/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo, useState } from 'react';
import {
  Building2,
  Search,
  ArrowRight,
  Briefcase,
  Layers,
  FileSpreadsheet,
  Truck,
  Warehouse as WarehouseIcon,
  FolderLock,
  BarChart3,
  Coins,
  LayoutDashboard,
  FileText,
} from 'lucide-react';
import { Project, PETTY_CASH_FUND_LABELS } from '../../types';
import { useAppState } from '../../store/AppStore';
import { useCurrentUser } from '../../store/session';
import { useWorkflows } from '../../store/useWorkflows';
import { emitToast } from '../../store/toast';
import { canCreateProject, hasManualSummary, projectEditableGroups } from '../../store/views/masterData';
import { ProjectFormModal } from './ProjectFormModal';
import { selectProjectFinancials } from '../../store/selectors';
import {
  selectProjectSuppliers,
  selectDocumentsFor,
  selectPettyFunds,
  selectStockByWarehouse,
  selectWarehouses,
} from '../../store/domainSelectors';
import { CLIENT_STATUS_LABELS, SUB_STATUS_LABELS } from '../statements/statementLabels';
import { barWidth, formatNumber, formatCurrencyCompact, formatDecimal, formatPercent, formatText } from '../../utils/formatters';
import { projectBudgetFigures } from '../../store/views/reports';
import { formatMoney } from '../../utils/money';
import { Money } from '../common/Money';

type ProjectTab = 'overview' | 'contract' | 'cost_centers' | 'statements' | 'suppliers' | 'inventory' | 'petty_cash' | 'documents' | 'budget';

const TABS: Array<{ id: ProjectTab; label: string; icon: typeof Layers }> = [
  { id: 'overview', label: 'نمای کلی', icon: LayoutDashboard },
  { id: 'contract', label: 'قرارداد', icon: Briefcase },
  { id: 'cost_centers', label: 'مراکز هزینه', icon: Layers },
  { id: 'statements', label: 'صورت‌وضعیت‌ها', icon: FileSpreadsheet },
  { id: 'suppliers', label: 'تأمین‌کنندگان', icon: Truck },
  { id: 'inventory', label: 'انبار', icon: WarehouseIcon },
  { id: 'petty_cash', label: 'تنخواه', icon: Coins },
  { id: 'documents', label: 'اسناد', icon: FolderLock },
  { id: 'budget', label: 'بودجه در برابر واقعی', icon: BarChart3 },
];

interface ProjectsModuleProps {
  projects: Project[];
  /** Selected project from the route (/projects/:projectId). */
  projectId?: string;
  onOpenProject: (projectId: string | null) => void;
  onNavigate: (path: string) => void;
}

const Stat: React.FC<{ label: string; value: string; tone?: string }> = ({ label, value, tone = 'text-slate-900' }) => (
  <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
    <div className="text-xs text-slate-500">{label}</div>
    <div className={`text-sm font-bold tabular-nums ${tone}`}>{value}</div>
  </div>
);

const Empty: React.FC<{ text: string }> = ({ text }) => <p className="text-xs text-slate-500 py-6 text-center">{text}</p>;

