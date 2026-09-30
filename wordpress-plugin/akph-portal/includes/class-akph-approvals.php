<?php
/**
 * Approval center (reference: selectApprovals in src/store/domainSelectors.ts, useApprovalActions in
 * src/store/useApprovalActions.ts; docs/SERVER-RULES.md §2).
 *
 * GET /approvals gathers every record of the server modules whose current step waits for the signed-in user:
 * pending journal entries (manual, reversal, petty cash count adjustment, bank reconciliation voucher), petty
 * cash expenses, replenishment requests, payment requests and receipts. Only items the user may act on now are
 * listed: the step belongs to the user's role (and project, for a project manager), the user is neither the
 * creator nor the approver of the previous step, and the amount is within the user's approval threshold.
 *
 * Each item names the route of its own module (approve_path / reject_path): approving or rejecting always runs
 * the owning module's command; nothing is copied here.
 */
if (!defined('ABSPATH')) {
    exit;
}

final class Akph_Approvals {
    const LIMIT = 500;

    /** @var array<int,string>|null project names of the current listing */
    private static $names = null;

    private static function project_names() {
        if (self::$names === null) {
            self::$names = array();
            foreach ((array) Akph_Db::results('SELECT id, name FROM ' . Akph_Schema::table('projects')) as $p) {
                self::$names[(int) $p->id] = $p->name;
            }
        }
        return self::$names;
    }

    private static function item($module, $label, $row_id, array $d) {
        $names = self::project_names();
        $project = !empty($d['project_id']) ? (int) $d['project_id'] : 0;
        return array(
            'id' => $module . ':' . $row_id,
            'module' => $module,
            'module_label' => $label,
            'record_id' => (string) $row_id,
            'doc_number' => (string) $d['doc_number'],
            'title' => (string) $d['title'],
            'amount' => (int) $d['amount'],
            'requester_id' => (string) (int) $d['requester_id'],
            'requester' => Akph_Flow::user_name($d['requester_id']),
            'previous_approver_id' => !empty($d['previous_approver_id']) ? (string) (int) $d['previous_approver_id'] : null,
            'project_id' => $project ? (string) $project : null,
            'project_name' => $project && isset($names[$project]) ? $names[$project] : '',
            'date' => (string) $d['date'],
            'stage' => (string) $d['stage'],
            'approver_role' => (string) $d['approver_role'],
            'version' => (int) $d['version'],
            'approve_path' => $d['approve_path'],
            'reject_path' => $d['reject_path'],
            'entity_type' => isset($d['entity_type']) ? $d['entity_type'] : '',
        );
    }

    /** Items waiting for the current user, newest first. */
    public static function for_current_user() {
        $uid = get_current_user_id();
        self::$names = null;
        $items = array_merge(
            self::journal($uid),
            self::petty_expenses($uid),
            self::petty_requests($uid),
            self::payment_requests($uid),
            self::receipts($uid),
            self::contracts($uid),
            self::amendments($uid),
            self::statements($uid)
        );
        usort($items, function ($a, $b) {
            return strcmp($b['date'], $a['date']) ?: strcmp($b['id'], $a['id']);
        });
        return array('items' => array_slice($items, 0, self::LIMIT), 'total' => count($items));
    }

    private static function journal($uid) {
        if (!current_user_can(Akph_Roles::JOURNAL_APPROVE) || !Akph_Auth::view_all()) {
            return array();
        }
        global $wpdb;
        $e = Akph_Ledger::entries_table();
        $rows = Akph_Db::results($wpdb->prepare(
            "SELECT e.*, ev.source AS event_source FROM {$e} e LEFT JOIN " . Akph_Posting::events_table() . " ev ON ev.entry_id = e.id WHERE e.status = 'pending' AND e.created_by <> %d ORDER BY e.id DESC LIMIT %d",
            $uid,
            self::LIMIT
        ));
        $out = array();
        foreach ((array) $rows as $r) {
            if ($r->source_type === 'reversal' || Akph_Ledger::reversal_target($r) > 0) {
                list($module, $label) = array('journal_reversal', 'سند معکوس');
            } elseif ($r->event_source === 'petty_count') {
                list($module, $label) = array('petty_adjustment', 'سند تعدیل شمارش تنخواه');
            } elseif ($r->event_source === 'bank_line') {
                list($module, $label) = array('bank_voucher', 'سند مغایرت بانکی');
            } else {
                list($module, $label) = array('journal_entry', 'سند حسابداری');
            }
            $out[] = self::item($module, $label, $r->id, array(
                'doc_number' => $r->draft_number,
                'title' => $r->description,
                'amount' => (int) $r->total,
                'requester_id' => $r->created_by,
                'project_id' => $r->project_id,
                'date' => $r->entry_date,
                'stage' => 'تأیید و قطعی‌کردن سند',
                'approver_role' => Akph_Flow::ACCOUNTANT,
                'version' => $r->version,
                'approve_path' => '/journal-entries/' . $r->id . '/post',
                'reject_path' => '/journal-entries/' . $r->id . '/reject',
                'entity_type' => 'journal_entry',
            ));
        }
        return $out;
    }

