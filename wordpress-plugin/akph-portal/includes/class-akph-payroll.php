<?php
/**
 * Payroll (0.8.0; reference: approvePayrollPeriod and payrollApprovedEvent in src/store; docs/SERVER-RULES.md §8).
 *
 * - Employees (optionally linked to a portal user): contract, base salary, allowances, monthly deductions, project and
 *   cost center. Personal data (national id, bank account, salary) is read and written only with akph_payroll_manage
 *   (accountant, senior manager, system administrator): never by a project manager, never by the assistant.
 * - Monthly period (fiscal year, month) → timesheets → calculation by the server (payslips) → approval of the
 *   accountant (not the one who calculated) → approval of the senior manager (not the previous approver) → one entry
 *   PAYROLL_APPROVED and payment requests in the treasury (net salaries, insurance, payroll tax).
 * - Calculation (integer Rials): pay components prorated by work days ÷ month days; overtime = base ÷ month hours ×
 *   hours × overtime factor; mission = base ÷ month days × days × mission factor; insurance of the employee and the
 *   employer on the insurable pay (optional monthly ceiling); income tax by the progressive monthly table of the fiscal
 *   year on (gross − employee insurance); loan installment and other deductions up to what is left.
 * - Entry: Dr salary cost per cost center (51201 site, 61101 headquarters) = gross + employer insurance − other
 *   deductions / Cr salaries payable 21501 (net), insurance payable 21201 (employee + employer), payroll tax 21203,
 *   staff loans 11303.
 */
if (!defined('ABSPATH')) {
    exit;
}

final class Akph_Payroll {
    const OPTION = 'akph_portal_payroll';
    const SITE_COST = '51201';
    const HQ_COST = '61101';
    const SALARY_PAYABLE = '21501';
    const INSURANCE_PAYABLE = '21201';
    const TAX_PAYABLE = '21203';
    const STAFF_LOANS = '11303';
    const CONTRACT_TYPES = array('full_time', 'temporary', 'hourly', 'daily');

    public static function t($name) {
        return Akph_Schema::table($name);
    }

    private static function now() {
        return Akph_Db::now_utc();
    }

    public static function chain() {
        return array(Akph_Flow::ACCOUNTANT, Akph_Flow::SENIOR);
    }

    private static function assert_manage() {
        Akph_Auth::assert_cap(Akph_Roles::PAYROLL_MANAGE, 'حقوق و اطلاعات پرسنل فقط برای حسابدار، مدیر ارشد و مدیر سیستم است.');
    }

    // ------------------------------------------------------------------ settings

    public static function default_brackets() {
        // Monthly income tax table (Rials, upper bound of each band; the last band has no bound).
        return array(
            array('upto' => 240000000, 'rate_bp' => 0),
            array('upto' => 300000000, 'rate_bp' => 1000),
            array('upto' => 380000000, 'rate_bp' => 1500),
            array('upto' => 500000000, 'rate_bp' => 2000),
            array('upto' => 666666666, 'rate_bp' => 2500),
            array('upto' => null, 'rate_bp' => 3000),
        );
    }

    public static function settings() {
        $s = get_option(self::OPTION, array());
        $s = is_array($s) ? $s : array();
        $int = function ($k, $d) use ($s) {
            return isset($s[$k]) && is_int($s[$k]) ? $s[$k] : $d;
        };
        return array(
            'worker_insurance_bp' => $int('worker_insurance_bp', 700),
            'employer_insurance_bp' => $int('employer_insurance_bp', 2300),
            'insurance_ceiling' => $int('insurance_ceiling', 0),
            'month_days' => $int('month_days', 30),
            'month_hours' => $int('month_hours', 220),
            'overtime_factor_bp' => $int('overtime_factor_bp', 14000),
            'mission_factor_bp' => $int('mission_factor_bp', 5000),
            'tax_tables' => isset($s['tax_tables']) && is_array($s['tax_tables']) ? $s['tax_tables'] : array(),
        );
    }

    /** Tax table of a fiscal year (the latest earlier year's, else the default). */
    public static function brackets_for($year) {
        $tables = self::settings()['tax_tables'];
        $years = array_filter(array_map('intval', array_keys($tables)), function ($y) use ($year) {
            return $y <= (int) $year;
        });
        if ($years) {
            return $tables[(string) max($years)];
        }
        return self::default_brackets();
    }

    public static function settings_shape() {
        $s = self::settings();
        $tables = array();
        foreach ($s['tax_tables'] as $y => $b) {
            $tables[] = array('fiscal_year' => (int) $y, 'brackets' => self::brackets_out($b));
        }
        return array(
            'worker_insurance_pct' => Akph_Qty::bp_string($s['worker_insurance_bp']),
            'employer_insurance_pct' => Akph_Qty::bp_string($s['employer_insurance_bp']),
            'insurance_ceiling' => $s['insurance_ceiling'],
            'month_days' => $s['month_days'],
            'month_hours' => $s['month_hours'],
            'overtime_factor_pct' => Akph_Qty::bp_string($s['overtime_factor_bp']),
            'mission_factor_pct' => Akph_Qty::bp_string($s['mission_factor_bp']),
            'tax_tables' => $tables,
            'default_brackets' => self::brackets_out(self::default_brackets()),
        );
    }

