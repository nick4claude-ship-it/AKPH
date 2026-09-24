import React, { useState } from 'react';
import { Sparkles, Send, Bot, User, CornerDownLeft, RefreshCw, X, MessageSquare, ArrowRight } from 'lucide-react';
import { Project, PettyCash, PendingApproval } from '../../types';
import { formatCurrencyCompact } from '../../utils/formatters';

interface AiAgentWidgetProps {
  isOpen?: boolean;
  onClose?: () => void;
  isFloating?: boolean;
  projects: Project[];
  pettyCashList: PettyCash[];
  pendingApprovals: PendingApproval[];
}

interface Message {
  id: string;
  sender: 'ai' | 'user';
  text: string;
  dataPoints?: { label: string; value: string }[];
  time: string;
}

export const samplePrompts = [
  'وضعیت مالی پروژه‌های فعال را بررسی کن.',
  'بیشترین هزینه این ماه مربوط به کدام پروژه بوده؟',
  'کدام پروژه بیشترین مطالبات را دارد؟',
  'هزینه‌های تنخواه این ماه را خلاصه کن.',
  'کدام فاکتورها هنوز تأیید نشده‌اند؟',
  'وضعیت سود و زیان شرکت را گزارش کن.',
];

export const AiAgentWidget: React.FC<AiAgentWidgetProps> = ({
  isOpen = true,
  onClose,
  isFloating = false,
  projects,
  pettyCashList,
  pendingApprovals,
}) => {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'm1',
      sender: 'ai',
      text: 'سلام مهندس رادمنش. من دستیار هوشمند مرکز فرماندهی و پایش مالی شرکت سازه گستران پارس هستم. داده‌های زنده ۵ پروژه فعال، تنخواه‌ها، صورت‌وضعیت‌ها و کارتابل تاییدیه را تحلیل می‌کنم. چه کمکی از دست من برمی‌آید؟',
      time: 'هم‌اکنون',
    },
  ]);
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);

  const generateAnswer = (query: string): { text: string; dataPoints?: { label: string; value: string }[] } => {
    const q = query.trim().toLowerCase();

    if (q.includes('مطالبات') || q.includes('بیشترین مطالبات')) {
      const sortedByRec = [...projects].sort((a, b) => b.receivables - a.receivables);
      const top = sortedByRec[0];
      const second = sortedByRec[1];
      return {
        text: `بر اساس آخرین پایش حساب‌ها، بیشترین مطالبات وصول‌نشده مربوط به پروژه «${top.name}» با مبلغ ${formatCurrencyCompact(top.receivables)} است. دومین پروژه پرمطالبه «${second.name}» به کارفرمایی شرکت سرمایه‌گذاری تابان با ${formatCurrencyCompact(second.receivables)} است. پیشنهاد می‌شود وصول مطالبات فاز البرز و صورت‌وضعیت شماره ۸ فجر تسریع گردد.`,
        dataPoints: [
          { label: top.name, value: formatCurrencyCompact(top.receivables) },
          { label: second.name, value: formatCurrencyCompact(second.receivables) },
          { label: 'مجموع مطالبات معوق', value: '۴.۲ میلیارد تومان' },
        ],
      };
    }

    if (q.includes('بیشترین هزینه') || q.includes('هزینه این ماه')) {
      const sortedByCost = [...projects].sort((a, b) => b.cost - a.cost);
      const topCost = sortedByCost[0];
      return {
        text: `بیشترین هزینه ثبت‌شده در دوره جاری مربوط به پروژه «${topCost.name}» با مجموع هزینه تمام‌شده ${formatCurrencyCompact(topCost.cost)} است که عمده آن صرف خرید آرماتوربندی، بتن‌ریزی سازه و سقف‌ها شده است.`,
        dataPoints: [
          { label: 'پروژه پرهزینه', value: topCost.name },
          { label: 'بهای تمام‌شده', value: formatCurrencyCompact(topCost.cost) },
          { label: 'حاشیه سود پروژه', value: `${topCost.profitMargin}٪` },
        ],
      };
    }

    if (q.includes('تنخواه') || q.includes('تنخواه گردان')) {
      const criticalPetty = pettyCashList.filter((p) => p.usableBalance < 0 || p.status === 'critical');
      return {
        text: `در حال حاضر ۴ تنخواه فعال در کارگاه‌ها پایش می‌شوند. تنخواه کارگاه «مجتمع مسکونی نیلوفر» به سرپرستی مهندس پورحسینی به دلیل هزینه‌های نظافت و نصبیات پایانی دچار کسری موجودی منفی ۴ میلیون تومان گردیده و نیازمند شارژ فوری است. موجودی قابل مصرف کل تنخواه‌ها ۲۸۷ میلیون تومان می‌باشد.`,
        dataPoints: [
          { label: 'موجودی کل تنخواه‌ها', value: '۲۸۷ میلیون تومان' },
          { label: 'هزینه‌های در انتظار تایید تنخواه', value: '۸۹.۵ میلیون تومان' },
          { label: 'تنخواه‌های نیازمند شارژ', value: '۲ کارگاه' },
        ],
      };
    }

    if (q.includes('فاکتور') || q.includes('تأیید') || q.includes('تایید نشده')) {
      const pendingCount = pendingApprovals.filter((p) => p.status === 'pending').length;
      return {
        text: `در حال حاضر تعداد ${pendingCount} سند و فاکتور به ارزش مجموعاً ۹۶۴ میلیون تومان در کارتابل تاییدیه شما قرار دارد. بزرگترین سند مربوط به خرید ۳۰ تن قیر پلیمری پروژه تقاطع فجر به مبلغ ۵۲۰ میلیون تومان (با ۳۲۰ میلیون پیش‌پرداخت نقدی) از شرکت نفت پاسارگاد است.`,
        dataPoints: [
          { label: 'اسناد در انتظار', value: `${pendingCount} فقره سند` },
          { label: 'ارزش کل اسناد', value: '۹۶۴ میلیون تومان' },
          { label: 'بزرگترین سند', value: 'پالایش نفت پاسارگاد (۵۲۰ م.ت)' },
        ],
      };
    }

    if (q.includes('سود و زیان') || q.includes('سود')) {
      return {
        text: `وضعیت کل شرکت بسیار مثبت است: درآمد ثبتی ۴۱۰.۵ میلیارد تومان در برابر ۳۴۰.۳ میلیارد تومان هزینه، که منجر به سود عملیاتی ۷۰.۲ میلیارد تومان با حاشیه سود میانگین ۱۷.۱٪ شده است. سودآوری نسبت به دوره قبل رشد ۲۵.۳٪ را نشان می‌دهد.`,
        dataPoints: [
          { label: 'درآمد کل شرکت', value: '۴۱۰.۵ میلیارد تومان' },
          { label: 'هزینه کل تمام‌شده', value: '۳۴۰.۳ میلیارد تومان' },
          { label: 'سود ناخالص عملیاتی', value: '۷۰.۲ میلیارد تومان' },
          { label: 'میانگین حاشیه سود', value: '۱۷.۱ درصد' },
        ],
      };
    }

    // Default general project overview
    return {
      text: `تمام ۵ پروژه فعال دارای پیشرفت فیزیکی منظم هستند. پروژه مسکونی نیلوفر در آستانه تحویل موقت (۹۴٪) است و برج رونیکا با حاشیه سود ۲۰.۵٪ سودآورترین پروژه جاری است. تنها ریسک اصلی، مطالبات معوق شهرداری در پروژه تقاطع بزرگراه فجر است.`,
      dataPoints: [
        { label: 'پروژه‌های فعال', value: '۵ پروژه' },
        { label: 'بالاترین حاشیه سود', value: 'برج رونیکا (۲۰.۵٪)' },
        { label: 'نزدیک به تحویل', value: 'مجتمع نیلوفر (۹۴٪)' },
      ],
    };
  };

  const handleSend = (textToSend?: string) => {
    const text = textToSend || inputValue;
    if (!text.trim()) return;

    const userMsg: Message = {
      id: `u-${Date.now()}`,
      sender: 'user',
      text,
      time: 'هم‌اکنون',
    };

    setMessages((prev) => [...prev, userMsg]);
    if (!textToSend) setInputValue('');
    setIsTyping(true);

    setTimeout(() => {
      const response = generateAnswer(text);
      const aiMsg: Message = {
        id: `ai-${Date.now()}`,
        sender: 'ai',
        text: response.text,
        dataPoints: response.dataPoints,
        time: 'هم‌اکنون',
      };
      setMessages((prev) => [...prev, aiMsg]);
      setIsTyping(false);
    }, 600);
  };

  if (!isOpen) return null;

  return (
    <div
      className={`${
        isFloating
          ? 'fixed bottom-6 left-6 z-50 w-96 max-w-[calc(100vw-3rem)] rounded-2xl shadow-2xl border border-amber-500/30'
          : 'bg-white rounded-xl border border-slate-200 shadow-xs'
      } bg-white flex flex-col overflow-hidden text-right`}
    >
      {/* Agent Top Header */}
      <div className="bg-gradient-to-l from-slate-900 via-slate-800 to-amber-950 p-3.5 text-white flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-amber-500/20 border border-amber-400/40 text-amber-300 flex items-center justify-center">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <h3 className="text-xs font-bold text-amber-300">دستیار هوشمند مدیریت (AI Agent)</h3>
              <span className="text-[9px] bg-amber-400/20 text-amber-300 px-1.5 py-0.5 rounded font-mono">
                نسخه مدیریتی
              </span>
            </div>
            <p className="text-[10px] text-slate-300">تحلیل یکپارچه پروژه‌ها، مالی، تنخواه و صورت‌وضعیت</p>
          </div>
        </div>

        {onClose && (
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-white rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Suggested Fast Prompts */}
      <div className="p-2.5 bg-slate-50 border-b border-slate-200/80">
        <div className="text-[10px] text-slate-500 font-semibold mb-1.5 flex items-center gap-1">
          <MessageSquare className="w-3 h-3 text-amber-600" />
          <span>پرسش‌های پیشنهادی مدیرعامل:</span>
        </div>
        <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
          {samplePrompts.map((p, idx) => (
            <button
              key={idx}
              onClick={() => handleSend(p)}
              className="text-[11px] bg-white hover:bg-amber-50 text-slate-700 hover:text-amber-900 border border-slate-200 hover:border-amber-300 px-2 py-1 rounded-md text-right transition-colors cursor-pointer"
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      {/* Chat Messages Log */}
      <div className="p-3.5 space-y-3 overflow-y-auto h-72 max-h-80 text-xs bg-slate-50/40">
        {messages.map((m) => (
          <div
            key={m.id}
            className={`flex flex-col ${m.sender === 'user' ? 'items-end' : 'items-start'}`}
          >
            <div
              className={`p-3 rounded-xl max-w-[90%] leading-relaxed ${
                m.sender === 'user'
                  ? 'bg-slate-900 text-white rounded-bl-xs'
                  : 'bg-white border border-slate-200 text-slate-800 rounded-br-xs shadow-2xs'
              }`}
            >
              <div className="flex items-center gap-1.5 mb-1 text-[10px] opacity-75">
                {m.sender === 'ai' ? (
                  <>
                    <Bot className="w-3 h-3 text-amber-600" />
                    <span className="font-bold text-amber-800">هوش تحلیلی سامانه</span>
                  </>
                ) : (
                  <>
                    <User className="w-3 h-3 text-slate-300" />
                    <span>مدیر ارشد</span>
                  </>
                )}
                <span>·</span>
                <span>{m.time}</span>
              </div>

              <p className="text-xs whitespace-pre-line">{m.text}</p>

              {/* Structured Key Metrics Pill Island if present */}
              {m.dataPoints && (
                <div className="mt-2 pt-2 border-t border-slate-100 grid grid-cols-1 gap-1 font-mono">
                  {m.dataPoints.map((dp, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between text-[11px] bg-slate-50 px-2 py-1 rounded border border-slate-200/60"
                    >
                      <span className="text-slate-600">{dp.label}:</span>
                      <strong className="text-slate-900 font-bold">{dp.value}</strong>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}

        {isTyping && (
          <div className="flex items-center gap-2 text-slate-400 text-xs p-2">
            <RefreshCw className="w-3.5 h-3.5 animate-spin text-amber-600" />
            <span>دستیار در حال تجمیع و تحلیل داده‌های مالی پروژه‌ها...</span>
          </div>
        )}
      </div>

      {/* Input Bar */}
      <div className="p-2.5 border-t border-slate-200 bg-white flex items-center gap-2">
        <input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSend()}
          placeholder="سوالی درباره سود، هزینه، تنخواه یا پروژه‌ها بپرسید..."
          className="flex-1 bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-amber-500"
        />
        <button
          onClick={() => handleSend()}
          disabled={!inputValue.trim()}
          className="bg-amber-500 hover:bg-amber-600 disabled:opacity-40 text-slate-950 p-2 rounded-lg transition-colors cursor-pointer"
        >
          <Send className="w-3.5 h-3.5 rotate-180" />
        </button>
      </div>
    </div>
  );
};
