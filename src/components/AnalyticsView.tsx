import React from 'react';
import { SystemStats } from '../types';
import { BookOpen, Search, Bookmark, PieChart, ShieldCheck, Clock, TrendingUp } from 'lucide-react';
import { AnalyticsMetricsSkeleton } from './common/Skeletons';

interface Props {
  stats: SystemStats | null;
}

export const AnalyticsView: React.FC<Props> = ({ stats }) => {
  if (!stats) {
    return <AnalyticsMetricsSkeleton />;
  }

  const statCards = [
    {
      title: 'Total Books in Catalog',
      value: stats.totalBooks,
      sub: `${stats.repositoryBooksCount} Repository • ${stats.externalOnlyBooksCount} Copyrighted`,
      icon: <BookOpen className="w-5 h-5 text-[#007185]" />,
    },
    {
      title: 'Discovery Searches Logged',
      value: stats.totalSearches,
      sub: 'Processed by Gemini Discovery Engine',
      icon: <Search className="w-5 h-5 text-[#c45500]" />,
    },
    {
      title: 'Reading List Saves',
      value: stats.totalReadingListItems,
      sub: 'Curated by active readers',
      icon: <Bookmark className="w-5 h-5 text-[#007600]" />,
    },
    {
      title: 'Curated Categories',
      value: Object.keys(stats.categoriesCount || {}).length,
      sub: 'Spanning strategy, finance & startups',
      icon: <PieChart className="w-5 h-5 text-purple-400" />,
    },
  ];

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Top Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((card, idx) => (
          <div key={idx} className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-gray-600">{card.title}</span>
              <div className="p-2 rounded-xl bg-gray-100">{card.icon}</div>
            </div>
            <div className="mt-3 text-2xl font-bold text-slate-100">{card.value}</div>
            <p className="text-[11px] text-gray-500 mt-1">{card.sub}</p>
          </div>
        ))}
      </div>

      {/* Fair Use & Midnight Reset Guard Banner */}
      <div className="bg-gradient-to-r from-blue-950/50 via-slate-900 to-slate-900 border border-blue-900/40 rounded-xl p-5 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="p-3 bg-[#232f3e]/20 border border-blue-500/30 rounded-xl text-[#007185]">
            <Clock className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h4 className="font-semibold text-slate-100 text-sm">Automated Fair-Use Rate Limiting Active</h4>
              <span className="text-[10px] font-bold text-[#007600] bg-[#007600]/10 border border-[#007600]/20 px-2 py-0.5 rounded-full">
                3 Requests / Day Limit
              </span>
            </div>
            <p className="text-xs text-gray-600 mt-0.5">
              Enforced across all repository book downloads. Resets automatically at <strong>00:00 UTC (Midnight)</strong> every day. Administrators bypass rate limits.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs bg-white px-3.5 py-2 rounded-xl border border-gray-200 text-gray-800">
          <ShieldCheck className="w-4 h-4 text-[#007600]" />
          <span>Midnight 00:00 UTC Reset Engine Active</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Category Breakdown */}
        <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2 mb-4">
            <TrendingUp className="w-4 h-4 text-[#007185]" />
            Category Distribution
          </h3>

          <div className="space-y-3">
            {Object.entries(stats.categoriesCount || {}).map(([category, count]) => {
              const numCount = Number(count);
              const pct = stats.totalBooks > 0 ? Math.round((numCount / stats.totalBooks) * 100) : 0;
              return (
                <div key={category} className="space-y-1">
                  <div className="flex justify-between text-xs text-gray-800">
                    <span>{category}</span>
                    <span className="font-semibold text-gray-600">
                      {numCount} ({pct}%)
                    </span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
                    <div
                      className="bg-gradient-to-r from-blue-500 to-blue-600 h-2 rounded-full transition-all duration-500"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Recent Search Intent Logs */}
        <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2 mb-4">
            <Clock className="w-4 h-4 text-[#c45500]" />
            Recent Natural Language Discovery Queries
          </h3>

          {!Array.isArray(stats.recentSearches) || stats.recentSearches.length === 0 ? (
            <p className="text-xs text-gray-500 py-8 text-center">No search queries logged yet.</p>
          ) : (
            <div className="space-y-2.5 max-h-[300px] overflow-y-auto pr-1">
              {(Array.isArray(stats.recentSearches) ? stats.recentSearches : []).map((log) => (
                <div
                  key={log.id}
                  className="p-3 bg-white/70 border border-gray-200/80 rounded-xl text-xs flex justify-between items-center"
                >
                  <div>
                    <p className="font-medium text-gray-900">"{log.query}"</p>
                    <span className="text-[10px] text-gray-500">
                      {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • Matched {log.matchedCount} books
                    </span>
                  </div>
                  <span className="text-[10px] uppercase font-bold text-[#007185] bg-[#007185]/10 px-2 py-0.5 rounded">
                    {log.intent}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
