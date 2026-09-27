<?php
/**
 * Routes of the REST namespace akph/v1 (docs/API-CONTRACT.md). Every route has a permission_callback from
 * Akph_Auth (login, X-WP-Nonce, portal role, capability); handlers check record-level rules (project scope,
 * field groups, separation of duties). Reads return data; writes go through Akph_Command.
 */
if (!defined('ABSPATH')) {
    exit;
}

final class Akph_Rest {
    const NS = 'akph/v1';
    const ID = '(?P<id>[1-9][0-9]{0,18})';

    public static function register_routes() {
        $r = Akph_Roles::class;
        $routes = array(
            '/me' => array(array('GET', 'me', $r::ACCESS)),
            '/projects' => array(array('GET', 'list_projects', $r::ACCESS), array('POST', 'create_project', $r::PROJECTS_CREATE)),
            '/projects/managers' => array(array('GET', 'list_managers', $r::PROJECTS_ASSIGN)),
            '/projects/' . self::ID => array(array('GET', 'get_project', $r::ACCESS), array('POST, PUT, PATCH', 'update_project', $r::ACCESS)),
            '/cost-centers' => array(array('GET', 'list_cost_centers', $r::ACCESS), array('POST', 'create_cost_center', $r::MASTER_DATA)),
            '/cost-centers/' . self::ID => array(array('POST, PUT, PATCH', 'update_cost_center', $r::MASTER_DATA)),
            '/counterparties' => array(array('GET', 'list_counterparties', $r::ACCESS), array('POST', 'create_counterparty', $r::MASTER_DATA)),
            '/counterparties/' . self::ID => array(array('POST, PUT, PATCH', 'update_counterparty', $r::MASTER_DATA)),
            '/accounts' => array(array('GET', 'list_accounts', $r::VIEW_ALL), array('POST', 'create_account', $r::ACCOUNTS_MANAGE)),
            '/accounts/' . self::ID => array(array('POST, PUT, PATCH', 'update_account', $r::ACCOUNTS_MANAGE)),
            '/journal-entries' => array(array('GET', 'list_entries', $r::VIEW_ALL), array('POST', 'create_entry', $r::JOURNAL_CREATE)),
            '/journal-entries/' . self::ID => array(array('GET', 'get_entry', $r::VIEW_ALL), array('POST, PUT, PATCH', 'update_entry', $r::JOURNAL_CREATE)),
            '/journal-entries/' . self::ID . '/post' => array(array('POST', 'post_entry', $r::JOURNAL_APPROVE)),
            '/journal-entries/' . self::ID . '/reject' => array(array('POST', 'reject_entry', $r::JOURNAL_APPROVE)),
            '/journal-entries/' . self::ID . '/reverse' => array(array('POST', 'reverse_entry', $r::JOURNAL_REVERSE)),
            '/reports/trial-balance' => array(array('GET', 'trial_balance', $r::REPORTS)),
            '/reports/ledger' => array(array('GET', 'ledger', $r::REPORTS)),
            '/audit' => array(array('GET', 'audit', $r::AUDIT_READ)),
            // «حساب کاربری من»: the signed-in user's own account only (no user id in any of these routes).
            '/account' => array(array('GET', 'account', $r::ACCESS)),
            '/account/profile' => array(array('POST', 'account_profile', $r::ACCESS)),
            '/account/email' => array(array('POST', 'account_email', $r::ACCESS)),
            '/account/password' => array(array('POST', 'account_password', $r::ACCESS)),
            '/account/avatar' => array(array('POST', 'account_avatar', $r::ACCESS), array('DELETE', 'account_avatar_delete', $r::ACCESS)),
            '/account/sessions' => array(array('GET', 'account_sessions', $r::ACCESS)),
            '/account/sessions/logout-others' => array(array('POST', 'account_logout_others', $r::ACCESS)),
            // Document center and attachments (project scope as for projects; archived, never deleted).
            '/documents' => array(array('GET', 'list_documents', $r::ACCESS), array('POST', 'upload_document', $r::ACCESS)),
            '/documents/' . self::ID => array(array('GET', 'get_document', $r::ACCESS)),
            '/documents/' . self::ID . '/download' => array(array('GET', 'download_document', $r::ACCESS)),
            '/documents/' . self::ID . '/links' => array(array('POST', 'link_document', $r::ACCESS)),
            '/documents/' . self::ID . '/archive' => array(array('POST', 'archive_document', $r::ACCESS)),
            // Petty cash (funds, categories, settings, expenses, replenishment, count, period close).
            '/petty-cash' => array(array('GET', 'petty_overview', $r::PETTY_SUBMIT)),
            '/petty-cash/settings' => array(array('GET', 'petty_settings', $r::PETTY_SUBMIT), array('POST', 'petty_update_settings', $r::SETTINGS)),
            '/petty-cash/categories' => array(array('GET', 'petty_categories', $r::PETTY_SUBMIT), array('POST', 'petty_replace_categories', $r::PETTY_MANAGE)),
            '/petty-cash/funds' => array(array('POST', 'petty_create_fund', $r::PETTY_MANAGE)),
            '/petty-cash/funds/' . self::ID => array(array('GET', 'petty_statement', $r::PETTY_SUBMIT), array('POST, PUT, PATCH', 'petty_update_fund', $r::PETTY_MANAGE)),
            '/petty-cash/funds/' . self::ID . '/count' => array(array('POST', 'petty_count', $r::PETTY_MANAGE)),
            '/petty-cash/funds/' . self::ID . '/close-period' => array(array('POST', 'petty_close_period', $r::PETTY_MANAGE)),
            '/petty-cash/expenses' => array(array('POST', 'petty_submit_expense', $r::PETTY_SUBMIT)),
            '/petty-cash/expenses/' . self::ID . '/approve' => array(array('POST', 'petty_approve_expense', $r::PETTY_APPROVE)),
            '/petty-cash/expenses/' . self::ID . '/reject' => array(array('POST', 'petty_reject_expense', $r::PETTY_APPROVE)),
            '/petty-cash/requests' => array(array('POST', 'petty_create_request', $r::PETTY_SUBMIT)),
            '/petty-cash/requests/' . self::ID . '/approve' => array(array('POST', 'petty_approve_request', $r::PETTY_APPROVE)),
            '/petty-cash/requests/' . self::ID . '/reject' => array(array('POST', 'petty_reject_request', $r::PETTY_APPROVE)),
            // Treasury (bank accounts and cash desks, payment requests, payments, receipts, transfers, cheques,
            // bank reconciliation, payment schedule). Balances always come from the ledger.
            '/treasury' => array(array('GET', 'treasury_overview', $r::VIEW_ALL)),
            '/treasury/settings' => array(array('GET', 'treasury_settings', $r::VIEW_ALL), array('POST', 'treasury_update_settings', $r::SETTINGS)),
            '/treasury/schedule' => array(array('GET', 'treasury_schedule', $r::VIEW_ALL)),
            '/treasury/accounts' => array(array('GET', 'treasury_accounts', $r::VIEW_ALL), array('POST', 'treasury_create_account', $r::TREASURY_MANAGE)),
            '/treasury/accounts/' . self::ID => array(array('POST, PUT, PATCH', 'treasury_update_account', $r::TREASURY_MANAGE)),
            '/treasury/accounts/' . self::ID . '/movements' => array(array('GET', 'treasury_movements', $r::VIEW_ALL)),
            '/treasury/accounts/' . self::ID . '/reconciliation' => array(array('GET', 'treasury_reconciliation', $r::VIEW_ALL)),
            '/treasury/accounts/' . self::ID . '/statement' => array(array('POST', 'treasury_import_statement', $r::TREASURY_MANAGE)),
            '/treasury/transfers' => array(array('POST', 'treasury_transfer', $r::TREASURY_MANAGE)),
            '/payment-requests' => array(array('GET', 'payment_requests', $r::VIEW_ALL), array('POST', 'payment_request_create', $r::PAYMENT_REQUEST)),
            '/payment-requests/' . self::ID . '/approve' => array(array('POST', 'payment_request_approve', $r::PAYMENT_APPROVE)),
            '/payment-requests/' . self::ID . '/reject' => array(array('POST', 'payment_request_reject', $r::PAYMENT_APPROVE)),
            '/payment-requests/' . self::ID . '/pay' => array(array('POST', 'payment_request_pay', $r::TREASURY_MANAGE)),
            '/receipts' => array(array('POST', 'receipt_create', $r::TREASURY_MANAGE)),
            '/receipts/' . self::ID . '/approve' => array(array('POST', 'receipt_approve', $r::PAYMENT_APPROVE)),
            '/receipts/' . self::ID . '/reject' => array(array('POST', 'receipt_reject', $r::PAYMENT_APPROVE)),
            '/cheques/' . self::ID . '/status' => array(array('POST', 'cheque_status', $r::TREASURY_MANAGE)),
            '/bank-statement-lines/' . self::ID . '/match' => array(array('POST', 'bank_line_match', $r::TREASURY_MANAGE)),
            '/bank-statement-lines/' . self::ID . '/voucher' => array(array('POST', 'bank_line_voucher', $r::TREASURY_MANAGE)),
            // Approval center: everything waiting for the signed-in user, from every server module.
            '/approvals' => array(array('GET', 'approvals', $r::ACCESS)),
            // «دستیار مدیریت»: the language model is called by the server only; settings for the system administrator.
            '/assistant/status' => array(array('GET', 'assistant_status', $r::ASSISTANT_USE)),
            '/assistant/ask' => array(array('POST', 'assistant_ask', $r::ASSISTANT_USE)),
            '/assistant/settings' => array(array('GET', 'assistant_settings', $r::AI_MANAGE), array('POST', 'assistant_update_settings', $r::AI_MANAGE)),
            '/assistant/test' => array(array('POST', 'assistant_test', $r::AI_MANAGE)),
        );
        foreach ($routes as $path => $defs) {
            $args = array();
            foreach ($defs as $def) {
                $args[] = array(
                    'methods' => $def[0],
                    'callback' => array(__CLASS__, $def[1]),
                    'permission_callback' => Akph_Auth::require_cap($def[2]),
                    // Kept out of the public /wp-json index; the namespace index itself needs portal access.
                    'show_in_index' => false,
                );
            }
            register_rest_route(self::NS, $path, $args);
        }
    }

