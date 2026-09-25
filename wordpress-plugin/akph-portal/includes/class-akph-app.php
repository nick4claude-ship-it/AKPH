<?php
/**
 * The app page /?akph_portal=1 (outside the theme). Only users with a portal role may open it; the demo mode
 * (sample data in the browser) only for the system administrator. The page and every akph/v1 response are
 * sent with Cache-Control: no-store. The Vazirmatn font is part of the app bundle (app/assets), not Google Fonts.
 */
if (!defined('ABSPATH')) {
    exit;
}

final class Akph_App {
    public static function boot() {
        add_action('template_redirect', array(__CLASS__, 'maybe_render'), 1);
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
        self::render($user, $mode);
        exit;
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

    private static function render(WP_User $user, $mode) {
        $assets = self::assets();
        $base = AKPH_PORTAL_URL . 'app/';
        $config = array(
            'mode' => $mode,
            'displayName' => $user->display_name,
            'userId' => (string) $user->ID,
            'siteName' => get_bloginfo('name'),
            'logoutUrl' => wp_logout_url(self::url()),
        );
        if ($mode === 'live') {
            // Plain permalinks give https://site/?rest_route=/akph/v1; the app appends paths and joins queries with &.
            $config['restUrl'] = esc_url_raw(rest_url(Akph_Rest::NS));
            $config['nonce'] = wp_create_nonce('wp_rest');
        }
        header('Content-Type: text/html; charset=utf-8');
        ?><!doctype html>
<html lang="fa" dir="rtl">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="robots" content="noindex, nofollow">
    <title><?php echo esc_html(get_bloginfo('name') . ' — پرتال'); ?></title>
    <?php if ($assets) : ?>
        <?php foreach ($assets['css'] as $css) : ?>
            <link rel="stylesheet" href="<?php echo esc_url($base . $css); ?>">
        <?php endforeach; ?>
        <?php foreach ($assets['preload'] as $file) : ?>
            <link rel="modulepreload" href="<?php echo esc_url($base . $file); ?>">
        <?php endforeach; ?>
    <?php endif; ?>
    <script>window.AkphPortal = <?php echo wp_json_encode($config); ?>;</script>
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
    }
}
