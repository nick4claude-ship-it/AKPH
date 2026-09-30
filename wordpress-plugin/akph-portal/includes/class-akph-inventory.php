<?php
/**
 * Inventory (0.8.0; reference: receiveGoodsFromPO, requestStoreIssue, confirmStoreIssue, releaseStoreIssue,
 * returnFromProject, returnToSupplier, createTransfer, advanceTransfer, applyStocktake in src/store/workflows.ts;
 * docs/SERVER-RULES.md §6).
 *
 * - Warehouses: central (headquarters, no project), project and temporary (both with a project).
 * - Stock per warehouse and material: on hand and reserved (DECIMAL(18,3)); free = on hand − reserved. Nothing
 *   leaves a warehouse beyond its free stock; rows of one document with the same material are summed first.
 * - Valuation: one moving weighted average per material, company-wide. Each material keeps its total quantity and
 *   total value (integer Rials); stock entering moves the average, stock leaving takes value × quantity ÷ total
 *   (the whole value when the last unit leaves), so the ledger's inventory account always equals Σ stock value.
 * - Kardex: one row per movement (in or out, value, resulting warehouse balance), written by the same command.
 * - Store issue: request (stock reserved) → confirmation by another user (Dr project cost 51101 at weighted
 *   average, Cr inventory 11501) or cancellation (reservation released). Project cost arises only here.
 * - Return from a project at the cost of the original issue (Dr 11501, Cr 51101); transfer between warehouses at
 *   weighted average (11501 → 11501 with the projects of both warehouses); stocktake: the count is approved by
 *   another user, then shortages (Dr 62401) and surpluses (Cr 41301) are posted in separate rows, never netted.
 */
if (!defined('ABSPATH')) {
    exit;
}

final class Akph_Inventory {
    const WAREHOUSE_KINDS = array('central', 'project', 'temporary');
    const INVENTORY_ACCOUNT = '11501';
    const MATERIALS_COST = '51101';
    const STOCKTAKE_LOSS = '62401';
    const STOCKTAKE_GAIN = '41301';

    public static function t($name) {
        return Akph_Schema::table($name);
    }

    private static function now() {
        return Akph_Db::now_utc();
    }

    // ------------------------------------------------------------------ shapes

    public static function material_shape($m, $with_value = true) {
        $qty = Akph_Qty::from_db($m->stock_qty);
        $out = array(
            'id' => (string) $m->id,
            'code' => $m->code,
            'name' => $m->name,
            'category' => $m->category,
            'unit' => $m->unit,
            'specification' => $m->specification,
            'reorder_level' => Akph_Qty::to_string(Akph_Qty::from_db($m->reorder_level)),
            'min_stock' => Akph_Qty::to_string(Akph_Qty::from_db($m->min_stock)),
            'max_stock' => Akph_Qty::to_string(Akph_Qty::from_db($m->max_stock)),
            'stock_qty' => Akph_Qty::to_string($qty),
            'active' => (bool) (int) $m->active,
            'version' => (int) $m->version,
        );
        if ($with_value) {
            $out['stock_value'] = (int) $m->stock_value;
            $out['average_cost'] = self::average($m);
        }
        return $out;
    }

    /** Weighted average cost of one unit (Rials); the last receipt cost when nothing is in stock. */
    public static function average($m) {
        $qty = Akph_Qty::from_db($m->stock_qty);
        return $qty > 0 ? (int) round((int) $m->stock_value * 1000 / $qty) : (int) $m->last_unit_cost;
    }

    public static function warehouse_shape($w) {
        global $wpdb;
        $project = $w->project_id ? Akph_Db::find(self::t('projects'), $w->project_id) : null;
        $agg = Akph_Db::row($wpdb->prepare('SELECT COUNT(*) AS items FROM ' . self::t('stock_balances') . ' WHERE warehouse_id = %d AND qty > 0', $w->id));
        return array(
            'id' => (string) $w->id,
            'code' => $w->code,
            'name' => $w->name,
            'kind' => $w->kind,
            'project_id' => $w->project_id ? (string) $w->project_id : null,
            'project_name' => $project ? $project->name : '',
            'location' => $w->location,
            'keeper_name' => $w->keeper_name,
            'active' => (bool) (int) $w->active,
            'items_count' => (int) $agg->items,
            'version' => (int) $w->version,
        );
    }

    private static function lines_of($table, $key, $id) {
        global $wpdb;
        return (array) Akph_Db::results($wpdb->prepare('SELECT * FROM ' . self::t($table) . " WHERE {$key} = %d ORDER BY id", $id));
    }

    private static function material_name($id) {
        $m = Akph_Db::find(self::t('materials'), $id);
        return $m ? array($m->code, $m->name, $m->unit) : array('', '', '');
    }

    public static function issue_shape($v) {
        $lines = array();
        foreach (self::lines_of('store_issue_lines', 'issue_id', $v->id) as $l) {
            list($code, $name, $unit) = self::material_name($l->material_id);
            $lines[] = array(
                'id' => (string) $l->id,
                'material_id' => (string) $l->material_id,
                'material_code' => $code,
                'material_name' => $name,
                'unit' => $unit,
                'quantity' => Akph_Qty::to_string(Akph_Qty::from_db($l->quantity)),
                'amount' => (int) $l->amount,
                'returned_qty' => Akph_Qty::to_string(Akph_Qty::from_db($l->returned_qty)),
                'returned_amount' => (int) $l->returned_amount,
            );
        }
        $w = Akph_Db::find(self::t('warehouses'), $v->warehouse_id);
        $p = Akph_Db::find(self::t('projects'), $v->project_id);
        return array(
            'id' => (string) $v->id,
            'number' => $v->number,
            'warehouse_id' => (string) $v->warehouse_id,
            'warehouse_name' => $w ? $w->name : '',
            'project_id' => (string) $v->project_id,
            'project_name' => $p ? $p->name : '',
            'cost_center_id' => $v->cost_center_id ? (string) $v->cost_center_id : null,
            'counterparty_id' => $v->counterparty_id ? (string) $v->counterparty_id : null,
            'date' => $v->issue_date,
            'status' => $v->status,
            'total_cost' => (int) $v->total_cost,
            'notes' => $v->notes,
            'lines' => $lines,
            'requested_by' => (string) $v->requested_by,
            'requested_by_name' => Akph_Flow::user_name($v->requested_by),
            'confirmed_by' => $v->confirmed_by ? (string) $v->confirmed_by : null,
            'confirmed_by_name' => Akph_Flow::user_name($v->confirmed_by),
            'entry' => Akph_Posting::entry_ref($v->entry_id),
            'version' => (int) $v->version,
        );
    }

    public static function return_shape($r) {
        list($code, $name, $unit) = self::material_name($r->material_id);
        return array(
            'id' => (string) $r->id,
            'number' => $r->number,
            'kind' => $r->kind,
            'source_id' => (string) $r->source_id,
            'source_line_id' => (string) $r->source_line_id,
            'warehouse_id' => (string) $r->warehouse_id,
            'project_id' => $r->project_id ? (string) $r->project_id : null,
            'counterparty_id' => $r->counterparty_id ? (string) $r->counterparty_id : null,
            'material_id' => (string) $r->material_id,
            'material_code' => $code,
            'material_name' => $name,
            'unit' => $unit,
            'quantity' => Akph_Qty::to_string(Akph_Qty::from_db($r->quantity)),
            'amount' => (int) $r->amount,
            'inventory_value' => (int) $r->inventory_value,
            'vat_amount' => (int) $r->vat_amount,
            'date' => $r->return_date,
            'reason' => $r->reason,
            'entry' => Akph_Posting::entry_ref($r->entry_id),
        );
    }

    public static function transfer_shape($t) {
        $lines = array();
        foreach (self::lines_of('stock_transfer_lines', 'transfer_id', $t->id) as $l) {
            list($code, $name, $unit) = self::material_name($l->material_id);
            $lines[] = array('id' => (string) $l->id, 'material_id' => (string) $l->material_id, 'material_code' => $code, 'material_name' => $name, 'unit' => $unit, 'quantity' => Akph_Qty::to_string(Akph_Qty::from_db($l->quantity)), 'amount' => (int) $l->amount);
        }
        $src = Akph_Db::find(self::t('warehouses'), $t->source_warehouse_id);
        $dst = Akph_Db::find(self::t('warehouses'), $t->target_warehouse_id);
        return array(
            'id' => (string) $t->id,
            'number' => $t->number,
            'source_warehouse_id' => (string) $t->source_warehouse_id,
            'source_warehouse_name' => $src ? $src->name : '',
            'source_project_id' => $src && $src->project_id ? (string) $src->project_id : null,
            'target_warehouse_id' => (string) $t->target_warehouse_id,
            'target_warehouse_name' => $dst ? $dst->name : '',
            'target_project_id' => $dst && $dst->project_id ? (string) $dst->project_id : null,
            'date' => $t->transfer_date,
            'status' => $t->status,
            'total_cost' => (int) $t->total_cost,
            'waybill' => $t->waybill,
            'driver_name' => $t->driver_name,
            'notes' => $t->notes,
            'lines' => $lines,
            'created_by' => (string) $t->created_by,
            'created_by_name' => Akph_Flow::user_name($t->created_by),
            'entry' => Akph_Posting::entry_ref($t->entry_id),
            'version' => (int) $t->version,
        );
    }