    /** GET /akph/v1 (the namespace index WordPress adds) answers only users with portal access. */
    public static function protect_index($response, $request) {
        if ($request instanceof WP_REST_Request && $request->get_param('namespace') === self::NS) {
            $allowed = Akph_Auth::check($request, Akph_Roles::ACCESS);
            if ($allowed !== true) {
                return $allowed;
            }
        }
        return $response;
    }

    /** Responses of akph/v1 are personal and must never be cached (LiteSpeed, CDN, browser). */
    public static function no_store_headers($response, $server, $request) {
        if ($response instanceof WP_HTTP_Response && strpos((string) $request->get_route(), '/' . self::NS) === 0) {
            $response->header('Cache-Control', 'no-store, no-cache, must-revalidate, private, max-age=0');
            $response->header('Pragma', 'no-cache');
            $response->header('X-LiteSpeed-Cache-Control', 'no-cache');
        }
        return $response;
    }

    /** Runs a read; an Akph_Error becomes its WP_Error. */
    private static function read(callable $fn) {
        try {
            return rest_ensure_response($fn());
        } catch (Akph_Error $e) {
            return $e->to_wp_error();
        } catch (Throwable $e) {
            error_log('[akph-portal] read failed: ' . $e->getMessage());
            return new WP_Error('akph_server_error', 'خطای سرور.', array('status' => 500));
        }
    }

