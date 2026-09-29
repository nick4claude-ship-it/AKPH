<?php
/**
 * 0.6.1: «تنظیمات گزارش و چاپ» (letterhead, logo, signatories) and the signature slots of printed records,
 * with the four portal roles: only the system administrator changes the settings, every role reads them,
 * versions and Idempotency-Key as for every command, and signatures come from the server's approval history.
 */
class Test_Akph_Print extends Akph_Test_Case {
    /** @var string[] */
    private $tmp_files = array();

    public function set_up() {
        parent::set_up();
        delete_option(Akph_Petty_Cash::OPTION);
        delete_option(Akph_Treasury::OPTION);
    }

    public function tear_down() {
        foreach ($this->tmp_files as $f) {
            if (is_file($f)) {
                unlink($f);
            }
        }
        parent::tear_down();
    }

    private function call($who, $method, $path, $body = null, array $headers = array(), array $query = array()) {
        $this->login($who);
        return $this->request($method, $path, $body, $headers, $query);
    }

    private function ok($who, $method, $path, $body = array(), array $query = array()) {
        $response = $this->call($who, $method, $path, $method === 'GET' ? null : $body, array(), $query);
        $this->assertContains($response->get_status(), array(200, 201), "{$method} {$path} as {$who}: " . wp_json_encode($response->get_data(), JSON_UNESCAPED_UNICODE));
        return $response->get_data();
    }

    private function settings($who = 'accountant') {
        return $this->ok($who, 'GET', '/report-settings')['settings'];
    }

    private function signatures($who, $type, $id) {
        return $this->call($who, 'GET', '/print/signatures', null, array(), array('entity_type' => $type, 'entity_id' => (string) $id));
    }

    public function test_defaults_are_position_titles_without_any_name() {
        foreach (array('admin', 'senior', 'accountant', 'pm') as $who) {
            $s = $this->settings($who);
            $this->assertSame('آریا کاوش پی هامون', $s['company']['legal_name']);
            $this->assertSame('', $s['company']['national_id']);
            $this->assertNull($s['company']['logo_url']);
            $this->assertSame(1, $s['version']);
            foreach ($s['signatories']['projects'] as $slot) {
                $this->assertSame('', $slot['name'], 'no name by default');
                $this->assertNull($slot['user_id']);
            }
            $this->assertSame(array('تهیه‌کننده', 'حسابدار', 'مدیر مالی', 'مدیرعامل'), array_column($s['signatories']['projects'], 'title'));
            $this->assertSame(array(), $s['signatories']['journal_entry'], 'workflow records sign from their approval history');
        }
        $this->assertStatus(403, $this->call('norole', 'GET', '/report-settings'));
        $this->assertStatus(401, $this->call('guest', 'GET', '/report-settings'));
    }

    public function test_only_the_system_administrator_changes_the_settings() {
        $body = array('version' => 1, 'company' => array('national_id' => '10100000000'));
        foreach (array('senior', 'accountant', 'pm') as $who) {
            $this->assertStatus(403, $this->call($who, 'POST', '/report-settings', $body), $who);
            $this->assertStatus(403, $this->call($who, 'GET', '/report-settings/users'), $who);
            $this->assertStatus(403, $this->call($who, 'DELETE', '/report-settings/logo', array('version' => 1)), $who);
        }
        $this->assertFalse(user_can(self::$users['senior'], Akph_Roles::REPORT_SETTINGS));
        $this->assertTrue(user_can(self::$users['admin'], Akph_Roles::REPORT_SETTINGS));
        $this->assertSame(1, $this->settings()['version'], 'nothing changed');

        $users = $this->ok('admin', 'GET', '/report-settings/users')['users'];
        $ids = array_column($users, 'id');
        $this->assertContains((string) self::$users['accountant'], $ids);
        $this->assertNotContains((string) self::$users['norole'], $ids, 'only portal users');
        $this->assertArrayNotHasKey('email', $users[0]);
    }

