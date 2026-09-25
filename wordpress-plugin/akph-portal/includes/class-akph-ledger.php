<?php
/**
 * Manual journal entries (reference: createManualJournalEntry, approveJournalEntry, rejectJournalEntry and
 * reverseJournalEntry in src/store/workflows.ts, finalizeManualEntry in src/store/postingEngine.ts).
 *
 *   create   → status pending with a draft number DRF-YYYY-NNNNN
 *   update   → only while pending, only by its creator
 *   post     → another user (user id ≠ created_by); permanent number ACC-YYYY-NNNNN issued in date order
 *   reject   → another user; the entry stays for the record
 *   reverse  → a new pending entry with debit and credit swapped (draft number DRF-…); it becomes final only
 *              when another user posts it (same rule as any entry), which issues its ACC number. The original
 *              is never edited or deleted. A rejected reversal releases the original for a new request.
 *
 * Lock order, the same in every command: numbering anchor of the year (Akph_Numbering::lock) first, then the
 * entry row (SELECT … FOR UPDATE). The entry is read once without a lock to know which year to lock; if its
 * year changed in between, the command stops with 409 akph_retry.
 *
 * Lines: at least two, each with exactly one positive integer amount, only postable accounts (subsidiary
 * or detail without children), Σ debit = Σ credit > 0. Entries dated in a closed fiscal year are refused.
 */
if (!defined('ABSPATH')) {
    exit;
}

final class Akph_Ledger {
    /** Types a manual entry may have (reversal is issued by the server; closing entries are not manual). */
    const MANUAL_TYPES = array('general', 'opening', 'adjustment', 'receipt', 'payment', 'purchase', 'petty_cash', 'statement', 'payroll', 'inventory', 'sales');
    const MAX_LINES = 200;

    public static function entries_table() {
        return Akph_Schema::table('ledger_entries');
    }

    public static function lines_table() {
        return Akph_Schema::table('ledger_lines');
    }

    /** Id of the entry a reversal reverses (kept after a rejection, when reversal_of is cleared); 0 otherwise. */
    public static function reversal_target($row) {
        if (!empty($row->reversal_target)) {
            return (int) $row->reversal_target;
        }
        return $row->reversal_of ? (int) $row->reversal_of : 0;
    }

    private static function is_reversal($row) {
        return $row->source_type === 'reversal' || self::reversal_target($row) > 0;
    }

    // ------------------------------------------------------------------ reading

    public static function shape($row, $lines = null) {
        global $wpdb;
        if ($lines === null) {
            $lines = Akph_Db::results($wpdb->prepare('SELECT * FROM ' . self::lines_table() . ' WHERE entry_id = %d ORDER BY line_no', $row->id));
        }
        // Live reversal of this entry (pending or posted); a rejected one no longer holds reversal_of.
        $reversed_by = Akph_Db::row($wpdb->prepare('SELECT id, doc_number, draft_number, status FROM ' . self::entries_table() . ' WHERE reversal_of = %d', $row->id));
        $target = self::reversal_target($row);
        $original = $target ? Akph_Db::row($wpdb->prepare('SELECT id, doc_number FROM ' . self::entries_table() . ' WHERE id = %d', $target)) : null;
        $name = function ($uid) {
            $u = $uid ? get_userdata((int) $uid) : null;
            return $u ? $u->display_name : '';
        };
        $out_lines = array();
        foreach ((array) $lines as $l) {
            $out_lines[] = array(
                'line_no' => (int) $l->line_no,
                'account_code' => $l->account_code,
                'project_id' => $l->project_id ? (string) $l->project_id : null,
                'cost_center_id' => $l->cost_center_id ? (string) $l->cost_center_id : null,
                'counterparty_id' => $l->counterparty_id ? (string) $l->counterparty_id : null,
                'description' => $l->description,
                'debit' => (int) $l->debit,
                'credit' => (int) $l->credit,
            );
        }
        return array(
            'id' => (string) $row->id,
            'doc_number' => $row->doc_number,
            'draft_number' => $row->draft_number,
            'fiscal_year' => (int) $row->fiscal_year,
            'date' => $row->entry_date,
            'description' => $row->description,
            'entry_type' => $row->entry_type,
            'source_type' => $row->source_type,
            'project_id' => $row->project_id ? (string) $row->project_id : null,
            'status' => $row->status,
            'total' => (int) $row->total,
            'lines' => $out_lines,
            'reversal_of' => $original ? array('id' => (string) $original->id, 'doc_number' => $original->doc_number) : null,
            'reversed_by' => $reversed_by ? array('id' => (string) $reversed_by->id, 'doc_number' => $reversed_by->doc_number, 'draft_number' => $reversed_by->draft_number, 'status' => $reversed_by->status) : null,
            'created_by' => (string) $row->created_by,
            'created_by_name' => $name($row->created_by),
            'created_at' => Akph_Db::iso_time($row->created_at),
            'approved_by' => $row->approved_by ? (string) $row->approved_by : null,
            'approved_by_name' => $name($row->approved_by),
            'approved_at' => Akph_Db::iso_time($row->approved_at),
            'rejected_by' => $row->rejected_by ? (string) $row->rejected_by : null,
            'rejected_at' => Akph_Db::iso_time($row->rejected_at),
            'status_note' => $row->status_note,
            'version' => (int) $row->version,
        );
    }

