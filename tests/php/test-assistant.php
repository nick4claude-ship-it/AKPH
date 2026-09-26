<?php
/**
 * «دستیار مدیریت» through the server: the API key is stored encrypted and never returned; only the system
 * administrator changes the settings; akph_assistant_use is required to ask; the daily limit holds; the model
 * receives only what the asking user may see (wp_remote_post is replaced by a fake that records the body).
 */
class Test_Akph_Assistant extends Akph_Test_Case {
    const KEY = 'sk-test-SECRET-KEY-abcd1234';

    /** @var array[] requests sent to the provider */
    private $sent = array();
    /** @var array|null next fake response (null: a normal answer) */
    private $reply = null;

    public function set_up() {
        parent::set_up();
        delete_option(Akph_Assistant::OPTION);
        $this->sent = array();
        $this->reply = null;
        add_filter('pre_http_request', array($this, 'fake_http'), 10, 3);
    }

    public function tear_down() {
        remove_filter('pre_http_request', array($this, 'fake_http'), 10);
        parent::tear_down();
    }

    public function fake_http($pre, $args, $url) {
        $this->sent[] = array('url' => $url, 'args' => $args, 'body' => json_decode($args['body'], true));
        if ($this->reply !== null) {
            return $this->reply;
        }
        return self::http(200, array('content' => array(array('type' => 'text', 'text' => 'پاسخ آزمایشی دستیار')), 'stop_reason' => 'end_turn', 'usage' => array('input_tokens' => 120, 'output_tokens' => 30)));
    }

    private static function http($code, $body) {
        return array('headers' => array(), 'body' => is_string($body) ? $body : wp_json_encode($body), 'response' => array('code' => $code, 'message' => ''), 'cookies' => array(), 'filename' => null);
    }

    private function configure(array $extra = array()) {
        $previous = get_current_user_id();
        $this->login('admin');
        $response = $this->request('POST', '/assistant/settings', array_merge(array('enabled' => true, 'provider' => 'anthropic', 'model' => 'claude-opus-5', 'api_key' => self::KEY, 'daily_limit' => 5, 'max_tokens' => 2048), $extra));
        $this->assertStatus(200, $response);
        wp_set_current_user($previous);
        Akph_Auth::flush();
        return $response;
    }

    private function ask($question = 'وضعیت پروژه‌ها چطور است؟', array $extra = array()) {
        return $this->request('POST', '/assistant/ask', array_merge(array('question' => $question), $extra));
    }

    public function test_key_is_stored_encrypted_and_never_returned() {
        $saved = $this->configure();
        $stored = get_option(Akph_Assistant::OPTION);
        $this->assertStringStartsWith('v1:', $stored['key_cipher']);
        $this->assertStringNotContainsString(self::KEY, wp_json_encode($stored));
        $this->assertStringNotContainsString('abcd1234', $stored['key_cipher']);

        $this->login('admin');
        $settings = $this->request('GET', '/assistant/settings')->get_data()['settings'];
        $this->assertSame(array('source' => 'settings', 'hint' => '•••• 1234'), $settings['key']);
        $this->assertTrue($settings['configured']);

        // The key is used for the provider call...
        $this->login('pm');
        $answer = $this->ask();
        $this->assertStatus(200, $answer);
        $this->assertSame(self::KEY, $this->sent[0]['args']['headers']['x-api-key']);
        // ...and appears in no response, audit row, stored command or request log.
        $this->reply = self::http(401, array('error' => array('message' => 'invalid x-api-key ' . self::KEY)));
        $failed = $this->ask('پرسش دوم');
        $this->assertStatus(502, $failed);
        $this->login('admin');
        $test = $this->request('POST', '/assistant/test', array());
        $this->assertFalse($test->get_data()['ok']);
        $responses = array($saved, $answer, $failed, $test, $this->request('GET', '/assistant/settings'), $this->request('GET', '/assistant/status'), $this->request('GET', '/me'), $this->request('GET', '/audit'));
        foreach ($responses as $response) {
            $this->assertStringNotContainsString(self::KEY, wp_json_encode($response->get_data()));
            $this->assertStringNotContainsString('abcd1234', wp_json_encode($response->get_data()));
        }
        global $wpdb;
        foreach (array('audit_log', 'idempotency_keys', 'ai_requests') as $table) {
            foreach ((array) $wpdb->get_results('SELECT * FROM ' . Akph_Schema::table($table), ARRAY_A) as $row) {
                $this->assertStringNotContainsString(self::KEY, wp_json_encode($row), $table);
            }
        }
    }