    private static function brackets_out($b) {
        return array_map(function ($x) {
            return array('upto' => $x['upto'] === null ? null : (int) $x['upto'], 'rate_pct' => Akph_Qty::bp_string((int) $x['rate_bp']));
        }, $b);
    }

    public static function update_settings(array $body) {
        Akph_Auth::assert_cap(Akph_Roles::SETTINGS, 'تنظیمات حقوق فقط با مجوز تنظیمات قابل تغییر است.');
        $before = get_option(self::OPTION, array());
        $s = self::settings();
        foreach (array('worker_insurance_pct' => 'worker_insurance_bp', 'employer_insurance_pct' => 'employer_insurance_bp') as $in => $out) {
            if (array_key_exists($in, $body)) {
                $s[$out] = Akph_Qty::percent_bp($body, $in, 'نرخ بیمه');
            }
        }
        foreach (array('overtime_factor_pct' => 'overtime_factor_bp', 'mission_factor_pct' => 'mission_factor_bp') as $in => $out) {
            if (array_key_exists($in, $body)) {
                $v = is_string($body[$in]) || is_int($body[$in]) || is_float($body[$in]) ? (string) $body[$in] : '';
                if (!preg_match('/^([0-9]{1,3})(?:\.([0-9]{1,2}))?$/D', $v, $m) || (int) $m[1] > 500) {
                    throw Akph_Error::invalid('ضریب باید درصد تا ۵۰۰ با حداکثر دو رقم اعشار باشد.', array('field' => $in));
                }
                $s[$out] = (int) $m[1] * 100 + (int) str_pad(isset($m[2]) ? $m[2] : '', 2, '0');
            }
        }
        if (array_key_exists('insurance_ceiling', $body)) {
            $s['insurance_ceiling'] = Akph_Input::amount($body, 'insurance_ceiling', 'سقف حقوق مشمول بیمه');
        }
        foreach (array('month_days' => array(1, 31), 'month_hours' => array(1, 400)) as $k => $range) {
            if (array_key_exists($k, $body)) {
                if (!is_int($body[$k]) || $body[$k] < $range[0] || $body[$k] > $range[1]) {
                    throw Akph_Error::invalid('مقدار ' . $k . ' نامعتبر است.', array('field' => $k));
                }
                $s[$k] = $body[$k];
            }
        }
        if (array_key_exists('tax_table', $body)) {
            $t = $body['tax_table'];
            if (!is_array($t) || !isset($t['fiscal_year']) || !is_int($t['fiscal_year']) || $t['fiscal_year'] < 1390 || $t['fiscal_year'] > 1500 || !isset($t['brackets']) || !is_array($t['brackets']) || !$t['brackets'] || count($t['brackets']) > 12) {
                throw Akph_Error::invalid('جدول مالیات: سال مالی و حداکثر ۱۲ پله لازم است.', array('field' => 'tax_table'));
            }
            $prev = 0;
            $bands = array();
            foreach (array_values($t['brackets']) as $i => $b) {
                $last = $i === count($t['brackets']) - 1;
                $upto = is_array($b) && array_key_exists('upto', $b) ? $b['upto'] : 'x';
                if ($last ? $upto !== null : (!is_int($upto) || $upto <= $prev)) {
                    throw Akph_Error::invalid('پله ' . ($i + 1) . ' جدول مالیات: سقف‌ها باید صعودی باشند و پله آخر سقف ندارد.', array('field' => 'tax_table'));
                }
                $bands[] = array('upto' => $upto, 'rate_bp' => Akph_Qty::percent_bp($b, 'rate_pct', 'نرخ پله ' . ($i + 1)));
                $prev = $last ? $prev : $upto;
            }
            $s['tax_tables'][(string) $t['fiscal_year']] = $bands;
        }
        update_option(self::OPTION, $s, false);
        Akph_Audit::log('payroll_settings_updated', 'settings', 0, $before, $s, 'payroll');
        return array('message' => 'تنظیمات حقوق ذخیره شد.', 'records' => array('payroll_settings' => array(self::settings_shape())));
    }

    // ------------------------------------------------------------------ employees

    public static function employee_shape($e) {
        return array(
            'id' => (string) $e->id,
            'code' => $e->code,
            'full_name' => $e->full_name,
            'user_id' => $e->user_id ? (string) $e->user_id : null,
            'national_id' => $e->national_id,
            'insurance_no' => $e->insurance_no,
            'bank_name' => $e->bank_name,
            'sheba' => $e->sheba,
            'account_number' => $e->account_number,
            'job_title' => $e->job_title,
            'contract_type' => $e->contract_type,
            'hire_date' => $e->hire_date,
            'project_id' => $e->project_id ? (string) $e->project_id : null,
            'cost_center_id' => (string) $e->cost_center_id,
            'base_salary' => (int) $e->base_salary,
            'housing_allowance' => (int) $e->housing_allowance,
            'food_allowance' => (int) $e->food_allowance,
            'child_allowance' => (int) $e->child_allowance,
            'other_benefits' => (int) $e->other_benefits,
            'loan_installment' => (int) $e->loan_installment,
            'other_deduction' => (int) $e->other_deduction,
            'insured' => (bool) (int) $e->insured,
            'active' => (bool) (int) $e->active,
            'version' => (int) $e->version,
        );
    }