    public function test_update_with_version_idempotency_and_audit() {
        $this->login('admin');
        $key = wp_generate_uuid4();
        $body = array(
            'version' => 1,
            'company' => array('legal_name' => 'شرکت آزمایشی', 'national_id' => '10100000000', 'registration_number' => '12345', 'address' => 'نشانی آزمایشی', 'phone' => '021-00000000'),
            'signatories' => array('projects' => array(
                array('title' => 'تهیه‌کننده', 'user_id' => (string) self::$users['accountant']),
                array('title' => 'مدیرعامل', 'name' => 'نام دستی'),
            )),
        );
        $first = $this->request('POST', '/report-settings', $body, array('Idempotency-Key' => $key));
        $this->assertStatus(200, $first);
        $s = $first->get_data()['records']['report_settings'][0];
        $this->assertSame(2, $s['version']);
        $this->assertSame('شرکت آزمایشی', $s['company']['legal_name']);
        $this->assertSame('کاربر accountant', $s['signatories']['projects'][0]['name'], 'the display name of the chosen user');
        $this->assertSame('نام دستی', $s['signatories']['projects'][1]['name']);
        $this->assertCount(4, $s['signatories']['financial'], 'other report types keep their slots');

        $again = $this->request('POST', '/report-settings', $body, array('Idempotency-Key' => $key));
        $this->assertSame('true', $again->get_headers()['Idempotency-Replayed']);
        $this->assertSame(2, $this->settings()['version'], 'the replay ran nothing');
        $this->assertSame(1, $this->count_rows('audit_log', "action = 'report_settings' AND user_id = " . self::$users['admin']));

        // Stale version → 409; version from If-Match works.
        $this->assertStatus(409, $this->call('admin', 'POST', '/report-settings', array('version' => 1, 'company' => array('phone' => '021-1'))));
        $this->assertStatus(428, $this->call('admin', 'POST', '/report-settings', array('company' => array('phone' => '021-1'))));
        $this->assertStatus(200, $this->call('admin', 'POST', '/report-settings', array('company' => array('phone' => '021-2')), array('If-Match' => '"2"')));
        $this->assertSame('021-2', $this->settings()['company']['phone']);
    }

    public function test_invalid_input_changes_nothing() {
        $bad = array(
            array('company' => array('national_id' => '12')),
            array('company' => array('legal_name' => '')),
            array('company' => array('logo_url' => 'http://x')),
            array('signatories' => array('unknown_type' => array())),
            array('signatories' => array('projects' => array(array('title' => '')))),
            array('signatories' => array('projects' => array(array('title' => 'x', 'user_id' => (string) self::$users['norole'])))),
            array('signatories' => array('projects' => array_fill(0, 7, array('title' => 'x')))),
            array('signatories' => array('projects' => array(array('title' => 'x', 'role' => 'administrator')))),
            array('company' => array('phone' => '021-1'), 'role' => 'administrator'),
        );
        foreach ($bad as $i => $b) {
            $response = $this->call('admin', 'POST', '/report-settings', array_merge(array('version' => 1), $b));
            $this->assertStatus(400, $response, "case {$i}");
        }
        $s = $this->settings();
        $this->assertSame(1, $s['version']);
        $this->assertSame('', $s['company']['phone']);
    }

    public function test_a_failed_write_is_rolled_back_completely() {
        $this->settings();
        $audit = Akph_Schema::table('audit_log');
        $fail = function ($sql) use ($audit) {
            return strpos($sql, 'INSERT INTO `' . $audit . '`') === 0 ? 'SELECT * FROM akph_no_such_table' : $sql;
        };
        add_filter('query', $fail);
        $response = $this->call('admin', 'POST', '/report-settings', array('version' => 1, 'company' => array('phone' => '021-9')));
        remove_filter('query', $fail);
        $this->assertStatus(500, $response);
        $s = $this->settings();
        $this->assertSame(1, $s['version']);
        $this->assertSame('', $s['company']['phone'], 'the settings row was rolled back with the audit row');
    }

    // ------------------------------------------------------------------ logo

    private function image_file($mime, $width = 900, $height = 300) {
        require_once ABSPATH . 'wp-admin/includes/file.php';
        $im = imagecreatetruecolor($width, $height);
        imagefill($im, 0, 0, imagecolorallocate($im, 30, 120, 200));
        $path = wp_tempnam('logo.' . ($mime === 'image/png' ? 'png' : 'jpg'));
        $mime === 'image/png' ? imagepng($im, $path) : imagejpeg($im, $path, 85);
        imagedestroy($im);
        $this->tmp_files[] = $path;
        return $path;
    }

    private function upload_logo($path, $name, $type, $version) {
        $request = new WP_REST_Request('POST', '/akph/v1/report-settings/logo');
        $request->set_header('X-WP-Nonce', wp_create_nonce('wp_rest'));
        $request->set_header('Idempotency-Key', wp_generate_uuid4());
        $request->set_header('If-Match', '"' . $version . '"');
        $request->set_file_params(array('logo' => array('name' => $name, 'type' => $type, 'tmp_name' => $path, 'error' => UPLOAD_ERR_OK, 'size' => filesize($path))));
        return rest_get_server()->dispatch($request);
    }

