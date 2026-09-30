/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// akph/v1 data source: reads from the server, sends only commands (Idempotency-Key, version/If-Match),
// never a computed record, number, status or total. Dates: ISO on the wire, Jalali in the app.
import assert from 'node:assert/strict';

type Call = { method: string; url: string; query: string; headers: Record<string, string>; body?: unknown };
const calls: Call[] = [];

const entry = (over: Record<string, unknown> = {}) => ({
  id: '11', doc_number: 'ACC-1405-00001', draft_number: 'DRF-1405-00001', fiscal_year: 1405, date: '2026-03-30', description: 'سند آزمون',
  entry_type: 'general', source_type: 'manual', project_id: '5', status: 'posted', total: 150,
  lines: [
    { line_no: 1, account_code: '61101', project_id: '5', cost_center_id: '8', counterparty_id: null, description: 'حقوق', debit: 150, credit: 0 },
    { line_no: 2, account_code: '11101', project_id: null, cost_center_id: null, counterparty_id: '3', description: 'بانک', debit: 0, credit: 150 },
  ],
  reversal_of: null, reversed_by: null, created_by: '7', created_by_name: 'حسابدار یک', created_at: '2026-03-30T08:00:00Z',
  approved_by: '9', approved_by_name: 'حسابدار دو', approved_at: '2026-03-30T09:00:00Z', rejected_by: null, rejected_at: null, status_note: '', version: 2,
  ...over,
});

// Petty cash, treasury and approvals as akph/v1 shapes them (class-akph-petty-cash.php, class-akph-treasury.php).
const fund = (over: Record<string, unknown> = {}) => ({
  id: '41', code: 'PCF-1405-00001', title: 'تنخواه کارگاه', fund_type: 'site_supervisor', project_id: '5', cost_center_id: '8', holder_user_id: '21',
  holder_name: 'متصدی', holder_phone: '', account_code: '11103', ceiling: 3_000_000_000, max_single_expense: 1_000_000_000, min_balance_warning: 500_000_000,
  source_account_id: '61', active: true, notes: '', period_start: '2026-09-01', balance: 1_850_000_000, pending_expenses: 600_000_000, usable_balance: 1_250_000_000,
  open_requests: 0, period_spent: 150_000_000, last_replenishment_amount: 2_000_000_000, last_replenishment_date: '2026-09-10', created_at: '2026-09-01T08:00:00Z', version: 4,
  ...over,
});
const expense = (over: Record<string, unknown> = {}) => ({
  id: '51', number: 'EXP-1405-00002', fund_id: '41', fund_title: 'تنخواه کارگاه', project_id: '5', cost_center_id: '8', category_id: null, category_name: 'مصالح جزئی',
  sub_category: '', account_code: '51101', date: '2026-09-20', amount: 600_000_000, vendor: 'فروشگاه', vendor_national_id: '', counterparty_id: null, invoice_number: 'F-1',
  invoice_date: null, description: 'اجاره ماشین‌آلات', payment_method: 'cash', status: 'pending', approval_level: 'project_and_finance', chain: ['مدیر پروژه', 'حسابدار'],
  step_index: 1, current_step: 'حسابدار',
  history: [
    { action: 'submitted', step: 'ثبت هزینه', user_id: '1', user_name: 'مدیر ارشد', role: 'مدیر ارشد', at: '2026-09-20T07:00:00Z', comment: '' },
    { action: 'approved', step: 'مدیر پروژه', user_id: '21', user_name: 'مدیر پروژه', role: 'مدیر پروژه', at: '2026-09-20T08:30:00Z', comment: 'تأیید' },
  ],
  submitted_by: '1', submitted_by_name: 'مدیر ارشد', last_approved_by: '21', reject_reason: '', entry: null, version: 2, created_at: '2026-09-20T07:00:00Z',
  ...over,
});
const payReq = (over: Record<string, unknown> = {}) => ({
  id: '71', number: 'PAY-1405-00001', source_type: 'manual', source_id: null, payable_type: 'supplier', debit_account_code: '21101', project_id: '5', cost_center_id: null,
  counterparty_id: '3', fund_id: null, beneficiary_name: 'تأمین‌کننده', beneficiary_type: '', beneficiary_sheba: '', amount: 300_000_000, paid_amount: 100_000_000,
  remaining_amount: 200_000_000, date: '2026-09-21', due_date: '2026-09-30', priority: 'normal', status: 'approved', description: '', requested_by: '7',
  requested_by_name: 'حسابدار یک', approved_by: '9', approved_by_name: 'حسابدار دو', approved_at: '2026-09-21T09:00:00Z', reject_reason: '', needs_senior: false,
  payments: [{ id: '81', account_id: '61', account_title: 'بانک نمونه', amount: 100_000_000, method: 'paya', tracking: 'P-1', date: '2026-09-22', cheque_id: null, entry: { id: '90', number: 'ACC-1405-00009', status: 'posted' }, paid_by: '7', paid_by_name: 'حسابدار یک' }],
  version: 3,
  ...over,
});
const approvalsBody = { items: [
  { id: 'petty_cash_expense:51', module: 'petty_cash_expense', module_label: 'هزینه تنخواه', record_id: '51', doc_number: 'EXP-1405-00002', title: 'اجاره ماشین‌آلات', amount: 600_000_000,
    requester_id: '1', requester: 'مدیر ارشد', previous_approver_id: '21', project_id: '5', project_name: 'پروژه آزمون', date: '2026-09-20', stage: 'تأیید حسابدار', approver_role: 'حسابدار',
    version: 2, approve_path: '/petty-cash/expenses/51/approve', reject_path: '/petty-cash/expenses/51/reject', entity_type: 'petty_expense' },
  { id: 'receipt:95', module: 'receipt', module_label: 'دریافت', record_id: '95', doc_number: 'REC-1405-00001', title: 'دریافت از کارفرما', amount: 50_000_000,
    requester_id: '9', requester: 'حسابدار دو', previous_approver_id: null, project_id: null, project_name: '', date: '2026-09-22', stage: 'تأیید دریافت', approver_role: 'حسابدار',
    version: 1, approve_path: '/receipts/95/approve', reject_path: '/receipts/95/reject', entity_type: 'receipt' },
], total: 2 };


