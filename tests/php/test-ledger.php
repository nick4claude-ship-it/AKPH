<?php
/**
 * Manual journal entries: separation of duties, idempotency, version conflicts, yearly numbering, balance,
 * group accounts, immutability of posted entries, reversal, rollback and audit.
 */
class Test_Akph_Ledger extends Akph_Test_Case {
    public function set_up() {
        parent::set_up();
        $this->install_chart();
    }

    private function post_entry($entry, $as) {
        $this->login($as);
        return $this->request('POST', "/journal-entries/{$entry['id']}/post", array('version' => $entry['version']));
    }

    public function test_creator_cannot_approve_own_entry() {
        $entry = $this->make_entry('accountant', '2026-04-10');
        $this->assertSame('pending', $entry['status']);
        $this->assertMatchesRegularExpression('/^DRF-1405-\d{5}$/', $entry['draft_number']);
        $this->assertNull($entry['doc_number']);

        $own = $this->post_entry($entry, 'accountant');
        $this->assertStatus(403, $own);
        $this->assertSame('akph_segregation_of_duties', $this->errorCode($own));
        $reject_own = $this->request('POST', "/journal-entries/{$entry['id']}/reject", array('version' => $entry['version'], 'reason' => 'x'));
        $this->assertSame('akph_segregation_of_duties', $this->errorCode($reject_own));

        $ok = $this->post_entry($entry, 'accountant2');
        $this->assertStatus(200, $ok);
        $posted = $ok->get_data()['records']['journal_entries'][0];
        $this->assertSame('posted', $posted['status']);
        $this->assertSame('ACC-1405-00001', $posted['doc_number']);
        $this->assertSame((string) self::$users['accountant2'], $posted['approved_by']);
        $this->assertSame((string) self::$users['accountant'], $posted['created_by']);
    }

    public function test_senior_manager_and_admin_are_bound_by_separation_of_duties_too() {
        foreach (array('senior', 'admin') as $who) {
            $entry = $this->make_entry($who, '2026-04-10');
            $this->assertSame('akph_segregation_of_duties', $this->errorCode($this->post_entry($entry, $who)), $who);
        }
    }

    public function test_project_manager_cannot_touch_the_journal() {
        $entry = $this->make_entry('accountant', '2026-04-10');
        $this->assertSame('akph_role_forbidden', $this->errorCode($this->post_entry($entry, 'pm')));
    }

    public function test_unbalanced_entry_is_refused() {
        $this->login('accountant');
        $body = $this->entry_body('2026-04-10');
        $body['lines'][1]['credit'] = 999999;
        $response = $this->request('POST', '/journal-entries', $body);
        $this->assertStatus(422, $response);
        $this->assertSame('akph_rule', $this->errorCode($response));
        $this->assertSame(0, $this->count_rows('ledger_entries'));

        $one_line = $this->entry_body('2026-04-10');
        $one_line['lines'] = array($one_line['lines'][0]);
        $this->assertStatus(422, $this->request('POST', '/journal-entries', $one_line));

        $both = $this->entry_body('2026-04-10');
        $both['lines'][0]['credit'] = 5;
        $this->assertStatus(422, $this->request('POST', '/journal-entries', $both));

        $float = $this->entry_body('2026-04-10');
        $float['lines'][0]['debit'] = 1000.5;
        $float['lines'][1]['credit'] = 1000.5;
        $this->assertStatus(400, $this->request('POST', '/journal-entries', $float));
    }

    public function test_group_and_general_accounts_are_not_postable() {
        $this->login('accountant');
        foreach (array('1', '11', '111') as $code) {
            $body = $this->entry_body('2026-04-10');
            $body['lines'][0]['account_code'] = $code;
            $response = $this->request('POST', '/journal-entries', $body);
            $this->assertStatus(422, $response, $code);
        }
        $body = $this->entry_body('2026-04-10');
        $body['lines'][0]['account_code'] = '99999';
        $this->assertStatus(422, $this->request('POST', '/journal-entries', $body));
    }

