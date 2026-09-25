<?php
/**
 * Cost centers and counterparties (clients, suppliers, subcontractors, consultants, ...).
 * Written by users with akph_master_data (system admin, senior manager, accountant). Project managers see
 * the cost centers of their own projects and the counterparties their projects refer to; headquarters
 * records (no project) are outside their scope.
 */
if (!defined('ABSPATH')) {
    exit;
}

final class Akph_Master_Data {
    const COUNTERPARTY_KINDS = array('client', 'supplier', 'subcontractor', 'consultant', 'employee', 'bank', 'other');
    const COST_CENTER_TYPES = array('project_site', 'headquarters', 'central_warehouse', 'machinery', 'technical_office', 'other');

    // ------------------------------------------------------------------ cost centers

    public static function cost_center_shape($row) {
        return array(
            'id' => (string) $row->id,
            'code' => $row->code,
            'name' => $row->name,
            'project_id' => $row->project_id ? (string) $row->project_id : null,
            'type' => $row->type,
            'manager_name' => $row->manager_name,
            'budget' => (int) $row->budget,
            'active' => (bool) (int) $row->active,
            'version' => (int) $row->version,
            'updated_at' => Akph_Db::iso_time($row->updated_at),
        );
    }

    public static function list_cost_centers() {
        global $wpdb;
        $t = Akph_Schema::table('cost_centers');
        $scope = Akph_Auth::project_scope_sql('project_id');
        $rows = Akph_Db::results("SELECT * FROM {$t} WHERE {$scope} ORDER BY code");
        return array_map(array(__CLASS__, 'cost_center_shape'), (array) $rows);
    }

    private static function cost_center_columns(array $body, $existing = null) {
        $data = array();
        if (!$existing || array_key_exists('name', $body)) {
            $data['name'] = Akph_Input::text($body, 'name', 190, true, 'نام مرکز هزینه');
        }
        if (!$existing || array_key_exists('project_id', $body)) {
            $project = Akph_Input::id($body, 'project_id');
            if ($project && !Akph_Db::find(Akph_Schema::table('projects'), $project)) {
                throw Akph_Error::invalid('پروژه مرکز هزینه پیدا نشد.', array('field' => 'project_id'));
            }
            $data['project_id'] = $project ?: null;
        }
        if (!$existing || array_key_exists('type', $body)) {
            $data['type'] = Akph_Input::one_of($body, 'type', self::COST_CENTER_TYPES, 'project_site');
        }
        if (!$existing || array_key_exists('manager_name', $body)) {
            $data['manager_name'] = Akph_Input::text($body, 'manager_name', 190);
        }
        if (!$existing || array_key_exists('budget', $body)) {
            $data['budget'] = Akph_Input::amount($body, 'budget', 'بودجه');
        }
        if (array_key_exists('active', $body)) {
            $data['active'] = Akph_Input::bool($body, 'active') ? 1 : 0;
        }
        if (array_key_exists('code', $body) && $body['code'] !== '' && $body['code'] !== null) {
            $code = Akph_Input::text($body, 'code', 32);
            if (!preg_match('/^[A-Za-z0-9.\-]{1,32}$/D', $code)) {
                throw Akph_Error::invalid('کد مرکز هزینه فقط حروف لاتین، رقم، نقطه و خط تیره است.', array('field' => 'code'));
            }
            // PREFIX-YYYY-N is the shape of the numbers the server issues (CC-1405-00001): a manual code of that
            // shape could take a number the counter will issue later. An existing record keeps its own code.
            if (self::looks_auto_numbered($code) && (!$existing || $code !== $existing->code)) {
                throw Akph_Error::invalid('کدی به شکل شماره خودکار (مانند CC-1405-00001) را سرور صادر می‌کند؛ کد دیگری وارد کنید یا کد را خالی بگذارید.', array('field' => 'code'));
            }
            $data['code'] = $code;
        }
        return $data;
    }

    /**
     * Pattern of server-issued numbers, ^[A-Z]+-\d{4}-\d+$. Checked case-insensitively: codes are compared
     * with the table's case-insensitive collation, so cc-1405-1 would collide with CC-1405-1 as well.
     */
    public static function looks_auto_numbered($code) {
        return (bool) preg_match('/^[A-Z]+-\d{4}-\d+$/iD', (string) $code);
    }

    private static function assert_unique_code($table, $code, $id = 0) {
        global $wpdb;
        if (Akph_Db::value($wpdb->prepare("SELECT id FROM {$table} WHERE code = %s AND id <> %d", $code, $id))) {
            throw Akph_Error::conflict('این کد قبلاً استفاده شده است.', array('field' => 'code'));
        }
    }

