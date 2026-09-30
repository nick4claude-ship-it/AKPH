<?php
/**
 * Contracts (0.7.0, docs/SERVER-RULES.md §2, docs/API-CONTRACT.md): client contracts (revenue) and subcontracts
 * (cost), with their BOQ lines, amendments, guarantees and advances.
 *
 * - A contract is created by the accountant (or the senior manager / system administrator) for a project and
 *   a counterparty of the right kind (client / subcontractor). Its amount is Σ round(quantity × rate) of its
 *   BOQ lines, computed here; the client never sends an amount. Rates of deductions are percentages with two
 *   decimals, stored as basis points.
 * - Approval chain: client contract → «مدیر ارشد»; subcontract → «مدیر پروژه» → «مدیر ارشد» (Akph_Flow: the
 *   creator never approves, nobody approves two consecutive steps). Only an active contract takes statements.
 * - An amendment (الحاقیه) adds quantity to lines, new lines, or days; it is effective only when the senior
 *   manager approves it (not its creator). A reduction below the quantity already measured is refused.
 * - Guarantees (تضامین) with bank, amount and due date; those due within 30 days are reported (notifications).
 * - Advances: a subcontract advance is paid only through a treasury payment request (payable 11402); a client
 *   advance is received only through a treasury receipt of type «advance» (21301) that names the contract.
 *
 * Executed, approved, received/paid and remaining amounts of a contract are never stored: they are computed
 * from its statements, receipts and payment requests, so they rise only with a final approval and fall back
 * when a statement is voided.
 */
if (!defined('ABSPATH')) {
    exit;
}

/** Quantities with three decimals as integer thousandths (no floating point). */
final class Akph_Qty {
    const MAX_MILLI = 999999999999999999; // DECIMAL(18,3)

    /** '12.345' / 12.345 / 12 → 12345; `$signed` allows a leading minus (amendments). */
    public static function parse($value, $field, $label, $signed = false) {
        if (is_int($value)) {
            $value = (string) $value;
        } elseif (is_float($value)) {
            $value = rtrim(rtrim(number_format($value, 3, '.', ''), '0'), '.');
        }
        $re = $signed ? '/^(-?)([0-9]{1,15})(?:\.([0-9]{1,3}))?$/D' : '/^()([0-9]{1,15})(?:\.([0-9]{1,3}))?$/D';
        if (!is_string($value) || !preg_match($re, $value, $m)) {
            throw Akph_Error::invalid($label . ' باید عدد با حداکثر سه رقم اعشار باشد.', array('field' => $field));
        }
        $milli = (int) $m[2] * 1000 + (int) str_pad(isset($m[3]) ? $m[3] : '', 3, '0');
        return $m[1] === '-' ? -$milli : $milli;
    }

    /** Stored DECIMAL(18,3) string → thousandths. */
    public static function from_db($value) {
        return self::parse((string) $value, 'quantity', 'مقدار', true);
    }

    /** Thousandths → '12.345' (trailing zeros trimmed). */
    public static function to_string($milli) {
        $sign = $milli < 0 ? '-' : '';
        $milli = abs((int) $milli);
        $int = intdiv($milli, 1000);
        $frac = $milli % 1000;
        return $sign . $int . ($frac ? '.' . rtrim(str_pad((string) $frac, 3, '0', STR_PAD_LEFT), '0') : '');
    }

    /** round(quantity × rate), half away from zero, without overflow for amounts that fit. */
    public static function amount($milli, $rate) {
        $sign = $milli < 0 ? -1 : 1;
        $milli = abs((int) $milli);
        $rate = (int) $rate;
        $whole = intdiv($milli, 1000);
        $frac = $milli % 1000;
        if ($whole > 0 && $rate > intdiv(Akph_Input::MAX_AMOUNT, $whole)) {
            throw Akph_Error::invalid('مبلغ ردیف بیش از حد مجاز است.', array('field' => 'rate'));
        }
        return $sign * ($whole * $rate + intdiv($frac * $rate + 500, 1000));
    }

    /** '12.5' (percent with up to two decimals) → 1250 basis points (0..10000). */
    public static function percent_bp($body, $key, $label) {
        if (!isset($body[$key]) || $body[$key] === '' || $body[$key] === null) {
            return 0;
        }
        $v = $body[$key];
        if (is_int($v) || is_float($v)) {
            $v = rtrim(rtrim(number_format((float) $v, 2, '.', ''), '0'), '.');
        }
        if (!is_string($v) || !preg_match('/^([0-9]{1,3})(?:\.([0-9]{1,2}))?$/D', $v, $m)) {
            throw Akph_Error::invalid($label . ' باید درصد با حداکثر دو رقم اعشار باشد.', array('field' => $key));
        }
        $bp = (int) $m[1] * 100 + (int) str_pad(isset($m[2]) ? $m[2] : '', 2, '0');
        if ($bp > 10000) {
            throw Akph_Error::invalid($label . ' نمی‌تواند بیش از ۱۰۰ درصد باشد.', array('field' => $key));
        }
        return $bp;
    }

    /** round(amount × bp / 10000), half away from zero. */
    public static function of_bp($amount, $bp) {
        $amount = (int) $amount;
        $bp = (int) $bp;
        return intdiv($amount, 10000) * $bp + intdiv(($amount % 10000) * $bp + 5000, 10000);
    }

    public static function bp_string($bp) {
        $bp = (int) $bp;
        return intdiv($bp, 100) . ($bp % 100 ? '.' . rtrim(str_pad((string) ($bp % 100), 2, '0', STR_PAD_LEFT), '0') : '');
    }
}

final class Akph_Contracts {
    const KINDS = array('client', 'subcontract');
    const GUARANTEE_KINDS = array('bid', 'performance', 'advance', 'retention', 'other');
    const GUARANTEE_STATUSES = array('active', 'released', 'expired');
    const DUE_SOON_DAYS = 30;
    /** Statuses of a statement whose quantities and amounts count as approved. */
    const APPROVED = array('approved_by_employer', 'partially_paid', 'paid', 'management_approved');
    /** Statuses that no longer hold quantities (closed without approval, or voided). */
    const CLOSED = array('returned_for_correction', 'returned_for_revision', 'rejected', 'voided');

    public static function t($name) {
        return Akph_Schema::table($name);
    }

    private static function prefix($kind) {
        return $kind === 'client' ? 'CNT' : 'SCN';
    }

    public static function chain_for($kind) {
        return $kind === 'client' ? array(Akph_Flow::SENIOR) : array(Akph_Flow::PM, Akph_Flow::SENIOR);
    }

    // ------------------------------------------------------------------ reads

