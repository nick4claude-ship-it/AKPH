<?php
/**
 * «حساب کاربری من» (routes /account*, docs/API-CONTRACT.md): every signed-in portal user reads and changes
 * only their own account. No account route takes a user id; role, capabilities, user_login and user_id are
 * never accepted, in the body or the query string (400), so no request can change another account or a role.
 *
 * - Profile (display name, first and last name, Iranian mobile, preferences) sends the account version it
 *   read (user meta akph_account_version; 409 when stale) and runs as a command (Idempotency-Key).
 * - Email and password changes need the current password. After 5 wrong passwords within 15 minutes both
 *   are refused until the window has passed (429). A password change ends every other session of the user
 *   and keeps the current one.
 * - Avatar: JPG, PNG or WebP up to 2 MB, checked by content (wp_check_filetype_and_ext, getimagesize) and
 *   re-encoded by WP_Image_Editor as a 256×256 square into the media library, owned by the user; the
 *   previous avatar is deleted. get_avatar() shows it (pre_get_avatar_data).
 * - Every change is written to the audit trail with the user id. Passwords never are.
 */
if (!defined('ABSPATH')) {
    exit;
}

final class Akph_Account {
    const META_VERSION = 'akph_account_version';
    const META_MOBILE = 'akph_mobile';
    const META_PREFERENCES = 'akph_preferences';
    const META_AVATAR = 'akph_avatar_id';
    const META_FAILURES = 'akph_password_failures';
    /** Post meta of an avatar attachment: the user it belongs to. */
    const AVATAR_OF = '_akph_avatar_of';

    const PASSWORD_MIN = 12;
    const PASSWORD_MAX = 200;
    const MAX_FAILURES = 5;
    const FAILURE_WINDOW = 900;
    const AVATAR_MAX_BYTES = 2097152;
    const AVATAR_SIZE = 256;
    /** Larger images are refused before decoding (memory). */
    const AVATAR_MAX_SIDE = 6000;
    const AVATAR_MIMES = array('jpg|jpeg|jpe' => 'image/jpeg', 'png' => 'image/png', 'webp' => 'image/webp');

    const CURRENCIES = array('site', 'toman', 'rial');
    const ROWS_PER_PAGE = array(10, 25, 50, 100);
    /** Pages the app may open after sign-in (the app falls back to the dashboard when the role cannot see one). */
    const START_PAGES = array(
        '/', '/projects', '/contracts/client', '/contracts/subcontract', '/statements/client', '/statements/subcontractor',
        '/procurement', '/inventory', '/petty-cash', '/finance/accounting', '/finance/payments', '/finance/receipts',
        '/documents', '/approvals', '/reports', '/ai',
    );

    /** Never accepted by an account route. */
    const FORBIDDEN_FIELDS = array(
        'role', 'roles', 'role_slug', 'capabilities', 'caps', 'allcaps', 'cap_key', 'user_level', 'user_login', 'user_id',
        'id', 'ID', 'user_pass', 'user_status', 'user_registered', 'user_activation_key', 'user_nicename',
    );

    public static function boot() {
        add_filter('pre_get_avatar_data', array(__CLASS__, 'avatar_data'), 10, 2);
    }

    // ------------------------------------------------------------------ reads

    private static function user() {
        $user = get_userdata(get_current_user_id());
        if (!$user) {
            throw new Akph_Error('akph_unauthorized', 'برای استفاده از پرتال وارد حساب کاربری شوید.', 401);
        }
        return $user;
    }

    /** GET /account */
    public static function current() {
        return self::shape(self::user());
    }

    public static function shape(WP_User $user) {
        $slug = Akph_Roles::role_of($user);
        return array(
            'id' => (string) $user->ID,
            'user_login' => $user->user_login,
            'display_name' => $user->display_name,
            'first_name' => (string) get_user_meta($user->ID, 'first_name', true),
            'last_name' => (string) get_user_meta($user->ID, 'last_name', true),
            'email' => $user->user_email,
            'mobile' => (string) get_user_meta($user->ID, self::META_MOBILE, true),
            'role' => Akph_Roles::label($slug),
            'role_slug' => $slug,
            'avatar_url' => self::avatar_url($user->ID),
            'preferences' => self::preferences($user->ID),
            'site_currency' => Akph_Settings::get('currency'),
            'registered_at' => $user->user_registered ? Akph_Db::iso_time($user->user_registered) : null,
            'version' => self::version($user->ID),
            'password_min_length' => self::PASSWORD_MIN,
            'avatar_max_bytes' => self::AVATAR_MAX_BYTES,
        );
    }

