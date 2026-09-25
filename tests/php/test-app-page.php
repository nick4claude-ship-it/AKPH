<?php
/**
 * The app page /?akph_portal=1 and the way users reach it (0.3.1): login_redirect after paydar-portal, the
 * inline configuration cannot close its <script>, and the page may not be framed by another site.
 */
class Test_Akph_App_Page extends Akph_Test_Case {
    /** What paydar-portal's filter (default priority) does: send its users to its own page. */
    private function add_paydar_like_filter() {
        add_filter('login_redirect', function () {
            return home_url('/paydar-dashboard/');
        }, 10, 3);
    }

    private function redirect_for($key, $requested, $redirect_to = null) {
        $user = get_userdata(self::$users[$key]);
        return apply_filters('login_redirect', $redirect_to === null ? ($requested !== '' ? $requested : admin_url()) : $redirect_to, $requested, $user);
    }

    public function test_login_redirect_runs_after_paydar_portal() {
        $priority = has_filter('login_redirect', array('Akph_App', 'login_redirect'));
        $this->assertSame(Akph_App::LOGIN_REDIRECT_PRIORITY, $priority);
        $this->assertGreaterThan(10, $priority);
    }

    public function test_a_login_heading_to_the_app_keeps_its_redirect_to() {
        $this->add_paydar_like_filter();
        $app = add_query_arg(array('akph_portal' => '1', 'section' => 'journal'), home_url('/'));
        foreach (array('pm', 'accountant', 'admin', 'norole') as $key) {
            $this->assertSame($app, $this->redirect_for($key, $app), $key);
        }
        // Only to this site: a foreign URL carrying the word falls back to the app.
        $this->assertSame(Akph_App::url(), $this->redirect_for('pm', 'https://evil.example/?akph_portal=1'));
    }

    public function test_portal_roles_land_on_the_app_after_a_plain_login() {
        $this->add_paydar_like_filter();
        foreach (array('admin', 'senior', 'accountant', 'pm') as $key) {
            $this->assertSame(Akph_App::url(), $this->redirect_for($key, ''), $key . ' without redirect_to');
            $this->assertSame(Akph_App::url(), $this->redirect_for($key, admin_url()), $key . ' with the default dashboard');
        }
        $this->assertSame(home_url('/?akph_portal=1'), Akph_App::url());
    }

    public function test_other_users_and_specific_destinations_are_left_alone() {
        $this->add_paydar_like_filter();
        $this->assertSame(home_url('/paydar-dashboard/'), $this->redirect_for('norole', ''), 'user without a portal role');
        $this->assertSame(home_url('/paydar-dashboard/'), $this->redirect_for('admin', admin_url('options-general.php')), 'a specific admin page');
        $failed = apply_filters('login_redirect', admin_url(), '', new WP_Error('incorrect_password', 'x'));
        $this->assertSame(home_url('/paydar-dashboard/'), $failed, 'failed login');
    }

    public function test_config_json_cannot_close_the_script_element() {
        $evil = 'شرکت </script><script>alert(1)</script> & <!-- "q" \'a\'';
        update_option('blogname', $evil);
        // Written directly: wp_update_user() would strip the tags before they reach the page.
        global $wpdb;
        $wpdb->update($wpdb->users, array('display_name' => '</SCRIPT><img src=x onerror=alert(2)>'), array('ID' => self::$users['accountant']));
        clean_user_cache(self::$users['accountant']);
        Akph_Settings::update(array('mode' => 'live'));
        $this->login('accountant');
        $page = Akph_App::respond(wp_get_current_user(), 'live');
        $html = $page['html'];

        $this->assertStringNotContainsString('<script>alert(1)', $html);
        $this->assertStringNotContainsString('<img src=x', $html);
        $this->assertStringNotContainsString('<!-- "q"', $html);
        $this->assertStringContainsString('\u003C\/script\u003E', $html);
        $this->assertStringContainsString('\u0026', $html);
        $this->assertSame(1, preg_match('/<script>window\.AkphPortal = (.*?);<\/script>/s', $html, $m));
        $config = json_decode($m[1], true);
        $this->assertSame($evil, $config['siteName'], 'the value itself arrives unchanged');
        $this->assertSame('</SCRIPT><img src=x onerror=alert(2)>', $config['displayName']);
        $this->assertSame('{"a":"\u003C\u0026\u003E"}', Akph_App::config_json(array('a' => '<&>')));
    }

    public function test_page_may_not_be_framed_by_another_site() {
        $this->login('admin');
        $page = Akph_App::respond(wp_get_current_user(), 'live');
        $this->assertContains('X-Frame-Options: SAMEORIGIN', $page['headers']);
        $this->assertContains("Content-Security-Policy: frame-ancestors 'self'", $page['headers']);
        $this->assertContains('Content-Type: text/html; charset=utf-8', $page['headers']);
        // The header comes from WordPress's own helper.
        $source = file_get_contents(AKPH_PORTAL_DIR . 'includes/class-akph-app.php');
        $this->assertMatchesRegularExpression('/^\s*send_frame_options_header\(\);/m', $source);
        $this->assertStringContainsString('JSON_HEX_TAG | JSON_HEX_AMP', $source);
    }
}