    public function test_logo_is_reencoded_proportionally_and_replaced() {
        $this->login('accountant');
        $this->assertStatus(403, $this->upload_logo($this->image_file('image/png'), 'logo.png', 'image/png', 1));

        $this->login('admin');
        $response = $this->upload_logo($this->image_file('image/png'), 'logo.png', 'image/png', 1);
        $this->assertStatus(200, $response);
        $s = $response->get_data()['records']['report_settings'][0];
        $this->assertSame(2, $s['version']);
        $row = Akph_Db::find(Akph_Schema::table('report_settings'), 1);
        $id = (int) $row->logo_id;
        $size = getimagesize(get_attached_file($id));
        $this->assertSame(array(600, 200), array($size[0], $size[1]), 'longer side 600 px, proportions kept');
        $this->assertSame(wp_get_attachment_url($id), $s['company']['logo_url']);
        $this->assertSame($s['company']['logo_url'], $this->settings('pm')['company']['logo_url'], 'every role prints with it');

        // Stale version, wrong type: refused, the logo stays.
        $this->login('admin');
        $this->assertStatus(409, $this->upload_logo($this->image_file('image/jpeg'), 'l.jpg', 'image/jpeg', 1));
        $fake = wp_tempnam('x.png');
        file_put_contents($fake, '<?php echo 1;');
        $this->tmp_files[] = $fake;
        $this->login('admin');
        $this->assertStatus(415, $this->upload_logo($fake, 'x.png', 'image/png', 2));

        $second = $this->upload_logo($this->image_file('image/jpeg', 120, 80), 'l.jpg', 'image/jpeg', 2);
        $this->assertStatus(200, $second);
        $this->assertNull(get_post($id), 'the previous logo is deleted');

        $this->assertStatus(409, $this->call('admin', 'DELETE', '/report-settings/logo', array('version' => 2)));
        $deleted = $this->ok('admin', 'DELETE', '/report-settings/logo', array('version' => 3));
        $this->assertNull($deleted['records']['report_settings'][0]['company']['logo_url']);
        $this->assertSame(1, $this->count_rows('audit_log', "action = 'report_logo_removed'"));
    }

    // ------------------------------------------------------------------ signatures from the approval history

    public function test_journal_entry_signatures_are_the_real_creator_and_approver() {
        $this->install_chart();
        $entry = $this->make_entry('accountant', Akph_Jalali::today_iso());
        $pending = $this->signatures('senior', 'journal_entry', $entry['id']);
        $this->assertStatus(200, $pending);
        $slots = $pending->get_data()['slots'];
        $this->assertSame('کاربر accountant', $slots[0]['name']);
        $this->assertTrue($slots[0]['signed']);
        $this->assertFalse($slots[1]['signed'], 'not approved yet: empty with a signature line');
        $this->assertSame('', $slots[1]['name']);
        $this->assertNull($slots[1]['at']);

        $this->ok('accountant2', 'POST', "/journal-entries/{$entry['id']}/post", array('version' => $entry['version']));
        // A configured extra slot (e.g. the managing director) follows the automatic ones.
        $this->ok('admin', 'POST', '/report-settings', array('version' => 1, 'signatories' => array('journal_entry' => array(array('title' => 'مدیرعامل')))));
        $data = $this->signatures('accountant', 'journal_entry', $entry['id'])->get_data();
        $this->assertMatchesRegularExpression('/^ACC-\d{4}-\d{5}$/', $data['number']);
        $this->assertSame('کاربر accountant2', $data['slots'][1]['name']);
        $this->assertTrue($data['slots'][1]['signed']);
        $this->assertNotNull($data['slots'][1]['at']);
        $this->assertSame(array('تهیه‌کننده', 'تأییدکننده', 'مدیرعامل'), array_column($data['slots'], 'title'));
        $this->assertSame('settings', $data['slots'][2]['source']);

        // Project managers do not read the journal; unknown types and ids are refused.
        $this->assertStatus(403, $this->signatures('pm', 'journal_entry', $entry['id']));
        $this->assertStatus(400, $this->signatures('accountant', 'contract_x', $entry['id']));
        $this->assertStatus(404, $this->signatures('accountant', 'journal_entry', 999999));
        $this->assertStatus(400, $this->call('accountant', 'GET', '/print/signatures', null, array(), array('entity_type' => 'journal_entry', 'entity_id' => $entry['id'], 'user_id' => '1')));
    }

