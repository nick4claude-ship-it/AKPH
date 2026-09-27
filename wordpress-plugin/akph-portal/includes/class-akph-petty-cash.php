<?php
/**
 * Petty cash (reference: submitPettyCashExpense, approvePettyCashExpense, rejectPettyCashExpense,
 * requestPettyCashReplenishment, reconcilePettyCash and updatePettyCashSettings in src/store/workflows.ts,
 * createPettyCashFund and updatePettyCashCategories in src/store/recordWorkflows.ts; pattern of
 * reference/paydar-portal/includes/class-paydar-petty-cash.php).
 *
 * Funds: several per project (project manager, site supervisor, procurement) or headquarters (no project);
 * holder (a user), fund account in the chart (default 11103), ceiling and limit of a single expense, active.
 * The balance of a fund is never stored: it is Σ(debit − credit) of the final ledger lines with cash_ref
 * 'pcf:ID'. Usable = balance − expenses waiting for approval.
 *
 * Expense: submitted by the fund holder or the project manager → approval chain from the stored settings by
 * amount (level 1 accountant; level 2 project manager, accountant; level 3 + senior manager; the project
 * manager step is skipped for a headquarters fund) → final approval posts PETTY_CASH_EXPENSE_APPROVED:
 * Dr the category's expense account (project, cost center, counterparty) / Cr the fund account. Rejection with
 * a reason on any step.
 *
 * Replenishment: request → project manager → accountant → senior manager above the threshold → a payment
 * request in treasury, already approved by the last approver; treasury pays it (Dr fund / Cr bank). The fund
 * ceiling counts the balance and every open request.
 *
 * Count: book balance, pending expenses, counted cash, difference with a required reason; a difference
 * becomes a pending adjustment entry (deficit Dr 62402 / Cr fund, surplus Dr fund / Cr 41302) that another
 * user posts in the journal. A period closes only when no expense or adjustment of the fund is open.
 */
if (!defined('ABSPATH')) {
    exit;
}

final class Akph_Petty_Cash {
    const OPTION = 'akph_portal_petty';
    const FUND_TYPES = array('project_manager', 'site_supervisor', 'procurement', 'headquarters');
    const LEVELS = array('site_manager_and_finance', 'project_and_finance', 'ceo_full');
    const PAYMENT_METHODS = array('card', 'cash', 'transfer', 'other');
    const DEFAULT_FUND_ACCOUNT = '11103';
    const SHORTAGE_ACCOUNT = '62402';
    const SURPLUS_ACCOUNT = '41302';

    public static function t($name) {
        return Akph_Schema::table($name);
    }

    public static function cash_ref($fund_id) {
        return 'pcf:' . (int) $fund_id;
    }

    // ------------------------------------------------------------------ settings

    /** Defaults = DEFAULT_PETTY_CASH_SETTINGS in src/store/state.ts (Rials). */
    public static function default_settings() {
        return array(
            'fund_limits' => array(
                'project_manager' => array('ceiling' => 3000000000, 'min_balance_warning' => 600000000, 'max_single_expense' => 1000000000),
                'site_supervisor' => array('ceiling' => 2500000000, 'min_balance_warning' => 500000000, 'max_single_expense' => 500000000),
                'procurement' => array('ceiling' => 1500000000, 'min_balance_warning' => 400000000, 'max_single_expense' => 800000000),
                'headquarters' => array('ceiling' => 1200000000, 'min_balance_warning' => 300000000, 'max_single_expense' => 400000000),
            ),
            'site_level_max' => 200000000,
            'project_level_max' => 1000000000,
            'approval_chains' => array(
                'site_manager_and_finance' => array(Akph_Flow::ACCOUNTANT),
                'project_and_finance' => array(Akph_Flow::PM, Akph_Flow::ACCOUNTANT),
                'ceo_full' => array(Akph_Flow::PM, Akph_Flow::ACCOUNTANT, Akph_Flow::SENIOR),
            ),
            'replenishment_senior_threshold' => 1000000000,
            'low_balance_percent' => 25,
            'default_expense_account' => '51101',
        );
    }

    public static function settings() {
        $stored = get_option(self::OPTION, array());
        $stored = is_array($stored) ? $stored : array();
        $d = self::default_settings();
        $out = $d;
        foreach (array('site_level_max', 'project_level_max', 'replenishment_senior_threshold', 'low_balance_percent') as $k) {
            if (isset($stored[$k]) && is_int($stored[$k])) {
                $out[$k] = $stored[$k];
            }
        }
        if (isset($stored['default_expense_account']) && is_string($stored['default_expense_account'])) {
            $out['default_expense_account'] = $stored['default_expense_account'];
        }
        foreach (self::FUND_TYPES as $type) {
            if (isset($stored['fund_limits'][$type]) && is_array($stored['fund_limits'][$type])) {
                $out['fund_limits'][$type] = array_merge($d['fund_limits'][$type], array_map('intval', $stored['fund_limits'][$type]));
            }
        }
        foreach (self::LEVELS as $level) {
            if (isset($stored['approval_chains'][$level]) && is_array($stored['approval_chains'][$level])) {
                $out['approval_chains'][$level] = array_values($stored['approval_chains'][$level]);
            }
        }
        return $out;
    }

    public static function update_settings(array $body) {
        Akph_Auth::assert_cap(Akph_Roles::SETTINGS, 'تنظیمات تنخواه فقط با مجوز تنظیمات (مدیر ارشد یا مدیر سیستم) قابل تغییر است.');
        $before = self::settings();
        $s = $before;
        foreach (array('site_level_max' => 'سقف سطح اول', 'project_level_max' => 'سقف سطح دوم', 'replenishment_senior_threshold' => 'آستانه تأیید مدیر ارشد شارژ') as $k => $label) {
            if (array_key_exists($k, $body)) {
                $s[$k] = Akph_Input::amount($body, $k, $label);
            }
        }
        if (array_key_exists('low_balance_percent', $body)) {
            $v = $body['low_balance_percent'];
            if (!is_int($v) || $v < 0 || $v > 100) {
                throw Akph_Error::invalid('درصد هشدار موجودی باید عددی بین ۰ و ۱۰۰ باشد.', array('field' => 'low_balance_percent'));
            }
            $s['low_balance_percent'] = $v;
        }
        if (array_key_exists('default_expense_account', $body)) {
            $s['default_expense_account'] = Akph_Posting::assert_postable($body['default_expense_account'], 'default_expense_account', 'حساب هزینه پیش‌فرض');
        }
        if (array_key_exists('fund_limits', $body)) {
            if (!is_array($body['fund_limits'])) {
                throw Akph_Error::invalid('سقف‌های تنخواه نامعتبر است.', array('field' => 'fund_limits'));
            }
            foreach ($body['fund_limits'] as $type => $limits) {
                if (!in_array($type, self::FUND_TYPES, true) || !is_array($limits)) {
                    throw Akph_Error::invalid('نوع تنخواه نامعتبر است: ' . $type, array('field' => 'fund_limits'));
                }
                foreach (array('ceiling', 'min_balance_warning', 'max_single_expense') as $k) {
                    if (array_key_exists($k, $limits)) {
                        $s['fund_limits'][$type][$k] = Akph_Input::amount($limits, $k, $k);
                    }
                }
            }
        }
        if (array_key_exists('approval_chains', $body)) {
            if (!is_array($body['approval_chains'])) {
                throw Akph_Error::invalid('زنجیره تأیید نامعتبر است.', array('field' => 'approval_chains'));
            }
            foreach ($body['approval_chains'] as $level => $chain) {
                if (!in_array($level, self::LEVELS, true) || !is_array($chain) || !$chain) {
                    throw Akph_Error::invalid('زنجیره تأیید سطح ' . $level . ' نامعتبر است.', array('field' => 'approval_chains'));
                }
                foreach ($chain as $role) {
                    if (!in_array($role, Akph_Flow::STEP_ROLES, true)) {
                        throw Akph_Error::invalid('نقش مرحله نامعتبر است: ' . $role, array('field' => 'approval_chains'));
                    }
                }
                if (count(array_unique($chain)) !== count($chain)) {
                    throw Akph_Error::invalid('یک نقش دو بار در زنجیره تأیید آمده است.', array('field' => 'approval_chains'));
                }
                $s['approval_chains'][$level] = array_values($chain);
            }
        }
        if ($s['site_level_max'] >= $s['project_level_max']) {
            throw Akph_Error::invalid('سقف سطح اول باید کمتر از سقف سطح دوم باشد.', array('field' => 'site_level_max'));
        }
        update_option(self::OPTION, $s, false);
        Akph_Audit::log('petty_settings', 'petty_settings', 0, $before, $s);
        return array('message' => 'سیاست تنخواه ذخیره شد.', 'records' => array('petty_settings' => array($s)));
    }