    /** Lines of a contract with the effective quantity (base + approved amendments). */
    public static function lines($contract_id) {
        global $wpdb;
        $rows = (array) Akph_Db::results($wpdb->prepare(
            'SELECT l.* FROM ' . self::t('contract_lines') . ' l LEFT JOIN ' . self::t('contract_amendments') . " a ON a.id = l.amendment_id
             WHERE l.contract_id = %d AND (l.amendment_id IS NULL OR a.status = 'approved') ORDER BY l.row_no, l.id",
            $contract_id
        ));
        $deltas = array();
        foreach ((array) Akph_Db::results($wpdb->prepare(
            'SELECT al.contract_line_id, al.quantity_delta FROM ' . self::t('amendment_lines') . ' al JOIN ' . self::t('contract_amendments') . " a ON a.id = al.amendment_id
             WHERE a.contract_id = %d AND a.status = 'approved' AND al.creates_line = 0 AND al.contract_line_id IS NOT NULL",
            $contract_id
        )) as $d) {
            $deltas[(int) $d->contract_line_id] = (isset($deltas[(int) $d->contract_line_id]) ? $deltas[(int) $d->contract_line_id] : 0) + Akph_Qty::from_db($d->quantity_delta);
        }
        $out = array();
        foreach ($rows as $r) {
            $base = Akph_Qty::from_db($r->quantity);
            $out[(int) $r->id] = array('row' => $r, 'base' => $base, 'quantity' => $base + (isset($deltas[(int) $r->id]) ? $deltas[(int) $r->id] : 0));
        }
        return $out;
    }

    /** Quantities of each line in approved statements and in statements still in the flow. */
    public static function measured($contract_id, $exclude_statement = 0) {
        global $wpdb;
        $closed = "'" . implode("','", self::CLOSED) . "'";
        $rows = (array) Akph_Db::results($wpdb->prepare(
            'SELECT sl.contract_line_id, sl.quantity, s.status FROM ' . self::t('statement_lines') . ' sl JOIN ' . self::t('statements') . " s ON s.id = sl.statement_id
             WHERE s.contract_id = %d AND s.id <> %d AND s.status NOT IN ({$closed})",
            $contract_id,
            (int) $exclude_statement
        ));
        $out = array();
        foreach ($rows as $r) {
            $k = (int) $r->contract_line_id;
            if (!isset($out[$k])) {
                $out[$k] = array('approved' => 0, 'pending' => 0);
            }
            $out[$k][in_array($r->status, self::APPROVED, true) ? 'approved' : 'pending'] += Akph_Qty::from_db($r->quantity);
        }
        return $out;
    }

    /** Figures of a contract, all computed from its lines, amendments, statements, receipts and payments. */
    public static function figures($c) {
        global $wpdb;
        $id = (int) $c->id;
        $amend = (int) Akph_Db::value($wpdb->prepare('SELECT COALESCE(SUM(amount_delta), 0) FROM ' . self::t('contract_amendments') . " WHERE contract_id = %d AND status = 'approved'", $id));
        $extend = (int) Akph_Db::value($wpdb->prepare('SELECT COALESCE(SUM(extend_days), 0) FROM ' . self::t('contract_amendments') . " WHERE contract_id = %d AND status = 'approved'", $id));
        $approved = "'" . implode("','", self::APPROVED) . "'";
        $closed = "'" . implode("','", self::CLOSED) . "'";
        $st = self::t('statements');
        $agg = Akph_Db::row($wpdb->prepare(
            "SELECT COALESCE(SUM(CASE WHEN status IN ({$approved}) THEN work_amount + adjustment_amount END), 0) AS approved_work,
                    COALESCE(SUM(CASE WHEN status IN ({$approved}) THEN gross_amount END), 0) AS approved_gross,
                    COALESCE(SUM(CASE WHEN status IN ({$approved}) THEN net_amount END), 0) AS approved_net,
                    COALESCE(SUM(CASE WHEN status NOT IN ({$closed}) THEN work_amount + adjustment_amount END), 0) AS measured
             FROM {$st} WHERE contract_id = %d",
            $id
        ));
        $deductions = array();
        foreach ((array) Akph_Db::col($wpdb->prepare("SELECT deductions FROM {$st} WHERE contract_id = %d AND status IN ({$approved})", $id)) as $json) {
            foreach ((array) json_decode((string) $json, true) as $d) {
                if (!empty($d['type'])) {
                    $deductions[$d['type']] = (isset($deductions[$d['type']]) ? $deductions[$d['type']] : 0) + (int) $d['amount'];
                }
            }
        }
        if ($c->kind === 'client') {
            $settled = (int) Akph_Db::value($wpdb->prepare('SELECT COALESCE(SUM(r.amount), 0) FROM ' . self::t('receipts') . " r JOIN {$st} s ON s.id = r.statement_id WHERE s.contract_id = %d AND r.status = 'approved'", $id));
            $advance = (int) Akph_Db::value($wpdb->prepare('SELECT COALESCE(SUM(amount), 0) FROM ' . self::t('receipts') . " WHERE contract_id = %d AND receipt_type = 'advance' AND status = 'approved'", $id));
        } else {
            $settled = (int) Akph_Db::value($wpdb->prepare('SELECT COALESCE(SUM(p.paid_amount), 0) FROM ' . self::t('payment_requests') . " p JOIN {$st} s ON s.payment_request_id = p.id WHERE s.contract_id = %d", $id));
            $advance = (int) Akph_Db::value($wpdb->prepare('SELECT COALESCE(SUM(paid_amount), 0) FROM ' . self::t('payment_requests') . " WHERE source_type = 'contract_advance' AND source_id = %d", $id));
        }
        $current = (int) $c->amount + $amend;
        $amortized = isset($deductions['advance_payment']) ? $deductions['advance_payment'] : 0;
        return array(
            'amendments_total' => $amend,
            'extend_days' => $extend,
            'current_amount' => $current,
            'measured_amount' => (int) $agg->measured,
            'approved_amount' => (int) $agg->approved_work,
            'approved_gross' => (int) $agg->approved_gross,
            'approved_net' => (int) $agg->approved_net,
            'remaining_amount' => max(0, $current - (int) $agg->approved_work),
            'settled_amount' => $settled,
            'balance_due' => max(0, (int) $agg->approved_net - $settled),
            'advance_amount' => $advance,
            'advance_expected' => Akph_Qty::of_bp($current, $c->advance_bp),
            'advance_remaining' => max(0, $advance - $amortized - self::pending_amortization($id)),
            'deductions' => $deductions,
        );
    }

    /** Advance deducted in statements still in the flow (reserved against the remaining advance). */
    public static function pending_amortization($contract_id, $exclude_statement = 0) {
        global $wpdb;
        $approved = array_merge(self::APPROVED, self::CLOSED);
        $in = "'" . implode("','", $approved) . "'";
        $sum = 0;
        foreach ((array) Akph_Db::col($wpdb->prepare('SELECT deductions FROM ' . self::t('statements') . " WHERE contract_id = %d AND id <> %d AND status NOT IN ({$in})", $contract_id, (int) $exclude_statement)) as $json) {
            foreach ((array) json_decode((string) $json, true) as $d) {
                if (isset($d['type']) && $d['type'] === 'advance_payment') {
                    $sum += (int) $d['amount'];
                }
            }
        }
        return $sum;
    }

