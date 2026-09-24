<?php
/**
 * Plugin Name: Paydar Management Portal
 * Description: سامانه پاک — پورتال مدیریت پروژه‌های آریا کاوش پی هامون، با نقش‌های سازمانی و دفتر حسابداری.
 * Version: 3.0.1
 * Requires at least: 6.2
 * Requires PHP: 7.4
 * Author: Paydar
 * License: GPL-2.0-or-later
 * Text Domain: paydar-portal
 */
if (!defined('ABSPATH')) { exit; }

final class Paydar_Portal {
    const VERSION = '3.0.1';
    const DB_VERSION = '2';
    const OPTION_DB_VERSION = 'paydar_portal_db_version';
    const OPTION_ROLES_VERSION = 'paydar_portal_roles_version';
    const ROLES_VERSION = '1';

    /* Capabilities */
    const CAP_ACCESS     = 'paydar_access';          // enter the portal
    const CAP_VIEW_ALL   = 'paydar_view_all';        // see every project (otherwise only assigned ones)
    const CAP_CREATE     = 'paydar_create_projects'; // register new projects
    const CAP_EDIT_BASE  = 'paydar_edit_base';       // name, client, location, contract id, description
    const CAP_EDIT_BUDGET= 'paydar_edit_budget';     // budget, contract amount
    const CAP_ASSIGN     = 'paydar_assign_manager';  // assign project manager (WP user id)
    const CAP_EDIT_EXEC_ALL = 'paydar_edit_exec_all';// execution fields on any project
    const CAP_EDIT_EXEC_OWN = 'paydar_edit_exec_own';// execution fields on own assigned projects
    const CAP_EDIT_FIN   = 'paydar_edit_financial';  // manual financial summaries

    /* Field groups: request key => group */
    private static $field_groups = array(
        'name' => 'base', 'client' => 'base', 'location' => 'base', 'contractId' => 'base', 'description' => 'base',
        'budget' => 'budget', 'contract' => 'budget',
        'managerUserId' => 'assign',
        'status' => 'exec', 'physical' => 'exec', 'supervisor' => 'exec', 'consultant' => 'exec', 'start' => 'exec', 'end' => 'exec',
        'revenue' => 'financial', 'cost' => 'financial', 'cash' => 'financial', 'receivable' => 'financial', 'payable' => 'financial',
    );
    /* Keys the UI may send that are always derived server-side and therefore ignored */
    private static $derived_keys = array('financial', 'manager', 'id');

    private static $instance;

    public static function boot() {
        if (!self::$instance) { self::$instance = new self(); }
        return self::$instance;
    }
    private function __construct() {
        register_activation_hook(__FILE__, array(__CLASS__, 'activate'));
        add_action('plugins_loaded', array(__CLASS__, 'maybe_upgrade'));
        add_action('rest_api_init', array($this, 'register_routes'));
        add_shortcode('paydar_portal', array($this, 'shortcode'));
        add_action('admin_notices', array($this, 'admin_notice'));
        add_filter('show_admin_bar', array($this, 'hide_admin_bar'));
        add_action('init', array($this, 'handle_login'));
        add_action('admin_init', array($this, 'keep_members_out_of_admin'));
        add_filter('login_redirect', array($this, 'login_redirect'), 10, 3);
        add_filter('logout_redirect', array($this, 'logout_redirect'), 10, 3);
    }
    private static function table_name() { global $wpdb; return $wpdb->prefix . 'paydar_projects'; }

