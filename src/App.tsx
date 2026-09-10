import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { BusiMindLogo } from './components/BusiMindLogo';
import {
  BookOpen,
  Settings,
  BarChart3,
  Search,
  Activity,
  ShieldCheck,
  ShoppingCart,
  MapPin,
  Menu,
  ChevronDown,
  User,
  LineChart,
  GraduationCap,
  PieChart,
  TrendingUp,
  Terminal,
  LogOut,
  Lock,
  Send,
  HelpCircle,
  Scale,
  Sparkles,
  BookPlus,
  Compass,
} from 'lucide-react';
import { TelegramSimulator } from './components/TelegramSimulator';
import { CatalogManager } from './components/CatalogManager';
import { SetupAssistant } from './components/SetupAssistant';
import { ValuationLab } from './components/ValuationLab';
import { AcademicLibraryView } from './components/AcademicLibraryView';
import { AnalyticsView } from './components/AnalyticsView';
import { MacroIntelligenceView } from './components/MacroIntelligenceView';
import { UniversalSearchBar } from './components/navigation/UniversalSearchBar';
import { MobileDrawer } from './components/navigation/MobileDrawer';
import { PrivacyPolicyModal } from './components/modals/PrivacyPolicyModal';
import { TermsOfServiceModal } from './components/modals/TermsOfServiceModal';
import { FaqModal } from './components/modals/FaqModal';
import { BookRequestModal } from './components/modals/BookRequestModal';
import { AdminAuthModal } from './components/modals/AdminAuthModal';
import { apiFetch } from './lib/api';
import { initTelegramWebApp, getTelegramUser } from './lib/telegram';
import { Book } from './types';

interface BotConfigStatus {
  botTokenConfigured: boolean;
  channelIdConfigured: boolean;
  botUsername?: string;
  channelId?: string;
  stats?: SystemStats;
}

interface SystemStats {
  totalBooks: number;
  totalModels: number;
  totalSubscribers: number;
  uptime: number;
}