    private static function employee_columns(array $body, $partial) {
        $data = array();
        $text = array('full_name' => array(190, true, 'نام و نام خانوادگی'), 'insurance_no' => array(32, false, ''), 'bank_name' => array(100, false, ''), 'account_number' => array(40, false, ''), 'job_title' => array(190, false, ''));
        foreach ($text as $k => $o) {
            if (!$partial || array_key_exists($k, $body)) {
                $data[$k] = Akph_Input::text($body, $k, $o[0], $o[1], $o[2]);
            }
        }
        if (!$partial || array_key_exists('national_id', $body)) {
            $nid = Akph_Input::text($body, 'national_id', 16);
            if ($nid !== '' && !preg_match('/^[0-9]{10}$/D', $nid)) {
                throw Akph_Error::invalid('کد ملی ۱۰ رقم است.', array('field' => 'national_id'));
            }
            $data['national_id'] = $nid;
        }
        if (!$partial || array_key_exists('sheba', $body)) {
            $sheba = strtoupper(str_replace(' ', '', Akph_Input::text($body, 'sheba', 32)));
            if ($sheba !== '' && !preg_match('/^IR[0-9]{24}$/D', $sheba)) {
                throw Akph_Error::invalid('شماره شبا باید IR و ۲۴ رقم باشد.', array('field' => 'sheba'));
            }
            $data['sheba'] = $sheba;
        }
        if (!$partial || array_key_exists('contract_type', $body)) {
            $data['contract_type'] = Akph_Input::one_of($body, 'contract_type', self::CONTRACT_TYPES, 'full_time');
        }
        if (!$partial || array_key_exists('hire_date', $body)) {
            $data['hire_date'] = Akph_Input::iso_date($body, 'hire_date', false);
        }
        if (!$partial || array_key_exists('user_id', $body)) {
            $uid = Akph_Input::id($body, 'user_id');
            if ($uid && (!get_userdata($uid) || !Akph_Roles::role_of(get_userdata($uid)))) {
                throw Akph_Error::invalid('کاربر پیوندشده باید کاربر پرتال باشد.', array('field' => 'user_id'));
            }
            $data['user_id'] = $uid ?: null;
        }
        foreach (array('base_salary' => 'حقوق پایه', 'housing_allowance' => 'حق مسکن', 'food_allowance' => 'بن', 'child_allowance' => 'حق اولاد', 'other_benefits' => 'سایر مزایا', 'loan_installment' => 'قسط مساعده', 'other_deduction' => 'سایر کسور') as $k => $label) {
            if (!$partial || array_key_exists($k, $body)) {
                $data[$k] = Akph_Input::amount($body, $k, $label);
            }
        }
        if (!$partial || array_key_exists('insured', $body)) {
            $data['insured'] = Akph_Input::bool($body, 'insured', true) ? 1 : 0;
        }
        if (!$partial || array_key_exists('cost_center_id', $body) || array_key_exists('project_id', $body)) {
            $cc = Akph_Input::id($body, 'cost_center_id', false);
            $center = Akph_Db::find(self::t('cost_centers'), $cc);
            if (!$center) {
                throw Akph_Error::invalid('مرکز هزینه پیدا نشد.', array('field' => 'cost_center_id'));
            }
            $project = Akph_Input::id($body, 'project_id') ?: ($center->project_id ? (int) $center->project_id : 0);
            if ($center->project_id && (int) $center->project_id !== $project) {
                throw Akph_Error::invalid('مرکز هزینه متعلق به این پروژه نیست.', array('field' => 'cost_center_id'));
            }
            $data['cost_center_id'] = $cc;
            $data['project_id'] = $project ?: null;
        }
        return $data;
    }

    public static function create_employee(array $body) {
        self::assert_manage();
        $year = Akph_Jalali::fiscal_year(Akph_Jalali::today_iso());
        Akph_Numbering::lock('EMP', $year);
        $data = self::employee_columns($body, false);
        $now = self::now();
        $id = Akph_Db::insert(self::t('employees'), $data + array('code' => 'tmp-' . substr(md5(wp_generate_uuid4()), 0, 24), 'active' => 1, 'created_by' => get_current_user_id(), 'version' => 1, 'created_at' => $now, 'updated_at' => $now));
        $code = Akph_Numbering::issue('EMP', $year, 'employee', $id);
        Akph_Db::update(self::t('employees'), array('code' => $code), array('id' => $id));
        $e = Akph_Db::find(self::t('employees'), $id);
        // Personal data stays out of the audit trail's object reference; the audit keeps the full before/after.
        Akph_Audit::log('employee_created', 'employee', $id, null, (array) $e, $code);
        return array('status' => 201, 'message' => 'پرسنل ' . $e->full_name . ' (' . $code . ') ثبت شد.', 'id' => $id, 'records' => array('employees' => array(self::employee_shape($e))));
    }

    public static function update_employee($id, array $body, $version) {
        self::assert_manage();
        $e = Akph_Db::lock(self::t('employees'), $id);
        if (!$e) {
            throw Akph_Error::not_found('پرسنل پیدا نشد.');
        }
        Akph_Input::assert_version($e, $version);
        $data = self::employee_columns($body, true);
        if (array_key_exists('active', $body)) {
            $data['active'] = Akph_Input::bool($body, 'active') ? 1 : 0;
        }
        if (!$data) {
            throw Akph_Error::invalid('تغییری فرستاده نشده است.');
        }
        Akph_Db::update(self::t('employees'), $data + array('version' => (int) $e->version + 1, 'updated_at' => self::now()), array('id' => $id));
        $after = Akph_Db::find(self::t('employees'), $id);
        Akph_Audit::log('employee_updated', 'employee', $id, (array) $e, (array) $after, $e->code);
        return array('message' => 'اطلاعات ' . $after->full_name . ' به‌روز شد.', 'id' => $id, 'records' => array('employees' => array(self::employee_shape($after))));
    }