// Contracts and statements as akph/v1 0.7.0 shapes them (class-akph-contracts.php, class-akph-statements.php).
const contractLine = (over: Record<string, unknown> = {}) => ({
  id: '301', row_no: 1, code: '010101', description: 'خاک‌برداری', unit: 'm3', base_quantity: '100', quantity: '120.5', rate: 2_000_000, amount: 241_000_000,
  approved_quantity: '40', pending_quantity: '10.25', amendment_id: null, ...over,
});
const contract = (over: Record<string, unknown> = {}) => ({
  id: '201', number: 'CNT-1405-00001', kind: 'client', contract_no: 'K-100', title: 'اجرای فونداسیون', project_id: '5', project_name: 'پروژه آزمون', cost_center_id: '8',
  counterparty_id: '3', counterparty_name: 'کارفرمای آزمون', trade_type: '', amount: 200_000_000, contract_date: '2026-03-25', start_date: '2026-04-01', end_date: '2027-03-31',
  duration_days: 360, advance_pct: '10', retention_pct: '5', insurance_pct: '5', tax_pct: '3', other_pct: '0', adjustment_base_index: '100', adjustment_factor_pct: '95',
  description: '', status: 'active', chain: ['مدیر ارشد'], step_index: 1, current_step: null,
  history: [{ action: 'submitted', step: 'ثبت قرارداد', user_id: '7', user_name: 'حسابدار یک', role: 'حسابدار', at: '2026-03-25T08:00:00Z', comment: '' }],
  last_approved_by: '1', reject_reason: '', created_by: '7', created_by_name: 'حسابدار یک', created_at: '2026-03-25T08:00:00Z',
  lines: [contractLine()],
  amendments: [{ id: '401', number: 'AMD-1405-00001', contract_id: '201', amendment_no: 'ال-۱', date: '2026-05-01', amount_delta: 41_000_000, extend_days: 30, description: '',
    status: 'approved', lines: [{ contract_line_id: '301', new_line: false, code: '010101', description: 'خاک‌برداری', unit: 'm3', rate: 2_000_000, quantity_delta: '20.5', amount: 41_000_000 }],
    created_by: '7', created_by_name: 'حسابدار یک', approved_by: '1', approved_by_name: 'مدیر ارشد', approved_at: '2026-05-02T08:00:00Z', reject_reason: '', version: 2 }],
  guarantees: [{ id: '501', contract_id: '201', kind: 'performance', guarantee_no: 'G-1', bank: 'بانک نمونه', amount: 10_000_000, issue_date: '2026-03-25', due_date: '2026-10-10',
    status: 'active', notes: '', days_to_due: 10, due_soon: true, version: 1 }],
  version: 5,
  amendments_total: 41_000_000, extend_days: 30, current_amount: 241_000_000, measured_amount: 100_500_000, approved_amount: 80_000_000, approved_gross: 87_200_000,
  approved_net: 70_000_000, remaining_amount: 161_000_000, settled_amount: 30_000_000, balance_due: 40_000_000, advance_amount: 20_000_000, advance_expected: 24_100_000,
  advance_remaining: 12_000_000, deductions: { retention: 4_000_000, advance_payment: 8_000_000 },
  ...over,
});
const statement = (over: Record<string, unknown> = {}) => ({
  id: '601', number: 'STC-1405-00002', kind: 'client', title: 'صورت‌وضعیت موقت ۲', contract_id: '201', contract_number: 'CNT-1405-00001', contract_no: 'K-100',
  contract_title: 'اجرای فونداسیون', project_id: '5', project_name: 'پروژه آزمون', cost_center_id: '8', counterparty_id: '3', counterparty_name: 'کارفرمای آزمون', trade_type: '',
  period_start: '2026-08-23', period_end: '2026-09-22', status: 'approved_by_consultant',
  current_step: { label: 'تأیید کارفرما', role: 'حسابدار', approval: true, next_status: 'approved_by_employer', requires: ['employer_ref', 'employer_date'] },
  include_vat: true,
  lines: [{ id: '701', contract_line_id: '301', row_no: 1, code: '010101', description: 'خاک‌برداری', unit: 'm3', contract_quantity: '120.5', previous_quantity: '40',
    quantity: '10.25', cumulative_quantity: '50.25', rate: 2_000_000, amount: 20_500_000, cumulative_amount: 100_500_000 }],
  work_amount: 20_500_000, adjustment_index: '110', adjustment_amount: 1_947_500, vat_rate: 10, vat_amount: 2_244_750, gross_amount: 24_692_250, fixed_deduction: 0,
  deductions: [{ type: 'retention', title: 'سپرده حسن انجام کار', rate: '5', amount: 1_122_375 }, { type: 'advance_payment', title: 'استهلاک پیش‌پرداخت', rate: '10', amount: 2_244_750 }],
  total_deductions: 3_367_125, net_amount: 21_325_125, settled_amount: 0, pending_receipts: 0, balance_due: 0, payment_request: null, employer_ref: null, employer_date: null,
  description: '', history: [
    { action: 'submitted', step: 'ثبت و ارسال به مشاور', user_id: '21', user_name: 'مدیر پروژه', role: 'مدیر پروژه', at: '2026-09-22T07:00:00Z', comment: '', from: 'draft', to: 'submitted_to_consultant' },
    { action: 'approved', step: 'تأیید مشاور', user_id: '22', user_name: 'مدیر پروژه دو', role: 'مدیر پروژه', at: '2026-09-23T07:00:00Z', comment: '', from: 'submitted_to_consultant', to: 'approved_by_consultant' },
  ],
  created_by: '21', created_by_name: 'مدیر پروژه', last_approved_by: '22', reject_reason: '', entry: null, void_entry: null, approved_at: null,
  created_at: '2026-09-22T07:00:00Z', version: 3,
  ...over,
});
const subContract = contract({
  id: '202', number: 'SCN-1405-00001', kind: 'subcontract', contract_no: 'S-7', title: 'آرماتوربندی', counterparty_id: '4', counterparty_name: 'پیمانکار جزء', trade_type: 'آرماتوربندی و قالب‌بندی',
  status: 'pending', chain: ['مدیر پروژه', 'مدیر ارشد'], step_index: 0, current_step: 'مدیر پروژه', amendments: [], guarantees: [], version: 1, last_approved_by: null,
  lines: [contractLine({ id: '302', description: 'آرماتوربندی', unit: 'kg', quantity: '5000', base_quantity: '5000', rate: 30_000, amount: 150_000_000, approved_quantity: '0', pending_quantity: '0' })],
});
const contractsBody = { contracts: [contract(), subContract] };
const statementsBody = { statements: [statement(), statement({ id: '602', number: 'STS-1405-00001', kind: 'subcontract', contract_id: '202', status: 'finance_approved',
  current_step: { label: 'تأیید مدیر ارشد', role: 'مدیر ارشد', approval: true, next_status: 'management_approved', requires: [] }, include_vat: false, vat_amount: 0,
  payment_request: null, history: [] })] };