    /** Entries the user may see: view-all users every entry; nobody else (journal routes need view_all caps). */
    public static function list_entries(array $filters) {
        global $wpdb;
        $t = self::entries_table();
        $where = '1=1';
        if (!empty($filters['status'])) {
            $where .= $wpdb->prepare(' AND status = %s', $filters['status']);
        }
        if (!empty($filters['from'])) {
            $where .= $wpdb->prepare(' AND entry_date >= %s', $filters['from']);
        }
        if (!empty($filters['to'])) {
            $where .= $wpdb->prepare(' AND entry_date <= %s', $filters['to']);
        }
        if (!empty($filters['fiscal_year'])) {
            $where .= $wpdb->prepare(' AND fiscal_year = %d', $filters['fiscal_year']);
        }
        $per_page = $filters['per_page'];
        $offset = ($filters['page'] - 1) * $per_page;
        $rows = (array) Akph_Db::results("SELECT * FROM {$t} WHERE {$where} ORDER BY entry_date DESC, id DESC LIMIT {$per_page} OFFSET {$offset}");
        $total = (int) Akph_Db::value("SELECT COUNT(*) FROM {$t} WHERE {$where}");
        $lines_by_entry = array();
        if ($rows) {
            $ids = implode(',', array_map(function ($r) {
                return (int) $r->id;
            }, $rows));
            foreach ((array) Akph_Db::results('SELECT * FROM ' . self::lines_table() . " WHERE entry_id IN ({$ids}) ORDER BY entry_id, line_no") as $l) {
                $lines_by_entry[(int) $l->entry_id][] = $l;
            }
        }
        $out = array();
        foreach ($rows as $r) {
            $out[] = self::shape($r, isset($lines_by_entry[(int) $r->id]) ? $lines_by_entry[(int) $r->id] : array());
        }
        return array('entries' => $out, 'page' => $filters['page'], 'total' => $total);
    }

    public static function get($id) {
        $row = Akph_Db::find(self::entries_table(), $id);
        if (!$row) {
            throw Akph_Error::not_found('سند پیدا نشد.');
        }
        return self::shape($row);
    }

    // ------------------------------------------------------------------ validation

    /** Date of an entry: valid ISO, fiscal year open. */
    private static function check_date($iso) {
        $year = Akph_Jalali::fiscal_year($iso);
        if (Akph_Settings::is_closed_year($year)) {
            throw Akph_Error::rule('سال مالی ' . $year . ' بسته شده است؛ ثبت سند در آن ممکن نیست.');
        }
        return $year;
    }

