<?php
/** Additive migration (dbDelta, InnoDB, versioned) and additive capabilities on the existing roles. */
class Test_Akph_Schema_Roles extends Akph_Test_Case {
    private function schema_snapshot() {
        global $wpdb;
        $out = array();
        foreach (array_keys(Akph_Schema::definitions()) as $name) {
            $row = $wpdb->get_row('SHOW CREATE TABLE ' . Akph_Schema::table($name), ARRAY_N);
            // AUTO_INCREMENT counters are data, not structure.
            $out[$name] = preg_replace('/ AUTO_INCREMENT=\d+/', '', $row[1]);
        }
        return $out;
    }

    public function test_tables_are_innodb_and_version_is_stored() {
        global $wpdb;
        foreach (array_keys(Akph_Schema::definitions()) as $name) {
            $status = $wpdb->get_row($wpdb->prepare('SHOW TABLE STATUS WHERE Name = %s', Akph_Schema::table($name)));
            $this->assertNotNull($status, $name);
            $this->assertSame('innodb', strtolower($status->Engine), $name);
        }
        $this->assertSame(Akph_Schema::DB_VERSION, get_option(Akph_Schema::OPTION_VERSION));
        $this->assertTrue(Akph_Schema::ready());
    }

    public function test_amount_columns_are_bigint() {
        global $wpdb;
        $columns = array('projects' => array('budget', 'contract_amount', 'manual_revenue', 'manual_cost'), 'ledger_lines' => array('debit', 'credit'), 'ledger_entries' => array('total'), 'cost_centers' => array('budget'));
        foreach ($columns as $table => $names) {
            foreach ($names as $col) {
                $type = $wpdb->get_var($wpdb->prepare('SELECT DATA_TYPE FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = %s AND COLUMN_NAME = %s', Akph_Schema::table($table), $col));
                $this->assertSame('bigint', strtolower($type), "{$table}.{$col}");
            }
        }
    }

    public function test_running_the_migration_again_changes_nothing() {
        $this->install_chart();
        $project = $this->make_project(array('budget' => 125000000000));
        $entry = $this->make_entry('accountant', '2026-04-10');
        global $wpdb;
        $before_schema = $this->schema_snapshot();
        $dump = function () use ($wpdb) {
            $d = array();
            foreach (array_keys(Akph_Schema::definitions()) as $name) {
                $d[$name] = $wpdb->get_results('SELECT * FROM ' . Akph_Schema::table($name) . ' ORDER BY id', ARRAY_A);
            }
            return $d;
        };
        $before_data = $dump();
        delete_option(Akph_Schema::OPTION_VERSION); // as after a plugin update
        Akph_Schema::maybe_migrate();
        $this->assertSame(array(), Akph_Schema::migrate());
        $this->assertSame($before_schema, $this->schema_snapshot());
        $this->assertSame($before_data, $dump());
        $this->assertSame(Akph_Schema::DB_VERSION, get_option(Akph_Schema::OPTION_VERSION));
        $this->assertNotEmpty($project['id']);
        $this->assertNotEmpty($entry['id']);
    }

    public function test_migration_code_never_drops_or_rebuilds() {
        $source = '';
        foreach (glob(dirname(__DIR__, 2) . '/wordpress-plugin/akph-portal/includes/*.php') as $file) {
            $source .= file_get_contents($file);
        }
        $this->assertDoesNotMatchRegularExpression('/\bDROP\s+(TABLE|COLUMN|INDEX)\b/i', $source);
        $this->assertDoesNotMatchRegularExpression('/\bALTER\s+TABLE\b/i', $source);
        $this->assertDoesNotMatchRegularExpression('/paydar_projects[^;]*\b(INSERT|UPDATE|DELETE)\b/i', $source);
    }