    public static function guarantee_shape($g) {
        $today = Akph_Jalali::today_iso();
        $days = $g->due_date ? (int) floor((strtotime($g->due_date) - strtotime($today)) / DAY_IN_SECONDS) : null;
        return array(
            'id' => (string) $g->id,
            'contract_id' => (string) $g->contract_id,
            'kind' => $g->kind,
            'guarantee_no' => $g->guarantee_no,
            'bank' => $g->bank,
            'amount' => (int) $g->amount,
            'issue_date' => $g->issue_date,
            'due_date' => $g->due_date,
            'status' => $g->status,
            'notes' => $g->notes,
            'days_to_due' => $days,
            'due_soon' => $g->status === 'active' && $days !== null && $days <= self::DUE_SOON_DAYS,
            'version' => (int) $g->version,
        );
    }

    public static function amendment_shape($a) {
        global $wpdb;
        $lines = array();
        foreach ((array) Akph_Db::results($wpdb->prepare('SELECT * FROM ' . self::t('amendment_lines') . ' WHERE amendment_id = %d ORDER BY id', $a->id)) as $l) {
            $lines[] = array(
                'contract_line_id' => $l->contract_line_id ? (string) $l->contract_line_id : null,
                'new_line' => (bool) (int) $l->creates_line,
                'code' => $l->code,
                'description' => $l->description,
                'unit' => $l->unit,
                'rate' => (int) $l->rate,
                'quantity_delta' => Akph_Qty::to_string(Akph_Qty::from_db($l->quantity_delta)),
                'amount' => (int) $l->amount,
            );
        }
        return array(
            'id' => (string) $a->id,
            'number' => $a->number,
            'contract_id' => (string) $a->contract_id,
            'amendment_no' => $a->amendment_no,
            'date' => $a->amendment_date,
            'amount_delta' => (int) $a->amount_delta,
            'extend_days' => (int) $a->extend_days,
            'description' => $a->description,
            'status' => $a->status,
            'lines' => $lines,
            'created_by' => (string) $a->created_by,
            'created_by_name' => Akph_Flow::user_name($a->created_by),
            'approved_by' => $a->approved_by ? (string) $a->approved_by : null,
            'approved_by_name' => Akph_Flow::user_name($a->approved_by),
            'approved_at' => Akph_Db::iso_time($a->approved_at),
            'reject_reason' => $a->reject_reason,
            'version' => (int) $a->version,
        );
    }

    public static function shape($c) {
        global $wpdb;
        $chain = Akph_Flow::chain($c->chain);
        $lines = self::lines($c->id);
        $measured = self::measured($c->id);
        $out_lines = array();
        foreach ($lines as $lid => $l) {
            $m = isset($measured[$lid]) ? $measured[$lid] : array('approved' => 0, 'pending' => 0);
            $out_lines[] = array(
                'id' => (string) $lid,
                'row_no' => (int) $l['row']->row_no,
                'code' => $l['row']->code,
                'description' => $l['row']->description,
                'unit' => $l['row']->unit,
                'base_quantity' => Akph_Qty::to_string($l['base']),
                'quantity' => Akph_Qty::to_string($l['quantity']),
                'rate' => (int) $l['row']->rate,
                'amount' => Akph_Qty::amount($l['quantity'], $l['row']->rate),
                'approved_quantity' => Akph_Qty::to_string($m['approved']),
                'pending_quantity' => Akph_Qty::to_string($m['pending']),
                'amendment_id' => $l['row']->amendment_id ? (string) $l['row']->amendment_id : null,
            );
        }
        $party = Akph_Db::find(self::t('counterparties'), $c->counterparty_id);
        $project = Akph_Db::find(self::t('projects'), $c->project_id);
        $amendments = array_map(array(__CLASS__, 'amendment_shape'), (array) Akph_Db::results($wpdb->prepare('SELECT * FROM ' . self::t('contract_amendments') . ' WHERE contract_id = %d ORDER BY id', $c->id)));
        $guarantees = array_map(array(__CLASS__, 'guarantee_shape'), (array) Akph_Db::results($wpdb->prepare('SELECT * FROM ' . self::t('contract_guarantees') . ' WHERE contract_id = %d ORDER BY due_date, id', $c->id)));
        return array_merge(array(
            'id' => (string) $c->id,
            'number' => $c->number,
            'kind' => $c->kind,
            'contract_no' => $c->contract_no,
            'title' => $c->title,
            'project_id' => (string) $c->project_id,
            'project_name' => $project ? $project->name : '',
            'cost_center_id' => $c->cost_center_id ? (string) $c->cost_center_id : null,
            'counterparty_id' => (string) $c->counterparty_id,
            'counterparty_name' => $party ? $party->name : '',
            'trade_type' => $c->trade_type,
            'amount' => (int) $c->amount,
            'contract_date' => $c->contract_date,
            'start_date' => $c->start_date,
            'end_date' => $c->end_date,
            'duration_days' => (int) $c->duration_days,
            'advance_pct' => Akph_Qty::bp_string($c->advance_bp),
            'retention_pct' => Akph_Qty::bp_string($c->retention_bp),
            'insurance_pct' => Akph_Qty::bp_string($c->insurance_bp),
            'tax_pct' => Akph_Qty::bp_string($c->tax_bp),
            'other_pct' => Akph_Qty::bp_string($c->other_bp),
            'adjustment_base_index' => $c->adjustment_base_index !== null ? rtrim(rtrim((string) $c->adjustment_base_index, '0'), '.') : null,
            'adjustment_factor_pct' => Akph_Qty::bp_string($c->adjustment_factor_bp),
            'description' => $c->description,
            'status' => $c->status,
            'chain' => $chain,
            'step_index' => (int) $c->step_index,
            'current_step' => $c->status === 'pending' && isset($chain[(int) $c->step_index]) ? $chain[(int) $c->step_index] : null,
            'history' => Akph_Flow::history($c->history),
            'last_approved_by' => $c->last_approved_by ? (string) $c->last_approved_by : null,
            'reject_reason' => $c->reject_reason,
            'created_by' => (string) $c->created_by,
            'created_by_name' => Akph_Flow::user_name($c->created_by),
            'created_at' => Akph_Db::iso_time($c->created_at),
            'lines' => $out_lines,
            'amendments' => $amendments,
            'guarantees' => $guarantees,
            'version' => (int) $c->version,
        ), self::figures($c));
    }

    /** Contracts the user may see (project managers: own projects only). */
    public static function list_contracts($kind = '') {
        global $wpdb;
        $scope = Akph_Auth::project_scope_sql('project_id');
        $where = $kind !== '' ? $wpdb->prepare(' AND kind = %s', $kind) : '';
        $rows = Akph_Db::results('SELECT * FROM ' . self::t('contracts') . " WHERE {$scope}{$where} ORDER BY id DESC LIMIT 1000");
        return array_map(array(__CLASS__, 'shape'), (array) $rows);
    }