    public static function stocktake_shape($s) {
        $lines = array();
        foreach (self::lines_of('stocktake_lines', 'stocktake_id', $s->id) as $l) {
            list($code, $name, $unit) = self::material_name($l->material_id);
            $sys = Akph_Qty::from_db($l->system_qty);
            $phy = Akph_Qty::from_db($l->physical_qty);
            $lines[] = array(
                'id' => (string) $l->id,
                'material_id' => (string) $l->material_id,
                'material_code' => $code,
                'material_name' => $name,
                'unit' => $unit,
                'system_qty' => Akph_Qty::to_string($sys),
                'physical_qty' => Akph_Qty::to_string($phy),
                'variance_qty' => Akph_Qty::to_string($phy - $sys),
                'loss_amount' => (int) $l->loss_amount,
                'gain_amount' => (int) $l->gain_amount,
            );
        }
        $w = Akph_Db::find(self::t('warehouses'), $s->warehouse_id);
        return array(
            'id' => (string) $s->id,
            'number' => $s->number,
            'warehouse_id' => (string) $s->warehouse_id,
            'warehouse_name' => $w ? $w->name : '',
            'project_id' => $w && $w->project_id ? (string) $w->project_id : null,
            'date' => $s->count_date,
            'status' => $s->status,
            'loss_amount' => (int) $s->loss_amount,
            'gain_amount' => (int) $s->gain_amount,
            'notes' => $s->notes,
            'lines' => $lines,
            'created_by' => (string) $s->created_by,
            'created_by_name' => Akph_Flow::user_name($s->created_by),
            'approved_by' => $s->approved_by ? (string) $s->approved_by : null,
            'approved_by_name' => Akph_Flow::user_name($s->approved_by),
            'reject_reason' => $s->reject_reason,
            'entry' => Akph_Posting::entry_ref($s->entry_id),
            'version' => (int) $s->version,
        );
    }

    // ------------------------------------------------------------------ scope

    /** Warehouses the current user may see: all for office roles; project warehouses of own projects for a PM. */
    public static function warehouse_scope_sql($column) {
        global $wpdb;
        if (Akph_Auth::view_all()) {
            return '1=1';
        }
        $ids = Akph_Auth::own_project_ids();
        if (!$ids) {
            return '1=0';
        }
        $in = implode(',', array_map('intval', $ids));
        return "{$column} IN (SELECT id FROM " . self::t('warehouses') . " WHERE project_id IN ({$in}))";
    }

    public static function warehouse_or_404($id, $lock = false) {
        $w = $lock ? Akph_Db::lock(self::t('warehouses'), $id) : Akph_Db::find(self::t('warehouses'), $id);
        // A warehouse without a project (central) is outside a project manager's scope.
        if (!$w || !Akph_Auth::can_access_project($w->project_id)) {
            throw Akph_Error::not_found('انبار پیدا نشد.');
        }
        return $w;
    }

    public static function overview() {
        global $wpdb;
        $full = Akph_Auth::view_all();
        $materials = array_map(function ($m) use ($full) {
            return self::material_shape($m, $full);
        }, (array) Akph_Db::results('SELECT * FROM ' . self::t('materials') . ' ORDER BY code LIMIT 5000'));
        $warehouses = array_map(array(__CLASS__, 'warehouse_shape'), (array) Akph_Db::results('SELECT * FROM ' . self::t('warehouses') . ' WHERE ' . self::warehouse_scope_sql('id') . ' ORDER BY code'));
        $balances = array();
        foreach ((array) Akph_Db::results('SELECT * FROM ' . self::t('stock_balances') . ' WHERE ' . self::warehouse_scope_sql('warehouse_id') . ' AND (qty <> 0 OR reserved <> 0)') as $b) {
            $balances[] = array('warehouse_id' => (string) $b->warehouse_id, 'material_id' => (string) $b->material_id, 'qty' => Akph_Qty::to_string(Akph_Qty::from_db($b->qty)), 'reserved' => Akph_Qty::to_string(Akph_Qty::from_db($b->reserved)));
        }
        $scope = Akph_Auth::project_scope_sql('project_id');
        return array(
            'materials' => $materials,
            'warehouses' => $warehouses,
            'balances' => $balances,
            'issues' => array_map(array(__CLASS__, 'issue_shape'), (array) Akph_Db::results('SELECT * FROM ' . self::t('store_issues') . " WHERE {$scope} ORDER BY id DESC LIMIT 1000")),
            'returns' => array_map(array(__CLASS__, 'return_shape'), (array) Akph_Db::results('SELECT * FROM ' . self::t('stock_returns') . ' WHERE ' . self::warehouse_scope_sql('warehouse_id') . ' ORDER BY id DESC LIMIT 1000')),
            'transfers' => array_map(array(__CLASS__, 'transfer_shape'), (array) Akph_Db::results('SELECT * FROM ' . self::t('stock_transfers') . ' WHERE ' . self::warehouse_scope_sql('source_warehouse_id') . ' OR ' . self::warehouse_scope_sql('target_warehouse_id') . ' ORDER BY id DESC LIMIT 1000')),
            'stocktakes' => array_map(array(__CLASS__, 'stocktake_shape'), (array) Akph_Db::results('SELECT * FROM ' . self::t('stocktakes') . ' WHERE ' . self::warehouse_scope_sql('warehouse_id') . ' ORDER BY id DESC LIMIT 500')),
        );
    }

    /** Kardex rows of a material (optionally one warehouse) in the user's scope, oldest first. */
    public static function kardex(array $q) {
        global $wpdb;
        $material = Akph_Input::id($q, 'material_id', false);
        $warehouse = Akph_Input::id($q, 'warehouse_id');
        if (!Akph_Db::find(self::t('materials'), $material)) {
            throw Akph_Error::not_found('کالا پیدا نشد.');
        }
        $where = $wpdb->prepare('material_id = %d', $material) . ($warehouse ? $wpdb->prepare(' AND warehouse_id = %d', $warehouse) : '') . ' AND ' . self::warehouse_scope_sql('warehouse_id');
        $full = Akph_Auth::view_all();
        $rows = array();
        foreach ((array) Akph_Db::results('SELECT * FROM ' . self::t('kardex') . " WHERE {$where} ORDER BY move_date, id LIMIT 5000") as $k) {
            $w = Akph_Db::find(self::t('warehouses'), $k->warehouse_id);
            $row = array(
                'id' => (string) $k->id,
                'material_id' => (string) $k->material_id,
                'warehouse_id' => (string) $k->warehouse_id,
                'warehouse_name' => $w ? $w->name : '',
                'date' => $k->move_date,
                'doc_type' => $k->doc_type,
                'doc_number' => $k->doc_number,
                'counterparty' => $k->counterparty,
                'in_qty' => Akph_Qty::to_string(Akph_Qty::from_db($k->in_qty)),
                'out_qty' => Akph_Qty::to_string(Akph_Qty::from_db($k->out_qty)),
                'balance_qty' => Akph_Qty::to_string(Akph_Qty::from_db($k->balance_qty)),
            );
            if ($full) {
                $row['value'] = (int) $k->value;
            }
            $rows[] = $row;
        }
        return array('kardex' => $rows);
    }

    // ------------------------------------------------------------------ master data

    private static function assert_manage() {
        Akph_Auth::assert_cap(Akph_Roles::INVENTORY_MANAGE, 'تعریف کالا، انبار و انبارگردانی با حسابدار، مدیر ارشد یا مدیر سیستم است.');
    }

    private static function qty_field($body, $key, $label) {
        return isset($body[$key]) && $body[$key] !== '' && $body[$key] !== null ? Akph_Qty::parse($body[$key], $key, $label) : 0;
    }