    public static function level_for($amount) {
        $s = self::settings();
        return $amount <= $s['site_level_max'] ? 'site_manager_and_finance' : ($amount <= $s['project_level_max'] ? 'project_and_finance' : 'ceo_full');
    }

    /** Chain of an expense; the project manager step is skipped when the fund has no project. */
    private static function expense_chain($level, $project_id) {
        $chain = self::settings()['approval_chains'][$level];
        if (!$project_id) {
            $chain = array_values(array_diff($chain, array(Akph_Flow::PM)));
        }
        return $chain ?: array(Akph_Flow::ACCOUNTANT);
    }

    private static function request_chain($amount, $project_id) {
        $chain = $project_id ? array(Akph_Flow::PM, Akph_Flow::ACCOUNTANT) : array(Akph_Flow::ACCOUNTANT);
        if ($amount > self::settings()['replenishment_senior_threshold']) {
            $chain[] = Akph_Flow::SENIOR;
        }
        return $chain;
    }

    // ------------------------------------------------------------------ funds

    private static function fund_or_404($id, $lock = false) {
        $row = $lock ? Akph_Db::lock(self::t('petty_funds'), $id) : Akph_Db::find(self::t('petty_funds'), $id);
        if (!$row || !Akph_Auth::can_access_project($row->project_id)) {
            throw Akph_Error::not_found('صندوق تنخواه پیدا نشد.');
        }
        return $row;
    }

    public static function pending_total($fund_id) {
        global $wpdb;
        return (int) Akph_Db::value($wpdb->prepare('SELECT COALESCE(SUM(amount), 0) FROM ' . self::t('petty_expenses') . " WHERE fund_id = %d AND status = 'pending'", $fund_id));
    }

    /** Open replenishment requests (waiting for approval, or approved and not yet fully paid). */
    public static function open_requests_total($fund_id) {
        global $wpdb;
        $pending = (int) Akph_Db::value($wpdb->prepare('SELECT COALESCE(SUM(amount), 0) FROM ' . self::t('petty_requests') . " WHERE fund_id = %d AND status = 'pending'", $fund_id));
        $approved = (int) Akph_Db::value($wpdb->prepare(
            'SELECT COALESCE(SUM(p.amount - p.paid_amount), 0) FROM ' . self::t('petty_requests') . ' r JOIN ' . self::t('payment_requests') . " p ON p.id = r.payment_request_id WHERE r.fund_id = %d AND r.status = 'approved' AND p.status IN ('approved','pending')",
            $fund_id
        ));
        return $pending + $approved;
    }

    public static function fund_shape($row) {
        global $wpdb;
        $balance = Akph_Posting::balance(self::cash_ref($row->id));
        $pending = self::pending_total($row->id);
        $last = Akph_Db::row($wpdb->prepare(
            'SELECT pm.amount, pm.pay_date FROM ' . self::t('payments') . ' pm JOIN ' . self::t('payment_requests') . " pr ON pr.id = pm.payment_request_id WHERE pr.source_type = 'petty_replenishment' AND pr.fund_id = %d ORDER BY pm.id DESC LIMIT 1",
            $row->id
        ));
        $spent = (int) Akph_Db::value($wpdb->prepare(
            'SELECT COALESCE(SUM(amount), 0) FROM ' . self::t('petty_expenses') . " WHERE fund_id = %d AND status = 'approved'" . ($row->period_start ? ' AND expense_date >= %s' : ' AND 1 = %d'),
            $row->id,
            $row->period_start ?: 1
        ));
        return array(
            'id' => (string) $row->id,
            'code' => $row->code,
            'title' => $row->title,
            'fund_type' => $row->fund_type,
            'project_id' => $row->project_id ? (string) $row->project_id : null,
            'cost_center_id' => $row->cost_center_id ? (string) $row->cost_center_id : null,
            'holder_user_id' => $row->holder_user_id ? (string) $row->holder_user_id : null,
            'holder_name' => $row->holder_name,
            'holder_phone' => $row->holder_phone,
            'account_code' => $row->account_code,
            'ceiling' => (int) $row->ceiling,
            'max_single_expense' => (int) $row->max_single_expense,
            'min_balance_warning' => (int) $row->min_balance_warning,
            'source_account_id' => $row->source_account_id ? (string) $row->source_account_id : null,
            'active' => (bool) (int) $row->active,
            'notes' => $row->notes,
            'period_start' => $row->period_start,
            'balance' => $balance,
            'pending_expenses' => $pending,
            'usable_balance' => $balance - $pending,
            'open_requests' => self::open_requests_total($row->id),
            'period_spent' => $spent,
            'last_replenishment_amount' => $last ? (int) $last->amount : 0,
            'last_replenishment_date' => $last ? $last->pay_date : null,
            'created_at' => Akph_Db::iso_time($row->created_at),
            'version' => (int) $row->version,
        );
    }