    /**
     * Normalised lines of a request, or an error. Returns [lines, total].
     * @return array{0: array<int, array>, 1: int}
     */
    private static function validate_lines($raw) {
        if (!is_array($raw) || count($raw) < 2) {
            throw Akph_Error::rule('سند باید دست‌کم دو ردیف داشته باشد.');
        }
        if (count($raw) > self::MAX_LINES) {
            throw Akph_Error::invalid('سند حداکثر ' . self::MAX_LINES . ' ردیف دارد.');
        }
        $lines = array();
        $debit = 0;
        $credit = 0;
        $n = 0;
        foreach (array_values($raw) as $i => $l) {
            $row_no = $i + 1;
            if (!is_array($l)) {
                throw Akph_Error::invalid('ردیف ' . $row_no . ' نامعتبر است.');
            }
            $code = isset($l['account_code']) ? (string) $l['account_code'] : '';
            $account = $code !== '' ? Akph_Accounts::by_code($code) : null;
            if (!$account) {
                throw Akph_Error::rule('ردیف ' . $row_no . ': کد حساب «' . $code . '» در کدینگ وجود ندارد.', array('line' => $row_no));
            }
            if (!Akph_Accounts::postable($account, Akph_Accounts::has_children($account->code))) {
                throw Akph_Error::rule('ردیف ' . $row_no . ': حساب «' . $account->code . ' - ' . $account->title . '» حساب گروهی یا غیرفعال است؛ فقط حساب معین/تفصیلی بدون زیرحساب قابل ثبت است.', array('line' => $row_no));
            }
            $d = Akph_Input::parse_amount(isset($l['debit']) ? $l['debit'] : 0, 'ردیف ' . $row_no . ': بدهکار');
            $c = Akph_Input::parse_amount(isset($l['credit']) ? $l['credit'] : 0, 'ردیف ' . $row_no . ': بستانکار');
            if (($d > 0) === ($c > 0)) {
                throw Akph_Error::rule('ردیف ' . $row_no . ': هر ردیف فقط یک مبلغ مثبت بدهکار یا بستانکار دارد.', array('line' => $row_no));
            }
            $project = Akph_Input::id($l, 'project_id');
            if ($project && !Akph_Db::find(Akph_Schema::table('projects'), $project)) {
                throw Akph_Error::invalid('ردیف ' . $row_no . ': پروژه پیدا نشد.', array('line' => $row_no));
            }
            $center = Akph_Input::id($l, 'cost_center_id');
            if ($center) {
                $cc = Akph_Db::find(Akph_Schema::table('cost_centers'), $center);
                if (!$cc) {
                    throw Akph_Error::invalid('ردیف ' . $row_no . ': مرکز هزینه پیدا نشد.', array('line' => $row_no));
                }
                if ($project && $cc->project_id && (int) $cc->project_id !== $project) {
                    throw Akph_Error::invalid('ردیف ' . $row_no . ': مرکز هزینه متعلق به پروژه دیگری است.', array('line' => $row_no));
                }
            }
            $party = Akph_Input::id($l, 'counterparty_id');
            if ($party && !Akph_Db::find(Akph_Schema::table('counterparties'), $party)) {
                throw Akph_Error::invalid('ردیف ' . $row_no . ': طرف حساب پیدا نشد.', array('line' => $row_no));
            }
            $n++;
            $lines[] = array(
                'line_no' => $n,
                'account_id' => (int) $account->id,
                'account_code' => $account->code,
                'project_id' => $project ?: null,
                'cost_center_id' => $center ?: null,
                'counterparty_id' => $party ?: null,
                'description' => Akph_Input::text($l, 'description', 500),
                'debit' => $d,
                'credit' => $c,
            );
            $debit += $d;
            $credit += $c;
            if ($debit > Akph_Input::MAX_AMOUNT || $credit > Akph_Input::MAX_AMOUNT) {
                throw Akph_Error::rule('جمع مبالغ سند از حد مجاز بیشتر است.');
            }
        }
        if ($debit !== $credit || $debit === 0) {
            throw Akph_Error::rule('سند نامتوازن است: جمع بدهکار (' . $debit . ') و بستانکار (' . $credit . ') باید برابر و بیش از صفر باشد.', array('debit' => $debit, 'credit' => $credit));
        }
        return array($lines, $debit);
    }

    private static function header(array $body) {
        $date = Akph_Input::iso_date($body, 'date');
        $year = self::check_date($date);
        $project = Akph_Input::id($body, 'project_id');
        if ($project && !Akph_Db::find(Akph_Schema::table('projects'), $project)) {
            throw Akph_Error::invalid('پروژه سند پیدا نشد.', array('field' => 'project_id'));
        }
        $type = Akph_Input::one_of($body, 'entry_type', self::MANUAL_TYPES, 'general');
        return array(
            'entry_date' => $date,
            'fiscal_year' => $year,
            'description' => Akph_Input::text($body, 'description', 1000, true, 'شرح سند'),
            'entry_type' => $type,
            'project_id' => $project ?: null,
        );
    }

