import React, { useState } from 'react';
import { Settings, Save, Coins, ShieldCheck, Percent } from 'lucide-react';
import { useAppState } from '../store/AppStore';
import { usePermission } from '../store/session';
import { useWorkflows } from '../store/useWorkflows';
import { PETTY_CASH_FUND_LABELS, PettyCashFundType, PettyCashSettings, PettyCashApprovalLevel } from '../types';
import { moneyUnitLabel } from '../utils/money';
import { MoneyInput, PercentInput } from '../ui/NumberInput';

const LEVEL_LABELS: Record<PettyCashApprovalLevel, string> = {
  site_manager_and_finance: 'سطح ۱',
  project_and_finance: 'سطح ۲',
  ceo_full: 'سطح ۳',
};

const INPUT_CLASS =
  'w-full px-2.5 py-1.5 rounded-lg border border-slate-200 bg-slate-50 text-xs font-mono text-left focus:outline-none focus:border-amber-500';

/** تنظیمات ذخیره‌شده سامانه؛ نرخ ارزش افزوده، سقف‌ها و زنجیره تأیید تنخواه از همین‌جا خوانده می‌شوند. */
export const SettingsPage: React.FC<{ onToast: (msg: string) => void }> = ({ onToast }) => {
  const { can } = usePermission();
  const wf = useWorkflows();
  const state = useAppState();
  const [draft, setDraft] = useState<PettyCashSettings>(state.pettyCashSettings);
  const [vatRate, setVatRate] = useState(state.financeSettings.vatRatePercent);
  const canEdit = can('settings.manage');

  const setLimit = (fund: PettyCashFundType, key: keyof PettyCashSettings['fundLimits'][PettyCashFundType], v: number) =>
    setDraft((d) => ({ ...d, fundLimits: { ...d.fundLimits, [fund]: { ...d.fundLimits[fund], [key]: v } } }));

  const save = () => {
    const finance = wf.updateFinanceSettings({ vatRatePercent: vatRate });
    if (!finance.ok) return onToast(finance.message);
    const petty = wf.updatePettyCashSettings(draft);
    onToast(petty.ok ? 'تنظیمات ذخیره شد و از این پس در ثبت و تأیید اسناد اعمال می‌شود.' : petty.message);
  };

  return (
    <div className="space-y-5 max-w-5xl">
      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-2xs flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-slate-900 text-amber-400 flex items-center justify-center">
            <Settings className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900">تنظیمات سامانه</h2>
            <p className="text-xs text-slate-500">نرخ ارزش افزوده و سیاست تنخواه: سقف هر نوع صندوق، سقف هر هزینه، آستانه‌های سطح تأیید و هشدار موجودی</p>
          </div>
        </div>
        <button
          onClick={save}
          disabled={!canEdit}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-500 text-slate-950 text-xs font-bold hover:bg-amber-600 disabled:opacity-50 cursor-pointer"
        >
          <Save className="w-3.5 h-3.5" />
          ذخیره تنظیمات
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-2xs space-y-3">
        <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
          <Percent className="w-4 h-4 text-indigo-600" /> تنظیمات مالی
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
          <label className="space-y-1">
            <span className="text-slate-600">نرخ مالیات بر ارزش افزوده (درصد)</span>
            <PercentInput disabled={!canEdit} value={vatRate} onValueChange={setVatRate} className={INPUT_CLASS} />
          </label>
          <div className="space-y-1">
            <span className="text-slate-600">واحد پول نمایش</span>
            <div className="px-2.5 py-1.5 rounded-lg border border-slate-100 bg-slate-50 text-slate-800 font-bold">
              {moneyUnitLabel()} <span className="font-normal text-slate-500">(یک‌بار در افزونه پایدار پورتال تعیین می‌شود؛ مبالغ به ریال ذخیره می‌شوند)</span>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-2xs space-y-3">
        <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
          <Coins className="w-4 h-4 text-amber-500" /> سقف صندوق‌های تنخواه ({moneyUnitLabel()})
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="text-slate-500 text-[11px]">
              <tr className="border-b border-slate-100">
                <th className="py-2 text-right">نوع تنخواه</th>
                <th className="py-2 px-2 text-right">سقف موجودی</th>
                <th className="py-2 px-2 text-right">حداقل هشدار</th>
                <th className="py-2 px-2 text-right">سقف هر هزینه</th>
              </tr>
            </thead>
            <tbody>
              {(Object.keys(PETTY_CASH_FUND_LABELS) as PettyCashFundType[]).map((f) => (
                <tr key={f} className="border-b border-slate-50">
                  <td className="py-2 font-medium text-slate-800">{PETTY_CASH_FUND_LABELS[f]}</td>
                  <td className="py-2 px-2"><MoneyInput disabled={!canEdit} value={draft.fundLimits[f].ceiling} onValueChange={(v) => setLimit(f, 'ceiling', v)} className={INPUT_CLASS} /></td>
                  <td className="py-2 px-2"><MoneyInput disabled={!canEdit} value={draft.fundLimits[f].minBalanceWarning} onValueChange={(v) => setLimit(f, 'minBalanceWarning', v)} className={INPUT_CLASS} /></td>
                  <td className="py-2 px-2"><MoneyInput disabled={!canEdit} value={draft.fundLimits[f].maxSingleExpense} onValueChange={(v) => setLimit(f, 'maxSingleExpense', v)} className={INPUT_CLASS} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-2xs space-y-3">
        <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-emerald-600" /> سطوح تأیید هزینه تنخواه (approvalLevelRequired)
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
          <label className="space-y-1">
            <span className="text-slate-600">حداکثر مبلغ سطح ۱</span>
            <MoneyInput disabled={!canEdit} value={draft.siteLevelMax} onValueChange={(v) => setDraft((d) => ({ ...d, siteLevelMax: v }))} className={INPUT_CLASS} />
          </label>
          <label className="space-y-1">
            <span className="text-slate-600">حداکثر مبلغ سطح ۲ (بیشتر از آن: سطح ۳)</span>
            <MoneyInput disabled={!canEdit} value={draft.projectLevelMax} onValueChange={(v) => setDraft((d) => ({ ...d, projectLevelMax: v }))} className={INPUT_CLASS} />
          </label>
          <label className="space-y-1">
            <span className="text-slate-600">هشدار موجودی کم (درصد از سقف)</span>
            <PercentInput disabled={!canEdit} value={draft.lowBalancePercent} onValueChange={(v) => setDraft((d) => ({ ...d, lowBalancePercent: v }))} className={INPUT_CLASS} />
          </label>
        </div>
        <div className="space-y-1.5 text-xs">
          {(Object.keys(LEVEL_LABELS) as PettyCashApprovalLevel[]).map((l) => (
            <div key={l} className="flex items-center justify-between bg-slate-50 border border-slate-100 rounded-lg px-3 py-2">
              <span className="font-medium text-slate-800">{LEVEL_LABELS[l]}</span>
              <span className="text-slate-600">{draft.approvalChains[l].join(' ← ')}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