    private static function fund_columns(array $body, $existing = null) {
        $d = array();
        $settings = self::settings();
        $has = function ($k) use ($body, $existing) {
            return !$existing || array_key_exists($k, $body);
        };
        if ($has('title')) {
            $d['title'] = Akph_Input::text($body, 'title', 190, true, 'عنوان تنخواه');
        }
        if ($has('fund_type')) {
            $d['fund_type'] = Akph_Input::one_of($body, 'fund_type', self::FUND_TYPES, $existing ? $existing->fund_type : 'site_supervisor');
        }
        $type = isset($d['fund_type']) ? $d['fund_type'] : $existing->fund_type;
        if ($has('project_id')) {
            $project = Akph_Input::id($body, 'project_id');
            if ($project && !Akph_Db::find(self::t('projects'), $project)) {
                throw Akph_Error::invalid('پروژه پیدا نشد.', array('field' => 'project_id'));
            }
            $d['project_id'] = $project ?: null;
        }
        $project_id = array_key_exists('project_id', $d) ? $d['project_id'] : ($existing ? $existing->project_id : null);
        if ($has('cost_center_id')) {
            $cc = Akph_Input::id($body, 'cost_center_id');
            if ($cc) {
                $row = Akph_Db::find(self::t('cost_centers'), $cc);
                if (!$row || ($row->project_id && (int) $row->project_id !== (int) $project_id)) {
                    throw Akph_Error::invalid('مرکز هزینه پیدا نشد یا متعلق به پروژه دیگری است.', array('field' => 'cost_center_id'));
                }
            } elseif (!$existing && $project_id) {
                global $wpdb;
                $cc = (int) Akph_Db::value($wpdb->prepare('SELECT id FROM ' . self::t('cost_centers') . " WHERE project_id = %d AND type = 'project_site' ORDER BY id LIMIT 1", $project_id));
            }
            $d['cost_center_id'] = $cc ?: null;
        }
        if ($has('holder_user_id')) {
            $holder = Akph_Input::id($body, 'holder_user_id');
            if ($holder && !Akph_Roles::role_of(get_userdata($holder) ?: null)) {
                throw Akph_Error::invalid('متصدی تنخواه باید کاربر پرتال باشد.', array('field' => 'holder_user_id'));
            }
            $d['holder_user_id'] = $holder;
        }
        if ($has('holder_name')) {
            $d['holder_name'] = Akph_Input::text($body, 'holder_name', 190, !$existing || array_key_exists('holder_name', $body), 'نام متصدی');
        }
        if ($has('holder_phone')) {
            $d['holder_phone'] = Akph_Input::text($body, 'holder_phone', 32);
        }
        if ($has('account_code')) {
            $code = isset($body['account_code']) && $body['account_code'] !== '' ? $body['account_code'] : self::DEFAULT_FUND_ACCOUNT;
            $d['account_code'] = Akph_Posting::assert_postable($code, 'account_code', 'حساب وجه تنخواه');
        }
        foreach (array('ceiling' => 'سقف صندوق', 'max_single_expense' => 'سقف هر هزینه', 'min_balance_warning' => 'حداقل موجودی هشدار') as $k => $label) {
            if (array_key_exists($k, $body)) {
                $d[$k] = Akph_Input::amount($body, $k, $label);
            } elseif (!$existing) {
                $d[$k] = (int) $settings['fund_limits'][$type][$k];
            }
        }
        if ($has('source_account_id')) {
            $src = Akph_Input::id($body, 'source_account_id');
            if ($src && !Akph_Db::find(self::t('treasury_accounts'), $src)) {
                throw Akph_Error::invalid('حساب بانکی تأمین‌کننده پیدا نشد.', array('field' => 'source_account_id'));
            }
            $d['source_account_id'] = $src ?: null;
        }
        if (array_key_exists('active', $body)) {
            $d['active'] = $body['active'] ? 1 : 0;
        }
        if ($has('notes')) {
            $d['notes'] = Akph_Input::text($body, 'notes', 1000);
        }
        $ceiling = isset($d['ceiling']) ? $d['ceiling'] : (int) $existing->ceiling;
        $single = isset($d['max_single_expense']) ? $d['max_single_expense'] : (int) $existing->max_single_expense;
        if ($ceiling <= 0 || $single <= 0 || $single > $ceiling) {
            throw Akph_Error::invalid('سقف صندوق و سقف هر هزینه باید مثبت باشند و سقف هر هزینه از سقف صندوق بیشتر نباشد.', array('field' => 'max_single_expense'));
        }
        return $d;
    }

    public static function create_fund(array $body) {
        Akph_Auth::assert_cap(Akph_Roles::PETTY_MANAGE, 'تعریف تنخواه فقط برای حسابدار و مدیر سیستم مجاز است.');
        $year = Akph_Jalali::fiscal_year(Akph_Jalali::today_iso());
        Akph_Numbering::lock('PCF', $year);
        $data = self::fund_columns($body);
        $now = Akph_Db::now_utc();
        $id = Akph_Db::insert(self::t('petty_funds'), $data + array(
            'code' => 'tmp-' . substr(str_replace('-', '', wp_generate_uuid4()), 0, 24),
            'period_start' => Akph_Jalali::today_iso(),
            'version' => 1,
            'created_by' => get_current_user_id(),
            'created_at' => $now,
            'updated_by' => get_current_user_id(),
            'updated_at' => $now,
        ));
        $code = Akph_Numbering::issue('PCF', $year, 'petty_fund', $id);
        Akph_Db::update(self::t('petty_funds'), array('code' => $code), array('id' => $id));
        $row = Akph_Db::find(self::t('petty_funds'), $id);
        Akph_Audit::log('petty_fund_created', 'petty_fund', $id, null, (array) $row, $code);
        return array('status' => 201, 'message' => 'تنخواه ' . $code . ' تعریف شد.', 'id' => $id, 'records' => array('petty_funds' => array(self::fund_shape($row))));
    }

    public static function update_fund($id, array $body, $version) {
        Akph_Auth::assert_cap(Akph_Roles::PETTY_MANAGE, 'ویرایش تنخواه فقط برای حسابدار و مدیر سیستم مجاز است.');
        $row = self::fund_or_404($id, true);
        Akph_Input::assert_version($row, $version);
        $data = self::fund_columns($body, $row);
        if (isset($data['account_code']) && $data['account_code'] !== $row->account_code && Akph_Posting::balance(self::cash_ref($id)) !== 0) {
            throw Akph_Error::rule('حساب وجه تنخواهی که مانده دارد قابل تغییر نیست.', array('field' => 'account_code'));
        }
        $data['version'] = (int) $row->version + 1;
        $data['updated_by'] = get_current_user_id();
        $data['updated_at'] = Akph_Db::now_utc();
        Akph_Db::update(self::t('petty_funds'), $data, array('id' => $id));
        $after = Akph_Db::find(self::t('petty_funds'), $id);
        Akph_Audit::log('petty_fund_updated', 'petty_fund', $id, (array) $row, (array) $after, $row->code);
        return array('message' => 'تنخواه ' . $row->code . ' به‌روز شد.', 'id' => $id, 'records' => array('petty_funds' => array(self::fund_shape($after))));
    }

    // ------------------------------------------------------------------ categories

    public static function category_shape($row) {
        $subs = json_decode((string) $row->subcategories, true);
        return array(
            'id' => (string) $row->id,
            'name' => $row->name,
            'subcategories' => is_array($subs) ? array_values($subs) : array(),
            'account_code' => $row->account_code,
            'active' => (bool) (int) $row->active,
            'version' => (int) $row->version,
        );
    }

    public static function list_categories($include_inactive = false) {
        $rows = Akph_Db::results('SELECT * FROM ' . self::t('petty_categories') . ($include_inactive ? '' : ' WHERE active = 1') . ' ORDER BY sort_order, id');
        return array_map(array(__CLASS__, 'category_shape'), (array) $rows);
    }

    /** Replaces the category list: rows with an id are updated, rows without one added, missing ones deactivated. */
    public static function replace_categories(array $body) {
        Akph_Auth::assert_cap(Akph_Roles::PETTY_MANAGE, 'ویرایش سرفصل‌های هزینه تنخواه مجاز نیست.');
        if (!isset($body['categories']) || !is_array($body['categories'])) {
            throw Akph_Error::invalid('فهرست سرفصل‌ها لازم است.', array('field' => 'categories'));
        }
        global $wpdb;
        $t = self::t('petty_categories');
        $existing = array();
        foreach ((array) Akph_Db::results("SELECT * FROM {$t} FOR UPDATE") as $r) {
            $existing[(int) $r->id] = $r;
        }
        $default = self::settings()['default_expense_account'];
        $kept = array();
        $now = Akph_Db::now_utc();
        foreach (array_values($body['categories']) as $i => $c) {
            if (!is_array($c)) {
                throw Akph_Error::invalid('سرفصل ' . ($i + 1) . ' نامعتبر است.', array('field' => 'categories'));
            }
            $name = Akph_Input::text($c, 'name', 190, true, 'نام سرفصل');
            $subs = array();
            foreach (isset($c['subcategories']) && is_array($c['subcategories']) ? $c['subcategories'] : array() as $sub) {
                if (is_string($sub) && trim($sub) !== '') {
                    $subs[] = mb_substr(sanitize_text_field($sub), 0, 190);
                }
            }
            $id = isset($c['id']) && is_string($c['id']) && preg_match('/^[1-9][0-9]{0,18}$/D', $c['id']) && isset($existing[(int) $c['id']]) ? (int) $c['id'] : 0;
            $code = isset($c['account_code']) && $c['account_code'] !== '' ? $c['account_code'] : ($id ? $existing[$id]->account_code : $default);
            $code = Akph_Posting::assert_postable($code, 'categories', 'حساب هزینه سرفصل «' . $name . '»');
            if (!preg_match('/^[56]/', $code)) {
                throw Akph_Error::rule('حساب سرفصل «' . $name . '» باید حساب هزینه (گروه ۵ یا ۶) باشد.', array('field' => 'categories'));
            }
            $data = array('name' => $name, 'subcategories' => wp_json_encode($subs), 'account_code' => $code, 'active' => 1, 'sort_order' => $i, 'updated_by' => get_current_user_id(), 'updated_at' => $now);
            if ($id) {
                Akph_Db::update($t, $data + array('version' => (int) $existing[$id]->version + 1), array('id' => $id));
            } else {
                $id = Akph_Db::insert($t, $data + array('version' => 1));
            }
            $kept[] = $id;
        }
        foreach ($existing as $id => $r) {
            if (!in_array($id, $kept, true) && (int) $r->active === 1) {
                Akph_Db::update($t, array('active' => 0, 'version' => (int) $r->version + 1, 'updated_at' => $now), array('id' => $id));
            }
        }
        Akph_Audit::log('petty_categories', 'petty_categories', 0, array_map(array(__CLASS__, 'category_shape'), array_values($existing)), self::list_categories(true));
        return array('message' => 'سرفصل‌های هزینه تنخواه ذخیره شد.', 'records' => array('petty_categories' => self::list_categories()));
    }

