<?php
/**
 * 0.8.0: procurement and inventory through the REST routes with the four portal roles: requisition approvals,
 * RFQ and quotes, purchase order (VAT and freight on the server), goods and service receipt, vendor invoice with
 * three-way match (a stopped invoice is not approvable), payment through the treasury, store issue at weighted
 * average (the only project cost of goods), returns, transfer, stocktake approved by a second user; separation of
 * duties, project manager scope, idempotency, version conflicts, rollback, and the books balanced at the end with
 * inventory in the ledger equal to the stock value.
 */
class Test_Akph_Procurement_Inventory extends Akph_Test_Case {
    /** @var array */
    private $project;
    /** @var array */
    private $project2;
    /** @var array */
    private $center;
    /** @var array */
    private $supplier;
    /** @var array */
    private $supplier2;
    /** @var array */
    private $bank;
    /** @var array */
    private $rebar;
    /** @var array */
    private $cement;
    /** @var array */
    private $central;
    /** @var array */
    private $site;

    public function set_up() {
        parent::set_up();
        delete_option(Akph_Treasury::OPTION);
        delete_option(Akph_Procurement::OPTION);
        $this->install_chart();
        $this->project = $this->make_project(array('name' => 'پروژه یک', 'manager_user_id' => self::$users['pm']));
        $this->project2 = $this->make_project(array('name' => 'پروژه دو', 'manager_user_id' => self::$users['pm2']));
        $this->center = $this->ok('accountant', 'POST', '/cost-centers', array('name' => 'کارگاه یک', 'project_id' => $this->project['id'], 'type' => 'project_site'), 201)['records']['cost_centers'][0];
        $this->supplier = $this->ok('accountant', 'POST', '/counterparties', array('kind' => 'supplier', 'name' => 'فروشنده یک'), 201)['records']['counterparties'][0];
        $this->supplier2 = $this->ok('accountant', 'POST', '/counterparties', array('kind' => 'supplier', 'name' => 'فروشنده دو'), 201)['records']['counterparties'][0];
        $this->bank = $this->ok('accountant', 'POST', '/treasury/accounts', array('kind' => 'bank', 'title' => 'بانک', 'bank_name' => 'بانک نمونه'), 201)['records']['treasury_accounts'][0];
        $this->rebar = $this->ok('accountant', 'POST', '/materials', array('name' => 'میلگرد ۱۶', 'unit' => 'kg', 'category' => 'آهن‌آلات'), 201)['records']['materials'][0];
        $this->cement = $this->ok('accountant', 'POST', '/materials', array('name' => 'سیمان', 'unit' => 'تن', 'code' => 'CEM-01'), 201)['records']['materials'][0];
        $this->central = $this->ok('accountant', 'POST', '/warehouses', array('name' => 'انبار مرکزی', 'kind' => 'central'), 201)['records']['warehouses'][0];
        $this->site = $this->ok('accountant', 'POST', '/warehouses', array('name' => 'انبار کارگاه یک', 'kind' => 'project', 'project_id' => $this->project['id']), 201)['records']['warehouses'][0];
    }

    // ------------------------------------------------------------------ helpers

    private function call($who, $method, $path, $body = null, array $headers = array(), array $query = array()) {
        $this->login($who);
        return $this->request($method, $path, $body, $headers, $query);
    }

