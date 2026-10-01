<?php
/**
 * 0.8.0 end-to-end scenario through the REST routes with the four portal roles, one project:
 * client contract → statement → receipt; subcontract → statement → payment; purchase → goods and service receipt →
 * vendor invoice → payment → store issue (consumption); petty cash replenishment and expense; payroll. At the end the
 * trial balance is balanced, inventory in the ledger equals the stock value, every payable that was paid is settled
 * and the project's profit and loss equals revenue minus the costs of the documents.
 */
class Test_Akph_End_To_End extends Akph_Test_Case {
    /** @var string */
    private $today;

    public function set_up() {
        parent::set_up();
        foreach (array(Akph_Treasury::OPTION, Akph_Procurement::OPTION, Akph_Payroll::OPTION, Akph_Petty_Cash::OPTION) as $option) {
            delete_option($option);
        }
        $this->install_chart();
        $this->today = Akph_Jalali::today_iso();
    }

    private function ok($who, $method, $path, $body = array(), $status = null, array $query = array()) {
        $this->login($who);
        $response = $this->request($method, $path, $method === 'GET' ? null : $body, array(), $query);
        if ($status !== null) {
            $this->assertStatus($status, $response, "{$method} {$path} as {$who}");
        } else {
            $this->assertContains($response->get_status(), array(200, 201), "{$method} {$path} as {$who}: " . wp_json_encode($response->get_data(), JSON_UNESCAPED_UNICODE));
        }
        return $response->get_data();
    }

    private function first($data, $slice) {
        return $data['records'][$slice][0];
    }

    /** Pays a payment request in full by `$payer` (never its approver). */
    private function pay($payer, array $pr, array $bank) {
        $pr = Akph_Treasury::request_shape(Akph_Db::find(Akph_Schema::table('payment_requests'), $pr['id']));
        $done = $this->ok($payer, 'POST', "/payment-requests/{$pr['id']}/pay", array('version' => $pr['version'], 'amount' => $pr['remaining_amount'], 'account_id' => $bank['id'], 'method' => 'transfer', 'tracking' => 'E2E'), 201);
        $this->assertSame('paid', $this->first($done, 'payment_requests')['status']);
        return $pr['remaining_amount'];
    }

    private function ledger_sum($where) {
        global $wpdb;
        return (int) $wpdb->get_var('SELECT COALESCE(SUM(l.debit) - SUM(l.credit), 0) FROM ' . Akph_Schema::table('ledger_lines') . ' l JOIN ' . Akph_Schema::table('ledger_entries') . " e ON e.id = l.entry_id WHERE e.status = 'posted' AND {$where}");
    }

