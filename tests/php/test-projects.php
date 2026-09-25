<?php
/** Projects: field groups per role, project-manager scope, versions; cost centers and counterparties. */
class Test_Akph_Projects extends Akph_Test_Case {
    public function test_create_requires_create_capability_and_issues_a_code() {
        $this->login('accountant');
        $this->assertSame('akph_role_forbidden', $this->errorCode($this->request('POST', '/projects', array('name' => 'x', 'client_name' => 'y'))));
        $this->login('senior');
        $response = $this->request('POST', '/projects', array('name' => 'برج آزمایشی', 'client_name' => 'کارفرما', 'budget' => 5000000000, 'manager_user_id' => self::$users['pm']));
        $this->assertStatus(201, $response);
        $p = $response->get_data()['records']['projects'][0];
        $this->assertMatchesRegularExpression('/^PRJ-1[34]\d\d-00001$/', $p['code']);
        $this->assertSame(5000000000, $p['budget']);
        $this->assertSame((string) self::$users['pm'], $p['manager_user_id']);
        $this->assertSame(1, $p['version']);
    }

    public function test_field_groups() {
        $p = $this->make_project(array('manager_user_id' => self::$users['pm']));
        // Project manager: execution fields of own project only.
        $this->login('pm');
        $ok = $this->request('POST', "/projects/{$p['id']}", array('version' => 1, 'physical_progress' => 35, 'status' => 'mobilizing', 'start_date' => '2026-04-01'));
        $this->assertStatus(200, $ok);
        $this->assertSame(35, $ok->get_data()['records']['projects'][0]['physical_progress']);
        $denied = $this->request('POST', "/projects/{$p['id']}", array('version' => 2, 'budget' => 1));
        $this->assertStatus(403, $denied);
        $this->assertSame('akph_field_forbidden', $this->errorCode($denied));
        $this->assertSame(array('budget'), $denied->get_data()['data']['fields']);
        $this->login('pm2');
        $this->assertStatus(404, $this->request('POST', "/projects/{$p['id']}", array('version' => 2, 'physical_progress' => 1)));

        // Accountant: the manual summary only.
        $this->login('accountant');
        $fin = $this->request('POST', "/projects/{$p['id']}", array('version' => 2, 'manual_revenue' => 120000000000, 'manual_cost' => 90000000000));
        $this->assertStatus(200, $fin);
        $this->assertSame(120000000000, $fin->get_data()['records']['projects'][0]['manual_summary']['revenue']);
        $this->assertStatus(403, $this->request('POST', "/projects/{$p['id']}", array('version' => 3, 'name' => 'نام دیگر')));

        // Unknown fields are refused; derived keys are ignored.
        $this->login('senior');
        $this->assertStatus(400, $this->request('POST', "/projects/{$p['id']}", array('version' => 3, 'hacker' => 1)));
        $ignored = $this->request('POST', "/projects/{$p['id']}", array('version' => 3, 'id' => '999', 'code' => 'X', 'name' => 'نام تازه'));
        $this->assertStatus(200, $ignored);
        $this->assertSame($p['code'], $ignored->get_data()['records']['projects'][0]['code']);
        $this->assertStatus(409, $this->request('POST', "/projects/{$p['id']}", array('version' => 3, 'name' => 'کهنه')));
    }

    public function test_manager_must_have_the_project_manager_role_and_amounts_are_integers() {
        $this->login('senior');
        $this->assertStatus(400, $this->request('POST', '/projects', array('name' => 'x', 'client_name' => 'y', 'manager_user_id' => self::$users['accountant'])));
        $this->assertStatus(400, $this->request('POST', '/projects', array('name' => 'x', 'client_name' => 'y', 'budget' => 10.5)));
        $this->assertStatus(400, $this->request('POST', '/projects', array('name' => 'x', 'client_name' => 'y', 'budget' => -5)));
        $this->assertStatus(400, $this->request('POST', '/projects', array('name' => 'x', 'client_name' => 'y', 'budget' => '1,000')));
        $this->assertSame(0, $this->count_rows('projects'));
    }

