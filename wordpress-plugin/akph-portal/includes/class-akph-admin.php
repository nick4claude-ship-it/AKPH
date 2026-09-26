<?php
/**
 * Dashboard screens: a link to the app, the settings (mode and display currency, with a health check) and
 * the one-time tools (project migration from paydar-portal, standard chart of accounts). Settings and tools
 * need manage_options.
 */
if (!defined('ABSPATH')) {
    exit;
}

final class Akph_Admin {
    public static function boot() {
        add_action('admin_menu', array(__CLASS__, 'menu'));
        add_action('admin_notices', array(__CLASS__, 'notices'));
    }

    public static function menu() {
        add_menu_page('پرتال AKPH', 'پرتال AKPH', Akph_Roles::ACCESS, 'akph-portal', array(__CLASS__, 'home_page'), 'dashicons-building', 3);
        add_submenu_page('akph-portal', 'تنظیمات پرتال AKPH', 'تنظیمات', 'manage_options', 'akph-portal-settings', array(__CLASS__, 'settings_page'));
        add_submenu_page('akph-portal', 'ابزارهای انتقال', 'انتقال و کدینگ', 'manage_options', 'akph-portal-tools', array(__CLASS__, 'tools_page'));
    }

    public static function notices() {
        if (!current_user_can('manage_options')) {
            return;
        }
        $problems = get_option(Akph_Schema::OPTION_ENGINE_PROBLEMS);
        if ($problems) {
            echo '<div class="notice notice-error"><p>پرتال AKPH: جدول‌های زیر روی موتور InnoDB ساخته نشدند و فرمان‌های پرتال غیرفعال‌اند: <code>' . esc_html(implode(', ', (array) $problems)) . '</code></p></div>';
        }
    }

    public static function home_page() {
        $url = esc_url(Akph_App::url());
        echo '<div class="wrap"><h1>پرتال AKPH</h1>';
        echo '<p><a class="button button-primary" href="' . $url . '" target="_blank" rel="noopener">باز کردن پرتال</a></p>';
        echo '<p>حالت فعلی: <strong>' . (Akph_Settings::get('mode') === 'demo' ? 'نمایشی (فقط مدیر سیستم؛ داده نمونه در مرورگر)' : 'واقعی (سرور akph/v1)') . '</strong></p></div>';
    }

    private static function status_rows() {
        global $wpdb;
        $problems = (array) get_option(Akph_Schema::OPTION_ENGINE_PROBLEMS, array());
        $missing = Akph_Roles::missing_roles();
        return array(
            array('PHP ۶۴ بیتی', PHP_INT_SIZE >= 8, 'PHP ' . PHP_VERSION . ' (' . (PHP_INT_SIZE * 8) . ' بیت)'),
            array('جدول‌های akph روی InnoDB', Akph_Schema::ready(), $problems ? implode(', ', $problems) : 'نسخه ' . get_option(Akph_Schema::OPTION_VERSION, '—')),
            array('نقش‌های پرتال', !$missing, $missing ? 'پیدا نشد: ' . implode(', ', $missing) . ' (افزونه پایدار پورتال این نقش‌ها را می‌سازد)' : 'مدیر سیستم، مدیر ارشد، حسابدار، مدیر پروژه'),
            array('قابلیت‌های akph_*', get_option(Akph_Roles::OPTION_VERSION) === Akph_Roles::ROLES_VERSION, 'نسخه ' . get_option(Akph_Roles::OPTION_VERSION, '—')),
            array('ثبت‌نام عمومی', !get_option('users_can_register'), get_option('users_can_register') ? 'فعال است؛ آن را در «تنظیمات › عمومی» غیرفعال کنید.' : 'غیرفعال'),
            array('آدرس REST', true, rest_url(Akph_Rest::NS)),
            array('موتور پایگاه‌داده', true, $wpdb->db_server_info()),
        );
    }