const responses: Record<string, unknown> = {
  'GET contracts': contractsBody,
  'GET statements': statementsBody,
  'POST contracts': { status: 201, message: 'قرارداد ثبت شد.', id: '203', doc_number: 'CNT-1405-00002', records: { contracts: [contract({ id: '203', number: 'CNT-1405-00002', status: 'pending', current_step: 'مدیر ارشد', step_index: 0, version: 1 })] } },
  'POST contracts/202/approve': { message: 'تأیید شد.', id: '202', records: { contracts: [{ ...subContract, step_index: 1, current_step: 'مدیر ارشد', version: 2, last_approved_by: '21' }] } },
  'POST contracts/201/amendments': { message: 'الحاقیه ثبت شد.', id: '402', doc_number: 'AMD-1405-00002', records: { contracts: [contract()] } },
  'POST contracts/201/guarantees': { message: 'ضمانت‌نامه ثبت شد.', id: '502', records: { contracts: [contract()] } },
  'POST contract-guarantees/501': { message: 'ضمانت‌نامه به‌روز شد.', id: '501', records: { contracts: [contract()] } },
  'POST client-statements': { message: 'صورت‌وضعیت ثبت شد.', id: '603', doc_number: 'STC-1405-00003', records: { statements: [statement({ id: '603', number: 'STC-1405-00003', status: 'draft', version: 1 })], contracts: [contract()] } },
  'POST subcontractor-statements': { message: 'صورت‌وضعیت ثبت شد.', id: '604', doc_number: 'STS-1405-00002', records: { statements: [statement({ id: '604', kind: 'subcontract', number: 'STS-1405-00002', status: 'submitted', contract_id: '202', version: 1 })], contracts: [subContract] } },
  'POST statements/601/approve': { message: 'تأیید کارفرما ثبت شد.', id: '601', records: { statements: [statement({ status: 'approved_by_employer', employer_ref: 'ن-۱۲', employer_date: '2026-09-25', entry: { id: '95', number: 'ACC-1405-00020', status: 'posted' }, current_step: null, version: 4 })], contracts: [contract()] } },
  'POST statements/602/return': { message: 'برگشت شد.', id: '602', records: { statements: [], contracts: [] } },
  'POST statements/601/void': { message: 'ابطال شد.', id: '601', records: { statements: [], contracts: [] } },
  'POST contracts/202/advance': { message: 'درخواست پرداخت پیش‌پرداخت ثبت شد.', records: { payment_requests: [] } },
  'POST receipts': { message: 'دریافت ثبت شد.', records: { receipts: [] } },
  'GET petty-cash': {
    funds: [fund()], categories: [{ id: '1', name: 'مصالح جزئی', subcategories: ['پیچ و مهره'], account_code: '51101', active: true, version: 1 }],
    settings: {
      fund_limits: {
        project_manager: { ceiling: 3_000_000_000, min_balance_warning: 600_000_000, max_single_expense: 1_000_000_000 },
        site_supervisor: { ceiling: 2_500_000_000, min_balance_warning: 500_000_000, max_single_expense: 500_000_000 },
        procurement: { ceiling: 1_500_000_000, min_balance_warning: 400_000_000, max_single_expense: 800_000_000 },
        headquarters: { ceiling: 1_200_000_000, min_balance_warning: 300_000_000, max_single_expense: 400_000_000 },
      },
      site_level_max: 200_000_000, project_level_max: 1_000_000_000,
      approval_chains: { site_manager_and_finance: ['حسابدار'], project_and_finance: ['مدیر پروژه', 'حسابدار'], ceo_full: ['مدیر پروژه', 'حسابدار', 'مدیر ارشد'] },
      replenishment_senior_threshold: 1_000_000_000, low_balance_percent: 25, default_expense_account: '51101',
    },
    expenses: [expense()],
    requests: [{ id: '45', number: 'PCR-1405-00001', fund_id: '41', fund_title: 'تنخواه کارگاه', project_id: '5', amount: 2_000_000_000, reason: 'شارژ اول', date: '2026-09-09', status: 'paid',
      chain: ['مدیر پروژه', 'حسابدار', 'مدیر ارشد'], step_index: 3, current_step: null, history: [], requested_by: '7', requested_by_name: 'حسابدار یک', last_approved_by: '1',
      reject_reason: '', payment_request_id: '70', balance_at_request: 0, version: 4 }],
    counts: [{ id: '47', number: 'RCN-1405-00001', fund_id: '41', fund_title: 'تنخواه کارگاه', holder_name: 'متصدی', period_start: '2026-09-01', period_end: '2026-09-25',
      book_balance: 1_250_000_000, pending_expenses: 0, expected_balance: 1_250_000_000, counted_cash: 1_240_000_000, discrepancy: -10_000_000, reason: 'رسید گمشده', notes: '',
      entry: { id: '91', number: 'DRF-1405-00004', status: 'pending' }, closes_period: false, counted_by: '7', counted_by_name: 'حسابدار یک', created_at: '2026-09-25T10:00:00Z' }],
    replenishments: [{ id: '80', fund_id: '41', payment_request_number: 'PAY-1405-00000', amount: 2_000_000_000, account_id: '61', account_title: 'بانک نمونه', method: 'satna',
      tracking: 'S-1', date: '2026-09-10', description: 'شارژ تنخواه', entry_number: 'ACC-1405-00003', paid_by_name: 'حسابدار یک' }],
  },
  'GET treasury': {
    accounts: [
      { id: '61', kind: 'bank', code: 'TRA-1405-00001', title: 'بانک نمونه', bank_name: 'بانک نمونه', branch: 'مرکزی', account_number: '0100', sheba: '', holder_name: 'شرکت',
        keeper_user_id: null, location: '', project_id: null, account_code: '11101', active: true, balance: 2_900_000_000, total_in: 5_000_000_000, total_out: 2_100_000_000, version: 1 },
      { id: '62', kind: 'cash', code: 'TRA-1405-00002', title: 'صندوق کارگاه', bank_name: '', branch: '', account_number: '', sheba: '', holder_name: 'تحویلدار',
        keeper_user_id: null, location: 'کارگاه', project_id: '5', account_code: '11102', active: true, balance: 30_000_000, total_in: 30_000_000, total_out: 0, version: 1 },
    ],
    payment_requests: [payReq(), payReq({ id: '72', number: 'PAY-1405-00002', status: 'pending', paid_amount: 0, remaining_amount: 300_000_000, approved_by: null, approved_by_name: '', approved_at: null, payments: [], version: 1 })],
    receipts: [{ id: '95', number: 'REC-1405-00001', receipt_type: 'statement', credit_account_code: '11201', counterparty_id: null, payer_name: 'کارفرما', project_id: null, account_id: '61',
      account_title: 'بانک نمونه', amount: 50_000_000, date: '2026-09-22', method: 'transfer', tracking: 'T-5', cheque_number: '', cheque_due_date: null, cheque_id: null, description: '',
      status: 'pending', created_by: '9', created_by_name: 'حسابدار دو', approved_by: null, reject_reason: '', entry: null, version: 1 }],
    cheques: [{ id: '97', direction: 'payable', serial: '123456', bank_name: 'بانک نمونه', amount: 200_000_000, issue_date: '2026-09-22', due_date: '2026-10-01', counterparty_id: '3',
      party_name: 'تأمین‌کننده', project_id: '5', account_id: '61', account_title: 'بانک نمونه', source_type: 'payment', source_id: '82', status: 'pending', status_date: null, status_note: '', version: 1 }],
    transfers: [],
    statement_lines: [{ id: '99', account_id: '61', date: '2026-09-23', description: 'کارمزد', reference: 'B2', direction: 'withdrawal', amount: 25_000, status: 'unmatched',
      matched_line_id: null, voucher: null, matched_entry: null, version: 1 }],
    settings: { payment_senior_threshold: 1_000_000_000 },
  },
  'GET approvals': approvalsBody,
  'GET treasury/settings': { settings: { payment_senior_threshold: 1_000_000_000, vat_rate_percent: 9 } },
  'GET report-settings': { settings: {
    company: { legal_name: 'آریا کاوش پی هامون', national_id: '', registration_number: '', economic_code: '', address: '', phone: '', logo_url: null },
    signatories: { projects: [{ title: 'تهیه‌کننده', user_id: null, name: '' }, { title: 'مدیرعامل', user_id: '4', name: 'مدیر یک' }], journal_entry: [] },
    report_types: [{ key: 'projects', label: 'گزارش پروژه‌ها', workflow: false }, { key: 'journal_entry', label: 'سند حسابداری', workflow: true }],
    version: 3, updated_at: null,
  } },
  'GET print/signatures': { entity_type: 'journal_entry', entity_id: '12', report_type: 'journal_entry', number: 'ACC-1405-00002', slots: [
    { title: 'تهیه‌کننده', user_id: '7', name: 'حسابدار یک', role: '', at: '2026-09-20T08:00:00Z', signed: true, source: 'approval' },
    { title: 'تأییدکننده', user_id: null, name: '', role: '', at: null, signed: false, source: 'approval' },
  ] },
  'POST treasury/settings': { message: 'تنظیمات خزانه ذخیره شد.', records: { treasury_settings: [{ payment_senior_threshold: 1_000_000_000, vat_rate_percent: 10 }] } },
  'POST report-settings': { message: 'تنظیمات گزارش و چاپ ذخیره شد.', records: { report_settings: [{
    company: { legal_name: 'آریا کاوش پی هامون', national_id: '10100000000', registration_number: '', economic_code: '', address: '', phone: '', logo_url: null },
    signatories: { projects: [{ title: 'حسابدار', user_id: null, name: '' }] }, report_types: [], version: 4, updated_at: null,
  }] } },
  'GET treasury/accounts/61/reconciliation': { account: {}, statement_lines: [], unmatched_ledger_lines: [{ line_id: '501', doc_number: 'ACC-1405-00010', date: '2026-09-23', description: 'x', direction: 'withdrawal', amount: 25_000 }] },
  'POST petty-cash/expenses/51/approve': { message: 'هزینه EXP-1405-00002 تأیید نهایی شد و سند ACC-1405-00011 صادر شد.', id: '51', doc_number: 'ACC-1405-00011', records: {
    petty_expenses: [expense({ status: 'approved', current_step: null, step_index: 2, entry: { id: '92', number: 'ACC-1405-00011', status: 'posted' }, version: 3 })],
    petty_funds: [fund({ balance: 1_250_000_000, pending_expenses: 0, version: 4 })],
  } },
  'POST payment-requests/71/pay': { message: 'پرداخت ثبت شد.', id: '82', doc_number: 'ACC-1405-00012', records: { payment_requests: [payReq({ status: 'paid', paid_amount: 300_000_000, remaining_amount: 0, version: 4 })] } },
  'POST receipts/95/approve': { message: 'دریافت REC-1405-00001 تأیید شد.', id: '95', doc_number: 'ACC-1405-00013', records: {} },
  'POST bank-statement-lines/99/match': { message: 'تطبیق شد.', id: '99', records: { bank_statement_lines: [{ id: '99', account_id: '61', date: '2026-09-23', description: 'کارمزد', reference: 'B2', direction: 'withdrawal', amount: 25_000, status: 'matched', matched_line_id: '501', voucher: null, matched_entry: { id: '93', number: 'ACC-1405-00010', status: 'posted' }, version: 2 }] } },
  'GET me': { id: '7', display_name: 'حسابدار یک', role: 'حسابدار', role_slug: 'paydar_accountant', view_all: true, project_ids: [], currency: 'rial', fiscal_year: 1405, closed_fiscal_years: [1403], today: '2026-09-25' },
  'GET projects': { projects: [{
    id: '5', code: 'PRJ-1405-00001', name: 'پروژه آزمون', client_id: null, client_name: 'کارفرما', consultant_name: '', manager_user_id: '21', manager_name: 'مدیر پروژه',
    site_supervisor: '', location: '', contract_ref: '', description: '', status: 'mobilizing', physical_progress: 12, start_date: '2026-04-04', end_date: null,
    budget: 5_000_000_000, contract_amount: 9_000_000_000, manual_summary: { revenue: 125_000_000_000, cost: 0, cash: 0, receivable: 0, payable: 0, note: 'منتقل‌شده' },
    legacy_id: 'PRJ-24-AAA', version: 3, editable: ['financial'], created_at: '2026-04-01T00:00:00Z', updated_at: '2026-04-01T00:00:00Z',
  }] },
  'GET cost-centers': { cost_centers: [{ id: '8', code: 'CC-1405-00001', name: 'کارگاه', project_id: '5', type: 'project_site', manager_name: '', budget: 0, active: true, version: 1 }] },
  'GET counterparties': { counterparties: [{ id: '3', kind: 'supplier', name: 'تأمین‌کننده', national_id: '', economic_code: '', phone: '', email: '', address: '', sheba: '', bank_name: '', trade_type: '', active: true, version: 1 },
    { id: '13', kind: 'client', name: 'کارفرمای آزمون', national_id: '', economic_code: '', phone: '', email: '', address: '', sheba: '', bank_name: '', trade_type: '', active: true, version: 1 }] },
  'GET accounts': { accounts: [
    { id: '1', code: '1', title: 'دارایی', level: 'group', nature: 'debit', parent_code: null, active: true, postable: false, version: 1 },
    { id: '2', code: '11', title: 'جاری', level: 'general', nature: 'debit', parent_code: '1', active: true, postable: false, version: 1 },
    { id: '3', code: '111', title: 'نقد', level: 'subsidiary', nature: 'debit', parent_code: '11', active: true, postable: false, version: 1 },
    { id: '4', code: '11101', title: 'بانک', level: 'detail', nature: 'debit', parent_code: '111', active: true, postable: true, version: 1 },
    { id: '5', code: '61101', title: 'حقوق ستاد', level: 'detail', nature: 'debit', parent_code: '111', active: true, postable: true, version: 1 },
  ] },
  'GET journal-entries': { entries: [entry(), entry({ id: '12', doc_number: null, draft_number: 'DRF-1405-00002', status: 'pending', approved_by: null, approved_at: null, version: 1 })], page: 1, total: 2 },
  'GET audit': { events: [], page: 1, total: 0 },
  'GET documents': { documents: [{
    id: '31', doc_number: 'DOC-1405-00001', title: 'قرارداد اسکن‌شده', doc_type: 'client_contract', description: '', project_id: '5', cost_center_id: null, counterparty_id: '3',
    file_name: 'contract.pdf', mime: 'application/pdf', size: 2048, sha256: 'a'.repeat(64), version: 1, uploaded_by: '7', uploaded_by_name: 'حسابدار یک',
    uploaded_at: '2026-04-05T08:00:00Z', status: 'active', archived_at: null, preview: true, can_archive: true,
    links: [{ entity_type: 'project', entity_id: '5' }, { entity_type: 'counterparty', entity_id: '3' }, { entity_type: 'invoice', entity_id: '44' }],
  }], page: 1, total: 1 },
  'POST journal-entries': { message: 'سند DRF-1405-00003 ثبت شد.', id: '13', doc_number: 'DRF-1405-00003', records: { journal_entries: [entry({ id: '13', doc_number: null, draft_number: 'DRF-1405-00003', status: 'pending', version: 1 })] } },
  'POST journal-entries/12/post': { message: 'قطعی شد.', id: '12', doc_number: 'ACC-1405-00002', records: { journal_entries: [entry({ id: '12', doc_number: 'ACC-1405-00002', version: 2 })] } },
  'POST projects/5': { message: 'به‌روز شد.', id: '5', records: { projects: [] } },
  'POST assistant/settings': { message: 'تنظیمات دستیار ذخیره شد.', records: { assistant_settings: [{
    enabled: true, provider: 'gemini', base_url: 'https://proxy.example.test', model: 'gemini-3.8-flash', max_tokens: 4096, daily_limit: 30, log_content: false,
    key: { source: 'settings', hint: '•••• 1234' }, proxy_token: { source: 'settings', hint: '•••• 9876' }, encryption_ready: true, configured: true,
  }] } },
  'POST documents/31/links': { message: 'سند DOC-1405-00001 به رکورد پیوند شد.', records: { documents: [{ id: '31', doc_number: 'DOC-1405-00001', title: 'قرارداد اسکن‌شده', doc_type: 'client_contract', file_name: 'contract.pdf', mime: 'application/pdf', size: 2048, version: 1, status: 'active', uploaded_at: '2026-04-05T08:00:00Z', links: [{ entity_type: 'statement', entity_id: '9' }], preview: true, can_archive: true }] } },
  'POST documents/31/archive': { message: 'سند DOC-1405-00001 بایگانی شد.', records: { documents: [{ id: '31', doc_number: 'DOC-1405-00001', title: 'قرارداد اسکن‌شده', doc_type: 'client_contract', file_name: 'contract.pdf', mime: 'application/pdf', size: 2048, version: 2, status: 'archived', uploaded_at: '2026-04-05T08:00:00Z', links: [], preview: true, can_archive: false }] } },
};