    public function test_petty_expense_signatures_follow_the_chain_and_the_project_scope() {
        $this->install_chart();
        $project = $this->make_project(array('name' => 'پروژه یک', 'manager_user_id' => self::$users['pm']));
        $this->make_project(array('name' => 'پروژه دو', 'manager_user_id' => self::$users['pm2']));
        $today = Akph_Jalali::today_iso();
        // Money into the fund: bank deposit → replenishment (PM → accountant → senior) → payment.
        $bank = $this->ok('accountant', 'POST', '/treasury/accounts', array('kind' => 'bank', 'title' => 'بانک', 'bank_name' => 'بانک نمونه'))['records']['treasury_accounts'][0];
        $rec = $this->ok('accountant', 'POST', '/receipts', array('amount' => 5000000000, 'receipt_type' => 'other_income', 'payer_name' => 'واریز', 'account_id' => $bank['id'], 'method' => 'transfer'))['records']['receipts'][0];
        $this->ok('accountant2', 'POST', "/receipts/{$rec['id']}/approve", array('version' => $rec['version']));
        $receipt = $this->signatures('senior', 'receipt', $rec['id'])->get_data();
        $this->assertSame(array('کاربر accountant', 'کاربر accountant2'), array_column($receipt['slots'], 'name'));

        $fund = $this->ok('accountant', 'POST', '/petty-cash/funds', array('title' => 'تنخواه کارگاه', 'fund_type' => 'site_supervisor', 'project_id' => $project['id'], 'holder_user_id' => (string) self::$users['pm'], 'holder_name' => 'متصدی', 'ceiling' => 3000000000, 'max_single_expense' => 1000000000))['records']['petty_funds'][0];
        $req = $this->ok('accountant', 'POST', '/petty-cash/requests', array('fund_id' => $fund['id'], 'amount' => 2000000000, 'reason' => 'شارژ'))['records']['petty_requests'][0];
        $this->ok('pm', 'POST', "/petty-cash/requests/{$req['id']}/approve", array('version' => 1));
        $this->ok('accountant2', 'POST', "/petty-cash/requests/{$req['id']}/approve", array('version' => 2));
        $pr = $this->ok('senior', 'POST', "/petty-cash/requests/{$req['id']}/approve", array('version' => 3))['records']['payment_requests'][0];
        $this->ok('accountant', 'POST', "/payment-requests/{$pr['id']}/pay", array('version' => $pr['version'], 'amount' => 2000000000, 'account_id' => $bank['id'], 'method' => 'satna', 'tracking' => 'S-1'));

        $r = $this->signatures('pm', 'petty_request', $req['id'])->get_data();
        $this->assertSame(array('کاربر accountant', 'کاربر pm', 'کاربر accountant2', 'کاربر senior'), array_column($r['slots'], 'name'));
        $pay = $this->signatures('accountant', 'payment_request', $pr['id'])->get_data();
        $this->assertSame('کاربر senior', $pay['slots'][1]['name']);
        $this->assertSame('کاربر accountant', $pay['slots'][2]['name'], 'the payer');

        // Second level expense (PM → accountant): after the PM only, the accountant slot is still empty.
        $exp = $this->ok('senior', 'POST', '/petty-cash/expenses', array('fund_id' => $fund['id'], 'amount' => 600000000, 'date' => $today, 'description' => 'اجاره'))['records']['petty_expenses'][0];
        $this->ok('pm', 'POST', "/petty-cash/expenses/{$exp['id']}/approve", array('version' => 1));
        $mid = $this->signatures('accountant', 'petty_expense', $exp['id'])->get_data();
        $this->assertSame(array('تنخواه‌دار (ثبت‌کننده)', 'تأیید مدیر پروژه', 'تأیید حسابدار'), array_column($mid['slots'], 'title'));
        $this->assertSame(array(true, true, false), array_column($mid['slots'], 'signed'));
        $this->assertSame('کاربر pm', $mid['slots'][1]['name']);

        // Project scope: the other project's manager sees nothing of it; headquarters records neither.
        $this->assertStatus(403, $this->signatures('pm2', 'petty_expense', $exp['id']));
        $this->assertStatus(403, $this->signatures('pm2', 'petty_request', $req['id']));
        $this->assertStatus(403, $this->signatures('pm', 'receipt', $rec['id']));
        $this->assertStatus(403, $this->signatures('pm', 'payment_request', $pr['id']));
    }

    public function test_vat_rate_is_a_server_setting_of_the_settings_roles() {
        $this->assertSame(10, $this->ok('accountant', 'GET', '/treasury/settings')['settings']['vat_rate_percent'], 'default 10%');
        $this->assertStatus(403, $this->call('accountant', 'POST', '/treasury/settings', array('vat_rate_percent' => 9)));
        $this->assertStatus(403, $this->call('pm', 'POST', '/treasury/settings', array('vat_rate_percent' => 9)));
        $this->assertStatus(400, $this->call('senior', 'POST', '/treasury/settings', array('vat_rate_percent' => 101)));
        $this->assertStatus(400, $this->call('senior', 'POST', '/treasury/settings', array('vat_rate_percent' => '9')));
        $saved = $this->ok('senior', 'POST', '/treasury/settings', array('vat_rate_percent' => 9));
        $this->assertSame(9, $saved['records']['treasury_settings'][0]['vat_rate_percent']);
        $this->assertSame(9, Akph_Treasury::settings()['vat_rate_percent']);
        $this->assertSame(1, $this->count_rows('audit_log', "action = 'treasury_settings' AND user_id = " . self::$users['senior']));
    }
}
