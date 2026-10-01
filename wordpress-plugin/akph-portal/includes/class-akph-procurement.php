<?php
/**
 * Procurement (0.8.0; reference: approveRequisition, createRfqFromRequisition, selectWinningBid,
 * createPurchaseOrderFromRfq, receiveGoodsFromPO, approveVendorInvoice, returnToSupplier in src/store;
 * docs/SERVER-RULES.md §7).
 *
 * - Requisition of a project (goods from the material list, or services with a cost account of group 5/6) →
 *   approval of the project manager → approval of purchasing / finance (accountant). Nobody approves own
 *   requisition or two consecutive steps.
 * - Request for quotation of an approved requisition, quotes of suppliers (a rate for every line), the winner.
 * - Purchase order from the winning quote (or from the approved requisition with typed rates): amounts, VAT at the
 *   rate of the settings and freight computed here; approved by the senior manager (not its creator).
 * - Goods receipt against an approved order: stock in at the order rate (weighted average moves); Dr inventory
 *   11501 / Cr goods received not invoiced 21401. Service receipt: Dr the line's cost account (project, cost
 *   center) / Cr 21401. Project cost of goods arises only when they are issued (Akph_Inventory).
 * - Vendor invoice of a receipt (three-way match: order, receipt, invoice). Price outside the tolerance, freight
 *   above the order, or VAT different from the order's rate stops the invoice («مغایرت و متوقف»), which cannot be
 *   approved until corrected. Approval (accountant, not the registrant): Dr 21401 at receipt value, price variance
 *   51102, freight 515, purchase VAT 11304 / Cr supplier payable 21101 → payment request in the treasury.
 * - Return to the supplier: stock out at weighted average; before the invoice Dr 21401, after it Dr 21101 with the
 *   VAT returned (11304) and the payment request reduced; the difference with the purchase price → 51102.
 */
if (!defined('ABSPATH')) {
    exit;
}

final class Akph_Procurement {
    const OPTION = 'akph_portal_procurement';
    const GRNI = '21401';
    const SUPPLIER_PAYABLE = '21101';
    const PURCHASE_VAT = '11304';
    const PRICE_VARIANCE = '51102';
    const FREIGHT = '515';
    const PRIORITIES = array('normal', 'urgent', 'critical');
    const QC = array('accepted', 'conditional', 'rejected');

    public static function t($name) {
        return Akph_Schema::table($name);
    }

    private static function now() {
        return Akph_Db::now_utc();
    }

    public static function chain() {
        return array(Akph_Flow::PM, Akph_Flow::ACCOUNTANT);
    }

    public static function settings() {
        $s = get_option(self::OPTION, array());
        $s = is_array($s) ? $s : array();
        return array(
            // Price variance of an invoice against its receipt tolerated before the invoice is stopped (basis points).
            'price_tolerance_bp' => isset($s['price_tolerance_bp']) && is_int($s['price_tolerance_bp']) ? $s['price_tolerance_bp'] : 200,
        );
    }

    public static function update_settings(array $body) {
        Akph_Auth::assert_cap(Akph_Roles::SETTINGS, 'تنظیمات خرید فقط با مجوز تنظیمات قابل تغییر است.');
        $before = self::settings();
        $bp = Akph_Qty::percent_bp($body, 'price_tolerance_pct', 'درصد مجاز مغایرت قیمت');
        $s = array('price_tolerance_bp' => $bp);
        update_option(self::OPTION, $s, false);
        Akph_Audit::log('procurement_settings_updated', 'settings', 0, $before, $s, 'procurement');
        return array('message' => 'تنظیمات خرید ذخیره شد.', 'records' => array('procurement_settings' => array(self::settings_shape())));
    }

    public static function settings_shape() {
        $s = self::settings();
        return array('price_tolerance_pct' => Akph_Qty::bp_string($s['price_tolerance_bp']), 'vat_rate_percent' => Akph_Treasury::settings()['vat_rate_percent']);
    }

    // ------------------------------------------------------------------ shapes

    private static function lines($table, $key, $id) {
        global $wpdb;
        return (array) Akph_Db::results($wpdb->prepare('SELECT * FROM ' . self::t($table) . " WHERE {$key} = %d ORDER BY id", $id));
    }

    private static function party_name($id) {
        $c = $id ? Akph_Db::find(self::t('counterparties'), $id) : null;
        return $c ? $c->name : '';
    }

    private static function project_name($id) {
        $p = $id ? Akph_Db::find(self::t('projects'), $id) : null;
        return $p ? $p->name : '';
    }

    public static function requisition_shape($r) {
        $chain = Akph_Flow::chain($r->chain);
        $lines = array();
        foreach (self::lines('requisition_lines', 'requisition_id', $r->id) as $l) {
            $qty = Akph_Qty::from_db($l->quantity);
            $lines[] = array(
                'id' => (string) $l->id,
                'kind' => $l->kind,
                'material_id' => $l->material_id ? (string) $l->material_id : null,
                'account_code' => $l->account_code,
                'description' => $l->description,
                'unit' => $l->unit,
                'quantity' => Akph_Qty::to_string($qty),
                'estimated_rate' => (int) $l->estimated_rate,
                'estimated_amount' => Akph_Qty::amount($qty, $l->estimated_rate),
            );
        }
        return array(
            'id' => (string) $r->id,
            'number' => $r->number,
            'project_id' => (string) $r->project_id,
            'project_name' => self::project_name($r->project_id),
            'cost_center_id' => $r->cost_center_id ? (string) $r->cost_center_id : null,
            'priority' => $r->priority,
            'needed_date' => $r->needed_date,
            'justification' => $r->justification,
            'estimated_total' => (int) $r->estimated_total,
            'status' => $r->status,
            'chain' => $chain,
            'step_index' => (int) $r->step_index,
            'current_step' => $r->status === 'pending' && isset($chain[(int) $r->step_index]) ? $chain[(int) $r->step_index] : null,
            'history' => Akph_Flow::history($r->history),
            'last_approved_by' => $r->last_approved_by ? (string) $r->last_approved_by : null,
            'reject_reason' => $r->reject_reason,
            'lines' => $lines,
            'created_by' => (string) $r->created_by,
            'created_by_name' => Akph_Flow::user_name($r->created_by),
            'created_at' => Akph_Db::iso_time($r->created_at),
            'version' => (int) $r->version,
        );
    }

    public static function rfq_shape($q) {
        $quotes = array();
        foreach (self::lines('rfq_quotes', 'rfq_id', $q->id) as $x) {
            $prices = json_decode((string) $x->prices, true);
            $quotes[] = array(
                'id' => (string) $x->id,
                'counterparty_id' => (string) $x->counterparty_id,
                'counterparty_name' => self::party_name($x->counterparty_id),
                'reference' => $x->reference,
                'prices' => is_array($prices) ? array_map(function ($p) {
                    return array('line_id' => (string) $p['line_id'], 'rate' => (int) $p['rate']);
                }, $prices) : array(),
                'vat_included' => (bool) (int) $x->vat_included,
                'freight' => (int) $x->freight,
                'delivery_days' => (int) $x->delivery_days,
                'payment_terms' => $x->payment_terms,
                'notes' => $x->notes,
                'subtotal' => (int) $x->subtotal,
                'winner' => (int) $x->id === (int) $q->winner_quote_id,
            );
        }
        $r = Akph_Db::find(self::t('requisitions'), $q->requisition_id);
        return array(
            'id' => (string) $q->id,
            'number' => $q->number,
            'requisition_id' => (string) $q->requisition_id,
            'requisition_number' => $r ? $r->number : '',
            'project_id' => (string) $q->project_id,
            'project_name' => self::project_name($q->project_id),
            'title' => $q->title,
            'deadline' => $q->deadline,
            'status' => $q->status,
            'winner_quote_id' => $q->winner_quote_id ? (string) $q->winner_quote_id : null,
            'quotes' => $quotes,
            'created_by' => (string) $q->created_by,
            'version' => (int) $q->version,
        );
    }

    public static function po_shape($o) {
        $lines = array();
        foreach (self::lines('po_lines', 'po_id', $o->id) as $l) {
            $lines[] = array(
                'id' => (string) $l->id,
                'requisition_line_id' => $l->requisition_line_id ? (string) $l->requisition_line_id : null,
                'kind' => $l->kind,
                'material_id' => $l->material_id ? (string) $l->material_id : null,
                'account_code' => $l->account_code,
                'description' => $l->description,
                'unit' => $l->unit,
                'quantity' => Akph_Qty::to_string(Akph_Qty::from_db($l->quantity)),
                'rate' => (int) $l->rate,
                'amount' => (int) $l->amount,
                'vat_amount' => (int) $l->vat_amount,
                'received_qty' => Akph_Qty::to_string(Akph_Qty::from_db($l->received_qty)),
            );
        }
        $w = $o->warehouse_id ? Akph_Db::find(self::t('warehouses'), $o->warehouse_id) : null;
        return array(
            'id' => (string) $o->id,
            'number' => $o->number,
            'requisition_id' => (string) $o->requisition_id,
            'rfq_id' => $o->rfq_id ? (string) $o->rfq_id : null,
            'project_id' => (string) $o->project_id,
            'project_name' => self::project_name($o->project_id),
            'cost_center_id' => $o->cost_center_id ? (string) $o->cost_center_id : null,
            'counterparty_id' => (string) $o->counterparty_id,
            'counterparty_name' => self::party_name($o->counterparty_id),
            'warehouse_id' => $o->warehouse_id ? (string) $o->warehouse_id : null,
            'warehouse_name' => $w ? $w->name : '',
            'issue_date' => $o->issue_date,
            'due_date' => $o->due_date,
            'payment_terms' => $o->payment_terms,
            'vat_rate' => (int) $o->vat_rate,
            'subtotal' => (int) $o->subtotal,
            'vat_amount' => (int) $o->vat_amount,
            'freight' => (int) $o->freight,
            'total' => (int) $o->total,
            'status' => $o->status,
            'current_step' => $o->status === 'pending' ? Akph_Flow::SENIOR : null,
            'history' => Akph_Flow::history($o->history),
            'approved_by' => $o->approved_by ? (string) $o->approved_by : null,
            'approved_by_name' => Akph_Flow::user_name($o->approved_by),
            'reject_reason' => $o->reject_reason,
            'notes' => $o->notes,
            'lines' => $lines,
            'created_by' => (string) $o->created_by,
            'created_by_name' => Akph_Flow::user_name($o->created_by),
            'version' => (int) $o->version,
        );
    }