    public static function version($user_id) {
        $v = (int) get_user_meta($user_id, self::META_VERSION, true);
        return $v > 0 ? $v : 1;
    }

    /** Stored preferences with the defaults for anything unset. */
    public static function preferences($user_id) {
        $stored = get_user_meta($user_id, self::META_PREFERENCES, true);
        $stored = is_array($stored) ? $stored : array();
        return array(
            'currency' => isset($stored['currency']) && in_array($stored['currency'], self::CURRENCIES, true) ? $stored['currency'] : 'site',
            'rows_per_page' => isset($stored['rows_per_page']) && in_array((int) $stored['rows_per_page'], self::ROWS_PER_PAGE, true) ? (int) $stored['rows_per_page'] : 25,
            'start_page' => isset($stored['start_page']) && in_array($stored['start_page'], self::START_PAGES, true) ? $stored['start_page'] : '/',
        );
    }

    /** The display unit for this user: the personal choice, or the site's setting. */
    public static function effective_currency($user_id) {
        $pref = self::preferences($user_id)['currency'];
        return $pref === 'site' ? Akph_Settings::get('currency') : $pref;
    }

    /** URL of the user's uploaded avatar, or null (the app then shows initials; no external avatar service). */
    public static function avatar_url($user_id) {
        $id = (int) get_user_meta($user_id, self::META_AVATAR, true);
        if ($id <= 0 || (int) get_post_meta($id, self::AVATAR_OF, true) !== (int) $user_id) {
            return null;
        }
        $url = wp_get_attachment_image_url($id, 'full');
        return $url ? $url : null;
    }

    /** pre_get_avatar_data: get_avatar() and get_avatar_url() show the uploaded avatar. */
    public static function avatar_data($args, $id_or_email) {
        $user_id = self::user_id_of($id_or_email);
        if ($user_id > 0) {
            $url = self::avatar_url($user_id);
            if ($url) {
                $args['url'] = $url;
                $args['found_avatar'] = true;
            }
        }
        return $args;
    }

    private static function user_id_of($id_or_email) {
        if (is_numeric($id_or_email)) {
            return (int) $id_or_email;
        }
        if ($id_or_email instanceof WP_User) {
            return (int) $id_or_email->ID;
        }
        if ($id_or_email instanceof WP_Post) {
            return (int) $id_or_email->post_author;
        }
        if ($id_or_email instanceof WP_Comment) {
            return (int) $id_or_email->user_id;
        }
        if (is_string($id_or_email) && is_email($id_or_email)) {
            $user = get_user_by('email', $id_or_email);
            return $user ? (int) $user->ID : 0;
        }
        return 0;
    }

    /** GET /account/sessions: the user's signed-in browsers; the current one first. */
    public static function sessions() {
        $user_id = get_current_user_id();
        $token = wp_get_session_token();
        $current = $token !== '' ? self::verifier($token) : '';
        $manager = WP_Session_Tokens::get_instance($user_id);
        $out = array();
        $raw = $manager instanceof WP_User_Meta_Session_Tokens ? get_user_meta($user_id, 'session_tokens', true) : null;
        if (is_array($raw)) {
            foreach ($raw as $verifier => $session) {
                if (is_array($session) && isset($session['expiration']) && (int) $session['expiration'] >= time()) {
                    $out[] = self::session_shape($session, $current !== '' && hash_equals($current, (string) $verifier));
                }
            }
        } else {
            // Another session store (session_token_manager filter): listed without marking the current one.
            foreach ($manager->get_all() as $session) {
                $out[] = self::session_shape($session, false);
            }
        }
        usort($out, function ($a, $b) {
            if ($a['current'] !== $b['current']) {
                return $a['current'] ? -1 : 1;
            }
            return strcmp((string) $b['login_at'], (string) $a['login_at']);
        });
        return array('sessions' => $out);
    }

