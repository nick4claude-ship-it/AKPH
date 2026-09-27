<?php
/**
 * Approval steps shared by petty cash and treasury (reference: PETTY_STEP_ACTION and checkPermission in
 * src/utils/permissions.ts, docs/SERVER-RULES.md §1–2).
 *
 * A step names the portal role that acts on it: «مدیر پروژه», «حسابدار» or «مدیر ارشد». The system
 * administrator and the senior manager may act on every step (their role allows every action); a project
 * manager only on the «مدیر پروژه» step of own projects; an accountant only on the «حسابدار» step.
 * Separation of duties, compared by user id and never overridden: the creator does not approve, and nobody
 * approves two consecutive steps of the same record.
 */
if (!defined('ABSPATH')) {
    exit;
}

final class Akph_Flow {
    const PM = 'مدیر پروژه';
    const ACCOUNTANT = 'حسابدار';
    const SENIOR = 'مدیر ارشد';
    const STEP_ROLES = array(self::PM, self::ACCOUNTANT, self::SENIOR);

    /** Portal role slug of the current user. */
    public static function role() {
        return Akph_Roles::role_of(wp_get_current_user());
    }

    public static function is_senior_or_admin() {
        return in_array(self::role(), array('administrator', 'paydar_senior_manager'), true);
    }

    /** May the current user act on a step of this role, for a record of `$project_id`? */
    public static function can_act($step_role, $project_id) {
        $slug = self::role();
        if (in_array($slug, array('administrator', 'paydar_senior_manager'), true)) {
            return true;
        }
        if ($step_role === self::PM) {
            return $slug === 'paydar_project_manager' && (int) $project_id > 0 && in_array((int) $project_id, Akph_Auth::own_project_ids(), true);
        }
        if ($step_role === self::ACCOUNTANT) {
            return $slug === 'paydar_accountant';
        }
        return false;
    }

    /** Throws unless the current user may act on the step and is neither the creator nor the previous approver. */
    public static function assert_step($step_role, $project_id, $created_by, $last_approved_by) {
        $uid = get_current_user_id();
        if ((int) $created_by === $uid) {
            throw new Akph_Error('akph_segregation_of_duties', 'تأیید یا رد رکوردی که خودتان ثبت کرده‌اید مجاز نیست (تفکیک وظایف).', 403);
        }
        if ($last_approved_by && (int) $last_approved_by === $uid) {
            throw new Akph_Error('akph_segregation_of_duties', 'مرحله قبلی این رکورد را خودتان تأیید کرده‌اید؛ دو مرحله پشت‌سرهم یک رکورد را یک نفر تأیید نمی‌کند (تفکیک وظایف).', 403);
        }
        if (!self::can_act($step_role, $project_id)) {
            throw Akph_Error::forbidden('این مرحله («' . $step_role . '») با نقش شما نیست' . ($step_role === self::PM ? ' یا پروژه متعلق به شما نیست' : '') . '.');
        }
    }

    /** Chain stored on a record ('مدیر پروژه|حسابدار') → roles. */
    public static function chain($stored) {
        return array_values(array_filter(explode('|', (string) $stored), 'strlen'));
    }

    /** History row appended to a record's JSON history. */
    public static function push_history($json, $action, $step, $comment = '') {
        $rows = json_decode((string) $json, true);
        $rows = is_array($rows) ? $rows : array();
        $user = wp_get_current_user();
        $rows[] = array(
            'action' => $action,
            'step' => (string) $step,
            'user_id' => (string) $user->ID,
            'user_name' => $user->display_name,
            'role' => Akph_Roles::label(Akph_Roles::role_of($user)),
            'at' => gmdate('Y-m-d\TH:i:s\Z'),
            'comment' => (string) $comment,
        );
        return wp_json_encode($rows);
    }

    public static function history($json) {
        $rows = json_decode((string) $json, true);
        return is_array($rows) ? $rows : array();
    }

    public static function user_name($uid) {
        $u = $uid ? get_userdata((int) $uid) : null;
        return $u ? $u->display_name : '';
    }
}