    public static function grn_shape($g) {
        $lines = array();
        foreach (self::lines('grn_lines', 'grn_id', $g->id) as $l) {
            $pl = Akph_Db::find(self::t('po_lines'), $l->po_line_id);
            $lines[] = array(
                'id' => (string) $l->id,
                'po_line_id' => (string) $l->po_line_id,
                'kind' => $l->kind,
                'material_id' => $l->material_id ? (string) $l->material_id : null,
                'description' => $pl ? $pl->description : '',
                'unit' => $pl ? $pl->unit : '',
                'delivered_qty' => Akph_Qty::to_string(Akph_Qty::from_db($l->delivered_qty)),
                'rejected_qty' => Akph_Qty::to_string(Akph_Qty::from_db($l->rejected_qty)),
                'accepted_qty' => Akph_Qty::to_string(Akph_Qty::from_db($l->accepted_qty)),
                'rate' => (int) $l->rate,
                'amount' => (int) $l->amount,
                'returned_qty' => Akph_Qty::to_string(Akph_Qty::from_db($l->returned_qty)),
                'returned_amount' => (int) $l->returned_amount,
            );
        }
        $o = Akph_Db::find(self::t('purchase_orders'), $g->po_id);
        $w = $g->warehouse_id ? Akph_Db::find(self::t('warehouses'), $g->warehouse_id) : null;
        return array(
            'id' => (string) $g->id,
            'number' => $g->number,
            'po_id' => (string) $g->po_id,
            'po_number' => $o ? $o->number : '',
            'warehouse_id' => $g->warehouse_id ? (string) $g->warehouse_id : null,
            'warehouse_name' => $w ? $w->name : '',
            'project_id' => (string) $g->project_id,
            'project_name' => self::project_name($g->project_id),
            'cost_center_id' => $g->cost_center_id ? (string) $g->cost_center_id : null,
            'counterparty_id' => (string) $g->counterparty_id,
            'counterparty_name' => self::party_name($g->counterparty_id),
            'date' => $g->receipt_date,
            'waybill' => $g->waybill,
            'qc_status' => $g->qc_status,
            'notes' => $g->notes,
            'goods_value' => (int) $g->goods_value,
            'service_value' => (int) $g->service_value,
            'total' => (int) $g->total,
            'lines' => $lines,
            'invoice_id' => self::invoice_of_grn($g->id),
            'created_by' => (string) $g->created_by,
            'created_by_name' => Akph_Flow::user_name($g->created_by),
            'entry' => Akph_Posting::entry_ref($g->entry_id),
        );
    }

    private static function invoice_of_grn($grn_id) {
        global $wpdb;
        $id = Akph_Db::value($wpdb->prepare('SELECT id FROM ' . self::t('vendor_invoices') . " WHERE grn_id = %d AND status <> 'rejected' ORDER BY id DESC LIMIT 1", $grn_id));
        return $id ? (string) $id : null;
    }

    public static function invoice_shape($i) {
        $pr = $i->payment_request_id ? Akph_Db::find(self::t('payment_requests'), $i->payment_request_id) : null;
        $g = Akph_Db::find(self::t('goods_receipts'), $i->grn_id);
        $o = Akph_Db::find(self::t('purchase_orders'), $i->po_id);
        $paid = $pr ? (int) $pr->paid_amount : 0;
        $owed = (int) $i->total - (int) $i->returned_amount;
        return array(
            'id' => (string) $i->id,
            'number' => $i->number,
            'invoice_no' => $i->invoice_no,
            'invoice_date' => $i->invoice_date,
            'due_date' => $i->due_date,
            'grn_id' => (string) $i->grn_id,
            'grn_number' => $g ? $g->number : '',
            'po_id' => (string) $i->po_id,
            'po_number' => $o ? $o->number : '',
            'project_id' => (string) $i->project_id,
            'project_name' => self::project_name($i->project_id),
            'cost_center_id' => $i->cost_center_id ? (string) $i->cost_center_id : null,
            'counterparty_id' => (string) $i->counterparty_id,
            'counterparty_name' => self::party_name($i->counterparty_id),
            'subtotal' => (int) $i->subtotal,
            'freight' => (int) $i->freight,
            'vat_amount' => (int) $i->vat_amount,
            'total' => (int) $i->total,
            'receipt_value' => (int) $i->receipt_value,
            'price_variance' => (int) $i->price_variance,
            'match_status' => $i->match_status,
            'match_notes' => $i->match_notes,
            'status' => $i->status,
            'returned_amount' => (int) $i->returned_amount,
            'paid_amount' => $paid,
            'remaining_amount' => $i->status === 'approved' ? max(0, $owed - $paid) : $owed,
            'payment_request' => $pr ? array('id' => (string) $pr->id, 'number' => $pr->number, 'status' => $pr->status, 'amount' => (int) $pr->amount, 'paid_amount' => (int) $pr->paid_amount) : null,
            'notes' => $i->notes,
            'reject_reason' => $i->reject_reason,
            'created_by' => (string) $i->created_by,
            'created_by_name' => Akph_Flow::user_name($i->created_by),
            'approved_by' => $i->approved_by ? (string) $i->approved_by : null,
            'approved_by_name' => Akph_Flow::user_name($i->approved_by),
            'entry' => Akph_Posting::entry_ref($i->entry_id),
            'version' => (int) $i->version,
        );
    }

    public static function overview() {
        $scope = Akph_Auth::project_scope_sql('project_id');
        $q = function ($table, $shape, $limit = 1000) use ($scope) {
            return array_map(array(__CLASS__, $shape), (array) Akph_Db::results('SELECT * FROM ' . self::t($table) . " WHERE {$scope} ORDER BY id DESC LIMIT {$limit}"));
        };
        return array(
            'requisitions' => $q('requisitions', 'requisition_shape'),
            'rfqs' => $q('rfqs', 'rfq_shape'),
            'purchase_orders' => $q('purchase_orders', 'po_shape'),
            'goods_receipts' => $q('goods_receipts', 'grn_shape'),
            'vendor_invoices' => $q('vendor_invoices', 'invoice_shape'),
            'supplier_returns' => array_map(array('Akph_Inventory', 'return_shape'), (array) Akph_Db::results('SELECT * FROM ' . self::t('stock_returns') . " WHERE kind = 'warehouse_to_supplier' AND " . Akph_Auth::project_scope_sql('project_id') . ' ORDER BY id DESC LIMIT 1000')),
            'settings' => self::settings_shape(),
        );
    }

    // ------------------------------------------------------------------ requisitions

    /** Account of a service line: a postable account of group 5 (project costs) or 6. */
    private static function service_account($code, $n) {
        $code = trim((string) $code);
        if ($code === '' || !in_array($code[0], array('5', '6'), true)) {
            throw Akph_Error::invalid('حساب هزینه خدمت ردیف ' . $n . ' باید از گروه ۵ یا ۶ باشد.', array('field' => 'lines'));
        }
        Akph_Posting::assert_postable($code, 'lines', 'حساب هزینه ردیف ' . $n);
        return $code;
    }

    private static function parse_requisition_lines($body) {
        if (!isset($body['lines']) || !is_array($body['lines']) || !$body['lines'] || count($body['lines']) > 200) {
            throw Akph_Error::invalid('ردیف‌های درخواست (حداقل یک، حداکثر ۲۰۰) لازم است.', array('field' => 'lines'));
        }
        $out = array();
        foreach (array_values($body['lines']) as $i => $l) {
            $n = $i + 1;
            if (!is_array($l)) {
                throw Akph_Error::invalid('ردیف ' . $n . ' نامعتبر است.', array('field' => 'lines'));
            }
            foreach (array_keys($l) as $k) {
                if (!in_array($k, array('kind', 'material_id', 'account_code', 'description', 'unit', 'quantity', 'estimated_rate'), true)) {
                    throw new Akph_Error('akph_unknown_field', 'فیلد ناشناخته در ردیف: ' . $k, 400, array('field' => 'lines'));
                }
            }
            $kind = Akph_Input::one_of($l, 'kind', array('goods', 'service'), 'goods');
            $qty = Akph_Qty::parse(isset($l['quantity']) ? $l['quantity'] : null, 'lines', 'مقدار ردیف ' . $n);
            if ($qty <= 0) {
                throw Akph_Error::invalid('مقدار ردیف ' . $n . ' باید مثبت باشد.', array('field' => 'lines'));
            }
            $rate = isset($l['estimated_rate']) && $l['estimated_rate'] !== '' ? Akph_Input::parse_amount($l['estimated_rate'], 'برآورد نرخ ردیف ' . $n, 'lines') : 0;
            if ($kind === 'goods') {
                $mid = Akph_Input::id($l, 'material_id', false);
                $m = Akph_Db::find(self::t('materials'), $mid);
                if (!$m || !(int) $m->active) {
                    throw Akph_Error::invalid('کالای ردیف ' . $n . ' در فهرست کالاها نیست.', array('field' => 'lines'));
                }
                $out[] = array('kind' => 'goods', 'material_id' => $mid, 'account_code' => '', 'description' => Akph_Input::text($l, 'description', 300) ?: $m->name, 'unit' => $m->unit, 'quantity' => Akph_Qty::to_string($qty), 'estimated_rate' => $rate, '_amount' => Akph_Qty::amount($qty, $rate));
            } else {
                $out[] = array('kind' => 'service', 'material_id' => null, 'account_code' => self::service_account(isset($l['account_code']) ? $l['account_code'] : '', $n), 'description' => Akph_Input::text($l, 'description', 300, true, 'شرح خدمت ردیف ' . $n), 'unit' => Akph_Input::text($l, 'unit', 32, true, 'واحد ردیف ' . $n), 'quantity' => Akph_Qty::to_string($qty), 'estimated_rate' => $rate, '_amount' => Akph_Qty::amount($qty, $rate));
            }
        }
        return $out;
    }

    public static function create_requisition(array $body) {
        Akph_Auth::assert_cap(Akph_Roles::PROCUREMENT_REQUEST, 'درخواست خرید با مدیر پروژه، مدیر ارشد یا مدیر سیستم است.');
        $year = Akph_Jalali::fiscal_year(Akph_Jalali::today_iso());
        Akph_Numbering::lock('REQ', $year);
        $project = Akph_Input::id($body, 'project_id', false);
        if (!Akph_Db::find(self::t('projects'), $project)) {
            throw Akph_Error::invalid('پروژه پیدا نشد.', array('field' => 'project_id'));
        }
        Akph_Auth::assert_project($project);
        $lines = self::parse_requisition_lines($body);
        $total = 0;
        foreach ($lines as $l) {
            $total += $l['_amount'];
        }
        $now = self::now();
        $id = Akph_Db::insert(self::t('requisitions'), array(
            'project_id' => $project,
            'cost_center_id' => self::cost_center($body, $project),
            'priority' => Akph_Input::one_of($body, 'priority', self::PRIORITIES, 'normal'),
            'needed_date' => Akph_Input::iso_date($body, 'needed_date', false),
            'justification' => Akph_Input::text($body, 'justification', 1000, true, 'علت نیاز'),
            'estimated_total' => $total,
            'status' => 'pending',
            'chain' => implode('|', self::chain()),
            'step_index' => 0,
            'history' => Akph_Flow::push_history('[]', 'submitted', 'ثبت درخواست خرید'),
            'created_by' => get_current_user_id(),
            'version' => 1,
            'created_at' => $now,
            'updated_at' => $now,
        ));
        foreach ($lines as $l) {
            unset($l['_amount']);
            Akph_Db::insert(self::t('requisition_lines'), $l + array('requisition_id' => $id));
        }
        $number = Akph_Numbering::issue('REQ', $year, 'requisition', $id);
        Akph_Db::update(self::t('requisitions'), array('number' => $number), array('id' => $id));
        $r = Akph_Db::find(self::t('requisitions'), $id);
        Akph_Audit::log('requisition_created', 'requisition', $id, null, (array) $r, $number);
        return array('status' => 201, 'message' => 'درخواست خرید ' . $number . ' ثبت شد و در انتظار تأیید مدیر پروژه است.', 'id' => $id, 'doc_number' => $number, 'records' => array('requisitions' => array(self::requisition_shape($r))));
    }

