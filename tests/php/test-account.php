<?php
/**
 * «حساب کاربری من» (/account*): each role reads and changes only its own account; role, capabilities,
 * user_login and user ids are never accepted; the current password guards email and password changes (with
 * an attempt limit); a password change ends the other sessions and keeps the current one; avatars are
 * JPG/PNG/WebP up to 2 MB, stored as the user's own 256×256 attachment.
 */
class Test_Akph_Account extends Akph_Test_Case {
    const PASSWORD = 'رمز-آزمایشی-قدیمی-1403';

    /** @var string[] files made by a test */
    private $tmp_files = array();

    public function set_up() {
        parent::set_up();
        foreach (self::$users as $id) {
            wp_set_password(self::PASSWORD, $id);
            foreach (array(Akph_Account::META_VERSION, Akph_Account::META_MOBILE, Akph_Account::META_PREFERENCES, Akph_Account::META_FAILURES) as $key) {
                delete_user_meta($id, $key);
            }
            $avatar = (int) get_user_meta($id, Akph_Account::META_AVATAR, true);
            if ($avatar) {
                wp_delete_attachment($avatar, true);
            }
            delete_user_meta($id, Akph_Account::META_AVATAR);
            WP_Session_Tokens::get_instance($id)->destroy_all();
            wp_update_user(array('ID' => $id, 'display_name' => 'کاربر', 'user_email' => 'user' . $id . '@example.org'));
        }
    }

    public function tear_down() {
        unset($_COOKIE[LOGGED_IN_COOKIE]);
        foreach ($this->tmp_files as $f) {
            if (is_file($f)) {
                unlink($f);
            }
        }
        parent::tear_down();
    }

    /** Signs `$key` in with a real session (cookie token) plus `$others` sessions in other browsers. */
    private function sign_in($key, $others = 2) {
        $id = self::$users[$key];
        $manager = WP_Session_Tokens::get_instance($id);
        $tokens = array();
        for ($i = 0; $i < $others; $i++) {
            $tokens[] = $manager->create(time() + DAY_IN_SECONDS);
        }
        $current = $manager->create(time() + DAY_IN_SECONDS);
        $_COOKIE[LOGGED_IN_COOKIE] = wp_generate_auth_cookie($id, time() + DAY_IN_SECONDS, 'logged_in', $current);
        $this->login($key);
        return array($current, $tokens);
    }

    private function account() {
        $response = $this->request('GET', '/account');
        $this->assertStatus(200, $response);
        return $response->get_data()['account'];
    }

    private function profile(array $body, $version = null) {
        return $this->request('POST', '/account/profile', array_merge(array('version' => $version === null ? $this->account()['version'] : $version), $body));
    }

    public function test_every_role_reads_and_changes_only_its_own_account() {
        foreach (array('admin', 'senior', 'accountant', 'pm') as $key) {
            $this->login($key);
            $account = $this->account();
            $this->assertSame((string) self::$users[$key], $account['id'], $key);
            $this->assertSame(1, $account['version']);
            $this->assertSame(array('currency' => 'site', 'rows_per_page' => 25, 'start_page' => '/'), $account['preferences']);

            $response = $this->profile(array('display_name' => 'نام تازه ' . $key, 'first_name' => 'نام', 'last_name' => 'خانوادگی'));
            $this->assertStatus(200, $response, $key);
            $record = $response->get_data()['records']['account'][0];
            $this->assertSame('نام تازه ' . $key, $record['display_name']);
            $this->assertSame(2, $record['version']);
            $this->assertSame('نام تازه ' . $key, get_userdata(self::$users[$key])->display_name);
        }
        // Nobody else was touched.
        foreach (array('accountant2', 'pm2', 'norole') as $key) {
            $this->assertSame('کاربر', get_userdata(self::$users[$key])->display_name, $key);
        }
        $this->assertSame(4, $this->count_rows('audit_log', "action = 'account_profile'"));
        $row = $GLOBALS['wpdb']->get_row('SELECT * FROM ' . Akph_Schema::table('audit_log') . " WHERE action = 'account_profile' ORDER BY id DESC LIMIT 1");
        $this->assertSame((string) self::$users['pm'], (string) $row->user_id);
        $this->assertSame((string) self::$users['pm'], (string) $row->object_id);
        $this->assertSame('user', $row->object_type);
    }