    public function test_capabilities_are_added_to_the_existing_roles_only() {
        $roles_before = array_keys(wp_roles()->roles);
        $role = get_role('paydar_accountant');
        $role->add_cap('paydar_custom_existing', true);
        delete_option(Akph_Roles::OPTION_VERSION);
        Akph_Roles::maybe_install();
        $this->assertSame($roles_before, array_keys(wp_roles()->roles), 'no role is created');
        $this->assertTrue(get_role('paydar_accountant')->has_cap('paydar_custom_existing'), 'existing capabilities stay');
        $this->assertTrue(get_role('paydar_accountant')->has_cap('paydar_access'), 'paydar-portal capabilities stay');
        $this->assertTrue(get_role('paydar_accountant')->has_cap(Akph_Roles::JOURNAL_APPROVE));
        $this->assertFalse(get_role('paydar_accountant')->has_cap(Akph_Roles::PROJECTS_CREATE));
        $this->assertTrue(get_role('paydar_project_manager')->has_cap(Akph_Roles::PROJECTS_EDIT_EXEC_OWN));
        $this->assertFalse(get_role('paydar_project_manager')->has_cap(Akph_Roles::VIEW_ALL));
        $this->assertTrue(get_role('administrator')->has_cap(Akph_Roles::SETTINGS));
        $this->assertTrue(get_role('paydar_senior_manager')->has_cap(Akph_Roles::JOURNAL_APPROVE));
        $this->assertFalse(get_role('subscriber')->has_cap(Akph_Roles::ACCESS));
        $this->assertSame(Akph_Roles::ROLES_VERSION, get_option(Akph_Roles::OPTION_VERSION));
    }

    public function test_plugin_does_not_open_registration() {
        update_option('users_can_register', 0);
        Akph_Roles::install();
        Akph_Schema::migrate();
        $this->assertSame('0', (string) get_option('users_can_register'));
    }

    public function test_capability_version_is_not_stored_while_a_portal_role_is_missing() {
        $saved = get_role('paydar_project_manager');
        $caps = $saved->capabilities;
        $name = wp_roles()->role_names['paydar_project_manager'];
        delete_option(Akph_Roles::OPTION_VERSION);
        remove_role('paydar_project_manager');
        try {
            $this->assertSame(array('paydar_project_manager'), Akph_Roles::install());
            $this->assertFalse(get_option(Akph_Roles::OPTION_VERSION), 'not stored: the missing role would never get its capabilities');
            $this->assertTrue(get_role('paydar_accountant')->has_cap(Akph_Roles::JOURNAL_CREATE), 'the existing roles are granted anyway');
            Akph_Roles::maybe_install();
            $this->assertFalse(get_option(Akph_Roles::OPTION_VERSION));
        } finally {
            add_role('paydar_project_manager', $name, array_diff_key($caps, array_flip(Akph_Roles::all_caps())));
        }
        // paydar-portal creates the role later: the next request grants it and stores the version.
        $this->assertFalse(get_role('paydar_project_manager')->has_cap(Akph_Roles::ACCESS));
        Akph_Roles::maybe_install();
        $this->assertTrue(get_role('paydar_project_manager')->has_cap(Akph_Roles::ACCESS));
        $this->assertSame(Akph_Roles::ROLES_VERSION, get_option(Akph_Roles::OPTION_VERSION));
    }

    public function test_tables_off_innodb_are_not_migrated_again_on_every_request() {
        global $wpdb;
        $audit = Akph_Schema::table('audit_log');
        $queries = array();
        $count = function ($sql) use (&$queries) {
            $queries[] = $sql;
            return $sql;
        };
        $wpdb->query("ALTER TABLE {$audit} ENGINE=MyISAM"); // what a host without InnoDB leaves behind
        try {
            delete_option(Akph_Schema::OPTION_VERSION);
            delete_transient(Akph_Schema::TRANSIENT_BACKOFF);
            $problems = Akph_Schema::migrate();
            $this->assertSame(array($audit . ':myisam'), $problems);
            $this->assertFalse(get_option(Akph_Schema::OPTION_VERSION));
            $this->assertNotEmpty(get_transient(Akph_Schema::TRANSIENT_BACKOFF));
            $this->assertFalse(Akph_Schema::ready());

            // The next requests do not run dbDelta again while the backoff lasts.
            add_filter('query', $count);
            Akph_Schema::maybe_migrate();
            Akph_Schema::maybe_migrate();
            remove_filter('query', $count);
            $this->assertSame(array(), preg_grep('/CREATE TABLE|SHOW TABLE STATUS|DESCRIBE|SHOW (FULL )?COLUMNS/i', $queries));

            // Commands answer 503 meanwhile.
            $this->login('accountant');
            $this->assertStatus(503, $this->request('POST', '/journal-entries', $this->entry_body('2026-04-10')));

            // After the backoff (or the retry button) the migration runs again.
            delete_transient(Akph_Schema::TRANSIENT_BACKOFF);
            $queries = array();
            add_filter('query', $count);
            Akph_Schema::maybe_migrate();
            remove_filter('query', $count);
            $this->assertNotEmpty(preg_grep('/SHOW TABLE STATUS/i', $queries));
            $this->assertNotEmpty(get_transient(Akph_Schema::TRANSIENT_BACKOFF), 'still MyISAM: backoff again');
        } finally {
            $wpdb->query("ALTER TABLE {$audit} ENGINE=InnoDB");
        }
        // ALTER TABLE committed the failed state above; the repaired state is committed too.
        $this->assertSame(array(), Akph_Schema::migrate());
        $this->assertSame(Akph_Schema::DB_VERSION, get_option(Akph_Schema::OPTION_VERSION));
        $this->assertFalse(get_transient(Akph_Schema::TRANSIENT_BACKOFF));
        $this->assertTrue(Akph_Schema::ready());
        $wpdb->query('COMMIT');
    }