    public function test_posted_entry_cannot_be_edited_or_deleted() {
        $entry = $this->make_entry('accountant', '2026-04-10');
        $posted = $this->post_entry($entry, 'accountant2')->get_data()['records']['journal_entries'][0];
        $this->login('accountant');
        $edit = $this->request('POST', "/journal-entries/{$posted['id']}", $this->entry_body('2026-04-10', 5) + array('version' => $posted['version']));
        $this->assertStatus(409, $edit);
        $this->assertSame(404, $this->request('DELETE', "/journal-entries/{$posted['id']}")->get_status(), 'no delete route');
        $again = $this->post_entry($posted, 'accountant2');
        $this->assertStatus(409, $again);
        global $wpdb;
        $this->assertSame('1000000', $wpdb->get_var($wpdb->prepare('SELECT total FROM ' . Akph_Schema::table('ledger_entries') . ' WHERE id = %d', $posted['id'])));
    }

    public function test_reversal_is_the_only_correction() {
        $entry = $this->make_entry('accountant', '2026-04-10', 700);
        $posted = $this->post_entry($entry, 'accountant2')->get_data()['records']['journal_entries'][0];
        $this->login('accountant');
        $missing_reason = $this->request('POST', "/journal-entries/{$posted['id']}/reverse", array('version' => $posted['version']));
        $this->assertStatus(400, $missing_reason);
        $response = $this->request('POST', "/journal-entries/{$posted['id']}/reverse", array('version' => $posted['version'], 'reason' => 'ثبت اشتباه'));
        $this->assertStatus(201, $response);
        list($original, $reversal) = $response->get_data()['records']['journal_entries'];
        $this->assertSame($posted['doc_number'], $original['doc_number']);
        $this->assertSame($reversal['id'], $original['reversed_by']['id']);
        $this->assertSame('posted', $reversal['status']);
        $this->assertSame('ACC-1405-00002', $reversal['doc_number']);
        $this->assertSame(700, $reversal['lines'][0]['credit']);
        $this->assertSame(700, $reversal['lines'][1]['debit']);
        $this->assertStatus(409, $this->request('POST', "/journal-entries/{$posted['id']}/reverse", array('version' => $posted['version'], 'reason' => 'دوباره')));
        $this->assertStatus(409, $this->request('POST', "/journal-entries/{$reversal['id']}/reverse", array('version' => $reversal['version'], 'reason' => 'معکوسِ معکوس')));
        $tb = $this->request('GET', '/reports/trial-balance')->get_data();
        $this->assertTrue($tb['balanced']);
        foreach ($tb['rows'] as $row) {
            $this->assertSame(0, $row['closing'], $row['account_code']);
        }
    }

