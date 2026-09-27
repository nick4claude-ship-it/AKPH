<?php
/**
 * Treasury (reference: createPaymentRequest, approvePaymentRequest, rejectPaymentRequest, executePayment,
 * recordReceipt and reconcileBankItem in src/store/workflows.ts, payableTypeForRequest in
 * src/store/paymentRequests.ts, TREASURY_PAYMENT / TREASURY_RECEIPT / BANK_RECONCILIATION_MATCH in
 * src/store/postingRules.ts; docs/SERVER-RULES.md §2–3).
 *
 * Bank accounts and cash desks (one table, kind bank|cash) point to an account of the chart (default 11101
 * bank, 11102 cash desk). Their balances are always read from the ledger (cash_ref 'tre:ID').
 *
 * Payment request: from a source (petty cash replenishment; later statements, invoices, payroll) or manual
 * (payable type or an expense/creditor account) → approval (accountant up to the threshold, senior manager
 * above it; never the requester) → payment queue → payments from a bank or cash desk chosen by a user other
 * than the approver: Dr the request's account / Cr the source account, never below zero. Partial payments
 * reduce the remaining amount. A cheque payment credits notes payable (21103) and waits for clearing.
 *
 * Receipt: recorded (manual credit account: receivables, advances, other income or any postable account) →
 * approved by another user with the approval capability → Dr bank or cash desk (or notes receivable 11202 for
 * a cheque) / Cr the chosen account.
 *
 * Transfers between accounts post at once (never below zero). Cheques change status pending → cleared or
 * bounced, each with its entry. Bank reconciliation: statement lines (form or CSV) are matched one to one with
 * final ledger lines of the account; a line without a ledger document becomes a pending voucher (deposit
 * Dr bank / Cr 21701, withdrawal Dr bank fees 62101 / Cr bank) that another user posts.
 */
if (!defined('ABSPATH')) {
    exit;
}

final class Akph_Treasury {
    const OPTION = 'akph_portal_treasury';
    const KINDS = array('bank', 'cash');
    const METHODS = array('satna', 'paya', 'transfer', 'card', 'cash', 'cheque');
    const PRIORITIES = array('urgent', 'normal', 'low');
    const RECEIPT_TYPES = array('statement', 'advance', 'other_income', 'custom');
    const NOTES_PAYABLE = '21103';
    const NOTES_RECEIVABLE = '11202';
    const BANK_SUSPENSE = '21701';
    const BANK_FEES = '62101';
    /** PAYABLE_ACCOUNTS of src/store/postingRules.ts (petty_cash uses the fund's own account). */
    const PAYABLE_ACCOUNTS = array(
        'supplier' => '21101',
        'subcontractor' => '21102',
        'payroll' => '21501',
        'insurance' => '21201',
        'tax_vat' => '21202',
        'tax_payroll' => '21203',
        'tax_withholding' => '21204',
        'advance' => '11401',
        'subcontractor_advance' => '11402',
        'general_expense' => '612',
    );
    const RECEIPT_ACCOUNTS = array('statement' => '11201', 'advance' => '21301', 'other_income' => '41302');

    public static function t($name) {
        return Akph_Schema::table($name);
    }

    public static function cash_ref($account_id) {
        return 'tre:' . (int) $account_id;
    }

    // ------------------------------------------------------------------ settings

    public static function settings() {
        $s = get_option(self::OPTION, array());
        $s = is_array($s) ? $s : array();
        return array(
            // Payment requests above this amount (Rials) need the senior manager; up to it the accountant approves.
            'payment_senior_threshold' => isset($s['payment_senior_threshold']) && is_int($s['payment_senior_threshold']) ? $s['payment_senior_threshold'] : 1000000000,
        );
    }

    public static function update_settings(array $body) {
        Akph_Auth::assert_cap(Akph_Roles::SETTINGS, 'تنظیمات خزانه فقط با مجوز تنظیمات قابل تغییر است.');
        $before = self::settings();
        $s = $before;
        if (array_key_exists('payment_senior_threshold', $body)) {
            $s['payment_senior_threshold'] = Akph_Input::amount($body, 'payment_senior_threshold', 'آستانه تأیید مدیر ارشد');
        }
        update_option(self::OPTION, $s, false);
        Akph_Audit::log('treasury_settings', 'treasury_settings', 0, $before, $s);
        return array('message' => 'تنظیمات خزانه ذخیره شد.', 'records' => array('treasury_settings' => array($s)));
    }

    // ------------------------------------------------------------------ bank accounts and cash desks

    public static function account_shape($row, $balance = null) {
        return array(
            'id' => (string) $row->id,
            'kind' => $row->kind,
            'code' => $row->code,
            'title' => $row->title,
            'bank_name' => $row->bank_name,
            'branch' => $row->branch,
            'account_number' => $row->account_number,
            'sheba' => $row->sheba,
            'holder_name' => $row->holder_name,
            'keeper_user_id' => $row->keeper_user_id ? (string) $row->keeper_user_id : null,
            'location' => $row->location,
            'project_id' => $row->project_id ? (string) $row->project_id : null,
            'account_code' => $row->account_code,
            'active' => (bool) (int) $row->active,
            'balance' => $balance === null ? Akph_Posting::balance(self::cash_ref($row->id)) : (int) $balance,
            'version' => (int) $row->version,
        );
    }

    public static function list_accounts() {
        $rows = (array) Akph_Db::results('SELECT * FROM ' . self::t('treasury_accounts') . ' ORDER BY kind, id');
        $refs = array_map(function ($r) {
            return self::cash_ref($r->id);
        }, $rows);
        $balances = Akph_Posting::balances($refs);
        $out = array();
        foreach ($rows as $r) {
            $out[] = self::account_shape($r, $balances[self::cash_ref($r->id)]);
        }
        return $out;
    }

    private static function account_columns(array $body, $existing = null) {
        $d = array();
        $has = function ($k) use ($body, $existing) {
            return !$existing || array_key_exists($k, $body);
        };
        if (!$existing) {
            $d['kind'] = Akph_Input::one_of($body, 'kind', self::KINDS, 'bank');
        }
        $kind = $existing ? $existing->kind : $d['kind'];
        if ($has('title')) {
            $d['title'] = Akph_Input::text($body, 'title', 190, true, 'عنوان حساب');
        }
        foreach (array('bank_name' => 100, 'branch' => 100, 'account_number' => 40, 'holder_name' => 190, 'location' => 190) as $k => $max) {
            if ($has($k)) {
                $d[$k] = Akph_Input::text($body, $k, $max);
            }
        }
        if ($kind === 'bank' && !$existing && $d['bank_name'] === '') {
            throw Akph_Error::invalid('نام بانک الزامی است.', array('field' => 'bank_name'));
        }
        if ($has('sheba')) {
            $sheba = strtoupper(str_replace(' ', '', Akph_Input::text($body, 'sheba', 34)));
            if ($sheba !== '' && !Akph_Master_Data::valid_sheba($sheba)) {
                throw Akph_Error::invalid('شماره شبا معتبر نیست.', array('field' => 'sheba'));
            }
            $d['sheba'] = $sheba;
        }
        if ($has('keeper_user_id')) {
            $d['keeper_user_id'] = Akph_Input::id($body, 'keeper_user_id');
        }
        if ($has('project_id')) {
            $p = Akph_Input::id($body, 'project_id');
            if ($p && !Akph_Db::find(self::t('projects'), $p)) {
                throw Akph_Error::invalid('پروژه پیدا نشد.', array('field' => 'project_id'));
            }
            $d['project_id'] = $p ?: null;
        }
        if ($has('account_code')) {
            $code = isset($body['account_code']) && $body['account_code'] !== '' ? $body['account_code'] : ($kind === 'cash' ? '11102' : '11101');
            $d['account_code'] = Akph_Posting::assert_postable($code, 'account_code', 'حساب کدینگ متصل');
        }
        if (array_key_exists('active', $body)) {
            $d['active'] = $body['active'] ? 1 : 0;
        }
        return $d;
    }

    public static function create_account(array $body) {
        Akph_Auth::assert_cap(Akph_Roles::TREASURY_MANAGE, 'تعریف حساب بانکی و صندوق مجاز نیست.');
        $year = Akph_Jalali::fiscal_year(Akph_Jalali::today_iso());
        Akph_Numbering::lock('TRA', $year);
        $data = self::account_columns($body);
        $now = Akph_Db::now_utc();
        $id = Akph_Db::insert(self::t('treasury_accounts'), $data + array('code' => 'tmp-' . substr(str_replace('-', '', wp_generate_uuid4()), 0, 24), 'version' => 1, 'created_by' => get_current_user_id(), 'created_at' => $now, 'updated_by' => get_current_user_id(), 'updated_at' => $now));
        $code = Akph_Numbering::issue('TRA', $year, 'treasury_account', $id);
        Akph_Db::update(self::t('treasury_accounts'), array('code' => $code), array('id' => $id));
        $row = Akph_Db::find(self::t('treasury_accounts'), $id);
        Akph_Audit::log('treasury_account_created', 'treasury_account', $id, null, (array) $row, $code);
        return array('status' => 201, 'message' => ($row->kind === 'cash' ? 'صندوق ' : 'حساب بانکی ') . $row->title . ' تعریف شد.', 'id' => $id, 'records' => array('treasury_accounts' => array(self::account_shape($row))));
    }

