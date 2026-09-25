<?php
/**
 * Base class: users of the four portal roles plus one without a portal role, REST dispatch with nonce and
 * Idempotency-Key, and clean akph tables for every test.
 *
 * Commands commit their own InnoDB transactions (that is what is under test), which also commits the test
 * suite's per-test transaction; every test therefore starts from emptied akph tables instead of relying on
 * the suite's rollback.
 */
abstract class Akph_Test_Case extends WP_UnitTestCase {
    /** @var array<string,int> role key → user id */
    protected static $users = array();

    const ROLE_KEYS = array(
        'admin' => 'administrator',
        'senior' => 'paydar_senior_manager',
        'accountant' => 'paydar_accountant',
        'accountant2' => 'paydar_accountant',
        'pm' => 'paydar_project_manager',
        'pm2' => 'paydar_project_manager',
        'norole' => 'subscriber',
    );

    public static function wpSetUpBeforeClass(WP_UnitTest_Factory $factory) {
        foreach (self::ROLE_KEYS as $key => $role) {
            self::$users[$key] = $factory->user->create(array('role' => $role, 'display_name' => 'کاربر ' . $key));
        }
    }

    public function set_up() {
        parent::set_up();
        global $wpdb, $wp_rest_server;
        foreach (array_keys(Akph_Schema::definitions()) as $name) {
            $wpdb->query('TRUNCATE TABLE ' . Akph_Schema::table($name));
        }
        $wpdb->query("DELETE FROM {$wpdb->prefix}paydar_projects");
        delete_option(Akph_Settings::OPTION);
        // A test that changes table engines commits its intermediate state (ALTER TABLE commits): start clean.
        delete_transient(Akph_Schema::TRANSIENT_BACKOFF);
        if (!Akph_Schema::ready()) {
            Akph_Schema::migrate();
        }
        $depth = new ReflectionProperty('Akph_Db', 'depth');
        $depth->setAccessible(true);
        $depth->setValue(null, 0);
        Akph_Auth::flush();
        $wp_rest_server = new WP_REST_Server();
        do_action('rest_api_init', $wp_rest_server);
        wp_set_current_user(0);
    }

    public function tear_down() {
        global $wp_rest_server;
        $wp_rest_server = null;
        parent::tear_down();
    }

    protected function login($key) {
        wp_set_current_user($key === 'guest' ? 0 : self::$users[$key]);
        Akph_Auth::flush();
    }

    /** Dispatches a request as the current user. `$headers` may override X-WP-Nonce / Idempotency-Key (null removes). */
    protected function request($method, $path, $body = null, array $headers = array(), array $query = array()) {
        $request = new WP_REST_Request($method, '/akph/v1' . $path);
        $defaults = array('X-WP-Nonce' => get_current_user_id() ? wp_create_nonce('wp_rest') : '');
        if ($method !== 'GET') {
            $defaults['Idempotency-Key'] = wp_generate_uuid4();
        }
        foreach (array_merge($defaults, $headers) as $name => $value) {
            if ($value !== null && $value !== '') {
                $request->set_header($name, $value);
            }
        }
        if ($body !== null) {
            $request->set_header('Content-Type', 'application/json');
            $request->set_body(wp_json_encode($body));
        }
        if ($query) {
            $request->set_query_params($query);
        }
        return rest_get_server()->dispatch($request);
    }

    protected function assertStatus($expected, WP_REST_Response $response, $message = '') {
        $data = $response->get_data();
        $detail = is_array($data) && isset($data['message']) ? ' — ' . (is_string($data['message']) ? $data['message'] : '') . (isset($data['code']) ? ' [' . $data['code'] . ']' : '') : '';
        $this->assertSame($expected, $response->get_status(), $message . $detail);
    }

    protected function errorCode(WP_REST_Response $response) {
        $data = $response->get_data();
        return is_array($data) && isset($data['code']) ? $data['code'] : null;
    }

    protected function count_rows($table, $where = '1=1') {
        global $wpdb;
        return (int) $wpdb->get_var('SELECT COUNT(*) FROM ' . Akph_Schema::table($table) . ' WHERE ' . $where);
    }

    // ------------------------------------------------------------------ fixtures (written through the API)

    protected function install_chart() {
        $previous = get_current_user_id();
        $this->login('admin');
        Akph_Accounts::install_standard_chart(false);
        wp_set_current_user($previous);
        Akph_Auth::flush();
    }

    /** Creates a project as the senior manager; returns its API record. */
    protected function make_project(array $fields = array()) {
        $previous = get_current_user_id();
        $this->login('senior');
        $response = $this->request('POST', '/projects', array_merge(array('name' => 'پروژه آزمایشی', 'client_name' => 'کارفرمای آزمایشی'), $fields));
        $this->assertStatus(201, $response);
        wp_set_current_user($previous);
        Akph_Auth::flush();
        return $response->get_data()['records']['projects'][0];
    }

    protected function entry_body($date, $amount = 1000000, array $extra = array()) {
        return array_merge(array(
            'date' => $date,
            'description' => 'سند آزمایشی',
            'lines' => array(
                array('account_code' => '11101', 'debit' => $amount, 'credit' => 0, 'description' => 'بانک'),
                array('account_code' => '41302', 'debit' => 0, 'credit' => $amount, 'description' => 'سایر درآمد'),
            ),
        ), $extra);
    }

    /** Creates a pending entry as `$creator`; returns its API record. */
    protected function make_entry($creator, $date, $amount = 1000000) {
        $previous = get_current_user_id();
        $this->login($creator);
        $response = $this->request('POST', '/journal-entries', $this->entry_body($date, $amount));
        $this->assertStatus(201, $response);
        wp_set_current_user($previous);
        Akph_Auth::flush();
        return $response->get_data()['records']['journal_entries'][0];
    }
}