    private static function id(WP_REST_Request $request) {
        $params = $request->get_url_params();
        return (int) $params['id'];
    }

    private static function page(WP_REST_Request $request, $default_per_page, $max_per_page) {
        $page = max(1, min(100000, (int) ($request->get_param('page') ?: 1)));
        $per = (int) ($request->get_param('per_page') ?: $default_per_page);
        return array($page, max(1, min($max_per_page, $per)));
    }

    // ------------------------------------------------------------------ session

    public static function me(WP_REST_Request $request) {
        return self::read(function () {
            return self::me_data();
        });
    }

    private static function me_data() {
        $user = wp_get_current_user();
        $slug = Akph_Roles::role_of($user);
        $caps = array();
        foreach (Akph_Roles::all_caps() as $cap) {
            $caps[$cap] = user_can($user, $cap);
        }
        $today = Akph_Jalali::today_iso();
        return array(
            'id' => (string) $user->ID,
            'display_name' => $user->display_name,
            'avatar_url' => Akph_Account::avatar_url($user->ID),
            'role' => Akph_Roles::label($slug),
            'role_slug' => $slug,
            'view_all' => Akph_Auth::view_all(),
            'project_ids' => Akph_Auth::view_all() ? array() : array_map('strval', Akph_Auth::own_project_ids()),
            // Display unit for this user (personal preference, else the site setting); amounts are always Rials.
            'currency' => Akph_Account::effective_currency($user->ID),
            'site_currency' => Akph_Settings::get('currency'),
            'preferences' => Akph_Account::preferences($user->ID),
            'fiscal_year' => Akph_Jalali::fiscal_year($today),
            'closed_fiscal_years' => Akph_Settings::get('closed_fiscal_years'),
            'document_max_bytes' => Akph_Documents::max_bytes(),
            'today' => $today,
            'caps' => $caps,
            'server_version' => AKPH_PORTAL_VERSION,
        );
    }

    // ------------------------------------------------------------------ own account

    public static function account(WP_REST_Request $request) {
        return self::read(function () use ($request) {
            Akph_Account::assert_query($request);
            return array('account' => Akph_Account::current());
        });
    }

    public static function account_profile(WP_REST_Request $request) {
        return Akph_Command::run($request, function ($body) use ($request) {
            Akph_Account::assert_fields($request, $body, array('display_name', 'first_name', 'last_name', 'mobile', 'preferences', 'version'));
            return Akph_Account::update_profile($body, Akph_Input::version($request, $body));
        });
    }

    public static function account_email(WP_REST_Request $request) {
        return self::with_password_attempts(function () use ($request) {
            return Akph_Command::run($request, function ($body) use ($request) {
                Akph_Account::assert_fields($request, $body, array('email', 'current_password'));
                return Akph_Account::change_email($body);
            }, array('secret' => array('current_password')));
        });
    }

    public static function account_password(WP_REST_Request $request) {
        return self::with_password_attempts(function () use ($request) {
            return Akph_Command::run($request, function ($body) use ($request) {
                Akph_Account::assert_fields($request, $body, array('current_password', 'new_password'));
                return Akph_Account::change_password($body);
            }, array('secret' => array('current_password', 'new_password')));
        });
    }

