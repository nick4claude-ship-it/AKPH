<?php
/**
 * Posting engine of the server (reference: preparePosting / applyPosting in src/store/postingEngine.ts and
 * the rules of src/store/postingRules.ts, docs/SERVER-RULES.md §3).
 *
 * A business event (petty cash expense approved, payment made, receipt approved, …) becomes one ledger entry
 * in the same akph_ledger_* tables as manual entries:
 *   - key (source, source_id, event_type) is unique in akph_ledger_events: the same event never creates a
 *     second entry (a repeated call returns the first one);
 *   - accounts are looked up in the chart by code; a code that is missing or not postable stops the command
 *     with a clear message and nothing is written;
 *   - lines are integer Rials, Σ debit = Σ credit > 0; the date must be in an open fiscal year, not after
 *     today and not before the last final entry of its year (numbers follow dates);
 *   - a final entry gets its ACC number at once (the approving user is recorded as its approver); a pending
 *     entry (count adjustments, bank reconciliation vouchers) gets a DRF number and becomes final only when
 *     another user posts it in the journal (Akph_Ledger::post).
 *
 * Cash lines carry cash_ref ('tre:ID' bank account or cash desk, 'pcf:ID' petty cash fund): balances of banks,
 * cash desks and funds are always Σ(debit − credit) of the final lines with that reference, never a stored
 * number.
 *
 * Lock order: a command that may post calls lock_year() before it locks any row (the ACC numbering anchor of
 * the year serialises every final posting, so balances read after it are consistent), then its own rows.
 */
if (!defined('ABSPATH')) {
    exit;
}

final class Akph_Posting {
    public static function events_table() {
        return Akph_Schema::table('ledger_events');
    }

    /** Fiscal year of a posting date after checking it (valid, open year, not in the future). */
    public static function year_for($date) {
        if (!Akph_Jalali::valid_iso($date)) {
            throw Akph_Error::invalid('تاریخ باید میلادی و به شکل YYYY-MM-DD باشد.', array('field' => 'date'));
        }
        if ($date > Akph_Jalali::today_iso()) {
            throw Akph_Error::rule('تاریخ (' . Akph_Jalali::format($date) . ') نمی‌تواند بعد از امروز باشد.', array('field' => 'date'));
        }
        $year = Akph_Jalali::fiscal_year($date);
        if (Akph_Settings::is_closed_year($year)) {
            throw Akph_Error::rule('سال مالی ' . $year . ' بسته شده است؛ ثبت سند در آن ممکن نیست.', array('field' => 'date'));
        }
        return $year;
    }

    /** First lock of a command that posts on `$date`: the numbering anchor of its year (ACC; DRF too for pending entries). */
    public static function lock_year($date, $pending = false) {
        $year = self::year_for($date);
        Akph_Numbering::lock('ACC', $year);
        if ($pending) {
            Akph_Numbering::lock('DRF', $year);
        }
        return $year;
    }

    /** Postable account by code, or a clear rule error naming the account and what it is for. */
    public static function account($code, $label = '') {
        $row = Akph_Accounts::by_code((string) $code);
        $name = '«' . $code . ($label !== '' ? ' - ' . $label : '') . '»';
        if (!$row) {
            throw Akph_Error::rule('حساب ' . $name . ' در کدینگ تعریف نشده است؛ آن را در کدینگ حساب‌ها اضافه کنید (پیشخوان ← پرتال AKPH ← انتقال و کدینگ). هیچ سندی ثبت نشد.', array('account_code' => (string) $code));
        }
        if (!Akph_Accounts::postable($row, Akph_Accounts::has_children($row->code))) {
            throw Akph_Error::rule('حساب ' . $name . ' گروهی یا غیرفعال است و قابل ثبت نیست؛ یک حساب معین/تفصیلی بدون زیرحساب انتخاب کنید. هیچ سندی ثبت نشد.', array('account_code' => (string) $code));
        }
        return $row;
    }

    /** Is `$code` a postable account? (validation of settings: fund, bank and category accounts) */
    public static function assert_postable($code, $field, $label) {
        if (!is_string($code) || !preg_match('/^[0-9]{1,16}$/D', $code)) {
            throw Akph_Error::invalid($label . ': کد حساب معتبر نیست.', array('field' => $field));
        }
        try {
            self::account($code, $label);
        } catch (Akph_Error $e) {
            throw new Akph_Error($e->error_code(), $e->getMessage(), $e->status(), array('field' => $field, 'account_code' => $code));
        }
        return $code;
    }

    /** Entry already posted for this event, or null. */
    public static function find_event($source, $source_id, $type) {
        global $wpdb;
        return Akph_Db::row($wpdb->prepare('SELECT * FROM ' . self::events_table() . ' WHERE source = %s AND source_id = %d AND event_type = %s', $source, (int) $source_id, $type));
    }