    public static function settings_page() {
        if (!current_user_can('manage_options')) {
            return;
        }
        $saved = false;
        $retried = null;
        $nonce_ok = isset($_POST['akph_settings_nonce']) && wp_verify_nonce(sanitize_text_field(wp_unslash($_POST['akph_settings_nonce'])), 'akph_settings');
        if ($nonce_ok && isset($_POST['akph_action']) && sanitize_key(wp_unslash($_POST['akph_action'])) === 'migrate_retry') {
            // The automatic retry waits for the backoff after a failed migration; this runs it now.
            $retried = Akph_Schema::migrate();
        } elseif ($nonce_ok) {
            Akph_Settings::update(array(
                'mode' => isset($_POST['mode']) ? sanitize_key(wp_unslash($_POST['mode'])) : 'live',
                'currency' => isset($_POST['currency']) ? sanitize_key(wp_unslash($_POST['currency'])) : 'toman',
            ));
            $saved = true;
        }
        $s = Akph_Settings::all();
        echo '<div class="wrap"><h1>تنظیمات پرتال AKPH</h1>';
        if ($saved) {
            echo '<div class="notice notice-success"><p>تنظیمات ذخیره شد.</p></div>';
        }
        if ($retried !== null) {
            echo $retried
                ? '<div class="notice notice-error"><p>ساخت جدول‌ها دوباره اجرا شد ولی این جدول‌ها هنوز روی InnoDB نیستند: <code>' . esc_html(implode(', ', $retried)) . '</code></p></div>'
                : '<div class="notice notice-success"><p>جدول‌های پرتال روی InnoDB آماده شدند.</p></div>';
        }
        echo '<form method="post">';
        wp_nonce_field('akph_settings', 'akph_settings_nonce');
        echo '<table class="form-table" role="presentation"><tr><th scope="row">حالت پرتال</th><td>';
        echo '<p><label><input type="radio" name="mode" value="live" ' . checked($s['mode'], 'live', false) . '> واقعی — داده از سرور (akph/v1). بخش‌هایی که هنوز فرمان سرور ندارند «فقط خواندنی — به‌زودی» هستند.</label></p>';
        echo '<p><label><input type="radio" name="mode" value="demo" ' . checked($s['mode'], 'demo', false) . '> نمایشی — داده نمونه فقط در مرورگر، فقط برای مدیر سیستم؛ چیزی در پایگاه‌داده ذخیره نمی‌شود.</label></p>';
        echo '</td></tr><tr><th scope="row"><label for="akph-currency">واحد نمایش مبالغ</label></th><td>';
        echo '<select id="akph-currency" name="currency"><option value="toman" ' . selected($s['currency'], 'toman', false) . '>تومان</option><option value="rial" ' . selected($s['currency'], 'rial', false) . '>ریال</option></select>';
        echo '<p class="description">مبالغ همیشه به ریال صحیح ذخیره می‌شوند؛ این فقط واحد نمایش است.</p></td></tr></table>';
        submit_button('ذخیره');
        echo '</form><h2>وضعیت</h2><table class="widefat striped" style="max-width:900px"><tbody>';
        foreach (self::status_rows() as $row) {
            echo '<tr><td>' . esc_html($row[0]) . '</td><td>' . ($row[1] ? '✅' : '⚠️') . '</td><td><code>' . esc_html($row[2]) . '</code></td></tr>';
        }
        echo '</tbody></table>';
        if (!Akph_Schema::ready()) {
            echo '<form method="post" style="margin-top:12px">';
            wp_nonce_field('akph_settings', 'akph_settings_nonce');
            echo '<p class="description">ساخت خودکار جدول‌ها پس از خطا تا یک ساعت تکرار نمی‌شود. پس از رفع مشکل موتور جدول‌ها (InnoDB) این دکمه را بزنید.</p>';
            echo '<button class="button" name="akph_action" value="migrate_retry">ساخت دوباره جدول‌ها</button></form>';
        }
        self::assistant_section();
        echo '</div>';
    }