    private static function cost_center($body, $project) {
        $cc = Akph_Input::id($body, 'cost_center_id');
        if ($cc) {
            $c = Akph_Db::find(self::t('cost_centers'), $cc);
            if (!$c || ($c->project_id && (int) $c->project_id !== (int) $project)) {
                throw Akph_Error::invalid('مرکز هزینه متعلق به این پروژه نیست.', array('field' => 'cost_center_id'));
            }
            return $cc;
        }
        global $wpdb;
        $first = Akph_Db::value($wpdb->prepare('SELECT id FROM ' . self::t('cost_centers') . ' WHERE project_id = %d ORDER BY id LIMIT 1', $project));
        return $first ? (int) $first : null;
    }

    private static function requisition_or_404($id) {
        $r = Akph_Db::lock(self::t('requisitions'), $id);
        if (!$r || !Akph_Auth::can_access_project($r->project_id)) {
            throw Akph_Error::not_found('درخواست خرید پیدا نشد.');
        }
        return $r;
    }

    public static function approve_requisition($id, array $body, $version) {
        Akph_Auth::assert_cap(Akph_Roles::PROCUREMENT_APPROVE, 'اجازه تأیید درخواست خرید را ندارید.');
        $comment = Akph_Input::text($body, 'comment', 1000);
        $r = self::requisition_or_404($id);
        Akph_Input::assert_version($r, $version);
        if ($r->status !== 'pending') {
            throw Akph_Error::conflict('این درخواست در انتظار تأیید نیست.', array('status' => $r->status));
        }
        $chain = Akph_Flow::chain($r->chain);
        $step = $chain[(int) $r->step_index];
        Akph_Flow::assert_step($step, $r->project_id, $r->created_by, $r->last_approved_by);
        $final = (int) $r->step_index + 1 >= count($chain);
        Akph_Db::update(self::t('requisitions'), array(
            'status' => $final ? 'approved' : 'pending',
            'step_index' => (int) $r->step_index + 1,
            'last_approved_by' => get_current_user_id(),
            'history' => Akph_Flow::push_history($r->history, 'approved', $step, $comment),
            'version' => (int) $r->version + 1,
            'updated_at' => self::now(),
        ), array('id' => $r->id));
        $after = Akph_Db::find(self::t('requisitions'), $r->id);
        Akph_Audit::log('requisition_approved', 'requisition', $r->id, (array) $r, (array) $after, $r->number);
        return array('message' => $final ? 'درخواست خرید ' . $r->number . ' تأیید نهایی شد و آماده استعلام بها است.' : 'تأیید ' . $step . ' ثبت شد؛ مرحله بعد: ' . $chain[(int) $r->step_index + 1] . '.', 'id' => $r->id, 'records' => array('requisitions' => array(self::requisition_shape($after))));
    }

    public static function reject_requisition($id, array $body, $version) {
        Akph_Auth::assert_cap(Akph_Roles::PROCUREMENT_APPROVE, 'اجازه رد درخواست خرید را ندارید.');
        $reason = Akph_Input::text($body, 'reason', 1000, true, 'علت رد');
        $r = self::requisition_or_404($id);
        Akph_Input::assert_version($r, $version);
        if ($r->status !== 'pending') {
            throw Akph_Error::conflict('این درخواست در انتظار تأیید نیست.', array('status' => $r->status));
        }
        $step = Akph_Flow::chain($r->chain)[(int) $r->step_index];
        Akph_Flow::assert_step($step, $r->project_id, $r->created_by, $r->last_approved_by);
        Akph_Db::update(self::t('requisitions'), array('status' => 'rejected', 'reject_reason' => $reason, 'history' => Akph_Flow::push_history($r->history, 'rejected', $step, $reason), 'version' => (int) $r->version + 1, 'updated_at' => self::now()), array('id' => $r->id));
        $after = Akph_Db::find(self::t('requisitions'), $r->id);
        Akph_Audit::log('requisition_rejected', 'requisition', $r->id, (array) $r, (array) $after, $r->number);
        return array('message' => 'درخواست خرید ' . $r->number . ' رد شد.', 'id' => $r->id, 'records' => array('requisitions' => array(self::requisition_shape($after))));
    }

    public static function cancel_requisition($id, array $body, $version) {
        Akph_Auth::assert_cap(Akph_Roles::PROCUREMENT_REQUEST, 'اجازه لغو درخواست خرید را ندارید.');
        $r = self::requisition_or_404($id);
        Akph_Input::assert_version($r, $version);
        if (!in_array($r->status, array('pending', 'approved'), true)) {
            throw Akph_Error::conflict('درخواستی که استعلام یا سفارش دارد لغو نمی‌شود.', array('status' => $r->status));
        }
        Akph_Db::update(self::t('requisitions'), array('status' => 'cancelled', 'history' => Akph_Flow::push_history($r->history, 'cancelled', 'لغو', Akph_Input::text($body, 'reason', 1000)), 'version' => (int) $r->version + 1, 'updated_at' => self::now()), array('id' => $r->id));
        $after = Akph_Db::find(self::t('requisitions'), $r->id);
        Akph_Audit::log('requisition_cancelled', 'requisition', $r->id, (array) $r, (array) $after, $r->number);
        return array('message' => 'درخواست خرید ' . $r->number . ' لغو شد.', 'id' => $r->id, 'records' => array('requisitions' => array(self::requisition_shape($after))));
    }

    // ------------------------------------------------------------------ RFQ and quotes

    private static function assert_manage() {
        Akph_Auth::assert_cap(Akph_Roles::PROCUREMENT_MANAGE, 'استعلام، سفارش و فاکتور خرید با حسابدار، مدیر ارشد یا مدیر سیستم است.');
    }

    public static function create_rfq($requisition_id, array $body) {
        self::assert_manage();
        $year = Akph_Jalali::fiscal_year(Akph_Jalali::today_iso());
        Akph_Numbering::lock('RFQ', $year);
        $r = self::requisition_or_404($requisition_id);
        if (!in_array($r->status, array('approved', 'rfq'), true)) {
            throw Akph_Error::rule('استعلام فقط برای درخواست تأییدشده صادر می‌شود.', array('status' => $r->status));
        }
        global $wpdb;
        if ((int) Akph_Db::value($wpdb->prepare('SELECT COUNT(*) FROM ' . self::t('rfqs') . " WHERE requisition_id = %d AND status IN ('open','awarded')", $r->id)) > 0) {
            throw Akph_Error::rule('برای این درخواست استعلام باز وجود دارد.', array('requisition_id' => (string) $r->id));
        }
        $now = self::now();
        $id = Akph_Db::insert(self::t('rfqs'), array('requisition_id' => $r->id, 'project_id' => $r->project_id, 'title' => Akph_Input::text($body, 'title', 190) ?: 'استعلام بهای درخواست ' . $r->number, 'deadline' => Akph_Input::iso_date($body, 'deadline', false), 'status' => 'open', 'created_by' => get_current_user_id(), 'version' => 1, 'created_at' => $now, 'updated_at' => $now));
        $number = Akph_Numbering::issue('RFQ', $year, 'rfq', $id);
        Akph_Db::update(self::t('rfqs'), array('number' => $number), array('id' => $id));
        Akph_Db::update(self::t('requisitions'), array('status' => 'rfq', 'version' => (int) $r->version + 1, 'updated_at' => $now), array('id' => $r->id));
        $q = Akph_Db::find(self::t('rfqs'), $id);
        Akph_Audit::log('rfq_created', 'rfq', $id, null, (array) $q, $number);
        return array('status' => 201, 'message' => 'استعلام بها ' . $number . ' صادر شد.', 'id' => $id, 'doc_number' => $number, 'records' => array('rfqs' => array(self::rfq_shape($q)), 'requisitions' => array(self::requisition_shape(Akph_Db::find(self::t('requisitions'), $r->id)))));
    }

    private static function rfq_or_404($id) {
        $q = Akph_Db::lock(self::t('rfqs'), $id);
        if (!$q || !Akph_Auth::can_access_project($q->project_id)) {
            throw Akph_Error::not_found('استعلام پیدا نشد.');
        }
        return $q;
    }

    private static function supplier_or_fail($id, $field = 'counterparty_id') {
        $c = $id ? Akph_Db::find(self::t('counterparties'), $id) : null;
        if (!$c || $c->kind !== 'supplier') {
            throw Akph_Error::invalid('فروشنده باید طرف حسابی از نوع «تأمین‌کننده» باشد.', array('field' => $field));
        }
        return $c;
    }

    /** Rates typed for the lines of a requisition: [line_id => rate]; every line must have one. */
    private static function parse_prices($body, $requisition_id, $key = 'prices', $line_key = 'line_id') {
        $lines = array();
        foreach (self::lines('requisition_lines', 'requisition_id', $requisition_id) as $l) {
            $lines[(int) $l->id] = $l;
        }
        if (!isset($body[$key]) || !is_array($body[$key])) {
            throw Akph_Error::invalid('نرخ هر ردیف درخواست را وارد کنید.', array('field' => $key));
        }
        $rates = array();
        foreach (array_values($body[$key]) as $i => $p) {
            if (!is_array($p)) {
                throw Akph_Error::invalid('ردیف نرخ نامعتبر است.', array('field' => $key));
            }
            foreach (array_keys($p) as $k) {
                if (!in_array($k, array($line_key, 'rate'), true)) {
                    throw new Akph_Error('akph_unknown_field', 'فیلد ناشناخته در ردیف: ' . $k . ' (مبلغ را سرور محاسبه می‌کند).', 400, array('field' => $key));
                }
            }
            $lid = Akph_Input::id($p, $line_key, false);
            if (!isset($lines[$lid])) {
                throw Akph_Error::invalid('ردیف ' . ($i + 1) . ' متعلق به این درخواست نیست.', array('field' => $key));
            }
            $rate = Akph_Input::parse_amount(isset($p['rate']) ? $p['rate'] : null, 'نرخ ردیف ' . ($i + 1), $key);
            if ($rate <= 0) {
                throw Akph_Error::invalid('نرخ ردیف ' . ($i + 1) . ' باید مثبت باشد.', array('field' => $key));
            }
            $rates[$lid] = $rate;
        }
        foreach ($lines as $lid => $l) {
            if (!isset($rates[$lid])) {
                throw Akph_Error::invalid('نرخ ردیف «' . $l->description . '» وارد نشده است.', array('field' => $key));
            }
        }
        return array($lines, $rates);
    }

