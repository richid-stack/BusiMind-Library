import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Book } from '../../types';
import {
  BookOpen,
  Star,
  Send,
  Brain,
  Link2,
  Trash2,
  CheckCircle2,
  Sparkles,
} from 'lucide-react';

interface Props {
  book: Book;
  onOpenReader: (book: Book) => void;
  onTestDeliver: (book: Book) => void;
  onExtractRAG: (book: Book) => void;
  onOpenLinkModal: (book: Book) => void;
  onDeleteBook: (id: string, title: string) => void;
  isDelivering: boolean;
  extractingRAGId: string | null;
  ragSuccessMsg?: string;
  isAdmin?: boolean;
}

export const KindleBookCard: React.FC<Props> = ({
  book,
  onOpenReader,
  onTestDeliver,
  onExtractRAG,
  onOpenLinkModal,
  onDeleteBook,
  isDelivering,
  extractingRAGId,
  ragSuccessMsg,
  isAdmin = false,
}) => {
  const [imageError, setImageError] = useState(false);
  const hasFile = Boolean(book.channelMessageId);

  return (
    <motion.div 
      variants={{
        hidden: { opacity: 0, y: 15 },
        visible: { opacity: 1, y: 0 }
      }}
      exit={{ opacity: 0, scale: 0.95 }}
      whileHover={{ y: -4, transition: { duration: 0.2 } }}
      className="group flex flex-col bg-white hover:bg-slate-50/50 border border-gray-200 hover:border-[#f3a847] rounded-lg p-3.5 transition-all duration-200 shadow-sm hover:shadow-md relative"
    >
      {/* 3D Realistic Book Jacket Container */}
      <div
        onClick={() => onOpenReader(book)}
        className="w-full aspect-[2/3] max-h-64 sm:max-h-72 mx-auto rounded-r-lg rounded-l-xs book-card-shadow book-cover-wrap relative overflow-hidden cursor-pointer select-none mb-3 bg-gray-100"
      >
        {/* Book Spine 3D Shading */}
        <div className="book-spine-effect" />
        {/* Realistic Paper Pages Edge */}
        <div className="book-page-edge" />

        {book.coverImageUrl && !imageError ? (
          <img
            src={book.coverImageUrl}
            alt={book.title}
            referrerPolicy="no-referrer"
            onError={() => setImageError(true)}
            className="w-full h-full object-cover rounded-r-lg"
          />
        ) : (
          <div className="w-full h-full p-4 flex flex-col justify-between bg-[#131921] border-l-4 border-[#f3a847] text-white relative">
            {/* Top Foil Category Stamp */}
            <div className="flex items-center justify-between border-b border-white/10 pb-2">
              <span className="text-[10px] font-bold tracking-widest uppercase text-[#f3a847]">
                BusiMind
              </span>
              <span className="text-[10px] font-mono text-gray-300">{book.publicationYear || 2024}</span>
            </div>

            {/* Embossed Book Title & Author */}
            <div className="my-auto py-2">
              <h4 className="font-display font-bold text-base sm:text-lg leading-snug tracking-tight line-clamp-3 text-white">
                {book.title}
              </h4>
              <div className="w-8 h-0.5 bg-[#f3a847] my-3" />
              <p className="text-xs text-gray-300 font-medium italic line-clamp-2">{book.author}</p>
            </div>

            {/* Bottom Book Footer */}
            <div className="pt-2 border-t border-white/10 flex items-center justify-between text-[11px] text-gray-400 font-mono">
              <span className="capitalize">{book.difficulty}</span>
              <span className="text-[#f3a847] font-bold">★ {book.ratingScore || 4.8}</span>
            </div>
          </div>
        )}

        {/* Amazon-style Prime / Direct Badge */}
        {hasFile && (
          <div className="absolute top-2 right-2 bg-[#131921]/90 backdrop-blur-md text-[#ffd814] font-bold text-xs px-2.5 py-0.5 rounded-full shadow flex items-center gap-1 z-20 border border-[#ffd814]/30">
            <CheckCircle2 className="w-3.5 h-3.5 text-[#ffd814]" />
            <span>Direct</span>
          </div>
        )}

        {/* Hover Quick Read Overlay */}
        <div className="absolute inset-0 bg-[#0f1111]/85 backdrop-blur-[2px] opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-2 p-3 text-center z-20">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onOpenReader(book);
            }}
            className="w-full py-2 px-3 bg-[#ffd814] hover:bg-[#f7ca00] text-[#0f1111] text-sm font-bold rounded-md shadow-sm flex items-center justify-center gap-1.5 transition-colors border border-[#fcd200]"
          >
            <BookOpen className="w-4 h-4" />
            <span>Read Summary</span>
          </button>

          {hasFile && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onTestDeliver(book);
              }}
              disabled={isDelivering}
              className="w-full py-2 px-3 bg-[#ffa41c] hover:bg-[#fa8900] text-[#0f1111] text-sm font-bold rounded-md flex items-center justify-center gap-1.5 transition-colors border border-[#ff8f00]"
            >
              <Send className="w-4 h-4" />
              <span>{isDelivering ? 'Dispatching...' : 'Deliver to Bot'}</span>
            </button>
          )}

          <button
            onClick={(e) => {
              e.stopPropagation();
              onExtractRAG(book);
            }}
            disabled={extractingRAGId === book.id}
            className="w-full py-2 px-3 bg-white hover:bg-gray-100 text-[#0f1111] text-sm font-medium rounded-md flex items-center justify-center gap-1.5 transition-colors border border-gray-300"
          >
            <Brain className="w-4 h-4 text-[#007185]" />
            <span>{extractingRAGId === book.id ? 'Extracting...' : 'Mental Models'}</span>
          </button>

          {ragSuccessMsg && (
            <div className="text-xs text-emerald-400 font-bold mt-1 animate-pulse">
              {ragSuccessMsg}
            </div>
          )}
        </div>
      </div>

      {/* Book Metadata Info (Clean Amazon Book Card Layout) */}
      <div className="flex-1 flex flex-col justify-between mt-1">
        <div>
          {/* Category Chip */}
          <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
            <span className="font-semibold text-[#007185] hover:underline cursor-pointer truncate max-w-[130px]">
              {book.category}
            </span>
            <span className="capitalize text-gray-500 text-[11px]">{book.difficulty}</span>
          </div>

          {/* Book Title */}
          <h3
            onClick={() => onOpenReader(book)}
            className="font-display font-bold text-base text-[#0f1111] hover:text-[#c45500] cursor-pointer transition-colors leading-snug line-clamp-2"
          >
            {book.title}
          </h3>

          {/* Author */}
          <p className="text-sm text-gray-600 mt-1 line-clamp-1">by <span className="text-[#007185] hover:underline cursor-pointer">{book.author}</span></p>

          {/* Amazon Star Rating */}
          <div className="flex items-center gap-1.5 mt-2 text-sm">
            <div className="flex items-center text-[#de7921]">
              <Star className="w-4 h-4 fill-[#de7921]" />
              <Star className="w-4 h-4 fill-[#de7921]" />
              <Star className="w-4 h-4 fill-[#de7921]" />
              <Star className="w-4 h-4 fill-[#de7921]" />
              <Star className="w-4 h-4 fill-[#de7921]/50" />
            </div>
            <span className="font-bold text-[#0f1111] text-sm">{book.ratingScore || 4.8}</span>
            <span className="text-xs text-[#007185] hover:underline cursor-pointer">({book.publicationYear || 2024})</span>
          </div>

          {/* Amazon Price Tag */}
          <div className="mt-2.5 text-sm">
            <div className="flex items-baseline gap-1.5">
              <span className="text-xs text-gray-600">Kindle</span>
              <span className="text-base font-bold text-[#b12704]">$0.00</span>
              <span className="text-xs text-gray-500">with BusiMind Pass</span>
            </div>
          </div>
        </div>

        {/* Actions Footer */}
        <div className="mt-4 pt-3 border-t border-gray-200 flex items-center justify-between gap-1 text-sm">
          <button
            onClick={() => onOpenReader(book)}
            className="text-sm font-semibold text-[#007185] hover:text-[#c45500] flex items-center gap-1"
          >
            <span>Read Summary</span>
          </button>

          {isAdmin ? (
            <div className="flex items-center gap-1">
              <button
                onClick={() => onOpenLinkModal(book)}
                title={hasFile ? 'Edit Telegram channel link' : 'Link to Telegram channel'}
                className={`p-1.5 rounded text-sm transition-colors ${
                  hasFile
                    ? 'text-[#007600] hover:bg-emerald-50'
                    : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'
                }`}
              >
                <Link2 className="w-4 h-4" />
              </button>

              <button
                onClick={() => onDeleteBook(book.id, book.title)}
                title="Remove book"
                className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => onTestDeliver(book)}
              title="Deliver to Telegram"
              className="text-xs font-semibold text-sky-700 hover:text-sky-900 flex items-center gap-1.5 bg-sky-50 hover:bg-sky-100 px-2.5 py-1.5 rounded border border-sky-200 transition-colors"
            >
              <Send className="w-3.5 h-3.5 text-[#229ed9]" />
              <span>Get on Telegram</span>
            </button>
          )}
        </div>
      </div>
    </motion.div>
  );
};
