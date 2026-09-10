import { apiFetch } from '../lib/api';
import React, { useState, useEffect } from 'react';
import { Search, FileText, Download, BookOpen, ExternalLink, Sparkles, BookMarked, Brain, Network, Loader2, CheckCircle2 } from 'lucide-react';
import { AcademicPaper, RAGMentalModel } from '../types';
import { AcademicPaperSkeleton } from './common/Skeletons';
import { useLoading } from '../context/LoadingContext';

export function AcademicLibraryView() {
  const { startLoading, stopLoading } = useLoading();
  const [curatedPapers, setCuratedPapers] = useState<AcademicPaper[]>([]);
  const [searchResults, setSearchResults] = useState<AcademicPaper[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [extractingModel, setExtractingModel] = useState<string | null>(null);
  const [extractionNotification, setExtractionNotification] = useState<{ title: string; framework: string; rule: string } | null>(null);

  useEffect(() => {
    fetchCurated();
  }, []);

  const fetchCurated = async () => {
    try {
      const res = await apiFetch('/api/research/papers/curated');
      if (res.ok) {
        setCuratedPapers(await res.json());
      }
    } catch (err) {
      console.error('Failed to load curated papers', err);
    }
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    
    setLoading(true);
    startLoading('Querying academic repositories...');
    try {
      const isId = /^10\.\d+\/|^arxiv:|\d{10,13}$/i.test(query.trim());
      
      let endpoint = `/api/research/papers/search?q=${encodeURIComponent(query.trim())}`;
      if (isId) {
        endpoint = `/api/research/papers/resolve?id=${encodeURIComponent(query.trim())}`;
      }

      const res = await apiFetch(endpoint);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          setSearchResults(data);
        } else if (data && data.id) {
          setSearchResults([data]);
        } else {
          setSearchResults([]);
        }
      }
    } catch (err) {
      console.error('Search failed', err);
    } finally {
      setLoading(false);
      stopLoading();
    }
  };

  const extractMentalModel = async (paper: AcademicPaper) => {
    setExtractingModel(paper.id);
    try {
      const res = await apiFetch('/api/research/extract-model', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(paper)
      });
      if (res.ok) {
        const model = await res.json();
        setExtractionNotification({
          title: paper.title,
          framework: model.frameworkName || 'Quantitative Valuation Model',
          rule: model.coreRule || 'Model extracted and indexed into BusiMind knowledge graph.'
        });
        setTimeout(() => setExtractionNotification(null), 8000);
      }
    } catch (err) {
      console.error('Extraction error', err);
    } finally {
      setExtractingModel(null);
    }
  };

  const displayList = searchResults.length > 0 ? searchResults : curatedPapers;

  return (
    <div className="w-full h-full p-4 sm:p-6 flex flex-col items-center">
      <div className="w-full max-w-6xl space-y-6">
        
        {/* Header (Clean Amazon/BusiMind Institutional Design) */}
        <div className="bg-white border border-gray-200 rounded-lg p-5 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-md bg-[#131921] flex items-center justify-center shrink-0 shadow-sm">
              <Network className="w-5 h-5 text-[#f3a847]" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-lg font-bold text-[#0f1111] tracking-tight">
                  Academic Research & Working Papers
                </h2>
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-[#007185]/10 text-[#007185] border border-[#007185]/20">
                  OPEN-ACCESS REPOSITORIES
                </span>
              </div>
              <p className="text-xs text-gray-600 mt-0.5">
                Search Semantic Scholar, arXiv, and CrossRef by DOI, ISBN, or topic. Synthesize empirical finance models directly into your valuation terminal.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs font-mono text-gray-500 shrink-0">
            <span>Indexed Papers:</span>
            <span className="font-bold text-[#0f1111] bg-gray-100 px-2 py-0.5 rounded border border-gray-200">
              {displayList.length}
            </span>
          </div>
        </div>

        {/* Extraction Banner Notification */}
        {extractionNotification && (
          <div className="bg-emerald-50 border border-emerald-300 rounded-lg p-4 flex items-start gap-3 shadow-sm animate-in fade-in">
            <CheckCircle2 className="w-5 h-5 text-[#007600] shrink-0 mt-0.5" />
            <div className="text-xs">
              <span className="font-bold text-[#007600] block text-sm">
                Mental Model Successfully Synthesized!
              </span>
              <p className="text-gray-800 mt-0.5">
                <strong>Framework:</strong> {extractionNotification.framework}
              </p>
              <p className="text-gray-600 mt-0.5">
                <strong>Core Rule:</strong> {extractionNotification.rule}
              </p>
            </div>
          </div>
        )}

        {/* Search Bar */}
        <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
          <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Enter Paper Title, DOI (e.g. 10.1016/...), arXiv ID, or ISBN..."
                className="w-full pl-9 pr-4 py-2.5 bg-white border border-gray-300 rounded-md text-xs sm:text-sm text-[#0f1111] placeholder-gray-400 focus:outline-none focus:border-[#f3a847] focus:ring-1 focus:ring-[#f3a847]"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-2.5 bg-[#ffd814] hover:bg-[#f7ca00] text-[#0f1111] border border-[#fcd200] rounded-md text-xs sm:text-sm font-bold transition-colors flex items-center justify-center gap-2 disabled:opacity-50 shadow-sm"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
              <span>Search Repositories</span>
            </button>
            {searchResults.length > 0 && (
              <button
                type="button"
                onClick={() => { setSearchResults([]); setQuery(''); }}
                className="px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-md text-xs sm:text-sm font-medium transition-colors border border-gray-200"
              >
                Clear
              </button>
            )}
          </form>
        </div>

        {/* Results Grid */}
        {loading ? (
          <AcademicPaperSkeleton count={4} />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {(Array.isArray(displayList) ? displayList : []).map(paper => (
            <div key={paper.id} className="bg-white border border-gray-200 hover:border-[#f3a847] rounded-lg p-5 flex flex-col shadow-sm hover:shadow-md transition-all">
              <div className="flex justify-between items-start gap-4 mb-2.5">
                <h3 className="text-sm sm:text-base font-bold text-[#0f1111] leading-snug">
                  {paper.title}
                </h3>
                {paper.isCurated && (
                  <span className="shrink-0 px-2 py-0.5 rounded bg-amber-50 text-[#b12704] text-[10px] font-bold uppercase tracking-wide border border-amber-200">
                    Curated
                  </span>
                )}
              </div>
              
              <div className="text-xs text-gray-600 mb-4 flex-1">
                <div className="mb-1.5 font-medium text-[#007185]">
                  {Array.isArray(paper.authors) ? paper.authors.join(', ') : (paper.authors || 'Unknown Author')} • <span className="text-gray-500 font-mono">{paper.year}</span>
                </div>
                {paper.venue && (
                  <div className="mb-2 text-gray-500 italic text-[11px]">
                    {paper.venue}
                  </div>
                )}
                <p className="line-clamp-3 leading-relaxed text-gray-700 text-xs">
                  {paper.tldr || paper.abstract || 'No abstract summary provided by indexing API.'}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2 mt-auto pt-3 border-t border-gray-200">
                {paper.pdfUrl ? (
                  <a
                    href={paper.pdfUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3 py-1.5 bg-[#007600]/10 hover:bg-emerald-100 text-[#007600] border border-[#007600]/20 rounded text-xs font-semibold flex items-center gap-1.5 transition-colors"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Open Access PDF</span>
                  </a>
                ) : paper.landingPageUrl ? (
                  <a
                    href={paper.landingPageUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3 py-1.5 bg-gray-50 hover:bg-gray-100 text-gray-700 border border-gray-200 rounded text-xs font-medium flex items-center gap-1.5 transition-colors"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>Publisher Link</span>
                  </a>
                ) : null}

                <button
                  onClick={() => extractMentalModel(paper)}
                  disabled={extractingModel === paper.id}
                  className="px-3 py-1.5 bg-[#131921] hover:bg-[#232f3e] text-white rounded text-xs font-semibold flex items-center gap-1.5 transition-colors ml-auto shadow-sm disabled:opacity-50"
                >
                  {extractingModel === paper.id ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-[#f3a847]" />
                  ) : (
                    <Brain className="w-3.5 h-3.5 text-[#f3a847]" />
                  )}
                  <span>{extractingModel === paper.id ? 'Synthesizing...' : 'Extract Model'}</span>
                </button>
              </div>
            </div>
          ))}
        </div>
        )}
        
        {displayList.length === 0 && !loading && (
          <div className="text-center py-16 bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
            <BookMarked className="w-12 h-12 mx-auto mb-3 text-gray-300" />
            <h3 className="text-sm font-bold text-[#0f1111]">No Research Papers Found</h3>
            <p className="text-xs text-gray-500 mt-1 max-w-sm mx-auto">
              Try searching with a paper title, author, DOI (e.g. 10.1016/...), or arXiv identifier.
            </p>
          </div>
        )}

      </div>
    </div>
  );
}
