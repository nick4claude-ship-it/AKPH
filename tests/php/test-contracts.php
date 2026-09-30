<?php
/**
 * 0.7.0: contracts and progress statements through the REST routes with the four portal roles: approval chains
 * and separation of duties by user id, project manager scope, server-computed amounts and quantities, postings
 * (CLIENT_STATEMENT_APPROVED, SUBCONTRACTOR_STATEMENT_APPROVED), receipts and payments only through the treasury,
 * void with reversal, idempotency, version conflicts, rollback, and the whole ledger balanced at the end.
 */
class Test_Akph_Contracts extends Akph_Test_Case {
    /** @var array */
    private $project;
    /** @var array */
    private $project2;
    /** @var array */
    private $client;
    /** @var array */
    private $sub;
    /** @var array */
    private $center;
    /** @var array */
    private $bank;
    /** @var string */
    private $today;

    public function set_up() {
        parent::set_up();
        delete_option(Akph_Petty_Cash::OPTION);
        delete_option(Akph_Treasury::OPTION);
        $this->install_chart();
        $this->project = $this->make_project(array('name' => 'پروژه یک', 'manager_user_id' => self::$users['pm']));
        $this->project2 = $this->make_project(array('name' => 'پروژه دو', 'manager_user_id' => self::$users['pm2']));
        $this->today = Akph_Jalali::today_iso();
        $this->client = $this->ok('accountant', 'POST', '/counterparties', array('kind' => 'client', 'name' => 'کارفرمای آزمایشی'), 201)['records']['counterparties'][0];
        $this->sub = $this->ok('accountant', 'POST', '/counterparties', array('kind' => 'subcontractor', 'name' => 'پیمانکار آزمایشی'), 201)['records']['counterparties'][0];
        $this->center = $this->ok('accountant', 'POST', '/cost-centers', array('name' => 'کارگاه یک', 'project_id' => $this->project['id'], 'type' => 'project_site'), 201)['records']['cost_centers'][0];
        $this->bank = $this->ok('accountant', 'POST', '/treasury/accounts', array('kind' => 'bank', 'title' => 'بانک', 'bank_name' => 'بانک نمونه'), 201)['records']['treasury_accounts'][0];
    }

    // ------------------------------------------------------------------ helpers

    private function call($who, $method, $path, $body = null, array $headers = array(), array $query = array()) {
        $this->login($who);
        return $this->request($method, $path, $body, $headers, $query);
    }

    private function ok($who, $method, $path, $body = array(), $status = null) {
        $response = $this->call($who, $method, $path, $method === 'GET' ? null : $body);
        if ($status !== null) {
            $this->assertStatus($status, $response, "{$method} {$path} as {$who}");
        } else {
            $this->assertContains($response->get_status(), array(200, 201), "{$method} {$path} as {$who}: " . wp_json_encode($response->get_data(), JSON_UNESCAPED_UNICODE));
        }
        return $response->get_data();
    }

    private function fails($who, $method, $path, $body, $status, $code = null) {
        $response = $this->call($who, $method, $path, $body);
        $this->assertStatus($status, $response, "{$method} {$path} as {$who}");
        if ($code !== null) {
            $this->assertSame($code, $this->errorCode($response), "{$method} {$path} as {$who}");
        }
        return $response->get_data();
    }

    private function contract($id) {
        return Akph_Contracts::shape(Akph_Db::find(Akph_Schema::table('contracts'), $id));
    }

    private function statement($id) {
        return Akph_Statements::shape(Akph_Db::find(Akph_Schema::table('statements'), $id));
    }

    private function entry_lines($entry_id) {
        global $wpdb;
        $out = array();
        foreach ((array) $wpdb->get_results($wpdb->prepare('SELECT account_code, debit, credit FROM ' . Akph_Schema::table('ledger_lines') . ' WHERE entry_id = %d', $entry_id)) as $l) {
            $out[$l->account_code] = (isset($out[$l->account_code]) ? $out[$l->account_code] : 0) + (int) $l->debit - (int) $l->credit;
        }
        return $out;
    }

    private function ledger_sum($where) {
        global $wpdb;
        return (int) $wpdb->get_var('SELECT COALESCE(SUM(l.debit) - SUM(l.credit), 0) FROM ' . Akph_Schema::table('ledger_lines') . ' l JOIN ' . Akph_Schema::table('ledger_entries') . " e ON e.id = l.entry_id WHERE e.status = 'posted' AND {$where}");
    }

