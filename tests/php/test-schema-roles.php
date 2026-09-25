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
}