    // ------------------------------------------------------------------ expenses

    public static function expense_shape($row) {
        $chain = Akph_Flow::chain($row->chain);
        $fund = Akph_Db::find(self::t('petty_funds'), $row->fund_id);
        return array(
            'id' => (string) $row->id,
            'number' => $row->number,
            'fund_id' => (string) $row->fund_id,
            'fund_title' => $fund ? $fund->title : '',
            'project_id' => $row->project_id ? (string) $row->project_id : null,
            'cost_center_id' => $row->cost_center_id ? (string) $row->cost_center_id : null,
            'category_id' => $row->category_id ? (string) $row->category_id : null,
            'category_name' => $row->category_name,
            'sub_category' => $row->sub_category,
            'account_code' => $row->account_code,
            'date' => $row->expense_date,
            'amount' => (int) $row->amount,
            'vendor' => $row->vendor,
            'vendor_national_id' => $row->vendor_national_id,
            'counterparty_id' => $row->counterparty_id ? (string) $row->counterparty_id : null,
            'invoice_number' => $row->invoice_number,
            'invoice_date' => $row->invoice_date,
            'description' => $row->description,
            'payment_method' => $row->payment_method,
            'status' => $row->status,
            'approval_level' => $row->approval_level,
            'chain' => $chain,
            'step_index' => (int) $row->step_index,
            'current_step' => $row->status === 'pending' && isset($chain[(int) $row->step_index]) ? $chain[(int) $row->step_index] : null,
            'history' => Akph_Flow::history($row->history),
            'submitted_by' => (string) $row->submitted_by,
            'submitted_by_name' => Akph_Flow::user_name($row->submitted_by),
            'last_approved_by' => $row->last_approved_by ? (string) $row->last_approved_by : null,
            'reject_reason' => $row->reject_reason,
            'entry' => Akph_Posting::entry_ref($row->entry_id),
            'version' => (int) $row->version,
            'created_at' => Akph_Db::iso_time($row->created_at),
        );
    }

    /** Holder of the fund, project manager of its project, or system admin / senior manager. */
    private static function assert_may_submit($fund) {
        Akph_Auth::assert_cap(Akph_Roles::PETTY_SUBMIT, 'اجازه ثبت هزینه تنخواه را ندارید.');
        $uid = get_current_user_id();
        if ((int) $fund->holder_user_id === $uid || Akph_Flow::is_senior_or_admin()) {
            return;
        }
        if (Akph_Flow::role() === 'paydar_project_manager' && $fund->project_id && Akph_Auth::can_access_project($fund->project_id)) {
            return;
        }
        throw Akph_Error::forbidden('هزینه این تنخواه را فقط متصدی آن یا مدیر پروژه ثبت می‌کند.');
    }

    public static function submit_expense(array $body) {
        $fund_id = Akph_Input::id($body, 'fund_id', false);
        $amount = Akph_Input::amount($body, 'amount', 'مبلغ هزینه');
        if ($amount <= 0) {
            throw Akph_Error::invalid('مبلغ هزینه باید عدد صحیح مثبت باشد.', array('field' => 'amount'));
        }
        $date = Akph_Input::iso_date($body, 'date');
        $year = Akph_Posting::year_for($date);
        $description = Akph_Input::text($body, 'description', 1000, true, 'شرح هزینه');
        // Lock order: numbering anchor, then the fund row (serialises the pending total of the fund).
        Akph_Numbering::lock('EXP', $year);
        $fund = self::fund_or_404($fund_id, true);
        self::assert_may_submit($fund);
        if (!(int) $fund->active) {
            throw Akph_Error::rule('این صندوق تنخواه فعال نیست.');
        }
        if ($amount > (int) $fund->max_single_expense) {
            throw Akph_Error::rule('سقف هر هزینه برای این تنخواه ' . number_format((int) $fund->max_single_expense) . ' ریال است.', array('field' => 'amount'));
        }
        $usable = Akph_Posting::balance(self::cash_ref($fund->id)) - self::pending_total($fund->id);
        if ($amount > $usable) {
            throw Akph_Error::rule('موجودی قابل مصرف تنخواه (' . number_format($usable) . ' ریال) کمتر از مبلغ هزینه است.', array('field' => 'amount', 'usable_balance' => $usable));
        }
        $category_id = Akph_Input::id($body, 'category_id');
        $category = null;
        if ($category_id) {
            $category = Akph_Db::find(self::t('petty_categories'), $category_id);
            if (!$category || !(int) $category->active) {
                throw Akph_Error::invalid('سرفصل هزینه پیدا نشد.', array('field' => 'category_id'));
            }
        } elseif (!empty($body['category_name'])) {
            global $wpdb;
            $category = Akph_Db::row($wpdb->prepare('SELECT * FROM ' . self::t('petty_categories') . ' WHERE name = %s AND active = 1 LIMIT 1', (string) $body['category_name']));
        }
        $account = $category ? $category->account_code : self::settings()['default_expense_account'];
        Akph_Posting::account($account, 'حساب هزینه سرفصل');
        $party = Akph_Input::id($body, 'counterparty_id');
        if ($party && !Akph_Db::find(self::t('counterparties'), $party)) {
            throw Akph_Error::invalid('فروشنده (طرف حساب) پیدا نشد.', array('field' => 'counterparty_id'));
        }
        $level = self::level_for($amount);
        $chain = self::expense_chain($level, $fund->project_id);
        $now = Akph_Db::now_utc();
        $id = Akph_Db::insert(self::t('petty_expenses'), array(
            'fund_id' => $fund->id,
            'project_id' => $fund->project_id,
            'cost_center_id' => $fund->cost_center_id,
            'category_id' => $category ? $category->id : null,
            'category_name' => $category ? $category->name : Akph_Input::text($body, 'category_name', 190),
            'sub_category' => Akph_Input::text($body, 'sub_category', 190),
            'account_code' => $account,
            'expense_date' => $date,
            'amount' => $amount,
            'vendor' => Akph_Input::text($body, 'vendor', 190),
            'vendor_national_id' => Akph_Input::text($body, 'vendor_national_id', 16),
            'counterparty_id' => $party ?: null,
            'invoice_number' => Akph_Input::text($body, 'invoice_number', 64),
            'invoice_date' => Akph_Input::iso_date($body, 'invoice_date', false),
            'description' => $description,
            'payment_method' => Akph_Input::one_of($body, 'payment_method', self::PAYMENT_METHODS, 'cash'),
            'status' => 'pending',
            'approval_level' => $level,
            'chain' => implode('|', $chain),
            'step_index' => 0,
            'history' => Akph_Flow::push_history('[]', 'submitted', 'ثبت هزینه'),
            'submitted_by' => get_current_user_id(),
            'version' => 1,
            'created_at' => $now,
            'updated_at' => $now,
        ));
        $number = Akph_Numbering::issue('EXP', $year, 'petty_expense', $id);
        Akph_Db::update(self::t('petty_expenses'), array('number' => $number), array('id' => $id));
        $row = Akph_Db::find(self::t('petty_expenses'), $id);
        Akph_Audit::log('petty_expense_submitted', 'petty_expense', $id, null, (array) $row, $number);
        return array(
            'status' => 201,
            'message' => 'هزینه ' . $number . ' ثبت و به مرحله «' . $chain[0] . '» ارسال شد.',
            'id' => $id,
            'doc_number' => $number,
            'records' => array('petty_expenses' => array(self::expense_shape($row)), 'petty_funds' => array(self::fund_shape(Akph_Db::find(self::t('petty_funds'), $fund->id)))),
        );
    }

