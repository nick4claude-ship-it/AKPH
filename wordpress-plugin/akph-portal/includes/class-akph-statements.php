<?php
/**
 * Progress statements (0.7.0; reference: CLIENT_STATEMENT_FLOW, SUBCONTRACTOR_STATEMENT_FLOW, computeClientStatementDraft,
 * validateSubcontractorStatement and the posting rules CLIENT_STATEMENT_APPROVED / SUBCONTRACTOR_STATEMENT_APPROVED).
 *
 * Client statement (صورت‌وضعیت کارفرما):
 *   measurement of this period's quantities on the contract's BOQ lines (previous = approved history, read-only;
 *   approved + pending + this period ≤ contract quantity incl. approved amendments) → «اندازه‌گیری و متره»
 *   (PM) → «ارسال به مشاور» (PM) → «تأیید مشاور» (PM, approval) → «تأیید کارفرما» (accountant, approval, with the
 *   employer's approval number and date) → CLIENT_STATEMENT_APPROVED:
 *     Dr receivables 11201 (net) + each deduction account; Cr contract revenue 41101 (before VAT), sales VAT 21202.
 *   Deductions are on the amount before VAT; the advance recovered never exceeds the advance still unrecovered.
 *   Receipts only through the treasury «دریافت» naming the statement (≤ what is still due).
 *
 * Subcontractor statement (صورت‌وضعیت پیمانکار جزء):
 *   «ثبت کارکرد» → «اندازه‌گیری» (PM) → «تأیید کارگاه» (PM) → «تأیید مدیر پروژه» (PM) → «تأیید مالی» (accountant)
 *   → «تأیید مدیر ارشد» → SUBCONTRACTOR_STATEMENT_APPROVED:
 *     Dr subcontractor cost 51301 (gross = Σ quantity × rate, cost center); Cr payable 21102 (net) and each deduction
 *     (retention 21601, insurance 21602, withholding tax 21204, penalty/other 21603, advance 11402)
 *   and an approved treasury payment request for the net amount (paid by someone other than the approver).
 *
 * Separation of duties by user id (Akph_Flow): the creator never approves, nobody approves two consecutive
 * approval steps; preparation steps (measure, send) are done by the project's manager. An approved statement
 * is voided only by the senior manager, only while nothing was received or paid on it: the entry is reversed and
 * the contract's approved amount falls back.
 */
if (!defined('ABSPATH')) {
    exit;
}

final class Akph_Statements {
    /** status => [next status, step role, label, is approval] */
    const CLIENT_FLOW = array(
        'draft' => array('prepared', 'مدیر پروژه', 'اندازه‌گیری و متره کارکرد', false),
        'returned_for_correction' => array('prepared', 'مدیر پروژه', 'اصلاح و اندازه‌گیری مجدد', false),
        'prepared' => array('submitted_to_consultant', 'مدیر پروژه', 'ارسال به مشاور', false),
        'submitted_to_consultant' => array('approved_by_consultant', 'مدیر پروژه', 'تأیید مشاور', true),
        'approved_by_consultant' => array('approved_by_employer', 'حسابدار', 'تأیید کارفرما', true),
    );
    const SUB_FLOW = array(
        'submitted' => array('measured', 'مدیر پروژه', 'اندازه‌گیری کارکرد', false),
        'returned_for_revision' => array('measured', 'مدیر پروژه', 'اندازه‌گیری مجدد', false),
        'measured' => array('site_review', 'مدیر پروژه', 'تأیید کارگاه', true),
        'site_review' => array('pm_approved', 'مدیر پروژه', 'تأیید مدیر پروژه', true),
        'pm_approved' => array('finance_approved', 'حسابدار', 'تأیید مالی', true),
        'finance_approved' => array('management_approved', 'مدیر ارشد', 'تأیید مدیر ارشد', true),
    );
    const EDITABLE = array('draft', 'prepared', 'returned_for_correction', 'submitted', 'returned_for_revision');

    const CLIENT_DEDUCTION_ACCOUNTS = array('advance_payment' => '21301', 'retention' => '11301', 'insurance' => '11302', 'tax' => '11305', 'materials' => '41102', 'other' => '11308');
    const SUB_DEDUCTION_ACCOUNTS = array('advance_payment' => '11402', 'retention' => '21601', 'insurance' => '21602', 'tax' => '21204', 'penalty' => '21603', 'other' => '21603');
    const DEDUCTION_TITLES = array(
        'advance_payment' => 'استهلاک پیش‌پرداخت',
        'retention' => 'سپرده حسن انجام کار',
        'insurance' => 'بیمه مکسوره',
        'tax' => 'مالیات تکلیفی',
        'materials' => 'مصالح تحویلی کارفرما',
        'penalty' => 'جریمه',
        'other' => 'سایر کسورات',
    );

    private static function t($name) {
        return Akph_Schema::table($name);
    }

    public static function flow($kind) {
        return $kind === 'client' ? self::CLIENT_FLOW : self::SUB_FLOW;
    }

    // ------------------------------------------------------------------ computation

