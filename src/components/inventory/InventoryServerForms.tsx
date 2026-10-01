/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Plus } from 'lucide-react';
import type { Project } from '../../types';
import { useAppState } from '../../store/AppStore';
import { useWorkflows } from '../../store/useWorkflows';
import { QuantityInput } from '../../ui/NumberInput';
import { formatDecimal, formatText } from '../../utils/formatters';
import { warehouseCountRows } from '../../store/views/inventory';

const field = 'mt-1 w-full p-2 rounded border border-slate-300 bg-white';

/** New warehouse (akph/v1): central, project (tied to a project) or temporary; the server issues the code. */
export const WarehouseCreateForm: React.FC<{ projects: Project[]; onToast: (msg: string) => void }> = ({ projects, onToast }) => {
  const wf = useWorkflows();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [kind, setKind] = useState<'central' | 'project' | 'temporary'>('project');
  const [projectId, setProjectId] = useState('');
  const [location, setLocation] = useState('');
  const [keeperName, setKeeperName] = useState('');
  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="btn btn-primary">
        <Plus className="w-4 h-4" />
        <span>تعریف انبار جدید</span>
      </button>
    );
  }
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs text-sm space-y-2">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        <label className="block text-xs text-slate-600">
          نام انبار
          <input value={name} onChange={(e) => setName(e.target.value)} className={field} />
        </label>
        <label className="block text-xs text-slate-600">
          نوع
          <select value={kind} onChange={(e) => setKind(e.target.value as typeof kind)} className={field}>
            <option value="central">مرکزی</option>
            <option value="project">پروژه</option>
            <option value="temporary">موقت</option>
          </select>
        </label>
        {kind !== 'central' && (
          <label className="block text-xs text-slate-600">
            پروژه
            <select value={projectId} onChange={(e) => setProjectId(e.target.value)} className={field}>
              <option value="">— انتخاب پروژه —</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {formatText(p.name)}
                </option>
              ))}
            </select>
          </label>
        )}
        <label className="block text-xs text-slate-600">
          محل
          <input value={location} onChange={(e) => setLocation(e.target.value)} className={field} />
        </label>
        <label className="block text-xs text-slate-600">
          انباردار
          <input value={keeperName} onChange={(e) => setKeeperName(e.target.value)} className={field} />
        </label>
      </div>
      <div className="flex justify-end gap-2">
        <button type="button" onClick={() => setOpen(false)} className="btn btn-secondary">
          انصراف
        </button>
        <button
          type="button"
          disabled={!name.trim() || (kind === 'project' && !projectId)}
          onClick={() => {
            onToast(wf.createWarehouse({ name, kind, projectId, location, keeperName }).message);
            setOpen(false);
            setName('');
          }}
          className="btn btn-primary disabled:opacity-40"
        >
          ثبت انبار
        </button>
      </div>
    </div>
  );
};

/**
 * Physical count of a warehouse (akph/v1): one row per item in stock there. The server computes the surplus and
 * shortage rows at average cost; the adjustment entry waits for a second user's approval.
 */
export const StocktakeCountForm: React.FC<{ onToast: (msg: string) => void }> = ({ onToast }) => {
  const wf = useWorkflows();
  const state = useAppState();
  const [open, setOpen] = useState(false);
  const [warehouseId, setWarehouseId] = useState('');
  const [date, setDate] = useState('');
  const [notes, setNotes] = useState('');
  const [counts, setCounts] = useState<Record<string, number>>({});
  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="btn btn-primary">
        <Plus className="w-4 h-4" />
        <span>ثبت شمارش انبار</span>
      </button>
    );
  }
  const rows = warehouseCountRows(state, warehouseId);
  return (
    <div className="bg-slate-50 rounded-xl border border-slate-200 p-3 text-sm space-y-2 w-full">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        <label className="block text-xs text-slate-600">
          انبار
          <select
            value={warehouseId}
            onChange={(e) => {
              setWarehouseId(e.target.value);
              setCounts({});
            }}
            className={field}
          >
            <option value="">— انتخاب انبار —</option>
            {state.warehouses.map((w) => (
              <option key={w.id} value={w.id}>
                {formatText(w.code)} - {formatText(w.name)}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-xs text-slate-600">
          تاریخ شمارش
          <input value={date} onChange={(e) => setDate(e.target.value)} placeholder="۱۴۰۵/۰۶/۳۱" className={field} />
        </label>
        <label className="block text-xs text-slate-600">
          شرح
          <input value={notes} onChange={(e) => setNotes(e.target.value)} className={field} />
        </label>
      </div>
      {rows.map((r) => (
        <label key={r.materialId} className="flex items-center justify-between gap-2 text-xs text-slate-600">
          <span>
            {formatText(r.materialName)} — موجودی سیستمی {formatDecimal(r.systemQty)} {formatText(r.unit)}
          </span>
          <QuantityInput
            aria-label={`شمارش ${r.materialName}`}
            value={counts[r.materialId] ?? r.systemQty}
            onValueChange={(v) => setCounts((prev) => ({ ...prev, [r.materialId]: v }))}
            className="w-32 p-2 rounded border border-slate-300 bg-white"
          />
        </label>
      ))}
      <div className="flex justify-end gap-2">
        <button type="button" onClick={() => setOpen(false)} className="btn btn-secondary">
          انصراف
        </button>
        <button
          type="button"
          disabled={!warehouseId || rows.length === 0}
          onClick={() => {
            const lines = rows.map((r) => ({ materialId: r.materialId, physicalCount: counts[r.materialId] ?? r.systemQty }));
            onToast(wf.createStocktake({ warehouseId, date, lines, notes }).message);
            setOpen(false);
          }}
          className="btn btn-primary disabled:opacity-40"
        >
          ثبت شمارش و ارسال برای تأیید
        </button>
      </div>
    </div>
  );
};