const g = globalThis as unknown as Record<string, unknown>;
// Plain permalinks, as on the live site: the REST base is a query string.
g.window = { AkphPortal: { mode: 'live', restUrl: 'https://site.test/?rest_route=/akph/v1', nonce: 'nonce-1', siteName: 'شرکت آزمون' } };
/** One-off answers, used before `responses`: a status and body, or a network failure ('network'). */
const queued: Record<string, ({ status: number; body: unknown } | 'network')[]> = {};
g.fetch = async (url: string, init: RequestInit) => {
  const prefix = 'https://site.test/?rest_route=/akph/v1/';
  assert.ok(url.startsWith(prefix), `REST URL keeps rest_route: ${url}`);
  const [path, query = ''] = url.slice(prefix.length).split('&', 2);
  const method = init.method || 'GET';
  calls.push({ method, url: path, query, headers: init.headers as Record<string, string>, body: init.body ? JSON.parse(String(init.body)) : undefined });
  const key = `${method} ${path}`;
  const next = queued[key]?.shift();
  if (next === 'network') throw new TypeError('Failed to fetch');
  if (next) return new Response(JSON.stringify(next.body), { status: next.status });
  if (!(key in responses)) return new Response(JSON.stringify({ code: 'rest_no_route', message: 'No route' }), { status: 404 });
  return new Response(JSON.stringify(responses[key]), { status: 200 });
};

const { createAkphDataSource } = await import('../src/api/akph');
const { sendCommand, ApiError } = await import('../src/api/client');
const { createCommandKeys, stableStringify } = await import('../src/store/commandKeys');
const { parseEntry, parseAccounts } = await import('../src/api/akph/mapping');
const { appReducer } = await import('../src/store/AppStore');
const { isoToJalali, jalaliToIso } = await import('../src/utils/jalali');

// ---------------------------------------------------------------- Jalali ↔ ISO (same algorithm as the server)
const fa = new Intl.DateTimeFormat('en-US-u-ca-persian-nu-latn', { year: 'numeric', month: 'numeric', day: 'numeric', timeZone: 'UTC' });
for (let d = Date.UTC(2015, 0, 1); d <= Date.UTC(2032, 11, 31); d += 86_400_000) {
  const iso = new Date(d).toISOString().slice(0, 10);
  const parts = Object.fromEntries(fa.formatToParts(new Date(d + 43_200_000)).map((p) => [p.type, p.value]));
  const expected = `${parts.year}/${String(parts.month).padStart(2, '0')}/${String(parts.day).padStart(2, '0')}`;
  const got = isoToJalali(iso).replace(/[۰-۹]/g, (c) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(c)));
  assert.equal(got, expected, iso);
  assert.equal(jalaliToIso(got), iso);
}
assert.equal(jalaliToIso('۱۴۰۴/۱۲/۳۰'), null, '1404 has no Esfand 30');
assert.equal(jalaliToIso('1403/12/30'), '2025-03-20');
console.log('  ✔ تبدیل شمسی ↔ میلادی با تقویم مرورگر برای ۱۸ سال یکسان است');

// ---------------------------------------------------------------- reading
const source = createAkphDataSource();
assert.equal(source.kind, 'akph');
const session = await source.loadSession();
assert.equal(session.user.role, 'حسابدار');
assert.equal(session.user.id, '7');
assert.equal(session.user.projectIds, undefined, 'view-all roles are not scoped');
assert.equal(session.currency, 'rial');
assert.equal(session.company.name, 'آریا کاوش پی هامون', 'the report settings name the company (the site name only when they cannot be read)');
const state = await source.loadState(session);
assert.equal(state.projects[0].status, 'تجهیز کارگاه');
assert.equal(state.projects[0].startDate, '۱۴۰۵/۰۱/۱۵', 'ISO dates become Jalali');
assert.equal(state.projects[0].manualSummary?.revenue, 125_000_000_000, 'amounts stay integer Rials');
assert.equal(state.projects[0].recordedRevenue, 0, 'ledger figures are never taken from the project record');
assert.deepEqual(state.projects[0].costCenterIds, ['8']);
assert.deepEqual(state.projects[0].editableGroups, ['financial']);
assert.equal(state.chartOfAccounts.length, 1);
assert.equal(state.chartOfAccounts[0].children?.[0].children?.[0].children?.length, 2, 'flat accounts become the tree');
const [posted, pending] = state.journalEntries;
assert.equal(posted.status, 'تأیید شده');
assert.equal(posted.date, '۱۴۰۵/۰۱/۱۰');
assert.equal(posted.totalDebit, 150);
assert.equal(posted.rows[0].accountName, 'حقوق ستاد');
assert.equal(posted.rows[0].costCenterName, 'کارگاه');
assert.equal(posted.rows[1].subledgerCode, '3');
assert.equal(pending.status, 'در انتظار تأیید');
assert.equal(pending.docNumber, 'DRF-1405-00002');
assert.equal(state.subledgers[0].id, '3', 'counterparties are offered as subledgers');
const [doc] = state.documents;
assert.equal(doc.docNumber, 'DOC-1405-00001');
assert.equal(doc.type, 'قرارداد اصلی کارفرما', 'server doc_type becomes the app category');
assert.equal(doc.date, '۱۴۰۵/۰۱/۱۶');
assert.equal(doc.fileFormat, 'PDF');
assert.deepEqual(doc.links.map((l) => l.entityType), ['project', 'counterparty', 'vendor_invoice'], 'server entity types become app ones');
assert.equal(doc.file?.previewable, true);
assert.equal(doc.file?.canArchive, true);
assert.equal(doc.url, undefined, 'no direct file URL: files come through the download route');
assert.ok(calls.find((c) => c.url === 'documents')!.query.includes('status=all'), 'archived documents are loaded too');
assert.deepEqual(state.financeSettings.closedFiscalYears, [1403]);
assert.ok(!('saveChanges' in source) || source.saveChanges === undefined, 'no generic record write');
assert.ok(calls.every((c) => c.headers['X-WP-Nonce'] === 'nonce-1'), 'every request carries the nonce');
assert.ok(calls.find((c) => c.url === 'journal-entries')!.query.includes('per_page=500'), 'query joined with & under plain permalinks');
console.log('  ✔ نشست از /me، پروژه‌ها، مراکز هزینه، طرف‌های حساب، کدینگ و اسناد از akph/v1 خوانده شد');