    /**
     * Lines and amounts of a statement from the quantities of this period. Returns
     * [lines, work, adjustment, vat_rate, vat, gross, deductions, total, net]. Throws on any rule.
     */
    private static function compute($c, array $qty_by_line, $include_vat, $index, $fixed, $exclude_statement = 0) {
        $lines = Akph_Contracts::lines($c->id);
        $measured = Akph_Contracts::measured($c->id, $exclude_statement);
        $rows = array();
        $work = 0;
        foreach ($qty_by_line as $lid => $qty) {
            if (!isset($lines[$lid])) {
                throw Akph_Error::invalid('ردیف ' . $lid . ' متعلق به قرارداد ' . $c->number . ' نیست.', array('field' => 'lines'));
            }
            $l = $lines[$lid];
            $m = isset($measured[$lid]) ? $measured[$lid] : array('approved' => 0, 'pending' => 0);
            if ($m['approved'] + $m['pending'] + $qty > $l['quantity']) {
                throw Akph_Error::rule('جمع مقدار «' . $l['row']->description . '» (قبلی ' . Akph_Qty::to_string($m['approved']) . ' + در جریان ' . Akph_Qty::to_string($m['pending']) . ' + این دوره ' . Akph_Qty::to_string($qty) . ') از مقدار قرارداد و الحاقیه‌ها (' . Akph_Qty::to_string($l['quantity']) . ') بیشتر است.', array('field' => 'lines', 'contract_line_id' => (string) $lid));
            }
            $amount = Akph_Qty::amount($qty, $l['row']->rate);
            $rows[] = array('contract_line_id' => $lid, 'previous' => $m['approved'], 'quantity' => $qty, 'rate' => (int) $l['row']->rate, 'amount' => $amount);
            $work += $amount;
        }
        if ($work <= 0) {
            throw Akph_Error::invalid('کارکرد این دوره صفر است؛ مقدار حداقل یک ردیف را وارد کنید.', array('field' => 'lines'));
        }
        $adjustment = 0;
        if ($index !== null) {
            if ($c->adjustment_base_index === null) {
                throw Akph_Error::rule('برای این قرارداد شاخص مبنای تعدیل تعریف نشده است.', array('field' => 'adjustment_index'));
            }
            $base_index = (float) $c->adjustment_base_index;
            $ratio = ((float) $index - $base_index) / $base_index;
            // Adjustment = work × (index ÷ base index − 1) × factor; a falling index gives no negative adjustment here.
            $adjustment = $ratio > 0 ? (int) round($work * $ratio * ((int) $c->adjustment_factor_bp / 10000)) : 0;
        }
        $base = $work + $adjustment;
        $vat_rate = $include_vat && $c->kind === 'client' ? (int) Akph_Treasury::settings()['vat_rate_percent'] : 0;
        $vat = Akph_Qty::of_bp($base, $vat_rate * 100);
        $gross = $base + $vat;
        $figures = Akph_Contracts::figures($c);
        $remaining_advance = max(0, $figures['advance_amount'] - (isset($figures['deductions']['advance_payment']) ? $figures['deductions']['advance_payment'] : 0) - Akph_Contracts::pending_amortization($c->id, $exclude_statement));
        $ded = array();
        $add = function ($type, $bp, $amount) use (&$ded) {
            if ($amount > 0) {
                $ded[] = array('type' => $type, 'title' => self::DEDUCTION_TITLES[$type], 'rate' => Akph_Qty::bp_string($bp), 'amount' => $amount);
            }
        };
        $add('advance_payment', $c->advance_bp, min(Akph_Qty::of_bp($base, $c->advance_bp), $remaining_advance));
        $add('retention', $c->retention_bp, Akph_Qty::of_bp($base, $c->retention_bp));
        $add('insurance', $c->insurance_bp, Akph_Qty::of_bp($base, $c->insurance_bp));
        $add('tax', $c->tax_bp, Akph_Qty::of_bp($base, $c->tax_bp));
        $add('other', $c->other_bp, Akph_Qty::of_bp($base, $c->other_bp));
        $add($c->kind === 'client' ? 'materials' : 'penalty', 0, $fixed);
        $total = 0;
        foreach ($ded as $d) {
            $total += $d['amount'];
        }
        if ($total > $gross) {
            throw Akph_Error::rule('جمع کسورات (' . number_format($total) . ' ریال) از مبلغ ناخالص (' . number_format($gross) . ' ریال) بیشتر است.', array('field' => 'fixed_deduction'));
        }
        return array('lines' => $rows, 'work' => $work, 'adjustment' => $adjustment, 'vat_rate' => $vat_rate, 'vat' => $vat, 'gross' => $gross, 'deductions' => $ded, 'total' => $total, 'net' => $gross - $total);
    }

    /** Body lines [{contract_line_id, quantity}] → line id => thousandths (zero quantities dropped). */
    private static function parse_quantities($body) {
        if (!isset($body['lines']) || !is_array($body['lines']) || !$body['lines']) {
            throw Akph_Error::invalid('مقادیر این دوره را برای ردیف‌های قرارداد وارد کنید.', array('field' => 'lines'));
        }
        $out = array();
        foreach (array_values($body['lines']) as $i => $l) {
            if (!is_array($l)) {
                throw Akph_Error::invalid('ردیف ' . ($i + 1) . ' نامعتبر است.', array('field' => 'lines'));
            }
            foreach (array_keys($l) as $k) {
                if (!in_array($k, array('contract_line_id', 'quantity'), true)) {
                    // previous quantities, rates and amounts are the server's; they are never accepted.
                    throw new Akph_Error('akph_unknown_field', 'فیلد ناشناخته در ردیف: ' . $k . ' (مقدار قبلی، نرخ و مبلغ را سرور تعیین می‌کند).', 400, array('field' => 'lines'));
                }
            }
            $lid = Akph_Input::id($l, 'contract_line_id', false);
            if (isset($out[$lid])) {
                throw Akph_Error::invalid('ردیف ' . $lid . ' تکراری است.', array('field' => 'lines'));
            }
            $q = Akph_Qty::parse(isset($l['quantity']) ? $l['quantity'] : null, 'lines', 'مقدار این دوره ردیف ' . ($i + 1));
            if ($q > 0) {
                $out[$lid] = $q;
            }
        }
        return $out;
    }

    private static function parse_index($body) {
        if (!isset($body['adjustment_index']) || $body['adjustment_index'] === '' || $body['adjustment_index'] === null) {
            return null;
        }
        $v = is_int($body['adjustment_index']) || is_float($body['adjustment_index']) ? (string) $body['adjustment_index'] : $body['adjustment_index'];
        if (!is_string($v) || !preg_match('/^[0-9]{1,9}(\.[0-9]{1,2})?$/D', $v) || (float) $v <= 0) {
            throw Akph_Error::invalid('شاخص دوره باید عدد مثبت با حداکثر دو رقم اعشار باشد.', array('field' => 'adjustment_index'));
        }
        return $v;
    }

    // ------------------------------------------------------------------ reads

