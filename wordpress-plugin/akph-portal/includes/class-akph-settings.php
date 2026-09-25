<?php
/**
 * Plugin settings (option akph_portal_settings):
 *   mode      'live' (akph/v1 server) or 'demo' (sample data in the browser, system administrator only)
 *   currency  display unit 'toman' or 'rial' (amounts are always stored in Rials)
 *   closed_fiscal_years  Jalali years that no longer accept entries
 */
if (!defined('ABSPATH')) {
    exit;
}

final class Akph_Settings {
    const OPTION = 'akph_portal_settings';

    public static function defaults() {
        return array('mode' => 'live', 'currency' => 'toman', 'closed_fiscal_years' => array());
    }

    public static function all() {
        $stored = get_option(self::OPTION, array());
        return self::sanitize(is_array($stored) ? $stored : array());
    }

    public static function get($key) {
        $all = self::all();
        return isset($all[$key]) ? $all[$key] : null;
    }

    public static function sanitize($value) {
        $d = self::defaults();
        $value = is_array($value) ? $value : array();
        $mode = isset($value['mode']) && in_array($value['mode'], array('live', 'demo'), true) ? $value['mode'] : $d['mode'];
        $currency = isset($value['currency']) && in_array($value['currency'], array('toman', 'rial'), true) ? $value['currency'] : $d['currency'];
        $closed = array();
        foreach (isset($value['closed_fiscal_years']) ? (array) $value['closed_fiscal_years'] : array() as $y) {
            if (is_numeric($y) && (int) $y >= 1300 && (int) $y <= 1500) {
                $closed[] = (int) $y;
            }
        }
        sort($closed);
        return array('mode' => $mode, 'currency' => $currency, 'closed_fiscal_years' => array_values(array_unique($closed)));
    }

    public static function update(array $changes) {
        update_option(self::OPTION, self::sanitize(array_merge(self::all(), $changes)), false);
    }

    public static function is_closed_year($jy) {
        return in_array((int) $jy, self::get('closed_fiscal_years'), true);
    }
}
