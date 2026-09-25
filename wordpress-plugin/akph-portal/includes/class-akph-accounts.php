<?php
/**
 * Chart of accounts: group (1 digit) › general (کل) › subsidiary (معین) › detail (تفصیلی).
 * Only a subsidiary or detail account without active children accepts entry lines; group and general
 * accounts never do. An account used in an entry keeps its code, level and parent.
 */
if (!defined('ABSPATH')) {
    exit;
}

final class Akph_Accounts {
    const LEVELS = array('group', 'general', 'subsidiary', 'detail');
    const NATURES = array('debit', 'credit', 'both');

    public static function table() {
        return Akph_Schema::table('ledger_accounts');
    }

    public static function shape($row, $has_children = null) {
        if ($has_children === null) {
            $has_children = self::has_children($row->code);
        }
        return array(
            'id' => (string) $row->id,
            'code' => $row->code,
            'title' => $row->title,
            'level' => $row->level,
            'nature' => $row->nature,
            'parent_code' => $row->parent_code !== '' ? $row->parent_code : null,
            'active' => (bool) (int) $row->active,
            'postable' => self::postable($row, $has_children),
            'version' => (int) $row->version,
        );
    }

    public static function postable($row, $has_children) {
        return (int) $row->active === 1 && in_array($row->level, array('subsidiary', 'detail'), true) && !$has_children;
    }

    public static function has_children($code) {
        global $wpdb;
        return (bool) Akph_Db::value($wpdb->prepare('SELECT id FROM ' . self::table() . ' WHERE parent_code = %s AND active = 1 LIMIT 1', $code));
    }

    public static function by_code($code) {
        global $wpdb;
        return Akph_Db::row($wpdb->prepare('SELECT * FROM ' . self::table() . ' WHERE code = %s', $code));
    }

    public static function list_all() {
        global $wpdb;
        $t = self::table();
        $rows = (array) Akph_Db::results("SELECT * FROM {$t} ORDER BY code");
        $parents = array();
        foreach ($rows as $r) {
            if ((int) $r->active === 1 && $r->parent_code !== '') {
                $parents[$r->parent_code] = true;
            }
        }
        $out = array();
        foreach ($rows as $r) {
            $out[] = self::shape($r, isset($parents[$r->code]));
        }
        return $out;
    }

    /** Level expected under a parent of `$level`. */
    private static function child_level($level) {
        $i = array_search($level, self::LEVELS, true);
        return $i === false || $i >= 3 ? null : self::LEVELS[$i + 1];
    }

    private static function validate(array $data, $existing = null) {
        if (!preg_match('/^[0-9]{1,12}$/D', $data['code'])) {
            throw Akph_Error::invalid('کد حساب باید ۱ تا ۱۲ رقم باشد.', array('field' => 'code'));
        }
        if ($data['level'] === 'group') {
            if ($data['parent_code'] !== '') {
                throw Akph_Error::invalid('حساب گروه والد ندارد.', array('field' => 'parent_code'));
            }
            return;
        }
        if ($data['parent_code'] === '') {
            throw Akph_Error::invalid('حساب کل، معین و تفصیلی باید حساب والد داشته باشد.', array('field' => 'parent_code'));
        }
        $parent = self::by_code($data['parent_code']);
        if (!$parent || (int) $parent->active !== 1) {
            throw Akph_Error::invalid('حساب والد پیدا نشد یا غیرفعال است.', array('field' => 'parent_code'));
        }
        if (self::child_level($parent->level) !== $data['level']) {
            throw Akph_Error::invalid('سطح حساب با سطح والد نمی‌خواند (گروه › کل › معین › تفصیلی).', array('field' => 'level'));
        }
        if (strpos($data['code'], $data['parent_code']) !== 0 || strlen($data['code']) <= strlen($data['parent_code'])) {
            throw Akph_Error::invalid('کد حساب باید با کد والد شروع شود و از آن بلندتر باشد.', array('field' => 'code'));
        }
        if ($existing && $data['parent_code'] === $existing->code) {
            throw Akph_Error::invalid('حساب نمی‌تواند والد خودش باشد.', array('field' => 'parent_code'));
        }
        // A parent that already carries entry lines would become a group account: refused.
        if (self::used($parent->code)) {
            throw Akph_Error::rule('حساب والد در اسناد استفاده شده است و نمی‌تواند زیرحساب بگیرد.', array('field' => 'parent_code'));
        }
    }

    public static function used($code) {
        global $wpdb;
        return (bool) Akph_Db::value($wpdb->prepare('SELECT id FROM ' . Akph_Schema::table('ledger_lines') . ' WHERE account_code = %s LIMIT 1', $code));
    }

