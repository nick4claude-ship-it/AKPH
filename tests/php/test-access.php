<?php
/**
 * Every akph/v1 route × the four portal roles, a user without a portal role and a guest.
 * Guests get 401, users without a portal role 403, roles without the route's capability 403
 * (akph_role_forbidden); roles with it pass the permission check (whatever the handler answers next).
 */
class Test_Akph_Access extends Akph_Test_Case {
    const PERMISSION_CODES = array('akph_unauthorized', 'akph_invalid_nonce', 'akph_no_portal_role', 'akph_role_forbidden', 'rest_forbidden');

    /** @var array<string,string> */
    private $ids = array();

    public function set_up() {
        parent::set_up();
        $this->install_chart();
        $this->login('senior');
        $project = $this->make_project(array('manager_user_id' => self::$users['pm']));
        $this->ids['project'] = $project['id'];
        $this->ids['entry'] = $this->make_entry('accountant', '2026-04-10')['id'];
        $cc = $this->request('POST', '/cost-centers', array('name' => 'کارگاه', 'project_id' => $project['id']));
        $this->ids['cost_center'] = $cc->get_data()['records']['cost_centers'][0]['id'];
        $cp = $this->request('POST', '/counterparties', array('kind' => 'supplier', 'name' => 'تأمین‌کننده آزمایشی'));
        $this->ids['counterparty'] = $cp->get_data()['records']['counterparties'][0]['id'];
        $this->ids['account'] = (string) Akph_Accounts::by_code('41302')->id;
        $this->login('guest');
    }

    /** [method, path, allowed role keys] */
    private function routes() {
        $all = array('admin', 'senior', 'accountant', 'pm');
        $office = array('admin', 'senior', 'accountant');
        $top = array('admin', 'senior');
        $p = $this->ids['project'];
        $e = $this->ids['entry'];
        return array(
            array('GET', '/me', $all),
            array('GET', '/projects', $all),
            array('POST', '/projects', $top),
            array('GET', '/projects/managers', $top),
            array('GET', "/projects/{$p}", $all),
            array('POST', "/projects/{$p}", $all),
            array('PATCH', "/projects/{$p}", $all),
            array('GET', '/cost-centers', $all),
            array('POST', '/cost-centers', $office),
            array('POST', '/cost-centers/' . $this->ids['cost_center'], $office),
            array('GET', '/counterparties', $all),
            array('POST', '/counterparties', $office),
            array('POST', '/counterparties/' . $this->ids['counterparty'], $office),
            array('GET', '/accounts', $office),
            array('POST', '/accounts', $office),
            array('POST', '/accounts/' . $this->ids['account'], $office),
            array('GET', '/journal-entries', $office),
            array('POST', '/journal-entries', $office),
            array('GET', "/journal-entries/{$e}", $office),
            array('POST', "/journal-entries/{$e}", $office),
            array('POST', "/journal-entries/{$e}/post", $office),
            array('POST', "/journal-entries/{$e}/reject", $office),
            array('POST', "/journal-entries/{$e}/reverse", $office),
            array('GET', '/reports/trial-balance', $all),
            array('GET', '/reports/ledger', $all),
            array('GET', '/audit', $office),
            array('GET', '/account', $all),
            array('POST', '/account/profile', $all),
            array('POST', '/account/email', $all),
            array('POST', '/account/password', $all),
            array('POST', '/account/avatar', $all),
            array('DELETE', '/account/avatar', $all),
            array('GET', '/account/sessions', $all),
            array('POST', '/account/sessions/logout-others', $all),
        );
    }

    public function test_every_route_for_every_role_guest_and_user_without_role() {
        $checked = 0;
        foreach ($this->routes() as $route) {
            list($method, $path, $allowed) = $route;
            foreach (array('admin', 'senior', 'accountant', 'pm', 'norole', 'guest') as $who) {
                $this->login($who);
                // Empty bodies: the permission check runs before any validation or write.
                $response = $this->request($method, $path, $method === 'GET' ? null : array());
                $code = $this->errorCode($response);
                $label = "{$method} {$path} as {$who}";
                if ($who === 'guest') {
                    $this->assertSame(401, $response->get_status(), $label);
                    $this->assertSame('akph_unauthorized', $code, $label);
                } elseif ($who === 'norole') {
                    $this->assertSame(403, $response->get_status(), $label);
                    $this->assertSame('akph_no_portal_role', $code, $label);
                } elseif (in_array($who, $allowed, true)) {
                    $this->assertNotContains($code, self::PERMISSION_CODES, $label . ' should pass the permission check');
                } else {
                    $this->assertSame(403, $response->get_status(), $label);
                    $this->assertSame('akph_role_forbidden', $code, $label);
                }
                $checked++;
            }
        }
        $this->assertSame(count($this->routes()) * 6, $checked);
    }