    public static function shape($s) {
        global $wpdb;
        $c = Akph_Db::find(self::t('contracts'), $s->contract_id);
        $contract_lines = Akph_Contracts::lines($s->contract_id);
        $lines = array();
        foreach ((array) Akph_Db::results($wpdb->prepare('SELECT * FROM ' . self::t('statement_lines') . ' WHERE statement_id = %d ORDER BY id', $s->id)) as $l) {
            $cl = isset($contract_lines[(int) $l->contract_line_id]) ? $contract_lines[(int) $l->contract_line_id] : null;
            $prev = Akph_Qty::from_db($l->previous_quantity);
            $qty = Akph_Qty::from_db($l->quantity);
            $lines[] = array(
                'id' => (string) $l->id,
                'contract_line_id' => (string) $l->contract_line_id,
                'row_no' => $cl ? (int) $cl['row']->row_no : 0,
                'code' => $cl ? $cl['row']->code : '',
                'description' => $cl ? $cl['row']->description : '',
                'unit' => $cl ? $cl['row']->unit : '',
                'contract_quantity' => $cl ? Akph_Qty::to_string($cl['quantity']) : '0',
                'previous_quantity' => Akph_Qty::to_string($prev),
                'quantity' => Akph_Qty::to_string($qty),
                'cumulative_quantity' => Akph_Qty::to_string($prev + $qty),
                'rate' => (int) $l->rate,
                'amount' => (int) $l->amount,
                'cumulative_amount' => Akph_Qty::amount($prev + $qty, $l->rate),
            );
        }
        $flow = self::flow($s->kind);
        $step = isset($flow[$s->status]) ? $flow[$s->status] : null;
        $received = 0;
        $pending_receipts = 0;
        $request = null;
        if ($s->kind === 'client') {
            $received = (int) Akph_Db::value($wpdb->prepare('SELECT COALESCE(SUM(amount), 0) FROM ' . self::t('receipts') . " WHERE statement_id = %d AND status = 'approved'", $s->id));
            $pending_receipts = (int) Akph_Db::value($wpdb->prepare('SELECT COALESCE(SUM(amount), 0) FROM ' . self::t('receipts') . " WHERE statement_id = %d AND status = 'pending'", $s->id));
        } elseif ($s->payment_request_id) {
            $pr = Akph_Db::find(self::t('payment_requests'), $s->payment_request_id);
            if ($pr) {
                $received = (int) $pr->paid_amount;
                $request = array('id' => (string) $pr->id, 'number' => $pr->number, 'status' => $pr->status, 'amount' => (int) $pr->amount, 'paid_amount' => (int) $pr->paid_amount);
            }
        }
        $approved = in_array($s->status, Akph_Contracts::APPROVED, true);
        $party = Akph_Db::find(self::t('counterparties'), $s->counterparty_id);
        $project = Akph_Db::find(self::t('projects'), $s->project_id);
        return array(
            'id' => (string) $s->id,
            'number' => $s->number,
            'kind' => $s->kind,
            'title' => $s->title,
            'contract_id' => (string) $s->contract_id,
            'contract_number' => $c ? $c->number : '',
            'contract_no' => $c ? $c->contract_no : '',
            'contract_title' => $c ? $c->title : '',
            'project_id' => (string) $s->project_id,
            'project_name' => $project ? $project->name : '',
            'cost_center_id' => $s->cost_center_id ? (string) $s->cost_center_id : null,
            'counterparty_id' => (string) $s->counterparty_id,
            'counterparty_name' => $party ? $party->name : '',
            'trade_type' => $c ? $c->trade_type : '',
            'period_start' => $s->period_start,
            'period_end' => $s->period_end,
            'status' => $s->status,
            'current_step' => $step ? array('label' => $step[2], 'role' => $step[1], 'approval' => $step[3], 'next_status' => $step[0], 'requires' => $s->kind === 'client' && $step[0] === 'approved_by_employer' ? array('employer_ref', 'employer_date') : array()) : null,
            'include_vat' => (bool) (int) $s->include_vat,
            'lines' => $lines,
            'work_amount' => (int) $s->work_amount,
            'adjustment_index' => $s->adjustment_index !== null ? rtrim(rtrim((string) $s->adjustment_index, '0'), '.') : null,
            'adjustment_amount' => (int) $s->adjustment_amount,
            'vat_rate' => (int) $s->vat_rate,
            'vat_amount' => (int) $s->vat_amount,
            'gross_amount' => (int) $s->gross_amount,
            'fixed_deduction' => (int) $s->fixed_deduction,
            'deductions' => array_values((array) json_decode((string) $s->deductions, true)),
            'total_deductions' => (int) $s->total_deductions,
            'net_amount' => (int) $s->net_amount,
            'settled_amount' => $received,
            'pending_receipts' => $pending_receipts,
            'balance_due' => $approved ? max(0, (int) $s->net_amount - $received) : 0,
            'payment_request' => $request,
            'employer_ref' => $s->employer_ref,
            'employer_date' => $s->employer_date,
            'description' => $s->description,
            'history' => Akph_Flow::history($s->history),
            'created_by' => (string) $s->created_by,
            'created_by_name' => Akph_Flow::user_name($s->created_by),
            'last_approved_by' => $s->last_approved_by ? (string) $s->last_approved_by : null,
            'reject_reason' => $s->reject_reason,
            'entry' => Akph_Posting::entry_ref($s->entry_id),
            'void_entry' => Akph_Posting::entry_ref($s->void_entry_id),
            'approved_at' => Akph_Db::iso_time($s->approved_at),
            'created_at' => Akph_Db::iso_time($s->created_at),
            'version' => (int) $s->version,
        );
    }

    public static function list_statements($kind = '') {
        global $wpdb;
        $scope = Akph_Auth::project_scope_sql('project_id');
        $where = $kind !== '' ? $wpdb->prepare(' AND kind = %s', $kind) : '';
        $rows = Akph_Db::results('SELECT * FROM ' . self::t('statements') . " WHERE {$scope}{$where} ORDER BY id DESC LIMIT 1000");
        return array_map(array(__CLASS__, 'shape'), (array) $rows);
    }