    /** «دستیار هوشمند»: provider, model, key (encrypted; shown as its last four characters), limits. */
    private static function assistant_section() {
        echo '<h2 id="akph-ai">دستیار هوشمند</h2>';
        $action = isset($_POST['akph_ai_action']) ? sanitize_key(wp_unslash($_POST['akph_ai_action'])) : '';
        if ($action !== '') {
            if (!isset($_POST['akph_ai_nonce']) || !wp_verify_nonce(sanitize_text_field(wp_unslash($_POST['akph_ai_nonce'])), 'akph_ai')) {
                echo '<div class="notice notice-error"><p>مهلت فرم تمام شده است؛ دوباره تلاش کنید.</p></div>';
            } elseif ($action === 'test') {
                $r = Akph_Assistant::test_connection();
                echo '<div class="notice ' . ($r['ok'] ? 'notice-success' : 'notice-error') . '"><p>' . esc_html($r['message']) . '</p></div>';
            } elseif ($action === 'save' && Akph_Schema::ready()) {
                $post = wp_unslash($_POST);
                $changes = array(
                    'enabled' => !empty($post['ai_enabled']),
                    'provider' => isset($post['ai_provider']) ? sanitize_key($post['ai_provider']) : 'anthropic',
                    'base_url' => isset($post['ai_base_url']) ? trim((string) $post['ai_base_url']) : '',
                    'model' => isset($post['ai_model']) ? trim((string) $post['ai_model']) : '',
                    'max_tokens' => isset($post['ai_max_tokens']) ? (string) absint($post['ai_max_tokens']) : '0',
                    'daily_limit' => isset($post['ai_daily_limit']) ? (string) absint($post['ai_daily_limit']) : '0',
                    'log_content' => !empty($post['ai_log_content']),
                    'clear_key' => !empty($post['ai_clear_key']),
                );
                if (isset($post['ai_api_key']) && trim((string) $post['ai_api_key']) !== '') {
                    $changes['api_key'] = trim((string) $post['ai_api_key']);
                }
                try {
                    Akph_Db::transaction(function () use ($changes) {
                        Akph_Assistant::update_settings($changes);
                    });
                    echo '<div class="notice notice-success"><p>تنظیمات دستیار ذخیره شد.</p></div>';
                } catch (Akph_Error $e) {
                    echo '<div class="notice notice-error"><p>' . esc_html($e->getMessage()) . '</p></div>';
                }
            }
        }
        $s = Akph_Assistant::public_settings();
        $key = $s['key'];
        echo '<p>پاسخ‌ها را سرور از مدل زبانی می‌گیرد؛ کلید API هرگز به مرورگر فرستاده نمی‌شود و دستیار فقط داده‌هایی را می‌بیند که همان کاربر اجازه دیدنشان را دارد. اگر میزبان سایت در ایران است و نشانی‌های api.anthropic.com یا api.openai.com در دسترس نیستند، «سازگار با OpenAI» را با نشانی یک سرویس در دسترس انتخاب کنید (راهنما: docs/INSTALL-FA.md).</p>';
        echo '<form method="post" action="#akph-ai">';
        wp_nonce_field('akph_ai', 'akph_ai_nonce');
        echo '<table class="form-table" role="presentation">';
        echo '<tr><th scope="row">وضعیت</th><td><label><input type="checkbox" name="ai_enabled" value="1" ' . checked($s['enabled'], true, false) . '> دستیار فعال باشد</label></td></tr>';
        echo '<tr><th scope="row"><label for="akph-ai-provider">سرویس‌دهنده</label></th><td><select id="akph-ai-provider" name="ai_provider">';
        foreach (array('anthropic' => 'Anthropic (Claude)', 'openai' => 'OpenAI', 'compatible' => 'سازگار با OpenAI (نشانی دلخواه)') as $value => $label) {
            echo '<option value="' . esc_attr($value) . '" ' . selected($s['provider'], $value, false) . '>' . esc_html($label) . '</option>';
        }
        echo '</select></td></tr>';
        echo '<tr><th scope="row"><label for="akph-ai-base">نشانی پایه (Base URL)</label></th><td><input id="akph-ai-base" class="regular-text" dir="ltr" name="ai_base_url" value="' . esc_attr($s['base_url']) . '" placeholder="https://…"><p class="description">برای Anthropic و OpenAI خالی بگذارید (نشانی رسمی). برای سرویس سازگار با OpenAI نشانی تا /v1 را وارد کنید؛ مسیر /chat/completions خودکار اضافه می‌شود.</p></td></tr>';
        echo '<tr><th scope="row"><label for="akph-ai-model">مدل</label></th><td><input id="akph-ai-model" class="regular-text" dir="ltr" name="ai_model" value="' . esc_attr($s['model']) . '"></td></tr>';
        echo '<tr><th scope="row"><label for="akph-ai-key">کلید API</label></th><td>';
        if ($key['source'] === 'constant') {
            echo '<p>کلید از ثابت <code>AKPH_AI_API_KEY</code> در wp-config.php خوانده می‌شود: <code>' . esc_html($key['hint']) . '</code></p>';
        } else {
            echo '<input id="akph-ai-key" type="password" class="regular-text" dir="ltr" name="ai_api_key" value="" autocomplete="new-password" placeholder="' . esc_attr($key['source'] === 'settings' ? 'ذخیره‌شده: ' . $key['hint'] : 'کلید را وارد کنید') . '">';
            echo '<p class="description">برای نگه‌داشتن کلید فعلی خالی بگذارید. کلید رمزنگاری‌شده ذخیره می‌شود و دوباره نمایش داده نمی‌شود.</p>';
            if ($key['source'] === 'settings') {
                echo '<p><label><input type="checkbox" name="ai_clear_key" value="1"> حذف کلید ذخیره‌شده</label></p>';
            }
            if ($key['source'] === 'unreadable') {
                echo '<p class="description" style="color:#b32d2e">کلید ذخیره‌شده خوانده نمی‌شود (کلیدهای امنیتی وردپرس تغییر کرده‌اند)؛ کلید را دوباره وارد کنید.</p>';
            }
            if (!$s['encryption_ready']) {
                echo '<p class="description" style="color:#b32d2e">AUTH_KEY و SECURE_AUTH_SALT در wp-config.php تنظیم نشده‌اند؛ برای ذخیره کلید آن‌ها را تنظیم کنید یا کلید را در ثابت AKPH_AI_API_KEY قرار دهید.</p>';
            }
        }
        echo '</td></tr>';
        echo '<tr><th scope="row"><label for="akph-ai-max">حداکثر توکن پاسخ</label></th><td><input id="akph-ai-max" type="number" min="64" max="32000" name="ai_max_tokens" value="' . esc_attr($s['max_tokens']) . '"></td></tr>';
        echo '<tr><th scope="row"><label for="akph-ai-limit">سقف روزانه درخواست هر کاربر</label></th><td><input id="akph-ai-limit" type="number" min="1" max="1000" name="ai_daily_limit" value="' . esc_attr($s['daily_limit']) . '"></td></tr>';
        echo '<tr><th scope="row">ثبت متن</th><td><label><input type="checkbox" name="ai_log_content" value="1" ' . checked($s['log_content'], true, false) . '> متن کامل پرسش و پاسخ هم ثبت شود</label><p class="description">در حالت عادی فقط کاربر، زمان، توکن مصرفی و نتیجه ثبت می‌شود.</p></td></tr>';
        echo '</table><p><button class="button button-primary" name="akph_ai_action" value="save">ذخیره تنظیمات دستیار</button> ';
        echo '<button class="button" name="akph_ai_action" value="test">آزمون اتصال</button></p></form>';

        $rows = Akph_Schema::ready() ? Akph_Assistant::recent_requests(20) : array();
        if ($rows) {
            $labels = array('ok' => 'موفق', 'refused' => 'بدون پاسخ', 'error' => 'ناموفق', 'pending' => 'در حال اجرا');
            echo '<h3>آخرین درخواست‌ها</h3><table class="widefat striped" style="max-width:900px"><thead><tr><th>کاربر</th><th>زمان</th><th>نتیجه</th><th>توکن ورودی</th><th>توکن خروجی</th></tr></thead><tbody>';
            foreach ($rows as $r) {
                $user = get_userdata((int) $r->user_id);
                echo '<tr><td>' . esc_html($user ? $user->display_name : '#' . $r->user_id) . '</td><td dir="ltr">' . esc_html(get_date_from_gmt($r->created_at, 'Y-m-d H:i')) . '</td><td>' . esc_html(isset($labels[$r->status]) ? $labels[$r->status] : $r->status) . ($r->error_code ? ' <code>' . esc_html($r->error_code) . '</code>' : '') . '</td><td>' . esc_html(number_format((int) $r->input_tokens)) . '</td><td>' . esc_html(number_format((int) $r->output_tokens)) . '</td></tr>';
            }
            echo '</tbody></table>';
        }
    }

