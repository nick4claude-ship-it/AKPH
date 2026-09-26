<?php
/**
 * The portal's members' login page (/?akph_portal=1 for guests): every portal role signs in and lands on its
 * start page; wrong credentials get one general message; 5 failures lock the IP address for 15 minutes; a user
 * without a portal role is logged out at once; an invalid nonce is refused. wp-login.php sends members (not
 * the system administrator) to this page, and logging out of the app comes back to it.
 */
class Test_Akph_Login extends Akph_Test_Case {
    const PASSWORD = 'رمز-ورود-آزمایشی-۱۴۰۵';
    const IP = '203.0.113.7';

    public function set_up() {
        parent::set_up();
        foreach (self::$users as $id) {
            wp_set_password(self::PASSWORD, $id);
            WP_Session_Tokens::get_instance($id)->destroy_all();
            delete_user_meta($id, Akph_Account::META_PREFERENCES);
        }
        foreach (array(self::IP, '203.0.113.8') as $ip) {
            delete_transient('akph_lf_' . md5($ip));
        }
        unset($_COOKIE[Akph_Login::MEMBER_COOKIE], $_GET['login'], $_REQUEST['action'], $_GET['action']);
        $_SERVER['REQUEST_METHOD'] = 'GET';
    }

    public function tear_down() {
        unset($_COOKIE[Akph_Login::MEMBER_COOKIE], $_GET['login'], $_REQUEST['action'], $_GET['action']);
        $_SERVER['REQUEST_METHOD'] = 'GET';
        parent::tear_down();
    }

    /** The form as a guest would post it (nonce made while signed out). */
    private function post($login, $password, array $extra = array(), $ip = self::IP) {
        wp_set_current_user(0);
        $form = array_merge(array(
            'akph_login' => '1',
            '_akph_nonce' => wp_create_nonce(Akph_Login::ACTION),
            'log' => $login,
            'pwd' => $password,
        ), $extra);
        return Akph_Login::process($form, $ip);
    }

    private function login_name($key) {
        return get_userdata(self::$users[$key])->user_login;
    }

    public function test_every_portal_role_signs_in_and_goes_to_its_start_page() {
        update_user_meta(self::$users['pm'], Akph_Account::META_PREFERENCES, array('start_page' => '/projects'));
        foreach (array('admin' => false, 'senior' => true, 'accountant' => true, 'pm' => true) as $key => $member) {
            $result = $this->post($this->login_name($key), self::PASSWORD);
            $this->assertSame('ok', $result['code'], $key);
            $this->assertSame($member, $result['member'], $key);
            $this->assertSame(self::$users[$key], get_current_user_id(), $key);
            $this->assertCount(1, WP_Session_Tokens::get_instance(self::$users[$key])->get_all(), $key . ' has a session');
            $expected = $key === 'pm' ? Akph_App::url() . '#/projects' : Akph_App::url();
            $this->assertSame($expected, $result['redirect'], $key);
        }
        // The email address works as well.
        $email = get_userdata(self::$users['accountant'])->user_email;
        $this->assertSame('ok', $this->post($email, self::PASSWORD)['code']);
    }

    public function test_wrong_password_and_unknown_user_get_the_same_general_message() {
        $wrong = $this->post($this->login_name('pm'), 'رمز-نادرست');
        $unknown = $this->post('no-such-user-akph', 'رمز-نادرست');
        $this->assertSame('failed', $wrong['code']);
        $this->assertSame('failed', $unknown['code']);
        $this->assertSame($wrong['redirect'], $unknown['redirect']);
        $this->assertSame(0, get_current_user_id());
        $this->assertSame('empty', $this->post($this->login_name('pm'), '')['code']);

        $_GET['login'] = 'failed';
        $html = Akph_Login::page_html();
        $this->assertStringContainsString('نام کاربری یا رمز عبور درست نیست.', $html);
        $this->assertStringNotContainsString($this->login_name('pm'), $html);
    }

    public function test_five_failures_lock_the_ip_address_for_15_minutes() {
        for ($i = 1; $i <= Akph_Login::MAX_FAILURES; $i++) {
            $this->assertSame('failed', $this->post($this->login_name('accountant'), 'نادرست-' . $i)['code'], "attempt {$i}");
        }
        // Even the right password is refused from this address; another address is not affected.
        $locked = $this->post($this->login_name('accountant'), self::PASSWORD);
        $this->assertSame('locked', $locked['code']);
        $this->assertSame(0, get_current_user_id());
        $this->assertCount(0, WP_Session_Tokens::get_instance(self::$users['accountant'])->get_all());
        $this->assertSame('ok', $this->post($this->login_name('accountant'), self::PASSWORD, array(), '203.0.113.8')['code']);
        // The transient lives for the window, then logins work again.
        $timeout = (int) get_option('_transient_timeout_akph_lf_' . md5(self::IP));
        $this->assertEqualsWithDelta(time() + Akph_Login::WINDOW, $timeout, 5);
        delete_transient('akph_lf_' . md5(self::IP));
        $this->assertSame('ok', $this->post($this->login_name('accountant'), self::PASSWORD)['code']);
        $_GET['login'] = 'locked';
        $this->assertStringContainsString('۱۵ دقیقه', Akph_Login::page_html());
    }

