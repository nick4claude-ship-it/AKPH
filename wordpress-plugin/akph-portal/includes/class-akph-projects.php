<?php
/**
 * Projects. Field groups as in paydar-portal (base, budget, assign, exec, financial): each field belongs
 * to one group and a user may write only the groups of their capabilities. Project managers see and edit
 * (execution fields only) the projects whose manager_user_id is their user id.
 *
 * The «manual summary» (revenue, cost, cash, receivable, payable) is a figure typed by a person or copied
 * from the old system. It never creates an accounting entry; the ledger figures come from posted entries.
 */
if (!defined('ABSPATH')) {
    exit;
}

final class Akph_Projects {
    const STATUSES = array('active', 'mobilizing', 'provisional_handover', 'suspended', 'closed');

    /** API field → group. */
    const FIELD_GROUPS = array(
        'name' => 'base', 'client_id' => 'base', 'client_name' => 'base', 'location' => 'base', 'contract_ref' => 'base', 'description' => 'base',
        'budget' => 'budget', 'contract_amount' => 'budget',
        'manager_user_id' => 'assign',
        'status' => 'exec', 'physical_progress' => 'exec', 'site_supervisor' => 'exec', 'consultant_name' => 'exec', 'start_date' => 'exec', 'end_date' => 'exec',
        'manual_revenue' => 'financial', 'manual_cost' => 'financial', 'manual_cash' => 'financial', 'manual_receivable' => 'financial',
        'manual_payable' => 'financial', 'manual_summary_note' => 'financial',
    );
    /** Keys a client may send that the server ignores (derived or identifying). */
    const IGNORED = array('id', 'code', 'version', 'editable', 'manager_name', 'created_at', 'updated_at');

    public static function table() {
        return Akph_Schema::table('projects');
    }

    public static function is_own($row) {
        return (int) $row->manager_user_id > 0 && (int) $row->manager_user_id === get_current_user_id();
    }

    public static function can_view($row) {
        return Akph_Auth::view_all() || self::is_own($row);
    }

    /** Groups the current user may write on `$row` (null = a new project). */
    public static function writable_groups($row = null) {
        $g = array();
        if (current_user_can(Akph_Roles::PROJECTS_EDIT_BASE)) {
            $g[] = 'base';
        }
        if (current_user_can(Akph_Roles::PROJECTS_EDIT_BUDGET)) {
            $g[] = 'budget';
        }
        if (current_user_can(Akph_Roles::PROJECTS_ASSIGN)) {
            $g[] = 'assign';
        }
        if (current_user_can(Akph_Roles::PROJECTS_EDIT_EXEC_ALL) || ($row && current_user_can(Akph_Roles::PROJECTS_EDIT_EXEC_OWN) && self::is_own($row))) {
            $g[] = 'exec';
        }
        if (current_user_can(Akph_Roles::PROJECTS_EDIT_FINANCIAL)) {
            $g[] = 'financial';
        }
        return $g;
    }

    public static function shape($row) {
        $manager = (int) $row->manager_user_id ? get_userdata((int) $row->manager_user_id) : null;
        return array(
            'id' => (string) $row->id,
            'code' => $row->code,
            'name' => $row->name,
            'client_id' => (int) $row->client_id ? (string) $row->client_id : null,
            'client_name' => $row->client_name,
            'consultant_name' => $row->consultant_name,
            'manager_user_id' => (int) $row->manager_user_id ? (string) $row->manager_user_id : null,
            'manager_name' => $manager ? $manager->display_name : '',
            'site_supervisor' => $row->site_supervisor,
            'location' => $row->location,
            'contract_ref' => $row->contract_ref,
            'description' => (string) $row->description,
            'status' => $row->status,
            'physical_progress' => (int) $row->physical_progress,
            'start_date' => $row->start_date ?: null,
            'end_date' => $row->end_date ?: null,
            'budget' => (int) $row->budget,
            'contract_amount' => (int) $row->contract_amount,
            'manual_summary' => array(
                'revenue' => (int) $row->manual_revenue,
                'cost' => (int) $row->manual_cost,
                'cash' => (int) $row->manual_cash,
                'receivable' => (int) $row->manual_receivable,
                'payable' => (int) $row->manual_payable,
                'note' => $row->manual_summary_note,
            ),
            'legacy_id' => $row->legacy_id,
            'version' => (int) $row->version,
            'editable' => self::writable_groups($row),
            'created_at' => Akph_Db::iso_time($row->created_at),
            'updated_at' => Akph_Db::iso_time($row->updated_at),
        );
    }

