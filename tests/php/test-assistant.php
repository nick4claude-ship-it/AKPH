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

    public function test_operations_context_without_payroll_personal_data() {
        $this->install_chart();
        delete_option(Akph_Payroll::OPTION);
        $own = $this->make_project(array('name' => 'پروژه الف', 'manager_user_id' => self::$users['pm']));
        $this->login('accountant');
        $material = $this->request('POST', '/materials', array('name' => 'میلگرد', 'unit' => 'kg'))->get_data()['records']['materials'][0];
        $center = $this->request('POST', '/cost-centers', array('name' => 'کارگاه الف', 'project_id' => $own['id'], 'type' => 'project_site'))->get_data()['records']['cost_centers'][0];
        $this->assertStatus(201, $this->request('POST', '/employees', array('full_name' => 'نام‌خانوادگی‌محرمانه', 'national_id' => '0012345678', 'sheba' => 'IR' . str_repeat('1', 24), 'cost_center_id' => $center['id'], 'base_salary' => 123456789)));
        $this->assertStatus(201, $this->request('POST', '/payroll/periods', array('fiscal_year' => 1405, 'month' => 7)));
        $this->login('pm');
        $this->assertStatus(201, $this->request('POST', '/requisitions', array('project_id' => $own['id'], 'justification' => 'آزمون', 'lines' => array(array('material_id' => $material['id'], 'quantity' => '5')))));

        $this->configure();
        foreach (array('pm', 'accountant', 'senior') as $i => $who) {
            $this->login($who);
            $this->assertStatus(200, $this->ask('وضعیت خرید و حقوق؟'));
            $sent = wp_json_encode($this->sent[$i]['body'], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
            $this->assertStringContainsString('درخواست خرید: در انتظار تأیید 1', $sent, $who);
            foreach (array('نام‌خانوادگی‌محرمانه', '0012345678', str_repeat('1', 24), '123,456,789', '12,345,678') as $private) {
                $this->assertStringNotContainsString($private, $sent, "no payroll personal data for {$who}");
            }
            if ($who === 'pm') {
                $this->assertStringNotContainsString('حقوق (فقط وضعیت', $sent, 'no payroll for the project manager');
                $this->assertStringNotContainsString('ارزش موجودی انبارها', $sent);
            } else {
                $this->assertStringContainsString('آخرین دوره 1405/7 — پیش‌نویس کارکرد', $sent);
            }
        }
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

    // ------------------------------------------------------------------ Google Gemini

    const PROXY_TOKEN = 'proxy-SECRET-token-9876';

    private static function gemini($text = 'پاسخ Gemini', $finish = 'STOP', array $extra = array()) {
        return self::http(200, array_merge(array(
            'candidates' => array(array('content' => array('role' => 'model', 'parts' => array(array('text' => 'در حال فکر کردن', 'thought' => true), array('text' => $text))), 'finishReason' => $finish)),
            'usageMetadata' => array('promptTokenCount' => 321, 'candidatesTokenCount' => 12, 'thoughtsTokenCount' => 30, 'totalTokenCount' => 363),
        ), $extra));
    }

    private static function google_error($code, $status, $message, array $reasons = array()) {
        $details = array();
        foreach ($reasons as $reason) {
            $details[] = array('@type' => 'type.googleapis.com/google.rpc.ErrorInfo', 'reason' => $reason, 'domain' => 'googleapis.com');
        }
        return self::http($code, array('error' => array('code' => $code, 'message' => $message, 'status' => $status, 'details' => $details)));
    }

    private function configure_gemini(array $extra = array()) {
        return $this->configure(array_merge(array('provider' => 'gemini', 'model' => 'gemini-3.8-flash', 'base_url' => '', 'daily_limit' => 50), $extra));
    }

    public function test_gemini_is_the_default_provider() {
        $settings = Akph_Assistant::public_settings();
        $this->assertSame('gemini', $settings['provider']);
        $this->assertSame('gemini-3.8-flash', $settings['model']);
        $this->assertSame('', $settings['base_url']);
        $this->assertSame(array('source' => 'none', 'hint' => ''), $settings['proxy_token']);
        // A site that chose another provider keeps it.
        update_option(Akph_Assistant::OPTION, array('provider' => 'anthropic'));
        $this->assertSame('anthropic', Akph_Assistant::public_settings()['provider']);
        $this->assertSame('claude-opus-5', Akph_Assistant::public_settings()['model']);
    }

    public function test_gemini_request_uses_the_key_header_and_generate_content() {
        $this->configure_gemini(array('model' => 'models/gemini-3.8-flash'));
        $this->reply = self::gemini();
        $this->login('senior');
        $first = $this->ask('پرسش نخست');
        $this->assertStatus(200, $first);
        $this->assertSame('پاسخ Gemini', $first->get_data()['answer'], 'thought parts are left out');

        $sent = $this->sent[0];
        $this->assertSame('https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent', $sent['url']);
        $this->assertStringNotContainsString(self::KEY, $sent['url'], 'the key is never in the URL');
        $this->assertStringNotContainsString('key=', $sent['url']);
        $this->assertSame(self::KEY, $sent['args']['headers']['x-goog-api-key']);
        $this->assertArrayNotHasKey('Authorization', $sent['args']['headers']);
        $this->assertArrayNotHasKey(Akph_Assistant::PROXY_HEADER, $sent['args']['headers']);
        $this->assertStringNotContainsString(self::KEY, $sent['args']['body'], 'nor in the body');
        $this->assertSame(0, $sent['args']['redirection'], 'no redirect can carry the key elsewhere');
        $this->assertSame(Akph_Assistant::TIMEOUT, $sent['args']['timeout']);

        $body = $sent['body'];
        $this->assertSame(array('systemInstruction', 'contents', 'generationConfig'), array_keys($body));
        $this->assertStringContainsString('فقط از داده‌های داخل <data>', $body['systemInstruction']['parts'][0]['text']);
        $this->assertStringContainsString('فقط خواندنی هستی', $body['systemInstruction']['parts'][0]['text']);
        $this->assertSame(array(array('role' => 'user', 'parts' => array(array('text' => 'پرسش نخست')))), $body['contents']);
        $this->assertSame(array('maxOutputTokens' => 2048), $body['generationConfig']);

        // Earlier turns go back with the Gemini roles user / model.
        $this->assertStatus(200, $this->ask('پرسش دوم', array('conversation_id' => $first->get_data()['conversation_id'])));
        $this->assertSame(array('user', 'model', 'user'), wp_list_pluck($this->sent[1]['body']['contents'], 'role'));
        $this->assertSame('پاسخ Gemini', $this->sent[1]['body']['contents'][1]['parts'][0]['text']);

        // Token use from usageMetadata (thinking counts as output).
        global $wpdb;
        $row = $wpdb->get_row('SELECT * FROM ' . Akph_Schema::table('ai_requests') . ' ORDER BY id ASC LIMIT 1');
        $this->assertSame('gemini', $row->provider);
        $this->assertSame(321, (int) $row->input_tokens);
        $this->assertSame(42, (int) $row->output_tokens);
        $this->assertSame('ok', $row->status);

        // The connection test goes the same way.
        $this->login('admin');
        $test = $this->request('POST', '/assistant/test', array());
        $this->assertTrue($test->get_data()['ok']);
        $this->assertSame(64, end($this->sent)['body']['generationConfig']['maxOutputTokens']);
        $this->assertSame(self::KEY, end($this->sent)['args']['headers']['x-goog-api-key']);
    }

    public function test_gemini_errors_and_blocks_are_translated() {
        $this->configure_gemini();
        $this->login('accountant');
        $cases = array(
            array(self::google_error(400, 'INVALID_ARGUMENT', 'API key not valid. Please pass a valid API key. ' . self::KEY, array('API_KEY_INVALID')), 'akph_assistant_auth', 'Google AI Studio'),
            array(self::google_error(403, 'PERMISSION_DENIED', 'Permission denied', array('API_KEY_INVALID')), 'akph_assistant_auth', 'Google AI Studio'),
            array(self::google_error(400, 'FAILED_PRECONDITION', 'User location is not supported for the API use.'), 'akph_assistant_region', Akph_Assistant::REGION_MESSAGE),
            array(self::google_error(429, 'RESOURCE_EXHAUSTED', 'Quota exceeded'), 'akph_assistant_quota', 'سهمیه'),
            array(self::google_error(404, 'NOT_FOUND', 'models/x is not found'), 'akph_assistant_request', 'مدل'),
            array(self::google_error(403, 'PERMISSION_DENIED', 'The caller does not have permission'), 'akph_assistant_auth', 'Gemini'),
            array(self::google_error(503, 'UNAVAILABLE', 'The model is overloaded'), 'akph_assistant_unavailable', 'Gemini'),
            array(new WP_Error('http_request_failed', 'cURL error 28'), 'akph_assistant_unreachable', 'واسط'),
        );
        foreach ($cases as $i => $case) {
            $this->reply = $case[0];
            $response = $this->ask('پرسش ' . $i);
            $this->assertStatus(502, $response, $case[1]);
            $this->assertSame($case[1], $this->errorCode($response));
            $this->assertStringContainsString($case[2], $response->get_data()['message']);
            $this->assertStringNotContainsString(self::KEY, wp_json_encode($response->get_data()));
            $this->assertStringNotContainsString('API key not valid', wp_json_encode($response->get_data()), 'the provider text is not passed on');
        }
        $this->assertSame(Akph_Assistant::REGION_MESSAGE, 'سرور سایت از منطقه‌ای درخواست می‌دهد که Gemini پشتیبانی نمی‌کند؛ نشانی پایه یک واسط خارج از ایران را وارد کنید.');

        // The connection test reports the same message.
        $this->login('admin');
        $this->reply = self::google_error(400, 'FAILED_PRECONDITION', 'User location is not supported for the API use.');
        $test = $this->request('POST', '/assistant/test', array())->get_data();
        $this->assertFalse($test['ok']);
        $this->assertSame(Akph_Assistant::REGION_MESSAGE, $test['message']);

        // Safety blocks of the prompt or of the answer: a refusal with its own message.
        $this->login('accountant');
        $blocked = array(
            self::http(200, array('promptFeedback' => array('blockReason' => 'SAFETY'), 'usageMetadata' => array('promptTokenCount' => 10))),
            self::gemini('', 'SAFETY'),
            self::gemini('متن ناتمام', 'PROHIBITED_CONTENT'),
        );
        foreach ($blocked as $reply) {
            $this->reply = $reply;
            $response = $this->ask('پرسش مسدود');
            $this->assertStatus(200, $response);
            $this->assertStringContainsString('سیاست‌های ایمنی', $response->get_data()['answer']);
            $this->assertStringNotContainsString('متن ناتمام', $response->get_data()['answer']);
        }
        global $wpdb;
        $this->assertSame(3, (int) $wpdb->get_var('SELECT COUNT(*) FROM ' . Akph_Schema::table('ai_requests') . " WHERE status = 'refused'"));
        $this->assertSame(count($cases), (int) $wpdb->get_var('SELECT COUNT(*) FROM ' . Akph_Schema::table('ai_requests') . " WHERE status = 'error'"));

        // Cut at the token limit: with text it is marked, with thinking only the limit is named.
        $this->reply = self::gemini('پاسخ نیمه', 'MAX_TOKENS');
        $cut = $this->ask('پرسش طولانی')->get_data();
        $this->assertTrue($cut['truncated']);
        $this->assertStringStartsWith('پاسخ نیمه', $cut['answer']);
        $this->reply = self::gemini('', 'MAX_TOKENS');
        $this->assertStringContainsString('حداکثر توکن پاسخ', $this->ask('پرسش سنگین')->get_data()['answer']);
    }

    public function test_gemini_through_a_proxy_with_an_encrypted_proxy_token() {
        $saved = $this->configure_gemini(array('base_url' => 'https://proxy.example.test/', 'proxy_token' => self::PROXY_TOKEN));
        $stored = get_option(Akph_Assistant::OPTION);
        $this->assertStringStartsWith('v1:', $stored['proxy_cipher']);
        $this->assertStringNotContainsString(self::PROXY_TOKEN, wp_json_encode($stored));
        $this->login('admin');
        $settings = $this->request('GET', '/assistant/settings');
        $this->assertSame(array('source' => 'settings', 'hint' => '•••• 9876'), $settings->get_data()['settings']['proxy_token']);

        $this->reply = self::gemini();
        $this->login('pm');
        $answer = $this->ask();
        $this->assertStatus(200, $answer);
        $sent = $this->sent[0];
        $this->assertSame('https://proxy.example.test/v1beta/models/gemini-3.8-flash:generateContent', $sent['url']);
        $this->assertSame(self::PROXY_TOKEN, $sent['args']['headers'][Akph_Assistant::PROXY_HEADER], 'its own header');
        $this->assertSame(self::KEY, $sent['args']['headers']['x-goog-api-key']);
        $this->assertStringNotContainsString(self::PROXY_TOKEN, $sent['url']);

        // The proxy refusing the token.
        $this->reply = self::http(401, 'unauthorized');
        $refused = $this->ask('پرسش دوم');
        $this->assertStatus(502, $refused);
        $this->assertSame('akph_assistant_proxy', $this->errorCode($refused));

        // Neither the token nor the key in any response or stored row.
        $this->login('admin');
        $responses = array($saved, $settings, $answer, $refused, $this->request('GET', '/assistant/status'), $this->request('GET', '/audit'), $this->request('POST', '/assistant/test', array()));
        foreach ($responses as $response) {
            $json = wp_json_encode($response->get_data());
            $this->assertStringNotContainsString(self::PROXY_TOKEN, $json);
            $this->assertStringNotContainsString(self::KEY, $json);
        }
        global $wpdb;
        foreach (array('audit_log', 'idempotency_keys', 'ai_requests') as $table) {
            foreach ((array) $wpdb->get_results('SELECT * FROM ' . Akph_Schema::table($table), ARRAY_A) as $row) {
                $this->assertStringNotContainsString(self::PROXY_TOKEN, wp_json_encode($row), $table);
            }
        }

        // The official address never receives the proxy token.
        $this->configure_gemini(array('base_url' => ''));
        $this->reply = self::gemini();
        $this->login('pm');
        $this->assertStatus(200, $this->ask('پرسش سوم'));
        $this->assertArrayNotHasKey(Akph_Assistant::PROXY_HEADER, end($this->sent)['args']['headers']);

        // Validation and removal.
        $this->login('admin');
        $short = $this->request('POST', '/assistant/settings', array('proxy_token' => 'short'));
        $this->assertStatus(400, $short);
        $this->assertSame('proxy_token', $short->get_data()['data']['field']);
        $this->assertStatus(400, $this->request('POST', '/assistant/settings', array('proxy_token' => "token-with-new-line\r\nX: y")));
        $cleared = $this->request('POST', '/assistant/settings', array('clear_proxy_token' => true));
        $this->assertSame('none', $cleared->get_data()['records']['assistant_settings'][0]['proxy_token']['source']);
    }
}
