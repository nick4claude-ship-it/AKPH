<?php
/**
 * Who may call a route, and which projects they see.
 *
 * Every akph/v1 route has a real permission_callback built here: signed in (401), a valid WordPress REST
 * nonce in X-WP-Nonce (403), one of the four portal roles (403), the route's capability (403) and the
 * migrated schema (503). Project scope: users without akph_view_all (project managers) see only projects
 * whose manager_user_id is their user id, and never records without a project.
 */
if (!defined('ABSPATH')) {
    exit;
}

final class Akph_Auth {
    /** @var array<int,int[]> */
    private static $own_projects = array();

    /** permission_callback for a route that needs `$cap`. */
    public static function require_cap($cap) {
        return function (WP_REST_Request $request) use ($cap) {
            return Akph_Auth::check($request, $cap);
        };
    }

    public static function check(WP_REST_Request $request, $cap) {
        if (!is_user_logged_in()) {
            return new WP_Error('akph_unauthorized', 'برای استفاده از پرتال وارد حساب کاربری شوید.', array('status' => 401));
        }
        $nonce = $request->get_header('X-WP-Nonce');
        if (!is_string($nonce) || $nonce === '' || !wp_verify_nonce($nonce, 'wp_rest')) {
            return new WP_Error('akph_invalid_nonce', 'نشست صفحه منقضی شده است (X-WP-Nonce نامعتبر)؛ صفحه را تازه کنید.', array('status' => 403));
        }
        $user = wp_get_current_user();
        if (!Akph_Roles::role_of($user)) {
            return new WP_Error('akph_no_portal_role', 'حساب شما نقش پرتال (مدیر سیستم، مدیر ارشد، حسابدار یا مدیر پروژه) ندارد.', array('status' => 403));
        }
        if (!user_can($user, Akph_Roles::ACCESS) || !user_can($user, $cap)) {
            return new WP_Error('akph_role_forbidden', 'نقش شما مجاز به این عملیات نیست.', array('status' => 403));
        }
        if (!Akph_Schema::ready()) {
            return new WP_Error('akph_not_ready', 'جدول‌های پرتال آماده نیست (PHP ۶۴ بیتی و موتور InnoDB لازم است). مدیر سیستم صفحه تنظیمات پرتال را ببیند.', array('status' => 503));
        }
        return true;
    }

    public static function can($cap) {
        return current_user_can($cap);
    }

    public static function view_all() {
        return current_user_can(Akph_Roles::VIEW_ALL);
    }

    /** Ids of the projects the current user manages (manager_user_id = user id). */
    public static function own_project_ids() {
        global $wpdb;
        $uid = get_current_user_id();
        if (!isset(self::$own_projects[$uid])) {
            $ids = $uid > 0 ? $wpdb->get_col($wpdb->prepare('SELECT id FROM ' . Akph_Schema::table('projects') . ' WHERE manager_user_id = %d', $uid)) : array();
            self::$own_projects[$uid] = array_map('intval', (array) $ids);
        }
        return self::$own_projects[$uid];
    }

    /** Forget cached project scopes (after a project is created or reassigned; tests switch users). */
    public static function flush() {
        self::$own_projects = array();
    }

    /** May the current user see or act on records of this project? A null project is headquarters. */
    public static function can_access_project($project_id) {
        if (self::view_all()) {
            return true;
        }
        $project_id = (int) $project_id;
        return $project_id > 0 && in_array($project_id, self::own_project_ids(), true);
    }

    /** Throws 403 (scope) unless the project is accessible. */
    public static function assert_project($project_id) {
        if (!self::can_access_project($project_id)) {
            throw Akph_Error::forbidden($project_id ? 'این رکورد متعلق به پروژه‌ای است که مدیریت آن با شما نیست.' : 'رکوردهای ستادی (بدون پروژه) در دسترس مدیر پروژه نیست.');
        }
    }

    public static function assert_cap($cap, $message = 'نقش شما مجاز به این عملیات نیست.') {
        if (!current_user_can($cap)) {
            throw Akph_Error::forbidden($message);
        }
    }

    /** SQL condition limiting `$column` (a project id column) to the user's scope; '1=1' for view-all users. */
    public static function project_scope_sql($column) {
        if (self::view_all()) {
            return '1=1';
        }
        $ids = self::own_project_ids();
        return $ids ? $column . ' IN (' . implode(',', array_map('intval', $ids)) . ')' : '1=0';
    }
}