    public static function statement_or_404($id, $lock = false) {
        $row = $lock ? Akph_Db::lock(self::t('statements'), $id) : Akph_Db::find(self::t('statements'), $id);
        if (!$row || !Akph_Auth::can_access_project($row->project_id)) {
            throw Akph_Error::not_found('صورت‌وضعیت پیدا نشد.');
        }
        return $row;
    }

    // ------------------------------------------------------------------ create / update

    private static function assert_prepare($project_id) {
        Akph_Auth::assert_cap(Akph_Roles::STATEMENTS_PREPARE, 'تهیه صورت‌وضعیت با مدیر پروژه (یا مدیر ارشد و مدیر سیستم) است.');
        if (!Akph_Flow::can_act(Akph_Flow::PM, $project_id)) {
            throw Akph_Error::forbidden('تهیه صورت‌وضعیت این پروژه با مدیر پروژه آن است.');
        }
    }

    private static function prefix($kind) {
        return $kind === 'client' ? 'STC' : 'STS';
    }

    private static function write_lines($statement_id, array $rows) {
        global $wpdb;
        Akph_Db::exec($wpdb->prepare('DELETE FROM ' . self::t('statement_lines') . ' WHERE statement_id = %d', $statement_id));
        foreach ($rows as $r) {
            Akph_Db::insert(self::t('statement_lines'), array(
                'statement_id' => $statement_id,
                'contract_line_id' => $r['contract_line_id'],
                'previous_quantity' => Akph_Qty::to_string($r['previous']),
                'quantity' => Akph_Qty::to_string($r['quantity']),
                'rate' => $r['rate'],
                'amount' => $r['amount'],
            ));
        }
    }

    private static function amount_columns(array $x) {
        return array(
            'work_amount' => $x['work'],
            'adjustment_amount' => $x['adjustment'],
            'vat_rate' => $x['vat_rate'],
            'vat_amount' => $x['vat'],
            'gross_amount' => $x['gross'],
            'deductions' => wp_json_encode($x['deductions']),
            'total_deductions' => $x['total'],
            'net_amount' => $x['net'],
        );
    }

    private static function period($body) {
        $start = Akph_Input::iso_date($body, 'period_start', true);
        $end = Akph_Input::iso_date($body, 'period_end', true);
        if ($end < $start) {
            throw Akph_Error::invalid('پایان دوره قبل از شروع آن است.', array('field' => 'period_end'));
        }
        return array($start, $end);
    }

    public static function create($kind, array $body) {
        $year = Akph_Jalali::fiscal_year(Akph_Jalali::today_iso());
        Akph_Numbering::lock(self::prefix($kind), $year);
        $c = Akph_Contracts::active_or_fail(Akph_Input::id($body, 'contract_id', false));
        if ($c->kind !== $kind) {
            throw Akph_Error::invalid($kind === 'client' ? 'این قرارداد، قرارداد کارفرما نیست.' : 'این قرارداد، قرارداد پیمانکار جزء نیست.', array('field' => 'contract_id'));
        }
        self::assert_prepare($c->project_id);
        list($start, $end) = self::period($body);
        $index = self::parse_index($body);
        $fixed = Akph_Input::amount($body, 'fixed_deduction', 'کسر ثابت');
        $include_vat = $kind === 'client' ? Akph_Input::bool($body, 'include_vat', true) : false;
        $x = self::compute($c, self::parse_quantities($body), $include_vat, $index, $fixed);
        $status = $kind === 'client' ? (!empty($body['submit']) ? 'submitted_to_consultant' : 'draft') : 'submitted';
        $now = Akph_Db::now_utc();
        $history = Akph_Flow::push_history('[]', 'submitted', $kind === 'client' ? ($status === 'draft' ? 'ثبت پیش‌نویس' : 'ثبت و ارسال به مشاور') : 'ثبت کارکرد', '', $kind === 'client' ? 'draft' : 'submitted', $status);
        $id = Akph_Db::insert(self::t('statements'), self::amount_columns($x) + array(
            'kind' => $kind,
            'title' => Akph_Input::text($body, 'title', 190, true, 'عنوان صورت‌وضعیت'),
            'contract_id' => $c->id,
            'project_id' => $c->project_id,
            'cost_center_id' => $c->cost_center_id,
            'counterparty_id' => $c->counterparty_id,
            'period_start' => $start,
            'period_end' => $end,
            'status' => $status,
            'include_vat' => $include_vat ? 1 : 0,
            'adjustment_index' => $index,
            'fixed_deduction' => $fixed,
            'description' => Akph_Input::text($body, 'description', 1000),
            'history' => $history,
            'created_by' => get_current_user_id(),
            'version' => 1,
            'created_at' => $now,
            'updated_at' => $now,
        ));
        self::write_lines($id, $x['lines']);
        $number = Akph_Numbering::issue(self::prefix($kind), $year, 'statement', $id);
        Akph_Db::update(self::t('statements'), array('number' => $number), array('id' => $id));
        $row = Akph_Db::find(self::t('statements'), $id);
        Akph_Audit::log('statement_created', 'statement', $id, null, (array) $row, $number);
        return array('status' => 201, 'message' => 'صورت‌وضعیت ' . $number . ' به مبلغ ناخالص ' . number_format($x['gross']) . ' ریال ثبت شد.', 'id' => $id, 'doc_number' => $number, 'records' => self::records($row));
    }

