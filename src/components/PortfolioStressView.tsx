import { apiFetch } from '../lib/api';
import React, { useState, useEffect } from 'react';
import {
  Briefcase,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Zap,
  DollarSign,
  PieChart,
  Plus,
  ArrowRight,
  ShieldCheck,
  RefreshCw,
  Sliders,
  CheckCircle2,
} from 'lucide-react';

interface Holding {
  id: string;
  symbol: string;
  name: string;
  currency: 'GHS' | 'USD';
  exchange: string;
  shares: number;
  averageCost: number;
  currentPrice: number;
  marketValue: number;
  unrealizedPnL: number;
  unrealizedPnLPercent: number;
  allocationPercent: number;
  sector?: string;
}

interface PortfolioSummary {
  cashGHS: number;
  cashUSD: number;
  equityValueGHS: number;
  equityValueUSD: number;
  totalValueGHS: number;
  totalValueUSD: number;
  holdings: Holding[];
  riskMetrics: {
    topHoldingAllocationPercent: number;
    topThreeAllocationPercent: number;
    concentrationLevel: 'LOW' | 'MODERATE' | 'HIGH' | 'EXTREME';
    currencySplit: {
      ghsPercent: number;
      usdPercent: number;
    };
    sectorConcentration: Record<string, number>;
  };
}

interface StressTestResult {
  scenarioId: string;
  title: string;
  description: string;
  preTestPortfolioValueUSD: number;
  postTestPortfolioValueUSD: number;
  estimatedDrawdownPercent: number;
  affectedHoldings: {
    symbol: string;
    prePrice: number;
    postPrice: number;
    lossPercent: number;
    impactUSD: number;
    cause: string;
  }[];
  mitigationRecommendations: string[];
}