    private static function insert_lines($entry_id, array $lines) {
        foreach ($lines as $line) {
            Akph_Db::insert(self::lines_table(), $line + array('entry_id' => $entry_id));
        }
    }

    /** Stored entry with its lines, for the audit trail. */
    private static function snapshot($id) {
        global $wpdb;
        $e = (array) Akph_Db::find(self::entries_table(), $id);
        $e['lines'] = Akph_Db::results($wpdb->prepare('SELECT account_code, project_id, cost_center_id, counterparty_id, description, debit, credit FROM ' . self::lines_table() . ' WHERE entry_id = %d ORDER BY line_no', $id), ARRAY_A);
        return $e;
    }

    // ------------------------------------------------------------------ commands

    public static function create(array $body) {
        Akph_Auth::assert_cap(Akph_Roles::JOURNAL_CREATE, 'اجازه ثبت سند حسابداری را ندارید.');
        $h = self::header($body);
        list($lines, $total) = self::validate_lines(isset($body['lines']) ? $body['lines'] : null);
        Akph_Numbering::lock('DRF', $h['fiscal_year']);
        $now = Akph_Db::now_utc();
        $id = Akph_Db::insert(self::entries_table(), $h + array(
            'doc_number' => null,
            'draft_number' => '',
            'source_type' => 'manual',
            'status' => 'pending',
            'total' => $total,
            'created_by' => get_current_user_id(),
            'created_at' => $now,
            'version' => 1,
            'updated_at' => $now,
        ));
        self::insert_lines($id, $lines);
        $draft = Akph_Numbering::issue('DRF', $h['fiscal_year'], 'entry_draft', $id);
        Akph_Db::update(self::entries_table(), array('draft_number' => $draft), array('id' => $id));
        Akph_Audit::log('entry_created', 'entry', $id, null, self::snapshot($id), $draft);
        $row = Akph_Db::find(self::entries_table(), $id);
        return array('status' => 201, 'message' => 'سند ' . $draft . ' ثبت شد و در انتظار تأیید کاربر دیگری است.', 'id' => $id, 'doc_number' => $draft, 'records' => array('journal_entries' => array(self::shape($row))));
    }

    /** Unlocked read of an entry (to know which numbering lock to take first), 404 when missing. */
    private static function peek($id) {
        $row = Akph_Db::find(self::entries_table(), $id);
        if (!$row) {
            throw Akph_Error::not_found('سند پیدا نشد.');
        }
        return $row;
    }

    /** Locked entry, 404 when missing. Callers already hold the numbering lock they need. */
    private static function lock($id) {
        $row = Akph_Db::lock(self::entries_table(), $id);
        if (!$row) {
            throw Akph_Error::not_found('سند پیدا نشد.');
        }
        return $row;
    }

    /** Numbering lock of the entry's year, then the entry row (see the lock order in the class comment). */
    private static function lock_for_numbering($prefix, $id) {
        $peek = self::peek($id);
        Akph_Numbering::lock($prefix, (int) $peek->fiscal_year);
        $row = self::lock($id);
        if ((int) $row->fiscal_year !== (int) $peek->fiscal_year) {
            throw Akph_Error::retry(); // changed between the two reads; its year's lock is not held
        }
        return $row;
    }

    private static function assert_pending($row, $message) {
        if ($row->status !== 'pending') {
            throw Akph_Error::conflict($message, array('status' => $row->status));
        }
    }

    /** Separation of duties: the creator never approves or rejects their own entry (compared by user id). */
    private static function assert_other_user($row) {
        if ((int) $row->created_by === get_current_user_id()) {
            throw new Akph_Error('akph_segregation_of_duties', 'تأیید یا رد سندی که خودتان ثبت کرده‌اید مجاز نیست (تفکیک وظایف).', 403);
        }
    }