    private function ok($who, $method, $path, $body = array(), $status = null, array $query = array()) {
        $response = $this->call($who, $method, $path, $method === 'GET' ? null : $body, array(), $query);
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

    private function assert_books() {
        global $wpdb;
        $this->assertSame(0, $this->ledger_sum('1=1'), 'the whole ledger is balanced');
        $bad = $wpdb->get_var('SELECT COUNT(*) FROM (SELECT entry_id FROM ' . Akph_Schema::table('ledger_lines') . ' GROUP BY entry_id HAVING SUM(debit) <> SUM(credit)) x');
        $this->assertSame('0', (string) $bad, 'every entry is balanced');
        $stock = (int) $wpdb->get_var('SELECT COALESCE(SUM(stock_value), 0) FROM ' . Akph_Schema::table('materials'));
        $this->assertSame($stock, $this->ledger_sum("l.account_code = '11501'"), 'inventory in the ledger = stock value of the materials');
        $neg = (int) $wpdb->get_var('SELECT COUNT(*) FROM ' . Akph_Schema::table('stock_balances') . ' WHERE qty < 0 OR reserved < 0 OR reserved > qty');
        $this->assertSame(0, $neg, 'no negative stock, reservations within the stock');
    }

    private function balance($warehouse, $material) {
        global $wpdb;
        $b = $wpdb->get_row($wpdb->prepare('SELECT qty, reserved FROM ' . Akph_Schema::table('stock_balances') . ' WHERE warehouse_id = %d AND material_id = %d', $warehouse, $material));
        return $b ? array(Akph_Qty::to_string(Akph_Qty::from_db($b->qty)), Akph_Qty::to_string(Akph_Qty::from_db($b->reserved))) : array('0', '0');
    }

    private function material($id) {
        return Akph_Inventory::material_shape(Akph_Db::find(Akph_Schema::table('materials'), $id));
    }

    /** Requisition of project 1 (rebar 1000 kg + one service line), approved by both steps. */
    private function approved_requisition() {
        $r = $this->ok('pm', 'POST', '/requisitions', array(
            'project_id' => $this->project['id'], 'priority' => 'urgent', 'justification' => 'فونداسیون بلوک الف',
            'lines' => array(
                array('kind' => 'goods', 'material_id' => $this->rebar['id'], 'quantity' => '1000', 'estimated_rate' => 500000),
                array('kind' => 'service', 'description' => 'اجاره جرثقیل', 'unit' => 'روز', 'quantity' => '2', 'estimated_rate' => 30000000, 'account_code' => '514'),
            ),
        ), 201)['records']['requisitions'][0];
        $this->assertSame(500000000 + 60000000, $r['estimated_total']);
        $this->assertSame($this->center['id'], $r['cost_center_id'], 'the project cost center by default');
        $this->assertSame('مدیر پروژه', $r['current_step']);
        $r = $this->ok('senior', 'POST', "/requisitions/{$r['id']}/approve", array('version' => $r['version']))['records']['requisitions'][0];
        $r = $this->ok('accountant', 'POST', "/requisitions/{$r['id']}/approve", array('version' => $r['version']))['records']['requisitions'][0];
        $this->assertSame('approved', $r['status']);
        return $r;
    }

    /** Approved order from the winning quote (supplier 1, VAT included, freight 10,000,000). */
    private function approved_order() {
        $r = $this->approved_requisition();
        $rfq = $this->ok('accountant', 'POST', "/requisitions/{$r['id']}/rfqs", array('deadline' => Akph_Jalali::today_iso()), 201)['records']['rfqs'][0];
        $goods = $r['lines'][0]['id'];
        $service = $r['lines'][1]['id'];
        $this->ok('accountant', 'POST', "/rfqs/{$rfq['id']}/quotes", array('counterparty_id' => $this->supplier['id'], 'prices' => array(array('line_id' => $goods, 'rate' => 480000), array('line_id' => $service, 'rate' => 30000000)), 'vat_included' => true, 'freight' => 10000000, 'delivery_days' => 5), 201);
        $rfq = $this->ok('accountant', 'POST', "/rfqs/{$rfq['id']}/quotes", array('counterparty_id' => $this->supplier2['id'], 'prices' => array(array('line_id' => $goods, 'rate' => 490000), array('line_id' => $service, 'rate' => 31000000))), 201)['records']['rfqs'][0];
        $winner = array_values(array_filter($rfq['quotes'], function ($q) {
            return $q['counterparty_name'] === 'فروشنده یک';
        }))[0];
        $rfq = $this->ok('accountant', 'POST', "/rfqs/{$rfq['id']}/award", array('quote_id' => $winner['id'], 'version' => $rfq['version']))['records']['rfqs'][0];
        $po = $this->ok('accountant', 'POST', '/purchase-orders', array('rfq_id' => $rfq['id'], 'warehouse_id' => $this->site['id']), 201)['records']['purchase_orders'][0];
        $this->assertSame(480000000 + 60000000, $po['subtotal'], 'Σ round(quantity × rate) on the server');
        $this->assertSame(10, $po['vat_rate'], 'VAT at the rate of the settings');
        $this->assertSame(54000000, $po['vat_amount']);
        $this->assertSame(10000000, $po['freight']);
        $this->assertSame(540000000 + 54000000 + 10000000, $po['total']);
        $this->fails('accountant', 'POST', "/purchase-orders/{$po['id']}/approve", array('version' => 1), 403, 'akph_segregation_of_duties');
        $this->fails('pm', 'POST', "/purchase-orders/{$po['id']}/approve", array('version' => 1), 403);
        $po = $this->ok('senior', 'POST', "/purchase-orders/{$po['id']}/approve", array('version' => 1))['records']['purchase_orders'][0];
        $this->assertSame('approved', $po['status']);
        return $po;
    }

    // ------------------------------------------------------------------ tests

    public function test_purchase_receipt_invoice_payment_and_consumption() {
        // Requisition steps: the creator never approves; a PM of another project neither.
        $r = $this->ok('pm', 'POST', '/requisitions', array('project_id' => $this->project['id'], 'justification' => 'آزمون', 'lines' => array(array('material_id' => $this->rebar['id'], 'quantity' => '10'))), 201)['records']['requisitions'][0];
        $this->fails('pm', 'POST', "/requisitions/{$r['id']}/approve", array('version' => 1), 403, 'akph_segregation_of_duties');
        $this->fails('pm2', 'POST', "/requisitions/{$r['id']}/approve", array('version' => 1), 404);
        $this->fails('accountant', 'POST', "/requisitions/{$r['id']}/approve", array('version' => 1), 403);
        $r = $this->ok('senior', 'POST', "/requisitions/{$r['id']}/approve", array('version' => 1))['records']['requisitions'][0];
        $this->fails('senior', 'POST', "/requisitions/{$r['id']}/approve", array('version' => 2), 403, 'akph_segregation_of_duties');
        $this->fails('pm', 'POST', '/requisitions', array('project_id' => $this->project2['id'], 'justification' => 'x', 'lines' => array(array('material_id' => $this->rebar['id'], 'quantity' => '1'))), 403);
        $this->fails('pm', 'POST', '/requisitions', array('project_id' => $this->project['id'], 'justification' => 'x', 'lines' => array(array('material_id' => $this->rebar['id'], 'quantity' => '1', 'amount' => 5))), 400, 'akph_unknown_field');

        $po = $this->approved_order();
        $goods_line = $po['lines'][0]['id'];
        $service_line = $po['lines'][1]['id'];

        // Receipt: 650 delivered, 50 rejected → 600 accepted; the service for 2 days.
        $this->fails('pm', 'POST', "/purchase-orders/{$po['id']}/receipts", array('lines' => array(array('po_line_id' => $goods_line, 'delivered_qty' => '1100'))), 422);
        $this->fails('pm', 'POST', "/purchase-orders/{$po['id']}/receipts", array('lines' => array(array('po_line_id' => $goods_line, 'delivered_qty' => '10', 'rate' => 1))), 400, 'akph_unknown_field');
        $grn = $this->ok('pm', 'POST', "/purchase-orders/{$po['id']}/receipts", array('waybill' => 'B-1', 'lines' => array(array('po_line_id' => $goods_line, 'delivered_qty' => '650', 'rejected_qty' => '50'), array('po_line_id' => $service_line, 'delivered_qty' => '2'))), 201);
        $g = $grn['records']['goods_receipts'][0];
        $this->assertSame(288000000, $g['goods_value']);
        $this->assertSame(60000000, $g['service_value']);
        $lines = $this->entry_lines($g['entry']['id']);
        $this->assertSame(288000000, $lines['11501'], 'Dr inventory');
        $this->assertSame(60000000, $lines['514'], 'Dr the service cost account (project cost of a service)');
        $this->assertSame(-348000000, $lines['21401'], 'Cr goods received not invoiced');
        $this->assertArrayNotHasKey('51101', $lines, 'goods are not a project cost until issued');
        $this->assertSame(array('600', '0'), $this->balance($this->site['id'], $this->rebar['id']));
        $this->assertSame(480000, $this->material($this->rebar['id'])['average_cost']);
        $this->assertSame('partial', $grn['records']['purchase_orders'][0]['status']);

        // Vendor invoice: a mismatch is stopped and cannot be approved until corrected.
        $inv = $this->ok('accountant', 'POST', "/goods-receipts/{$g['id']}/invoices", array('invoice_no' => 'F-100', 'invoice_date' => Akph_Jalali::today_iso(), 'subtotal' => 400000000, 'freight' => 10000000, 'vat_amount' => 40000000), 201)['records']['vendor_invoices'][0];
        $this->assertSame('stopped', $inv['status']);
        $this->assertSame('mismatch', $inv['match_status']);
        $this->fails('accountant2', 'POST', "/vendor-invoices/{$inv['id']}/approve", array('version' => 1), 422);
        $this->fails('accountant', 'POST', "/goods-receipts/{$g['id']}/invoices", array('invoice_no' => 'F-101', 'invoice_date' => Akph_Jalali::today_iso(), 'subtotal' => 1), 422);
        $inv = $this->ok('accountant', 'POST', "/vendor-invoices/{$inv['id']}", array('subtotal' => 350000000, 'vat_amount' => 35000000, 'version' => 1))['records']['vendor_invoices'][0];
        $this->assertSame('pending', $inv['status'], 'within the 2% tolerance');
        $this->assertSame(2000000, $inv['price_variance']);
        $this->fails('accountant', 'POST', "/vendor-invoices/{$inv['id']}/approve", array('version' => 2), 403, 'akph_segregation_of_duties');
        $this->fails('pm', 'POST', "/vendor-invoices/{$inv['id']}/approve", array('version' => 2), 403);
        $approved = $this->ok('accountant2', 'POST', "/vendor-invoices/{$inv['id']}/approve", array('version' => 2));
        $inv = $approved['records']['vendor_invoices'][0];
        $this->assertSame('approved', $inv['status']);
        $lines = $this->entry_lines($inv['entry']['id']);
        $this->assertSame(348000000, $lines['21401'], 'GRNI cleared at receipt value');
        $this->assertSame(2000000, $lines['51102'], 'price variance');
        $this->assertSame(10000000, $lines['515'], 'freight');
        $this->assertSame(35000000, $lines['11304'], 'purchase VAT');
        $this->assertSame(-395000000, $lines['21101'], 'supplier payable = invoice total');
        $pr = $approved['records']['payment_requests'][0];
        $this->assertSame('approved', $pr['status']);
        $this->assertSame(395000000, $pr['amount']);
        $this->fails('accountant2', 'POST', "/payment-requests/{$pr['id']}/pay", array('amount' => 1000, 'account_id' => $this->bank['id'], 'version' => $pr['version']), 403, 'akph_segregation_of_duties');

        // Money in the bank, then payment by a user other than the approver.
        $rec = $this->ok('accountant', 'POST', '/receipts', array('amount' => 900000000, 'receipt_type' => 'other_income', 'payer_name' => 'سرمایه', 'account_id' => $this->bank['id']), 201)['records']['receipts'][0];
        $this->ok('accountant2', 'POST', "/receipts/{$rec['id']}/approve", array('version' => $rec['version']));
        $this->ok('accountant', 'POST', "/payment-requests/{$pr['id']}/pay", array('amount' => 100000000, 'account_id' => $this->bank['id'], 'version' => $pr['version']), 201);
        $inv = Akph_Procurement::invoice_shape(Akph_Db::find(Akph_Schema::table('vendor_invoices'), $inv['id']));
        $this->assertSame(100000000, $inv['paid_amount']);
        $this->assertSame(295000000, $inv['remaining_amount']);

        // Store issue: rows of one material are summed against the free stock; the requester never confirms.
        $this->fails('pm', 'POST', '/store-issues', array('warehouse_id' => $this->site['id'], 'lines' => array(array('material_id' => $this->rebar['id'], 'quantity' => '400'), array('material_id' => $this->rebar['id'], 'quantity' => '250'))), 422);
        $issue = $this->ok('pm', 'POST', '/store-issues', array('warehouse_id' => $this->site['id'], 'lines' => array(array('material_id' => $this->rebar['id'], 'quantity' => '100'), array('material_id' => $this->rebar['id'], 'quantity' => '100.5'))), 201)['records']['store_issues'][0];
        $this->assertSame(array('600', '200.5'), $this->balance($this->site['id'], $this->rebar['id']), 'reserved');
        $this->fails('pm', 'POST', "/store-issues/{$issue['id']}/confirm", array('version' => 1), 403, 'akph_segregation_of_duties');
        $this->fails('accountant', 'POST', "/store-issues/{$issue['id']}/confirm", array('version' => 1), 403);
        $confirmed = $this->ok('senior', 'POST', "/store-issues/{$issue['id']}/confirm", array('version' => 1));
        $issue = $confirmed['records']['store_issues'][0];
        $this->assertSame('issued', $issue['status']);
        $this->assertSame(Akph_Qty::amount(200500, 480000), $issue['total_cost'], 'weighted average × quantity');
        $lines = $this->entry_lines($issue['entry']['id']);
        $this->assertSame($issue['total_cost'], $lines['51101'], 'Dr project cost');
        $this->assertSame(-$issue['total_cost'], $lines['11501'], 'Cr inventory');
        $this->assertSame(array('399.5', '0'), $this->balance($this->site['id'], $this->rebar['id']));
        $this->assertSame($issue['total_cost'], $this->ledger_sum("l.account_code = '51101' AND l.project_id = " . (int) $this->project['id']));

        // Return from the project at the cost of the issue.
        $ret = $this->ok('pm', 'POST', "/store-issues/{$issue['id']}/returns", array('line_id' => $issue['lines'][0]['id'], 'quantity' => '20.5', 'reason' => 'مازاد'), 201);
        $this->assertSame(array('420', '0'), $this->balance($this->site['id'], $this->rebar['id']));
        $this->fails('pm', 'POST', "/store-issues/{$issue['id']}/returns", array('line_id' => $issue['lines'][0]['id'], 'quantity' => '181', 'reason' => 'x'), 422);

        // Return to the supplier after the invoice: payable, VAT and the payment request shrink.
        $this->fails('pm', 'POST', "/goods-receipts/{$g['id']}/returns", array('line_id' => $g['lines'][0]['id'], 'quantity' => '601', 'reason' => 'x'), 422);
        $back = $this->ok('pm', 'POST', "/goods-receipts/{$g['id']}/returns", array('line_id' => $g['lines'][0]['id'], 'quantity' => '100', 'reason' => 'معیوب'), 201);
        $sr = $back['records']['stock_returns'][0];
        $this->assertSame(48000000, $sr['amount']);
        $this->assertSame(4800000, $sr['vat_amount'], 'VAT of the invoice in proportion');
        $lines = $this->entry_lines($sr['entry']['id']);
        $this->assertSame(52800000, $lines['21101']);
        $this->assertSame(-4800000, $lines['11304']);
        $pr = $back['records']['payment_requests'][0];
        $this->assertSame(395000000 - 52800000, $pr['amount']);
        $this->assertSame(array('320', '0'), $this->balance($this->site['id'], $this->rebar['id']));

        // Transfer to the central warehouse; the PM of the project cannot see the central warehouse.
        $t = $this->ok('pm', 'POST', '/stock-transfers', array('source_warehouse_id' => $this->site['id'], 'target_warehouse_id' => $this->central['id'], 'lines' => array(array('material_id' => $this->rebar['id'], 'quantity' => '120'))), 201)['records']['stock_transfers'][0];
        $delivered = $this->ok('senior', 'POST', "/stock-transfers/{$t['id']}/deliver", array('version' => 1));
        $this->assertSame('delivered', $delivered['records']['stock_transfers'][0]['status']);
        $this->assertSame(array('200', '0'), $this->balance($this->site['id'], $this->rebar['id']));
        $this->assertSame(array('120', '0'), $this->balance($this->central['id'], $this->rebar['id']));
        $pm_view = $this->ok('pm', 'GET', '/inventory');
        $this->assertSame(array($this->site['id']), array_column($pm_view['warehouses'], 'id'), 'central warehouse outside the PM scope');
        $this->assertArrayNotHasKey('stock_value', $pm_view['materials'][0], 'values for office roles only');
        $this->assertSame(array(), $this->ok('pm2', 'GET', '/procurement')['requisitions'], 'other project');

        // Stocktake: shortage of 10 kg, approved by a second user; no posting before the approval.
        $st = $this->ok('accountant', 'POST', '/stocktakes', array('warehouse_id' => $this->site['id'], 'lines' => array(array('material_id' => $this->rebar['id'], 'quantity' => '190'))), 201)['records']['stocktakes'][0];
        $this->assertSame('pending', $st['status']);
        $this->assertSame(array('200', '0'), $this->balance($this->site['id'], $this->rebar['id']));
        $this->fails('accountant', 'POST', "/stocktakes/{$st['id']}/approve", array('version' => 1), 403, 'akph_segregation_of_duties');
        $done = $this->ok('accountant2', 'POST', "/stocktakes/{$st['id']}/approve", array('version' => 1));
        $st = $done['records']['stocktakes'][0];
        $this->assertGreaterThan(0, $st['loss_amount']);
        $this->assertSame(0, $st['gain_amount']);
        $lines = $this->entry_lines($st['entry']['id']);
        $this->assertSame($st['loss_amount'], $lines['62401']);
        $this->assertSame(array('190', '0'), $this->balance($this->site['id'], $this->rebar['id']));

        // Kardex: every move of the material with the resulting warehouse balance.
        $k = $this->ok('accountant', 'GET', '/inventory/kardex', null, null, array('material_id' => $this->rebar['id'], 'warehouse_id' => $this->site['id']))['kardex'];
        $this->assertSame(array('goods_receipt', 'store_issue', 'project_return', 'supplier_return', 'transfer_out', 'stocktake'), array_column($k, 'doc_type'));
        $this->assertSame('190', end($k)['balance_qty']);

        $this->assert_books();
    }

    public function test_approvals_center_idempotency_version_and_rollback() {
        $r = $this->ok('pm', 'POST', '/requisitions', array('project_id' => $this->project['id'], 'justification' => 'آزمون', 'lines' => array(array('material_id' => $this->cement['id'], 'quantity' => '5', 'estimated_rate' => 100))), 201)['records']['requisitions'][0];
        $ids = function ($who) {
            return array_column($this->ok($who, 'GET', '/approvals')['items'], 'id');
        };
        $this->assertContains('purchase_requisition:' . $r['id'], $ids('senior'));
        $this->assertNotContains('purchase_requisition:' . $r['id'], $ids('pm'), 'not the creator');
        $this->assertNotContains('purchase_requisition:' . $r['id'], $ids('accountant'), 'not the accountant step yet');

        // Idempotency: the same key returns the same answer and creates one record.
        $this->login('pm');
        $key = wp_generate_uuid4();
        $body = array('warehouse_id' => $this->site['id'], 'lines' => array(array('material_id' => $this->cement['id'], 'quantity' => '1')));
        $this->assertStatus(422, $this->request('POST', '/store-issues', $body, array('Idempotency-Key' => $key)));
        $po = $this->approved_order();
        $grn = $this->ok('pm', 'POST', "/purchase-orders/{$po['id']}/receipts", array('lines' => array(array('po_line_id' => $po['lines'][0]['id'], 'delivered_qty' => '10'))), 201)['records']['goods_receipts'][0];
        $this->login('pm');
        $key = wp_generate_uuid4();
        $body = array('warehouse_id' => $this->site['id'], 'lines' => array(array('material_id' => $this->rebar['id'], 'quantity' => '2')));
        $first = $this->request('POST', '/store-issues', $body, array('Idempotency-Key' => $key));
        $second = $this->request('POST', '/store-issues', $body, array('Idempotency-Key' => $key));
        $this->assertStatus(201, $first);
        $this->assertSame($first->get_data()['id'], $second->get_data()['id']);
        $this->assertSame(1, $this->count_rows('store_issues'));
        $this->assertSame(array('10', '2'), $this->balance($this->site['id'], $this->rebar['id']));
        $issue = $first->get_data()['records']['store_issues'][0];
        $this->assertContains('store_issue:' . $issue['id'], $ids('senior'));

        // Version conflict.
        $this->fails('senior', 'POST', "/store-issues/{$issue['id']}/confirm", array('version' => 7), 409);
        $this->ok('pm', 'POST', "/store-issues/{$issue['id']}/cancel", array('version' => 1, 'reason' => 'انصراف'));
        $this->assertSame(array('10', '0'), $this->balance($this->site['id'], $this->rebar['id']), 'reservation released');

        // Rollback: the freight account missing → the invoice approval stops and nothing is written.
        $inv = $this->ok('accountant', 'POST', "/goods-receipts/{$grn['id']}/invoices", array('invoice_no' => 'R-1', 'invoice_date' => Akph_Jalali::today_iso(), 'subtotal' => 4800000, 'freight' => 1000000, 'vat_amount' => 480000), 201)['records']['vendor_invoices'][0];
        $this->assertSame('pending', $inv['status']);
        global $wpdb;
        $accounts = Akph_Schema::table('ledger_accounts');
        $wpdb->query("UPDATE {$accounts} SET active = 0 WHERE code = '515'");
        $entries = $this->count_rows('ledger_entries');
        $requests = $this->count_rows('payment_requests');
        $this->fails('accountant2', 'POST', "/vendor-invoices/{$inv['id']}/approve", array('version' => 1), 422);
        $this->assertSame($entries, $this->count_rows('ledger_entries'), 'no entry');
        $this->assertSame($requests, $this->count_rows('payment_requests'), 'no payment request');
        $this->assertSame('pending', Akph_Db::find(Akph_Schema::table('vendor_invoices'), $inv['id'])->status);
        $wpdb->query("UPDATE {$accounts} SET active = 1 WHERE code = '515'");
        $this->ok('accountant2', 'POST', "/vendor-invoices/{$inv['id']}/approve", array('version' => 1));
        $this->assert_books();
    }

    public function test_master_data_and_scope() {
        $this->fails('pm', 'POST', '/materials', array('name' => 'x', 'unit' => 'kg'), 403);
        $this->fails('accountant', 'POST', '/materials', array('name' => 'x', 'unit' => 'kg', 'code' => 'CEM-01'), 409);
        $this->fails('accountant', 'POST', '/warehouses', array('name' => 'x', 'kind' => 'project'), 400);
        $this->fails('accountant', 'POST', '/warehouses', array('name' => 'x', 'kind' => 'central', 'project_id' => $this->project['id']), 400);
        $this->assertMatchesRegularExpression('/^MAT-\d{4}-\d{5}$/', $this->rebar['code']);
        $this->assertMatchesRegularExpression('/^WH-\d{4}-\d{5}$/', $this->site['code']);
        $m = $this->ok('accountant', 'POST', "/materials/{$this->rebar['id']}", array('reorder_level' => '50.5', 'version' => 1))['records']['materials'][0];
        $this->assertSame('50.5', $m['reorder_level']);
        $this->fails('accountant', 'POST', "/materials/{$this->rebar['id']}", array('name' => 'y', 'version' => 1), 409);
        $this->fails('pm2', 'POST', '/store-issues', array('warehouse_id' => $this->site['id'], 'lines' => array(array('material_id' => $this->rebar['id'], 'quantity' => '1'))), 404);
        $this->fails('accountant', 'POST', '/store-issues', array('warehouse_id' => $this->site['id'], 'lines' => array(array('material_id' => $this->rebar['id'], 'quantity' => '1'))), 403);
    }
}