    /** Refuses while wrong-password attempts are used up; counts a wrong password after its command rolled back. */
    private static function with_password_attempts(callable $command) {
        $locked = Akph_Account::attempts_error();
        if ($locked) {
            return $locked;
        }
        $response = $command();
        if (is_wp_error($response) && $response->get_error_code() === 'akph_wrong_password') {
            Akph_Account::record_failure();
        }
        return $response;
    }

    public static function account_avatar(WP_REST_Request $request) {
        $files = $request->get_file_params();
        $tmp = isset($files['avatar']['tmp_name']) && is_string($files['avatar']['tmp_name']) ? $files['avatar']['tmp_name'] : '';
        $fingerprint = $tmp !== '' && is_file($tmp) ? (string) hash_file('sha256', $tmp) : '';
        return Akph_Command::run($request, function ($body) use ($request) {
            Akph_Account::assert_fields($request, $body, array());
            return Akph_Account::upload_avatar($request);
        }, array('fingerprint' => $fingerprint));
    }

    public static function account_avatar_delete(WP_REST_Request $request) {
        return Akph_Command::run($request, function ($body) use ($request) {
            Akph_Account::assert_fields($request, $body, array());
            return Akph_Account::delete_avatar();
        });
    }

    public static function account_sessions(WP_REST_Request $request) {
        return self::read(function () use ($request) {
            Akph_Account::assert_query($request);
            return Akph_Account::sessions();
        });
    }

    public static function account_logout_others(WP_REST_Request $request) {
        return Akph_Command::run($request, function ($body) use ($request) {
            Akph_Account::assert_fields($request, $body, array());
            return Akph_Account::logout_others();
        });
    }

    // ------------------------------------------------------------------ documents

    public static function list_documents(WP_REST_Request $request) {
        return self::read(function () use ($request) {
            Akph_Account::assert_query($request);
            list($page, $per_page) = self::page($request, 50, 200);
            $p = $request->get_query_params();
            $f = array(
                'status' => isset($p['status']) && in_array($p['status'], array('active', 'archived', 'all'), true) ? $p['status'] : 'active',
                'project_id' => Akph_Input::id($p, 'project_id'),
                'doc_type' => isset($p['doc_type']) && $p['doc_type'] !== '' ? Akph_Input::one_of($p, 'doc_type', Akph_Documents::DOC_TYPES) : '',
                'entity_type' => isset($p['entity_type']) && $p['entity_type'] !== '' ? Akph_Input::one_of($p, 'entity_type', Akph_Documents::ENTITY_TYPES) : '',
                'entity_id' => isset($p['entity_id']) && preg_match('/^[A-Za-z0-9_-]{1,64}$/D', (string) $p['entity_id']) ? (string) $p['entity_id'] : '',
                'q' => isset($p['q']) ? mb_substr(sanitize_text_field((string) $p['q']), 0, 100) : '',
            );
            if ($f['project_id']) {
                Akph_Auth::assert_project($f['project_id']);
            }
            return Akph_Documents::list_documents($f, $page, $per_page);
        });
    }

    public static function get_document(WP_REST_Request $request) {
        return self::read(function () use ($request) {
            return array('document' => Akph_Documents::shape(Akph_Documents::get_visible(self::id($request))));
        });
    }

    /** Multipart: file `file` and the form fields; the file's SHA-256 and the fields enter the request hash. */
    public static function upload_document(WP_REST_Request $request) {
        $files = $request->get_file_params();
        $fields = (array) $request->get_body_params();
        $tmp = isset($files['file']['tmp_name']) && is_string($files['file']['tmp_name']) ? $files['file']['tmp_name'] : '';
        ksort($fields);
        $fingerprint = ($tmp !== '' && is_file($tmp) ? (string) hash_file('sha256', $tmp) : '') . '|' . wp_json_encode($fields);
        return Akph_Command::run($request, function ($body) use ($request, $files, $fields) {
            Akph_Account::assert_fields($request, $body, array());
            Akph_Account::assert_fields($request, $fields, array('title', 'doc_type', 'description', 'project_id', 'cost_center_id', 'counterparty_id', 'entity_type', 'entity_id'));
            foreach (array_keys($files) as $key) {
                if ($key !== 'file') {
                    throw new Akph_Error('akph_unknown_field', 'فیلد ناشناخته: ' . $key, 400, array('field' => (string) $key));
                }
            }
            if (empty($files['file']) || !is_array($files['file']) || is_array($files['file']['name'] ?? null)) {
                throw Akph_Error::invalid('فایل (file) فرستاده نشده است.', array('field' => 'file'));
            }
            return Akph_Documents::upload($fields, $files['file']);
        }, array('fingerprint' => $fingerprint));
    }