    private static function expense_or_404($id, $lock = false) {
        $row = $lock ? Akph_Db::lock(self::t('petty_expenses'), $id) : Akph_Db::find(self::t('petty_expenses'), $id);
        if (!$row || !Akph_Auth::can_access_project($row->project_id)) {
            throw Akph_Error::not_found('هزینه تنخواه پیدا نشد.');
        }
        return $row;
    }

    public static function approve_expense($id, array $body, $version) {
        Akph_Auth::assert_cap(Akph_Roles::PETTY_APPROVE, 'اجازه تأیید هزینه تنخواه را ندارید.');
        $comment = Akph_Input::text($body, 'comment', 1000);
        $today = Akph_Jalali::today_iso();
        // The approval may be the final one, which posts: ACC anchor first, then the expense and its fund.
        Akph_Posting::lock_year($today);
        $row = self::expense_or_404($id, true);
        Akph_Input::assert_version($row, $version);
        if ($row->status !== 'pending') {
            throw Akph_Error::conflict('این هزینه در انتظار تأیید نیست.', array('status' => $row->status));
        }
        $chain = Akph_Flow::chain($row->chain);
        $idx = (int) $row->step_index;
        $step = isset($chain[$idx]) ? $chain[$idx] : Akph_Flow::ACCOUNTANT;
        Akph_Flow::assert_step($step, $row->project_id, $row->submitted_by, $row->last_approved_by);
        $fund = Akph_Db::lock(self::t('petty_funds'), $row->fund_id);
        $history = Akph_Flow::push_history($row->history, 'approved', $step, $comment);
        $now = Akph_Db::now_utc();
        $uid = get_current_user_id();
        if (isset($chain[$idx + 1])) {
            Akph_Db::update(self::t('petty_expenses'), array('step_index' => $idx + 1, 'last_approved_by' => $uid, 'history' => $history, 'version' => (int) $row->version + 1, 'updated_at' => $now), array('id' => $id));
            $after = Akph_Db::find(self::t('petty_expenses'), $id);
            Akph_Audit::log('petty_expense_step_approved', 'petty_expense', $id, (array) $row, (array) $after, $row->number);
            return array('message' => 'تأیید «' . $step . '» ثبت شد؛ مرحله بعد: «' . $chain[$idx + 1] . '».', 'id' => $id, 'records' => array('petty_expenses' => array(self::expense_shape($after))));
        }
        // Final approval: Dr expense (project, cost center, vendor) / Cr the fund; the fund may not go negative.
        Akph_Posting::assert_available(self::cash_ref($fund->id), (int) $row->amount, 'تنخواه «' . $fund->title . '»');
        $posted = Akph_Posting::post(array(
            'source' => 'petty_expense',
            'source_id' => $id,
            'type' => 'PETTY_CASH_EXPENSE_APPROVED',
            'date' => $today,
            'description' => 'هزینه تنخواه ' . $row->number . ' - ' . $fund->title . ': ' . $row->description,
            'entry_type' => 'petty_cash',
            'project_id' => $row->project_id,
            'lines' => array(
                array('code' => $row->account_code, 'label' => 'حساب هزینه', 'debit' => (int) $row->amount, 'project_id' => $row->project_id, 'cost_center_id' => $row->cost_center_id, 'counterparty_id' => $row->counterparty_id, 'description' => $row->description . ' (' . $row->number . ')'),
                array('code' => $fund->account_code, 'label' => 'وجه تنخواه', 'credit' => (int) $row->amount, 'project_id' => $row->project_id, 'cash_ref' => self::cash_ref($fund->id), 'description' => 'کسر از تنخواه ' . $fund->title . ' بابت ' . $row->number),
            ),
        ));
        $entry = $posted['entry'];
        Akph_Db::update(self::t('petty_expenses'), array('status' => 'approved', 'step_index' => $idx + 1, 'last_approved_by' => $uid, 'history' => $history, 'entry_id' => $entry->id, 'version' => (int) $row->version + 1, 'updated_at' => $now), array('id' => $id));
        $after = Akph_Db::find(self::t('petty_expenses'), $id);
        Akph_Audit::log('petty_expense_approved', 'petty_expense', $id, (array) $row, (array) $after, $row->number);
        return array(
            'message' => 'هزینه ' . $row->number . ' تأیید نهایی شد و سند ' . $entry->doc_number . ' صادر شد.',
            'id' => $id,
            'doc_number' => $entry->doc_number,
            'records' => array(
                'petty_expenses' => array(self::expense_shape($after)),
                'petty_funds' => array(self::fund_shape(Akph_Db::find(self::t('petty_funds'), $fund->id))),
                'journal_entries' => array(Akph_Ledger::shape($entry)),
            ),
        );
    }

    public static function reject_expense($id, array $body, $version) {
        Akph_Auth::assert_cap(Akph_Roles::PETTY_APPROVE, 'اجازه رد هزینه تنخواه را ندارید.');
        $reason = Akph_Input::text($body, 'reason', 1000, true, 'علت رد');
        $return = !empty($body['return_to_user']);
        $row = self::expense_or_404($id, true);
        Akph_Input::assert_version($row, $version);
        if ($row->status !== 'pending') {
            throw Akph_Error::conflict('این هزینه در انتظار تأیید نیست.', array('status' => $row->status));
        }
        $chain = Akph_Flow::chain($row->chain);
        $step = isset($chain[(int) $row->step_index]) ? $chain[(int) $row->step_index] : Akph_Flow::ACCOUNTANT;
        Akph_Flow::assert_step($step, $row->project_id, $row->submitted_by, null);
        Akph_Db::update(self::t('petty_expenses'), array(
            'status' => $return ? 'returned' : 'rejected',
            'reject_reason' => $reason,
            'history' => Akph_Flow::push_history($row->history, $return ? 'returned' : 'rejected', $step, $reason),
            'version' => (int) $row->version + 1,
            'updated_at' => Akph_Db::now_utc(),
        ), array('id' => $id));
        $after = Akph_Db::find(self::t('petty_expenses'), $id);
        Akph_Audit::log('petty_expense_rejected', 'petty_expense', $id, (array) $row, (array) $after, $row->number);
        return array(
            'message' => $return ? 'هزینه ' . $row->number . ' برای اصلاح به ثبت‌کننده برگشت داده شد.' : 'هزینه ' . $row->number . ' رد شد.',
            'id' => $id,
            'records' => array('petty_expenses' => array(self::expense_shape($after)), 'petty_funds' => array(self::fund_shape(Akph_Db::find(self::t('petty_funds'), $row->fund_id)))),
        );
    }

