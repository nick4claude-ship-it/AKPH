<?php
/**
 * Members' login page of the portal (the pattern of reference/paydar-portal: login_form and handle_login).
 *
 * - A guest opening /?akph_portal=1 sees this page instead of being sent to wp-login.php. The form posts back
 *   to the same address and is handled on `init`: nonce, then wp_signon() with is_ssl(). Errors are general
 *   (an unknown user and a wrong password read the same). After 5 failed logins within 15 minutes from one IP
 *   address, logins from it are refused until the window has passed (transient). A user without a portal
 *   role is logged out at once («حساب شما دسترسی به پرتال ندارد»). A successful login opens the app on the
 *   user's start page («حساب کاربری من» → صفحه شروع).
 * - The page is never cached (nocache_headers, DONOTCACHEPAGE, LiteSpeed no-cache) and may not be framed by
 *   another site. It uses the app's own stylesheet (Vazirmatn from app/assets and the design tokens).
 * - wp-login.php keeps working for the system administrator. A signed-in user whose portal role is senior
 *   manager, project manager or accountant, or a browser that last signed in to the portal with such a role,
 *   is sent from wp-login.php (no action other than login) to this page. «فراموشی رمز» uses wp-login.php's
 *   own lost-password flow and returns here.
 * - Logging out from the app (wp_logout_url with the app as redirect_to) comes back here, after
 *   paydar-portal's logout_redirect.
 */
if (!defined('ABSPATH')) {
    exit;
}

final class Akph_Login {
    const ACTION = 'akph_login';
    const MAX_FAILURES = 5;
    const WINDOW = 900;
    /** Runs after paydar-portal's logout_redirect (default priority 10). */
    const LOGOUT_REDIRECT_PRIORITY = 99;
    /** Set after a portal login of a member (not the system administrator): wp-login.php sends that browser here. */
    const MEMBER_COOKIE = 'akph_portal_member';
    /** Portal roles that sign in through the portal (the system administrator may also use wp-login.php). */
    const MEMBER_ROLES = array('paydar_senior_manager', 'paydar_project_manager', 'paydar_accountant');

    const MESSAGES = array(
        'failed' => array('error', 'نام کاربری یا رمز عبور درست نیست.'),
        'empty' => array('error', 'نام کاربری و رمز عبور را وارد کنید.'),
        'locked' => array('error', 'به‌دلیل تلاش‌های ناموفق پی‌درپی، ورود تا ۱۵ دقیقه دیگر ممکن نیست.'),
        'expired' => array('error', 'مهلت این صفحه تمام شده بود؛ دوباره تلاش کنید.'),
        'noaccess' => array('error', 'حساب شما دسترسی به پرتال ندارد.'),
        'out' => array('success', 'از حساب خارج شدید.'),
        'checkemail' => array('success', 'اگر حسابی با این مشخصات وجود داشته باشد، پیوند بازنشانی رمز به ایمیل آن فرستاده شد.'),
        'reset' => array('success', 'رمز عبور تازه ثبت شد؛ اکنون وارد شوید.'),
    );

    /** @var string[] header lines of the login page (the CLI SAPI keeps none, so the tests read these) */
    private static $sent_headers = array();

    public static function boot() {
        add_action('init', array(__CLASS__, 'handle'));
        add_action('login_init', array(__CLASS__, 'redirect_members_from_wp_login'));
        add_action('after_password_reset', array(__CLASS__, 'after_password_reset'), 10, 1);
        add_filter('logout_redirect', array(__CLASS__, 'logout_redirect'), self::LOGOUT_REDIRECT_PRIORITY, 3);
    }

    // ------------------------------------------------------------------ login

    /** `init`: a login form posted to the portal. */
    public static function handle() {
        if (!isset($_SERVER['REQUEST_METHOD']) || $_SERVER['REQUEST_METHOD'] !== 'POST' || empty($_POST[self::ACTION])) {
            return;
        }
        $result = self::process(wp_unslash($_POST), self::client_ip());
        if ($result['code'] === 'ok') {
            // Members are sent from wp-login.php to this page later; the system administrator keeps wp-login.php.
            $member = $result['member'];
            setcookie(self::MEMBER_COOKIE, $member ? '1' : '', $member ? time() + YEAR_IN_SECONDS : time() - YEAR_IN_SECONDS, COOKIEPATH, COOKIE_DOMAIN, is_ssl(), true);
        }
        wp_safe_redirect($result['redirect']);
        exit;
    }

