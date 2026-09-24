/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { AppState } from './types';
import { selectProjects, selectProjectFinancials, selectKpiItems } from './selectors';
import { selectApprovals, selectPettyFunds, selectNotifications, selectMaterials } from './domainSelectors';
import { formatCurrencyCompact } from '../utils/formatters';

export interface AssistantAnswer {
  text: string;
  dataPoints?: { label: string; value: string }[];
}

const fa = (n: number) => n.toLocaleString('fa-IR');
const money = (n: number) => formatCurrencyCompact(n);

/**
 * دستیار مدیریت: پاسخ‌ها فقط از داده‌های store محاسبه می‌شود (پروژه، حسابداری، قرارداد، خرید، تنخواه، صورت‌وضعیت، انبار).
 */
export function answerManagementQuery(state: AppState, query: string): AssistantAnswer {
  const q = query.trim();
  const projects = selectProjects(state);

  // «وضعیت پروژه X» — contract, executed work, revenue, cost, profit, receivables, payables.
  const named = projects.find((p) => q.includes(p.name) || q.includes(p.code) || p.name.split(/[\s()-]+/).some((w) => w.length > 3 && q.includes(w)));
  if (named) {
    const f = selectProjectFinancials(state, named.id);
    const contracts = state.contracts.filter((c) => c.projectId === named.id);
    const contractValue = contracts.reduce((a, c) => a + c.currentValue, 0) || named.contractAmount;
    const executed = contracts.reduce((a, c) => a + c.executedValue, 0);
    const subPayable = state.subcontractorStatements
      .filter((s) => s.projectId === named.id && (s.status === 'management_approved' || s.status === 'paid'))
      .reduce((a, s) => a + s.remainingPayable, 0);
    const pendingStatements = state.clientStatements.filter((s) => s.projectId === named.id && !['approved_by_employer', 'claimed', 'partially_paid', 'paid', 'rejected'].includes(s.status)).length;
    return {
      text: `پروژه «${named.name}»: مبلغ قرارداد ${money(contractValue)}، کارکرد اجراشده ${money(executed)}، درآمد شناسایی‌شده ${money(f.recordedRevenue)} و بهای تمام‌شده ${money(f.actualCost)} (سود ${money(f.profit)}). مطالبات از کارفرما ${money(f.receivables)} و بدهی‌های پروژه ${money(f.liabilities)} است${pendingStatements ? `؛ ${fa(pendingStatements)} صورت‌وضعیت هنوز به تأیید کارفرما نرسیده است` : ''}.`,
      dataPoints: [
        { label: 'قرارداد', value: money(contractValue) },
        { label: 'کارکرد', value: money(executed) },
        { label: 'درآمد', value: money(f.recordedRevenue) },
        { label: 'هزینه', value: money(f.actualCost) },
        { label: 'سود', value: money(f.profit) },
        { label: 'مطالبات', value: money(f.receivables) },
        { label: 'بدهی', value: money(f.liabilities) },
        { label: 'بدهی به پیمانکاران جزء', value: money(subPayable) },
      ],
    };
  }

  if (q.includes('مطالبات')) {
    const sorted = [...projects].sort((a, b) => b.receivables - a.receivables).filter((p) => p.receivables > 0);
    if (!sorted.length) return { text: 'در حال حاضر مانده مطالباتی در دفاتر ثبت نشده است.' };
    const total = sorted.reduce((a, p) => a + p.receivables, 0);
    return {
      text: `بیشترین مطالبات مربوط به «${sorted[0].name}» با ${money(sorted[0].receivables)} است. جمع مطالبات تجاری پروژه‌ها ${money(total)} است.`,
      dataPoints: sorted.slice(0, 4).map((p) => ({ label: p.name, value: money(p.receivables) })),
    };
  }

  if (q.includes('هزینه')) {
    const sorted = [...projects].sort((a, b) => b.cost - a.cost);
    const top = sorted[0];
    if (!top) return { text: 'پروژه‌ای ثبت نشده است.' };
    return {
      text: `بیشترین بهای تمام‌شده ثبت‌شده در دفاتر مربوط به «${top.name}» با ${money(top.cost)} است.`,
      dataPoints: sorted.slice(0, 4).map((p) => ({ label: p.name, value: money(p.cost) })),
    };
  }

  if (q.includes('تنخواه')) {
    const funds = selectPettyFunds(state).filter((f) => f.status === 'active');
    const low = funds.filter((f) => f.usableBalance <= f.ceilingLimit * (state.pettyCashSettings.lowBalancePercent / 100));
    const pending = state.pettyCashExpenses.filter((e) => e.status === 'pending_approval' || e.status === 'submitted');
    return {
      text: `${fa(funds.length)} صندوق تنخواه فعال است با موجودی واقعی ${money(funds.reduce((a, f) => a + f.actualBalance, 0))}. ${fa(pending.length)} هزینه به مبلغ ${money(pending.reduce((a, e) => a + e.amount, 0))} در انتظار تأیید است${low.length ? ` و ${low.map((f) => `«${f.title}»`).join('، ')} نیازمند شارژ است` : ''}.`,
      dataPoints: [
        { label: 'موجودی قابل مصرف کل', value: money(funds.reduce((a, f) => a + f.usableBalance, 0)) },
        { label: 'هزینه‌های در انتظار', value: `${fa(pending.length)} فقره` },
        { label: 'صندوق‌های نیازمند شارژ', value: fa(low.length) },
      ],
    };
  }

  if (q.includes('تأیید') || q.includes('تایید') || q.includes('فاکتور')) {
    const approvals = selectApprovals(state);
    const byModule = new Map<string, number>();
    for (const a of approvals) byModule.set(a.moduleLabel, (byModule.get(a.moduleLabel) || 0) + 1);
    const biggest = [...approvals].sort((a, b) => b.amount - a.amount)[0];
    return {
      text: approvals.length
        ? `${fa(approvals.length)} مورد به ارزش ${money(approvals.reduce((a, x) => a + x.amount, 0))} در انتظار تأیید است. بزرگ‌ترین مورد: ${biggest.moduleLabel} ${biggest.docNumber} (${money(biggest.amount)}) در مرحله «${biggest.stage}».`
        : 'موردی در انتظار تأیید نیست.',
      dataPoints: [...byModule].map(([label, n]) => ({ label, value: `${fa(n)} فقره` })),
    };
  }

  if (q.includes('انبار') || q.includes('موجودی')) {
    const low = selectMaterials(state).filter((m) => m.currentStock <= m.reorderLevel);
    return {
      text: low.length ? `${fa(low.length)} قلم کالا به نقطه سفارش رسیده است: ${low.map((m) => m.name).join('، ')}.` : 'موجودی همه اقلام بالاتر از نقطه سفارش است.',
      dataPoints: low.slice(0, 4).map((m) => ({ label: m.name, value: `${fa(m.currentStock)} ${m.unit}` })),
    };
  }

  if (q.includes('سود') || q.includes('زیان')) {
    const k = selectKpiItems(state);
    const v = (id: string) => k.find((x) => x.id === id)?.value ?? 0;
    return {
      text: `بر اساس دفاتر: درآمد ${money(v('kpi-1'))}، بهای تمام‌شده و هزینه‌ها ${money(v('kpi-2'))} و سود ناخالص ${money(v('kpi-3'))} (حاشیه ${fa(v('kpi-4'))}٪). نقدینگی ${money(v('kpi-7'))} و بدهی‌های جاری ${money(v('kpi-8'))} است.`,
      dataPoints: [
        { label: 'درآمد', value: money(v('kpi-1')) },
        { label: 'هزینه', value: money(v('kpi-2')) },
        { label: 'سود ناخالص', value: money(v('kpi-3')) },
        { label: 'مطالبات', value: money(v('kpi-5')) },
      ],
    };
  }

  const alerts = selectNotifications(state).filter((n) => n.priority === 'critical');
  const best = [...projects].sort((a, b) => b.profitMargin - a.profitMargin)[0];
  return {
    text: `${fa(projects.length)} پروژه در سامانه ثبت است${best ? `؛ بیشترین حاشیه سود متعلق به «${best.name}» (${fa(best.profitMargin)}٪) است` : ''}. ${fa(alerts.length)} هشدار بحرانی باز وجود دارد${alerts[0] ? `، از جمله: ${alerts[0].title}` : ''}. برای جزئیات، نام پروژه را بپرسید.`,
    dataPoints: projects.slice(0, 5).map((p) => ({ label: p.name, value: `درآمد ${money(p.recordedRevenue)} / هزینه ${money(p.cost)}` })),
  };
}