    public static function download_document(WP_REST_Request $request) {
        try {
            $download = Akph_Documents::prepare_download(self::id($request), (string) $request->get_param('inline') === '1');
        } catch (Akph_Error $e) {
            return $e->to_wp_error();
        }
        if (!apply_filters('akph_documents_stream', true)) {
            // Tests: the headers that would be sent, without streaming.
            return new WP_REST_Response(array('headers' => $download['headers']), 200);
        }
        Akph_Documents::stream($download);
    }

    public static function link_document(WP_REST_Request $request) {
        return Akph_Command::run($request, function ($body) use ($request) {
            Akph_Account::assert_fields($request, $body, array('entity_type', 'entity_id'));
            return Akph_Documents::link(self::id($request), $body);
        });
    }

    public static function archive_document(WP_REST_Request $request) {
        return Akph_Command::run($request, function ($body) use ($request) {
            Akph_Account::assert_fields($request, $body, array('version'));
            return Akph_Documents::archive(self::id($request), Akph_Input::version($request, $body));
        });
    }

    // ------------------------------------------------------------------ petty cash

    /** Stored command with an allowlist of body fields (unknown or forbidden fields → 400/403). */
    private static function command(WP_REST_Request $request, array $fields, callable $fn) {
        return Akph_Command::run($request, function ($body) use ($request, $fields, $fn) {
            Akph_Account::assert_fields($request, $body, $fields);
            return $fn($body);
        });
    }

    private static function query_read(WP_REST_Request $request, callable $fn) {
        return self::read(function () use ($request, $fn) {
            Akph_Account::assert_query($request);
            return $fn();
        });
    }

    const FUND_FIELDS = array('title', 'fund_type', 'project_id', 'cost_center_id', 'holder_user_id', 'holder_name', 'holder_phone', 'account_code', 'ceiling', 'max_single_expense', 'min_balance_warning', 'source_account_id', 'active', 'notes');

    public static function petty_overview(WP_REST_Request $request) {
        return self::query_read($request, function () {
            return Akph_Petty_Cash::overview();
        });
    }

    public static function petty_settings(WP_REST_Request $request) {
        return self::query_read($request, function () {
            return array('settings' => Akph_Petty_Cash::settings());
        });
    }

    public static function petty_update_settings(WP_REST_Request $request) {
        return self::command($request, array('site_level_max', 'project_level_max', 'replenishment_senior_threshold', 'low_balance_percent', 'default_expense_account', 'fund_limits', 'approval_chains'), function ($body) {
            return Akph_Petty_Cash::update_settings($body);
        });
    }

    public static function petty_categories(WP_REST_Request $request) {
        return self::query_read($request, function () {
            return array('categories' => Akph_Petty_Cash::list_categories());
        });
    }

    public static function petty_replace_categories(WP_REST_Request $request) {
        return self::command($request, array('categories'), function ($body) {
            return Akph_Petty_Cash::replace_categories($body);
        });
    }

    public static function petty_create_fund(WP_REST_Request $request) {
        return self::command($request, self::FUND_FIELDS, function ($body) {
            return Akph_Petty_Cash::create_fund($body);
        });
    }

    public static function petty_update_fund(WP_REST_Request $request) {
        return self::command($request, array_merge(self::FUND_FIELDS, array('version')), function ($body) use ($request) {
            $version = Akph_Input::version($request, $body);
            unset($body['version']);
            return Akph_Petty_Cash::update_fund(self::id($request), $body, $version);
        });
    }

    public static function petty_statement(WP_REST_Request $request) {
        return self::query_read($request, function () use ($request) {
            return Akph_Petty_Cash::statement(self::id($request));
        });
    }

    public static function petty_count(WP_REST_Request $request) {
        return self::command($request, array('counted_cash', 'reason', 'notes', 'period_start', 'period_end'), function ($body) use ($request) {
            return Akph_Petty_Cash::count_fund(self::id($request), $body);
        });
    }

    public static function petty_close_period(WP_REST_Request $request) {
        return self::command($request, array('period_end', 'version'), function ($body) use ($request) {
            return Akph_Petty_Cash::close_period(self::id($request), $body, Akph_Input::version($request, $body));
        });
    }

    public static function petty_submit_expense(WP_REST_Request $request) {
        return self::command($request, array('fund_id', 'amount', 'date', 'category_id', 'category_name', 'sub_category', 'vendor', 'vendor_national_id', 'counterparty_id', 'invoice_number', 'invoice_date', 'description', 'payment_method'), function ($body) {
            return Akph_Petty_Cash::submit_expense($body);
        });
    }

    public static function petty_approve_expense(WP_REST_Request $request) {
        return self::command($request, array('comment', 'version'), function ($body) use ($request) {
            return Akph_Petty_Cash::approve_expense(self::id($request), $body, Akph_Input::version($request, $body));
        });
    }

    public static function petty_reject_expense(WP_REST_Request $request) {
        return self::command($request, array('reason', 'return_to_user', 'version'), function ($body) use ($request) {
            return Akph_Petty_Cash::reject_expense(self::id($request), $body, Akph_Input::version($request, $body));
        });
    }