    // ------------------------------------------------------------------ periods, timesheets, payslips

    public static function period_shape($p) {
        $chain = self::chain();
        $step = null;
        if ($p->status === 'calculated') {
            $step = $chain[0];
        } elseif ($p->status === 'finance_approved') {
            $step = $chain[1];
        }
        $requests = array();
        foreach (array_filter(explode(',', (string) $p->payment_request_ids)) as $rid) {
            $pr = Akph_Db::find(self::t('payment_requests'), $rid);
            if ($pr) {
                $requests[] = array('id' => (string) $pr->id, 'number' => $pr->number, 'payable_type' => $pr->payable_type, 'status' => $pr->status, 'amount' => (int) $pr->amount, 'paid_amount' => (int) $pr->paid_amount);
            }
        }
        return array(
            'id' => (string) $p->id,
            'number' => $p->number,
            'fiscal_year' => (int) $p->fiscal_year,
            'month' => (int) $p->month,
            'status' => $p->status,
            'current_step' => $step,
            'gross_total' => (int) $p->gross_total,
            'net_total' => (int) $p->net_total,
            'cost_total' => (int) $p->cost_total,
            'history' => Akph_Flow::history($p->history),
            'calculated_by' => $p->calculated_by ? (string) $p->calculated_by : null,
            'calculated_by_name' => Akph_Flow::user_name($p->calculated_by),
            'last_approved_by' => $p->last_approved_by ? (string) $p->last_approved_by : null,
            'reject_reason' => $p->reject_reason,
            'entry' => Akph_Posting::entry_ref($p->entry_id),
            'payment_requests' => $requests,
            'created_by' => (string) $p->created_by,
            'version' => (int) $p->version,
        );
    }

    private static function dec($v) {
        return rtrim(rtrim((string) $v, '0'), '.') ?: '0';
    }

    public static function timesheet_shape($t) {
        return array('id' => (string) $t->id, 'period_id' => (string) $t->period_id, 'employee_id' => (string) $t->employee_id, 'work_days' => self::dec($t->work_days), 'absent_days' => self::dec($t->absent_days), 'overtime_hours' => self::dec($t->overtime_hours), 'mission_days' => self::dec($t->mission_days), 'notes' => $t->notes);
    }

    public static function payslip_shape($s) {
        $e = Akph_Db::find(self::t('employees'), $s->employee_id);
        $p = Akph_Db::find(self::t('payroll_periods'), $s->period_id);
        $out = array('id' => (string) $s->id, 'number' => $s->number, 'period_id' => (string) $s->period_id, 'fiscal_year' => $p ? (int) $p->fiscal_year : 0, 'month' => $p ? (int) $p->month : 0, 'status' => $p ? $p->status : '', 'employee_id' => (string) $s->employee_id, 'employee_name' => $e ? $e->full_name : '', 'employee_code' => $e ? $e->code : '', 'job_title' => $e ? $e->job_title : '', 'project_id' => $s->project_id ? (string) $s->project_id : null, 'cost_center_id' => (string) $s->cost_center_id, 'work_days' => self::dec($s->work_days), 'overtime_hours' => self::dec($s->overtime_hours));
        foreach (array('base_pay', 'housing', 'food', 'child', 'other_benefits', 'overtime_pay', 'mission_pay', 'gross', 'insurable', 'worker_insurance', 'employer_insurance', 'taxable', 'income_tax', 'loan_deduction', 'other_deduction', 'total_deductions', 'net', 'cost') as $k) {
            $out[$k] = (int) $s->{$k};
        }
        return $out;
    }

    public static function overview() {
        self::assert_manage();
        return array(
            'employees' => array_map(array(__CLASS__, 'employee_shape'), (array) Akph_Db::results('SELECT * FROM ' . self::t('employees') . ' ORDER BY code')),
            'periods' => array_map(array(__CLASS__, 'period_shape'), (array) Akph_Db::results('SELECT * FROM ' . self::t('payroll_periods') . ' ORDER BY fiscal_year DESC, month DESC LIMIT 120')),
            'timesheets' => array_map(array(__CLASS__, 'timesheet_shape'), (array) Akph_Db::results('SELECT t.* FROM ' . self::t('timesheets') . ' t JOIN ' . self::t('payroll_periods') . ' p ON p.id = t.period_id ORDER BY p.fiscal_year DESC, p.month DESC, t.id LIMIT 5000')),
            'payslips' => array_map(array(__CLASS__, 'payslip_shape'), (array) Akph_Db::results('SELECT s.* FROM ' . self::t('payslips') . ' s JOIN ' . self::t('payroll_periods') . ' p ON p.id = s.period_id ORDER BY p.fiscal_year DESC, p.month DESC, s.id LIMIT 5000')),
            'settings' => self::settings_shape(),
        );
    }