    /** How WP_Session_Tokens stores a token. */
    private static function verifier($token) {
        return function_exists('hash') ? hash('sha256', $token) : sha1($token);
    }

    private static function session_shape(array $s, $current) {
        $ip = isset($s['ip']) && filter_var($s['ip'], FILTER_VALIDATE_IP) ? (string) $s['ip'] : '';
        return array(
            'current' => (bool) $current,
            'login_at' => isset($s['login']) ? gmdate('Y-m-d\TH:i:s\Z', (int) $s['login']) : null,
            'expires_at' => isset($s['expiration']) ? gmdate('Y-m-d\TH:i:s\Z', (int) $s['expiration']) : null,
            'ip' => $ip,
            'device' => self::device_label(isset($s['ua']) ? (string) $s['ua'] : ''),
        );
    }

    /** «مرورگر روی سیستم‌عامل» from a user agent (the raw user agent is not returned). */
    public static function device_label($ua) {
        $browsers = array('Edg/' => 'Edge', 'OPR/' => 'Opera', 'SamsungBrowser' => 'Samsung Internet', 'Firefox/' => 'Firefox', 'Chrome/' => 'Chrome', 'Safari/' => 'Safari');
        $systems = array('Android' => 'Android', 'iPhone' => 'iOS', 'iPad' => 'iPadOS', 'Windows' => 'Windows', 'Mac OS X' => 'macOS', 'Linux' => 'Linux');
        $browser = '';
        foreach ($browsers as $needle => $name) {
            if (stripos($ua, $needle) !== false) {
                $browser = $name;
                break;
            }
        }
        $system = '';
        foreach ($systems as $needle => $name) {
            if (stripos($ua, $needle) !== false) {
                $system = $name;
                break;
            }
        }
        if ($browser === '' && $system === '') {
            return 'مرورگر ناشناخته';
        }
        if ($browser === '') {
            return 'مرورگر روی ' . $system;
        }
        return $system === '' ? $browser : $browser . ' روی ' . $system;
    }

    // ------------------------------------------------------------------ guards

    /**
     * 400 for a field the route does not take. Role, capabilities, user_login and user ids are refused with
     * their own message, also in the query string (which otherwise carries only WordPress's own parameters).
     */
    public static function assert_fields(WP_REST_Request $request, $body, array $allowed) {
        foreach (array_keys((array) $request->get_query_params()) as $key) {
            if (in_array((string) $key, self::FORBIDDEN_FIELDS, true)) {
                throw self::forbidden_field($key);
            }
        }
        foreach (array_keys((array) $body) as $key) {
            if (in_array((string) $key, $allowed, true)) {
                continue;
            }
            if (in_array((string) $key, self::FORBIDDEN_FIELDS, true)) {
                throw self::forbidden_field($key);
            }
            throw new Akph_Error('akph_unknown_field', 'فیلد ناشناخته: ' . $key, 400, array('field' => (string) $key));
        }
    }

    private static function forbidden_field($key) {
        return new Akph_Error('akph_forbidden_field', 'نقش، قابلیت‌ها، نام کاربری و شناسه کاربر از این مسیر قابل تغییر نیست.', 400, array('field' => (string) $key));
    }

    /** GET routes: only the query-string rule. */
    public static function assert_query(WP_REST_Request $request) {
        self::assert_fields($request, array(), array());
    }

    /** 429 while the user has used up the wrong-password attempts of the window; null otherwise. */
    public static function attempts_error() {
        $failures = self::recent_failures(get_current_user_id());
        if (count($failures) < self::MAX_FAILURES) {
            return null;
        }
        $wait = max(1, min($failures) + self::FAILURE_WINDOW - time());
        $minutes = (int) ceil($wait / 60);
        return new WP_Error(
            'akph_too_many_attempts',
            'به‌دلیل ' . self::fa(self::MAX_FAILURES) . ' بار ورود رمز نادرست، تغییر رمز عبور و ایمیل تا ' . self::fa($minutes) . ' دقیقه دیگر ممکن نیست.',
            array('status' => 429, 'retry_after' => $wait)
        );
    }

