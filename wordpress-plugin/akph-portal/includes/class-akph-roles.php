<?php
/**
 * Capabilities akph_* added to the four existing roles. No role is created and no capability is ever
 * removed (paydar-portal keeps working with its own paydar_* capabilities). The grant set is versioned
 * in the option akph_portal_roles_version, like paydar_portal_roles_version.
 */
if (!defined('ABSPATH')) {
    exit;
}

final class Akph_Roles {
    /** 1 — 0.3.0; 2 — akph_assistant_use (all four roles) and akph_ai_manage (system administrator). */
    const ROLES_VERSION = '2';
    const OPTION_VERSION = 'akph_portal_roles_version';

    const ACCESS = 'akph_access';
    const VIEW_ALL = 'akph_view_all';
    const PROJECTS_CREATE = 'akph_projects_create';
    const PROJECTS_EDIT_BASE = 'akph_projects_edit_base';
    const PROJECTS_EDIT_BUDGET = 'akph_projects_edit_budget';
    const PROJECTS_ASSIGN = 'akph_projects_assign';
    const PROJECTS_EDIT_EXEC_ALL = 'akph_projects_edit_exec_all';
    const PROJECTS_EDIT_EXEC_OWN = 'akph_projects_edit_exec_own';
    const PROJECTS_EDIT_FINANCIAL = 'akph_projects_edit_financial';
    const MASTER_DATA = 'akph_master_data';
    const ACCOUNTS_MANAGE = 'akph_accounts_manage';
    const JOURNAL_CREATE = 'akph_journal_create';
    const JOURNAL_APPROVE = 'akph_journal_approve';
    const JOURNAL_REVERSE = 'akph_journal_reverse';
    const REPORTS = 'akph_reports';
    const AUDIT_READ = 'akph_audit_read';
    const SETTINGS = 'akph_settings';
    /** Ask the management assistant (server-side language model, the user's own data scope). */
    const ASSISTANT_USE = 'akph_assistant_use';
    /** Assistant settings and the API key: system administrator only. */
    const AI_MANAGE = 'akph_ai_manage';

    /** WordPress role slug → portal role label (docs/SERVER-RULES.md §1), in order of precedence. */
    const PORTAL_ROLES = array(
        'administrator' => 'مدیر سیستم',
        'paydar_senior_manager' => 'مدیر ارشد',
        'paydar_accountant' => 'حسابدار',
        'paydar_project_manager' => 'مدیر پروژه',
    );

    public static function all_caps() {
        return array(
            self::ACCESS, self::VIEW_ALL, self::PROJECTS_CREATE, self::PROJECTS_EDIT_BASE, self::PROJECTS_EDIT_BUDGET,
            self::PROJECTS_ASSIGN, self::PROJECTS_EDIT_EXEC_ALL, self::PROJECTS_EDIT_EXEC_OWN, self::PROJECTS_EDIT_FINANCIAL,
            self::MASTER_DATA, self::ACCOUNTS_MANAGE, self::JOURNAL_CREATE, self::JOURNAL_APPROVE, self::JOURNAL_REVERSE,
            self::REPORTS, self::AUDIT_READ, self::SETTINGS, self::ASSISTANT_USE, self::AI_MANAGE,
        );
    }

    /** Mirrors ROLE_PERMISSIONS in src/utils/permissions.ts: system admin and senior manager may do everything. */
    public static function grants() {
        $senior = array_values(array_diff(self::all_caps(), array(self::PROJECTS_EDIT_EXEC_OWN, self::AI_MANAGE)));
        return array(
            'administrator' => array_merge($senior, array(self::AI_MANAGE)),
            'paydar_senior_manager' => $senior,
            'paydar_accountant' => array(
                self::ACCESS, self::VIEW_ALL, self::PROJECTS_EDIT_FINANCIAL, self::MASTER_DATA, self::ACCOUNTS_MANAGE,
                self::JOURNAL_CREATE, self::JOURNAL_APPROVE, self::JOURNAL_REVERSE, self::REPORTS, self::AUDIT_READ,
                self::ASSISTANT_USE,
            ),
            'paydar_project_manager' => array(self::ACCESS, self::PROJECTS_EDIT_EXEC_OWN, self::REPORTS, self::ASSISTANT_USE),
        );
    }

    public static function maybe_install() {
        if (get_option(self::OPTION_VERSION) !== self::ROLES_VERSION) {
            self::install();
        }
    }

    /**
     * Additive: add_cap only, on roles that exist. The version is stored only when all four roles exist, so a
     * role created later (paydar-portal activated after this plugin) still gets its capabilities on a later
     * request. Missing roles are reported in the settings screen. Returns the missing role slugs.
     */
    public static function install() {
        $missing = array();
        foreach (self::grants() as $slug => $caps) {
            $role = get_role($slug);
            if (!$role) {
                $missing[] = $slug;
                continue;
            }
            foreach ($caps as $cap) {
                if (!$role->has_cap($cap)) {
                    $role->add_cap($cap, true);
                }
            }
        }
        if (!$missing) {
            update_option(self::OPTION_VERSION, self::ROLES_VERSION, false);
        }
        return $missing;
    }

    /** Roles of the list above that do not exist on this site (paydar-portal creates them). */
    public static function missing_roles() {
        $missing = array();
        foreach (array_keys(self::PORTAL_ROLES) as $slug) {
            if (!get_role($slug)) {
                $missing[] = $slug;
            }
        }
        return $missing;
    }

    /** Portal role slug of a user (highest precedence), or null for a user outside the portal. */
    public static function role_of($user) {
        if (!$user instanceof WP_User || !$user->exists()) {
            return null;
        }
        foreach (array_keys(self::PORTAL_ROLES) as $slug) {
            if (in_array($slug, (array) $user->roles, true)) {
                return $slug;
            }
        }
        return null;
    }

    public static function label($slug) {
        return isset(self::PORTAL_ROLES[$slug]) ? self::PORTAL_ROLES[$slug] : '';
    }
}