    /**
     * Posts one event. $e: source, source_id, type, date, description, entry_type, project_id (optional),
     * pending (bool), lines: [code, label, debit, credit, project_id, cost_center_id, counterparty_id, cash_ref,
     * description]. Returns ['entry' => row, 'duplicate' => bool]. The caller holds lock_year($date, pending).
     */
    public static function post(array $e) {
        $existing = self::find_event($e['source'], $e['source_id'], $e['type']);
        if ($existing) {
            return array('entry' => Akph_Db::find(Akph_Ledger::entries_table(), $existing->entry_id), 'duplicate' => true);
        }
        $pending = !empty($e['pending']);
        $date = $e['date'];
        $year = self::year_for($date);
        $lines = array();
        $debit = 0;
        $credit = 0;
        foreach ($e['lines'] as $i => $l) {
            $d = (int) (isset($l['debit']) ? $l['debit'] : 0);
            $c = (int) (isset($l['credit']) ? $l['credit'] : 0);
            if ($d < 0 || $c < 0 || ($d > 0) === ($c > 0)) {
                throw new Akph_Error('akph_internal', 'ردیف سند خودکار نامعتبر است.', 500);
            }
            $account = self::account($l['code'], isset($l['label']) ? $l['label'] : '');
            $lines[] = array(
                'line_no' => $i + 1,
                'account_id' => (int) $account->id,
                'account_code' => $account->code,
                'project_id' => !empty($l['project_id']) ? (int) $l['project_id'] : null,
                'cost_center_id' => !empty($l['cost_center_id']) ? (int) $l['cost_center_id'] : null,
                'counterparty_id' => !empty($l['counterparty_id']) ? (int) $l['counterparty_id'] : null,
                'cash_ref' => !empty($l['cash_ref']) ? (string) $l['cash_ref'] : null,
                'description' => mb_substr((string) (isset($l['description']) ? $l['description'] : ''), 0, 500),
                'debit' => $d,
                'credit' => $c,
            );
            $debit += $d;
            $credit += $c;
        }
        if (count($lines) < 2 || $debit !== $credit || $debit <= 0 || $debit > Akph_Input::MAX_AMOUNT) {
            throw Akph_Error::rule('سند خودکار نامتوازن است؛ ثبت انجام نشد.', array('debit' => $debit, 'credit' => $credit));
        }
        if (!$pending) {
            Akph_Ledger::check_posting_date($date, $year);
        }
        $now = Akph_Db::now_utc();
        $uid = get_current_user_id();
        $id = Akph_Db::insert(Akph_Ledger::entries_table(), array(
            'doc_number' => null,
            'draft_number' => '',
            'fiscal_year' => $year,
            'entry_date' => $date,
            'description' => mb_substr((string) $e['description'], 0, 1000),
            'entry_type' => isset($e['entry_type']) ? $e['entry_type'] : 'general',
            'source_type' => 'event',
            'project_id' => !empty($e['project_id']) ? (int) $e['project_id'] : null,
            'status' => $pending ? 'pending' : 'posted',
            'total' => $debit,
            'created_by' => $uid,
            'created_at' => $now,
            'approved_by' => $pending ? null : $uid,
            'approved_at' => $pending ? null : $now,
            'version' => 1,
            'updated_at' => $now,
        ));
        foreach ($lines as $line) {
            Akph_Db::insert(Akph_Ledger::lines_table(), $line + array('entry_id' => $id));
        }
        if ($pending) {
            $number = Akph_Numbering::issue('DRF', $year, 'entry_draft', $id);
            Akph_Db::update(Akph_Ledger::entries_table(), array('draft_number' => $number), array('id' => $id));
        } else {
            $number = Akph_Numbering::issue('ACC', $year, 'entry', $id);
            Akph_Db::update(Akph_Ledger::entries_table(), array('doc_number' => $number), array('id' => $id));
        }
        Akph_Db::insert(self::events_table(), array(
            'source' => (string) $e['source'],
            'source_id' => (int) $e['source_id'],
            'event_type' => (string) $e['type'],
            'entry_id' => $id,
            'created_by' => $uid,
            'created_at' => $now,
        ));
        Akph_Audit::log($pending ? 'entry_created' : 'entry_posted', 'entry', $id, null, array('event' => $e['type'], 'source' => $e['source'], 'source_id' => (int) $e['source_id'], 'total' => $debit), $number);
        return array('entry' => Akph_Db::find(Akph_Ledger::entries_table(), $id), 'duplicate' => false);
    }

    /** Book balance of a cash reference (final lines only). */
    public static function balance($cash_ref) {
        global $wpdb;
        return (int) Akph_Db::value($wpdb->prepare(
            'SELECT COALESCE(SUM(l.debit) - SUM(l.credit), 0) FROM ' . Akph_Ledger::lines_table() . ' l JOIN ' . Akph_Ledger::entries_table() . " e ON e.id = l.entry_id WHERE l.cash_ref = %s AND e.status = 'posted'",
            $cash_ref
        ));
    }