    public function test_role_capabilities_login_and_user_ids_are_never_accepted() {
        $this->login('pm');
        $other = self::$users['admin'];
        $attempts = array(
            array('role' => 'administrator'),
            array('roles' => array('administrator')),
            array('capabilities' => array('akph_view_all' => true)),
            array('user_login' => 'someone'),
            array('user_id' => $other),
            array('id' => $other),
            array('display_name' => 'x', 'user_id' => $other),
        );
        foreach ($attempts as $body) {
            $response = $this->profile($body);
            $this->assertStatus(400, $response, wp_json_encode($body));
            $this->assertSame('akph_forbidden_field', $this->errorCode($response));
        }
        $unknown = $this->profile(array('nickname' => 'x'));
        $this->assertStatus(400, $unknown);
        $this->assertSame('akph_unknown_field', $this->errorCode($unknown));
        $nested = $this->profile(array('preferences' => array('role' => 'administrator')));
        $this->assertStatus(400, $nested);

        // In the query string too, on every account route.
        $query = $this->request('POST', '/account/profile', array('display_name' => 'x', 'version' => 1), array(), array('user_id' => $other));
        $this->assertStatus(400, $query);
        $this->assertSame('akph_forbidden_field', $this->errorCode($query));
        $this->assertStatus(400, $this->request('GET', '/account', null, array(), array('user_id' => $other)));
        $this->assertStatus(400, $this->request('POST', '/account/email', array('email' => 'a@example.org', 'current_password' => self::PASSWORD, 'role' => 'administrator')));
        $this->assertStatus(400, $this->request('POST', '/account/password', array('current_password' => self::PASSWORD, 'new_password' => 'یک-رمز-تازه-و-بلند', 'user_id' => $other)));

        $pm = get_userdata(self::$users['pm']);
        $this->assertSame(array('paydar_project_manager'), array_values($pm->roles));
        $this->assertFalse(user_can($pm, Akph_Roles::VIEW_ALL));
        $this->assertSame('کاربر', $pm->display_name);
        $this->assertSame('کاربر', get_userdata($other)->display_name);
        $this->assertSame(1, $this->account()['version']);
        $this->assertSame(0, $this->count_rows('audit_log', "action LIKE 'account%'"));
    }

    public function test_guests_and_users_without_a_portal_role_are_refused() {
        $this->login('guest');
        $this->assertStatus(401, $this->request('GET', '/account'));
        $this->login('norole');
        $response = $this->request('POST', '/account/profile', array('display_name' => 'x', 'version' => 1));
        $this->assertStatus(403, $response);
        $this->assertSame('akph_no_portal_role', $this->errorCode($response));
        $this->assertSame('کاربر', get_userdata(self::$users['norole'])->display_name);
    }

    public function test_profile_validation_version_and_idempotency() {
        $this->login('accountant');
        $mobile = $this->profile(array('mobile' => '۰۹۱۲ ۳۴۵ ۶۷۸۹'));
        $this->assertStatus(200, $mobile);
        $this->assertSame('09123456789', $mobile->get_data()['records']['account'][0]['mobile']);
        foreach (array(array('+989351112233', '09351112233'), array('00989351112233', '09351112233'), array('9351112233', '09351112233'), array('', '')) as $case) {
            list($in, $out) = $case;
            $response = $this->profile(array('mobile' => $in));
            $this->assertStatus(200, $response, $in);
            $this->assertSame($out, $response->get_data()['records']['account'][0]['mobile'], $in);
        }
        foreach (array('0912345678', '08123456789', '091234567890', 'abc', '+44912345678') as $bad) {
            $response = $this->profile(array('mobile' => $bad));
            $this->assertStatus(400, $response, $bad);
        }
        $this->assertStatus(400, $this->profile(array('display_name' => '   ')));
        $this->assertStatus(400, $this->profile(array('preferences' => array('rows_per_page' => 30))));
        $this->assertStatus(400, $this->profile(array('preferences' => array('start_page' => '/wp-admin'))));
        $this->assertStatus(400, $this->profile(array('preferences' => array('currency' => 'usd'))));

        $prefs = $this->profile(array('preferences' => array('currency' => 'rial', 'rows_per_page' => 50, 'start_page' => '/finance/accounting')));
        $this->assertStatus(200, $prefs);
        $this->assertSame(array('currency' => 'rial', 'rows_per_page' => 50, 'start_page' => '/finance/accounting'), $prefs->get_data()['records']['account'][0]['preferences']);
        $me = $this->request('GET', '/me')->get_data();
        $this->assertSame('rial', $me['currency']);
        $this->assertSame('toman', $me['site_currency']);
        $this->assertSame(50, $me['preferences']['rows_per_page']);

        // Stale version: 409; version is required.
        $version = $this->account()['version'];
        $this->assertStatus(409, $this->profile(array('first_name' => 'الف'), $version - 1));
        $this->assertStatus(428, $this->request('POST', '/account/profile', array('first_name' => 'الف')));

        // The same Idempotency-Key replays the first answer and saves once.
        $key = wp_generate_uuid4();
        $first = $this->request('POST', '/account/profile', array('first_name' => 'ب', 'version' => $version), array('Idempotency-Key' => $key));
        $again = $this->request('POST', '/account/profile', array('first_name' => 'ب', 'version' => $version), array('Idempotency-Key' => $key));
        $this->assertStatus(200, $first);
        $this->assertStatus(200, $again);
        $this->assertSame($first->get_data(), $again->get_data());
        $this->assertSame($version + 1, $this->account()['version']);
    }

