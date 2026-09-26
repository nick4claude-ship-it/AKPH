import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sparkles, Send, Bot, User, RefreshCw, X, MessageSquare, Settings, RotateCcw, AlertCircle } from 'lucide-react';
import { formatInt, formatText } from '../../utils/formatters';
import { useAssistant } from '../../store/useAssistant';
import { Button } from '../common/Button';

interface AiAgentWidgetProps {
  isOpen?: boolean;
  onClose?: () => void;
  isFloating?: boolean;
}

export const samplePrompts = [
  'وضعیت پروژه‌ها را خلاصه کن.',
  'بیشترین هزینه مربوط به کدام پروژه است؟',
  'کدام پروژه بیشترین مطالبات را دارد؟',
  'چه مواردی در انتظار تأیید است؟',
  'مانده بانک‌ها و صندوق چقدر است؟',
  'وضعیت سود و زیان را گزارش کن.',
];

/** The management assistant: dashboard card, the /ai page and the floating panel. */
export const AiAgentWidget: React.FC<AiAgentWidgetProps> = ({ isOpen = true, onClose, isFloating = false }) => {
  const assistant = useAssistant();
  const navigate = useNavigate();
  const [input, setInput] = useState('');
  const log = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = log.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [assistant.messages.length, assistant.sending]);

  if (!isOpen) return null;

  const submit = (text?: string) => {
    const q = text ?? input;
    if (!q.trim()) return;
    assistant.send(q);
    if (text === undefined) setInput('');
  };

  const welcome = assistant.demo
    ? `سلام ${assistant.userName}. این دستیار در نسخه نمایشی است: پاسخ‌ها با قواعد ثابت از داده‌های نمونه همین مرورگر محاسبه می‌شود و به سرویس هوش مصنوعی وصل نیست.`
    : `سلام ${assistant.userName}. پرسش خود را درباره پروژه‌ها و دفاتر بنویسید؛ پاسخ فقط از داده‌هایی ساخته می‌شود که شما اجازه دیدنشان را دارید. دستیار چیزی ثبت یا تأیید نمی‌کند.`;

  return (
    <section
      aria-label="دستیار مدیریت"
      className={`${isFloating ? 'fixed bottom-6 left-6 z-50 w-96 max-w-[calc(100vw-3rem)] shadow-lg' : ''} card flex flex-col overflow-hidden text-right`}
    >
      <div className="bg-nav px-4 py-3 text-white flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="w-9 h-9 rounded-lg bg-brand/20 text-brand flex items-center justify-center shrink-0">
            <Sparkles className="w-5 h-5" aria-hidden />
          </span>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-white">دستیار مدیریت</h3>
              {assistant.demo && <span className="text-xs px-2 rounded-full bg-brand text-brand-ink">نمایشی</span>}
            </div>
            <p className="text-xs text-slate-300 truncate">
              {assistant.demo
                ? 'پاسخ نمایشی از داده‌های نمونه'
                : assistant.ready && assistant.status
                  ? `امروز ${formatInt(assistant.status.remaining)} پرسش دیگر از ${formatInt(assistant.status.dailyLimit)}`
                  : 'پاسخ از داده‌هایی که اجازه دیدنشان را دارید'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {assistant.messages.length > 0 && (
            <button type="button" onClick={assistant.reset} aria-label="گفتگوی تازه" className="p-2 text-slate-300 hover:text-white rounded-lg">
              <RotateCcw className="w-4 h-4" aria-hidden />
            </button>
          )}
          {onClose && (
            <button type="button" onClick={onClose} aria-label="بستن دستیار" className="p-2 text-slate-300 hover:text-white rounded-lg">
              <X className="w-4 h-4" aria-hidden />
            </button>
          )}
        </div>
      </div>

      {!assistant.status && !assistant.statusError ? (
        <div className="p-4 space-y-2">
          <div className="skeleton h-4 w-2/3" />
          <div className="skeleton h-4 w-1/2" />
        </div>
      ) : assistant.statusError ? (
        <div className="p-6 flex flex-col items-center gap-3 text-center">
          <AlertCircle className="w-8 h-8 text-danger" aria-hidden />
          <p className="text-sm text-ink">{assistant.statusError}</p>
          <Button size="sm" icon={RotateCcw} onClick={assistant.reloadStatus}>
            تلاش دوباره
          </Button>
        </div>
      ) : !assistant.ready ? (
        <div className="p-6 flex flex-col items-center gap-3 text-center">
          <Bot className="w-10 h-10 text-ink-subtle" aria-hidden />
          <p className="text-sm font-bold text-ink">دستیار هوشمند هنوز توسط مدیر سیستم فعال نشده است</p>
          {assistant.canManage ? (
            <>
              <p className="text-xs text-ink-subtle">سرویس‌دهنده، مدل و کلید API را در تنظیمات وارد و دستیار را فعال کنید.</p>
              <Button variant="primary" size="sm" icon={Settings} onClick={() => navigate('/settings')}>
                تنظیمات دستیار
              </Button>
            </>
          ) : (
            <p className="text-xs text-ink-subtle">پس از فعال‌شدن، همین‌جا می‌توانید درباره پروژه‌ها و دفاتر بپرسید.</p>
          )}
        </div>
      ) : (
        <>
          <div className="px-3 py-2 bg-surface-muted border-b border-line">
            <p className="text-xs text-ink-muted font-medium mb-2 flex items-center gap-1">
              <MessageSquare className="w-4 h-4 text-brand-strong" aria-hidden />
              پرسش‌های پیشنهادی
            </p>
            <div className="flex flex-wrap gap-2 max-h-24 overflow-y-auto">
              {samplePrompts.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => submit(p)}
                  disabled={assistant.sending}
                  className="text-xs bg-surface hover:bg-brand-soft text-ink-muted hover:text-ink border border-line px-2 py-1 rounded-md text-right disabled:opacity-60"
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          <div ref={log} className="p-3 space-y-3 overflow-y-auto h-72 text-sm bg-canvas" aria-live="polite">
            <Bubble sender="ai" name="دستیار" text={welcome} />
            {assistant.messages.map((m) => (
              <Bubble key={m.id} sender={m.sender} name={m.sender === 'ai' ? 'دستیار' : formatText(assistant.userName)} text={m.text} time={m.time} error={m.error} dataPoints={m.dataPoints} />
            ))}
            {assistant.sending && (
              <div className="flex items-center gap-2 text-ink-subtle text-xs p-2">
                <RefreshCw className="w-4 h-4 animate-spin text-brand-strong" aria-hidden />
                در حال آماده‌کردن پاسخ…
              </div>
            )}
          </div>

          <form
            className="p-2 border-t border-line bg-surface flex items-center gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              submit();
            }}
          >
            <input
              aria-label="پرسش از دستیار"
              type="text"
              value={input}
              maxLength={assistant.status?.questionMax}
              onChange={(e) => setInput(e.target.value)}
              placeholder="پرسش درباره پروژه‌ها، هزینه‌ها یا تأییدها…"
              className="input flex-1"
            />
            <button type="submit" disabled={!input.trim() || assistant.sending} aria-label="ارسال پرسش" className="btn btn-primary btn-icon">
              <Send className="w-4 h-4 rotate-180" aria-hidden />
            </button>
          </form>
        </>
      )}
    </section>
  );
};