    public static function create_cost_center(array $body) {
        Akph_Auth::assert_cap(Akph_Roles::MASTER_DATA);
        $t = Akph_Schema::table('cost_centers');
        $data = self::cost_center_columns($body);
        $now = Akph_Db::now_utc();
        $data += array('active' => 1, 'version' => 1, 'created_by' => get_current_user_id(), 'updated_by' => get_current_user_id(), 'created_at' => $now, 'updated_at' => $now);
        $given = isset($data['code']) ? $data['code'] : '';
        if ($given !== '') {
            self::assert_unique_code($t, $given);
        } else {
            $data['code'] = 'TMP-' . wp_generate_password(20, false, false);
        }
        $id = Akph_Db::insert($t, $data);
        if ($given === '') {
            Akph_Db::update($t, array('code' => Akph_Numbering::issue('CC', Akph_Jalali::fiscal_year(Akph_Jalali::today_iso()), 'cost_center', $id)), array('id' => $id));
        }
        $row = Akph_Db::find($t, $id);
        Akph_Audit::log('cost_center_created', 'cost_center', $id, null, (array) $row, $row->code);
        return array('status' => 201, 'message' => 'مرکز هزینه ' . $row->code . ' ثبت شد.', 'id' => $id, 'records' => array('cost_centers' => array(self::cost_center_shape($row))));
    }

    public static function update_cost_center($id, array $body, $version) {
        Akph_Auth::assert_cap(Akph_Roles::MASTER_DATA);
        $t = Akph_Schema::table('cost_centers');
        $row = Akph_Db::lock($t, $id);
        if (!$row) {
            throw Akph_Error::not_found('مرکز هزینه پیدا نشد.');
        }
        Akph_Input::assert_version($row, $version);
        $data = self::cost_center_columns($body, $row);
        if (isset($data['code'])) {
            self::assert_unique_code($t, $data['code'], $id);
            if ($data['code'] !== $row->code && self::used_in_lines('cost_center_id', $id)) {
                throw Akph_Error::rule('کد مرکز هزینه‌ای که در سند استفاده شده قابل تغییر نیست.');
            }
        }
        $data['version'] = (int) $row->version + 1;
        $data['updated_by'] = get_current_user_id();
        $data['updated_at'] = Akph_Db::now_utc();
        Akph_Db::update($t, $data, array('id' => $id));
        $after = Akph_Db::find($t, $id);
        Akph_Audit::log('cost_center_updated', 'cost_center', $id, (array) $row, (array) $after, $after->code);
        return array('message' => 'مرکز هزینه ' . $after->code . ' به‌روز شد.', 'id' => $id, 'records' => array('cost_centers' => array(self::cost_center_shape($after))));
    }

    private static function used_in_lines($column, $id) {
        global $wpdb;
        return (bool) Akph_Db::value($wpdb->prepare('SELECT id FROM ' . Akph_Schema::table('ledger_lines') . " WHERE {$column} = %d LIMIT 1", $id));
    }

    // ------------------------------------------------------------------ counterparties

    public static function counterparty_shape($row) {
        return array(
            'id' => (string) $row->id,
            'kind' => $row->kind,
            'name' => $row->name,
            'national_id' => $row->national_id,
            'economic_code' => $row->economic_code,
            'phone' => $row->phone,
            'email' => $row->email,
            'address' => $row->address,
            'sheba' => $row->sheba,
            'bank_name' => $row->bank_name,
            'trade_type' => $row->trade_type,
            'active' => (bool) (int) $row->active,
            'version' => (int) $row->version,
            'updated_at' => Akph_Db::iso_time($row->updated_at),
        );
    }

    public static function list_counterparties() {
        global $wpdb;
        $t = Akph_Schema::table('counterparties');
        if (Akph_Auth::view_all()) {
            $rows = Akph_Db::results("SELECT * FROM {$t} ORDER BY name");
        } else {
            // Project managers: only the clients their own projects refer to.
            $scope = Akph_Auth::project_scope_sql('p.id');
            $p = Akph_Schema::table('projects');
            $rows = Akph_Db::results("SELECT DISTINCT c.* FROM {$t} c JOIN {$p} p ON p.client_id = c.id WHERE {$scope} ORDER BY c.name");
        }
        return array_map(array(__CLASS__, 'counterparty_shape'), (array) $rows);
    }

    /** IR + 24 digits with a valid ISO 13616 (mod 97) check. */
    public static function valid_sheba($sheba) {
        if (!preg_match('/^IR[0-9]{24}$/D', $sheba)) {
            return false;
        }
        $moved = substr($sheba, 4) . '1827' . substr($sheba, 2, 2);
        $rem = 0;
        foreach (str_split($moved, 7) as $chunk) {
            $rem = (int) ($rem . $chunk) % 97;
        }
        return $rem === 1;
    }