    /** Balances of many references at once: ref => balance. */
    public static function balances(array $refs) {
        global $wpdb;
        $out = array_fill_keys($refs, 0);
        if (!$refs) {
            return $out;
        }
        $in = implode(',', array_map(function ($r) use ($wpdb) {
            return $wpdb->prepare('%s', $r);
        }, $refs));
        $rows = Akph_Db::results('SELECT l.cash_ref, SUM(l.debit) - SUM(l.credit) AS bal FROM ' . Akph_Ledger::lines_table() . ' l JOIN ' . Akph_Ledger::entries_table() . " e ON e.id = l.entry_id WHERE e.status = 'posted' AND l.cash_ref IN ({$in}) GROUP BY l.cash_ref");
        foreach ((array) $rows as $r) {
            $out[$r->cash_ref] = (int) $r->bal;
        }
        return $out;
    }

    /** Refuses a credit that would take a cash reference below zero. */
    public static function assert_available($cash_ref, $amount, $title) {
        $balance = self::balance($cash_ref);
        if ($balance < $amount) {
            throw Akph_Error::rule('موجودی ' . $title . ' (' . number_format($balance) . ' ریال) برای این مبلغ (' . number_format($amount) . ' ریال) کافی نیست؛ موجودی منفی مجاز نیست.', array('balance' => $balance, 'amount' => (int) $amount));
        }
        return $balance;
    }

    /** Before a pending automatic entry is posted: its net credit on each cash reference must be available. */
    public static function assert_pending_cash($entry_id) {
        global $wpdb;
        $rows = Akph_Db::results($wpdb->prepare('SELECT cash_ref, SUM(credit) - SUM(debit) AS net FROM ' . Akph_Ledger::lines_table() . ' WHERE entry_id = %d AND cash_ref IS NOT NULL GROUP BY cash_ref', $entry_id));
        foreach ((array) $rows as $r) {
            if ((int) $r->net > 0) {
                self::assert_available($r->cash_ref, (int) $r->net, strpos($r->cash_ref, 'pcf:') === 0 ? 'تنخواه' : 'حساب بانکی/صندوق');
            }
        }
    }

    /**
     * A pending automatic entry was rejected in the journal: the event may be posted again (its key is kept
     * for the record with a suffix) and a bank statement line waiting on it is unmatched again.
     */
    public static function release_event($entry_id) {
        global $wpdb;
        Akph_Db::exec($wpdb->prepare('UPDATE ' . self::events_table() . " SET event_type = LEFT(CONCAT(event_type, '#R', entry_id), 40) WHERE entry_id = %d", $entry_id));
        Akph_Db::exec($wpdb->prepare('UPDATE ' . Akph_Schema::table('bank_statement_lines') . " SET status = 'unmatched', matched_line_id = NULL, voucher_entry_id = NULL, matched_by = NULL, version = version + 1 WHERE voucher_entry_id = %d", $entry_id));
    }

    /** Movements of a cash reference (final entries), oldest first, with the running balance. */
    public static function movements($cash_ref, $limit = 500) {
        global $wpdb;
        $rows = Akph_Db::results($wpdb->prepare(
            'SELECT l.id AS line_id, l.debit, l.credit, l.description, e.id AS entry_id, e.doc_number, e.entry_date FROM ' . Akph_Ledger::lines_table() . ' l JOIN ' . Akph_Ledger::entries_table() . " e ON e.id = l.entry_id WHERE l.cash_ref = %s AND e.status = 'posted' ORDER BY e.entry_date, e.id, l.line_no LIMIT %d",
            $cash_ref,
            (int) $limit
        ));
        $running = 0;
        $out = array();
        foreach ((array) $rows as $r) {
            $running += (int) $r->debit - (int) $r->credit;
            $out[] = array(
                'line_id' => (string) $r->line_id,
                'entry_id' => (string) $r->entry_id,
                'doc_number' => $r->doc_number,
                'date' => $r->entry_date,
                'description' => $r->description,
                'debit' => (int) $r->debit,
                'credit' => (int) $r->credit,
                'balance' => $running,
            );
        }
        return $out;
    }

    /** Doc number (ACC or DRF) and status of an entry, for the records that point to it. */
    public static function entry_ref($entry_id) {
        if (!$entry_id) {
            return null;
        }
        $row = Akph_Db::find(Akph_Ledger::entries_table(), $entry_id);
        if (!$row) {
            return null;
        }
        return array('id' => (string) $row->id, 'number' => $row->doc_number ?: $row->draft_number, 'status' => $row->status);
    }
}