    public static function create_period(array $body) {
        self::assert_manage();
        $year = isset($body['fiscal_year']) ? $body['fiscal_year'] : null;
        $month = isset($body['month']) ? $body['month'] : null;
        if (!is_int($year) || $year < 1390 || $year > 1500 || !is_int($month) || $month < 1 || $month > 12) {
            throw Akph_Error::invalid('سال مالی و ماه (۱ تا ۱۲) دوره را وارد کنید.', array('field' => 'month'));
        }
        Akph_Numbering::lock('PRL', $year);
        $now = self::now();
        $id = Akph_Db::try_insert(self::t('payroll_periods'), array('fiscal_year' => $year, 'month' => $month, 'status' => 'draft', 'history' => Akph_Flow::push_history('[]', 'submitted', 'ایجاد دوره حقوق'), 'created_by' => get_current_user_id(), 'version' => 1, 'created_at' => $now, 'updated_at' => $now));
        if ($id === false) {
            throw Akph_Error::conflict('دوره حقوق ' . $month . '/' . $year . ' قبلاً ایجاد شده است.');
        }
        $number = Akph_Numbering::issue('PRL', $year, 'payroll_period', $id);
        Akph_Db::update(self::t('payroll_periods'), array('number' => $number), array('id' => $id));
        $p = Akph_Db::find(self::t('payroll_periods'), $id);
        Akph_Audit::log('payroll_period_created', 'payroll_period', $id, null, (array) $p, $number);
        return array('status' => 201, 'message' => 'دوره حقوق ' . $number . ' ایجاد شد.', 'id' => $id, 'doc_number' => $number, 'records' => array('payroll_periods' => array(self::period_shape($p))));
    }

    private static function period_or_404($id) {
        $p = Akph_Db::lock(self::t('payroll_periods'), $id);
        if (!$p) {
            throw Akph_Error::not_found('دوره حقوق پیدا نشد.');
        }
        return $p;
    }

    private static function days($body, $key, $label, $max) {
        $v = isset($body[$key]) && $body[$key] !== '' ? $body[$key] : 0;
        $s = is_int($v) || is_float($v) ? (string) $v : $v;
        if (!is_string($s) || !preg_match('/^[0-9]{1,3}(\.[0-9]{1,2})?$/D', $s) || (float) $s > $max) {
            throw Akph_Error::invalid($label . ' باید عدد نامنفی حداکثر ' . $max . ' با دو رقم اعشار باشد.', array('field' => 'timesheets'));
        }
        return $s;
    }

    /** Timesheets of a draft period: [{employee_id, work_days, absent_days, overtime_hours, mission_days, notes}]. */
    public static function save_timesheets($period_id, array $body, $version) {
        self::assert_manage();
        $p = self::period_or_404($period_id);
        Akph_Input::assert_version($p, $version);
        if (!in_array($p->status, array('draft', 'calculated'), true)) {
            throw Akph_Error::conflict('کارکرد دوره تأییدشده تغییر نمی‌کند.', array('status' => $p->status));
        }
        if (!isset($body['timesheets']) || !is_array($body['timesheets']) || !$body['timesheets'] || count($body['timesheets']) > 1000) {
            throw Akph_Error::invalid('کارکرد پرسنل را وارد کنید.', array('field' => 'timesheets'));
        }
        global $wpdb;
        $s = self::settings();
        foreach (array_values($body['timesheets']) as $i => $t) {
            if (!is_array($t)) {
                throw Akph_Error::invalid('ردیف ' . ($i + 1) . ' نامعتبر است.', array('field' => 'timesheets'));
            }
            foreach (array_keys($t) as $k) {
                if (!in_array($k, array('employee_id', 'work_days', 'absent_days', 'overtime_hours', 'mission_days', 'notes'), true)) {
                    throw new Akph_Error('akph_unknown_field', 'فیلد ناشناخته در ردیف: ' . $k, 400, array('field' => 'timesheets'));
                }
            }
            $eid = Akph_Input::id($t, 'employee_id', false);
            $e = Akph_Db::find(self::t('employees'), $eid);
            if (!$e) {
                throw Akph_Error::invalid('پرسنل ردیف ' . ($i + 1) . ' پیدا نشد.', array('field' => 'timesheets'));
            }
            $row = array(
                'work_days' => self::days($t, 'work_days', 'روز کارکرد', $s['month_days']),
                'absent_days' => self::days($t, 'absent_days', 'روز غیبت', $s['month_days']),
                'overtime_hours' => self::days($t, 'overtime_hours', 'ساعت اضافه‌کار', 300),
                'mission_days' => self::days($t, 'mission_days', 'روز مأموریت', $s['month_days']),
                'notes' => Akph_Input::text($t, 'notes', 500),
                'updated_by' => get_current_user_id(),
                'updated_at' => self::now(),
            );
            $existing = Akph_Db::value($wpdb->prepare('SELECT id FROM ' . self::t('timesheets') . ' WHERE period_id = %d AND employee_id = %d', $p->id, $eid));
            if ($existing) {
                Akph_Db::update(self::t('timesheets'), $row, array('id' => $existing));
            } else {
                Akph_Db::insert(self::t('timesheets'), $row + array('period_id' => $p->id, 'employee_id' => $eid));
            }
        }
        // A changed timesheet invalidates a calculation.
        Akph_Db::exec($wpdb->prepare('DELETE FROM ' . self::t('payslips') . ' WHERE period_id = %d', $p->id));
        Akph_Db::update(self::t('payroll_periods'), array('status' => 'draft', 'gross_total' => 0, 'net_total' => 0, 'cost_total' => 0, 'calculated_by' => null, 'version' => (int) $p->version + 1, 'updated_at' => self::now()), array('id' => $p->id));
        Akph_Audit::log('timesheets_saved', 'payroll_period', $p->id, null, array('rows' => count($body['timesheets'])), $p->number);
        return self::period_result($p->id, 'کارکرد ' . count($body['timesheets']) . ' نفر ثبت شد.');
    }