    public static function update_account($id, array $body, $version) {
        Akph_Auth::assert_cap(Akph_Roles::TREASURY_MANAGE, 'ویرایش حساب بانکی و صندوق مجاز نیست.');
        $row = Akph_Db::lock(self::t('treasury_accounts'), $id);
        if (!$row) {
            throw Akph_Error::not_found('حساب پیدا نشد.');
        }
        Akph_Input::assert_version($row, $version);
        $data = self::account_columns($body, $row);
        if (isset($data['account_code']) && $data['account_code'] !== $row->account_code && Akph_Posting::balance(self::cash_ref($id)) !== 0) {
            throw Akph_Error::rule('حساب کدینگ حسابی که مانده دارد قابل تغییر نیست.', array('field' => 'account_code'));
        }
        $data += array('version' => (int) $row->version + 1, 'updated_by' => get_current_user_id(), 'updated_at' => Akph_Db::now_utc());
        Akph_Db::update(self::t('treasury_accounts'), $data, array('id' => $id));
        $after = Akph_Db::find(self::t('treasury_accounts'), $id);
        Akph_Audit::log('treasury_account_updated', 'treasury_account', $id, (array) $row, (array) $after, $row->code);
        return array('message' => 'حساب ' . $row->title . ' به‌روز شد.', 'id' => $id, 'records' => array('treasury_accounts' => array(self::account_shape($after))));
    }

    private static function active_account($id, $lock = true) {
        $row = $lock ? Akph_Db::lock(self::t('treasury_accounts'), $id) : Akph_Db::find(self::t('treasury_accounts'), $id);
        if (!$row) {
            throw Akph_Error::invalid('حساب بانکی یا صندوق پیدا نشد.', array('field' => 'account_id'));
        }
        if (!(int) $row->active) {
            throw Akph_Error::rule('حساب «' . $row->title . '» غیرفعال است.', array('field' => 'account_id'));
        }
        return $row;
    }

    public static function account_movements($id) {
        $row = Akph_Db::find(self::t('treasury_accounts'), $id);
        if (!$row) {
            throw Akph_Error::not_found('حساب پیدا نشد.');
        }
        return array('account' => self::account_shape($row), 'movements' => Akph_Posting::movements(self::cash_ref($id)));
    }

    // ------------------------------------------------------------------ payment requests

    public static function request_shape($row) {
        $payments = Akph_Db::results($GLOBALS['wpdb']->prepare('SELECT * FROM ' . self::t('payments') . ' WHERE payment_request_id = %d ORDER BY id', $row->id));
        $list = array();
        foreach ((array) $payments as $p) {
            $acc = Akph_Db::find(self::t('treasury_accounts'), $p->account_id);
            $list[] = array(
                'id' => (string) $p->id,
                'account_id' => (string) $p->account_id,
                'account_title' => $acc ? $acc->title : '',
                'amount' => (int) $p->amount,
                'method' => $p->method,
                'tracking' => $p->tracking,
                'date' => $p->pay_date,
                'cheque_id' => $p->cheque_id ? (string) $p->cheque_id : null,
                'entry' => Akph_Posting::entry_ref($p->entry_id),
                'paid_by' => (string) $p->paid_by,
                'paid_by_name' => Akph_Flow::user_name($p->paid_by),
            );
        }
        return array(
            'id' => (string) $row->id,
            'number' => $row->number,
            'source_type' => $row->source_type,
            'source_id' => $row->source_id ? (string) $row->source_id : null,
            'payable_type' => $row->payable_type,
            'debit_account_code' => $row->debit_account_code,
            'project_id' => $row->project_id ? (string) $row->project_id : null,
            'cost_center_id' => $row->cost_center_id ? (string) $row->cost_center_id : null,
            'counterparty_id' => $row->counterparty_id ? (string) $row->counterparty_id : null,
            'fund_id' => $row->fund_id ? (string) $row->fund_id : null,
            'beneficiary_name' => $row->beneficiary_name,
            'beneficiary_type' => $row->beneficiary_type,
            'beneficiary_sheba' => $row->beneficiary_sheba,
            'amount' => (int) $row->amount,
            'paid_amount' => (int) $row->paid_amount,
            'remaining_amount' => (int) $row->amount - (int) $row->paid_amount,
            'date' => $row->request_date,
            'due_date' => $row->due_date,
            'priority' => $row->priority,
            'status' => $row->status,
            'description' => $row->description,
            'requested_by' => (string) $row->requested_by,
            'requested_by_name' => Akph_Flow::user_name($row->requested_by),
            'approved_by' => $row->approved_by ? (string) $row->approved_by : null,
            'approved_by_name' => Akph_Flow::user_name($row->approved_by),
            'approved_at' => $row->approved_at ? Akph_Db::iso_time($row->approved_at) : null,
            'reject_reason' => $row->reject_reason,
            'needs_senior' => (int) $row->amount > self::settings()['payment_senior_threshold'],
            'payments' => $list,
            'version' => (int) $row->version,
        );
    }

    public static function list_requests() {
        $scope = Akph_Auth::project_scope_sql('project_id');
        $rows = Akph_Db::results('SELECT * FROM ' . self::t('payment_requests') . " WHERE {$scope} ORDER BY id DESC LIMIT 1000");
        return array_map(array(__CLASS__, 'request_shape'), (array) $rows);
    }

    /**
     * Inserts a payment request (the caller holds the PAY numbering lock). Used by manual requests and by
     * modules that create one (petty cash replenishment). `approved_by` set = enters the queue approved.
     */
    public static function create_request_internal(array $d) {
        $today = Akph_Jalali::today_iso();
        $year = Akph_Jalali::fiscal_year($today);
        $now = Akph_Db::now_utc();
        $approved = !empty($d['approved_by']);
        $id = Akph_Db::insert(self::t('payment_requests'), array(
            'source_type' => $d['source_type'],
            'source_id' => (int) (isset($d['source_id']) ? $d['source_id'] : 0),
            'payable_type' => $d['payable_type'],
            'debit_account_code' => $d['debit_account_code'],
            'project_id' => !empty($d['project_id']) ? (int) $d['project_id'] : null,
            'cost_center_id' => !empty($d['cost_center_id']) ? (int) $d['cost_center_id'] : null,
            'counterparty_id' => !empty($d['counterparty_id']) ? (int) $d['counterparty_id'] : null,
            'fund_id' => !empty($d['fund_id']) ? (int) $d['fund_id'] : null,
            'beneficiary_name' => mb_substr((string) $d['beneficiary_name'], 0, 190),
            'beneficiary_type' => (string) (isset($d['beneficiary_type']) ? $d['beneficiary_type'] : ''),
            'beneficiary_sheba' => (string) (isset($d['beneficiary_sheba']) ? $d['beneficiary_sheba'] : ''),
            'amount' => (int) $d['amount'],
            'paid_amount' => 0,
            'request_date' => $today,
            'due_date' => isset($d['due_date']) && $d['due_date'] ? $d['due_date'] : $today,
            'priority' => isset($d['priority']) ? $d['priority'] : 'normal',
            'status' => $approved ? 'approved' : 'pending',
            'description' => mb_substr((string) (isset($d['description']) ? $d['description'] : ''), 0, 1000),
            'requested_by' => (int) (isset($d['requested_by']) ? $d['requested_by'] : get_current_user_id()),
            'approved_by' => $approved ? (int) $d['approved_by'] : null,
            'approved_at' => $approved ? $now : null,
            'version' => 1,
            'created_at' => $now,
            'updated_at' => $now,
        ));
        $number = Akph_Numbering::issue('PAY', $year, 'payment_request', $id);
        Akph_Db::update(self::t('payment_requests'), array('number' => $number), array('id' => $id));
        $row = Akph_Db::find(self::t('payment_requests'), $id);
        Akph_Audit::log('payment_request_created', 'payment_request', $id, null, (array) $row, $number);
        return $row;
    }

