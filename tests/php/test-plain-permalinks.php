<?php
/**
 * 0.7.1: plain permalinks. The REST address is /index.php?rest_route=/akph/v1/... and WordPress returns
 * `rest_route` (and its global switches such as _locale) among the query parameters. Strict query checks must not
 * reject them as unknown fields: every GET of contracts, statements and print signatures answers 200, every other
 * parameterless GET route of the namespace never answers akph_unknown_field for them, and a real unknown field is still rejected.
 */
class Test_Akph_Plain_Permalinks extends Akph_Test_Case {
    /** @var string */
    private $today;

    public function set_up() {
        parent::set_up();
        delete_option(Akph_Treasury::OPTION);
        $this->install_chart();
        $this->today = Akph_Jalali::today_iso();
    }

    private function ok($who, $method, $path, $body = array(), $status = null) {
        $this->login($who);
        $response = $this->request($method, $path, $method === 'GET' ? null : $body);
        $this->assertContains($response->get_status(), $status ? array($status) : array(200, 201), "{$method} {$path}: " . wp_json_encode($response->get_data(), JSON_UNESCAPED_UNICODE));
        return $response->get_data();
    }

    /** GET as plain permalinks send it: rest_route (plus `$extra`) in the query string. */
    private function plain_get($who, $path, array $extra = array()) {
        $this->login($who);
        return $this->request('GET', $path, null, array(), array_merge(array('rest_route' => '/akph/v1' . $path), $extra));
    }

    public function test_contract_statement_and_signature_reads_accept_rest_route() {
        $project = $this->make_project(array('name' => 'پروژه یک', 'manager_user_id' => self::$users['pm']));
        $client = $this->ok('accountant', 'POST', '/counterparties', array('kind' => 'client', 'name' => 'کارفرما'), 201)['records']['counterparties'][0];
        $c = $this->ok('accountant', 'POST', '/contracts', array('kind' => 'client', 'contract_no' => 'ک-۱', 'title' => 'سازه', 'project_id' => $project['id'], 'counterparty_id' => $client['id'],
            'lines' => array(array('description' => 'بتن', 'unit' => 'مترمکعب', 'quantity' => '10', 'rate' => 1000000))), 201)['records']['contracts'][0];
        $this->ok('senior', 'POST', "/contracts/{$c['id']}/approve", array('version' => 1));
        $s = $this->ok('pm', 'POST', '/client-statements', array('contract_id' => $c['id'], 'title' => 'موقت ۱', 'period_start' => $this->today, 'period_end' => $this->today,
            'lines' => array(array('contract_line_id' => $c['lines'][0]['id'], 'quantity' => '2'))), 201)['records']['statements'][0];

        $reads = array(
            array('/contracts', array()),
            array('/contracts', array('kind' => 'client')),
            array('/contracts', array('kind' => 'subcontract', 'project_id' => $project['id'])),
            array('/contracts/guarantees-due', array()),
            array("/contracts/{$c['id']}", array()),
            array('/reports/contracts', array('project_id' => $project['id'])),
            array('/statements', array()),
            array('/statements', array('kind' => 'client')),
            array("/statements/{$s['id']}", array()),
            array('/print/signatures', array('entity_type' => 'client_statement', 'entity_id' => $s['id'])),
            array('/report-settings', array()),
        );
        foreach (array('accountant', 'pm', 'senior', 'admin') as $who) {
            foreach ($reads as $read) {
                list($path, $query) = $read;
                $response = $this->plain_get($who, $path, $query);
                $this->assertStatus(200, $response, "GET ?rest_route={$path} as {$who}");
            }
        }
        // The other WordPress globals are ignored too; a real unknown field is still an error.
        $globals = array('_locale' => 'user', '_wpnonce' => 'x', '_envelope' => '', '_fields' => '', '_embed' => '', '_jsonp' => '', '_method' => 'GET');
        foreach (array('/contracts', '/statements') as $path) {
            $this->assertStatus(200, $this->plain_get('accountant', $path, array('_locale' => 'user')), "{$path} with _locale");
        }
        foreach (array_keys($globals) as $key) {
            $this->assertTrue(Akph_Input::is_wp_global($key), $key);
        }
        $bad = $this->plain_get('accountant', '/contracts', array('foo' => '1'));
        $this->assertStatus(400, $bad);
        $this->assertSame('akph_unknown_field', $this->errorCode($bad));
        $bad = $this->plain_get('accountant', '/print/signatures', array('entity_type' => 'client_statement', 'entity_id' => $s['id'], 'amount' => '1'));
        $this->assertSame('akph_unknown_field', $this->errorCode($bad));
    }

    public function test_no_get_route_rejects_rest_route() {
        $this->make_project(array('name' => 'پروژه', 'manager_user_id' => self::$users['pm']));
        $routes = rest_get_server()->get_routes('akph/v1');
        $checked = 0;
        foreach ($routes as $route => $handlers) {
            if (strpos($route, '(?P<') !== false) {
                continue;
            }
            $get = false;
            foreach ($handlers as $h) {
                $get = $get || !empty($h['methods']['GET']);
            }
            if (!$get) {
                continue;
            }
            $path = substr($route, strlen('/akph/v1'));
            foreach (array('admin', 'pm') as $who) {
                $response = $this->plain_get($who, $path);
                // A route may still need its own parameters (e.g. account_code of the ledger); rest_route is never the problem.
                $this->assertNotSame('akph_unknown_field', $this->errorCode($response), "GET ?rest_route={$path} as {$who}: " . wp_json_encode($response->get_data(), JSON_UNESCAPED_UNICODE));
            }
            $checked++;
        }
        $this->assertGreaterThan(20, $checked, 'every parameterless GET route of akph/v1 was called');
    }
}
