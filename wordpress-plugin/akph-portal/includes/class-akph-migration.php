<?php
/**
 * One-time copy of the projects of paydar-portal ({prefix}paydar_projects) into {prefix}akph_projects.
 *
 * - The old table is only read (SELECT); nothing of paydar-portal is changed or deleted.
 * - Repeatable: a project already copied (same legacy_id) is skipped, so a second run creates nothing.
 * - The old amounts are decimal «billion Toman» figures typed by hand. Budget and contract amount become
 *   integer Rials on the project; revenue, cost, cash, receivable and payable become the project's
 *   «manual summary». No accounting entry is created, and the old ledger (paydar_ac_*) is not copied.
 */
if (!defined('ABSPATH')) {
    exit;
}

final class Akph_Migration {
    /** 1 billion Toman = 10^9 × 10 Rials. */
    const RIALS_PER_BILLION_TOMAN = 10000000000;

    const STATUS_MAP = array('active' => 'active', 'risk' => 'active', 'done' => 'closed', 'paused' => 'suspended');

    public static function legacy_table() {
        global $wpdb;
        return $wpdb->prefix . 'paydar_projects';
    }

    public static function legacy_exists() {
        global $wpdb;
        $t = self::legacy_table();
        return $wpdb->get_var($wpdb->prepare('SHOW TABLES LIKE %s', $wpdb->esc_like($t))) === $t;
    }

    /**
     * Decimal billion-Toman text ('12.50') → integer Rials, without floating point.
     * @return int|null null when the text is not a non-negative decimal with at most 2 decimals or overflows.
     */
    public static function billion_toman_to_rial($value) {
        $text = trim((string) $value);
        if ($text === '') {
            return 0;
        }
        if (!preg_match('/^([0-9]{1,15})(?:\.([0-9]{1,8}))?$/D', $text, $m)) {
            return null;
        }
        $whole = ltrim($m[1], '0');
        $frac = isset($m[2]) ? rtrim($m[2], '0') : '';
        if (strlen($whole) > 8) {
            return null; // above 99,999,999 billion Toman: outside BIGINT once in Rials
        }
        $rials = (int) ($whole === '' ? '0' : $whole) * self::RIALS_PER_BILLION_TOMAN;
        if ($frac !== '') {
            $rials += (int) str_pad($frac, 10, '0');
        }
        return $rials <= Akph_Input::MAX_AMOUNT ? $rials : null;
    }

    /** Old date text → ISO, accepting Jalali 'YYYY/MM/DD' (any digits) and ISO 'YYYY-MM-DD'. */
    public static function legacy_date($value) {
        $text = trim((string) $value);
        if ($text === '') {
            return array(null, null);
        }
        if (Akph_Jalali::valid_iso($text)) {
            return array($text, null);
        }
        $iso = Akph_Jalali::parse_jalali($text);
        if ($iso) {
            return array($iso, null);
        }
        return array(null, 'تاریخ «' . $text . '» خوانده نشد و خالی ماند.');
    }

    /** Plan for every old project: what would be created or skipped, the converted values and warnings. */
    public static function plan() {
        global $wpdb;
        if (!self::legacy_exists()) {
            return array('available' => false, 'items' => array(), 'create' => 0, 'skip' => 0, 'errors' => 0);
        }
        $rows = $wpdb->get_results('SELECT * FROM ' . self::legacy_table() . ' ORDER BY id');
        $existing = $wpdb->get_col('SELECT legacy_id FROM ' . Akph_Schema::table('projects') . ' WHERE legacy_id IS NOT NULL');
        $existing = array_flip((array) $existing);
        $items = array();
        $counts = array('create' => 0, 'skip' => 0, 'errors' => 0);
        foreach ((array) $rows as $row) {
            $item = self::map_row($row);
            if (isset($existing[$item['legacy_id']])) {
                $item['action'] = 'skip';
                $item['reason'] = 'قبلاً منتقل شده است.';
            }
            $counts[$item['action'] === 'error' ? 'errors' : $item['action']]++;
            $items[] = $item;
        }
        return array('available' => true, 'items' => $items) + $counts;
    }