    /** Pending rows of a chained petty cash table the user may act on. */
    private static function chained($table, $creator_col, $uid) {
        if (!current_user_can(Akph_Roles::PETTY_APPROVE)) {
            return array();
        }
        global $wpdb;
        $scope = Akph_Auth::project_scope_sql('project_id');
        $rows = Akph_Db::results($wpdb->prepare(
            'SELECT * FROM ' . Akph_Schema::table($table) . " WHERE status = 'pending' AND {$creator_col} <> %d AND (last_approved_by IS NULL OR last_approved_by <> %d) AND {$scope} ORDER BY id DESC LIMIT %d",
            $uid,
            $uid,
            self::LIMIT
        ));
        $out = array();
        foreach ((array) $rows as $r) {
            $chain = Akph_Flow::chain($r->chain);
            $step = isset($chain[(int) $r->step_index]) ? $chain[(int) $r->step_index] : Akph_Flow::ACCOUNTANT;
            if (Akph_Flow::can_act($step, $r->project_id)) {
                $out[] = array($r, $step);
            }
        }
        return $out;
    }

    private static function petty_expenses($uid) {
        $out = array();
        foreach (self::chained('petty_expenses', 'submitted_by', $uid) as $pair) {
            list($r, $step) = $pair;
            $out[] = self::item('petty_cash_expense', 'هزینه تنخواه', $r->id, array(
                'doc_number' => $r->number,
                'title' => $r->description . ($r->vendor !== '' ? ' — ' . $r->vendor : ''),
                'amount' => (int) $r->amount,
                'requester_id' => $r->submitted_by,
                'previous_approver_id' => $r->last_approved_by,
                'project_id' => $r->project_id,
                'date' => $r->expense_date,
                'stage' => 'تأیید ' . $step,
                'approver_role' => $step,
                'version' => $r->version,
                'approve_path' => '/petty-cash/expenses/' . $r->id . '/approve',
                'reject_path' => '/petty-cash/expenses/' . $r->id . '/reject',
                'entity_type' => 'petty_expense',
            ));
        }
        return $out;
    }

    private static function petty_requests($uid) {
        $out = array();
        foreach (self::chained('petty_requests', 'requested_by', $uid) as $pair) {
            list($r, $step) = $pair;
            $fund = Akph_Db::find(Akph_Schema::table('petty_funds'), $r->fund_id);
            $out[] = self::item('petty_replenishment', 'درخواست شارژ تنخواه', $r->id, array(
                'doc_number' => $r->number,
                'title' => 'شارژ ' . ($fund ? $fund->title : 'تنخواه') . ': ' . $r->reason,
                'amount' => (int) $r->amount,
                'requester_id' => $r->requested_by,
                'previous_approver_id' => $r->last_approved_by,
                'project_id' => $r->project_id,
                'date' => $r->request_date,
                'stage' => 'تأیید ' . $step,
                'approver_role' => $step,
                'version' => $r->version,
                'approve_path' => '/petty-cash/requests/' . $r->id . '/approve',
                'reject_path' => '/petty-cash/requests/' . $r->id . '/reject',
                'entity_type' => 'petty_request',
            ));
        }
        return $out;
    }