    public static function create_request(array $body) {
        Akph_Auth::assert_cap(Akph_Roles::PAYMENT_REQUEST, 'اجازه ثبت درخواست پرداخت را ندارید.');
        $amount = Akph_Input::amount($body, 'amount', 'مبلغ درخواست');
        if ($amount <= 0) {
            throw Akph_Error::invalid('مبلغ درخواست باید عدد صحیح مثبت باشد.', array('field' => 'amount'));
        }
        $beneficiary = Akph_Input::text($body, 'beneficiary_name', 190, true, 'ذی‌نفع');
        $project = Akph_Input::id($body, 'project_id');
        if ($project && !Akph_Db::find(self::t('projects'), $project)) {
            throw Akph_Error::invalid('پروژه پیدا نشد.', array('field' => 'project_id'));
        }
        Akph_Auth::assert_project($project ?: null);
        $party = Akph_Input::id($body, 'counterparty_id');
        if ($party && !Akph_Db::find(self::t('counterparties'), $party)) {
            throw Akph_Error::invalid('طرف حساب پیدا نشد.', array('field' => 'counterparty_id'));
        }
        $cc = Akph_Input::id($body, 'cost_center_id');
        if ($cc && !Akph_Db::find(self::t('cost_centers'), $cc)) {
            throw Akph_Error::invalid('مرکز هزینه پیدا نشد.', array('field' => 'cost_center_id'));
        }
        if (!empty($body['debit_account_code'])) {
            // Manual request against a chosen expense or creditor account.
            $type = 'manual_account';
            $code = Akph_Posting::assert_postable($body['debit_account_code'], 'debit_account_code', 'حساب بدهکار (هزینه/بستانکار)');
        } else {
            $type = Akph_Input::one_of($body, 'payable_type', array_keys(self::PAYABLE_ACCOUNTS));
            $code = self::PAYABLE_ACCOUNTS[$type];
            Akph_Posting::account($code, 'حساب ' . $type);
        }
        $due = Akph_Input::iso_date($body, 'due_date', false);
        Akph_Numbering::lock('PAY', Akph_Jalali::fiscal_year(Akph_Jalali::today_iso()));
        $row = self::create_request_internal(array(
            'source_type' => 'manual',
            'payable_type' => $type,
            'debit_account_code' => $code,
            'project_id' => $project,
            'cost_center_id' => $cc,
            'counterparty_id' => $party,
            'beneficiary_name' => $beneficiary,
            'beneficiary_type' => Akph_Input::text($body, 'beneficiary_type', 64),
            'beneficiary_sheba' => Akph_Input::text($body, 'beneficiary_sheba', 26),
            'amount' => $amount,
            'due_date' => $due,
            'priority' => Akph_Input::one_of($body, 'priority', self::PRIORITIES, 'normal'),
            'description' => Akph_Input::text($body, 'description', 1000),
        ));
        return array('status' => 201, 'message' => 'درخواست پرداخت ' . $row->number . ' ثبت شد و در انتظار تأیید است.', 'id' => $row->id, 'doc_number' => $row->number, 'records' => array('payment_requests' => array(self::request_shape($row))));
    }

    private static function request_or_404($id) {
        $row = Akph_Db::lock(self::t('payment_requests'), $id);
        if (!$row || !Akph_Auth::can_access_project($row->project_id)) {
            throw Akph_Error::not_found('درخواست پرداخت پیدا نشد.');
        }
        return $row;
    }

    /** May the current user approve this amount? Accountant up to the threshold, senior manager / admin above it. */
    public static function may_approve_amount($amount) {
        if (!current_user_can(Akph_Roles::PAYMENT_APPROVE)) {
            return false;
        }
        return Akph_Flow::is_senior_or_admin() || (int) $amount <= self::settings()['payment_senior_threshold'];
    }

    public static function approve_request($id, array $body, $version) {
        Akph_Auth::assert_cap(Akph_Roles::PAYMENT_APPROVE, 'اجازه تأیید درخواست پرداخت را ندارید.');
        $row = self::request_or_404($id);
        Akph_Input::assert_version($row, $version);
        if ($row->status !== 'pending') {
            throw Akph_Error::conflict('این درخواست در انتظار تأیید نیست.', array('status' => $row->status));
        }
        if ((int) $row->requested_by === get_current_user_id()) {
            throw new Akph_Error('akph_segregation_of_duties', 'درخواست پرداختی را که خودتان ثبت کرده‌اید تأیید نمی‌کنید (تفکیک وظایف).', 403);
        }
        if (!self::may_approve_amount($row->amount)) {
            throw Akph_Error::forbidden('مبلغ این درخواست بیش از آستانه تأیید حسابدار (' . number_format(self::settings()['payment_senior_threshold']) . ' ریال) است؛ تأیید با مدیر ارشد است.');
        }
        $now = Akph_Db::now_utc();
        Akph_Db::update(self::t('payment_requests'), array('status' => 'approved', 'approved_by' => get_current_user_id(), 'approved_at' => $now, 'version' => (int) $row->version + 1, 'updated_at' => $now), array('id' => $id));
        $after = Akph_Db::find(self::t('payment_requests'), $id);
        Akph_Audit::log('payment_request_approved', 'payment_request', $id, (array) $row, (array) $after, $row->number);
        return array('message' => 'درخواست پرداخت ' . $row->number . ' تأیید شد و در صف پرداخت خزانه قرار گرفت.', 'id' => $id, 'records' => array('payment_requests' => array(self::request_shape($after))));
    }

    public static function reject_request($id, array $body, $version) {
        Akph_Auth::assert_cap(Akph_Roles::PAYMENT_APPROVE, 'اجازه رد درخواست پرداخت را ندارید.');
        $reason = Akph_Input::text($body, 'reason', 1000, true, 'علت رد');
        $row = self::request_or_404($id);
        Akph_Input::assert_version($row, $version);
        if (!in_array($row->status, array('pending', 'approved'), true) || (int) $row->paid_amount > 0) {
            throw Akph_Error::conflict('درخواستی که پرداخت شده یا بسته است قابل رد نیست.', array('status' => $row->status));
        }
        if ((int) $row->requested_by === get_current_user_id()) {
            throw new Akph_Error('akph_segregation_of_duties', 'درخواست پرداختی را که خودتان ثبت کرده‌اید رد نمی‌کنید؛ از کاربر دیگری بخواهید.', 403);
        }
        Akph_Db::update(self::t('payment_requests'), array('status' => 'rejected', 'reject_reason' => $reason, 'version' => (int) $row->version + 1, 'updated_at' => Akph_Db::now_utc()), array('id' => $id));
        $after = Akph_Db::find(self::t('payment_requests'), $id);
        Akph_Audit::log('payment_request_rejected', 'payment_request', $id, (array) $row, (array) $after, $row->number);
        $records = array('payment_requests' => array(self::request_shape($after)));
        $petty = Akph_Petty_Cash::on_payment_request($after);
        if ($petty) {
            $records['petty_requests'] = array(Akph_Petty_Cash::request_shape($petty));
        }
        return array('message' => 'درخواست پرداخت ' . $row->number . ' رد شد.', 'id' => $id, 'records' => $records);
    }

    /** Account line of the request's side (the fund of a replenishment carries its cash reference). */
    private static function request_debit_line($row, $amount, $description) {
        $line = array('code' => $row->debit_account_code, 'label' => 'حساب طرف پرداخت', 'debit' => $amount, 'project_id' => $row->project_id, 'cost_center_id' => $row->cost_center_id, 'counterparty_id' => $row->counterparty_id, 'description' => $description);
        if ($row->source_type === 'petty_replenishment' && $row->fund_id) {
            $line['cash_ref'] = Akph_Petty_Cash::cash_ref($row->fund_id);
            $line['cost_center_id'] = null;
        }
        return $line;
    }