const Bubble: React.FC<{
  sender: 'ai' | 'user';
  name: string;
  text: string;
  time?: string;
  error?: boolean;
  dataPoints?: { label: string; value: string }[];
}> = ({ sender, name, text, time, error, dataPoints }) => (
  <div className={`flex flex-col ${sender === 'user' ? 'items-end' : 'items-start'}`}>
    <div
      className={`p-3 rounded-xl max-w-[90%] ${
        sender === 'user' ? 'bg-nav text-white' : error ? 'bg-danger-soft border border-rose-200 text-danger' : 'bg-surface border border-line text-ink'
      }`}
    >
      <div className={`flex items-center gap-2 mb-1 text-xs ${sender === 'user' ? 'text-slate-300' : 'text-ink-subtle'}`}>
        {sender === 'ai' ? <Bot className="w-4 h-4" aria-hidden /> : <User className="w-4 h-4" aria-hidden />}
        <span className="font-medium">{name}</span>
        {time && (
          <>
            <span aria-hidden>·</span>
            <span>{formatText(time)}</span>
          </>
        )}
      </div>
      <p className="text-sm whitespace-pre-line">{formatText(text)}</p>
      {dataPoints && (
        <div className="mt-2 pt-2 border-t border-line grid grid-cols-1 gap-1 tabular-nums">
          {dataPoints.map((dp) => (
            <div key={dp.label} className="flex items-center justify-between gap-2 text-xs bg-surface-muted px-2 py-1 rounded">
              <span className="text-ink-muted">{formatText(dp.label)}</span>
              <strong className="text-ink font-bold">{formatText(dp.value)}</strong>
            </div>
          ))}
        </div>
      )}
    </div>
  </div>
);
