import React from 'react';
import {
  X,
  BookOpen,
  LineChart,
  GraduationCap,
  PieChart,
  TrendingUp,
  Terminal,
  Settings,
  ShieldCheck,
  Scale,
  HelpCircle,
  BookPlus,
  Lock,
  LogOut,
  Send,
  ExternalLink,
  ChevronRight,
  ShieldAlert,
} from 'lucide-react';

import { BusiMindLogo } from '../BusiMindLogo';
import { useAuth } from '../../context/AuthContext';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  activeTab: string;
  onSelectTab: (tab: any) => void;
  isAdmin: boolean;
  onOpenAdminAuth: () => void;
  onAdminSignOut: () => void;
  onOpenPrivacy: () => void;
  onOpenTerms: () => void;
  onOpenFaq: () => void;
  onOpenBookRequest: () => void;
  bookCount: number;
}

export const MobileDrawer: React.FC<Props> = ({
  isOpen,
  onClose,
  activeTab,
  onSelectTab,
  isAdmin,
  onOpenAdminAuth,
  onAdminSignOut,
  onOpenPrivacy,
  onOpenTerms,
  onOpenFaq,
  onOpenBookRequest,
  bookCount,
}) => {
  const { user, telegramChatId } = useAuth();
  
  if (!isOpen) return null;

  const handleNav = (tab: string) => {
    onSelectTab(tab);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex animate-fadeIn">
      {/* Backdrop */}
      <div
        onClick={onClose}
        className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity"
      />

      {/* Drawer Panel */}
      <div className="relative w-4/5 max-w-sm bg-white h-full shadow-2xl flex flex-col z-10 text-[#0f1111] animate-slideRight">
        {/* Drawer Header */}
        <div className="bg-[#131921] text-white p-4 flex items-center justify-between border-b border-white/10">
          <div className="flex items-center gap-2.5">
            <BusiMindLogo className="w-8 h-8 text-[#f3a847]" />
            <div className="flex flex-col justify-center">
              <h2 className="font-bold text-lg leading-none tracking-tight">BusiMind Library</h2>
              <p className="text-[11px] text-gray-300 mt-1 font-medium">
                Curated Business & Financial Literature
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-md text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Drawer Body */}
        <div className="flex-1 overflow-y-auto divide-y divide-gray-100 custom-scrollbar">
          {/* Main Sections */}
          <div className="py-2">
            <div className="px-4 py-2 text-xs font-bold uppercase tracking-wider text-gray-500">
              Library & Analysis
            </div>
            <button
              onClick={() => handleNav('catalog')}
              className={`w-full flex items-center justify-between px-4 py-3 text-sm font-semibold transition-colors ${
                activeTab === 'catalog'
                  ? 'bg-amber-50 text-[#c45500] font-bold border-l-4 border-[#f3a847]'
                  : 'text-gray-800 hover:bg-gray-50 border-l-4 border-transparent'
              }`}
            >
              <div className="flex items-center gap-3">
                <BookOpen className="w-5 h-5 text-[#f3a847]" />
                <span>{isAdmin ? 'Executive Bookstore' : 'BusiMind Library'}</span>
              </div>
              {isAdmin && (
                <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded font-mono">
                  {bookCount}
                </span>
              )}
            </button>

            {isAdmin && (
              <>
                <button
                  onClick={() => handleNav('valuation')}
                  className={`w-full flex items-center justify-between px-4 py-3 text-sm font-semibold transition-colors ${
                    activeTab === 'valuation'
                      ? 'bg-amber-50 text-[#c45500] font-bold border-l-4 border-[#f3a847]'
                      : 'text-gray-800 hover:bg-gray-50 border-l-4 border-transparent'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <LineChart className="w-5 h-5 text-[#007600]" />
                    <span>Financial Terminal (DCF)</span>
                  </div>
                  <ChevronRight className="w-4 h-4 text-gray-400" />
                </button>

                <button
                  onClick={() => handleNav('research')}
                  className={`w-full flex items-center justify-between px-4 py-3 text-sm font-semibold transition-colors ${
                    activeTab === 'research'
                      ? 'bg-amber-50 text-[#c45500] font-bold border-l-4 border-[#f3a847]'
                      : 'text-gray-800 hover:bg-gray-50 border-l-4 border-transparent'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <GraduationCap className="w-5 h-5 text-indigo-600" />
                    <span>Academic Research (DOI)</span>
                  </div>
                  <ChevronRight className="w-4 h-4 text-gray-400" />
                </button>

                <button
                  onClick={() => handleNav('analytics')}
                  className={`w-full flex items-center justify-between px-4 py-3 text-sm font-semibold transition-colors ${
                    activeTab === 'analytics'
                      ? 'bg-amber-50 text-[#c45500] font-bold border-l-4 border-[#f3a847]'
                      : 'text-gray-800 hover:bg-gray-50 border-l-4 border-transparent'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <PieChart className="w-5 h-5 text-purple-600" />
                    <span>Portfolio & Stress Testing</span>
                  </div>
                  <ChevronRight className="w-4 h-4 text-gray-400" />
                </button>

                <button
                  onClick={() => handleNav('macro')}
                  className={`w-full flex items-center justify-between px-4 py-3 text-sm font-semibold transition-colors ${
                    activeTab === 'macro'
                      ? 'bg-amber-50 text-[#c45500] font-bold border-l-4 border-[#f3a847]'
                      : 'text-gray-800 hover:bg-gray-50 border-l-4 border-transparent'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <TrendingUp className="w-5 h-5 text-[#de7921]" />
                    <span>Macro & BoG Benchmarks</span>
                  </div>
                  <ChevronRight className="w-4 h-4 text-gray-400" />
                </button>
              </>
            )}
          </div>

          {/* Admin Tools (Curator Only) */}
          {isAdmin && (
            <div className="py-2 bg-amber-50/40">
              <div className="px-4 py-2 text-xs font-bold uppercase tracking-wider text-amber-900 flex items-center gap-1.5">
                <ShieldAlert className="w-3.5 h-3.5 text-amber-700" />
                Curator Suite
              </div>

              <button
                onClick={() => handleNav('setup')}
                className={`w-full flex items-center justify-between px-4 py-2.5 text-xs font-semibold transition-colors ${
                  activeTab === 'setup'
                    ? 'bg-amber-100 text-amber-900 font-bold border-l-4 border-[#de7921]'
                    : 'text-gray-800 hover:bg-amber-50'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Settings className="w-4 h-4 text-amber-700" />
                  <span>Channel Ingestion & Setup</span>
                </div>
                <ChevronRight className="w-3.5 h-3.5 text-gray-400" />
              </button>

              <button
                onClick={() => handleNav('simulator')}
                className={`w-full flex items-center justify-between px-4 py-2.5 text-xs font-semibold transition-colors ${
                  activeTab === 'simulator'
                    ? 'bg-amber-100 text-amber-900 font-bold border-l-4 border-[#de7921]'
                    : 'text-gray-800 hover:bg-amber-50'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Terminal className="w-4 h-4 text-amber-700" />
                  <span>Telegram Diagnostics & Simulator</span>
                </div>
                <ChevronRight className="w-3.5 h-3.5 text-gray-400" />
              </button>
            </div>
          )}

          {/* User Assistance & Community */}
          <div className="py-2">
            <div className="px-4 py-1.5 text-[11px] font-bold uppercase tracking-wider text-gray-400">
              Community & Support
            </div>

            <button
              onClick={() => {
                onClose();
                onOpenBookRequest();
              }}
              className="w-full flex items-center justify-between px-4 py-2.5 text-xs font-medium text-gray-800 hover:bg-gray-50"
            >
              <div className="flex items-center gap-3">
                <BookPlus className="w-4 h-4 text-[#007185]" />
                <span>Request a Book or Paper</span>
              </div>
              <ChevronRight className="w-3.5 h-3.5 text-gray-400" />
            </button>

            <button
              onClick={() => {
                onClose();
                onOpenFaq();
              }}
              className="w-full flex items-center justify-between px-4 py-2.5 text-xs font-medium text-gray-800 hover:bg-gray-50"
            >
              <div className="flex items-center gap-3">
                <HelpCircle className="w-4 h-4 text-gray-500" />
                <span>FAQs & Documentation</span>
              </div>
              <ChevronRight className="w-3.5 h-3.5 text-gray-400" />
            </button>

            <a
              href={telegramChatId ? "https://t.me/BusiMind_bot" : (user ? `https://t.me/BusiMind_bot?start=link_${user.uid}` : "https://t.me/BusiMind_bot")}
              target="_blank"
              rel="noreferrer"
              className="w-full flex items-center justify-between px-4 py-2.5 text-xs font-medium text-gray-800 hover:bg-gray-50"
            >
              <div className="flex items-center gap-3">
                <Send className="w-4 h-4 text-[#229ed9]" />
                <span>{telegramChatId ? 'Open Telegram Bot' : 'Link Telegram Account'} (@BusiMind_bot)</span>
              </div>
              <ExternalLink className="w-3.5 h-3.5 text-gray-400" />
            </a>
          </div>

          {/* Legal & Governance */}
          <div className="py-2">
            <div className="px-4 py-1.5 text-[11px] font-bold uppercase tracking-wider text-gray-400">
              Governance & Policies
            </div>

            <button
              onClick={() => {
                onClose();
                onOpenPrivacy();
              }}
              className="w-full flex items-center justify-between px-4 py-2.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
            >
              <div className="flex items-center gap-3">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                <span>Privacy Policy</span>
              </div>
              <ChevronRight className="w-3.5 h-3.5 text-gray-400" />
            </button>

            <button
              onClick={() => {
                onClose();
                onOpenTerms();
              }}
              className="w-full flex items-center justify-between px-4 py-2.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
            >
              <div className="flex items-center gap-3">
                <Scale className="w-4 h-4 text-blue-600" />
                <span>Terms of Service</span>
              </div>
              <ChevronRight className="w-3.5 h-3.5 text-gray-400" />
            </button>
          </div>
        </div>

        {/* Drawer Footer (Sign Out for all users) */}
        {user && (
          <div className="p-3 bg-gray-50 border-t border-gray-200">
            <button
              onClick={() => {
                onClose();
                onAdminSignOut();
              }}
              className="w-full py-2 px-3 rounded-md bg-red-50 hover:bg-red-100 text-red-700 text-xs font-bold flex items-center justify-center gap-2 border border-red-200 transition-colors"
            >
              <LogOut className="w-4 h-4" />
              Sign Out
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