    public static function pay_request($id, array $body, $version) {
        Akph_Auth::assert_cap(Akph_Roles::TREASURY_MANAGE, 'اجازه ثبت پرداخت را ندارید.');
        $amount = Akph_Input::amount($body, 'amount', 'مبلغ پرداخت');
        $account_id = Akph_Input::id($body, 'account_id', false);
        $method = Akph_Input::one_of($body, 'method', self::METHODS, 'transfer');
        $tracking = Akph_Input::text($body, 'tracking', 64);
        $date = Akph_Input::iso_date($body, 'date', false) ?: Akph_Jalali::today_iso();
        // Lock order: ACC anchor of the posting year, then the request, then the source account.
        Akph_Posting::lock_year($date);
        $row = self::request_or_404($id);
        Akph_Input::assert_version($row, $version);
        if ($row->status !== 'approved') {
            throw Akph_Error::conflict('فقط درخواست تأییدشده قابل پرداخت است.', array('status' => $row->status));
        }
        if ($row->approved_by && (int) $row->approved_by === get_current_user_id()) {
            throw new Akph_Error('akph_segregation_of_duties', 'پرداخت‌کننده نمی‌تواند تأییدکننده همین درخواست باشد (تفکیک وظایف).', 403);
        }
        $remaining = (int) $row->amount - (int) $row->paid_amount;
        if ($amount <= 0 || $amount > $remaining) {
            throw Akph_Error::invalid('مبلغ پرداخت باید عدد صحیح مثبت و حداکثر ' . number_format($remaining) . ' ریال (مانده درخواست) باشد.', array('field' => 'amount'));
        }
        $account = self::active_account($account_id);
        $now = Akph_Db::now_utc();
        $pid = Akph_Db::insert(self::t('payments'), array('payment_request_id' => $row->id, 'account_id' => $account->id, 'amount' => $amount, 'method' => $method, 'tracking' => $tracking, 'pay_date' => $date, 'paid_by' => get_current_user_id(), 'created_at' => $now));
        $cheque = null;
        $desc = 'پرداخت ' . $row->number . ' به ' . $row->beneficiary_name . ($tracking !== '' ? ' (پیگیری ' . $tracking . ')' : '');
        if ($method === 'cheque') {
            $serial = Akph_Input::text($body, 'cheque_number', 40, true, 'شماره چک');
            $due = Akph_Input::iso_date($body, 'cheque_due_date', false) ?: $date;
            $debit = self::request_debit_line($row, $amount, $desc);
            $cheque = self::insert_cheque(array(
                'direction' => 'payable', 'serial' => $serial, 'bank_name' => $account->bank_name, 'amount' => $amount, 'issue_date' => $date, 'due_date' => $due,
                'counterparty_id' => $row->counterparty_id, 'party_name' => $row->beneficiary_name, 'project_id' => $row->project_id, 'account_id' => $account->id,
                'source_type' => 'payment', 'source_id' => $pid, 'counter_account_code' => $row->debit_account_code, 'counter_cash_ref' => isset($debit['cash_ref']) ? $debit['cash_ref'] : null,
            ));
            $lines = array($debit, array('code' => self::NOTES_PAYABLE, 'label' => 'اسناد پرداختنی', 'credit' => $amount, 'counterparty_id' => $row->counterparty_id, 'project_id' => $row->project_id, 'description' => 'چک ' . $serial . ' سررسید ' . Akph_Jalali::format($due)));
        } else {
            Akph_Posting::assert_available(self::cash_ref($account->id), $amount, ($account->kind === 'cash' ? 'صندوق «' : 'حساب «') . $account->title . '»');
            $lines = array(self::request_debit_line($row, $amount, $desc), array('code' => $account->account_code, 'label' => $account->kind === 'cash' ? 'صندوق' : 'بانک', 'credit' => $amount, 'cash_ref' => self::cash_ref($account->id), 'description' => 'خروج وجه بابت ' . $row->number));
        }
        $posted = Akph_Posting::post(array(
            'source' => 'payment',
            'source_id' => $pid,
            'type' => 'TREASURY_PAYMENT',
            'date' => $date,
            'description' => $desc,
            'entry_type' => 'payment',
            'project_id' => $row->project_id,
            'lines' => $lines,
        ));
        $entry = $posted['entry'];
        Akph_Db::update(self::t('payments'), array('entry_id' => $entry->id, 'cheque_id' => $cheque ? $cheque->id : null), array('id' => $pid));
        $paid = (int) $row->paid_amount + $amount;
        $status = $paid >= (int) $row->amount ? 'paid' : 'approved';
        Akph_Db::update(self::t('payment_requests'), array('paid_amount' => $paid, 'status' => $status, 'version' => (int) $row->version + 1, 'updated_at' => $now), array('id' => $row->id));
        $after = Akph_Db::find(self::t('payment_requests'), $row->id);
        Akph_Audit::log('payment_made', 'payment_request', $row->id, (array) $row, (array) $after + array('payment_id' => $pid, 'amount' => $amount), $row->number);
        $records = array('payment_requests' => array(self::request_shape($after)), 'journal_entries' => array(Akph_Ledger::shape($entry)), 'treasury_accounts' => array(self::account_shape(Akph_Db::find(self::t('treasury_accounts'), $account->id))));
        if ($cheque) {
            $records['cheques'] = array(self::cheque_shape(Akph_Db::find(self::t('cheques'), $cheque->id)));
        }
        $petty = Akph_Petty_Cash::on_payment_request($after);
        if ($petty) {
            $records['petty_requests'] = array(Akph_Petty_Cash::request_shape($petty));
            $records['petty_funds'] = array(Akph_Petty_Cash::fund_shape(Akph_Db::find(self::t('petty_funds'), $petty->fund_id)));
        }
        return array('status' => 201, 'message' => 'پرداخت ' . number_format($amount) . ' ریال ثبت و سند ' . $entry->doc_number . ' صادر شد.' . ($status === 'paid' ? '' : ' مانده درخواست: ' . number_format((int) $row->amount - $paid) . ' ریال.'), 'id' => $pid, 'doc_number' => $entry->doc_number, 'records' => $records);
    }

    // ------------------------------------------------------------------ receipts

    public static function receipt_shape($row) {
        $acc = Akph_Db::find(self::t('treasury_accounts'), $row->account_id);
        return array(
            'id' => (string) $row->id,
            'number' => $row->number,
            'receipt_type' => $row->receipt_type,
            'credit_account_code' => $row->credit_account_code,
            'counterparty_id' => $row->counterparty_id ? (string) $row->counterparty_id : null,
            'payer_name' => $row->payer_name,
            'project_id' => $row->project_id ? (string) $row->project_id : null,
            'account_id' => (string) $row->account_id,
            'account_title' => $acc ? $acc->title : '',
            'amount' => (int) $row->amount,
            'date' => $row->receipt_date,
            'method' => $row->method,
            'tracking' => $row->tracking,
            'cheque_number' => $row->cheque_number,
            'cheque_due_date' => $row->cheque_due_date,
            'cheque_id' => $row->cheque_id ? (string) $row->cheque_id : null,
            'description' => $row->description,
            'status' => $row->status,
            'created_by' => (string) $row->created_by,
            'created_by_name' => Akph_Flow::user_name($row->created_by),
            'approved_by' => $row->approved_by ? (string) $row->approved_by : null,
            'reject_reason' => $row->reject_reason,
            'entry' => Akph_Posting::entry_ref($row->entry_id),
            'version' => (int) $row->version,
        );
    }

    public static function list_receipts() {
        $scope = Akph_Auth::project_scope_sql('project_id');
        $rows = Akph_Db::results('SELECT * FROM ' . self::t('receipts') . " WHERE {$scope} ORDER BY id DESC LIMIT 1000");
        return array_map(array(__CLASS__, 'receipt_shape'), (array) $rows);
    }

    public static function create_receipt(array $body) {
        Akph_Auth::assert_cap(Akph_Roles::TREASURY_MANAGE, 'اجازه ثبت دریافت را ندارید.');
        $amount = Akph_Input::amount($body, 'amount', 'مبلغ دریافت');
        if ($amount <= 0) {
            throw Akph_Error::invalid('مبلغ دریافت باید عدد صحیح مثبت باشد.', array('field' => 'amount'));
        }
        $type = Akph_Input::one_of($body, 'receipt_type', self::RECEIPT_TYPES, 'statement');
        $code = $type === 'custom'
            ? Akph_Posting::assert_postable(isset($body['credit_account_code']) ? $body['credit_account_code'] : '', 'credit_account_code', 'حساب بستانکار')
            : self::RECEIPT_ACCOUNTS[$type];
        Akph_Posting::account($code, 'حساب بستانکار دریافت');
        $date = Akph_Input::iso_date($body, 'date', false) ?: Akph_Jalali::today_iso();
        Akph_Posting::year_for($date);
        $party = Akph_Input::id($body, 'counterparty_id');
        if ($party && !Akph_Db::find(self::t('counterparties'), $party)) {
            throw Akph_Error::invalid('طرف حساب پیدا نشد.', array('field' => 'counterparty_id'));
        }
        $payer = Akph_Input::text($body, 'payer_name', 190);
        if (!$party && $payer === '') {
            throw Akph_Error::invalid('پرداخت‌کننده (طرف حساب) را انتخاب کنید.', array('field' => 'counterparty_id'));
        }
        $project = Akph_Input::id($body, 'project_id');
        if ($project && !Akph_Db::find(self::t('projects'), $project)) {
            throw Akph_Error::invalid('پروژه پیدا نشد.', array('field' => 'project_id'));
        }
        $method = Akph_Input::one_of($body, 'method', self::METHODS, 'transfer');
        $year = Akph_Jalali::fiscal_year($date);
        Akph_Numbering::lock('REC', $year);
        $account = self::active_account(Akph_Input::id($body, 'account_id', false), false);
        $cheque_no = $method === 'cheque' ? Akph_Input::text($body, 'cheque_number', 40, true, 'شماره چک') : '';
        $now = Akph_Db::now_utc();
        $id = Akph_Db::insert(self::t('receipts'), array(
            'receipt_type' => $type,
            'credit_account_code' => $code,
            'counterparty_id' => $party ?: null,
            'payer_name' => $payer !== '' ? $payer : (string) Akph_Db::find(self::t('counterparties'), $party)->name,
            'project_id' => $project ?: null,
            'account_id' => $account->id,
            'amount' => $amount,
            'receipt_date' => $date,
            'method' => $method,
            'tracking' => Akph_Input::text($body, 'tracking', 64),
            'cheque_number' => $cheque_no,
            'cheque_bank' => $method === 'cheque' ? Akph_Input::text($body, 'cheque_bank', 100) : '',
            'cheque_due_date' => $method === 'cheque' ? (Akph_Input::iso_date($body, 'cheque_due_date', false) ?: $date) : null,
            'description' => Akph_Input::text($body, 'description', 1000),
            'status' => 'pending',
            'created_by' => get_current_user_id(),
            'version' => 1,
            'created_at' => $now,
            'updated_at' => $now,
        ));
        $number = Akph_Numbering::issue('REC', $year, 'receipt', $id);
        Akph_Db::update(self::t('receipts'), array('number' => $number), array('id' => $id));
        $row = Akph_Db::find(self::t('receipts'), $id);
        Akph_Audit::log('receipt_recorded', 'receipt', $id, null, (array) $row, $number);
        return array('status' => 201, 'message' => 'دریافت ' . $number . ' ثبت شد و در انتظار تأیید حسابدار دیگری است.', 'id' => $id, 'doc_number' => $number, 'records' => array('receipts' => array(self::receipt_shape($row))));
    }