    public static function create_material(array $body) {
        self::assert_manage();
        $year = Akph_Jalali::fiscal_year(Akph_Jalali::today_iso());
        Akph_Numbering::lock('MAT', $year);
        $code = Akph_Input::text($body, 'code', 32);
        if ($code !== '' && preg_match('/^[A-Z]+-\d{4}-\d+$/D', $code)) {
            throw Akph_Error::invalid('کد دستی کالا نباید به شکل شماره خودکار باشد.', array('field' => 'code'));
        }
        $now = self::now();
        $data = array(
            'code' => $code !== '' ? $code : 'tmp-' . substr(md5(wp_generate_uuid4()), 0, 24),
            'name' => Akph_Input::text($body, 'name', 190, true, 'نام کالا'),
            'category' => Akph_Input::text($body, 'category', 100),
            'unit' => Akph_Input::text($body, 'unit', 32, true, 'واحد'),
            'specification' => Akph_Input::text($body, 'specification', 500),
            'reorder_level' => Akph_Qty::to_string(self::qty_field($body, 'reorder_level', 'نقطه سفارش')),
            'min_stock' => Akph_Qty::to_string(self::qty_field($body, 'min_stock', 'حداقل موجودی')),
            'max_stock' => Akph_Qty::to_string(self::qty_field($body, 'max_stock', 'حداکثر موجودی')),
            'created_by' => get_current_user_id(),
            'version' => 1,
            'created_at' => $now,
            'updated_at' => $now,
        );
        $id = Akph_Db::try_insert(self::t('materials'), $data);
        if ($id === false) {
            throw Akph_Error::conflict('کد کالا «' . $code . '» تکراری است.', array('field' => 'code'));
        }
        if ($code === '') {
            $code = Akph_Numbering::issue('MAT', $year, 'material', $id);
            Akph_Db::update(self::t('materials'), array('code' => $code), array('id' => $id));
        }
        $m = Akph_Db::find(self::t('materials'), $id);
        Akph_Audit::log('material_created', 'material', $id, null, (array) $m, $m->code);
        return array('status' => 201, 'message' => 'کالای ' . $m->name . ' (' . $m->code . ') تعریف شد.', 'id' => $id, 'records' => array('materials' => array(self::material_shape($m))));
    }

    public static function update_material($id, array $body, $version) {
        self::assert_manage();
        $m = Akph_Db::lock(self::t('materials'), $id);
        if (!$m) {
            throw Akph_Error::not_found('کالا پیدا نشد.');
        }
        Akph_Input::assert_version($m, $version);
        $data = array();
        foreach (array('name' => 190, 'category' => 100, 'specification' => 500) as $k => $max) {
            if (array_key_exists($k, $body)) {
                $data[$k] = Akph_Input::text($body, $k, $max, $k === 'name', 'نام کالا');
            }
        }
        if (array_key_exists('unit', $body)) {
            $unit = Akph_Input::text($body, 'unit', 32, true, 'واحد');
            if ($unit !== $m->unit && (Akph_Qty::from_db($m->stock_qty) !== 0 || self::has_moves($m->id))) {
                throw Akph_Error::rule('واحد کالایی که گردش دارد تغییر نمی‌کند.', array('field' => 'unit'));
            }
            $data['unit'] = $unit;
        }
        foreach (array('reorder_level' => 'نقطه سفارش', 'min_stock' => 'حداقل موجودی', 'max_stock' => 'حداکثر موجودی') as $k => $label) {
            if (array_key_exists($k, $body)) {
                $data[$k] = Akph_Qty::to_string(self::qty_field($body, $k, $label));
            }
        }
        if (array_key_exists('active', $body)) {
            $data['active'] = Akph_Input::bool($body, 'active') ? 1 : 0;
        }
        if (!$data) {
            throw Akph_Error::invalid('تغییری فرستاده نشده است.');
        }
        Akph_Db::update(self::t('materials'), $data + array('version' => (int) $m->version + 1, 'updated_at' => self::now()), array('id' => $id));
        $after = Akph_Db::find(self::t('materials'), $id);
        Akph_Audit::log('material_updated', 'material', $id, (array) $m, (array) $after, $m->code);
        return array('message' => 'کالای ' . $after->name . ' به‌روز شد.', 'id' => $id, 'records' => array('materials' => array(self::material_shape($after))));
    }

    private static function has_moves($material_id) {
        global $wpdb;
        return (int) Akph_Db::value($wpdb->prepare('SELECT COUNT(*) FROM ' . self::t('kardex') . ' WHERE material_id = %d', $material_id)) > 0;
    }

    private static function warehouse_columns(array $body, $partial = false) {
        $data = array();
        if (!$partial || array_key_exists('name', $body)) {
            $data['name'] = Akph_Input::text($body, 'name', 190, true, 'نام انبار');
        }
        if (!$partial || array_key_exists('kind', $body)) {
            $data['kind'] = Akph_Input::one_of($body, 'kind', self::WAREHOUSE_KINDS, 'central');
        }
        if (!$partial || array_key_exists('project_id', $body)) {
            $data['project_id'] = Akph_Input::id($body, 'project_id') ?: null;
        }
        foreach (array('location' => 190, 'keeper_name' => 190) as $k => $max) {
            if (!$partial || array_key_exists($k, $body)) {
                $data[$k] = Akph_Input::text($body, $k, $max);
            }
        }
        return $data;
    }

    private static function assert_warehouse_project($kind, $project_id) {
        if ($kind === 'central' && $project_id) {
            throw Akph_Error::invalid('انبار مرکزی به پروژه تعلق ندارد.', array('field' => 'project_id'));
        }
        if ($kind !== 'central') {
            if (!$project_id || !Akph_Db::find(self::t('projects'), $project_id)) {
                throw Akph_Error::invalid('انبار پروژه یا موقت باید پروژه داشته باشد.', array('field' => 'project_id'));
            }
        }
    }

    public static function create_warehouse(array $body) {
        self::assert_manage();
        $year = Akph_Jalali::fiscal_year(Akph_Jalali::today_iso());
        Akph_Numbering::lock('WH', $year);
        $data = self::warehouse_columns($body);
        self::assert_warehouse_project($data['kind'], $data['project_id']);
        $now = self::now();
        $id = Akph_Db::insert(self::t('warehouses'), $data + array('code' => 'tmp-' . substr(md5(wp_generate_uuid4()), 0, 24), 'created_by' => get_current_user_id(), 'version' => 1, 'created_at' => $now, 'updated_at' => $now));
        $code = Akph_Numbering::issue('WH', $year, 'warehouse', $id);
        Akph_Db::update(self::t('warehouses'), array('code' => $code), array('id' => $id));
        $w = Akph_Db::find(self::t('warehouses'), $id);
        Akph_Audit::log('warehouse_created', 'warehouse', $id, null, (array) $w, $code);
        return array('status' => 201, 'message' => 'انبار ' . $w->name . ' (' . $code . ') تعریف شد.', 'id' => $id, 'records' => array('warehouses' => array(self::warehouse_shape($w))));
    }

    public static function update_warehouse($id, array $body, $version) {
        self::assert_manage();
        $w = Akph_Db::lock(self::t('warehouses'), $id);
        if (!$w) {
            throw Akph_Error::not_found('انبار پیدا نشد.');
        }
        Akph_Input::assert_version($w, $version);
        $data = self::warehouse_columns($body, true);
        if (array_key_exists('active', $body)) {
            $data['active'] = Akph_Input::bool($body, 'active') ? 1 : 0;
        }
        $kind = isset($data['kind']) ? $data['kind'] : $w->kind;
        $project = array_key_exists('project_id', $data) ? $data['project_id'] : $w->project_id;
        if (($kind !== $w->kind || (int) $project !== (int) $w->project_id) && self::warehouse_has_stock($w->id)) {
            throw Akph_Error::rule('نوع یا پروژه انباری که موجودی یا گردش دارد تغییر نمی‌کند.', array('field' => 'kind'));
        }
        self::assert_warehouse_project($kind, $project);
        if (!$data) {
            throw Akph_Error::invalid('تغییری فرستاده نشده است.');
        }
        Akph_Db::update(self::t('warehouses'), $data + array('version' => (int) $w->version + 1, 'updated_at' => self::now()), array('id' => $id));
        $after = Akph_Db::find(self::t('warehouses'), $id);
        Akph_Audit::log('warehouse_updated', 'warehouse', $id, (array) $w, (array) $after, $w->code);
        return array('message' => 'انبار ' . $after->name . ' به‌روز شد.', 'id' => $id, 'records' => array('warehouses' => array(self::warehouse_shape($after))));
    }

    private static function warehouse_has_stock($id) {
        global $wpdb;
        return (int) Akph_Db::value($wpdb->prepare('SELECT COUNT(*) FROM ' . self::t('kardex') . ' WHERE warehouse_id = %d', $id)) > 0;
    }

    // ------------------------------------------------------------------ stock engine (inside a command's transaction)