    public static function update($id, array $body, $version) {
        Akph_Auth::assert_cap(Akph_Roles::JOURNAL_CREATE, 'اجازه ویرایش سند حسابداری را ندارید.');
        // A date moved to another year needs a new draft number: take that year's numbering lock first.
        $peek = self::peek($id);
        $new_year = self::year_of(isset($body['date']) ? $body['date'] : null);
        $locked_year = 0;
        if ($new_year && $new_year !== (int) $peek->fiscal_year) {
            Akph_Numbering::lock('DRF', $new_year);
            $locked_year = $new_year;
        }
        $row = self::lock($id);
        if ($row->status === 'posted') {
            throw Akph_Error::conflict('سند قطعی قابل ویرایش یا حذف نیست؛ برای اصلاح سند معکوس صادر کنید.', array('status' => $row->status));
        }
        if (self::is_reversal($row)) {
            throw Akph_Error::conflict('سند معکوس قابل ویرایش نیست؛ آن را رد کنید و درخواست تازه بدهید.', array('status' => $row->status));
        }
        self::assert_pending($row, 'فقط سند در انتظار تأیید قابل ویرایش است.');
        Akph_Input::assert_version($row, $version);
        if ((int) $row->created_by !== get_current_user_id()) {
            throw Akph_Error::forbidden('فقط ثبت‌کننده سند می‌تواند پیش‌نویس را ویرایش کند.');
        }
        $before = self::snapshot($id);
        $h = self::header($body);
        list($lines, $total) = self::validate_lines(isset($body['lines']) ? $body['lines'] : null);
        global $wpdb;
        $data = $h + array('total' => $total, 'version' => (int) $row->version + 1, 'updated_at' => Akph_Db::now_utc());
        // The draft number belongs to the year it was issued in; a date moved to another year gets a new one.
        if ((int) $h['fiscal_year'] !== (int) $row->fiscal_year) {
            if ((int) $h['fiscal_year'] !== $locked_year) {
                throw Akph_Error::retry();
            }
            $data['draft_number'] = Akph_Numbering::issue('DRF', $h['fiscal_year'], 'entry_draft', $id);
        }
        Akph_Db::update(self::entries_table(), $data, array('id' => $id));
        Akph_Db::exec($wpdb->prepare('DELETE FROM ' . self::lines_table() . ' WHERE entry_id = %d', $id));
        self::insert_lines($id, $lines);
        Akph_Audit::log('entry_updated', 'entry', $id, $before, self::snapshot($id), $row->draft_number);
        $after = Akph_Db::find(self::entries_table(), $id);
        return array('message' => 'پیش‌نویس ' . $after->draft_number . ' به‌روز شد.', 'id' => $id, 'records' => array('journal_entries' => array(self::shape($after))));
    }

    /** Fiscal year of a date sent by the client, or 0 when it is not a valid date (validated later). */
    private static function year_of($date) {
        try {
            return Akph_Jalali::fiscal_year(Akph_Input::iso_date(array('date' => $date), 'date'));
        } catch (Akph_Error $e) {
            return 0;
        }
    }

    /** Numbers follow dates: a final entry cannot be dated before the last final entry of its year, nor after today. */
    private static function check_posting_date($iso, $fiscal_year) {
        global $wpdb;
        if ($iso > Akph_Jalali::today_iso()) {
            throw Akph_Error::rule('تاریخ سند (' . Akph_Jalali::format($iso) . ') نمی‌تواند بعد از امروز باشد.');
        }
        // Caller holds the ACC numbering lock of this year. ACC numbers are issued in date order, so the last
        // number of the year belongs to the latest final entry. Locking reads see the newest commit even when
        // this transaction's snapshot is older, and they touch only that numbering row and that one entry (a
        // locking read over a range of entries would also lock rows other commands are working on).
        $last_id = (int) Akph_Db::value($wpdb->prepare('SELECT object_id FROM ' . Akph_Schema::table('doc_sequences') . " WHERE prefix = 'ACC' AND fiscal_year = %d AND seq > 0 ORDER BY seq DESC LIMIT 1 FOR UPDATE", $fiscal_year));
        $last = $last_id ? Akph_Db::value($wpdb->prepare('SELECT entry_date FROM ' . self::entries_table() . ' WHERE id = %d LOCK IN SHARE MODE', $last_id)) : null;
        if ($last && $iso < $last) {
            throw Akph_Error::rule('تاریخ سند (' . Akph_Jalali::format($iso) . ') نمی‌تواند قبل از آخرین سند قطعی سال ' . $fiscal_year . ' (' . Akph_Jalali::format($last) . ') باشد؛ شماره اسناد به ترتیب تاریخ است.');
        }
        self::check_date($iso);
    }