    public function test_idempotency_key_returns_the_same_response_and_creates_one_entry() {
        $this->login('accountant');
        $key = 'test-key-' . wp_generate_password(12, false, false);
        $first = $this->request('POST', '/journal-entries', $this->entry_body('2026-04-10'), array('Idempotency-Key' => $key));
        $second = $this->request('POST', '/journal-entries', $this->entry_body('2026-04-10'), array('Idempotency-Key' => $key));
        $this->assertStatus(201, $first);
        $this->assertStatus(201, $second);
        $this->assertSame(wp_json_encode($first->get_data()), wp_json_encode($second->get_data()));
        $this->assertSame('true', $second->get_headers()['Idempotency-Replayed']);
        $this->assertSame(1, $this->count_rows('ledger_entries'));
        $this->assertSame(1, $this->count_rows('doc_sequences', 'seq > 0'));

        $different = $this->request('POST', '/journal-entries', $this->entry_body('2026-04-11'), array('Idempotency-Key' => $key));
        $this->assertStatus(422, $different);
        $this->assertSame('akph_idempotency_mismatch', $this->errorCode($different));

        $no_key = $this->request('POST', '/journal-entries', $this->entry_body('2026-04-10'), array('Idempotency-Key' => null));
        $this->assertStatus(400, $no_key);
        $this->assertSame(1, $this->count_rows('ledger_entries'));

        // Keys are per user: another user's identical key is a new command.
        $this->login('accountant2');
        $this->assertStatus(201, $this->request('POST', '/journal-entries', $this->entry_body('2026-04-10'), array('Idempotency-Key' => $key)));
        $this->assertSame(2, $this->count_rows('ledger_entries'));

        // Approving twice with the same key posts once.
        $entry = $first->get_data()['records']['journal_entries'][0];
        $post_key = 'post-key-' . wp_generate_password(12, false, false);
        $a = $this->request('POST', "/journal-entries/{$entry['id']}/post", array('version' => $entry['version']), array('Idempotency-Key' => $post_key));
        $b = $this->request('POST', "/journal-entries/{$entry['id']}/post", array('version' => $entry['version']), array('Idempotency-Key' => $post_key));
        $this->assertStatus(200, $a);
        $this->assertStatus(200, $b);
        $this->assertSame($a->get_data()['doc_number'], $b->get_data()['doc_number']);
        $this->assertSame(1, $this->count_rows('doc_sequences', "prefix = 'ACC' AND seq > 0"));
    }

    public function test_version_conflict() {
        $entry = $this->make_entry('accountant', '2026-04-10');
        $this->login('accountant');
        $updated = $this->request('POST', "/journal-entries/{$entry['id']}", $this->entry_body('2026-04-11', 2000) + array('version' => $entry['version']));
        $this->assertStatus(200, $updated);
        $this->assertSame(2, $updated->get_data()['records']['journal_entries'][0]['version']);

        $stale = $this->request('POST', "/journal-entries/{$entry['id']}", $this->entry_body('2026-04-12', 3000) + array('version' => $entry['version']));
        $this->assertStatus(409, $stale);
        $this->assertSame(2, $stale->get_data()['data']['current_version']);
        $stale_post = $this->post_entry($entry, 'accountant2');
        $this->assertStatus(409, $stale_post);
        $this->login('accountant2');
        $missing = $this->request('POST', "/journal-entries/{$entry['id']}/post", array());
        $this->assertStatus(428, $missing);
        $if_match = $this->request('POST', "/journal-entries/{$entry['id']}/post", array(), array('If-Match' => '"2"'));
        $this->assertStatus(200, $if_match);
    }

    public function test_only_the_creator_edits_a_draft() {
        $entry = $this->make_entry('accountant', '2026-04-10');
        $this->login('accountant2');
        $this->assertStatus(403, $this->request('POST', "/journal-entries/{$entry['id']}", $this->entry_body('2026-04-10', 9) + array('version' => $entry['version'])));
    }

    public function test_numbering_restarts_every_fiscal_year_and_follows_dates() {
        // 1404: 2025-03-21 … 2026-03-20; 1405 starts 2026-03-21.
        $a = $this->make_entry('accountant', '2025-06-01');
        $b = $this->make_entry('accountant', '2025-07-01');
        $c = $this->make_entry('accountant', '2026-03-21');
        $d = $this->make_entry('accountant', '2026-04-01');
        $this->assertSame('DRF-1404-00001', $a['draft_number']);
        $this->assertSame('DRF-1404-00002', $b['draft_number']);
        $this->assertSame('DRF-1405-00001', $c['draft_number']);
        $numbers = array();
        foreach (array($a, $b, $c, $d) as $entry) {
            $numbers[] = $this->post_entry($entry, 'senior')->get_data()['doc_number'];
        }
        $this->assertSame(array('ACC-1404-00001', 'ACC-1404-00002', 'ACC-1405-00001', 'ACC-1405-00002'), $numbers);

        // A draft dated before the last posted entry of its year cannot be posted (numbers follow dates).
        $early = $this->make_entry('accountant', '2026-03-25');
        $late = $this->post_entry($early, 'senior');
        $this->assertStatus(422, $late);

        // Future dates are not posted.
        $future = $this->make_entry('accountant', gmdate('Y-m-d', strtotime('+40 days')));
        $this->assertStatus(422, $this->post_entry($future, 'senior'));
        global $wpdb;
        $this->assertSame(0, (int) $wpdb->get_var('SELECT COUNT(*) FROM (SELECT prefix, fiscal_year, seq, COUNT(*) c FROM ' . Akph_Schema::table('doc_sequences') . ' GROUP BY prefix, fiscal_year, seq HAVING c > 1) x'));
    }