    /** Lines [{material_id, quantity}] → [material_id => thousandths] summed per material (materials must exist). */
    public static function parse_material_lines($body, $allow_zero = false, $label = 'مقدار') {
        if (!isset($body['lines']) || !is_array($body['lines']) || !$body['lines']) {
            throw Akph_Error::invalid('حداقل یک ردیف کالا لازم است.', array('field' => 'lines'));
        }
        if (count($body['lines']) > 300) {
            throw Akph_Error::invalid('حداکثر ۳۰۰ ردیف.', array('field' => 'lines'));
        }
        $out = array();
        foreach (array_values($body['lines']) as $i => $l) {
            if (!is_array($l)) {
                throw Akph_Error::invalid('ردیف ' . ($i + 1) . ' نامعتبر است.', array('field' => 'lines'));
            }
            foreach (array_keys($l) as $k) {
                if (!in_array($k, array('material_id', 'quantity'), true)) {
                    throw new Akph_Error('akph_unknown_field', 'فیلد ناشناخته در ردیف: ' . $k . ' (بها و مبلغ را سرور تعیین می‌کند).', 400, array('field' => 'lines'));
                }
            }
            $mid = Akph_Input::id($l, 'material_id', false);
            $m = Akph_Db::find(self::t('materials'), $mid);
            if (!$m) {
                throw Akph_Error::invalid('کالای ردیف ' . ($i + 1) . ' پیدا نشد.', array('field' => 'lines'));
            }
            $q = Akph_Qty::parse(isset($l['quantity']) ? $l['quantity'] : null, 'lines', $label . ' ردیف ' . ($i + 1));
            if ($q <= 0 && !$allow_zero) {
                throw Akph_Error::invalid($label . ' ردیف ' . ($i + 1) . ' باید مثبت باشد.', array('field' => 'lines'));
            }
            $out[$mid] = (isset($out[$mid]) ? $out[$mid] : 0) + $q;
        }
        ksort($out);
        return $out;
    }

    /** Locks the materials (ascending id: one lock order for every command) and returns them by id. */
    public static function lock_materials(array $ids) {
        $ids = array_values(array_unique(array_map('intval', $ids)));
        sort($ids);
        $out = array();
        foreach ($ids as $id) {
            $m = Akph_Db::lock(self::t('materials'), $id);
            if (!$m) {
                throw Akph_Error::not_found('کالا پیدا نشد.');
            }
            $out[$id] = $m;
        }
        return $out;
    }

    /** Locks (creating it when missing) the balance of a material in a warehouse. */
    public static function lock_balance($warehouse_id, $material_id) {
        global $wpdb;
        $t = self::t('stock_balances');
        Akph_Db::exec($wpdb->prepare("INSERT INTO {$t} (warehouse_id, material_id, qty, reserved, updated_at) VALUES (%d, %d, 0, 0, %s) ON DUPLICATE KEY UPDATE warehouse_id = warehouse_id", $warehouse_id, $material_id, self::now()));
        return Akph_Db::row($wpdb->prepare("SELECT * FROM {$t} WHERE warehouse_id = %d AND material_id = %d FOR UPDATE", $warehouse_id, $material_id));
    }

    private static function set_balance($b, $qty, $reserved) {
        Akph_Db::update(self::t('stock_balances'), array('qty' => Akph_Qty::to_string($qty), 'reserved' => Akph_Qty::to_string($reserved), 'updated_at' => self::now()), array('id' => $b->id));
    }

    public static function free_qty($b) {
        return Akph_Qty::from_db($b->qty) - Akph_Qty::from_db($b->reserved);
    }

    private static function kardex_row($material, $warehouse_id, array $move, $in, $out, $value, $balance_qty) {
        Akph_Db::insert(self::t('kardex'), array(
            'material_id' => $material->id,
            'warehouse_id' => $warehouse_id,
            'move_date' => $move['date'],
            'doc_type' => $move['doc_type'],
            'doc_number' => $move['doc_number'],
            'source_type' => $move['source_type'],
            'source_id' => $move['source_id'],
            'counterparty' => mb_substr((string) (isset($move['counterparty']) ? $move['counterparty'] : ''), 0, 190),
            'in_qty' => Akph_Qty::to_string($in),
            'out_qty' => Akph_Qty::to_string($out),
            'value' => $value,
            'balance_qty' => Akph_Qty::to_string($balance_qty),
            'created_by' => get_current_user_id(),
            'created_at' => self::now(),
        ));
    }

    /** Stock in at `$value` Rials: the weighted average moves. `$material` is locked by the caller. */
    public static function stock_in($material, $warehouse_id, $qty, $value, array $move) {
        $b = self::lock_balance($warehouse_id, $material->id);
        $m = Akph_Db::find(self::t('materials'), $material->id);
        $total_qty = Akph_Qty::from_db($m->stock_qty) + $qty;
        $total_value = (int) $m->stock_value + $value;
        Akph_Db::update(self::t('materials'), array(
            'stock_qty' => Akph_Qty::to_string($total_qty),
            'stock_value' => $total_value,
            'last_unit_cost' => $qty > 0 ? (int) round($value * 1000 / $qty) : (int) $m->last_unit_cost,
            'updated_at' => self::now(),
        ), array('id' => $m->id));
        $new = Akph_Qty::from_db($b->qty) + $qty;
        self::set_balance($b, $new, Akph_Qty::from_db($b->reserved));
        self::kardex_row($m, $warehouse_id, $move, $qty, 0, $value, $new);
    }

    /**
     * Stock out at the weighted average (the whole value when the last unit of the company leaves). `$release`
     * of the warehouse's reservation is consumed with it. Returns the value (Rials).
     */
    public static function stock_out($material, $warehouse_id, $qty, array $move, $release = 0) {
        $b = self::lock_balance($warehouse_id, $material->id);
        $m = Akph_Db::find(self::t('materials'), $material->id);
        $on_hand = Akph_Qty::from_db($b->qty);
        $reserved = Akph_Qty::from_db($b->reserved);
        if ($qty > $on_hand - ($reserved - $release)) {
            throw Akph_Error::rule('موجودی آزاد «' . $m->name . '» در این انبار ' . Akph_Qty::to_string($on_hand - $reserved + $release) . ' ' . $m->unit . ' است؛ خروج ' . Akph_Qty::to_string($qty) . ' ممکن نیست.', array('field' => 'lines', 'material_id' => (string) $m->id));
        }
        $total_qty = Akph_Qty::from_db($m->stock_qty);
        $total_value = (int) $m->stock_value;
        $value = $qty >= $total_qty ? $total_value : (int) round($total_value * ($qty / $total_qty));
        Akph_Db::update(self::t('materials'), array('stock_qty' => Akph_Qty::to_string($total_qty - $qty), 'stock_value' => $total_value - $value, 'updated_at' => self::now()), array('id' => $m->id));
        $new = $on_hand - $qty;
        self::set_balance($b, $new, max(0, $reserved - $release));
        self::kardex_row($m, $warehouse_id, $move, 0, $qty, -$value, $new);
        return $value;
    }

    /** Moves stock between warehouses at weighted average (the company-wide quantity and value do not change). */
    private static function stock_move($material, $from, $to, $qty, array $out_move, array $in_move) {
        $value = self::stock_out($material, $from, $qty, $out_move);
        self::stock_in(Akph_Db::find(self::t('materials'), $material->id), $to, $qty, $value, $in_move);
        return $value;
    }

    /** Reservation of a store issue (the free stock must cover it). */
    private static function reserve($material, $warehouse_id, $qty) {
        $b = self::lock_balance($warehouse_id, $material->id);
        $free = self::free_qty($b);
        if ($qty > $free) {
            throw Akph_Error::rule('موجودی آزاد «' . $material->name . '» در این انبار ' . Akph_Qty::to_string($free) . ' ' . $material->unit . ' است؛ جمع درخواست ' . Akph_Qty::to_string($qty) . '.', array('field' => 'lines', 'material_id' => (string) $material->id));
        }
        self::set_balance($b, Akph_Qty::from_db($b->qty), Akph_Qty::from_db($b->reserved) + $qty);
    }

    private static function unreserve($material_id, $warehouse_id, $qty) {
        $b = self::lock_balance($warehouse_id, $material_id);
        self::set_balance($b, Akph_Qty::from_db($b->qty), max(0, Akph_Qty::from_db($b->reserved) - $qty));
    }

    private static function inventory_line($amount, $side, $warehouse, $description) {
        $l = array('code' => self::INVENTORY_ACCOUNT, 'label' => 'موجودی کالا', $side => $amount, 'project_id' => $warehouse->project_id, 'description' => $description . ' (' . $warehouse->name . ')');
        return $l;
    }