    private function assert_books_balance() {
        global $wpdb;
        $this->assertSame(0, $this->ledger_sum('1=1'), 'the whole ledger is balanced');
        $bad = $wpdb->get_var('SELECT COUNT(*) FROM (SELECT entry_id FROM ' . Akph_Schema::table('ledger_lines') . ' GROUP BY entry_id HAVING SUM(debit) <> SUM(credit)) x');
        $this->assertSame('0', (string) $bad, 'every entry is balanced');
        foreach ((array) $wpdb->get_results('SELECT id FROM ' . Akph_Schema::table('treasury_accounts')) as $a) {
            $this->assertGreaterThanOrEqual(0, Akph_Posting::balance('tre:' . $a->id));
        }
    }

    private function approval_ids($who) {
        return array_map(function ($i) {
            return $i['id'];
        }, $this->ok($who, 'GET', '/approvals')['items']);
    }

    private function client_contract(array $extra = array()) {
        $data = $this->ok('accountant', 'POST', '/contracts', array_merge(array(
            'kind' => 'client',
            'contract_no' => 'ق-۱۲۳',
            'title' => 'قرارداد اجرای سازه',
            'project_id' => $this->project['id'],
            'counterparty_id' => $this->client['id'],
            'start_date' => $this->today,
            'duration_days' => 365,
            'advance_pct' => '10',
            'retention_pct' => '5',
            'insurance_pct' => '5',
            'tax_pct' => '3',
            'lines' => array(
                array('code' => '010101', 'description' => 'بتن‌ریزی', 'unit' => 'مترمکعب', 'quantity' => '1000', 'rate' => 5000000),
                array('code' => '020202', 'description' => 'آرماتوربندی', 'unit' => 'کیلوگرم', 'quantity' => '2000.5', 'rate' => 300000),
            ),
        ), $extra), 201);
        return $data['records']['contracts'][0];
    }

    private function subcontract(array $extra = array()) {
        $data = $this->ok('accountant', 'POST', '/contracts', array_merge(array(
            'kind' => 'subcontract',
            'contract_no' => 'پ-۷',
            'title' => 'قرارداد قالب‌بندی',
            'project_id' => $this->project['id'],
            'cost_center_id' => $this->center['id'],
            'counterparty_id' => $this->sub['id'],
            'trade_type' => 'قالب‌بندی',
            'advance_pct' => '20',
            'retention_pct' => '10',
            'tax_pct' => '3',
            'lines' => array(
                array('description' => 'قالب‌بندی دیوار', 'unit' => 'مترمربع', 'quantity' => '500', 'rate' => 800000),
                array('description' => 'قالب‌بندی سقف', 'unit' => 'مترمربع', 'quantity' => '250.75', 'rate' => 1000000),
            ),
        ), $extra), 201);
        return $data['records']['contracts'][0];
    }

    private function receive($who, array $body, $approver) {
        $rec = $this->ok($who, 'POST', '/receipts', array_merge(array('account_id' => $this->bank['id'], 'method' => 'transfer', 'tracking' => 'T'), $body), 201)['records']['receipts'][0];
        return $this->ok($approver, 'POST', "/receipts/{$rec['id']}/approve", array('version' => $rec['version']));
    }

    // ------------------------------------------------------------------ tests