    /** Called after a command answered akph_wrong_password (its transaction is already rolled back). */
    public static function record_failure() {
        $user_id = get_current_user_id();
        $failures = self::recent_failures($user_id);
        $failures[] = time();
        update_user_meta($user_id, self::META_FAILURES, $failures);
        Akph_Audit::log('account_password_failed', 'user', $user_id, null, array('attempts' => count($failures)));
    }

    private static function recent_failures($user_id) {
        $stored = get_user_meta($user_id, self::META_FAILURES, true);
        $cutoff = time() - self::FAILURE_WINDOW;
        return array_values(array_filter(array_map('intval', is_array($stored) ? $stored : array()), function ($t) use ($cutoff) {
            return $t > $cutoff;
        }));
    }

    private static function fa($n) {
        return strtr((string) $n, array('0' => '۰', '1' => '۱', '2' => '۲', '3' => '۳', '4' => '۴', '5' => '۵', '6' => '۶', '7' => '۷', '8' => '۸', '9' => '۹'));
    }

    /** A password field as sent (never trimmed or sanitized). */
    private static function secret($body, $key, $label) {
        $value = isset($body[$key]) ? $body[$key] : '';
        if (!is_string($value) || $value === '') {
            throw Akph_Error::invalid($label . ' الزامی است.', array('field' => $key));
        }
        if (strlen($value) > 4 * self::PASSWORD_MAX) {
            throw Akph_Error::invalid($label . ' بیش از حد طولانی است.', array('field' => $key));
        }
        return $value;
    }

    private static function verify_password(WP_User $user, $password) {
        if (!wp_check_password($password, $user->user_pass, $user->ID)) {
            throw new Akph_Error('akph_wrong_password', 'رمز عبور فعلی درست نیست.', 403, array('field' => 'current_password'));
        }
    }

    // ------------------------------------------------------------------ commands

    /** POST /account/profile */
    public static function update_profile(array $body, $version) {
        $user = self::user();
        $current = self::lock_version($user->ID);
        Akph_Input::assert_version((object) array('version' => $current), $version);
        $before = self::profile_snapshot($user->ID);

        $userdata = array();
        if (array_key_exists('display_name', $body)) {
            $userdata['display_name'] = sanitize_text_field(Akph_Input::text($body, 'display_name', 100, true, 'نام نمایشی'));
            if ($userdata['display_name'] === '') {
                throw Akph_Error::invalid('نام نمایشی الزامی است.', array('field' => 'display_name'));
            }
        }
        foreach (array('first_name' => 'نام', 'last_name' => 'نام خانوادگی') as $key => $label) {
            if (array_key_exists($key, $body)) {
                $userdata[$key] = sanitize_text_field(Akph_Input::text($body, $key, 60, false, $label));
            }
        }
        if (array_key_exists('mobile', $body)) {
            $mobile = self::mobile($body['mobile']);
            if ($mobile === '') {
                delete_user_meta($user->ID, self::META_MOBILE);
            } else {
                update_user_meta($user->ID, self::META_MOBILE, $mobile);
            }
        }
        if (array_key_exists('preferences', $body)) {
            update_user_meta($user->ID, self::META_PREFERENCES, self::parse_preferences($body['preferences'], self::preferences($user->ID)));
        }
        if ($userdata) {
            $result = wp_update_user(array_merge(array('ID' => $user->ID), $userdata));
            if (is_wp_error($result)) {
                throw Akph_Error::invalid('ذخیره اطلاعات حساب انجام نشد.');
            }
        }

        $after = self::profile_snapshot($user->ID);
        $changed = array_keys(array_filter($after, function ($value, $key) use ($before) {
            return $before[$key] !== $value;
        }, ARRAY_FILTER_USE_BOTH));
        if (!$changed) {
            return array('message' => 'تغییری برای ذخیره نبود.', 'records' => array('account' => array(self::shape(get_userdata($user->ID)))));
        }
        update_user_meta($user->ID, self::META_VERSION, $current + 1);
        Akph_Audit::log('account_profile', 'user', $user->ID, array_intersect_key($before, array_flip($changed)), array_intersect_key($after, array_flip($changed)));
        return array('message' => 'اطلاعات حساب ذخیره شد.', 'records' => array('account' => array(self::shape(get_userdata($user->ID)))));
    }