    public static function petty_create_request(WP_REST_Request $request) {
        return self::command($request, array('fund_id', 'amount', 'reason'), function ($body) {
            return Akph_Petty_Cash::create_request($body);
        });
    }

    public static function petty_approve_request(WP_REST_Request $request) {
        return self::command($request, array('comment', 'version'), function ($body) use ($request) {
            return Akph_Petty_Cash::approve_request(self::id($request), $body, Akph_Input::version($request, $body));
        });
    }

    public static function petty_reject_request(WP_REST_Request $request) {
        return self::command($request, array('reason', 'version'), function ($body) use ($request) {
            return Akph_Petty_Cash::reject_request(self::id($request), $body, Akph_Input::version($request, $body));
        });
    }

    // ------------------------------------------------------------------ treasury

    const TREASURY_ACCOUNT_FIELDS = array('kind', 'title', 'bank_name', 'branch', 'account_number', 'sheba', 'holder_name', 'keeper_user_id', 'location', 'project_id', 'account_code', 'active');

    public static function treasury_overview(WP_REST_Request $request) {
        return self::query_read($request, function () {
            return Akph_Treasury::overview();
        });
    }

    public static function treasury_settings(WP_REST_Request $request) {
        return self::query_read($request, function () {
            return array('settings' => Akph_Treasury::settings());
        });
    }

    public static function treasury_update_settings(WP_REST_Request $request) {
        return self::command($request, array('payment_senior_threshold'), function ($body) {
            return Akph_Treasury::update_settings($body);
        });
    }

    public static function treasury_schedule(WP_REST_Request $request) {
        return self::query_read($request, function () {
            return Akph_Treasury::schedule();
        });
    }

    public static function treasury_accounts(WP_REST_Request $request) {
        return self::query_read($request, function () {
            return array('accounts' => Akph_Treasury::list_accounts());
        });
    }

    public static function treasury_create_account(WP_REST_Request $request) {
        return self::command($request, self::TREASURY_ACCOUNT_FIELDS, function ($body) {
            return Akph_Treasury::create_account($body);
        });
    }

    public static function treasury_update_account(WP_REST_Request $request) {
        return self::command($request, array_merge(self::TREASURY_ACCOUNT_FIELDS, array('version')), function ($body) use ($request) {
            $version = Akph_Input::version($request, $body);
            unset($body['version'], $body['kind']);
            return Akph_Treasury::update_account(self::id($request), $body, $version);
        });
    }

    public static function treasury_movements(WP_REST_Request $request) {
        return self::query_read($request, function () use ($request) {
            return Akph_Treasury::account_movements(self::id($request));
        });
    }

    public static function treasury_reconciliation(WP_REST_Request $request) {
        return self::query_read($request, function () use ($request) {
            return Akph_Treasury::reconciliation(self::id($request));
        });
    }

    public static function treasury_import_statement(WP_REST_Request $request) {
        return self::command($request, array('lines', 'csv'), function ($body) use ($request) {
            return Akph_Treasury::import_statement(self::id($request), $body);
        });
    }

    public static function treasury_transfer(WP_REST_Request $request) {
        return self::command($request, array('from_account_id', 'to_account_id', 'amount', 'date', 'tracking', 'description'), function ($body) {
            return Akph_Treasury::create_transfer($body);
        });
    }

    public static function payment_requests(WP_REST_Request $request) {
        return self::query_read($request, function () {
            return array('payment_requests' => Akph_Treasury::list_requests());
        });
    }

    public static function payment_request_create(WP_REST_Request $request) {
        return self::command($request, array('amount', 'beneficiary_name', 'beneficiary_type', 'beneficiary_sheba', 'project_id', 'cost_center_id', 'counterparty_id', 'payable_type', 'debit_account_code', 'due_date', 'priority', 'description'), function ($body) {
            return Akph_Treasury::create_request($body);
        });
    }

    public static function payment_request_approve(WP_REST_Request $request) {
        return self::command($request, array('comment', 'version'), function ($body) use ($request) {
            return Akph_Treasury::approve_request(self::id($request), $body, Akph_Input::version($request, $body));
        });
    }

    public static function payment_request_reject(WP_REST_Request $request) {
        return self::command($request, array('reason', 'version'), function ($body) use ($request) {
            return Akph_Treasury::reject_request(self::id($request), $body, Akph_Input::version($request, $body));
        });
    }

    public static function payment_request_pay(WP_REST_Request $request) {
        return self::command($request, array('amount', 'account_id', 'method', 'tracking', 'date', 'cheque_number', 'cheque_due_date', 'version'), function ($body) use ($request) {
            return Akph_Treasury::pay_request(self::id($request), $body, Akph_Input::version($request, $body));
        });
    }

