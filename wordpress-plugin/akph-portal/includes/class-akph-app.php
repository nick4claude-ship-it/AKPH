<?php
/**
 * The app page /?akph_portal=1 (outside the theme). Only users with a portal role may open it; the demo mode
 * (sample data in the browser) only for the system administrator. The page and every akph/v1 response are
 * sent with Cache-Control: no-store; the page may not be framed by another site (X-Frame-Options through
 * send_frame_options_header(), CSP frame-ancestors). The Vazirmatn font is part of the app bundle
 * (app/assets), not Google Fonts.
 *
 * After login, users with a portal role land on the app (login_redirect at priority 99, after paydar-portal):
 * a login that was heading to the app keeps its redirect_to; a plain login (no destination, or the default
 * dashboard) goes to the app; a login for any other specific page is left as the earlier filters made it.
 */
if (!defined('ABSPATH')) {
    exit;
}

final class Akph_App {
    /** Runs after paydar-portal's login_redirect filter (default priority 10). */
    const LOGIN_REDIRECT_PRIORITY = 99;

    /** @var string[] Header lines sent for the app page (the CLI SAPI keeps none, so the tests read these). */
    private static $sent_headers = array();

    public static function boot() {
        add_action('template_redirect', array(__CLASS__, 'maybe_render'), 1);
        add_filter('login_redirect', array(__CLASS__, 'login_redirect'), self::LOGIN_REDIRECT_PRIORITY, 3);
    }

    /**
     * @param string           $redirect_to destination chosen so far (paydar-portal may have changed it)
     * @param string           $requested   redirect_to sent with the login form ('' when none)
     * @param WP_User|WP_Error $user
     */
    public static function login_redirect($redirect_to, $requested, $user) {
        $requested = is_string($requested) ? $requested : '';
        if ($requested !== '' && strpos($requested, 'akph_portal') !== false) {
            return wp_validate_redirect($requested, self::url());
        }
        if (!$user instanceof WP_User || !Akph_Roles::role_of($user) || !user_can($user, Akph_Roles::ACCESS)) {
            return $redirect_to;
        }
        return self::is_default_destination($requested) ? self::url() : $redirect_to;
    }

    /** No destination, or the dashboard that wp-login.php puts in the form when none was asked for. */
    private static function is_default_destination($requested) {
        if ($requested === '') {
            return true;
        }
        $path = function ($url) {
            $p = wp_parse_url($url, PHP_URL_PATH);
            return rtrim(is_string($p) ? $p : '', '/');
        };
        $target = $path($requested);
        $query = (string) wp_parse_url($requested, PHP_URL_QUERY);
        return $query === '' && in_array($target, array($path(admin_url()), $path(admin_url('index.php'))), true);
    }

    public static function url() {
        return add_query_arg('akph_portal', '1', home_url('/'));
    }

    public static function maybe_render() {
        if (!isset($_GET['akph_portal'])) {
            return;
        }
        self::no_store();
        if (!is_user_logged_in()) {
            auth_redirect();
            exit;
        }
        $user = wp_get_current_user();
        $role = Akph_Roles::role_of($user);
        if (!$role || !user_can($user, Akph_Roles::ACCESS)) {
            wp_die(esc_html('حساب شما نقش پرتال ندارد. با مدیر سیستم تماس بگیرید.'), esc_html('دسترسی ممکن نیست'), array('response' => 403));
        }
        $mode = Akph_Settings::get('mode');
        if ($mode === 'demo' && $role !== 'administrator') {
            wp_die(esc_html('پرتال در حالت نمایشی است و فقط مدیر سیستم آن را می‌بیند.'), esc_html('دسترسی ممکن نیست'), array('response' => 403));
        }
        $page = self::respond($user, $mode);
        echo $page['html']; // phpcs:ignore WordPress.Security.EscapeOutput -- escaped in page_html()
        exit;
    }

    /**
     * Sends the headers of the app page and returns them with the HTML: ['headers' => string[], 'html' => string].
     */
    public static function respond(WP_User $user, $mode) {
        self::$sent_headers = array();
        self::send_header('Content-Type: text/html; charset=utf-8');
        // WordPress's own helper for X-Frame-Options: SAMEORIGIN (clickjacking), plus the CSP equivalent.
        send_frame_options_header();
        self::$sent_headers[] = 'X-Frame-Options: SAMEORIGIN';
        self::send_header("Content-Security-Policy: frame-ancestors 'self'");
        self::send_header('Referrer-Policy: same-origin');
        self::send_header('X-Content-Type-Options: nosniff');
        return array('headers' => self::$sent_headers, 'html' => self::page_html($user, $mode));
    }

