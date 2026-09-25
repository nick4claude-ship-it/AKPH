<?php
/**
 * Trial balance and account ledger, from posted entries only. Project managers get the lines of their own
 * projects only (lines without a project are headquarters and excluded); their reports are marked partial,
 * and the ledger omits the entry description (entry_description = null) for users without akph_view_all.
 */
if (!defined('ABSPATH')) {
    exit;
}

final class Akph_Reports {
    /** Validated filters: from, to (ISO), project_id. */
    public static function filters(WP_REST_Request $request) {
        $params = $request->get_query_params();
        $from = Akph_Input::iso_date($params, 'from', false);
        $to = Akph_Input::iso_date($params, 'to', false);
        if ($from && $to && $from > $to) {
            throw Akph_Error::invalid('تاریخ شروع بازه بعد از تاریخ پایان است.');
        }
        $project = Akph_Input::id($params, 'project_id');
        if ($project) {
            Akph_Auth::assert_project($project);
        }
        return array('from' => $from, 'to' => $to, 'project_id' => $project);
    }

    private static function where(array $f) {
        global $wpdb;
        $where = "e.status = 'posted'";
        if ($f['to']) {
            $where .= $wpdb->prepare(' AND e.entry_date <= %s', $f['to']);
        }
        if ($f['project_id']) {
            $where .= $wpdb->prepare(' AND l.project_id = %d', $f['project_id']);
        }
        $where .= ' AND ' . Akph_Auth::project_scope_sql('l.project_id');
        return $where;
    }

    public static function trial_balance(array $f) {
        global $wpdb;
        $l = Akph_Ledger::lines_table();
        $e = Akph_Ledger::entries_table();
        $a = Akph_Accounts::table();
        $where = self::where($f);
        $before = $f['from'] ? $wpdb->prepare('e.entry_date < %s', $f['from']) : '1=0';
        $during = $f['from'] ? $wpdb->prepare('e.entry_date >= %s', $f['from']) : '1=1';
        $rows = Akph_Db::results(
            "SELECT l.account_code, a.title, a.level, a.nature,
                SUM(CASE WHEN {$before} THEN CAST(l.debit AS SIGNED) - CAST(l.credit AS SIGNED) ELSE 0 END) AS opening,
                SUM(CASE WHEN {$during} THEN l.debit ELSE 0 END) AS debit,
                SUM(CASE WHEN {$during} THEN l.credit ELSE 0 END) AS credit
             FROM {$l} l JOIN {$e} e ON e.id = l.entry_id LEFT JOIN {$a} a ON a.code = l.account_code
             WHERE {$where}
             GROUP BY l.account_code, a.title, a.level, a.nature
             ORDER BY l.account_code"
        );
        $out = array();
        $tot = array('opening' => 0, 'debit' => 0, 'credit' => 0, 'closing' => 0);
        foreach ((array) $rows as $r) {
            $opening = (int) $r->opening;
            $closing = $opening + (int) $r->debit - (int) $r->credit;
            $out[] = array(
                'account_code' => $r->account_code,
                'title' => (string) $r->title,
                'nature' => (string) $r->nature,
                'opening' => $opening,
                'debit' => (int) $r->debit,
                'credit' => (int) $r->credit,
                'closing' => $closing,
                'closing_debit' => $closing > 0 ? $closing : 0,
                'closing_credit' => $closing < 0 ? -$closing : 0,
            );
            $tot['opening'] += $opening;
            $tot['debit'] += (int) $r->debit;
            $tot['credit'] += (int) $r->credit;
            $tot['closing'] += $closing;
        }
        return array(
            'rows' => $out,
            'totals' => $tot,
            'balanced' => $tot['debit'] === $tot['credit'] && $tot['closing'] === 0,
            'from' => $f['from'],
            'to' => $f['to'],
            'project_id' => $f['project_id'] ? (string) $f['project_id'] : null,
            'partial' => (bool) $f['project_id'] || !Akph_Auth::view_all(),
        );
    }

    public static function ledger(array $f, $account_code, $page, $per_page) {
        global $wpdb;
        $account = Akph_Accounts::by_code($account_code);
        if (!$account) {
            throw Akph_Error::not_found('حساب پیدا نشد.');
        }
        $l = Akph_Ledger::lines_table();
        $e = Akph_Ledger::entries_table();
        $where = self::where($f) . $wpdb->prepare(' AND l.account_code = %s', $account_code);
        $opening = 0;
        if ($f['from']) {
            $opening = (int) Akph_Db::value("SELECT COALESCE(SUM(CAST(l.debit AS SIGNED) - CAST(l.credit AS SIGNED)), 0) FROM {$l} l JOIN {$e} e ON e.id = l.entry_id WHERE {$where}" . $wpdb->prepare(' AND e.entry_date < %s', $f['from']));
            $where .= $wpdb->prepare(' AND e.entry_date >= %s', $f['from']);
        }
        $offset = ($page - 1) * $per_page;
        // Balance carried into this page: opening + everything before the page (same order as the rows).
        $carried = $opening;
        if ($offset > 0) {
            $carried += (int) Akph_Db::value("SELECT COALESCE(SUM(x.d - x.c), 0) FROM (SELECT CAST(l.debit AS SIGNED) AS d, CAST(l.credit AS SIGNED) AS c FROM {$l} l JOIN {$e} e ON e.id = l.entry_id WHERE {$where} ORDER BY e.entry_date, e.id, l.line_no LIMIT {$offset}) x");
        }
        $rows = Akph_Db::results("SELECT e.id AS entry_id, e.doc_number, e.entry_date, e.description AS entry_description, l.line_no, l.description, l.project_id, l.cost_center_id, l.counterparty_id, l.debit, l.credit FROM {$l} l JOIN {$e} e ON e.id = l.entry_id WHERE {$where} ORDER BY e.entry_date, e.id, l.line_no LIMIT {$per_page} OFFSET {$offset}");
        $total = (int) Akph_Db::value("SELECT COUNT(*) FROM {$l} l JOIN {$e} e ON e.id = l.entry_id WHERE {$where}");
        $balance = $carried;
        $out = array();
        // The entry description may name other projects or headquarters matters: shown only to users who see
        // every project. Everyone keeps the description of their own line.
        $show_entry_description = Akph_Auth::view_all();
        foreach ((array) $rows as $r) {
            $balance += (int) $r->debit - (int) $r->credit;
            $out[] = array(
                'entry_id' => (string) $r->entry_id,
                'doc_number' => $r->doc_number,
                'date' => $r->entry_date,
                'entry_description' => $show_entry_description ? $r->entry_description : null,
                'description' => $r->description,
                'project_id' => $r->project_id ? (string) $r->project_id : null,
                'cost_center_id' => $r->cost_center_id ? (string) $r->cost_center_id : null,
                'counterparty_id' => $r->counterparty_id ? (string) $r->counterparty_id : null,
                'debit' => (int) $r->debit,
                'credit' => (int) $r->credit,
                'balance' => $balance,
            );
        }
        return array(
            'account' => Akph_Accounts::shape($account),
            'opening' => $opening,
            'carried' => $carried,
            'rows' => $out,
            'page' => $page,
            'total' => $total,
            'from' => $f['from'],
            'to' => $f['to'],
            'project_id' => $f['project_id'] ? (string) $f['project_id'] : null,
            'partial' => (bool) $f['project_id'] || !Akph_Auth::view_all(),
        );
    }
}