    private static function payment_requests($uid) {
        if (!current_user_can(Akph_Roles::PAYMENT_APPROVE)) {
            return array();
        }
        global $wpdb;
        $scope = Akph_Auth::project_scope_sql('project_id');
        $rows = Akph_Db::results($wpdb->prepare(
            'SELECT * FROM ' . Akph_Schema::table('payment_requests') . " WHERE status = 'pending' AND requested_by <> %d AND {$scope} ORDER BY id DESC LIMIT %d",
            $uid,
            self::LIMIT
        ));
        $senior = Akph_Treasury::settings()['payment_senior_threshold'];
        $out = array();
        foreach ((array) $rows as $r) {
            if (!Akph_Treasury::may_approve_amount($r->amount)) {
                continue;
            }
            $role = (int) $r->amount > $senior ? Akph_Flow::SENIOR : Akph_Flow::ACCOUNTANT;
            $out[] = self::item('payment_request', 'درخواست پرداخت', $r->id, array(
                'doc_number' => $r->number,
                'title' => $r->beneficiary_name . ($r->description !== '' ? ': ' . $r->description : ''),
                'amount' => (int) $r->amount,
                'requester_id' => $r->requested_by,
                'project_id' => $r->project_id,
                'date' => $r->request_date,
                'stage' => 'تأیید پرداخت (' . $role . ')',
                'approver_role' => $role,
                'version' => $r->version,
                'approve_path' => '/payment-requests/' . $r->id . '/approve',
                'reject_path' => '/payment-requests/' . $r->id . '/reject',
                'entity_type' => 'payment_request',
            ));
        }
        return $out;
    }

    private static function receipts($uid) {
        if (!current_user_can(Akph_Roles::PAYMENT_APPROVE)) {
            return array();
        }
        global $wpdb;
        $scope = Akph_Auth::project_scope_sql('project_id');
        $rows = Akph_Db::results($wpdb->prepare(
            'SELECT * FROM ' . Akph_Schema::table('receipts') . " WHERE status = 'pending' AND created_by <> %d AND {$scope} ORDER BY id DESC LIMIT %d",
            $uid,
            self::LIMIT
        ));
        $out = array();
        foreach ((array) $rows as $r) {
            $out[] = self::item('receipt', 'دریافت', $r->id, array(
                'doc_number' => $r->number,
                'title' => 'دریافت از ' . $r->payer_name . ($r->description !== '' ? ': ' . $r->description : ''),
                'amount' => (int) $r->amount,
                'requester_id' => $r->created_by,
                'project_id' => $r->project_id,
                'date' => $r->receipt_date,
                'stage' => 'تأیید دریافت',
                'approver_role' => Akph_Flow::ACCOUNTANT,
                'version' => $r->version,
                'approve_path' => '/receipts/' . $r->id . '/approve',
                'reject_path' => '/receipts/' . $r->id . '/reject',
                'entity_type' => 'receipt',
            ));
        }
        return $out;
    }

    // ------------------------------------------------------------------ 0.7.0: contracts, amendments, statements

    private static function contracts($uid) {
        if (!current_user_can(Akph_Roles::CONTRACTS_APPROVE)) {
            return array();
        }
        global $wpdb;
        $scope = Akph_Auth::project_scope_sql('project_id');
        $rows = Akph_Db::results($wpdb->prepare(
            'SELECT * FROM ' . Akph_Schema::table('contracts') . " WHERE status = 'pending' AND created_by <> %d AND (last_approved_by IS NULL OR last_approved_by <> %d) AND {$scope} ORDER BY id DESC LIMIT %d",
            $uid,
            $uid,
            self::LIMIT
        ));
        $out = array();
        foreach ((array) $rows as $r) {
            $chain = Akph_Flow::chain($r->chain);
            $step = isset($chain[(int) $r->step_index]) ? $chain[(int) $r->step_index] : Akph_Flow::SENIOR;
            if (!Akph_Flow::can_act($step, $r->project_id)) {
                continue;
            }
            $out[] = self::item('contract', $r->kind === 'client' ? 'قرارداد کارفرما' : 'قرارداد پیمانکار جزء', $r->id, array(
                'doc_number' => $r->number,
                'title' => $r->title . ' (' . $r->contract_no . ')',
                'amount' => (int) $r->amount,
                'requester_id' => $r->created_by,
                'previous_approver_id' => $r->last_approved_by,
                'project_id' => $r->project_id,
                'date' => substr((string) $r->created_at, 0, 10),
                'stage' => 'تأیید ' . $step,
                'approver_role' => $step,
                'version' => $r->version,
                'approve_path' => '/contracts/' . $r->id . '/approve',
                'reject_path' => '/contracts/' . $r->id . '/reject',
                'entity_type' => 'contract',
            ));
        }
        return $out;
    }

