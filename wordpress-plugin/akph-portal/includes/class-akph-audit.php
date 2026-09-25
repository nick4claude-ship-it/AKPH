<?php
/**
 * Audit trail: who (WordPress user id, never a display name), what, and the record before and after.
 * Written inside the command's transaction, so a rolled-back command leaves no audit row either.
 */
if (!defined('ABSPATH')) {
    exit;
}

final class Akph_Audit {
    /** Request key of the running command (Idempotency-Key), stored with each audit row. */
    private static $request_key = '';

    public static function set_request_key($key) {
        self::$request_key = (string) $key;
    }

    public static function log($action, $object_type, $object_id, $before, $after, $object_ref = '') {
        Akph_Db::insert(Akph_Schema::table('audit_log'), array(
            'user_id' => get_current_user_id(),
            'action' => substr((string) $action, 0, 64),
            'object_type' => substr((string) $object_type, 0, 32),
            'object_id' => (int) $object_id,
            'object_ref' => substr((string) $object_ref, 0, 64),
            'before_data' => $before === null ? null : wp_json_encode($before),
            'after_data' => $after === null ? null : wp_json_encode($after),
            'request_key' => self::$request_key,
            'created_at' => Akph_Db::now_utc(),
        ));
    }

    /** Latest audit rows (before/after included for the reviewers who may read the audit trail). */
    public static function list_rows($page, $per_page, $object_type = '', $object_id = 0) {
        global $wpdb;
        $t = Akph_Schema::table('audit_log');
        $where = '1=1';
        if ($object_type !== '') {
            $where .= $wpdb->prepare(' AND object_type = %s', $object_type);
        }
        if ($object_id > 0) {
            $where .= $wpdb->prepare(' AND object_id = %d', $object_id);
        }
        $offset = ($page - 1) * $per_page;
        $rows = Akph_Db::results("SELECT * FROM {$t} WHERE {$where} ORDER BY id DESC LIMIT {$per_page} OFFSET {$offset}");
        $total = (int) Akph_Db::value("SELECT COUNT(*) FROM {$t} WHERE {$where}");
        $out = array();
        foreach ((array) $rows as $r) {
            $user = get_userdata((int) $r->user_id);
            $out[] = array(
                'id' => (string) $r->id,
                'user_id' => (string) $r->user_id,
                'user_name' => $user ? $user->display_name : '',
                'user_role' => $user ? Akph_Roles::label(Akph_Roles::role_of($user)) : '',
                'action' => $r->action,
                'object_type' => $r->object_type,
                'object_id' => (string) $r->object_id,
                'object_ref' => $r->object_ref,
                'before' => $r->before_data === null ? null : json_decode($r->before_data, true),
                'after' => $r->after_data === null ? null : json_decode($r->after_data, true),
                'created_at' => Akph_Db::iso_time($r->created_at),
            );
        }
        return array('events' => $out, 'page' => $page, 'total' => $total);
    }
}