    public static function post($id, $version) {
        Akph_Auth::assert_cap(Akph_Roles::JOURNAL_APPROVE, 'اجازه تأیید سند حسابداری را ندارید.');
        // Serialise approvals of the year (numbers always follow dates), then lock the entry.
        $row = self::lock_for_numbering('ACC', $id);
        self::assert_pending($row, 'سند در انتظار تأیید نیست.');
        Akph_Input::assert_version($row, $version);
        self::assert_other_user($row);
        $reversal = self::is_reversal($row);
        if (!$reversal) {
            // Accounts may have changed since the draft (a new child, deactivation): validate again.
            global $wpdb;
            $stored = Akph_Db::results($wpdb->prepare('SELECT account_code, project_id, cost_center_id, counterparty_id, description, debit, credit FROM ' . self::lines_table() . ' WHERE entry_id = %d ORDER BY line_no', $id), ARRAY_A);
            foreach ($stored as &$l) {
                $l['debit'] = (int) $l['debit'];
                $l['credit'] = (int) $l['credit'];
            }
            unset($l);
            self::validate_lines($stored);
        }
        // A reversal mirrors the lines of a posted entry, so its lines are balanced by construction; its
        // original is final and never changes, and reversal_of (unique) still points at it while pending.
        self::check_posting_date($row->entry_date, (int) $row->fiscal_year);
        $number = Akph_Numbering::issue('ACC', (int) $row->fiscal_year, 'entry', $id);
        $before = self::snapshot($id);
        $now = Akph_Db::now_utc();
        Akph_Db::update(self::entries_table(), array(
            'status' => 'posted',
            'doc_number' => $number,
            'approved_by' => get_current_user_id(),
            'approved_at' => $now,
            'version' => (int) $row->version + 1,
            'updated_at' => $now,
        ), array('id' => $id));
        $after = Akph_Db::find(self::entries_table(), $id);
        if (!$reversal) {
            Akph_Audit::log('entry_posted', 'entry', $id, $before, self::snapshot($id), $number);
            return array('message' => 'سند ' . $number . ' تأیید و قطعی شد.', 'id' => $id, 'doc_number' => $number, 'records' => array('journal_entries' => array(self::shape($after))));
        }
        $original = Akph_Db::find(self::entries_table(), self::reversal_target($row));
        Akph_Audit::log('entry_reversed', 'entry', $id, $before, self::snapshot($id) + array('original_id' => (int) $original->id, 'original_doc_number' => $original->doc_number), $number);
        return array(
            'message' => 'سند معکوس ' . $number . ' برای سند ' . $original->doc_number . ' تأیید و قطعی شد.',
            'id' => $id,
            'doc_number' => $number,
            'records' => array('journal_entries' => array(self::shape($original), self::shape($after))),
        );
    }

    public static function reject($id, array $body, $version) {
        Akph_Auth::assert_cap(Akph_Roles::JOURNAL_APPROVE, 'اجازه رد سند حسابداری را ندارید.');
        $row = self::lock($id);
        self::assert_pending($row, 'فقط سند در انتظار تأیید قابل رد است.');
        Akph_Input::assert_version($row, $version);
        self::assert_other_user($row);
        $reason = Akph_Input::text($body, 'reason', 1000, true, 'علت رد');
        $before = self::snapshot($id);
        $now = Akph_Db::now_utc();
        $data = array(
            'status' => 'rejected',
            'rejected_by' => get_current_user_id(),
            'rejected_at' => $now,
            'status_note' => $reason,
            'version' => (int) $row->version + 1,
            'updated_at' => $now,
        );
        $target = self::reversal_target($row);
        if ($target) {
            // The original is free for a new reversal request; reversal_target keeps the link for the record.
            $data['reversal_of'] = null;
            $data['reversal_target'] = $target;
        }
        Akph_Db::update(self::entries_table(), $data, array('id' => $id));
        Akph_Audit::log('entry_rejected', 'entry', $id, $before, self::snapshot($id), $row->draft_number);
        $after = Akph_Db::find(self::entries_table(), $id);
        $records = array(self::shape($after));
        if ($target) {
            array_unshift($records, self::shape(Akph_Db::find(self::entries_table(), $target)));
        }
        return array('message' => 'سند ' . $row->draft_number . ' رد شد.', 'id' => $id, 'records' => array('journal_entries' => $records));
    }