    public static function add_quote($rfq_id, array $body) {
        self::assert_manage();
        $q = self::rfq_or_404($rfq_id);
        if ($q->status !== 'open') {
            throw Akph_Error::rule('این استعلام برای ثبت پیشنهاد باز نیست.', array('status' => $q->status));
        }
        $party = self::supplier_or_fail(Akph_Input::id($body, 'counterparty_id', false));
        list($lines, $rates) = self::parse_prices($body, $q->requisition_id);
        $subtotal = 0;
        foreach ($lines as $lid => $l) {
            $subtotal += Akph_Qty::amount(Akph_Qty::from_db($l->quantity), $rates[$lid]);
        }
        $days = isset($body['delivery_days']) && $body['delivery_days'] !== '' ? $body['delivery_days'] : 0;
        if (!is_int($days) || $days < 0 || $days > 3650) {
            throw Akph_Error::invalid('مهلت تحویل (روز) باید عدد صحیح باشد.', array('field' => 'delivery_days'));
        }
        $prices = array();
        foreach ($rates as $lid => $rate) {
            $prices[] = array('line_id' => $lid, 'rate' => $rate);
        }
        $id = Akph_Db::insert(self::t('rfq_quotes'), array(
            'rfq_id' => $q->id, 'counterparty_id' => $party->id, 'reference' => Akph_Input::text($body, 'reference', 64), 'prices' => wp_json_encode($prices),
            'vat_included' => Akph_Input::bool($body, 'vat_included', false) ? 1 : 0, 'freight' => Akph_Input::amount($body, 'freight', 'کرایه حمل'),
            'delivery_days' => $days, 'payment_terms' => Akph_Input::text($body, 'payment_terms', 190), 'notes' => Akph_Input::text($body, 'notes', 1000),
            'subtotal' => $subtotal, 'created_by' => get_current_user_id(), 'created_at' => self::now(),
        ));
        Akph_Db::update(self::t('rfqs'), array('version' => (int) $q->version + 1, 'updated_at' => self::now()), array('id' => $q->id));
        Akph_Audit::log('rfq_quote_added', 'rfq', $q->id, null, array('quote_id' => $id, 'counterparty_id' => $party->id, 'subtotal' => $subtotal), $q->number);
        return array('status' => 201, 'message' => 'پیشنهاد ' . $party->name . ' به مبلغ ' . number_format($subtotal) . ' ریال ثبت شد.', 'id' => $id, 'records' => array('rfqs' => array(self::rfq_shape(Akph_Db::find(self::t('rfqs'), $q->id)))));
    }

    public static function award_rfq($rfq_id, array $body, $version) {
        self::assert_manage();
        $q = self::rfq_or_404($rfq_id);
        Akph_Input::assert_version($q, $version);
        if ($q->status !== 'open') {
            throw Akph_Error::rule('این استعلام باز نیست.', array('status' => $q->status));
        }
        $quote = Akph_Db::find(self::t('rfq_quotes'), Akph_Input::id($body, 'quote_id', false));
        if (!$quote || (int) $quote->rfq_id !== (int) $q->id) {
            throw Akph_Error::invalid('پیشنهاد در این استعلام نیست.', array('field' => 'quote_id'));
        }
        Akph_Db::update(self::t('rfqs'), array('status' => 'awarded', 'winner_quote_id' => $quote->id, 'version' => (int) $q->version + 1, 'updated_at' => self::now()), array('id' => $q->id));
        $after = Akph_Db::find(self::t('rfqs'), $q->id);
        Akph_Audit::log('rfq_awarded', 'rfq', $q->id, (array) $q, (array) $after, $q->number);
        return array('message' => self::party_name($quote->counterparty_id) . ' برنده استعلام ' . $q->number . ' شد.', 'id' => $q->id, 'records' => array('rfqs' => array(self::rfq_shape($after))));
    }

    // ------------------------------------------------------------------ purchase orders

    public static function create_po(array $body) {
        self::assert_manage();
        $year = Akph_Jalali::fiscal_year(Akph_Jalali::today_iso());
        Akph_Numbering::lock('PO', $year);
        $rfq_id = Akph_Input::id($body, 'rfq_id');
        $rfq = null;
        if ($rfq_id) {
            $rfq = self::rfq_or_404($rfq_id);
            if ($rfq->status !== 'awarded') {
                throw Akph_Error::rule('سفارش از استعلامی صادر می‌شود که برنده دارد.', array('status' => $rfq->status));
            }
            $r = self::requisition_or_404($rfq->requisition_id);
            $quote = Akph_Db::find(self::t('rfq_quotes'), $rfq->winner_quote_id);
            $party = self::supplier_or_fail($quote->counterparty_id);
            $rates = array();
            foreach ((array) json_decode((string) $quote->prices, true) as $p) {
                $rates[(int) $p['line_id']] = (int) $p['rate'];
            }
            $req_lines = array();
            foreach (self::lines('requisition_lines', 'requisition_id', $r->id) as $l) {
                $req_lines[(int) $l->id] = $l;
            }
            $freight = (int) $quote->freight;
            $vat_applies = (bool) (int) $quote->vat_included;
            $terms = $quote->payment_terms;
        } else {
            $r = self::requisition_or_404(Akph_Input::id($body, 'requisition_id', false));
            $party = self::supplier_or_fail(Akph_Input::id($body, 'counterparty_id', false));
            list($req_lines, $rates) = self::parse_prices($body, $r->id, 'lines', 'requisition_line_id');
            $freight = Akph_Input::amount($body, 'freight', 'کرایه حمل');
            $vat_applies = Akph_Input::bool($body, 'vat_applies', false);
            $terms = Akph_Input::text($body, 'payment_terms', 190);
        }
        if (!in_array($r->status, array('approved', 'rfq'), true)) {
            throw Akph_Error::rule('سفارش فقط برای درخواست تأییدشده‌ای صادر می‌شود که سفارش دیگری ندارد.', array('status' => $r->status));
        }
        $has_goods = false;
        foreach ($req_lines as $l) {
            $has_goods = $has_goods || $l->kind === 'goods';
        }
        $warehouse = Akph_Input::id($body, 'warehouse_id');
        if ($has_goods) {
            if (!$warehouse) {
                throw Akph_Error::invalid('انبار مقصد کالا را انتخاب کنید.', array('field' => 'warehouse_id'));
            }
            $w = Akph_Inventory::warehouse_or_404($warehouse);
            if ($w->project_id && (int) $w->project_id !== (int) $r->project_id) {
                throw Akph_Error::invalid('انبار مقصد باید انبار مرکزی یا انبار همین پروژه باشد.', array('field' => 'warehouse_id'));
            }
        }
        $vat_rate = $vat_applies ? (int) Akph_Treasury::settings()['vat_rate_percent'] : 0;
        $now = self::now();
        $id = Akph_Db::insert(self::t('purchase_orders'), array(
            'requisition_id' => $r->id, 'rfq_id' => $rfq ? $rfq->id : null, 'project_id' => $r->project_id, 'cost_center_id' => $r->cost_center_id, 'counterparty_id' => $party->id,
            'warehouse_id' => $has_goods ? $warehouse : null, 'issue_date' => Akph_Jalali::today_iso(), 'due_date' => Akph_Input::iso_date($body, 'due_date', false),
            'payment_terms' => $terms, 'vat_rate' => $vat_rate, 'freight' => $freight, 'status' => 'pending', 'notes' => Akph_Input::text($body, 'notes', 1000),
            'history' => Akph_Flow::push_history('[]', 'submitted', 'صدور سفارش'), 'created_by' => get_current_user_id(), 'version' => 1, 'created_at' => $now, 'updated_at' => $now,
        ));
        $subtotal = 0;
        $vat = 0;
        foreach ($req_lines as $lid => $l) {
            $qty = Akph_Qty::from_db($l->quantity);
            $amount = Akph_Qty::amount($qty, $rates[$lid]);
            $line_vat = (int) round($amount * $vat_rate / 100);
            Akph_Db::insert(self::t('po_lines'), array('po_id' => $id, 'requisition_line_id' => $lid, 'kind' => $l->kind, 'material_id' => $l->material_id, 'account_code' => $l->account_code, 'description' => $l->description, 'unit' => $l->unit, 'quantity' => $l->quantity, 'rate' => $rates[$lid], 'amount' => $amount, 'vat_amount' => $line_vat));
            $subtotal += $amount;
            $vat += $line_vat;
        }
        if ($subtotal + $vat + $freight > Akph_Input::MAX_AMOUNT) {
            throw Akph_Error::invalid('مبلغ سفارش بیش از حد مجاز است.');
        }
        $number = Akph_Numbering::issue('PO', $year, 'purchase_order', $id);
        Akph_Db::update(self::t('purchase_orders'), array('number' => $number, 'subtotal' => $subtotal, 'vat_amount' => $vat, 'total' => $subtotal + $vat + $freight), array('id' => $id));
        Akph_Db::update(self::t('requisitions'), array('status' => 'ordered', 'version' => (int) $r->version + 1, 'updated_at' => $now), array('id' => $r->id));
        if ($rfq) {
            Akph_Db::update(self::t('rfqs'), array('status' => 'ordered', 'version' => (int) $rfq->version + 1, 'updated_at' => $now), array('id' => $rfq->id));
        }
        $o = Akph_Db::find(self::t('purchase_orders'), $id);
        Akph_Audit::log('po_created', 'purchase_order', $id, null, (array) $o, $number);
        $records = array('purchase_orders' => array(self::po_shape($o)), 'requisitions' => array(self::requisition_shape(Akph_Db::find(self::t('requisitions'), $r->id))));
        if ($rfq) {
            $records['rfqs'] = array(self::rfq_shape(Akph_Db::find(self::t('rfqs'), $rfq->id)));
        }
        return array('status' => 201, 'message' => 'سفارش خرید ' . $number . ' به مبلغ ' . number_format($o->total) . ' ریال صادر شد و در انتظار تأیید مدیر ارشد است.', 'id' => $id, 'doc_number' => $number, 'records' => $records);
    }