    private static function counterparty_columns(array $body, $existing = null) {
        $data = array();
        if (!$existing || array_key_exists('kind', $body)) {
            $data['kind'] = Akph_Input::one_of($body, 'kind', self::COUNTERPARTY_KINDS);
        }
        if (!$existing || array_key_exists('name', $body)) {
            $data['name'] = Akph_Input::text($body, 'name', 190, true, 'نام طرف حساب');
        }
        foreach (array('national_id' => 16, 'economic_code' => 20, 'phone' => 32, 'address' => 255, 'bank_name' => 64, 'trade_type' => 64) as $key => $max) {
            if (!$existing || array_key_exists($key, $body)) {
                $data[$key] = Akph_Input::text($body, $key, $max);
            }
        }
        if (isset($data['national_id']) && $data['national_id'] !== '' && !preg_match('/^[0-9]{10,11}$/D', $data['national_id'])) {
            throw Akph_Error::invalid('شناسه ملی یا کد ملی باید ۱۰ یا ۱۱ رقم باشد.', array('field' => 'national_id'));
        }
        if (!$existing || array_key_exists('email', $body)) {
            $email = Akph_Input::text($body, 'email', 100);
            if ($email !== '' && !is_email($email)) {
                throw Akph_Error::invalid('نشانی ایمیل نامعتبر است.', array('field' => 'email'));
            }
            $data['email'] = $email;
        }
        if (!$existing || array_key_exists('sheba', $body)) {
            $sheba = strtoupper(str_replace(' ', '', Akph_Input::text($body, 'sheba', 34)));
            if ($sheba !== '' && !self::valid_sheba($sheba)) {
                throw Akph_Error::invalid('شماره شبا معتبر نیست (IR و ۲۴ رقم با رقم کنترل درست).', array('field' => 'sheba'));
            }
            $data['sheba'] = $sheba;
        }
        if (array_key_exists('active', $body)) {
            $data['active'] = Akph_Input::bool($body, 'active') ? 1 : 0;
        }
        return $data;
    }

    public static function create_counterparty(array $body) {
        Akph_Auth::assert_cap(Akph_Roles::MASTER_DATA);
        $t = Akph_Schema::table('counterparties');
        $data = self::counterparty_columns($body);
        $now = Akph_Db::now_utc();
        $data += array('active' => 1, 'version' => 1, 'created_by' => get_current_user_id(), 'updated_by' => get_current_user_id(), 'created_at' => $now, 'updated_at' => $now);
        $id = Akph_Db::insert($t, $data);
        $row = Akph_Db::find($t, $id);
        Akph_Audit::log('counterparty_created', 'counterparty', $id, null, (array) $row, $row->name);
        return array('status' => 201, 'message' => 'طرف حساب «' . $row->name . '» ثبت شد.', 'id' => $id, 'records' => array('counterparties' => array(self::counterparty_shape($row))));
    }

    public static function update_counterparty($id, array $body, $version) {
        Akph_Auth::assert_cap(Akph_Roles::MASTER_DATA);
        $t = Akph_Schema::table('counterparties');
        $row = Akph_Db::lock($t, $id);
        if (!$row) {
            throw Akph_Error::not_found('طرف حساب پیدا نشد.');
        }
        Akph_Input::assert_version($row, $version);
        $data = self::counterparty_columns($body, $row);
        $data['version'] = (int) $row->version + 1;
        $data['updated_by'] = get_current_user_id();
        $data['updated_at'] = Akph_Db::now_utc();
        Akph_Db::update($t, $data, array('id' => $id));
        $after = Akph_Db::find($t, $id);
        $records = array('counterparties' => array(self::counterparty_shape($after)));
        // A renamed client is renamed on its projects too (same transaction).
        if ($after->name !== $row->name && $after->kind === 'client') {
            global $wpdb;
            $p = Akph_Schema::table('projects');
            $ids = Akph_Db::col($wpdb->prepare("SELECT id FROM {$p} WHERE client_id = %d", $id));
            if ($ids) {
                Akph_Db::exec($wpdb->prepare("UPDATE {$p} SET client_name = %s, version = version + 1, updated_by = %d, updated_at = %s WHERE client_id = %d", $after->name, get_current_user_id(), Akph_Db::now_utc(), $id));
                $records['projects'] = array();
                foreach ($ids as $pid) {
                    $records['projects'][] = Akph_Projects::shape(Akph_Db::find($p, (int) $pid));
                }
            }
        }
        Akph_Audit::log('counterparty_updated', 'counterparty', $id, (array) $row, (array) $after, $after->name);
        return array('message' => 'طرف حساب «' . $after->name . '» به‌روز شد.', 'id' => $id, 'records' => $records);
    }
}
