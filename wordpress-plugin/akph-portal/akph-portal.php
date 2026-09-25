<?php
/**
 * Plugin Name:       پرتال مدیریت پیمانکاری AKPH
 * Description:       اپلیکیشن مدیریت پروژه، قرارداد، خزانه، تنخواه، انبار و حسابداری با سرور akph/v1 (پروژه‌ها، مراکز هزینه، طرف‌های حساب، کدینگ و اسناد حسابداری).
 * Version:           0.3.1
 * Requires at least: 6.2
 * Requires PHP:      7.4
 * Author:            AKPH
 * License:           Apache-2.0
 * Text Domain:       akph-portal
 */

if (!defined('ABSPATH')) {
    exit;
}

define('AKPH_PORTAL_VERSION', '0.3.1');
define('AKPH_PORTAL_FILE', __FILE__);
define('AKPH_PORTAL_DIR', plugin_dir_path(__FILE__));
define('AKPH_PORTAL_URL', plugin_dir_url(__FILE__));

require_once AKPH_PORTAL_DIR . 'includes/class-akph-error.php';
require_once AKPH_PORTAL_DIR . 'includes/class-akph-jalali.php';
require_once AKPH_PORTAL_DIR . 'includes/class-akph-schema.php';
require_once AKPH_PORTAL_DIR . 'includes/class-akph-roles.php';
require_once AKPH_PORTAL_DIR . 'includes/class-akph-settings.php';
require_once AKPH_PORTAL_DIR . 'includes/class-akph-auth.php';
require_once AKPH_PORTAL_DIR . 'includes/class-akph-db.php';
require_once AKPH_PORTAL_DIR . 'includes/class-akph-input.php';
require_once AKPH_PORTAL_DIR . 'includes/class-akph-audit.php';
require_once AKPH_PORTAL_DIR . 'includes/class-akph-numbering.php';
require_once AKPH_PORTAL_DIR . 'includes/class-akph-command.php';
require_once AKPH_PORTAL_DIR . 'includes/class-akph-projects.php';
require_once AKPH_PORTAL_DIR . 'includes/class-akph-master-data.php';
require_once AKPH_PORTAL_DIR . 'includes/class-akph-accounts.php';
require_once AKPH_PORTAL_DIR . 'includes/class-akph-ledger.php';
require_once AKPH_PORTAL_DIR . 'includes/class-akph-reports.php';
require_once AKPH_PORTAL_DIR . 'includes/class-akph-rest.php';
require_once AKPH_PORTAL_DIR . 'includes/class-akph-migration.php';
require_once AKPH_PORTAL_DIR . 'includes/class-akph-admin.php';
require_once AKPH_PORTAL_DIR . 'includes/class-akph-app.php';

register_activation_hook(__FILE__, array('Akph_Plugin', 'activate'));
// Deactivation only stops the daily cleanup; tables, options and capabilities stay (no uninstall.php either).
register_deactivation_hook(__FILE__, array('Akph_Plugin', 'deactivate'));

/** Wires the plugin into WordPress. Nothing here touches the tables or data of paydar-portal. */
final class Akph_Plugin {
    public static function boot() {
        // Migrations run on every request until the stored version matches (not only on activation):
        // replacing the plugin files through an upload never fires the activation hook.
        add_action('plugins_loaded', array('Akph_Schema', 'maybe_migrate'), 5);
        add_action('plugins_loaded', array('Akph_Roles', 'maybe_install'), 6);
        add_action('rest_api_init', array('Akph_Rest', 'register_routes'));
        add_filter('rest_post_dispatch', array('Akph_Rest', 'no_store_headers'), 10, 3);
        add_filter('rest_namespace_index', array('Akph_Rest', 'protect_index'), 10, 2);
        add_action('akph_portal_daily', array('Akph_Command', 'purge_old_keys'));
        if (!wp_next_scheduled('akph_portal_daily')) {
            wp_schedule_event(time() + HOUR_IN_SECONDS, 'daily', 'akph_portal_daily');
        }
        Akph_Admin::boot();
        Akph_App::boot();
    }

    public static function activate() {
        Akph_Schema::migrate();
        Akph_Roles::install();
    }

    public static function deactivate() {
        wp_clear_scheduled_hook('akph_portal_daily');
    }
}

Akph_Plugin::boot();