// ---------------------------------------------------------------- commands
const commands = source.commands!;
for (const a of ['createManualJournalEntry', 'submitManualJournalEntryForm', 'approveJournalEntryLogged', 'rejectJournalEntryLogged', 'reverseJournalEntryLogged', 'createProject', 'updateProject', 'createCostCenter', 'createCounterparty', 'createAccount']) {
  assert.equal(commands.supports(a), true, a);
}
for (const a of ['approveVendorInvoice', 'closeFiscalYearLogged', 'createRequisition']) assert.equal(commands.supports(a), false, a);
console.log('  ✔ فرمان‌های این مرحله پشتیبانی می‌شوند؛ بقیه «فقط خواندنی — به‌زودی»');

const draftKey = 'submission-key-0001';
const draft = await commands.run('createManualJournalEntry', [{
  id: 'local', docNumber: 'LOCAL-1', date: '۱۴۰۵/۰۲/۰۱', title: 'دستی', type: 'پرداخت', submitter: 'x', status: 'تأیید شده',
  rows: [
    { id: 'r1', accountCode: '61101', accountName: '', description: '', debit: 15, credit: 0, projectId: '5', costCenterId: '8' },
    { id: 'r2', accountCode: '61101', accountName: '', description: '', debit: 15, credit: 0 },
    { id: 'r3', accountCode: '11101', accountName: '', description: '', debit: 0, credit: 30, subledgerCode: '3' },
  ],
  totalDebit: 30, totalCredit: 30, isBalanced: true, history: [],
}], state, draftKey);
const create = calls.find((c) => c.method === 'POST' && c.url === 'journal-entries')!;
assert.equal(create.headers['Idempotency-Key'], draftKey, 'the key of the form submission is sent as given');
const body = create.body as Record<string, unknown>;
for (const k of ['id', 'status', 'doc_number', 'docNumber', 'draft_number', 'total', 'totalDebit', 'submitter', 'version']) assert.ok(!(k in body), `draft body must not carry ${k}`);
assert.equal(body.date, '2026-04-21', 'Jalali form date → ISO');
assert.equal(body.entry_type, 'payment');
const lines = body.lines as { debit: number; credit: number; cost_center_id: string | null; counterparty_id: string | null }[];
assert.deepEqual(lines.map((l) => l.debit), [15, 15, 0], 'Rials sent unchanged, row by row');
assert.equal(lines[0].cost_center_id, '8');
assert.equal(lines[2].counterparty_id, '3');
assert.equal(draft.records[0].slice, 'journalEntries');
assert.equal(draft.docNumber, 'DRF-1405-00003');
console.log('  ✔ سند دستی فقط به‌صورت ورودی کاربر و با Idempotency-Key ارسال شد؛ شماره، وضعیت و جمع‌ها را سرور داد');

const merged = appReducer(state, { type: 'MERGE_SERVER_RECORDS', records: draft.records });
assert.equal(merged.journalEntries[0].id, '13');
await commands.run('approveJournalEntryLogged', ['12'], merged, 'submission-key-0002');
const postCall = calls.find((c) => c.url === 'journal-entries/12/post')!;
assert.equal(postCall.headers['If-Match'], '"1"', 'If-Match carries the record version');
assert.deepEqual(postCall.body, { version: 1 });
console.log('  ✔ قطعی‌کردن با version و If-Match نسخه رکورد');

await commands.run('updateProject', ['5', { physicalProgress: 40, startDate: '۱۴۰۵/۰۲/۰۱', manualRevenue: 7 }], state, 'submission-key-0003');
const upd = calls.find((c) => c.url === 'projects/5')!;
assert.deepEqual(upd.body, { physical_progress: 40, start_date: '2026-04-21', manual_revenue: 7, version: 3 }, 'only the changed fields, with the version');
console.log('  ✔ ویرایش پروژه فقط فیلدهای تغییرکرده را با نسخه رکورد می‌فرستد');

// ---------------------------------------------------------------- petty cash, treasury, approval center (0.6.0)
{
  const { readOnlyNoticeFor } = await import('../src/store/readOnly');
  const { selectApprovals } = await import('../src/store/domainSelectors');
  for (const path of ['/petty-cash', '/finance/payments', '/finance/receipts', '/finance/banks', '/finance/cash', '/approvals']) {
    assert.equal(readOnlyNoticeFor(source.writablePaths, path), null, `${path} is not read-only with the server`);
  }
  assert.match(readOnlyNoticeFor(source.writablePaths, '/procurement') || '', /فقط خواندنی/, 'sections without server commands stay read-only');

  const [f] = state.pettyCashAccounts;
  assert.equal(f.actualBalance, 1_850_000_000, 'fund balance from the server (ledger)');
  assert.equal(f.usableBalance, 1_250_000_000);
  assert.equal(f.projectName, 'پروژه آزمون');
  assert.equal(f.sourceBankAccountTitle, 'بانک نمونه - 0100');
  const [e] = state.pettyCashExpenses;
  assert.equal(e.status, 'pending_approval');
  assert.equal(e.currentApprovalStep, 'حسابدار', 'the current step comes from the server');
  assert.equal(e.submitterId, '1');
  assert.equal(e.approvalHistory[0].level, 'ثبت اولیه');
  assert.equal(e.approvalHistory[1].approverId, '21');
  assert.equal(e.date, '۱۴۰۵/۰۶/۲۹');
  assert.equal(state.pettyCashRequests[0].status, 'تأیید شده');
  assert.equal(state.pettyCashReconciliations[0].status, 'دارای کسری');
  assert.equal(state.pettyCashReconciliations[0].adjustmentDocNumber, 'DRF-1405-00004');
  assert.equal(state.pettyCashReplenishments[0].pettyCashTitle, 'تنخواه کارگاه');
  assert.equal(state.pettyCashSettings.projectLevelMax, 1_000_000_000);
  assert.deepEqual(state.pettyCashSettings.approvalChains.ceo_full, ['مدیر پروژه', 'حسابدار', 'مدیر ارشد']);
  assert.equal(state.bankAccounts[0].balance, 2_900_000_000, 'bank balance from the ledger');
  assert.equal(state.bankAccounts[0].totalReceipts, 5_000_000_000);
  assert.equal(state.cashDesks[0].title, 'صندوق کارگاه');
  const [queued, waiting] = state.paymentRequests;
  assert.equal(queued.status, 'در صف پرداخت خزانه');
  assert.equal(queued.remainingAmount, 200_000_000, 'partial payment: remaining from the server');
  assert.equal(queued.approvedById, '9');
  assert.equal(waiting.status, 'در انتظار تأیید مالی');
  assert.equal(state.payments[0].docNumber, 'ACC-1405-00009');
  assert.equal(state.receipts[0].pendingApproval, true);
  assert.equal(state.receipts[0].status, 'در جریان وصول');
  assert.equal(state.treasuryChecks[0].status, 'در جریان وصول/سررسید');
  assert.equal(state.bankReconciliations[0].matched, false);
  const approvals = selectApprovals(state);
  assert.deepEqual(approvals.map((a) => a.id), ['petty_cash_expense:51', 'receipt:95'], 'the approval center lists what the server says');
  assert.equal(approvals[0].server?.approvePath, 'petty-cash/expenses/51/approve');
  assert.equal(approvals[0].context.lastApprovedBy, '21');
  console.log('  ✔ تنخواه، خزانه و کارتابل از سرور خوانده شد؛ موجودی‌ها و مرحله‌ها از سرور است');

  for (const a of ['approvePettyCashExpense', 'payRequestForm', 'recordReceipt', 'decideServerApproval', 'transferBetweenAccounts', 'changeChequeStatus', 'importBankStatement', 'closePettyCashPeriod']) {
    assert.equal(commands.supports(a), true, a);
    assert.equal(commands.serverValidated?.(a), true, `${a}: the server decides`);
  }
  calls.length = 0;
  const approved = await commands.run('approvePettyCashExpense', ['51', 'بررسی شد'], state, 'petty-approve-key');
  const approveCall = calls.find((c) => c.url === 'petty-cash/expenses/51/approve')!;
  assert.deepEqual(approveCall.body, { comment: 'بررسی شد', version: 2 }, 'only the comment and the version');
  assert.equal(approveCall.headers['Idempotency-Key'], 'petty-approve-key');
  assert.ok(calls.some((c) => c.method === 'GET' && c.url === 'approvals'), 'the approval center is refreshed after a command');
  const afterApprove = appReducer(state, { type: 'MERGE_SERVER_RECORDS', records: approved.records });
  assert.equal(afterApprove.pettyCashExpenses[0].status, 'approved');
  assert.equal(afterApprove.pettyCashExpenses[0].journalEntryId, 'ACC-1405-00011');
  assert.equal(afterApprove.pettyCashAccounts[0].actualBalance, 1_250_000_000);
  assert.ok(Array.isArray(afterApprove.serverApprovals));

  calls.length = 0;
  await commands.run('payRequestForm', [{ requestId: '71', sourceId: 'bank:61', amount: 200_000_000, trackingNumber: 'P-2' }], state, 'pay-key');
  const payCall = calls.find((c) => c.url === 'payment-requests/71/pay')!;
  assert.deepEqual(payCall.body, { amount: 200_000_000, account_id: '61', method: 'transfer', tracking: 'P-2', version: 3 }, 'no balance, entry or status from the browser');

  calls.length = 0;
  await commands.run('decideServerApproval', [approvals[1], 'approve', ''], state, 'approval-key');
  assert.deepEqual(calls.find((c) => c.url === 'receipts/95/approve')!.body, { comment: '', version: 1 }, 'approval runs the owning module\'s command');

  calls.length = 0;
  await commands.run('reconcileBankItemLogged', ['99'], state, 'recon-key');
  assert.deepEqual(calls.find((c) => c.url === 'bank-statement-lines/99/match')!.body, { ledger_line_id: '501', version: 1 }, 'matched with the ledger line of the same amount');

  await assert.rejects(
    commands.run('recordReceipt', [{ sourceType: 'سایر درآمدها', amount: 1, bankAccountId: '61', method: 'تهاتر', trackingNumber: '-' }], state, 'receipt-key'),
    (err: unknown) => err instanceof ApiError && /تهاتر/.test(err.farsiMessage)
  );
  console.log('  ✔ فرمان‌های تنخواه، خزانه و کارتابل فقط ورودی کاربر و نسخه رکورد را می‌فرستند و کارتابل پس از هر فرمان تازه می‌شود');
}