    public function test_clear_key_removes_the_stored_key() {
        $this->configure();
        $this->login('admin');
        $cleared = $this->request('POST', '/assistant/settings', array('clear_key' => true));
        $this->assertStatus(200, $cleared);
        $this->assertSame('none', $cleared->get_data()['records']['assistant_settings'][0]['key']['source']);
        $this->assertFalse($cleared->get_data()['records']['assistant_settings'][0]['configured']);
        $this->login('pm');
        $this->assertStatus(503, $this->ask());
    }

    public function test_settings_are_for_the_system_administrator_only() {
        foreach (array('senior', 'accountant', 'pm') as $who) {
            $this->login($who);
            foreach (array(array('GET', '/assistant/settings', null), array('POST', '/assistant/settings', array('enabled' => true)), array('POST', '/assistant/test', array())) as $r) {
                $response = $this->request($r[0], $r[1], $r[2]);
                $this->assertStatus(403, $response, "{$r[0]} {$r[1]} as {$who}");
                $this->assertSame('akph_role_forbidden', $this->errorCode($response));
            }
        }
        $this->assertFalse(get_option(Akph_Assistant::OPTION));
        $this->login('admin');
        $unknown = $this->request('POST', '/assistant/settings', array('enabled' => true, 'role' => 'administrator'));
        $this->assertStatus(400, $unknown);
        $this->assertStatus(400, $this->request('POST', '/assistant/settings', array('provider' => 'compatible', 'base_url' => 'http://insecure.example.test/v1')));
        $this->assertStatus(400, $this->request('POST', '/assistant/settings', array('provider' => 'compatible')));
    }

    public function test_every_role_may_ask_and_a_user_without_the_capability_gets_403() {
        foreach (self::ROLE_KEYS as $key => $role) {
            if ($role !== 'subscriber') {
                $this->assertTrue(get_role($role)->has_cap(Akph_Roles::ASSISTANT_USE), $role);
            }
        }
        $this->assertTrue(get_role('administrator')->has_cap(Akph_Roles::AI_MANAGE));
        $this->assertFalse(get_role('paydar_senior_manager')->has_cap(Akph_Roles::AI_MANAGE));

        $this->configure();
        $this->login('norole');
        $this->assertStatus(403, $this->ask());
        $this->login('guest');
        $this->assertStatus(401, $this->ask());

        $user = new WP_User(self::$users['accountant']);
        $user->add_cap(Akph_Roles::ASSISTANT_USE, false);
        try {
            $this->login('accountant');
            $response = $this->ask();
            $this->assertStatus(403, $response);
            $this->assertSame('akph_role_forbidden', $this->errorCode($response));
            $this->assertStatus(403, $this->request('GET', '/assistant/status'));
        } finally {
            $user->remove_cap(Akph_Roles::ASSISTANT_USE);
        }
        $this->assertSame(array(), $this->sent);
    }

    public function test_disabled_or_unconfigured_assistant_answers_503_without_calling_out() {
        $this->login('accountant');
        $response = $this->ask();
        $this->assertStatus(503, $response);
        $this->assertSame('akph_assistant_disabled', $this->errorCode($response));
        $this->assertSame(Akph_Assistant::DISABLED_MESSAGE, $response->get_data()['message']);
        $this->assertFalse($this->request('GET', '/assistant/status')->get_data()['enabled']);
        $this->configure(array('enabled' => false));
        $this->login('accountant');
        $this->assertStatus(503, $this->ask());
        $this->assertSame(array(), $this->sent);
    }

