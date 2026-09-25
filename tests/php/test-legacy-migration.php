<?php
/** One-time copy of paydar-portal projects: dry-run, repeatable, read-only on the old table, no entries. */
class Test_Akph_Legacy_Migration extends Akph_Test_Case {
    private function legacy_insert(array $row) {
        global $wpdb;
        $now = '2025-01-01 00:00:00';
        $wpdb->insert($wpdb->prefix . 'paydar_projects', $row + array(
            'manager' => '', 'manager_user_id' => 0, 'supervisor' => '', 'consultant' => '', 'location' => '',
            'budget' => '0.00', 'contract_amount' => '0.00', 'revenue' => '0.00', 'cost' => '0.00', 'cash' => '0.00',
            'receivable' => '0.00', 'payable' => '0.00', 'physical' => 0, 'financial' => 0, 'status' => 'active',
            'start_date' => '', 'end_date' => '', 'contract_id' => '', 'description' => '', 'created_at' => $now, 'updated_at' => $now,
        ));
    }

    private function legacy_checksum() {
        global $wpdb;
        return md5(wp_json_encode($wpdb->get_results("SELECT * FROM {$wpdb->prefix}paydar_projects ORDER BY id", ARRAY_A)));
    }

    public function set_up() {
        parent::set_up();
        $this->legacy_insert(array('project_id' => 'PRJ-24-AAA111', 'name' => 'پروژه قدیمی الف', 'client' => 'کارفرمای الف', 'manager_user_id' => self::$users['pm'],
            'budget' => '12.50', 'contract_amount' => '20.00', 'revenue' => '3.25', 'cost' => '2.10', 'cash' => '1.00', 'receivable' => '0.75', 'payable' => '0.05',
            'physical' => 40, 'status' => 'risk', 'start_date' => '۱۴۰۳/۰۵/۰۱', 'end_date' => '1405/12/29', 'contract_id' => 'C-9'));
        $this->legacy_insert(array('project_id' => 'PRJ-24-BBB222', 'name' => 'پروژه قدیمی ب', 'client' => 'کارفرمای ب', 'manager_user_id' => self::$users['accountant'],
            'status' => 'done', 'start_date' => 'نامعلوم'));
    }

    public function test_billion_toman_to_rial_is_exact() {
        $this->assertSame(125000000000, Akph_Migration::billion_toman_to_rial('12.50'));
        $this->assertSame(10000000000, Akph_Migration::billion_toman_to_rial('1'));
        $this->assertSame(500000000, Akph_Migration::billion_toman_to_rial('0.05'));
        $this->assertSame(0, Akph_Migration::billion_toman_to_rial('0.00'));
        $this->assertNull(Akph_Migration::billion_toman_to_rial('-1.00'));
        $this->assertNull(Akph_Migration::billion_toman_to_rial('abc'));
        $this->assertNull(Akph_Migration::billion_toman_to_rial('99999999.99'), 'beyond the safe integer range');
    }

    public function test_dry_run_changes_nothing() {
        $before = $this->legacy_checksum();
        $this->login('admin');
        $plan = Akph_Migration::plan();
        $this->assertTrue($plan['available']);
        $this->assertSame(2, $plan['create']);
        $this->assertSame(0, $plan['skip']);
        $a = $plan['items'][0]['fields'];
        $this->assertSame(125000000000, $a['budget']);
        $this->assertSame(200000000000, $a['contract_amount']);
        $this->assertSame(32500000000, $a['manual_revenue']);
        $this->assertSame(500000000, $a['manual_payable']);
        $this->assertSame('2024-07-22', $a['start_date']); // ۱۴۰۳/۰۵/۰۱
        $this->assertSame('2027-03-20', $a['end_date']);  // 1405/12/29
        $this->assertSame('active', $a['status']);
        $b = $plan['items'][1];
        $this->assertSame(0, $b['fields']['manager_user_id'], 'an accountant is not a project manager');
        $this->assertSame('closed', $b['fields']['status']);
        $this->assertNull($b['fields']['start_date']);
        $this->assertNotEmpty($b['warnings']);
        $this->assertSame(0, $this->count_rows('projects'));
        $this->assertSame($before, $this->legacy_checksum());
    }

    public function test_migration_is_repeatable_and_creates_no_entries() {
        $before = $this->legacy_checksum();
        $this->login('admin');
        $first = Akph_Migration::run();
        $this->assertSame(array('created' => 2, 'skipped' => 0), $first);
        $second = Akph_Migration::run();
        $this->assertSame(array('created' => 0, 'skipped' => 2), $second);
        $this->assertSame(2, $this->count_rows('projects'));
        $this->assertSame(0, $this->count_rows('ledger_entries'));
        $this->assertSame(0, $this->count_rows('ledger_lines'));
        $this->assertSame($before, $this->legacy_checksum());
        global $wpdb;
        $row = $wpdb->get_row('SELECT * FROM ' . Akph_Schema::table('projects') . " WHERE legacy_id = 'PRJ-24-AAA111'");
        $this->assertSame('PRJ-24-AAA111', $row->code);
        $this->assertSame('125000000000', $row->budget);
        $this->assertSame('21000000000', $row->manual_cost);
        $this->assertSame((string) self::$users['pm'], $row->manager_user_id);
        $this->assertSame(2, $this->count_rows('audit_log', "action = 'project_migrated'"));
        $plan = Akph_Migration::plan();
        $this->assertSame(0, $plan['create']);
        $this->assertSame(2, $plan['skip']);

        // The project manager sees the migrated project assigned to them, with its manual summary.
        $this->login('pm');
        $projects = $this->request('GET', '/projects')->get_data()['projects'];
        $this->assertCount(1, $projects);
        $this->assertSame(32500000000, $projects[0]['manual_summary']['revenue']);
    }
}