    /** Re-measurement of a statement that is not in an approval step yet (draft, returned). */
    public static function update($id, array $body, $version) {
        $peek = self::statement_or_404($id);
        $c = Akph_Contracts::active_or_fail($peek->contract_id);
        $s = self::statement_or_404($id, true);
        Akph_Input::assert_version($s, $version);
        if (!in_array($s->status, self::EDITABLE, true)) {
            throw Akph_Error::rule('صورت‌وضعیتی که در مرحله تأیید است ویرایش نمی‌شود؛ ابتدا آن را برگشت دهید.', array('status' => $s->status));
        }
        self::assert_prepare($s->project_id);
        list($start, $end) = self::period($body);
        $index = self::parse_index($body);
        $fixed = Akph_Input::amount($body, 'fixed_deduction', 'کسر ثابت');
        $include_vat = $s->kind === 'client' ? Akph_Input::bool($body, 'include_vat', true) : false;
        $x = self::compute($c, self::parse_quantities($body), $include_vat, $index, $fixed, $s->id);
        self::write_lines($s->id, $x['lines']);
        Akph_Db::update(self::t('statements'), self::amount_columns($x) + array(
            'title' => Akph_Input::text($body, 'title', 190, true, 'عنوان صورت‌وضعیت'),
            'period_start' => $start,
            'period_end' => $end,
            'include_vat' => $include_vat ? 1 : 0,
            'adjustment_index' => $index,
            'fixed_deduction' => $fixed,
            'description' => Akph_Input::text($body, 'description', 1000),
            'history' => Akph_Flow::push_history($s->history, 'edited', 'اصلاح مقادیر', '', $s->status, $s->status),
            'version' => (int) $s->version + 1,
            'updated_at' => Akph_Db::now_utc(),
        ), array('id' => $s->id));
        $after = Akph_Db::find(self::t('statements'), $s->id);
        Akph_Audit::log('statement_updated', 'statement', $s->id, (array) $s, (array) $after, $s->number);
        return array('message' => 'مقادیر صورت‌وضعیت ' . $s->number . ' اصلاح شد.', 'id' => $s->id, 'records' => self::records($after));
    }

    private static function records($s, array $extra = array()) {
        return array_merge(array(
            'statements' => array(self::shape($s)),
            'contracts' => array(Akph_Contracts::shape(Akph_Db::find(self::t('contracts'), $s->contract_id))),
        ), $extra);
    }

    // ------------------------------------------------------------------ flow

    public static function advance($id, array $body, $version) {
        $comment = Akph_Input::text($body, 'comment', 1000);
        $today = Akph_Jalali::today_iso();
        $peek = self::statement_or_404($id);
        $flow = self::flow($peek->kind);
        $final = isset($flow[$peek->status]) && in_array($flow[$peek->status][0], Akph_Contracts::APPROVED, true);
        if ($final) {
            Akph_Posting::lock_year($today);
            if ($peek->kind === 'subcontract') {
                Akph_Numbering::lock('PAY', Akph_Jalali::fiscal_year($today));
            }
        }
        $c = Akph_Contracts::contract_or_404($peek->contract_id, true);
        $s = self::statement_or_404($id, true);
        Akph_Input::assert_version($s, $version);
        if (!isset($flow[$s->status])) {
            throw Akph_Error::conflict('این صورت‌وضعیت مرحله تأیید بعدی ندارد.', array('status' => $s->status));
        }
        list($next, $role, $label, $approval) = $flow[$s->status];
        if ($approval) {
            Akph_Auth::assert_cap(Akph_Roles::CONTRACTS_APPROVE, 'اجازه تأیید صورت‌وضعیت را ندارید.');
            Akph_Flow::assert_step($role, $s->project_id, $s->created_by, $s->last_approved_by);
        } else {
            self::assert_prepare($s->project_id);
        }
        $data = array(
            'status' => $next,
            'history' => Akph_Flow::push_history($s->history, $approval ? 'approved' : 'step', $label, $comment, $s->status, $next),
            'version' => (int) $s->version + 1,
            'updated_at' => Akph_Db::now_utc(),
        );
        if ($approval) {
            $data['last_approved_by'] = get_current_user_id();
        }
        $extra = array();
        $message = '«' . $label . '» ثبت شد.';
        if (in_array($next, Akph_Contracts::APPROVED, true)) {
            if ($c->status !== 'active') {
                throw Akph_Error::rule('قرارداد ' . $c->number . ' فعال نیست.', array('status' => $c->status));
            }
            if ($s->kind === 'client') {
                $data['employer_ref'] = Akph_Input::text($body, 'employer_ref', 64, true, 'شماره تأیید کارفرما');
                $data['employer_date'] = Akph_Input::iso_date($body, 'employer_date', true);
                if ($data['employer_date'] > $today) {
                    throw Akph_Error::invalid('تاریخ تأیید کارفرما بعد از امروز است.', array('field' => 'employer_date'));
                }
            }
            $posted = self::post_approval($c, $s, $today);
            $data['entry_id'] = $posted['entry']->id;
            $data['approved_at'] = Akph_Db::now_utc();
            $extra['journal_entries'] = array(Akph_Ledger::shape($posted['entry']));
            $message = '«' . $label . '» ثبت شد و سند ' . $posted['entry']->doc_number . ' صادر شد.';
            if ($s->kind === 'subcontract' && (int) $s->net_amount > 0) {
                $request = self::payment_request($c, $s);
                $data['payment_request_id'] = $request->id;
                $extra['payment_requests'] = array(Akph_Treasury::request_shape($request));
                $message .= ' درخواست پرداخت ' . $request->number . ' به خزانه رفت.';
            }
            $extra['doc_number'] = $posted['entry']->doc_number;
        }
        Akph_Db::update(self::t('statements'), $data, array('id' => $s->id));
        $after = Akph_Db::find(self::t('statements'), $s->id);
        Akph_Audit::log($approval ? 'statement_approved' : 'statement_step', 'statement', $s->id, (array) $s, (array) $after, $s->number);
        $doc = isset($extra['doc_number']) ? $extra['doc_number'] : null;
        unset($extra['doc_number']);
        $out = array('message' => $message, 'id' => $s->id, 'records' => self::records($after, $extra));
        if ($doc) {
            $out['doc_number'] = $doc;
        }
        return $out;
    }