    private static function columns(array $body, $existing = null) {
        $pick = function ($key, $fallback) use ($body) {
            return array_key_exists($key, $body) ? $body[$key] : $fallback;
        };
        $data = array(
            'code' => (string) $pick('code', $existing ? $existing->code : ''),
            'title' => Akph_Input::text(array('title' => $pick('title', $existing ? $existing->title : '')), 'title', 190, true, 'عنوان حساب'),
            'level' => Akph_Input::one_of(array('level' => $pick('level', $existing ? $existing->level : null)), 'level', self::LEVELS),
            'nature' => Akph_Input::one_of(array('nature' => $pick('nature', $existing ? $existing->nature : 'both')), 'nature', self::NATURES),
            'parent_code' => (string) $pick('parent_code', $existing ? $existing->parent_code : ''),
        );
        if ($data['parent_code'] === 'null') {
            $data['parent_code'] = '';
        }
        if (array_key_exists('active', $body)) {
            $data['active'] = Akph_Input::bool($body, 'active') ? 1 : 0;
        }
        return $data;
    }

    public static function create(array $body) {
        Akph_Auth::assert_cap(Akph_Roles::ACCOUNTS_MANAGE);
        $data = self::columns($body);
        self::validate($data);
        if (self::by_code($data['code'])) {
            throw Akph_Error::conflict('کد حساب تکراری است.', array('field' => 'code'));
        }
        $now = Akph_Db::now_utc();
        $data += array('active' => 1, 'version' => 1, 'created_by' => get_current_user_id(), 'updated_by' => get_current_user_id(), 'created_at' => $now, 'updated_at' => $now);
        $id = Akph_Db::insert(self::table(), $data);
        $row = Akph_Db::find(self::table(), $id);
        Akph_Audit::log('account_created', 'account', $id, null, (array) $row, $row->code);
        $records = array(self::shape($row));
        if ($data['parent_code'] !== '') {
            $records[] = self::shape(self::by_code($data['parent_code'])); // the parent is no longer postable
        }
        return array('status' => 201, 'message' => 'حساب ' . $row->code . ' ثبت شد.', 'id' => $id, 'records' => array('accounts' => $records));
    }

    public static function update($id, array $body, $version) {
        Akph_Auth::assert_cap(Akph_Roles::ACCOUNTS_MANAGE);
        $row = Akph_Db::lock(self::table(), $id);
        if (!$row) {
            throw Akph_Error::not_found('حساب پیدا نشد.');
        }
        Akph_Input::assert_version($row, $version);
        $data = self::columns($body, $row);
        $structural = $data['code'] !== $row->code || $data['level'] !== $row->level || $data['parent_code'] !== $row->parent_code;
        if ($structural && self::used($row->code)) {
            throw Akph_Error::rule('کد، سطح یا والد حسابی که در سند استفاده شده قابل تغییر نیست.');
        }
        if ($structural && self::has_children($row->code)) {
            throw Akph_Error::rule('ساختار حسابی که زیرحساب دارد قابل تغییر نیست.');
        }
        if (isset($data['active']) && !$data['active'] && self::has_children($row->code)) {
            throw Akph_Error::rule('حسابی که زیرحساب فعال دارد غیرفعال نمی‌شود.');
        }
        if ($structural) {
            self::validate($data, $row);
            $other = self::by_code($data['code']);
            if ($other && (int) $other->id !== (int) $id) {
                throw Akph_Error::conflict('کد حساب تکراری است.', array('field' => 'code'));
            }
        }
        $data['version'] = (int) $row->version + 1;
        $data['updated_by'] = get_current_user_id();
        $data['updated_at'] = Akph_Db::now_utc();
        Akph_Db::update(self::table(), $data, array('id' => $id));
        $after = Akph_Db::find(self::table(), $id);
        Akph_Audit::log('account_updated', 'account', $id, (array) $row, (array) $after, $after->code);
        return array('message' => 'حساب ' . $after->code . ' به‌روز شد.', 'id' => $id, 'records' => array('accounts' => array(self::shape($after))));
    }

    /** Standard chart shipped with the plugin (codes and titles only, no balances). */
    public static function standard_chart() {
        return require AKPH_PORTAL_DIR . 'includes/standard-chart.php';
    }

    /**
     * Inserts the standard accounts whose codes are missing (never changes existing ones).
     * @return array{missing: array, inserted: int}
     */
    public static function install_standard_chart($dry_run) {
        $missing = array();
        foreach (self::standard_chart() as $a) {
            if (!self::by_code($a[0])) {
                $missing[] = $a;
            }
        }
        if ($dry_run || !$missing) {
            return array('missing' => $missing, 'inserted' => 0);
        }
        Akph_Db::transaction(function () use ($missing) {
            $now = Akph_Db::now_utc();
            foreach ($missing as $a) {
                $id = Akph_Db::insert(self::table(), array(
                    'code' => $a[0], 'title' => $a[1], 'level' => $a[2], 'nature' => $a[3], 'parent_code' => $a[4],
                    'active' => 1, 'version' => 1, 'created_by' => get_current_user_id(), 'updated_by' => get_current_user_id(),
                    'created_at' => $now, 'updated_at' => $now,
                ));
                Akph_Audit::log('account_created', 'account', $id, null, array('code' => $a[0], 'title' => $a[1], 'source' => 'standard_chart'), $a[0]);
            }
        });
        return array('missing' => $missing, 'inserted' => count($missing));
    }
}
