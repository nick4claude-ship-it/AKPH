<?php
/**
 * 0.8.0: payroll through the REST routes: personal data only for the accountant, senior manager and system
 * administrator (never a project manager); timesheets → calculation on the server (proration, overtime, insurance
 * of both sides, progressive income tax, loan) → accountant approval (not the calculator) → senior manager approval
 * (not the previous approver) → PAYROLL_APPROVED (salary cost per cost center; salaries, insurance and payroll tax
 * payable in separate accounts) and payment requests in the treasury; the books balanced.
 */
class Test_Akph_Payroll extends Akph_Test_Case {
    /** @var array */
    private $project;
    /** @var array */
    private $site_center;
    /** @var array */
    private $hq_center;

    public function set_up() {
        parent::set_up();
        delete_option(Akph_Payroll::OPTION);
        delete_option(Akph_Treasury::OPTION);
        $this->install_chart();
        $this->project = $this->make_project(array('name' => 'پروژه یک', 'manager_user_id' => self::$users['pm']));
        $this->site_center = $this->ok('accountant', 'POST', '/cost-centers', array('name' => 'کارگاه', 'project_id' => $this->project['id'], 'type' => 'project_site'), 201)['records']['cost_centers'][0];
        $this->hq_center = $this->ok('accountant', 'POST', '/cost-centers', array('name' => 'ستاد', 'type' => 'headquarters'), 201)['records']['cost_centers'][0];
    }

    private function ok($who, $method, $path, $body = array(), $status = null) {
        $this->login($who);
        $response = $this->request($method, $path, $method === 'GET' ? null : $body);
        if ($status !== null) {
            $this->assertStatus($status, $response, "{$method} {$path} as {$who}");
        } else {
            $this->assertContains($response->get_status(), array(200, 201), "{$method} {$path} as {$who}: " . wp_json_encode($response->get_data(), JSON_UNESCAPED_UNICODE));
        }
        return $response->get_data();
    }

    private function fails($who, $method, $path, $body, $status, $code = null) {
        $this->login($who);
        $response = $this->request($method, $path, $body);
        $this->assertStatus($status, $response, "{$method} {$path} as {$who}");
        if ($code !== null) {
            $this->assertSame($code, $this->errorCode($response));
        }
    }

    private function entry_lines($entry_id) {
        global $wpdb;
        $out = array();
        foreach ((array) $wpdb->get_results($wpdb->prepare('SELECT account_code, debit, credit FROM ' . Akph_Schema::table('ledger_lines') . ' WHERE entry_id = %d', $entry_id)) as $l) {
            $out[$l->account_code] = (isset($out[$l->account_code]) ? $out[$l->account_code] : 0) + (int) $l->debit - (int) $l->credit;
        }
        return $out;
    }

    public function test_income_tax_is_progressive() {
        $b = Akph_Payroll::default_brackets();
        $this->assertSame(0, Akph_Payroll::income_tax(240000000, $b));
        $this->assertSame(6000000, Akph_Payroll::income_tax(300000000, $b));
        $this->assertSame(6000000 + 12000000 + 24000000, Akph_Payroll::income_tax(500000000, $b));
    }

    public function test_personal_data_scope() {
        $this->fails('pm', 'GET', '/payroll', null, 403);
        $this->fails('pm', 'POST', '/employees', array('full_name' => 'x', 'cost_center_id' => $this->site_center['id']), 403);
        $this->fails('accountant', 'POST', '/employees', array('full_name' => 'x', 'cost_center_id' => $this->site_center['id'], 'national_id' => '123'), 400);
        $this->fails('accountant', 'POST', '/employees', array('full_name' => 'x', 'cost_center_id' => $this->site_center['id'], 'sheba' => 'IR12'), 400);
        $e = $this->ok('accountant', 'POST', '/employees', array('full_name' => 'کارمند آزمون', 'cost_center_id' => $this->site_center['id'], 'national_id' => '0012345678', 'base_salary' => 100), 201)['records']['employees'][0];
        $this->assertSame($this->project['id'], $e['project_id'], 'project of the cost center');
        $this->assertSame('0012345678', $this->ok('senior', 'GET', '/payroll')['employees'][0]['national_id']);
        $this->assertSame('0012345678', $this->ok('admin', 'GET', '/payroll')['employees'][0]['national_id']);
    }