    /* ---------- install / migration (additive only) ---------- */
    public static function activate() {
        self::migrate();
        self::install_roles();
        Paydar_Accounting::upgrade();
    }
    public static function maybe_upgrade() {
        if (get_option(self::OPTION_DB_VERSION) !== self::DB_VERSION) { self::migrate(); }
        if (get_option(self::OPTION_ROLES_VERSION) !== self::ROLES_VERSION) { self::install_roles(); }
    }
    private static function migrate() {
        global $wpdb;
        require_once ABSPATH . 'wp-admin/includes/upgrade.php';
        $table = self::table_name();
        $collate = $wpdb->get_charset_collate();
        // dbDelta only adds missing columns/indexes; it never drops columns or data.
        $sql = "CREATE TABLE {$table} (
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
            PRIMARY KEY  (id),
            UNIQUE KEY project_id (project_id),
            KEY status (status),
            KEY manager_user_id (manager_user_id)
        ) {$collate};";
        dbDelta($sql);
        update_option(self::OPTION_DB_VERSION, self::DB_VERSION, false);
    }
    public static function role_definitions() {
        $base = array('read' => true, self::CAP_ACCESS => true);
        return array(
            'paydar_senior_manager' => array('مدیر ارشد', $base + array(
                self::CAP_VIEW_ALL => true, self::CAP_CREATE => true, self::CAP_EDIT_BASE => true, self::CAP_EDIT_BUDGET => true,
                self::CAP_ASSIGN => true, self::CAP_EDIT_EXEC_ALL => true, self::CAP_EDIT_FIN => true)),
            'paydar_project_manager' => array('مدیر پروژه', $base + array(self::CAP_EDIT_EXEC_OWN => true)),
            'paydar_accountant' => array('حسابدار', $base + array(self::CAP_VIEW_ALL => true, self::CAP_EDIT_FIN => true)),
        );
    }
    public static function all_caps() {
        return array(self::CAP_ACCESS, self::CAP_VIEW_ALL, self::CAP_CREATE, self::CAP_EDIT_BASE, self::CAP_EDIT_BUDGET,
            self::CAP_ASSIGN, self::CAP_EDIT_EXEC_ALL, self::CAP_EDIT_EXEC_OWN, self::CAP_EDIT_FIN);
    }
    private static function install_roles() {
        foreach (self::role_definitions() as $slug => $def) {
            $role = get_role($slug);
            if (!$role) { add_role($slug, $def[0], $def[1]); continue; }
            // Existing role: bring capabilities in line with the definition without touching assigned users.
            foreach ($def[1] as $cap => $grant) { $role->add_cap($cap, $grant); }
            foreach (self::all_caps() as $cap) { if (!isset($def[1][$cap]) && $role->has_cap($cap)) { $role->remove_cap($cap); } }
        }
        $admin = get_role('administrator');
        if ($admin) { foreach (self::all_caps() as $cap) { $admin->add_cap($cap); } }
        update_option(self::OPTION_ROLES_VERSION, self::ROLES_VERSION, false);
    }

    /* ---------- permission helpers ---------- */
    private static function can($cap) { return current_user_can($cap); }
    private static function user_role_label($user = null) {
        $user = $user ?: wp_get_current_user();
        if (user_can($user, 'manage_options')) { return 'مدیر سیستم'; }
        foreach (self::role_definitions() as $slug => $def) { if (in_array($slug, (array) $user->roles, true)) { return $def[0]; } }
        return 'کاربر پرتال';
    }
    private static function is_assigned($row) {
        $uid = get_current_user_id();
        return $uid > 0 && (int) $row->manager_user_id === $uid;
    }
    private static function can_view_row($row) {
        return self::can(self::CAP_VIEW_ALL) || self::is_assigned($row);
    }
    /** Field groups the current user may write on a given row (null row = creation). */
    private static function writable_groups($row = null) {
        $g = array();
        if (self::can(self::CAP_EDIT_BASE)) { $g[] = 'base'; }
        if (self::can(self::CAP_EDIT_BUDGET)) { $g[] = 'budget'; }
        if (self::can(self::CAP_ASSIGN)) { $g[] = 'assign'; }
        if (self::can(self::CAP_EDIT_EXEC_ALL) || ($row && self::can(self::CAP_EDIT_EXEC_OWN) && self::is_assigned($row))) { $g[] = 'exec'; }
        if (self::can(self::CAP_EDIT_FIN)) { $g[] = 'financial'; }
        return $g;
    }

    /* ---------- REST ---------- */
    public function register_routes() {
        register_rest_route('paydar/v1', '/projects', array(
            array('methods' => WP_REST_Server::READABLE, 'callback' => array($this, 'list_projects'), 'permission_callback' => array($this, 'perm_access')),
            array('methods' => WP_REST_Server::CREATABLE, 'callback' => array($this, 'create_project'), 'permission_callback' => array($this, 'perm_create')),
        ));
        register_rest_route('paydar/v1', '/projects/(?P<project_id>[A-Z0-9-]+)', array(
            array('methods' => WP_REST_Server::READABLE, 'callback' => array($this, 'get_project'), 'permission_callback' => array($this, 'perm_access')),
            array('methods' => WP_REST_Server::EDITABLE, 'callback' => array($this, 'update_project'), 'permission_callback' => array($this, 'perm_access')),
        ));
        register_rest_route('paydar/v1', '/me', array(
            array('methods' => WP_REST_Server::READABLE, 'callback' => array($this, 'me'), 'permission_callback' => array($this, 'perm_access')),
        ));
        register_rest_route('paydar/v1', '/managers', array(
            array('methods' => WP_REST_Server::READABLE, 'callback' => array($this, 'list_managers'), 'permission_callback' => array($this, 'perm_assign')),
        ));
    }
    public function perm_access() {
        if (!is_user_logged_in()) { return new WP_Error('paydar_unauthorized', 'برای دسترسی به پرتال وارد شوید.', array('status' => 401)); }
        if (!self::can(self::CAP_ACCESS)) { return new WP_Error('paydar_forbidden', 'حساب شما به پرتال دسترسی ندارد.', array('status' => 403)); }
        return true;
    }
    public function perm_create() {
        $ok = $this->perm_access();
        if ($ok !== true) { return $ok; }
        return self::can(self::CAP_CREATE) ? true : new WP_Error('paydar_forbidden', 'اجازه ثبت پروژه جدید را ندارید.', array('status' => 403));
    }
    public function perm_assign() {
        $ok = $this->perm_access();
        if ($ok !== true) { return $ok; }
        return self::can(self::CAP_ASSIGN) ? true : new WP_Error('paydar_forbidden', 'اجازه تخصیص مدیر پروژه را ندارید.', array('status' => 403));
    }

    public function me() {
        $u = wp_get_current_user();
        return rest_ensure_response(array(
            'id' => $u->ID, 'name' => $u->display_name, 'role' => self::user_role_label($u),
            'can' => array(
                'viewAll' => self::can(self::CAP_VIEW_ALL), 'create' => self::can(self::CAP_CREATE),
                'assign' => self::can(self::CAP_ASSIGN), 'editBase' => self::can(self::CAP_EDIT_BASE),
                'editBudget' => self::can(self::CAP_EDIT_BUDGET), 'editFinancial' => self::can(self::CAP_EDIT_FIN),
                'editExecAll' => self::can(self::CAP_EDIT_EXEC_ALL), 'editExecOwn' => self::can(self::CAP_EDIT_EXEC_OWN),
            ),
        ));
    }
    public function list_managers() {
        $users = get_users(array('role__in' => array('paydar_project_manager'), 'orderby' => 'display_name', 'fields' => array('ID', 'display_name')));
        $out = array();
        foreach ($users as $u) {
            $role = self::user_role_label(get_userdata($u->ID));
            $out[] = array('id' => (int) $u->ID, 'name' => $u->display_name, 'role' => $role);
        }
        return rest_ensure_response(array('managers' => $out));
    }

    private function shape($row) {
        return array(
            'id' => (string) $row->project_id,
            'name' => $row->name, 'client' => $row->client, 'manager' => $row->manager, 'managerUserId' => (int) $row->manager_user_id,
            'supervisor' => $row->supervisor, 'consultant' => $row->consultant, 'location' => $row->location,
            'budget' => (float) $row->budget, 'contract' => (float) $row->contract_amount,
            'revenue' => (float) $row->revenue, 'cost' => (float) $row->cost, 'cash' => (float) $row->cash,
            'receivable' => (float) $row->receivable, 'payable' => (float) $row->payable,
            'physical' => (int) $row->physical, 'financial' => (int) $row->financial, 'status' => $row->status,
            'start' => $row->start_date, 'end' => $row->end_date, 'contractId' => $row->contract_id,
            'description' => $row->description,
            'editable' => self::writable_groups($row),
        );
    }
    /** Project id taken ONLY from the URL route (body/query params can never redirect the target). */
    private static function route_id($request) {
        $u = $request->get_url_params();
        return isset($u['project_id']) ? sanitize_text_field($u['project_id']) : '';
    }
    private function find_row($id) {
        global $wpdb;
        return $wpdb->get_row($wpdb->prepare('SELECT * FROM ' . self::table_name() . ' WHERE project_id = %s', $id));
    }
    public function list_projects() {
        global $wpdb;
        $t = self::table_name();
        if (self::can(self::CAP_VIEW_ALL)) {
            $rows = $wpdb->get_results("SELECT * FROM {$t} ORDER BY updated_at DESC, id DESC");
        } else {
            $rows = $wpdb->get_results($wpdb->prepare("SELECT * FROM {$t} WHERE manager_user_id = %d AND manager_user_id > 0 ORDER BY updated_at DESC, id DESC", get_current_user_id()));
        }
        return rest_ensure_response(array('projects' => array_map(array($this, 'shape'), $rows ?: array())));
    }
    public function get_project($request) {
        $row = $this->find_row(self::route_id($request));
        // Same response for "missing" and "not yours" so IDs of other projects are not revealed.
        if (!$row || !self::can_view_row($row)) { return new WP_Error('paydar_not_found', 'پروژه پیدا نشد.', array('status' => 404)); }
        return rest_ensure_response(array('project' => $this->shape($row)));
    }

    /** Validate that every submitted field belongs to an allowed group. */
    private function check_fields($request, $allowed_groups) {
        $params = $request->get_json_params();
        if (!is_array($params)) { $params = $request->get_body_params(); }
        $denied = array();
        foreach ((array) $params as $key => $val) {
            if (in_array($key, self::$derived_keys, true)) { continue; }
            if (!isset(self::$field_groups[$key])) { $denied[] = $key; continue; }
            if (!in_array(self::$field_groups[$key], $allowed_groups, true)) { $denied[] = $key; }
        }
        if ($denied) {
            return new WP_Error('paydar_field_forbidden', 'اجازه تغییر این فیلدها را ندارید: ' . implode('، ', $denied), array('status' => 403, 'fields' => $denied));
        }
        return array_keys((array) $params);
    }
    private function resolve_manager($uid) {
        $uid = (int) $uid;
        if ($uid === 0) { return array(0, null); }
        $user = get_userdata($uid);
        if (!$user || !in_array('paydar_project_manager', (array) $user->roles, true)) {
            return new WP_Error('paydar_bad_manager', 'کاربر انتخاب‌شده نقش مدیر پروژه ندارد.', array('status' => 400));
        }
        return array($uid, $user->display_name);
    }
    /** Build DB columns from the submitted, already-authorised keys. */
    private function columns($request, $keys) {
        $p = function($k) use ($request) { return $request->get_param($k); };
        $num = function($k) use ($p) { return max(0, (float) $p($k)); };
        $map = array(
            'name' => function() use ($p) { return array('name' => sanitize_text_field($p('name'))); },
            'client' => function() use ($p) { return array('client' => sanitize_text_field($p('client'))); },
            'location' => function() use ($p) { return array('location' => sanitize_text_field($p('location'))); },
            'contractId' => function() use ($p) { return array('contract_id' => sanitize_text_field($p('contractId'))); },
            'description' => function() use ($p) { return array('description' => sanitize_textarea_field($p('description'))); },
            'budget' => function() use ($num) { return array('budget' => $num('budget')); },
            'contract' => function() use ($num) { return array('contract_amount' => $num('contract')); },
            'status' => function() use ($p) { $s = sanitize_key($p('status')); return array('status' => in_array($s, array('active','risk','done','paused'), true) ? $s : 'active'); },
            'physical' => function() use ($p) { return array('physical' => min(100, max(0, (int) $p('physical')))); },
            'supervisor' => function() use ($p) { return array('supervisor' => sanitize_text_field($p('supervisor'))); },
            'consultant' => function() use ($p) { return array('consultant' => sanitize_text_field($p('consultant'))); },
            'start' => function() use ($p) { return array('start_date' => sanitize_text_field($p('start'))); },
            'end' => function() use ($p) { return array('end_date' => sanitize_text_field($p('end'))); },
            'revenue' => function() use ($num) { return array('revenue' => $num('revenue')); },
            'cost' => function() use ($num) { return array('cost' => $num('cost')); },
            'cash' => function() use ($num) { return array('cash' => $num('cash')); },
            'receivable' => function() use ($num) { return array('receivable' => $num('receivable')); },
            'payable' => function() use ($num) { return array('payable' => $num('payable')); },
        );
        $data = array();
        foreach ($keys as $k) { if (isset($map[$k])) { $data += $map[$k](); } }
        if (in_array('managerUserId', $keys, true)) {
            $m = $this->resolve_manager($p('managerUserId'));
            if (is_wp_error($m)) { return $m; }
            $data['manager_user_id'] = $m[0];
            if ($m[1] !== null) { $data['manager'] = $m[1]; }
        }
        return $data;
    }
    private static function recalc_financial(&$data, $row = null) {
        $contract = isset($data['contract_amount']) ? (float) $data['contract_amount'] : ($row ? (float) $row->contract_amount : 0);
        $revenue = isset($data['revenue']) ? (float) $data['revenue'] : ($row ? (float) $row->revenue : 0);
        $data['financial'] = $contract > 0 ? (int) min(100, round($revenue / $contract * 100)) : 0;
    }

    public function create_project($request) {
        global $wpdb;
        $groups = self::writable_groups(null);
        $keys = $this->check_fields($request, $groups);
        if (is_wp_error($keys)) { return $keys; }
        $data = $this->columns($request, $keys);
        if (is_wp_error($data)) { return $data; }
        foreach (array('name' => 'نام پروژه', 'client' => 'کارفرما') as $col => $label) {
            if (empty($data[$col])) { return new WP_Error('paydar_required_fields', $label . ' الزامی است.', array('status' => 400)); }
        }
        if (empty($data['manager'])) { $data['manager'] = ''; }
        if (!isset($data['description'])) { $data['description'] = ''; }
        self::recalc_financial($data);
        $id = 'PRJ-' . gmdate('y') . '-' . strtoupper(wp_generate_password(6, false, false));
        $data['project_id'] = $id;
        $data['created_at'] = current_time('mysql');
        $data['updated_at'] = current_time('mysql');
        if (!$wpdb->insert(self::table_name(), $data)) { return new WP_Error('paydar_save_failed', 'ذخیره پروژه انجام نشد. دوباره تلاش کنید.', array('status' => 500)); }
        return new WP_REST_Response(array('project' => $this->shape($this->find_row($id))), 201);
    }
    public function update_project($request) {
        global $wpdb;
        $id = self::route_id($request);
        $row = $this->find_row($id);
        if (!$row || !self::can_view_row($row)) { return new WP_Error('paydar_not_found', 'پروژه پیدا نشد.', array('status' => 404)); }
        $groups = self::writable_groups($row);
        if (!$groups) { return new WP_Error('paydar_forbidden', 'اجازه ویرایش این پروژه را ندارید.', array('status' => 403)); }
        $keys = $this->check_fields($request, $groups);
        if (is_wp_error($keys)) { return $keys; }
        $data = $this->columns($request, $keys);
        if (is_wp_error($data)) { return $data; }
        if ((isset($data['name']) && $data['name'] === '') || (isset($data['client']) && $data['client'] === '')) {
            return new WP_Error('paydar_required_fields', 'نام پروژه و کارفرما نمی‌توانند خالی باشند.', array('status' => 400));
        }
        if (!$data) { return rest_ensure_response(array('project' => $this->shape($row))); }
        self::recalc_financial($data, $row);
        $data['updated_at'] = current_time('mysql');
        if ($wpdb->update(self::table_name(), $data, array('project_id' => $id)) === false) {
            return new WP_Error('paydar_update_failed', 'به‌روزرسانی پروژه انجام نشد.', array('status' => 500));
        }
        return rest_ensure_response(array('project' => $this->shape($this->find_row($id))));
    }

    /* ---------- front end ---------- */
    public function hide_admin_bar($show) {
        return (is_user_logged_in() && !current_user_can('manage_options')) ? false : $show;
    }
    public function shortcode() {
        if (!is_user_logged_in()) { return $this->login_form(); }
        if (!self::can(self::CAP_ACCESS)) {
            return '<section class="paydar-login-required"><h2>دسترسی محدود است</h2><p>حساب کاربری شما اجازه مشاهده این پرتال را ندارد.</p></section>';
        }
        $u = wp_get_current_user();
        wp_enqueue_style('paydar-portal', plugins_url('assets/portal.css', __FILE__), array(), self::VERSION);
        wp_enqueue_style('paydar-accounting', plugins_url('assets/accounting.css', __FILE__), array('paydar-portal'), self::VERSION);
        wp_enqueue_style('paydar-petty', plugins_url('assets/petty-cash.css', __FILE__), array('paydar-accounting'), self::VERSION);
        wp_enqueue_script('paydar-petty', plugins_url('assets/petty-cash.js', __FILE__), array(), self::VERSION, true);
        wp_enqueue_script('paydar-accounting', plugins_url('assets/accounting.js', __FILE__), array(), self::VERSION, true);
        wp_enqueue_script('paydar-portal', plugins_url('assets/portal.js', __FILE__), array('paydar-accounting','paydar-petty'), self::VERSION, true);
        wp_localize_script('paydar-portal', 'PaydarPortal', array(
            'accounting' => Paydar_Accounting::caps(),
            'petty' => Paydar_Petty_Cash::caps(),
            'restUrl' => esc_url_raw(rest_url('paydar/v1')),
            'nonce' => wp_create_nonce('wp_rest'),
            'displayName' => $u->display_name,
            'roleLabel' => self::user_role_label($u),
            'userId' => $u->ID,
            'siteName' => get_bloginfo('name'),
            'logoUrl' => plugins_url('assets/logo-mark.png', __FILE__),
            'logoutUrl' => wp_logout_url(home_url('/')),
            'can' => array(
                'viewAll' => self::can(self::CAP_VIEW_ALL), 'create' => self::can(self::CAP_CREATE), 'assign' => self::can(self::CAP_ASSIGN),
                'editBase' => self::can(self::CAP_EDIT_BASE), 'editBudget' => self::can(self::CAP_EDIT_BUDGET), 'editFinancial' => self::can(self::CAP_EDIT_FIN),
            ),
        ));
        return '<div class="paydar-app" dir="rtl"><aside id="sidebar"></aside><div class="workspace"><header><button class="icon-button mobile" id="menu" aria-label="باز کردن منو">☰</button><div class="breadcrumb">سامانه پاک <span>/</span> <b id="crumb">نمای کلی شرکت</b></div><div class="header-end"><span class="date">' . esc_html(wp_date('l، j F Y')) . '</span><span class="divider"></span><button class="icon-button" id="notifications" aria-label="هشدارها"></button><span class="avatar" title="' . esc_attr($u->display_name) . '">' . esc_html(mb_substr($u->display_name, 0, 1)) . '</span></div></header><main id="app"><div class="card empty">در حال بارگذاری پروژه‌ها…</div></main><footer><span>سامانه پاک · پورتال آریا کاوش پی هامون</span><span>پروژه · حسابداری · تنخواه</span></footer></div><dialog id="modal"></dialog><div id="toast" role="status"></div></div>';
    }

    /* ---------- dedicated member login ---------- */
    private static function portal_url() {
        $front = (int) get_option('page_on_front');
        return $front ? get_permalink($front) : home_url('/');
    }
    private static function client_ip() {
        return isset($_SERVER['REMOTE_ADDR']) ? preg_replace('/[^0-9a-fA-F:.]/', '', wp_unslash($_SERVER['REMOTE_ADDR'])) : 'unknown';
    }
    private static function redirect_with($code) {
        wp_safe_redirect(add_query_arg('login', $code, self::portal_url()));
        exit;
    }
    public function handle_login() {
        if (empty($_POST['paydar_login']) || $_SERVER['REQUEST_METHOD'] !== 'POST') { return; }
        if (!isset($_POST['_pnonce']) || !wp_verify_nonce(sanitize_text_field(wp_unslash($_POST['_pnonce'])), 'paydar_login')) { self::redirect_with('expired'); }
        $key = 'paydar_lf_' . md5(self::client_ip());
        $fails = (int) get_transient($key);
        if ($fails >= 5) { self::redirect_with('locked'); }
        $login = isset($_POST['log']) ? sanitize_user(wp_unslash($_POST['log'])) : '';
        $pass = isset($_POST['pwd']) ? (string) wp_unslash($_POST['pwd']) : '';
        if ($login === '' || $pass === '') { self::redirect_with('empty'); }
        $user = wp_signon(array('user_login' => $login, 'user_password' => $pass, 'remember' => !empty($_POST['rememberme'])), is_ssl());
        if (is_wp_error($user)) {
            set_transient($key, $fails + 1, 15 * MINUTE_IN_SECONDS);
            self::redirect_with('failed');
        }
        delete_transient($key);
        if (!user_can($user, self::CAP_ACCESS) && !user_can($user, 'manage_options')) {
            wp_logout();
            self::redirect_with('noaccess');
        }
        wp_safe_redirect(self::portal_url());
        exit;
    }
    public function keep_members_out_of_admin() {
        if (wp_doing_ajax() || (defined('DOING_CRON') && DOING_CRON) || !is_user_logged_in() || current_user_can('manage_options')) { return; }
        global $pagenow;
        if ($pagenow === 'admin-post.php') { return; }
        wp_safe_redirect(self::portal_url());
        exit;
    }
    public function login_redirect($redirect_to, $requested, $user) {
        if ($user instanceof WP_User && !user_can($user, 'manage_options')) { return self::portal_url(); }
        return $redirect_to;
    }
    public function logout_redirect($redirect_to, $requested, $user) {
        return add_query_arg('login', 'out', self::portal_url());
    }
    private function login_form() {
        wp_enqueue_style('paydar-login', plugins_url('assets/login.css', __FILE__), array(), self::VERSION);
        $msgs = array(
            'failed' => array('err', 'نام کاربری یا رمز عبور درست نیست.'),
            'empty' => array('err', 'نام کاربری و رمز عبور را وارد کنید.'),
            'locked' => array('err', 'به‌دلیل تلاش‌های ناموفق پی‌درپی، ورود تا ۱۵ دقیقه دیگر ممکن نیست.'),
            'expired' => array('err', 'مهلت صفحه تمام شده بود؛ دوباره تلاش کنید.'),
            'noaccess' => array('err', 'حساب شما به سامانه پاک دسترسی ندارد. با مدیر سیستم تماس بگیرید.'),
            'out' => array('ok', 'با موفقیت از سامانه خارج شدید.'),
        );
        $code = isset($_GET['login']) ? sanitize_key(wp_unslash($_GET['login'])) : '';
        $msg = isset($msgs[$code]) ? '<div class="pl-msg ' . $msgs[$code][0] . '" role="alert">' . esc_html($msgs[$code][1]) . '</div>' : '';
        $logo = esc_url(plugins_url('assets/logo-mark.png', __FILE__));
        $lost = esc_url(wp_lostpassword_url(self::portal_url()));
        $action = esc_url(self::portal_url());
        $year = esc_html(wp_date('Y'));
        ob_start(); ?>
<div class="paydar-login" dir="rtl">
  <div class="pl-card">
    <section class="pl-side">
      <img src="<?php echo $logo; ?>" alt="آریا کاوش پی هامون" class="pl-logo">
      <h1>سامانه پاک</h1>
      <p class="pl-sub">پورتال آریا کاوش پی هامون</p>
      <ul class="pl-points">
        <li>پایش پروژه‌ها و پیشرفت فیزیکی</li>
        <li>خلاصه‌های مالی و بودجه</li>
        <li>تقویم کاری، مهلت‌ها و تعطیلات</li>
      </ul>
      <p class="pl-note">دسترسی هر کاربر بر اساس نقش سازمانی او تعیین می‌شود.</p>
    </section>
    <section class="pl-form">
      <h2>ورود اعضا</h2>
      <p class="pl-hint">با نام کاربری و رمز عبوری که مدیر سیستم برای شما تعریف کرده وارد شوید.</p>
      <?php echo $msg; ?>
      <form method="post" action="<?php echo $action; ?>" autocomplete="on" novalidate>
        <input type="hidden" name="paydar_login" value="1">
        <input type="hidden" name="_pnonce" value="<?php echo esc_attr(wp_create_nonce('paydar_login')); ?>">
        <label for="pl-user">نام کاربری یا ایمیل</label>
        <input id="pl-user" name="log" type="text" required autocomplete="username" dir="ltr" autofocus>
        <label for="pl-pass">رمز عبور</label>
        <div class="pl-pass">
          <input id="pl-pass" name="pwd" type="password" required autocomplete="current-password" dir="ltr">
          <button type="button" class="pl-eye" aria-label="نمایش رمز عبور" onclick="var i=document.getElementById('pl-pass');var s=i.type==='password';i.type=s?'text':'password';this.setAttribute('aria-label',s?'پنهان کردن رمز عبور':'نمایش رمز عبور');this.classList.toggle('on',s)"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg></button>
        </div>
        <div class="pl-row">
          <label class="pl-check"><input type="checkbox" name="rememberme" value="1"> مرا به خاطر بسپار</label>
          <a href="<?php echo $lost; ?>">فراموشی رمز عبور</a>
        </div>
        <button type="submit" class="pl-submit">ورود به سامانه</button>
      </form>
      <p class="pl-foot">ثبت‌نام عمومی وجود ندارد · © <?php echo $year; ?> آریا کاوش پی هامون</p>
    </section>
  </div>
</div>
<?php
        return ob_get_clean();
    }

    public function admin_notice() {
        if (!current_user_can('manage_options')) { return; }
        if (get_option(self::OPTION_DB_VERSION) !== self::DB_VERSION) {
            echo '<div class="notice notice-warning"><p>جدول اطلاعات پروژه‌ها به‌روز نیست. صفحه را یک‌بار دیگر بارگذاری کنید؛ اگر پیام باقی ماند افزونه را غیرفعال و دوباره فعال کنید.</p></div>';
        }
    }
}
Paydar_Portal::boot();
require_once __DIR__ . '/includes/class-paydar-accounting.php';
require_once __DIR__ . '/includes/class-paydar-petty-cash.php';
