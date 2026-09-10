import { apiFetch } from '../lib/api';
import React, { useState, useEffect } from 'react';
import {
  TrendingUp,
  TrendingDown,
  Calculator,
  Brain,
  ShieldCheck,
  Scale,
  Search,
  Sparkles,
  BookOpen,
  Layers,
  Activity,
  Check,
  Plus,
  Trash2,
  RefreshCw,
  Sliders,
  Globe,
  Building,
  AlertCircle,
  ExternalLink,
  ChevronRight,
  BookMarked,
  ArrowUpRight,
  ShieldAlert,
} from 'lucide-react';
import {
  FinancialAssetQuote,
  DualValuationResult,
  RAGMentalModel,
  JournalEntry,
} from '../types';
import { PortfolioStressView } from './PortfolioStressView';
import { MacroIntelligenceView } from './MacroIntelligenceView';
import { PeerComparisonScreenerView } from './PeerComparisonScreenerView';
import { ValuationQuoteSkeleton } from './common/Skeletons';
import { useLoading } from '../context/LoadingContext';

export const ValuationLab: React.FC = () => {
  const { startLoading, stopLoading } = useLoading();
  // State for market quote and valuation
  const [symbolInput, setSymbolInput] = useState('MTNGH');
  const [selectedAsset, setSelectedAsset] = useState<string>('MTNGH');
  const [quote, setQuote] = useState<FinancialAssetQuote | null>(null);
  const [valuation, setValuation] = useState<DualValuationResult | null>(null);
  const [loadingQuote, setLoadingQuote] = useState(false);
  const [loadingValuation, setLoadingValuation] = useState(false);

  // DCF Custom Assumptions (Sliders)
  const [customGrowthRate, setCustomGrowthRate] = useState<number>(15);
  const [customDiscountRate, setCustomDiscountRate] = useState<number>(20);
  const [customTerminalRate, setCustomTerminalRate] = useState<number>(5);

  // RAG Mental Models
  const [ragModels, setRagModels] = useState<RAGMentalModel[]>([]);
  const [selectedModel, setSelectedModel] = useState<RAGMentalModel | null>(null);
  const [extractModalOpen, setExtractModalOpen] = useState(false);
  const [extractTitle, setExtractTitle] = useState('');
  const [extractAuthor, setExtractAuthor] = useState('');
  const [extractNotes, setExtractNotes] = useState('');
  const [extracting, setExtracting] = useState(false);
  const [extractSuccess, setExtractSuccess] = useState<string | null>(null);

  // Journal entries
  const [journalEntries, setJournalEntries] = useState<JournalEntry[]>([]);
  const [journalModalOpen, setJournalModalOpen] = useState(false);
  const [newJournalAction, setNewJournalAction] = useState<'BUY' | 'WATCH' | 'PASS'>('BUY');
  const [newJournalThesis, setNewJournalThesis] = useState('');
  const [newJournalInvalidation, setNewJournalInvalidation] = useState('');
  const [newJournalTarget, setNewJournalTarget] = useState('');
  const [newJournalStop, setNewJournalStop] = useState('');
  const [savingJournal, setSavingJournal] = useState(false);

  // Sub-tabs in Valuation Lab
  const [activeSubTab, setActiveSubTab] = useState<
    'dual_valuation' | 'rag_knowledge' | 'journal' | 'portfolio_stress' | 'macro_intelligence' | 'peer_screener'
  >('dual_valuation');

  // Quick pick assets
  const quickPicks = [
    { symbol: 'MTNGH', name: 'MTN Ghana', exchange: 'GSE', currency: 'GHS', tag: 'Telecom / MoMo' },
    { symbol: 'GCB', name: 'GCB Bank PLC', exchange: 'GSE', currency: 'GHS', tag: 'Banking' },
    { symbol: 'TOTAL', name: 'TotalEnergies GH', exchange: 'GSE', currency: 'GHS', tag: 'Energy / Retail' },
    { symbol: 'SCB', name: 'Standard Chartered GH', exchange: 'GSE', currency: 'GHS', tag: 'Banking' },
    { symbol: 'NVDA', name: 'NVIDIA Corp', exchange: 'NASDAQ', currency: 'USD', tag: 'AI / Semiconductors' },
    { symbol: 'VOO', name: 'Vanguard S&P 500 ETF', exchange: 'NYSE', currency: 'USD', tag: 'Broad Index' },
    { symbol: 'AAPL', name: 'Apple Inc', exchange: 'NASDAQ', currency: 'USD', tag: 'Consumer Tech' },
    { symbol: 'MSFT', name: 'Microsoft Corp', exchange: 'NASDAQ', currency: 'USD', tag: 'Cloud / Enterprise' },
  ];

  // Fetch RAG Models
  const fetchRagModels = async () => {
    try {
      const res = await apiFetch('/api/finance/rag/models');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          setRagModels(data);
        }
      }
    } catch (err) {
      console.error('Failed to load RAG models', err);
    }
  };

  // Fetch Journal Entries
  const fetchJournal = async () => {
    try {
      const res = await apiFetch('/api/finance/journal');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          setJournalEntries(data);
        }
      }
    } catch (err) {
      console.error('Failed to load journal entries', err);
    }
  };

  // Load Asset Quote & Run Valuation
  const loadAsset = async (sym: string, overrideRates?: { growth?: number; discount?: number; terminal?: number }) => {
    setLoadingQuote(true);
    setLoadingValuation(true);
    setSelectedAsset(sym);
    startLoading(`Analyzing ${sym} market quote & valuation...`);

    try {
      // 1. Fetch Quote
      const quoteRes = await apiFetch(`/api/finance/quote?symbol=${encodeURIComponent(sym)}`);
      if (quoteRes.ok) {
        const quoteData: FinancialAssetQuote = await quoteRes.json();
        if (quoteData && quoteData.symbol) {
          setQuote(quoteData);

          // Set initial slider defaults based on market
          const isGhana = quoteData.exchange === 'GSE' || quoteData.currency === 'GHS';
          const initialDiscount = overrideRates?.discount ?? (isGhana ? 20 : 9);
          const initialGrowth = overrideRates?.growth ?? (isGhana ? 16 : 14);
          const initialTerminal = overrideRates?.terminal ?? (isGhana ? 6 : 3.5);

          if (!overrideRates) {
            setCustomDiscountRate(initialDiscount);
            setCustomGrowthRate(initialGrowth);
            setCustomTerminalRate(initialTerminal);
          }

          // 2. Run Valuation
          const valRes = await apiFetch('/api/finance/valuation', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              symbol: sym,
              growthRate: initialGrowth / 100,
              discountRate: initialDiscount / 100,
              terminalRate: initialTerminal / 100,
            }),
          });
          if (valRes.ok) {
            const valData = await valRes.json();
            if (valData && typeof valData.synthesizedFairValue === 'number' && valData.dcf) {
              setValuation(valData);
            }
          }
        }
      }
    } catch (err) {
      console.error('Failed to analyze asset', err);
    } finally {
      setLoadingQuote(false);
      setLoadingValuation(false);
      stopLoading();
    }
  };

  // Recalculate with custom slider values
  const recalculateValuation = async () => {
    if (!selectedAsset) return;
    setLoadingValuation(true);
    try {
      const valRes = await apiFetch('/api/finance/valuation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symbol: selectedAsset,
          growthRate: customGrowthRate / 100,
          discountRate: customDiscountRate / 100,
          terminalRate: customTerminalRate / 100,
        }),
      });
      if (valRes.ok) {
        const valData = await valRes.json();
        if (valData && typeof valData.synthesizedFairValue === 'number' && valData.dcf) {
          setValuation(valData);
        }
      }
    } catch (err) {
      console.error('Failed to recalculate valuation', err);
    } finally {
      setLoadingValuation(false);
    }
  };

  // Handle RAG Mental Model Extraction
  const handleExtractMentalModels = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!extractTitle.trim()) return;
    setExtracting(true);
    setExtractSuccess(null);

    try {
      const res = await apiFetch('/api/finance/rag/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bookIdOrTitle: extractTitle,
          author: extractAuthor,
          notes: extractNotes,
        }),
      });
      const data = await res.json();
      if (data.success && data.extracted) {
        setExtractSuccess(`Successfully extracted ${data.extracted.length} mental models from "${extractTitle}"!`);
        fetchRagModels();
        setExtractTitle('');
        setExtractAuthor('');
        setExtractNotes('');
        setTimeout(() => {
          setExtractModalOpen(false);
          setExtractSuccess(null);
        }, 2000);
      }
    } catch (err) {
      console.error('RAG extraction failed', err);
    } finally {
      setExtracting(false);
    }
  };

  // Handle Journal Save
  const handleSaveJournal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quote || !newJournalThesis.trim()) return;
    setSavingJournal(true);

    try {
      const payload = {
        symbol: quote.symbol,
        assetName: quote.name,
        action: newJournalAction,
        entryPrice: quote.price,
        targetPrice: newJournalTarget ? Number(newJournalTarget) : undefined,
        stopOrReviewPrice: newJournalStop ? Number(newJournalStop) : undefined,
        currency: quote.currency,
        thesis: newJournalThesis,
        invalidationCriteria: newJournalInvalidation,
        appliedBooks: Array.isArray(valuation?.appliedMentalModels) ? valuation.appliedMentalModels.map((m) => m.bookTitle) : [],
        status: 'active' as const,
      };

      const res = await apiFetch('/api/finance/journal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        fetchJournal();
        setJournalModalOpen(false);
        setNewJournalThesis('');
        setNewJournalInvalidation('');
        setNewJournalTarget('');
        setNewJournalStop('');
      }
    } catch (err) {
      console.error('Failed to save journal', err);
    } finally {
      setSavingJournal(false);
    }
  };

  // Initial load
  useEffect(() => {
    loadAsset('MTNGH');
    fetchRagModels();
    fetchJournal();
  }, []);

  return (
    <div className="space-y-6">
      {/* HEADER SECTION */}
      <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
        {/* Global Macro Quick Stats */}
        <div className="flex items-center gap-4 text-xs font-mono overflow-x-auto custom-scrollbar pb-3 mb-4 border-b border-gray-200">
          <div className="flex items-center gap-1.5 px-3 py-1 bg-white rounded-md border border-gray-200">
            <span className="text-gray-600">GSE-CI:</span>
            <span className="text-[#007600] font-bold">3,842.15</span>
            <span className="text-[#007600] text-[10px]">+1.42%</span>
          </div>
          <div className="flex items-center gap-1.5 px-3 py-1 bg-white rounded-md border border-gray-200">
            <span className="text-gray-600">BoG POLICY:</span>
            <span className="text-[#007185] font-bold">29.00%</span>
          </div>
          <div className="flex items-center gap-1.5 px-3 py-1 bg-white rounded-md border border-gray-200">
            <span className="text-gray-600">US 10Y:</span>
            <span className="text-[#007185] font-bold">4.28%</span>
          </div>
        </div>

        {/* Main Terminal Header Title & Controls */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded bg-[#232f3e] flex items-center justify-center shrink-0 shadow-lg shadow-sm">
              <Scale className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h2 className="text-lg font-bold text-white tracking-tight">
                  Valuation Engine
                </h2>
                <span className="text-[10px] font-mono font-medium px-2 py-0.5 rounded bg-[#007185]/10 text-[#007185] border border-[#007185]/20">
                  GLOBAL EQUITIES
                </span>
                <span className="text-[10px] font-mono font-medium px-2 py-0.5 rounded bg-gray-100 text-gray-800 border border-gray-300">
                  DCF + RELATIVE
                </span>
              </div>
              <p className="text-xs text-gray-600 mt-0.5 max-w-2xl">
                Advanced discounted cash flow, peer multiples, and AI-assisted stress testing.
              </p>
            </div>
          </div>

          {/* Sub-tab Navigation (Institutional Bloomberg Style) */}
          <div className="flex flex-wrap items-center bg-white p-1 rounded-lg border border-gray-200 text-xs gap-1">
            <button
              onClick={() => setActiveSubTab('dual_valuation')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md font-medium transition-colors ${
                activeSubTab === 'dual_valuation'
                  ? 'bg-[#232f3e] text-white shadow'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100/50'
              }`}
            >
              <Calculator className="w-3.5 h-3.5" />
              <span>[F1] Models</span>
            </button>

            <button
              onClick={() => setActiveSubTab('portfolio_stress')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md font-medium transition-colors ${
                activeSubTab === 'portfolio_stress'
                  ? 'bg-[#232f3e] text-white shadow'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100/50'
              }`}
            >
              <ShieldAlert className="w-3.5 h-3.5" />
              <span>[F2] Stress</span>
            </button>

            <button
              onClick={() => setActiveSubTab('peer_screener')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md font-medium transition-colors ${
                activeSubTab === 'peer_screener'
                  ? 'bg-[#232f3e] text-white shadow'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100/50'
              }`}
            >
              <Scale className="w-3.5 h-3.5" />
              <span>[F3] Screener</span>
            </button>

            <button
              onClick={() => setActiveSubTab('macro_intelligence')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md font-medium transition-colors ${
                activeSubTab === 'macro_intelligence'
                  ? 'bg-[#232f3e] text-white shadow'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100/50'
              }`}
            >
              <Globe className="w-3.5 h-3.5" />
              <span>[F4] Macro</span>
            </button>

            <button
              onClick={() => setActiveSubTab('rag_knowledge')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md font-medium transition-colors ${
                activeSubTab === 'rag_knowledge'
                  ? 'bg-[#232f3e] text-white shadow'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100/50'
              }`}
            >
              <Brain className="w-3.5 h-3.5" />
              <span>[F5] RAG</span>
              <span className="px-1.5 py-0.2 rounded text-[10px] bg-white text-blue-300">
                {ragModels.length}
              </span>
            </button>

            <button
              onClick={() => setActiveSubTab('journal')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md font-medium transition-colors ${
                activeSubTab === 'journal'
                  ? 'bg-[#232f3e] text-white shadow'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100/50'
              }`}
            >
              <BookMarked className="w-3.5 h-3.5" />
              <span>[F6] Journal</span>
              <span className="px-1.5 py-0.2 rounded text-[10px] bg-white text-blue-300">
                {journalEntries.length}
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* QUICK SELECTOR BAR & SEARCH (Shown for Dual Valuation) */}
      {activeSubTab === 'dual_valuation' && (
      <div className="bg-white border border-gray-200 rounded-xl p-3 shadow-sm">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs font-semibold text-gray-800">
            <Activity className="w-4 h-4 text-[#007185]" />
            <span>Select Asset or Enter Ticker:</span>
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (symbolInput.trim()) loadAsset(symbolInput.trim().toUpperCase());
            }}
            className="flex items-center gap-2 w-full sm:w-auto"
          >
            <div className="relative flex-1 sm:w-64">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
              <input
                type="text"
                value={symbolInput}
                onChange={(e) => setSymbolInput(e.target.value)}
                placeholder="e.g. MTNGH, GCB, NVDA, VOO..."
                className="w-full pl-9 pr-3 py-1.5 bg-white border border-gray-200 rounded-md text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
              />
            </div>
            <button
              type="submit"
              disabled={loadingQuote}
              className="px-3.5 py-1.5 bg-[#232f3e] hover:bg-blue-500 text-white rounded-md text-xs font-medium transition-colors flex items-center gap-1 shrink-0"
            >
              {loadingQuote ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
              Analyze
            </button>
          </form>
        </div>

        {/* Quick Ticker Chips */}
        <div className="flex flex-wrap items-center gap-2 pt-2 mt-2 border-t border-gray-200">
          <span className="text-[11px] text-gray-500 font-medium mr-1">Ghana (GSE):</span>
          {quickPicks
            .filter((p) => p.exchange === 'GSE')
            .map((p) => (
              <button
                key={p.symbol}
                onClick={() => {
                  setSymbolInput(p.symbol);
                  loadAsset(p.symbol);
                }}
                className={`px-2.5 py-1 rounded text-[11px] font-mono transition-colors flex items-center gap-1.5 ${
                  selectedAsset === p.symbol
                    ? 'bg-[#232f3e]/20 text-[#007185] border border-blue-600/40'
                    : 'bg-white text-gray-600 hover:text-gray-900 border border-gray-200'
                }`}
              >
                <span>🇬🇭</span>
                <span className="font-bold">{p.symbol}</span>
                <span className="text-[10px] text-gray-500">({p.tag})</span>
              </button>
            ))}

          <span className="text-[11px] text-gray-500 font-medium ml-2 mr-1">Global & ETFs:</span>
          {quickPicks
            .filter((p) => p.exchange !== 'GSE')
            .map((p) => (
              <button
                key={p.symbol}
                onClick={() => {
                  setSymbolInput(p.symbol);
                  loadAsset(p.symbol);
                }}
                className={`px-2.5 py-1 rounded text-[11px] font-mono transition-colors flex items-center gap-1.5 ${
                  selectedAsset === p.symbol
                    ? 'bg-[#232f3e]/20 text-[#007185] border border-blue-600/40'
                    : 'bg-white text-gray-600 hover:text-gray-900 border border-gray-200'
                }`}
              >
                <span>🌐</span>
                <span className="font-bold">{p.symbol}</span>
                <span className="text-[10px] text-gray-500">({p.tag})</span>
              </button>
            ))}
        </div>
      </div>
      )}

      {/* TAB 1: DUAL VALUATION LAB */}
      {activeSubTab === 'dual_valuation' && (
        <div className="space-y-6">
          {/* ASSET CURRENT HEADER & SUMMARY */}
          {quote && (
            <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                <div>
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className="text-2xl font-black text-white tracking-tight">{quote.name}</span>
                    <span className="px-2.5 py-0.5 rounded bg-[#232f3e]/20 text-[#007185] border border-blue-600/40 text-xs font-bold font-mono">
                      {quote.symbol}
                    </span>
                    <span className="text-xs px-2.5 py-0.5 rounded bg-gray-100 text-gray-800 font-mono border border-gray-200">
                      {quote.exchange}
                    </span>
                  </div>
                  <p className="text-xs text-gray-600 mt-1.5 flex items-center gap-2 flex-wrap font-mono">
                    <span>SECTOR: <strong className="text-gray-900">{quote.sector || 'Equities'}</strong></span>
                    <span>•</span>
                    <span>FEED: <strong className="text-gray-900">{quote.source}</strong></span>
                    <span>•</span>
                    <span>CURRENCY: <strong className="text-[#007185]">{quote.currency}</strong></span>
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-6">
                  {/* Market Price */}
                  <div>
                    <span className="text-[10px] uppercase tracking-wider text-gray-600 block font-mono font-semibold">
                      LAST TRADED PRICE
                    </span>
                    <div className="flex items-baseline gap-2 mt-0.5">
                      <span className="text-3xl font-black text-white font-mono tabular-nums">
                        {quote.currency === 'USD' ? '$' : 'GH₵'}{(quote.price ?? 0).toFixed(2)}
                      </span>
                      {typeof quote.changePercent === 'number' && (
                        <span
                          className={`text-xs font-bold font-mono px-2 py-0.5 rounded flex items-center ${
                            quote.changePercent >= 0
                              ? 'bg-[#007600]/10 text-[#007600] border border-emerald-500/30'
                              : 'bg-[#B12704]/10 text-[#B12704] border border-rose-500/30'
                          }`}
                        >
                          {quote.changePercent >= 0 ? (
                            <TrendingUp className="w-3.5 h-3.5 mr-0.5" />
                          ) : (
                            <TrendingDown className="w-3.5 h-3.5 mr-0.5" />
                          )}
                          {quote.changePercent >= 0 ? '+' : ''}
                          {quote.changePercent.toFixed(2)}%
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Synthesized Fair Value */}
                  {valuation && typeof valuation.synthesizedFairValue === 'number' && (
                    <div className="pl-6 border-l border-gray-200">
                      <span className="text-[10px] uppercase tracking-wider text-gray-600 block font-mono font-semibold">
                        SYNTHESIZED INTRINSIC VALUE
                      </span>
                      <div className="flex items-baseline gap-2 mt-0.5">
                        <span className="text-3xl font-black text-[#007185] font-mono tabular-nums">
                          {quote.currency === 'USD' ? '$' : 'GH₵'}{valuation.synthesizedFairValue.toFixed(2)}
                        </span>
                        <span
                          className={`text-xs font-bold font-mono px-2.5 py-0.5 rounded ${
                            (valuation.synthesizedMarginOfSafety ?? 0) >= 15
                              ? 'bg-emerald-500/20 text-[#007600] border border-emerald-500/30'
                              : (valuation.synthesizedMarginOfSafety ?? 0) >= 0
                              ? 'bg-gray-100/80 text-gray-800 border border-gray-300'
                              : 'bg-rose-500/20 text-[#B12704] border border-rose-500/30'
                          }`}
                        >
                          {(valuation.synthesizedMarginOfSafety ?? 0) >= 0 ? '+' : ''}
                          {valuation.synthesizedMarginOfSafety ?? 0}% Margin
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Verdict Badge & Journal Action Button */}
                  {valuation && (
                    <div className="flex flex-col items-end gap-2">
                      <div
                        className={`px-3.5 py-1.5 rounded font-bold font-mono text-xs uppercase tracking-wider shadow-sm ${
                          valuation.institutionalVerdict === 'STRONG BUY' ||
                          valuation.institutionalVerdict === 'MARGIN OF SAFETY'
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                            : valuation.institutionalVerdict === 'FAIR VALUE'
                            ? 'bg-gray-100 text-gray-800 border border-gray-300'
                            : 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                        }`}
                      >
                        ● {valuation.institutionalVerdict}
                      </div>

                      <button
                        onClick={() => setJournalModalOpen(true)}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 hover:bg-slate-700 text-gray-900 rounded text-xs font-semibold transition-colors border border-gray-200 shadow-sm"
                      >
                        <Plus className="w-3.5 h-3.5 text-[#c45500]" />
                        Log Thesis in Journal
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* DUAL VALUATION FOOTBALL FIELD VISUALIZATION */}
          {valuation && quote && (
            <div className="bg-gray-100 border border-gray-200 rounded-2xl p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Sliders className="w-4 h-4 text-[#007185]" />
                  <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                    Institutional Valuation Football Field Range
                  </h3>
                </div>
                <span className="text-xs text-gray-600">
                  Target Price Range ({quote.currency})
                </span>
              </div>

              {/* Range Chart */}
              <div className="bg-slate-950 p-5 rounded-xl border border-gray-200/80 space-y-5">
                {/* Method 1: DCF */}
                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs">
                    <span className="font-semibold text-gray-800 flex items-center gap-1.5">
                      <Calculator className="w-3.5 h-3.5 text-[#007600]" />
                      Discounted Cash Flow (DCF - 5Y Free Cash Flow)
                    </span>
                    <span className="font-mono text-[#007600] font-bold">
                      {quote.currency} {(valuation.dcf.intrinsicValue ?? 0).toFixed(2)}
                      <span className="text-gray-600 text-[11px] ml-1.5">
                        ({(valuation.dcf.marginOfSafetyPercent ?? 0) >= 0 ? '+' : ''}
                        {valuation.dcf.marginOfSafetyPercent ?? 0}% margin)
                      </span>
                    </span>
                  </div>
                  <div className="h-3 bg-gray-100 rounded-full overflow-hidden relative">
                    <div
                      className="h-full bg-gradient-to-r from-emerald-600 to-emerald-400 rounded-full transition-all duration-500"
                      style={{
                        width: `${Math.min(
                          100,
                          Math.max(10, ((valuation.dcf.intrinsicValue ?? 0) / (Math.max(0.01, quote.price) * 1.6)) * 100)
                        )}%`,
                      }}
                    />
                  </div>
                </div>

                {/* Method 2: Benjamin Graham Number */}
                {typeof valuation.multiples.grahamNumber === 'number' && (
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs">
                      <span className="font-semibold text-gray-800 flex items-center gap-1.5">
                        <ShieldCheck className="w-3.5 h-3.5 text-[#007185]" />
                        Benjamin Graham Number (The Intelligent Investor)
                      </span>
                      <span className="font-mono text-[#007185] font-bold">
                        {quote.currency} {valuation.multiples.grahamNumber.toFixed(2)}
                        <span className="text-gray-600 text-[11px] ml-1.5">
                          ({(valuation.multiples.grahamMarginPercent ?? 0) >= 0 ? '+' : ''}
                          {valuation.multiples.grahamMarginPercent ?? 0}% margin)
                        </span>
                      </span>
                    </div>
                    <div className="h-3 bg-gray-100 rounded-full overflow-hidden relative">
                      <div
                        className="h-full bg-gradient-to-r from-indigo-600 to-indigo-400 rounded-full transition-all duration-500"
                        style={{
                          width: `${Math.min(
                            100,
                            Math.max(10, (valuation.multiples.grahamNumber / (Math.max(0.01, quote.price) * 1.6)) * 100)
                          )}%`,
                        }}
                      />
                    </div>
                  </div>
                )}

                {/* Method 3: Peter Lynch Fair Value */}
                {typeof valuation.multiples.peterLynchFairValue === 'number' && (
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs">
                      <span className="font-semibold text-gray-800 flex items-center gap-1.5">
                        <TrendingUp className="w-3.5 h-3.5 text-[#c45500]" />
                        Peter Lynch Fair Value (One Up On Wall Street - PEG = 1.0)
                      </span>
                      <span className="font-mono text-[#c45500] font-bold">
                        {quote.currency} {valuation.multiples.peterLynchFairValue.toFixed(2)}
                      </span>
                    </div>
                    <div className="h-3 bg-gray-100 rounded-full overflow-hidden relative">
                      <div
                        className="h-full bg-gradient-to-r from-amber-600 to-amber-400 rounded-full transition-all duration-500"
                        style={{
                          width: `${Math.min(
                            100,
                            Math.max(
                              10,
                              (valuation.multiples.peterLynchFairValue / (Math.max(0.01, quote.price) * 1.6)) * 100
                            )
                          )}%`,
                        }}
                      />
                    </div>
                  </div>
                )}

                {/* Market Benchmark Marker */}
                <div className="pt-2 flex items-center justify-between text-xs border-t border-gray-200 text-gray-600">
                  <span>
                    Current Market Price: <strong className="text-white">{quote.currency} {(quote.price ?? 0).toFixed(2)}</strong>
                  </span>
                  <span>
                    Consensus Dual Fair Value:{' '}
                    <strong className="text-indigo-300">{quote.currency} {(valuation.synthesizedFairValue ?? 0).toFixed(2)}</strong>
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* TWO-COLUMN BREAKDOWN: DCF ASSUMPTIONS & MULTIPLES */}
          {valuation && quote && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* MODEL 1: DCF Cash Flow Engine */}
              <div className="bg-gray-100 border border-gray-200 rounded-2xl p-6 space-y-5">
                <div className="flex items-center justify-between border-b border-gray-200 pb-3">
                  <div className="flex items-center gap-2">
                    <Calculator className="w-4 h-4 text-[#007600]" />
                    <h4 className="text-sm font-bold text-white uppercase tracking-wider">
                      Model 1: Discounted Cash Flow (DCF)
                    </h4>
                  </div>
                  <span className="text-xs px-2 py-0.5 rounded bg-[#007600]/10 text-[#007600] border border-[#007600]/20">
                    Grounded in Damodaran
                  </span>
                </div>

                {/* Projected Free Cash Flows (5 Years) */}
                <div className="space-y-2">
                  <span className="text-xs font-semibold text-gray-800">
                    Projected 5-Year Free Cash Flows:
                  </span>
                  <div className="grid grid-cols-5 gap-2">
                    {Array.isArray(valuation?.dcf?.projectedCashFlows) && valuation.dcf.projectedCashFlows.map((cf, i) => (
                      <div key={i} className="bg-slate-950 p-2.5 rounded-xl border border-gray-200 text-center">
                        <span className="text-[10px] text-gray-500 block font-medium">Year {cf.year}</span>
                        <span className="text-xs font-bold text-gray-900 font-mono">
                          {quote.currency === 'USD' ? '$' : 'GH₵'}
                          {cf.cashFlow != null ? (cf.cashFlow > 1000 ? `${(cf.cashFlow / 1000).toFixed(1)}k` : cf.cashFlow.toFixed(1)) : '0'}
                        </span>
                        <span className="text-[9px] text-gray-500 block mt-0.5">
                          PV: {cf.presentValue != null ? (cf.presentValue > 1000 ? `${(cf.presentValue / 1000).toFixed(1)}k` : cf.presentValue.toFixed(1)) : '0'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* DCF Sliders for Sensitivity Analysis */}
                <div className="bg-slate-950/70 p-4 rounded-xl border border-gray-200 space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-gray-800 flex items-center gap-1.5">
                      <Sliders className="w-3.5 h-3.5 text-[#007185]" />
                      Adjust DCF Sensitivity Assumptions:
                    </span>
                    <button
                      onClick={recalculateValuation}
                      disabled={loadingValuation}
                      className="px-2.5 py-1 bg-[#131921]/80 hover:bg-[#131921] text-white rounded-lg text-xs font-medium transition-colors flex items-center gap-1"
                    >
                      {loadingValuation ? (
                        <RefreshCw className="w-3 h-3 animate-spin" />
                      ) : (
                        <Check className="w-3 h-3" />
                      )}
                      Apply
                    </button>
                  </div>

                  {/* Growth Rate Slider */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-gray-600">5Y Revenue/FCF Growth Rate:</span>
                      <span className="font-bold text-indigo-300">{customGrowthRate}%</span>
                    </div>
                    <input
                      type="range"
                      min={1}
                      max={40}
                      step={1}
                      value={customGrowthRate}
                      onChange={(e) => setCustomGrowthRate(Number(e.target.value))}
                      className="w-full accent-indigo-500 h-1.5 bg-gray-100 rounded-lg cursor-pointer"
                    />
                  </div>

                  {/* Discount Rate (WACC) Slider */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-gray-600">
                        Discount Rate / Cost of Capital (WACC):
                      </span>
                      <span className="font-bold text-emerald-300">{customDiscountRate}%</span>
                    </div>
                    <input
                      type="range"
                      min={6}
                      max={35}
                      step={0.5}
                      value={customDiscountRate}
                      onChange={(e) => setCustomDiscountRate(Number(e.target.value))}
                      className="w-full accent-emerald-500 h-1.5 bg-gray-100 rounded-lg cursor-pointer"
                    />
                    <div className="flex justify-between text-[10px] text-gray-500">
                      <span>US/Global (8-10%)</span>
                      <span>Frontier Market / GSE (18-22%)</span>
                    </div>
                  </div>

                  {/* Terminal Rate Slider */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-gray-600">Perpetual Terminal Growth Rate:</span>
                      <span className="font-bold text-amber-300">{customTerminalRate}%</span>
                    </div>
                    <input
                      type="range"
                      min={1}
                      max={8}
                      step={0.5}
                      value={customTerminalRate}
                      onChange={(e) => setCustomTerminalRate(Number(e.target.value))}
                      className="w-full accent-amber-500 h-1.5 bg-gray-100 rounded-lg cursor-pointer"
                    />
                  </div>
                </div>

                {/* DCF Output Stats */}
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="bg-slate-950 p-3 rounded-xl border border-gray-200">
                    <span className="text-gray-600 block text-[11px]">PV of Terminal Value</span>
                    <span className="font-bold text-gray-900 text-sm font-mono">
                      {quote.currency} {(valuation.dcf.terminalPV ?? valuation.dcf.terminalValue ?? 0).toFixed(2)}
                    </span>
                  </div>
                  <div className="bg-slate-950 p-3 rounded-xl border border-gray-200">
                    <span className="text-gray-600 block text-[11px]">Intrinsic Value Per Share</span>
                    <span className="font-bold text-[#007600] text-sm font-mono">
                      {quote.currency} {(valuation.dcf.intrinsicValue ?? 0).toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>

              {/* MODEL 2: Graham & Lynch Multiples Valuation */}
              <div className="bg-gray-100 border border-gray-200 rounded-2xl p-6 space-y-5">
                <div className="flex items-center justify-between border-b border-gray-200 pb-3">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-[#007185]" />
                    <h4 className="text-sm font-bold text-white uppercase tracking-wider">
                      Model 2: Graham & Lynch Multiples
                    </h4>
                  </div>
                  <span className="text-xs px-2 py-0.5 rounded bg-indigo-500/10 text-[#007185] border border-indigo-500/20">
                    Grounded in Graham & Lynch
                  </span>
                </div>

                {/* Fundamentals Overview */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                  <div className="bg-slate-950 p-2.5 rounded-xl border border-gray-200 text-center">
                    <span className="text-[10px] text-gray-500 block">P/E Ratio</span>
                    <span className="font-mono font-bold text-white">
                      {typeof (quote.peRatio ?? (quote as any).pe) === 'number' ? `${(quote.peRatio ?? (quote as any).pe).toFixed(1)}x` : 'N/A'}
                    </span>
                  </div>
                  <div className="bg-slate-950 p-2.5 rounded-xl border border-gray-200 text-center">
                    <span className="text-[10px] text-gray-500 block">P/B Ratio</span>
                    <span className="font-mono font-bold text-white">
                      {typeof (quote.pbRatio ?? (quote as any).pb) === 'number' ? `${(quote.pbRatio ?? (quote as any).pb).toFixed(2)}x` : 'N/A'}
                    </span>
                  </div>
                  <div className="bg-slate-950 p-2.5 rounded-xl border border-gray-200 text-center">
                    <span className="text-[10px] text-gray-500 block">EPS (TTM)</span>
                    <span className="font-mono font-bold text-white">
                      {typeof quote.eps === 'number' ? `${quote.currency} ${quote.eps.toFixed(2)}` : 'N/A'}
                    </span>
                  </div>
                  <div className="bg-slate-950 p-2.5 rounded-xl border border-gray-200 text-center">
                    <span className="text-[10px] text-gray-500 block">Div Yield</span>
                    <span className="font-mono font-bold text-[#007600]">
                      {typeof quote.dividendYield === 'number' ? `${quote.dividendYield.toFixed(1)}%` : '0.0%'}
                    </span>
                  </div>
                </div>

                {/* Benjamin Graham Formula */}
                <div className="bg-slate-950 p-4 rounded-xl border border-gray-200 space-y-2">
                  <div className="flex justify-between items-start">
                    <div>
                      <h5 className="text-xs font-bold text-white flex items-center gap-1.5">
                        <ShieldCheck className="w-3.5 h-3.5 text-[#007185]" />
                        Benjamin Graham Number
                      </h5>
                      <p className="text-[11px] text-gray-600 mt-0.5">
                        Max price a defensive value investor should pay: √(22.5 × EPS × BVPS)
                      </p>
                    </div>
                    {typeof valuation.multiples.grahamNumber === 'number' && (
                      <span className="text-sm font-extrabold font-mono text-indigo-300">
                        {quote.currency} {valuation.multiples.grahamNumber.toFixed(2)}
                      </span>
                    )}
                  </div>
                  {valuation.multiples.grahamMarginPercent !== undefined && (
                    <div className="flex items-center gap-2 text-xs">
                      <span className="text-gray-600">Graham Margin of Safety:</span>
                      <span
                        className={`font-bold ${
                          valuation.multiples.grahamMarginPercent >= 0
                            ? 'text-[#007600]'
                            : 'text-[#B12704]'
                        }`}
                      >
                        {valuation.multiples.grahamMarginPercent >= 0 ? '+' : ''}
                        {valuation.multiples.grahamMarginPercent}%
                      </span>
                    </div>
                  )}
                </div>

                {/* Peter Lynch Fair Value */}
                <div className="bg-slate-950 p-4 rounded-xl border border-gray-200 space-y-2">
                  <div className="flex justify-between items-start">
                    <div>
                      <h5 className="text-xs font-bold text-white flex items-center gap-1.5">
                        <TrendingUp className="w-3.5 h-3.5 text-[#c45500]" />
                        Peter Lynch Fair Value (PEG Ratio)
                      </h5>
                      <p className="text-[11px] text-gray-600 mt-0.5">
                        P/E should match earnings growth rate: PEG = 1.0
                      </p>
                    </div>
                    {typeof valuation.multiples.peterLynchFairValue === 'number' && (
                      <span className="text-sm font-extrabold font-mono text-amber-300">
                        {quote.currency} {valuation.multiples.peterLynchFairValue.toFixed(2)}
                      </span>
                    )}
                  </div>
                  {typeof valuation.multiples.pegRatio === 'number' && (
                    <div className="flex items-center gap-2 text-xs">
                      <span className="text-gray-600">Current PEG Ratio:</span>
                      <span
                        className={`font-bold ${
                          valuation.multiples.pegRatio <= 1.0 ? 'text-[#007600]' : 'text-[#c45500]'
                        }`}
                      >
                        {valuation.multiples.pegRatio.toFixed(2)}
                        {valuation.multiples.pegRatio <= 1.0 ? ' (Attractive Growth Value)' : ' (Premium)'}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* GROUNDED RAG PRINCIPLES & AI EXECUTIVE SYNTHESIS */}
          {valuation && (
            <div className="bg-gray-100 border border-gray-200 rounded-2xl p-6 space-y-5">
              <div className="flex items-center justify-between border-b border-gray-200 pb-3">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-[#c45500]" />
                  <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                    Institutional AI Executive Synthesis (Gemini 3.8 Flash)
                  </h3>
                </div>
                <span className="text-xs text-gray-600">
                  Grounded in {Array.isArray(valuation?.appliedMentalModels) ? valuation.appliedMentalModels.length : 0} library books
                </span>
              </div>

              {/* Synthesis Text */}
              <div className="bg-slate-950 p-5 rounded-xl border border-gray-200 text-xs text-gray-800 leading-relaxed whitespace-pre-line font-sans">
                {valuation.aiExecutiveSummary}
              </div>

              {/* Applied Books Cards */}
              <div className="space-y-3">
                <span className="text-xs font-bold text-gray-600 uppercase tracking-wider">
                  Book Principles Directly Applied to this Asset:
                </span>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {Array.isArray(valuation?.appliedMentalModels) && valuation.appliedMentalModels.map((m, idx) => (
                    <div
                      key={m.id || `applied_model_${idx}`}
                      className="bg-slate-950 p-4 rounded-xl border border-gray-200 space-y-2 hover:border-gray-300 transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-white">{m.modelName}</span>
                        {m.category && (
                          <span className="text-[10px] px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300">
                            {m.category}
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-gray-600 flex items-center gap-1">
                        <BookOpen className="w-3 h-3 text-[#007185] shrink-0" />
                        <span className="text-gray-900 font-medium">{m.bookTitle}</span> • {m.author}
                      </p>
                      <p className="text-xs text-gray-800">{m.corePrinciple || m.rationale}</p>
                      {(m.valuationApplication || m.rationale) && (
                        <div className="pt-2 border-t border-gray-200 text-[11px] text-[#007600]">
                          <strong>Valuation Application:</strong> {m.valuationApplication || m.rationale}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: RAG MENTAL MODELS KNOWLEDGE REPOSITORY */}
      {activeSubTab === 'rag_knowledge' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 bg-gray-100 border border-gray-200 rounded-2xl">
            <div>
              <h3 className="text-base font-bold text-white">Dynamic RAG Mental Model Repository</h3>
              <p className="text-xs text-gray-600 mt-0.5">
                Every business and investment book in your catalog extracts structured mental models into this store to power AI valuations and analyses.
              </p>
            </div>

            <button
              onClick={() => setExtractModalOpen(true)}
              className="flex items-center gap-2 px-4 py-2 bg-[#131921] hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold shadow-md shadow-indigo-600/20 transition-all shrink-0"
            >
              <Sparkles className="w-4 h-4" />
              Extract from Any Book
            </button>
          </div>

          {/* Model Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.isArray(ragModels) && ragModels.map((model) => (
              <div
                key={model.id}
                className="bg-gray-100 border border-gray-200 rounded-2xl p-5 space-y-3 hover:border-indigo-500/40 transition-colors flex flex-col justify-between"
              >
                <div className="space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <h4 className="text-sm font-bold text-white tracking-tight">{model.modelName}</h4>
                    <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                      {model.category}
                    </span>
                  </div>

                  <p className="text-xs text-gray-600 flex items-center gap-1.5">
                    <BookOpen className="w-3.5 h-3.5 text-[#007185] shrink-0" />
                    <span>
                      <strong className="text-gray-900">{model.bookTitle}</strong> by {model.author}
                    </span>
                  </p>

                  <p className="text-xs text-gray-800 leading-relaxed pt-1">
                    {model.corePrinciple}
                  </p>

                  <div className="bg-slate-950 p-2.5 rounded-xl border border-gray-200 text-xs space-y-1">
                    <span className="text-[10px] font-bold text-gray-600 uppercase tracking-wider block">
                      Valuation Rule:
                    </span>
                    <span className="text-gray-800 text-[11px] leading-snug block">
                      {model.valuationApplication}
                    </span>
                  </div>
                </div>

                {model.redFlags && model.redFlags.length > 0 && (
                  <div className="pt-2 border-t border-gray-200 text-[11px] text-[#B12704] flex items-start gap-1.5">
                    <ShieldAlert className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                    <span>Red Flag: {model.redFlags[0]}</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 3: INVESTMENT THESIS JOURNAL */}
      {activeSubTab === 'journal' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 bg-gray-100 border border-gray-200 rounded-2xl">
            <div>
              <h3 className="text-base font-bold text-white">Investment Thesis & Decision Journal</h3>
              <p className="text-xs text-gray-600 mt-0.5">
                Log investment decisions, clear invalidation criteria, and which book frameworks informed each thesis.
              </p>
            </div>

            <button
              onClick={() => setJournalModalOpen(true)}
              className="flex items-center gap-2 px-4 py-2 bg-[#131921] hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold shadow-md shadow-indigo-600/20 transition-all shrink-0"
            >
              <Plus className="w-4 h-4" />
              New Thesis Entry
            </button>
          </div>

          {/* Journal Entries List */}
          <div className="space-y-4">
            {!Array.isArray(journalEntries) || journalEntries.length === 0 ? (
              <div className="p-12 text-center bg-gray-100 border border-gray-200 rounded-2xl text-gray-600">
                <BookMarked className="w-10 h-10 text-slate-600 mx-auto mb-3" />
                <p className="text-sm font-medium">No journal entries logged yet.</p>
                <p className="text-xs text-gray-500 mt-1">
                  Run a valuation analysis and log your first investment thesis!
                </p>
              </div>
            ) : (
              journalEntries.map((entry) => (
                <div
                  key={entry.id}
                  className="bg-gray-100 border border-gray-200 rounded-2xl p-6 space-y-4 hover:border-gray-300 transition-colors"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <span
                        className={`px-2.5 py-1 rounded-lg text-xs font-bold uppercase tracking-wider ${
                          entry.action === 'BUY'
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                            : entry.action === 'WATCH'
                            ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                            : 'bg-gray-100 text-gray-600'
                        }`}
                      >
                        {entry.action}
                      </span>
                      <span className="text-base font-bold text-white">{entry.assetName}</span>
                      <span className="font-mono text-xs px-2 py-0.5 rounded bg-slate-950 text-indigo-300 border border-gray-200">
                        {entry.symbol}
                      </span>
                    </div>

                    <div className="flex items-center gap-4 text-xs">
                      <div>
                        <span className="text-gray-500 text-[10px] block">Entry Price</span>
                        <span className="font-mono font-bold text-white">
                          {entry.currency} {(entry.entryPrice ?? 0).toFixed(2)}
                        </span>
                      </div>
                      {typeof entry.targetPrice === 'number' && (
                        <div>
                          <span className="text-gray-500 text-[10px] block">Target Price</span>
                          <span className="font-mono font-bold text-[#007185]">
                            {entry.currency} {entry.targetPrice.toFixed(2)}
                          </span>
                        </div>
                      )}
                      {typeof entry.stopOrReviewPrice === 'number' && (
                        <div>
                          <span className="text-gray-500 text-[10px] block">Review Level</span>
                          <span className="font-mono font-bold text-[#B12704]">
                            {entry.currency} {entry.stopOrReviewPrice.toFixed(2)}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Thesis Text */}
                  <div className="space-y-1">
                    <span className="text-[10px] uppercase font-bold text-gray-500 tracking-wider">
                      Core Investment Thesis:
                    </span>
                    <p className="text-xs text-gray-900 leading-relaxed bg-slate-950 p-3 rounded-xl border border-gray-200">
                      {entry.thesis}
                    </p>
                  </div>

                  {/* Invalidation Criteria */}
                  {entry.invalidationCriteria && (
                    <div className="space-y-1">
                      <span className="text-[10px] uppercase font-bold text-[#B12704] tracking-wider">
                        Strict Invalidation Criteria (When to Exit):
                      </span>
                      <p className="text-xs text-gray-800 leading-relaxed bg-slate-950 p-3 rounded-xl border border-rose-950/40">
                        {entry.invalidationCriteria}
                      </p>
                    </div>
                  )}

                  {/* Applied Books */}
                  {Array.isArray(entry.appliedBooks) && entry.appliedBooks.length > 0 && (
                    <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-gray-200">
                      <span className="text-[10px] text-gray-500 font-medium">Applied Principles:</span>
                      {entry.appliedBooks.map((b, i) => (
                        <span
                          key={i}
                          className="text-[11px] px-2.5 py-0.5 rounded-full bg-slate-950 text-indigo-300 border border-gray-200"
                        >
                          {b}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* SUB-TAB: PORTFOLIO & STRESS TESTING */}
      {activeSubTab === 'portfolio_stress' && <PortfolioStressView />}

      {/* SUB-TAB: PEER COMPARISON & SCREENER */}
      {activeSubTab === 'peer_screener' && <PeerComparisonScreenerView />}

      {/* SUB-TAB: MACROECONOMIC BENCHMARKS & BOG */}
      {activeSubTab === 'macro_intelligence' && <MacroIntelligenceView />}

      {/* EXTRACT MENTAL MODELS MODAL */}
      {extractModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-gray-100 border border-gray-200 rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-[#c45500]" />
                <h4 className="text-base font-bold text-white">Extract Mental Models from Book</h4>
              </div>
              <button
                onClick={() => setExtractModalOpen(false)}
                className="text-gray-600 hover:text-white text-xs"
              >
                ✕ Close
              </button>
            </div>

            <p className="text-xs text-gray-600">
              Provide any book title and author or paste chapter notes. Gemini 3.8 Flash will extract structured mental models, core principles, valuation rules, and red flags directly into the RAG repository.
            </p>

            {extractSuccess && (
              <div className="p-3 bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 rounded-xl text-xs flex items-center gap-2">
                <Check className="w-4 h-4 shrink-0" />
                {extractSuccess}
              </div>
            )}

            <form onSubmit={handleExtractMentalModels} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-gray-800 block mb-1">
                  Book Title *
                </label>
                <input
                  type="text"
                  required
                  value={extractTitle}
                  onChange={(e) => setExtractTitle(e.target.value)}
                  placeholder="e.g. Competitive Strategy, Zero to One, Margin of Safety..."
                  className="w-full px-3 py-2 bg-slate-950 border border-gray-200 rounded-xl text-xs text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-800 block mb-1">
                  Author (optional)
                </label>
                <input
                  type="text"
                  value={extractAuthor}
                  onChange={(e) => setExtractAuthor(e.target.value)}
                  placeholder="e.g. Michael Porter, Peter Thiel, Seth Klarman..."
                  className="w-full px-3 py-2 bg-slate-950 border border-gray-200 rounded-xl text-xs text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-800 block mb-1">
                  Custom Notes or Key Ideas (optional)
                </label>
                <textarea
                  rows={3}
                  value={extractNotes}
                  onChange={(e) => setExtractNotes(e.target.value)}
                  placeholder="Paste any highlights, chapter notes, or specific valuation rules..."
                  className="w-full px-3 py-2 bg-slate-950 border border-gray-200 rounded-xl text-xs text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setExtractModalOpen(false)}
                  className="px-4 py-2 bg-gray-100 hover:bg-slate-700 text-gray-800 rounded-xl text-xs font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={extracting}
                  className="px-4 py-2 bg-[#131921] hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold transition-colors flex items-center gap-1.5"
                >
                  {extracting ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      Extracting with Gemini...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-3.5 h-3.5" />
                      Extract Models
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* NEW JOURNAL THESIS MODAL */}
      {journalModalOpen && quote && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-gray-100 border border-gray-200 rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <BookMarked className="w-5 h-5 text-[#007185]" />
                <h4 className="text-base font-bold text-white">Log Investment Thesis</h4>
              </div>
              <button
                onClick={() => setJournalModalOpen(false)}
                className="text-gray-600 hover:text-white text-xs"
              >
                ✕ Close
              </button>
            </div>

            <div className="flex items-center justify-between p-3 bg-slate-950 rounded-xl border border-gray-200 text-xs">
              <div>
                <span className="font-bold text-white">{quote.name} ({quote.symbol})</span>
                <span className="text-gray-500 block">{quote.exchange}</span>
              </div>
              <div className="text-right font-mono font-bold text-indigo-300">
                {quote.currency} {(quote.price ?? 0).toFixed(2)}
              </div>
            </div>

            <form onSubmit={handleSaveJournal} className="space-y-4">
              <div className="grid grid-cols-3 gap-2">
                {(['BUY', 'WATCH', 'PASS'] as const).map((act) => (
                  <button
                    key={act}
                    type="button"
                    onClick={() => setNewJournalAction(act)}
                    className={`py-2 rounded-xl text-xs font-bold transition-all ${
                      newJournalAction === act
                        ? act === 'BUY'
                          ? 'bg-emerald-600 text-white'
                          : act === 'WATCH'
                          ? 'bg-amber-600 text-white'
                          : 'bg-slate-700 text-white'
                        : 'bg-slate-950 text-gray-600 border border-gray-200 hover:text-white'
                    }`}
                  >
                    {act}
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-gray-800 block mb-1">
                    Target Exit Price ({quote.currency})
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={newJournalTarget}
                    onChange={(e) => setNewJournalTarget(e.target.value)}
                    placeholder={valuation?.synthesizedFairValue != null ? valuation.synthesizedFairValue.toFixed(2) : ''}
                    className="w-full px-3 py-2 bg-slate-950 border border-gray-200 rounded-xl text-xs text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-gray-800 block mb-1">
                    Stop / Review Price ({quote.currency})
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={newJournalStop}
                    onChange={(e) => setNewJournalStop(e.target.value)}
                    placeholder={quote?.price != null ? (quote.price * 0.85).toFixed(2) : ''}
                    className="w-full px-3 py-2 bg-slate-950 border border-gray-200 rounded-xl text-xs text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-800 block mb-1">
                  Core Investment Thesis *
                </label>
                <textarea
                  required
                  rows={3}
                  value={newJournalThesis}
                  onChange={(e) => setNewJournalThesis(e.target.value)}
                  placeholder="Why does this asset possess a sustainable moat? What is the catalyst for fair value convergence?"
                  className="w-full px-3 py-2 bg-slate-950 border border-gray-200 rounded-xl text-xs text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-800 block mb-1">
                  Thesis Invalidation Criteria *
                </label>
                <textarea
                  required
                  rows={2}
                  value={newJournalInvalidation}
                  onChange={(e) => setNewJournalInvalidation(e.target.value)}
                  placeholder="What specific quantifiable event would prove this thesis wrong and trigger an exit?"
                  className="w-full px-3 py-2 bg-slate-950 border border-gray-200 rounded-xl text-xs text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setJournalModalOpen(false)}
                  className="px-4 py-2 bg-gray-100 hover:bg-slate-700 text-gray-800 rounded-xl text-xs font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingJournal}
                  className="px-4 py-2 bg-[#131921] hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold transition-colors"
                >
                  {savingJournal ? 'Saving...' : 'Save Thesis'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
