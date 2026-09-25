<?php
/**
 * Transactions under contention (0.3.1): every query is checked, a deadlock (1213) or lock wait timeout (1205)
 * aborts the whole command with a retryable 409 and nothing saved, the same command then succeeds with the
 * same Idempotency-Key, every ledger command takes the numbering lock before the entry row, and database
 * errors reach error_log only, never the REST response.
 *
 * A second MySQL connection plays the other user: it holds locks while the command runs on $wpdb.
 */
class Test_Akph_Concurrency extends Akph_Test_Case {
    /** @var mysqli|null */
    private $other;
    /** @var string[] */
    private $queries = array();

    public function set_up() {
        parent::set_up();
        $this->install_chart();
    }

    public function tear_down() {
        global $wpdb;
        if ($this->other) {
            @$this->other->query('ROLLBACK');
            $this->other->close();
            $this->other = null;
        }
        remove_all_filters('query');
        $wpdb->query('SET SESSION innodb_lock_wait_timeout = 50');
        parent::tear_down();
    }

    private function other_connection() {
        global $wpdb;
        list($host, $port, $socket) = $wpdb->parse_db_host(DB_HOST);
        $this->other = mysqli_init();
        $this->other->real_connect($host, DB_USER, DB_PASSWORD, DB_NAME, $port ? (int) $port : null, $socket ?: null);
        $this->other->set_charset('utf8mb4');
        $this->other->query('SET SESSION innodb_lock_wait_timeout = 50');
        return $this->other;
    }

    private function record_queries() {
        $this->queries = array();
        add_filter('query', function ($sql) {
            $this->queries[] = $sql;
            return $sql;
        });
    }

    /** Index of the first recorded query matching all the patterns, -1 when none. */
    private function first_query(array $patterns) {
        foreach ($this->queries as $i => $sql) {
            $all = true;
            foreach ($patterns as $p) {
                if (!preg_match($p, $sql)) {
                    $all = false;
                    break;
                }
            }
            if ($all) {
                return $i;
            }
        }
        return -1;
    }

    private function post_request($entry, $key) {
        return $this->request('POST', "/journal-entries/{$entry['id']}/post", array('version' => $entry['version']), array('Idempotency-Key' => $key));
    }

    private function assert_nothing_posted($entry_id) {
        global $wpdb;
        $this->assertSame('pending', $wpdb->get_var($wpdb->prepare('SELECT status FROM ' . Akph_Schema::table('ledger_entries') . ' WHERE id = %d', $entry_id)));
        $this->assertSame(0, $this->count_rows('doc_sequences', "prefix = 'ACC' AND seq > 0"));
        $this->assertSame(0, $this->count_rows('audit_log', "action = 'entry_posted'"));
    }

    public function test_lock_wait_timeout_aborts_the_command_with_a_retryable_409() {
        global $wpdb;
        $entry = $this->make_entry('accountant', '2026-04-10');
        $keys_before = $this->count_rows('idempotency_keys');

        // Another request holds the numbering lock of 1405 (not committed yet).
        $other = $this->other_connection();
        $other->query('START TRANSACTION');
        $this->assertTrue($other->query('INSERT INTO ' . Akph_Schema::table('doc_sequences') . " (prefix, fiscal_year, seq, object_type, object_id, issued_by, issued_at) VALUES ('ACC', 1405, 0, 'anchor', 0, 0, UTC_TIMESTAMP()) ON DUPLICATE KEY UPDATE object_type = 'anchor'"));

        $wpdb->query('SET SESSION innodb_lock_wait_timeout = 1');
        $this->login('accountant2');
        $key = 'retry-' . wp_generate_password(16, false, false);
        $response = $this->post_request($entry, $key);
        $this->assertStatus(409, $response);
        $this->assertSame('akph_retry', $this->errorCode($response));
        $this->assertTrue($response->get_data()['data']['retryable']);
        $this->assertFalse(Akph_Db::in_transaction(), 'the transaction was closed');
        $this->assert_nothing_posted($entry['id']);
        $this->assertSame($keys_before, $this->count_rows('idempotency_keys'), 'the key is not kept, so the same command may run again');

        // The other request finishes; the same command with the same key now succeeds, once.
        $other->query('ROLLBACK');
        $again = $this->post_request($entry, $key);
        $this->assertStatus(200, $again);
        $this->assertSame('ACC-1405-00001', $again->get_data()['doc_number']);
        $replay = $this->post_request($entry, $key);
        $this->assertSame('true', $replay->get_headers()['Idempotency-Replayed']);
        $this->assertSame(1, $this->count_rows('doc_sequences', "prefix = 'ACC' AND seq > 0"));
    }