    public function test_client_contract_statement_and_receipt_with_four_roles() {
        // Contract: created by the accountant; the project manager may not create one; senior manager approves.
        $this->fails('pm', 'POST', '/contracts', array('kind' => 'client', 'contract_no' => 'x', 'title' => 'x', 'project_id' => $this->project['id'], 'counterparty_id' => $this->client['id'], 'lines' => array()), 403);
        $this->fails('accountant', 'POST', '/contracts', array('kind' => 'client', 'contract_no' => 'x', 'title' => 'x', 'project_id' => $this->project['id'], 'counterparty_id' => $this->sub['id'], 'lines' => array(array('description' => 'a', 'unit' => 'b', 'quantity' => '1', 'rate' => 1))), 400);
        $this->fails('accountant', 'POST', '/contracts', array('kind' => 'client', 'contract_no' => 'x', 'title' => 'x', 'project_id' => $this->project['id'], 'counterparty_id' => $this->client['id'], 'amount' => 5, 'lines' => array(array('description' => 'a', 'unit' => 'b', 'quantity' => '1', 'rate' => 1))), 400, 'akph_unknown_field');
        $c = $this->client_contract();
        $this->assertMatchesRegularExpression('/^CNT-\d{4}-\d{5}$/', $c['number']);
        // 1000 × 5,000,000 + 2000.5 × 300,000 (quantity with decimals, amount computed by the server)
        $this->assertSame(5000000000 + 600150000, $c['amount']);
        $this->assertSame('2000.5', $c['lines'][1]['quantity']);
        $this->assertSame('pending', $c['status']);
        $this->assertSame(array('مدیر ارشد'), $c['chain']);
        $this->fails('accountant', 'POST', "/contracts/{$c['id']}/approve", array('version' => 1), 403, 'akph_segregation_of_duties');
        $this->fails('accountant2', 'POST', "/contracts/{$c['id']}/approve", array('version' => 1), 403, 'akph_forbidden');
        $this->fails('pm', 'POST', "/contracts/{$c['id']}/approve", array('version' => 1), 403, 'akph_forbidden');
        $this->assertContains('contract:' . $c['id'], $this->approval_ids('senior'));
        $this->assertNotContains('contract:' . $c['id'], $this->approval_ids('accountant2'));
        $this->fails('pm', 'POST', '/client-statements', array('contract_id' => $c['id'], 'title' => 'موقت ۱', 'period_start' => $this->today, 'period_end' => $this->today, 'lines' => array(array('contract_line_id' => $c['lines'][0]['id'], 'quantity' => '10'))), 422);
        $c = $this->ok('senior', 'POST', "/contracts/{$c['id']}/approve", array('version' => 1))['records']['contracts'][0];
        $this->assertSame('active', $c['status']);

        // Client advance: only through a treasury receipt that names the contract (≤ 10% of the contract).
        $this->assertSame(560015000, $c['advance_expected']);
        $this->fails('accountant', 'POST', '/receipts', array('amount' => 560015001, 'receipt_type' => 'advance', 'contract_id' => $c['id'], 'account_id' => $this->bank['id']), 422);
        $this->receive('accountant', array('amount' => 500000000, 'receipt_type' => 'advance', 'contract_id' => $c['id']), 'accountant2');
        $c = $this->contract($c['id']);
        $this->assertSame(500000000, $c['advance_amount']);
        $this->assertSame(500000000, $c['advance_remaining']);

        // Statement: the project manager measures; previous, rates and amounts are the server's.
        $l1 = $c['lines'][0]['id'];
        $l2 = $c['lines'][1]['id'];
        $body = array('contract_id' => $c['id'], 'title' => 'صورت‌وضعیت موقت ۱', 'period_start' => $this->today, 'period_end' => $this->today, 'lines' => array(array('contract_line_id' => $l1, 'quantity' => '100'), array('contract_line_id' => $l2, 'quantity' => '500.25')));
        $this->fails('pm', 'POST', '/client-statements', array_merge($body, array('lines' => array(array('contract_line_id' => $l1, 'quantity' => '1000.001')))), 422);
        $this->fails('pm', 'POST', '/client-statements', array_merge($body, array('lines' => array(array('contract_line_id' => $l1, 'quantity' => '1', 'amount' => 5)))), 400, 'akph_unknown_field');
        $this->fails('pm2', 'POST', '/client-statements', $body, 404);
        $this->fails('accountant', 'POST', '/client-statements', $body, 403);
        $key = wp_generate_uuid4();
        $this->login('pm');
        $first = $this->request('POST', '/client-statements', $body, array('Idempotency-Key' => $key));
        $this->assertStatus(201, $first);
        $again = $this->request('POST', '/client-statements', $body, array('Idempotency-Key' => $key));
        $this->assertSame('true', $again->get_headers()['Idempotency-Replayed']);
        $this->assertSame(1, $this->count_rows('statements'));
        $s = $first->get_data()['records']['statements'][0];
        $this->assertMatchesRegularExpression('/^STC-\d{4}-\d{5}$/', $s['number']);
        $work = 100 * 5000000 + 150075000; // 500.25 × 300,000
        $this->assertSame($work, $s['work_amount']);
        $this->assertSame(10, $s['vat_rate']);
        $this->assertSame((int) round($work * 0.10), $s['vat_amount']);
        $this->assertSame($work + $s['vat_amount'], $s['gross_amount']);
        $types = array_column($s['deductions'], 'amount', 'type');
        $this->assertSame((int) round($work * 0.10), $types['advance_payment'], 'advance on the amount before VAT');
        $this->assertSame((int) round($work * 0.05), $types['retention']);
        $this->assertSame((int) round($work * 0.05), $types['insurance']);
        $this->assertSame((int) round($work * 0.03), $types['tax']);
        $this->assertSame($s['gross_amount'] - array_sum($types), $s['net_amount']);
        $this->assertSame('draft', $s['status']);

        // A second statement cannot take more than what is left (pending quantities count).
        $this->fails('pm', 'POST', '/client-statements', array_merge($body, array('lines' => array(array('contract_line_id' => $l1, 'quantity' => '901')))), 422);

        // Flow: preparation by the project manager, consultant approval by someone else (not the creator).
        $s = $this->ok('pm', 'POST', "/statements/{$s['id']}/approve", array('version' => 1))['records']['statements'][0];
        $this->assertSame('prepared', $s['status']);
        $s = $this->ok('pm', 'POST', "/statements/{$s['id']}/approve", array('version' => 2))['records']['statements'][0];
        $this->assertSame('submitted_to_consultant', $s['status']);
        $this->fails('pm', 'POST', "/statements/{$s['id']}/approve", array('version' => 3), 403, 'akph_segregation_of_duties');
        $this->fails('accountant', 'POST', "/statements/{$s['id']}/approve", array('version' => 3), 403, 'akph_forbidden');
        $this->assertContains('client_statement:' . $s['id'], $this->approval_ids('senior'));
        $this->assertNotContains('client_statement:' . $s['id'], $this->approval_ids('pm'));
        $this->fails('senior', 'POST', "/statements/{$s['id']}/approve", array('version' => 2), 409);
        $s = $this->ok('senior', 'POST', "/statements/{$s['id']}/approve", array('version' => 3))['records']['statements'][0];
        $this->assertSame('approved_by_consultant', $s['status']);
        $this->assertSame(0, $this->contract($c['id'])['approved_amount'], 'nothing is approved before the employer');
        // Employer approval: the accountant, with the employer's approval number and date; not the senior manager again.
        $this->fails('senior', 'POST', "/statements/{$s['id']}/approve", array('version' => 4, 'employer_ref' => 'ک-۱', 'employer_date' => $this->today), 403, 'akph_segregation_of_duties');
        $this->fails('accountant', 'POST', "/statements/{$s['id']}/approve", array('version' => 4), 400);
        $items = $this->ok('accountant', 'GET', '/approvals')['items'];
        $item = array_values(array_filter($items, function ($i) use ($s) {
            return $i['id'] === 'client_statement:' . $s['id'];
        }))[0];
        $this->assertSame(array('employer_ref', 'employer_date'), $item['requires']);
        $done = $this->ok('accountant', 'POST', "/statements/{$s['id']}/approve", array('version' => 4, 'employer_ref' => 'ک-۱', 'employer_date' => $this->today));
        $s = $done['records']['statements'][0];
        $this->assertSame('approved_by_employer', $s['status']);
        $this->assertMatchesRegularExpression('/^ACC-\d{4}-\d{5}$/', $done['doc_number']);
        $lines = $this->entry_lines($s['entry']['id']);
        $this->assertSame($s['net_amount'], $lines['11201']);
        $this->assertSame($types['advance_payment'], $lines['21301']);
        $this->assertSame($types['retention'], $lines['11301']);
        $this->assertSame($types['insurance'], $lines['11302']);
        $this->assertSame($types['tax'], $lines['11305']);
        $this->assertSame(-$work, $lines['41101'], 'revenue without VAT');
        $this->assertSame(-$s['vat_amount'], $lines['21202']);
        $c = $this->contract($c['id']);
        $this->assertSame($work, $c['approved_amount']);
        $this->assertSame($s['net_amount'], $c['balance_due']);
        $this->assertSame(500000000 - $types['advance_payment'], $c['advance_remaining']);
        $this->assertSame('100', $c['lines'][0]['approved_quantity']);

        // Signatures from the approval history.
        $sig = $this->call('accountant', 'GET', '/print/signatures', null, array(), array('entity_type' => 'client_statement', 'entity_id' => $s['id']))->get_data();
        $this->assertSame(array('کاربر pm', 'کاربر senior', 'کاربر accountant'), array_column($sig['slots'], 'name'));

        // Second statement: previous quantity is the approved one, read-only.
        $s2 = $this->ok('pm', 'POST', '/client-statements', array_merge($body, array('title' => 'موقت ۲', 'submit' => true, 'lines' => array(array('contract_line_id' => $l1, 'quantity' => '50')))), 201)['records']['statements'][0];
        $this->assertSame('100', $s2['lines'][0]['previous_quantity']);
        $this->assertSame('150', $s2['lines'][0]['cumulative_quantity']);
        $this->assertSame('submitted_to_consultant', $s2['status']);

        // Receipts: only against an approved statement and within what is due.
        $this->fails('accountant', 'POST', '/receipts', array('amount' => 1000, 'receipt_type' => 'statement', 'account_id' => $this->bank['id']), 400);
        $this->fails('accountant', 'POST', '/receipts', array('amount' => 1000, 'receipt_type' => 'statement', 'statement_id' => $s2['id'], 'account_id' => $this->bank['id']), 422);
        $this->fails('accountant', 'POST', '/receipts', array('amount' => $s['net_amount'] + 1, 'receipt_type' => 'statement', 'statement_id' => $s['id'], 'account_id' => $this->bank['id']), 422);
        $part = $this->receive('accountant', array('amount' => 100000000, 'receipt_type' => 'statement', 'statement_id' => $s['id']), 'accountant2');
        $this->assertSame('partially_paid', $part['records']['statements'][0]['status']);
        $this->assertSame(-100000000, $this->entry_lines($part['records']['journal_entries'][0]['id'])['11201']);
        $rest = $this->receive('accountant', array('amount' => $s['net_amount'] - 100000000, 'receipt_type' => 'statement', 'statement_id' => $s['id']), 'accountant2');
        $this->assertSame('paid', $rest['records']['statements'][0]['status']);
        $this->assertSame(0, $this->contract($c['id'])['balance_due']);
        // A statement with receipts is not voided.
        $this->fails('senior', 'POST', "/statements/{$s['id']}/void", array('version' => $this->statement($s['id'])['version'], 'reason' => 'x'), 422);

        // Project scope: the other project's manager sees nothing of it.
        $this->assertSame(array(), $this->ok('pm2', 'GET', '/contracts')['contracts']);
        $this->assertSame(array(), $this->ok('pm2', 'GET', '/statements')['statements']);
        $this->fails('pm2', 'POST', "/statements/{$s2['id']}/approve", array('version' => 1), 404);
        $this->assertCount(1, $this->ok('pm', 'GET', '/contracts')['contracts']);
        $this->assert_books_balance();
    }

