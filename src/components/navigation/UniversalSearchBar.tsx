import React, { useState, useEffect, useRef } from 'react';
import {
  Search,
  ChevronDown,
  X,
  BookOpen,
  LineChart,
  GraduationCap,
  TrendingUp,
  Activity,
  ArrowRight,
  Sparkles,
} from 'lucide-react';
import { apiFetch } from '../../lib/api';
import { Book } from '../../types';

interface SearchResult {
  books: Book[];
  models: Array<{ name: string; category: string; definition: string; sourceBook: string }>;
  papers: Array<{ title: string; authors: string[]; abstract: string; year: number }>;
  tickers: Array<{ ticker: string; name: string; exchange: string; sector: string; targetPrice?: string }>;
  macro: Array<{ id: string; title: string; value: string; relevance: string }>;
  totalResults: number;
}

interface Props {
  onSelectBook?: (book: Book) => void;
  onNavigateTab: (tab: 'catalog' | 'valuation' | 'research' | 'analytics' | 'macro' | 'simulator' | 'setup') => void;
  onCatalogSearchChange?: (query: string) => void;
}

export const UniversalSearchBar: React.FC<Props> = ({
  onSelectBook,
  onNavigateTab,
  onCatalogSearchChange,
}) => {
  const [query, setQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<'all' | 'books' | 'finance' | 'academic'>('all');
  const [results, setResults] = useState<SearchResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  // Debounced search
  useEffect(() => {
    if (!query.trim()) {
      setResults(null);
      setIsOpen(false);
      if (onCatalogSearchChange) onCatalogSearchChange('');
      return;
    }

    if (onCatalogSearchChange) {
      onCatalogSearchChange(query);
    }

    const timer = setTimeout(async () => {
      setLoading(true);
      setIsOpen(true);
      try {
        const res = await apiFetch(`/api/search?q=${encodeURIComponent(query.trim())}`);
        if (res.ok) {
          const data = await res.json();
          setResults(data);
        }
      } catch (err) {
        console.warn('Search query error:', err);
      } finally {
        setLoading(false);
      }
    }, 220);

    return () => clearTimeout(timer);
  }, [query]);

  const handleClear = () => {
    setQuery('');
    setResults(null);
    setIsOpen(false);
    if (onCatalogSearchChange) onCatalogSearchChange('');
  };

  const handleSelectBook = (book: Book) => {
    setIsOpen(false);
    onNavigateTab('catalog');
    if (onSelectBook) onSelectBook(book);
  };

  const handleSelectTicker = (ticker: string) => {
    setIsOpen(false);
    onNavigateTab('valuation');
  };

  const handleSelectPaper = () => {
    setIsOpen(false);
    onNavigateTab('research');
  };

  const handleSelectMacro = () => {
    setIsOpen(false);
    onNavigateTab('macro');
  };

  return (
    <div ref={containerRef} className="relative flex-1 min-w-0">
      {/* Search Input Bar */}
      <div className="flex items-center bg-white rounded-md overflow-hidden focus-within:ring-2 focus-within:ring-[#f3a847] shadow-xs">
        {/* Department / Category Dropdown */}
        <div className="hidden md:flex items-center">
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value as any)}
            className="bg-gray-100 hover:bg-gray-200 border-r border-gray-300 px-3 py-2 text-sm text-gray-700 cursor-pointer focus:outline-none appearance-none pr-8 font-medium"
            style={{
              backgroundImage: `url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3e%3cpolyline points='6 9 12 15 18 9'%3e%3c/polyline%3e%3c/svg%3e")`,
              backgroundRepeat: 'no-repeat',
              backgroundPosition: 'right 0.5rem center',
              backgroundSize: '1em',
            }}
          >
            <option value="all">All</option>
            <option value="books">Books</option>
            <option value="finance">Terminal</option>
            <option value="academic">Papers</option>
          </select>
        </div>

        {/* Query Input */}
        <input
          type="text"
          value={query}
          onFocus={() => {
            if (results && query) setIsOpen(true);
          }}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search books, GSE/US equities, DCF models, or academic papers..."
          className="flex-1 bg-transparent px-3 py-2 text-base md:text-sm text-gray-900 focus:outline-none placeholder-gray-500 min-w-0 w-full"
        />

        {/* Clear Button */}
        {query && (
          <button
            onClick={handleClear}
            className="p-1 text-gray-400 hover:text-gray-600 mr-1"
          >
            <X className="w-4 h-4" />
          </button>
        )}

        {/* Search Submit Button */}
        <button
          type="button"
          onClick={() => {
            if (results && results.totalResults > 0) setIsOpen(true);
          }}
          className="bg-[#febd69] hover:bg-[#f3a847] px-4 py-2.5 flex items-center justify-center transition-colors shrink-0"
        >
          <Search className="w-5 h-5 text-gray-900" />
        </button>
      </div>

      {/* Real-time Results Popover */}
      {isOpen && (loading || results) && (
        <div className="absolute top-full left-0 right-0 mt-1.5 bg-white text-[#0f1111] rounded-lg shadow-2xl border border-gray-200 overflow-hidden z-50 max-h-[75vh] overflow-y-auto animate-fadeIn custom-scrollbar">
          {loading ? (
            <div className="p-4 space-y-4">
              <div className="space-y-3">
                <div className="h-3 w-32 bg-gray-200 rounded animate-pulse" />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {[1, 2].map((i) => (
                    <div key={i} className="flex items-center gap-2.5 p-2 rounded-md border border-transparent">
                      <div className="w-9 h-12 bg-gray-100 rounded shrink-0 animate-pulse" />
                      <div className="min-w-0 flex-1 space-y-1.5">
                        <div className="h-3 w-3/4 bg-gray-200 rounded animate-pulse" />
                        <div className="h-2 w-1/2 bg-gray-100 rounded animate-pulse" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="space-y-3 pt-3 border-t border-gray-100">
                <div className="h-3 w-40 bg-gray-200 rounded animate-pulse" />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {[1, 2].map((i) => (
                    <div key={i} className="flex items-center justify-between p-2 rounded-md border border-gray-100">
                      <div className="space-y-1.5 flex-1">
                        <div className="h-3 w-1/3 bg-gray-200 rounded animate-pulse" />
                        <div className="h-2 w-2/3 bg-gray-100 rounded animate-pulse" />
                      </div>
                      <div className="h-3 w-12 bg-gray-200 rounded animate-pulse" />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : results?.totalResults === 0 ? (
            <div className="p-6 text-center text-sm text-gray-500">
              No results found for &quot;<strong>{query}</strong>&quot;. Try searching for &quot;Warren Buffett&quot;, &quot;MTNGH&quot;, &quot;DCF&quot;, or &quot;Fama French&quot;.
            </div>
          ) : results ? (
            <div className="divide-y divide-gray-100">
              {/* 1. Books Results */}
              {results.books.length > 0 && (
                <div className="p-3">
                  <div className="flex items-center justify-between pb-2 mb-2 border-b border-gray-100">
                    <span className="text-xs font-bold uppercase tracking-wider text-gray-500 flex items-center gap-1.5">
                      <BookOpen className="w-3.5 h-3.5 text-[#f3a847]" />
                      Books & Literature ({results.books.length})
                    </span>
                    <button
                      onClick={() => {
                        setIsOpen(false);
                        onNavigateTab('catalog');
                      }}
                      className="text-[11px] font-semibold text-[#007185] hover:underline"
                    >
                      View in Library →
                    </button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {results.books.map((book) => (
                      <div
                        key={book.id}
                        onClick={() => handleSelectBook(book)}
                        className="flex items-center gap-2.5 p-2 rounded-md hover:bg-slate-50 cursor-pointer border border-transparent hover:border-gray-200 transition-colors"
                      >
                        <div className="w-9 h-12 bg-gray-100 rounded shrink-0 overflow-hidden shadow-xs">
                          {book.coverImageUrl ? (
                            <img
                              src={book.coverImageUrl}
                              alt=""
                              referrerPolicy="no-referrer"
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full bg-[#131921] flex items-center justify-center text-white text-[9px] font-bold">
                              BM
                            </div>
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <h4 className="text-xs font-bold text-gray-900 truncate leading-snug">
                            {book.title}
                          </h4>
                          <p className="text-[11px] text-gray-500 truncate">by {book.author}</p>
                          <span className="inline-block mt-0.5 text-[9px] px-1.5 py-0.2 bg-amber-50 text-amber-800 rounded font-medium">
                            {book.category}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 2. Equities & GSE Tickers */}
              {results.tickers.length > 0 && (
                <div className="p-3 bg-slate-50/50">
                  <div className="flex items-center justify-between pb-2 mb-2 border-b border-gray-200">
                    <span className="text-xs font-bold uppercase tracking-wider text-gray-500 flex items-center gap-1.5">
                      <LineChart className="w-3.5 h-3.5 text-[#007600]" />
                      Equities & Valuation Terminal ({results.tickers.length})
                    </span>
                    <button
                      onClick={() => {
                        setIsOpen(false);
                        onNavigateTab('valuation');
                      }}
                      className="text-[11px] font-semibold text-[#007185] hover:underline"
                    >
                      Open Terminal →
                    </button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {results.tickers.map((t) => (
                      <div
                        key={t.ticker}
                        onClick={() => handleSelectTicker(t.ticker)}
                        className="flex items-center justify-between p-2 rounded-md bg-white border border-gray-200 hover:border-[#f3a847] cursor-pointer transition-colors"
                      >
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono font-bold text-xs text-gray-900">{t.ticker}</span>
                            <span className="text-[10px] px-1 bg-gray-100 text-gray-600 rounded">
                              {t.exchange}
                            </span>
                          </div>
                          <p className="text-[11px] text-gray-500 truncate max-w-[180px]">{t.name}</p>
                        </div>
                        {t.targetPrice && (
                          <div className="text-right">
                            <span className="text-xs font-mono font-bold text-[#007600] block">{t.targetPrice}</span>
                            <span className="text-[9px] text-gray-400">Fair Value</span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 3. Academic Working Papers */}
              {results.papers.length > 0 && (
                <div className="p-3">
                  <div className="flex items-center justify-between pb-2 mb-2 border-b border-gray-100">
                    <span className="text-xs font-bold uppercase tracking-wider text-gray-500 flex items-center gap-1.5">
                      <GraduationCap className="w-3.5 h-3.5 text-indigo-600" />
                      Academic Working Papers ({results.papers.length})
                    </span>
                    <button
                      onClick={handleSelectPaper}
                      className="text-[11px] font-semibold text-[#007185] hover:underline"
                    >
                      View in Academic Library →
                    </button>
                  </div>
                  <div className="space-y-1.5">
                    {results.papers.map((p, idx) => (
                      <div
                        key={idx}
                        onClick={handleSelectPaper}
                        className="p-2 rounded-md hover:bg-slate-50 cursor-pointer border border-transparent hover:border-gray-200 transition-colors"
                      >
                        <h4 className="text-xs font-bold text-gray-900 leading-snug line-clamp-1">
                          {p.title}
                        </h4>
                        <p className="text-[11px] text-gray-500 mt-0.5 line-clamp-1">
                          {p.authors.join(', ')} • {p.year}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 4. Macro Benchmarks */}
              {results.macro.length > 0 && (
                <div className="p-3 bg-amber-50/40">
                  <div className="flex items-center justify-between pb-2 mb-2 border-b border-amber-200/60">
                    <span className="text-xs font-bold uppercase tracking-wider text-gray-700 flex items-center gap-1.5">
                      <TrendingUp className="w-3.5 h-3.5 text-[#de7921]" />
                      Macro Indicators & Rates
                    </span>
                    <button
                      onClick={handleSelectMacro}
                      className="text-[11px] font-semibold text-[#007185] hover:underline"
                    >
                      Inspect Shocks →
                    </button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {results.macro.map((m) => (
                      <div
                        key={m.id}
                        onClick={handleSelectMacro}
                        className="flex items-center justify-between p-2 rounded-md bg-white border border-gray-200 hover:border-amber-400 cursor-pointer transition-colors"
                      >
                        <div>
                          <p className="text-xs font-bold text-gray-900 line-clamp-1">{m.title}</p>
                          <span className="text-[10px] text-gray-500">{m.relevance}</span>
                        </div>
                        <span className="text-xs font-mono font-bold text-[#b12704]">{m.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
};
