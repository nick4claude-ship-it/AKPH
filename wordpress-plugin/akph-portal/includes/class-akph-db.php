<?php
/**
 * Transactions on InnoDB (START TRANSACTION … COMMIT / ROLLBACK), row locks (SELECT … FOR UPDATE) and checked
 * queries. Every query of the plugin goes through the wrappers below, which inspect $wpdb->last_error right
 * after the call:
 *
 * - deadlock (1213) or lock wait timeout (1205) → Akph_Error 409 `akph_retry` (the whole command is rolled
 *   back and may be sent again with the same Idempotency-Key);
 * - any other database error → Akph_Error 500 `akph_db_error` with a generic message; the details (error,
 *   number, query) go to error_log only, never into the REST response.
 */
if (!defined('ABSPATH')) {
    exit;
}

final class Akph_Db {
    const ER_LOCK_WAIT_TIMEOUT = 1205;
    const ER_LOCK_DEADLOCK = 1213;
    const ER_DUP_ENTRY = 1062;

    /** @var int */
    private static $depth = 0;

    public static function begin() {
        if (self::$depth === 0) {
            self::exec('START TRANSACTION');
        }
        self::$depth++;
    }

    public static function commit() {
        if (self::$depth === 1) {
            self::exec('COMMIT'); // a failed COMMIT throws with depth still 1, so the caller's rollback runs
        }
        self::$depth = max(0, self::$depth - 1);
    }

    public static function rollback() {
        global $wpdb;
        if (self::$depth > 0) {
            self::$depth = 0;
            $previous = $wpdb->suppress_errors(true);
            $wpdb->query('ROLLBACK');
            $wpdb->suppress_errors($previous);
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

    // ------------------------------------------------------------------ checked queries

    /** MySQL error number of the last statement on $wpdb's connection (0 when unknown). */
    private static function last_errno() {
        global $wpdb;
        $dbh = $wpdb->dbh;
        if ($dbh instanceof mysqli) {
            return (int) mysqli_errno($dbh);
        }
        return 0;
    }

    /** true for errors after which the same command can simply be sent again. */
    public static function is_retryable($errno, $message) {
        $errno = (int) $errno;
        return $errno === self::ER_LOCK_DEADLOCK || $errno === self::ER_LOCK_WAIT_TIMEOUT
            || stripos((string) $message, 'Deadlock found') !== false || stripos((string) $message, 'Lock wait timeout exceeded') !== false;
    }

    /** The error to throw for a failed statement (see the class comment). */
    public static function error_for($errno, $message, $sql = '') {
        if (self::is_retryable($errno, $message)) {
            return Akph_Error::retry();
        }
        error_log(sprintf('[akph-portal] database error %d: %s | %s', (int) $errno, $message, substr(preg_replace('/\s+/', ' ', (string) $sql), 0, 500)));
        return new Akph_Error('akph_db_error', 'خطای پایگاه‌داده؛ هیچ تغییری ذخیره نشد.', 500);
    }

    /**
     * Calls a $wpdb method with printing of errors switched off (with WP_DEBUG_DISPLAY wpdb would echo the
     * error and the query into the REST response); last_error is still set and checked by the caller.
     */
    private static function call($method, array $args) {
        global $wpdb;
        $previous = $wpdb->suppress_errors(true);
        try {
            return call_user_func_array(array($wpdb, $method), $args);
        } finally {
            $wpdb->suppress_errors($previous);
        }
    }

    /** Throws when the last statement failed. */
    public static function check($sql = '') {
        global $wpdb;
        if ((string) $wpdb->last_error !== '') {
            throw self::error_for(self::last_errno(), $wpdb->last_error, $sql !== '' ? $sql : (string) $wpdb->last_query);
        }
    }

    public static function exec($sql) {
        global $wpdb;
        $result = self::call('query', array($sql));
        self::check($sql);
        if ($result === false) {
            throw self::error_for(self::last_errno(), 'query returned false', $sql);
        }
        return $result;
    }

    public static function value($sql) {
        global $wpdb;
        $value = self::call('get_var', array($sql));
        self::check($sql);
        return $value;
    }

    public static function row($sql, $output = OBJECT) {
        global $wpdb;
        $row = self::call('get_row', array($sql, $output));
        self::check($sql);
        return $row;
    }

    public static function results($sql, $output = OBJECT) {
        global $wpdb;
        $rows = self::call('get_results', array($sql, $output));
        self::check($sql);
        return is_array($rows) ? $rows : array();
    }

    public static function col($sql) {
        global $wpdb;
        $values = self::call('get_col', array($sql));
        self::check($sql);
        return is_array($values) ? $values : array();
    }

    /** Kept for callers that pass a $wpdb result: false or a pending error aborts the command. */
    public static function must($result) {
        self::check();
        if ($result === false) {
            throw self::error_for(self::last_errno(), 'query returned false');
        }
        return $result;
    }

    public static function insert($table, array $data) {
        global $wpdb;
        $ok = self::call('insert', array($table, $data));
        self::check();
        if ($ok === false) {
            throw self::error_for(self::last_errno(), 'insert returned false', 'INSERT INTO ' . $table);
        }
        return (int) $wpdb->insert_id;
    }

    /** Inserts a row whose unique key may already exist: false for a duplicate key, the new id otherwise. */
    public static function try_insert($table, array $data) {
        global $wpdb;
        $ok = self::call('insert', array($table, $data));
        if ($ok === false && (self::last_errno() === self::ER_DUP_ENTRY || self::is_duplicate_error())) {
            return false;
        }
        self::check();
        if ($ok === false) {
            throw self::error_for(self::last_errno(), 'insert returned false', 'INSERT INTO ' . $table);
        }
        return (int) $wpdb->insert_id;
    }

    public static function update($table, array $data, array $where) {
        global $wpdb;
        $result = self::call('update', array($table, $data, $where));
        self::check();
        if ($result === false) {
            throw self::error_for(self::last_errno(), 'update returned false', 'UPDATE ' . $table);
        }
        return $result;
    }

    /** The row, locked until the end of the transaction. */
    public static function lock($table, $id) {
        global $wpdb;
        return self::row($wpdb->prepare("SELECT * FROM {$table} WHERE id = %d FOR UPDATE", $id));
    }

    public static function find($table, $id) {
        global $wpdb;
        return self::row($wpdb->prepare("SELECT * FROM {$table} WHERE id = %d", $id));
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
