import { apiFetch } from '../lib/api';
import React, { useState, useEffect, useRef } from 'react';
import {
  Send,
  Bot,
  User,
  Sparkles,
  BookOpen,
  RefreshCw,
  CheckCircle2,
  ChevronRight,
  Clock,
  Trash2,
  Share2,
  AlertTriangle,
  FileText,
} from 'lucide-react';

interface SimMessage {
  id: string;
  sender: 'bot' | 'user';
  text: string;
  photoUrl?: string;
  buttons?: { text: string; data: string }[][];
  timestamp: string;
  autoDeleteSeconds?: number;
  bookTitle?: string;
  fileName?: string;
  isExpired?: boolean;
}

export const TelegramSimulator: React.FC = () => {
  const [messages, setMessages] = useState<SimMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [countdowns, setCountdowns] = useState<Record<string, number>>({});
  const scrollRef = useRef<HTMLDivElement>(null);

  // Countdown effect for auto-deleting file messages
  useEffect(() => {
    const timer = setInterval(() => {
      setCountdowns((prev) => {
        let changed = false;
        const next: Record<string, number> = { ...prev };
        Object.keys(next).forEach((id) => {
          const seconds = next[id];
          if (typeof seconds === 'number') {
            if (seconds > 1) {
              next[id] = seconds - 1;
              changed = true;
            } else if (seconds === 1) {
              next[id] = 0;
              changed = true;
              // Mark message as expired
              setMessages((prevMsgs) =>
                prevMsgs.map((m) =>
                  m.id === id
                    ? {
                        ...m,
                        isExpired: true,
                        text: `🗑️ *File Expired & Auto-Deleted*\n\nThe 2-minute availability window has expired. The file was automatically removed from this chat per library policy.\n\n💡 _If you forwarded it to your Saved Messages, it remains safely accessible in your personal Telegram account._`,
                        buttons: [
                          [{ text: '📚 Browse Categories', data: 'menu_categories' }],
                          [{ text: '🏠 Main Menu', data: 'menu_main' }],
                        ],
                      }
                    : m
                )
              );
            }
          }
        });
        return changed ? next : prev;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  // Initialize with /start simulation
  useEffect(() => {
    handleSimulate('/start');
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, loading]);

  const handleSimulate = async (text?: string, callbackData?: string) => {
    if (!text && !callbackData) return;

    if (text) {
      const userMsg: SimMessage = {
        id: Date.now().toString(),
        sender: 'user',
        text,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, userMsg]);
    }

    setLoading(true);

    try {
      const res = await apiFetch('/api/simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, callbackData }),
      });

      const data = await res.json();
      const newId = (Date.now() + 1).toString();

      const botMsg: SimMessage = {
        id: newId,
        sender: 'bot',
        text: data.text || 'No response',
        photoUrl: data.photoUrl,
        buttons: data.buttons,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        autoDeleteSeconds: data.autoDeleteSeconds,
        bookTitle: data.bookTitle,
        fileName: data.fileName,
      };

      if (data.autoDeleteSeconds) {
        setCountdowns((prev) => ({ ...prev, [newId]: data.autoDeleteSeconds }));
      }

      setMessages((prev) => [...prev, botMsg]);
    } catch (err) {
      console.error('Simulator error:', err);
      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          sender: 'bot',
          text: '⚠️ Simulation error connecting to backend.',
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const triggerManualExpire = (msgId: string) => {
    setCountdowns((prev) => ({ ...prev, [msgId]: 0 }));
    setMessages((prevMsgs) =>
      prevMsgs.map((m) =>
        m.id === msgId
          ? {
              ...m,
              isExpired: true,
              text: `🗑️ *File Expired & Auto-Deleted*\n\nThe 2-minute availability window has expired. The file was automatically removed from this chat per library policy.\n\n💡 _If you forwarded it to your Saved Messages, it remains safely accessible in your personal Telegram account._`,
              buttons: [
                [{ text: '📚 Browse Categories', data: 'menu_categories' }],
                [{ text: '🏠 Main Menu', data: 'menu_main' }],
              ],
            }
          : m
      )
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || loading) return;
    const query = input;
    setInput('');
    handleSimulate(query);
  };

  const formatSeconds = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const s = sec % 60;
    return `${mins}:${s < 10 ? '0' : ''}${s}`;
  };

  const quickPrompts = [
    'so are there romance novels ?',
    'Do you have Good to Great by Jim Collins?',
    'I want to request Zero to One by Peter Thiel',
    '/wishlist',
    'Analyze MTN Ghana (MTNGH)',
    'Compare MTNGH and GCB',
    'What if the cedi depreciates 15%?',
    'Show my portfolio & risk',
    'Find high dividend GSE stocks',
    '/path entrepreneurship from scratch',
  ];

  return (
    <div className="flex flex-col h-[740px] max-w-4xl mx-auto bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden">
      {/* Simulator Header */}
      <div className="bg-slate-800/90 backdrop-blur px-5 py-3.5 border-b border-slate-700/60 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-amber-500 to-indigo-600 flex items-center justify-center shadow-md shadow-indigo-500/20">
            <Bot className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold text-slate-100">BusiMind</h2>
              <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                Bot Preview
              </span>
            </div>
            <p className="text-xs text-slate-400">@BusiMind_bot • Powered by Gemini 3.8 Flash</p>
          </div>
        </div>

        <button
          onClick={() => {
            setMessages([]);
            handleSimulate('/start');
          }}
          className="flex items-center gap-1.5 text-xs text-slate-300 hover:text-white bg-slate-700/60 hover:bg-slate-700 px-3 py-1.5 rounded-lg border border-slate-600 transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Restart /start
        </button>
      </div>

      {/* Messages Scroll Area */}
      <div ref={scrollRef} className="flex-1 p-4 sm:p-6 overflow-y-auto space-y-4 bg-slate-950/60">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}
          >
            <div
              className={`max-w-[90%] sm:max-w-[80%] rounded-2xl p-4 text-sm leading-relaxed ${
                msg.sender === 'user'
                  ? 'bg-indigo-600 text-white rounded-br-none shadow-md shadow-indigo-600/20'
                  : 'bg-slate-800 text-slate-100 border border-slate-700/80 rounded-bl-none shadow-sm'
              }`}
            >
              {/* Auto-delete banner for delivered file */}
              {countdowns[msg.id] !== undefined && countdowns[msg.id] > 0 && (
                <div className="mb-3 p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                  <div className="flex items-center gap-2 text-amber-300 font-medium">
                    <Clock className="w-4 h-4 animate-pulse text-amber-400" />
                    <span>Auto-delete in: <strong className="font-mono text-sm text-amber-200">{formatSeconds(countdowns[msg.id])}</strong></span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-slate-300 bg-slate-900/60 px-2 py-0.5 rounded border border-slate-700/60 flex items-center gap-1">
                      <Share2 className="w-3 h-3 text-indigo-400" /> Forward to Saved Messages
                    </span>
                    <button
                      onClick={() => triggerManualExpire(msg.id)}
                      className="px-2 py-1 bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-300 rounded-lg text-[10px] font-semibold transition-colors flex items-center gap-1"
                      title="Simulate what happens when 2 minutes pass"
                    >
                      <Trash2 className="w-3 h-3" />
                      Test Expiration
                    </button>
                  </div>
                </div>
              )}

              {msg.isExpired && (
                <div className="mb-2 px-2.5 py-1.5 rounded-lg bg-rose-500/10 border border-rose-500/30 text-[11px] text-rose-300 flex items-center gap-1.5">
                  <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                  <span>File automatically deleted from chat (2-minute window expired)</span>
                </div>
              )}

              {/* Physical Telegram Document Bubble (Showing clean [BusiMind] filename) */}
              {msg.fileName && !msg.isExpired && (
                <div className="mb-3 p-3 rounded-xl bg-slate-900/90 border border-indigo-500/30 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-indigo-500/20 border border-indigo-500/40 flex items-center justify-center text-indigo-300 shrink-0">
                    <FileText className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-slate-100 truncate font-mono">{msg.fileName}</p>
                    <p className="text-[10px] text-emerald-400 font-mono mt-0.5 flex items-center gap-1">
                      <span>✓ Official [BusiMind] Standardized File</span>
                    </p>
                  </div>
                </div>
              )}

              {/* Telegram Photo / Book Cover Preview */}
              {msg.photoUrl && (
                <div className="mb-3 rounded-xl overflow-hidden max-w-[200px] border border-slate-700/80 shadow-md bg-slate-900">
                  <img
                    src={msg.photoUrl}
                    alt="Book Cover"
                    className="w-full h-auto object-cover max-h-[260px]"
                    referrerPolicy="no-referrer"
                  />
                </div>
              )}

              {/* Parse Markdown-like bold and italics for clean Telegram display */}
              <div className="whitespace-pre-wrap font-sans space-y-1">
                {(msg.text || '').split('\n').map((line, lIdx) => {
                  let formatted = line;
                  return (
                    <p key={lIdx} className={line.startsWith('*') || line.startsWith('🎯') || line.startsWith('🗺') ? 'font-medium' : ''}>
                      {formatted.replace(/\*(.*?)\*/g, '$1').replace(/_(.*?)_/g, '$1')}
                    </p>
                  );
                })}
              </div>

              {/* Telegram Inline Keyboard Buttons */}
              {Array.isArray(msg.buttons) && msg.buttons.length > 0 && (
                <div className="mt-3 pt-3 border-t border-slate-700/60 flex flex-col gap-1.5">
                  {msg.buttons.map((row, rIdx) => {
                    const buttonList = Array.isArray(row) ? row : (row ? [row] : []);
                    return (
                      <div key={rIdx} className="flex flex-wrap gap-1.5">
                        {buttonList.map((btn: any, bIdx: number) => (
                          <button
                            key={bIdx}
                            disabled={loading}
                            onClick={() => handleSimulate(undefined, btn?.data)}
                            className="flex-1 min-w-[130px] text-xs font-medium py-2 px-3 bg-slate-700/80 hover:bg-indigo-600/90 text-slate-200 hover:text-white rounded-xl border border-slate-600/70 hover:border-indigo-500 transition-all text-center truncate active:scale-[0.98]"
                          >
                            {btn?.text || 'Action'}
                          </button>
                        ))}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
            <span className="text-[10px] text-slate-500 mt-1 px-1">{msg.timestamp}</span>
          </div>
        ))}

        {loading && (
          <div className="flex items-center gap-2 text-xs text-slate-400 bg-slate-800/60 border border-slate-700/50 rounded-xl px-3.5 py-2.5 max-w-fit">
            <Sparkles className="w-3.5 h-3.5 text-amber-400 animate-spin" />
            <span>BusiMind is analyzing business concepts...</span>
          </div>
        )}
      </div>

      {/* Suggested Fast Prompts */}
      <div className="px-4 py-2 bg-slate-900/95 border-t border-slate-800/80 overflow-x-auto flex items-center gap-2 text-xs">
        <span className="text-slate-400 text-[11px] font-medium whitespace-nowrap flex items-center gap-1">
          <Sparkles className="w-3 h-3 text-amber-400" /> Try:
        </span>
        {quickPrompts.map((prompt, idx) => (
          <button
            key={idx}
            disabled={loading}
            onClick={() => handleSimulate(prompt)}
            className="whitespace-nowrap px-2.5 py-1 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 hover:border-slate-600 transition-colors text-[11px]"
          >
            {prompt}
          </button>
        ))}
      </div>

      {/* Message Input Box */}
      <form onSubmit={handleSubmit} className="p-3 sm:p-4 bg-slate-900 border-t border-slate-800 flex items-center gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask BusiMind anything or state your business goal..."
          className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
        />
        <button
          type="submit"
          disabled={!input.trim() || loading}
          className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white p-2.5 rounded-xl transition-all shadow-md shadow-indigo-600/30 flex items-center justify-center"
        >
          <Send className="w-4 h-4" />
        </button>
      </form>
    </div>
  );
};