    public static function contract_or_404($id, $lock = false) {
        $row = $lock ? Akph_Db::lock(self::t('contracts'), $id) : Akph_Db::find(self::t('contracts'), $id);
        if (!$row || !Akph_Auth::can_access_project($row->project_id)) {
            throw Akph_Error::not_found('قرارداد پیدا نشد.');
        }
        return $row;
    }

    /** Totals of the contracts of a project or counterparty (the pages of project and counterparty). */
    public static function summary(array $filters) {
        $all = self::list_contracts();
        $out = array('client' => array(), 'subcontract' => array());
        $keys = array('amount', 'amendments_total', 'current_amount', 'measured_amount', 'approved_amount', 'approved_net', 'settled_amount', 'balance_due', 'remaining_amount', 'advance_amount', 'advance_remaining');
        foreach ($all as $c) {
            if (!empty($filters['project_id']) && $c['project_id'] !== (string) $filters['project_id']) {
                continue;
            }
            if (!empty($filters['counterparty_id']) && $c['counterparty_id'] !== (string) $filters['counterparty_id']) {
                continue;
            }
            if ($c['status'] !== 'active' && $c['status'] !== 'closed') {
                continue;
            }
            $bucket = &$out[$c['kind']];
            foreach ($keys as $k) {
                $bucket[$k] = (isset($bucket[$k]) ? $bucket[$k] : 0) + $c[$k];
            }
            foreach ($c['deductions'] as $type => $amount) {
                $bucket['deductions'][$type] = (isset($bucket['deductions'][$type]) ? $bucket['deductions'][$type] : 0) + $amount;
            }
            $bucket['count'] = (isset($bucket['count']) ? $bucket['count'] : 0) + 1;
            $bucket['guarantees_due_soon'] = (isset($bucket['guarantees_due_soon']) ? $bucket['guarantees_due_soon'] : 0) + count(array_filter($c['guarantees'], function ($g) {
                return $g['due_soon'];
            }));
            unset($bucket);
        }
        return $out;
    }

    // ------------------------------------------------------------------ create / update

    private static function assert_manage() {
        Akph_Auth::assert_cap(Akph_Roles::CONTRACTS_MANAGE, 'ثبت و ویرایش قرارداد با حسابدار، مدیر ارشد یا مدیر سیستم است.');
    }

    /** Validated columns of a contract (without lines). */
    private static function columns($kind, array $body) {
        $project = Akph_Input::id($body, 'project_id', false);
        $p = Akph_Db::find(self::t('projects'), $project);
        if (!$p) {
            throw Akph_Error::invalid('پروژه پیدا نشد.', array('field' => 'project_id'));
        }
        Akph_Auth::assert_project($project);
        $party = Akph_Input::id($body, 'counterparty_id', false);
        $cp = Akph_Db::find(self::t('counterparties'), $party);
        $want = $kind === 'client' ? 'client' : 'subcontractor';
        if (!$cp || $cp->kind !== $want) {
            throw Akph_Error::invalid($kind === 'client' ? 'کارفرما باید طرف حسابی از نوع «کارفرما» باشد.' : 'پیمانکار باید طرف حسابی از نوع «پیمانکار جزء» باشد.', array('field' => 'counterparty_id'));
        }
        $cc = Akph_Input::id($body, 'cost_center_id');
        if ($cc) {
            $center = Akph_Db::find(self::t('cost_centers'), $cc);
            if (!$center || ($center->project_id && (int) $center->project_id !== $project)) {
                throw Akph_Error::invalid('مرکز هزینه متعلق به این پروژه نیست.', array('field' => 'cost_center_id'));
            }
        } elseif ($kind === 'subcontract') {
            throw Akph_Error::invalid('مرکز هزینه قرارداد پیمانکار جزء الزامی است.', array('field' => 'cost_center_id'));
        }
        $start = Akph_Input::iso_date($body, 'start_date', false);
        $end = Akph_Input::iso_date($body, 'end_date', false);
        if ($start && $end && $end < $start) {
            throw Akph_Error::invalid('تاریخ پایان قبل از تاریخ شروع است.', array('field' => 'end_date'));
        }
        $duration = isset($body['duration_days']) && $body['duration_days'] !== '' ? $body['duration_days'] : 0;
        if (!is_int($duration) || $duration < 0 || $duration > 36500) {
            throw Akph_Error::invalid('مدت قرارداد (روز) باید عدد صحیح باشد.', array('field' => 'duration_days'));
        }
        $index = null;
        if (isset($body['adjustment_base_index']) && $body['adjustment_base_index'] !== '' && $body['adjustment_base_index'] !== null) {
            $v = is_float($body['adjustment_base_index']) || is_int($body['adjustment_base_index']) ? (string) $body['adjustment_base_index'] : $body['adjustment_base_index'];
            if (!is_string($v) || !preg_match('/^[0-9]{1,9}(\.[0-9]{1,2})?$/D', $v) || (float) $v <= 0) {
                throw Akph_Error::invalid('شاخص مبنای تعدیل باید عدد مثبت با حداکثر دو رقم اعشار باشد.', array('field' => 'adjustment_base_index'));
            }
            $index = $v;
        }
        return array(
            'contract_no' => Akph_Input::text($body, 'contract_no', 64, true, 'شماره قرارداد'),
            'title' => Akph_Input::text($body, 'title', 190, true, 'عنوان قرارداد'),
            'project_id' => $project,
            'cost_center_id' => $cc ?: null,
            'counterparty_id' => $party,
            'trade_type' => Akph_Input::text($body, 'trade_type', 100, $kind === 'subcontract', 'نوع کار'),
            'contract_date' => Akph_Input::iso_date($body, 'contract_date', false),
            'start_date' => $start,
            'end_date' => $end,
            'duration_days' => $duration,
            'advance_bp' => Akph_Qty::percent_bp($body, 'advance_pct', 'درصد پیش‌پرداخت'),
            'retention_bp' => Akph_Qty::percent_bp($body, 'retention_pct', 'درصد حسن انجام کار'),
            'insurance_bp' => Akph_Qty::percent_bp($body, 'insurance_pct', 'درصد بیمه'),
            'tax_bp' => Akph_Qty::percent_bp($body, 'tax_pct', 'درصد مالیات تکلیفی'),
            'other_bp' => Akph_Qty::percent_bp($body, 'other_pct', 'درصد سایر کسورات'),
            'adjustment_base_index' => $index,
            'adjustment_factor_bp' => $index !== null ? (Akph_Qty::percent_bp($body, 'adjustment_factor_pct', 'ضریب تعدیل') ?: 9500) : 0,
            'description' => Akph_Input::text($body, 'description', 1000),
        );
    }