    public function test_version_2_adds_reversal_target_and_fills_it_for_existing_reversals() {
        global $wpdb;
        $entries = Akph_Schema::table('ledger_entries');
        $this->assertSame('reversal_target', $wpdb->get_var("SHOW COLUMNS FROM {$entries} LIKE 'reversal_target'"));
        $now = gmdate('Y-m-d H:i:s');
        $row = array('fiscal_year' => 1405, 'entry_date' => '2026-04-10', 'description' => 'x', 'created_by' => 1, 'created_at' => $now, 'updated_at' => $now, 'status' => 'posted');
        $wpdb->insert($entries, $row + array('doc_number' => 'ACC-1405-00001'));
        $original = (int) $wpdb->insert_id;
        $wpdb->insert($entries, $row + array('doc_number' => 'ACC-1405-00002', 'source_type' => 'reversal', 'entry_type' => 'reversal', 'reversal_of' => $original));
        $reversal = (int) $wpdb->insert_id; // as 0.3.0 wrote it: no reversal_target
        delete_option(Akph_Schema::OPTION_VERSION);
        Akph_Schema::maybe_migrate();
        $this->assertSame((string) $original, $wpdb->get_var("SELECT reversal_target FROM {$entries} WHERE id = {$reversal}"));
        $this->assertNull($wpdb->get_var("SELECT reversal_target FROM {$entries} WHERE id = {$original}"));
        $this->assertSame('2', Akph_Schema::DB_VERSION);
    }

    public function test_release_runs_only_for_a_new_tag_after_ci_and_never_overwrites() {
        $root = dirname(__DIR__, 2) . '/.github/workflows/';
        $release = file_get_contents($root . 'release.yml');
        $ci = file_get_contents($root . 'ci.yml');
        // Trigger: new tags only (no branch pushes, manual runs or other events).
        $this->assertSame(1, preg_match('/^on:\n(.*?)^\S/ms', $release, $on));
        $this->assertSame("  push:\n    tags:\n      - 'akph-portal-v*'", trim($on[1], "\n"));
        $this->assertStringNotContainsString('workflow_dispatch', $release);
        $this->assertDoesNotMatchRegularExpression('/^\s+branches:/m', $release);
        // The whole CI (npm tests and the WordPress/PHP tests) runs first, and the release job needs it.
        $this->assertMatchesRegularExpression('/uses: \.\/\.github\/workflows\/ci\.yml/', $release);
        $this->assertMatchesRegularExpression('/needs: \[?ci\]?/', $release);
        $this->assertStringContainsString('workflow_call', $ci);
        $this->assertStringContainsString('vendor/bin/phpunit', $ci);
        // An existing release is never overwritten.
        $this->assertStringNotContainsString('--clobber', $release);
        $this->assertStringContainsString('gh release view', $release);
        $this->assertStringContainsString('already exists', $release);
        $this->assertStringContainsString('gh release create', $release);
        $this->assertDoesNotMatchRegularExpression('/gh release (upload|edit|delete)/', $release);
        // A branch push runs CI; a tag runs it only through the release.
        $this->assertSame(1, preg_match('/^on:\n(.*?)^\S/ms', $ci, $ci_on));
        $this->assertStringContainsString("branches: ['**']", $ci_on[1]);
    }
}