    private static function receipt_or_404($id) {
        $row = Akph_Db::lock(self::t('receipts'), $id);
        if (!$row || !Akph_Auth::can_access_project($row->project_id)) {
            throw Akph_Error::not_found('دریافت پیدا نشد.');
        }
        return $row;
    }

    public static function approve_receipt($id, array $body, $version) {
        Akph_Auth::assert_cap(Akph_Roles::PAYMENT_APPROVE, 'اجازه تأیید دریافت را ندارید.');
        $today = Akph_Jalali::today_iso();
        $peek = Akph_Db::find(self::t('receipts'), $id);
        $date = $peek ? $peek->receipt_date : $today;
        Akph_Posting::lock_year($date);
        $row = self::receipt_or_404($id);
        Akph_Input::assert_version($row, $version);
        if ($row->status !== 'pending') {
            throw Akph_Error::conflict('این دریافت در انتظار تأیید نیست.', array('status' => $row->status));
        }
        if ((int) $row->created_by === get_current_user_id()) {
            throw new Akph_Error('akph_segregation_of_duties', 'دریافتی را که خودتان ثبت کرده‌اید تأیید نمی‌کنید (تفکیک وظایف).', 403);
        }
        $account = self::active_account($row->account_id);
        $cheque = null;
        $credit = array('code' => $row->credit_account_code, 'label' => 'حساب بستانکار دریافت', 'credit' => (int) $row->amount, 'counterparty_id' => $row->counterparty_id, 'project_id' => $row->project_id, 'description' => 'دریافت ' . $row->number . ' از ' . $row->payer_name);
        if ($row->method === 'cheque') {
            $cheque = self::insert_cheque(array(
                'direction' => 'receivable', 'serial' => $row->cheque_number, 'bank_name' => $row->cheque_bank, 'amount' => (int) $row->amount, 'issue_date' => $row->receipt_date,
                'due_date' => $row->cheque_due_date ?: $row->receipt_date, 'counterparty_id' => $row->counterparty_id, 'party_name' => $row->payer_name, 'project_id' => $row->project_id,
                'account_id' => $account->id, 'source_type' => 'receipt', 'source_id' => $row->id, 'counter_account_code' => $row->credit_account_code, 'counter_cash_ref' => null,
            ));
            $debit = array('code' => self::NOTES_RECEIVABLE, 'label' => 'اسناد دریافتنی', 'debit' => (int) $row->amount, 'counterparty_id' => $row->counterparty_id, 'project_id' => $row->project_id, 'description' => 'چک دریافتی ' . $row->cheque_number);
        } else {
            $debit = array('code' => $account->account_code, 'label' => $account->kind === 'cash' ? 'صندوق' : 'بانک', 'debit' => (int) $row->amount, 'cash_ref' => self::cash_ref($account->id), 'description' => 'واریز وجه طبق ' . $row->number . ($row->tracking !== '' ? ' (پیگیری ' . $row->tracking . ')' : ''));
        }
        $posted = Akph_Posting::post(array(
            'source' => 'receipt',
            'source_id' => $row->id,
            'type' => 'TREASURY_RECEIPT',
            'date' => $row->receipt_date,
            'description' => 'دریافت ' . $row->number . ' از ' . $row->payer_name . ($row->description !== '' ? ': ' . $row->description : ''),
            'entry_type' => 'receipt',
            'project_id' => $row->project_id,
            'lines' => array($debit, $credit),
        ));
        $entry = $posted['entry'];
        $now = Akph_Db::now_utc();
        Akph_Db::update(self::t('receipts'), array('status' => 'approved', 'approved_by' => get_current_user_id(), 'approved_at' => $now, 'entry_id' => $entry->id, 'cheque_id' => $cheque ? $cheque->id : null, 'version' => (int) $row->version + 1, 'updated_at' => $now), array('id' => $row->id));
        $after = Akph_Db::find(self::t('receipts'), $row->id);
        Akph_Audit::log('receipt_approved', 'receipt', $row->id, (array) $row, (array) $after, $row->number);
        $records = array('receipts' => array(self::receipt_shape($after)), 'journal_entries' => array(Akph_Ledger::shape($entry)), 'treasury_accounts' => array(self::account_shape(Akph_Db::find(self::t('treasury_accounts'), $account->id))));
        if ($cheque) {
            $records['cheques'] = array(self::cheque_shape(Akph_Db::find(self::t('cheques'), $cheque->id)));
        }
        return array('message' => 'دریافت ' . $row->number . ' تأیید شد و سند ' . $entry->doc_number . ' صادر شد.', 'id' => $row->id, 'doc_number' => $entry->doc_number, 'records' => $records);
    }

    public static function reject_receipt($id, array $body, $version) {
        Akph_Auth::assert_cap(Akph_Roles::PAYMENT_APPROVE, 'اجازه رد دریافت را ندارید.');
        $reason = Akph_Input::text($body, 'reason', 1000, true, 'علت رد');
        $row = self::receipt_or_404($id);
        Akph_Input::assert_version($row, $version);
        if ($row->status !== 'pending') {
            throw Akph_Error::conflict('این دریافت در انتظار تأیید نیست.', array('status' => $row->status));
        }
        if ((int) $row->created_by === get_current_user_id()) {
            throw new Akph_Error('akph_segregation_of_duties', 'دریافتی را که خودتان ثبت کرده‌اید رد نمی‌کنید (تفکیک وظایف).', 403);
        }
        Akph_Db::update(self::t('receipts'), array('status' => 'rejected', 'reject_reason' => $reason, 'version' => (int) $row->version + 1, 'updated_at' => Akph_Db::now_utc()), array('id' => $row->id));
        $after = Akph_Db::find(self::t('receipts'), $row->id);
        Akph_Audit::log('receipt_rejected', 'receipt', $row->id, (array) $row, (array) $after, $row->number);
        return array('message' => 'دریافت ' . $row->number . ' رد شد.', 'id' => $row->id, 'records' => array('receipts' => array(self::receipt_shape($after))));
    }

    // ------------------------------------------------------------------ transfers

    public static function transfer_shape($row) {
        $from = Akph_Db::find(self::t('treasury_accounts'), $row->from_account_id);
        $to = Akph_Db::find(self::t('treasury_accounts'), $row->to_account_id);
        return array(
            'id' => (string) $row->id,
            'number' => $row->number,
            'from_account_id' => (string) $row->from_account_id,
            'from_title' => $from ? $from->title : '',
            'to_account_id' => (string) $row->to_account_id,
            'to_title' => $to ? $to->title : '',
            'amount' => (int) $row->amount,
            'date' => $row->transfer_date,
            'tracking' => $row->tracking,
            'description' => $row->description,
            'entry' => Akph_Posting::entry_ref($row->entry_id),
            'created_by_name' => Akph_Flow::user_name($row->created_by),
        );
    }

    public static function create_transfer(array $body) {
        Akph_Auth::assert_cap(Akph_Roles::TREASURY_MANAGE, 'اجازه انتقال وجه بین حساب‌ها را ندارید.');
        $amount = Akph_Input::amount($body, 'amount', 'مبلغ انتقال');
        if ($amount <= 0) {
            throw Akph_Error::invalid('مبلغ انتقال باید عدد صحیح مثبت باشد.', array('field' => 'amount'));
        }
        $from_id = Akph_Input::id($body, 'from_account_id', false);
        $to_id = Akph_Input::id($body, 'to_account_id', false);
        if ($from_id === $to_id) {
            throw Akph_Error::invalid('حساب مبدأ و مقصد یکی است.', array('field' => 'to_account_id'));
        }
        $date = Akph_Input::iso_date($body, 'date', false) ?: Akph_Jalali::today_iso();
        $year = Akph_Posting::lock_year($date);
        Akph_Numbering::lock('TRF', $year);
        // Both accounts in id order (a transfer the other way locks them in the same order).
        $first = self::active_account(min($from_id, $to_id));
        $second = self::active_account(max($from_id, $to_id));
        $from = (int) $first->id === $from_id ? $first : $second;
        $to = (int) $first->id === $to_id ? $first : $second;
        Akph_Posting::assert_available(self::cash_ref($from->id), $amount, 'حساب مبدأ «' . $from->title . '»');
        $tracking = Akph_Input::text($body, 'tracking', 64);
        $desc = Akph_Input::text($body, 'description', 1000);
        $id = Akph_Db::insert(self::t('transfers'), array('from_account_id' => $from->id, 'to_account_id' => $to->id, 'amount' => $amount, 'transfer_date' => $date, 'tracking' => $tracking, 'description' => $desc, 'created_by' => get_current_user_id(), 'created_at' => Akph_Db::now_utc()));
        $number = Akph_Numbering::issue('TRF', $year, 'transfer', $id);
        $posted = Akph_Posting::post(array(
            'source' => 'transfer',
            'source_id' => $id,
            'type' => 'TREASURY_TRANSFER',
            'date' => $date,
            'description' => 'انتقال وجه ' . $number . ' از ' . $from->title . ' به ' . $to->title . ($desc !== '' ? ': ' . $desc : ''),
            'entry_type' => 'payment',
            'lines' => array(
                array('code' => $to->account_code, 'label' => 'حساب مقصد', 'debit' => $amount, 'cash_ref' => self::cash_ref($to->id), 'description' => 'واریز انتقالی از ' . $from->title),
                array('code' => $from->account_code, 'label' => 'حساب مبدأ', 'credit' => $amount, 'cash_ref' => self::cash_ref($from->id), 'description' => 'برداشت انتقالی به ' . $to->title),
            ),
        ));
        Akph_Db::update(self::t('transfers'), array('number' => $number, 'entry_id' => $posted['entry']->id), array('id' => $id));
        $row = Akph_Db::find(self::t('transfers'), $id);
        Akph_Audit::log('treasury_transfer', 'transfer', $id, null, (array) $row, $number);
        return array('status' => 201, 'message' => 'انتقال ' . $number . ' ثبت و سند ' . $posted['entry']->doc_number . ' صادر شد.', 'id' => $id, 'doc_number' => $posted['entry']->doc_number, 'records' => array(
            'transfers' => array(self::transfer_shape($row)),
            'treasury_accounts' => array(self::account_shape(Akph_Db::find(self::t('treasury_accounts'), $from->id)), self::account_shape(Akph_Db::find(self::t('treasury_accounts'), $to->id))),
            'journal_entries' => array(Akph_Ledger::shape($posted['entry'])),
        ));
    }