    /** Version row locked for the rest of the command (two saves of the same version: the second gets 409). */
    private static function lock_version($user_id) {
        global $wpdb;
        $row = Akph_Db::row($wpdb->prepare("SELECT umeta_id, meta_value FROM {$wpdb->usermeta} WHERE user_id = %d AND meta_key = %s ORDER BY umeta_id LIMIT 1 FOR UPDATE", $user_id, self::META_VERSION));
        if (!$row) {
            add_user_meta($user_id, self::META_VERSION, 1, true);
            return 1;
        }
        return max(1, (int) $row->meta_value);
    }

    private static function profile_snapshot($user_id) {
        clean_user_cache($user_id);
        $user = get_userdata($user_id);
        return array(
            'display_name' => $user->display_name,
            'first_name' => (string) get_user_meta($user_id, 'first_name', true),
            'last_name' => (string) get_user_meta($user_id, 'last_name', true),
            'mobile' => (string) get_user_meta($user_id, self::META_MOBILE, true),
            'preferences' => self::preferences($user_id),
        );
    }

    /**
     * Iranian mobile number → 09XXXXXXXXX. Persian and Arabic digits, spaces, dashes and the +98 / 0098 / 98
     * prefixes are accepted; '' clears the number.
     */
    public static function mobile($value) {
        if ($value === null) {
            return '';
        }
        if (!is_string($value)) {
            throw Akph_Error::invalid('شماره همراه باید متن باشد.', array('field' => 'mobile'));
        }
        $digits = strtr($value, array(
            '۰' => '0', '۱' => '1', '۲' => '2', '۳' => '3', '۴' => '4', '۵' => '5', '۶' => '6', '۷' => '7', '۸' => '8', '۹' => '9',
            '٠' => '0', '١' => '1', '٢' => '2', '٣' => '3', '٤' => '4', '٥' => '5', '٦' => '6', '٧' => '7', '٨' => '8', '٩' => '9',
        ));
        $digits = preg_replace('/[\s\-()]+/u', '', $digits);
        if ($digits === '') {
            return '';
        }
        if (!preg_match('/^(?:\+98|0098|98|0)?(9[0-9]{9})$/D', $digits, $m)) {
            throw Akph_Error::invalid('شماره همراه معتبر نیست؛ باید با ۰۹ شروع شود و ۱۱ رقم باشد (مثل ۰۹۱۲۳۴۵۶۷۸۹).', array('field' => 'mobile'));
        }
        return '0' . $m[1];
    }

    private static function parse_preferences($value, array $current) {
        if (!is_array($value) || ($value && array_keys($value) === range(0, count($value) - 1))) {
            throw Akph_Error::invalid('ترجیحات باید یک شیء باشد.', array('field' => 'preferences'));
        }
        $out = $current;
        foreach ($value as $key => $v) {
            switch ((string) $key) {
                case 'currency':
                    if (!in_array($v, self::CURRENCIES, true)) {
                        throw Akph_Error::invalid('واحد پول باید پیش‌فرض سامانه، تومان یا ریال باشد.', array('field' => 'preferences.currency'));
                    }
                    $out['currency'] = $v;
                    break;
                case 'rows_per_page':
                    $n = is_int($v) || (is_string($v) && preg_match('/^[0-9]{1,3}$/D', $v)) ? (int) $v : 0;
                    if (!in_array($n, self::ROWS_PER_PAGE, true)) {
                        throw Akph_Error::invalid('تعداد ردیف جدول باید ۱۰، ۲۵، ۵۰ یا ۱۰۰ باشد.', array('field' => 'preferences.rows_per_page'));
                    }
                    $out['rows_per_page'] = $n;
                    break;
                case 'start_page':
                    if (!in_array($v, self::START_PAGES, true)) {
                        throw Akph_Error::invalid('صفحه شروع معتبر نیست.', array('field' => 'preferences.start_page'));
                    }
                    $out['start_page'] = $v;
                    break;
                default:
                    throw new Akph_Error('akph_unknown_field', 'فیلد ناشناخته: preferences.' . $key, 400, array('field' => 'preferences.' . $key));
            }
        }
        return $out;
    }