    /**
     * Checks and signs in; returns ['code' => ok|failed|empty|locked|expired|noaccess, 'redirect' => url,
     * 'member' => bool]. `$post` is unslashed form data.
     */
    public static function process(array $post, $ip) {
        $fail = function ($code) {
            return array('code' => $code, 'redirect' => self::page_url($code), 'member' => false);
        };
        $nonce = isset($post['_akph_nonce']) ? (string) $post['_akph_nonce'] : '';
        if ($nonce === '' || !wp_verify_nonce($nonce, self::ACTION)) {
            return $fail('expired');
        }
        $key = self::lock_key($ip);
        $failures = (int) get_transient($key);
        if ($failures >= self::MAX_FAILURES) {
            return $fail('locked');
        }
        $login = isset($post['log']) ? trim(sanitize_user((string) $post['log'])) : '';
        $password = isset($post['pwd']) ? (string) $post['pwd'] : '';
        if ($login === '' || $password === '') {
            return $fail('empty');
        }
        // The session wp_signon() opens, so that a user without portal access keeps nothing of it.
        $token = '';
        $capture = function ($cookie, $expire, $expiration, $user_id, $scheme, $session_token) use (&$token) {
            $token = (string) $session_token;
        };
        add_action('set_logged_in_cookie', $capture, 10, 6);
        // The address may be an email: wp_signon() accepts both (wp_authenticate_email_password).
        $user = wp_signon(array('user_login' => $login, 'user_password' => $password, 'remember' => !empty($post['rememberme'])), is_ssl());
        remove_action('set_logged_in_cookie', $capture, 10);
        if (is_wp_error($user)) {
            set_transient($key, $failures + 1, self::WINDOW);
            return $fail('failed');
        }
        delete_transient($key);
        $role = Akph_Roles::role_of($user);
        if (!$role || !user_can($user, Akph_Roles::ACCESS)) {
            if ($token !== '') {
                WP_Session_Tokens::get_instance($user->ID)->destroy($token);
            }
            wp_set_current_user($user->ID);
            wp_logout();
            return $fail('noaccess');
        }
        wp_set_current_user($user->ID);
        return array('code' => 'ok', 'redirect' => self::start_url($user), 'member' => in_array($role, self::MEMBER_ROLES, true));
    }

    /** The app on the user's start page (preference in «حساب کاربری من»; the app checks the role can open it). */
    public static function start_url(WP_User $user) {
        $start = Akph_Account::preferences($user->ID)['start_page'];
        return Akph_App::url() . ($start !== '/' ? '#' . $start : '');
    }

    public static function page_url($code = '') {
        return $code === '' ? Akph_App::url() : add_query_arg('login', $code, Akph_App::url());
    }

    private static function lock_key($ip) {
        return 'akph_lf_' . md5((string) $ip);
    }

    private static function client_ip() {
        return isset($_SERVER['REMOTE_ADDR']) ? preg_replace('/[^0-9a-fA-F:.]/', '', wp_unslash($_SERVER['REMOTE_ADDR'])) : 'unknown';
    }

    // ------------------------------------------------------------------ wp-login.php and logout

    /**
     * `login_init`: members use the portal login. Only the plain login screen (GET, action login) is
     * redirected; logout, lost password and password reset keep working, and so does the system administrator.
     */
    public static function redirect_members_from_wp_login() {
        $target = self::wp_login_redirect_target();
        if ($target !== null) {
            wp_safe_redirect($target);
            exit;
        }
    }

    /** Where wp-login.php should send this request, or null to show it (split out for the tests). */
    public static function wp_login_redirect_target() {
        $action = isset($_REQUEST['action']) ? sanitize_key(wp_unslash($_REQUEST['action'])) : 'login';
        $method = isset($_SERVER['REQUEST_METHOD']) ? $_SERVER['REQUEST_METHOD'] : 'GET';
        if ($action !== 'login' || $method !== 'GET' || isset($_GET['interim-login']) || isset($_GET['reauth'])) {
            return null;
        }
        if (is_user_logged_in()) {
            return self::is_member(wp_get_current_user()) ? Akph_App::url() : null;
        }
        return !empty($_COOKIE[self::MEMBER_COOKIE]) ? self::page_url() : null;
    }

    /** Senior manager, project manager or accountant as portal role (the system administrator is not). */
    public static function is_member($user) {
        return in_array(Akph_Roles::role_of($user), self::MEMBER_ROLES, true);
    }

    /** A member who reset the password through wp-login.php comes back to the portal login. */
    public static function after_password_reset($user) {
        if (!$user instanceof WP_User || !self::is_member($user) || !did_action('login_init')) {
            return;
        }
        wp_safe_redirect(self::page_url('reset'));
        exit;
    }