    // ------------------------------------------------------------------ store issues

    private static function assert_issue_cap() {
        Akph_Auth::assert_cap(Akph_Roles::INVENTORY_ISSUE, 'حواله انبار با مدیر پروژه، مدیر ارشد یا مدیر سیستم است.');
    }

    public static function create_issue(array $body) {
        self::assert_issue_cap();
        $year = Akph_Jalali::fiscal_year(Akph_Jalali::today_iso());
        Akph_Numbering::lock('SIV', $year);
        $w = self::warehouse_or_404(Akph_Input::id($body, 'warehouse_id', false));
        if (!(int) $w->active) {
            throw Akph_Error::rule('انبار غیرفعال است.', array('field' => 'warehouse_id'));
        }
        $project = Akph_Input::id($body, 'project_id') ?: (int) $w->project_id;
        if (!$project || !Akph_Db::find(self::t('projects'), $project)) {
            throw Akph_Error::invalid('پروژه مصرف را انتخاب کنید.', array('field' => 'project_id'));
        }
        Akph_Auth::assert_project($project);
        if ($w->project_id && (int) $w->project_id !== $project) {
            throw Akph_Error::rule('انبار پروژه فقط به همان پروژه حواله می‌دهد؛ برای پروژه دیگر انتقال بین انبارها ثبت کنید.', array('field' => 'project_id'));
        }
        $cc = self::cost_center_of($body, $project);
        $party = Akph_Input::id($body, 'counterparty_id');
        if ($party) {
            $cp = Akph_Db::find(self::t('counterparties'), $party);
            if (!$cp || $cp->kind !== 'subcontractor') {
                throw Akph_Error::invalid('تحویل‌گیرنده باید پیمانکار جزء باشد.', array('field' => 'counterparty_id'));
            }
        }
        $lines = self::parse_material_lines($body);
        $materials = self::lock_materials(array_keys($lines));
        $now = self::now();
        $id = Akph_Db::insert(self::t('store_issues'), array(
            'warehouse_id' => $w->id,
            'project_id' => $project,
            'cost_center_id' => $cc,
            'counterparty_id' => $party ?: null,
            'issue_date' => Akph_Input::iso_date($body, 'date', false) ?: Akph_Jalali::today_iso(),
            'status' => 'requested',
            'notes' => Akph_Input::text($body, 'notes', 1000),
            'requested_by' => get_current_user_id(),
            'version' => 1,
            'created_at' => $now,
            'updated_at' => $now,
        ));
        foreach ($lines as $mid => $q) {
            self::reserve($materials[$mid], $w->id, $q);
            Akph_Db::insert(self::t('store_issue_lines'), array('issue_id' => $id, 'material_id' => $mid, 'quantity' => Akph_Qty::to_string($q)));
        }
        $number = Akph_Numbering::issue('SIV', $year, 'store_issue', $id);
        Akph_Db::update(self::t('store_issues'), array('number' => $number), array('id' => $id));
        $v = Akph_Db::find(self::t('store_issues'), $id);
        Akph_Audit::log('store_issue_requested', 'store_issue', $id, null, (array) $v, $number);
        return array('status' => 201, 'message' => 'درخواست حواله ' . $number . ' ثبت و کالا رزرو شد؛ خروج قطعی با تأیید کاربر دیگر انجام می‌شود.', 'id' => $id, 'doc_number' => $number, 'records' => self::issue_records($v));
    }

