import React, { useState } from 'react';
import {
  Search,
  Filter,
  Plus,
  Clock,
  AlertTriangle,
  CheckCircle2,
  Building2,
  ChevronDown,
  Layers,
  ArrowRight,
  Eye,
  FileCheck,
  Send,
  X,
  FileText,
} from 'lucide-react';
import { PurchaseRequisition, Project, RequisitionPriority, RequisitionStatus } from '../../types';
import { Dialog } from '../../ui/Dialog';
import { formatMoney } from '../../utils/money';
import { formatDecimal, formatInt, formatText } from '../../utils/formatters';
import { requisitionConvertible } from '../../store/views/procurement';
import { Money } from '../common/Money';

interface RequisitionsListViewProps {
  requisitions: PurchaseRequisition[];
  projects: Project[];
  onOpenNewModal: () => void;
  onApproveRequisition: (reqId: string, level: 'site' | 'project' | 'procurement' | 'finance') => void;
  onConvertToRfq: (req: PurchaseRequisition) => void;
  onConvertToPo: (req: PurchaseRequisition) => void;
}

export const RequisitionsListView: React.FC<RequisitionsListViewProps> = ({
  requisitions,
  projects,
  onOpenNewModal,
  onApproveRequisition,
  onConvertToRfq,
  onConvertToPo,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProjectId, setSelectedProjectId] = useState<string>('all');
  const [selectedPriority, setSelectedPriority] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [activeReqForDetail, setActiveReqForDetail] = useState<PurchaseRequisition | null>(null);

  // Filtering
  const filteredReqs = requisitions.filter((req) => {
    if (selectedProjectId !== 'all' && req.projectId !== selectedProjectId) return false;
    if (selectedPriority !== 'all' && req.priority !== selectedPriority) return false;
    if (selectedStatus !== 'all' && req.status !== selectedStatus) return false;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchNumber = req.requisitionNumber.toLowerCase().includes(q);
      const matchProject = req.projectName.toLowerCase().includes(q);
      const matchRequester = req.requesterName.toLowerCase().includes(q);
      const matchItems = req.items.some((it) => it.materialName.toLowerCase().includes(q));
      return matchNumber || matchProject || matchRequester || matchItems;
    }
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Top Filter and Action Bar */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
              <FileCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-800">درخواست‌های خرید و تقاضای کالا از کارگاه‌ها</h3>
              <p className="text-xs text-slate-500">
                مجموع {formatInt(filteredReqs.length)} تقاضای خرید فعال در فرآیند بررسی، استعلام و تأمین
              </p>
            </div>
          </div>

          <button
            onClick={onOpenNewModal}
            className="btn btn-primary self-start sm:self-auto"
          >
            <Plus className="w-4 h-4" />
            <span>ثبت تقاضای خرید جدید</span>
          </button>
        </div>

        {/* Filter Inputs Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 pt-2 border-t border-slate-100">
          <div className="relative">
            <Search className="w-4 h-4 absolute right-3 top-3 text-slate-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="جستجو در شماره PR، کالا، درخواست‌کننده..."
              className="w-full bg-slate-50 border border-slate-200 rounded-xl pr-9 pl-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-hidden"
            />
          </div>

          <div>
            <select aria-label="فیلتر: پروژه‌ها"
              value={selectedProjectId}
              onChange={(e) => setSelectedProjectId(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-hidden"
            >
              <option value="all">تمام پروژه‌ها</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>{formatText(p.name)}</option>
              ))}
            </select>
          </div>

          <div>
            <select aria-label="فیلتر: تمام اولویت‌ها"
              value={selectedPriority}
              onChange={(e) => setSelectedPriority(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-hidden font-medium"
            >
              <option value="all">تمام اولویت‌ها</option>
              <option value="فوری کارگاهی (حیاتی)">🚨 فوری کارگاهی (حیاتی)</option>
              <option value="بالا">⚡ بالا</option>
              <option value="عادی">🟢 عادی</option>
              <option value="دوره‌ای برنامه‌ریزی‌شده">📅 دوره‌ای برنامه‌ریزی‌شده</option>
            </select>
          </div>

          <div>
            <select aria-label="فیلتر: تمام وضعیت‌های گردش کار"
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-hidden"
            >
              <option value="all">تمام وضعیت‌های گردش کار</option>
              <option value="پیش‌نویس کارگاه">پیش‌نویس کارگاه</option>
              <option value="تأیید سرپرست کارگاه">تأیید سرپرست کارگاه</option>
              <option value="تأیید فنی پروژه">تأیید فنی پروژه</option>
              <option value="مصوبه مدیر تدارکات">مصوبه مدیر تدارکات</option>
              <option value="تأیید نهایی مدیر ارشد">تأیید نهایی مدیر ارشد</option>
              <option value="در حال استعلام بها (RFQ)">در حال استعلام بها</option>
              <option value="سفارش صادر شده (PO)">سفارش صادر شده</option>
            </select>
          </div>
        </div>
      </div>

      {/* Requisitions List Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-2xs">
        <div className="table-scroll">
          <table className="w-full text-right text-sm">
            <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
              <tr>
                <th className="py-3 px-4">شماره تقاضا</th>
                <th className="py-3 px-4">پروژه و مرکز هزینه</th>
                <th className="py-3 px-4">اقلام کلیدی سفارش</th>
                <th className="py-3 px-4 text-center">اولویت</th>
                <th className="py-3 px-4 text-left">برآورد ریالی</th>
                <th className="py-3 px-4 text-center">وضعیت تأییدیه</th>
                <th className="py-3 px-4 text-center">عملیات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredReqs.map((req) => (
                <tr key={req.id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="py-3 px-4">
                    <div className="tabular-nums font-bold text-slate-900">{formatText(req.requisitionNumber)}</div>
                    <div className="text-xs text-slate-500 mt-1">{formatText(req.date)}</div>
                  </td>

                  <td className="py-3 px-4">
                    <div className="font-bold text-slate-800">{formatText(req.projectName)}</div>
                    <div className="text-xs text-slate-500 mt-1">{formatText(req.costCenter)}</div>
                  </td>

                  <td className="py-3 px-4 max-w-xs">
                    <div className="font-bold text-slate-900 truncate">
                      {req.items[0]?.materialName}
                    </div>
                    <div className="text-xs text-slate-500 mt-1">
                      {req.items.length > 1
                        ? `و ${req.items.length - 1} ردیف دیگر...`
                        : `${formatDecimal(req.items[0]?.requestedQty)} ${req.items[0]?.unit}`}
                    </div>
                  </td>

                  <td className="py-3 px-4 text-center">
                    <span
                      className={`inline-block px-2 py-1 rounded-full text-xs font-bold ${
                        req.priority === 'فوری کارگاهی (حیاتی)'
                          ? 'bg-rose-100 text-rose-700 border border-rose-200'
                          : req.priority === 'بالا'
                          ? 'bg-amber-100 text-amber-700 border border-amber-200'
                          : 'bg-slate-100 text-slate-700'
                      }`}
                    >
                      {formatText(req.priority)}
                    </span>
                  </td>

                  <td className="py-3 px-4 text-left tabular-nums font-bold text-slate-900">
                    <Money rial={req.totalEstimatedAmount} />
                  </td>

                  <td className="py-3 px-4 text-center">
                    <span
                      className={`inline-block px-2 py-1 rounded-full text-xs font-bold ${
                        req.status === 'سفارش صادر شده (PO)'
                          ? 'bg-emerald-100 text-emerald-800'
                          : req.status === 'تأیید نهایی مدیر ارشد'
                          ? 'bg-indigo-100 text-indigo-800'
                          : req.status === 'در حال استعلام بها (RFQ)'
                          ? 'bg-cyan-100 text-cyan-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {formatText(req.status)}
                    </span>
                  </td>

                  <td className="py-3 px-4 text-center">
                    <div className="flex items-center justify-center gap-2">
                      <button
                        onClick={() => setActiveReqForDetail(req)}
                        title="مشاهده جزئیات و گردش تأیید"
                        className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors cursor-pointer"
                      >
                        <Eye className="w-4 h-4" />
                      </button>

                      {requisitionConvertible(req) && (
                        <>
                          <button
                            onClick={() => onConvertToRfq(req)}
                            title="ایجاد استعلام بها"
                            className="px-2 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg font-bold text-xs transition-colors cursor-pointer"
                          >
                            استعلام
                          </button>
                          <button
                            onClick={() => onConvertToPo(req)}
                            title="صدور مستقیم سفارش خرید"
                            className="px-2 py-1 bg-amber-50 hover:bg-amber-100 text-amber-700 rounded-lg font-bold text-xs transition-colors cursor-pointer"
                          >
                            سفارش
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Detailed Modal for Single Requisition */}
      {activeReqForDetail && (
        <Dialog onClose={() => setActiveReqForDetail(null)} label="پرونده تقاضای خرید" overlayClassName="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4" className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col border border-slate-200 animate-in fade-in zoom-in-95 duration-200">
          
            <div className="flex items-center justify-between p-4 border-b border-slate-200 bg-slate-50 rounded-t-2xl">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-800">
                    پرونده تقاضای خرید {formatText(activeReqForDetail.requisitionNumber)}
                  </h3>
                  <p className="text-xs text-slate-500">{formatText(activeReqForDetail.projectName)} · تاریخ: {formatText(activeReqForDetail.date)}</p>
                </div>
              </div>
              <button
                onClick={() => setActiveReqForDetail(null)}
                className="p-2 text-slate-500 hover:text-slate-600 hover:bg-slate-200/60 rounded-xl transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto flex-1 space-y-5 text-sm">
              {/* Requester & Justification */}
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200/70 space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-slate-500">درخواست‌کننده:</span>
                  <span className="font-bold text-slate-900">
                    {formatText(activeReqForDetail.requesterName)} ({activeReqForDetail.requesterRole})
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500">مرکز هزینه / WBS:</span>
                  <span className="tabular-nums font-bold text-slate-800">
                    {formatText(activeReqForDetail.wbsCode)} - {formatText(activeReqForDetail.costCenter)}
                  </span>
                </div>
                <div className="pt-2 border-t border-slate-200/60 text-slate-600">
                  <span className="font-bold text-slate-700 block mb-1">توجیه خرید:</span>
                  <p className="leading-relaxed">{formatText(activeReqForDetail.justification)}</p>
                </div>
              </div>

              {/* Items List Table */}
              <div>
                <h4 className="font-bold text-slate-800 mb-2">فهرست اقلام تقاضا شده:</h4>
                <div className="border border-slate-200 rounded-xl table-scroll">
                  <table className="w-full text-right text-sm">
                    <thead className="bg-slate-100 text-slate-600 font-bold border-b border-slate-200">
                      <tr>
                        <th className="p-2">شرح کالا</th>
                        <th className="p-2 text-center">مقدار</th>
                        <th className="p-2 text-left">نرخ تخمینی</th>
                        <th className="p-2 text-left">جمع کل</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {activeReqForDetail.items.map((it) => (
                        <tr key={it.id}>
                          <td className="p-2">
                            <div className="font-bold text-slate-900">{formatText(it.materialName)}</div>
                            <div className="text-xs text-slate-500">{formatText(it.specification)}</div>
                          </td>
                          <td className="p-2 text-center tabular-nums font-bold">
                            {formatDecimal(it.requestedQty)} {formatText(it.unit)}
                          </td>
                          <td className="p-2 text-left tabular-nums">
                            {formatMoney(it.estimatedUnitPrice, false)}
                          </td>
                          <td className="p-2 text-left tabular-nums font-bold text-indigo-700">
                            {formatMoney(it.estimatedTotalPrice, false)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Multi-step Approval Chain */}
              <div>
                <h4 className="font-bold text-slate-800 mb-2">مراحل تأیید و گردش اداری:</h4>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {/* Step 1: Site Supervisor */}
                  <div className={`p-2 rounded-xl border ${activeReqForDetail.approvals.siteSupervisor?.approved ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-slate-50 border-slate-200 text-slate-500'}`}>
                    <div className="font-bold text-sm">۱. سرپرست کارگاه</div>
                    <div className="text-sm mt-1">
                      {activeReqForDetail.approvals.siteSupervisor?.approved ? '✓ تأیید شده' : 'در انتظار'}
                    </div>
                  </div>

                  {/* Step 2: Project Manager */}
                  <div className={`p-2 rounded-xl border ${activeReqForDetail.approvals.projectManager?.approved ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-slate-50 border-slate-200 text-slate-500'}`}>
                    <div className="font-bold text-sm">۲. مدیر پروژه</div>
                    <div className="text-sm mt-1">
                      {activeReqForDetail.approvals.projectManager?.approved ? '✓ تأیید شده' : 'در انتظار'}
                    </div>
                  </div>

                  {/* Step 3: Procurement Manager */}
                  <div className={`p-2 rounded-xl border ${activeReqForDetail.approvals.procurementManager?.approved ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-slate-50 border-slate-200 text-slate-500'}`}>
                    <div className="font-bold text-sm">۳. تأیید تدارکات (حسابدار)</div>
                    <div className="text-sm mt-1">
                      {activeReqForDetail.approvals.procurementManager?.approved ? '✓ تأیید شده' : 'در انتظار'}
                    </div>
                  </div>

                  {/* Step 4: Finance / CEO */}
                  <div className={`p-2 rounded-xl border ${activeReqForDetail.approvals.financialDirector?.approved ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-slate-50 border-slate-200 text-slate-500'}`}>
                    <div className="font-bold text-sm">۴. مدیر ارشد</div>
                    <div className="text-sm mt-1">
                      {activeReqForDetail.approvals.financialDirector?.approved ? '✓ تأیید نهایی' : 'در نوبت'}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-between items-center p-4 border-t border-slate-200 bg-slate-50 rounded-b-2xl">
              <button
                onClick={() => {
                  onApproveRequisition(activeReqForDetail.id, 'finance');
                  setActiveReqForDetail(null);
                }}
                className="flex items-center gap-2 px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-sm font-bold transition-colors cursor-pointer"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>تأیید مرحله و پیشبرد گردش کار</span>
              </button>
              <button
                onClick={() => setActiveReqForDetail(null)}
                className="px-4 py-2 border border-slate-300 rounded-xl text-sm font-bold text-slate-700 hover:bg-slate-200/50 transition-colors cursor-pointer"
              >
                بستن
              </button>
            </div>
          </Dialog>
      )}
    </div>
  );
};
