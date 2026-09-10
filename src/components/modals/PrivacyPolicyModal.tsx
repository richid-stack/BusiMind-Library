import React from 'react';
import { X, ShieldCheck, Lock, EyeOff, Server, FileText } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export const PrivacyPolicyModal: React.FC<Props> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/75 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white text-[#0f1111] rounded-xl shadow-2xl border border-gray-200 max-w-2xl w-full max-h-[88vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="bg-[#131921] text-white px-6 py-4 flex items-center justify-between border-b border-white/10">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-[#f3a847]/20 border border-[#f3a847]/30 text-[#f3a847]">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-bold text-lg leading-tight">BusiMind Library Privacy Policy</h2>
              <p className="text-xs text-gray-300">Last updated: September 2026 • Version 2.4</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="p-6 overflow-y-auto space-y-6 text-sm text-gray-700 leading-relaxed custom-scrollbar">
          <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-lg flex items-start gap-3">
            <Lock className="w-5 h-5 text-emerald-700 shrink-0 mt-0.5" />
            <p className="text-xs text-emerald-900 leading-snug">
              <strong>Zero Commercial Tracking:</strong> BusiMind Library is strictly a digital academic and financial research resource. We do not sell user data, run advertising networks, or deploy third-party telemetry scripts.
            </p>
          </div>

          <section className="space-y-2">
            <h3 className="font-bold text-base text-[#0f1111] flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#f3a847]" />
              1. Information We Collect
            </h3>
            <p>
              When using BusiMind Library in web or Telegram Mini App mode, we collect the minimal data necessary to fulfill business knowledge requests:
            </p>
            <ul className="list-disc pl-5 space-y-1.5 text-xs text-gray-600">
              <li><strong>Telegram Identifiers:</strong> Your Telegram User ID or Chat ID is used strictly to deliver requested books, academic papers, and financial alerts directly to your personal messaging client.</li>
              <li><strong>Local Reading Preferences:</strong> Preferences such as chosen reading font size, theme mode (Sepia, Midnight, Pearl), and paper-trading portfolio allocations are stored locally on your device in browser local storage.</li>
              <li><strong>Analytical Queries:</strong> Search queries submitted to the financial terminal or academic paper resolver are processed to surface relevant literature.</li>
            </ul>
          </section>

          <section className="space-y-2">
            <h3 className="font-bold text-base text-[#0f1111] flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#f3a847]" />
              2. Telegram Integration & Delivery Lifecycle
            </h3>
            <p>
              When you choose to deliver literature to Telegram:
            </p>
            <ul className="list-disc pl-5 space-y-1.5 text-xs text-gray-600">
              <li>Deliveries are transmitted securely via Telegram Bot API Webhooks.</li>
              <li>In accordance with channel hygiene protocols, ephemeral delivery files in private channels undergo automated clean-up to prevent storage leakage.</li>
              <li>We never access, read, or inspect your personal Telegram messages, contact lists, or private chats outside of commands explicitly sent to the BusiMind Bot.</li>
            </ul>
          </section>

          <section className="space-y-2">
            <h3 className="font-bold text-base text-[#0f1111] flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#f3a847]" />
              3. Financial Models & Paper Trading Security
            </h3>
            <p>
              The Valuation Lab, DCF simulations, GSE & US equity comparisons, and portfolio stress tests are educational paper-trading sandboxes:
            </p>
            <ul className="list-disc pl-5 space-y-1.5 text-xs text-gray-600">
              <li>No real brokerage credentials, bank account tokens, or financial identity details are ever requested or stored.</li>
              <li>Calculations run directly on client sessions with real-time public market rates (Bank of Ghana MPR, GSE market data, SEC EDGAR filings).</li>
            </ul>
          </section>

          <section className="space-y-2">
            <h3 className="font-bold text-base text-[#0f1111] flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#f3a847]" />
              4. Data Deletion & Reader Rights
            </h3>
            <p>
              You maintain sovereign ownership of your reading data. You can clear your client-side reading list, journal entries, and simulation history at any time by clearing your browser cache or sending <code className="bg-gray-100 px-1 py-0.5 rounded text-xs">/reset</code> to the Telegram bot.
            </p>
          </section>
        </div>

        {/* Footer */}
        <div className="bg-gray-50 px-6 py-3.5 border-t border-gray-200 flex items-center justify-between">
          <span className="text-xs text-gray-500">BusiMind Library Privacy Protocol</span>
          <button
            onClick={onClose}
            className="bg-[#131921] hover:bg-[#232f3e] text-white px-4 py-2 rounded-md font-medium text-xs transition-colors shadow-sm"
          >
            I Understand
          </button>
        </div>
      </div>
    </div>
  );
};