    public function test_closed_fiscal_year_is_refused() {
        Akph_Settings::update(array('closed_fiscal_years' => array(1404)));
        $this->login('accountant');
        $response = $this->request('POST', '/journal-entries', $this->entry_body('2025-06-01'));
        $this->assertStatus(422, $response);
        $this->assertSame(0, $this->count_rows('ledger_entries'));
    }

    public function test_failed_command_rolls_everything_back() {
        $this->login('accountant');
        $body = $this->entry_body('2026-04-10');
        $body['lines'][] = array('account_code' => '11101', 'debit' => 0, 'credit' => 0);
        $response = $this->request('POST', '/journal-entries', $body);
        $this->assertStatus(422, $response);
        foreach (array('ledger_entries', 'ledger_lines', 'idempotency_keys') as $table) {
            $this->assertSame(0, $this->count_rows($table), $table);
        }
        $this->assertSame(0, $this->count_rows('audit_log', "object_type = 'entry'"));
        $this->assertSame(0, $this->count_rows('doc_sequences', 'seq > 0'));
    }

    public function test_audit_records_user_ids_and_before_after() {
        $entry = $this->make_entry('accountant', '2026-04-10');
        $this->post_entry($entry, 'accountant2');
        global $wpdb;
        $rows = $wpdb->get_results('SELECT * FROM ' . Akph_Schema::table('audit_log') . " WHERE object_type = 'entry' ORDER BY id");
        $this->assertCount(2, $rows);
        $this->assertSame('entry_created', $rows[0]->action);
        $this->assertSame((string) self::$users['accountant'], $rows[0]->user_id);
        $this->assertNull($rows[0]->before_data);
        $this->assertSame('entry_posted', $rows[1]->action);
        $this->assertSame((string) self::$users['accountant2'], $rows[1]->user_id);
        $before = json_decode($rows[1]->before_data, true);
        $after = json_decode($rows[1]->after_data, true);
        $this->assertSame('pending', $before['status']);
        $this->assertSame('posted', $after['status']);
        $this->assertNotSame('', $rows[1]->request_key);
        $this->login('senior');
        $list = $this->request('GET', '/audit', null, array(), array('object_type' => 'entry'))->get_data();
        $this->assertSame(2, $list['total']);
        $this->assertSame((string) self::$users['accountant2'], $list['events'][0]['user_id']);
    }

    public function test_ledger_report_running_balance() {
        foreach (array(array('2026-04-01', 100), array('2026-04-02', 250)) as $p) {
            $entry = $this->make_entry('accountant', $p[0], $p[1]);
            $this->post_entry($entry, 'senior');
        }
        $this->login('accountant');
        $ledger = $this->request('GET', '/reports/ledger', null, array(), array('account_code' => '11101'))->get_data();
        $this->assertSame(2, $ledger['total']);
        $this->assertSame(array(100, 350), array_column($ledger['rows'], 'balance'));
        $page2 = $this->request('GET', '/reports/ledger', null, array(), array('account_code' => '11101', 'per_page' => 1, 'page' => 2))->get_data();
        $this->assertSame(100, $page2['carried']);
        $this->assertSame(350, $page2['rows'][0]['balance']);
        $from = $this->request('GET', '/reports/ledger', null, array(), array('account_code' => '11101', 'from' => '2026-04-02'))->get_data();
        $this->assertSame(100, $from['opening']);
    }
}