    // ------------------------------------------------------------------ replenishment requests

    public static function request_shape($row) {
        $chain = Akph_Flow::chain($row->chain);
        $fund = Akph_Db::find(self::t('petty_funds'), $row->fund_id);
        return array(
            'id' => (string) $row->id,
            'number' => $row->number,
            'fund_id' => (string) $row->fund_id,
            'fund_title' => $fund ? $fund->title : '',
            'project_id' => $row->project_id ? (string) $row->project_id : null,
            'amount' => (int) $row->amount,
            'reason' => $row->reason,
            'date' => $row->request_date,
            'status' => $row->status,
            'chain' => $chain,
            'step_index' => (int) $row->step_index,
            'current_step' => $row->status === 'pending' && isset($chain[(int) $row->step_index]) ? $chain[(int) $row->step_index] : null,
            'history' => Akph_Flow::history($row->history),
            'requested_by' => (string) $row->requested_by,
            'requested_by_name' => Akph_Flow::user_name($row->requested_by),
            'last_approved_by' => $row->last_approved_by ? (string) $row->last_approved_by : null,
            'reject_reason' => $row->reject_reason,
            'payment_request_id' => $row->payment_request_id ? (string) $row->payment_request_id : null,
            'balance_at_request' => $fund ? Akph_Posting::balance(self::cash_ref($fund->id)) : 0,
            'version' => (int) $row->version,
        );
    }

    private static function request_or_404($id, $lock = false) {
        $row = $lock ? Akph_Db::lock(self::t('petty_requests'), $id) : Akph_Db::find(self::t('petty_requests'), $id);
        if (!$row || !Akph_Auth::can_access_project($row->project_id)) {
            throw Akph_Error::not_found('درخواست شارژ پیدا نشد.');
        }
        return $row;
    }

    public static function create_request(array $body) {
        $fund_id = Akph_Input::id($body, 'fund_id', false);
        $amount = Akph_Input::amount($body, 'amount', 'مبلغ شارژ');
        if ($amount <= 0) {
            throw Akph_Error::invalid('مبلغ شارژ باید عدد صحیح مثبت باشد.', array('field' => 'amount'));
        }
        $reason = Akph_Input::text($body, 'reason', 1000, true, 'علت درخواست');
        $today = Akph_Jalali::today_iso();
        $year = Akph_Jalali::fiscal_year($today);
        Akph_Numbering::lock('PCR', $year);
        $fund = self::fund_or_404($fund_id, true);
        if (!current_user_can(Akph_Roles::PETTY_MANAGE)) {
            self::assert_may_submit($fund);
        }
        if (!(int) $fund->active) {
            throw Akph_Error::rule('این صندوق تنخواه فعال نیست.');
        }
        global $wpdb;
        $open = Akph_Db::row($wpdb->prepare('SELECT number FROM ' . self::t('petty_requests') . " WHERE fund_id = %d AND status = 'pending' LIMIT 1", $fund->id));
        if ($open) {
            throw Akph_Error::conflict('درخواست شارژ ' . $open->number . ' برای این صندوق هنوز در انتظار تأیید است.');
        }
        $balance = Akph_Posting::balance(self::cash_ref($fund->id));
        $open_total = self::open_requests_total($fund->id);
        if ($balance + $open_total + $amount > (int) $fund->ceiling) {
            throw Akph_Error::rule('با این شارژ (موجودی ' . number_format($balance) . ' + درخواست‌های باز ' . number_format($open_total) . ' ریال) سقف صندوق (' . number_format((int) $fund->ceiling) . ' ریال) رد می‌شود.', array('field' => 'amount'));
        }
        $chain = self::request_chain($amount, $fund->project_id);
        $now = Akph_Db::now_utc();
        $id = Akph_Db::insert(self::t('petty_requests'), array(
            'fund_id' => $fund->id,
            'project_id' => $fund->project_id,
            'amount' => $amount,
            'reason' => $reason,
            'request_date' => $today,
            'status' => 'pending',
            'chain' => implode('|', $chain),
            'step_index' => 0,
            'history' => Akph_Flow::push_history('[]', 'submitted', 'ثبت درخواست شارژ'),
            'requested_by' => get_current_user_id(),
            'version' => 1,
            'created_at' => $now,
            'updated_at' => $now,
        ));
        $number = Akph_Numbering::issue('PCR', $year, 'petty_request', $id);
        Akph_Db::update(self::t('petty_requests'), array('number' => $number), array('id' => $id));
        $row = Akph_Db::find(self::t('petty_requests'), $id);
        Akph_Audit::log('petty_request_created', 'petty_request', $id, null, (array) $row, $number);
        return array(
            'status' => 201,
            'message' => 'درخواست شارژ ' . $number . ' ثبت و به مرحله «' . $chain[0] . '» ارسال شد.',
            'id' => $id,
            'doc_number' => $number,
            'records' => array('petty_requests' => array(self::request_shape($row)), 'petty_funds' => array(self::fund_shape(Akph_Db::find(self::t('petty_funds'), $fund->id)))),
        );
    }

    public static function approve_request($id, array $body, $version) {
        Akph_Auth::assert_cap(Akph_Roles::PETTY_APPROVE, 'اجازه تأیید درخواست شارژ را ندارید.');
        $comment = Akph_Input::text($body, 'comment', 1000);
        $today = Akph_Jalali::today_iso();
        // The final step creates a payment request (PAY number): its anchor first, then the rows.
        Akph_Numbering::lock('PAY', Akph_Jalali::fiscal_year($today));
        $row = self::request_or_404($id, true);
        Akph_Input::assert_version($row, $version);
        if ($row->status !== 'pending') {
            throw Akph_Error::conflict('این درخواست در انتظار تأیید نیست.', array('status' => $row->status));
        }
        $chain = Akph_Flow::chain($row->chain);
        $idx = (int) $row->step_index;
        $step = isset($chain[$idx]) ? $chain[$idx] : Akph_Flow::ACCOUNTANT;
        Akph_Flow::assert_step($step, $row->project_id, $row->requested_by, $row->last_approved_by);
        $history = Akph_Flow::push_history($row->history, 'approved', $step, $comment);
        $uid = get_current_user_id();
        $now = Akph_Db::now_utc();
        if (isset($chain[$idx + 1])) {
            Akph_Db::update(self::t('petty_requests'), array('step_index' => $idx + 1, 'last_approved_by' => $uid, 'history' => $history, 'version' => (int) $row->version + 1, 'updated_at' => $now), array('id' => $id));
            $after = Akph_Db::find(self::t('petty_requests'), $id);
            Akph_Audit::log('petty_request_step_approved', 'petty_request', $id, (array) $row, (array) $after, $row->number);
            return array('message' => 'تأیید «' . $step . '» ثبت شد؛ مرحله بعد: «' . $chain[$idx + 1] . '».', 'id' => $id, 'records' => array('petty_requests' => array(self::request_shape($after))));
        }
        $fund = Akph_Db::lock(self::t('petty_funds'), $row->fund_id);
        $payment = Akph_Treasury::create_request_internal(array(
            'source_type' => 'petty_replenishment',
            'source_id' => $id,
            'payable_type' => 'petty_cash',
            'debit_account_code' => $fund->account_code,
            'project_id' => $row->project_id,
            'cost_center_id' => $fund->cost_center_id,
            'fund_id' => $fund->id,
            'beneficiary_name' => $fund->title . ($fund->holder_name ? ' (' . $fund->holder_name . ')' : ''),
            'beneficiary_type' => 'petty_holder',
            'amount' => (int) $row->amount,
            'due_date' => $today,
            'description' => 'شارژ تنخواه طبق درخواست ' . $row->number . ': ' . $row->reason,
            'requested_by' => (int) $row->requested_by,
            // The replenishment chain is its approval: the request enters the payment queue already approved.
            'approved_by' => $uid,
        ));
        Akph_Db::update(self::t('petty_requests'), array('status' => 'approved', 'step_index' => $idx + 1, 'last_approved_by' => $uid, 'history' => $history, 'payment_request_id' => $payment->id, 'version' => (int) $row->version + 1, 'updated_at' => $now), array('id' => $id));
        $after = Akph_Db::find(self::t('petty_requests'), $id);
        Akph_Audit::log('petty_request_approved', 'petty_request', $id, (array) $row, (array) $after, $row->number);
        return array(
            'message' => 'درخواست شارژ ' . $row->number . ' تأیید شد و درخواست پرداخت ' . $payment->number . ' در صف خزانه قرار گرفت.',
            'id' => $id,
            'doc_number' => $payment->number,
            'records' => array('petty_requests' => array(self::request_shape($after)), 'payment_requests' => array(Akph_Treasury::request_shape($payment))),
        );
    }