    public function test_email_change_needs_the_current_password_and_a_free_address() {
        $this->login('senior');
        $wrong = $this->request('POST', '/account/email', array('email' => 'new-senior@example.org', 'current_password' => 'نادرست-نادرست'));
        $this->assertStatus(403, $wrong);
        $this->assertSame('akph_wrong_password', $this->errorCode($wrong));
        $taken = $this->request('POST', '/account/email', array('email' => 'user' . self::$users['pm'] . '@example.org', 'current_password' => self::PASSWORD));
        $this->assertStatus(409, $taken);
        $this->assertStatus(400, $this->request('POST', '/account/email', array('email' => 'not-an-email', 'current_password' => self::PASSWORD)));

        $ok = $this->request('POST', '/account/email', array('email' => 'new-senior@example.org', 'current_password' => self::PASSWORD));
        $this->assertStatus(200, $ok);
        $this->assertSame('new-senior@example.org', get_userdata(self::$users['senior'])->user_email);
        $this->assertSame(1, $this->count_rows('audit_log', "action = 'account_email' AND user_id = " . self::$users['senior']));
    }

    public function test_wrong_current_password_is_refused_and_attempts_are_limited() {
        list($token) = $this->sign_in('pm', 0);
        for ($i = 1; $i <= Akph_Account::MAX_FAILURES; $i++) {
            $response = $this->request('POST', '/account/password', array('current_password' => 'رمز-نادرست-' . $i, 'new_password' => 'یک-رمز-تازه-و-بلند'));
            $this->assertStatus(403, $response, "attempt {$i}");
            $this->assertSame('akph_wrong_password', $this->errorCode($response));
        }
        // Even the right password is refused for the rest of the window, for email changes too.
        $locked = $this->request('POST', '/account/password', array('current_password' => self::PASSWORD, 'new_password' => 'یک-رمز-تازه-و-بلند'));
        $this->assertStatus(429, $locked);
        $this->assertSame('akph_too_many_attempts', $this->errorCode($locked));
        $this->assertStatus(429, $this->request('POST', '/account/email', array('email' => 'x@example.org', 'current_password' => self::PASSWORD)));
        $this->assertTrue(wp_check_password(self::PASSWORD, get_userdata(self::$users['pm'])->user_pass));
        $this->assertSame(Akph_Account::MAX_FAILURES, $this->count_rows('audit_log', "action = 'account_password_failed'"));
        // Another user is not affected.
        $this->login('pm2');
        $this->assertStatus(403, $this->request('POST', '/account/password', array('current_password' => 'x-x-x-x-x-x', 'new_password' => 'یک-رمز-تازه-و-بلند')));

        // After the window the right password works again.
        $old = array_fill(0, Akph_Account::MAX_FAILURES, time() - Akph_Account::FAILURE_WINDOW - 1);
        update_user_meta(self::$users['pm'], Akph_Account::META_FAILURES, $old);
        $this->login('pm');
        $this->assertStatus(200, $this->request('POST', '/account/password', array('current_password' => self::PASSWORD, 'new_password' => 'یک-رمز-تازه-و-بلند')));
        $this->assertTrue(WP_Session_Tokens::get_instance(self::$users['pm'])->verify($token));
    }