    private static function cost_center_of($body, $project) {
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

    private static function issue_records($v, array $extra = array()) {
        global $wpdb;
        $ids = array_map('intval', (array) Akph_Db::col($wpdb->prepare('SELECT material_id FROM ' . self::t('store_issue_lines') . ' WHERE issue_id = %d', $v->id)));
        return array_merge(array('store_issues' => array(self::issue_shape($v))), self::stock_records($ids, array((int) $v->warehouse_id)), $extra);
    }

    /** Materials and balances touched by a command (for the app's copies). */
    public static function stock_records(array $material_ids, array $warehouse_ids) {
        global $wpdb;
        $material_ids = array_values(array_unique(array_filter(array_map('intval', $material_ids))));
        $warehouse_ids = array_values(array_unique(array_filter(array_map('intval', $warehouse_ids))));
        $full = Akph_Auth::view_all();
        $materials = array();
        $balances = array();
        foreach ($material_ids as $mid) {
            $m = Akph_Db::find(self::t('materials'), $mid);
            if ($m) {
                $materials[] = self::material_shape($m, $full);
            }
            foreach ($warehouse_ids as $wid) {
                $b = Akph_Db::row($wpdb->prepare('SELECT * FROM ' . self::t('stock_balances') . ' WHERE warehouse_id = %d AND material_id = %d', $wid, $mid));
                $balances[] = array('warehouse_id' => (string) $wid, 'material_id' => (string) $mid, 'qty' => $b ? Akph_Qty::to_string(Akph_Qty::from_db($b->qty)) : '0', 'reserved' => $b ? Akph_Qty::to_string(Akph_Qty::from_db($b->reserved)) : '0');
            }
        }
        return array('materials' => $materials, 'stock_balances' => $balances);
    }

    private static function issue_or_404($id, $lock = true) {
        $v = $lock ? Akph_Db::lock(self::t('store_issues'), $id) : Akph_Db::find(self::t('store_issues'), $id);
        if (!$v || !Akph_Auth::can_access_project($v->project_id)) {
            throw Akph_Error::not_found('حواله پیدا نشد.');
        }
        return $v;
    }

    /** Confirmation by a user other than the requester: stock out at weighted average and the project cost entry. */
    public static function confirm_issue($id, array $body, $version) {
        self::assert_issue_cap();
        $today = Akph_Jalali::today_iso();
        Akph_Posting::lock_year($today);
        $v = self::issue_or_404($id);
        Akph_Input::assert_version($v, $version);
        if ($v->status !== 'requested') {
            throw Akph_Error::conflict('این حواله در انتظار تأیید خروج نیست.', array('status' => $v->status));
        }
        // The requester never confirms their own issue; the step is the project manager's (or the senior manager's).
        Akph_Flow::assert_step(Akph_Flow::PM, $v->project_id, $v->requested_by, null);
        $w = Akph_Db::find(self::t('warehouses'), $v->warehouse_id);
        $lines = self::lines_of('store_issue_lines', 'issue_id', $v->id);
        $materials = self::lock_materials(array_map(function ($l) {
            return $l->material_id;
        }, $lines));
        $total = 0;
        $move = array('date' => $today, 'doc_type' => 'store_issue', 'doc_number' => $v->number, 'source_type' => 'store_issue', 'source_id' => $v->id, 'counterparty' => self::project_name($v->project_id));
        foreach ($lines as $l) {
            $q = Akph_Qty::from_db($l->quantity);
            $value = self::stock_out($materials[(int) $l->material_id], $v->warehouse_id, $q, $move, $q);
            Akph_Db::update(self::t('store_issue_lines'), array('amount' => $value), array('id' => $l->id));
            $total += $value;
        }
        $entry = null;
        if ($total > 0) {
            $desc = 'حواله مصرف ' . $v->number . ' به بهای میانگین موزون';
            $posted = Akph_Posting::post(array(
                'source' => 'store_issue', 'source_id' => $v->id, 'type' => 'STORE_ISSUE', 'date' => $today, 'description' => $desc, 'entry_type' => 'inventory', 'project_id' => $v->project_id,
                'lines' => array(
                    array('code' => self::MATERIALS_COST, 'label' => 'مصالح مصرفی پروژه', 'debit' => $total, 'project_id' => $v->project_id, 'cost_center_id' => $v->cost_center_id, 'counterparty_id' => $v->counterparty_id, 'description' => $desc),
                    self::inventory_line($total, 'credit', $w, 'خروج کالا طبق حواله ' . $v->number),
                ),
            ));
            $entry = $posted['entry'];
        }
        $now = self::now();
        Akph_Db::update(self::t('store_issues'), array('status' => 'issued', 'total_cost' => $total, 'entry_id' => $entry ? $entry->id : null, 'confirmed_by' => get_current_user_id(), 'confirmed_at' => $now, 'version' => (int) $v->version + 1, 'updated_at' => $now), array('id' => $v->id));
        $after = Akph_Db::find(self::t('store_issues'), $v->id);
        Akph_Audit::log('store_issue_confirmed', 'store_issue', $v->id, (array) $v, (array) $after, $v->number);
        $extra = $entry ? array('journal_entries' => array(Akph_Ledger::shape($entry))) : array();
        return array('message' => 'حواله ' . $v->number . ' به بهای میانگین موزون (' . number_format($total) . ' ریال) خارج شد' . ($entry ? ' و سند ' . $entry->doc_number . ' صادر شد.' : '.'), 'id' => $v->id, 'doc_number' => $entry ? $entry->doc_number : null, 'records' => self::issue_records($after, $extra));
    }

    public static function cancel_issue($id, array $body, $version) {
        self::assert_issue_cap();
        $v = self::issue_or_404($id);
        Akph_Input::assert_version($v, $version);
        if ($v->status !== 'requested') {
            throw Akph_Error::conflict('فقط حواله در انتظار قابل لغو است.', array('status' => $v->status));
        }
        $lines = self::lines_of('store_issue_lines', 'issue_id', $v->id);
        self::lock_materials(array_map(function ($l) {
            return $l->material_id;
        }, $lines));
        foreach ($lines as $l) {
            self::unreserve((int) $l->material_id, $v->warehouse_id, Akph_Qty::from_db($l->quantity));
        }
        Akph_Db::update(self::t('store_issues'), array('status' => 'cancelled', 'notes' => mb_substr(trim($v->notes . ' ' . Akph_Input::text($body, 'reason', 500)), 0, 1000), 'version' => (int) $v->version + 1, 'updated_at' => self::now()), array('id' => $v->id));
        $after = Akph_Db::find(self::t('store_issues'), $v->id);
        Akph_Audit::log('store_issue_cancelled', 'store_issue', $v->id, (array) $v, (array) $after, $v->number);
        return array('message' => 'رزرو حواله ' . $v->number . ' آزاد و حواله لغو شد.', 'id' => $v->id, 'records' => self::issue_records($after));
    }

    private static function project_name($id) {
        $p = $id ? Akph_Db::find(self::t('projects'), $id) : null;
        return $p ? $p->name : '';
    }

    /** Return from the project at the cost of the original issue: Dr inventory, Cr project materials cost. */
    public static function return_from_project($issue_id, array $body) {
        self::assert_issue_cap();
        $today = Akph_Jalali::today_iso();
        Akph_Posting::lock_year($today);
        Akph_Numbering::lock('RTN', Akph_Jalali::fiscal_year($today));
        $v = self::issue_or_404($issue_id);
        if ($v->status !== 'issued') {
            throw Akph_Error::rule('فقط کالای حواله‌شده قابل برگشت است.', array('status' => $v->status));
        }
        $line_id = Akph_Input::id($body, 'line_id', false);
        $l = Akph_Db::lock(self::t('store_issue_lines'), $line_id);
        if (!$l || (int) $l->issue_id !== (int) $v->id) {
            throw Akph_Error::invalid('ردیف حواله پیدا نشد.', array('field' => 'line_id'));
        }
        $qty = Akph_Qty::parse(isset($body['quantity']) ? $body['quantity'] : null, 'quantity', 'مقدار برگشتی');
        $issued = Akph_Qty::from_db($l->quantity);
        $returned = Akph_Qty::from_db($l->returned_qty);
        if ($qty <= 0 || $qty > $issued - $returned) {
            throw Akph_Error::rule('حداکثر مقدار قابل برگشت ' . Akph_Qty::to_string($issued - $returned) . ' است.', array('field' => 'quantity'));
        }
        $reason = Akph_Input::text($body, 'reason', 1000, true, 'علت برگشت');
        $materials = self::lock_materials(array($l->material_id));
        // At the cost of the original issue; the last return takes what is left of it.
        $value = $qty === $issued - $returned ? (int) $l->amount - (int) $l->returned_amount : (int) round((int) $l->amount * ($qty / $issued));
        $now = self::now();
        $rid = Akph_Db::insert(self::t('stock_returns'), array('kind' => 'project_to_warehouse', 'source_id' => $v->id, 'source_line_id' => $l->id, 'warehouse_id' => $v->warehouse_id, 'project_id' => $v->project_id, 'cost_center_id' => $v->cost_center_id, 'material_id' => $l->material_id, 'quantity' => Akph_Qty::to_string($qty), 'amount' => $value, 'inventory_value' => $value, 'return_date' => $today, 'reason' => $reason, 'created_by' => get_current_user_id(), 'created_at' => $now));
        $number = Akph_Numbering::issue('RTN', Akph_Jalali::fiscal_year($today), 'stock_return', $rid);
        self::stock_in($materials[(int) $l->material_id], $v->warehouse_id, $qty, $value, array('date' => $today, 'doc_type' => 'project_return', 'doc_number' => $number, 'source_type' => 'stock_return', 'source_id' => $rid, 'counterparty' => self::project_name($v->project_id)));
        $entry = null;
        if ($value > 0) {
            $w = Akph_Db::find(self::t('warehouses'), $v->warehouse_id);
            $posted = Akph_Posting::post(array(
                'source' => 'stock_return', 'source_id' => $rid, 'type' => 'STORE_RETURN', 'date' => $today, 'description' => 'برگشت کالا از پروژه به انبار ' . $number, 'entry_type' => 'inventory', 'project_id' => $v->project_id,
                'lines' => array(
                    self::inventory_line($value, 'debit', $w, 'ورود مجدد کالای برگشتی ' . $number),
                    array('code' => self::MATERIALS_COST, 'label' => 'مصالح مصرفی پروژه', 'credit' => $value, 'project_id' => $v->project_id, 'cost_center_id' => $v->cost_center_id, 'description' => 'کاهش بهای مصالح پروژه بابت برگشت ' . $number),
                ),
            ));
            $entry = $posted['entry'];
        }
        Akph_Db::update(self::t('stock_returns'), array('number' => $number, 'entry_id' => $entry ? $entry->id : null), array('id' => $rid));
        Akph_Db::update(self::t('store_issue_lines'), array('returned_qty' => Akph_Qty::to_string($returned + $qty), 'returned_amount' => (int) $l->returned_amount + $value), array('id' => $l->id));
        Akph_Db::update(self::t('store_issues'), array('version' => (int) $v->version + 1, 'updated_at' => $now), array('id' => $v->id));
        $r = Akph_Db::find(self::t('stock_returns'), $rid);
        Akph_Audit::log('stock_returned_from_project', 'stock_return', $rid, null, (array) $r, $number);
        return array('status' => 201, 'message' => 'برگشت ' . $number . ' ثبت شد و بهای پروژه ' . number_format($value) . ' ریال کاهش یافت.', 'id' => $rid, 'doc_number' => $entry ? $entry->doc_number : $number,
            'records' => self::issue_records(Akph_Db::find(self::t('store_issues'), $v->id), array('stock_returns' => array(self::return_shape($r))) + ($entry ? array('journal_entries' => array(Akph_Ledger::shape($entry))) : array())));
    }

    // ------------------------------------------------------------------ transfers

    public static function create_transfer(array $body) {
        self::assert_issue_cap();
        $year = Akph_Jalali::fiscal_year(Akph_Jalali::today_iso());
        Akph_Numbering::lock('STR', $year);
        $src = self::warehouse_or_404(Akph_Input::id($body, 'source_warehouse_id', false));
        $dst_id = Akph_Input::id($body, 'target_warehouse_id', false);
        $dst = Akph_Db::find(self::t('warehouses'), $dst_id);
        if (!$dst || !(int) $dst->active) {
            throw Akph_Error::invalid('انبار مقصد پیدا نشد.', array('field' => 'target_warehouse_id'));
        }
        if ((int) $src->id === (int) $dst->id) {
            throw Akph_Error::invalid('انبار مبدأ و مقصد یکسان است.', array('field' => 'target_warehouse_id'));
        }
        $lines = self::parse_material_lines($body);
        $materials = self::lock_materials(array_keys($lines));
        foreach ($lines as $mid => $q) {
            $b = self::lock_balance($src->id, $mid);
            if ($q > self::free_qty($b)) {
                throw Akph_Error::rule('موجودی آزاد «' . $materials[$mid]->name . '» در انبار مبدأ ' . Akph_Qty::to_string(self::free_qty($b)) . ' است؛ جمع انتقال ' . Akph_Qty::to_string($q) . '.', array('field' => 'lines'));
            }
        }
        $now = self::now();
        $id = Akph_Db::insert(self::t('stock_transfers'), array(
            'source_warehouse_id' => $src->id,
            'target_warehouse_id' => $dst->id,
            'transfer_date' => Akph_Input::iso_date($body, 'date', false) ?: Akph_Jalali::today_iso(),
            'status' => 'requested',
            'waybill' => Akph_Input::text($body, 'waybill', 64),
            'driver_name' => Akph_Input::text($body, 'driver_name', 190),
            'notes' => Akph_Input::text($body, 'notes', 1000),
            'created_by' => get_current_user_id(),
            'version' => 1,
            'created_at' => $now,
            'updated_at' => $now,
        ));
        foreach ($lines as $mid => $q) {
            Akph_Db::insert(self::t('stock_transfer_lines'), array('transfer_id' => $id, 'material_id' => $mid, 'quantity' => Akph_Qty::to_string($q)));
        }
        $number = Akph_Numbering::issue('STR', $year, 'stock_transfer', $id);
        Akph_Db::update(self::t('stock_transfers'), array('number' => $number), array('id' => $id));
        $t = Akph_Db::find(self::t('stock_transfers'), $id);
        Akph_Audit::log('stock_transfer_created', 'stock_transfer', $id, null, (array) $t, $number);
        return array('status' => 201, 'message' => 'حواله انتقال ' . $number . ' ثبت شد؛ موجودی هنگام تحویل در مقصد جابه‌جا می‌شود.', 'id' => $id, 'doc_number' => $number, 'records' => array('stock_transfers' => array(self::transfer_shape($t))));
    }

    private static function transfer_or_404($id) {
        $t = Akph_Db::lock(self::t('stock_transfers'), $id);
        if (!$t) {
            throw Akph_Error::not_found('حواله انتقال پیدا نشد.');
        }
        self::warehouse_or_404($t->source_warehouse_id);
        return $t;
    }

    /** Delivery at the target: both balances and the kardex change; Dr inventory (target) / Cr inventory (source). */
    public static function deliver_transfer($id, array $body, $version) {
        self::assert_issue_cap();
        $today = Akph_Jalali::today_iso();
        Akph_Posting::lock_year($today);
        $t = self::transfer_or_404($id);
        Akph_Input::assert_version($t, $version);
        if ($t->status !== 'requested') {
            throw Akph_Error::conflict('این انتقال در انتظار تحویل نیست.', array('status' => $t->status));
        }
        $src = Akph_Db::find(self::t('warehouses'), $t->source_warehouse_id);
        $dst = Akph_Db::find(self::t('warehouses'), $t->target_warehouse_id);
        $lines = self::lines_of('stock_transfer_lines', 'transfer_id', $t->id);
        $materials = self::lock_materials(array_map(function ($l) {
            return $l->material_id;
        }, $lines));
        $total = 0;
        foreach ($lines as $l) {
            $m = $materials[(int) $l->material_id];
            $base = array('date' => $today, 'doc_number' => $t->number, 'source_type' => 'stock_transfer', 'source_id' => $t->id);
            $value = self::stock_move($m, $src->id, $dst->id, Akph_Qty::from_db($l->quantity), $base + array('doc_type' => 'transfer_out', 'counterparty' => $dst->name), $base + array('doc_type' => 'transfer_in', 'counterparty' => $src->name));
            Akph_Db::update(self::t('stock_transfer_lines'), array('amount' => $value), array('id' => $l->id));
            $total += $value;
        }
        $entry = null;
        if ($total > 0) {
            $posted = Akph_Posting::post(array(
                'source' => 'stock_transfer', 'source_id' => $t->id, 'type' => 'INVENTORY_TRANSFER', 'date' => $today, 'description' => 'انتقال بین انبارها ' . $t->number, 'entry_type' => 'inventory', 'project_id' => $src->project_id,
                'lines' => array(
                    self::inventory_line($total, 'debit', $dst, 'ورود کالای انتقالی ' . $t->number),
                    self::inventory_line($total, 'credit', $src, 'خروج کالای انتقالی ' . $t->number),
                ),
            ));
            $entry = $posted['entry'];
        }
        $now = self::now();
        Akph_Db::update(self::t('stock_transfers'), array('status' => 'delivered', 'total_cost' => $total, 'entry_id' => $entry ? $entry->id : null, 'delivered_by' => get_current_user_id(), 'version' => (int) $t->version + 1, 'updated_at' => $now), array('id' => $t->id));
        $after = Akph_Db::find(self::t('stock_transfers'), $t->id);
        Akph_Audit::log('stock_transfer_delivered', 'stock_transfer', $t->id, (array) $t, (array) $after, $t->number);
        $records = array_merge(array('stock_transfers' => array(self::transfer_shape($after))), self::stock_records(array_keys($materials), array($src->id, $dst->id)));
        if ($entry) {
            $records['journal_entries'] = array(Akph_Ledger::shape($entry));
        }
        return array('message' => 'انتقال ' . $t->number . ' تحویل شد؛ موجودی هر دو انبار و کاردکس به‌روز شد' . ($entry ? ' و سند ' . $entry->doc_number . ' صادر شد.' : '.'), 'id' => $t->id, 'doc_number' => $entry ? $entry->doc_number : null, 'records' => $records);
    }

    public static function cancel_transfer($id, array $body, $version) {
        self::assert_issue_cap();
        $t = self::transfer_or_404($id);
        Akph_Input::assert_version($t, $version);
        if ($t->status !== 'requested') {
            throw Akph_Error::conflict('فقط انتقال تحویل‌نشده قابل لغو است.', array('status' => $t->status));
        }
        Akph_Db::update(self::t('stock_transfers'), array('status' => 'cancelled', 'version' => (int) $t->version + 1, 'updated_at' => self::now()), array('id' => $t->id));
        $after = Akph_Db::find(self::t('stock_transfers'), $t->id);
        Akph_Audit::log('stock_transfer_cancelled', 'stock_transfer', $t->id, (array) $t, (array) $after, $t->number);
        return array('message' => 'انتقال ' . $t->number . ' لغو شد.', 'id' => $t->id, 'records' => array('stock_transfers' => array(self::transfer_shape($after))));
    }

    // ------------------------------------------------------------------ stocktakes

    public static function create_stocktake(array $body) {
        self::assert_manage();
        $year = Akph_Jalali::fiscal_year(Akph_Jalali::today_iso());
        Akph_Numbering::lock('STK', $year);
        $w = self::warehouse_or_404(Akph_Input::id($body, 'warehouse_id', false));
        $lines = self::parse_material_lines($body, true, 'شمارش فیزیکی');
        self::lock_materials(array_keys($lines));
        $now = self::now();
        $id = Akph_Db::insert(self::t('stocktakes'), array('warehouse_id' => $w->id, 'count_date' => Akph_Input::iso_date($body, 'date', false) ?: Akph_Jalali::today_iso(), 'status' => 'pending', 'notes' => Akph_Input::text($body, 'notes', 1000), 'created_by' => get_current_user_id(), 'version' => 1, 'created_at' => $now, 'updated_at' => $now));
        foreach ($lines as $mid => $physical) {
            $b = self::lock_balance($w->id, $mid);
            if ($physical < Akph_Qty::from_db($b->reserved)) {
                throw Akph_Error::rule('شمارش فیزیکی از مقدار رزروشده کمتر است؛ ابتدا حواله‌های رزروشده را تعیین تکلیف کنید.', array('field' => 'lines', 'material_id' => (string) $mid));
            }
            Akph_Db::insert(self::t('stocktake_lines'), array('stocktake_id' => $id, 'material_id' => $mid, 'system_qty' => Akph_Qty::to_string(Akph_Qty::from_db($b->qty)), 'physical_qty' => Akph_Qty::to_string($physical)));
        }
        $number = Akph_Numbering::issue('STK', $year, 'stocktake', $id);
        Akph_Db::update(self::t('stocktakes'), array('number' => $number), array('id' => $id));
        $s = Akph_Db::find(self::t('stocktakes'), $id);
        Akph_Audit::log('stocktake_counted', 'stocktake', $id, null, (array) $s, $number);
        return array('status' => 201, 'message' => 'انبارگردانی ' . $number . ' ثبت شد و سند تعدیل پس از تأیید کاربر دیگر صادر می‌شود.', 'id' => $id, 'doc_number' => $number, 'records' => array('stocktakes' => array(self::stocktake_shape($s))));
    }

    private static function stocktake_or_404($id) {
        $s = Akph_Db::lock(self::t('stocktakes'), $id);
        if (!$s) {
            throw Akph_Error::not_found('انبارگردانی پیدا نشد.');
        }
        self::warehouse_or_404($s->warehouse_id);
        return $s;
    }

    /**
     * Approval by a user other than the counter: every counted material is set to its physical count at weighted
     * average. The stock must not have moved since the count. Shortages and surpluses are separate rows.
     */
    public static function approve_stocktake($id, array $body, $version) {
        self::assert_manage();
        $s0 = Akph_Db::find(self::t('stocktakes'), $id);
        $date = $s0 ? $s0->count_date : Akph_Jalali::today_iso();
        Akph_Posting::lock_year($date);
        $s = self::stocktake_or_404($id);
        Akph_Input::assert_version($s, $version);
        if ($s->status !== 'pending') {
            throw Akph_Error::conflict('این انبارگردانی در انتظار تأیید نیست.', array('status' => $s->status));
        }
        if ((int) $s->created_by === get_current_user_id()) {
            throw new Akph_Error('akph_segregation_of_duties', 'انبارگردانی را که خودتان شمرده‌اید تأیید نمی‌کنید (تفکیک وظایف).', 403);
        }
        $w = Akph_Db::find(self::t('warehouses'), $s->warehouse_id);
        $lines = self::lines_of('stocktake_lines', 'stocktake_id', $s->id);
        $materials = self::lock_materials(array_map(function ($l) {
            return $l->material_id;
        }, $lines));
        $loss = 0;
        $gain = 0;
        $move = array('date' => $s->count_date, 'doc_type' => 'stocktake', 'doc_number' => $s->number, 'source_type' => 'stocktake', 'source_id' => $s->id, 'counterparty' => 'انبارگردانی');
        foreach ($lines as $l) {
            $m = $materials[(int) $l->material_id];
            $b = self::lock_balance($w->id, $m->id);
            if (Akph_Qty::from_db($b->qty) !== Akph_Qty::from_db($l->system_qty)) {
                throw Akph_Error::rule('موجودی «' . $m->name . '» پس از شمارش تغییر کرده است؛ انبارگردانی را رد و دوباره شمارش کنید.', array('material_id' => (string) $m->id));
            }
            $var = Akph_Qty::from_db($l->physical_qty) - Akph_Qty::from_db($l->system_qty);
            if ($var < 0) {
                $value = self::stock_out($m, $w->id, -$var, $move);
                Akph_Db::update(self::t('stocktake_lines'), array('loss_amount' => $value), array('id' => $l->id));
                $loss += $value;
            } elseif ($var > 0) {
                $value = Akph_Qty::amount($var, self::average(Akph_Db::find(self::t('materials'), $m->id)));
                self::stock_in($m, $w->id, $var, $value, $move);
                Akph_Db::update(self::t('stocktake_lines'), array('gain_amount' => $value), array('id' => $l->id));
                $gain += $value;
            }
        }
        $entry = null;
        if ($loss + $gain > 0) {
            $rows = array();
            if ($loss > 0) {
                $rows[] = array('code' => self::STOCKTAKE_LOSS, 'label' => 'کسری انبارگردانی', 'debit' => $loss, 'project_id' => $w->project_id, 'description' => 'کسری انبارگردانی ' . $s->number);
                $rows[] = self::inventory_line($loss, 'credit', $w, 'کاهش موجودی بابت کسری ' . $s->number);
            }
            if ($gain > 0) {
                $rows[] = self::inventory_line($gain, 'debit', $w, 'افزایش موجودی بابت اضافات ' . $s->number);
                $rows[] = array('code' => self::STOCKTAKE_GAIN, 'label' => 'اضافات انبارگردانی', 'credit' => $gain, 'project_id' => $w->project_id, 'description' => 'اضافات انبارگردانی ' . $s->number);
            }
            $posted = Akph_Posting::post(array('source' => 'stocktake', 'source_id' => $s->id, 'type' => 'STOCKTAKE_ADJUSTMENT', 'date' => $s->count_date, 'description' => 'سند تعدیل انبارگردانی ' . $s->number, 'entry_type' => 'inventory', 'project_id' => $w->project_id, 'lines' => $rows));
            $entry = $posted['entry'];
        }
        $now = self::now();
        Akph_Db::update(self::t('stocktakes'), array('status' => 'approved', 'loss_amount' => $loss, 'gain_amount' => $gain, 'entry_id' => $entry ? $entry->id : null, 'approved_by' => get_current_user_id(), 'approved_at' => $now, 'version' => (int) $s->version + 1, 'updated_at' => $now), array('id' => $s->id));
        $after = Akph_Db::find(self::t('stocktakes'), $s->id);
        Akph_Audit::log('stocktake_approved', 'stocktake', $s->id, (array) $s, (array) $after, $s->number);
        $records = array_merge(array('stocktakes' => array(self::stocktake_shape($after))), self::stock_records(array_keys($materials), array($w->id)));
        if ($entry) {
            $records['journal_entries'] = array(Akph_Ledger::shape($entry));
        }
        return array('message' => $entry ? 'سند تعدیل انبارگردانی ' . $entry->doc_number . ' صادر شد (کسری ' . number_format($loss) . '، اضافه ' . number_format($gain) . ' ریال).' : 'انبارگردانی بدون مغایرت ریالی تأیید شد.', 'id' => $s->id, 'doc_number' => $entry ? $entry->doc_number : null, 'records' => $records);
    }

    public static function reject_stocktake($id, array $body, $version) {
        self::assert_manage();
        $reason = Akph_Input::text($body, 'reason', 1000, true, 'علت رد');
        $s = self::stocktake_or_404($id);
        Akph_Input::assert_version($s, $version);
        if ($s->status !== 'pending') {
            throw Akph_Error::conflict('این انبارگردانی در انتظار تأیید نیست.', array('status' => $s->status));
        }
        if ((int) $s->created_by === get_current_user_id()) {
            throw new Akph_Error('akph_segregation_of_duties', 'انبارگردانی را که خودتان شمرده‌اید رد یا تأیید نمی‌کنید.', 403);
        }
        Akph_Db::update(self::t('stocktakes'), array('status' => 'rejected', 'reject_reason' => $reason, 'version' => (int) $s->version + 1, 'updated_at' => self::now()), array('id' => $s->id));
        $after = Akph_Db::find(self::t('stocktakes'), $s->id);
        Akph_Audit::log('stocktake_rejected', 'stocktake', $s->id, (array) $s, (array) $after, $s->number);
        return array('message' => 'انبارگردانی ' . $s->number . ' رد شد.', 'id' => $s->id, 'records' => array('stocktakes' => array(self::stocktake_shape($after))));
    }

    // ------------------------------------------------------------------ approval center

    /** Store issues waiting for confirmation and stocktakes waiting for approval, for the current user. */
    public static function approval_items($uid) {
        $out = array();
        if (current_user_can(Akph_Roles::INVENTORY_ISSUE)) {
            $scope = Akph_Auth::project_scope_sql('project_id');
            foreach ((array) Akph_Db::results('SELECT * FROM ' . self::t('store_issues') . " WHERE status = 'requested' AND {$scope} ORDER BY id DESC LIMIT 500") as $v) {
                if ((int) $v->requested_by === (int) $uid || !Akph_Flow::can_act(Akph_Flow::PM, $v->project_id)) {
                    continue;
                }
                $out[] = Akph_Approvals::make_item('store_issue', 'حواله انبار', $v->id, array(
                    'doc_number' => $v->number, 'title' => 'خروج کالا از ' . self::warehouse_name($v->warehouse_id), 'amount' => 0, 'requester_id' => $v->requested_by,
                    'project_id' => $v->project_id, 'date' => $v->issue_date, 'stage' => 'تأیید خروج از انبار', 'approver_role' => Akph_Flow::PM, 'version' => $v->version,
                    'approve_path' => '/store-issues/' . $v->id . '/confirm', 'reject_path' => '/store-issues/' . $v->id . '/cancel', 'entity_type' => 'store_issue',
                ));
            }
        }
        if (current_user_can(Akph_Roles::INVENTORY_MANAGE)) {
            foreach ((array) Akph_Db::results('SELECT * FROM ' . self::t('stocktakes') . " WHERE status = 'pending' AND " . self::warehouse_scope_sql('warehouse_id') . ' ORDER BY id DESC LIMIT 200') as $s) {
                if ((int) $s->created_by === (int) $uid) {
                    continue;
                }
                $w = Akph_Db::find(self::t('warehouses'), $s->warehouse_id);
                $out[] = Akph_Approvals::make_item('stocktake', 'انبارگردانی', $s->id, array(
                    'doc_number' => $s->number, 'title' => 'انبارگردانی ' . ($w ? $w->name : ''), 'amount' => 0, 'requester_id' => $s->created_by,
                    'project_id' => $w ? $w->project_id : null, 'date' => $s->count_date, 'stage' => 'تأیید انبارگردانی و سند تعدیل', 'approver_role' => Akph_Flow::ACCOUNTANT, 'version' => $s->version,
                    'approve_path' => '/stocktakes/' . $s->id . '/approve', 'reject_path' => '/stocktakes/' . $s->id . '/reject', 'entity_type' => 'stocktake',
                ));
            }
        }
        return $out;
    }

    private static function warehouse_name($id) {
        $w = Akph_Db::find(self::t('warehouses'), $id);
        return $w ? $w->name : '';
    }
}
