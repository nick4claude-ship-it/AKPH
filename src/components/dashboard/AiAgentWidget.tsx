import React, { useState } from 'react';
import { Sparkles, Send, Bot, User, CornerDownLeft, RefreshCw, X, MessageSquare, ArrowRight } from 'lucide-react';
import { formatCurrencyCompact } from '../../utils/formatters';
import { useAppState } from '../../store/AppStore';
import { useCurrentUser } from '../../store/session';
import { answerManagementQuery, AssistantAnswer } from '../../store/assistant';

interface AiAgentWidgetProps {
  isOpen?: boolean;
  onClose?: () => void;
  isFloating?: boolean;
}

interface Message {
  id: string;
  sender: 'ai' | 'user';
  text: string;
  dataPoints?: { label: string; value: string }[];
  time: string;
}

export const samplePrompts = [
  'وضعیت پروژه رونیکا را بگو.',
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
  const appState = useAppState();
  const user = useCurrentUser();
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'm1',
      sender: 'ai',
      text: `سلام ${user.name}. من دستیار هوشمند مدیریت هستم و پاسخ‌ها را مستقیماً از داده‌های پروژه‌ها، حسابداری، قراردادها، تدارکات، تنخواه، صورت‌وضعیت‌ها و انبار محاسبه می‌کنم. مثلاً بپرسید: «وضعیت پروژه رونیکا را بگو».`,
      time: 'هم‌اکنون',
    },
  ]);
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);

  const generateAnswer = (query: string): AssistantAnswer => answerManagementQuery(appState, query);

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
