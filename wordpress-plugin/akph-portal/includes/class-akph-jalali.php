<?php
/**
 * Jalali (Persian) calendar arithmetic, independent of WordPress date functions (WP-Parsidate filters
 * those). Dates are stored as Gregorian ISO 'Y-m-d'; the fiscal year is the Jalali year of the date.
 * Algorithm: jalaali-js (Borkowski), the same one the app uses (src/utils/jalali.ts).
 */
if (!defined('ABSPATH')) {
    exit;
}

final class Akph_Jalali {
    private static $breaks = array(-61, 9, 38, 199, 426, 686, 756, 818, 1111, 1181, 1210, 1635, 2060, 2097, 2192, 2262, 2324, 2394, 2456, 3178);

    private static function div($a, $b) {
        return intdiv($a, $b);
    }

    private static function mod($a, $b) {
        return $a - intdiv($a, $b) * $b;
    }

    /** @return array{leap:int,gy:int,march:int} */
    private static function jal_cal($jy) {
        $bl = count(self::$breaks);
        $gy = $jy + 621;
        $leap_j = -14;
        $jp = self::$breaks[0];
        if ($jy < $jp || $jy >= self::$breaks[$bl - 1]) {
            throw new Akph_Error('akph_invalid_date', 'سال شمسی خارج از محدوده است.', 400);
        }
        $jump = 0;
        for ($i = 1; $i < $bl; $i++) {
            $jm = self::$breaks[$i];
            $jump = $jm - $jp;
            if ($jy < $jm) {
                break;
            }
            $leap_j = $leap_j + self::div($jump, 33) * 8 + self::div(self::mod($jump, 33), 4);
            $jp = $jm;
        }
        $n = $jy - $jp;
        $leap_j = $leap_j + self::div($n, 33) * 8 + self::div(self::mod($n, 33) + 3, 4);
        if (self::mod($jump, 33) === 4 && $jump - $n === 4) {
            $leap_j += 1;
        }
        $leap_g = self::div($gy, 4) - self::div((self::div($gy, 100) + 1) * 3, 4) - 150;
        $march = 20 + $leap_j - $leap_g;
        if ($jump - $n < 6) {
            $n = $n - $jump + self::div($jump + 4, 33) * 33;
        }
        $leap = self::mod(self::mod($n + 1, 33) - 1, 4);
        if ($leap === -1) {
            $leap = 4;
        }
        return array('leap' => $leap, 'gy' => $gy, 'march' => $march);
    }

    private static function g2d($gy, $gm, $gd) {
        $d = self::div(($gy + self::div($gm - 8, 6) + 100100) * 1461, 4) + self::div(153 * self::mod($gm + 9, 12) + 2, 5) + $gd - 34840408;
        return $d - self::div(self::div($gy + 100100 + self::div($gm - 8, 6), 100) * 3, 4) + 752;
    }

    private static function d2g($jdn) {
        $j = 4 * $jdn + 139361631;
        $j = $j + self::div(self::div(4 * $jdn + 183187720, 146097) * 3, 4) * 4 - 3908;
        $i = self::div(self::mod($j, 1461), 4) * 5 + 308;
        $gd = self::div(self::mod($i, 153), 5) + 1;
        $gm = self::mod(self::div($i, 153), 12) + 1;
        $gy = self::div($j, 1461) - 100100 + self::div(8 - $gm, 6);
        return array($gy, $gm, $gd);
    }

    private static function j2d($jy, $jm, $jd) {
        $r = self::jal_cal($jy);
        return self::g2d($r['gy'], 3, $r['march']) + ($jm - 1) * 31 - self::div($jm, 7) * ($jm - 7) + $jd - 1;
    }