    private static function po_or_404($id) {
        $o = Akph_Db::lock(self::t('purchase_orders'), $id);
        if (!$o || !Akph_Auth::can_access_project($o->project_id)) {
            throw Akph_Error::not_found('سفارش خرید پیدا نشد.');
        }
        return $o;
    }

    public static function approve_po($id, array $body, $version) {
        Akph_Auth::assert_cap(Akph_Roles::PROCUREMENT_APPROVE, 'اجازه تأیید سفارش خرید را ندارید.');
        $comment = Akph_Input::text($body, 'comment', 1000);
        $o = self::po_or_404($id);
        Akph_Input::assert_version($o, $version);
        if ($o->status !== 'pending') {
            throw Akph_Error::conflict('این سفارش در انتظار تأیید نیست.', array('status' => $o->status));
        }
        Akph_Flow::assert_step(Akph_Flow::SENIOR, $o->project_id, $o->created_by, null);
        $now = self::now();
        Akph_Db::update(self::t('purchase_orders'), array('status' => 'approved', 'approved_by' => get_current_user_id(), 'approved_at' => $now, 'history' => Akph_Flow::push_history($o->history, 'approved', Akph_Flow::SENIOR, $comment), 'version' => (int) $o->version + 1, 'updated_at' => $now), array('id' => $o->id));
        $after = Akph_Db::find(self::t('purchase_orders'), $o->id);
        Akph_Audit::log('po_approved', 'purchase_order', $o->id, (array) $o, (array) $after, $o->number);
        return array('message' => 'سفارش خرید ' . $o->number . ' تأیید و به فروشنده ابلاغ شد.', 'id' => $o->id, 'records' => array('purchase_orders' => array(self::po_shape($after))));
    }

    /** Reject (pending) or cancel (approved, nothing received): the requisition is free for another order. */
    public static function reject_po($id, array $body, $version) {
        Akph_Auth::assert_cap(Akph_Roles::PROCUREMENT_APPROVE, 'اجازه رد سفارش خرید را ندارید.');
        $reason = Akph_Input::text($body, 'reason', 1000, true, 'علت رد');
        $o = self::po_or_404($id);
        Akph_Input::assert_version($o, $version);
        if ($o->status === 'pending') {
            Akph_Flow::assert_step(Akph_Flow::SENIOR, $o->project_id, $o->created_by, null);
            $status = 'rejected';
        } elseif ($o->status === 'approved' && !self::has_receipts($o->id)) {
            if (!Akph_Flow::is_senior_or_admin()) {
                throw Akph_Error::forbidden('لغو سفارش تأییدشده با مدیر ارشد است.');
            }
            $status = 'cancelled';
        } else {
            throw Akph_Error::conflict('سفارشی که کالا یا خدمت آن دریافت شده رد یا لغو نمی‌شود.', array('status' => $o->status));
        }
        $now = self::now();
        Akph_Db::update(self::t('purchase_orders'), array('status' => $status, 'reject_reason' => $reason, 'history' => Akph_Flow::push_history($o->history, $status, Akph_Flow::SENIOR, $reason), 'version' => (int) $o->version + 1, 'updated_at' => $now), array('id' => $o->id));
        $r = Akph_Db::lock(self::t('requisitions'), $o->requisition_id);
        Akph_Db::update(self::t('requisitions'), array('status' => 'approved', 'version' => (int) $r->version + 1, 'updated_at' => $now), array('id' => $r->id));
        if ($o->rfq_id) {
            Akph_Db::update(self::t('rfqs'), array('status' => 'awarded', 'updated_at' => $now), array('id' => $o->rfq_id));
        }
        $after = Akph_Db::find(self::t('purchase_orders'), $o->id);
        Akph_Audit::log('po_' . $status, 'purchase_order', $o->id, (array) $o, (array) $after, $o->number);
        return array('message' => 'سفارش خرید ' . $o->number . ($status === 'rejected' ? ' رد شد.' : ' لغو شد.'), 'id' => $o->id, 'records' => array('purchase_orders' => array(self::po_shape($after)), 'requisitions' => array(self::requisition_shape(Akph_Db::find(self::t('requisitions'), $r->id)))));
    }

    private static function has_receipts($po_id) {
        global $wpdb;
        return (int) Akph_Db::value($wpdb->prepare('SELECT COUNT(*) FROM ' . self::t('goods_receipts') . ' WHERE po_id = %d', $po_id)) > 0;
    }

    // ------------------------------------------------------------------ receipts

    public static function receive($po_id, array $body) {
        Akph_Auth::assert_cap(Akph_Roles::INVENTORY_RECEIVE, 'اجازه ثبت رسید را ندارید.');
        $date = Akph_Input::iso_date($body, 'date', false) ?: Akph_Jalali::today_iso();
        Akph_Posting::lock_year($date);
        Akph_Numbering::lock('GRN', Akph_Jalali::fiscal_year($date));
        $o = self::po_or_404($po_id);
        if (!in_array($o->status, array('approved', 'partial'), true)) {
            throw Akph_Error::rule('کالا یا خدمت فقط از سفارش تأییدشده و بازِ دریافت می‌شود.', array('status' => $o->status));
        }
        $po_lines = array();
        foreach (self::lines('po_lines', 'po_id', $o->id) as $l) {
            $po_lines[(int) $l->id] = $l;
        }
        if (!isset($body['lines']) || !is_array($body['lines']) || !$body['lines']) {
            throw Akph_Error::invalid('مقادیر دریافتی را وارد کنید.', array('field' => 'lines'));
        }
        $rows = array();
        foreach (array_values($body['lines']) as $i => $l) {
            $n = $i + 1;
            if (!is_array($l)) {
                throw Akph_Error::invalid('ردیف ' . $n . ' نامعتبر است.', array('field' => 'lines'));
            }
            foreach (array_keys($l) as $k) {
                if (!in_array($k, array('po_line_id', 'delivered_qty', 'rejected_qty'), true)) {
                    throw new Akph_Error('akph_unknown_field', 'فیلد ناشناخته در ردیف: ' . $k . ' (نرخ و مبلغ از سفارش خوانده می‌شود).', 400, array('field' => 'lines'));
                }
            }
            $lid = Akph_Input::id($l, 'po_line_id', false);
            if (!isset($po_lines[$lid])) {
                throw Akph_Error::invalid('ردیف ' . $n . ' متعلق به این سفارش نیست.', array('field' => 'lines'));
            }
            $delivered = Akph_Qty::parse(isset($l['delivered_qty']) ? $l['delivered_qty'] : null, 'lines', 'مقدار تحویلی ردیف ' . $n);
            $rejected = isset($l['rejected_qty']) && $l['rejected_qty'] !== '' ? Akph_Qty::parse($l['rejected_qty'], 'lines', 'مقدار مردودی ردیف ' . $n) : 0;
            if ($delivered <= 0 || $rejected > $delivered) {
                throw Akph_Error::invalid('مقدار تحویلی ردیف ' . $n . ' باید مثبت و مردودی حداکثر برابر آن باشد.', array('field' => 'lines'));
            }
            if (!isset($rows[$lid])) {
                $rows[$lid] = array('delivered' => 0, 'rejected' => 0);
            }
            $rows[$lid]['delivered'] += $delivered;
            $rows[$lid]['rejected'] += $rejected;
        }
        $warehouse = null;
        $has_goods = false;
        foreach ($rows as $lid => $x) {
            $pl = $po_lines[$lid];
            $open = Akph_Qty::from_db($pl->quantity) - Akph_Qty::from_db($pl->received_qty);
            if ($x['delivered'] - $x['rejected'] > $open) {
                throw Akph_Error::rule('دریافت «' . $pl->description . '» از مانده سفارش (' . Akph_Qty::to_string($open) . ') بیشتر است.', array('field' => 'lines'));
            }
            $has_goods = $has_goods || $pl->kind === 'goods';
        }
        if ($has_goods) {
            $warehouse = Akph_Inventory::warehouse_or_404(Akph_Input::id($body, 'warehouse_id') ?: (int) $o->warehouse_id);
            if ($warehouse->project_id && (int) $warehouse->project_id !== (int) $o->project_id) {
                throw Akph_Error::invalid('انبار باید انبار مرکزی یا انبار همین پروژه باشد.', array('field' => 'warehouse_id'));
            }
        }
        $material_ids = array();
        foreach ($rows as $lid => $x) {
            if ($po_lines[$lid]->kind === 'goods') {
                $material_ids[] = (int) $po_lines[$lid]->material_id;
            }
        }
        $materials = Akph_Inventory::lock_materials($material_ids);
        $now = self::now();
        $gid = Akph_Db::insert(self::t('goods_receipts'), array(
            'po_id' => $o->id, 'warehouse_id' => $warehouse ? $warehouse->id : null, 'project_id' => $o->project_id, 'cost_center_id' => $o->cost_center_id, 'counterparty_id' => $o->counterparty_id,
            'receipt_date' => $date, 'waybill' => Akph_Input::text($body, 'waybill', 64), 'qc_status' => Akph_Input::one_of($body, 'qc_status', self::QC, 'accepted'), 'notes' => Akph_Input::text($body, 'notes', 1000),
            'created_by' => get_current_user_id(), 'created_at' => $now,
        ));
        $number = Akph_Numbering::issue('GRN', Akph_Jalali::fiscal_year($date), 'goods_receipt', $gid);
        $party = self::party_name($o->counterparty_id);
        $goods = 0;
        $services = array();
        foreach ($rows as $lid => $x) {
            $pl = $po_lines[$lid];
            $accepted = $x['delivered'] - $x['rejected'];
            $amount = Akph_Qty::amount($accepted, $pl->rate);
            Akph_Db::insert(self::t('grn_lines'), array('grn_id' => $gid, 'po_line_id' => $lid, 'kind' => $pl->kind, 'material_id' => $pl->material_id, 'delivered_qty' => Akph_Qty::to_string($x['delivered']), 'rejected_qty' => Akph_Qty::to_string($x['rejected']), 'accepted_qty' => Akph_Qty::to_string($accepted), 'rate' => $pl->rate, 'amount' => $amount));
            Akph_Db::update(self::t('po_lines'), array('received_qty' => Akph_Qty::to_string(Akph_Qty::from_db($pl->received_qty) + $accepted)), array('id' => $lid));
            if ($accepted <= 0) {
                continue;
            }
            if ($pl->kind === 'goods') {
                Akph_Inventory::stock_in($materials[(int) $pl->material_id], $warehouse->id, $accepted, $amount, array('date' => $date, 'doc_type' => 'goods_receipt', 'doc_number' => $number, 'source_type' => 'goods_receipt', 'source_id' => $gid, 'counterparty' => $party));
                $goods += $amount;
            } else {
                $services[] = array('code' => $pl->account_code, 'amount' => $amount, 'description' => $pl->description);
            }
        }
        $service_total = 0;
        foreach ($services as $s) {
            $service_total += $s['amount'];
        }
        $total = $goods + $service_total;
        $entry = null;
        if ($total > 0) {
            $lines = array();
            if ($goods > 0) {
                $lines[] = array('code' => Akph_Inventory::INVENTORY_ACCOUNT, 'label' => 'موجودی کالا', 'debit' => $goods, 'project_id' => $warehouse->project_id, 'description' => 'ورود کالا به ' . $warehouse->name . ' طبق رسید ' . $number);
            }
            foreach ($services as $s) {
                $lines[] = array('code' => $s['code'], 'label' => 'هزینه خدمت', 'debit' => $s['amount'], 'project_id' => $o->project_id, 'cost_center_id' => $o->cost_center_id, 'counterparty_id' => $o->counterparty_id, 'description' => 'دریافت خدمت «' . $s['description'] . '» طبق رسید ' . $number);
            }
            $lines[] = array('code' => self::GRNI, 'label' => 'کالا و خدمات دریافتی فاکتورنشده', 'credit' => $total, 'project_id' => $o->project_id, 'counterparty_id' => $o->counterparty_id, 'description' => 'دریافتی فاکتورنشده از ' . $party . ' - ' . $number);
            $posted = Akph_Posting::post(array('source' => 'goods_receipt', 'source_id' => $gid, 'type' => 'GOODS_RECEIPT', 'date' => $date, 'description' => 'رسید ' . $number . ' از ' . $party . ' (سفارش ' . $o->number . ')', 'entry_type' => 'inventory', 'project_id' => $o->project_id, 'lines' => $lines));
            $entry = $posted['entry'];
        }
        Akph_Db::update(self::t('goods_receipts'), array('number' => $number, 'goods_value' => $goods, 'service_value' => $service_total, 'total' => $total, 'entry_id' => $entry ? $entry->id : null), array('id' => $gid));
        $complete = true;
        foreach (self::lines('po_lines', 'po_id', $o->id) as $pl) {
            $complete = $complete && Akph_Qty::from_db($pl->received_qty) >= Akph_Qty::from_db($pl->quantity);
        }
        Akph_Db::update(self::t('purchase_orders'), array('status' => $complete ? 'received' : 'partial', 'version' => (int) $o->version + 1, 'updated_at' => $now), array('id' => $o->id));
        $g = Akph_Db::find(self::t('goods_receipts'), $gid);
        Akph_Audit::log('goods_received', 'goods_receipt', $gid, null, (array) $g, $number);
        $records = array_merge(array('goods_receipts' => array(self::grn_shape($g)), 'purchase_orders' => array(self::po_shape(Akph_Db::find(self::t('purchase_orders'), $o->id)))), Akph_Inventory::stock_records(array_keys($materials), $warehouse ? array($warehouse->id) : array()));
        if ($entry) {
            $records['journal_entries'] = array(Akph_Ledger::shape($entry));
        }
        return array('status' => 201, 'message' => 'رسید ' . $number . ' از سفارش ' . $o->number . ' ثبت شد' . ($entry ? ' و سند ' . $entry->doc_number . ' صادر شد.' : '.'), 'id' => $gid, 'doc_number' => $entry ? $entry->doc_number : $number, 'records' => $records);
    }