    public static function list_visible() {
        global $wpdb;
        $t = self::table();
        if (Akph_Auth::view_all()) {
            $rows = Akph_Db::results("SELECT * FROM {$t} ORDER BY id DESC");
        } else {
            $rows = Akph_Db::results($wpdb->prepare("SELECT * FROM {$t} WHERE manager_user_id = %d AND manager_user_id > 0 ORDER BY id DESC", get_current_user_id()));
        }
        return array_map(array(__CLASS__, 'shape'), (array) $rows);
    }

    /** Same answer for "missing" and "not yours", so ids of other projects are not revealed. */
    public static function get_visible($id) {
        $row = Akph_Db::find(self::table(), $id);
        if (!$row || !self::can_view($row)) {
            throw Akph_Error::not_found('پروژه پیدا نشد.');
        }
        return $row;
    }

    /** Checks every submitted key against the writable groups; returns the keys to apply. */
    private static function allowed_keys(array $body, array $groups) {
        $denied = array();
        $unknown = array();
        $keys = array();
        foreach (array_keys($body) as $key) {
            if (in_array($key, self::IGNORED, true)) {
                continue;
            }
            if (!isset(self::FIELD_GROUPS[$key])) {
                $unknown[] = $key;
                continue;
            }
            if (!in_array(self::FIELD_GROUPS[$key], $groups, true)) {
                $denied[] = $key;
                continue;
            }
            $keys[] = $key;
        }
        if ($unknown) {
            throw Akph_Error::invalid('فیلد ناشناخته: ' . implode('، ', $unknown), array('fields' => $unknown));
        }
        if ($denied) {
            throw new Akph_Error('akph_field_forbidden', 'اجازه تغییر این فیلدها را ندارید: ' . implode('، ', $denied), 403, array('fields' => $denied));
        }
        return $keys;
    }

    /** Column values of the submitted, already authorised keys. */
    private static function columns(array $body, array $keys) {
        $data = array();
        foreach ($keys as $key) {
            switch ($key) {
                case 'name':
                    $data['name'] = Akph_Input::text($body, 'name', 190, true, 'نام پروژه');
                    break;
                case 'client_name':
                case 'location':
                case 'site_supervisor':
                case 'consultant_name':
                    $data[$key] = Akph_Input::text($body, $key, 190);
                    break;
                case 'contract_ref':
                    $data['contract_ref'] = Akph_Input::text($body, 'contract_ref', 64);
                    break;
                case 'manual_summary_note':
                    $data['manual_summary_note'] = Akph_Input::text($body, 'manual_summary_note', 255);
                    break;
                case 'description':
                    $data['description'] = Akph_Input::text($body, 'description', 5000);
                    break;
                case 'client_id':
                    $client = Akph_Input::id($body, 'client_id');
                    if ($client) {
                        $cp = Akph_Db::find(Akph_Schema::table('counterparties'), $client);
                        if (!$cp || $cp->kind !== 'client') {
                            throw Akph_Error::invalid('کارفرمای انتخاب‌شده در طرف‌های حساب (نوع کارفرما) پیدا نشد.', array('field' => 'client_id'));
                        }
                        $data['client_name'] = $cp->name;
                    }
                    $data['client_id'] = $client;
                    break;
                case 'budget':
                case 'contract_amount':
                case 'manual_revenue':
                case 'manual_cost':
                case 'manual_cash':
                case 'manual_receivable':
                case 'manual_payable':
                    $data[$key] = Akph_Input::amount($body, $key);
                    break;
                case 'manager_user_id':
                    $uid = Akph_Input::id($body, 'manager_user_id');
                    if ($uid) {
                        $user = get_userdata($uid);
                        if (!$user || !in_array('paydar_project_manager', (array) $user->roles, true)) {
                            throw Akph_Error::invalid('کاربر انتخاب‌شده نقش مدیر پروژه ندارد.', array('field' => 'manager_user_id'));
                        }
                    }
                    $data['manager_user_id'] = $uid;
                    break;
                case 'status':
                    $data['status'] = Akph_Input::one_of($body, 'status', self::STATUSES);
                    break;
                case 'physical_progress':
                    $p = $body['physical_progress'];
                    if (!is_int($p) || $p < 0 || $p > 100) {
                        throw Akph_Error::invalid('پیشرفت فیزیکی باید عدد صحیح ۰ تا ۱۰۰ باشد.', array('field' => 'physical_progress'));
                    }
                    $data['physical_progress'] = $p;
                    break;
                case 'start_date':
                case 'end_date':
                    $data[$key] = Akph_Input::iso_date($body, $key, false);
                    break;
            }
        }
        return $data;
    }