    private static function d2j($jdn) {
        list($gy) = self::d2g($jdn);
        $jy = $gy - 621;
        $r = self::jal_cal($jy);
        $jdn1f = self::g2d($gy, 3, $r['march']);
        $k = $jdn - $jdn1f;
        if ($k >= 0) {
            if ($k <= 185) {
                return array($jy, 1 + self::div($k, 31), self::mod($k, 31) + 1);
            }
            $k -= 186;
        } else {
            $jy -= 1;
            $k += 179;
            if ($r['leap'] === 1) {
                $k += 1;
            }
        }
        return array($jy, 7 + self::div($k, 30), self::mod($k, 30) + 1);
    }

    public static function is_leap($jy) {
        return self::jal_cal($jy)['leap'] === 0;
    }

    public static function month_length($jy, $jm) {
        if ($jm <= 6) {
            return 31;
        }
        if ($jm <= 11) {
            return 30;
        }
        return self::is_leap($jy) ? 30 : 29;
    }

    /** true for a real Gregorian date 'Y-m-d' between 1900 and 2200. */
    public static function valid_iso($value) {
        if (!is_string($value) || !preg_match('/^(\d{4})-(\d{2})-(\d{2})$/D', $value, $m)) {
            return false;
        }
        $y = (int) $m[1];
        return $y >= 1900 && $y <= 2200 && checkdate((int) $m[2], (int) $m[3], $y);
    }

    /** @return int[] [jy, jm, jd] of an ISO date. */
    public static function from_iso($iso) {
        if (!self::valid_iso($iso)) {
            throw new Akph_Error('akph_invalid_date', 'تاریخ باید میلادی و به شکل YYYY-MM-DD باشد.', 400);
        }
        list($gy, $gm, $gd) = array_map('intval', explode('-', $iso));
        return self::d2j(self::g2d($gy, $gm, $gd));
    }

    /** ISO date of a Jalali date, or null when the Jalali date does not exist. */
    public static function to_iso($jy, $jm, $jd) {
        $jy = (int) $jy;
        $jm = (int) $jm;
        $jd = (int) $jd;
        if ($jy < 1300 || $jy > 1500 || $jm < 1 || $jm > 12 || $jd < 1 || $jd > self::month_length($jy, $jm)) {
            return null;
        }
        list($gy, $gm, $gd) = self::d2g(self::j2d($jy, $jm, $jd));
        return sprintf('%04d-%02d-%02d', $gy, $gm, $gd);
    }

    /** 'YYYY/MM/DD' Jalali (Latin digits) or null; accepts Persian and Arabic-Indic digits. */
    public static function parse_jalali($text) {
        $text = strtr(trim((string) $text), array(
            '۰' => '0', '۱' => '1', '۲' => '2', '۳' => '3', '۴' => '4', '۵' => '5', '۶' => '6', '۷' => '7', '۸' => '8', '۹' => '9',
            '٠' => '0', '١' => '1', '٢' => '2', '٣' => '3', '٤' => '4', '٥' => '5', '٦' => '6', '٧' => '7', '٨' => '8', '٩' => '9',
        ));
        if (!preg_match('#^(1[3-4]\d{2})[/-](\d{1,2})[/-](\d{1,2})$#D', $text, $m)) {
            return null;
        }
        return self::to_iso((int) $m[1], (int) $m[2], (int) $m[3]);
    }

    public static function format($iso) {
        list($jy, $jm, $jd) = self::from_iso($iso);
        return sprintf('%04d/%02d/%02d', $jy, $jm, $jd);
    }

    public static function fiscal_year($iso) {
        $j = self::from_iso($iso);
        return $j[0];
    }

    /** Today in the site's time zone, without date_i18n()/wp_date() (filtered by WP-Parsidate). */
    public static function today_iso() {
        $now = new DateTimeImmutable('now', wp_timezone());
        return $now->format('Y-m-d');
    }

    /** First and last ISO day of a Jalali year. */
    public static function year_bounds($jy) {
        return array(self::to_iso($jy, 1, 1), self::to_iso($jy, 12, self::month_length($jy, 12)));
    }
}