    public function test_cost_centers_and_counterparties() {
        $p = $this->make_project(array('manager_user_id' => self::$users['pm']));
        $this->login('accountant');
        $cc = $this->request('POST', '/cost-centers', array('name' => 'کارگاه اصلی', 'project_id' => $p['id'], 'budget' => 1000));
        $this->assertStatus(201, $cc);
        $center = $cc->get_data()['records']['cost_centers'][0];
        $this->assertMatchesRegularExpression('/^CC-1\d{3}-00001$/', $center['code']);
        $hq = $this->request('POST', '/cost-centers', array('name' => 'دفتر مرکزی', 'type' => 'headquarters', 'code' => 'HQ-01'));
        $this->assertStatus(201, $hq);
        $this->assertStatus(409, $this->request('POST', '/cost-centers', array('name' => 'تکراری', 'code' => 'HQ-01')));
        $this->assertStatus(409, $this->request('POST', "/cost-centers/{$center['id']}", array('version' => 5, 'name' => 'x')));

        $bad_sheba = $this->request('POST', '/counterparties', array('kind' => 'supplier', 'name' => 'تأمین‌کننده', 'sheba' => 'IR000000000000000000000000'));
        $this->assertStatus(400, $bad_sheba);
        $client = $this->request('POST', '/counterparties', array('kind' => 'client', 'name' => 'کارفرمای نمونه'));
        $this->assertStatus(201, $client);
        $client = $client->get_data()['records']['counterparties'][0];

        // The project manager sees the cost center of the own project, not headquarters.
        $this->login('pm');
        $this->assertSame(array($center['id']), array_column($this->request('GET', '/cost-centers')->get_data()['cost_centers'], 'id'));
        $this->assertSame('akph_role_forbidden', $this->errorCode($this->request('POST', '/cost-centers', array('name' => 'x'))));

        // Linking the client to the project; renaming the client renames it on the project.
        $this->login('senior');
        $linked = $this->request('POST', "/projects/{$p['id']}", array('version' => 1, 'client_id' => $client['id']));
        $this->assertStatus(200, $linked);
        $this->login('accountant');
        $renamed = $this->request('POST', "/counterparties/{$client['id']}", array('version' => 1, 'name' => 'کارفرمای تازه'));
        $this->assertStatus(200, $renamed);
        $this->assertSame('کارفرمای تازه', $renamed->get_data()['records']['projects'][0]['client_name']);
        $this->login('pm');
        $this->assertSame(array($client['id']), array_column($this->request('GET', '/counterparties')->get_data()['counterparties'], 'id'));
    }

    public function test_manual_cost_center_code_may_not_look_like_an_issued_number() {
        $this->login('accountant');
        foreach (array('CC-1405-00001', 'CC-1405-7', 'PRJ-1404-12', 'cc-1405-00002', 'ABC-2026-1') as $code) {
            $response = $this->request('POST', '/cost-centers', array('name' => 'کد دستی', 'code' => $code));
            $this->assertStatus(400, $response, $code);
            $this->assertSame('code', $response->get_data()['data']['field'], $code);
        }
        $this->assertSame(0, $this->count_rows('cost_centers'));
        foreach (array('SITE-01', 'CC-1405', 'CC1405-1', 'HQ-2026-A', '1405-0001') as $code) {
            $this->assertStatus(201, $this->request('POST', '/cost-centers', array('name' => 'کد دستی ' . $code, 'code' => $code)), $code);
        }
        // The issued number itself is kept on edits; another record cannot take that shape.
        $auto = $this->request('POST', '/cost-centers', array('name' => 'شماره خودکار'))->get_data()['records']['cost_centers'][0];
        $this->assertMatchesRegularExpression('/^CC-\d{4}-\d{5}$/', $auto['code']);
        $kept = $this->request('POST', "/cost-centers/{$auto['id']}", array('version' => $auto['version'], 'code' => $auto['code'], 'name' => 'نام تازه'));
        $this->assertStatus(200, $kept);
        $manual = $this->request('GET', '/cost-centers')->get_data()['cost_centers'][0];
        $renamed = $this->request('POST', "/cost-centers/{$manual['id']}", array('version' => $manual['version'], 'code' => 'CC-1405-00099'));
        $this->assertStatus(400, $renamed);
        $this->assertTrue(Akph_Master_Data::looks_auto_numbered('CC-1405-00001'));
        $this->assertFalse(Akph_Master_Data::looks_auto_numbered("CC-1405-1\n"));
    }

    public function test_chart_of_accounts_rules() {
        $this->login('accountant');
        $group = $this->request('POST', '/accounts', array('code' => '7', 'title' => 'گروه آزمایشی', 'level' => 'group', 'nature' => 'debit'));
        $this->assertStatus(201, $group);
        $this->assertFalse($group->get_data()['records']['accounts'][0]['postable']);
        $this->assertStatus(400, $this->request('POST', '/accounts', array('code' => '7101', 'title' => 'پرش سطح', 'level' => 'subsidiary', 'parent_code' => '7')));
        $this->assertStatus(201, $this->request('POST', '/accounts', array('code' => '71', 'title' => 'کل', 'level' => 'general', 'parent_code' => '7')));
        $sub = $this->request('POST', '/accounts', array('code' => '711', 'title' => 'معین', 'level' => 'subsidiary', 'parent_code' => '71', 'nature' => 'debit'));
        $this->assertTrue($sub->get_data()['records']['accounts'][0]['postable']);
        $this->assertStatus(409, $this->request('POST', '/accounts', array('code' => '711', 'title' => 'تکراری', 'level' => 'subsidiary', 'parent_code' => '71')));
        $this->login('pm');
        $this->assertSame('akph_role_forbidden', $this->errorCode($this->request('GET', '/accounts')));
    }
}