    /** POST /account/email */
    public static function change_email(array $body) {
        $user = self::user();
        $password = self::secret($body, 'current_password', 'رمز عبور فعلی');
        $raw = Akph_Input::text($body, 'email', 100, true, 'ایمیل');
        $email = sanitize_email($raw);
        if ($email === '' || $email !== $raw || !is_email($email)) {
            throw Akph_Error::invalid('نشانی ایمیل معتبر نیست.', array('field' => 'email'));
        }
        // The password first: without it nobody learns whether an address is taken.
        self::verify_password($user, $password);
        if (strtolower($email) === strtolower($user->user_email)) {
            throw Akph_Error::invalid('این نشانی همان ایمیل فعلی شماست.', array('field' => 'email'));
        }
        $owner = email_exists($email);
        if ($owner && (int) $owner !== (int) $user->ID) {
            throw Akph_Error::conflict('این ایمیل برای حساب دیگری ثبت شده است.', array('field' => 'email'));
        }
        $result = wp_update_user(array('ID' => $user->ID, 'user_email' => $email));
        if (is_wp_error($result)) {
            throw Akph_Error::invalid('ثبت ایمیل انجام نشد.', array('field' => 'email'));
        }
        delete_user_meta($user->ID, self::META_FAILURES);
        Akph_Audit::log('account_email', 'user', $user->ID, array('email' => $user->user_email), array('email' => $email));
        return array('message' => 'ایمیل حساب تغییر کرد.', 'records' => array('account' => array(self::shape(get_userdata($user->ID)))));
    }

    /** POST /account/password */
    public static function change_password(array $body) {
        $user = self::user();
        $current = self::secret($body, 'current_password', 'رمز عبور فعلی');
        $new = self::secret($body, 'new_password', 'رمز عبور جدید');
        self::verify_password($user, $current);
        $length = mb_strlen($new, 'UTF-8');
        if ($length < self::PASSWORD_MIN) {
            throw Akph_Error::invalid('رمز عبور جدید باید دست‌کم ' . self::fa(self::PASSWORD_MIN) . ' نویسه باشد.', array('field' => 'new_password'));
        }
        if ($length > self::PASSWORD_MAX) {
            throw Akph_Error::invalid('رمز عبور جدید حداکثر ' . self::fa(self::PASSWORD_MAX) . ' نویسه است.', array('field' => 'new_password'));
        }
        if ($new === $current) {
            throw Akph_Error::invalid('رمز عبور جدید باید با رمز فعلی فرق داشته باشد.', array('field' => 'new_password'));
        }

        $token = wp_get_session_token();
        $remember = self::remembered($user->ID);
        wp_set_password($new, $user->ID);
        $manager = WP_Session_Tokens::get_instance($user->ID);
        $before = count($manager->get_all());
        if ($token !== '') {
            $manager->destroy_others($token);
        } else {
            $manager->destroy_all();
        }
        $ended = max(0, $before - count($manager->get_all()));
        delete_user_meta($user->ID, self::META_FAILURES);
        Akph_Audit::log('account_password', 'user', $user->ID, null, array('other_sessions_ended' => $ended));
        if ($token !== '') {
            // The auth cookie is signed with a fragment of the password hash: issue it again for the same session.
            wp_set_auth_cookie($user->ID, $remember, '', $token);
        }
        $message = $ended > 0
            ? 'رمز عبور تغییر کرد و ' . self::fa($ended) . ' نشست دیگر بسته شد؛ نشست فعلی باز می‌ماند.'
            : 'رمز عبور تغییر کرد؛ نشست فعلی باز می‌ماند.';
        return array('message' => $message, 'records' => array('account' => array(self::shape(get_userdata($user->ID)))));
    }

    /** Was the current session signed in with «مرا به خاطر بسپار» (same rule as wp_update_user). */
    private static function remembered($user_id) {
        $cookie = wp_parse_auth_cookie('', 'logged_in');
        $default = apply_filters('auth_cookie_expiration', 2 * DAY_IN_SECONDS, $user_id, false);
        return is_array($cookie) && isset($cookie['expiration']) && ((int) $cookie['expiration'] - time()) > $default;
    }