    public function test_nonce_is_required() {
        $this->login('admin');
        $missing = $this->request('GET', '/me', null, array('X-WP-Nonce' => null));
        $this->assertStatus(403, $missing);
        $this->assertSame('akph_invalid_nonce', $this->errorCode($missing));
        $wrong = $this->request('GET', '/me', null, array('X-WP-Nonce' => 'deadbeef00'));
        $this->assertSame('akph_invalid_nonce', $this->errorCode($wrong));
        $post = $this->request('POST', '/counterparties', array('kind' => 'other', 'name' => 'x'), array('X-WP-Nonce' => null));
        $this->assertSame('akph_invalid_nonce', $this->errorCode($post));
        $this->assertSame(0, $this->count_rows('counterparties', "name = 'x'"));
    }

    public function test_every_registered_route_has_a_real_permission_callback() {
        $routes = rest_get_server()->get_routes('akph/v1');
        $this->assertNotEmpty($routes);
        // The namespace index WordPress adds (GET /akph/v1) is guarded by a filter instead.
        $this->login('guest');
        $this->assertSame(401, $this->request('GET', '')->get_status());
        $this->login('norole');
        $this->assertSame(403, $this->request('GET', '')->get_status());
        $this->login('pm');
        $this->assertSame(200, $this->request('GET', '')->get_status());
        unset($routes['/akph/v1']);
        foreach ($routes as $path => $handlers) {
            foreach ($handlers as $handler) {
                if (!is_array($handler) || !isset($handler['callback'])) {
                    continue;
                }
                $this->assertArrayHasKey('permission_callback', $handler, $path);
                $this->assertInstanceOf('Closure', $handler['permission_callback'], $path);
                $this->assertNotSame('__return_true', $handler['permission_callback'], $path);
            }
        }
    }

    public function test_me_describes_the_session() {
        $this->login('pm');
        $me = $this->request('GET', '/me')->get_data();
        $this->assertSame('مدیر پروژه', $me['role']);
        $this->assertSame((string) self::$users['pm'], $me['id']);
        $this->assertSame(array($this->ids['project']), $me['project_ids']);
        $this->assertSame('toman', $me['currency']);
        $this->assertSame(Akph_Jalali::fiscal_year(Akph_Jalali::today_iso()), $me['fiscal_year']);
        $this->login('accountant');
        $me = $this->request('GET', '/me')->get_data();
        $this->assertSame('حسابدار', $me['role']);
        $this->assertTrue($me['view_all']);
        $this->assertSame(array(), $me['project_ids']);
    }

    public function test_responses_are_not_cacheable() {
        $this->login('admin');
        $request = new WP_REST_Request('GET', '/akph/v1/me');
        $request->set_header('X-WP-Nonce', wp_create_nonce('wp_rest'));
        $response = apply_filters('rest_post_dispatch', rest_get_server()->dispatch($request), rest_get_server(), $request);
        $headers = $response->get_headers();
        $this->assertStringContainsString('no-store', $headers['Cache-Control']);
    }

    public function test_project_manager_scope() {
        $this->login('pm2');
        $this->assertSame(array(), $this->request('GET', '/projects')->get_data()['projects']);
        $this->assertStatus(404, $this->request('GET', '/projects/' . $this->ids['project']));
        $this->assertSame(array(), $this->request('GET', '/cost-centers')->get_data()['cost_centers']);
        $this->assertSame(array(), $this->request('GET', '/counterparties')->get_data()['counterparties']);
        $denied = $this->request('GET', '/reports/trial-balance', null, array(), array('project_id' => $this->ids['project']));
        $this->assertStatus(403, $denied);

        $this->login('pm');
        $projects = $this->request('GET', '/projects')->get_data()['projects'];
        $this->assertCount(1, $projects);
        $this->assertSame(array('exec'), $projects[0]['editable']);
        $centers = $this->request('GET', '/cost-centers')->get_data()['cost_centers'];
        $this->assertCount(1, $centers);
        $tb = $this->request('GET', '/reports/trial-balance')->get_data();
        $this->assertTrue($tb['partial']);
    }
}
