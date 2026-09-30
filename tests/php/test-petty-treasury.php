<?php
/**
 * 0.6.0: petty cash, treasury and the approval center through the REST routes, with the four portal roles.
 * Every scenario ends with the whole ledger balanced and every fund / bank balance equal to its ledger lines.
 */
class Test_Akph_Petty_Treasury extends Akph_Test_Case {
    /** @var array */
    private $project;
    /** @var array */
    private $project2;
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
    }

    // ------------------------------------------------------------------ helpers

    private function call($who, $method, $path, $body = null, array $headers = array()) {
        $this->login($who);
        return $this->request($method, $path, $body, $headers);
    }

    /** Runs a command that must succeed; returns the response data. */
    private function ok($who, $method, $path, $body = array(), $status = null) {
        $response = $this->call($who, $method, $path, $body);
        $code = $response->get_status();
        if ($status !== null) {
            $this->assertStatus($status, $response, "{$method} {$path} as {$who}");
        } else {
            $this->assertContains($code, array(200, 201), "{$method} {$path} as {$who}: " . wp_json_encode($response->get_data(), JSON_UNESCAPED_UNICODE));
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

    private function bank($title = 'بانک آزمایشی', $kind = 'bank') {
        $data = $this->ok('accountant', 'POST', '/treasury/accounts', array('kind' => $kind, 'title' => $title, 'bank_name' => $kind === 'bank' ? 'بانک نمونه' : ''), 201);
        return $data['records']['treasury_accounts'][0];
    }

    /** Money into a bank or cash desk through a receipt approved by a second user. */
    private function deposit(array $account, $amount) {
        $rec = $this->ok('accountant', 'POST', '/receipts', array('amount' => $amount, 'receipt_type' => 'other_income', 'payer_name' => 'واریز آزمایشی', 'account_id' => $account['id'], 'method' => 'transfer'), 201);
        $row = $rec['records']['receipts'][0];
        $this->ok('accountant2', 'POST', "/receipts/{$row['id']}/approve", array('version' => $row['version']));
    }

    private function fund(array $fields = array()) {
        $data = $this->ok('accountant', 'POST', '/petty-cash/funds', array_merge(array(
            'title' => 'تنخواه کارگاه',
            'fund_type' => 'site_supervisor',
            'project_id' => $this->project['id'],
            'holder_user_id' => (string) self::$users['pm'],
            'holder_name' => 'متصدی آزمایشی',
            'ceiling' => 3000000000,
            'max_single_expense' => 1000000000,
        ), $fields), 201);
        return $data['records']['petty_funds'][0];
    }

    private function fund_row($id) {
        return Akph_Petty_Cash::fund_shape(Akph_Db::find(Akph_Schema::table('petty_funds'), $id));
    }

    private function expense($who, array $fund, $amount, array $extra = array()) {
        $data = $this->ok($who, 'POST', '/petty-cash/expenses', array_merge(array('fund_id' => $fund['id'], 'amount' => $amount, 'date' => $this->today, 'description' => 'خرید مصالح جزئی', 'vendor' => 'فروشگاه نمونه', 'invoice_number' => 'F-1'), $extra), 201);
        return $data['records']['petty_expenses'][0];
    }

    private function expense_row($id) {
        return Akph_Petty_Cash::expense_shape(Akph_Db::find(Akph_Schema::table('petty_expenses'), $id));
    }

    private function approve_expense($who, $id, $status = null) {
        $row = $this->expense_row($id);
        return $this->ok($who, 'POST', "/petty-cash/expenses/{$id}/approve", array('version' => $row['version']), $status);
    }

    /** Replenishes `$fund` by `$amount` through the whole chain and a payment from `$bank`. */
    private function replenish(array $fund, array $bank, $amount) {
        $req = $this->ok('accountant', 'POST', '/petty-cash/requests', array('fund_id' => $fund['id'], 'amount' => $amount, 'reason' => 'شارژ آزمایشی'), 201)['records']['petty_requests'][0];
        $approvers = array(Akph_Flow::PM => 'pm', Akph_Flow::ACCOUNTANT => 'accountant2', Akph_Flow::SENIOR => 'senior');
        $last = null;
        foreach ($req['chain'] as $step) {
            $row = Akph_Petty_Cash::request_shape(Akph_Db::find(Akph_Schema::table('petty_requests'), $req['id']));
            $last = $this->ok($approvers[$step], 'POST', "/petty-cash/requests/{$req['id']}/approve", array('version' => $row['version']));
        }
        $pr = $last['records']['payment_requests'][0];
        $this->ok('accountant', 'POST', "/payment-requests/{$pr['id']}/pay", array('version' => $pr['version'], 'amount' => $amount, 'account_id' => $bank['id'], 'method' => 'transfer', 'tracking' => 'T-1'), 201);
        return $pr;
    }

    private function ledger_sum($where) {
        global $wpdb;
        return (int) $wpdb->get_var('SELECT COALESCE(SUM(l.debit) - SUM(l.credit), 0) FROM ' . Akph_Schema::table('ledger_lines') . ' l JOIN ' . Akph_Schema::table('ledger_entries') . " e ON e.id = l.entry_id WHERE e.status = 'posted' AND {$where}");
    }

    /** Σ debit = Σ credit over the final ledger, per entry and in total; cash balances = their lines. */
    private function assert_books_balance() {
        global $wpdb;
        $l = Akph_Schema::table('ledger_lines');
        $e = Akph_Schema::table('ledger_entries');
        $this->assertSame(0, $this->ledger_sum('1=1'), 'the whole ledger is balanced');
        $bad = $wpdb->get_var("SELECT COUNT(*) FROM (SELECT l.entry_id FROM {$l} l GROUP BY l.entry_id HAVING SUM(l.debit) <> SUM(l.credit)) x");
        $this->assertSame('0', (string) $bad, 'every entry is balanced');
        $this->assertSame('0', (string) $wpdb->get_var("SELECT COUNT(*) FROM {$e} WHERE status = 'posted' AND (doc_number IS NULL OR doc_number = '')"), 'every final entry has its number');
        foreach ((array) $wpdb->get_results('SELECT id, account_code FROM ' . Akph_Schema::table('petty_funds')) as $f) {
            $this->assertSame($this->ledger_sum($wpdb->prepare('l.cash_ref = %s', 'pcf:' . $f->id)), $this->fund_row($f->id)['balance']);
        }
        foreach ((array) $wpdb->get_results('SELECT id FROM ' . Akph_Schema::table('treasury_accounts')) as $a) {
            $this->assertSame($this->ledger_sum($wpdb->prepare('l.cash_ref = %s', 'tre:' . $a->id)), Akph_Posting::balance('tre:' . $a->id));
        }
        // With one fund and one account per chart code, the account totals equal the balances too.
        $this->assertSame($this->ledger_sum("l.account_code = '11103'"), $this->ledger_sum("l.cash_ref LIKE 'pcf:%'"));
        $this->assertSame($this->ledger_sum("l.account_code IN ('11101','11102')"), $this->ledger_sum("l.cash_ref LIKE 'tre:%'"));
    }

    private function approvals($who) {
        $this->login($who);
        $response = $this->request('GET', '/approvals');
        $this->assertStatus(200, $response);
        return $response->get_data()['items'];
    }

    private function approval_ids($who) {
        return array_map(function ($i) {
            return $i['id'];
        }, $this->approvals($who));
    }

    // ------------------------------------------------------------------ petty cash

    public function test_full_petty_cash_flow_with_all_four_roles() {
        $bank = $this->bank();
        $this->deposit($bank, 5000000000);
        $fund = $this->fund();
        $this->assertSame(0, $fund['balance']);
        $this->assertSame('11103', $fund['account_code']);

        // Replenishment above the senior threshold: PM → accountant → senior; created by the accountant.
        $req = $this->ok('accountant', 'POST', '/petty-cash/requests', array('fund_id' => $fund['id'], 'amount' => 2000000000, 'reason' => 'شارژ اول'), 201)['records']['petty_requests'][0];
        $this->assertSame(array(Akph_Flow::PM, Akph_Flow::ACCOUNTANT, Akph_Flow::SENIOR), $req['chain']);
        $this->fails('accountant', 'POST', "/petty-cash/requests/{$req['id']}/approve", array('version' => 1), 403, 'akph_segregation_of_duties');
        $this->fails('pm2', 'POST', "/petty-cash/requests/{$req['id']}/approve", array('version' => 1), 404);
        $this->fails('accountant2', 'POST', "/petty-cash/requests/{$req['id']}/approve", array('version' => 1), 403, 'akph_forbidden');
        $this->assertContains('petty_replenishment:' . $req['id'], $this->approval_ids('pm'));
        $this->assertNotContains('petty_replenishment:' . $req['id'], $this->approval_ids('accountant'), 'not for its creator');
        $this->assertNotContains('petty_replenishment:' . $req['id'], $this->approval_ids('pm2'), 'not outside the project');
        $this->ok('pm', 'POST', "/petty-cash/requests/{$req['id']}/approve", array('version' => 1, 'comment' => 'تأیید مدیر پروژه'));
        $this->assertNotContains('petty_replenishment:' . $req['id'], $this->approval_ids('pm'), 'the next step is not the PM\'s');
        $this->fails('pm', 'POST', "/petty-cash/requests/{$req['id']}/approve", array('version' => 2), 403);
        $this->ok('accountant2', 'POST', "/petty-cash/requests/{$req['id']}/approve", array('version' => 2));
        $this->fails('accountant2', 'POST', "/petty-cash/requests/{$req['id']}/approve", array('version' => 3), 403, 'akph_segregation_of_duties');
        $this->assertContains('petty_replenishment:' . $req['id'], $this->approval_ids('senior'));
        $done = $this->ok('senior', 'POST', "/petty-cash/requests/{$req['id']}/approve", array('version' => 3));
        $pr = $done['records']['payment_requests'][0];
        $this->assertSame('approved', $pr['status']);
        $this->assertSame('petty_replenishment', $pr['source_type']);
        $this->assertSame((string) self::$users['senior'], $pr['approved_by']);
        $this->assertSame(0, $this->fund_row($fund['id'])['balance'], 'nothing moves before the payment');
        $this->assertSame(2000000000, $this->fund_row($fund['id'])['open_requests']);

        // Treasury pays it in two parts; the approver may not pay.
        $this->fails('senior', 'POST', "/payment-requests/{$pr['id']}/pay", array('version' => $pr['version'], 'amount' => 500000000, 'account_id' => $bank['id']), 403, 'akph_segregation_of_duties');
        $part = $this->ok('accountant', 'POST', "/payment-requests/{$pr['id']}/pay", array('version' => $pr['version'], 'amount' => 500000000, 'account_id' => $bank['id'], 'method' => 'paya', 'tracking' => 'P-1'), 201);
        $pr = $part['records']['payment_requests'][0];
        $this->assertSame(1500000000, $pr['remaining_amount']);
        $this->assertSame('approved', $pr['status']);
        $this->assertSame(500000000, $this->fund_row($fund['id'])['balance']);
        $this->fails('accountant', 'POST', "/payment-requests/{$pr['id']}/pay", array('version' => $pr['version'], 'amount' => 1500000001, 'account_id' => $bank['id']), 400);
        $rest = $this->ok('accountant', 'POST', "/payment-requests/{$pr['id']}/pay", array('version' => $pr['version'], 'amount' => 1500000000, 'account_id' => $bank['id'], 'method' => 'satna', 'tracking' => 'S-1'), 201);
        $this->assertSame('paid', $rest['records']['payment_requests'][0]['status']);
        $this->assertSame('paid', $rest['records']['petty_requests'][0]['status']);
        $this->assertSame(2000000000, $this->fund_row($fund['id'])['balance']);
        $this->assertSame(3000000000, Akph_Posting::balance('tre:' . $bank['id']));

        // Expense up to the first level: accountant only; submitted by the project manager.
        $small = $this->expense('pm', $fund, 150000000);
        $this->assertSame(array(Akph_Flow::ACCOUNTANT), $small['chain']);
        $this->fails('pm', 'POST', "/petty-cash/expenses/{$small['id']}/approve", array('version' => 1), 403, 'akph_segregation_of_duties');
        $this->assertSame(1850000000, $this->fund_row($fund['id'])['usable_balance']);
        $final = $this->approve_expense('accountant', $small['id']);
        $this->assertSame('approved', $final['records']['petty_expenses'][0]['status']);
        $this->assertMatchesRegularExpression('/^ACC-\d{4}-\d{5}$/', $final['doc_number']);
        $entry = $final['records']['journal_entries'][0];
        $this->assertSame('posted', $entry['status']);
        $this->assertSame(1850000000, $this->fund_row($fund['id'])['balance']);

        // Second level (PM → accountant), submitted by the senior manager.
        $mid = $this->expense('senior', $fund, 600000000, array('description' => 'اجاره ماشین‌آلات'));
        $this->assertSame(array(Akph_Flow::PM, Akph_Flow::ACCOUNTANT), $mid['chain']);
        $this->fails('accountant', 'POST', "/petty-cash/expenses/{$mid['id']}/approve", array('version' => 1), 403, 'akph_forbidden');
        $this->assertContains('petty_cash_expense:' . $mid['id'], $this->approval_ids('pm'));
        $this->assertNotContains('petty_cash_expense:' . $mid['id'], $this->approval_ids('accountant'));
        $this->approve_expense('pm', $mid['id']);
        $this->assertContains('petty_cash_expense:' . $mid['id'], $this->approval_ids('accountant'));
        $this->approve_expense('accountant', $mid['id']);
        $this->assertSame(1250000000, $this->fund_row($fund['id'])['balance']);

        // Rejection with a reason on the current step; above the single-expense limit is refused.
        $bad = $this->expense('pm', $fund, 180000000);
        $this->fails('accountant', 'POST', "/petty-cash/expenses/{$bad['id']}/reject", array('version' => 1), 400);
        $rejected = $this->ok('accountant', 'POST', "/petty-cash/expenses/{$bad['id']}/reject", array('version' => 1, 'reason' => 'فاکتور ناخوانا'));
        $this->assertSame('rejected', $rejected['records']['petty_expenses'][0]['status']);
        $this->fails('pm', 'POST', '/petty-cash/expenses', array('fund_id' => $fund['id'], 'amount' => 1000000001, 'date' => $this->today, 'description' => 'زیاد'), 422);

        // Count: a shortage becomes a pending adjustment; the period closes only after another user posts it.
        $count = $this->ok('accountant', 'POST', "/petty-cash/funds/{$fund['id']}/count", array('counted_cash' => 1240000000, 'reason' => 'کسری رسید گمشده'), 201);
        $c = $count['records']['petty_counts'][0];
        $this->assertSame(-10000000, $c['discrepancy']);
        $adj = $count['records']['journal_entries'][0];
        $this->assertSame('pending', $adj['status']);
        $this->fails('accountant', 'POST', "/petty-cash/funds/{$fund['id']}/count", array('counted_cash' => 1, 'reason' => ''), 400);
        $f = $this->fund_row($fund['id']);
        $this->fails('accountant', 'POST', "/petty-cash/funds/{$fund['id']}/close-period", array('version' => $f['version']), 422);
        $this->assertContains('petty_adjustment:' . $adj['id'], $this->approval_ids('accountant2'));
        $this->assertNotContains('petty_adjustment:' . $adj['id'], $this->approval_ids('accountant'));
        $this->assertNotContains('petty_adjustment:' . $adj['id'], $this->approval_ids('pm'));
        $this->fails('accountant', 'POST', "/journal-entries/{$adj['id']}/post", array('version' => $adj['version']), 403, 'akph_segregation_of_duties');
        $this->ok('accountant2', 'POST', "/journal-entries/{$adj['id']}/post", array('version' => $adj['version']));
        $this->assertSame(1240000000, $this->fund_row($fund['id'])['balance']);
        $closed = $this->ok('accountant', 'POST', "/petty-cash/funds/{$fund['id']}/close-period", array('version' => $f['version']));
        $this->assertSame(gmdate('Y-m-d', strtotime($this->today . ' +1 day')), $closed['records']['petty_funds'][0]['period_start']);

        // Reports: statement with movements and history; overview by scope.
        $this->login('pm');
        $statement = $this->request('GET', "/petty-cash/funds/{$fund['id']}")->get_data();
        $this->assertSame(1240000000, end($statement['movements'])['balance']);
        $this->assertCount(3, $statement['expenses']);
        $this->assertNotEmpty($statement['history']);
        $this->assertCount(2, $this->request('GET', '/petty-cash')->get_data()['replenishments']);
        $this->login('pm2');
        $this->assertSame(array(), $this->request('GET', '/petty-cash')->get_data()['funds']);
        $this->assertStatus(404, $this->request('GET', "/petty-cash/funds/{$fund['id']}"));

        $this->assert_books_balance();
        $this->assertSame(0, $this->ledger_sum("l.account_code = '41302'") + 5000000000 * 1, 'the deposit credited other income');
    }

    public function test_project_manager_scope_and_headquarters_funds() {
        $hq = $this->fund(array('title' => 'تنخواه ستاد', 'fund_type' => 'headquarters', 'project_id' => '', 'holder_user_id' => (string) self::$users['accountant'], 'ceiling' => 1000000000, 'max_single_expense' => 400000000));
        $this->assertNull($hq['project_id']);
        $this->login('pm');
        $this->assertSame(array(), $this->request('GET', '/petty-cash')->get_data()['funds']);
        $this->assertStatus(404, $this->request('GET', "/petty-cash/funds/{$hq['id']}"));
        $this->fails('pm', 'POST', '/petty-cash/expenses', array('fund_id' => $hq['id'], 'amount' => 1000, 'date' => $this->today, 'description' => 'x'), 404);
        $this->fails('pm', 'POST', '/petty-cash/funds', array('title' => 'x'), 403, 'akph_role_forbidden');
        // A headquarters request skips the project manager step.
        $req = $this->ok('accountant', 'POST', '/petty-cash/requests', array('fund_id' => $hq['id'], 'amount' => 100000000, 'reason' => 'ستاد'), 201)['records']['petty_requests'][0];
        $this->assertSame(array(Akph_Flow::ACCOUNTANT), $req['chain']);
        $this->assertSame(array(), $this->approvals('pm'));
        $this->assertContains('petty_replenishment:' . $req['id'], $this->approval_ids('accountant2'));
        // Manual payment requests without a project are not for a project manager either.
        $this->fails('pm', 'POST', '/payment-requests', array('amount' => 1, 'beneficiary_name' => 'x', 'payable_type' => 'supplier'), 403, 'akph_role_forbidden');
        $this->assertStatus(403, $this->call('pm', 'GET', '/treasury'));
    }

    public function test_fund_ceiling_counts_open_requests_and_one_pending_request_per_fund() {
        $bank = $this->bank();
        $this->deposit($bank, 5000000000);
        $fund = $this->fund(array('ceiling' => 1000000000, 'max_single_expense' => 500000000));
        $this->fails('accountant', 'POST', '/petty-cash/requests', array('fund_id' => $fund['id'], 'amount' => 1000000001, 'reason' => 'x'), 422);
        $first = $this->ok('accountant', 'POST', '/petty-cash/requests', array('fund_id' => $fund['id'], 'amount' => 600000000, 'reason' => 'اول'), 201)['records']['petty_requests'][0];
        $this->fails('accountant', 'POST', '/petty-cash/requests', array('fund_id' => $fund['id'], 'amount' => 100000000, 'reason' => 'دوم'), 409);
        $this->ok('pm', 'POST', "/petty-cash/requests/{$first['id']}/approve", array('version' => 1));
        $this->ok('accountant2', 'POST', "/petty-cash/requests/{$first['id']}/approve", array('version' => 2));
        // Approved and unpaid still counts: 600M open + 500M > 1,000M.
        $this->fails('accountant', 'POST', '/petty-cash/requests', array('fund_id' => $fund['id'], 'amount' => 500000000, 'reason' => 'سوم'), 422);
        $this->ok('accountant', 'POST', '/petty-cash/requests', array('fund_id' => $fund['id'], 'amount' => 400000000, 'reason' => 'سوم'), 201);
        // Expenses cannot exceed the usable balance (balance − pending).
        $this->fails('pm', 'POST', '/petty-cash/expenses', array('fund_id' => $fund['id'], 'amount' => 1000, 'date' => $this->today, 'description' => 'x'), 422);
        $this->assert_books_balance();
    }

    public function test_missing_account_stops_the_command_and_writes_nothing() {
        $err = $this->fails('accountant', 'POST', '/petty-cash/funds', array('title' => 'x', 'fund_type' => 'site_supervisor', 'project_id' => $this->project['id'], 'holder_name' => 'y', 'account_code' => '11199'), 422, 'akph_rule');
        $this->assertStringContainsString('در کدینگ تعریف نشده', $err['message']);
        $this->assertSame(0, $this->count_rows('petty_funds'));

        $bank = $this->bank();
        $this->deposit($bank, 1000000000);
        $fund = $this->fund();
        $this->replenish($fund, $bank, 500000000);
        $expense = $this->expense('pm', $fund, 100000000);
        $entries = $this->count_rows('ledger_entries');
        global $wpdb;
        $wpdb->query('DELETE FROM ' . Akph_Accounts::table() . " WHERE code = '51101'");
        $err = $this->fails('accountant', 'POST', "/petty-cash/expenses/{$expense['id']}/approve", array('version' => 1), 422, 'akph_rule');
        $this->assertStringContainsString('51101', $err['message']);
        $this->assertStringContainsString('در کدینگ تعریف نشده', $err['message']);
        $this->assertSame($entries, $this->count_rows('ledger_entries'), 'no entry');
        $this->assertSame('pending', $this->expense_row($expense['id'])['status'], 'the approval rolled back');
        $this->assertSame(0, $this->count_rows('ledger_events', "source = 'petty_expense'"));
        $this->assert_books_balance();
    }

    public function test_idempotency_version_conflict_and_one_entry_per_event() {
        $bank = $this->bank();
        $this->deposit($bank, 1000000000);
        $fund = $this->fund();
        $this->replenish($fund, $bank, 500000000);
        $expense = $this->expense('pm', $fund, 100000000);

        $this->fails('accountant', 'POST', "/petty-cash/expenses/{$expense['id']}/approve", array('version' => 7), 409, 'akph_conflict');
        $this->fails('accountant', 'POST', "/petty-cash/expenses/{$expense['id']}/approve", array(), 428, 'akph_version_required');
        $key = wp_generate_uuid4();
        $first = $this->call('accountant', 'POST', "/petty-cash/expenses/{$expense['id']}/approve", array('version' => 1), array('Idempotency-Key' => $key));
        $this->assertStatus(200, $first);
        $again = $this->call('accountant', 'POST', "/petty-cash/expenses/{$expense['id']}/approve", array('version' => 1), array('Idempotency-Key' => $key));
        $this->assertStatus(200, $again);
        $this->assertSame('true', $again->get_headers()['Idempotency-Replayed']);
        $this->assertSame($first->get_data()['doc_number'], $again->get_data()['doc_number']);
        $this->assertSame(1, $this->count_rows('ledger_events', "source = 'petty_expense' AND source_id = " . (int) $expense['id']));
        $this->fails('accountant', 'POST', "/petty-cash/expenses/{$expense['id']}/approve", array('version' => 2), 409, 'akph_conflict');

        // The engine returns the first entry for the same (source, id, type).
        $this->login('accountant');
        Akph_Db::begin();
        Akph_Posting::lock_year($this->today);
        $dup = Akph_Posting::post(array('source' => 'petty_expense', 'source_id' => (int) $expense['id'], 'type' => 'PETTY_CASH_EXPENSE_APPROVED', 'date' => $this->today, 'description' => 'x', 'lines' => array()));
        Akph_Db::commit();
        $this->assertTrue($dup['duplicate']);
        $this->assertSame($first->get_data()['doc_number'], $dup['entry']->doc_number);
        $this->assertSame(1, $this->count_rows('ledger_entries', "source_type = 'event' AND description LIKE '%" . esc_sql($expense['number']) . "%'"));

        // Automatic entries are neither edited nor reversed from the journal.
        $entry_id = (int) $this->expense_row($expense['id'])['entry']['id'];
        $this->fails('accountant2', 'POST', "/journal-entries/{$entry_id}/reverse", array('version' => 1, 'reason' => 'x'), 409);
        $this->assert_books_balance();
    }

    public function test_lock_wait_rolls_back_the_final_approval_and_the_same_key_then_succeeds() {
        global $wpdb;
        $bank = $this->bank();
        $this->deposit($bank, 1000000000);
        $fund = $this->fund();
        $this->replenish($fund, $bank, 500000000);
        $expense = $this->expense('pm', $fund, 100000000);
        $entries = $this->count_rows('ledger_entries');

        list($host, $port, $socket) = $wpdb->parse_db_host(DB_HOST);
        $other = mysqli_init();
        $other->real_connect($host, DB_USER, DB_PASSWORD, DB_NAME, $port ? (int) $port : null, $socket ?: null);
        $other->query('START TRANSACTION');
        $this->assertInstanceOf('mysqli_result', $other->query('SELECT id FROM ' . Akph_Schema::table('petty_expenses') . ' WHERE id = ' . (int) $expense['id'] . ' FOR UPDATE'));
        $wpdb->query('SET SESSION innodb_lock_wait_timeout = 1');
        $key = wp_generate_uuid4();
        try {
            $response = $this->call('accountant', 'POST', "/petty-cash/expenses/{$expense['id']}/approve", array('version' => 1), array('Idempotency-Key' => $key));
            $this->assertStatus(409, $response);
            $this->assertSame('akph_retry', $this->errorCode($response));
            $this->assertSame($entries, $this->count_rows('ledger_entries'));
            $this->assertSame('pending', $this->expense_row($expense['id'])['status']);
            $this->assertSame(0, $this->count_rows('ledger_events', "source = 'petty_expense'"));
        } finally {
            $other->query('ROLLBACK');
            $other->close();
            $wpdb->query('SET SESSION innodb_lock_wait_timeout = 50');
        }
        $again = $this->call('accountant', 'POST', "/petty-cash/expenses/{$expense['id']}/approve", array('version' => 1), array('Idempotency-Key' => $key));
        $this->assertStatus(200, $again);
        $this->assertSame($entries + 1, $this->count_rows('ledger_entries'));
        $this->assert_books_balance();
    }

    public function test_settings_and_categories_live_on_the_server() {
        $this->fails('accountant', 'POST', '/petty-cash/settings', array('site_level_max' => 1), 403, 'akph_role_forbidden');
        $saved = $this->ok('senior', 'POST', '/petty-cash/settings', array('site_level_max' => 50000000, 'project_level_max' => 400000000, 'replenishment_senior_threshold' => 300000000));
        $this->assertSame(50000000, $saved['records']['petty_settings'][0]['site_level_max']);
        $this->fails('senior', 'POST', '/petty-cash/settings', array('site_level_max' => 500000000), 400);
        $this->fails('senior', 'POST', '/petty-cash/settings', array('approval_chains' => array('ceo_full' => array('مدیر پروژه', 'مدیر پروژه'))), 400);
        $this->fails('senior', 'POST', '/petty-cash/settings', array('role' => 'x'), 400, 'akph_forbidden_field');

        $cats = $this->ok('accountant', 'POST', '/petty-cash/categories', array('categories' => array(
            array('name' => 'ایاب و ذهاب', 'subcategories' => array('تاکسی'), 'account_code' => '62402'),
            array('name' => 'مصالح جزئی'),
        )))['records']['petty_categories'];
        $this->assertCount(2, $cats);
        $this->assertSame('51101', $cats[1]['account_code'], 'default expense account');
        $this->fails('accountant', 'POST', '/petty-cash/categories', array('categories' => array(array('name' => 'x', 'account_code' => '11101'))), 422);

        $bank = $this->bank();
        $this->deposit($bank, 1000000000);
        $fund = $this->fund();
        $this->replenish($fund, $bank, 500000000);
        $expense = $this->expense('pm', $fund, 60000000, array('category_id' => $cats[0]['id']));
        $this->assertSame('62402', $expense['account_code']);
        $this->assertSame(array(Akph_Flow::PM, Akph_Flow::ACCOUNTANT), $expense['chain'], 'the stored thresholds decide the level');
        $this->assert_books_balance();
    }

    // ------------------------------------------------------------------ treasury

    public function test_manual_payment_request_thresholds_sod_and_negative_balance() {
        $bank = $this->bank();
        $this->deposit($bank, 400000000);
        $party = $this->ok('accountant', 'POST', '/counterparties', array('kind' => 'supplier', 'name' => 'تأمین‌کننده آزمایشی'), 201)['records']['counterparties'][0];

        $small = $this->ok('accountant', 'POST', '/payment-requests', array('amount' => 300000000, 'beneficiary_name' => $party['name'], 'counterparty_id' => $party['id'], 'payable_type' => 'supplier', 'project_id' => $this->project['id'], 'due_date' => $this->today), 201)['records']['payment_requests'][0];
        $this->assertSame('21101', $small['debit_account_code']);
        $this->fails('accountant', 'POST', "/payment-requests/{$small['id']}/approve", array('version' => 1), 403, 'akph_segregation_of_duties');
        $this->assertContains('payment_request:' . $small['id'], $this->approval_ids('accountant2'));
        $this->assertNotContains('payment_request:' . $small['id'], $this->approval_ids('pm'));
        $approved = $this->ok('accountant2', 'POST', "/payment-requests/{$small['id']}/approve", array('version' => 1))['records']['payment_requests'][0];
        $this->fails('accountant2', 'POST', "/payment-requests/{$small['id']}/pay", array('version' => $approved['version'], 'amount' => 100, 'account_id' => $bank['id']), 403, 'akph_segregation_of_duties');

        $big = $this->ok('accountant', 'POST', '/payment-requests', array('amount' => 1500000000, 'beneficiary_name' => 'پیمانکار', 'debit_account_code' => '21102'), 201)['records']['payment_requests'][0];
        $this->assertNotContains('payment_request:' . $big['id'], $this->approval_ids('accountant2'), 'above the accountant threshold');
        $this->fails('accountant2', 'POST', "/payment-requests/{$big['id']}/approve", array('version' => 1), 403, 'akph_forbidden');
        $this->assertContains('payment_request:' . $big['id'], $this->approval_ids('senior'));
        $big = $this->ok('senior', 'POST', "/payment-requests/{$big['id']}/approve", array('version' => 1))['records']['payment_requests'][0];
        $err = $this->fails('accountant', 'POST', "/payment-requests/{$big['id']}/pay", array('version' => $big['version'], 'amount' => 500000000, 'account_id' => $bank['id']), 422, 'akph_rule');
        $this->assertStringContainsString('موجودی منفی مجاز نیست', $err['message']);
        $this->assertSame(400000000, Akph_Posting::balance('tre:' . $bank['id']));

        $paid = $this->ok('accountant', 'POST', "/payment-requests/{$small['id']}/pay", array('version' => $approved['version'], 'amount' => 300000000, 'account_id' => $bank['id'], 'method' => 'transfer', 'tracking' => 'TR-9'), 201);
        $this->assertSame('paid', $paid['records']['payment_requests'][0]['status']);
        $this->assertSame(100000000, $paid['records']['treasury_accounts'][0]['balance']);
        $this->assertSame(-300000000, $this->ledger_sum("l.account_code = '11101'") - 400000000);

        // Rejection needs a reason and syncs; a paid request cannot be rejected.
        $this->fails('accountant2', 'POST', "/payment-requests/{$small['id']}/reject", array('version' => 3, 'reason' => 'x'), 409);
        $this->ok('senior', 'POST', "/payment-requests/{$big['id']}/reject", array('version' => $big['version'], 'reason' => 'بودجه ندارد'));
        $this->assert_books_balance();
    }

    public function test_cheques_receipts_transfers_and_schedule() {
        $bank = $this->bank();
        $cash = $this->bank('صندوق کارگاه', 'cash');
        $this->assertSame('11102', $cash['account_code']);
        $this->deposit($bank, 1000000000);

        // Payable cheque: notes payable, then cleared from the bank.
        $pr = $this->ok('accountant', 'POST', '/payment-requests', array('amount' => 200000000, 'beneficiary_name' => 'تأمین‌کننده', 'payable_type' => 'supplier', 'due_date' => $this->today), 201)['records']['payment_requests'][0];
        $pr = $this->ok('accountant2', 'POST', "/payment-requests/{$pr['id']}/approve", array('version' => 1))['records']['payment_requests'][0];
        $paid = $this->ok('accountant', 'POST', "/payment-requests/{$pr['id']}/pay", array('version' => $pr['version'], 'amount' => 200000000, 'account_id' => $bank['id'], 'method' => 'cheque', 'cheque_number' => '123456', 'cheque_due_date' => $this->today), 201);
        $cheque = $paid['records']['cheques'][0];
        $this->assertSame('pending', $cheque['status']);
        $this->assertSame(1000000000, Akph_Posting::balance('tre:' . $bank['id']), 'a cheque leaves the bank when it clears');
        $this->assertSame(-200000000, $this->ledger_sum("l.account_code = '21103'"));
        $schedule = $this->call('accountant', 'GET', '/treasury/schedule')->get_data();
        $this->assertContains('cheque', array_column($schedule['items'], 'kind'));
        $this->ok('accountant', 'POST', "/cheques/{$cheque['id']}/status", array('version' => 1, 'status' => 'cleared'));
        $this->assertSame(800000000, Akph_Posting::balance('tre:' . $bank['id']));
        $this->assertSame(0, $this->ledger_sum("l.account_code = '21103'"));
        $this->fails('accountant', 'POST', "/cheques/{$cheque['id']}/status", array('version' => 2, 'status' => 'bounced', 'note' => 'x'), 409);

        // Receivable cheque: approved by another user into notes receivable; one bounces, a second clears.
        $rec = $this->ok('accountant', 'POST', '/receipts', array('amount' => 50000000, 'receipt_type' => 'other_income', 'payer_name' => 'کارفرما', 'project_id' => $this->project['id'], 'account_id' => $bank['id'], 'method' => 'cheque', 'cheque_number' => '777'), 201)['records']['receipts'][0];
        $this->assertContains('receipt:' . $rec['id'], $this->approval_ids('senior'));
        $this->assertNotContains('receipt:' . $rec['id'], $this->approval_ids('accountant'));
        $this->fails('accountant', 'POST', "/receipts/{$rec['id']}/approve", array('version' => 1), 403, 'akph_segregation_of_duties');
        $approved = $this->ok('senior', 'POST', "/receipts/{$rec['id']}/approve", array('version' => 1));
        $rc = $approved['records']['cheques'][0];
        $this->assertSame(50000000, $this->ledger_sum("l.account_code = '11202'"));
        $this->fails('accountant', 'POST', "/cheques/{$rc['id']}/status", array('version' => 1, 'status' => 'bounced'), 400);
        $this->ok('accountant', 'POST', "/cheques/{$rc['id']}/status", array('version' => 1, 'status' => 'bounced', 'note' => 'کسری موجودی صادرکننده'));
        $this->assertSame(0, $this->ledger_sum("l.account_code = '11202'"));
        $this->assertSame(0, $this->ledger_sum("l.account_code = '11201'"), 'the receivable is back as before the receipt');

        // Rejected receipt posts nothing.
        $r2 = $this->ok('accountant', 'POST', '/receipts', array('amount' => 10, 'receipt_type' => 'advance', 'payer_name' => 'x', 'account_id' => $bank['id']), 201)['records']['receipts'][0];
        $this->ok('accountant2', 'POST', "/receipts/{$r2['id']}/reject", array('version' => 1, 'reason' => 'تکراری'));
        $this->assertSame(0, $this->ledger_sum("l.account_code = '21301'"));

        // Transfer bank → cash desk; not beyond the balance.
        $this->fails('accountant', 'POST', '/treasury/transfers', array('from_account_id' => $bank['id'], 'to_account_id' => $cash['id'], 'amount' => 800000001), 422);
        $this->fails('accountant', 'POST', '/treasury/transfers', array('from_account_id' => $bank['id'], 'to_account_id' => $bank['id'], 'amount' => 1), 400);
        $t = $this->ok('accountant', 'POST', '/treasury/transfers', array('from_account_id' => $bank['id'], 'to_account_id' => $cash['id'], 'amount' => 30000000, 'tracking' => 'X'), 201);
        $this->assertSame(770000000, Akph_Posting::balance('tre:' . $bank['id']));
        $this->assertSame(30000000, Akph_Posting::balance('tre:' . $cash['id']));
        $this->assertCount(1, $this->call('accountant', 'GET', '/treasury')->get_data()['transfers']);
        $this->assertNotEmpty($t['doc_number']);
        $this->assert_books_balance();
    }

    public function test_bank_reconciliation_matches_each_line_once_and_vouchers_need_a_second_user() {
        $bank = $this->bank();
        $this->deposit($bank, 250000000);
        $csv = "تاریخ,شرح,واریز,برداشت,پیگیری\n{$this->today},واریز مشتری,\"250,000,000\",,A1\n{$this->today},کارمزد,,25000,B2\n{$this->today},واریز دوم,250000000,,C3\n";
        $imported = $this->ok('accountant', 'POST', "/treasury/accounts/{$bank['id']}/statement", array('csv' => $csv), 201)['records']['bank_statement_lines'];
        $this->assertCount(3, $imported);
        $this->fails('accountant', 'POST', "/treasury/accounts/{$bank['id']}/statement", array('lines' => array(array('date' => 'x', 'deposit' => 1))), 400);

        $rec = $this->call('accountant', 'GET', "/treasury/accounts/{$bank['id']}/reconciliation")->get_data();
        $this->assertCount(1, $rec['unmatched_ledger_lines']);
        $ledger_line = $rec['unmatched_ledger_lines'][0]['line_id'];
        $this->fails('accountant', 'POST', "/bank-statement-lines/{$imported[1]['id']}/match", array('version' => 1, 'ledger_line_id' => $ledger_line), 422);
        $this->ok('accountant', 'POST', "/bank-statement-lines/{$imported[0]['id']}/match", array('version' => 1, 'ledger_line_id' => $ledger_line));
        $this->fails('accountant', 'POST', "/bank-statement-lines/{$imported[2]['id']}/match", array('version' => 1, 'ledger_line_id' => $ledger_line), 409);
        $this->fails('accountant', 'POST', "/bank-statement-lines/{$imported[0]['id']}/match", array('version' => 2, 'ledger_line_id' => $ledger_line), 409);

        // Fee without a document: pending voucher; rejected → the line is free again; then posted by another user.
        $v = $this->ok('accountant', 'POST', "/bank-statement-lines/{$imported[1]['id']}/voucher", array('version' => 1), 201);
        $entry = $v['records']['journal_entries'][0];
        $this->assertSame('pending', $entry['status']);
        $this->assertContains('bank_voucher:' . $entry['id'], $this->approval_ids('accountant2'));
        $this->ok('accountant2', 'POST', "/journal-entries/{$entry['id']}/reject", array('version' => 1, 'reason' => 'شرح کامل نیست'));
        $line = Akph_Treasury::statement_line_shape(Akph_Db::find(Akph_Schema::table('bank_statement_lines'), $imported[1]['id']));
        $this->assertSame('unmatched', $line['status']);
        $v = $this->ok('accountant', 'POST', "/bank-statement-lines/{$imported[1]['id']}/voucher", array('version' => $line['version']), 201);
        $entry = $v['records']['journal_entries'][0];
        $this->fails('accountant', 'POST', "/journal-entries/{$entry['id']}/post", array('version' => 1), 403, 'akph_segregation_of_duties');
        $this->ok('accountant2', 'POST', "/journal-entries/{$entry['id']}/post", array('version' => 1));
        $this->assertSame(249975000, Akph_Posting::balance('tre:' . $bank['id']));
        $this->assertSame(25000, $this->ledger_sum("l.account_code = '62101'"));
        $rec = $this->call('accountant', 'GET', "/treasury/accounts/{$bank['id']}/reconciliation")->get_data();
        $this->assertCount(0, $rec['unmatched_ledger_lines'], 'the voucher line counts as matched');
        $this->assertSame(array('matched', 'voucher', 'unmatched'), array_column($rec['statement_lines'], 'status'));
        $this->assert_books_balance();
    }

    public function test_approval_center_lists_only_what_the_user_may_approve_now() {
        $entry = $this->make_entry('accountant', $this->today);
        $this->assertSame(array(), $this->approvals('accountant'), 'own entry');
        $items = $this->approvals('accountant2');
        $this->assertSame(array('journal_entry:' . $entry['id']), array_column($items, 'id'));
        $item = $items[0];
        foreach (array('module', 'module_label', 'doc_number', 'amount', 'requester', 'date', 'stage', 'approve_path', 'reject_path', 'version') as $k) {
            $this->assertArrayHasKey($k, $item);
        }
        $this->assertSame('/journal-entries/' . $entry['id'] . '/post', $item['approve_path']);
        $this->assertSame('کاربر accountant', $item['requester']);
        $this->assertSame(array(), $this->approvals('pm'), 'a project manager does not approve journal entries');
        $this->ok('accountant2', 'POST', $item['approve_path'], array('version' => $item['version']));
        $this->assertSame(array(), $this->approvals('accountant2'));
        $this->assertStatus(401, $this->call('guest', 'GET', '/approvals'));
    }
}
