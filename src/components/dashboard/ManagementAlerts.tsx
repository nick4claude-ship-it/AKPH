import React, { useState } from 'react';
import { ManagementAlert, AlertPriority } from '../../types';
import { AlertTriangle, AlertCircle, Info, ChevronLeft, Check, ShieldAlert } from 'lucide-react';

interface ManagementAlertsProps {
  alerts: ManagementAlert[];
  onActionClick: (alert: ManagementAlert) => void;
  onDismiss: (alertId: string) => void;
}

export const ManagementAlerts: React.FC<ManagementAlertsProps> = ({
  alerts,
  onActionClick,
  onDismiss,
}) => {
  const [filterPriority, setFilterPriority] = useState<string>('all');

  const filtered = alerts.filter(
    (a) => filterPriority === 'all' || a.priority === filterPriority
  );

  const getPriorityTag = (p: AlertPriority) => {
    switch (p) {
      case 'critical':
        return (
          <span className="text-[10px] font-bold bg-rose-100 text-rose-800 px-2 py-0.5 rounded border border-rose-300 flex items-center gap-1">
            <AlertCircle className="w-3 h-3 text-rose-600" />
            بحرانی (Critical)
          </span>
        );
      case 'warning':
        return (
          <span className="text-[10px] font-bold bg-amber-100 text-amber-800 px-2 py-0.5 rounded border border-amber-300 flex items-center gap-1">
            <AlertTriangle className="w-3 h-3 text-amber-600" />
            هشدار (Warning)
          </span>
        );
      case 'info':
        return (
          <span className="text-[10px] font-medium bg-blue-100 text-blue-800 px-2 py-0.5 rounded border border-blue-200 flex items-center gap-1">
            <Info className="w-3 h-3 text-blue-600" />
            اطلاع (Info)
          </span>
        );
    }
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-rose-500/10 text-rose-600 flex items-center justify-center">
            <ShieldAlert className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900">هشدارهای مهم مدیریتی</h3>
            <p className="text-[11px] text-slate-500">
              شناسایی هوشمند انحراف بودجه، کسری تنخواه، سررسید مطالبات و موارد نیازمند اقدام
            </p>
          </div>
        </div>

        {/* Priority Filter */}
        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg text-[11px]">
          <button
            onClick={() => setFilterPriority('all')}
            className={`px-2 py-0.5 rounded transition-colors cursor-pointer ${
              filterPriority === 'all'
                ? 'bg-white text-slate-900 font-bold shadow-2xs'
                : 'text-slate-600'
            }`}
          >
            همه ({alerts.length})
          </button>
          <button
            onClick={() => setFilterPriority('critical')}
            className={`px-2 py-0.5 rounded transition-colors cursor-pointer ${
              filterPriority === 'critical'
                ? 'bg-white text-rose-700 font-bold shadow-2xs'
                : 'text-slate-600'
            }`}
          >
            بحرانی ({alerts.filter((a) => a.priority === 'critical').length})
          </button>
          <button
            onClick={() => setFilterPriority('warning')}
            className={`px-2 py-0.5 rounded transition-colors cursor-pointer ${
              filterPriority === 'warning'
                ? 'bg-white text-amber-700 font-bold shadow-2xs'
                : 'text-slate-600'
            }`}
          >
            هشدار ({alerts.filter((a) => a.priority === 'warning').length})
          </button>
        </div>
      </div>

      {/* Alerts List */}
      <div className="divide-y divide-slate-100 mt-2 max-h-72 overflow-y-auto pr-1">
        {filtered.length === 0 ? (
          <div className="py-6 text-center text-slate-400 text-xs">
            هیچ هشداری در این دسته‌بندی وجود ندارد.
          </div>
        ) : (
          filtered.map((alert) => (
            <div
              key={alert.id}
              className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs hover:bg-slate-50/70 p-2 rounded-lg transition-colors"
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  {getPriorityTag(alert.priority)}
                  <span className="font-bold text-slate-900">{alert.title}</span>
                  <span className="text-[10px] text-slate-400 font-mono">({alert.date})</span>
                </div>
                <p className="text-slate-600 text-[11px] leading-relaxed pr-6">
                  {alert.description}
                </p>
                {alert.relatedProjectName && (
                  <div className="text-[10px] text-slate-400 pr-6">
                    پروژه مرتبط: <span className="text-slate-700 font-medium">{alert.relatedProjectName}</span>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                {alert.actionLabel && (
                  <button
                    onClick={() => onActionClick(alert)}
                    className="flex items-center gap-1 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold px-2.5 py-1.5 rounded-lg text-[11px] transition-colors cursor-pointer shadow-2xs"
                  >
                    <span>{alert.actionLabel}</span>
                    <ChevronLeft className="w-3.5 h-3.5" />
                  </button>
                )}
                <button
                  onClick={() => onDismiss(alert.id)}
                  className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 rounded-md transition-colors cursor-pointer"
                  title="نشان‌گذاری به عنوان بررسی شده"
                >
                  <Check className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