    public function test_daily_limit_is_enforced_per_user() {
        $this->configure(array('daily_limit' => 2));
        $this->login('accountant');
        $first = $this->ask('پرسش ۱');
        $this->assertStatus(200, $first);
        $this->assertSame(1, $first->get_data()['remaining']);
        // A failed provider call does not use up the limit.
        $this->reply = self::http(500, 'down');
        $this->assertStatus(502, $this->ask('پرسش خطا'));
        $this->reply = null;
        $this->assertStatus(200, $this->ask('پرسش ۲'));
        $third = $this->ask('پرسش ۳');
        $this->assertStatus(429, $third);
        $this->assertSame('akph_daily_limit', $this->errorCode($third));
        $this->assertCount(3, $this->sent, 'the refused question is not sent');
        $this->assertSame(0, $this->request('GET', '/assistant/status')->get_data()['remaining']);
        // Another user has their own limit.
        $this->login('senior');
        $this->assertStatus(200, $this->ask('پرسش دیگر'));
        // The request log: user, time, tokens and outcome; no text unless the administrator enabled it.
        global $wpdb;
        $rows = $wpdb->get_results('SELECT * FROM ' . Akph_Schema::table('ai_requests') . ' WHERE user_id = ' . self::$users['accountant'] . ' ORDER BY id');
        $this->assertSame(array('ok', 'error', 'ok'), wp_list_pluck($rows, 'status'));
        $this->assertSame('120', $rows[0]->input_tokens);
        $this->assertSame('30', $rows[0]->output_tokens);
        $this->assertNull($rows[0]->question);
        $this->assertNull($rows[0]->answer);
    }

    public function test_full_text_is_logged_only_when_enabled() {
        $this->configure(array('log_content' => true));
        $this->login('pm');
        $this->assertStatus(200, $this->ask('پرسش ثبت‌شدنی'));
        global $wpdb;
        $row = $wpdb->get_row('SELECT * FROM ' . Akph_Schema::table('ai_requests'));
        $this->assertSame('پرسش ثبت‌شدنی', $row->question);
        $this->assertSame('پاسخ آزمایشی دستیار', $row->answer);
    }

    public function test_project_manager_context_has_only_own_projects_and_no_headquarters_figures() {
        $this->install_chart();
        $own = $this->make_project(array('name' => 'پروژه تحت مدیریت الف', 'manager_user_id' => self::$users['pm']));
        $this->make_project(array('name' => 'پروژه محرمانه دیگر', 'manager_user_id' => self::$users['pm2']));
        $today = Akph_Jalali::today_iso();
        // A headquarters entry (no project) and an entry of the manager's project, both posted.
        $this->login('accountant');
        $hq = $this->request('POST', '/journal-entries', $this->entry_body($today, 7770000000))->get_data()['records']['journal_entries'][0];
        $body = $this->entry_body($today, 3330000000);
        $body['lines'][0]['project_id'] = $own['id'];
        $body['lines'][1]['project_id'] = $own['id'];
        $project_entry = $this->request('POST', '/journal-entries', $body)->get_data()['records']['journal_entries'][0];
        $this->login('accountant2');
        foreach (array($hq, $project_entry) as $e) {
            $this->assertStatus(200, $this->request('POST', "/journal-entries/{$e['id']}/post", array('version' => $e['version'])));
        }
        wp_update_user(array('ID' => self::$users['pm2'], 'user_email' => 'hidden-person@example.org'));
        update_user_meta(self::$users['pm'], Akph_Account::META_MOBILE, '09120000000');

        $this->configure();
        $this->login('pm');
        $this->assertStatus(200, $this->ask('وضعیت مالی پروژه‌هایم چیست؟'));
        $system = $this->sent[0]['body']['system'];
        $this->assertStringContainsString('پروژه تحت مدیریت الف', $system);
        $this->assertStringNotContainsString('پروژه محرمانه دیگر', $system);
        $this->assertStringContainsString('333,000,000', $system, 'own project figures (toman)');
        $this->assertStringNotContainsString('777,000,000', $system, 'no headquarters entry');
        $this->assertStringNotContainsString('1,110,000,000', $system, 'no company-wide total');
        $this->assertStringNotContainsString('اسناد حسابداری سال مالی', $system);
        $this->assertStringContainsString('بدون داده‌های ستادی', $system);
        foreach (array('@example.org', '09120000000', 'example.com') as $private) {
            $this->assertStringNotContainsString($private, wp_json_encode($this->sent[0]['body']));
        }

        // The accountant (akph_view_all) gets both projects and the headquarters figures.
        $this->login('accountant');
        $this->assertStatus(200, $this->ask('وضعیت کل شرکت؟'));
        $system = $this->sent[1]['body']['system'];
        $this->assertStringContainsString('پروژه محرمانه دیگر', $system);
        $this->assertStringContainsString('1,110,000,000', $system);
        $this->assertStringContainsString('اسناد حسابداری سال مالی', $system);
    }

