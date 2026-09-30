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
    /**
     * 1 — 0.3.0; 2 — akph_assistant_use (all four roles) and akph_ai_manage (system administrator);
     * 3 — petty cash, treasury and approvals (0.6.0); 4 — akph_report_settings (system administrator, 0.6.1);
     * 5 — contracts and progress statements (0.7.0); 6 — procurement, inventory and payroll (0.8.0).
     */
    const ROLES_VERSION = '6';
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
    /** Petty cash: submit expenses and replenishment requests (fund holder or project manager of the project). */
    const PETTY_SUBMIT = 'akph_petty_submit';
    /** Petty cash: act on an approval step (the step's role decides who: PM, accountant, senior manager). */
    const PETTY_APPROVE = 'akph_petty_approve';
    /** Petty cash: funds, categories, settings, counts and period close. */
    const PETTY_MANAGE = 'akph_petty_manage';
    /** Treasury: bank accounts and cash desks, payments, receipts, transfers, cheques, reconciliation. */
    const TREASURY_MANAGE = 'akph_treasury_manage';
    /** Treasury: approve payment requests (senior manager above the threshold) and receipts. */
    const PAYMENT_APPROVE = 'akph_payment_approve';
    /** Treasury: create manual payment requests. */
    const PAYMENT_REQUEST = 'akph_payment_request';
    /** «تنظیمات گزارش و چاپ»: letterhead, logo and signatories (system administrator only). */
    const REPORT_SETTINGS = 'akph_report_settings';
    /** Contracts: create and edit contracts, amendments, guarantees and subcontract advances. */
    const CONTRACTS_MANAGE = 'akph_contracts_manage';
    /** Act on an approval step of a contract, amendment or statement (the step's role decides who). */
    const CONTRACTS_APPROVE = 'akph_contracts_approve';
    /** Prepare progress statements (measurement, sending) for own projects. */
    const STATEMENTS_PREPARE = 'akph_statements_prepare';
    /** Purchase requisitions for own projects. */
    const PROCUREMENT_REQUEST = 'akph_procurement_request';
    /** Requests for quotation, quotes, purchase orders and vendor invoices (registration). */
    const PROCUREMENT_MANAGE = 'akph_procurement_manage';
    /** Act on an approval step of a requisition, purchase order or vendor invoice (the step's role decides who). */
    const PROCUREMENT_APPROVE = 'akph_procurement_approve';
    /** Goods and service receipts against purchase orders, returns to the supplier. */
    const INVENTORY_RECEIVE = 'akph_inventory_receive';
    /** Store issues (request, confirm), returns from a project and transfers between warehouses. */
    const INVENTORY_ISSUE = 'akph_inventory_issue';
    /** Materials, warehouses and stocktakes (count and approval). */
    const INVENTORY_MANAGE = 'akph_inventory_manage';
    /** Employees (with their personal data), timesheets, payroll calculation and approval. */
    const PAYROLL_MANAGE = 'akph_payroll_manage';

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
            self::PETTY_SUBMIT, self::PETTY_APPROVE, self::PETTY_MANAGE, self::TREASURY_MANAGE, self::PAYMENT_APPROVE,
            self::PAYMENT_REQUEST, self::REPORT_SETTINGS, self::CONTRACTS_MANAGE, self::CONTRACTS_APPROVE, self::STATEMENTS_PREPARE,
            self::PROCUREMENT_REQUEST, self::PROCUREMENT_MANAGE, self::PROCUREMENT_APPROVE, self::INVENTORY_RECEIVE,
            self::INVENTORY_ISSUE, self::INVENTORY_MANAGE, self::PAYROLL_MANAGE,
        );
    }

    /** Mirrors ROLE_PERMISSIONS in src/utils/permissions.ts: system admin and senior manager may do everything. */
    public static function grants() {
        $senior = array_values(array_diff(self::all_caps(), array(self::PROJECTS_EDIT_EXEC_OWN, self::AI_MANAGE, self::REPORT_SETTINGS)));
        return array(
            'administrator' => array_merge($senior, array(self::AI_MANAGE, self::REPORT_SETTINGS)),
            'paydar_senior_manager' => $senior,
            'paydar_accountant' => array(
                self::ACCESS, self::VIEW_ALL, self::PROJECTS_EDIT_FINANCIAL, self::MASTER_DATA, self::ACCOUNTS_MANAGE,
                self::JOURNAL_CREATE, self::JOURNAL_APPROVE, self::JOURNAL_REVERSE, self::REPORTS, self::AUDIT_READ,
                self::ASSISTANT_USE, self::PETTY_SUBMIT, self::PETTY_APPROVE, self::PETTY_MANAGE, self::TREASURY_MANAGE,
                self::PAYMENT_APPROVE, self::PAYMENT_REQUEST, self::CONTRACTS_MANAGE, self::CONTRACTS_APPROVE,
                self::PROCUREMENT_MANAGE, self::PROCUREMENT_APPROVE, self::INVENTORY_RECEIVE, self::INVENTORY_MANAGE, self::PAYROLL_MANAGE,
            ),
            'paydar_project_manager' => array(
                self::ACCESS, self::PROJECTS_EDIT_EXEC_OWN, self::REPORTS, self::ASSISTANT_USE, self::PETTY_SUBMIT, self::PETTY_APPROVE,
                self::CONTRACTS_APPROVE, self::STATEMENTS_PREPARE, self::PROCUREMENT_REQUEST, self::PROCUREMENT_APPROVE,
                self::INVENTORY_RECEIVE, self::INVENTORY_ISSUE,
            ),
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
