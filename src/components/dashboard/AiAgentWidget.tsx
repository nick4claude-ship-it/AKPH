import React, { useState } from 'react';
import { Sparkles, Send, Bot, User, CornerDownLeft, RefreshCw, X, MessageSquare, ArrowRight } from 'lucide-react';
import { formatCurrencyCompact, formatText } from '../../utils/formatters';
import { useCurrentUser } from '../../store/session';
import { useAssistant, type AssistantMessage } from '../../store/useAssistant';

interface AiAgentWidgetProps {
  isOpen?: boolean;
  onClose?: () => void;
  isFloating?: boolean;
}

type Message = AssistantMessage;

export const samplePrompts = [
  'وضعیت پروژه‌ها را خلاصه کن.',
  'بیشترین هزینه مربوط به کدام پروژه است؟',
  'کدام پروژه بیشترین مطالبات را دارد؟',
  'وضعیت تنخواه‌ها را خلاصه کن.',
  'چه مواردی در انتظار تأیید است؟',
  'وضعیت سود و زیان شرکت را گزارش کن.',
];

export const AiAgentWidget: React.FC<AiAgentWidgetProps> = ({
  isOpen = true,
  onClose,
  isFloating = false,
}) => {
  const user = useCurrentUser();
  const assistant = useAssistant();
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'm1',
      sender: 'ai',
      text: `سلام ${user.name}. این نسخه نمایشی دستیار است و هنوز به مدل زبانی متصل نیست؛ پاسخ‌ها با قواعد ثابت و مستقیماً از داده‌های ثبت‌شده (دفاتر، قراردادها، صورت‌وضعیت‌ها، تنخواه، خرید و انبار) محاسبه می‌شود. مثلاً بپرسید: «وضعیت پروژه‌ها را خلاصه کن».`,
      time: 'هم‌اکنون',
    },
  ]);
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);


  const handleSend = (textToSend?: string) => {
    const text = textToSend || inputValue;
    if (!text.trim()) return;

    const userMsg = assistant.userMessage(text);

    setMessages((prev) => [...prev, userMsg]);
    if (!textToSend) setInputValue('');
    setIsTyping(true);

    setTimeout(() => {
      const aiMsg = assistant.reply(text);
      setMessages((prev) => [...prev, aiMsg]);
      setIsTyping(false);
    }, 600);
  };

  if (!isOpen) return null;

  return (
    <div
      className={`${
        isFloating
          ? 'fixed bottom-6 left-6 z-50 w-96 max-w-[calc(100vw-3rem)] rounded-xl shadow-2xl border border-amber-500/30'
          : 'bg-white rounded-xl border border-slate-200 shadow-xs'
      } bg-white flex flex-col overflow-hidden text-right`}
    >
      {/* Agent Top Header */}
      <div className="bg-gradient-to-l from-slate-900 via-slate-800 to-amber-950 p-3 text-white flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-amber-500/20 border border-amber-400/40 text-amber-300 flex items-center justify-center">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-amber-300">دستیار مدیریت</h3>
              <span
                className="text-xs bg-rose-500/25 text-rose-100 border border-rose-300/40 px-2 py-1 rounded font-bold"
                title="به مدل زبانی متصل نیست؛ پاسخ‌ها با قواعد ثابت از داده‌های سامانه محاسبه می‌شود."
              >
                نسخه نمایشی
              </span>
            </div>
            <p className="text-sm text-slate-300">پاسخ از داده‌های ثبت‌شده؛ بدون اتصال به مدل زبانی</p>
          </div>
        </div>

        {onClose && (
          <button
            onClick={onClose}
            aria-label="بستن"
            className="p-1 text-slate-500 hover:text-white rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Suggested Fast Prompts */}
      <div className="p-2 bg-slate-50 border-b border-slate-200/80">
        <div className="text-xs text-slate-500 font-medium mb-2 flex items-center gap-1">
          <MessageSquare className="w-3 h-3 text-amber-700" />
          <span>پرسش‌های پیشنهادی:</span>
        </div>
        <div className="flex flex-wrap gap-2 max-h-24 overflow-y-auto">
          {samplePrompts.map((p) => (
            <button
              key={p}
              onClick={() => handleSend(p)}
              className="text-xs bg-white hover:bg-amber-50 text-slate-700 hover:text-amber-900 border border-slate-200 hover:border-amber-300 px-2 py-1 rounded-md text-right transition-colors cursor-pointer"
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      {/* Chat Messages Log */}
      <div className="p-3 space-y-3 overflow-y-auto h-72 max-h-80 text-sm bg-slate-50/40">
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
              <div className="flex items-center gap-2 mb-1 text-sm opacity-75">
                {m.sender === 'ai' ? (
                  <>
                    <Bot className="w-3 h-3 text-amber-700" />
                    <span className="font-bold text-amber-800">دستیار (نسخه نمایشی)</span>
                  </>
                ) : (
                  <>
                    <User className="w-3 h-3 text-slate-300" />
                    <span>{formatText(user.name)}</span>
                  </>
                )}
                <span>·</span>
                <span>{formatText(m.time)}</span>
              </div>

              <p className="text-sm whitespace-pre-line">{formatText(m.text)}</p>

              {/* Structured Key Metrics Pill Island if present */}
              {m.dataPoints && (
                <div className="mt-2 pt-2 border-t border-slate-100 grid grid-cols-1 gap-1 tabular-nums">
                  {m.dataPoints.map((dp) => (
                    <div
                      key={dp.label}
                      className="flex items-center justify-between text-xs bg-slate-50 px-2 py-1 rounded border border-slate-200/60"
                    >
                      <span className="text-slate-600">{formatText(dp.label)}:</span>
                      <strong className="text-slate-900 font-bold">{formatText(dp.value)}</strong>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}

        {isTyping && (
          <div className="flex items-center gap-2 text-slate-500 text-xs p-2">
            <RefreshCw className="w-3.5 h-3.5 animate-spin text-amber-700" />
            <span>دستیار در حال تجمیع و تحلیل داده‌های مالی پروژه‌ها...</span>
          </div>
        )}
      </div>

      {/* Input Bar */}
      <div className="p-2 border-t border-slate-200 bg-white flex items-center gap-2">
        <input aria-label="پرسش از دستیار"
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSend()}
          placeholder="سوالی درباره سود، هزینه، تنخواه یا پروژه‌ها بپرسید..."
          className="flex-1 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-amber-500"
        />
        <button
          onClick={() => handleSend()}
          disabled={!inputValue.trim()}
          aria-label="ارسال پرسش"
              className="btn btn-primary btn-icon"
        >
          <Send className="w-3.5 h-3.5 rotate-180" />
        </button>
      </div>
    </div>
  );
};