    private static function amendments($uid) {
        if (!current_user_can(Akph_Roles::CONTRACTS_APPROVE) || !Akph_Flow::can_act(Akph_Flow::SENIOR, 0)) {
            return array();
        }
        global $wpdb;
        $rows = Akph_Db::results($wpdb->prepare(
            'SELECT a.*, c.project_id, c.title AS contract_title, c.number AS contract_number FROM ' . Akph_Schema::table('contract_amendments') . ' a JOIN ' . Akph_Schema::table('contracts') . " c ON c.id = a.contract_id WHERE a.status = 'pending' AND a.created_by <> %d ORDER BY a.id DESC LIMIT %d",
            $uid,
            self::LIMIT
        ));
        $out = array();
        foreach ((array) $rows as $r) {
            $out[] = self::item('contract_amendment', 'الحاقیه قرارداد', $r->id, array(
                'doc_number' => $r->number,
                'title' => 'الحاقیه ' . $r->amendment_no . ' قرارداد ' . $r->contract_number . ' - ' . $r->contract_title,
                'amount' => (int) $r->amount_delta,
                'requester_id' => $r->created_by,
                'project_id' => $r->project_id,
                'date' => (string) $r->amendment_date,
                'stage' => 'تأیید مدیر ارشد',
                'approver_role' => Akph_Flow::SENIOR,
                'version' => $r->version,
                'approve_path' => '/contract-amendments/' . $r->id . '/approve',
                'reject_path' => '/contract-amendments/' . $r->id . '/reject',
                'entity_type' => 'contract',
            ));
        }
        return $out;
    }

    /** Statements whose current step (preparation or approval) the user may take now. */
    private static function statements($uid) {
        global $wpdb;
        $scope = Akph_Auth::project_scope_sql('project_id');
        $in = "'" . implode("','", array_merge(array_keys(Akph_Statements::CLIENT_FLOW), array_keys(Akph_Statements::SUB_FLOW))) . "'";
        $rows = Akph_Db::results($wpdb->prepare('SELECT * FROM ' . Akph_Schema::table('statements') . " WHERE status IN ({$in}) AND {$scope} ORDER BY id DESC LIMIT %d", self::LIMIT));
        $out = array();
        foreach ((array) $rows as $r) {
            $flow = Akph_Statements::flow($r->kind);
            list(, $role, $label, $approval) = $flow[$r->status];
            if ($approval) {
                if (!current_user_can(Akph_Roles::CONTRACTS_APPROVE) || (int) $r->created_by === $uid || ((int) $r->last_approved_by === $uid && $uid > 0)) {
                    continue;
                }
            } elseif (!current_user_can(Akph_Roles::STATEMENTS_PREPARE)) {
                continue;
            }
            if (!Akph_Flow::can_act($role, $r->project_id)) {
                continue;
            }
            $out[] = self::item($r->kind === 'client' ? 'client_statement' : 'subcontractor_statement', $r->kind === 'client' ? 'صورت‌وضعیت کارفرما' : 'صورت‌وضعیت پیمانکار جزء', $r->id, array(
                'doc_number' => $r->number,
                'title' => $r->title,
                'amount' => (int) $r->gross_amount,
                'requester_id' => $r->created_by,
                'previous_approver_id' => $r->last_approved_by,
                'project_id' => $r->project_id,
                'date' => (string) $r->period_end,
                'stage' => $label,
                'approver_role' => $role,
                'version' => $r->version,
                'approve_path' => '/statements/' . $r->id . '/approve',
                'reject_path' => '/statements/' . $r->id . '/return',
                'entity_type' => $r->kind === 'client' ? 'client_statement' : 'subcontractor_statement',
            )) + array('requires' => $r->kind === 'client' && $r->status === 'approved_by_consultant' ? array('employer_ref', 'employer_date') : array());
        }
        return $out;
    }
}