    private static function grn_or_404($id, $lock = true) {
        $g = $lock ? Akph_Db::lock(self::t('goods_receipts'), $id) : Akph_Db::find(self::t('goods_receipts'), $id);
        if (!$g || !Akph_Auth::can_access_project($g->project_id)) {
            throw Akph_Error::not_found('رسید پیدا نشد.');
        }
        return $g;
    }

    // ------------------------------------------------------------------ vendor invoices

    private static function invoice_amounts(array $body) {
        return array(
            'subtotal' => Akph_Input::amount($body, 'subtotal', 'مبلغ کالا/خدمت فاکتور'),
            'freight' => Akph_Input::amount($body, 'freight', 'کرایه حمل فاکتور'),
            'vat_amount' => Akph_Input::amount($body, 'vat_amount', 'ارزش افزوده فاکتور'),
        );
    }

    /** Three-way match of an invoice with its order and receipt (net of returns before the invoice). */
    private static function match($g, $o, array $a, $exclude_invoice = 0) {
        global $wpdb;
        $returned = (int) Akph_Db::value($wpdb->prepare('SELECT COALESCE(SUM(returned_amount), 0) FROM ' . self::t('grn_lines') . ' WHERE grn_id = %d', $g->id));
        $receipt_value = (int) $g->total - $returned;
        $variance = $a['subtotal'] - $receipt_value;
        $notes = array();
        $tol = (int) round($receipt_value * self::settings()['price_tolerance_bp'] / 10000);
        if (abs($variance) > $tol) {
            $notes[] = 'مغایرت مبلغ فاکتور با ارزش رسید (' . number_format($variance) . ' ریال) بیش از حد مجاز است.';
        }
        $freight_used = (int) Akph_Db::value($wpdb->prepare('SELECT COALESCE(SUM(freight), 0) FROM ' . self::t('vendor_invoices') . " WHERE po_id = %d AND status IN ('pending','approved','stopped') AND id <> %d", $o->id, $exclude_invoice));
        if ($a['freight'] > (int) $o->freight - $freight_used) {
            $notes[] = 'کرایه حمل فاکتور از کرایه سفارش (' . number_format((int) $o->freight - $freight_used) . ' ریال باقیمانده) بیشتر است.';
        }
        $expected_vat = (int) round($a['subtotal'] * (int) $o->vat_rate / 100);
        if (abs($a['vat_amount'] - $expected_vat) > 1) {
            $notes[] = 'ارزش افزوده فاکتور با نرخ سفارش (' . (int) $o->vat_rate . '٪ = ' . number_format($expected_vat) . ' ریال) برابر نیست.';
        }
        return array('receipt_value' => $receipt_value, 'price_variance' => $variance, 'match_status' => $notes ? 'mismatch' : 'matched', 'match_notes' => implode(' ', $notes));
    }

    public static function register_invoice($grn_id, array $body) {
        self::assert_manage();
        $year = Akph_Jalali::fiscal_year(Akph_Jalali::today_iso());
        Akph_Numbering::lock('INV', $year);
        $g = self::grn_or_404($grn_id);
        if (self::invoice_of_grn($g->id)) {
            throw Akph_Error::rule('برای این رسید فاکتور ثبت شده است.', array('grn_id' => (string) $g->id));
        }
        if ((int) $g->total <= 0) {
            throw Akph_Error::rule('رسید بدون کالا یا خدمت پذیرفته‌شده فاکتور ندارد.');
        }
        $o = Akph_Db::find(self::t('purchase_orders'), $g->po_id);
        $invoice_no = Akph_Input::text($body, 'invoice_no', 64, true, 'شماره فاکتور فروشنده');
        global $wpdb;
        if ((int) Akph_Db::value($wpdb->prepare('SELECT COUNT(*) FROM ' . self::t('vendor_invoices') . " WHERE counterparty_id = %d AND invoice_no = %s AND status <> 'rejected'", $g->counterparty_id, $invoice_no)) > 0) {
            throw Akph_Error::conflict('فاکتور ' . $invoice_no . ' این فروشنده قبلاً ثبت شده است.', array('field' => 'invoice_no'));
        }
        $a = self::invoice_amounts($body);
        if ($a['subtotal'] <= 0) {
            throw Akph_Error::invalid('مبلغ فاکتور باید مثبت باشد.', array('field' => 'subtotal'));
        }
        $m = self::match($g, $o, $a);
        $now = self::now();
        $id = Akph_Db::insert(self::t('vendor_invoices'), $a + $m + array(
            'invoice_no' => $invoice_no, 'invoice_date' => Akph_Input::iso_date($body, 'invoice_date', true), 'due_date' => Akph_Input::iso_date($body, 'due_date', false),
            'grn_id' => $g->id, 'po_id' => $o->id, 'project_id' => $g->project_id, 'cost_center_id' => $g->cost_center_id, 'counterparty_id' => $g->counterparty_id,
            'total' => $a['subtotal'] + $a['freight'] + $a['vat_amount'], 'status' => $m['match_status'] === 'matched' ? 'pending' : 'stopped', 'notes' => Akph_Input::text($body, 'notes', 1000),
            'created_by' => get_current_user_id(), 'version' => 1, 'created_at' => $now, 'updated_at' => $now,
        ));
        $number = Akph_Numbering::issue('INV', $year, 'vendor_invoice', $id);
        Akph_Db::update(self::t('vendor_invoices'), array('number' => $number), array('id' => $id));
        $i = Akph_Db::find(self::t('vendor_invoices'), $id);
        Akph_Audit::log('vendor_invoice_registered', 'vendor_invoice', $id, null, (array) $i, $number);
        return array('status' => 201, 'message' => $i->status === 'pending' ? 'فاکتور ' . $invoice_no . ' با تطبیق سه‌جانبه ثبت شد و در انتظار تأیید است.' : 'فاکتور ' . $invoice_no . ' ثبت شد اما «دارای مغایرت و متوقف» است: ' . $i->match_notes, 'id' => $id, 'doc_number' => $number, 'records' => array('vendor_invoices' => array(self::invoice_shape($i)), 'goods_receipts' => array(self::grn_shape($g))));
    }

    private static function invoice_or_404($id) {
        $i = Akph_Db::lock(self::t('vendor_invoices'), $id);
        if (!$i || !Akph_Auth::can_access_project($i->project_id)) {
            throw Akph_Error::not_found('فاکتور پیدا نشد.');
        }
        return $i;
    }

    /** Correction of a pending or stopped invoice: the match runs again. */
    public static function update_invoice($id, array $body, $version) {
        self::assert_manage();
        $i = self::invoice_or_404($id);
        Akph_Input::assert_version($i, $version);
        if (!in_array($i->status, array('pending', 'stopped'), true)) {
            throw Akph_Error::conflict('فقط فاکتور در انتظار یا متوقف اصلاح می‌شود.', array('status' => $i->status));
        }
        $a = array(
            'subtotal' => array_key_exists('subtotal', $body) ? Akph_Input::amount($body, 'subtotal', 'مبلغ فاکتور') : (int) $i->subtotal,
            'freight' => array_key_exists('freight', $body) ? Akph_Input::amount($body, 'freight', 'کرایه حمل') : (int) $i->freight,
            'vat_amount' => array_key_exists('vat_amount', $body) ? Akph_Input::amount($body, 'vat_amount', 'ارزش افزوده') : (int) $i->vat_amount,
        );
        $m = self::match(Akph_Db::find(self::t('goods_receipts'), $i->grn_id), Akph_Db::find(self::t('purchase_orders'), $i->po_id), $a, $i->id);
        $data = $a + $m + array('total' => $a['subtotal'] + $a['freight'] + $a['vat_amount'], 'status' => $m['match_status'] === 'matched' ? 'pending' : 'stopped', 'version' => (int) $i->version + 1, 'updated_at' => self::now());
        foreach (array('invoice_date', 'due_date') as $k) {
            if (array_key_exists($k, $body)) {
                $data[$k] = Akph_Input::iso_date($body, $k, $k === 'invoice_date');
            }
        }
        if (array_key_exists('notes', $body)) {
            $data['notes'] = Akph_Input::text($body, 'notes', 1000);
        }
        Akph_Db::update(self::t('vendor_invoices'), $data, array('id' => $i->id));
        $after = Akph_Db::find(self::t('vendor_invoices'), $i->id);
        Akph_Audit::log('vendor_invoice_updated', 'vendor_invoice', $i->id, (array) $i, (array) $after, $i->number);
        return array('message' => $after->status === 'pending' ? 'فاکتور اصلاح شد و تطبیق سه‌جانبه برقرار است.' : 'فاکتور هنوز دارای مغایرت است: ' . $after->match_notes, 'id' => $i->id, 'records' => array('vendor_invoices' => array(self::invoice_shape($after))));
    }