    /** Final approval: quantities are checked again against the approved history, then the event is posted. */
    private static function post_approval($c, $s, $date) {
        global $wpdb;
        $lines = Akph_Contracts::lines($c->id);
        $measured = Akph_Contracts::measured($c->id, $s->id);
        foreach ((array) Akph_Db::results($wpdb->prepare('SELECT * FROM ' . self::t('statement_lines') . ' WHERE statement_id = %d', $s->id)) as $l) {
            $lid = (int) $l->contract_line_id;
            $approved = isset($measured[$lid]) ? $measured[$lid]['approved'] : 0;
            $qty = Akph_Qty::from_db($l->quantity);
            if (!isset($lines[$lid]) || $approved + $qty > $lines[$lid]['quantity']) {
                throw Akph_Error::rule('مقدار تأییدشده ردیف ' . $lid . ' از مقدار قرارداد بیشتر می‌شود؛ صورت‌وضعیت را برگشت و اصلاح کنید.', array('field' => 'lines'));
            }
            // «مقدار قبلی» of the approved statement is the approved history at the moment of approval.
            Akph_Db::update(self::t('statement_lines'), array('previous_quantity' => Akph_Qty::to_string($approved)), array('id' => $l->id));
        }
        $deductions = (array) json_decode((string) $s->deductions, true);
        $figures = Akph_Contracts::figures($c);
        $taken = isset($figures['deductions']['advance_payment']) ? $figures['deductions']['advance_payment'] : 0;
        foreach ($deductions as $d) {
            if ($d['type'] === 'advance_payment' && (int) $d['amount'] > max(0, $figures['advance_amount'] - $taken)) {
                throw Akph_Error::rule('استهلاک پیش‌پرداخت از مانده پیش‌پرداخت قرارداد بیشتر است؛ صورت‌وضعیت را برگشت و اصلاح کنید.', array('field' => 'deductions'));
            }
        }
        $party = Akph_Db::find(self::t('counterparties'), $s->counterparty_id);
        $who = $party ? $party->name : '';
        $ref = $s->number . ' (' . $s->title . ')';
        $tags = array('project_id' => $s->project_id, 'cost_center_id' => $s->cost_center_id, 'counterparty_id' => $s->counterparty_id);
        $lines_out = array();
        if ($s->kind === 'client') {
            if ((int) $s->net_amount > 0) {
                $lines_out[] = $tags + array('code' => '11201', 'label' => 'مطالبات از کارفرما', 'debit' => (int) $s->net_amount, 'description' => 'خالص مطالبات صورت‌وضعیت ' . $ref);
            }
            foreach ($deductions as $d) {
                $lines_out[] = $tags + array('code' => self::CLIENT_DEDUCTION_ACCOUNTS[$d['type']], 'label' => $d['title'], 'debit' => (int) $d['amount'], 'description' => $d['title'] . ' صورت‌وضعیت ' . $ref);
            }
            $lines_out[] = $tags + array('code' => '41101', 'label' => 'درآمد پیمان', 'credit' => (int) $s->gross_amount - (int) $s->vat_amount, 'description' => 'درآمد کارکرد مصوب صورت‌وضعیت ' . $ref);
            if ((int) $s->vat_amount > 0) {
                $lines_out[] = $tags + array('code' => '21202', 'label' => 'ارزش افزوده فروش', 'credit' => (int) $s->vat_amount, 'description' => 'ارزش افزوده صورت‌وضعیت ' . $ref);
            }
            $type = 'CLIENT_STATEMENT_APPROVED';
            $desc = 'شناسایی درآمد صورت‌وضعیت ' . $ref . ' - ' . $who;
        } else {
            $lines_out[] = $tags + array('code' => '51301', 'label' => 'هزینه پیمانکاران جزء', 'debit' => (int) $s->gross_amount, 'description' => 'کارکرد تأییدشده ' . $who . ' - ' . $ref);
            if ((int) $s->net_amount > 0) {
                $lines_out[] = $tags + array('code' => '21102', 'label' => 'پرداختنی پیمانکاران', 'credit' => (int) $s->net_amount, 'description' => 'خالص قابل پرداخت به ' . $who . ' - ' . $ref);
            }
            foreach ($deductions as $d) {
                $lines_out[] = $tags + array('code' => self::SUB_DEDUCTION_ACCOUNTS[$d['type']], 'label' => $d['title'], 'credit' => (int) $d['amount'], 'description' => $d['title'] . ' ' . $who . ' - ' . $ref);
            }
            $type = 'SUBCONTRACTOR_STATEMENT_APPROVED';
            $desc = 'تأیید صورت‌وضعیت پیمانکار جزء ' . $ref . ' - ' . $who;
        }
        return Akph_Posting::post(array('source' => 'statement', 'source_id' => $s->id, 'type' => $type, 'date' => $date, 'description' => $desc, 'entry_type' => 'statement', 'project_id' => $s->project_id, 'lines' => $lines_out));
    }

    /** Payment request of an approved subcontractor statement, approved by the final approver. */
    private static function payment_request($c, $s) {
        $party = Akph_Db::find(self::t('counterparties'), $s->counterparty_id);
        return Akph_Treasury::create_request_internal(array(
            'source_type' => 'sub_statement',
            'source_id' => $s->id,
            'payable_type' => 'subcontractor',
            'debit_account_code' => Akph_Treasury::PAYABLE_ACCOUNTS['subcontractor'],
            'project_id' => $s->project_id,
            'cost_center_id' => $s->cost_center_id,
            'counterparty_id' => $s->counterparty_id,
            'beneficiary_name' => $party ? $party->name : $c->title,
            'beneficiary_type' => 'پیمانکار جزء',
            'beneficiary_sheba' => $party ? (string) $party->sheba : '',
            'amount' => (int) $s->net_amount,
            'description' => 'خالص صورت‌وضعیت ' . $s->number . ' قرارداد ' . $c->number,
            'requested_by' => (int) $s->created_by,
            'approved_by' => get_current_user_id(),
        ));
    }