    // ------------------------------------------------------------------ cheques

    public static function cheque_shape($row) {
        $acc = $row->account_id ? Akph_Db::find(self::t('treasury_accounts'), $row->account_id) : null;
        return array(
            'id' => (string) $row->id,
            'direction' => $row->direction,
            'serial' => $row->serial,
            'bank_name' => $row->bank_name,
            'amount' => (int) $row->amount,
            'issue_date' => $row->issue_date,
            'due_date' => $row->due_date,
            'counterparty_id' => $row->counterparty_id ? (string) $row->counterparty_id : null,
            'party_name' => $row->party_name,
            'project_id' => $row->project_id ? (string) $row->project_id : null,
            'account_id' => $row->account_id ? (string) $row->account_id : null,
            'account_title' => $acc ? $acc->title : '',
            'source_type' => $row->source_type,
            'source_id' => (string) $row->source_id,
            'status' => $row->status,
            'status_date' => $row->status_date,
            'status_note' => $row->status_note,
            'version' => (int) $row->version,
        );
    }

    private static function insert_cheque(array $d) {
        $now = Akph_Db::now_utc();
        $id = Akph_Db::insert(self::t('cheques'), $d + array('status' => 'pending', 'version' => 1, 'created_by' => get_current_user_id(), 'created_at' => $now, 'updated_at' => $now));
        return Akph_Db::find(self::t('cheques'), $id);
    }

    public static function list_cheques() {
        $scope = Akph_Auth::project_scope_sql('project_id');
        $rows = Akph_Db::results('SELECT * FROM ' . self::t('cheques') . " WHERE {$scope} ORDER BY due_date, id LIMIT 1000");
        return array_map(array(__CLASS__, 'cheque_shape'), (array) $rows);
    }

    /** Cheque pending → cleared (paid by / into the bank) or bounced (liability or receivable restored). */
    public static function change_cheque($id, array $body, $version) {
        Akph_Auth::assert_cap(Akph_Roles::TREASURY_MANAGE, 'اجازه تغییر وضعیت چک را ندارید.');
        $status = Akph_Input::one_of($body, 'status', array('cleared', 'bounced'));
        $date = Akph_Input::iso_date($body, 'date', false) ?: Akph_Jalali::today_iso();
        Akph_Posting::lock_year($date);
        $row = Akph_Db::lock(self::t('cheques'), $id);
        if (!$row || !Akph_Auth::can_access_project($row->project_id)) {
            throw Akph_Error::not_found('چک پیدا نشد.');
        }
        Akph_Input::assert_version($row, $version);
        if ($row->status !== 'pending') {
            throw Akph_Error::conflict('وضعیت این چک قبلاً تعیین شده است.', array('status' => $row->status));
        }
        $amount = (int) $row->amount;
        $note = Akph_Input::text($body, 'note', 1000, $status === 'bounced', 'علت برگشت');
        $account = null;
        $records = array();
        if ($row->direction === 'payable') {
            if ($status === 'cleared') {
                $account = self::active_account($row->account_id);
                Akph_Posting::assert_available(self::cash_ref($account->id), $amount, 'حساب «' . $account->title . '»');
                $lines = array(
                    array('code' => self::NOTES_PAYABLE, 'label' => 'اسناد پرداختنی', 'debit' => $amount, 'counterparty_id' => $row->counterparty_id, 'project_id' => $row->project_id, 'description' => 'وصول چک پرداختنی ' . $row->serial),
                    array('code' => $account->account_code, 'label' => 'بانک', 'credit' => $amount, 'cash_ref' => self::cash_ref($account->id), 'description' => 'پاس شدن چک ' . $row->serial),
                );
            } else {
                $counter = array('code' => $row->counter_account_code, 'label' => 'حساب طرف پرداخت', 'credit' => $amount, 'counterparty_id' => $row->counterparty_id, 'project_id' => $row->project_id, 'description' => 'برگشت چک ' . $row->serial . ': ' . $note);
                if ($row->counter_cash_ref) {
                    $counter['cash_ref'] = $row->counter_cash_ref;
                    Akph_Posting::assert_available($row->counter_cash_ref, $amount, 'تنخواه مرتبط');
                }
                $lines = array(array('code' => self::NOTES_PAYABLE, 'label' => 'اسناد پرداختنی', 'debit' => $amount, 'counterparty_id' => $row->counterparty_id, 'project_id' => $row->project_id, 'description' => 'ابطال چک برگشتی ' . $row->serial), $counter);
            }
        } else {
            if ($status === 'cleared') {
                $target = Akph_Input::id($body, 'account_id') ?: (int) $row->account_id;
                $account = self::active_account($target);
                $lines = array(
                    array('code' => $account->account_code, 'label' => 'بانک', 'debit' => $amount, 'cash_ref' => self::cash_ref($account->id), 'description' => 'وصول چک دریافتی ' . $row->serial),
                    array('code' => self::NOTES_RECEIVABLE, 'label' => 'اسناد دریافتنی', 'credit' => $amount, 'counterparty_id' => $row->counterparty_id, 'project_id' => $row->project_id, 'description' => 'وصول چک ' . $row->serial),
                );
            } else {
                $lines = array(
                    array('code' => $row->counter_account_code, 'label' => 'حساب طرف دریافت', 'debit' => $amount, 'counterparty_id' => $row->counterparty_id, 'project_id' => $row->project_id, 'description' => 'برگشت چک دریافتی ' . $row->serial . ': ' . $note),
                    array('code' => self::NOTES_RECEIVABLE, 'label' => 'اسناد دریافتنی', 'credit' => $amount, 'counterparty_id' => $row->counterparty_id, 'project_id' => $row->project_id, 'description' => 'ابطال چک برگشتی ' . $row->serial),
                );
            }
        }
        $posted = Akph_Posting::post(array(
            'source' => 'cheque',
            'source_id' => $row->id,
            'type' => 'CHEQUE_' . strtoupper($status),
            'date' => $date,
            'description' => ($row->direction === 'payable' ? 'چک پرداختنی ' : 'چک دریافتی ') . $row->serial . ' - ' . ($status === 'cleared' ? 'وصول/پاس' : 'برگشتی') . ' (' . $row->party_name . ')',
            'entry_type' => $row->direction === 'payable' ? 'payment' : 'receipt',
            'project_id' => $row->project_id,
            'lines' => $lines,
        ));
        Akph_Db::update(self::t('cheques'), array('status' => $status, 'status_date' => $date, 'status_note' => $note, 'account_id' => $account ? $account->id : $row->account_id, 'version' => (int) $row->version + 1, 'updated_at' => Akph_Db::now_utc()), array('id' => $row->id));
        // A bounced payable cheque reopens the payment request for the same amount.
        if ($row->direction === 'payable' && $status === 'bounced' && $row->source_type === 'payment') {
            $payment = Akph_Db::find(self::t('payments'), $row->source_id);
            if ($payment) {
                $req = Akph_Db::lock(self::t('payment_requests'), $payment->payment_request_id);
                Akph_Db::update(self::t('payment_requests'), array('paid_amount' => max(0, (int) $req->paid_amount - $amount), 'status' => 'approved', 'version' => (int) $req->version + 1, 'updated_at' => Akph_Db::now_utc()), array('id' => $req->id));
                $after_req = Akph_Db::find(self::t('payment_requests'), $req->id);
                $records['payment_requests'] = array(self::request_shape($after_req));
                $petty = Akph_Petty_Cash::on_payment_request($after_req);
                if ($petty) {
                    $records['petty_requests'] = array(Akph_Petty_Cash::request_shape($petty));
                }
            }
        }
        $after = Akph_Db::find(self::t('cheques'), $row->id);
        Akph_Audit::log('cheque_' . $status, 'cheque', $row->id, (array) $row, (array) $after, $row->serial);
        $records['cheques'] = array(self::cheque_shape($after));
        $records['journal_entries'] = array(Akph_Ledger::shape($posted['entry']));
        if ($account) {
            $records['treasury_accounts'] = array(self::account_shape(Akph_Db::find(self::t('treasury_accounts'), $account->id)));
        }
        return array('message' => 'چک ' . $row->serial . ($status === 'cleared' ? ' وصول/پاس شد' : ' برگشتی ثبت شد') . ' و سند ' . $posted['entry']->doc_number . ' صادر شد.', 'id' => $row->id, 'doc_number' => $posted['entry']->doc_number, 'records' => $records);
    }