// ---------------------------------------------------------------- documents
{
  const docs = source.documents!;
  assert.equal(docs.demo, false);
  const linked = await docs.link(state.documents[0], { entityType: 'subcontractor_statement', entityId: '9' }, 'doc-link-key');
  const linkCall = calls.find((c) => c.url === 'documents/31/links')!;
  assert.deepEqual(linkCall.body, { entity_type: 'statement', entity_id: '9' }, 'app record kinds are sent as the server entity types');
  assert.equal(linkCall.headers['Idempotency-Key'], 'doc-link-key');
  assert.equal(linked.document.links[0].entityType, 'client_statement');
  const archived = await docs.archive(state.documents[0], 'doc-archive-key');
  const archiveCall = calls.find((c) => c.url === 'documents/31/archive')!;
  assert.deepEqual(archiveCall.body, { version: 1 });
  assert.equal(archiveCall.headers['If-Match'], '"1"');
  assert.equal(archived.document.status, 'بایگانی‌شده');
  assert.equal(archived.document.file?.canArchive, false);
}
console.log('  ✔ پیوند و بایگانی سند فقط با فرمان سرور (Idempotency-Key و نسخه رکورد)؛ حذفی وجود ندارد');

// ---------------------------------------------------------------- assistant settings (Gemini, proxy token)
{
  const { createAkphAssistantApi, parseAssistantSettings } = await import('../src/api/akph/assistant');
  assert.equal(parseAssistantSettings({ key: {} }).provider, 'gemini', 'Gemini is the default provider');
  assert.deepEqual(parseAssistantSettings({ key: {} }).proxyToken, { source: 'none', hint: '' });
  const input = {
    enabled: true, provider: 'gemini' as const, baseUrl: ' https://proxy.example.test ', model: 'gemini-3.8-flash', maxTokens: 4096, dailyLimit: 30, logContent: false,
    apiKey: '', clearKey: false, proxyToken: 'proxy-token-0123456789', clearProxyToken: false,
  };
  const saved = await createAkphAssistantApi().saveSettings(input, 'assistant-settings-key');
  const sentBody = calls.find((c) => c.url === 'assistant/settings')!.body as Record<string, unknown>;
  assert.equal(sentBody.proxy_token, 'proxy-token-0123456789', 'a new proxy token is sent once, to the server');
  assert.equal(sentBody.base_url, 'https://proxy.example.test');
  assert.ok(!('api_key' in sentBody), 'an empty key keeps the stored one');
  assert.equal(saved.settings.provider, 'gemini');
  assert.deepEqual(saved.settings.proxyToken, { source: 'settings', hint: '•••• 9876' }, 'the token comes back only as a hint');
  const { modelForProvider } = await import('../src/store/useAssistant');
  assert.equal(modelForProvider('gemini', 'claude-opus-5'), 'gemini-3.8-flash', 'switching providers replaces a default model');
  assert.equal(modelForProvider('gemini', 'my-model'), 'my-model', 'a model the administrator typed stays');
}
console.log('  ✔ تنظیمات دستیار: Gemini پیش‌فرض است و توکن واسط فقط فرستاده می‌شود و فقط با چهار نویسه آخر برمی‌گردد');

// A reversal waits for a second person: pending on the wire, pending in the app, the original not yet reversed.
{
  const { pendingReversalIds, reversedEntryIds } = await import('../src/store/postingEngine');
  const lk = { chart: state.chartOfAccounts, projects: state.projects, costCenters: state.costCenters, counterparties: state.counterparties };
  const request = parseEntry(entry({ id: '14', doc_number: null, draft_number: 'DRF-1405-00004', status: 'pending', entry_type: 'reversal', source_type: 'reversal', approved_by: null, approved_at: null, version: 1, reversal_of: { id: '11', doc_number: 'ACC-1405-00001' } }), lk);
  assert.equal(request.status, 'در انتظار تأیید');
  assert.equal(request.docNumber, 'DRF-1405-00004');
  assert.equal(request.reversedFromDocId, '11');
  const withRequest = appReducer(state, { type: 'MERGE_SERVER_RECORDS', records: [{ slice: 'journalEntries', upserted: [request as unknown as Record<string, unknown>] }] });
  assert.ok(pendingReversalIds(withRequest).has('11'));
  assert.ok(!reversedEntryIds(withRequest).has('11'), 'not reversed until another user posts it');
  const posted = parseEntry(entry({ id: '14', doc_number: 'ACC-1405-00003', draft_number: 'DRF-1405-00004', entry_type: 'reversal', source_type: 'reversal', version: 2, reversal_of: { id: '11', doc_number: 'ACC-1405-00001' } }), lk);
  const final = appReducer(withRequest, { type: 'MERGE_SERVER_RECORDS', records: [{ slice: 'journalEntries', upserted: [posted as unknown as Record<string, unknown>] }] });
  assert.ok(reversedEntryIds(final).has('11'));
  assert.ok(!pendingReversalIds(final).has('11'));
  console.log('  ✔ سند معکوس تا تأیید کاربر دوم «در انتظار تأیید» است و سند اصلی تا آن زمان معکوس‌شده حساب نمی‌شود');
}

const replaced = appReducer(state, { type: 'MERGE_SERVER_RECORDS', records: [{ slice: 'chartOfAccounts', replace: parseAccounts(responses['GET accounts']) }] });
assert.equal(replaced.chartOfAccounts[0].code, '1');

// ---------------------------------------------------------------- one Idempotency-Key per form submission
{
  let clock = 1_000;
  let n = 0;
  const keys = createCommandKeys({ now: () => clock, newKey: () => `key-${++n}`, successGraceMs: 15_000, unknownKeepMs: 600_000 });
  const form = { date: '۱۴۰۵/۰۲/۰۱', title: 'سند', rows: [{ accountCode: '11101', debit: 5 }] };
  const first = keys.acquire('submitManualJournalEntryForm', [form]);
  assert.deepEqual(first, { key: 'key-1', inFlight: false });
  // Pressing submit again while the first send is on its way: same key, and not sent again.
  assert.deepEqual(keys.acquire('submitManualJournalEntryForm', [{ rows: [{ debit: 5, accountCode: '11101' }], title: 'سند', date: '۱۴۰۵/۰۲/۰۱' }]), { key: 'key-1', inFlight: true }, 'key order does not matter');
  keys.settle('key-1', 'ok');
  clock += 5_000;
  assert.equal(keys.acquire('submitManualJournalEntryForm', [form]).key, 'key-1', 'a late double click gets the stored answer');
  keys.settle('key-1', 'ok');
  clock += 20_000;
  assert.equal(keys.acquire('submitManualJournalEntryForm', [form]).key, 'key-2', 'a later submission is a new command');
  // No answer (network): submitting again by hand reuses the key, so a command that did run is not run twice.
  keys.settle('key-2', 'unknown');
  clock += 300_000;
  assert.equal(keys.acquire('submitManualJournalEntryForm', [form]).key, 'key-2');
  // A refusal leaves nothing on the server: the corrected (or same) form is a new submission.
  keys.settle('key-2', 'rejected');
  assert.equal(keys.acquire('submitManualJournalEntryForm', [form]).key, 'key-3');
  assert.notEqual(keys.acquire('approveJournalEntryLogged', ['12']).key, keys.acquire('approveJournalEntryLogged', ['13']).key, 'another record, another key');
  assert.notEqual(keys.acquire('rejectJournalEntryLogged', ['12', 'x']).key, keys.acquire('approveJournalEntryLogged', ['12']).key, 'another action, another key');
  assert.equal(stableStringify({ b: 1, a: [1, { d: undefined, c: 2 }] }), '{"a":[1,{"c":2}],"b":1}');
  console.log('  ✔ Idempotency-Key یک بار برای هر ارسال فرم ساخته می‌شود و در تکرار همان ارسال تغییر نمی‌کند');
}