    /** BOQ lines of the body → rows (quantities in thousandths, amounts computed). */
    private static function parse_lines($body) {
        if (!isset($body['lines']) || !is_array($body['lines']) || !$body['lines']) {
            throw Akph_Error::invalid('حداقل یک ردیف فهرست بها (شرح، واحد، مقدار، نرخ) لازم است.', array('field' => 'lines'));
        }
        if (count($body['lines']) > 500) {
            throw Akph_Error::invalid('حداکثر ۵۰۰ ردیف.', array('field' => 'lines'));
        }
        $out = array();
        $seen = array();
        foreach (array_values($body['lines']) as $i => $l) {
            if (!is_array($l)) {
                throw Akph_Error::invalid('ردیف ' . ($i + 1) . ' نامعتبر است.', array('field' => 'lines'));
            }
            foreach (array_keys($l) as $k) {
                if (!in_array($k, array('code', 'description', 'unit', 'quantity', 'rate'), true)) {
                    throw new Akph_Error('akph_unknown_field', 'فیلد ناشناخته در ردیف: ' . $k, 400, array('field' => 'lines'));
                }
            }
            $desc = Akph_Input::text($l, 'description', 300, true, 'شرح ردیف ' . ($i + 1));
            $unit = Akph_Input::text($l, 'unit', 32, true, 'واحد ردیف ' . ($i + 1));
            $qty = Akph_Qty::parse(isset($l['quantity']) ? $l['quantity'] : null, 'lines', 'مقدار ردیف ' . ($i + 1));
            $rate = Akph_Input::parse_amount(isset($l['rate']) ? $l['rate'] : null, 'نرخ ردیف ' . ($i + 1), 'lines');
            if ($qty <= 0 || $rate <= 0) {
                throw Akph_Error::invalid('مقدار و نرخ ردیف ' . ($i + 1) . ' باید مثبت باشد.', array('field' => 'lines'));
            }
            $key = mb_strtolower($desc . '|' . $unit);
            if (isset($seen[$key])) {
                throw Akph_Error::invalid('ردیف «' . $desc . '» تکراری است.', array('field' => 'lines'));
            }
            $seen[$key] = true;
            $out[] = array('row_no' => $i + 1, 'code' => Akph_Input::text($l, 'code', 32), 'description' => $desc, 'unit' => $unit, 'quantity' => $qty, 'rate' => $rate, 'amount' => Akph_Qty::amount($qty, $rate));
        }
        return $out;
    }

    private static function insert_lines($contract_id, array $lines, $amendment_id = null) {
        $total = 0;
        $now = Akph_Db::now_utc();
        foreach ($lines as $l) {
            Akph_Db::insert(self::t('contract_lines'), array(
                'contract_id' => $contract_id,
                'amendment_id' => $amendment_id,
                'row_no' => $l['row_no'],
                'code' => $l['code'],
                'description' => $l['description'],
                'unit' => $l['unit'],
                'quantity' => Akph_Qty::to_string($l['quantity']),
                'rate' => $l['rate'],
                'amount' => $l['amount'],
                'created_at' => $now,
            ));
            $total += $l['amount'];
        }
        if ($total > Akph_Input::MAX_AMOUNT) {
            throw Akph_Error::invalid('مبلغ قرارداد بیش از حد مجاز است.', array('field' => 'lines'));
        }
        return $total;
    }

    public static function create($kind, array $body) {
        self::assert_manage();
        $cols = self::columns($kind, $body);
        $lines = self::parse_lines($body);
        $year = Akph_Jalali::fiscal_year(Akph_Jalali::today_iso());
        Akph_Numbering::lock(self::prefix($kind), $year);
        $now = Akph_Db::now_utc();
        $id = Akph_Db::insert(self::t('contracts'), $cols + array(
            'kind' => $kind,
            'status' => 'pending',
            'chain' => implode('|', self::chain_for($kind)),
            'step_index' => 0,
            'history' => Akph_Flow::push_history('[]', 'submitted', 'ثبت قرارداد'),
            'created_by' => get_current_user_id(),
            'version' => 1,
            'created_at' => $now,
            'updated_at' => $now,
        ));
        $total = self::insert_lines($id, $lines);
        $number = Akph_Numbering::issue(self::prefix($kind), $year, 'contract', $id);
        Akph_Db::update(self::t('contracts'), array('number' => $number, 'amount' => $total), array('id' => $id));
        $row = Akph_Db::find(self::t('contracts'), $id);
        Akph_Audit::log('contract_created', 'contract', $id, null, (array) $row + array('lines' => count($lines)), $number);
        $next = self::chain_for($kind)[0];
        return array('status' => 201, 'message' => 'قرارداد ' . $number . ' به مبلغ ' . number_format($total) . ' ریال ثبت شد؛ مرحله بعد: تأیید «' . $next . '».', 'id' => $id, 'doc_number' => $number, 'records' => array('contracts' => array(self::shape($row))));
    }

    /** A pending or rejected contract may be edited; the approval starts again. */
    public static function update($id, array $body, $version) {
        self::assert_manage();
        $row = self::contract_or_404($id, true);
        Akph_Input::assert_version($row, $version);
        if (!in_array($row->status, array('pending', 'rejected'), true)) {
            throw Akph_Error::rule('قرارداد تأییدشده فقط با الحاقیه تغییر می‌کند.', array('status' => $row->status));
        }
        $cols = self::columns($row->kind, $body);
        $lines = self::parse_lines($body);
        global $wpdb;
        Akph_Db::exec($wpdb->prepare('DELETE FROM ' . self::t('contract_lines') . ' WHERE contract_id = %d AND amendment_id IS NULL', $id));
        $total = self::insert_lines($id, $lines);
        Akph_Db::update(self::t('contracts'), $cols + array(
            'amount' => $total,
            'status' => 'pending',
            'step_index' => 0,
            'last_approved_by' => null,
            'reject_reason' => '',
            'history' => Akph_Flow::push_history($row->history, 'resubmitted', 'ویرایش و ارسال دوباره'),
            'version' => (int) $row->version + 1,
            'updated_at' => Akph_Db::now_utc(),
        ), array('id' => $id));
        $after = Akph_Db::find(self::t('contracts'), $id);
        Akph_Audit::log('contract_updated', 'contract', $id, (array) $row, (array) $after, $row->number);
        return array('message' => 'قرارداد ' . $row->number . ' ویرایش شد و دوباره در انتظار تأیید است.', 'id' => $id, 'records' => array('contracts' => array(self::shape($after))));
    }

