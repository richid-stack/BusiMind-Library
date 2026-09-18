import React, { useState, useEffect } from 'react';
import { X, Send, ExternalLink, CheckCircle2, AlertCircle, Sparkles, HelpCircle, Copy, Check } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { Book } from '../../types';
import { apiFetch } from '../../lib/api';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  book?: Book | null;
  onConnected?: (chatId: string) => void;
}

export const TelegramConnectModal: React.FC<Props> = ({ isOpen, onClose, book, onConnected }) => {
  const { user, telegramChatId } = useAuth();
  const [manualId, setManualId] = useState('');
  const [pairingCode, setPairingCode] = useState<string | null>(null);
  const [copiedCode, setCopiedCode] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [hasOpenedLink, setHasOpenedLink] = useState(false);

  // Generate a short 6-digit pairing code when modal opens
  useEffect(() => {
    if (isOpen && user?.uid) {
      apiFetch('/api/user/generate-pairing-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uid: user.uid, bookId: book?.id }),
      })
        .then((res) => res.json())
        .then((data) => {
          if (data.code) {
            setPairingCode(data.code);
          }
        })
        .catch((e) => console.warn('Pairing code fetch error:', e));
    }
  }, [isOpen, user?.uid, book?.id]);

  // Auto-detect when Telegram account gets linked via Firestore snapshot
  useEffect(() => {
    if (telegramChatId && isOpen) {
      setSuccessMsg(`Telegram linked! (Chat ID: ${telegramChatId})`);
      if (onConnected) {
        onConnected(telegramChatId);
      }
      const timer = setTimeout(() => {
        onClose();
      }, 1800);
      return () => clearTimeout(timer);
    }
  }, [telegramChatId, isOpen, onConnected, onClose]);

  if (!isOpen) return null;

  const botUsername = 'BusiMind_bot';
  const startPayload = pairingCode
    ? `p_${pairingCode}`
    : user?.uid
    ? `link_${user.uid}${book ? `_book_${book.id}` : ''}`
    : book ? `book_${book.id}` : '';
  const telegramLink = `https://t.me/${botUsername}?start=${startPayload}`;

  const handleOpenTelegram = () => {
    setHasOpenedLink(true);
    window.open(telegramLink, '_blank');
  };

  const handleCopyCode = () => {
    if (!pairingCode) return;
    navigator.clipboard.writeText(pairingCode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanId = manualId.trim().replace(/^@/, '');
    if (!cleanId) return;

    setLoading(true);
    setError(null);

    try {
      const res = await apiFetch('/api/user/link-telegram', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          uid: user?.uid,
          telegramChatId: cleanId,
          bookIdToDeliver: book?.id,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setSuccessMsg(data.delivery?.delivered
          ? `Delivered "${book?.title || 'Book'}" directly to your Telegram!`
          : `Telegram linked successfully! (Chat ID: ${cleanId})`
        );
        if (onConnected) {
          onConnected(cleanId);
        }
        setTimeout(() => {
          onClose();
        }, 1800);
      } else {
        setError(data.error || 'Failed to link account. Please verify your Chat ID.');
      }
    } catch (err: any) {
      setError(err?.message || 'Network connection failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleUnlink = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch('/api/user/unlink-telegram', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          uid: user?.uid,
          email: user?.email,
          chatId: telegramChatId || manualId.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setSuccessMsg('Telegram unlinked! You can now link your primary account.');
        if (onConnected) {
          onConnected('');
        }
        setManualId('');
      } else {
        setError(data.error || 'Failed to unlink account.');
      }
    } catch (err: any) {
      setError(err?.message || 'Network error unlinking Telegram.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/60 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-[420px] bg-[#0B0D12] border border-slate-800/80 rounded-3xl shadow-2xl overflow-hidden flex flex-col">
        
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-2 text-slate-500 hover:text-slate-300 rounded-full hover:bg-slate-800/50 transition-colors cursor-pointer z-10"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="px-8 pt-10 pb-6 flex flex-col items-center text-center">
          <div className="w-14 h-14 bg-[#2AABEE]/10 rounded-full flex items-center justify-center mb-5 border border-[#2AABEE]/20">
            <Send className="w-6 h-6 text-[#2AABEE] translate-x-[-1px] translate-y-[1px]" />
          </div>
          <h2 className="text-xl font-semibold text-white tracking-tight mb-2">Connect Telegram</h2>
          <p className="text-[15px] text-slate-400 leading-relaxed max-w-[280px]">
            Link your account to receive books instantly in your chat.
          </p>
        </div>

        {book && (
          <div className="px-8 pb-6">
            <div className="flex items-center gap-3 p-3.5 rounded-2xl bg-slate-900/50 border border-slate-800/50">
               <div className="w-8 h-10 bg-slate-800 rounded flex items-center justify-center text-[10px] font-bold text-slate-400 shrink-0 uppercase tracking-wider">
                 PDF
               </div>
               <div className="flex-1 min-w-0">
                 <div className="text-[14px] font-medium text-white truncate">{book.title}</div>
                 <div className="text-[13px] text-slate-500 truncate">{book.author}</div>
               </div>
               <div className="text-[11px] font-medium text-[#2AABEE] bg-[#2AABEE]/10 px-2.5 py-1 rounded-full whitespace-nowrap">
                 Ready
               </div>
            </div>
          </div>
        )}

        <div className="px-8 pb-8 space-y-7">
          {successMsg ? (
            <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl flex flex-col items-center text-center gap-2 text-emerald-400 animate-fade-in">
              <CheckCircle2 className="w-6 h-6" />
              <p className="text-[15px] font-medium">{successMsg}</p>
            </div>
          ) : (
            <>
              <div className="space-y-4">
                <button
                  type="button"
                  onClick={handleOpenTelegram}
                  className="w-full h-12 bg-[#2AABEE] hover:bg-[#229ED9] text-white font-medium text-[15px] rounded-xl flex items-center justify-center gap-2 transition-colors cursor-pointer shadow-lg shadow-[#2AABEE]/20"
                >
                  <Send className="w-4 h-4" />
                  <span>Open in Telegram</span>
                </button>

                {hasOpenedLink ? (
                   <div className="flex items-center justify-center gap-2 text-[14px] text-[#2AABEE] animate-pulse">
                     <div className="w-1.5 h-1.5 rounded-full bg-[#2AABEE]" />
                     <span>Waiting for connection...</span>
                   </div>
                ) : (
                   <p className="text-[13px] text-slate-500 text-center">
                     Tap <strong className="text-slate-300 font-medium">Start</strong> when the app opens to complete linking.
                   </p>
                )}
              </div>

              <div className="h-px w-full bg-slate-800/80" />

              <div className="space-y-4">
                {pairingCode && (
                  <div className="flex items-center justify-between text-[14px]">
                    <span className="text-slate-400">Pairing Code</span>
                    <button 
                       type="button"
                       onClick={handleCopyCode}
                       className="flex items-center gap-2 text-slate-300 hover:text-white transition-colors group cursor-pointer"
                    >
                       <span className="font-mono bg-slate-800/50 group-hover:bg-slate-800 px-2 py-0.5 rounded text-slate-200 tracking-wider">{pairingCode}</span>
                       {copiedCode ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4 text-slate-500 group-hover:text-slate-400" />}
                    </button>
                  </div>
                )}

                <form onSubmit={handleManualSubmit} className="flex gap-2">
                   <input
                      type="text"
                      placeholder="Or enter Chat ID..."
                      value={manualId}
                      onChange={(e) => setManualId(e.target.value)}
                      className="flex-1 h-11 bg-slate-900/50 border border-slate-800 rounded-xl px-4 text-[14px] text-white placeholder:text-slate-600 focus:outline-none focus:border-slate-700 transition-colors"
                   />
                   <button
                      type="submit"
                      disabled={loading || !manualId.trim()}
                      className="px-4 h-11 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-white text-[14px] font-medium rounded-xl transition-colors shrink-0 cursor-pointer"
                   >
                     Link
                   </button>
                </form>
                {error && <p className="text-red-400 text-[13px] text-center">{error}</p>}
              </div>
              
              {(telegramChatId || manualId) && (
                <div className="pt-2 text-center">
                  <button onClick={handleUnlink} disabled={loading} className="text-[13px] text-red-400/80 hover:text-red-400 transition-colors cursor-pointer">
                    Unlink current account
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