    public function test_calculation_approvals_entry_and_payment_requests() {
        $site = $this->ok('accountant', 'POST', '/employees', array(
            'full_name' => 'کارگر کارگاه', 'cost_center_id' => $this->site_center['id'], 'base_salary' => 300000000, 'housing_allowance' => 30000000,
            'food_allowance' => 20000000, 'child_allowance' => 0, 'loan_installment' => 10000000, 'other_deduction' => 1000000,
        ), 201)['records']['employees'][0];
        $hq = $this->ok('accountant', 'POST', '/employees', array('full_name' => 'کارمند ستاد', 'cost_center_id' => $this->hq_center['id'], 'base_salary' => 200000000, 'insured' => false), 201)['records']['employees'][0];
        $p = $this->ok('accountant', 'POST', '/payroll/periods', array('fiscal_year' => 1405, 'month' => 6), 201)['records']['payroll_periods'][0];
        $this->fails('accountant', 'POST', '/payroll/periods', array('fiscal_year' => 1405, 'month' => 6), 409);
        $this->fails('accountant', 'POST', "/payroll/periods/{$p['id']}/calculate", array('version' => 1), 422);
        $p = $this->ok('accountant', 'POST', "/payroll/periods/{$p['id']}/timesheets", array('version' => 1, 'timesheets' => array(
            array('employee_id' => $site['id'], 'work_days' => '30', 'overtime_hours' => '22'),
            array('employee_id' => $hq['id'], 'work_days' => '15'),
        )))['records']['payroll_periods'][0];
        $calc = $this->ok('accountant', 'POST', "/payroll/periods/{$p['id']}/calculate", array('version' => $p['version']));
        $p = $calc['records']['payroll_periods'][0];
        $slips = array_column($calc['records']['payslips'], null, 'employee_id');
        $s = $slips[$site['id']];
        // 300,000,000 ÷ 220 × 22 × 1.4 = 42,000,000 overtime.
        $this->assertSame(42000000, $s['overtime_pay']);
        $this->assertSame(300000000 + 30000000 + 20000000 + 42000000, $s['gross']);
        $this->assertSame((int) round(392000000 * 0.07), $s['worker_insurance']);
        $this->assertSame((int) round(392000000 * 0.23), $s['employer_insurance']);
        $this->assertSame(Akph_Payroll::income_tax(392000000 - 27440000, Akph_Payroll::default_brackets()), $s['income_tax']);
        $this->assertSame(10000000, $s['loan_deduction']);
        $this->assertSame($s['gross'] - $s['worker_insurance'] - $s['income_tax'] - 10000000 - 1000000, $s['net']);
        $h = $slips[$hq['id']];
        $this->assertSame(100000000, $h['gross'], 'prorated by 15 of 30 days');
        $this->assertSame(0, $h['worker_insurance'], 'not insured');
        $this->assertSame(0, $h['income_tax'], 'below the exempt band');

        // Separation of duties: the calculator does not approve; the accountant approver does not take the senior step.
        $this->fails('accountant', 'POST', "/payroll/periods/{$p['id']}/approve", array('version' => $p['version']), 403, 'akph_segregation_of_duties');
        $p = $this->ok('accountant2', 'POST', "/payroll/periods/{$p['id']}/approve", array('version' => $p['version']))['records']['payroll_periods'][0];
        $this->assertSame('finance_approved', $p['status']);
        $this->fails('accountant2', 'POST', "/payroll/periods/{$p['id']}/approve", array('version' => $p['version']), 403, 'akph_segregation_of_duties');
        $this->fails('pm', 'POST', "/payroll/periods/{$p['id']}/approve", array('version' => $p['version']), 403);
        $ids = array_column($this->ok('senior', 'GET', '/approvals')['items'], 'id');
        $this->assertContains('payroll:' . $p['id'], $ids);
        $done = $this->ok('senior', 'POST', "/payroll/periods/{$p['id']}/approve", array('version' => $p['version']));
        $p = $done['records']['payroll_periods'][0];
        $this->assertSame('approved', $p['status']);
        $lines = $this->entry_lines($p['entry']['id']);
        $this->assertSame($s['cost'] - 1000000, $lines['51201'], 'site salary cost (project, cost center)');
        $this->assertSame($h['cost'], $lines['61101'], 'headquarters salary cost');
        $this->assertSame(-($s['net'] + $h['net']), $lines['21501']);
        $this->assertSame(-($s['worker_insurance'] + $s['employer_insurance']), $lines['21201']);
        $this->assertSame(-$s['income_tax'], $lines['21203']);
        $this->assertSame(-10000000, $lines['11303']);
        $this->assertSame(0, array_sum($lines));
        $requests = $done['records']['payment_requests'];
        $this->assertSame(array('payroll', 'insurance', 'tax_payroll'), array_column($requests, 'payable_type'));
        $this->assertSame(array('approved', 'approved', 'approved'), array_column($requests, 'status'));
        $this->assertSame($s['net'] + $h['net'], $requests[0]['amount']);
        $this->fails('senior', 'POST', "/payroll/periods/{$p['id']}/timesheets", array('version' => $p['version'], 'timesheets' => array(array('employee_id' => $hq['id'], 'work_days' => '1'))), 409);
    }
}
