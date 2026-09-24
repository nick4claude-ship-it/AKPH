<?php
/**
 * Plugin Name:       پرتال مدیریت پیمانکاری AKPH
 * Description:       اپلیکیشن مدیریت پروژه، قرارداد، خزانه، تنخواه، انبار و حسابداری. حالت نمایشی با داده نمونه، یا اتصال به افزونه «پایدار پورتال» (paydar/v1).
 * Version:           0.2.0
 * Requires at least: 6.0
 * Requires PHP:      7.4
 * Author:            AKPH
 * License:           Apache-2.0
 * Text Domain:       akph-portal
 */

if (!defined('ABSPATH')) {
    exit;
}

define('AKPH_PORTAL_VERSION', '0.2.0');
define('AKPH_PORTAL_DIR', plugin_dir_path(__FILE__));
define('AKPH_PORTAL_URL', plugin_dir_url(__FILE__));

/** Standalone page of the app (outside the theme and the admin styles). */
function akph_portal_app_url() {
    return add_query_arg('akph_portal', '1', home_url('/'));
}

/** 'demo' (sample data in the browser) or 'paydar' (the paydar-portal plugin's REST API). */
function akph_portal_mode() {
    $mode = get_option('akph_portal_mode', 'demo');
    return in_array($mode, array('demo', 'paydar'), true) ? $mode : 'demo';
}

// ---------------------------------------------------------------- admin menu

add_action('admin_menu', function () {
    add_menu_page('پرتال AKPH', 'پرتال AKPH', 'read', 'akph-portal', 'akph_portal_admin_page', 'dashicons-building', 3);
    add_submenu_page('akph-portal', 'تنظیمات پرتال AKPH', 'تنظیمات', 'manage_options', 'akph-portal-settings', 'akph_portal_settings_page');
});

add_action('admin_init', function () {
    register_setting('akph_portal', 'akph_portal_mode', array(
        'type'              => 'string',
        'default'           => 'demo',
        'sanitize_callback' => function ($value) {
            return in_array($value, array('demo', 'paydar'), true) ? $value : 'demo';
        },
    ));
});

function akph_portal_admin_page() {
    $url = esc_url(akph_portal_app_url());
    echo '<div class="wrap" style="margin:0;padding:0">';
    echo '<p style="margin:8px 0"><a class="button button-primary" href="' . $url . '" target="_blank" rel="noopener">باز کردن پرتال در صفحه کامل</a> ';
    echo '<span style="margin-inline-start:8px;color:#646970">حالت فعلی: ' . (akph_portal_mode() === 'demo' ? 'نسخه نمایشی (داده نمونه)' : 'اتصال به افزونه پایدار پورتال') . '</span></p>';
    echo '<iframe src="' . $url . '" title="پرتال AKPH" style="width:100%;height:calc(100vh - 120px);border:1px solid #dcdcde;border-radius:8px;background:#fff"></iframe>';
    echo '</div>';
}

function akph_portal_settings_page() {
    if (!current_user_can('manage_options')) {
        return;
    }
    $mode = akph_portal_mode();
    $paydar_ok = function_exists('rest_get_server') && in_array('paydar/v1', rest_get_server()->get_namespaces(), true);
    ?>
    <div class="wrap">
        <h1>تنظیمات پرتال AKPH</h1>
        <form method="post" action="options.php">
            <?php settings_fields('akph_portal'); ?>
            <table class="form-table" role="presentation">
                <tr>
                    <th scope="row">منبع داده</th>
                    <td>
                        <label><input type="radio" name="akph_portal_mode" value="demo" <?php checked($mode, 'demo'); ?>>
                            نسخه نمایشی — داده نمونه در مرورگر؛ با تازه‌کردن صفحه تغییرات پاک می‌شود؛ تعویض نقش برای آزمون فعال است.</label><br><br>
                        <label><input type="radio" name="akph_portal_mode" value="paydar" <?php checked($mode, 'paydar'); ?>>
                            اتصال به افزونه «پایدار پورتال» (مسیرهای paydar/v1)</label>
                        <p class="description">
                            <?php echo $paydar_ok ? 'افزونه پایدار پورتال فعال است.' : 'فضای نام paydar/v1 پیدا نشد؛ برای این حالت افزونه پایدار پورتال باید نصب و فعال باشد.'; ?>
                            قالب پاسخ مسیرهای افزونه هنوز با کد آن تطبیق داده نشده است؛ اگر پیام «قالب پاسخ نمی‌خواند» دیدید، حالت نمایشی را انتخاب کنید.
                        </p>
                    </td>
                </tr>
            </table>
            <?php submit_button('ذخیره'); ?>
        </form>
    </div>
    <?php
}