    private static function map_row($row) {
        $warnings = array();
        $errors = array();
        $amount = function ($column, $label) use ($row, &$errors) {
            $value = isset($row->$column) ? $row->$column : '0';
            $rials = self::billion_toman_to_rial($value);
            if ($rials === null) {
                $errors[] = $label . ' («' . $value . '») به ریال صحیح تبدیل نشد.';
                return 0;
            }
            return $rials;
        };
        $manager = (int) $row->manager_user_id;
        if ($manager) {
            $user = get_userdata($manager);
            if (!$user || !in_array('paydar_project_manager', (array) $user->roles, true)) {
                $warnings[] = 'کاربر مدیر پروژه (شناسه ' . $manager . ') نقش مدیر پروژه ندارد؛ مدیر خالی ماند.';
                $manager = 0;
            }
        }
        list($start, $w1) = self::legacy_date(isset($row->start_date) ? $row->start_date : '');
        list($end, $w2) = self::legacy_date(isset($row->end_date) ? $row->end_date : '');
        foreach (array($w1, $w2) as $w) {
            if ($w) {
                $warnings[] = $w;
            }
        }
        $status = isset(self::STATUS_MAP[$row->status]) ? self::STATUS_MAP[$row->status] : 'active';
        if ($row->status === 'risk') {
            $warnings[] = 'وضعیت «در معرض ریسک» در سامانه جدید «در حال اجرا» است.';
        }
        $legacy_id = (string) $row->project_id;
        $fields = array(
            'code' => $legacy_id,
            'name' => mb_substr((string) $row->name, 0, 190),
            'client_name' => mb_substr((string) $row->client, 0, 190),
            'consultant_name' => mb_substr((string) $row->consultant, 0, 190),
            'manager_user_id' => $manager,
            'site_supervisor' => mb_substr((string) $row->supervisor, 0, 190),
            'location' => mb_substr((string) $row->location, 0, 190),
            'contract_ref' => mb_substr((string) $row->contract_id, 0, 64),
            'description' => (string) $row->description,
            'status' => $status,
            'physical_progress' => max(0, min(100, (int) $row->physical)),
            'start_date' => $start,
            'end_date' => $end && $start && $end < $start ? null : $end,
            'budget' => $amount('budget', 'بودجه'),
            'contract_amount' => $amount('contract_amount', 'مبلغ قرارداد'),
            'manual_revenue' => $amount('revenue', 'درآمد'),
            'manual_cost' => $amount('cost', 'هزینه'),
            'manual_cash' => $amount('cash', 'نقد'),
            'manual_receivable' => $amount('receivable', 'مطالبات'),
            'manual_payable' => $amount('payable', 'بدهی'),
            'manual_summary_note' => 'خلاصه دستی منتقل‌شده از پایدار پورتال (ورود اولیه به میلیارد تومان)',
            'legacy_id' => $legacy_id,
        );
        if ($end && $start && $end < $start) {
            $warnings[] = 'تاریخ پایان قبل از شروع بود و خالی ماند.';
        }
        if ($fields['name'] === '' || $legacy_id === '') {
            $errors[] = 'نام یا شناسه پروژه خالی است.';
        }
        return array(
            'legacy_id' => $legacy_id,
            'name' => $fields['name'],
            'action' => $errors ? 'error' : 'create',
            'fields' => $fields,
            'warnings' => $warnings,
            'errors' => $errors,
        );
    }

    /** Copies the planned projects in one transaction (all or nothing). */
    public static function run() {
        global $wpdb;
        $plan = self::plan();
        if (!$plan['available']) {
            throw new Akph_Error('akph_no_legacy', 'جدول پروژه‌های پایدار پورتال پیدا نشد.', 404);
        }
        if ($plan['errors']) {
            throw Akph_Error::invalid('برخی پروژه‌ها خطا دارند؛ پیش‌نمایش را ببینید و ابتدا داده قبلی را اصلاح کنید.');
        }
        $t = Akph_Schema::table('projects');
        $created = 0;
        Akph_Db::transaction(function () use ($plan, $t, &$created, $wpdb) {
            foreach ($plan['items'] as $item) {
                if ($item['action'] !== 'create') {
                    continue;
                }
                // Re-check inside the transaction: two administrators may run the tool at once.
                if ($wpdb->get_var($wpdb->prepare("SELECT id FROM {$t} WHERE legacy_id = %s FOR UPDATE", $item['legacy_id']))) {
                    continue;
                }
                $data = $item['fields'];
                if ($wpdb->get_var($wpdb->prepare("SELECT id FROM {$t} WHERE code = %s", $data['code']))) {
                    $data['code'] = mb_substr('LEG-' . $data['code'], 0, 32);
                }
                $now = Akph_Db::now_utc();
                $data += array('client_id' => 0, 'version' => 1, 'created_by' => get_current_user_id(), 'updated_by' => get_current_user_id(), 'created_at' => $now, 'updated_at' => $now);
                $id = Akph_Db::insert($t, $data);
                Akph_Audit::log('project_migrated', 'project', $id, null, $data + array('source' => 'paydar_projects'), $data['code']);
                $created++;
            }
        });
        return array('created' => $created, 'skipped' => $plan['skip']);
    }
}