    private static function period_result($id, $message, array $extra = array()) {
        global $wpdb;
        $p = Akph_Db::find(self::t('payroll_periods'), $id);
        return array('message' => $message, 'id' => $id, 'records' => array_merge(array(
            'payroll_periods' => array(self::period_shape($p)),
            'timesheets' => array_map(array(__CLASS__, 'timesheet_shape'), (array) Akph_Db::results($wpdb->prepare('SELECT * FROM ' . self::t('timesheets') . ' WHERE period_id = %d ORDER BY id', $id))),
            'payslips' => array_map(array(__CLASS__, 'payslip_shape'), (array) Akph_Db::results($wpdb->prepare('SELECT * FROM ' . self::t('payslips') . ' WHERE period_id = %d ORDER BY id', $id))),
        ), $extra));
    }

    /** Monthly income tax of a taxable amount by the progressive table. */
    public static function income_tax($taxable, array $brackets) {
        $tax = 0;
        $low = 0;
        foreach ($brackets as $b) {
            $high = $b['upto'] === null ? PHP_INT_MAX : (int) $b['upto'];
            if ($taxable > $low) {
                $tax += (int) round((min($taxable, $high) - $low) * (int) $b['rate_bp'] / 10000);
            }
            if ($taxable <= $high) {
                break;
            }
            $low = $high;
        }
        return $tax;
    }

    /** Payslip amounts of one employee for one timesheet (integer Rials). */
    public static function compute($e, $t, $fiscal_year) {
        $s = self::settings();
        $days = (float) $t->work_days;
        $md = $s['month_days'];
        $pro = function ($amount) use ($days, $md) {
            return (int) round((int) $amount * $days / $md);
        };
        $x = array(
            'base_pay' => $pro($e->base_salary),
            'housing' => $pro($e->housing_allowance),
            'food' => $pro($e->food_allowance),
            'child' => $pro($e->child_allowance),
            'other_benefits' => $pro($e->other_benefits),
            'overtime_pay' => (int) round((int) $e->base_salary / $s['month_hours'] * (float) $t->overtime_hours * $s['overtime_factor_bp'] / 10000),
            'mission_pay' => (int) round((int) $e->base_salary / $md * (float) $t->mission_days * $s['mission_factor_bp'] / 10000),
        );
        $gross = array_sum($x);
        $insurable = $s['insurance_ceiling'] > 0 ? min($gross, $s['insurance_ceiling']) : $gross;
        $worker = (int) $e->insured ? (int) round($insurable * $s['worker_insurance_bp'] / 10000) : 0;
        $employer = (int) $e->insured ? (int) round($insurable * $s['employer_insurance_bp'] / 10000) : 0;
        $taxable = max(0, $gross - $worker);
        $tax = self::income_tax($taxable, self::brackets_for($fiscal_year));
        $left = max(0, $gross - $worker - $tax);
        $loan = min((int) $e->loan_installment, $left);
        $other = min((int) $e->other_deduction, $left - $loan);
        $ded = $worker + $tax + $loan + $other;
        return $x + array('gross' => $gross, 'insurable' => (int) $e->insured ? $insurable : 0, 'worker_insurance' => $worker, 'employer_insurance' => $employer, 'taxable' => $taxable, 'income_tax' => $tax, 'loan_deduction' => $loan, 'other_deduction' => $other, 'total_deductions' => $ded, 'net' => $gross - $ded, 'cost' => $gross + $employer);
    }