    /** POST /account/sessions/logout-others */
    public static function logout_others() {
        $user = self::user();
        $token = wp_get_session_token();
        if ($token === '') {
            throw Akph_Error::invalid('نشست فعلی شناسایی نشد؛ یک بار خارج و دوباره وارد شوید.');
        }
        $manager = WP_Session_Tokens::get_instance($user->ID);
        $before = count($manager->get_all());
        $manager->destroy_others($token);
        $ended = max(0, $before - count($manager->get_all()));
        Akph_Audit::log('account_logout_others', 'user', $user->ID, null, array('sessions_ended' => $ended));
        return array(
            'message' => $ended > 0 ? 'از ' . self::fa($ended) . ' نشست دیگر خارج شدید.' : 'نشست دیگری باز نبود.',
            'records' => array('account' => array(self::shape($user))),
        );
    }

    /** POST /account/avatar (multipart, file field `avatar`) */
    public static function upload_avatar(WP_REST_Request $request) {
        $user = self::user();
        $files = (array) $request->get_file_params();
        foreach (array_keys($files) as $key) {
            if ($key !== 'avatar') {
                throw new Akph_Error('akph_unknown_field', 'فیلد ناشناخته: ' . $key, 400, array('field' => (string) $key));
            }
        }
        foreach (array_keys((array) $request->get_body_params()) as $key) {
            throw in_array((string) $key, self::FORBIDDEN_FIELDS, true)
                ? self::forbidden_field($key)
                : new Akph_Error('akph_unknown_field', 'فیلد ناشناخته: ' . $key, 400, array('field' => (string) $key));
        }
        if (empty($files['avatar']) || !is_array($files['avatar']) || is_array($files['avatar']['name'] ?? null)) {
            throw Akph_Error::invalid('فایل تصویر (avatar) فرستاده نشده است.', array('field' => 'avatar'));
        }
        $file = $files['avatar'];
        $error = isset($file['error']) ? (int) $file['error'] : UPLOAD_ERR_NO_FILE;
        if ($error === UPLOAD_ERR_INI_SIZE || $error === UPLOAD_ERR_FORM_SIZE) {
            throw self::too_large();
        }
        $tmp = isset($file['tmp_name']) ? (string) $file['tmp_name'] : '';
        if ($error !== UPLOAD_ERR_OK || $tmp === '' || !is_file($tmp)) {
            throw Akph_Error::invalid('بارگذاری فایل انجام نشد؛ دوباره تلاش کنید.', array('field' => 'avatar'));
        }
        $size = filesize($tmp);
        if ($size === false || $size <= 0) {
            throw Akph_Error::invalid('فایل خالی است.', array('field' => 'avatar'));
        }
        if ($size > self::AVATAR_MAX_BYTES) {
            throw self::too_large();
        }
        $check = wp_check_filetype_and_ext($tmp, isset($file['name']) ? (string) $file['name'] : '', self::AVATAR_MIMES);
        $info = @getimagesize($tmp); // phpcs:ignore WordPress.PHP.NoSilencedErrors -- a non-image is answered below
        if (empty($check['ext']) || empty($check['type']) || !$info || empty($info['mime']) || $info['mime'] !== $check['type'] || !in_array($info['mime'], self::AVATAR_MIMES, true)) {
            throw self::wrong_type();
        }
        $width = (int) $info[0];
        $height = (int) $info[1];
        if ($width < 1 || $height < 1 || $width > self::AVATAR_MAX_SIDE || $height > self::AVATAR_MAX_SIDE) {
            throw Akph_Error::invalid('ابعاد تصویر باید حداکثر ' . self::fa(self::AVATAR_MAX_SIDE) . ' پیکسل باشد.', array('field' => 'avatar'));
        }

        $editor = wp_get_image_editor($tmp);
        if (is_wp_error($editor)) {
            throw self::wrong_type();
        }
        // Centre square, scaled (up or down) to 256×256; re-encoding drops metadata and anything hidden in the file.
        $side = min($width, $height);
        $cropped = $editor->crop((int) (($width - $side) / 2), (int) (($height - $side) / 2), $side, $side, self::AVATAR_SIZE, self::AVATAR_SIZE);
        if (is_wp_error($cropped)) {
            throw self::wrong_type();
        }
        $mime = wp_image_editor_supports(array('mime_type' => $info['mime'])) ? $info['mime'] : 'image/jpeg';
        $ext = array('image/jpeg' => 'jpg', 'image/png' => 'png', 'image/webp' => 'webp')[$mime];
        $uploads = wp_upload_dir();
        if (!empty($uploads['error'])) {
            throw new Akph_Error('akph_upload_dir', 'پوشه بارگذاری وردپرس قابل نوشتن نیست؛ به مدیر سیستم اطلاع دهید.', 500);
        }
        $name = wp_unique_filename($uploads['path'], 'akph-avatar-' . $user->ID . '-' . strtolower(wp_generate_password(8, false, false)) . '.' . $ext);
        $saved = $editor->save(trailingslashit($uploads['path']) . $name, $mime);
        if (is_wp_error($saved) || empty($saved['path'])) {
            throw new Akph_Error('akph_upload_failed', 'ذخیره تصویر انجام نشد.', 500);
        }
        $path = $saved['path'];
        try {
            $attachment = wp_insert_attachment(array(
                'post_mime_type' => $mime,
                'post_title' => 'تصویر پروفایل',
                'post_content' => '',
                'post_status' => 'inherit',
                'post_author' => $user->ID,
                'guid' => trailingslashit($uploads['url']) . basename($path),
            ), $path, 0, true);
            if (is_wp_error($attachment) || !$attachment) {
                throw new Akph_Error('akph_upload_failed', 'ذخیره تصویر انجام نشد.', 500);
            }
            require_once ABSPATH . 'wp-admin/includes/file.php';
            require_once ABSPATH . 'wp-admin/includes/image.php';
            wp_update_attachment_metadata($attachment, wp_generate_attachment_metadata($attachment, $path));
            update_post_meta($attachment, self::AVATAR_OF, $user->ID);
            $previous = (int) get_user_meta($user->ID, self::META_AVATAR, true);
            update_user_meta($user->ID, self::META_AVATAR, $attachment);
            Akph_Audit::log('account_avatar', 'user', $user->ID, array('avatar_id' => $previous > 0 ? $previous : null), array('avatar_id' => (int) $attachment));
            self::delete_attachment($user->ID, $previous);
        } catch (Throwable $e) {
            if (isset($attachment) && is_int($attachment) && $attachment > 0) {
                wp_delete_attachment($attachment, true);
            }
            if (is_file($path)) {
                wp_delete_file($path);
            }
            throw $e;
        }
        return array('message' => 'تصویر پروفایل ذخیره شد.', 'records' => array('account' => array(self::shape(get_userdata($user->ID)))));
    }