    public function test_a_user_without_a_portal_role_is_logged_out_at_once() {
        $result = $this->post($this->login_name('norole'), self::PASSWORD);
        $this->assertSame('noaccess', $result['code']);
        $this->assertSame(0, get_current_user_id());
        $this->assertCount(0, WP_Session_Tokens::get_instance(self::$users['norole'])->get_all(), 'the new session is destroyed');
        $this->assertSame(add_query_arg('login', 'noaccess', Akph_App::url()), $result['redirect']);
        $_GET['login'] = 'noaccess';
        $this->assertStringContainsString('حساب شما دسترسی به پرتال ندارد.', Akph_Login::page_html());
    }

    public function test_an_invalid_nonce_is_refused_before_anything_else() {
        foreach (array('', 'deadbeef00') as $nonce) {
            $result = $this->post($this->login_name('senior'), self::PASSWORD, array('_akph_nonce' => $nonce));
            $this->assertSame('expired', $result['code']);
        }
        $this->assertSame(0, get_current_user_id());
        $this->assertCount(0, WP_Session_Tokens::get_instance(self::$users['senior'])->get_all());
        $this->assertFalse(get_transient('akph_lf_' . md5(self::IP)), 'not counted as a failed login');
    }

    public function test_login_page_is_not_cached_or_framed_and_has_the_form() {
        $page = Akph_Login::respond();
        $this->assertContains('Cache-Control: no-store, no-cache, must-revalidate, private, max-age=0', $page['headers']);
        $this->assertContains('X-LiteSpeed-Cache-Control: no-cache', $page['headers']);
        $this->assertContains('X-Frame-Options: SAMEORIGIN', $page['headers']);
        $this->assertContains("Content-Security-Policy: frame-ancestors 'self'", $page['headers']);
        $this->assertTrue(defined('DONOTCACHEPAGE') && DONOTCACHEPAGE);
        $html = $page['html'];
        $this->assertStringContainsString('<html lang="fa" dir="rtl">', $html);
        $this->assertStringContainsString('سامانه پاک: پورتال آریا کاوش', $html);
        foreach (array('name="log"', 'name="pwd"', 'name="rememberme"', 'name="_akph_nonce"', 'مرا به خاطر بسپار', 'فراموشی رمز', 'aria-label="نمایش رمز عبور"', 'for="akl-user"', 'for="akl-pass"') as $needle) {
            $this->assertStringContainsString($needle, $html, $needle);
        }
        // «فراموشی رمز» returns to the portal after the email is sent.
        $this->assertStringContainsString(esc_url(wp_lostpassword_url(add_query_arg('login', 'checkemail', Akph_App::url()))), $html);
        $source = file_get_contents(AKPH_PORTAL_DIR . 'includes/class-akph-login.php');
        $this->assertMatchesRegularExpression('/^\s*send_frame_options_header\(\);/m', $source);
        $this->assertStringContainsString("wp_signon(array('user_login' => \$login, 'user_password' => \$password, 'remember' => !empty(\$post['rememberme'])), is_ssl())", $source);
    }

    public function test_wp_login_sends_members_to_the_portal_but_not_the_administrator() {
        $this->login('pm');
        $this->assertSame(Akph_App::url(), Akph_Login::wp_login_redirect_target());
        $this->login('senior');
        $this->assertSame(Akph_App::url(), Akph_Login::wp_login_redirect_target());
        $this->login('admin');
        $this->assertNull(Akph_Login::wp_login_redirect_target(), 'the system administrator keeps wp-login.php');
        $this->login('norole');
        $this->assertNull(Akph_Login::wp_login_redirect_target());

        // A signed-out browser that last signed in to the portal as a member.
        $this->login('guest');
        $this->assertNull(Akph_Login::wp_login_redirect_target());
        $_COOKIE[Akph_Login::MEMBER_COOKIE] = '1';
        $this->assertSame(Akph_App::url(), Akph_Login::wp_login_redirect_target());

        // Logout, lost password, reset and a posted form are never redirected.
        foreach (array('logout', 'lostpassword', 'rp', 'resetpass') as $action) {
            $_REQUEST['action'] = $action;
            $this->login('pm');
            $this->assertNull(Akph_Login::wp_login_redirect_target(), $action);
        }
        unset($_REQUEST['action']);
        $_SERVER['REQUEST_METHOD'] = 'POST';
        $this->assertNull(Akph_Login::wp_login_redirect_target());
    }

    public function test_members_always_land_in_the_app_and_logout_returns_to_the_portal_login() {
        add_filter('login_redirect', function () {
            return home_url('/paydar-dashboard/');
        }, 10, 3);
        foreach (array('senior', 'accountant', 'pm') as $key) {
            $redirect = apply_filters('login_redirect', admin_url('profile.php'), admin_url('profile.php'), get_userdata(self::$users[$key]));
            $this->assertSame(Akph_App::url(), $redirect, $key);
        }
        $this->assertSame(home_url('/paydar-dashboard/'), apply_filters('login_redirect', admin_url('options.php'), admin_url('options.php'), get_userdata(self::$users['admin'])));

        // paydar-portal's logout_redirect runs first; a logout that came from the app ends on the portal login.
        add_filter('logout_redirect', function () {
            return home_url('/?login=out');
        }, 10, 3);
        $this->assertGreaterThan(10, has_filter('logout_redirect', array('Akph_Login', 'logout_redirect')));
        $user = get_userdata(self::$users['pm']);
        $this->assertSame(add_query_arg('login', 'out', Akph_App::url()), apply_filters('logout_redirect', home_url('/'), Akph_App::url(), $user));
        $this->assertSame(home_url('/?login=out'), apply_filters('logout_redirect', home_url('/'), home_url('/shop/'), $user), 'other logouts are left alone');
        $_GET['login'] = 'out';
        $this->assertStringContainsString('از حساب خارج شدید.', Akph_Login::page_html());
    }
}