    public static function reject_request($id, array $body, $version) {
        Akph_Auth::assert_cap(Akph_Roles::PETTY_APPROVE, 'اجازه رد درخواست شارژ را ندارید.');
        $reason = Akph_Input::text($body, 'reason', 1000, true, 'علت رد');
        $row = self::request_or_404($id, true);
        Akph_Input::assert_version($row, $version);
        if ($row->status !== 'pending') {
            throw Akph_Error::conflict('این درخواست در انتظار تأیید نیست.', array('status' => $row->status));
        }
        $chain = Akph_Flow::chain($row->chain);
        $step = isset($chain[(int) $row->step_index]) ? $chain[(int) $row->step_index] : Akph_Flow::ACCOUNTANT;
        Akph_Flow::assert_step($step, $row->project_id, $row->requested_by, null);
        Akph_Db::update(self::t('petty_requests'), array('status' => 'rejected', 'reject_reason' => $reason, 'history' => Akph_Flow::push_history($row->history, 'rejected', $step, $reason), 'version' => (int) $row->version + 1, 'updated_at' => Akph_Db::now_utc()), array('id' => $id));
        $after = Akph_Db::find(self::t('petty_requests'), $id);
        Akph_Audit::log('petty_request_rejected', 'petty_request', $id, (array) $row, (array) $after, $row->number);
        return array('message' => 'درخواست شارژ ' . $row->number . ' رد شد.', 'id' => $id, 'records' => array('petty_requests' => array(self::request_shape($after))));
    }

    /** Called by treasury when a replenishment payment request is paid in full or rejected. */
    public static function on_payment_request($payment_request) {
        if ($payment_request->source_type !== 'petty_replenishment') {
            return null;
        }
        $row = Akph_Db::lock(self::t('petty_requests'), $payment_request->source_id);
        if (!$row) {
            return null;
        }
        $status = $payment_request->status === 'paid' ? 'paid' : ($payment_request->status === 'rejected' ? 'rejected' : 'approved');
        if ($status !== $row->status) {
            $data = array('status' => $status, 'version' => (int) $row->version + 1, 'updated_at' => Akph_Db::now_utc());
            if ($status === 'rejected') {
                $data['reject_reason'] = $payment_request->reject_reason;
            }
            Akph_Db::update(self::t('petty_requests'), $data, array('id' => $row->id));
        }
        return Akph_Db::find(self::t('petty_requests'), $row->id);
    }

    // ------------------------------------------------------------------ count and period close

    public static function count_shape($row) {
        $fund = Akph_Db::find(self::t('petty_funds'), $row->fund_id);
        return array(
            'id' => (string) $row->id,
            'number' => $row->number,
            'fund_id' => (string) $row->fund_id,
            'fund_title' => $fund ? $fund->title : '',
            'holder_name' => $fund ? $fund->holder_name : '',
            'period_start' => $row->period_start,
            'period_end' => $row->period_end,
            'book_balance' => (int) $row->book_balance,
            'pending_expenses' => (int) $row->pending_expenses,
            'expected_balance' => (int) $row->expected_balance,
            'counted_cash' => (int) $row->counted_cash,
            'discrepancy' => (int) $row->discrepancy,
            'reason' => $row->reason,
            'notes' => $row->notes,
            'entry' => Akph_Posting::entry_ref($row->entry_id),
            'closes_period' => (bool) (int) $row->closes_period,
            'counted_by' => (string) $row->counted_by,
            'counted_by_name' => Akph_Flow::user_name($row->counted_by),
            'created_at' => Akph_Db::iso_time($row->created_at),
        );
    }

    public static function count_fund($id, array $body) {
        Akph_Auth::assert_cap(Akph_Roles::PETTY_MANAGE, 'شمارش و مغایرت‌گیری تنخواه مجاز نیست.');
        $counted = Akph_Input::amount($body, 'counted_cash', 'وجه شمارش‌شده');
        $today = Akph_Jalali::today_iso();
        $end = Akph_Input::iso_date($body, 'period_end', false) ?: $today;
        $start = Akph_Input::iso_date($body, 'period_start', false);
        $year = Akph_Posting::year_for($today);
        // An adjustment is a pending entry (DRF), then the count's own number, then the fund row.
        Akph_Numbering::lock('DRF', $year);
        Akph_Numbering::lock('RCN', $year);
        $fund = self::fund_or_404($id, true);
        $book = Akph_Posting::balance(self::cash_ref($fund->id));
        $pending = self::pending_total($fund->id);
        $expected = $book - $pending;
        $diff = $counted - $expected;
        $reason = Akph_Input::text($body, 'reason', 1000, $diff !== 0, 'علت مغایرت');
        $now = Akph_Db::now_utc();
        $cid = Akph_Db::insert(self::t('petty_counts'), array(
            'fund_id' => $fund->id,
            'period_start' => $start ?: $fund->period_start,
            'period_end' => $end,
            'book_balance' => $book,
            'pending_expenses' => $pending,
            'expected_balance' => $expected,
            'counted_cash' => $counted,
            'discrepancy' => $diff,
            'reason' => $diff !== 0 ? $reason : '',
            'notes' => Akph_Input::text($body, 'notes', 1000),
            'counted_by' => get_current_user_id(),
            'created_at' => $now,
        ));
        $number = Akph_Numbering::issue('RCN', $year, 'petty_count', $cid);
        $entry = null;
        if ($diff !== 0) {
            $amount = abs($diff);
            $fund_line = array('code' => $fund->account_code, 'label' => 'وجه تنخواه', 'project_id' => $fund->project_id, 'cash_ref' => self::cash_ref($fund->id), 'description' => 'مغایرت شمارش تنخواه ' . $fund->title . ' (' . $number . ')');
            $other = $diff < 0
                ? array('code' => self::SHORTAGE_ACCOUNT, 'label' => 'کسری صندوق و تنخواه', 'project_id' => $fund->project_id, 'cost_center_id' => $fund->cost_center_id, 'description' => 'کسری شمارش تنخواه: ' . $reason)
                : array('code' => self::SURPLUS_ACCOUNT, 'label' => 'سایر درآمدهای متفرقه', 'project_id' => $fund->project_id, 'description' => 'اضافه شمارش تنخواه: ' . $reason);
            $lines = $diff < 0
                ? array($other + array('debit' => $amount), $fund_line + array('credit' => $amount))
                : array($fund_line + array('debit' => $amount), $other + array('credit' => $amount));
            $posted = Akph_Posting::post(array(
                'source' => 'petty_count',
                'source_id' => $cid,
                'type' => 'PETTY_COUNT_ADJUSTMENT',
                'date' => $today,
                'description' => 'سند تعدیل مغایرت شمارش تنخواه ' . $fund->title . ' (' . $number . '): ' . $reason,
                'entry_type' => 'petty_cash',
                'project_id' => $fund->project_id,
                'pending' => true,
                'lines' => $lines,
            ));
            $entry = $posted['entry'];
        }
        Akph_Db::update(self::t('petty_counts'), array('number' => $number, 'entry_id' => $entry ? $entry->id : null), array('id' => $cid));
        $row = Akph_Db::find(self::t('petty_counts'), $cid);
        Akph_Audit::log('petty_count', 'petty_count', $cid, null, (array) $row, $number);
        $records = array('petty_counts' => array(self::count_shape($row)));
        if ($entry) {
            $records['journal_entries'] = array(Akph_Ledger::shape($entry));
        }
        return array(
            'status' => 201,
            'message' => $entry ? 'صورتجلسه ' . $number . ' ثبت شد؛ سند تعدیل ' . $entry->draft_number . ' در انتظار تأیید کاربر دیگر است.' : 'صورتجلسه ' . $number . ' بدون مغایرت ثبت شد.',
            'id' => $cid,
            'doc_number' => $number,
            'records' => $records,
        );
    }