export default function App() {
  const [activeTab, setActiveTab] = useState<'catalog' | 'valuation' | 'research' | 'analytics' | 'macro' | 'simulator' | 'setup'>('catalog');
  const [status, setStatus] = useState<BotConfigStatus | null>(null);
  const [stats, setStats] = useState<SystemStats | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isAuthChecking, setIsAuthChecking] = useState(true);
  const [catalogSearchQuery, setCatalogSearchQuery] = useState('');

  // Modals
  const [isPrivacyOpen, setIsPrivacyOpen] = useState(false);
  const [isTermsOpen, setIsTermsOpen] = useState(false);
  const [isFaqOpen, setIsFaqOpen] = useState(false);
  const [isBookRequestOpen, setIsBookRequestOpen] = useState(false);
  const [isAdminAuthOpen, setIsAdminAuthOpen] = useState(false);
  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState(false);

  // Initialize Telegram WebApp SDK if running inside Telegram
  useEffect(() => {
    initTelegramWebApp();
  }, []);

  // Secret Admin access via URL query (?admin=true) or keyboard shortcut (Ctrl+Shift+A)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('admin') === 'true' || params.get('portal') === 'admin' || params.get('curator') === 'true') {
      setIsAdminAuthOpen(true);
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'A' || e.key === 'a')) {
        e.preventDefault();
        setIsAdminAuthOpen(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Check admin access
  const verifyAdminAuth = async () => {
    const savedPassword = localStorage.getItem('WEB_ADMIN_PASSWORD');
    if (!savedPassword) {
      setIsAdmin(false);
      setIsAuthChecking(false);
      return;
    }

    try {
      const res = await apiFetch('/api/auth/verify', { method: 'POST' });
      if (res.ok) {
        setIsAdmin(true);
      } else {
        setIsAdmin(false);
        localStorage.removeItem('WEB_ADMIN_PASSWORD');
      }
    } catch {
      setIsAdmin(false);
    } finally {
      setIsAuthChecking(false);
    }
  };

  useEffect(() => {
    verifyAdminAuth();
  }, []);

  // Fetch metadata status
  const fetchStatus = async () => {
    try {
      const endpoint = isAdmin ? '/api/status' : '/api/status/public';
      const res = await apiFetch(endpoint);
      if (res.ok) {
        const data = await res.json();
        setStatus(data);
        if (data.stats) {
          setStats(data.stats);
        } else if (data.totalBooks !== undefined) {
          setStats((prev) => ({
            totalBooks: data.totalBooks,
            repositoryBooksCount: data.totalBooks,
            externalOnlyBooksCount: 0,
            totalSearches: prev?.totalSearches || 0,
            totalReadingListItems: prev?.totalReadingListItems || 0,
            totalBookRequests: prev?.totalBookRequests || 0,
            pendingBookRequests: prev?.pendingBookRequests || 0,
            categoriesCount: prev?.categoriesCount || {},
            recentSearches: prev?.recentSearches || [],
          }));
        }
      }
    } catch (err) {
      console.warn('Status fetch error:', err);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, [isAdmin]);

  const handleAdminSignOut = () => {
    localStorage.removeItem('WEB_ADMIN_PASSWORD');
    setIsAdmin(false);
    if (activeTab === 'setup' || activeTab === 'simulator') {
      setActiveTab('catalog');
    }
  };

  const handleAdminLoginSuccess = () => {
    setIsAdmin(true);
    fetchStatus();
  };

  const handleTabSelect = (tab: typeof activeTab) => {
    // If not admin and trying to access admin tabs, redirect to catalog
    if (!isAdmin && (tab === 'setup' || tab === 'simulator')) {
      setIsAdminAuthOpen(true);
      return;
    }
    setActiveTab(tab);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const tgUser = getTelegramUser();

  return (
    <div className="min-h-screen bg-[#eaeded] text-[#0f1111] flex flex-col font-sans selection:bg-[#f3a847]/30">
      {/* 1. TOP HEADER NAVIGATION BAR (Amazon/Kindle Craft) */}
      <header className="bg-[#131921] text-white flex flex-col z-40 sticky top-0 shadow-md">
        <div className="flex items-center px-3 sm:px-4 py-2 gap-2 sm:gap-4">
          {/* Logo */}
          <div
            onClick={() => handleTabSelect('catalog')}
            className="flex items-center gap-2 cursor-pointer border border-transparent hover:border-white/40 p-1.5 rounded-sm transition-all shrink-0"
          >
            <BusiMindLogo className="w-8 h-8 text-white" />
            <div className="flex flex-col justify-center">
              <span className="text-xl sm:text-2xl font-bold tracking-tight leading-none">BusiMind</span>
              <span className="text-[12px] sm:text-sm text-[#f3a847] font-bold tracking-wide mt-0.5">
                Library
              </span>
            </div>
          </div>

          {/* Delivery Location (Desktop) */}
          <div
            onClick={() => window.open('https://t.me/BusiMind_bot', '_blank')}
            className="hidden lg:flex items-center gap-1.5 cursor-pointer border border-transparent hover:border-white/40 p-2 rounded-sm transition-all shrink-0"
          >
            <MapPin className="w-5 h-5 text-white mt-1" />
            <div className="flex flex-col text-white leading-tight">
              <span className="text-xs text-gray-300">
                {tgUser ? `Deliver to ${tgUser.first_name}` : 'Deliver to'}
              </span>
              <span className="text-sm font-bold flex items-center gap-1">
                Telegram Library <ChevronDown className="w-4 h-4 text-gray-300" />
              </span>
            </div>
          </div>

          {/* Universal Search Bar */}
          <div className="flex-1 min-w-0">
            <UniversalSearchBar
              onNavigateTab={handleTabSelect}
              onCatalogSearchChange={setCatalogSearchQuery}
            />
          </div>

          {/* Right Navigation (Public: Wishlist, Telegram, Help / Admin: Curator Exit) */}
          <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
            <div
              onClick={() => setIsBookRequestOpen(true)}
              className="hidden sm:flex flex-col cursor-pointer border border-transparent hover:border-white/40 p-1.5 rounded-sm transition-all"
            >
              <span className="text-xs text-gray-300">Request</span>
              <span className="text-sm font-bold leading-tight flex items-center gap-1">
                Missing Book <BookPlus className="w-4 h-4 text-[#f3a847]" />
              </span>
            </div>

            <a
              href="https://t.me/BusiMind_bot"
              target="_blank"
              rel="noreferrer"
              className="hidden md:flex flex-col cursor-pointer border border-transparent hover:border-white/40 p-1.5 rounded-sm transition-all"
            >
              <span className="text-xs text-gray-300">Telegram Bot</span>
              <span className="text-sm font-bold leading-tight flex items-center gap-1 text-[#229ed9]">
                @BusiMind_bot
              </span>
            </a>

            <div
              onClick={() => setIsFaqOpen(true)}
              className="flex items-center gap-1.5 cursor-pointer border border-transparent hover:border-white/40 p-2 rounded-sm transition-all"
            >
              <HelpCircle className="w-5 h-5 text-gray-300" />
              <span className="text-sm font-bold hidden md:inline-block leading-tight">Help</span>
            </div>

            {/* Admin Curator Badge & Exit (ONLY rendered when already authenticated) */}
            {isAdmin && (
              <div className="flex items-center gap-1.5 ml-1 border-l border-white/20 pl-2">
                <div className="hidden sm:flex items-center gap-1 bg-[#ffd814]/15 border border-[#ffd814]/40 text-[#ffd814] px-2.5 py-1 rounded-full text-xs font-bold">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>Curator</span>
                </div>
                <button
                  onClick={handleAdminSignOut}
                  title="Exit Curator Mode"
                  className="p-1.5 text-gray-300 hover:text-rose-300 hover:bg-white/10 rounded transition-colors text-xs flex items-center gap-1"
                >
                  <LogOut className="w-4 h-4 text-rose-400" />
                  <span className="hidden xl:inline text-xs">Exit</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* 2. SUB-NAVIGATION BAR (Amazon Department Style) */}
        <div className="bg-[#232f3e] px-4 py-2 flex items-center gap-3 sm:gap-6 text-sm font-medium overflow-x-auto custom-scrollbar shadow-inner">
          <button
            onClick={() => setIsMobileDrawerOpen(true)}
            className="flex items-center gap-1 border border-transparent hover:border-white px-2 py-1 rounded-sm shrink-0 text-white font-bold"
          >
            <Menu className="w-5 h-5" /> All
          </button>

          <button
            onClick={() => handleTabSelect('catalog')}
            className={`border border-transparent hover:border-white px-2 py-1 rounded-sm shrink-0 flex items-center gap-1.5 transition-colors ${
              activeTab === 'catalog' ? 'text-[#f3a847] font-bold bg-white/10' : 'text-gray-200'
            }`}
          >
            <BookOpen className="w-4 h-4" />
            <span>Executive Bookstore</span>
            {(stats?.totalBooks || status?.totalBooks) ? (
              <span className="text-[10px] bg-[#f3a847] text-[#131921] px-1.5 py-0.5 rounded-full font-bold ml-0.5">
                {stats?.totalBooks || status?.totalBooks}
              </span>
            ) : null}
          </button>

          <button
            onClick={() => handleTabSelect('valuation')}
            className={`border border-transparent hover:border-white px-2 py-1 rounded-sm flex items-center gap-1.5 shrink-0 transition-colors ${
              activeTab === 'valuation' ? 'text-[#f3a847] font-bold bg-white/10' : 'text-gray-200'
            }`}
          >
            <LineChart className="w-4 h-4 text-emerald-400" />
            <span>Financial Terminal (DCF)</span>
          </button>

          <button
            onClick={() => handleTabSelect('research')}
            className={`border border-transparent hover:border-white px-2 py-1 rounded-sm flex items-center gap-1.5 shrink-0 transition-colors ${
              activeTab === 'research' ? 'text-[#f3a847] font-bold bg-white/10' : 'text-gray-200'
            }`}
          >
            <GraduationCap className="w-4 h-4 text-indigo-400" />
            <span>Academic Library</span>
          </button>

          <button
            onClick={() => handleTabSelect('analytics')}
            className={`border border-transparent hover:border-white px-2 py-1 rounded-sm flex items-center gap-1.5 shrink-0 transition-colors ${
              activeTab === 'analytics' ? 'text-[#f3a847] font-bold bg-white/10' : 'text-gray-200'
            }`}
          >
            <PieChart className="w-4 h-4 text-purple-400" />
            <span>Portfolio & Risk</span>
          </button>

          <button
            onClick={() => handleTabSelect('macro')}
            className={`border border-transparent hover:border-white px-2 py-1 rounded-sm flex items-center gap-1.5 shrink-0 transition-colors ${
              activeTab === 'macro' ? 'text-[#f3a847] font-bold bg-white/10' : 'text-gray-200'
            }`}
          >
            <TrendingUp className="w-4 h-4 text-amber-400" />
            <span>Macro & BoG Benchmarks</span>
          </button>

          {/* Admin-Only Tabs */}
          {isAdmin && (
            <>
              <div className="h-4 w-px bg-gray-600 shrink-0 mx-2" />
              <button
                onClick={() => handleTabSelect('setup')}
                className={`border border-transparent hover:border-white px-2 py-1 rounded-sm flex items-center gap-1.5 shrink-0 transition-colors ${
                  activeTab === 'setup' ? 'text-[#f3a847] font-bold bg-white/10' : 'text-gray-300'
                }`}
              >
                <Settings className="w-4 h-4 text-amber-300" />
                <span>Channel Ingestion</span>
              </button>

              <button
                onClick={() => handleTabSelect('simulator')}
                className={`border border-transparent hover:border-white px-2 py-1 rounded-sm flex items-center gap-1.5 shrink-0 transition-colors ${
                  activeTab === 'simulator' ? 'text-[#f3a847] font-bold bg-white/10' : 'text-gray-300'
                }`}
              >
                <Terminal className="w-4 h-4 text-amber-300" />
                <span>Telegram Simulator</span>
              </button>
            </>
          )}
        </div>
      </header>

      {/* 3. MAIN WORKSPACE STAGE */}
      <main className="flex-1 w-full max-w-[1540px] mx-auto px-3 sm:px-6 py-4 pb-24 md:pb-16">
        {/* Active Tab Breadcrumb */}
        <div className="text-xs text-gray-500 mb-3 flex items-center gap-1 overflow-x-auto">
          <span
            onClick={() => handleTabSelect('catalog')}
            className="hover:underline cursor-pointer font-medium"
          >
            BusiMind Library
          </span>
          <span>›</span>
          <span className="capitalize text-gray-800 font-bold">
            {activeTab === 'catalog'
              ? 'Executive Bookstore & Kindle Summaries'
              : activeTab === 'valuation'
              ? 'Financial Valuation & DCF Terminal'
              : activeTab === 'research'
              ? 'Academic Working Papers & Working Models'
              : activeTab === 'analytics'
              ? 'Multi-Asset Portfolio Stress Testing'
              : activeTab === 'macro'
              ? 'Macroeconomic Sensitivity & Bank of Ghana Rates'
              : activeTab === 'setup'
              ? 'Curator Channel Ingestion'
              : 'Telegram Webhook Simulator'}
          </span>
        </div>

        {/* Tab Workspaces */}
        <div className="bg-transparent text-[#0f1111] w-full max-w-7xl mx-auto py-6 overflow-hidden">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.3, ease: 'easeOut' }}
            >
              {activeTab === 'catalog' && (
                <CatalogManager
                  channelIdConfigured={Boolean(status?.channelIdConfigured)}
                  channelId={status?.channelId}
                  onRefresh={fetchStatus}
                  isAdmin={isAdmin}
                  externalSearchQuery={catalogSearchQuery}
                />
              )}

              {activeTab === 'valuation' && <ValuationLab />}
              {activeTab === 'research' && <AcademicLibraryView />}
              {activeTab === 'analytics' && <AnalyticsView stats={stats} />}
              {activeTab === 'macro' && <MacroIntelligenceView />}

              {/* Locked Admin Routes */}
              {activeTab === 'setup' && isAdmin && (
                <SetupAssistant status={status} onRefresh={fetchStatus} />
              )}
              {activeTab === 'simulator' && isAdmin && <TelegramSimulator />}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>

      {/* 4. INSTITUTIONAL FOOTER */}
      <footer className="bg-[#232f3e] text-white pt-10 pb-12 mt-auto">
        <div className="max-w-7xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-8 px-6 text-sm">
          <div>
            <h3 className="font-bold mb-4 text-white flex items-center gap-2">
              <BusiMindLogo className="w-5 h-5 text-white" />
              <span>BusiMind Library</span>
            </h3>
            <ul className="space-y-3 text-gray-300">
              <li>
                <button
                  onClick={() => setIsPrivacyOpen(true)}
                  className="hover:text-white hover:underline transition-colors"
                >
                  Privacy Protocol
                </button>
              </li>
              <li>
                <button
                  onClick={() => setIsTermsOpen(true)}
                  className="hover:text-white hover:underline transition-colors"
                >
                  Terms & Fair Use
                </button>
              </li>
              <li>
                <button
                  onClick={() => setIsFaqOpen(true)}
                  className="hover:text-white hover:underline transition-colors"
                >
                  Frequently Asked Questions
                </button>
              </li>
              <li>
                <button
                  onClick={() => setIsBookRequestOpen(true)}
                  className="hover:text-[#f3a847] hover:underline transition-colors font-bold text-[#f3a847]"
                >
                  Request Missing Book
                </button>
              </li>
            </ul>
          </div>

          <div>
            <h3 className="font-bold mb-4 text-white">Analysis & Valuations</h3>
            <ul className="space-y-3 text-gray-300">
              <li>
                <button
                  onClick={() => handleTabSelect('valuation')}
                  className="hover:text-white hover:underline transition-colors"
                >
                  Discounted Cash Flow (DCF)
                </button>
              </li>
              <li>
                <button
                  onClick={() => handleTabSelect('macro')}
                  className="hover:text-white hover:underline transition-colors"
                >
                  Bank of Ghana Rates & Yields
                </button>
              </li>
              <li>
                <button
                  onClick={() => handleTabSelect('research')}
                  className="hover:text-white hover:underline transition-colors"
                >
                  Mental Models & Frameworks
                </button>
              </li>
              <li>
                <button
                  onClick={() => handleTabSelect('analytics')}
                  className="hover:text-white hover:underline transition-colors"
                >
                  Cedi Currency Stress Testing
                </button>
              </li>
            </ul>
          </div>

          <div>
            <h3 className="font-bold mb-4 text-white">Telegram Integration</h3>
            <ul className="space-y-3 text-gray-300">
              <li>
                <a
                  href="https://t.me/BusiMind_bot"
                  target="_blank"
                  rel="noreferrer"
                  className="hover:text-white hover:underline transition-colors font-bold text-[#229ed9]"
                >
                  Launch @BusiMind_bot
                </a>
              </li>
              <li>
                <span>Direct Book Delivery</span>
              </li>
              <li>
                <span>Telegram Mini App (TMA)</span>
              </li>
              <li>
                <span>Kindle Summary Forwarding</span>
              </li>
            </ul>
          </div>

          {/* 4th Column: Curator Suite for Admin, or Community & Support for Public */}
          <div>
            {isAdmin ? (
              <>
                <h3 className="font-bold mb-4 text-white">Curator Suite</h3>
                <ul className="space-y-3 text-gray-300">
                  <li>
                    <button
                      onClick={() => handleTabSelect('setup')}
                      className="hover:text-[#f3a847] hover:underline transition-colors text-[#f3a847] font-bold"
                    >
                      Channel Ingestion Portal
                    </button>
                  </li>
                  <li>
                    <button
                      onClick={() => handleTabSelect('simulator')}
                      className="hover:text-[#f3a847] hover:underline transition-colors text-[#f3a847] font-bold"
                    >
                      Telegram Bot Diagnostics
                    </button>
                  </li>
                  <li>
                    <button
                      onClick={handleAdminSignOut}
                      className="hover:text-rose-400 hover:underline transition-colors text-rose-400 font-bold"
                    >
                      Sign Out of Admin Mode
                    </button>
                  </li>
                </ul>
              </>
            ) : (
              <>
                <h3 className="font-bold mb-4 text-white">Community & Support</h3>
                <ul className="space-y-3 text-gray-300">
                  <li>
                    <button
                      onClick={() => setIsBookRequestOpen(true)}
                      className="hover:text-white hover:underline transition-colors"
                    >
                      Request Missing Book
                    </button>
                  </li>
                  <li>
                    <button
                      onClick={() => setIsFaqOpen(true)}
                      className="hover:text-white hover:underline transition-colors"
                    >
                      Reader FAQ & Documentation
                    </button>
                  </li>
                  <li>
                    <button
                      onClick={() => setIsPrivacyOpen(true)}
                      className="hover:text-white hover:underline transition-colors"
                    >
                      Data Privacy Protocol
                    </button>
                  </li>
                  <li>
                    <button
                      onClick={() => setIsTermsOpen(true)}
                      className="hover:text-white hover:underline transition-colors"
                    >
                      Educational Fair Use
                    </button>
                  </li>
                </ul>
              </>
            )}
          </div>
        </div>

        <div className="mt-10 pt-8 border-t border-gray-700 flex flex-col items-center justify-center gap-4 text-center px-4">
          <div className="flex items-center gap-2">
            <BusiMindLogo className="w-8 h-8 text-[#f3a847]" />
            <span className="text-xl font-bold tracking-tight text-white">
              BusiMind Library
            </span>
          </div>
          <div className="text-sm text-gray-400 flex flex-wrap items-center justify-center gap-5">
            <button onClick={() => setIsTermsOpen(true)} className="hover:underline hover:text-white">
              Terms of Service
            </button>
            <span>•</span>
            <button onClick={() => setIsPrivacyOpen(true)} className="hover:underline hover:text-white">
              Privacy Protocol
            </button>
            <span>•</span>
            <button onClick={() => setIsFaqOpen(true)} className="hover:underline hover:text-white">
              FAQs & Help
            </button>
            <span>•</span>
            <button onClick={() => setIsBookRequestOpen(true)} className="hover:underline hover:text-white">
              Wishlist Request
            </button>
          </div>
          <div
            onClick={() => setIsAdminAuthOpen(true)}
            className="text-xs text-gray-500 max-w-xl cursor-default select-none hover:text-gray-400 transition-colors mt-2"
            title="BusiMind Institutional Repository"
          >
            © {new Date().getFullYear()} BusiMind Library. Sourced for research, financial analysis, and intellectual inquiry. All trade names and author rights belong to their respective copyright holders.
          </div>
        </div>
      </footer>

      {/* 6. MODALS */}
      <PrivacyPolicyModal isOpen={isPrivacyOpen} onClose={() => setIsPrivacyOpen(false)} />
      <TermsOfServiceModal isOpen={isTermsOpen} onClose={() => setIsTermsOpen(false)} />
      <FaqModal
        isOpen={isFaqOpen}
        onClose={() => setIsFaqOpen(false)}
        onOpenBookRequest={() => setIsBookRequestOpen(true)}
      />
      <BookRequestModal isOpen={isBookRequestOpen} onClose={() => setIsBookRequestOpen(false)} />
      <AdminAuthModal
        isOpen={isAdminAuthOpen}
        onClose={() => setIsAdminAuthOpen(false)}
        onSuccess={handleAdminLoginSuccess}
      />
      <MobileDrawer
        isOpen={isMobileDrawerOpen}
        onClose={() => setIsMobileDrawerOpen(false)}
        activeTab={activeTab}
        onSelectTab={handleTabSelect}
        isAdmin={isAdmin}
        onOpenAdminAuth={() => setIsAdminAuthOpen(true)}
        onAdminSignOut={handleAdminSignOut}
        onOpenPrivacy={() => setIsPrivacyOpen(true)}
        onOpenTerms={() => setIsTermsOpen(true)}
        onOpenFaq={() => setIsFaqOpen(true)}
        onOpenBookRequest={() => setIsBookRequestOpen(true)}
        bookCount={stats?.totalBooks || status?.totalBooks || 0}
      />
    </div>
  );
}