    public function test_full_cycle_balanced_books_and_project_pnl() {
        $project = $this->make_project(array('name' => 'پروژه سراسری', 'manager_user_id' => self::$users['pm']));
        $pid = $project['id'];
        $center = $this->first($this->ok('accountant', 'POST', '/cost-centers', array('name' => 'کارگاه سراسری', 'project_id' => $pid, 'type' => 'project_site'), 201), 'cost_centers');
        $hq = $this->first($this->ok('accountant', 'POST', '/cost-centers', array('name' => 'ستاد', 'type' => 'headquarters'), 201), 'cost_centers');
        $client = $this->first($this->ok('accountant', 'POST', '/counterparties', array('kind' => 'client', 'name' => 'کارفرمای نمونه'), 201), 'counterparties');
        $sub = $this->first($this->ok('accountant', 'POST', '/counterparties', array('kind' => 'subcontractor', 'name' => 'پیمانکار نمونه'), 201), 'counterparties');
        $supplier = $this->first($this->ok('accountant', 'POST', '/counterparties', array('kind' => 'supplier', 'name' => 'فروشنده نمونه'), 201), 'counterparties');
        $bank = $this->first($this->ok('accountant', 'POST', '/treasury/accounts', array('kind' => 'bank', 'title' => 'بانک', 'bank_name' => 'بانک نمونه'), 201), 'treasury_accounts');

        // Capital in the bank (a treasury receipt approved by a second user).
        $rec = $this->first($this->ok('accountant', 'POST', '/receipts', array('amount' => 20000000000, 'receipt_type' => 'other_income', 'payer_name' => 'سرمایه', 'account_id' => $bank['id']), 201), 'receipts');
        $this->ok('accountant2', 'POST', "/receipts/{$rec['id']}/approve", array('version' => $rec['version']));

        // 1) Client contract → statement (four steps) → receipt from the employer.
        $c = $this->first($this->ok('accountant', 'POST', '/contracts', array('kind' => 'client', 'contract_no' => 'ک-۱', 'title' => 'اجرای سازه', 'project_id' => $pid, 'counterparty_id' => $client['id'],
            'retention_pct' => '5', 'lines' => array(array('description' => 'بتن‌ریزی', 'unit' => 'مترمکعب', 'quantity' => '1000', 'rate' => 5000000))), 201), 'contracts');
        $this->ok('senior', 'POST', "/contracts/{$c['id']}/approve", array('version' => 1));
        $s = $this->first($this->ok('pm', 'POST', '/client-statements', array('contract_id' => $c['id'], 'title' => 'موقت ۱', 'submit' => true, 'period_start' => $this->today, 'period_end' => $this->today,
            'lines' => array(array('contract_line_id' => $c['lines'][0]['id'], 'quantity' => '200.5'))), 201), 'statements');
        $this->ok('senior', 'POST', "/statements/{$s['id']}/approve", array('version' => $s['version']));
        $s = $this->first($this->ok('accountant', 'POST', "/statements/{$s['id']}/approve", array('version' => $s['version'] + 1, 'employer_ref' => 'ن-۱', 'employer_date' => $this->today)), 'statements');
        $this->assertSame('approved_by_employer', $s['status']);
        $revenue = $s['work_amount'];
        $this->assertSame(1002500000, $revenue);
        $rec = $this->first($this->ok('accountant', 'POST', '/receipts', array('amount' => $s['net_amount'], 'receipt_type' => 'statement', 'statement_id' => $s['id'], 'account_id' => $bank['id']), 201), 'receipts');
        $this->ok('accountant2', 'POST', "/receipts/{$rec['id']}/approve", array('version' => $rec['version']));
        $this->assertSame(0, Akph_Contracts::shape(Akph_Db::find(Akph_Schema::table('contracts'), $c['id']))['balance_due'], 'the employer paid the statement');

        // 2) Subcontract → statement (five steps) → payment by someone other than the approver.
        $sc = $this->first($this->ok('accountant', 'POST', '/contracts', array('kind' => 'subcontract', 'contract_no' => 'پ-۱', 'title' => 'قالب‌بندی', 'project_id' => $pid, 'cost_center_id' => $center['id'],
            'counterparty_id' => $sub['id'], 'trade_type' => 'قالب‌بندی', 'retention_pct' => '10', 'lines' => array(array('description' => 'قالب دیوار', 'unit' => 'مترمربع', 'quantity' => '500', 'rate' => 800000))), 201), 'contracts');
        $this->ok('pm', 'POST', "/contracts/{$sc['id']}/approve", array('version' => 1));
        $this->ok('senior', 'POST', "/contracts/{$sc['id']}/approve", array('version' => 2));
        $ss = $this->first($this->ok('pm', 'POST', '/subcontractor-statements', array('contract_id' => $sc['id'], 'title' => 'کارکرد ۱', 'period_start' => $this->today, 'period_end' => $this->today,
            'lines' => array(array('contract_line_id' => $sc['lines'][0]['id'], 'quantity' => '150.25'))), 201), 'statements');
        foreach (array('pm', 'senior', 'admin', 'accountant') as $i => $who) {
            $this->ok($who, 'POST', "/statements/{$ss['id']}/approve", array('version' => $i + 1));
        }
        $done = $this->ok('senior', 'POST', "/statements/{$ss['id']}/approve", array('version' => 5));
        $ss = $this->first($done, 'statements');
        $sub_cost = $ss['gross_amount'];
        $this->assertSame(120200000, $sub_cost);
        $this->pay('accountant', $this->first($done, 'payment_requests'), $bank);

        // 3) Purchase: requisition → RFQ → PO → goods and service receipt → invoice (3-way match) → payment → issue.
        $rebar = $this->first($this->ok('accountant', 'POST', '/materials', array('name' => 'میلگرد', 'unit' => 'kg'), 201), 'materials');
        $site = $this->first($this->ok('accountant', 'POST', '/warehouses', array('name' => 'انبار کارگاه', 'kind' => 'project', 'project_id' => $pid), 201), 'warehouses');
        $r = $this->first($this->ok('pm', 'POST', '/requisitions', array('project_id' => $pid, 'justification' => 'فونداسیون', 'lines' => array(
            array('kind' => 'goods', 'material_id' => $rebar['id'], 'quantity' => '2000', 'estimated_rate' => 500000),
            array('kind' => 'service', 'description' => 'اجاره جرثقیل', 'unit' => 'روز', 'quantity' => '3', 'estimated_rate' => 20000000, 'account_code' => '514'),
        )), 201), 'requisitions');
        $r = $this->first($this->ok('senior', 'POST', "/requisitions/{$r['id']}/approve", array('version' => 1)), 'requisitions');
        $r = $this->first($this->ok('accountant', 'POST', "/requisitions/{$r['id']}/approve", array('version' => 2)), 'requisitions');
        $rfq = $this->first($this->ok('accountant', 'POST', "/requisitions/{$r['id']}/rfqs", array(), 201), 'rfqs');
        $rfq = $this->first($this->ok('accountant', 'POST', "/rfqs/{$rfq['id']}/quotes", array('counterparty_id' => $supplier['id'], 'vat_included' => true, 'freight' => 5000000,
            'prices' => array(array('line_id' => $r['lines'][0]['id'], 'rate' => 450000), array('line_id' => $r['lines'][1]['id'], 'rate' => 20000000))), 201), 'rfqs');
        $rfq = $this->first($this->ok('accountant', 'POST', "/rfqs/{$rfq['id']}/award", array('quote_id' => $rfq['quotes'][0]['id'], 'version' => $rfq['version'])), 'rfqs');
        $po = $this->first($this->ok('accountant', 'POST', '/purchase-orders', array('rfq_id' => $rfq['id'], 'warehouse_id' => $site['id']), 201), 'purchase_orders');
        $po = $this->first($this->ok('senior', 'POST', "/purchase-orders/{$po['id']}/approve", array('version' => 1)), 'purchase_orders');
        $g = $this->first($this->ok('pm', 'POST', "/purchase-orders/{$po['id']}/receipts", array('lines' => array(
            array('po_line_id' => $po['lines'][0]['id'], 'delivered_qty' => '2000'), array('po_line_id' => $po['lines'][1]['id'], 'delivered_qty' => '3'),
        )), 201), 'goods_receipts');
        $this->assertSame(900000000, $g['goods_value']);
        $service_cost = $g['service_value'];
        $this->assertSame(60000000, $service_cost);
        $inv = $this->first($this->ok('accountant', 'POST', "/goods-receipts/{$g['id']}/invoices", array('invoice_no' => 'F-1', 'invoice_date' => $this->today,
            'subtotal' => 960000000, 'freight' => 5000000, 'vat_amount' => 96000000), 201), 'vendor_invoices');
        $this->assertSame('pending', $inv['status']);
        $approved = $this->ok('accountant2', 'POST', "/vendor-invoices/{$inv['id']}/approve", array('version' => $inv['version']));
        $inv = $this->first($approved, 'vendor_invoices');
        $this->assertSame(1061000000, $inv['total']);
        $this->pay('accountant', $this->first($approved, 'payment_requests'), $bank);
        $inv = Akph_Procurement::invoice_shape(Akph_Db::find(Akph_Schema::table('vendor_invoices'), $inv['id']));
        $this->assertSame(0, $inv['remaining_amount'], 'the supplier is paid');
        $issue = $this->first($this->ok('pm', 'POST', '/store-issues', array('warehouse_id' => $site['id'], 'lines' => array(array('material_id' => $rebar['id'], 'quantity' => '1200.75'))), 201), 'store_issues');
        $issue = $this->first($this->ok('senior', 'POST', "/store-issues/{$issue['id']}/confirm", array('version' => 1)), 'store_issues');
        $consumption = $issue['total_cost'];
        $this->assertSame(Akph_Qty::amount(1200750, 450000), $consumption, 'weighted average × quantity');

        // 4) Petty cash: fund, replenishment through the chain and treasury, an expense approved by the accountant.
        $fund = $this->first($this->ok('accountant', 'POST', '/petty-cash/funds', array('title' => 'تنخواه کارگاه', 'fund_type' => 'site_supervisor', 'project_id' => $pid,
            'holder_user_id' => (string) self::$users['pm'], 'holder_name' => 'متصدی', 'ceiling' => 3000000000, 'max_single_expense' => 1000000000), 201), 'petty_funds');
        $req = $this->first($this->ok('accountant', 'POST', '/petty-cash/requests', array('fund_id' => $fund['id'], 'amount' => 200000000, 'reason' => 'شارژ'), 201), 'petty_requests');
        $approvers = array(Akph_Flow::PM => 'pm', Akph_Flow::ACCOUNTANT => 'accountant2', Akph_Flow::SENIOR => 'senior');
        $last = null;
        foreach ($req['chain'] as $i => $step) {
            $last = $this->ok($approvers[$step], 'POST', "/petty-cash/requests/{$req['id']}/approve", array('version' => $i + 1));
        }
        $this->pay('accountant', $this->first($last, 'payment_requests'), $bank);
        $exp = $this->first($this->ok('pm', 'POST', '/petty-cash/expenses', array('fund_id' => $fund['id'], 'amount' => 45000000, 'date' => $this->today, 'description' => 'ابزار جزئی', 'vendor' => 'فروشگاه', 'invoice_number' => 'F-9'), 201), 'petty_expenses');
        $this->ok('accountant', 'POST', "/petty-cash/expenses/{$exp['id']}/approve", array('version' => 1));
        $petty_cost = 45000000;

        // 5) Payroll: one site worker (project cost) and one headquarters employee; both approvals; the three requests paid.
        $worker = $this->first($this->ok('accountant', 'POST', '/employees', array('full_name' => 'کارگر کارگاه', 'cost_center_id' => $center['id'], 'base_salary' => 250000000), 201), 'employees');
        $staff = $this->first($this->ok('accountant', 'POST', '/employees', array('full_name' => 'کارمند ستاد', 'cost_center_id' => $hq['id'], 'base_salary' => 400000000), 201), 'employees');
        $p = $this->first($this->ok('accountant', 'POST', '/payroll/periods', array('fiscal_year' => 1405, 'month' => 7), 201), 'payroll_periods');
        $p = $this->first($this->ok('accountant', 'POST', "/payroll/periods/{$p['id']}/timesheets", array('version' => $p['version'], 'timesheets' => array(
            array('employee_id' => $worker['id'], 'work_days' => '30', 'overtime_hours' => '10'), array('employee_id' => $staff['id'], 'work_days' => '30'),
        ))), 'payroll_periods');
        $calc = $this->ok('accountant', 'POST', "/payroll/periods/{$p['id']}/calculate", array('version' => $p['version']));
        $p = $this->first($calc, 'payroll_periods');
        $slips = array_column($calc['records']['payslips'], null, 'employee_id');
        $payroll_site_cost = $slips[$worker['id']]['cost'];
        $p = $this->first($this->ok('accountant2', 'POST', "/payroll/periods/{$p['id']}/approve", array('version' => $p['version'])), 'payroll_periods');
        $final = $this->ok('senior', 'POST', "/payroll/periods/{$p['id']}/approve", array('version' => $p['version']));
        $this->assertSame('approved', $this->first($final, 'payroll_periods')['status']);
        foreach ($final['records']['payment_requests'] as $pr) {
            $this->pay('accountant', $pr, $bank);
        }
        $this->assertSame(0, $this->ledger_sum("l.account_code IN ('21501', '21201', '21203')"), 'salaries, insurance and payroll tax settled');

        // Approval center is empty of this scenario's items; nothing is left half-way.
        foreach (array('senior', 'accountant', 'accountant2', 'pm', 'admin') as $who) {
            $this->assertSame(array(), $this->ok($who, 'GET', '/approvals')['items'], "no pending item for {$who}");
        }

        // Trial balance: balanced; inventory = stock value; payables of the paid documents settled.
        $tb = $this->ok('senior', 'GET', '/reports/trial-balance');
        $this->assertTrue($tb['balanced']);
        $this->assertSame($tb['totals']['debit'], $tb['totals']['credit']);
        $closing = array_column($tb['rows'], 'closing', 'account_code');
        global $wpdb;
        $stock = (int) $wpdb->get_var('SELECT COALESCE(SUM(stock_value), 0) FROM ' . Akph_Schema::table('materials'));
        $this->assertSame(900000000 - $consumption, $stock);
        $this->assertSame($stock, $closing['11501'], 'inventory in the ledger = stock value');
        $this->assertSame(0, isset($closing['21401']) ? $closing['21401'] : 0, 'goods received are all invoiced');
        $this->assertSame(0, isset($closing['21101']) ? $closing['21101'] : 0, 'the supplier is settled');
        $this->assertSame(0, isset($closing['11201']) ? $closing['11201'] : 0, 'the employer is settled');
        $this->assertSame(Akph_Posting::balance('tre:' . $bank['id']), $closing['11101'], 'bank in the ledger = treasury balance');
        $this->assertSame(200000000 - $petty_cost, $closing['11103'], 'petty cash fund after the expense');

        // Project P&L: revenue of the statement minus the project's costs (subcontract, service, consumption,
        // freight, petty cash, site payroll); stock that was not issued is not a cost.
        $ptb = $this->ok('senior', 'GET', '/reports/trial-balance', array(), null, array('project_id' => $pid));
        $income = 0;
        $expense = 0;
        foreach ($ptb['rows'] as $row) {
            if ($row['account_code'][0] === '4') {
                $income -= $row['closing'];
            } elseif (in_array($row['account_code'][0], array('5', '6'), true)) {
                $expense += $row['closing'];
            }
        }
        $this->assertSame($revenue, $income, 'project revenue = approved statement work');
        $this->assertSame($sub_cost + $service_cost + $consumption + 5000000 + $petty_cost + $payroll_site_cost, $expense, 'project costs from the documents');
        $this->assertSame(0, $this->ledger_sum("l.account_code = '51101' AND (l.project_id IS NULL OR l.project_id <> " . (int) $pid . ')'), 'consumption only on the project');
        $pm = $this->ok('pm', 'GET', '/reports/trial-balance', array(), null, array('project_id' => $pid));
        $this->assertSame($ptb['totals'], $pm['totals'], 'the project manager sees the same project figures');
        $this->assertSame(0, $this->ledger_sum('1=1'));
    }
}
