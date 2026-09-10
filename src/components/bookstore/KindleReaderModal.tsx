import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Book } from '../../types';
import {
  X,
  BookOpen,
  Send,
  Brain,
  Star,
  CheckCircle2,
  Copy,
  ExternalLink,
  Bookmark,
  Share2,
  Sparkles,
  Sliders,
  Type,
  Sun,
  Moon,
  Coffee,
  Check,
} from 'lucide-react';

interface Props {
  book: Book | null;
  onClose: () => void;
  onTestDeliver: (book: Book) => void;
  onExtractRAG: (book: Book) => void;
  isDelivering: boolean;
  extractingRAGId: string | null;
  ragSuccessMsg?: string;
}

type ReaderTheme = 'sepia' | 'obsidian' | 'paper' | 'dark';
type FontSize = 'sm' | 'base' | 'lg';

export const KindleReaderModal: React.FC<Props> = ({
  book,
  onClose,
  onTestDeliver,
  onExtractRAG,
  isDelivering,
  extractingRAGId,
  ragSuccessMsg,
}) => {
  const [activeTab, setActiveTab] = useState<'summary' | 'roi' | 'takeaways' | 'models'>('summary');
  const [theme, setTheme] = useState<ReaderTheme>('obsidian');
  const [fontSize, setFontSize] = useState<FontSize>('base');
  const [copiedTakeaway, setCopiedTakeaway] = useState<number | null>(null);

  if (!book) return null;

  const handleCopyTakeaway = (text: string, idx: number) => {
    navigator.clipboard.writeText(text);
    setCopiedTakeaway(idx);
    setTimeout(() => setCopiedTakeaway(null), 2000);
  };

  // Theme styling configurations
  const themeStyles: Record<ReaderTheme, { bg: string; text: string; subText: string; border: string; accent: string }> = {
    paper: {
      bg: 'bg-white',
      text: 'text-gray-900',
      subText: 'text-gray-500',
      border: 'border-gray-200',
      accent: 'text-[#007185]',
    },
    sepia: {
      bg: 'bg-[#f4ecd8]',
      text: 'text-[#433422]',
      subText: 'text-[#79634e]',
      border: 'border-[#dfd3b6]',
      accent: 'text-[#b12704]',
    },
    obsidian: {
      bg: 'bg-[#131921]',
      text: 'text-gray-100',
      subText: 'text-gray-400',
      border: 'border-[#232f3e]',
      accent: 'text-[#f3a847]',
    },
    dark: {
      bg: 'bg-[#0f1111]',
      text: 'text-gray-200',
      subText: 'text-gray-400',
      border: 'border-gray-800',
      accent: 'text-white',
    },
  };

  const currentTheme = themeStyles[theme];

  const fontSizeClass = {
    sm: 'text-xs sm:text-sm leading-relaxed',
    base: 'text-sm sm:text-base leading-relaxed',
    lg: 'text-base sm:text-lg leading-loose',
  }[fontSize];

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 md:p-6 bg-black/85 backdrop-blur-md"
    >
      {/* Kindle Cloud Reader Outer Container */}
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        transition={{ type: "spring", damping: 25, stiffness: 300 }}
        className={`w-full max-w-5xl h-[92vh] max-h-[900px] rounded-lg ${currentTheme.bg} ${currentTheme.border} border shadow-2xl flex flex-col overflow-hidden transition-colors duration-300`}
      >
        {/* Top Kindle Navigation Toolbar */}
        <div className={`flex items-center justify-between px-4 sm:px-6 py-3 border-b ${currentTheme.border} shrink-0`}>
          <div className="flex items-center gap-3 truncate">
            <div className="w-8 h-8 rounded bg-[#232f3e] flex items-center justify-center shrink-0 border border-[#f3a847]/30">
              <BookOpen className="w-4 h-4 text-[#f3a847]" />
            </div>
            <div className="truncate">
              <h3 className={`font-display font-bold text-sm sm:text-base ${currentTheme.text} truncate`}>
                {book.title}
              </h3>
              <p className={`text-[11px] ${currentTheme.subText} truncate`}>By {book.author}</p>
            </div>
          </div>

          {/* Controls: Theme, Font Size, Close */}
          <div className="flex items-center gap-2 sm:gap-4 shrink-0">
            {/* Theme Selector */}
            <div className="flex items-center bg-black/20 p-1 rounded border border-white/10 text-xs">
              <button
                onClick={() => setTheme('obsidian')}
                title="Obsidian Dark Theme"
                className={`p-1.5 rounded transition-colors ${theme === 'obsidian' ? 'bg-[#232f3e] text-[#f3a847]' : 'text-gray-400 hover:text-white'}`}
              >
                <Moon className="w-3.5 h-3.5" />
              </button>

              <button
                onClick={() => setTheme('sepia')}
                title="Sepia Theme"
                className={`p-1.5 rounded transition-colors ${theme === 'sepia' ? 'bg-[#dfd3b6] text-[#433422]' : 'text-gray-400 hover:text-white'}`}
              >
                <Coffee className="w-3.5 h-3.5" />
              </button>

              <button
                onClick={() => setTheme('paper')}
                title="Paper Light Theme"
                className={`p-1.5 rounded transition-colors ${theme === 'paper' ? 'bg-gray-200 text-gray-900' : 'text-gray-400 hover:text-white'}`}
              >
                <Sun className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Font Size Selector */}
            <div className="flex items-center bg-black/20 p-1 rounded border border-white/10 text-[11px] font-bold">
              <button
                onClick={() => setFontSize('sm')}
                className={`px-2 py-1 rounded ${fontSize === 'sm' ? 'bg-white/20 text-white' : 'text-gray-400'}`}
              >
                A-
              </button>
              <button
                onClick={() => setFontSize('base')}
                className={`px-2 py-1 rounded ${fontSize === 'base' ? 'bg-white/20 text-white' : 'text-gray-400'}`}
              >
                A
              </button>
              <button
                onClick={() => setFontSize('lg')}
                className={`px-2 py-1 rounded ${fontSize === 'lg' ? 'bg-white/20 text-white' : 'text-gray-400'}`}
              >
                A+
              </button>
            </div>

            {/* Close Button */}
            <button
              onClick={onClose}
              className={`p-2 rounded border ${currentTheme.border} ${currentTheme.text} hover:bg-black/10 transition-colors`}
              title="Close Reader"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Reader Body Grid: Sidebar & Reading Slate */}
        <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
          {/* Left Column: 3D Book Spine & Metadata */}
          <div className={`w-full md:w-72 lg:w-80 p-5 sm:p-6 border-b md:border-b-0 md:border-r ${currentTheme.border} overflow-y-auto shrink-0 flex flex-col justify-between custom-scrollbar`}>
            <div>
              {/* 3D Book Jacket Presentation */}
              <div className="w-36 sm:w-44 aspect-[2/3] mx-auto rounded-r-xl rounded-l-xs book-card-shadow relative overflow-hidden mb-5">
                <div className="book-spine-effect" />
                <div className="book-page-edge" />
                {book.coverImageUrl ? (
                  <img
                    src={book.coverImageUrl}
                    alt={book.title}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover rounded-r-xl"
                  />
                ) : (
                  <div className="w-full h-full p-4 flex flex-col justify-between bg-gradient-to-b from-[#18233a] via-[#101726] to-[#0a0f19] text-gray-900">
                    <span className="text-[9px] font-bold text-[#f3a847] uppercase tracking-wider">
                      BusiMind Edition
                    </span>
                    <div>
                      <h4 className="font-display font-bold text-base leading-snug text-amber-100">
                        {book.title}
                      </h4>
                      <p className="text-xs text-gray-500 italic mt-1">{book.author}</p>
                    </div>
                    <span className="text-[9px] font-mono text-gray-500">★ {book.ratingScore}</span>
                  </div>
                )}
              </div>

              {/* Book Metadata List */}
              <div className="space-y-2 text-xs">
                <div className={`flex justify-between py-1 border-b ${currentTheme.border}`}>
                  <span className={currentTheme.subText}>Author</span>
                  <span className={`font-semibold ${currentTheme.text}`}>{book.author}</span>
                </div>

                <div className={`flex justify-between py-1 border-b ${currentTheme.border}`}>
                  <span className={currentTheme.subText}>Category</span>
                  <span className={`font-semibold ${currentTheme.accent}`}>{book.category}</span>
                </div>

                <div className={`flex justify-between py-1 border-b ${currentTheme.border}`}>
                  <span className={currentTheme.subText}>Published</span>
                  <span className={`font-semibold ${currentTheme.text}`}>{book.publicationYear}</span>
                </div>

                <div className={`flex justify-between py-1 border-b ${currentTheme.border}`}>
                  <span className={currentTheme.subText}>Difficulty</span>
                  <span className={`capitalize font-semibold ${currentTheme.text}`}>{book.difficulty}</span>
                </div>

                <div className={`flex justify-between py-1 border-b ${currentTheme.border}`}>
                  <span className={currentTheme.subText}>Rating</span>
                  <span className="font-semibold text-amber-500 flex items-center gap-1">
                    ★ {book.ratingScore} / 5.0
                  </span>
                </div>

                {book.channelMessageId && (
                  <div className={`flex justify-between py-1 border-b ${currentTheme.border}`}>
                    <span className={currentTheme.subText}>Availability</span>
                    <span className="text-[#007600] font-semibold text-xs flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5 text-[#007600]" />
                      Direct Library Delivery
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Quick Action CTAs */}
            <div className="pt-4 space-y-2">
              {book.channelMessageId && (
                <button
                  onClick={() => onTestDeliver(book)}
                  disabled={isDelivering}
                  className="w-full py-2.5 px-3 bg-[#ffa41c] hover:bg-[#fa8900] text-[#0f1111] font-bold rounded-full text-xs flex items-center justify-center gap-2 shadow-sm transition-colors border border-[#ff8f00]"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>{isDelivering ? 'Dispatching to Bot...' : '⚡ Send Book to Telegram'}</span>
                </button>
              )}

              <button
                onClick={() => onExtractRAG(book)}
                disabled={extractingRAGId === book.id}
                className="w-full py-2 px-3 bg-white hover:bg-gray-100 border border-gray-300 text-[#0f1111] font-semibold rounded-full text-xs flex items-center justify-center gap-2 transition-colors"
              >
                <Brain className="w-3.5 h-3.5" />
                <span>{extractingRAGId === book.id ? 'Extracting Models...' : 'Extract RAG Mental Models'}</span>
              </button>

              {ragSuccessMsg && (
                <p className="text-[11px] text-[#007600] text-center font-semibold">
                  ✓ {ragSuccessMsg}
                </p>
              )}

              {book.externalPurchaseUrl && (
                <a
                  href={book.externalPurchaseUrl}
                  target="_blank"
                  rel="noreferrer"
                  className={`w-full py-1.5 px-3 rounded-full border ${currentTheme.border} ${currentTheme.subText} hover:${currentTheme.text} text-[11px] flex items-center justify-center gap-1.5 transition-colors`}
                >
                  <span>Publisher Official Edition</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              )}
            </div>
          </div>

          {/* Right Column: Immersive Kindle Reader Content */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Reading Tabs */}
            <div className={`flex items-center gap-4 px-6 pt-4 border-b ${currentTheme.border} overflow-x-auto custom-scrollbar shrink-0`}>
              <button
                onClick={() => setActiveTab('summary')}
                className={`pb-2 text-xs font-semibold transition-all border-b-2 ${
                  activeTab === 'summary'
                    ? `border-[#e77600] ${currentTheme.text}`
                    : `border-transparent ${currentTheme.subText} hover:${currentTheme.text}`
                }`}
              >
                Executive Thesis
              </button>

              <button
                onClick={() => setActiveTab('roi')}
                className={`pb-2 text-xs font-semibold transition-all border-b-2 ${
                  activeTab === 'roi'
                    ? `border-[#e77600] ${currentTheme.text}`
                    : `border-transparent ${currentTheme.subText} hover:${currentTheme.text}`
                }`}
              >
                Strategic ROI & Career Value
              </button>

              <button
                onClick={() => setActiveTab('takeaways')}
                className={`pb-2 text-xs font-semibold transition-all border-b-2 ${
                  activeTab === 'takeaways'
                    ? `border-[#e77600] ${currentTheme.text}`
                    : `border-transparent ${currentTheme.subText} hover:${currentTheme.text}`
                }`}
              >
                Key Takeaways ({book.keyTakeaways?.length || 0})
              </button>

              <button
                onClick={() => setActiveTab('models')}
                className={`pb-2 text-xs font-semibold transition-all border-b-2 ${
                  activeTab === 'models'
                    ? `border-[#e77600] ${currentTheme.text}`
                    : `border-transparent ${currentTheme.subText} hover:${currentTheme.text}`
                }`}
              >
                Valuation Mental Models
              </button>
            </div>

            {/* Reading Pane Scroll Area */}
            <div className="flex-1 p-6 sm:p-8 md:p-10 overflow-y-auto custom-scrollbar">
              {/* TAB 1: EXECUTIVE THESIS */}
              {activeTab === 'summary' && (
                <div className="max-w-2xl space-y-6">
                  <div>
                    <span className="text-[11px] font-bold uppercase tracking-widest text-amber-500 font-mono">
                      Executive Summary & Synthesis
                    </span>
                    <h2 className={`font-display text-2xl sm:text-3xl font-bold mt-1 ${currentTheme.text}`}>
                      The Core Argument
                    </h2>
                  </div>

                  <p className={`${fontSizeClass} ${currentTheme.text}`}>
                    {book.description}
                  </p>

                  <div className={`p-4 sm:p-5 rounded-lg border ${currentTheme.border} bg-black/5 space-y-2`}>
                    <div className="text-xs font-bold text-[#e77600] uppercase tracking-wider flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Why BusiMind Recommends This Volume</span>
                    </div>
                    <p className={`${fontSizeClass} italic ${currentTheme.text}`}>
                      "{book.whyRecommended}"
                    </p>
                  </div>

                  {book.bestFor && (
                    <div className="pt-2">
                      <h4 className={`text-xs font-bold uppercase tracking-wider ${currentTheme.subText} mb-1`}>
                        Ideal Target Audience
                      </h4>
                      <p className={`text-xs sm:text-sm ${currentTheme.text}`}>
                        {book.bestFor}
                      </p>
                    </div>
                  )}

                  {book.tags && book.tags.length > 0 && (
                    <div className="pt-4 flex flex-wrap gap-1.5">
                      {book.tags.map((tag, i) => (
                        <span
                          key={i}
                          className={`text-[10px] px-2.5 py-1 rounded-md border ${currentTheme.border} ${currentTheme.subText}`}
                        >
                          #{tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* TAB 2: STRATEGIC ROI */}
              {activeTab === 'roi' && (
                <div className="max-w-2xl space-y-6">
                  <div>
                    <span className="text-[11px] font-bold uppercase tracking-widest text-emerald-500 font-mono">
                      Pragmatic Return On Investment
                    </span>
                    <h2 className={`font-display text-2xl sm:text-3xl font-bold mt-1 ${currentTheme.text}`}>
                      How This Multiplies Career & Wealth
                    </h2>
                  </div>

                  <div className={`p-5 rounded-lg border border-[#007600]/30 bg-[#007600]/5 space-y-3`}>
                    <p className={`${fontSizeClass} ${currentTheme.text}`}>
                      {book.howItHelps ||
                        'Equips you with cognitive models to avoid costly business pitfalls, identify asymmetrical market opportunities, and make superior capital allocation choices.'}
                    </p>
                  </div>

                  <div className="space-y-4 pt-2">
                    <h4 className={`text-sm font-bold ${currentTheme.text}`}>
                      Direct Applications in Modern Enterprise:
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className={`p-4 rounded-lg border ${currentTheme.border} bg-black/5`}>
                        <div className="font-semibold text-xs text-[#e77600] mb-1">Valuation & Due Diligence</div>
                        <p className={`text-xs ${currentTheme.subText}`}>
                          Stress-tests financial multiples and operating margins against qualitative moats.
                        </p>
                      </div>

                      <div className={`p-4 rounded-lg border ${currentTheme.border} bg-black/5`}>
                        <div className="font-semibold text-xs text-[#007600] mb-1">Capital Preservation</div>
                        <p className={`text-xs ${currentTheme.subText}`}>
                          Inoculates decision-makers against FOMO, market euphoria, and liquidity miscalculations.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 3: KEY TAKEAWAYS */}
              {activeTab === 'takeaways' && (
                <div className="max-w-2xl space-y-5">
                  <div>
                    <span className="text-[11px] font-bold uppercase tracking-widest text-amber-500 font-mono">
                      Actionable Blueprint
                    </span>
                    <h2 className={`font-display text-2xl sm:text-3xl font-bold mt-1 ${currentTheme.text}`}>
                      Essential Chapter Takeaways
                    </h2>
                  </div>

                  {book.keyTakeaways && book.keyTakeaways.length > 0 ? (
                    <div className="space-y-3">
                      {book.keyTakeaways.map((point, idx) => (
                        <div
                          key={idx}
                          className={`p-4 rounded-lg border ${currentTheme.border} bg-black/5 flex items-start justify-between gap-3 group hover:border-[#e77600]/40 transition-colors`}
                        >
                          <div className="flex items-start gap-3">
                            <span className="w-6 h-6 rounded-full bg-[#f3a847]/20 text-[#f3a847] font-mono text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                              {idx + 1}
                            </span>
                            <p className={`${fontSizeClass} ${currentTheme.text}`}>
                              {point}
                            </p>
                          </div>

                          <button
                            onClick={() => handleCopyTakeaway(point, idx)}
                            className="p-1.5 text-gray-500 hover:text-[#f3a847] opacity-0 group-hover:opacity-100 transition-opacity"
                            title="Copy takeaway"
                          >
                            {copiedTakeaway === idx ? (
                              <Check className="w-3.5 h-3.5 text-emerald-400" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="py-8 text-center text-xs text-gray-500">
                      No chapter takeaways logged for this title yet.
                    </div>
                  )}
                </div>
              )}

              {/* TAB 4: VALUATION & MENTAL MODELS */}
              {activeTab === 'models' && (
                <div className="max-w-2xl space-y-5">
                  <div>
                    <span className="text-[11px] font-bold uppercase tracking-widest text-indigo-400 font-mono">
                      RAG Financial Engine
                    </span>
                    <h2 className={`font-display text-2xl sm:text-3xl font-bold mt-1 ${currentTheme.text}`}>
                      Integrated Mental Frameworks
                    </h2>
                  </div>

                  <p className={`text-xs sm:text-sm ${currentTheme.subText}`}>
                    These mental frameworks are extracted directly from <strong className={currentTheme.text}>{book.title}</strong> and are injected into BusiMind's DCF Valuation Lab to evaluate enterprise risk, terminal value, and management moats.
                  </p>

                  <div className="p-4 rounded-lg border border-indigo-500/30 bg-indigo-950/20 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Brain className="w-4 h-4 text-indigo-400" />
                        <span className="font-bold text-xs text-indigo-200">
                          {book.title} Framework Synthesis
                        </span>
                      </div>
                      <span className="text-[10px] bg-indigo-500/20 text-indigo-300 font-mono px-2 py-0.5 rounded-full">
                        ACTIVE IN LAB
                      </span>
                    </div>
                    <p className={`text-xs ${currentTheme.text}`}>
                      "{book.whyRecommended}"
                    </p>
                  </div>

                  <div className="pt-2">
                    <button
                      onClick={() => onExtractRAG(book)}
                      disabled={extractingRAGId === book.id}
                      className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-gray-900 font-bold rounded-lg text-xs flex items-center gap-2 shadow-md transition-colors"
                    >
                      <Brain className="w-3.5 h-3.5" />
                      <span>{extractingRAGId === book.id ? 'Re-analyzing...' : 'Extract Fresh Models to RAG Base'}</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
};