// ---------------------------------------------------------------- standalone app page

add_action('template_redirect', function () {
    if (!isset($_GET['akph_portal'])) {
        return;
    }
    if (!is_user_logged_in()) {
        auth_redirect();
    }
    akph_portal_render_app();
    exit;
});

/** Entry script, its CSS and the chunks it imports, from Vite's manifest. */
function akph_portal_assets() {
    $manifest_file = AKPH_PORTAL_DIR . 'app/.vite/manifest.json';
    if (!file_exists($manifest_file)) {
        return null;
    }
    $manifest = json_decode(file_get_contents($manifest_file), true);
    if (!is_array($manifest)) {
        return null;
    }
    $entry = null;
    foreach ($manifest as $item) {
        if (!empty($item['isEntry'])) {
            $entry = $item;
            break;
        }
    }
    if (!$entry) {
        return null;
    }
    $preload = array();
    foreach (isset($entry['imports']) ? $entry['imports'] : array() as $key) {
        if (isset($manifest[$key]['file'])) {
            $preload[] = $manifest[$key]['file'];
        }
    }
    return array(
        'script'  => $entry['file'],
        'css'     => isset($entry['css']) ? $entry['css'] : array(),
        'preload' => $preload,
    );
}

function akph_portal_render_app() {
    $assets = akph_portal_assets();
    $base   = AKPH_PORTAL_URL . 'app/';
    $user   = wp_get_current_user();
    $config = array(
        'displayName' => $user->display_name,
        'userId'      => $user->ID,
    );
    if (akph_portal_mode() === 'paydar') {
        // The app reads everything else (role, projects, currency) from GET /me of the paydar-portal plugin.
        $config['restUrl'] = esc_url_raw(rest_url('paydar/v1'));
        $config['nonce']   = wp_create_nonce('wp_rest');
    }
    nocache_headers();
    header('Content-Type: text/html; charset=utf-8');
    ?><!doctype html>
<html lang="fa" dir="rtl">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>پرتال مدیریت پیمانکاری</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Vazirmatn:wght@300;400;500;600;700;800;900&display=swap" rel="stylesheet">
    <?php if ($assets) : ?>
        <?php foreach ($assets['css'] as $css) : ?>
            <link rel="stylesheet" href="<?php echo esc_url($base . $css); ?>">
        <?php endforeach; ?>
        <?php foreach ($assets['preload'] as $file) : ?>
            <link rel="modulepreload" href="<?php echo esc_url($base . $file); ?>">
        <?php endforeach; ?>
    <?php endif; ?>
    <script>window.PaydarPortal = <?php echo wp_json_encode($config); ?>;</script>
</head>
<body>
<?php if (!$assets) : ?>
    <p style="font-family:tahoma;padding:24px">فایل‌های برنامه (app/) در افزونه پیدا نشد. بسته افزونه را دوباره نصب کنید.</p>
<?php else : ?>
    <div id="root"></div>
    <script type="module" src="<?php echo esc_url($base . $assets['script']); ?>"></script>
<?php endif; ?>
</body>
</html>
    <?php
}