    // ------------------------------------------------------------------ bank reconciliation

    public static function statement_line_shape($row) {
        return array(
            'id' => (string) $row->id,
            'account_id' => (string) $row->account_id,
            'date' => $row->line_date,
            'description' => $row->description,
            'reference' => $row->reference,
            'direction' => $row->direction,
            'amount' => (int) $row->amount,
            'status' => $row->status,
            'matched_line_id' => $row->matched_line_id ? (string) $row->matched_line_id : null,
            'voucher' => Akph_Posting::entry_ref($row->voucher_entry_id),
            'matched_entry' => $row->matched_line_id ? self::entry_of_line($row->matched_line_id) : null,
            'version' => (int) $row->version,
        );
    }

    private static function entry_of_line($line_id) {
        $line = Akph_Db::find(Akph_Ledger::lines_table(), $line_id);
        return $line ? Akph_Posting::entry_ref($line->entry_id) : null;
    }

    /** Statement lines of one account from a list of rows or CSV text (date, description, deposit, withdrawal, reference). */
    public static function import_statement($account_id, array $body) {
        Akph_Auth::assert_cap(Akph_Roles::TREASURY_MANAGE, 'ورود صورت‌حساب بانکی مجاز نیست.');
        $account = Akph_Db::lock(self::t('treasury_accounts'), $account_id);
        if (!$account || $account->kind !== 'bank') {
            throw Akph_Error::not_found('حساب بانکی پیدا نشد.');
        }
        $rows = array();
        if (isset($body['csv']) && is_string($body['csv'])) {
            $n = 0;
            foreach (preg_split('/\r\n|\r|\n/', $body['csv']) as $line) {
                $n++;
                if (trim($line) === '') {
                    continue;
                }
                $cols = str_getcsv($line, ',', '"', '\\');
                if ($n === 1 && !preg_match('/[0-9]/', (string) $cols[0])) {
                    continue; // header row
                }
                $cols = array_pad($cols, 5, '');
                $rows[] = array('date' => trim($cols[0]), 'description' => trim($cols[1]), 'deposit' => trim(str_replace(',', '', $cols[2])), 'withdrawal' => trim(str_replace(',', '', $cols[3])), 'reference' => trim($cols[4]), 'row' => $n);
            }
        } elseif (isset($body['lines']) && is_array($body['lines'])) {
            foreach (array_values($body['lines']) as $i => $l) {
                $rows[] = (is_array($l) ? $l : array()) + array('row' => $i + 1);
            }
        }
        if (!$rows) {
            throw Akph_Error::invalid('ردیفی برای ورود نیست (فرم ردیف‌ها یا متن CSV: تاریخ، شرح، واریز، برداشت، شماره پیگیری).', array('field' => 'lines'));
        }
        if (count($rows) > 1000) {
            throw Akph_Error::invalid('حداکثر ۱۰۰۰ ردیف در هر ورود.', array('field' => 'lines'));
        }
        $batch = wp_generate_uuid4();
        $now = Akph_Db::now_utc();
        $out = array();
        foreach ($rows as $r) {
            $label = 'ردیف ' . $r['row'];
            $date = isset($r['date']) ? (string) $r['date'] : '';
            $iso = Akph_Jalali::valid_iso($date) ? $date : Akph_Jalali::parse_jalali($date);
            if (!$iso) {
                throw Akph_Error::invalid($label . ': تاریخ نامعتبر است (شمسی ۱۴۰۳/۰۱/۱۵ یا میلادی ۲۰۲۴-۰۴-۰۳).', array('field' => 'lines', 'row' => $r['row']));
            }
            if (isset($r['direction'])) {
                $direction = Akph_Input::one_of($r, 'direction', array('deposit', 'withdrawal'));
                $amount = Akph_Input::parse_amount(isset($r['amount']) ? $r['amount'] : 0, $label . ': مبلغ', 'lines');
            } else {
                $dep = isset($r['deposit']) && $r['deposit'] !== '' ? Akph_Input::parse_amount($r['deposit'], $label . ': واریز', 'lines') : 0;
                $wd = isset($r['withdrawal']) && $r['withdrawal'] !== '' ? Akph_Input::parse_amount($r['withdrawal'], $label . ': برداشت', 'lines') : 0;
                if (($dep > 0) === ($wd > 0)) {
                    throw Akph_Error::invalid($label . ': فقط یکی از واریز یا برداشت مقدار دارد.', array('field' => 'lines', 'row' => $r['row']));
                }
                $direction = $dep > 0 ? 'deposit' : 'withdrawal';
                $amount = max($dep, $wd);
            }
            if ($amount <= 0) {
                throw Akph_Error::invalid($label . ': مبلغ باید مثبت باشد.', array('field' => 'lines', 'row' => $r['row']));
            }
            $id = Akph_Db::insert(self::t('bank_statement_lines'), array(
                'account_id' => $account->id,
                'line_date' => $iso,
                'description' => mb_substr(sanitize_text_field((string) (isset($r['description']) ? $r['description'] : '')), 0, 500),
                'reference' => mb_substr(sanitize_text_field((string) (isset($r['reference']) ? $r['reference'] : '')), 0, 64),
                'direction' => $direction,
                'amount' => $amount,
                'status' => 'unmatched',
                'batch' => $batch,
                'version' => 1,
                'created_by' => get_current_user_id(),
                'created_at' => $now,
            ));
            $out[] = self::statement_line_shape(Akph_Db::find(self::t('bank_statement_lines'), $id));
        }
        Akph_Audit::log('bank_statement_imported', 'treasury_account', $account->id, null, array('batch' => $batch, 'lines' => count($out)), $account->code);
        return array('status' => 201, 'message' => count($out) . ' ردیف صورت‌حساب بانک ثبت شد.', 'records' => array('bank_statement_lines' => $out));
    }

    /** Statement lines and the final ledger lines of the account not matched yet. */
    public static function reconciliation($account_id) {
        global $wpdb;
        $account = Akph_Db::find(self::t('treasury_accounts'), $account_id);
        if (!$account) {
            throw Akph_Error::not_found('حساب پیدا نشد.');
        }
        $lines = Akph_Db::results($wpdb->prepare('SELECT * FROM ' . self::t('bank_statement_lines') . ' WHERE account_id = %d ORDER BY line_date, id', $account_id));
        $unmatched = Akph_Db::results($wpdb->prepare(
            'SELECT l.id, l.debit, l.credit, l.description, e.doc_number, e.entry_date FROM ' . Akph_Ledger::lines_table() . ' l JOIN ' . Akph_Ledger::entries_table() . ' e ON e.id = l.entry_id LEFT JOIN ' . self::t('bank_statement_lines') . " s ON s.matched_line_id = l.id WHERE l.cash_ref = %s AND e.status = 'posted' AND s.id IS NULL ORDER BY e.entry_date, l.id",
            self::cash_ref($account_id)
        ));
        $ledger = array();
        foreach ((array) $unmatched as $l) {
            $ledger[] = array('line_id' => (string) $l->id, 'doc_number' => $l->doc_number, 'date' => $l->entry_date, 'description' => $l->description, 'direction' => (int) $l->debit > 0 ? 'deposit' : 'withdrawal', 'amount' => max((int) $l->debit, (int) $l->credit));
        }
        return array('account' => self::account_shape($account), 'statement_lines' => array_map(array(__CLASS__, 'statement_line_shape'), (array) $lines), 'unmatched_ledger_lines' => $ledger);
    }

    public static function list_statement_lines() {
        $rows = Akph_Db::results('SELECT * FROM ' . self::t('bank_statement_lines') . ' ORDER BY line_date DESC, id DESC LIMIT 2000');
        return array_map(array(__CLASS__, 'statement_line_shape'), (array) $rows);
    }

    private static function statement_line_or_404($id) {
        $row = Akph_Db::lock(self::t('bank_statement_lines'), $id);
        if (!$row) {
            throw Akph_Error::not_found('ردیف صورت‌حساب پیدا نشد.');
        }
        return $row;
    }

