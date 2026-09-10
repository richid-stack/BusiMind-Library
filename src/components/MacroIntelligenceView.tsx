import { apiFetch } from '../lib/api';
import React, { useState, useEffect } from 'react';
import {
  Globe,
  TrendingUp,
  TrendingDown,
  Activity,
  Percent,
  Layers,
  AlertCircle,
  RefreshCw,
  Zap,
} from 'lucide-react';

interface MacroDashboard {
  ghana: {
    bogPolicyRatePercent: number;
    treasuryBill91DayPercent: number;
    cpiInflationHeadlinePercent: number;
    usdGhsExchangeRate: number;
    lastUpdated: string;
  };
  global: {
    usFedFundsRatePercent: number;
    us10YearTreasuryYieldPercent: number;
    usCpiInflationPercent: number;
    brentCrudeUSD: number;
    goldPerOunceUSD: number;
    lastUpdated: string;
  };
}

export const MacroIntelligenceView: React.FC = () => {
  const [macro, setMacro] = useState<MacroDashboard | null>(null);
  const [loading, setLoading] = useState(true);

  // Custom simulation inputs
  const [cediDepreciation, setCediDepreciation] = useState(15);
  const [interestRateHike, setInterestRateHike] = useState(200);

  const fetchMacro = async () => {
    setLoading(true);
    try {
      const res = await apiFetch('/api/finance/macro');
      if (res.ok) {
        const data = await res.json();
        if (data && data.ghana && data.global) {
          setMacro(data);
        }
      }
    } catch (err) {
      console.error('Failed to load macro dashboard', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMacro();
  }, []);

  if (loading || !macro) {
    return (
      <div className="flex items-center justify-center p-12 bg-white border border-gray-200 rounded-lg shadow-sm">
        <RefreshCw className="w-5 h-5 text-[#f3a847] animate-spin mr-3" />
        <span className="text-gray-700 font-medium text-sm">Loading macroeconomic indicators...</span>
      </div>
    );
  }

  const usdRate = macro?.ghana?.usdGhsExchangeRate ?? 15.5;
  const tBillRate = macro?.ghana?.treasuryBill91DayPercent ?? 24.5;
  const simulatedUSDGHS = (usdRate * (1 + cediDepreciation / 100)).toFixed(2);
  const simulatedTBill = (tBillRate + interestRateHike / 100).toFixed(2);

  return (
    <div className="space-y-6">
      {/* GHANA SOVEREIGN BENCHMARK DASHBOARD */}
      <div className="p-5 bg-white border border-gray-200 rounded-lg shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-gray-200 pb-3">
          <div className="flex items-center gap-2.5">
            <span className="text-2xl" role="img" aria-label="Ghana Flag">🇬🇭</span>
            <div>
              <h3 className="text-sm font-bold text-[#0f1111]">Bank of Ghana & Domestic Sovereign Benchmarks</h3>
              <p className="text-xs text-gray-600">Official monetary policy rate, risk-free cost of capital, and FX reference rates.</p>
            </div>
          </div>
          <span className="text-[11px] font-mono text-gray-500">Updated: {macro.ghana.lastUpdated}</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 font-mono">
          <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
            <span className="text-[10px] text-gray-500 font-semibold uppercase tracking-wider block font-sans">BoG Policy Rate</span>
            <div className="text-2xl font-bold text-[#b12704] tabular-nums mt-1">
              {macro.ghana.bogPolicyRatePercent}%
            </div>
            <span className="text-[11px] text-gray-500 font-sans block mt-1">Central Bank Benchmark</span>
          </div>

          <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
            <span className="text-[10px] text-gray-500 font-semibold uppercase tracking-wider block font-sans">91-Day T-Bill Benchmark</span>
            <div className="text-2xl font-bold text-[#007600] tabular-nums mt-1">
              {macro.ghana.treasuryBill91DayPercent}%
            </div>
            <span className="text-[11px] text-gray-500 font-sans block mt-1">Equity hurdle rate baseline</span>
          </div>

          <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
            <span className="text-[10px] text-gray-500 font-semibold uppercase tracking-wider block font-sans">Headline CPI Inflation</span>
            <div className="text-2xl font-bold text-[#b12704] tabular-nums mt-1">
              {macro.ghana.cpiInflationHeadlinePercent}%
            </div>
            <span className="text-[11px] text-gray-500 font-sans block mt-1">Year-over-year cost pressure</span>
          </div>

          <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
            <span className="text-[10px] text-gray-500 font-semibold uppercase tracking-wider block font-sans">USD / GHS Interbank</span>
            <div className="text-2xl font-bold text-[#0f1111] tabular-nums mt-1">
              GH₵{(macro.ghana.usdGhsExchangeRate ?? 0).toFixed(2)}
            </div>
            <span className="text-[11px] text-gray-500 font-sans block mt-1">Spot reference rate</span>
          </div>
        </div>
      </div>

      {/* GLOBAL BENCHMARK DASHBOARD */}
      <div className="p-5 bg-white border border-gray-200 rounded-lg shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-gray-200 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded bg-[#131921] flex items-center justify-center shrink-0">
              <Globe className="w-4 h-4 text-[#f3a847]" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-[#0f1111]">Global Capital Markets & Commodities</h3>
              <p className="text-xs text-gray-600">US sovereign yield curves, global inflation trends, energy inputs, and gold export benchmarks.</p>
            </div>
          </div>
          <span className="text-[11px] font-mono text-gray-500">Updated: {macro.global.lastUpdated}</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 font-mono">
          <div className="p-3.5 bg-gray-50 border border-gray-200 rounded-lg">
            <span className="text-[10px] text-gray-500 font-semibold uppercase tracking-wider block font-sans">US Fed Funds</span>
            <div className="text-xl font-bold text-[#0f1111] tabular-nums mt-1">
              {macro.global.usFedFundsRatePercent}%
            </div>
            <span className="text-[10px] text-gray-500 font-sans block mt-0.5">Target upper bound</span>
          </div>

          <div className="p-3.5 bg-gray-50 border border-gray-200 rounded-lg">
            <span className="text-[10px] text-gray-500 font-semibold uppercase tracking-wider block font-sans">US 10-Yr Treasury</span>
            <div className="text-xl font-bold text-[#007185] tabular-nums mt-1">
              {macro.global.us10YearTreasuryYieldPercent}%
            </div>
            <span className="text-[10px] text-gray-500 font-sans block mt-0.5">Global risk-free rate</span>
          </div>

          <div className="p-3.5 bg-gray-50 border border-gray-200 rounded-lg">
            <span className="text-[10px] text-gray-500 font-semibold uppercase tracking-wider block font-sans">US CPI Inflation</span>
            <div className="text-xl font-bold text-[#0f1111] tabular-nums mt-1">
              {macro.global.usCpiInflationPercent}%
            </div>
            <span className="text-[10px] text-gray-500 font-sans block mt-0.5">Year-over-year</span>
          </div>

          <div className="p-3.5 bg-gray-50 border border-gray-200 rounded-lg">
            <span className="text-[10px] text-gray-500 font-semibold uppercase tracking-wider block font-sans">Brent Crude Oil</span>
            <div className="text-xl font-bold text-[#b12704] tabular-nums mt-1">
              ${macro.global.brentCrudeUSD}
            </div>
            <span className="text-[10px] text-gray-500 font-sans block mt-0.5">USD per barrel</span>
          </div>

          <div className="p-3.5 bg-gray-50 border border-gray-200 rounded-lg">
            <span className="text-[10px] text-gray-500 font-semibold uppercase tracking-wider block font-sans">Gold Spot Price</span>
            <div className="text-xl font-bold text-amber-600 tabular-nums mt-1">
              ${macro.global.goldPerOunceUSD}
            </div>
            <span className="text-[10px] text-gray-500 font-sans block mt-0.5">Ghana export anchor</span>
          </div>
        </div>
      </div>

      {/* MACRO SCENARIO STRESS SANDBOX */}
      <div className="p-5 bg-white border border-gray-200 rounded-lg shadow-sm space-y-4">
        <div className="flex items-center gap-2.5 border-b border-gray-200 pb-3">
          <div className="w-8 h-8 rounded bg-[#131921] flex items-center justify-center shrink-0">
            <Zap className="w-4 h-4 text-[#ffd814]" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-[#0f1111]">Live Macro Shock Sensitivity Simulation</h3>
            <p className="text-xs text-gray-600">
              Interactively adjust foreign exchange depreciation and domestic interest rates to model sector cash-flow impact.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-1">
          <div className="space-y-4 p-4 bg-gray-50 border border-gray-200 rounded-lg">
            <div>
              <div className="flex justify-between text-xs mb-1.5">
                <span className="text-gray-700 font-medium">Cedi Currency Depreciation:</span>
                <span className="text-[#b12704] font-bold font-mono">+{cediDepreciation}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="50"
                step="1"
                value={cediDepreciation}
                onChange={(e) => setCediDepreciation(Number(e.target.value))}
                className="w-full accent-[#131921]"
              />
              <div className="text-xs text-gray-600 mt-1 font-mono">
                Simulated USD/GHS Rate: <span className="text-[#0f1111] font-bold">GH₵{simulatedUSDGHS}</span>
              </div>
            </div>

            <div>
              <div className="flex justify-between text-xs mb-1.5">
                <span className="text-gray-700 font-medium">BoG Yield Hike (Basis Points):</span>
                <span className="text-[#b12704] font-bold font-mono">+{interestRateHike} bps</span>
              </div>
              <input
                type="range"
                min="0"
                max="600"
                step="25"
                value={interestRateHike}
                onChange={(e) => setInterestRateHike(Number(e.target.value))}
                className="w-full accent-[#131921]"
              />
              <div className="text-xs text-gray-600 mt-1 font-mono">
                Simulated 91-Day T-Bill: <span className="text-[#0f1111] font-bold">{simulatedTBill}%</span>
              </div>
            </div>
          </div>

          <div className="space-y-3 p-4 bg-gray-50 border border-gray-200 rounded-lg text-xs">
            <h4 className="font-bold text-[#0f1111] uppercase tracking-wider text-[11px] font-mono">
              Sector Transmission Dynamics:
            </h4>
            <div className="space-y-2 text-gray-700">
              <div className="p-2.5 rounded-md bg-white border border-gray-200 shadow-2xs">
                <span className="font-bold text-[#007600] mr-2">Commercial Banks (GCB / SCB):</span>
                Net interest margin expands immediately with higher T-Bill yields, but credit risk increases as borrowers face higher debt servicing costs.
              </div>
              <div className="p-2.5 rounded-md bg-white border border-gray-200 shadow-2xs">
                <span className="font-bold text-[#007185] mr-2">Telecom & MoMo (MTNGH):</span>
                Dominant market share and customer float interest revenues provide strong margin defense, though USD tower lease capital expenditures rise.
              </div>
              <div className="p-2.5 rounded-md bg-white border border-gray-200 shadow-2xs">
                <span className="font-bold text-[#b12704] mr-2">Downstream Oil (TOTAL / GOIL):</span>
                Working capital financing costs increase during currency depreciation due to foreign exchange letters of credit for petroleum product imports.
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
