<?php
/**
 * PHPUnit bootstrap: the WordPress test suite (wordpress-develop, WP_TESTS_DIR) with MySQL, the four roles
 * paydar-portal creates, its projects table (read by the migration tool), and the akph-portal plugin.
 */

$tests_dir = getenv('WP_TESTS_DIR');
if (!$tests_dir || !file_exists($tests_dir . '/includes/functions.php')) {
    fwrite(STDERR, "WP_TESTS_DIR must point to wordpress-develop/tests/phpunit\n");
    exit(1);
}
if (!defined('WP_TESTS_PHPUNIT_POLYFILLS_PATH') && getenv('WP_TESTS_PHPUNIT_POLYFILLS_PATH')) {
    define('WP_TESTS_PHPUNIT_POLYFILLS_PATH', getenv('WP_TESTS_PHPUNIT_POLYFILLS_PATH'));
}

require_once $tests_dir . '/includes/functions.php';

tests_add_filter('muplugins_loaded', function () {
    // What paydar-portal leaves on a site: its roles (with their own capabilities) and its projects table.
    $roles = array(
        'paydar_senior_manager' => 'مدیر ارشد',
        'paydar_project_manager' => 'مدیر پروژه',
        'paydar_accountant' => 'حسابدار',
    );
    foreach ($roles as $slug => $label) {
        if (!get_role($slug)) {
            add_role($slug, $label, array('read' => true, 'paydar_access' => true));
        }
    }
    global $wpdb;
    $wpdb->query("CREATE TABLE IF NOT EXISTS {$wpdb->prefix}paydar_projects (
        id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
        project_id varchar(32) NOT NULL,
        name varchar(190) NOT NULL,
        client varchar(190) NOT NULL,
        manager varchar(190) NOT NULL,
        manager_user_id bigint(20) unsigned NOT NULL DEFAULT 0,
        supervisor varchar(190) NOT NULL DEFAULT '',
        consultant varchar(190) NOT NULL DEFAULT '',
        location varchar(190) NOT NULL DEFAULT '',
        budget decimal(18,2) NOT NULL DEFAULT 0,
        contract_amount decimal(18,2) NOT NULL DEFAULT 0,
        revenue decimal(18,2) NOT NULL DEFAULT 0,
        cost decimal(18,2) NOT NULL DEFAULT 0,
        cash decimal(18,2) NOT NULL DEFAULT 0,
        receivable decimal(18,2) NOT NULL DEFAULT 0,
        payable decimal(18,2) NOT NULL DEFAULT 0,
        physical smallint(5) unsigned NOT NULL DEFAULT 0,
        financial smallint(5) unsigned NOT NULL DEFAULT 0,
        status varchar(16) NOT NULL DEFAULT 'active',
        start_date varchar(32) NOT NULL DEFAULT '',
        end_date varchar(32) NOT NULL DEFAULT '',
        contract_id varchar(64) NOT NULL DEFAULT '',
        description text NOT NULL,
        created_at datetime NOT NULL,
        updated_at datetime NOT NULL,
        PRIMARY KEY (id),
        UNIQUE KEY project_id (project_id)
    ) ENGINE=InnoDB");
    require dirname(__DIR__, 2) . '/wordpress-plugin/akph-portal/akph-portal.php';
});

require $tests_dir . '/includes/bootstrap.php';
require __DIR__ . '/class-akph-test-case.php';
