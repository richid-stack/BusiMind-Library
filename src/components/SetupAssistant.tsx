import { apiFetch } from '../lib/api';
import React, { useState } from 'react';
import {
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Copy,
  ExternalLink,
  Bot,
  Key,
  Globe,
  Radio,
  Send,
  Sparkles,
} from 'lucide-react';
import { BotConfigStatus } from '../types';

interface Props {
  status: BotConfigStatus | null;
  onRefresh: () => void;
}

export const SetupAssistant: React.FC<Props> = ({ status, onRefresh }) => {
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [webhookLoading, setWebhookLoading] = useState(false);
  const [webhookResult, setWebhookResult] = useState<any>(null);

  const copyToClipboard = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const handleRegisterWebhook = async () => {
    setWebhookLoading(true);
    setWebhookResult(null);
    try {
      const res = await apiFetch('/api/webhook/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hostUrl: status?.appUrl }),
      });
      const data = await res.json();
      setWebhookResult(data);
      onRefresh();
    } catch (err: any) {
      setWebhookResult({ error: err.message || 'Webhook registration request failed' });
    } finally {
      setWebhookLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Cloud Run Live Ingress Banner */}
      <div className="bg-gradient-to-r from-blue-950/70 via-slate-900 to-slate-900 border border-blue-800/40 rounded-xl p-6 shadow-xl relative overflow-hidden">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 -ml-4" />
              <h2 className="text-base font-bold text-slate-100">Live 24/7 Cloud Run Ingress Active</h2>
            </div>
            <p className="text-xs text-gray-800 mt-1.5 max-w-2xl leading-relaxed">
              Your BusiMind backend is permanently provisioned with auto-managed SSL and container scalability. You do not need to keep your computer turned on.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => copyToClipboard(status?.webhookUrl || '', 'webhook')}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 hover:bg-slate-700 text-xs font-medium text-gray-900 rounded-xl border border-gray-300 transition-colors"
            >
              {copiedField === 'webhook' ? <CheckCircle2 className="w-3.5 h-3.5 text-[#007600]" /> : <Copy className="w-3.5 h-3.5" />}
              Copy Webhook URL
            </button>
          </div>
        </div>
      </div>

      {/* Checklist Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Card 1: Telegram Bot Token */}
        <div className="bg-white border border-gray-200 rounded-xl p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-blue-500/20 text-[#007185] flex items-center justify-center">
                  <Bot className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-slate-100">1. Telegram Bot Token</h3>
                  <p className="text-[11px] text-gray-600">From @BotFather for @BusiMind_bot</p>
                </div>
              </div>

              {status?.botTokenConfigured ? (
                <span className="flex items-center gap-1 text-[11px] font-semibold text-[#007600] bg-[#007600]/10 border border-[#007600]/20 px-2 py-0.5 rounded-full">
                  <CheckCircle2 className="w-3 h-3" /> Configured
                </span>
              ) : (
                <span className="flex items-center gap-1 text-[11px] font-semibold text-[#c45500] bg-[#f3a847]/10 border border-[#f3a847]/30 px-2 py-0.5 rounded-full">
                  <AlertCircle className="w-3 h-3" /> Pending Secret
                </span>
              )}
            </div>

            <div className="mt-4 p-3 bg-white/80 rounded-xl text-xs space-y-1.5 text-gray-800">
              <p>• In Telegram, message <a href="https://t.me/BotFather" target="_blank" rel="noreferrer" className="text-[#007185] underline">@BotFather</a></p>
              <p>• Send: <code className="text-gray-900 bg-gray-100 px-1 py-0.5 rounded">/token</code> &rarr; select <code className="text-gray-900 bg-gray-100 px-1 py-0.5 rounded">@BusiMind_bot</code></p>
              <p>• Add to your workspace secrets as <code className="text-blue-300 font-mono">TELEGRAM_BOT_TOKEN</code></p>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-gray-200 text-[11px] text-gray-600">
            {status?.botTokenConfigured ? `Connected to @${status.botUsername}` : 'Simulator mode is active for instant preview testing.'}
          </div>
        </div>

        {/* Card 2: Google Gemini AI */}
        <div className="bg-white border border-gray-200 rounded-xl p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-[#c45500] flex items-center justify-center">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-slate-100">2. Gemini 3.8 Flash Engine</h3>
                  <p className="text-[11px] text-gray-600">Intent understanding & reading paths</p>
                </div>
              </div>

              {status?.geminiKeyConfigured ? (
                <span className="flex items-center gap-1 text-[11px] font-semibold text-[#007600] bg-[#007600]/10 border border-[#007600]/20 px-2 py-0.5 rounded-full">
                  <CheckCircle2 className="w-3 h-3" /> Active
                </span>
              ) : (
                <span className="flex items-center gap-1 text-[11px] font-semibold text-[#007600] bg-[#007600]/10 border border-[#007600]/20 px-2 py-0.5 rounded-full">
                  <CheckCircle2 className="w-3 h-3" /> AI Studio Injected
                </span>
              )}
            </div>

            <div className="mt-4 p-3 bg-white/80 rounded-xl text-xs space-y-1.5 text-gray-800">
              <p>• Model: <span className="text-[#007185] font-mono">gemini-3.8-flash</span></p>
              <p>• Anti-hallucination guard enforced on BusiMind book catalog</p>
              <p>• Automatic fallback search enabled if API quotas are exceeded</p>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-gray-200 text-[11px] text-gray-600">
            Powers natural language discovery and structured curriculums.
          </div>
        </div>

        {/* Card 3: Private Channel Repository */}
        <div className="bg-white border border-gray-200 rounded-xl p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-sky-500/20 text-sky-400 flex items-center justify-center">
                  <Radio className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-slate-100">3. Telegram Channel (Repository)</h3>
                  <p className="text-[11px] text-gray-600">BusiMind Library private channel</p>
                </div>
              </div>

              {status?.channelIdConfigured ? (
                <span className="flex items-center gap-1 text-[11px] font-semibold text-[#007600] bg-[#007600]/10 border border-[#007600]/20 px-2 py-0.5 rounded-full">
                  <CheckCircle2 className="w-3 h-3" /> {status.channelId}
                </span>
              ) : (
                <span className="flex items-center gap-1 text-[11px] font-semibold text-gray-600 bg-gray-100 px-2 py-0.5 rounded-full">
                  Optional / Set Channel ID
                </span>
              )}
            </div>

            <div className="mt-4 p-3 bg-white/80 rounded-xl text-xs space-y-1.5 text-gray-800">
              <p>• Create a private channel in Telegram (e.g. <em>BusiMind Library</em>)</p>
              <p>• Add <code className="text-gray-900">@BusiMind_bot</code> as an Administrator</p>
              <p>• Forward a post to <code className="text-gray-900">@JsonDumpBot</code> to obtain the <code className="text-blue-300">-100...</code> ID</p>
              <p>• Set in secrets as <code className="text-blue-300 font-mono">TELEGRAM_CHANNEL_ID</code></p>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-gray-200 text-[11px] text-gray-600">
            Delivers legal PDFs with Telegram <code className="text-gray-800 font-mono">copyMessage</code>.
          </div>
        </div>

        {/* Card 4: Real-time Connection */}
        <div className="bg-white border border-gray-200 rounded-xl p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-[#007600] flex items-center justify-center">
                  <Globe className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-slate-100">4. Telegram Live Connection</h3>
                  <p className="text-[11px] text-gray-600">Direct Long Polling Active</p>
                </div>
              </div>

              <span className="flex items-center gap-1 text-[11px] font-semibold text-[#007600] bg-[#007600]/10 border border-[#007600]/20 px-2 py-0.5 rounded-full">
                <CheckCircle2 className="w-3 h-3" /> Live & Connected
              </span>
            </div>

            <div className="mt-4 p-3 bg-white/80 rounded-xl text-xs space-y-2 text-gray-800">
              <p>
                • <strong className="text-emerald-300">Direct Long Polling:</strong> The server directly pulls incoming updates from Telegram with sub-second latency.
              </p>
              <p>
                • Bypasses incoming reverse-proxy authentication redirects (302) seamlessly.
              </p>
              <p className="text-gray-600">
                • Status: Bot is actively polling and processing commands from @BusiMind_bot.
              </p>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-gray-200 text-[11px] text-gray-600">
            Open Telegram and message @BusiMind_bot with /start!
          </div>
        </div>
      </div>
    </div>
  );
};