    public static function approve($id, array $body, $version) {
        Akph_Auth::assert_cap(Akph_Roles::CONTRACTS_APPROVE, 'اجازه تأیید قرارداد را ندارید.');
        $comment = Akph_Input::text($body, 'comment', 1000);
        $row = self::contract_or_404($id, true);
        Akph_Input::assert_version($row, $version);
        if ($row->status !== 'pending') {
            throw Akph_Error::conflict('این قرارداد در انتظار تأیید نیست.', array('status' => $row->status));
        }
        $chain = Akph_Flow::chain($row->chain);
        $idx = (int) $row->step_index;
        $step = isset($chain[$idx]) ? $chain[$idx] : Akph_Flow::SENIOR;
        Akph_Flow::assert_step($step, $row->project_id, $row->created_by, $row->last_approved_by);
        $last = !isset($chain[$idx + 1]);
        Akph_Db::update(self::t('contracts'), array(
            'status' => $last ? 'active' : 'pending',
            'step_index' => $idx + 1,
            'last_approved_by' => get_current_user_id(),
            'history' => Akph_Flow::push_history($row->history, 'approved', $step, $comment),
            'version' => (int) $row->version + 1,
            'updated_at' => Akph_Db::now_utc(),
        ), array('id' => $id));
        $after = Akph_Db::find(self::t('contracts'), $id);
        Akph_Audit::log($last ? 'contract_approved' : 'contract_step_approved', 'contract', $id, (array) $row, (array) $after, $row->number);
        return array('message' => $last ? 'قرارداد ' . $row->number . ' تأیید نهایی شد و فعال است.' : 'تأیید «' . $step . '» ثبت شد؛ مرحله بعد: «' . $chain[$idx + 1] . '».', 'id' => $id, 'records' => array('contracts' => array(self::shape($after))));
    }

    public static function reject($id, array $body, $version) {
        Akph_Auth::assert_cap(Akph_Roles::CONTRACTS_APPROVE, 'اجازه رد قرارداد را ندارید.');
        $reason = Akph_Input::text($body, 'reason', 1000, true, 'علت رد');
        $row = self::contract_or_404($id, true);
        Akph_Input::assert_version($row, $version);
        if ($row->status !== 'pending') {
            throw Akph_Error::conflict('این قرارداد در انتظار تأیید نیست.', array('status' => $row->status));
        }
        $chain = Akph_Flow::chain($row->chain);
        $step = isset($chain[(int) $row->step_index]) ? $chain[(int) $row->step_index] : Akph_Flow::SENIOR;
        Akph_Flow::assert_step($step, $row->project_id, $row->created_by, null);
        Akph_Db::update(self::t('contracts'), array('status' => 'rejected', 'reject_reason' => $reason, 'history' => Akph_Flow::push_history($row->history, 'rejected', $step, $reason), 'version' => (int) $row->version + 1, 'updated_at' => Akph_Db::now_utc()), array('id' => $id));
        $after = Akph_Db::find(self::t('contracts'), $id);
        Akph_Audit::log('contract_rejected', 'contract', $id, (array) $row, (array) $after, $row->number);
        return array('message' => 'قرارداد ' . $row->number . ' رد شد.', 'id' => $id, 'records' => array('contracts' => array(self::shape($after))));
    }

    public static function active_or_fail($id) {
        $row = self::contract_or_404($id, true);
        if ($row->status !== 'active') {
            throw Akph_Error::rule('قرارداد ' . $row->number . ' هنوز تأیید نهایی نشده یا بسته است.', array('status' => $row->status));
        }
        return $row;
    }

    // ------------------------------------------------------------------ amendments

    public static function create_amendment($contract_id, array $body) {
        self::assert_manage();
        $year = Akph_Jalali::fiscal_year(Akph_Jalali::today_iso());
        Akph_Numbering::lock('AMD', $year);
        $c = self::active_or_fail($contract_id);
        $lines = self::lines($c->id);
        $measured = self::measured($c->id);
        $extend = isset($body['extend_days']) && $body['extend_days'] !== '' ? $body['extend_days'] : 0;
        if (!is_int($extend) || $extend < 0 || $extend > 36500) {
            throw Akph_Error::invalid('تمدید (روز) باید عدد صحیح نامنفی باشد.', array('field' => 'extend_days'));
        }
        $rows = array();
        $delta = 0;
        foreach (isset($body['lines']) && is_array($body['lines']) ? array_values($body['lines']) : array() as $i => $l) {
            if (!is_array($l)) {
                throw Akph_Error::invalid('ردیف الحاقیه نامعتبر است.', array('field' => 'lines'));
            }
            $n = $i + 1;
            if (!empty($l['contract_line_id'])) {
                $lid = Akph_Input::id($l, 'contract_line_id', false);
                if (!isset($lines[$lid])) {
                    throw Akph_Error::invalid('ردیف ' . $n . ' متعلق به این قرارداد نیست.', array('field' => 'lines'));
                }
                $qty = Akph_Qty::parse(isset($l['quantity_delta']) ? $l['quantity_delta'] : null, 'lines', 'تغییر مقدار ردیف ' . $n, true);
                if ($qty === 0) {
                    throw Akph_Error::invalid('تغییر مقدار ردیف ' . $n . ' صفر است.', array('field' => 'lines'));
                }
                $m = isset($measured[$lid]) ? $measured[$lid]['approved'] + $measured[$lid]['pending'] : 0;
                if ($lines[$lid]['quantity'] + $qty < $m) {
                    throw Akph_Error::rule('کاهش مقدار «' . $lines[$lid]['row']->description . '» کمتر از مقدار اندازه‌گیری‌شده (' . Akph_Qty::to_string($m) . ') مجاز نیست.', array('field' => 'lines'));
                }
                $rate = (int) $lines[$lid]['row']->rate;
                $amount = Akph_Qty::amount($qty, $rate);
                $rows[] = array('contract_line_id' => $lid, 'creates_line' => 0, 'code' => $lines[$lid]['row']->code, 'description' => $lines[$lid]['row']->description, 'unit' => $lines[$lid]['row']->unit, 'rate' => $rate, 'quantity_delta' => Akph_Qty::to_string($qty), 'amount' => $amount);
            } else {
                $desc = Akph_Input::text($l, 'description', 300, true, 'شرح ردیف جدید ' . $n);
                $unit = Akph_Input::text($l, 'unit', 32, true, 'واحد ردیف جدید ' . $n);
                $qty = Akph_Qty::parse(isset($l['quantity_delta']) ? $l['quantity_delta'] : null, 'lines', 'مقدار ردیف جدید ' . $n);
                $rate = Akph_Input::parse_amount(isset($l['rate']) ? $l['rate'] : null, 'نرخ ردیف جدید ' . $n, 'lines');
                if ($qty <= 0 || $rate <= 0) {
                    throw Akph_Error::invalid('مقدار و نرخ ردیف جدید ' . $n . ' باید مثبت باشد.', array('field' => 'lines'));
                }
                $amount = Akph_Qty::amount($qty, $rate);
                $rows[] = array('contract_line_id' => null, 'creates_line' => 1, 'code' => Akph_Input::text($l, 'code', 32), 'description' => $desc, 'unit' => $unit, 'rate' => $rate, 'quantity_delta' => Akph_Qty::to_string($qty), 'amount' => $amount);
            }
            $delta += $amount;
        }
        if (!$rows && $extend === 0) {
            throw Akph_Error::invalid('الحاقیه باید تغییر مقدار، ردیف جدید یا تمدید مدت داشته باشد.', array('field' => 'lines'));
        }
        if ((int) $c->amount + self::figures($c)['amendments_total'] + $delta < 0) {
            throw Akph_Error::rule('مبلغ قرارداد پس از الحاقیه منفی می‌شود.', array('field' => 'lines'));
        }
        $now = Akph_Db::now_utc();
        $id = Akph_Db::insert(self::t('contract_amendments'), array(
            'contract_id' => $c->id,
            'amendment_no' => Akph_Input::text($body, 'amendment_no', 64, true, 'شماره الحاقیه'),
            'amendment_date' => Akph_Input::iso_date($body, 'date', false) ?: Akph_Jalali::today_iso(),
            'amount_delta' => $delta,
            'extend_days' => $extend,
            'description' => Akph_Input::text($body, 'description', 1000),
            'status' => 'pending',
            'created_by' => get_current_user_id(),
            'version' => 1,
            'created_at' => $now,
            'updated_at' => $now,
        ));
        foreach ($rows as $r) {
            Akph_Db::insert(self::t('amendment_lines'), $r + array('amendment_id' => $id));
        }
        $number = Akph_Numbering::issue('AMD', $year, 'contract_amendment', $id);
        Akph_Db::update(self::t('contract_amendments'), array('number' => $number), array('id' => $id));
        $a = Akph_Db::find(self::t('contract_amendments'), $id);
        Akph_Audit::log('amendment_created', 'contract_amendment', $id, null, (array) $a, $number);
        return array('status' => 201, 'message' => 'الحاقیه ' . $number . ' ثبت شد و در انتظار تأیید مدیر ارشد است.', 'id' => $id, 'doc_number' => $number, 'records' => array('contracts' => array(self::shape(Akph_Db::find(self::t('contracts'), $c->id)))));
    }