    public function test_password_change_ends_other_sessions_and_keeps_the_current_one() {
        list($current, $others) = $this->sign_in('accountant', 3);
        $manager = WP_Session_Tokens::get_instance(self::$users['accountant']);
        $this->assertCount(4, $manager->get_all());
        $sessions = $this->request('GET', '/account/sessions')->get_data()['sessions'];
        $this->assertCount(4, $sessions);
        $this->assertTrue($sessions[0]['current']);
        $this->assertSame(1, count(array_filter(wp_list_pluck($sessions, 'current'))));

        $short = $this->request('POST', '/account/password', array('current_password' => self::PASSWORD, 'new_password' => 'کوتاه'));
        $this->assertStatus(400, $short);
        $same = $this->request('POST', '/account/password', array('current_password' => self::PASSWORD, 'new_password' => self::PASSWORD));
        $this->assertStatus(400, $same);

        $issued = array();
        $capture = function ($cookie, $expire, $expiration, $user_id, $scheme, $token) use (&$issued) {
            $issued[] = array($cookie, $token);
        };
        add_action('set_logged_in_cookie', $capture, 10, 6);
        $response = $this->request('POST', '/account/password', array('current_password' => self::PASSWORD, 'new_password' => 'رمز-تازه-و-طولانی-۱۴۰۵'));
        remove_action('set_logged_in_cookie', $capture, 10);
        $this->assertStatus(200, $response);

        $user = get_userdata(self::$users['accountant']);
        $this->assertTrue(wp_check_password('رمز-تازه-و-طولانی-۱۴۰۵', $user->user_pass, $user->ID));
        $this->assertFalse(wp_check_password(self::PASSWORD, $user->user_pass, $user->ID));
        $this->assertCount(1, $manager->get_all());
        $this->assertTrue($manager->verify($current), 'the current session stays');
        foreach ($others as $token) {
            $this->assertFalse($manager->verify($token), 'other sessions end');
        }
        // A fresh cookie for the same session, valid with the new password.
        $this->assertCount(1, $issued);
        $this->assertSame($current, $issued[0][1]);
        $this->assertSame($user->ID, wp_validate_auth_cookie($issued[0][0], 'logged_in'));

        $row = $GLOBALS['wpdb']->get_row('SELECT * FROM ' . Akph_Schema::table('audit_log') . " WHERE action = 'account_password'");
        $this->assertSame(array('other_sessions_ended' => 3), json_decode($row->after_data, true));
        // No password (or its hash) in the audit trail or the stored command.
        global $wpdb;
        $stored = $wpdb->get_col('SELECT CONCAT(IFNULL(before_data, ""), IFNULL(after_data, "")) FROM ' . Akph_Schema::table('audit_log'));
        $stored = array_merge($stored, $wpdb->get_col('SELECT CONCAT(request_hash, IFNULL(response, "")) FROM ' . Akph_Schema::table('idempotency_keys')));
        foreach ($stored as $text) {
            $this->assertStringNotContainsString('رمز-تازه', (string) $text);
            $this->assertStringNotContainsString(self::PASSWORD, (string) $text);
        }
    }

    public function test_logout_others() {
        list($current, $others) = $this->sign_in('senior', 2);
        $response = $this->request('POST', '/account/sessions/logout-others', array());
        $this->assertStatus(200, $response);
        $manager = WP_Session_Tokens::get_instance(self::$users['senior']);
        $this->assertTrue($manager->verify($current));
        $this->assertFalse($manager->verify($others[0]));
        $this->assertCount(1, $this->request('GET', '/account/sessions')->get_data()['sessions']);
        // Another user's sessions are not touched.
        list($pm_current) = $this->sign_in('pm', 1);
        $this->assertCount(2, WP_Session_Tokens::get_instance(self::$users['pm'])->get_all());
        $this->assertTrue(WP_Session_Tokens::get_instance(self::$users['pm'])->verify($pm_current));
    }

    // ------------------------------------------------------------------ avatar

    private function image_file($mime, $width = 300, $height = 200) {
        require_once ABSPATH . 'wp-admin/includes/file.php';
        $im = imagecreatetruecolor($width, $height);
        imagefill($im, 0, 0, imagecolorallocate($im, 30, 120, 200));
        $ext = array('image/png' => 'png', 'image/jpeg' => 'jpg', 'image/webp' => 'webp')[$mime];
        $path = wp_tempnam('avatar.' . $ext);
        if ($mime === 'image/png') {
            imagepng($im, $path);
        } elseif ($mime === 'image/jpeg') {
            imagejpeg($im, $path, 85);
        } else {
            imagewebp($im, $path, 80);
        }
        imagedestroy($im);
        $this->tmp_files[] = $path;
        return $path;
    }