    private static function money_cell($rials) {
        return esc_html(number_format((int) $rials)) . ' ریال';
    }

    public static function tools_page() {
        if (!current_user_can('manage_options')) {
            return;
        }
        echo '<div class="wrap"><h1>انتقال پروژه‌ها و کدینگ استاندارد</h1>';
        if (!Akph_Schema::ready()) {
            echo '<div class="notice notice-error"><p>جدول‌های پرتال آماده نیست؛ صفحه تنظیمات را ببینید.</p></div></div>';
            return;
        }
        $action = isset($_POST['akph_action']) ? sanitize_key(wp_unslash($_POST['akph_action'])) : '';
        $valid = $action && isset($_POST['akph_tools_nonce']) && wp_verify_nonce(sanitize_text_field(wp_unslash($_POST['akph_tools_nonce'])), 'akph_tools');
        if ($action && !$valid) {
            echo '<div class="notice notice-error"><p>مهلت فرم تمام شده است؛ دوباره تلاش کنید.</p></div>';
        }

        // ---- project migration
        echo '<h2>۱. انتقال پروژه‌ها از پایدار پورتال</h2>';
        echo '<p>جدول <code>' . esc_html(Akph_Migration::legacy_table()) . '</code> فقط خوانده می‌شود و تغییر نمی‌کند. اجرای دوباره پروژه تکراری نمی‌سازد. مبالغ خلاصه دستی (میلیارد تومان) به ریال تبدیل و فقط به‌صورت «خلاصه دستی» ثبت می‌شوند؛ هیچ سند حسابداری ساخته نمی‌شود و اسناد حسابداری افزونه قبلی منتقل نمی‌شوند.</p>';
        if ($valid && $action === 'migrate_run') {
            try {
                $r = Akph_Migration::run();
                echo '<div class="notice notice-success"><p>' . esc_html($r['created']) . ' پروژه منتقل شد؛ ' . esc_html($r['skipped']) . ' پروژه قبلاً منتقل شده بود.</p></div>';
            } catch (Akph_Error $e) {
                echo '<div class="notice notice-error"><p>' . esc_html($e->getMessage()) . ' هیچ تغییری ذخیره نشد.</p></div>';
            }
        }
        $show_plan = $valid && in_array($action, array('migrate_preview', 'migrate_run'), true);
        $plan = null;
        if ($show_plan) {
            try {
                $plan = Akph_Migration::plan();
            } catch (Akph_Error $e) {
                echo '<div class="notice notice-error"><p>' . esc_html($e->getMessage()) . '</p></div>';
                $show_plan = false;
            }
        }
        if ($show_plan) {
            if (!$plan['available']) {
                echo '<p>جدول پروژه‌های پایدار پورتال پیدا نشد.</p>';
            } else {
                echo '<p>پیش‌نمایش: <strong>' . esc_html($plan['create']) . '</strong> پروژه جدید، <strong>' . esc_html($plan['skip']) . '</strong> تکراری (رد می‌شود)، <strong>' . esc_html($plan['errors']) . '</strong> خطا.</p>';
                echo '<table class="widefat striped"><thead><tr><th>شناسه قبلی</th><th>نام</th><th>اقدام</th><th>بودجه</th><th>مبلغ قرارداد</th><th>خلاصه دستی (درآمد / هزینه)</th><th>هشدار و خطا</th></tr></thead><tbody>';
                $labels = array('create' => 'ایجاد', 'skip' => 'رد (قبلاً منتقل شده)', 'error' => 'خطا');
                foreach ($plan['items'] as $item) {
                    $f = $item['fields'];
                    $notes = array_merge($item['errors'], $item['warnings']);
                    echo '<tr><td><code>' . esc_html($item['legacy_id']) . '</code></td><td>' . esc_html($item['name']) . '</td><td>' . esc_html($labels[$item['action']]) . '</td>';
                    echo '<td>' . self::money_cell($f['budget']) . '</td><td>' . self::money_cell($f['contract_amount']) . '</td>';
                    echo '<td>' . self::money_cell($f['manual_revenue']) . ' / ' . self::money_cell($f['manual_cost']) . '</td>';
                    echo '<td>' . esc_html(implode(' ', $notes)) . '</td></tr>';
                }
                echo '</tbody></table>';
            }
        }
        echo '<form method="post" style="margin-top:12px">';
        wp_nonce_field('akph_tools', 'akph_tools_nonce');
        echo '<button class="button" name="akph_action" value="migrate_preview">پیش‌نمایش (بدون تغییر)</button> ';
        if ($show_plan && !empty($plan['available']) && $plan['create'] > 0 && !$plan['errors']) {
            echo '<button class="button button-primary" name="akph_action" value="migrate_run" onclick="return confirm(\'پروژه‌ها منتقل شوند؟\')">انتقال ' . esc_html($plan['create']) . ' پروژه</button>';
        }
        echo '</form>';

        // ---- standard chart
        echo '<h2 style="margin-top:32px">۲. کدینگ استاندارد حساب‌ها</h2>';
        echo '<p>کدهای حسابی که قواعد ثبت پرتال استفاده می‌کنند (فقط کد، عنوان و سطح؛ بدون مانده). حساب‌های موجود تغییر نمی‌کنند و فقط کدهای ناموجود اضافه می‌شوند.</p>';
        $r = null;
        if ($valid && in_array($action, array('chart_preview', 'chart_install'), true)) {
            try {
                $r = Akph_Accounts::install_standard_chart($action === 'chart_preview');
            } catch (Akph_Error $e) {
                echo '<div class="notice notice-error"><p>' . esc_html($e->getMessage()) . ' هیچ تغییری ذخیره نشد.</p></div>';
            }
        }
        if ($r !== null) {
            if ($action === 'chart_install') {
                echo '<div class="notice notice-success"><p>' . esc_html($r['inserted']) . ' حساب اضافه شد.</p></div>';
            } else {
                echo '<p>' . esc_html(count($r['missing'])) . ' حساب در کدینگ شما نیست:</p><ul style="columns:2">';
                foreach ($r['missing'] as $a) {
                    echo '<li><code>' . esc_html($a[0]) . '</code> ' . esc_html($a[1]) . '</li>';
                }
                echo '</ul>';
            }
        }
        echo '<form method="post">';
        wp_nonce_field('akph_tools', 'akph_tools_nonce');
        echo '<button class="button" name="akph_action" value="chart_preview">پیش‌نمایش کدهای ناموجود</button> ';
        echo '<button class="button button-primary" name="akph_action" value="chart_install" onclick="return confirm(\'کدهای ناموجود اضافه شوند؟\')">افزودن کدهای ناموجود</button>';
        echo '</form></div>';
    }
}
