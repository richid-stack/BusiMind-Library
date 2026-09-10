import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Book } from '../../types';
import { KindleBookCard } from './KindleBookCard';
import { Layers } from 'lucide-react';

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.05
    }
  }
};

const itemVariants = {
  hidden: { opacity: 0, y: 10 },
  visible: { opacity: 1, y: 0 }
};

interface Props {
  books: Book[];
  onOpenReader: (book: Book) => void;
  onTestDeliver: (book: Book) => void;
  onExtractRAG: (book: Book) => void;
  onOpenLinkModal: (book: Book) => void;
  onDeleteBook: (id: string, title: string) => void;
  isDeliveringId: string | null;
  extractingRAGId: string | null;
  ragSuccessMessages: Record<string, string>;
  isAdmin?: boolean;
}

export const BookstoreShelves: React.FC<Props> = ({
  books,
  onOpenReader,
  onTestDeliver,
  onExtractRAG,
  onOpenLinkModal,
  onDeleteBook,
  isDeliveringId,
  extractingRAGId,
  ragSuccessMessages,
  isAdmin = false,
}) => {
  // Group all books dynamically by category
  const booksByCategory = books.reduce((acc, book) => {
    const cat = book.category || 'Other & Uncategorized';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(book);
    return acc;
  }, {} as Record<string, Book[]>);

  const categories = Object.keys(booksByCategory).sort();

  return (
    <div className="space-y-12 py-4">
      {books.length === 0 && (
        <div className="text-center py-20 px-6 border border-dashed border-gray-300 rounded-2xl bg-white shadow-sm">
          <Layers className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-800 font-display mb-2">The Bookstore is Empty</h2>
          <p className="text-gray-500 max-w-md mx-auto">
            You don't have any books indexed yet. Forward books from your private Telegram channel to the bot to instantly auto-index and fetch covers for them!
          </p>
        </div>
      )}

      {categories.map((category) => {
        const categoryBooks = booksByCategory[category];
        
        return (
          <motion.div 
            key={category} 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="space-y-4"
          >
            <div className="flex items-center justify-between border-b border-gray-200 pb-2">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded bg-[#0f1111] text-white shadow-sm">
                  <Layers className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-display font-bold text-xl sm:text-2xl text-[#0f1111] flex items-center gap-2">
                    <span>{category}</span>
                  </h3>
                  <p className="text-sm text-gray-500 mt-0.5">Top picks for you in this category.</p>
                </div>
              </div>
              <span className="text-sm text-[#007185] font-medium hover:text-[#c45500] hover:underline cursor-pointer">
                See all {categoryBooks.length} results
              </span>
            </div>
            
            <motion.div 
              className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4"
              variants={containerVariants}
              initial="hidden"
              animate="visible"
            >
              <AnimatePresence mode="popLayout">
                {categoryBooks.map((book) => (
                  <KindleBookCard
                    key={book.id}
                    book={book}
                    onOpenReader={onOpenReader}
                    onTestDeliver={onTestDeliver}
                    onExtractRAG={onExtractRAG}
                    onOpenLinkModal={onOpenLinkModal}
                    onDeleteBook={onDeleteBook}
                    isDelivering={isDeliveringId === book.id}
                    extractingRAGId={extractingRAGId}
                    ragSuccessMsg={ragSuccessMessages[book.id]}
                    isAdmin={isAdmin}
                  />
                ))}
              </AnimatePresence>
            </motion.div>
          </motion.div>
        );
      })}
    </div>
  );
};
