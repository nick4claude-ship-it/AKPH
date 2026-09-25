<?php
/**
 * Transactions on InnoDB (START TRANSACTION … COMMIT / ROLLBACK) and row locks (SELECT … FOR UPDATE).
 * Every write of a command happens inside one transaction; any error rolls the whole command back.
 */
if (!defined('ABSPATH')) {
    exit;
}

final class Akph_Db {
    /** @var int */
    private static $depth = 0;

    public static function begin() {
        global $wpdb;
        if (self::$depth === 0) {
            self::must($wpdb->query('START TRANSACTION'));
        }
        self::$depth++;
    }

    public static function commit() {
        global $wpdb;
        self::$depth = max(0, self::$depth - 1);
        if (self::$depth === 0) {
            self::must($wpdb->query('COMMIT'));
        }
    }

    public static function rollback() {
        global $wpdb;
        if (self::$depth > 0) {
            self::$depth = 0;
            $wpdb->query('ROLLBACK');
        }
    }

    public static function in_transaction() {
        return self::$depth > 0;
    }

    /** Runs `$fn` in a transaction and returns its result; any Throwable rolls back and is rethrown. */
    public static function transaction(callable $fn) {
        self::begin();
        try {
            $result = $fn();
            self::commit();
            return $result;
        } catch (Throwable $e) {
            self::rollback();
            throw $e;
        }
    }

    /** A failed query (false) aborts the command. */
    public static function must($result) {
        global $wpdb;
        if ($result === false) {
            throw new Akph_Error('akph_db_error', 'خطای پایگاه‌داده؛ هیچ تغییری ذخیره نشد.', 500, array('db_error' => (string) $wpdb->last_error));
        }
        return $result;
    }

    public static function insert($table, array $data) {
        global $wpdb;
        self::must($wpdb->insert($table, $data));
        return (int) $wpdb->insert_id;
    }

    public static function update($table, array $data, array $where) {
        global $wpdb;
        return self::must($wpdb->update($table, $data, $where));
    }

    /** The row, locked until the end of the transaction. */
    public static function lock($table, $id) {
        global $wpdb;
        return $wpdb->get_row($wpdb->prepare("SELECT * FROM {$table} WHERE id = %d FOR UPDATE", $id));
    }

    public static function find($table, $id) {
        global $wpdb;
        return $wpdb->get_row($wpdb->prepare("SELECT * FROM {$table} WHERE id = %d", $id));
    }

    public static function now_utc() {
        return gmdate('Y-m-d H:i:s');
    }

    /** '2026-09-25T01:02:03Z' for a stored UTC datetime. */
    public static function iso_time($mysql) {
        return $mysql ? str_replace(' ', 'T', (string) $mysql) . 'Z' : null;
    }

    public static function is_duplicate_error() {
        global $wpdb;
        return stripos((string) $wpdb->last_error, 'Duplicate entry') !== false;
    }
}