    public static function close_period($id, array $body, $version) {
        Akph_Auth::assert_cap(Akph_Roles::PETTY_MANAGE, 'بستن دوره تنخواه مجاز نیست.');
        $end = Akph_Input::iso_date($body, 'period_end', false) ?: Akph_Jalali::today_iso();
        $fund = self::fund_or_404($id, true);
        Akph_Input::assert_version($fund, $version);
        global $wpdb;
        $open = (int) Akph_Db::value($wpdb->prepare('SELECT COUNT(*) FROM ' . self::t('petty_expenses') . " WHERE fund_id = %d AND status = 'pending'", $fund->id));
        if ($open > 0) {
            throw Akph_Error::rule('دوره تنخواه بسته نمی‌شود: ' . $open . ' هزینه هنوز در انتظار تأیید است.');
        }
        $adjust = (int) Akph_Db::value($wpdb->prepare(
            'SELECT COUNT(*) FROM ' . self::t('petty_counts') . ' c JOIN ' . Akph_Ledger::entries_table() . " e ON e.id = c.entry_id WHERE c.fund_id = %d AND e.status = 'pending'",
            $fund->id
        ));
        if ($adjust > 0) {
            throw Akph_Error::rule('دوره تنخواه بسته نمی‌شود: سند تعدیل شمارش این صندوق هنوز در انتظار تأیید است.');
        }
        if ($fund->period_start && $end < $fund->period_start) {
            throw Akph_Error::invalid('پایان دوره نمی‌تواند قبل از شروع دوره باشد.', array('field' => 'period_end'));
        }
        $next = gmdate('Y-m-d', strtotime($end . ' +1 day'));
        Akph_Db::update(self::t('petty_funds'), array('period_start' => $next, 'version' => (int) $fund->version + 1, 'updated_by' => get_current_user_id(), 'updated_at' => Akph_Db::now_utc()), array('id' => $fund->id));
        $after = Akph_Db::find(self::t('petty_funds'), $fund->id);
        Akph_Audit::log('petty_period_closed', 'petty_fund', $fund->id, array('period_start' => $fund->period_start), array('period_end' => $end, 'next_period_start' => $next, 'balance' => Akph_Posting::balance(self::cash_ref($fund->id))), $fund->code);
        return array('message' => 'دوره تنخواه ' . $fund->title . ' تا ' . Akph_Jalali::format($end) . ' بسته شد.', 'id' => $fund->id, 'records' => array('petty_funds' => array(self::fund_shape($after))));
    }

    // ------------------------------------------------------------------ reading

    public static function statement($id) {
        global $wpdb;
        $fund = self::fund_or_404($id);
        $expenses = Akph_Db::results($wpdb->prepare('SELECT * FROM ' . self::t('petty_expenses') . ' WHERE fund_id = %d ORDER BY id DESC LIMIT 500', $fund->id));
        $requests = Akph_Db::results($wpdb->prepare('SELECT * FROM ' . self::t('petty_requests') . ' WHERE fund_id = %d ORDER BY id DESC LIMIT 200', $fund->id));
        $counts = Akph_Db::results($wpdb->prepare('SELECT * FROM ' . self::t('petty_counts') . ' WHERE fund_id = %d ORDER BY id DESC LIMIT 200', $fund->id));
        return array(
            'fund' => self::fund_shape($fund),
            'movements' => Akph_Posting::movements(self::cash_ref($fund->id)),
            'expenses' => array_map(array(__CLASS__, 'expense_shape'), (array) $expenses),
            'requests' => array_map(array(__CLASS__, 'request_shape'), (array) $requests),
            'counts' => array_map(array(__CLASS__, 'count_shape'), (array) $counts),
            'history' => Akph_Audit::list_rows(1, 100, 'petty_fund', $fund->id)['events'],
        );
    }

    /** Replenishments paid (payments of replenishment requests), for the fund views. */
    private static function replenishments($scope) {
        $rows = Akph_Db::results(
            'SELECT pm.*, pr.fund_id, pr.number AS request_number, pr.description, a.title AS account_title, e.doc_number FROM ' . self::t('payments') . ' pm JOIN ' . self::t('payment_requests') . ' pr ON pr.id = pm.payment_request_id LEFT JOIN ' . self::t('treasury_accounts') . ' a ON a.id = pm.account_id LEFT JOIN ' . Akph_Ledger::entries_table() . " e ON e.id = pm.entry_id WHERE pr.source_type = 'petty_replenishment' AND {$scope} ORDER BY pm.id DESC LIMIT 500"
        );
        $out = array();
        foreach ((array) $rows as $r) {
            $out[] = array(
                'id' => (string) $r->id,
                'fund_id' => (string) $r->fund_id,
                'payment_request_number' => $r->request_number,
                'amount' => (int) $r->amount,
                'account_id' => (string) $r->account_id,
                'account_title' => (string) $r->account_title,
                'method' => $r->method,
                'tracking' => $r->tracking,
                'date' => $r->pay_date,
                'description' => $r->description,
                'entry_number' => $r->doc_number,
                'paid_by_name' => Akph_Flow::user_name($r->paid_by),
            );
        }
        return $out;
    }

    /** Everything the petty cash screens need, within the user's project scope. */
    public static function overview() {
        $scope = Akph_Auth::project_scope_sql('project_id');
        $funds = Akph_Db::results('SELECT * FROM ' . self::t('petty_funds') . " WHERE {$scope} ORDER BY id");
        $expenses = Akph_Db::results('SELECT * FROM ' . self::t('petty_expenses') . " WHERE {$scope} ORDER BY id DESC LIMIT 1000");
        $requests = Akph_Db::results('SELECT * FROM ' . self::t('petty_requests') . " WHERE {$scope} ORDER BY id DESC LIMIT 500");
        $fund_ids = array_map(function ($f) {
            return (int) $f->id;
        }, (array) $funds);
        $counts = $fund_ids ? Akph_Db::results('SELECT * FROM ' . self::t('petty_counts') . ' WHERE fund_id IN (' . implode(',', $fund_ids) . ') ORDER BY id DESC LIMIT 500') : array();
        return array(
            'funds' => array_map(array(__CLASS__, 'fund_shape'), (array) $funds),
            'categories' => self::list_categories(),
            'settings' => self::settings(),
            'expenses' => array_map(array(__CLASS__, 'expense_shape'), (array) $expenses),
            'requests' => array_map(array(__CLASS__, 'request_shape'), (array) $requests),
            'counts' => array_map(array(__CLASS__, 'count_shape'), (array) $counts),
            'replenishments' => self::replenishments(Akph_Auth::project_scope_sql('pr.project_id')),
        );
    }
}