    /**
     * Request to reverse a posted entry: a new pending entry with debit and credit swapped. It becomes final
     * only when another user posts it (post()), like any other entry.
     */
    public static function reverse($id, array $body, $version) {
        Akph_Auth::assert_cap(Akph_Roles::JOURNAL_REVERSE, 'اجازه صدور سند معکوس را ندارید.');
        global $wpdb;
        $reason = Akph_Input::text($body, 'reason', 1000, true, 'علت صدور سند معکوس');
        $date = Akph_Input::iso_date($body, 'date', false) ?: Akph_Jalali::today_iso();
        if ($date > Akph_Jalali::today_iso()) {
            throw Akph_Error::rule('تاریخ سند معکوس (' . Akph_Jalali::format($date) . ') نمی‌تواند بعد از امروز باشد.');
        }
        $year = self::check_date($date);
        self::peek($id);
        // Same lock order as every ledger command: the numbering anchor, then the entry row.
        Akph_Numbering::lock('DRF', $year);
        $row = self::lock($id);
        Akph_Input::assert_version($row, $version);
        if ($row->status !== 'posted') {
            throw Akph_Error::conflict('فقط سند قطعی قابل معکوس‌کردن است.', array('status' => $row->status));
        }
        if (self::is_reversal($row)) {
            throw Akph_Error::conflict('سند معکوس را نمی‌توان دوباره معکوس کرد.');
        }
        $live = Akph_Db::row($wpdb->prepare('SELECT id, status, draft_number, doc_number FROM ' . self::entries_table() . ' WHERE reversal_of = %d FOR UPDATE', $id));
        if ($live) {
            throw $live->status === 'posted'
                ? Akph_Error::conflict('این سند قبلاً معکوس شده است (' . $live->doc_number . ').')
                : Akph_Error::conflict('درخواست معکوس این سند (' . $live->draft_number . ') در انتظار تأیید است.');
        }
        if ($date < $row->entry_date) {
            throw Akph_Error::rule('تاریخ سند معکوس نمی‌تواند قبل از سند اصلی باشد.');
        }
        $now = Akph_Db::now_utc();
        $new_id = Akph_Db::insert(self::entries_table(), array(
            'doc_number' => null,
            'draft_number' => '',
            'fiscal_year' => $year,
            'entry_date' => $date,
            'description' => mb_substr('معکوس سند ' . $row->doc_number . ' — ' . $reason, 0, 1000),
            'entry_type' => 'reversal',
            'source_type' => 'reversal',
            'project_id' => $row->project_id,
            'status' => 'pending',
            'reversal_of' => $id,
            'reversal_target' => $id,
            'total' => (int) $row->total,
            'created_by' => get_current_user_id(),
            'created_at' => $now,
            'status_note' => $reason,
            'version' => 1,
            'updated_at' => $now,
        ));
        $lines = Akph_Db::results($wpdb->prepare('SELECT * FROM ' . self::lines_table() . ' WHERE entry_id = %d ORDER BY line_no', $id));
        foreach ((array) $lines as $l) {
            Akph_Db::insert(self::lines_table(), array(
                'entry_id' => $new_id,
                'line_no' => (int) $l->line_no,
                'account_id' => (int) $l->account_id,
                'account_code' => $l->account_code,
                'project_id' => $l->project_id,
                'cost_center_id' => $l->cost_center_id,
                'counterparty_id' => $l->counterparty_id,
                'description' => mb_substr('معکوس: ' . $l->description, 0, 500),
                'debit' => (int) $l->credit,
                'credit' => (int) $l->debit,
            ));
        }
        $draft = Akph_Numbering::issue('DRF', $year, 'entry_draft', $new_id);
        Akph_Db::update(self::entries_table(), array('draft_number' => $draft), array('id' => $new_id));
        Akph_Audit::log('entry_reversal_requested', 'entry', $new_id, null, self::snapshot($new_id) + array('original_id' => $id, 'original_doc_number' => $row->doc_number), $draft);
        $original = Akph_Db::find(self::entries_table(), $id);
        $reversal = Akph_Db::find(self::entries_table(), $new_id);
        return array(
            'status' => 201,
            'message' => 'سند معکوس ' . $draft . ' برای سند ' . $row->doc_number . ' ثبت شد و در انتظار تأیید کاربر دیگری است.',
            'id' => $new_id,
            'doc_number' => $draft,
            'records' => array('journal_entries' => array(self::shape($original), self::shape($reversal))),
        );
    }
}