    /** One statement line ↔ one final ledger line of the same account, same direction and amount; each only once. */
    public static function match_line($id, array $body, $version) {
        Akph_Auth::assert_cap(Akph_Roles::TREASURY_MANAGE, 'تطبیق بانکی مجاز نیست.');
        $ledger_id = Akph_Input::id($body, 'ledger_line_id', false);
        $row = self::statement_line_or_404($id);
        Akph_Input::assert_version($row, $version);
        if ($row->status !== 'unmatched') {
            throw Akph_Error::conflict('این ردیف قبلاً تطبیق شده است.', array('status' => $row->status));
        }
        global $wpdb;
        $line = Akph_Db::row($wpdb->prepare('SELECT l.*, e.status AS entry_status FROM ' . Akph_Ledger::lines_table() . ' l JOIN ' . Akph_Ledger::entries_table() . ' e ON e.id = l.entry_id WHERE l.id = %d FOR UPDATE', $ledger_id));
        if (!$line || $line->cash_ref !== self::cash_ref($row->account_id) || $line->entry_status !== 'posted') {
            throw Akph_Error::invalid('ردیف دفتر این حساب بانکی (سند قطعی) پیدا نشد.', array('field' => 'ledger_line_id'));
        }
        $dir = (int) $line->debit > 0 ? 'deposit' : 'withdrawal';
        $amt = max((int) $line->debit, (int) $line->credit);
        if ($dir !== $row->direction || $amt !== (int) $row->amount) {
            throw Akph_Error::rule('مبلغ یا جهت ردیف دفتر (' . number_format($amt) . ') با ردیف صورت‌حساب (' . number_format((int) $row->amount) . ') یکی نیست.');
        }
        $taken = Akph_Db::value($wpdb->prepare('SELECT id FROM ' . self::t('bank_statement_lines') . ' WHERE matched_line_id = %d FOR UPDATE', $ledger_id));
        if ($taken) {
            throw Akph_Error::conflict('این ردیف دفتر قبلاً با ردیف دیگری از صورت‌حساب تطبیق شده است.');
        }
        Akph_Db::update(self::t('bank_statement_lines'), array('status' => 'matched', 'matched_line_id' => $ledger_id, 'matched_by' => get_current_user_id(), 'version' => (int) $row->version + 1), array('id' => $row->id));
        $after = Akph_Db::find(self::t('bank_statement_lines'), $row->id);
        Akph_Audit::log('bank_line_matched', 'bank_statement_line', $row->id, (array) $row, (array) $after);
        return array('message' => 'ردیف صورت‌حساب با سند ' . self::entry_of_line($ledger_id)['number'] . ' تطبیق شد.', 'id' => $row->id, 'records' => array('bank_statement_lines' => array(self::statement_line_shape($after))));
    }

    /** A statement line without a ledger document → pending voucher that another user posts. */
    public static function voucher_for_line($id, array $body, $version) {
        Akph_Auth::assert_cap(Akph_Roles::TREASURY_MANAGE, 'صدور سند مغایرت بانکی مجاز نیست.');
        Akph_Auth::assert_cap(Akph_Roles::JOURNAL_CREATE, 'صدور سند مغایرت بانکی مجاز نیست.');
        $today = Akph_Jalali::today_iso();
        $peek = Akph_Db::find(self::t('bank_statement_lines'), $id);
        $date = $peek && $peek->line_date <= $today && !Akph_Settings::is_closed_year(Akph_Jalali::fiscal_year($peek->line_date)) ? $peek->line_date : $today;
        Akph_Posting::lock_year($date, true);
        $row = self::statement_line_or_404($id);
        Akph_Input::assert_version($row, $version);
        if ($row->status !== 'unmatched') {
            throw Akph_Error::conflict('این ردیف قبلاً تطبیق شده است.', array('status' => $row->status));
        }
        $account = Akph_Db::find(self::t('treasury_accounts'), $row->account_id);
        $amount = (int) $row->amount;
        $bank = array('code' => $account->account_code, 'label' => 'بانک', 'cash_ref' => self::cash_ref($account->id));
        if ($row->direction === 'deposit') {
            $lines = array(
                $bank + array('debit' => $amount, 'description' => 'شناسایی واریز طبق صورت‌حساب بانک: ' . $row->description),
                array('code' => self::BANK_SUSPENSE, 'label' => 'واریزهای نامشخص', 'credit' => $amount, 'description' => 'واریز نامشخص در انتظار تعیین تکلیف: ' . $row->description),
            );
        } else {
            $lines = array(
                array('code' => self::BANK_FEES, 'label' => 'کارمزد بانکی', 'debit' => $amount, 'description' => 'کارمزد/برداشت بانکی: ' . $row->description),
                $bank + array('credit' => $amount, 'description' => 'برداشت طبق صورت‌حساب بانک: ' . $row->description),
            );
        }
        $posted = Akph_Posting::post(array(
            'source' => 'bank_line',
            'source_id' => $row->id,
            'type' => 'BANK_RECONCILIATION_MATCH',
            'date' => $date,
            'description' => 'سند رفع مغایرت بانکی ' . $account->title . ': ' . ($row->direction === 'deposit' ? 'واریز' : 'برداشت') . ' فاقد سند دفتری — ' . $row->description,
            'entry_type' => $row->direction === 'deposit' ? 'receipt' : 'payment',
            'pending' => true,
            'lines' => $lines,
        ));
        $entry = $posted['entry'];
        global $wpdb;
        $bank_line = (int) Akph_Db::value($wpdb->prepare('SELECT id FROM ' . Akph_Ledger::lines_table() . ' WHERE entry_id = %d AND cash_ref = %s LIMIT 1', $entry->id, self::cash_ref($account->id)));
        Akph_Db::update(self::t('bank_statement_lines'), array('status' => 'voucher', 'voucher_entry_id' => $entry->id, 'matched_line_id' => $bank_line, 'matched_by' => get_current_user_id(), 'version' => (int) $row->version + 1), array('id' => $row->id));
        $after = Akph_Db::find(self::t('bank_statement_lines'), $row->id);
        Akph_Audit::log('bank_line_voucher', 'bank_statement_line', $row->id, (array) $row, (array) $after, $entry->draft_number);
        return array('status' => 201, 'message' => 'سند ' . $entry->draft_number . ' برای این ردیف صادر شد و در انتظار تأیید کاربر دیگر است.', 'id' => $row->id, 'doc_number' => $entry->draft_number, 'records' => array('bank_statement_lines' => array(self::statement_line_shape($after)), 'journal_entries' => array(Akph_Ledger::shape($entry))));
    }

    // ------------------------------------------------------------------ schedule and overview

    /** Approved requests with a remaining amount and pending cheques, by due date, with the cash available. */
    public static function schedule() {
        $scope = Akph_Auth::project_scope_sql('project_id');
        $requests = Akph_Db::results('SELECT * FROM ' . self::t('payment_requests') . " WHERE status = 'approved' AND amount > paid_amount AND {$scope} ORDER BY due_date, id");
        $cheques = Akph_Db::results('SELECT * FROM ' . self::t('cheques') . " WHERE status = 'pending' AND {$scope} ORDER BY due_date, id");
        $items = array();
        foreach ((array) $requests as $r) {
            $items[] = array('kind' => 'payment_request', 'id' => (string) $r->id, 'number' => $r->number, 'due_date' => $r->due_date, 'amount' => (int) $r->amount - (int) $r->paid_amount, 'direction' => 'out', 'party' => $r->beneficiary_name);
        }
        foreach ((array) $cheques as $c) {
            $items[] = array('kind' => 'cheque', 'id' => (string) $c->id, 'number' => $c->serial, 'due_date' => $c->due_date, 'amount' => (int) $c->amount, 'direction' => $c->direction === 'payable' ? 'out' : 'in', 'party' => $c->party_name);
        }
        usort($items, function ($a, $b) {
            return strcmp($a['due_date'], $b['due_date']);
        });
        $available = 0;
        if (Akph_Auth::view_all()) {
            foreach (self::list_accounts() as $a) {
                if ($a['active']) {
                    $available += $a['balance'];
                }
            }
        }
        $running = 0;
        foreach ($items as &$it) {
            $running += $it['direction'] === 'out' ? $it['amount'] : -$it['amount'];
            $it['cumulative_out'] = $running;
            $it['covered'] = $running <= $available;
        }
        unset($it);
        return array('items' => $items, 'available_cash' => $available);
    }

    public static function overview() {
        $view_all = Akph_Auth::view_all();
        $transfers = $view_all ? Akph_Db::results('SELECT * FROM ' . self::t('transfers') . ' ORDER BY id DESC LIMIT 500') : array();
        return array(
            'accounts' => $view_all ? self::list_accounts() : array(),
            'payment_requests' => self::list_requests(),
            'receipts' => self::list_receipts(),
            'cheques' => self::list_cheques(),
            'transfers' => array_map(array(__CLASS__, 'transfer_shape'), (array) $transfers),
            'statement_lines' => $view_all ? self::list_statement_lines() : array(),
            'settings' => self::settings(),
        );
    }
}