/** مرکز اتصال همه اطلاعات پروژه: شرکت ← پروژه ← مرکز هزینه ← قرارداد/تراکنش. */
export const ProjectsModule: React.FC<ProjectsModuleProps> = ({ projects, projectId, onOpenProject, onNavigate }) => {
  const state = useAppState();
  const user = useCurrentUser();
  const wf = useWorkflows();
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState<ProjectTab>('overview');
  const [formOpen, setFormOpen] = useState<'new' | 'edit' | null>(null);
  const project = projects.find((p) => p.id === projectId);
  const form = formOpen && (
    <ProjectFormModal
      project={formOpen === 'edit' ? project : undefined}
      onClose={() => setFormOpen(null)}
      onCreate={(f) => {
        const r = wf.createProject(f);
        if (r.ok) emitToast(r.message);
        return r;
      }}
      onUpdate={(id, changes) => {
        const r = wf.updateProject(id, changes);
        if (r.ok) emitToast(r.message);
        return r;
      }}
    />
  );

  if (!project) {
    const q = search.trim().toLowerCase();
    const rows = projects.filter((p) => !q || p.name.toLowerCase().includes(q) || p.code.toLowerCase().includes(q) || p.client.toLowerCase().includes(q));
    return (
      <div className="space-y-5">
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <span className="text-xs bg-blue-100 text-blue-800 font-bold px-2 py-1 rounded tabular-nums">Project Management Hub</span>
            <h2 className="text-base font-bold text-slate-900 mt-1">پروژه‌ها — مرکز اتصال قرارداد، هزینه، صورت‌وضعیت، انبار و اسناد</h2>
          </div>
          <div className="flex items-center gap-2 w-full md:w-auto">
          {canCreateProject(user) && (
            <button onClick={() => setFormOpen('new')} className="px-3 py-2 rounded-lg bg-slate-900 text-white text-sm font-bold whitespace-nowrap cursor-pointer">
              پروژه جدید
            </button>
          )}
          <div className="relative w-full md:w-72">
            <Search className="w-3.5 h-3.5 text-slate-500 absolute right-2.5 top-2.5" />
            <input
              aria-label="جستجوی پروژه"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="جستجوی نام، کد یا کارفرما..."
              className="w-full pl-3 pr-8 py-2 rounded-lg border border-slate-200 bg-slate-50 text-sm focus:outline-none focus:border-amber-500"
            />
          </div>
          </div>
        </div>
        {form}
        {rows.length === 0 && <Empty text="پروژه‌ای برای نمایش وجود ندارد." />}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {rows.map((p) => (
            <button
              key={p.id}
              onClick={() => onOpenProject(p.id)}
              className="bg-white rounded-xl border border-slate-200 p-4 text-right hover:border-amber-400 hover:shadow-sm transition-all cursor-pointer space-y-3"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="text-xs tabular-nums text-slate-500">{formatText(p.code)}</div>
                  <div className="text-sm font-bold text-slate-900">{formatText(p.name)}</div>
                  <div className="text-xs text-slate-500">کارفرما: {formatText(p.client)}</div>
                </div>
                <span className="text-xs px-2 py-1 rounded bg-slate-100 text-slate-700">{formatText(p.status)}</span>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center">
                <Stat label="درآمد" value={formatCurrencyCompact(p.recordedRevenue)} tone="text-emerald-700" />
                <Stat label="هزینه" value={formatCurrencyCompact(p.cost)} tone="text-rose-700" />
                <Stat label="مطالبات" value={formatCurrencyCompact(p.receivables)} tone="text-blue-700" />
              </div>
              <div className="space-y-1">
                <div className="flex justify-between text-xs text-slate-500">
                  <span>پیشرفت فیزیکی {formatDecimal(p.physicalProgress)}٪</span>
                  <span>پیشرفت مالی {formatDecimal(p.financialProgress)}٪</span>
                </div>
                <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full bg-amber-500" style={{ width: barWidth(p.physicalProgress) }} />
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>
    );
  }

  const f = selectProjectFinancials(state, project.id);
  const contracts = state.contracts.filter((c) => c.projectId === project.id);
  const subcontracts = state.subcontractorContracts.filter((c) => c.projectId === project.id);
  const clientStatements = state.clientStatements.filter((s) => s.projectId === project.id);
  const subStatements = state.subcontractorStatements.filter((s) => s.projectId === project.id);
  const costCenters = state.costCenters.filter((c) => c.projectId === project.id);
  const { rows: budget, budgetTotal, actualTotal } = projectBudgetFigures(state, project.id);
  const suppliers = selectProjectSuppliers(state, project.id);
  const warehouses = selectWarehouses(state).filter((w) => w.projectId === project.id);
  const funds = selectPettyFunds(state).filter((a) => a.projectId === project.id);
  const documents = selectDocumentsFor(state, 'project', project.id);
  const consultant = state.counterparties.find((c) => c.id === project.consultantId)?.name;

  return (
    <div className="space-y-5">
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button onClick={() => onOpenProject(null)} className="p-2 rounded-lg bg-slate-100 hover:bg-slate-200 cursor-pointer" title="بازگشت به فهرست">
              <ArrowRight className="w-4 h-4" />
            </button>
            <div>
              <div className="text-xs tabular-nums text-slate-500">{formatText(project.code)}</div>
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Building2 className="w-4 h-4 text-amber-700" /> {formatText(project.name)}
              </h2>
              <p className="text-xs text-slate-500">
                کارفرما: {formatText(project.client)} · مشاور: {consultant || '-'} · مدیر پروژه: {formatText(project.manager)} · سرپرست کارگاه: {formatText(project.siteSupervisor)}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 self-start">
            <span className="text-xs px-2 py-1 rounded-lg bg-slate-100 text-slate-700">{formatText(project.status)}</span>
            {projectEditableGroups(user, project).length > 0 && (
              <button onClick={() => setFormOpen('edit')} className="text-xs px-2 py-1 rounded-lg bg-slate-900 text-white font-bold cursor-pointer">
                ویرایش
              </button>
            )}
          </div>
        </div>
        {form}
        <div className="flex items-center gap-1 overflow-x-auto scrollbar-none">
          {TABS.map((t) => {
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap cursor-pointer ${
                  tab === t.id ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                <Icon className="w-3.5 h-3.5" /> {formatText(t.label)}
              </button>
            );
          })}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs">
        {tab === 'overview' && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Stat label="مبلغ قرارداد" value={formatMoney(project.contractAmount, false)} />
              <Stat label="درآمد شناسایی‌شده (دفاتر)" value={formatMoney(f.recordedRevenue, false)} tone="text-emerald-700" />
              <Stat label="بهای تمام‌شده (دفاتر)" value={formatMoney(f.actualCost, false)} tone="text-rose-700" />
              <Stat label="سود" value={formatMoney(f.profit, false)} tone={f.profit >= 0 ? 'text-emerald-700' : 'text-rose-700'} />
              <Stat label="مطالبات از کارفرما" value={formatMoney(f.receivables, false)} tone="text-blue-700" />
              <Stat label="بدهی پروژه" value={formatMoney(f.liabilities, false)} tone="text-amber-700" />
              <Stat label="بودجه مصوب" value={formatMoney(project.budget, false)} />
              <Stat label="حاشیه سود" value={formatPercent(f.profitMargin)} />
            </div>
            {project.manualSummary && hasManualSummary(project) && (
              <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-3 space-y-2">
                <div className="text-sm font-bold text-slate-700">
                  خلاصه دستی <span className="font-normal text-slate-500">— رقم واردشده یا منتقل‌شده از سامانه قبلی؛ سند حسابداری نیست و در دفاتر و گزارش‌ها حساب نمی‌شود.</span>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                  <Stat label="درآمد" value={formatMoney(project.manualSummary.revenue, false)} />
                  <Stat label="هزینه" value={formatMoney(project.manualSummary.cost, false)} />
                  <Stat label="نقد" value={formatMoney(project.manualSummary.cash, false)} />
                  <Stat label="مطالبات" value={formatMoney(project.manualSummary.receivable, false)} />
                  <Stat label="بدهی" value={formatMoney(project.manualSummary.payable, false)} />
                </div>
                {project.manualSummary.note && <p className="text-xs text-slate-500">{formatText(project.manualSummary.note)}</p>}
              </div>
            )}
            <div className="grid grid-cols-2 gap-3 text-sm">
              {[
                ['پیشرفت فیزیکی', project.physicalProgress],
                ['پیشرفت مالی (درآمد ÷ قرارداد)', project.financialProgress],
              ].map(([label, v]) => (
                <div key={label as string} className="space-y-1">
                  <div className="flex justify-between text-slate-600">
                    <span>{label}</span>
                    <span className="tabular-nums">{formatDecimal(v as number)}٪</span>
                  </div>
                  <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full bg-amber-500" style={{ width: barWidth(v as number) }} />
                  </div>
                </div>
              ))}
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
              <Stat label="قراردادها (کارفرما / جزء)" value={`${formatDecimal(contracts.length)} / ${formatDecimal(subcontracts.length)}`} />
              <Stat label="صورت‌وضعیت‌ها (کارفرما / جزء)" value={`${formatDecimal(clientStatements.length)} / ${formatDecimal(subStatements.length)}`} />
              <Stat label="تأمین‌کنندگان" value={formatDecimal(suppliers.length)} />
              <Stat label="اسناد" value={formatDecimal(documents.length)} />
            </div>
          </div>
        )}

        {tab === 'contract' && (
          <div className="space-y-4 text-sm">
            <h3 className="font-bold text-slate-900">قرارداد(های) اصلی کارفرما</h3>
            {contracts.length === 0 && <Empty text="قرارداد کارفرما برای این پروژه ثبت نشده است." />}
            {contracts.map((c) => (
              <div key={c.id} className="border border-slate-200 rounded-xl p-3 grid grid-cols-2 md:grid-cols-6 gap-2">
                <div className="md:col-span-2">
                  <div className="font-bold">{formatText(c.code)}</div>
                  <div className="text-xs text-slate-500">{formatText(c.projectTitle)}</div>
                </div>
                <Stat label="مبلغ فعلی" value={formatCurrencyCompact(c.currentValue)} />
                <Stat label="صورت‌وضعیت مصوب" value={formatCurrencyCompact(c.approvedBilledValue)} />
                <Stat label="دریافتی" value={formatCurrencyCompact(c.receivedValue)} tone="text-emerald-700" />
                <Stat label="مدت" value={`${c.startDate} تا ${c.endDate}`} />
              </div>
            ))}
            <h3 className="font-bold text-slate-900 pt-2">قراردادهای پیمانکاران جزء</h3>
            {subcontracts.length === 0 && <Empty text="قرارداد جزء ثبت نشده است." />}
            <div className="table-scroll">
              <table className="w-full text-right">
              <tbody className="divide-y divide-slate-100">
                {subcontracts.map((c) => (
                  <tr key={c.id}>
                    <td className="py-2">
                      <div className="font-bold">{formatText(c.contractNumber)}</div>
                      <div className="text-xs text-slate-500">
                        {formatText(c.subcontractorName)} · {formatText(c.tradeType)}
                      </div>
                    </td>
                    <td className="py-2 text-left tabular-nums"><Money rial={c.contractValue} compact /></td>
                    <td className="py-2 text-left tabular-nums text-emerald-700">پرداخت <Money rial={c.paidValue} compact /></td>
                    <td className="py-2 text-left tabular-nums text-amber-700">مانده <Money rial={c.remainingPayableValue} compact /></td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          </div>
        )}

        {tab === 'cost_centers' && (
          <div className="table-scroll">
            <table className="w-full text-sm text-right">
            <thead className="text-xs text-slate-500 border-b border-slate-100">
              <tr>
                <th className="py-2">کد</th>
                <th className="py-2">مرکز هزینه</th>
                <th className="py-2">نوع</th>
                <th className="py-2">مسئول</th>
                <th className="py-2 text-left">بودجه</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {costCenters.map((c) => (
                <tr key={c.id}>
                  <td className="py-2 tabular-nums">{formatText(c.code)}</td>
                  <td className="py-2 font-bold">{formatText(c.name)}</td>
                  <td className="py-2">{formatText(c.type)}</td>
                  <td className="py-2">{formatText(c.manager || '-')}</td>
                  <td className="py-2 text-left tabular-nums">{formatMoney(c.budget || 0, false)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        )}

        {tab === 'statements' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 text-sm">
            <div>
              <h3 className="font-bold text-slate-900 mb-2">صورت‌وضعیت کارفرما (مطالبات)</h3>
              {clientStatements.length === 0 && <Empty text="صورت‌وضعیتی ثبت نشده است." />}
              {clientStatements.map((s) => (
                <div key={s.id} className="flex justify-between border-b border-slate-50 py-2">
                  <span>
                    {formatText(s.statementNumber)} <span className="text-xs text-slate-500">({CLIENT_STATUS_LABELS[s.status]})</span>
                  </span>
                  <span className="tabular-nums"><Money rial={s.netPayable} compact /></span>
                </div>
              ))}
              <button onClick={() => onNavigate('/statements/client')} className="mt-2 text-amber-700 font-bold cursor-pointer">
                ماژول صورت‌وضعیت کارفرما ←
              </button>
            </div>
            <div>
              <h3 className="font-bold text-slate-900 mb-2">صورت‌وضعیت پیمانکار جزء (بدهی)</h3>
              {subStatements.length === 0 && <Empty text="صورت‌وضعیتی ثبت نشده است." />}
              {subStatements.map((s) => (
                <div key={s.id} className="flex justify-between border-b border-slate-50 py-2">
                  <span>
                    {formatText(s.statementNumber)} · {formatText(s.subcontractorName)} <span className="text-xs text-slate-500">({SUB_STATUS_LABELS[s.status]})</span>
                  </span>
                  <span className="tabular-nums"><Money rial={s.netPayable} compact /></span>
                </div>
              ))}
              <button onClick={() => onNavigate('/statements/subcontractor')} className="mt-2 text-amber-700 font-bold cursor-pointer">
                ماژول صورت‌وضعیت جزء ←
              </button>
            </div>
          </div>
        )}

        {tab === 'suppliers' && (
          <div className="table-scroll">
            <table className="w-full text-sm text-right">
            <thead className="text-xs text-slate-500 border-b border-slate-100">
              <tr>
                <th className="py-2">تأمین‌کننده</th>
                <th className="py-2 text-left">سفارش‌ها</th>
                <th className="py-2 text-left">مبلغ سفارش</th>
                <th className="py-2 text-left">فاکتور</th>
                <th className="py-2 text-left">پرداخت</th>
                <th className="py-2 text-left">مانده</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {suppliers.map((s) => (
                <tr key={s.id}>
                  <td className="py-2">
                    <button onClick={() => onNavigate(`/partners/suppliers/${s.id}`)} className="font-bold text-slate-900 hover:text-amber-700 cursor-pointer">
                      {formatText(s.name)}
                    </button>
                  </td>
                  <td className="py-2 text-left tabular-nums">{formatDecimal(s.orders)}</td>
                  <td className="py-2 text-left tabular-nums"><Money rial={s.ordered} compact /></td>
                  <td className="py-2 text-left tabular-nums"><Money rial={s.invoiced} compact /></td>
                  <td className="py-2 text-left tabular-nums text-emerald-700"><Money rial={s.paid} compact /></td>
                  <td className="py-2 text-left tabular-nums text-amber-700"><Money rial={s.balance} compact /></td>
                </tr>
              ))}
              {suppliers.length === 0 && (
                <tr>
                  <td colSpan={6}>
                    <Empty text="خرید ثبت‌شده‌ای برای این پروژه وجود ندارد." />
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          </div>
        )}

        {tab === 'inventory' && (
          <div className="space-y-4 text-sm">
            {warehouses.length === 0 && <Empty text="انبار اختصاصی برای این پروژه تعریف نشده است." />}
            {warehouses.map((w) => (
              <div key={w.id} className="border border-slate-200 rounded-xl p-3 space-y-2">
                <div className="flex justify-between">
                  <span className="font-bold">
                    {formatText(w.name)} <span className="text-xs text-slate-500">({w.type})</span>
                  </span>
                  <span className="tabular-nums"><Money rial={w.totalValuation} compact /></span>
                </div>
                {selectStockByWarehouse(state, w.id).map((b) => (
                  <div key={b.materialId} className="flex justify-between text-sm text-slate-600">
                    <span>{b.material!.name}</span>
                    <span className="tabular-nums">
                      {formatDecimal(b.qty)} {b.material!.unit} (رزرو {formatDecimal(b.reservedQty)})
                    </span>
                  </div>
                ))}
              </div>
            ))}
            <div>
              <h3 className="font-bold text-slate-900 mb-1">حواله‌های مصرف پروژه</h3>
              {state.storeIssues
                .filter((v) => v.projectId === project.id)
                .map((v) => (
                  <div key={v.id} className="flex justify-between border-b border-slate-50 py-1">
                    <span>
                      {formatText(v.issueNumber)} · {formatText(v.status)}
                    </span>
                    <span className="tabular-nums"><Money rial={v.totalCost} compact /></span>
                  </div>
                ))}
            </div>
          </div>
        )}

        {tab === 'petty_cash' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
            {funds.length === 0 && <Empty text="تنخواهی برای این پروژه تعریف نشده است." />}
            {funds.map((a) => (
              <div key={a.id} className="border border-slate-200 rounded-xl p-3 space-y-1">
                <div className="text-sm text-amber-700 font-bold">{PETTY_CASH_FUND_LABELS[a.fundType]}</div>
                <div className="font-bold">{formatText(a.title)}</div>
                <div className="text-xs text-slate-500">{formatText(a.holderName)}</div>
                <div className="flex justify-between">
                  <span>قابل مصرف</span>
                  <span className="tabular-nums">{formatMoney(a.usableBalance, false)}</span>
                </div>
                <div className="flex justify-between text-slate-500">
                  <span>سقف</span>
                  <span className="tabular-nums">{formatMoney(a.ceilingLimit, false)}</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {tab === 'documents' && (
          <div className="space-y-1 text-sm">
            {documents.length === 0 && <Empty text="سندی به این پروژه متصل نیست." />}
            {documents.map((d) => (
              <div key={d.id} className="flex items-center justify-between border-b border-slate-50 py-2">
                <span className="flex items-center gap-2">
                  <FileText className="w-3.5 h-3.5 text-slate-500" />
                  {formatText(d.title)}
                </span>
                <span className="text-xs text-slate-500">
                  {formatText(d.type)} · {formatText(d.date)}
                </span>
              </div>
            ))}
            <button onClick={() => onNavigate('/documents')} className="mt-2 text-amber-700 font-bold cursor-pointer">
              مرکز اسناد ←
            </button>
          </div>
        )}

        {tab === 'budget' && (
          <div className="space-y-3 text-sm">
            <div className="grid grid-cols-3 gap-3">
              <Stat label="بودجه مراکز هزینه" value={formatMoney(budgetTotal, false)} />
              <Stat label="هزینه واقعی (دفاتر)" value={formatMoney(actualTotal, false)} tone="text-rose-700" />
              <Stat label="انحراف" value={formatMoney(budgetTotal - actualTotal, false)} tone={budgetTotal - actualTotal >= 0 ? 'text-emerald-700' : 'text-rose-700'} />
            </div>
            <div className="table-scroll">
              <table className="w-full text-right">
              <thead className="text-xs text-slate-500 border-b border-slate-100">
                <tr>
                  <th className="py-2">مرکز هزینه</th>
                  <th className="py-2 text-left">بودجه</th>
                  <th className="py-2 text-left">واقعی</th>
                  <th className="py-2 text-left">انحراف</th>
                  <th className="py-2 w-40">مصرف بودجه</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {budget.map((r) => (
                  <tr key={r.costCenterId || 'none'}>
                    <td className="py-2 font-medium">{formatText(r.name)}</td>
                    <td className="py-2 text-left tabular-nums">{formatMoney(r.budget, false)}</td>
                    <td className="py-2 text-left tabular-nums">{formatMoney(r.actual, false)}</td>
                    <td className={`py-2 text-left tabular-nums ${r.variance < 0 ? 'text-rose-700' : 'text-emerald-700'}`}>{formatMoney(r.variance, false)}</td>
                    <td className="py-2">
                      <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full ${r.usedPercent > 100 ? 'bg-rose-500' : 'bg-amber-500'}`}
                          style={{ width: barWidth(r.budget > 0 ? r.usedPercent : 100) }}
                        />
                      </div>
                      <div className="text-xs text-slate-500 tabular-nums">{r.budget > 0 ? `${formatDecimal(r.usedPercent)}٪` : 'بدون بودجه'}</div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