    private function upload($path, $name, $type) {
        $request = new WP_REST_Request('POST', '/akph/v1/account/avatar');
        $request->set_header('X-WP-Nonce', wp_create_nonce('wp_rest'));
        $request->set_header('Idempotency-Key', wp_generate_uuid4());
        $request->set_file_params(array('avatar' => array('name' => $name, 'type' => $type, 'tmp_name' => $path, 'error' => UPLOAD_ERR_OK, 'size' => filesize($path))));
        return rest_get_server()->dispatch($request);
    }

    public function test_avatar_is_stored_as_the_users_own_square_attachment() {
        $this->login('pm');
        $response = $this->upload($this->image_file('image/png', 300, 200), 'avatar.png', 'image/png');
        $this->assertStatus(200, $response);
        $id = (int) get_user_meta(self::$users['pm'], Akph_Account::META_AVATAR, true);
        $post = get_post($id);
        $this->assertSame('attachment', $post->post_type);
        $this->assertSame((string) self::$users['pm'], (string) $post->post_author);
        $this->assertSame('image/png', $post->post_mime_type);
        $size = getimagesize(get_attached_file($id));
        $this->assertSame(array(256, 256), array($size[0], $size[1]));
        $url = $response->get_data()['records']['account'][0]['avatar_url'];
        $this->assertSame(wp_get_attachment_image_url($id, 'full'), $url);
        $this->assertSame($url, get_avatar_url(self::$users['pm']));
        $this->assertSame($url, $this->request('GET', '/me')->get_data()['avatar_url']);

        // A small JPEG is scaled up to the same square; the previous avatar is deleted.
        $second = $this->upload($this->image_file('image/jpeg', 80, 120), 'photo.jpg', 'image/jpeg');
        $this->assertStatus(200, $second);
        $new_id = (int) get_user_meta(self::$users['pm'], Akph_Account::META_AVATAR, true);
        $this->assertNotSame($id, $new_id);
        $this->assertNull(get_post($id));
        $size = getimagesize(get_attached_file($new_id));
        $this->assertSame(array(256, 256), array($size[0], $size[1]));

        $uploads = 2;
        if (function_exists('imagewebp') && wp_image_editor_supports(array('mime_type' => 'image/webp'))) {
            $this->assertStatus(200, $this->upload($this->image_file('image/webp'), 'a.webp', 'image/webp'));
            $uploads++;
        }

        $removed = $this->request('DELETE', '/account/avatar');
        $this->assertStatus(200, $removed);
        $this->assertNull($removed->get_data()['records']['account'][0]['avatar_url']);
        $this->assertSame('', get_user_meta(self::$users['pm'], Akph_Account::META_AVATAR, true));
        $this->assertSame($uploads, $this->count_rows('audit_log', "action = 'account_avatar' AND user_id = " . self::$users['pm']));
        $this->assertSame(1, $this->count_rows('audit_log', "action = 'account_avatar_removed' AND user_id = " . self::$users['pm']));
    }

    public function test_non_images_and_files_over_2mb_are_refused() {
        require_once ABSPATH . 'wp-admin/includes/file.php';
        $this->login('accountant');
        $text = wp_tempnam('note.png');
        file_put_contents($text, str_repeat('not an image ', 50));
        $this->tmp_files[] = $text;
        $response = $this->upload($text, 'note.png', 'image/png');
        $this->assertStatus(415, $response);
        $this->assertSame('akph_file_type', $this->errorCode($response));

        $gif = wp_tempnam('a.gif');
        $im = imagecreatetruecolor(10, 10);
        imagegif($im, $gif);
        imagedestroy($im);
        $this->tmp_files[] = $gif;
        $this->assertStatus(415, $this->upload($gif, 'a.gif', 'image/gif'));

        // A PHP file with an image extension.
        $php = wp_tempnam('shell.jpg');
        file_put_contents($php, '<?php echo 1;');
        $this->tmp_files[] = $php;
        $this->assertStatus(415, $this->upload($php, 'shell.jpg', 'image/jpeg'));

        $big = $this->image_file('image/png', 20, 20);
        $fh = fopen($big, 'ab');
        fwrite($fh, str_repeat("\0", Akph_Account::AVATAR_MAX_BYTES));
        fclose($fh);
        $response = $this->upload($big, 'big.png', 'image/png');
        $this->assertStatus(413, $response);
        $this->assertSame('akph_file_too_large', $this->errorCode($response));

        $this->assertSame('', get_user_meta(self::$users['accountant'], Akph_Account::META_AVATAR, true));
        $this->assertSame(0, $this->count_rows('audit_log', "action = 'account_avatar'"));
    }
}