    public static function calculate($period_id, array $body, $version) {
        self::assert_manage();
        $p0 = Akph_Db::find(self::t('payroll_periods'), $period_id);
        Akph_Numbering::lock('PSL', $p0 ? (int) $p0->fiscal_year : Akph_Jalali::fiscal_year(Akph_Jalali::today_iso()));
        $p = self::period_or_404($period_id);
        Akph_Input::assert_version($p, $version);
        if (!in_array($p->status, array('draft', 'calculated'), true)) {
            throw Akph_Error::conflict('دوره تأییدشده دوباره محاسبه نمی‌شود.', array('status' => $p->status));
        }
        global $wpdb;
        $sheets = (array) Akph_Db::results($wpdb->prepare('SELECT * FROM ' . self::t('timesheets') . ' WHERE period_id = %d ORDER BY id', $p->id));
        if (!$sheets) {
            throw Akph_Error::rule('برای این دوره کارکردی ثبت نشده است.');
        }
        Akph_Db::exec($wpdb->prepare('DELETE FROM ' . self::t('payslips') . ' WHERE period_id = %d', $p->id));
        $gross = 0;
        $net = 0;
        $cost = 0;
        $now = self::now();
        foreach ($sheets as $t) {
            $e = Akph_Db::find(self::t('employees'), $t->employee_id);
            if (!$e || !(int) $e->active) {
                continue;
            }
            $x = self::compute($e, $t, $p->fiscal_year);
            $sid = Akph_Db::insert(self::t('payslips'), $x + array('period_id' => $p->id, 'employee_id' => $e->id, 'project_id' => $e->project_id, 'cost_center_id' => $e->cost_center_id, 'work_days' => $t->work_days, 'overtime_hours' => $t->overtime_hours, 'created_at' => $now));
            Akph_Db::update(self::t('payslips'), array('number' => Akph_Numbering::issue('PSL', $p->fiscal_year, 'payslip', $sid)), array('id' => $sid));
            $gross += $x['gross'];
            $net += $x['net'];
            $cost += $x['cost'];
        }
        Akph_Db::update(self::t('payroll_periods'), array('status' => 'calculated', 'gross_total' => $gross, 'net_total' => $net, 'cost_total' => $cost, 'calculated_by' => get_current_user_id(), 'last_approved_by' => null, 'history' => Akph_Flow::push_history($p->history, 'calculated', 'محاسبه حقوق'), 'version' => (int) $p->version + 1, 'updated_at' => $now), array('id' => $p->id));
        Akph_Audit::log('payroll_calculated', 'payroll_period', $p->id, null, array('gross' => $gross, 'net' => $net, 'cost' => $cost), $p->number);
        return self::period_result($p->id, 'حقوق ' . $p->number . ' محاسبه شد: خالص ' . number_format($net) . ' ریال؛ در انتظار تأیید حسابدار.');
    }

    /** Accountant step, then senior manager step (the final one posts the entry and the payment requests). */
    public static function approve($period_id, array $body, $version) {
        self::assert_manage();
        $comment = Akph_Input::text($body, 'comment', 1000);
        $today = Akph_Jalali::today_iso();
        $p0 = Akph_Db::find(self::t('payroll_periods'), $period_id);
        $final = $p0 && $p0->status === 'finance_approved';
        if ($final) {
            Akph_Posting::lock_year($today);
            Akph_Numbering::lock('PAY', Akph_Jalali::fiscal_year($today));
        }
        $p = self::period_or_404($period_id);
        Akph_Input::assert_version($p, $version);
        if (!in_array($p->status, array('calculated', 'finance_approved'), true) || ($p->status === 'finance_approved') !== $final) {
            throw Akph_Error::conflict('این دوره در انتظار تأیید نیست.', array('status' => $p->status));
        }
        $step = $final ? Akph_Flow::SENIOR : Akph_Flow::ACCOUNTANT;
        Akph_Flow::assert_step($step, 0, $p->calculated_by, $p->last_approved_by);
        $now = self::now();
        $data = array('last_approved_by' => get_current_user_id(), 'history' => Akph_Flow::push_history($p->history, 'approved', $step, $comment), 'version' => (int) $p->version + 1, 'updated_at' => $now);
        if (!$final) {
            Akph_Db::update(self::t('payroll_periods'), $data + array('status' => 'finance_approved'), array('id' => $p->id));
            Akph_Audit::log('payroll_finance_approved', 'payroll_period', $p->id, (array) $p, $data, $p->number);
            return self::period_result($p->id, 'تأیید حسابدار ثبت شد؛ دوره در انتظار تأیید مدیر ارشد است.');
        }
        global $wpdb;
        $slips = (array) Akph_Db::results($wpdb->prepare('SELECT * FROM ' . self::t('payslips') . ' WHERE period_id = %d', $p->id));
        if (!$slips) {
            throw Akph_Error::rule('فیش محاسبه‌شده‌ای در این دوره نیست.');
        }
        $by_center = array();
        $credit = array('net' => 0, 'insurance' => 0, 'tax' => 0, 'loans' => 0);
        foreach ($slips as $s) {
            $key = (int) $s->cost_center_id;
            if (!isset($by_center[$key])) {
                $by_center[$key] = array('project_id' => $s->project_id, 'amount' => 0);
            }
            $by_center[$key]['amount'] += (int) $s->cost - (int) $s->other_deduction;
            $credit['net'] += (int) $s->net;
            $credit['insurance'] += (int) $s->worker_insurance + (int) $s->employer_insurance;
            $credit['tax'] += (int) $s->income_tax;
            $credit['loans'] += (int) $s->loan_deduction;
        }
        $label = $p->month . '/' . $p->fiscal_year;
        $lines = array();
        foreach ($by_center as $cc => $x) {
            if ($x['amount'] <= 0) {
                continue;
            }
            $center = Akph_Db::find(self::t('cost_centers'), $cc);
            $overhead = !$center || !$center->project_id;
            $lines[] = array('code' => $overhead ? self::HQ_COST : self::SITE_COST, 'label' => 'هزینه حقوق', 'debit' => $x['amount'], 'project_id' => $overhead ? null : $x['project_id'], 'cost_center_id' => $cc, 'description' => 'هزینه حقوق و سهم بیمه کارفرما دوره ' . $label . ($center ? ' - ' . $center->name : ''));
        }
        $lines[] = array('code' => self::SALARY_PAYABLE, 'label' => 'حقوق پرداختنی', 'credit' => $credit['net'], 'description' => 'خالص حقوق پرداختنی دوره ' . $label);
        foreach (array('insurance' => array(self::INSURANCE_PAYABLE, 'بیمه سهم کارگر و کارفرما دوره '), 'tax' => array(self::TAX_PAYABLE, 'مالیات حقوق دوره '), 'loans' => array(self::STAFF_LOANS, 'کسر اقساط مساعده پرسنل دوره ')) as $k => $a) {
            if ($credit[$k] > 0) {
                $lines[] = array('code' => $a[0], 'label' => $a[1], 'credit' => $credit[$k], 'description' => $a[1] . $label);
            }
        }
        $posted = Akph_Posting::post(array('source' => 'payroll_period', 'source_id' => $p->id, 'type' => 'PAYROLL_APPROVED', 'date' => $today, 'description' => 'سند حقوق و دستمزد دوره ' . $label . ' (' . $p->number . ')', 'entry_type' => 'payroll', 'lines' => $lines));
        $entry = $posted['entry'];
        $requests = array();
        $make = function ($type, $code, $amount, $name, $desc) use (&$requests, $p) {
            if ($amount <= 0) {
                return;
            }
            $requests[] = Akph_Treasury::create_request_internal(array('source_type' => 'payroll', 'source_id' => $p->id, 'payable_type' => $type, 'debit_account_code' => $code, 'beneficiary_name' => $name, 'beneficiary_type' => 'payroll', 'amount' => $amount, 'description' => $desc, 'approved_by' => get_current_user_id()));
        };
        $make('payroll', self::SALARY_PAYABLE, $credit['net'], 'پرسنل - لیست حقوق ' . $label, 'خالص حقوق دوره ' . $label . ' (' . $p->number . ')');
        $make('insurance', self::INSURANCE_PAYABLE, $credit['insurance'], 'سازمان تأمین اجتماعی', 'حق بیمه دوره ' . $label);
        $make('tax_payroll', self::TAX_PAYABLE, $credit['tax'], 'سازمان امور مالیاتی', 'مالیات حقوق دوره ' . $label);
        Akph_Db::update(self::t('payroll_periods'), $data + array('status' => 'approved', 'entry_id' => $entry->id, 'payment_request_ids' => implode(',', array_map(function ($r) {
            return $r->id;
        }, $requests))), array('id' => $p->id));
        Akph_Audit::log('payroll_approved', 'payroll_period', $p->id, (array) $p, $data + array('entry_id' => $entry->id), $p->number);
        return self::period_result($p->id, 'حقوق دوره ' . $label . ' تأیید شد؛ سند ' . $entry->doc_number . ' صادر و ' . count($requests) . ' درخواست پرداخت به خزانه ارسال شد.', array('journal_entries' => array(Akph_Ledger::shape($entry)), 'payment_requests' => array_map(array('Akph_Treasury', 'request_shape'), $requests)));
    }