export const PortfolioStressView: React.FC = () => {
  const [summary, setSummary] = useState<PortfolioSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [tradeSymbol, setTradeSymbol] = useState('MTNGH');
  const [tradeShares, setTradeShares] = useState(100);
  const [tradeAction, setTradeAction] = useState<'BUY' | 'SELL'>('BUY');
  const [trading, setTrading] = useState(false);
  const [tradeMessage, setTradeMessage] = useState<string | null>(null);

  // Stress testing
  const [stressResult, setStressResult] = useState<StressTestResult | null>(null);
  const [stressing, setStressing] = useState(false);
  const [selectedScenario, setSelectedScenario] = useState<'CEDI_DEPRECIATION_15' | 'RATE_HIKE_300BPS' | 'TOP_HOLDING_CRASH_30' | 'TECH_DRAWDOWN_25'>('CEDI_DEPRECIATION_15');

  const fetchPortfolio = async () => {
    setLoading(true);
    try {
      const res = await apiFetch('/api/finance/portfolio');
      if (res.ok) {
        const data = await res.json();
        if (data && Array.isArray(data.holdings)) {
          setSummary(data);
        }
      }
    } catch (err) {
      console.error('Failed to fetch portfolio', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPortfolio();
  }, []);

  const handleExecuteTrade = async (e: React.FormEvent) => {
    e.preventDefault();
    setTrading(true);
    setTradeMessage(null);
    try {
      const res = await apiFetch('/api/finance/trade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: tradeAction,
          symbol: tradeSymbol,
          shares: tradeShares,
        }),
      });
      const data = await res.json();
      setTradeMessage(data.message || (data.success ? 'Order completed successfully.' : 'Order failed.'));
      await fetchPortfolio();
    } catch (err: any) {
      setTradeMessage(`Error: ${err.message}`);
    } finally {
      setTrading(false);
    }
  };

  const handleRunStressTest = async (scenario: 'CEDI_DEPRECIATION_15' | 'RATE_HIKE_300BPS' | 'TOP_HOLDING_CRASH_30' | 'TECH_DRAWDOWN_25') => {
    setSelectedScenario(scenario);
    setStressing(true);
    try {
      const res = await apiFetch('/api/finance/stress-test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scenario }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data && data.scenarioId) {
          setStressResult(data);
        }
      }
    } catch (err) {
      console.error('Failed to run stress test', err);
    } finally {
      setStressing(false);
    }
  };

  if (loading || !summary) {
    return (
      <div className="flex items-center justify-center p-12 bg-white border border-gray-200 rounded-lg shadow-sm">
        <RefreshCw className="w-5 h-5 text-[#f3a847] animate-spin mr-3" />
        <span className="text-gray-700 font-medium text-sm">Loading simulated institutional portfolio...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Portfolio Top Bar Stats (Bloomberg / Koyfin Density) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 bg-white border border-gray-200 rounded-lg shadow-sm">
          <span className="text-xs text-gray-500 font-medium uppercase tracking-wider block font-mono">
            Total Portfolio Value
          </span>
          <div className="text-2xl font-bold text-[#0f1111] font-mono tabular-nums mt-1">
            ${summary.totalValueUSD.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <span className="text-xs text-[#007600] font-mono font-medium block mt-0.5">
            ≈ GH₵{summary.totalValueGHS.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
        </div>

        <div className="p-4 bg-white border border-gray-200 rounded-lg shadow-sm">
          <span className="text-xs text-gray-500 font-medium uppercase tracking-wider block font-mono">
            Liquid Cash Reserves
          </span>
          <div className="text-xl font-bold text-[#0f1111] font-mono tabular-nums mt-1">
            GH₵{summary.cashGHS.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <span className="text-xs text-gray-500 font-mono font-medium block mt-0.5">
            + ${summary.cashUSD.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD
          </span>
        </div>

        <div className="p-4 bg-white border border-gray-200 rounded-lg shadow-sm">
          <span className="text-xs text-gray-500 font-medium uppercase tracking-wider block font-mono">
            Concentration Risk
          </span>
          <div className="text-base font-bold text-[#0f1111] mt-1 flex items-center gap-2">
            <span
              className={`px-2.5 py-0.5 rounded text-xs font-mono font-bold uppercase ${
                summary.riskMetrics.concentrationLevel === 'LOW'
                  ? 'bg-emerald-50 text-[#007600] border border-emerald-200'
                  : summary.riskMetrics.concentrationLevel === 'MODERATE'
                  ? 'bg-amber-50 text-[#b12704] border border-amber-200'
                  : 'bg-rose-50 text-rose-700 border border-rose-200'
              }`}
            >
              {summary.riskMetrics.concentrationLevel}
            </span>
          </div>
          <span className="text-[11px] text-gray-500 block mt-1">
            Top 1: {summary.riskMetrics.topHoldingAllocationPercent}% | Top 3: {summary.riskMetrics.topThreeAllocationPercent}%
          </span>
        </div>

        <div className="p-4 bg-white border border-gray-200 rounded-lg shadow-sm">
          <span className="text-xs text-gray-500 font-medium uppercase tracking-wider block font-mono">
            Currency Split
          </span>
          <div className="text-base font-bold text-[#0f1111] font-mono mt-1">
            {summary.riskMetrics.currencySplit.ghsPercent}% GHS / {summary.riskMetrics.currencySplit.usdPercent}% USD
          </div>
          <span className="text-[11px] text-[#007185] block mt-1">
            Dual Sovereign Hedged
          </span>
        </div>
      </div>

      {/* Main Grid: Holdings Table & Paper Trade Form */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Holdings Table (2 cols) */}
        <div className="lg:col-span-2 p-5 bg-white border border-gray-200 rounded-lg shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-gray-200 pb-3">
            <div className="flex items-center gap-2.5">
              <Briefcase className="w-4 h-4 text-[#007185]" />
              <h3 className="text-sm font-bold text-[#0f1111] tracking-tight">Active Portfolio Positions</h3>
            </div>
            <span className="text-xs text-gray-500 font-mono">{summary.holdings.length} Positions</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="text-gray-500 border-b border-gray-200 bg-gray-50/75 uppercase text-[10px] font-mono">
                <tr>
                  <th className="p-2.5">Asset</th>
                  <th className="p-2.5">Shares</th>
                  <th className="p-2.5">Avg Cost</th>
                  <th className="p-2.5">Price</th>
                  <th className="p-2.5">Market Value</th>
                  <th className="p-2.5">P&L</th>
                  <th className="p-2.5">Weight</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 font-mono">
                {Array.isArray(summary?.holdings) && summary.holdings.map((h) => (
                  <tr key={h.id} className="hover:bg-slate-50 transition-colors">
                    <td className="p-2.5">
                      <div className="font-bold text-[#0f1111]">{h.symbol}</div>
                      <div className="text-[10px] text-gray-500 font-sans truncate max-w-[130px]">{h.name}</div>
                    </td>
                    <td className="p-2.5 text-gray-700 tabular-nums">{h.shares.toLocaleString()}</td>
                    <td className="p-2.5 text-gray-600 tabular-nums">
                      {h.currency} {h.averageCost != null ? h.averageCost.toFixed(2) : '0.00'}
                    </td>
                    <td className="p-2.5 font-bold text-[#0f1111] tabular-nums">
                      {h.currency} {h.currentPrice != null ? h.currentPrice.toFixed(2) : '0.00'}
                    </td>
                    <td className="p-2.5 font-semibold text-gray-800 tabular-nums">
                      {h.currency} {h.marketValue.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>
                    <td className="p-2.5 tabular-nums">
                      <span
                        className={`font-bold ${
                          h.unrealizedPnLPercent >= 0 ? 'text-[#007600]' : 'text-[#b12704]'
                        }`}
                      >
                        {h.unrealizedPnLPercent >= 0 ? '+' : ''}
                        {h.unrealizedPnLPercent}%
                      </span>
                    </td>
                    <td className="p-2.5 text-gray-600 tabular-nums">{h.allocationPercent}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Paper Trade Form (1 col) */}
        <div className="p-5 bg-white border border-gray-200 rounded-lg shadow-sm space-y-4">
          <div className="flex items-center gap-2 border-b border-gray-200 pb-3">
            <Zap className="w-4 h-4 text-[#f3a847]" />
            <h3 className="text-sm font-bold text-[#0f1111]">Simulate Virtual Execution</h3>
          </div>
          <p className="text-xs text-gray-600">
            Execute paper transactions with live market feeds. Balances and cash reserves update immediately.
          </p>

          <form onSubmit={handleExecuteTrade} className="space-y-3 text-xs">
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setTradeAction('BUY')}
                className={`flex-1 py-2 rounded-md font-bold transition-all text-xs ${
                  tradeAction === 'BUY'
                    ? 'bg-[#007600] text-white shadow-sm'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200 border border-gray-200'
                }`}
              >
                BUY
              </button>
              <button
                type="button"
                onClick={() => setTradeAction('SELL')}
                className={`flex-1 py-2 rounded-md font-bold transition-all text-xs ${
                  tradeAction === 'SELL'
                    ? 'bg-[#b12704] text-white shadow-sm'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200 border border-gray-200'
                }`}
              >
                SELL
              </button>
            </div>

            <div>
              <label className="text-gray-700 font-medium block mb-1">Select Asset Symbol</label>
              <select
                value={tradeSymbol}
                onChange={(e) => setTradeSymbol(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-gray-300 rounded-md text-gray-900 text-xs focus:outline-none focus:border-[#f3a847] focus:ring-1 focus:ring-[#f3a847]"
              >
                <option value="MTNGH">MTNGH (MTN Ghana - GSE)</option>
                <option value="GCB">GCB (GCB Bank - GSE)</option>
                <option value="TOTAL">TOTAL (TotalEnergies - GSE)</option>
                <option value="SCB">SCB (Standard Chartered - GSE)</option>
                <option value="NVDA">NVDA (NVIDIA - NASDAQ)</option>
                <option value="VOO">VOO (S&P 500 ETF - NYSE)</option>
                <option value="AAPL">AAPL (Apple - NASDAQ)</option>
              </select>
            </div>

            <div>
              <label className="text-gray-700 font-medium block mb-1">Quantity (Units)</label>
              <input
                type="number"
                min="1"
                value={tradeShares}
                onChange={(e) => setTradeShares(parseInt(e.target.value, 10) || 1)}
                className="w-full px-3 py-2 bg-white border border-gray-300 rounded-md text-gray-900 font-mono text-xs focus:outline-none focus:border-[#f3a847] focus:ring-1 focus:ring-[#f3a847]"
              />
            </div>

            {tradeMessage && (
              <div className="p-2.5 rounded-md bg-amber-50 border border-amber-200 text-gray-800 text-xs">
                {tradeMessage}
              </div>
            )}

            <button
              type="submit"
              disabled={trading}
              className="w-full py-2.5 bg-[#ffd814] hover:bg-[#f7ca00] text-[#0f1111] border border-[#fcd200] font-bold rounded-md text-xs transition-colors shadow-sm disabled:opacity-50"
            >
              {trading ? 'Transmitting Order...' : `Execute ${tradeAction} Order`}
            </button>
          </form>
        </div>
      </div>

      {/* MACRO STRESS-TEST ENGINE SECTION */}
      <div className="p-5 bg-white border border-gray-200 rounded-lg shadow-sm space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-200 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-[#f3a847]" />
              <h3 className="text-sm font-bold text-[#0f1111]">Institutional Stress-Testing Sandbox</h3>
            </div>
            <p className="text-xs text-gray-600 mt-0.5">
              Simulate systemic FX shockwaves, interest rate cycles, and equity crashes across current portfolio weights.
            </p>
          </div>

          <div className="flex flex-wrap gap-2 text-xs">
            <button
              onClick={() => handleRunStressTest('CEDI_DEPRECIATION_15')}
              disabled={stressing}
              className={`px-3 py-1.5 rounded-md font-medium border transition-all ${
                selectedScenario === 'CEDI_DEPRECIATION_15'
                  ? 'bg-[#131921] text-white border-[#131921] shadow-sm'
                  : 'bg-white text-gray-700 border-gray-200 hover:border-gray-400'
              }`}
            >
              🇬🇭 Cedi 15% Depreciation
            </button>

            <button
              onClick={() => handleRunStressTest('RATE_HIKE_300BPS')}
              disabled={stressing}
              className={`px-3 py-1.5 rounded-md font-medium border transition-all ${
                selectedScenario === 'RATE_HIKE_300BPS'
                  ? 'bg-[#131921] text-white border-[#131921] shadow-sm'
                  : 'bg-white text-gray-700 border-gray-200 hover:border-gray-400'
              }`}
            >
              📈 300 bps Rate Hike
            </button>

            <button
              onClick={() => handleRunStressTest('TOP_HOLDING_CRASH_30')}
              disabled={stressing}
              className={`px-3 py-1.5 rounded-md font-medium border transition-all ${
                selectedScenario === 'TOP_HOLDING_CRASH_30'
                  ? 'bg-[#131921] text-white border-[#131921] shadow-sm'
                  : 'bg-white text-gray-700 border-gray-200 hover:border-gray-400'
              }`}
            >
              💥 30% Top Asset Crash
            </button>

            <button
              onClick={() => handleRunStressTest('TECH_DRAWDOWN_25')}
              disabled={stressing}
              className={`px-3 py-1.5 rounded-md font-medium border transition-all ${
                selectedScenario === 'TECH_DRAWDOWN_25'
                  ? 'bg-[#131921] text-white border-[#131921] shadow-sm'
                  : 'bg-white text-gray-700 border-gray-200 hover:border-gray-400'
              }`}
            >
              🌐 Tech 25% Correction
            </button>
          </div>
        </div>

        {stressResult && (
          <div className="space-y-4 animate-in fade-in duration-200">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 font-mono">
              <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
                <span className="text-[10px] text-gray-500 uppercase tracking-wider block">Pre-Shock Portfolio Value</span>
                <div className="text-lg font-bold text-[#0f1111] tabular-nums mt-0.5">
                  ${stressResult.preTestPortfolioValueUSD.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
              </div>

              <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
                <span className="text-[10px] text-gray-500 uppercase tracking-wider block">Post-Shock Projected Value</span>
                <div className="text-lg font-bold text-[#b12704] tabular-nums mt-0.5">
                  ${stressResult.postTestPortfolioValueUSD.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
              </div>

              <div className="p-4 bg-rose-50 border border-rose-200 rounded-lg">
                <span className="text-[10px] text-rose-800 uppercase tracking-wider block font-bold">Projected Drawdown</span>
                <div className="text-lg font-bold text-[#b12704] tabular-nums mt-0.5">
                  {stressResult.estimatedDrawdownPercent}%
                </div>
              </div>
            </div>

            <div className="p-4 bg-white border border-gray-200 rounded-lg">
              <h4 className="text-xs font-bold text-gray-800 mb-2 uppercase tracking-wider font-mono">
                Asset Drawdown Breakdown:
              </h4>
              <div className="space-y-2">
                {Array.isArray(stressResult?.affectedHoldings) && stressResult.affectedHoldings.map((a) => (
                  <div
                    key={a.symbol}
                    className="flex flex-col sm:flex-row sm:items-center justify-between text-xs p-2.5 rounded-md bg-gray-50 border border-gray-200 gap-2"
                  >
                    <div>
                      <span className="font-bold text-[#0f1111] font-mono mr-2">{a.symbol}</span>
                      <span className="text-gray-600 text-[11px]">{a.cause}</span>
                    </div>
                    <div className="flex items-center gap-3 font-mono">
                      <span className="text-[#b12704] font-bold">{a.lossPercent}%</span>
                      <span className="text-gray-500">-${a.impactUSD.toLocaleString()} USD</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-lg">
              <div className="flex items-center gap-2 mb-2 text-[#007600] text-xs font-bold">
                <ShieldCheck className="w-4 h-4" />
                Institutional Risk Mitigation Directives:
              </div>
              <ul className="text-xs text-gray-800 space-y-1 list-disc list-inside">
                {Array.isArray(stressResult?.mitigationRecommendations) && stressResult.mitigationRecommendations.map((rec, idx) => (
                  <li key={idx}>{rec}</li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