// ---------------------------------------------------------------- 409 akph_retry and lost answers
{
  const retryBody = { code: 'akph_retry', message: 'هم‌زمان با کاربر دیگری روی همین رکورد کار شد و هیچ تغییری ذخیره نشد؛ دوباره تلاش کنید.', data: { status: 409, retryable: true } };
  const sends = () => calls.filter((c) => c.url === 'journal-entries/12/post');
  calls.length = 0;
  queued['POST journal-entries/12/post'] = [{ status: 409, body: retryBody }];
  const answer = await sendCommand<{ doc_number: string }>('POST', 'journal-entries/12/post', { version: 1 }, { idempotencyKey: 'retry-key-1', version: 1, retryDelayMs: 1 });
  assert.equal(answer.doc_number, 'ACC-1405-00002');
  assert.equal(sends().length, 2, 'sent again once after 409 akph_retry');
  assert.deepEqual(sends().map((c) => c.headers['Idempotency-Key']), ['retry-key-1', 'retry-key-1'], 'with the same key');

  calls.length = 0;
  queued['POST journal-entries/12/post'] = [{ status: 409, body: retryBody }, { status: 409, body: retryBody }];
  await assert.rejects(sendCommand('POST', 'journal-entries/12/post', {}, { idempotencyKey: 'retry-key-2', retryDelayMs: 1 }), (e: unknown) => e instanceof ApiError && e.code === 'akph_retry' && !e.outcomeUnknown);
  assert.equal(sends().length, 2, 'only once');

  calls.length = 0;
  queued['POST journal-entries/12/post'] = [{ status: 409, body: { code: 'akph_conflict', message: 'نسخه رکورد تغییر کرده است.', data: { status: 409 } } }];
  await assert.rejects(sendCommand('POST', 'journal-entries/12/post', {}, { idempotencyKey: 'retry-key-3', retryDelayMs: 1 }), (e: unknown) => e instanceof ApiError && e.code === 'akph_conflict');
  assert.equal(sends().length, 1, 'a stale version is not sent again');

  calls.length = 0;
  queued['POST journal-entries/12/post'] = ['network'];
  await sendCommand('POST', 'journal-entries/12/post', {}, { idempotencyKey: 'retry-key-4' });
  assert.deepEqual(sends().map((c) => c.headers['Idempotency-Key']), ['retry-key-4', 'retry-key-4'], 'a lost answer is asked again with the same key');
  console.log('  ✔ خطای 409 akph_retry (بن‌بست/پایان مهلت قفل) و پاسخ گم‌شده یک بار با همان کلید تکرار می‌شوند؛ تعارض نسخه تکرار نمی‌شود');
}

// ---------------------------------------------------------------- report settings and print (0.6.1)
{
  const { readOnlyNoticeFor } = await import('../src/store/readOnly');
  assert.equal(session.company.legalName, 'آریا کاوش پی هامون', 'the letterhead comes from the report settings, not the site name');
  assert.equal(session.reportSettings?.version, 3);
  assert.deepEqual(session.reportSettings?.signatories.projects, [{ title: 'تهیه‌کننده', userId: null, name: '' }, { title: 'مدیرعامل', userId: '4', name: 'مدیر یک' }]);
  assert.equal(state.financeSettings.vatRatePercent, 9, 'VAT rate from the server');
  assert.equal(readOnlyNoticeFor(source.writablePaths, '/settings'), null, '/settings is not read-only with the server');

  calls.length = 0;
  await commands.run('updateFinanceSettings', [{ vatRatePercent: 10 }], state, 'submission-key-vat1');
  const vat = calls.find((c) => c.url === 'treasury/settings' && c.method === 'POST')!;
  assert.deepEqual(vat.body, { vat_rate_percent: 10 });

  const print = source.print!;
  calls.length = 0;
  const saved = await print.save({ company: { nationalId: '10100000000' }, signatories: { projects: [{ title: 'حسابدار', userId: null, name: ' ' }, { title: 'مدیرعامل', userId: '4', name: 'نادیده' }] } }, 3, 'report-settings-key-1');
  const post = calls.find((c) => c.url === 'report-settings')!;
  assert.deepEqual(post.body, { version: 3, company: { national_id: '10100000000' }, signatories: { projects: [{ title: 'حسابدار', name: '' }, { title: 'مدیرعامل', user_id: '4' }] } }, 'a slot sends a user id or a typed name, never both');
  assert.equal(post.headers['If-Match'], '"3"');
  assert.equal(post.headers['Idempotency-Key'], 'report-settings-key-1');
  assert.equal(saved.settings.version, 4);
  assert.equal(saved.settings.company.nationalId, '10100000000');

  const sig = await print.signatures('journal_entry', '12');
  const sigCall = calls.find((c) => c.url === 'print/signatures')!;
  assert.match(sigCall.query, /entity_type=journal_entry/);
  assert.equal(sig?.slots[0].name, 'حسابدار یک');
  assert.equal(sig?.slots[1].signed, false);
  assert.equal(sig?.slots[1].at, null, 'an unsigned step has no date');
  console.log('  ✔ تنظیمات گزارش و چاپ (سربرگ، امضاکنندگان، نسخه و کلید)، نرخ ارزش افزوده و امضاهای سند از سرور');
}


