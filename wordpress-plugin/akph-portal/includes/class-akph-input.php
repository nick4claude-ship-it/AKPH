<?php
/**
 * Strict readers for command bodies. Amounts are integer Rials (JSON integer or a digit string, at most
 * 15 digits so they stay exact in the browser); floats and grouped digits are refused.
 */
if (!defined('ABSPATH')) {
    exit;
}

final class Akph_Input {
    /** Largest amount of a single field or entry total: Number.MAX_SAFE_INTEGER. */
    const MAX_AMOUNT = 9007199254740991;

    public static function text($body, $key, $max = 190, $required = false, $label = '') {
        $value = isset($body[$key]) ? $body[$key] : '';
        if (!is_string($value) && !is_int($value)) {
            throw Akph_Error::invalid(($label ?: $key) . ' باید متن باشد.', array('field' => $key));
        }
        $value = trim(sanitize_textarea_field((string) $value));
        if ($required && $value === '') {
            throw Akph_Error::invalid(($label ?: $key) . ' الزامی است.', array('field' => $key));
        }
        if (mb_strlen($value) > $max) {
            throw Akph_Error::invalid(($label ?: $key) . ' بیش از ' . $max . ' نویسه است.', array('field' => $key));
        }
        return $value;
    }

    /** Non-negative integer amount in Rials. */
    public static function amount($body, $key, $label = '') {
        $value = isset($body[$key]) ? $body[$key] : 0;
        return self::parse_amount($value, $label ?: $key, $key);
    }

    public static function parse_amount($value, $label, $field = '') {
        if (is_int($value)) {
            $ok = $value >= 0 && $value <= self::MAX_AMOUNT;
        } elseif (is_string($value) && preg_match('/^[0-9]{1,16}$/D', $value)) {
            $ok = strlen(ltrim($value, '0')) <= 16 && (int) $value <= self::MAX_AMOUNT;
            $value = (int) $value;
        } else {
            $ok = false;
        }
        if (!$ok) {
            throw Akph_Error::invalid($label . ' باید عدد صحیح نامنفی به ریال (بدون اعشار) باشد.', array('field' => $field));
        }
        return (int) $value;
    }

    /** Positive integer id, or 0 when absent/empty and `$optional`. */
    public static function id($body, $key, $optional = true) {
        $value = isset($body[$key]) ? $body[$key] : null;
        if ($value === null || $value === '' || $value === 0 || $value === '0') {
            if ($optional) {
                return 0;
            }
            throw Akph_Error::invalid($key . ' الزامی است.', array('field' => $key));
        }
        if ((is_int($value) && $value > 0) || (is_string($value) && preg_match('/^[1-9][0-9]{0,18}$/D', $value))) {
            return (int) $value;
        }
        throw Akph_Error::invalid($key . ' شناسه نامعتبر است.', array('field' => $key));
    }

    public static function iso_date($body, $key, $required = true) {
        $value = isset($body[$key]) ? $body[$key] : null;
        if ($value === null || $value === '') {
            if ($required) {
                throw Akph_Error::invalid('تاریخ الزامی است.', array('field' => $key));
            }
            return null;
        }
        if (!Akph_Jalali::valid_iso($value)) {
            throw Akph_Error::invalid('تاریخ باید میلادی و به شکل YYYY-MM-DD باشد.', array('field' => $key));
        }
        return $value;
    }

    public static function one_of($body, $key, array $allowed, $default = null) {
        $value = isset($body[$key]) ? $body[$key] : $default;
        if (!in_array($value, $allowed, true)) {
            throw Akph_Error::invalid($key . ' باید یکی از این مقادیر باشد: ' . implode('، ', $allowed), array('field' => $key));
        }
        return $value;
    }

    public static function bool($body, $key, $default = true) {
        if (!array_key_exists($key, $body)) {
            return $default;
        }
        return (bool) $body[$key];
    }

    /** Version the client last saw; from the body or the If-Match header. */
    public static function version(WP_REST_Request $request, $body) {
        $value = isset($body['version']) ? $body['version'] : null;
        if ($value === null) {
            $match = $request->get_header('If-Match');
            if (is_string($match) && preg_match('/^(?:W\/)?"?([0-9]+)"?$/', trim($match), $m)) {
                $value = $m[1];
            }
        }
        if ($value === null || !preg_match('/^[1-9][0-9]{0,9}$/D', (string) $value)) {
            throw new Akph_Error('akph_version_required', 'نسخه رکورد (version) لازم است؛ صفحه را تازه کنید.', 428);
        }
        return (int) $value;
    }

    /** 409 when the stored row changed since the client read it. */
    public static function assert_version($row, $expected) {
        if ((int) $row->version !== (int) $expected) {
            throw Akph_Error::conflict('این رکورد هم‌زمان توسط کاربر دیگری تغییر کرده است؛ نسخه تازه را دریافت کنید.', array('current_version' => (int) $row->version));
        }
    }
}
