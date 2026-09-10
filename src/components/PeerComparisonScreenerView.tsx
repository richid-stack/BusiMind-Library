import { apiFetch } from '../lib/api';
import React, { useState, useEffect } from 'react';
import {
  Scale,
  Search,
  Filter,
  ArrowRight,
  TrendingUp,
  ShieldCheck,
  RefreshCw,
  Sliders,
  CheckCircle2,
} from 'lucide-react';

interface AssetComparison {
  assetA: any;
  assetB: any;
  winnerMetrics: Record<string, string>;
  synthesis: string;
}

export const PeerComparisonScreenerView: React.FC = () => {
  const [symA, setSymA] = useState('MTNGH');
  const [symB, setSymB] = useState('GCB');
  const [comparison, setComparison] = useState<AssetComparison | null>(null);
  const [loadingComp, setLoadingComp] = useState(false);

  // Screener state
  const [minYield, setMinYield] = useState<number>(5);
  const [maxPE, setMaxPE] = useState<number>(15);
  const [regionFilter, setRegionFilter] = useState<string>('GSE');
  const [screenResults, setScreenResults] = useState<any[]>([]);
  const [loadingScreen, setLoadingScreen] = useState(false);

  const fetchComparison = async (a: string, b: string) => {
    setLoadingComp(true);
    try {
      const res = await apiFetch(`/api/finance/compare?symbolA=${a}&symbolB=${b}`);
      if (res.ok) {
        const data = await res.json();
        if (data && data.assetA && data.assetB) {
          setComparison(data);
        }
      }
    } catch (err) {
      console.error('Failed to compare assets', err);
    } finally {
      setLoadingComp(false);
    }
  };

  const runScreener = async () => {
    setLoadingScreen(true);
    try {
      let url = `/api/finance/screen?minYield=${minYield}&maxPE=${maxPE}`;
      if (regionFilter) url += `&region=${regionFilter}`;
      const res = await apiFetch(url);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          setScreenResults(data);
        }
      }
    } catch (err) {
      console.error('Failed to run screener', err);
    } finally {
      setLoadingScreen(false);
    }
  };

  useEffect(() => {
    fetchComparison('MTNGH', 'GCB');
    runScreener();
  }, []);

  return (
    <div className="space-y-6">
      {/* HEAD-TO-HEAD ASSET COMPARISON */}
      <div className="p-5 bg-white border border-gray-200 rounded-lg shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-200 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded bg-[#131921] flex items-center justify-center shrink-0 shadow-sm">
              <Scale className="w-4 h-4 text-[#f3a847]" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-[#0f1111]">Head-to-Head Peer Factor Audit</h3>
              <p className="text-xs text-gray-600">Side-by-side multiple comparison, capital efficiency, and competitive moat synthesis.</p>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs">
            <select
              value={symA}
              onChange={(e) => {
                setSymA(e.target.value);
                fetchComparison(e.target.value, symB);
              }}
              className="px-3 py-1.5 bg-white border border-gray-300 rounded-md text-gray-900 font-mono text-xs focus:outline-none focus:border-[#f3a847] focus:ring-1 focus:ring-[#f3a847]"
            >
              <option value="MTNGH">MTNGH (MTN Ghana)</option>
              <option value="GCB">GCB (GCB Bank)</option>
              <option value="TOTAL">TOTAL (TotalEnergies)</option>
              <option value="SCB">SCB (StanChart GH)</option>
              <option value="NVDA">NVDA (NVIDIA)</option>
              <option value="AAPL">AAPL (Apple)</option>
            </select>

            <span className="text-gray-400 font-bold font-mono text-xs px-1">VS</span>

            <select
              value={symB}
              onChange={(e) => {
                setSymB(e.target.value);
                fetchComparison(symA, e.target.value);
              }}
              className="px-3 py-1.5 bg-white border border-gray-300 rounded-md text-gray-900 font-mono text-xs focus:outline-none focus:border-[#f3a847] focus:ring-1 focus:ring-[#f3a847]"
            >
              <option value="GCB">GCB (GCB Bank)</option>
              <option value="MTNGH">MTNGH (MTN Ghana)</option>
              <option value="TOTAL">TOTAL (TotalEnergies)</option>
              <option value="SCB">SCB (StanChart GH)</option>
              <option value="MSFT">MSFT (Microsoft)</option>
              <option value="NVDA">NVDA (NVIDIA)</option>
            </select>

            <button
              onClick={() => fetchComparison(symA, symB)}
              disabled={loadingComp}
              title="Refresh comparison"
              className="p-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-md border border-gray-200 transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingComp ? 'animate-spin text-[#f3a847]' : ''}`} />
            </button>
          </div>
        </div>

        {comparison && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Asset A Card */}
              <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg space-y-3">
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="text-base font-bold text-[#0f1111]">{comparison.assetA.name}</h4>
                    <span className="text-xs text-[#007185] font-mono font-semibold">
                      {comparison.assetA.symbol} • {comparison.assetA.exchange} ({comparison.assetA.currency})
                    </span>
                  </div>
                  <div className="text-right font-mono">
                    <div className="text-lg font-bold text-[#0f1111] tabular-nums">
                      {comparison.assetA.currency} {comparison.assetA.price != null ? comparison.assetA.price.toFixed(2) : '0.00'}
                    </div>
                    <span className="text-[11px] text-gray-500">P/E: {comparison.assetA.peRatio?.toFixed(1) || 'N/A'}x</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs pt-2 border-t border-gray-200 font-mono">
                  <div className="bg-white p-2 rounded border border-gray-200">
                    <span className="text-gray-500 text-[10px] block uppercase font-sans">Dividend Yield</span>
                    <div className="font-bold text-[#007600] text-sm mt-0.5">{comparison.assetA.dividendYieldPercent || 0}%</div>
                  </div>
                  <div className="bg-white p-2 rounded border border-gray-200">
                    <span className="text-gray-500 text-[10px] block uppercase font-sans">Return on Equity</span>
                    <div className="font-bold text-gray-900 text-sm mt-0.5">{comparison.assetA.roePercent || 0}%</div>
                  </div>
                </div>
              </div>

              {/* Asset B Card */}
              <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg space-y-3">
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="text-base font-bold text-[#0f1111]">{comparison.assetB.name}</h4>
                    <span className="text-xs text-[#007185] font-mono font-semibold">
                      {comparison.assetB.symbol} • {comparison.assetB.exchange} ({comparison.assetB.currency})
                    </span>
                  </div>
                  <div className="text-right font-mono">
                    <div className="text-lg font-bold text-[#0f1111] tabular-nums">
                      {comparison.assetB.currency} {comparison.assetB.price != null ? comparison.assetB.price.toFixed(2) : '0.00'}
                    </div>
                    <span className="text-[11px] text-gray-500">P/E: {comparison.assetB.peRatio?.toFixed(1) || 'N/A'}x</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs pt-2 border-t border-gray-200 font-mono">
                  <div className="bg-white p-2 rounded border border-gray-200">
                    <span className="text-gray-500 text-[10px] block uppercase font-sans">Dividend Yield</span>
                    <div className="font-bold text-[#007600] text-sm mt-0.5">{comparison.assetB.dividendYieldPercent || 0}%</div>
                  </div>
                  <div className="bg-white p-2 rounded border border-gray-200">
                    <span className="text-gray-500 text-[10px] block uppercase font-sans">Return on Equity</span>
                    <div className="font-bold text-gray-900 text-sm mt-0.5">{comparison.assetB.roePercent || 0}%</div>
                  </div>
                </div>
              </div>
            </div>

            {/* AI Peer Synthesis */}
            <div className="p-4 bg-amber-50/70 border border-amber-200 rounded-lg text-xs space-y-2">
              <div className="flex items-center gap-1.5 font-bold text-[#0f1111]">
                <ShieldCheck className="w-4 h-4 text-[#007600]" />
                <span>Comparative Strategic Moat Synthesis</span>
              </div>
              <p className="text-gray-700 leading-relaxed text-xs">{comparison.synthesis}</p>
            </div>
          </div>
        )}
      </div>

      {/* MULTI-FACTOR VALUE SCREENER */}
      <div className="p-5 bg-white border border-gray-200 rounded-lg shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-200 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded bg-[#131921] flex items-center justify-center shrink-0 shadow-sm">
              <Filter className="w-4 h-4 text-[#ffd814]" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-[#0f1111]">Multi-Factor Quantitative Universe Screener</h3>
              <p className="text-xs text-gray-600">Filter security universe by minimum dividend yields, P/E multiples, and margin of safety.</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 text-xs">
            <div className="flex items-center gap-1.5">
              <span className="text-gray-600">Min Yield:</span>
              <input
                type="number"
                value={minYield}
                onChange={(e) => setMinYield(Number(e.target.value))}
                className="w-14 px-2 py-1 bg-white border border-gray-300 rounded text-gray-900 font-mono text-xs focus:outline-none focus:border-[#f3a847]"
              />
              <span className="text-gray-500 font-mono">%</span>
            </div>

            <div className="flex items-center gap-1.5">
              <span className="text-gray-600">Max P/E:</span>
              <input
                type="number"
                value={maxPE}
                onChange={(e) => setMaxPE(Number(e.target.value))}
                className="w-14 px-2 py-1 bg-white border border-gray-300 rounded text-gray-900 font-mono text-xs focus:outline-none focus:border-[#f3a847]"
              />
            </div>

            <div>
              <select
                value={regionFilter}
                onChange={(e) => setRegionFilter(e.target.value)}
                className="px-2.5 py-1 bg-white border border-gray-300 rounded text-gray-900 text-xs focus:outline-none focus:border-[#f3a847]"
              >
                <option value="GSE">Ghana Stock Exchange</option>
                <option value="US">US Markets (NYSE/NASDAQ)</option>
                <option value="">All Global Markets</option>
              </select>
            </div>

            <button
              onClick={runScreener}
              disabled={loadingScreen}
              className="px-3.5 py-1.5 bg-[#ffd814] hover:bg-[#f7ca00] text-[#0f1111] border border-[#fcd200] rounded-md font-bold text-xs transition-colors shadow-sm disabled:opacity-50"
            >
              {loadingScreen ? 'Screening Universe...' : 'Run Screener'}
            </button>
          </div>
        </div>

        {/* Screener Results Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="text-gray-500 border-b border-gray-200 bg-gray-50/75 uppercase text-[10px] font-mono">
              <tr>
                <th className="p-2.5">Symbol</th>
                <th className="p-2.5">Company</th>
                <th className="p-2.5">Exchange</th>
                <th className="p-2.5">Market Price</th>
                <th className="p-2.5">P/E Ratio</th>
                <th className="p-2.5">Div Yield</th>
                <th className="p-2.5">ROE</th>
                <th className="p-2.5">Margin of Safety</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 font-mono">
              {(Array.isArray(screenResults) ? screenResults : []).map((asset) => (
                <tr key={asset.symbol} className="hover:bg-slate-50 transition-colors">
                  <td className="p-2.5 font-bold text-[#0f1111]">{asset.symbol}</td>
                  <td className="p-2.5 text-gray-800 font-sans">{asset.name}</td>
                  <td className="p-2.5 text-gray-500">{asset.exchange}</td>
                  <td className="p-2.5 font-bold text-[#0f1111] tabular-nums">
                    {asset.currency} {asset.price != null ? asset.price.toFixed(2) : '0.00'}
                  </td>
                  <td className="p-2.5 text-gray-700 tabular-nums">{asset.peRatio?.toFixed(1) || 'N/A'}x</td>
                  <td className="p-2.5 text-[#007600] font-bold tabular-nums">{asset.dividendYieldPercent || 0}%</td>
                  <td className="p-2.5 text-gray-700 tabular-nums">{asset.roePercent || 0}%</td>
                  <td className="p-2.5 tabular-nums">
                    <span
                      className={`px-2 py-0.5 rounded font-bold text-[11px] ${
                        (asset.marginOfSafetyPercent || 0) >= 0
                          ? 'bg-emerald-50 text-[#007600] border border-emerald-200'
                          : 'bg-rose-50 text-[#b12704] border border-rose-200'
                      }`}
                    >
                      {(asset.marginOfSafetyPercent || 0) >= 0 ? '+' : ''}
                      {asset.marginOfSafetyPercent || 0}%
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