    private static function amendment_or_404($id) {
        $a = Akph_Db::lock(self::t('contract_amendments'), $id);
        if (!$a) {
            throw Akph_Error::not_found('الحاقیه پیدا نشد.');
        }
        self::contract_or_404($a->contract_id);
        return $a;
    }

    public static function approve_amendment($id, array $body, $version) {
        Akph_Auth::assert_cap(Akph_Roles::CONTRACTS_APPROVE, 'اجازه تأیید الحاقیه را ندارید.');
        $peek = Akph_Db::find(self::t('contract_amendments'), $id);
        if ($peek) {
            self::contract_or_404($peek->contract_id, true); // contract first, then the amendment (lock order)
        }
        $a = self::amendment_or_404($id);
        Akph_Input::assert_version($a, $version);
        if ($a->status !== 'pending') {
            throw Akph_Error::conflict('این الحاقیه در انتظار تأیید نیست.', array('status' => $a->status));
        }
        $c = Akph_Db::find(self::t('contracts'), $a->contract_id);
        Akph_Flow::assert_step(Akph_Flow::SENIOR, $c->project_id, $a->created_by, null);
        global $wpdb;
        // Reductions are checked again against what is measured now.
        $lines = self::lines($c->id);
        $measured = self::measured($c->id);
        $rows = (array) Akph_Db::results($wpdb->prepare('SELECT * FROM ' . self::t('amendment_lines') . ' WHERE amendment_id = %d ORDER BY id', $id));
        $max_row = 0;
        foreach ($lines as $l) {
            $max_row = max($max_row, (int) $l['row']->row_no);
        }
        foreach ($rows as $r) {
            if ((int) $r->creates_line) {
                $qty = Akph_Qty::from_db($r->quantity_delta);
                $line_id = Akph_Db::insert(self::t('contract_lines'), array('contract_id' => $c->id, 'amendment_id' => $id, 'row_no' => ++$max_row, 'code' => $r->code, 'description' => $r->description, 'unit' => $r->unit, 'quantity' => Akph_Qty::to_string($qty), 'rate' => (int) $r->rate, 'amount' => (int) $r->amount, 'created_at' => Akph_Db::now_utc()));
                Akph_Db::update(self::t('amendment_lines'), array('contract_line_id' => $line_id), array('id' => $r->id));
                continue;
            }
            $lid = (int) $r->contract_line_id;
            $m = isset($measured[$lid]) ? $measured[$lid]['approved'] + $measured[$lid]['pending'] : 0;
            if (!isset($lines[$lid]) || $lines[$lid]['quantity'] + Akph_Qty::from_db($r->quantity_delta) < $m) {
                throw Akph_Error::rule('کاهش مقدار «' . $r->description . '» کمتر از مقدار اندازه‌گیری‌شده مجاز نیست.', array('field' => 'lines'));
            }
        }
        $now = Akph_Db::now_utc();
        Akph_Db::update(self::t('contract_amendments'), array('status' => 'approved', 'approved_by' => get_current_user_id(), 'approved_at' => $now, 'version' => (int) $a->version + 1, 'updated_at' => $now), array('id' => $id));
        Akph_Db::update(self::t('contracts'), array('version' => (int) $c->version + 1, 'updated_at' => $now), array('id' => $c->id));
        $after = Akph_Db::find(self::t('contract_amendments'), $id);
        Akph_Audit::log('amendment_approved', 'contract_amendment', $id, (array) $a, (array) $after, $a->number);
        return array('message' => 'الحاقیه ' . $a->number . ' تأیید شد؛ مبلغ و مقادیر قرارداد ' . $c->number . ' به‌روز شد.', 'id' => $id, 'records' => array('contracts' => array(self::shape(Akph_Db::find(self::t('contracts'), $c->id)))));
    }

    public static function reject_amendment($id, array $body, $version) {
        Akph_Auth::assert_cap(Akph_Roles::CONTRACTS_APPROVE, 'اجازه رد الحاقیه را ندارید.');
        $reason = Akph_Input::text($body, 'reason', 1000, true, 'علت رد');
        $a = self::amendment_or_404($id);
        Akph_Input::assert_version($a, $version);
        if ($a->status !== 'pending') {
            throw Akph_Error::conflict('این الحاقیه در انتظار تأیید نیست.', array('status' => $a->status));
        }
        $c = Akph_Db::find(self::t('contracts'), $a->contract_id);
        Akph_Flow::assert_step(Akph_Flow::SENIOR, $c->project_id, $a->created_by, null);
        Akph_Db::update(self::t('contract_amendments'), array('status' => 'rejected', 'reject_reason' => $reason, 'version' => (int) $a->version + 1, 'updated_at' => Akph_Db::now_utc()), array('id' => $id));
        Akph_Audit::log('amendment_rejected', 'contract_amendment', $id, (array) $a, array('status' => 'rejected', 'reason' => $reason), $a->number);
        return array('message' => 'الحاقیه ' . $a->number . ' رد شد.', 'id' => $id, 'records' => array('contracts' => array(self::shape($c))));
    }

    // ------------------------------------------------------------------ guarantees

