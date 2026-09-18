import React, { useState, useEffect } from 'react';
import { Send, SkipForward, CheckCircle2, ArrowRight } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { apiFetch } from '../lib/api';

interface Props {
  onSkip: () => void;
}

export const TelegramOnboarding: React.FC<Props> = ({ onSkip }) => {
  const { user, isNewUser, clearIsNewUser } = useAuth();
  
  // If isNewUser is true, start at step 1 (Welcome). Else start at step 2 (Telegram).
  const [step, setStep] = useState<'welcome' | 'telegram'>(isNewUser ? 'welcome' : 'telegram');
  
  const [manualId, setManualId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [openedBot, setOpenedBot] = useState(false);

  // Clear isNewUser flag once we've successfully shown the welcome step
  useEffect(() => {
    if (isNewUser) {
      clearIsNewUser();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleLink = () => {
    if (user) {
      setOpenedBot(true);
      window.open(`https://t.me/BusiMind_bot?start=link_${user.uid}`, '_blank');
    }
  };

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanId = manualId.trim().replace(/^@/, '');
    if (!cleanId || !user) return;

    setLoading(true);
    setError(null);

    try {
      const res = await apiFetch('/api/user/link-telegram', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          uid: user.uid,
          telegramChatId: cleanId,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.error || 'Failed to link Chat ID. Please verify and retry.');
      }
      // If success, AuthContext snapshot will update and automatically unmount this component
    } catch (err: any) {
      setError(err?.message || 'Connection error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0B0D12] flex flex-col items-center justify-center p-4 sm:p-6">
      <div className="w-full max-w-[420px] bg-[#0B0D12] rounded-3xl border border-slate-800/80 shadow-2xl overflow-hidden flex flex-col animate-fade-in">
        
        {step === 'welcome' && (
          <div className="px-8 pt-12 pb-10 flex flex-col items-center text-center">
            <div className="w-16 h-16 bg-emerald-500/10 rounded-full flex items-center justify-center mb-6 border border-emerald-500/20">
              <CheckCircle2 className="w-7 h-7 text-emerald-400" />
            </div>
            
            <h2 className="text-2xl font-semibold text-white tracking-tight mb-3">Account Created</h2>
            <p className="text-[15px] text-slate-400 leading-relaxed max-w-[280px] mb-10">
              Welcome to BusiMind. Your professional library and research workspace is ready.
            </p>

            <button
              onClick={() => setStep('telegram')}
              className="w-full h-12 bg-white hover:bg-slate-100 text-slate-900 font-medium text-[15px] rounded-xl flex items-center justify-center gap-2 transition-colors cursor-pointer"
            >
              <span>Continue Setup</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}

        {step === 'telegram' && (
          <>
            <div className="px-8 pt-10 pb-6 flex flex-col items-center text-center">
              <div className="w-14 h-14 bg-[#2AABEE]/10 rounded-full flex items-center justify-center mb-5 border border-[#2AABEE]/20">
                <Send className="w-6 h-6 text-[#2AABEE] translate-x-[-1px] translate-y-[1px]" />
              </div>
              <h2 className="text-xl font-semibold text-white tracking-tight mb-2">Connect Telegram</h2>
              <p className="text-[15px] text-slate-400 leading-relaxed max-w-[280px]">
                Deliver books instantly to your phone or desktop reader.
              </p>
            </div>

            <div className="px-8 pb-8 space-y-7">
              <div className="space-y-4">
                <button
                  type="button"
                  onClick={handleLink}
                  className="w-full h-12 bg-[#2AABEE] hover:bg-[#229ED9] text-white font-medium text-[15px] rounded-xl flex items-center justify-center gap-2 transition-colors cursor-pointer shadow-lg shadow-[#2AABEE]/20"
                >
                  <Send className="w-4 h-4" />
                  <span>Open in Telegram</span>
                </button>

                {openedBot ? (
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

              <div className="pt-2 text-center">
                <button
                  onClick={onSkip}
                  className="w-full h-11 bg-transparent hover:bg-white/5 text-slate-400 hover:text-white font-medium rounded-xl transition-colors flex items-center justify-center gap-2 text-[14px] cursor-pointer"
                >
                  <span>Skip for now</span>
                  <SkipForward className="w-4 h-4 opacity-70" />
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