    private static function send_header($line) {
        self::$sent_headers[] = $line;
        if (!headers_sent()) {
            header($line);
        }
    }

    /** No page cache anywhere: WordPress, LiteSpeed Cache, proxies and the browser. */
    private static function no_store() {
        if (!defined('DONOTCACHEPAGE')) {
            define('DONOTCACHEPAGE', true);
        }
        do_action('litespeed_control_set_nocache', 'akph portal app page');
        nocache_headers();
        if (!headers_sent()) {
            header('Cache-Control: no-store, no-cache, must-revalidate, private, max-age=0');
            header('X-LiteSpeed-Cache-Control: no-cache');
        }
    }

    /** Entry script, its CSS and the chunks it imports, from Vite's manifest. */
    private static function assets() {
        $manifest_file = AKPH_PORTAL_DIR . 'app/.vite/manifest.json';
        if (!file_exists($manifest_file)) {
            return null;
        }
        $manifest = json_decode((string) file_get_contents($manifest_file), true);
        if (!is_array($manifest)) {
            return null;
        }
        foreach ($manifest as $item) {
            if (!empty($item['isEntry'])) {
                $preload = array();
                foreach (isset($item['imports']) ? $item['imports'] : array() as $key) {
                    if (isset($manifest[$key]['file'])) {
                        $preload[] = $manifest[$key]['file'];
                    }
                }
                return array('script' => $item['file'], 'css' => isset($item['css']) ? $item['css'] : array(), 'preload' => $preload);
            }
        }
        return null;
    }

    /**
     * The inline configuration as a script-safe JSON literal: <, >, & are \u escapes, so no value (a site or
     * user name with </script> or <!--) can close the script element or start markup.
     */
    public static function config_json(array $config) {
        return wp_json_encode($config, JSON_HEX_TAG | JSON_HEX_AMP);
    }

    public static function page_html(WP_User $user, $mode) {
        $assets = self::assets();
        $base = AKPH_PORTAL_URL . 'app/';
        $config = array(
            'mode' => $mode,
            'displayName' => $user->display_name,
            'userId' => (string) $user->ID,
            // Stored HTML-escaped by WordPress; the app renders text, so it gets the plain name.
            'siteName' => wp_specialchars_decode(get_bloginfo('name'), ENT_QUOTES),
            'logoutUrl' => wp_logout_url(self::url()),
        );
        if ($mode === 'live') {
            // Plain permalinks give https://site/?rest_route=/akph/v1; the app appends paths and joins queries with &.
            $config['restUrl'] = esc_url_raw(rest_url(Akph_Rest::NS));
            $config['nonce'] = wp_create_nonce('wp_rest');
        }
        ob_start();
        ?><!doctype html>
<html lang="fa" dir="rtl">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="robots" content="noindex, nofollow">
    <title>سامانه پاک: پورتال آریا کاوش</title>
    <?php if ($assets) : ?>
        <?php foreach ($assets['css'] as $css) : ?>
            <link rel="stylesheet" href="<?php echo esc_url($base . $css); ?>">
        <?php endforeach; ?>
        <?php foreach ($assets['preload'] as $file) : ?>
            <link rel="modulepreload" href="<?php echo esc_url($base . $file); ?>">
        <?php endforeach; ?>
    <?php endif; ?>
    <script>window.AkphPortal = <?php echo self::config_json($config); // phpcs:ignore WordPress.Security.EscapeOutput ?>;</script>
</head>
<body>
<?php if (!$assets) : ?>
    <p style="font-family:tahoma;padding:24px">فایل‌های برنامه (app/) در افزونه پیدا نشد. بسته نصبی افزونه را دوباره بارگذاری کنید.</p>
<?php else : ?>
    <div id="root"></div>
    <script type="module" src="<?php echo esc_url($base . $assets['script']); ?>"></script>
<?php endif; ?>
</body>
</html>
        <?php
        return (string) ob_get_clean();
    }
}