    /** Back to the preparer (client: «برگشت جهت اصلاح», subcontractor: «برگشت جهت اصلاح متره»), or rejected. */
    public static function send_back($id, array $body, $version, $reject) {
        $reason = Akph_Input::text($body, 'reason', 1000, true, $reject ? 'علت رد' : 'علت برگشت');
        $s = self::statement_or_404($id, true);
        Akph_Input::assert_version($s, $version);
        $flow = self::flow($s->kind);
        if (!isset($flow[$s->status]) || in_array($s->status, array('draft', 'returned_for_correction', 'returned_for_revision'), true) && !$reject) {
            throw Akph_Error::conflict('این صورت‌وضعیت در مرحله‌ای نیست که برگشت داده شود.', array('status' => $s->status));
        }
        $role = $flow[$s->status][1];
        if (!Akph_Flow::can_act($role, $s->project_id)) {
            throw Akph_Error::forbidden('این مرحله («' . $role . '») با نقش شما نیست.');
        }
        $to = $reject ? 'rejected' : ($s->kind === 'client' ? 'returned_for_correction' : 'returned_for_revision');
        Akph_Db::update(self::t('statements'), array(
            'status' => $to,
            'reject_reason' => $reason,
            'last_approved_by' => null,
            'history' => Akph_Flow::push_history($s->history, $reject ? 'rejected' : 'returned', $flow[$s->status][2], $reason, $s->status, $to),
            'version' => (int) $s->version + 1,
            'updated_at' => Akph_Db::now_utc(),
        ), array('id' => $s->id));
        $after = Akph_Db::find(self::t('statements'), $s->id);
        Akph_Audit::log($reject ? 'statement_rejected' : 'statement_returned', 'statement', $s->id, (array) $s, (array) $after, $s->number);
        return array('message' => 'صورت‌وضعیت ' . $s->number . ($reject ? ' رد شد.' : ' برای اصلاح برگشت داده شد.'), 'id' => $s->id, 'records' => self::records($after));
    }

    /**
     * Voiding an approved statement (senior manager / system administrator, with a reason): only while nothing
     * was received (client) or paid (subcontractor) on it. The entry is reversed by a new entry, the payment
     * request of a subcontractor statement is rejected, and the contract's approved amount falls back.
     */
    public static function void($id, array $body, $version) {
        if (!Akph_Flow::is_senior_or_admin()) {
            throw Akph_Error::forbidden('ابطال صورت‌وضعیت تأییدشده فقط با مدیر ارشد یا مدیر سیستم است.');
        }
        $reason = Akph_Input::text($body, 'reason', 1000, true, 'علت ابطال');
        $today = Akph_Jalali::today_iso();
        Akph_Posting::lock_year($today);
        $peek = self::statement_or_404($id);
        Akph_Contracts::contract_or_404($peek->contract_id, true);
        $s = self::statement_or_404($id, true);
        Akph_Input::assert_version($s, $version);
        if (!in_array($s->status, Akph_Contracts::APPROVED, true) || !$s->entry_id) {
            throw Akph_Error::conflict('فقط صورت‌وضعیت تأییدشده ابطال می‌شود؛ پیش از تأیید از «برگشت» یا «رد» استفاده کنید.', array('status' => $s->status));
        }
        global $wpdb;
        $extra = array();
        if ($s->kind === 'client') {
            $n = (int) Akph_Db::value($wpdb->prepare('SELECT COUNT(*) FROM ' . self::t('receipts') . " WHERE statement_id = %d AND status IN ('pending','approved')", $s->id));
            if ($n > 0) {
                throw Akph_Error::rule('برای این صورت‌وضعیت دریافت ثبت شده است؛ ابطال ممکن نیست.', array('receipts' => $n));
            }
        } elseif ($s->payment_request_id) {
            $pr = Akph_Db::lock(self::t('payment_requests'), $s->payment_request_id);
            if ($pr && (int) $pr->paid_amount > 0) {
                throw Akph_Error::rule('بخشی از خالص این صورت‌وضعیت پرداخت شده است؛ ابطال ممکن نیست.', array('paid' => (int) $pr->paid_amount));
            }
            if ($pr && $pr->status !== 'rejected') {
                Akph_Db::update(self::t('payment_requests'), array('status' => 'rejected', 'reject_reason' => 'ابطال صورت‌وضعیت ' . $s->number . ': ' . $reason, 'version' => (int) $pr->version + 1, 'updated_at' => Akph_Db::now_utc()), array('id' => $pr->id));
                Akph_Audit::log('payment_request_rejected', 'payment_request', $pr->id, (array) $pr, array('status' => 'rejected'), $pr->number);
                $extra['payment_requests'] = array(Akph_Treasury::request_shape(Akph_Db::find(self::t('payment_requests'), $pr->id)));
            }
        }
        $lines = array();
        foreach ((array) Akph_Db::results($wpdb->prepare('SELECT * FROM ' . Akph_Ledger::lines_table() . ' WHERE entry_id = %d ORDER BY line_no', $s->entry_id)) as $l) {
            $lines[] = array('code' => $l->account_code, 'debit' => (int) $l->credit, 'credit' => (int) $l->debit, 'project_id' => $l->project_id, 'cost_center_id' => $l->cost_center_id, 'counterparty_id' => $l->counterparty_id, 'description' => 'ابطال: ' . $l->description);
        }
        $original = Akph_Db::find(Akph_Ledger::entries_table(), $s->entry_id);
        $posted = Akph_Posting::post(array('source' => 'statement', 'source_id' => $s->id, 'type' => 'STATEMENT_VOIDED', 'date' => $today, 'description' => 'ابطال صورت‌وضعیت ' . $s->number . ' (سند ' . ($original ? $original->doc_number : '') . '): ' . $reason, 'entry_type' => 'statement', 'project_id' => $s->project_id, 'lines' => $lines));
        Akph_Db::update(self::t('statements'), array('status' => 'voided', 'reject_reason' => $reason, 'void_entry_id' => $posted['entry']->id, 'history' => Akph_Flow::push_history($s->history, 'voided', 'ابطال', $reason, $s->status, 'voided'), 'version' => (int) $s->version + 1, 'updated_at' => Akph_Db::now_utc()), array('id' => $s->id));
        $after = Akph_Db::find(self::t('statements'), $s->id);
        Akph_Audit::log('statement_voided', 'statement', $s->id, (array) $s, (array) $after, $s->number);
        $extra['journal_entries'] = array(Akph_Ledger::shape($posted['entry']));
        return array('message' => 'صورت‌وضعیت ' . $s->number . ' ابطال شد و سند برگشتی ' . $posted['entry']->doc_number . ' صادر شد.', 'id' => $s->id, 'doc_number' => $posted['entry']->doc_number, 'records' => self::records($after, $extra));
    }

