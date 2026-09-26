import React, { useState } from 'react';
import { ManagementAlert, AlertPriority } from '../../types';
import { AlertTriangle, AlertCircle, Info, ChevronLeft, Check, ShieldAlert } from 'lucide-react';
import { formatInt, formatText } from '../../utils/formatters';

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
          <span className="text-xs font-bold bg-rose-100 text-rose-800 px-2 py-1 rounded border border-rose-300 flex items-center gap-1">
            <AlertCircle className="w-3 h-3 text-rose-700" />
            بحرانی
          </span>
        );
      case 'warning':
        return (
          <span className="text-xs font-bold bg-amber-100 text-amber-800 px-2 py-1 rounded border border-amber-300 flex items-center gap-1">
            <AlertTriangle className="w-3 h-3 text-amber-700" />
            هشدار
          </span>
        );
      case 'info':
        return (
          <span className="text-xs font-medium bg-blue-100 text-blue-800 px-2 py-1 rounded border border-blue-200 flex items-center gap-1">
            <Info className="w-3 h-3 text-blue-600" />
            اطلاع
          </span>
        );
    }
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-rose-500/10 text-rose-700 flex items-center justify-center">
            <ShieldAlert className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900">هشدارهای مهم مدیریتی</h3>
            <p className="text-xs text-slate-500">
              شناسایی هوشمند انحراف بودجه، کسری تنخواه، سررسید مطالبات و موارد نیازمند اقدام
            </p>
          </div>
        </div>

        {/* Priority Filter */}
        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg text-sm">
          <button
            onClick={() => setFilterPriority('all')}
            className={`px-2 py-1 rounded transition-colors cursor-pointer ${
              filterPriority === 'all'
                ? 'bg-white text-slate-900 font-bold shadow-2xs'
                : 'text-slate-600'
            }`}
          >
            همه ({formatInt(alerts.length)})
          </button>
          <button
            onClick={() => setFilterPriority('critical')}
            className={`px-2 py-1 rounded transition-colors cursor-pointer ${
              filterPriority === 'critical'
                ? 'bg-white text-rose-700 font-bold shadow-2xs'
                : 'text-slate-600'
            }`}
          >
            بحرانی ({formatInt(alerts.filter((a) => a.priority === 'critical').length)})
          </button>
          <button
            onClick={() => setFilterPriority('warning')}
            className={`px-2 py-1 rounded transition-colors cursor-pointer ${
              filterPriority === 'warning'
                ? 'bg-white text-amber-700 font-bold shadow-2xs'
                : 'text-slate-600'
            }`}
          >
            هشدار ({formatInt(alerts.filter((a) => a.priority === 'warning').length)})
          </button>
        </div>
      </div>

      {/* Alerts List */}
      <div className="divide-y divide-slate-100 mt-2 max-h-72 overflow-y-auto pr-1">
        {filtered.length === 0 ? (
          <div className="py-6 text-center text-slate-500 text-xs">
            هیچ هشداری در این دسته‌بندی وجود ندارد.
          </div>
        ) : (
          filtered.map((alert) => (
            <div
              key={alert.id}
              className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-sm hover:bg-slate-50/70 p-2 rounded-lg transition-colors"
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  {getPriorityTag(alert.priority)}
                  <span className="font-bold text-slate-900">{formatText(alert.title)}</span>
                  <span className="text-xs text-slate-500 tabular-nums">({alert.date})</span>
                </div>
                <p className="text-slate-600 text-sm leading-relaxed pr-6">
                  {formatText(alert.description)}
                </p>
                {alert.relatedProjectName && (
                  <div className="text-xs text-slate-500 pr-6">
                    پروژه مرتبط: <span className="text-slate-700 font-medium">{formatText(alert.relatedProjectName)}</span>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                {alert.actionLabel && (
                  <button
                    onClick={() => onActionClick(alert)}
                    className="btn btn-primary btn-sm"
                  >
                    <span>{formatText(alert.actionLabel)}</span>
                    <ChevronLeft className="w-3.5 h-3.5" />
                  </button>
                )}
                <button
                  onClick={() => onDismiss(alert.id)}
                  className="p-2 text-slate-500 hover:text-slate-600 hover:bg-slate-200/60 rounded-md transition-colors cursor-pointer"
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