    public function test_amendment_raises_the_cap_and_void_takes_the_amount_back() {
        $c = $this->client_contract(array('advance_pct' => '0'));
        $this->ok('senior', 'POST', "/contracts/{$c['id']}/approve", array('version' => 1));
        $l1 = $c['lines'][0]['id'];
        $s = $this->ok('pm', 'POST', '/client-statements', array('contract_id' => $c['id'], 'title' => 'موقت ۱', 'submit' => true, 'period_start' => $this->today, 'period_end' => $this->today, 'lines' => array(array('contract_line_id' => $l1, 'quantity' => '1000'))), 201)['records']['statements'][0];
        // The line is full: more needs an approved amendment.
        $this->fails('pm', 'POST', '/client-statements', array('contract_id' => $c['id'], 'title' => 'موقت ۲', 'period_start' => $this->today, 'period_end' => $this->today, 'lines' => array(array('contract_line_id' => $l1, 'quantity' => '1'))), 422);
        $this->fails('accountant', 'POST', "/contracts/{$c['id']}/amendments", array('amendment_no' => 'ا-۱', 'lines' => array(array('contract_line_id' => $l1, 'quantity_delta' => '-1'))), 422);
        $a = $this->ok('accountant', 'POST', "/contracts/{$c['id']}/amendments", array('amendment_no' => 'ا-۱', 'extend_days' => 60, 'lines' => array(
            array('contract_line_id' => $l1, 'quantity_delta' => '200'),
            array('description' => 'عایق‌کاری', 'unit' => 'مترمربع', 'quantity_delta' => '10', 'rate' => 700000),
        )), 201);
        $am = $a['records']['contracts'][0]['amendments'][0];
        $this->assertSame(200 * 5000000 + 7000000, $am['amount_delta']);
        $this->assertSame('pending', $am['status']);
        $this->assertSame(0, $a['records']['contracts'][0]['amendments_total'], 'not effective before approval');
        $this->fails('accountant', 'POST', "/contract-amendments/{$am['id']}/approve", array('version' => 1), 403, 'akph_segregation_of_duties');
        $this->fails('accountant2', 'POST', "/contract-amendments/{$am['id']}/approve", array('version' => 1), 403);
        $this->assertContains('contract_amendment:' . $am['id'], $this->approval_ids('senior'));
        $c = $this->ok('senior', 'POST', "/contract-amendments/{$am['id']}/approve", array('version' => 1))['records']['contracts'][0];
        $this->assertSame($c['amount'] + $am['amount_delta'], $c['current_amount']);
        $this->assertSame(60, $c['extend_days']);
        $this->assertSame('1200', $c['lines'][0]['quantity']);
        $this->assertCount(3, $c['lines']);
        $this->ok('pm', 'POST', '/client-statements', array('contract_id' => $c['id'], 'title' => 'موقت ۲', 'period_start' => $this->today, 'period_end' => $this->today, 'lines' => array(array('contract_line_id' => $l1, 'quantity' => '1'))), 201);

        // Approve the first statement (admin as consultant, accountant as employer), then void it.
        $this->ok('admin', 'POST', "/statements/{$s['id']}/approve", array('version' => 1));
        $done = $this->ok('accountant', 'POST', "/statements/{$s['id']}/approve", array('version' => 2, 'employer_ref' => 'ک-۲', 'employer_date' => $this->today));
        $before = $this->contract($c['id']);
        $this->assertSame(5000000000, $before['approved_amount']);
        $this->fails('accountant', 'POST', "/statements/{$s['id']}/void", array('version' => 3, 'reason' => 'اشتباه'), 403);
        $this->fails('senior', 'POST', "/statements/{$s['id']}/void", array('version' => 3), 400);
        $void = $this->ok('senior', 'POST', "/statements/{$s['id']}/void", array('version' => 3, 'reason' => 'اشتباه در متره'));
        $this->assertSame('voided', $void['records']['statements'][0]['status']);
        $original = $this->entry_lines($done['records']['statements'][0]['entry']['id']);
        foreach ($this->entry_lines($void['records']['statements'][0]['void_entry']['id']) as $code => $net) {
            $this->assertSame(-$original[$code], $net, "reversal of {$code}");
        }
        $after = $this->contract($c['id']);
        $this->assertSame(0, $after['approved_amount'], 'the approved amount falls back');
        $this->assertSame('0', $after['lines'][0]['approved_quantity']);
        $this->assertSame(0, $this->ledger_sum("l.account_code = '41101'"));
        $this->assert_books_balance();
    }

