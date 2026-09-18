import React, { useState, useRef } from 'react';
import { motion, useMotionValue, useSpring, useTransform } from 'motion/react';
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
import { triggerHaptic } from '../../lib/telegram';

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
  const [isHovered, setIsHovered] = useState(false);
  const hasFile = Boolean(book.channelMessageId);

  // 3D Motion Physics values
  const pointerX = useMotionValue(0);
  const pointerY = useMotionValue(0);

  const springConfig = { stiffness: 350, damping: 25 };
  const rotateX = useSpring(useTransform(pointerY, [-0.5, 0.5], [8, -8]), springConfig);
  const rotateY = useSpring(useTransform(pointerX, [-0.5, 0.5], [-10, 10]), springConfig);
  const elevationScale = useSpring(isHovered ? 1.03 : 1, springConfig);

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width - 0.5;
    const y = (e.clientY - rect.top) / rect.height - 0.5;
    pointerX.set(x);
    pointerY.set(y);
  };

  const handlePointerEnter = () => {
    setIsHovered(true);
  };

  const handlePointerLeave = () => {
    setIsHovered(false);
    pointerX.set(0);
    pointerY.set(0);
  };

  const handleCardClick = () => {
    triggerHaptic('light');
    onOpenReader(book);
  };

  return (
    <motion.div 
      variants={{
        hidden: { opacity: 0, y: 15 },
        visible: { opacity: 1, y: 0 }
      }}
      exit={{ opacity: 0, scale: 0.95 }}
      whileHover={{ y: -5, transition: { type: 'spring', stiffness: 400, damping: 25 } }}
      className="group flex flex-col bg-white hover:bg-slate-50/70 border border-gray-200/90 hover:border-[#f3a847]/80 rounded-xl p-3.5 transition-colors duration-200 shadow-sm hover:shadow-xl relative select-none"
    >
      {/* 3D Realistic Book Jacket Container with Physics */}
      <motion.div
        onClick={handleCardClick}
        onPointerMove={handlePointerMove}
        onPointerEnter={handlePointerEnter}
        onPointerLeave={handlePointerLeave}
        style={{
          perspective: 1000,
          rotateX,
          rotateY,
          scale: elevationScale,
          transformStyle: 'preserve-3d',
        }}
        whileTap={{ scale: 0.96, transition: { type: 'spring', stiffness: 500, damping: 20 } }}
        className="w-full aspect-[2/3] max-h-64 sm:max-h-72 mx-auto rounded-r-lg rounded-l-xs book-card-shadow relative overflow-hidden cursor-pointer mb-3 bg-gray-100 will-change-transform"
      >
        {/* Book Spine 3D Shading */}
        <div className="book-spine-effect" />
        {/* Realistic Paper Pages Edge */}
        <div className="book-page-edge" />

        {/* Dynamic Specular Glare Reflection */}
        {isHovered && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.25 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 pointer-events-none rounded-r-lg z-15"
            style={{
              background: 'radial-gradient(circle at 50% 20%, rgba(255,255,255,0.7) 0%, rgba(255,255,255,0) 65%)',
            }}
          />
        )}

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
          <motion.div 
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="absolute top-2 right-2 bg-[#131921]/90 backdrop-blur-md text-[#ffd814] font-bold text-xs px-2.5 py-0.5 rounded-full shadow flex items-center gap-1 z-20 border border-[#ffd814]/30"
          >
            <CheckCircle2 className="w-3.5 h-3.5 text-[#ffd814]" />
            <span>Direct</span>
          </motion.div>
        )}

        {/* Hover Quick Read Overlay */}
        <div className="absolute inset-0 bg-[#0f1111]/85 backdrop-blur-[3px] opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex flex-col items-center justify-center gap-2 p-3 text-center z-20">
          <motion.button
            whileHover={{ scale: 1.04 }}
            whileTap={{ scale: 0.94 }}
            transition={{ type: 'spring', stiffness: 500, damping: 25 }}
            onClick={(e) => {
              e.stopPropagation();
              triggerHaptic('medium');
              onOpenReader(book);
            }}
            className="w-full py-2 px-3 bg-[#ffd814] hover:bg-[#f7ca00] text-[#0f1111] text-sm font-bold rounded-lg shadow-md flex items-center justify-center gap-1.5 transition-colors border border-[#fcd200] cursor-pointer"
          >
            <BookOpen className="w-4 h-4" />
            <span>Read Summary</span>
          </motion.button>

          {isAdmin && hasFile && (
            <motion.button
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.94 }}
              transition={{ type: 'spring', stiffness: 500, damping: 25 }}
              onClick={(e) => {
                e.stopPropagation();
                triggerHaptic('medium');
                onTestDeliver(book);
              }}
              disabled={isDelivering}
              className="w-full py-2 px-3 bg-[#ffa41c] hover:bg-[#fa8900] text-[#0f1111] text-sm font-bold rounded-lg flex items-center justify-center gap-1.5 transition-colors border border-[#ff8f00] cursor-pointer"
            >
              <Send className="w-4 h-4" />
              <span>{isDelivering ? 'Dispatching...' : 'Deliver to Bot'}</span>
            </motion.button>
          )}

          {!isAdmin && hasFile && (
            <motion.button
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.94 }}
              transition={{ type: 'spring', stiffness: 500, damping: 25 }}
              onClick={(e) => {
                e.stopPropagation();
                triggerHaptic('medium');
                onTestDeliver(book);
              }}
              disabled={isDelivering}
              className="w-full py-2 px-3 bg-[#ffa41c] hover:bg-[#fa8900] text-[#0f1111] text-sm font-bold rounded-lg flex items-center justify-center gap-1.5 transition-colors border border-[#ff8f00] cursor-pointer"
            >
              <Send className="w-4 h-4" />
              <span>{isDelivering ? 'Connecting...' : 'Get on Telegram'}</span>
            </motion.button>
          )}

          {isAdmin && (
            <>
              <motion.button
                whileHover={{ scale: 1.04 }}
                whileTap={{ scale: 0.94 }}
                transition={{ type: 'spring', stiffness: 500, damping: 25 }}
                onClick={(e) => {
                  e.stopPropagation();
                  triggerHaptic('light');
                  onExtractRAG(book);
                }}
                disabled={extractingRAGId === book.id}
                className="w-full py-2 px-3 bg-white hover:bg-gray-100 text-[#0f1111] text-sm font-medium rounded-lg flex items-center justify-center gap-1.5 transition-colors border border-gray-300 cursor-pointer"
              >
                <Brain className="w-4 h-4 text-[#007185]" />
                <span>{extractingRAGId === book.id ? 'Extracting...' : 'Mental Models'}</span>
              </motion.button>

              {ragSuccessMsg && (
                <div className="text-xs text-emerald-400 font-bold mt-1 animate-pulse">
                  {ragSuccessMsg}
                </div>
              )}
            </>
          )}
        </div>
      </motion.div>

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
            onClick={handleCardClick}
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
            {book.publicationYear && (
              <span className="text-xs text-[#007185] hover:underline cursor-pointer">({book.publicationYear})</span>
            )}
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
          <motion.button
            whileHover={{ x: 2 }}
            whileTap={{ scale: 0.95 }}
            onClick={handleCardClick}
            className="text-sm font-semibold text-[#007185] hover:text-[#c45500] flex items-center gap-1 cursor-pointer"
          >
            <span>Read Summary</span>
          </motion.button>

          {isAdmin ? (
            <div className="flex items-center gap-1">
              <motion.button
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                onClick={() => {
                  triggerHaptic('light');
                  onOpenLinkModal(book);
                }}
                title={hasFile ? 'Edit Telegram channel link' : 'Link to Telegram channel'}
                className={`p-1.5 rounded-lg text-sm transition-colors cursor-pointer ${
                  hasFile
                    ? 'text-[#007600] hover:bg-emerald-50'
                    : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'
                }`}
              >
                <Link2 className="w-4 h-4" />
              </motion.button>

              <motion.button
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                onClick={() => {
                  triggerHaptic('medium');
                  onDeleteBook(book.id, book.title);
                }}
                title="Remove book"
                className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
              >
                <Trash2 className="w-4 h-4" />
              </motion.button>
            </div>
          ) : (
            <motion.button
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.93 }}
              transition={{ type: 'spring', stiffness: 500, damping: 25 }}
              onClick={() => {
                triggerHaptic('medium');
                onTestDeliver(book);
              }}
              title="Deliver to Telegram"
              className="text-xs font-semibold text-sky-700 hover:text-sky-900 flex items-center gap-1.5 bg-sky-50 hover:bg-sky-100 px-3 py-1.5 rounded-lg border border-sky-200 transition-colors shadow-xs cursor-pointer"
            >
              <Send className="w-3.5 h-3.5 text-[#229ed9]" />
              <span>Get on Telegram</span>
            </motion.button>
          )}
        </div>
      </div>
    </motion.div>
  );
};