    public static function reject($period_id, array $body, $version) {
        self::assert_manage();
        $reason = Akph_Input::text($body, 'reason', 1000, true, 'علت برگشت');
        $p = self::period_or_404($period_id);
        Akph_Input::assert_version($p, $version);
        if (!in_array($p->status, array('calculated', 'finance_approved'), true)) {
            throw Akph_Error::conflict('این دوره در انتظار تأیید نیست.', array('status' => $p->status));
        }
        $step = $p->status === 'finance_approved' ? Akph_Flow::SENIOR : Akph_Flow::ACCOUNTANT;
        Akph_Flow::assert_step($step, 0, $p->calculated_by, $p->last_approved_by);
        Akph_Db::update(self::t('payroll_periods'), array('status' => 'draft', 'reject_reason' => $reason, 'last_approved_by' => null, 'history' => Akph_Flow::push_history($p->history, 'returned', $step, $reason), 'version' => (int) $p->version + 1, 'updated_at' => self::now()), array('id' => $p->id));
        Akph_Audit::log('payroll_returned', 'payroll_period', $p->id, (array) $p, array('reason' => $reason), $p->number);
        return self::period_result($p->id, 'دوره ' . $p->number . ' برای اصلاح برگشت داده شد.');
    }

    public static function approval_items($uid) {
        $out = array();
        if (!current_user_can(Akph_Roles::PAYROLL_MANAGE)) {
            return $out;
        }
        foreach ((array) Akph_Db::results('SELECT * FROM ' . self::t('payroll_periods') . " WHERE status IN ('calculated','finance_approved') ORDER BY id DESC LIMIT 50") as $p) {
            $step = $p->status === 'finance_approved' ? Akph_Flow::SENIOR : Akph_Flow::ACCOUNTANT;
            if ((int) $p->calculated_by === (int) $uid || ((int) $p->last_approved_by === (int) $uid && $uid > 0) || !Akph_Flow::can_act($step, 0)) {
                continue;
            }
            $out[] = Akph_Approvals::make_item('payroll', 'حقوق و دستمزد', $p->id, array(
                'doc_number' => $p->number, 'title' => 'حقوق ماه ' . $p->month . '/' . $p->fiscal_year, 'amount' => (int) $p->net_total, 'requester_id' => $p->calculated_by, 'previous_approver_id' => $p->last_approved_by,
                'project_id' => null, 'date' => substr((string) $p->updated_at, 0, 10), 'stage' => 'تأیید ' . $step, 'approver_role' => $step, 'version' => $p->version,
                'approve_path' => '/payroll/periods/' . $p->id . '/approve', 'reject_path' => '/payroll/periods/' . $p->id . '/reject', 'entity_type' => 'payroll_period',
            ));
        }
        return $out;
    }
}
