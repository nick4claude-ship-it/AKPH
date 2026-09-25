<?php
/**
 * Document numbers PREFIX-YYYY-NNNNN, issued only by the server, inside the command's transaction.
 * Each issued number is a row with the unique key (prefix, fiscal_year, seq); the counter of every Jalali
 * fiscal year starts at 1. Issuing is serialised per (prefix, year) by locking an anchor row (seq 0).
 */
if (!defined('ABSPATH')) {
    exit;
}

final class Akph_Numbering {
    const DIGITS = 5;

    /**
     * Serialises numbering of (prefix, year) until the end of the transaction. Commands that must check
     * something in date order before numbering (posting a journal entry) take this lock first.
     */
    public static function lock($prefix, $fiscal_year) {
        global $wpdb;
        if (!Akph_Db::in_transaction()) {
            throw new Akph_Error('akph_internal', 'شماره سند فقط داخل تراکنش صادر می‌شود.', 500);
        }
        $t = Akph_Schema::table('doc_sequences');
        // Anchor row: a concurrent command waits here until this transaction commits or rolls back.
        Akph_Db::must($wpdb->query($wpdb->prepare(
            "INSERT IGNORE INTO {$t} (prefix, fiscal_year, seq, object_type, object_id, issued_by, issued_at) VALUES (%s, %d, 0, 'anchor', 0, 0, %s)",
            strtoupper((string) $prefix),
            (int) $fiscal_year,
            Akph_Db::now_utc()
        )));
        $wpdb->get_var($wpdb->prepare("SELECT id FROM {$t} WHERE prefix = %s AND fiscal_year = %d AND seq = 0 FOR UPDATE", strtoupper((string) $prefix), (int) $fiscal_year));
    }

    public static function issue($prefix, $fiscal_year, $object_type, $object_id) {
        global $wpdb;
        $t = Akph_Schema::table('doc_sequences');
        $prefix = strtoupper((string) $prefix);
        $fiscal_year = (int) $fiscal_year;
        self::lock($prefix, $fiscal_year);
        // Locking read: sees the latest committed number even if this transaction's snapshot is older.
        $last = (int) $wpdb->get_var($wpdb->prepare("SELECT MAX(seq) FROM {$t} WHERE prefix = %s AND fiscal_year = %d FOR UPDATE", $prefix, $fiscal_year));
        $seq = $last + 1;
        Akph_Db::insert($t, array(
            'prefix' => $prefix,
            'fiscal_year' => $fiscal_year,
            'seq' => $seq,
            'object_type' => $object_type,
            'object_id' => (int) $object_id,
            'issued_by' => get_current_user_id(),
            'issued_at' => Akph_Db::now_utc(),
        ));
        return self::format($prefix, $fiscal_year, $seq);
    }

    public static function format($prefix, $fiscal_year, $seq) {
        return sprintf('%s-%d-%s', $prefix, $fiscal_year, str_pad((string) $seq, self::DIGITS, '0', STR_PAD_LEFT));
    }
}