    public function test_subcontract_statement_to_payment_with_segregation() {
        $c = $this->subcontract();
        $this->assertMatchesRegularExpression('/^SCN-\d{4}-\d{5}$/', $c['number']);
        $this->assertSame(500 * 800000 + 250750000, $c['amount']);
        $this->assertSame(array('مدیر پروژه', 'مدیر ارشد'), $c['chain']);
        $this->fails('pm2', 'POST', "/contracts/{$c['id']}/approve", array('version' => 1), 404);
        $this->fails('accountant2', 'POST', "/contracts/{$c['id']}/approve", array('version' => 1), 403, 'akph_forbidden');
        $this->ok('pm', 'POST', "/contracts/{$c['id']}/approve", array('version' => 1));
        $this->fails('pm', 'POST', "/contracts/{$c['id']}/approve", array('version' => 2), 403);
        $c = $this->ok('senior', 'POST', "/contracts/{$c['id']}/approve", array('version' => 2))['records']['contracts'][0];
        $this->assertSame('active', $c['status']);

        // Advance: a treasury payment request (11402), paid by someone other than its approver.
        $this->fails('accountant', 'POST', "/contracts/{$c['id']}/advance", array('amount' => $c['advance_expected'] + 1), 422);
        $adv = $this->ok('accountant', 'POST', "/contracts/{$c['id']}/advance", array('amount' => 100000000), 201)['records']['payment_requests'][0];
        $this->assertSame('subcontractor_advance', $adv['payable_type']);
        $this->receive('accountant', array('amount' => 3000000000, 'receipt_type' => 'other_income', 'payer_name' => 'سرمایه'), 'accountant2');
        $adv = $this->ok('accountant2', 'POST', "/payment-requests/{$adv['id']}/approve", array('version' => 1))['records']['payment_requests'][0];
        $this->ok('accountant', 'POST', "/payment-requests/{$adv['id']}/pay", array('version' => $adv['version'], 'amount' => 100000000, 'account_id' => $this->bank['id']), 201);
        $this->assertSame(100000000, $this->contract($c['id'])['advance_amount']);

        // Statement: PM records and measures; site approval by the senior manager (the PM created it), PM approval
        // by the system administrator (not the senior manager twice in a row), finance by the accountant, final by
        // the senior manager.
        $l1 = $c['lines'][0]['id'];
        $l2 = $c['lines'][1]['id'];
        $s = $this->ok('pm', 'POST', '/subcontractor-statements', array('contract_id' => $c['id'], 'title' => 'صورت‌وضعیت ۱', 'period_start' => $this->today, 'period_end' => $this->today, 'fixed_deduction' => 1000000, 'lines' => array(array('contract_line_id' => $l1, 'quantity' => '200'), array('contract_line_id' => $l2, 'quantity' => '100.5'))), 201)['records']['statements'][0];
        $gross = 200 * 800000 + 100500000;
        $this->assertSame($gross, $s['gross_amount']);
        $this->assertSame(0, $s['vat_amount']);
        $types = array_column($s['deductions'], 'amount', 'type');
        $this->assertSame(min((int) round($gross * 0.20), 100000000), $types['advance_payment'], 'capped at the advance paid');
        $this->assertSame((int) round($gross * 0.10), $types['retention']);
        $this->assertSame(1000000, $types['penalty']);
        $this->assertSame('submitted', $s['status']);
        $s = $this->ok('pm', 'POST', "/statements/{$s['id']}/approve", array('version' => 1))['records']['statements'][0];
        $this->assertSame('measured', $s['status']);
        $this->fails('pm', 'POST', "/statements/{$s['id']}/approve", array('version' => 2), 403, 'akph_segregation_of_duties');
        $this->ok('senior', 'POST', "/statements/{$s['id']}/approve", array('version' => 2));
        $this->fails('senior', 'POST', "/statements/{$s['id']}/approve", array('version' => 3), 403, 'akph_segregation_of_duties');
        $this->ok('admin', 'POST', "/statements/{$s['id']}/approve", array('version' => 3));
        $this->fails('pm', 'POST', "/statements/{$s['id']}/approve", array('version' => 4), 403);
        $this->ok('accountant', 'POST', "/statements/{$s['id']}/approve", array('version' => 4));
        $this->assertSame(0, $this->contract($c['id'])['approved_amount']);
        $done = $this->ok('senior', 'POST', "/statements/{$s['id']}/approve", array('version' => 5));
        $s = $done['records']['statements'][0];
        $this->assertSame('management_approved', $s['status']);
        $lines = $this->entry_lines($s['entry']['id']);
        $this->assertSame($gross, $lines['51301']);
        $this->assertSame(-$s['net_amount'], $lines['21102']);
        $this->assertSame(-$types['retention'], $lines['21601']);
        $this->assertSame(-$types['tax'], $lines['21204']);
        $this->assertSame(-$types['advance_payment'], $lines['11402']);
        $this->assertSame(-1000000, $lines['21603']);
        global $wpdb;
        $cc = (int) $wpdb->get_var($wpdb->prepare('SELECT cost_center_id FROM ' . Akph_Schema::table('ledger_lines') . " WHERE entry_id = %d AND account_code = '51301'", $s['entry']['id']));
        $this->assertSame((int) $this->center['id'], $cc, 'the cost is on the contract\'s cost center');
        $pr = $done['records']['payment_requests'][0];
        $this->assertSame('approved', $pr['status']);
        $this->assertSame($s['net_amount'], $pr['amount']);
        $this->assertSame('subcontractor', $pr['payable_type']);
        $c = $this->contract($c['id']);
        $this->assertSame($gross, $c['approved_amount']);
        $this->assertSame($s['net_amount'], $c['balance_due']);

        // Payment: not by the approver; then the contract's paid amount follows the treasury.
        $this->fails('senior', 'POST', "/payment-requests/{$pr['id']}/pay", array('version' => $pr['version'], 'amount' => $pr['amount'], 'account_id' => $this->bank['id']), 403, 'akph_segregation_of_duties');
        $this->ok('accountant', 'POST', "/payment-requests/{$pr['id']}/pay", array('version' => $pr['version'], 'amount' => 50000000, 'account_id' => $this->bank['id']), 201);
        $this->assertSame(50000000, $this->contract($c['id'])['settled_amount']);
        $this->fails('senior', 'POST', "/statements/{$s['id']}/void", array('version' => $this->statement($s['id'])['version'], 'reason' => 'x'), 422);
        $sig = $this->call('accountant', 'GET', '/print/signatures', null, array(), array('entity_type' => 'subcontractor_statement', 'entity_id' => $s['id']))->get_data();
        $this->assertSame(array('کاربر pm', 'کاربر pm', 'کاربر senior', 'کاربر admin', 'کاربر accountant', 'کاربر senior'), array_column($sig['slots'], 'name'));
        $this->assert_books_balance();
    }