    /** Logging out from the app (redirect_to is the app) returns to the portal login. */
    public static function logout_redirect($redirect_to, $requested, $user) {
        $requested = is_string($requested) ? $requested : '';
        if ($requested !== '' && strpos($requested, 'akph_portal') !== false) {
            return self::page_url('out');
        }
        return $redirect_to;
    }

    // ------------------------------------------------------------------ the page

    /** Sends the login page's headers; returns ['headers' => string[], 'html' => string]. */
    public static function respond() {
        self::$sent_headers = array();
        if (!defined('DONOTCACHEPAGE')) {
            define('DONOTCACHEPAGE', true);
        }
        do_action('litespeed_control_set_nocache', 'akph portal login page');
        nocache_headers();
        self::send_header('Cache-Control: no-store, no-cache, must-revalidate, private, max-age=0');
        self::send_header('X-LiteSpeed-Cache-Control: no-cache');
        self::send_header('Content-Type: text/html; charset=utf-8');
        send_frame_options_header();
        self::$sent_headers[] = 'X-Frame-Options: SAMEORIGIN';
        self::send_header("Content-Security-Policy: frame-ancestors 'self'");
        self::send_header('Referrer-Policy: same-origin');
        self::send_header('X-Content-Type-Options: nosniff');
        return array('headers' => self::$sent_headers, 'html' => self::page_html());
    }

    private static function send_header($line) {
        self::$sent_headers[] = $line;
        if (!headers_sent()) {
            header($line);
        }
    }