    private static function check_dates(array $merged) {
        if (!empty($merged['start_date']) && !empty($merged['end_date']) && $merged['end_date'] < $merged['start_date']) {
            throw Akph_Error::invalid('تاریخ پایان نمی‌تواند قبل از تاریخ شروع باشد.', array('field' => 'end_date'));
        }
    }

    public static function create(array $body) {
        Akph_Auth::assert_cap(Akph_Roles::PROJECTS_CREATE, 'اجازه ثبت پروژه جدید را ندارید.');
        $keys = self::allowed_keys($body, self::writable_groups(null));
        $data = self::columns($body, $keys);
        if (empty($data['name'])) {
            throw Akph_Error::invalid('نام پروژه الزامی است.', array('field' => 'name'));
        }
        if (empty($data['client_name'])) {
            throw Akph_Error::invalid('کارفرما الزامی است.', array('field' => 'client_name'));
        }
        self::check_dates($data);
        $now = Akph_Db::now_utc();
        $data += array('description' => '', 'status' => 'active');
        $data['code'] = 'TMP-' . wp_generate_password(20, false, false);
        $data['version'] = 1;
        $data['created_by'] = get_current_user_id();
        $data['updated_by'] = get_current_user_id();
        $data['created_at'] = $now;
        $data['updated_at'] = $now;
        $id = Akph_Db::insert(self::table(), $data);
        $code = Akph_Numbering::issue('PRJ', Akph_Jalali::fiscal_year(Akph_Jalali::today_iso()), 'project', $id);
        Akph_Db::update(self::table(), array('code' => $code), array('id' => $id));
        $row = Akph_Db::find(self::table(), $id);
        Akph_Audit::log('project_created', 'project', $id, null, self::audit_view($row), $code);
        return array('status' => 201, 'message' => 'پروژه ' . $code . ' ثبت شد.', 'id' => $id, 'records' => array('projects' => array(self::shape($row))));
    }

    public static function update($id, array $body, $version) {
        $row = Akph_Db::lock(self::table(), $id);
        if (!$row || !self::can_view($row)) {
            throw Akph_Error::not_found('پروژه پیدا نشد.');
        }
        Akph_Input::assert_version($row, $version);
        $groups = self::writable_groups($row);
        if (!$groups) {
            throw Akph_Error::forbidden('اجازه ویرایش این پروژه را ندارید.');
        }
        $keys = self::allowed_keys($body, $groups);
        $data = self::columns($body, $keys);
        if (array_key_exists('client_name', $data) && $data['client_name'] === '') {
            throw Akph_Error::invalid('کارفرما نمی‌تواند خالی باشد.', array('field' => 'client_name'));
        }
        self::check_dates(array_merge((array) $row, $data));
        if (!$data) {
            return array('message' => 'تغییری ثبت نشد.', 'id' => $id, 'records' => array('projects' => array(self::shape($row))));
        }
        $data['version'] = (int) $row->version + 1;
        $data['updated_by'] = get_current_user_id();
        $data['updated_at'] = Akph_Db::now_utc();
        Akph_Db::update(self::table(), $data, array('id' => $id));
        $after = Akph_Db::find(self::table(), $id);
        Akph_Audit::log('project_updated', 'project', $id, self::audit_view($row), self::audit_view($after), $row->code);
        return array('message' => 'پروژه ' . $row->code . ' به‌روز شد.', 'id' => $id, 'records' => array('projects' => array(self::shape($after))));
    }

    /** Stored columns only (no derived fields) for the audit trail. */
    private static function audit_view($row) {
        $a = (array) $row;
        unset($a['created_at'], $a['updated_at']);
        return $a;
    }

    /** Users with the project manager role, for the assignment field. */
    public static function managers() {
        $users = get_users(array('role__in' => array('paydar_project_manager'), 'orderby' => 'display_name', 'fields' => array('ID', 'display_name')));
        $out = array();
        foreach ($users as $u) {
            $out[] = array('id' => (string) $u->ID, 'name' => $u->display_name);
        }
        return $out;
    }
}
