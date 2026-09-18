import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Book } from '../../types';
import {
  BookOpen,
  Send,
  Brain,
  Star,
  Clock,
  Bookmark,
  Sparkles,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';

interface Props {
  books?: Book[];
  book?: Book;
  isAdmin?: boolean;
  onOpenReader: (book: Book) => void;
  onTestDeliver: (book: Book) => void;
  onExtractRAG: (book: Book) => void;
  extractingRAGId: string | null;
  ragSuccessMsg?: string;
  isDelivering: boolean;
}

export const KindleHeroFeature: React.FC<Props> = ({
  books = [],
  book: singleBook,
  isAdmin = false,
  onOpenReader,
  onTestDeliver,
  onExtractRAG,
  extractingRAGId,
  ragSuccessMsg,
  isDelivering,
}) => {
  // Normalize books array safely
  const validBooks = (Array.isArray(books) && books.length > 0 ? books : (singleBook ? [singleBook] : [])).filter(Boolean);
  const totalCount = validBooks.length;

  const [currentIndex, setCurrentIndex] = useState(0);

  // Reset index if validBooks changes
  useEffect(() => {
    if (currentIndex >= totalCount && totalCount > 0) {
      setCurrentIndex(0);
    }
  }, [totalCount, currentIndex]);

  // Auto-rotate featured books every 10 seconds
  useEffect(() => {
    if (totalCount <= 1) return;
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % totalCount);
    }, 10000);
    return () => clearInterval(interval);
  }, [totalCount]);

  if (totalCount === 0) return null;

  const activeBook = validBooks[currentIndex] || validBooks[0];
  if (!activeBook) return null;

  const handleNext = () => {
    setCurrentIndex((prev) => (prev + 1) % totalCount);
  };

  const handlePrev = () => {
    setCurrentIndex((prev) => (prev - 1 + totalCount) % totalCount);
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
      className="relative overflow-hidden rounded-xl bg-white border border-gray-200 shadow-sm p-6 sm:p-8 transition-all duration-300"
    >
      <AnimatePresence mode="wait">
        <motion.div 
          key={activeBook.id}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.3 }}
          className="relative z-10 flex flex-col lg:flex-row items-center gap-8 lg:gap-12"
        >
          {/* 3D Book Jacket Container */}
        <div className="shrink-0 group cursor-pointer relative" onClick={() => onOpenReader(activeBook)}>
          <div className="book-cover-wrap w-44 sm:w-52 aspect-[2/3] rounded-r-xl rounded-l-sm bg-[#131921] book-card-shadow relative overflow-hidden border-r border-t border-b border-gray-300">
            {/* Book Spine Highlight Effect */}
            <div className="book-spine-effect" />
            {/* Realistic Page Rim */}
            <div className="book-page-edge" />

            {activeBook.coverImageUrl ? (
              <img
                src={activeBook.coverImageUrl}
                alt={activeBook.title}
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover rounded-r-xl"
              />
            ) : (
              <div className="w-full h-full p-5 flex flex-col justify-between bg-[#131921] text-white border-l-4 border-[#f3a847]">
                <div>
                  <div className="text-[10px] font-bold tracking-widest text-[#f3a847] uppercase font-sans">
                    BusiMind Classic
                  </div>
                  <div className="text-xs text-gray-400 mt-0.5">{activeBook.category}</div>
                </div>
                <div className="my-auto py-2">
                  <h3 className="font-display font-bold text-lg sm:text-xl leading-snug tracking-tight text-white line-clamp-3">
                    {activeBook.title}
                  </h3>
                  <div className="w-8 h-0.5 bg-[#f3a847] my-2" />
                  <p className="text-xs text-gray-300 italic font-display">{activeBook.author}</p>
                </div>
                <div className="text-[10px] text-gray-400 font-mono tracking-wider flex items-center justify-between">
                  <span>EST. {activeBook.publicationYear || 'N/A'}</span>
                  <span>★ {activeBook.ratingScore || '4.8'}</span>
                </div>
              </div>
            )}

            {/* Bestseller Ribbon Badge */}
            {activeBook.isFeatured && (
              <div className="absolute top-3 left-3 bg-[#f3a847] text-slate-950 text-[10px] font-bold px-2 py-0.5 rounded shadow-md uppercase tracking-wider flex items-center gap-1">
                <Bookmark className="w-2.5 h-2.5 fill-current" />
                <span>Editor's Pick</span>
              </div>
            )}
          </div>
        </div>

        {/* Book Editorial Metadata & Actions */}
        <div className="flex-1 text-center lg:text-left space-y-4">
          <div className="flex flex-wrap items-center justify-center lg:justify-start gap-2 text-xs">
            <span className="px-3 py-1 rounded-sm bg-[#f3a847]/10 text-[#c45500] border border-[#f3a847]/30 font-semibold flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-[#f3a847]" />
              <span>Featured Masterwork</span>
            </span>
            <span className="px-2.5 py-0.5 rounded-sm bg-gray-100 text-gray-700 text-[11px] border border-gray-300 font-medium">
              {activeBook.category || 'Business'}
            </span>
            <span className="px-2.5 py-0.5 rounded-sm bg-blue-50 text-[#007185] text-[11px] border border-blue-200 font-medium">
              BusiMind Cloud
            </span>
          </div>

          <div>
            <h2 className="font-display text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight text-[#0f1111] leading-tight">
              {activeBook.title}
            </h2>
            <p className="text-sm sm:text-base text-gray-600 font-medium mt-1">
              By <span className="text-[#007185] hover:text-[#c45500] hover:underline cursor-pointer">{activeBook.author}</span> • {activeBook.publicationYear || 'Classic'}
            </p>
          </div>

          {/* Star Rating & Reading Stats */}
          <div className="flex flex-wrap items-center justify-center lg:justify-start gap-4 text-xs text-gray-700">
            <div className="flex items-center gap-1">
              {[...Array(5)].map((_, i) => (
                <Star key={i} className="w-4 h-4 fill-[#ffa41c] text-[#ffa41c]" />
              ))}
              <span className="font-bold text-[#0f1111] ml-1">{activeBook.ratingScore || '4.8'}</span>
              <span className="text-[#007185] hover:text-[#c45500] hover:underline cursor-pointer text-[11px] ml-1">
                (Verified Reader Reviews)
              </span>
            </div>
            <span className="text-gray-400 hidden sm:inline">•</span>
            <div className="flex items-center gap-1.5 text-gray-600">
              <Clock className="w-3.5 h-3.5" />
              <span>~3.5 hrs reading time</span>
            </div>
            <span className="text-gray-400 hidden sm:inline">•</span>
            <span className="capitalize text-gray-600">
              Level: <strong className="text-[#0f1111]">{activeBook.difficulty || 'Intermediate'}</strong>
            </span>
          </div>

          {/* Editorial Excerpt */}
          <p className="text-xs sm:text-sm text-[#0f1111] leading-relaxed max-w-2xl line-clamp-3">
            {activeBook.description}
          </p>

          {/* Why Read Highlight Card */}
          {activeBook.whyRecommended && (
            <div className="p-3.5 rounded-sm bg-[#fcf8e3] border border-[#faebcc] text-xs text-[#8a6d3b] max-w-2xl flex items-start gap-2.5 text-left">
              <span className="font-bold text-[#0f1111] shrink-0">Key Thesis:</span>
              <span className="line-clamp-2">{activeBook.whyRecommended}</span>
            </div>
          )}

          {/* Interactive CTA Buttons */}
          <div className="pt-2 flex flex-wrap items-center justify-center lg:justify-start gap-3">
            <button
              onClick={() => onOpenReader(activeBook)}
              className="px-5 py-2.5 bg-[#ffd814] hover:bg-[#f7ca00] text-[#0f1111] border border-[#fcd200] font-bold rounded-full text-xs sm:text-sm flex items-center gap-2 transition-colors shadow-sm"
            >
              <BookOpen className="w-4 h-4" />
              <span>Read Preview</span>
            </button>
            {isAdmin && activeBook.channelMessageId && (
              <button
                onClick={() => onTestDeliver(activeBook)}
                disabled={isDelivering}
                className="px-4 py-2.5 bg-[#ffa41c] hover:bg-[#fa8900] text-[#0f1111] border border-[#ff8f00] font-semibold rounded-full text-xs flex items-center gap-2 transition-colors shadow-sm"
              >
                <Send className="w-3.5 h-3.5" />
                <span>{isDelivering ? 'Dispatching...' : 'Send to Telegram'}</span>
              </button>
            )}
            {!isAdmin && activeBook.channelMessageId && (
              <button
                onClick={() => onTestDeliver(activeBook)}
                disabled={isDelivering}
                className="px-4 py-2.5 bg-sky-50 hover:bg-sky-100 text-sky-800 border border-sky-200 font-semibold rounded-full text-xs flex items-center gap-2 transition-colors shadow-sm"
              >
                <Send className="w-3.5 h-3.5 text-[#229ed9]" />
                <span>{isDelivering ? 'Connecting...' : 'Get on Telegram'}</span>
              </button>
            )}
            {isAdmin && (
              <button
                onClick={() => onExtractRAG(activeBook)}
                disabled={extractingRAGId === activeBook.id}
                className="px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-[#0f1111] border border-gray-300 font-semibold rounded-full text-xs flex items-center gap-2 transition-colors shadow-sm"
              >
                <Brain className="w-3.5 h-3.5" />
                <span>{extractingRAGId === activeBook.id ? 'Synthesizing...' : 'Extract Models'}</span>
              </button>
            )}

            {isAdmin && ragSuccessMsg && (
              <span className="text-xs text-[#007600] font-bold flex items-center gap-1 animate-fadeIn">
                ✓ {ragSuccessMsg}
              </span>
            )}
          </div>
        </div>
        </motion.div>
      </AnimatePresence>

      {/* Carousel Controls & Indicators */}
      {totalCount > 1 && (
        <div className="mt-6 pt-4 border-t border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrev}
              aria-label="Previous Featured Book"
              className="p-1.5 rounded-full hover:bg-gray-100 text-gray-600 border border-gray-200 transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-xs text-gray-500 font-medium">
              Featured {currentIndex + 1} of {totalCount}
            </span>
            <button
              onClick={handleNext}
              aria-label="Next Featured Book"
              className="p-1.5 rounded-full hover:bg-gray-100 text-gray-600 border border-gray-200 transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <div className="flex items-center gap-1.5">
            {validBooks.map((_, idx) => (
              <button
                key={idx}
                onClick={() => setCurrentIndex(idx)}
                aria-label={`Go to slide ${idx + 1}`}
                className={`h-2 rounded-full transition-all ${
                  idx === currentIndex ? 'bg-[#f3a847] w-6' : 'bg-gray-300 w-2 hover:bg-gray-400'
                }`}
              />
            ))}
          </div>
        </div>
      )}
    </motion.div>
  );
};