    public function test_deadlock_aborts_the_command_with_a_retryable_409() {
        global $wpdb;
        $entry = $this->make_entry('accountant', '2026-04-10');
        $entries = Akph_Schema::table('ledger_entries');
        $other = $this->other_connection();
        $other->query('START TRANSACTION');
        // The other transaction holds the entry row and has more work to lose (so InnoDB picks the command as
        // the victim), then asks for the numbering lock the command holds: a lock cycle.
        for ($i = 0; $i < 30; $i++) {
            $other->query('INSERT INTO ' . Akph_Schema::table('audit_log') . " (user_id, action, object_type, object_id, created_at) VALUES (0, 'test_weight', 'test', {$i}, UTC_TIMESTAMP())");
        }
        $this->assertInstanceOf('mysqli_result', $other->query("SELECT id FROM {$entries} WHERE id = " . (int) $entry['id'] . ' FOR UPDATE'));
        $sent = false;
        add_filter('query', function ($sql) use ($other, $entries, &$sent) {
            if (!$sent && strpos($sql, $entries) !== false && strpos($sql, 'FOR UPDATE') !== false) {
                $sent = true;
                $other->query('INSERT INTO ' . Akph_Schema::table('doc_sequences') . " (prefix, fiscal_year, seq, object_type, object_id, issued_by, issued_at) VALUES ('ACC', 1405, 0, 'anchor', 0, 0, UTC_TIMESTAMP()) ON DUPLICATE KEY UPDATE object_type = 'anchor'", MYSQLI_ASYNC);
                usleep(300000); // the other connection is now waiting for the anchor this command holds
            }
            return $sql;
        });
        $this->login('accountant2');
        $response = $this->post_request($entry, 'deadlock-' . wp_generate_password(16, false, false));
        remove_all_filters('query');
        $this->assertTrue($sent);
        $this->assertStatus(409, $response);
        $this->assertSame('akph_retry', $this->errorCode($response));
        $this->assertTrue($response->get_data()['data']['retryable']);
        // The other connection got the anchor once the command rolled back.
        $links = $errors = $reject = array($other);
        mysqli_poll($links, $errors, $reject, 5);
        $this->assertNotFalse($other->reap_async_query());
        $other->query('ROLLBACK');
        $this->assert_nothing_posted($entry['id']);
    }

    public function test_deadlock_and_lock_wait_timeout_are_retryable_other_errors_are_not() {
        $this->assertTrue(Akph_Db::is_retryable(1213, ''));
        $this->assertTrue(Akph_Db::is_retryable(1205, ''));
        $this->assertTrue(Akph_Db::is_retryable(0, 'Deadlock found when trying to get lock; try restarting transaction'));
        $this->assertTrue(Akph_Db::is_retryable(0, 'Lock wait timeout exceeded; try restarting transaction'));
        $this->assertFalse(Akph_Db::is_retryable(1062, "Duplicate entry 'x' for key 'code'"));
        $this->assertFalse(Akph_Db::is_retryable(1054, "Unknown column 'nope' in 'field list'"));
        $error = Akph_Db::error_for(1213, 'Deadlock found when trying to get lock; try restarting transaction');
        $this->assertSame('akph_retry', $error->error_code());
        $this->assertSame(409, $error->status());
        $this->assertTrue($error->to_wp_error()->get_error_data()['retryable']);
    }

