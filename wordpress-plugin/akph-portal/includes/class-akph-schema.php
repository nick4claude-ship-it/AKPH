<?php
/**
 * Tables {prefix}akph_*. Created and upgraded only with dbDelta, which adds missing tables, columns and
 * indexes and never drops or rebuilds anything. The stored version (option akph_portal_db_version) is
 * compared on every request (plugins_loaded), so an upgrade by replacing files migrates too.
 */
if (!defined('ABSPATH')) {
    exit;
}

final class Akph_Schema {
    const DB_VERSION = '1';
    const OPTION_VERSION = 'akph_portal_db_version';
    /** Tables that are not InnoDB (transactions and row locks would silently not work). */
    const OPTION_ENGINE_PROBLEMS = 'akph_portal_engine_problems';

    public static function table($name) {
        global $wpdb;
        return $wpdb->prefix . 'akph_' . $name;
    }

    /** Column definitions. Amounts are integer Rials in BIGINT; dates are Gregorian DATE; times are UTC. */
    public static function definitions() {
        return array(
            'projects' => "id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
 code varchar(32) NOT NULL,
 name varchar(190) NOT NULL,
 client_id bigint(20) unsigned NOT NULL DEFAULT 0,
 client_name varchar(190) NOT NULL DEFAULT '',
 consultant_name varchar(190) NOT NULL DEFAULT '',
 manager_user_id bigint(20) unsigned NOT NULL DEFAULT 0,
 site_supervisor varchar(190) NOT NULL DEFAULT '',
 location varchar(190) NOT NULL DEFAULT '',
 contract_ref varchar(64) NOT NULL DEFAULT '',
 description text NULL,
 status varchar(24) NOT NULL DEFAULT 'active',
 physical_progress tinyint(3) unsigned NOT NULL DEFAULT 0,
 start_date date NULL DEFAULT NULL,
 end_date date NULL DEFAULT NULL,
 budget bigint(20) NOT NULL DEFAULT 0,
 contract_amount bigint(20) NOT NULL DEFAULT 0,
 manual_revenue bigint(20) NOT NULL DEFAULT 0,
 manual_cost bigint(20) NOT NULL DEFAULT 0,
 manual_cash bigint(20) NOT NULL DEFAULT 0,
 manual_receivable bigint(20) NOT NULL DEFAULT 0,
 manual_payable bigint(20) NOT NULL DEFAULT 0,
 manual_summary_note varchar(255) NOT NULL DEFAULT '',
 legacy_id varchar(64) NULL DEFAULT NULL,
 version int(10) unsigned NOT NULL DEFAULT 1,
 created_by bigint(20) unsigned NOT NULL DEFAULT 0,
 created_at datetime NOT NULL,
 updated_by bigint(20) unsigned NOT NULL DEFAULT 0,
 updated_at datetime NOT NULL,
 PRIMARY KEY  (id),
 UNIQUE KEY code (code),
 UNIQUE KEY legacy_id (legacy_id),
 KEY manager_user_id (manager_user_id),
 KEY status (status)",
            'cost_centers' => "id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
 code varchar(32) NOT NULL,
 name varchar(190) NOT NULL,
 project_id bigint(20) unsigned NULL DEFAULT NULL,
 type varchar(32) NOT NULL DEFAULT '',
 manager_name varchar(190) NOT NULL DEFAULT '',
 budget bigint(20) NOT NULL DEFAULT 0,
 active tinyint(1) NOT NULL DEFAULT 1,
 version int(10) unsigned NOT NULL DEFAULT 1,
 created_by bigint(20) unsigned NOT NULL DEFAULT 0,
 created_at datetime NOT NULL,
 updated_by bigint(20) unsigned NOT NULL DEFAULT 0,
 updated_at datetime NOT NULL,
 PRIMARY KEY  (id),
 UNIQUE KEY code (code),
 KEY project_id (project_id)",
            'counterparties' => "id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
 kind varchar(16) NOT NULL,
 name varchar(190) NOT NULL,
 national_id varchar(16) NOT NULL DEFAULT '',
 economic_code varchar(20) NOT NULL DEFAULT '',
 phone varchar(32) NOT NULL DEFAULT '',
 email varchar(100) NOT NULL DEFAULT '',
 address varchar(255) NOT NULL DEFAULT '',
 sheba varchar(26) NOT NULL DEFAULT '',
 bank_name varchar(64) NOT NULL DEFAULT '',
 trade_type varchar(64) NOT NULL DEFAULT '',
 active tinyint(1) NOT NULL DEFAULT 1,
 version int(10) unsigned NOT NULL DEFAULT 1,
 created_by bigint(20) unsigned NOT NULL DEFAULT 0,
 created_at datetime NOT NULL,
 updated_by bigint(20) unsigned NOT NULL DEFAULT 0,
 updated_at datetime NOT NULL,
 PRIMARY KEY  (id),
 KEY kind (kind)",
            'ledger_accounts' => "id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
 code varchar(16) NOT NULL,
 title varchar(190) NOT NULL,
 level varchar(12) NOT NULL,
 nature varchar(8) NOT NULL,
 parent_code varchar(16) NOT NULL DEFAULT '',
 active tinyint(1) NOT NULL DEFAULT 1,
 version int(10) unsigned NOT NULL DEFAULT 1,
 created_by bigint(20) unsigned NOT NULL DEFAULT 0,
 created_at datetime NOT NULL,
 updated_by bigint(20) unsigned NOT NULL DEFAULT 0,
 updated_at datetime NOT NULL,
 PRIMARY KEY  (id),
 UNIQUE KEY code (code),
 KEY parent_code (parent_code)",
            'ledger_entries' => "id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
 doc_number varchar(20) NULL DEFAULT NULL,
 draft_number varchar(20) NOT NULL DEFAULT '',
 fiscal_year smallint(5) unsigned NOT NULL,
 entry_date date NOT NULL,
 description varchar(1000) NOT NULL,
 entry_type varchar(24) NOT NULL DEFAULT 'general',
 source_type varchar(24) NOT NULL DEFAULT 'manual',
 project_id bigint(20) unsigned NULL DEFAULT NULL,
 status varchar(12) NOT NULL DEFAULT 'pending',
 reversal_of bigint(20) unsigned NULL DEFAULT NULL,
 total bigint(20) unsigned NOT NULL DEFAULT 0,
 created_by bigint(20) unsigned NOT NULL,
 created_at datetime NOT NULL,
 approved_by bigint(20) unsigned NULL DEFAULT NULL,
 approved_at datetime NULL DEFAULT NULL,
 rejected_by bigint(20) unsigned NULL DEFAULT NULL,
 rejected_at datetime NULL DEFAULT NULL,
 status_note varchar(1000) NOT NULL DEFAULT '',
 version int(10) unsigned NOT NULL DEFAULT 1,
 updated_at datetime NOT NULL,
 PRIMARY KEY  (id),
 UNIQUE KEY doc_number (doc_number),
 UNIQUE KEY reversal_of (reversal_of),
 KEY status_date (status,entry_date),
 KEY fiscal_year (fiscal_year),
 KEY project_id (project_id)",
            'ledger_lines' => "id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
 entry_id bigint(20) unsigned NOT NULL,
 line_no smallint(5) unsigned NOT NULL,
 account_id bigint(20) unsigned NOT NULL,
 account_code varchar(16) NOT NULL,
 project_id bigint(20) unsigned NULL DEFAULT NULL,
 cost_center_id bigint(20) unsigned NULL DEFAULT NULL,
 counterparty_id bigint(20) unsigned NULL DEFAULT NULL,
 description varchar(500) NOT NULL DEFAULT '',
 debit bigint(20) unsigned NOT NULL DEFAULT 0,
 credit bigint(20) unsigned NOT NULL DEFAULT 0,
 PRIMARY KEY  (id),
 KEY entry_id (entry_id),
 KEY account_code (account_code),
 KEY project_id (project_id)",
            'audit_log' => "id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
 user_id bigint(20) unsigned NOT NULL,
 action varchar(64) NOT NULL,
 object_type varchar(32) NOT NULL,
 object_id bigint(20) unsigned NOT NULL DEFAULT 0,
 object_ref varchar(64) NOT NULL DEFAULT '',
 before_data longtext NULL,
 after_data longtext NULL,
 request_key varchar(100) NOT NULL DEFAULT '',
 created_at datetime NOT NULL,
 PRIMARY KEY  (id),
 KEY object (object_type,object_id),
 KEY user_id (user_id),
 KEY created_at (created_at)",
            'idempotency_keys' => "id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
 user_id bigint(20) unsigned NOT NULL,
 idem_key varchar(100) NOT NULL,
 route varchar(191) NOT NULL,
 request_hash char(64) NOT NULL,
 status_code smallint(5) unsigned NOT NULL DEFAULT 0,
 response longtext NULL,
 created_at datetime NOT NULL,
 PRIMARY KEY  (id),
 UNIQUE KEY user_key (user_id,idem_key),
 KEY created_at (created_at)",
            'doc_sequences' => "id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
 prefix varchar(8) NOT NULL,
 fiscal_year smallint(5) unsigned NOT NULL,
 seq int(10) unsigned NOT NULL,
 object_type varchar(32) NOT NULL DEFAULT '',
 object_id bigint(20) unsigned NOT NULL DEFAULT 0,
 issued_by bigint(20) unsigned NOT NULL DEFAULT 0,
 issued_at datetime NOT NULL,
 PRIMARY KEY  (id),
 UNIQUE KEY number (prefix,fiscal_year,seq)",
        );
    }

