import React from 'react';
import { X, Scale, AlertTriangle, BookOpen, CheckCircle } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export const TermsOfServiceModal: React.FC<Props> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/75 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white text-[#0f1111] rounded-xl shadow-2xl border border-gray-200 max-w-2xl w-full max-h-[88vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="bg-[#131921] text-white px-6 py-4 flex items-center justify-between border-b border-white/10">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-[#f3a847]/20 border border-[#f3a847]/30 text-[#f3a847]">
              <Scale className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-bold text-lg leading-tight">BusiMind Library Terms of Service</h2>
              <p className="text-xs text-gray-300">Effective: September 2026</p>
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
          <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
            <p className="text-xs text-amber-900 leading-snug">
              <strong>Educational & Analytical Resource:</strong> All financial valuations, DCF spreadsheets, Bank of Ghana rate sensitivity simulations, and academic summaries provided on BusiMind Library are for intellectual inquiry, scholarship, and educational paper-trading purposes only. Nothing herein constitutes investment, legal, or fiscal advice.
            </p>
          </div>

          <section className="space-y-2">
            <h3 className="font-bold text-base text-[#0f1111] flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#f3a847]" />
              1. Acceptance of Terms
            </h3>
            <p>
              By accessing the BusiMind Library website, using our Telegram Mini App, or initiating book deliveries through the BusiMind Bot, you agree to comply with and be bound by these institutional Terms of Service.
            </p>
          </section>

          <section className="space-y-2">
            <h3 className="font-bold text-base text-[#0f1111] flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#f3a847]" />
              2. Intellectual Property & Fair Use
            </h3>
            <p>
              BusiMind Library curates business, economic, and strategic management literature to advance executive literacy and academic rigor:
            </p>
            <ul className="list-disc pl-5 space-y-1.5 text-xs text-gray-600">
              <li>Book summaries, mental model extractions, and core takeaways are original derivative educational analyses produced for research and personal study under international Fair Use doctrines.</li>
              <li>Academic working papers sourced via DOI, arXiv, and Semantic Scholar are indexed according to open-access pre-print licenses and academic citation protocols.</li>
              <li>Trademarks, corporate titles, and author rights belong strictly to their respective copyright holders.</li>
            </ul>
          </section>

          <section className="space-y-2">
            <h3 className="font-bold text-base text-[#0f1111] flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#f3a847]" />
              3. Permitted & Prohibited Conduct
            </h3>
            <p>
              Users agree to access the library responsibly:
            </p>
            <ul className="list-disc pl-5 space-y-1.5 text-xs text-gray-600">
              <li>You may read literature in-browser, save reading paths, and send reading materials to your personal Telegram client for individual enrichment.</li>
              <li>You may not run automated scraping bots to DDOS the indexing servers or bypass security rate-limits.</li>
              <li>Administrative ingestion interfaces, webhook configurations, and database credentials are reserved exclusively for authorized library curators.</li>
            </ul>
          </section>

          <section className="space-y-2">
            <h3 className="font-bold text-base text-[#0f1111] flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#f3a847]" />
              4. Disclaimer of Warranties & Limitation of Liability
            </h3>
            <p>
              The library is provided on an &quot;as-is&quot; and &quot;as-available&quot; basis. BusiMind Library makes no guarantees regarding uninterrupted availability or 100% real-time accuracy of secondary financial data feeds. In no event shall BusiMind Library or its operators be liable for financial decisions made using the valuation terminal.
            </p>
          </section>
        </div>

        {/* Footer */}
        <div className="bg-gray-50 px-6 py-3.5 border-t border-gray-200 flex items-center justify-between">
          <span className="text-xs text-gray-500">Institutional Terms • BusiMind Library</span>
          <button
            onClick={onClose}
            className="bg-[#131921] hover:bg-[#232f3e] text-white px-4 py-2 rounded-md font-medium text-xs transition-colors shadow-sm"
          >
            Agree & Continue
          </button>
        </div>
      </div>
    </div>
  );
};