    public static function receipt_create(WP_REST_Request $request) {
        return self::command($request, array('amount', 'receipt_type', 'credit_account_code', 'date', 'counterparty_id', 'payer_name', 'project_id', 'account_id', 'method', 'tracking', 'cheque_number', 'cheque_bank', 'cheque_due_date', 'description'), function ($body) {
            return Akph_Treasury::create_receipt($body);
        });
    }

    public static function receipt_approve(WP_REST_Request $request) {
        return self::command($request, array('comment', 'version'), function ($body) use ($request) {
            return Akph_Treasury::approve_receipt(self::id($request), $body, Akph_Input::version($request, $body));
        });
    }

    public static function receipt_reject(WP_REST_Request $request) {
        return self::command($request, array('reason', 'version'), function ($body) use ($request) {
            return Akph_Treasury::reject_receipt(self::id($request), $body, Akph_Input::version($request, $body));
        });
    }

    public static function cheque_status(WP_REST_Request $request) {
        return self::command($request, array('status', 'date', 'note', 'account_id', 'version'), function ($body) use ($request) {
            return Akph_Treasury::change_cheque(self::id($request), $body, Akph_Input::version($request, $body));
        });
    }

    public static function bank_line_match(WP_REST_Request $request) {
        return self::command($request, array('ledger_line_id', 'version'), function ($body) use ($request) {
            return Akph_Treasury::match_line(self::id($request), $body, Akph_Input::version($request, $body));
        });
    }

    public static function bank_line_voucher(WP_REST_Request $request) {
        return self::command($request, array('version'), function ($body) use ($request) {
            return Akph_Treasury::voucher_for_line(self::id($request), $body, Akph_Input::version($request, $body));
        });
    }

    // ------------------------------------------------------------------ approval center

    public static function approvals(WP_REST_Request $request) {
        return self::query_read($request, function () {
            return Akph_Approvals::for_current_user();
        });
    }

    // ------------------------------------------------------------------ assistant

    public static function assistant_status(WP_REST_Request $request) {
        return self::read(function () {
            return Akph_Assistant::status();
        });
    }

    /**
     * Not a stored command: the answer is not kept with an Idempotency-Key (only in the request log, and its
     * text only when the administrator chose so). The request log counts the daily limit.
     */
    public static function assistant_ask(WP_REST_Request $request) {
        return self::read(function () use ($request) {
            $body = self::json_body($request);
            Akph_Account::assert_fields($request, $body, array('question', 'conversation_id'));
            return Akph_Assistant::ask($body);
        });
    }

    public static function assistant_settings(WP_REST_Request $request) {
        return self::read(function () {
            return array('settings' => Akph_Assistant::public_settings());
        });
    }

    public static function assistant_update_settings(WP_REST_Request $request) {
        return Akph_Command::run($request, function ($body) use ($request) {
            Akph_Account::assert_fields($request, $body, array('enabled', 'provider', 'base_url', 'model', 'max_tokens', 'daily_limit', 'log_content', 'api_key', 'clear_key', 'proxy_token', 'clear_proxy_token'));
            return array('message' => 'تنظیمات دستیار ذخیره شد.', 'records' => array('assistant_settings' => array(Akph_Assistant::update_settings($body))));
        }, array('secret' => array('api_key', 'proxy_token')));
    }

    public static function assistant_test(WP_REST_Request $request) {
        return self::read(function () use ($request) {
            Akph_Account::assert_fields($request, self::json_body($request), array());
            return Akph_Assistant::test_connection();
        });
    }

    /** JSON object body of a request that is not a stored command. */
    private static function json_body(WP_REST_Request $request) {
        $body = $request->get_json_params();
        if ($body === null) {
            if (trim((string) $request->get_body()) !== '') {
                throw new Akph_Error('akph_invalid_json', 'بدنه درخواست JSON معتبر نیست.', 400);
            }
            return array();
        }
        if (!is_array($body)) {
            throw new Akph_Error('akph_invalid_json', 'بدنه درخواست باید یک شیء JSON باشد.', 400);
        }
        return $body;
    }

    // ------------------------------------------------------------------ projects

    public static function list_projects() {
        return self::read(function () {
            return array('projects' => Akph_Projects::list_visible());
        });
    }

    public static function get_project(WP_REST_Request $request) {
        return self::read(function () use ($request) {
            return array('project' => Akph_Projects::shape(Akph_Projects::get_visible(self::id($request))));
        });
    }

    public static function list_managers() {
        return self::read(function () {
            return array('managers' => Akph_Projects::managers());
        });
    }

    public static function create_project(WP_REST_Request $request) {
        return Akph_Command::run($request, function ($body) {
            return Akph_Projects::create($body);
        });
    }

    public static function update_project(WP_REST_Request $request) {
        return Akph_Command::run($request, function ($body) use ($request) {
            return Akph_Projects::update(self::id($request), $body, Akph_Input::version($request, $body));
        });
    }

    // ------------------------------------------------------------------ master data

    public static function list_cost_centers() {
        return self::read(function () {
            return array('cost_centers' => Akph_Master_Data::list_cost_centers());
        });
    }