    /** Approval by the accountant (not the registrant): the purchase entry and the payment request. */
    public static function approve_invoice($id, array $body, $version) {
        Akph_Auth::assert_cap(Akph_Roles::PROCUREMENT_APPROVE, 'اجازه تأیید فاکتور خرید را ندارید.');
        $peek = Akph_Db::find(self::t('vendor_invoices'), $id);
        $date = $peek ? $peek->invoice_date : Akph_Jalali::today_iso();
        Akph_Posting::lock_year($date);
        Akph_Numbering::lock('PAY', Akph_Jalali::fiscal_year(Akph_Jalali::today_iso()));
        $i = self::invoice_or_404($id);
        Akph_Input::assert_version($i, $version);
        if ($i->status === 'stopped') {
            throw Akph_Error::rule('فاکتور «دارای مغایرت و متوقف» است و تأیید نمی‌شود: ' . $i->match_notes, array('status' => $i->status));
        }
        if ($i->status !== 'pending') {
            throw Akph_Error::conflict('این فاکتور در انتظار تأیید نیست.', array('status' => $i->status));
        }
        Akph_Flow::assert_step(Akph_Flow::ACCOUNTANT, $i->project_id, $i->created_by, null);
        $g = Akph_Db::lock(self::t('goods_receipts'), $i->grn_id);
        $o = Akph_Db::find(self::t('purchase_orders'), $i->po_id);
        // Returns may have been recorded since the registration: the match is checked again now.
        $m = self::match($g, $o, array('subtotal' => (int) $i->subtotal, 'freight' => (int) $i->freight, 'vat_amount' => (int) $i->vat_amount), $i->id);
        if ($m['match_status'] !== 'matched') {
            throw Akph_Error::rule('تطبیق سه‌جانبه دیگر برقرار نیست: ' . $m['match_notes'] . ' فاکتور را اصلاح کنید.', array('status' => 'mismatch'));
        }
        $party = self::party_name($i->counterparty_id);
        $ref = $i->invoice_no . ' (' . $i->number . ')';
        $lines = array();
        if ($m['receipt_value'] > 0) {
            $lines[] = array('code' => self::GRNI, 'label' => 'کالا و خدمات دریافتی فاکتورنشده', 'debit' => $m['receipt_value'], 'project_id' => $i->project_id, 'counterparty_id' => $i->counterparty_id, 'description' => 'تسویه دریافتی فاکتورنشده (ارزش رسید) با فاکتور ' . $ref);
        }
        if ($m['price_variance'] > 0) {
            $lines[] = array('code' => self::PRICE_VARIANCE, 'label' => 'مغایرت قیمت خرید', 'debit' => $m['price_variance'], 'project_id' => $i->project_id, 'cost_center_id' => $i->cost_center_id, 'description' => 'مغایرت قیمت فاکتور ' . $ref . ' با رسید');
        }
        if ((int) $i->freight > 0) {
            $lines[] = array('code' => self::FREIGHT, 'label' => 'کرایه حمل', 'debit' => (int) $i->freight, 'project_id' => $i->project_id, 'cost_center_id' => $i->cost_center_id, 'description' => 'کرایه حمل فاکتور ' . $ref);
        }
        if ((int) $i->vat_amount > 0) {
            $lines[] = array('code' => self::PURCHASE_VAT, 'label' => 'ارزش افزوده خرید', 'debit' => (int) $i->vat_amount, 'counterparty_id' => $i->counterparty_id, 'description' => 'ارزش افزوده خرید فاکتور ' . $ref);
        }
        $lines[] = array('code' => self::SUPPLIER_PAYABLE, 'label' => 'بستانکاران تأمین‌کننده', 'credit' => (int) $i->total, 'project_id' => $i->project_id, 'counterparty_id' => $i->counterparty_id, 'description' => 'بستانکاری ' . $party . ' بابت فاکتور ' . $ref);
        if ($m['price_variance'] < 0) {
            $lines[] = array('code' => self::PRICE_VARIANCE, 'label' => 'مغایرت قیمت خرید', 'credit' => -$m['price_variance'], 'project_id' => $i->project_id, 'cost_center_id' => $i->cost_center_id, 'description' => 'مغایرت قیمت فاکتور ' . $ref . ' با رسید');
        }
        $posted = Akph_Posting::post(array('source' => 'vendor_invoice', 'source_id' => $i->id, 'type' => 'VENDOR_INVOICE', 'date' => $i->invoice_date, 'description' => 'فاکتور خرید ' . $ref . ' - ' . $party, 'entry_type' => 'purchase', 'project_id' => $i->project_id, 'lines' => $lines));
        $entry = $posted['entry'];
        $cp = Akph_Db::find(self::t('counterparties'), $i->counterparty_id);
        $request = Akph_Treasury::create_request_internal(array(
            'source_type' => 'vendor_invoice', 'source_id' => $i->id, 'payable_type' => 'supplier', 'debit_account_code' => self::SUPPLIER_PAYABLE,
            'project_id' => $i->project_id, 'cost_center_id' => $i->cost_center_id, 'counterparty_id' => $i->counterparty_id,
            'beneficiary_name' => $party, 'beneficiary_type' => 'supplier', 'beneficiary_sheba' => $cp && isset($cp->sheba) ? (string) $cp->sheba : '',
            'amount' => (int) $i->total, 'due_date' => $i->due_date ?: null, 'description' => 'پرداخت فاکتور ' . $ref . ' (سفارش ' . $o->number . ')',
            'approved_by' => get_current_user_id(),
        ));
        $now = self::now();
        Akph_Db::update(self::t('vendor_invoices'), array('status' => 'approved', 'receipt_value' => $m['receipt_value'], 'price_variance' => $m['price_variance'], 'entry_id' => $entry->id, 'payment_request_id' => $request->id, 'approved_by' => get_current_user_id(), 'approved_at' => $now, 'version' => (int) $i->version + 1, 'updated_at' => $now), array('id' => $i->id));
        $after = Akph_Db::find(self::t('vendor_invoices'), $i->id);
        Akph_Audit::log('vendor_invoice_approved', 'vendor_invoice', $i->id, (array) $i, (array) $after, $i->number);
        return array('message' => 'فاکتور ' . $i->invoice_no . ' تأیید و سند ' . $entry->doc_number . ' صادر شد؛ درخواست پرداخت ' . $request->number . ' در خزانه ایجاد شد.', 'id' => $i->id, 'doc_number' => $entry->doc_number,
            'records' => array('vendor_invoices' => array(self::invoice_shape($after)), 'journal_entries' => array(Akph_Ledger::shape($entry)), 'payment_requests' => array(Akph_Treasury::request_shape($request))));
    }

    public static function reject_invoice($id, array $body, $version) {
        Akph_Auth::assert_cap(Akph_Roles::PROCUREMENT_APPROVE, 'اجازه رد فاکتور خرید را ندارید.');
        $reason = Akph_Input::text($body, 'reason', 1000, true, 'علت رد');
        $i = self::invoice_or_404($id);
        Akph_Input::assert_version($i, $version);
        if (!in_array($i->status, array('pending', 'stopped'), true)) {
            throw Akph_Error::conflict('این فاکتور در انتظار تأیید نیست.', array('status' => $i->status));
        }
        Akph_Flow::assert_step(Akph_Flow::ACCOUNTANT, $i->project_id, $i->created_by, null);
        Akph_Db::update(self::t('vendor_invoices'), array('status' => 'rejected', 'reject_reason' => $reason, 'version' => (int) $i->version + 1, 'updated_at' => self::now()), array('id' => $i->id));
        $after = Akph_Db::find(self::t('vendor_invoices'), $i->id);
        Akph_Audit::log('vendor_invoice_rejected', 'vendor_invoice', $i->id, (array) $i, (array) $after, $i->number);
        return array('message' => 'فاکتور ' . $i->invoice_no . ' رد شد؛ رسید برای فاکتور درست آزاد است.', 'id' => $i->id, 'records' => array('vendor_invoices' => array(self::invoice_shape($after))));
    }

    // ------------------------------------------------------------------ return to the supplier