    public function test_return_edit_and_rollback() {
        $c = $this->subcontract(array('advance_pct' => '0'));
        $this->ok('pm', 'POST', "/contracts/{$c['id']}/approve", array('version' => 1));
        $this->ok('senior', 'POST', "/contracts/{$c['id']}/approve", array('version' => 2));
        $l1 = $c['lines'][0]['id'];
        $s = $this->ok('pm', 'POST', '/subcontractor-statements', array('contract_id' => $c['id'], 'title' => 'ص ۱', 'period_start' => $this->today, 'period_end' => $this->today, 'lines' => array(array('contract_line_id' => $l1, 'quantity' => '10'))), 201)['records']['statements'][0];
        $this->ok('pm', 'POST', "/statements/{$s['id']}/approve", array('version' => 1));
        $this->ok('senior', 'POST', "/statements/{$s['id']}/approve", array('version' => 2));
        // Returned for revision: re-measured and the approvals start again (last approver cleared).
        $this->fails('pm', 'POST', "/statements/{$s['id']}/return", array('version' => 3), 400);
        $s = $this->ok('pm', 'POST', "/statements/{$s['id']}/return", array('version' => 3, 'reason' => 'متره اشتباه'))['records']['statements'][0];
        $this->assertSame('returned_for_revision', $s['status']);
        $this->assertNull($s['last_approved_by']);
        $s = $this->ok('pm', 'POST', "/statements/{$s['id']}", array('version' => 4, 'title' => 'ص ۱ اصلاحی', 'period_start' => $this->today, 'period_end' => $this->today, 'lines' => array(array('contract_line_id' => $l1, 'quantity' => '12'))))['records']['statements'][0];
        $this->assertSame(12 * 800000, $s['gross_amount']);
        $this->ok('pm', 'POST', "/statements/{$s['id']}/approve", array('version' => 5));
        $this->ok('senior', 'POST', "/statements/{$s['id']}/approve", array('version' => 6));
        $this->ok('admin', 'POST', "/statements/{$s['id']}/approve", array('version' => 7));
        $this->ok('accountant', 'POST', "/statements/{$s['id']}/approve", array('version' => 8));

        // A failure while posting the final approval leaves nothing behind (no entry, no request, same status).
        $entries = $this->count_rows('ledger_entries');
        $requests = $this->count_rows('payment_requests');
        $audit = Akph_Schema::table('audit_log');
        $fail = function ($sql) use ($audit) {
            return strpos($sql, 'INSERT INTO `' . $audit . '`') === 0 && strpos($sql, 'statement_approved') !== false ? 'SELECT * FROM akph_no_such_table' : $sql;
        };
        add_filter('query', $fail);
        $response = $this->call('senior', 'POST', "/statements/{$s['id']}/approve", array('version' => 9));
        remove_filter('query', $fail);
        $this->assertStatus(500, $response);
        $this->assertSame($entries, $this->count_rows('ledger_entries'));
        $this->assertSame($requests, $this->count_rows('payment_requests'));
        $this->assertSame('finance_approved', $this->statement($s['id'])['status']);
        $this->ok('senior', 'POST', "/statements/{$s['id']}/approve", array('version' => 9));
        $this->assert_books_balance();
    }