    public static function create_cost_center(WP_REST_Request $request) {
        return Akph_Command::run($request, function ($body) {
            return Akph_Master_Data::create_cost_center($body);
        });
    }

    public static function update_cost_center(WP_REST_Request $request) {
        return Akph_Command::run($request, function ($body) use ($request) {
            return Akph_Master_Data::update_cost_center(self::id($request), $body, Akph_Input::version($request, $body));
        });
    }

    public static function list_counterparties() {
        return self::read(function () {
            return array('counterparties' => Akph_Master_Data::list_counterparties());
        });
    }

    public static function create_counterparty(WP_REST_Request $request) {
        return Akph_Command::run($request, function ($body) {
            return Akph_Master_Data::create_counterparty($body);
        });
    }

    public static function update_counterparty(WP_REST_Request $request) {
        return Akph_Command::run($request, function ($body) use ($request) {
            return Akph_Master_Data::update_counterparty(self::id($request), $body, Akph_Input::version($request, $body));
        });
    }

    // ------------------------------------------------------------------ chart of accounts

    public static function list_accounts() {
        return self::read(function () {
            return array('accounts' => Akph_Accounts::list_all());
        });
    }

    public static function create_account(WP_REST_Request $request) {
        return Akph_Command::run($request, function ($body) {
            return Akph_Accounts::create($body);
        });
    }

    public static function update_account(WP_REST_Request $request) {
        return Akph_Command::run($request, function ($body) use ($request) {
            return Akph_Accounts::update(self::id($request), $body, Akph_Input::version($request, $body));
        });
    }

    // ------------------------------------------------------------------ journal

    public static function list_entries(WP_REST_Request $request) {
        return self::read(function () use ($request) {
            list($page, $per_page) = self::page($request, 100, 500);
            $params = $request->get_query_params();
            $status = isset($params['status']) ? (string) $params['status'] : '';
            if ($status !== '' && !in_array($status, array('pending', 'posted', 'rejected'), true)) {
                throw Akph_Error::invalid('وضعیت نامعتبر است.');
            }
            $fy = isset($params['fiscal_year']) ? (int) $params['fiscal_year'] : 0;
            return Akph_Ledger::list_entries(array(
                'status' => $status,
                'from' => Akph_Input::iso_date($params, 'from', false),
                'to' => Akph_Input::iso_date($params, 'to', false),
                'fiscal_year' => $fy >= 1300 && $fy <= 1500 ? $fy : 0,
                'page' => $page,
                'per_page' => $per_page,
            ));
        });
    }

    public static function get_entry(WP_REST_Request $request) {
        return self::read(function () use ($request) {
            return array('entry' => Akph_Ledger::get(self::id($request)));
        });
    }

    public static function create_entry(WP_REST_Request $request) {
        return Akph_Command::run($request, function ($body) {
            return Akph_Ledger::create($body);
        });
    }

    public static function update_entry(WP_REST_Request $request) {
        return Akph_Command::run($request, function ($body) use ($request) {
            return Akph_Ledger::update(self::id($request), $body, Akph_Input::version($request, $body));
        });
    }

    public static function post_entry(WP_REST_Request $request) {
        return Akph_Command::run($request, function ($body) use ($request) {
            return Akph_Ledger::post(self::id($request), Akph_Input::version($request, $body));
        });
    }

    public static function reject_entry(WP_REST_Request $request) {
        return Akph_Command::run($request, function ($body) use ($request) {
            return Akph_Ledger::reject(self::id($request), $body, Akph_Input::version($request, $body));
        });
    }

    public static function reverse_entry(WP_REST_Request $request) {
        return Akph_Command::run($request, function ($body) use ($request) {
            return Akph_Ledger::reverse(self::id($request), $body, Akph_Input::version($request, $body));
        });
    }

    // ------------------------------------------------------------------ reports and audit

    public static function trial_balance(WP_REST_Request $request) {
        return self::read(function () use ($request) {
            return Akph_Reports::trial_balance(Akph_Reports::filters($request));
        });
    }

    public static function ledger(WP_REST_Request $request) {
        return self::read(function () use ($request) {
            $code = (string) $request->get_param('account_code');
            if (!preg_match('/^[0-9]{1,12}$/D', $code)) {
                throw Akph_Error::invalid('کد حساب (account_code) لازم است.');
            }
            list($page, $per_page) = self::page($request, 200, 1000);
            return Akph_Reports::ledger(Akph_Reports::filters($request), $code, $page, $per_page);
        });
    }

    public static function audit(WP_REST_Request $request) {
        return self::read(function () use ($request) {
            list($page, $per_page) = self::page($request, 50, 200);
            $type = (string) $request->get_param('object_type');
            if ($type !== '' && !preg_match('/^[a-z_]{1,32}$/D', $type)) {
                throw Akph_Error::invalid('نوع رکورد نامعتبر است.');
            }
            return Akph_Audit::list_rows($page, $per_page, $type, (int) $request->get_param('object_id'));
        });
    }
}
