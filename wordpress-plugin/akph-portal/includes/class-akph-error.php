<?php
/**
 * Error raised inside a command or a read. It carries the HTTP status and a Persian message; the whole
 * command is rolled back when it is thrown.
 */
if (!defined('ABSPATH')) {
    exit;
}

final class Akph_Error extends Exception {
    /** @var string */
    private $error_code;
    /** @var int */
    private $status;
    /** @var array */
    private $data;

    public function __construct($error_code, $message, $status = 400, array $data = array()) {
        parent::__construct($message, (int) $status);
        $this->error_code = (string) $error_code;
        $this->status = (int) $status;
        $this->data = $data;
    }

    public function status() {
        return $this->status;
    }

    public function error_code() {
        return $this->error_code;
    }

    public function to_wp_error() {
        return new WP_Error($this->error_code, $this->getMessage(), array_merge($this->data, array('status' => $this->status)));
    }

    // Shorthands for the statuses of docs/API-CONTRACT.md.
    public static function invalid($message, array $data = array()) {
        return new self('akph_invalid', $message, 400, $data);
    }

    public static function forbidden($message, array $data = array()) {
        return new self('akph_forbidden', $message, 403, $data);
    }

    public static function not_found($message = 'رکورد پیدا نشد.') {
        return new self('akph_not_found', $message, 404);
    }

    public static function conflict($message, array $data = array()) {
        return new self('akph_conflict', $message, 409, $data);
    }

    /**
     * The command met another command on the same records (deadlock, lock wait timeout, or a record that
     * changed between two locks). Nothing was saved; the client may send it again with the same key.
     */
    public static function retry() {
        return new self('akph_retry', 'هم‌زمان با کاربر دیگری روی همین رکورد کار شد و هیچ تغییری ذخیره نشد؛ دوباره تلاش کنید.', 409, array('retryable' => true));
    }

    /** A rule of accounting is violated (unbalanced entry, group account, closed year, ...). */
    public static function rule($message, array $data = array()) {
        return new self('akph_rule', $message, 422, $data);
    }
}