    public static function page_html() {
        $code = isset($_GET['login']) ? sanitize_key(wp_unslash($_GET['login'])) : '';
        $message = isset(self::MESSAGES[$code]) ? self::MESSAGES[$code] : null;
        $assets = Akph_App::assets();
        $base = AKPH_PORTAL_URL . 'app/';
        $logo = Akph_App::asset_file('company_logo');
        $lost = wp_lostpassword_url(self::page_url('checkemail'));
        $site = wp_specialchars_decode(get_bloginfo('name'), ENT_QUOTES);
        ob_start();
        ?><!doctype html>
<html lang="fa" dir="rtl">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="robots" content="noindex, nofollow">
    <title>ورود | سامانه پاک: پورتال آریا کاوش</title>
    <?php if ($assets) : ?>
        <?php foreach ($assets['css'] as $css) : ?>
            <link rel="stylesheet" href="<?php echo esc_url($base . $css); ?>">
        <?php endforeach; ?>
    <?php endif; ?>
    <style>
        body { margin: 0; min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 16px; box-sizing: border-box;
            font-family: var(--font-sans, 'Vazirmatn Variable', Vazirmatn, Tahoma, sans-serif); font-size: 14px; line-height: 1.6;
            background: var(--color-canvas, #f1f5f9); color: var(--color-ink, #0f172a); }
        .akl-card { width: 100%; max-width: 880px; display: grid; grid-template-columns: 1fr 1fr; background: var(--color-surface, #fff);
            border: 1px solid var(--color-line, #e2e8f0); border-radius: 12px; overflow: hidden; box-shadow: 0 10px 30px rgb(15 23 42 / 0.08); }
        .akl-side { background: var(--color-nav, #0f172a); color: #e2e8f0; padding: 32px; display: flex; flex-direction: column; gap: 12px; }
        .akl-logo { width: 64px; height: 64px; border-radius: 12px; background: #fff; object-fit: contain; padding: 4px; box-sizing: border-box; }
        .akl-side h1 { margin: 8px 0 0; font-size: 22px; font-weight: 700; color: #fff; line-height: 1.4; }
        .akl-side p { margin: 0; color: #cbd5e1; }
        .akl-side ul { margin: 8px 0 0; padding: 0 18px 0 0; color: #cbd5e1; }
        .akl-form { padding: 32px; display: flex; flex-direction: column; gap: 16px; }
        .akl-form h2 { margin: 0; font-size: 18px; font-weight: 700; }
        .akl-hint { margin: 0; color: var(--color-ink-muted, #475569); }
        .akl-field label { display: block; font-weight: 500; margin-bottom: 4px; }
        .akl-input { width: 100%; box-sizing: border-box; min-height: 44px; padding: 8px 12px; border: 1px solid var(--color-line-strong, #cbd5e1);
            border-radius: 8px; background: #fff; color: inherit; font: inherit; }
        .akl-input:focus { border-color: var(--color-brand-strong, #b45309); }
        :focus-visible { outline: 2px solid var(--color-focus, #2563eb); outline-offset: 2px; }
        .akl-pass { position: relative; }
        .akl-pass .akl-input { padding-left: 48px; }
        .akl-eye { position: absolute; left: 0; top: 0; bottom: 0; width: 44px; display: flex; align-items: center; justify-content: center;
            background: none; border: 0; color: var(--color-ink-muted, #475569); cursor: pointer; border-radius: 8px; }
        .akl-row { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 8px; }
        .akl-row a { color: var(--color-brand-strong, #b45309); font-weight: 500; }
        .akl-check { display: inline-flex; align-items: center; gap: 8px; }
        .akl-check input { width: 18px; height: 18px; accent-color: #d97706; }
        .akl-submit { min-height: 44px; border: 0; border-radius: 8px; background: var(--color-brand, #f59e0b); color: var(--color-brand-ink, #0f172a);
            font: inherit; font-weight: 700; cursor: pointer; }
        .akl-submit:hover { background: var(--color-brand-hover, #fbbf24); }
        .akl-msg { padding: 12px; border-radius: 8px; font-weight: 500; }
        .akl-msg.error { background: var(--color-danger-soft, #fff1f2); color: var(--color-danger, #be123c); }
        .akl-msg.success { background: var(--color-success-soft, #ecfdf5); color: var(--color-success, #047857); }
        .akl-foot { margin: 0; color: var(--color-ink-muted, #475569); font-size: 12px; }
        @media (max-width: 720px) { .akl-card { grid-template-columns: 1fr; } .akl-side, .akl-form { padding: 24px; } .akl-side ul { display: none; } }
    </style>
</head>
<body>
<main class="akl-card">
    <section class="akl-side" aria-label="معرفی سامانه">
        <?php if ($logo) : ?>
            <img src="<?php echo esc_url($base . $logo); ?>" alt="نشان آریا کاوش" class="akl-logo">
        <?php endif; ?>
        <h1>سامانه پاک: پورتال آریا کاوش</h1>
        <p><?php echo esc_html($site); ?></p>
        <ul>
            <li>پروژه‌ها، قراردادها و صورت‌وضعیت‌ها</li>
            <li>حسابداری، خزانه، تنخواه و اسناد</li>
            <li>دسترسی هر کاربر بر اساس نقش سازمانی او</li>
        </ul>
    </section>
    <section class="akl-form">
        <h2>ورود اعضا</h2>
        <p class="akl-hint">با نام کاربری یا ایمیل و رمز عبوری که مدیر سیستم برای شما تعریف کرده وارد شوید.</p>
        <?php if ($message) : ?>
            <div class="akl-msg <?php echo esc_attr($message[0]); ?>" role="<?php echo $message[0] === 'error' ? 'alert' : 'status'; ?>"><?php echo esc_html($message[1]); ?></div>
        <?php endif; ?>
        <form method="post" action="<?php echo esc_url(Akph_App::url()); ?>" autocomplete="on" novalidate>
            <input type="hidden" name="<?php echo esc_attr(self::ACTION); ?>" value="1">
            <input type="hidden" name="_akph_nonce" value="<?php echo esc_attr(wp_create_nonce(self::ACTION)); ?>">
            <div class="akl-field">
                <label for="akl-user">نام کاربری یا ایمیل</label>
                <input id="akl-user" class="akl-input" name="log" type="text" required autocomplete="username" dir="ltr" autofocus>
            </div>
            <div class="akl-field" style="margin-top:16px">
                <label for="akl-pass">رمز عبور</label>
                <div class="akl-pass">
                    <input id="akl-pass" class="akl-input" name="pwd" type="password" required autocomplete="current-password" dir="ltr">
                    <button type="button" class="akl-eye" id="akl-eye" aria-label="نمایش رمز عبور" aria-pressed="false">
                        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>
                    </button>
                </div>
            </div>
            <div class="akl-row" style="margin-top:16px">
                <label class="akl-check"><input type="checkbox" name="rememberme" value="1"> مرا به خاطر بسپار</label>
                <a href="<?php echo esc_url($lost); ?>">فراموشی رمز</a>
            </div>
            <button type="submit" class="akl-submit" style="width:100%;margin-top:16px">ورود به پرتال</button>
        </form>
        <p class="akl-foot">ثبت‌نام عمومی وجود ندارد؛ حساب را مدیر سیستم می‌سازد.</p>
    </section>
</main>
<script>
(function () {
    var eye = document.getElementById('akl-eye'), input = document.getElementById('akl-pass');
    eye.addEventListener('click', function () {
        var show = input.type === 'password';
        input.type = show ? 'text' : 'password';
        eye.setAttribute('aria-pressed', show ? 'true' : 'false');
        eye.setAttribute('aria-label', show ? 'پنهان کردن رمز عبور' : 'نمایش رمز عبور');
    });
})();
</script>
</body>
</html>
        <?php
        return (string) ob_get_clean();
    }
}