    /** Client statement a receipt may settle: approved, of the right project, with enough left to receive. */
    public static function assert_receivable($statement_id, $amount, $exclude_receipt = 0) {
        global $wpdb;
        $s = Akph_Db::lock(self::t('statements'), $statement_id);
        if (!$s || $s->kind !== 'client' || !Akph_Auth::can_access_project($s->project_id)) {
            throw Akph_Error::invalid('صورت‌وضعیت کارفرما پیدا نشد.', array('field' => 'statement_id'));
        }
        if (!in_array($s->status, array('approved_by_employer', 'partially_paid'), true)) {
            throw Akph_Error::rule('فقط صورت‌وضعیت تأییدشده کارفرما که کاملاً وصول نشده قابل دریافت است.', array('field' => 'statement_id'));
        }
        $taken = (int) Akph_Db::value($wpdb->prepare('SELECT COALESCE(SUM(amount), 0) FROM ' . self::t('receipts') . " WHERE statement_id = %d AND status IN ('pending','approved') AND id <> %d", $s->id, (int) $exclude_receipt));
        $left = (int) $s->net_amount - $taken;
        if ($amount > $left) {
            throw Akph_Error::rule('مبلغ دریافت (' . number_format($amount) . ' ریال) از مانده مطالبات صورت‌وضعیت ' . $s->number . ' (' . number_format(max(0, $left)) . ' ریال) بیشتر است.', array('field' => 'amount', 'remaining' => max(0, $left)));
        }
        return $s;
    }

    /** After a receipt on a statement is approved: «وصول بخشی» or «وصول کامل». */
    public static function on_receipt($statement_id) {
        global $wpdb;
        $s = Akph_Db::find(self::t('statements'), $statement_id);
        if (!$s || !in_array($s->status, array('approved_by_employer', 'partially_paid'), true)) {
            return null;
        }
        $received = (int) Akph_Db::value($wpdb->prepare('SELECT COALESCE(SUM(amount), 0) FROM ' . self::t('receipts') . " WHERE statement_id = %d AND status = 'approved'", $s->id));
        $status = $received >= (int) $s->net_amount ? 'paid' : 'partially_paid';
        if ($status !== $s->status) {
            Akph_Db::update(self::t('statements'), array('status' => $status, 'version' => (int) $s->version + 1, 'updated_at' => Akph_Db::now_utc()), array('id' => $s->id));
        }
        return Akph_Db::find(self::t('statements'), $s->id);
    }

    /** Client contract an advance receipt names: active, client, and not above the contract's advance. */
    public static function assert_advance_receipt($contract_id, $amount, $exclude_receipt = 0) {
        global $wpdb;
        $c = Akph_Db::lock(self::t('contracts'), $contract_id);
        if (!$c || $c->kind !== 'client' || $c->status !== 'active' || !Akph_Auth::can_access_project($c->project_id)) {
            throw Akph_Error::invalid('قرارداد کارفرمای فعال پیدا نشد.', array('field' => 'contract_id'));
        }
        $taken = (int) Akph_Db::value($wpdb->prepare('SELECT COALESCE(SUM(amount), 0) FROM ' . self::t('receipts') . " WHERE contract_id = %d AND receipt_type = 'advance' AND status IN ('pending','approved') AND id <> %d", $c->id, (int) $exclude_receipt));
        $allowed = Akph_Contracts::figures($c)['advance_expected'];
        if ($taken + $amount > $allowed) {
            throw Akph_Error::rule('جمع پیش‌دریافت (' . number_format($taken + $amount) . ' ریال) از پیش‌پرداخت قرارداد ' . $c->number . ' (' . number_format($allowed) . ' ریال) بیشتر است.', array('field' => 'amount'));
        }
        return $c;
    }

    // ------------------------------------------------------------------ signatures

    /** Signature slots: the preparer, then every step of the flow signed by its actor in the current round. */
    public static function signature_slots($id) {
        $s = self::statement_or_404($id);
        $history = Akph_Flow::history($s->history);
        $round = array();
        foreach ($history as $h) {
            $action = isset($h['action']) ? $h['action'] : '';
            if (in_array($action, array('returned', 'rejected'), true)) {
                $round = array();
            } elseif (in_array($action, array('approved', 'step'), true)) {
                $round[$h['step']] = $h;
            }
        }
        $slot = function ($title, $h) {
            $uid = $h ? (int) $h['user_id'] : 0;
            return array('title' => $title, 'user_id' => $uid ? (string) $uid : null, 'name' => $uid ? Akph_Flow::user_name($uid) : '', 'role' => '', 'at' => $uid ? $h['at'] : null, 'signed' => $uid > 0, 'source' => 'approval');
        };
        $slots = array($slot($s->kind === 'client' ? 'تهیه‌کننده' : 'ثبت کارکرد', isset($history[0]) ? $history[0] : null));
        $steps = $s->kind === 'client' ? array('تأیید مشاور', 'تأیید کارفرما') : array('اندازه‌گیری کارکرد', 'تأیید کارگاه', 'تأیید مدیر پروژه', 'تأیید مالی', 'تأیید مدیر ارشد');
        foreach ($steps as $label) {
            $h = isset($round[$label]) ? $round[$label] : ($label === 'اندازه‌گیری کارکرد' && isset($round['اندازه‌گیری مجدد']) ? $round['اندازه‌گیری مجدد'] : null);
            $slots[] = $slot($label, $h);
        }
        return array('number' => $s->number, 'slots' => $slots);
    }
}