    public function test_request_shape_rules_and_conversation() {
        $this->configure();
        $this->login('senior');
        $first = $this->ask('پرسش نخست');
        $this->assertStatus(200, $first);
        $sent = $this->sent[0];
        $this->assertSame('https://api.anthropic.com/v1/messages', $sent['url']);
        $this->assertSame('2023-06-01', $sent['args']['headers']['anthropic-version']);
        $this->assertSame(Akph_Assistant::TIMEOUT, $sent['args']['timeout']);
        $this->assertSame(0, $sent['args']['redirection']);
        $this->assertSame('claude-opus-5', $sent['body']['model']);
        $this->assertSame(2048, $sent['body']['max_tokens']);
        $this->assertStringContainsString('فقط از داده‌های داخل <data>', $sent['body']['system']);
        $this->assertStringContainsString('فقط خواندنی هستی', $sent['body']['system']);
        $this->assertStringContainsString('داده کافی برای پاسخ به این پرسش در دسترس نیست', $sent['body']['system']);
        $this->assertSame(array(array('role' => 'user', 'content' => 'پرسش نخست')), $sent['body']['messages']);
        $this->assertSame('پاسخ آزمایشی دستیار', $first->get_data()['answer']);

        // The same conversation sends the previous turn again.
        $conversation = $first->get_data()['conversation_id'];
        $this->assertStatus(200, $this->ask('پرسش دوم', array('conversation_id' => $conversation)));
        $this->assertSame(array('user', 'assistant', 'user'), wp_list_pluck($this->sent[1]['body']['messages'], 'role'));

        $this->assertStatus(400, $this->ask(str_repeat('ا', Akph_Assistant::QUESTION_MAX + 1)));
        $this->assertStatus(400, $this->ask('   '));
        $this->assertStatus(400, $this->ask('پرسش', array('user_id' => self::$users['pm'])));
        $this->assertStatus(400, $this->ask('پرسش', array('conversation_id' => '../x')));
        $this->assertCount(2, $this->sent);

        // Refusals and cut answers.
        $this->reply = self::http(200, array('content' => array(), 'stop_reason' => 'refusal', 'usage' => array('input_tokens' => 5, 'output_tokens' => 0)));
        $refused = $this->ask('پرسش سوم');
        $this->assertStatus(200, $refused);
        $this->assertStringContainsString('پاسخی تولید نشد', $refused->get_data()['answer']);
    }

    public function test_openai_compatible_service() {
        $this->configure(array('provider' => 'compatible', 'base_url' => 'https://llm.example.test/v1/', 'model' => 'local-model'));
        $this->reply = self::http(200, array('choices' => array(array('message' => array('content' => 'پاسخ سرویس سازگار'), 'finish_reason' => 'stop')), 'usage' => array('prompt_tokens' => 50, 'completion_tokens' => 9)));
        $this->login('accountant');
        $response = $this->ask('سلام');
        $this->assertStatus(200, $response);
        $this->assertSame('پاسخ سرویس سازگار', $response->get_data()['answer']);
        $sent = $this->sent[0];
        $this->assertSame('https://llm.example.test/v1/chat/completions', $sent['url']);
        $this->assertSame('Bearer ' . self::KEY, $sent['args']['headers']['Authorization']);
        $this->assertSame('system', $sent['body']['messages'][0]['role']);
        $this->assertSame(2048, $sent['body']['max_tokens']);
        $this->assertSame('local-model', $sent['body']['model']);

        $this->configure(array('provider' => 'openai', 'base_url' => '', 'model' => 'gpt-model'));
        $this->login('accountant');
        $this->assertStatus(200, $this->ask('سلام دوباره'));
        $this->assertSame('https://api.openai.com/v1/chat/completions', $this->sent[1]['url']);
        $this->assertSame(2048, $this->sent[1]['body']['max_completion_tokens']);
    }
}