    public static function create_guarantee($contract_id, array $body) {
        self::assert_manage();
        $c = self::contract_or_404($contract_id, true);
        $amount = Akph_Input::amount($body, 'amount', 'مبلغ ضمانت‌نامه');
        if ($amount <= 0) {
            throw Akph_Error::invalid('مبلغ ضمانت‌نامه باید مثبت باشد.', array('field' => 'amount'));
        }
        $issue = Akph_Input::iso_date($body, 'issue_date', false);
        $due = Akph_Input::iso_date($body, 'due_date', true);
        if ($issue && $due < $issue) {
            throw Akph_Error::invalid('سررسید قبل از تاریخ صدور است.', array('field' => 'due_date'));
        }
        $now = Akph_Db::now_utc();
        $id = Akph_Db::insert(self::t('contract_guarantees'), array(
            'contract_id' => $c->id,
            'kind' => Akph_Input::one_of($body, 'kind', self::GUARANTEE_KINDS),
            'guarantee_no' => Akph_Input::text($body, 'guarantee_no', 64, true, 'شماره ضمانت‌نامه'),
            'bank' => Akph_Input::text($body, 'bank', 100, true, 'بانک صادرکننده'),
            'amount' => $amount,
            'issue_date' => $issue,
            'due_date' => $due,
            'status' => 'active',
            'notes' => Akph_Input::text($body, 'notes', 1000),
            'created_by' => get_current_user_id(),
            'version' => 1,
            'created_at' => $now,
            'updated_at' => $now,
        ));
        $g = Akph_Db::find(self::t('contract_guarantees'), $id);
        Akph_Audit::log('guarantee_created', 'contract_guarantee', $id, null, (array) $g, $c->number);
        return array('status' => 201, 'message' => 'ضمانت‌نامه ' . $g->guarantee_no . ' برای قرارداد ' . $c->number . ' ثبت شد.', 'id' => $id, 'records' => array('contracts' => array(self::shape($c))));
    }

    public static function update_guarantee($id, array $body, $version) {
        self::assert_manage();
        $peek = Akph_Db::find(self::t('contract_guarantees'), $id);
        if (!$peek) {
            throw Akph_Error::not_found('ضمانت‌نامه پیدا نشد.');
        }
        $c = self::contract_or_404($peek->contract_id, true);
        $g = Akph_Db::lock(self::t('contract_guarantees'), $id);
        Akph_Input::assert_version($g, $version);
        $data = array();
        if (array_key_exists('status', $body)) {
            $data['status'] = Akph_Input::one_of($body, 'status', self::GUARANTEE_STATUSES);
        }
        if (array_key_exists('due_date', $body)) {
            $data['due_date'] = Akph_Input::iso_date($body, 'due_date', true);
        }
        if (array_key_exists('notes', $body)) {
            $data['notes'] = Akph_Input::text($body, 'notes', 1000);
        }
        if (!$data) {
            throw Akph_Error::invalid('تغییری فرستاده نشده است.');
        }
        Akph_Db::update(self::t('contract_guarantees'), $data + array('version' => (int) $g->version + 1, 'updated_at' => Akph_Db::now_utc()), array('id' => $id));
        Akph_Audit::log('guarantee_updated', 'contract_guarantee', $id, (array) $g, $data, $c->number);
        return array('message' => 'ضمانت‌نامه ' . $g->guarantee_no . ' به‌روز شد.', 'id' => $id, 'records' => array('contracts' => array(self::shape($c))));
    }

    /** Active guarantees due within DUE_SOON_DAYS (or past due) of contracts the user may see. */
    public static function guarantees_due() {
        global $wpdb;
        $scope = Akph_Auth::project_scope_sql('c.project_id');
        $limit = gmdate('Y-m-d', strtotime(Akph_Jalali::today_iso()) + self::DUE_SOON_DAYS * DAY_IN_SECONDS);
        $rows = (array) Akph_Db::results($wpdb->prepare(
            'SELECT g.*, c.number AS contract_number, c.title AS contract_title, c.project_id FROM ' . self::t('contract_guarantees') . ' g JOIN ' . self::t('contracts') . " c ON c.id = g.contract_id
             WHERE g.status = 'active' AND g.due_date <= %s AND {$scope} ORDER BY g.due_date",
            $limit
        ));
        return array_map(function ($g) {
            return self::guarantee_shape($g) + array('contract_number' => $g->contract_number, 'contract_title' => $g->contract_title, 'project_id' => (string) $g->project_id);
        }, $rows);
    }

    // ------------------------------------------------------------------ advances

    /** Subcontract advance: a treasury payment request (payable 11402), paid only by the treasury. */
    public static function request_advance($contract_id, array $body) {
        self::assert_manage();
        $amount = Akph_Input::amount($body, 'amount', 'مبلغ پیش‌پرداخت');
        if ($amount <= 0) {
            throw Akph_Error::invalid('مبلغ پیش‌پرداخت باید مثبت باشد.', array('field' => 'amount'));
        }
        Akph_Numbering::lock('PAY', Akph_Jalali::fiscal_year(Akph_Jalali::today_iso()));
        $c = self::active_or_fail($contract_id);
        if ($c->kind !== 'subcontract') {
            throw Akph_Error::rule('پیش‌پرداخت کارفرما فقط با «دریافت» خزانه (نوع پیش‌دریافت) ثبت می‌شود.', array('field' => 'amount'));
        }
        global $wpdb;
        $requested = (int) Akph_Db::value($wpdb->prepare('SELECT COALESCE(SUM(amount), 0) FROM ' . self::t('payment_requests') . " WHERE source_type = 'contract_advance' AND source_id = %d AND status <> 'rejected'", $c->id));
        $allowed = self::figures($c)['advance_expected'];
        if ($requested + $amount > $allowed) {
            throw Akph_Error::rule('جمع پیش‌پرداخت (' . number_format($requested + $amount) . ' ریال) از سقف پیش‌پرداخت قرارداد (' . number_format($allowed) . ' ریال) بیشتر است.', array('field' => 'amount'));
        }
        Akph_Posting::account(Akph_Treasury::PAYABLE_ACCOUNTS['subcontractor_advance'], 'پیش‌پرداخت پیمانکاران');
        $party = Akph_Db::find(self::t('counterparties'), $c->counterparty_id);
        $row = Akph_Treasury::create_request_internal(array(
            'source_type' => 'contract_advance',
            'source_id' => $c->id,
            'payable_type' => 'subcontractor_advance',
            'debit_account_code' => Akph_Treasury::PAYABLE_ACCOUNTS['subcontractor_advance'],
            'project_id' => $c->project_id,
            'cost_center_id' => $c->cost_center_id,
            'counterparty_id' => $c->counterparty_id,
            'beneficiary_name' => $party ? $party->name : $c->title,
            'beneficiary_type' => 'پیمانکار جزء',
            'beneficiary_sheba' => $party ? (string) $party->sheba : '',
            'amount' => $amount,
            'due_date' => Akph_Input::iso_date($body, 'due_date', false),
            'description' => 'پیش‌پرداخت قرارداد ' . $c->number . ' - ' . $c->title,
        ));
        return array('status' => 201, 'message' => 'درخواست پیش‌پرداخت ' . $row->number . ' در خزانه ثبت شد و در انتظار تأیید است.', 'id' => $row->id, 'doc_number' => $row->number, 'records' => array('payment_requests' => array(Akph_Treasury::request_shape($row)), 'contracts' => array(self::shape($c))));
    }
}