// ---------------------------------------------------------------- contracts and statements (0.7.0)
{
  const { readOnlyNoticeFor } = await import('../src/store/readOnly');
  for (const path of ['/contracts/client', '/contracts/subcontract', '/statements/client', '/statements/subcontractor']) {
    assert.equal(readOnlyNoticeFor(source.writablePaths, path), null, `${path} is not read-only with the server`);
  }
  const [client] = state.contracts;
  assert.equal(client.code, 'CNT-1405-00001', 'the server number is the contract code');
  assert.equal(client.number, 'K-100');
  assert.equal(client.status, 'فعال');
  assert.equal(client.currentValue, 241_000_000, 'value after amendments from the server');
  assert.equal(client.approvedChangesValue, 41_000_000);
  assert.equal(client.executedValue, 80_000_000);
  assert.equal(client.receivableValue, 40_000_000);
  assert.equal(client.server?.guarantees[0].dueSoon, true);
  assert.equal(client.server?.percents.tax, 3);
  const boq = state.contractBoq.find((b) => b.id === '301')!;
  assert.equal(boq.initialQuantity, 120.5, 'decimal quantity');
  assert.equal(boq.cumulativeExecutedQuantity, 40, 'previous = approved quantity');
  assert.equal(state.contractAmendments[0].status, 'تأیید شده');
  assert.equal(state.contractAmendments[0].amount, 41_000_000);
  const [sub] = state.subcontractorContracts;
  assert.equal(sub.status, 'در انتظار تأیید');
  assert.equal(sub.server?.currentStep, 'مدیر پروژه');
  const [stc, sts] = [state.clientStatements[0], state.subcontractorStatements[0]];
  assert.equal(stc.statementNumber, 'STC-1405-00002');
  assert.equal(stc.status, 'approved_by_consultant');
  assert.equal(stc.items[0].currentQuantity, 10.25);
  assert.equal(stc.items[0].boqItemId, '301');
  assert.equal(stc.workflowHistory[1].stepAction, 'client_statement.consultant_approval', 'server history keeps the approval actions');
  assert.equal(stc.workflowHistory[1].toStatus, 'approved_by_consultant');
  assert.deepEqual(stc.server?.currentStep?.requires, ['employer_ref', 'employer_date']);
  assert.equal(stc.deductions[0].calculatedAmount, 1_122_375);
  assert.equal(sts.subcontractorContractId, '202');
  assert.equal(sts.status, 'finance_approved');

  calls.length = 0;
  await commands.run('createClientContract', [{
    code: 'X', number: ' K-200 ', projectTitle: 'دیوارچینی', projectId: '5', employer: 'کارفرمای آزمون', executiveBody: '', consultant: '', contractor: '', initialValue: 999,
    contractDate: '۱۴۰۵/۰۱/۰۵', startDate: '۱۴۰۵/۰۱/۱۰', endDate: '', durationMonths: 12, contractType: 'فهرست‌بهایی', status: 'فعال', advancePaymentPercentage: 10,
    retentionPercentage: 5, description: '', insurancePercentage: 5, taxPercentage: 3, otherPercentage: 0, adjustmentBaseIndex: 100, adjustmentFactorPercentage: 95,
    lines: [{ id: 'l1', code: '01', description: 'دیوار', unit: 'm2', quantity: 12.345, rate: 1_500_000 }, { id: 'l2', code: '', description: '', unit: '', quantity: 0, rate: 0 }],
  }], state, 'contract-key-1');
  const cc = calls.find((c) => c.method === 'POST' && c.url === 'contracts')!;
  const cb = cc.body as Record<string, unknown>;
  assert.equal(cc.headers['Idempotency-Key'], 'contract-key-1');
  for (const k of ['amount', 'number', 'status', 'code', 'initial_value', 'version']) assert.ok(!(k in cb), `contract body must not carry ${k}`);
  assert.equal(cb.kind, 'client');
  assert.equal(cb.contract_no, 'K-200');
  assert.equal(cb.counterparty_id, '13', 'the employer counterparty (by name among clients)');
  assert.equal(cb.contract_date, '2026-03-25');
  assert.deepEqual(cb.lines, [{ code: '01', description: 'دیوار', unit: 'm2', quantity: '12.345', rate: 1_500_000 }], 'blank rows left out; quantity as a decimal string; no amount');
  assert.equal(cb.adjustment_base_index, 100);

  calls.length = 0;
  await commands.run('decideContract', ['202', 'approve', ''], state, 'contract-key-2');
  const ca = calls.find((c) => c.url === 'contracts/202/approve')!;
  assert.equal(ca.headers['If-Match'], '"1"');

  calls.length = 0;
  await commands.run('createContractAmendment', ['201', { number: 'ال-۲', type: 'تغییر مقادیر', date: '۱۴۰۵/۰۳/۰۱', amount: 1, extendedDays: 0, description: '', status: 'در انتظار تأیید',
    lines: [{ id: 'a', contractLineId: '301', description: '', unit: '', rate: 0, quantityDelta: -5.5 }, { id: 'b', contractLineId: '', description: 'ردیف نو', unit: 'm', rate: 900, quantityDelta: 3 }] }], state, 'amend-key-1');
  const am = calls.find((c) => c.url === 'contracts/201/amendments')!.body as Record<string, unknown>;
  assert.ok(!('amount' in am) && !('amount_delta' in am), 'the amendment amount is the server\'s');
  assert.deepEqual(am.lines, [{ contract_line_id: '301', quantity_delta: '-5.5' }, { description: 'ردیف نو', unit: 'm', rate: 900, quantity_delta: '3' }]);

  calls.length = 0;
  await commands.run('submitClientStatementForm', [{
    contractId: '201', statementNumber: 'موقت ۳', statementType: 'موقت', periodStartDate: '۱۴۰۵/۰۶/۰۱', periodEndDate: '۱۴۰۵/۰۶/۳۱', preparationDate: '', description: '',
    quantities: { '301': 7.125 }, overrunClassifications: {}, otherAllowables: 0, adjustmentAmount: 12345, includeVAT: true, advanceRate: 99, retentionRate: 99, insuranceRate: 99,
    withholdingTaxRate: 99, materialDeduction: 0, adjustmentIndex: 110,
  }, 'draft'], state, 'stc-key-1');
  const sb = calls.find((c) => c.url === 'client-statements')!.body as Record<string, unknown>;
  assert.deepEqual(sb.lines, [{ contract_line_id: '301', quantity: '7.125' }], 'only the line and quantity; previous quantity, rate and amount are the server\'s');
  for (const k of ['adjustment_amount', 'retention_rate', 'advance_rate', 'gross_amount', 'net_amount', 'deductions', 'vat_amount']) assert.ok(!(k in sb), `statement body must not carry ${k}`);
  assert.equal(sb.adjustment_index, '110');
  assert.equal(sb.submit, false);

  calls.length = 0;
  const stcMerged = await commands.run('decideClientStatement', ['601', 'approve', '', { employerRef: 'ن-۱۲', employerDate: '۱۴۰۵/۰۷/۰۳' }], state, 'stc-key-2');
  const ap = calls.find((c) => c.url === 'statements/601/approve')!;
  assert.deepEqual(ap.body, { comment: '', employer_ref: 'ن-۱۲', employer_date: '2026-09-25', version: 3 }, 'employer approval letter with the version');
  const approved = appReducer(state, { type: 'MERGE_SERVER_RECORDS', records: stcMerged.records }).clientStatements.find((x) => x.id === '601')!;
  assert.equal(approved.status, 'approved_by_employer');
  assert.equal(approved.accountingJournalEntryId, 'ACC-1405-00020', 'the receivable entry of the posting engine');

  calls.length = 0;
  await commands.run('submitSubcontractorStatementForm', [{ contractId: '202', statementNumber: 'کارکرد ۱', periodStartDate: '۱۴۰۵/۰۶/۰۱', periodEndDate: '۱۴۰۵/۰۶/۳۱', retentionRate: 50, advanceDeduction: 7, penaltyAmount: 1000, otherDeduction: 500,
    lines: [{ id: 'x', contractLineId: '302', locked: true, description: 'آرماتوربندی', unit: 'kg', contractQuantity: 5000, unitRate: 1, previousQuantity: 0, pendingQuantity: 0, currentQuantity: 1200 }] }], state, 'sts-key-1');
  const ssb = calls.find((c) => c.url === 'subcontractor-statements')!.body as Record<string, unknown>;
  assert.deepEqual(ssb.lines, [{ contract_line_id: '302', quantity: '1200' }]);
  assert.equal(ssb.fixed_deduction, 1500, 'penalty and other deductions as one fixed deduction; retention and advance by the server');
  await assert.rejects(
    commands.run('submitSubcontractorStatementForm', [{ contractId: '202', statementNumber: 'x', periodStartDate: '', periodEndDate: '', retentionRate: 0, advanceDeduction: 0, penaltyAmount: 0, otherDeduction: 0,
      lines: [{ id: 'n', locked: false, description: 'کار جدید', unit: 'm', contractQuantity: 1, unitRate: 1, previousQuantity: 0, pendingQuantity: 0, currentQuantity: 1 }] }], state, 'sts-key-2'),
    (e: unknown) => e instanceof ApiError && /الحاقیه/.test(e.farsiMessage),
    'work outside the contract lines needs an amendment',
  );

  calls.length = 0;
  await commands.run('decideSubcontractorStatement', ['602', 'return', 'متره دوباره'], state, 'sts-key-3');
  assert.deepEqual(calls.find((c) => c.url === 'statements/602/return')!.body, { reason: 'متره دوباره', version: 3 });
  await commands.run('voidStatement', ['601', 'اشتباه'], state, 'void-key-1');
  assert.deepEqual(calls.find((c) => c.url === 'statements/601/void')!.body, { reason: 'اشتباه', version: 3 });
  await commands.run('addContractGuarantee', ['201', { kind: 'performance', guaranteeNo: 'G-2', bank: 'بانک', amount: 5_000_000, issueDate: '۱۴۰۵/۰۱/۰۵', dueDate: '۱۴۰۶/۰۱/۰۵', notes: '' }], state, 'g-key-1');
  assert.equal((calls.find((c) => c.url === 'contracts/201/guarantees')!.body as Record<string, unknown>).due_date, '2027-03-25');
  await commands.run('updateContractGuarantee', ['501', { status: 'released' }], state, 'g-key-2');
  assert.deepEqual(calls.find((c) => c.url === 'contract-guarantees/501')!.body, { status: 'released', version: 1 });
  await commands.run('requestSubcontractAdvance', ['202', 3_000_000], state, 'adv-key-1');
  assert.deepEqual(calls.find((c) => c.url === 'contracts/202/advance')!.body, { amount: 3_000_000 });

  calls.length = 0;
  await commands.run('recordReceipt', [{ sourceType: 'صورت‌وضعیت کارفرما', statementId: '601', amount: 5_000_000, bankAccountId: '61', method: 'حواله بانکی', trackingNumber: 'T-9' }], state, 'rec-key-9');
  const rb = calls.find((c) => c.url === 'receipts')!.body as Record<string, unknown>;
  assert.equal(rb.statement_id, '601', 'a statement receipt names its statement');
  assert.equal(rb.receipt_type, 'statement');
  console.log('  ✔ قرارداد، الحاقیه، ضمانت‌نامه و صورت‌وضعیت‌ها: فقط ورودی کاربر؛ مبلغ، مقدار قبلی، کسورات و سند را سرور تعیین می‌کند');
}

// ---------------------------------------------------------------- strict parsing
const look = { chart: [], projects: [], costCenters: [], counterparties: [] };
assert.throws(() => parseEntry(entry({ status: 'weird' }), look), /status/);
assert.throws(() => parseEntry(entry({ total: 1.5 }), look), /ریال/);
assert.throws(() => parseEntry(entry({ date: '1405/01/01' }), look), /تاریخ/);
console.log('  ✔ قالب نامنتظر پاسخ سرور با پیام روشن رد می‌شود');

console.log('\nقرارداد API سرور akph/v1: همه آزمون‌ها موفق.');