    public static function maybe_migrate() {
        if (get_option(self::OPTION_VERSION) !== self::DB_VERSION) {
            self::migrate();
        }
    }

    /**
     * Additive migration. Returns the engine problems found (empty when every table is InnoDB).
     * The version is stored only when all tables exist on InnoDB; otherwise every command answers 503.
     */
    public static function migrate() {
        global $wpdb;
        require_once ABSPATH . 'wp-admin/includes/upgrade.php';
        $collate = $wpdb->get_charset_collate();
        $problems = array();
        foreach (self::definitions() as $name => $columns) {
            $table = self::table($name);
            dbDelta("CREATE TABLE {$table} (\n {$columns}\n) ENGINE=InnoDB {$collate};");
            $engine = self::engine($table);
            if ($engine !== 'innodb') {
                $problems[] = $table . ':' . ($engine === '' ? 'missing' : $engine);
            }
        }
        update_option(self::OPTION_ENGINE_PROBLEMS, $problems, false);
        if (!$problems) {
            update_option(self::OPTION_VERSION, self::DB_VERSION, false);
        }
        return $problems;
    }

    private static function engine($table) {
        global $wpdb;
        $status = $wpdb->get_row($wpdb->prepare('SHOW TABLE STATUS WHERE Name = %s', $table));
        return $status && isset($status->Engine) ? strtolower((string) $status->Engine) : '';
    }

    /** Commands run only on a 64-bit PHP with every table migrated on InnoDB. */
    public static function ready() {
        return PHP_INT_SIZE >= 8 && get_option(self::OPTION_VERSION) === self::DB_VERSION && !get_option(self::OPTION_ENGINE_PROBLEMS);
    }
}