    public function test_numbering_lock_comes_before_the_entry_row_in_post_and_reverse() {
        $entry = $this->make_entry('accountant', '2026-04-10');
        $entries = preg_quote(Akph_Schema::table('ledger_entries'), '/');
        $sequences = preg_quote(Akph_Schema::table('doc_sequences'), '/');
        $anchor = array("/INSERT INTO {$sequences} /", '/ON DUPLICATE KEY UPDATE/');
        $row_lock = array("/FROM {$entries} WHERE id = " . (int) $entry['id'] . ' FOR UPDATE/');

        $this->login('accountant2');
        $this->record_queries();
        $posted = $this->post_request($entry, wp_generate_uuid4());
        $this->assertStatus(200, $posted);
        $a = $this->first_query(array_merge($anchor, array("/'ACC'/")));
        $r = $this->first_query($row_lock);
        $this->assertGreaterThan(-1, $a);
        $this->assertGreaterThan(-1, $r);
        $this->assertLessThan($r, $a, 'post: numbering lock first, then the entry row');

        $posted = $posted->get_data()['records']['journal_entries'][0];
        $this->record_queries();
        $reverse = $this->request('POST', "/journal-entries/{$posted['id']}/reverse", array('version' => $posted['version'], 'reason' => 'آزمایش ترتیب قفل'));
        $this->assertStatus(201, $reverse);
        $a = $this->first_query(array_merge($anchor, array("/'DRF'/")));
        $r = $this->first_query($row_lock);
        $this->assertGreaterThan(-1, $a);
        $this->assertLessThan($r, $a, 'reverse: numbering lock first, then the entry row');

        $reversal = $reverse->get_data()['records']['journal_entries'][1];
        $this->login('senior');
        $this->record_queries();
        $this->assertStatus(200, $this->request('POST', "/journal-entries/{$reversal['id']}/post", array('version' => $reversal['version'])));
        $a = $this->first_query(array_merge($anchor, array("/'ACC'/")));
        $r = $this->first_query(array("/FROM {$entries} WHERE id = " . (int) $reversal['id'] . ' FOR UPDATE/'));
        $this->assertLessThan($r, $a, 'posting a reversal: numbering lock first, then the entry row');
    }

    public function test_numbering_lock_is_a_single_insert_on_duplicate_key_update() {
        $source = file_get_contents(AKPH_PORTAL_DIR . 'includes/class-akph-numbering.php');
        $this->assertStringContainsString('ON DUPLICATE KEY UPDATE', $source);
        $this->assertStringNotContainsString('INSERT IGNORE', $source);
        foreach (glob(AKPH_PORTAL_DIR . 'includes/*.php') as $file) {
            $this->assertStringNotContainsString('INSERT IGNORE', file_get_contents($file), basename($file));
        }
        $this->login('accountant');
        $this->request('POST', '/journal-entries', $this->entry_body('2026-04-10'));
        $this->request('POST', '/journal-entries', $this->entry_body('2026-04-11'));
        $this->assertSame(1, $this->count_rows('doc_sequences', "prefix = 'DRF' AND fiscal_year = 1405 AND seq = 0"), 'one anchor per prefix and year');
    }

    public function test_a_failed_locking_read_aborts_the_command_and_details_go_to_error_log_only() {
        $entry = $this->make_entry('accountant', '2026-04-10');
        $entries = Akph_Schema::table('ledger_entries');
        // Break the row lock (SELECT … FOR UPDATE) of the entry: before 0.3.1 wpdb returned null and the
        // command answered as if the entry did not exist.
        add_filter('query', function ($sql) use ($entries) {
            if (strpos($sql, "FROM {$entries} WHERE id =") !== false && strpos($sql, 'FOR UPDATE') !== false) {
                return str_replace('SELECT *', 'SELECT no_such_column_x9', $sql);
            }
            return $sql;
        });
        $log = tempnam(sys_get_temp_dir(), 'akph-log');
        $previous_log = ini_set('error_log', $log);
        try {
            $this->login('accountant2');
            $response = $this->post_request($entry, wp_generate_uuid4());
        } finally {
            ini_set('error_log', $previous_log);
            remove_all_filters('query');
        }
        $this->assertStatus(500, $response);
        $this->assertSame('akph_db_error', $this->errorCode($response));
        $body = wp_json_encode($response->get_data());
        foreach (array('no_such_column_x9', $entries, 'SELECT', 'Unknown column') as $secret) {
            $this->assertStringNotContainsString($secret, $body, 'REST response must not carry database details');
        }
        $this->assertSame(array('status'), array_keys($response->get_data()['data']));
        $logged = (string) file_get_contents($log);
        unlink($log);
        $this->assertStringContainsString('[akph-portal] database error', $logged);
        $this->assertStringContainsString('no_such_column_x9', $logged);
        $this->assert_nothing_posted($entry['id']);
    }
}