    public function test_guarantees_due_and_report() {
        $c = $this->client_contract();
        $this->ok('senior', 'POST', "/contracts/{$c['id']}/approve", array('version' => 1));
        $soon = gmdate('Y-m-d', strtotime($this->today) + 10 * DAY_IN_SECONDS);
        $later = gmdate('Y-m-d', strtotime($this->today) + 200 * DAY_IN_SECONDS);
        $this->fails('pm', 'POST', "/contracts/{$c['id']}/guarantees", array('kind' => 'performance', 'guarantee_no' => 'ض-۱', 'bank' => 'بانک', 'amount' => 1000, 'due_date' => $soon), 403);
        $c = $this->ok('accountant', 'POST', "/contracts/{$c['id']}/guarantees", array('kind' => 'performance', 'guarantee_no' => 'ض-۱', 'bank' => 'بانک نمونه', 'amount' => 250000000, 'issue_date' => $this->today, 'due_date' => $soon), 201)['records']['contracts'][0];
        $this->ok('accountant', 'POST', "/contracts/{$c['id']}/guarantees", array('kind' => 'advance', 'guarantee_no' => 'ض-۲', 'bank' => 'بانک نمونه', 'amount' => 100000000, 'due_date' => $later), 201);
        $due = $this->ok('pm', 'GET', '/contracts/guarantees-due')['guarantees'];
        $this->assertSame(array('ض-۱'), array_column($due, 'guarantee_no'), 'the project manager sees his project\'s guarantee due soon');
        $this->assertSame(array(), $this->ok('pm2', 'GET', '/contracts/guarantees-due')['guarantees']);
        $g = $c['guarantees'][0];
        $this->assertTrue($g['due_soon']);
        $this->ok('accountant', 'POST', "/contract-guarantees/{$g['id']}", array('version' => 1, 'status' => 'released'));
        $this->assertSame(array(), $this->ok('accountant', 'GET', '/contracts/guarantees-due')['guarantees']);
        $summary = $this->call('pm', 'GET', '/reports/contracts', null, array(), array('project_id' => $this->project['id']))->get_data()['summary'];
        $this->assertSame(1, $summary['client']['count']);
        $this->assertSame($c['amount'], $summary['client']['current_amount']);
        $this->assertStatus(403, $this->call('pm2', 'GET', '/reports/contracts', null, array(), array('project_id' => $this->project['id'])));
    }
}