    public static function return_to_supplier($grn_id, array $body) {
        Akph_Auth::assert_cap(Akph_Roles::INVENTORY_RECEIVE, 'اجازه ثبت برگشت از خرید را ندارید.');
        $today = Akph_Jalali::today_iso();
        Akph_Posting::lock_year($today);
        Akph_Numbering::lock('RTN', Akph_Jalali::fiscal_year($today));
        $g = self::grn_or_404($grn_id);
        $line = Akph_Db::lock(self::t('grn_lines'), Akph_Input::id($body, 'line_id', false));
        if (!$line || (int) $line->grn_id !== (int) $g->id || $line->kind !== 'goods') {
            throw Akph_Error::invalid('ردیف کالای رسید پیدا نشد.', array('field' => 'line_id'));
        }
        $qty = Akph_Qty::parse(isset($body['quantity']) ? $body['quantity'] : null, 'quantity', 'مقدار برگشتی');
        $accepted = Akph_Qty::from_db($line->accepted_qty);
        $returned = Akph_Qty::from_db($line->returned_qty);
        if ($qty <= 0 || $qty > $accepted - $returned) {
            throw Akph_Error::rule('حداکثر مقدار قابل برگشت ' . Akph_Qty::to_string($accepted - $returned) . ' است.', array('field' => 'quantity'));
        }
        $reason = Akph_Input::text($body, 'reason', 1000, true, 'علت برگشت');
        $invoice = null;
        $inv_id = self::invoice_of_grn($g->id);
        if ($inv_id) {
            $invoice = Akph_Db::lock(self::t('vendor_invoices'), $inv_id);
            if ($invoice->status !== 'approved') {
                // An invoice waiting for approval is matched again at approval; it only needs the returned value.
                $invoice = null;
            }
        }
        $materials = Akph_Inventory::lock_materials(array($line->material_id));
        // The supplier is credited at the purchase price; stock leaves at the weighted average (the average of what
        // stays does not change). The difference is a purchase price variance.
        $value = $qty === $accepted - $returned ? (int) $line->amount - (int) $line->returned_amount : Akph_Qty::amount($qty, $line->rate);
        $now = self::now();
        $rid = Akph_Db::insert(self::t('stock_returns'), array('kind' => 'warehouse_to_supplier', 'source_id' => $g->id, 'source_line_id' => $line->id, 'warehouse_id' => $g->warehouse_id, 'project_id' => $g->project_id, 'cost_center_id' => $g->cost_center_id, 'counterparty_id' => $g->counterparty_id, 'material_id' => $line->material_id, 'quantity' => Akph_Qty::to_string($qty), 'amount' => $value, 'return_date' => $today, 'reason' => $reason, 'created_by' => get_current_user_id(), 'created_at' => $now));
        $number = Akph_Numbering::issue('RTN', Akph_Jalali::fiscal_year($today), 'stock_return', $rid);
        $party = self::party_name($g->counterparty_id);
        $inventory_value = Akph_Inventory::stock_out($materials[(int) $line->material_id], $g->warehouse_id, $qty, array('date' => $today, 'doc_type' => 'supplier_return', 'doc_number' => $number, 'source_type' => 'stock_return', 'source_id' => $rid, 'counterparty' => $party));
        $vat = $invoice && (int) $invoice->subtotal > 0 ? (int) round($value * (int) $invoice->vat_amount / (int) $invoice->subtotal) : 0;
        $w = Akph_Db::find(self::t('warehouses'), $g->warehouse_id);
        $lines = array(
            array('code' => $invoice ? self::SUPPLIER_PAYABLE : self::GRNI, 'label' => $invoice ? 'بستانکاران تأمین‌کننده' : 'کالای دریافتی فاکتورنشده', 'debit' => $value + $vat, 'project_id' => $g->project_id, 'counterparty_id' => $g->counterparty_id, 'description' => ($invoice ? 'کاهش بدهی ' : 'کاهش کالای فاکتورنشده ') . $party . ' بابت برگشت ' . $number),
        );
        if ($inventory_value > 0) {
            $lines[] = array('code' => Akph_Inventory::INVENTORY_ACCOUNT, 'label' => 'موجودی کالا', 'credit' => $inventory_value, 'project_id' => $w ? $w->project_id : null, 'description' => 'خروج کالای مرجوعی ' . $number . ' به بهای میانگین');
        }
        if ($vat > 0) {
            $lines[] = array('code' => self::PURCHASE_VAT, 'label' => 'ارزش افزوده خرید', 'credit' => $vat, 'counterparty_id' => $g->counterparty_id, 'description' => 'برگشت ارزش افزوده خرید بابت مرجوعی ' . $number);
        }
        $variance = $value - $inventory_value;
        if ($variance > 0) {
            $lines[] = array('code' => self::PRICE_VARIANCE, 'label' => 'مغایرت قیمت خرید', 'credit' => $variance, 'project_id' => $g->project_id, 'cost_center_id' => $g->cost_center_id, 'description' => 'اختلاف قیمت خرید و میانگین موجودی مرجوعی ' . $number);
        } elseif ($variance < 0) {
            $lines[] = array('code' => self::PRICE_VARIANCE, 'label' => 'مغایرت قیمت خرید', 'debit' => -$variance, 'project_id' => $g->project_id, 'cost_center_id' => $g->cost_center_id, 'description' => 'اختلاف قیمت خرید و میانگین موجودی مرجوعی ' . $number);
        }
        $entry = null;
        if ($value + $vat > 0) {
            $posted = Akph_Posting::post(array('source' => 'stock_return', 'source_id' => $rid, 'type' => 'PURCHASE_RETURN', 'date' => $today, 'description' => 'برگشت از خرید ' . $number . ' به ' . $party, 'entry_type' => 'inventory', 'project_id' => $g->project_id, 'lines' => $lines));
            $entry = $posted['entry'];
        }
        Akph_Db::update(self::t('stock_returns'), array('number' => $number, 'inventory_value' => $inventory_value, 'vat_amount' => $vat, 'entry_id' => $entry ? $entry->id : null), array('id' => $rid));
        Akph_Db::update(self::t('grn_lines'), array('returned_qty' => Akph_Qty::to_string($returned + $qty), 'returned_amount' => (int) $line->returned_amount + $value), array('id' => $line->id));
        $records = array();
        if ($invoice) {
            // After the invoice: what is owed to the supplier (and its payment request) shrinks by the value with VAT.
            $credit = $value + $vat;
            Akph_Db::update(self::t('vendor_invoices'), array('returned_amount' => (int) $invoice->returned_amount + $credit, 'version' => (int) $invoice->version + 1, 'updated_at' => $now), array('id' => $invoice->id));
            if ($invoice->payment_request_id) {
                $pr = Akph_Db::lock(self::t('payment_requests'), $invoice->payment_request_id);
                if ($pr && $pr->status !== 'rejected') {
                    $cut = min($credit, (int) $pr->amount - (int) $pr->paid_amount);
                    $amount = (int) $pr->amount - $cut;
                    $status = $amount === 0 ? 'rejected' : ((int) $pr->paid_amount >= $amount ? 'paid' : $pr->status);
                    Akph_Db::update(self::t('payment_requests'), array('amount' => $amount, 'status' => $status, 'reject_reason' => $amount === 0 ? 'برگشت کامل کالا ' . $number : $pr->reject_reason, 'description' => mb_substr($pr->description . ' — کاهش ' . number_format($cut) . ' ریال بابت برگشت ' . $number, 0, 1000), 'version' => (int) $pr->version + 1, 'updated_at' => $now), array('id' => $pr->id));
                    $records['payment_requests'] = array(Akph_Treasury::request_shape(Akph_Db::find(self::t('payment_requests'), $pr->id)));
                }
            }
            $records['vendor_invoices'] = array(self::invoice_shape(Akph_Db::find(self::t('vendor_invoices'), $invoice->id)));
        }
        $r = Akph_Db::find(self::t('stock_returns'), $rid);
        Akph_Audit::log('stock_returned_to_supplier', 'stock_return', $rid, null, (array) $r, $number);
        $records = array_merge($records, array('stock_returns' => array(Akph_Inventory::return_shape($r)), 'goods_receipts' => array(self::grn_shape(Akph_Db::find(self::t('goods_receipts'), $g->id)))), Akph_Inventory::stock_records(array($line->material_id), array($g->warehouse_id)));
        if ($entry) {
            $records['journal_entries'] = array(Akph_Ledger::shape($entry));
        }
        return array('status' => 201, 'message' => 'برگشت از خرید ' . $number . ' ثبت شد' . ($entry ? ' و سند ' . $entry->doc_number . ' صادر شد.' : '.'), 'id' => $rid, 'doc_number' => $entry ? $entry->doc_number : $number, 'records' => $records);
    }

    // ------------------------------------------------------------------ approval center

    public static function approval_items($uid) {
        $out = array();
        if (!current_user_can(Akph_Roles::PROCUREMENT_APPROVE)) {
            return $out;
        }
        $scope = Akph_Auth::project_scope_sql('project_id');
        foreach ((array) Akph_Db::results('SELECT * FROM ' . self::t('requisitions') . " WHERE status = 'pending' AND {$scope} ORDER BY id DESC LIMIT 500") as $r) {
            $step = Akph_Flow::chain($r->chain)[(int) $r->step_index];
            if ((int) $r->created_by === (int) $uid || ((int) $r->last_approved_by === (int) $uid && $uid > 0) || !Akph_Flow::can_act($step, $r->project_id)) {
                continue;
            }
            $out[] = Akph_Approvals::make_item('purchase_requisition', 'درخواست خرید', $r->id, array(
                'doc_number' => $r->number, 'title' => $r->justification, 'amount' => (int) $r->estimated_total, 'requester_id' => $r->created_by, 'previous_approver_id' => $r->last_approved_by,
                'project_id' => $r->project_id, 'date' => substr((string) $r->created_at, 0, 10), 'stage' => 'تأیید ' . $step, 'approver_role' => $step, 'version' => $r->version,
                'approve_path' => '/requisitions/' . $r->id . '/approve', 'reject_path' => '/requisitions/' . $r->id . '/reject', 'entity_type' => 'purchase_requisition',
            ));
        }
        foreach ((array) Akph_Db::results('SELECT * FROM ' . self::t('purchase_orders') . " WHERE status = 'pending' AND {$scope} ORDER BY id DESC LIMIT 500") as $o) {
            if ((int) $o->created_by === (int) $uid || !Akph_Flow::can_act(Akph_Flow::SENIOR, $o->project_id)) {
                continue;
            }
            $out[] = Akph_Approvals::make_item('purchase_order', 'سفارش خرید', $o->id, array(
                'doc_number' => $o->number, 'title' => 'سفارش به ' . self::party_name($o->counterparty_id), 'amount' => (int) $o->total, 'requester_id' => $o->created_by,
                'project_id' => $o->project_id, 'date' => $o->issue_date, 'stage' => 'تأیید مدیر ارشد', 'approver_role' => Akph_Flow::SENIOR, 'version' => $o->version,
                'approve_path' => '/purchase-orders/' . $o->id . '/approve', 'reject_path' => '/purchase-orders/' . $o->id . '/reject', 'entity_type' => 'purchase_order',
            ));
        }
        foreach ((array) Akph_Db::results('SELECT * FROM ' . self::t('vendor_invoices') . " WHERE status = 'pending' AND {$scope} ORDER BY id DESC LIMIT 500") as $i) {
            if ((int) $i->created_by === (int) $uid || !Akph_Flow::can_act(Akph_Flow::ACCOUNTANT, $i->project_id)) {
                continue;
            }
            $out[] = Akph_Approvals::make_item('vendor_invoice', 'فاکتور خرید', $i->id, array(
                'doc_number' => $i->number, 'title' => 'فاکتور ' . $i->invoice_no . ' - ' . self::party_name($i->counterparty_id), 'amount' => (int) $i->total, 'requester_id' => $i->created_by,
                'project_id' => $i->project_id, 'date' => $i->invoice_date, 'stage' => 'تأیید تطبیق سه‌جانبه (حسابدار)', 'approver_role' => Akph_Flow::ACCOUNTANT, 'version' => $i->version,
                'approve_path' => '/vendor-invoices/' . $i->id . '/approve', 'reject_path' => '/vendor-invoices/' . $i->id . '/reject', 'entity_type' => 'vendor_invoice',
            ));
        }
        return $out;
    }
}