    /** DELETE /account/avatar */
    public static function delete_avatar() {
        $user = self::user();
        $previous = (int) get_user_meta($user->ID, self::META_AVATAR, true);
        if ($previous <= 0) {
            return array('message' => 'تصویر پروفایلی ثبت نشده بود.', 'records' => array('account' => array(self::shape($user))));
        }
        delete_user_meta($user->ID, self::META_AVATAR);
        Akph_Audit::log('account_avatar_removed', 'user', $user->ID, array('avatar_id' => $previous), array('avatar_id' => null));
        self::delete_attachment($user->ID, $previous);
        return array('message' => 'تصویر پروفایل حذف شد.', 'records' => array('account' => array(self::shape(get_userdata($user->ID)))));
    }

    /** Deletes an avatar attachment of this user (never another attachment). */
    private static function delete_attachment($user_id, $attachment_id) {
        if ($attachment_id > 0 && get_post_type($attachment_id) === 'attachment' && (int) get_post_meta($attachment_id, self::AVATAR_OF, true) === (int) $user_id) {
            wp_delete_attachment($attachment_id, true);
        }
    }

    private static function too_large() {
        return new Akph_Error('akph_file_too_large', 'حجم تصویر باید حداکثر ۲ مگابایت باشد.', 413, array('field' => 'avatar'));
    }

    private static function wrong_type() {
        return new Akph_Error('akph_file_type', 'فقط تصویر JPG، PNG یا WebP پذیرفته می‌شود.', 415, array('field' => 'avatar'));
    }
}
