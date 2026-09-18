import { apiFetch } from '../lib/api';
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Book, DistributionType, BookRequest } from '../types';
import {
  BookOpen,
  Plus,
  Search,
  Tag,
  ExternalLink,
  Edit2,
  Trash2,
  Link2,
  CheckCircle2,
  AlertCircle,
  FileText,
  ShieldCheck,
  Building2,
  Send,
  Sparkles,
  ClipboardList,
  Clock,
  Flame,
  CheckCircle,
  XCircle,
  Brain,
  LayoutGrid,
  Layers,
  Table as TableIcon,
  Filter,
  SlidersHorizontal,
} from 'lucide-react';
import { KindleHeroFeature } from './bookstore/KindleHeroFeature';
import { BookstoreShelves } from './bookstore/BookstoreShelves';
import { KindleBookCard } from './bookstore/KindleBookCard';
import { KindleReaderModal } from './bookstore/KindleReaderModal';
import { TelegramConnectModal } from './modals/TelegramConnectModal';
import { getTelegramUser, triggerHaptic } from '../lib/telegram';
import { useAuth } from '../context/AuthContext';
import {
  HeroFeatureSkeleton,
  BookstoreShelvesSkeleton,
  BookGridSkeleton,
  BookTableSkeleton,
  RequestsQueueSkeleton,
} from './common/Skeletons';
import { useLoading } from '../context/LoadingContext';

interface Props {
  channelIdConfigured: boolean;
  channelId?: string;
  onRefresh?: () => void;
  isAdmin?: boolean;
  externalSearchQuery?: string;
}

export const CatalogManager: React.FC<Props> = ({
  channelIdConfigured,
  channelId,
  onRefresh,
  isAdmin = false,
  externalSearchQuery,
}) => {
  const { telegramChatId, user } = useAuth();
  const { startLoading, stopLoading } = useLoading();
  const [books, setBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedDist, setSelectedDist] = useState<string>('all');
  const [selectedType, setSelectedType] = useState<string>('all');

  // Sync external search query from header search bar
  useEffect(() => {
    if (externalSearchQuery !== undefined) {
      setSearch(externalSearchQuery);
    }
  }, [externalSearchQuery]);

  // Interactive Kindle Storefront View Controls
  const [viewMode, setViewMode] = useState<'shelves' | 'grid' | 'table'>('shelves');
  const [readingBook, setReadingBook] = useState<Book | null>(null);
  const [heroBookId, setHeroBookId] = useState<string | null>(null);

  // Quick Link Bar at the top
  const [quickLinkUrl, setQuickLinkUrl] = useState('');
  const [quickLinkBookId, setQuickLinkBookId] = useState('');
  const [quickLinkLoading, setQuickLinkLoading] = useState(false);
  const [quickLinkSuccess, setQuickLinkSuccess] = useState<string | null>(null);

  // Link Message ID Modal / State (Moved to SetupAssistant but keeping simple vars for TS to not break if used elsewhere or removing safely)
  const [deliveringBookId, setDeliveringBookId] = useState<string | null>(null);
  const [deliveryResult, setDeliveryResult] = useState<{ id: string; msg: string; ok: boolean } | null>(null);

  const featuredBooks = books.filter(b => b.isFeatured) || [];
  const heroBooks = featuredBooks.length > 0 ? featuredBooks : books.slice(0, 3);
  const [extractingRAGBookId, setExtractingRAGBookId] = useState<string | null>(null);
  const [extractedRAGSuccess, setExtractedRAGSuccess] = useState<Record<string, string>>({});

  const handleExtractRAG = async (book: Book) => {
    setExtractingRAGBookId(book.id);
    try {
      const res = await apiFetch('/api/finance/rag/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bookIdOrTitle: book.title,
          author: book.author,
          notes: `${book.description} ${book.whyRecommended} ${book.howItHelps || ''} ${(book.keyTakeaways || []).join(' ')}`,
        }),
      });
      const data = await res.json();
      if (data.success && data.extracted) {
        setExtractedRAGSuccess((prev) => ({
          ...prev,
          [book.id]: `+${data.extracted.length} Models Extracted!`,
        }));
      }
    } catch (err) {
      console.error('Failed to extract RAG models from book', err);
    } finally {
      setExtractingRAGBookId(null);
    }
  };

  // Add Book Modal State
  const [isAdding, setIsAdding] = useState(false);
  const [connectModalBook, setConnectModalBook] = useState<Book | null>(null);
  const [newBook, setNewBook] = useState({
    title: '',
    author: '',
    category: 'Entrepreneurship',
    subcategory: '',
    description: '',
    whyRecommended: '',
    bestFor: '',
    difficulty: 'beginner',
    tags: '',
    publicationYear: 2024,
    ratingScore: 4.8,
    distributionType: 'telegram_repository' as DistributionType,
    channelMessageId: '',
    externalPurchaseUrl: '',
    externalLibraryUrl: '',
  });

  // Requests / Wishlist / Linker Sub-View
  const [activeSubTab, setActiveSubTab] = useState<'catalog' | 'requests' | 'linker'>('catalog');
  const [requests, setRequests] = useState<BookRequest[]>([]);
  const [requestsLoading, setRequestsLoading] = useState(false);
  const [requestSearch, setRequestSearch] = useState('');
  const [requestFilterStatus, setRequestFilterStatus] = useState<'all' | 'pending' | 'acquired' | 'dismissed'>('all');

  const fetchBooks = async () => {
    setLoading(true);
    startLoading('Loading executive bookstore...');
    try {
      const res = await apiFetch('/api/books');
      if (res.ok) {
        const data = await res.json();
        const booksArray = Array.isArray(data) ? data : [];
        setBooks(booksArray);
        if (booksArray.length > 0 && !quickLinkBookId) {
          setQuickLinkBookId(booksArray[0].id);
        }
      } else {
        throw new Error(`Server returned ${res.status}`);
      }
    } catch (err) {
      console.error('Failed to fetch books', err);
    } finally {
      setLoading(false);
      stopLoading();
    }
  };

  const fetchRequests = async () => {
    setRequestsLoading(true);
    try {
      const res = await apiFetch('/api/requests');
      if (res.ok) {
        const data = await res.json();
        setRequests(Array.isArray(data) ? data : []);
      } else {
        throw new Error(`Server returned ${res.status}`);
      }
    } catch (err) {
      console.error('Failed to fetch book requests', err);
    } finally {
      setRequestsLoading(false);
    }
  };

  useEffect(() => {
    fetchBooks();
    fetchRequests();
  }, []);

  const handleUpdateRequestStatus = async (id: string, status: 'pending' | 'acquired' | 'dismissed') => {
    try {
      const res = await apiFetch(`/api/requests/${id}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      if (res.ok) {
        setRequests((prev) => prev.map((r) => (r.id === id ? { ...r, status } : r)));
        if (onRefresh) onRefresh();
      }
    } catch (err) {
      console.error('Failed to update request status', err);
    }
  };

  const handleDeleteRequest = async (id: string) => {
    if (!confirm('Are you sure you want to remove this request from the wishlist?')) return;
    try {
      const res = await apiFetch(`/api/requests/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setRequests((prev) => prev.filter((r) => r.id !== id));
        if (onRefresh) onRefresh();
      }
    } catch (err) {
      console.error('Failed to delete request', err);
    }
  };

  const handleFulfillRequest = (req: BookRequest) => {
    setNewBook({
      title: req.requestedTitle,
      author: req.requestedAuthor || '',
      category: req.topic && req.topic.length < 30 ? req.topic : 'Entrepreneurship',
      subcategory: req.topic || '',
      description: `Requested by BusiMind users (${req.requestCount} request(s)).`,
      whyRecommended: `Highly requested business book by users.`,
      bestFor: 'Entrepreneurs, managers, and operators.',
      difficulty: 'beginner',
      tags: req.topic ? req.topic.toLowerCase().replace(/[^a-z0-9]/g, '') : 'strategy',
      publicationYear: 2024,
      ratingScore: 4.8,
      distributionType: 'telegram_repository',
      channelMessageId: '',
      externalPurchaseUrl: '',
      externalLibraryUrl: '',
    });
    setIsAdding(true);
  };

  // Helper to parse message ID and channel from string or link
  const parseTelegramLinkOrId = (input: string) => {
    const trimmed = input.trim();
    // Case 1: https://t.me/c/3969099877/234
    const channelMatch = trimmed.match(/t\.me\/c\/(\d+)\/(\d+)/);
    if (channelMatch) {
      return {
        channelId: `-100${channelMatch[1]}`,
        messageId: parseInt(channelMatch[2], 10),
      };
    }
    // Case 2: https://t.me/username/234
    const publicMatch = trimmed.match(/t\.me\/[^\/]+\/(\d+)/);
    if (publicMatch) {
      return {
        channelId: channelId || process.env.TELEGRAM_CHANNEL_ID,
        messageId: parseInt(publicMatch[1], 10),
      };
    }
    // Case 3: Just the number "234"
    const parsedNum = parseInt(trimmed, 10);
    if (!isNaN(parsedNum)) {
      return {
        channelId: channelId || process.env.TELEGRAM_CHANNEL_ID,
        messageId: parsedNum,
      };
    }
    return null;
  };

  const handleQuickLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickLinkUrl || !quickLinkBookId) return;

    const parsed = parseTelegramLinkOrId(quickLinkUrl);
    if (!parsed || !parsed.messageId) {
      alert('Could not detect Message ID. Please enter a valid Telegram link (e.g. https://t.me/c/3969099877/234) or a number (e.g. 234).');
      return;
    }

    setQuickLinkLoading(true);
    setQuickLinkSuccess(null);

    try {
      const res = await apiFetch(`/api/books/${quickLinkBookId}/link-channel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          channelMessageId: parsed.messageId,
          channelChatId: parsed.channelId || channelId,
        }),
      });

      if (res.ok) {
        const selectedBook = books.find((b) => b.id === quickLinkBookId);
        setQuickLinkSuccess(`Successfully linked "${selectedBook?.title}" to Channel Msg #${parsed.messageId}!`);
        setQuickLinkUrl('');
        await fetchBooks();
        if (onRefresh) onRefresh();
        setTimeout(() => setQuickLinkSuccess(null), 5000);
      } else {
        alert('Failed to link Telegram message. Verify channel credentials.');
      }
    } catch (err: any) {
      alert(`Error linking book: ${err.message}`);
    } finally {
      setQuickLinkLoading(false);
    }
  };

  const handleTestDeliver = async (book: Book) => {
    setDeliveringBookId(book.id);
    setDeliveryResult(null);

    const tgUser = getTelegramUser();
    const effectiveChatId = tgUser?.id || telegramChatId;
    const endpoint = isAdmin ? `/api/books/${book.id}/test-deliver` : `/api/books/${book.id}/deliver`;

    if (!effectiveChatId && !isAdmin) {
      setConnectModalBook(book);
      setDeliveringBookId(null);
      return;
    }

    try {
      const res = await apiFetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chatId: effectiveChatId, uid: user?.uid }),
      });
      const data = await res.json();

      if (res.ok && data.success) {
        triggerHaptic('medium');
        if (data.delivered) {
          setDeliveryResult({
            id: book.id,
            msg: data.message || `Delivered to your Telegram! (Msg #${data.deliveredMessageId})`,
            ok: true,
          });
        } else if (data.deepLink) {
          window.open(data.deepLink, '_blank');
          setDeliveryResult({
            id: book.id,
            msg: `Opening BusiMind Bot on Telegram to receive "${book.title}"...`,
            ok: true,
          });
        } else {
          setDeliveryResult({
            id: book.id,
            msg: `"${book.title}" delivery requested.`,
            ok: true,
          });
        }
      } else {
        setDeliveryResult({
          id: book.id,
          msg: data.error || 'Failed to deliver book',
          ok: false,
        });
      }
    } catch (err: any) {
      setDeliveryResult({
        id: book.id,
        msg: err.message || 'Delivery error',
        ok: false,
      });
    } finally {
      setDeliveringBookId(null);
      setTimeout(() => setDeliveryResult(null), 6000);
    }
  };

  const handleCreateBook = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const parsedMsgId = newBook.channelMessageId ? parseTelegramLinkOrId(newBook.channelMessageId)?.messageId : undefined;

      const res = await apiFetch('/api/books', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...newBook,
          channelMessageId: parsedMsgId,
          tags: newBook.tags.split(',').map((t) => t.trim()).filter(Boolean),
        }),
      });

      if (res.ok) {
        await fetchBooks();
        if (onRefresh) onRefresh();
        setIsAdding(false);
        setNewBook({
          title: '',
          author: '',
          category: 'Entrepreneurship',
          subcategory: '',
          description: '',
          whyRecommended: '',
          bestFor: '',
          difficulty: 'beginner',
          tags: '',
          publicationYear: 2024,
          ratingScore: 4.8,
          distributionType: 'telegram_repository',
          channelMessageId: '',
          externalPurchaseUrl: '',
          externalLibraryUrl: '',
        });
      }
    } catch (err) {
      console.error('Error creating book', err);
    }
  };

  const handleDeleteBook = async (id: string, title: string) => {
    if (!confirm(`Are you sure you want to remove "${title}" from the catalog?`)) return;

    try {
      const res = await apiFetch(`/api/books/${id}`, { method: 'DELETE' });
      if (res.ok) {
        await fetchBooks();
        if (onRefresh) onRefresh();
      }
    } catch (err) {
      console.error('Failed to delete book', err);
    }
  };

  const filteredBooks = books.filter((b) => {
    const matchesSearch =
      b.title.toLowerCase().includes(search.toLowerCase()) ||
      b.author.toLowerCase().includes(search.toLowerCase()) ||
      b.tags?.some((t) => t.toLowerCase().includes(search.toLowerCase()));

    const matchesCategory = selectedCategory === 'all' || b.category.toLowerCase().includes(selectedCategory.toLowerCase());
    const matchesDist = selectedDist === 'all' || b.distributionType === selectedDist;
    const matchesType = selectedType === 'all' || (b.resourceType || 'book') === selectedType;

    return matchesSearch && matchesCategory && matchesDist && matchesType;
  });

  const filteredRequests = requests.filter((r) => {
    const matchesSearch =
      r.requestedTitle.toLowerCase().includes(requestSearch.toLowerCase()) ||
      (r.requestedAuthor && r.requestedAuthor.toLowerCase().includes(requestSearch.toLowerCase())) ||
      r.searchQuery.toLowerCase().includes(requestSearch.toLowerCase()) ||
      (r.topic && r.topic.toLowerCase().includes(requestSearch.toLowerCase()));

    const matchesStatus = requestFilterStatus === 'all' || r.status === requestFilterStatus;
    return matchesSearch && matchesStatus;
  });

  const categories = Array.from(new Set(books.map((b) => b.category)));

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Sub-navigation tabs: Storefront Catalog vs User Requests vs Channel File Linker */}
      {/* SUB-TABS (Admin Only) */}
      {isAdmin && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-200 pb-4">
          <div className="flex items-center gap-1.5 bg-white p-1 rounded-xl border border-gray-200 text-sm shadow-sm overflow-x-auto">
            <motion.button
              whileTap={{ scale: 0.96 }}
              onClick={() => {
                triggerHaptic('light');
                setActiveSubTab('catalog');
              }}
              className={`relative flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors whitespace-nowrap cursor-pointer ${
                activeSubTab === 'catalog' ? 'text-white font-bold' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              {activeSubTab === 'catalog' && (
                <motion.div
                  layoutId="activeSubTabIndicator"
                  className="absolute inset-0 bg-[#131921] rounded-lg shadow-sm"
                  transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                />
              )}
              <BookOpen className="w-4 h-4 relative z-10" />
              <span className="relative z-10">Storefront Catalog</span>
              <span className={`relative z-10 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                activeSubTab === 'catalog' ? 'bg-[#f3a847] text-slate-950' : 'bg-gray-100 text-gray-700'
              }`}>
                {books.length}
              </span>
            </motion.button>

            <motion.button
              whileTap={{ scale: 0.96 }}
              onClick={() => {
                triggerHaptic('light');
                setActiveSubTab('requests');
              }}
              className={`relative flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors whitespace-nowrap cursor-pointer ${
                activeSubTab === 'requests' ? 'text-white font-bold' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              {activeSubTab === 'requests' && (
                <motion.div
                  layoutId="activeSubTabIndicator"
                  className="absolute inset-0 bg-[#131921] rounded-lg shadow-sm"
                  transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                />
              )}
              <ClipboardList className="w-4 h-4 relative z-10" />
              <span className="relative z-10">User Requests Queue</span>
              {requests.filter((r) => r.status === 'pending').length > 0 ? (
                <span className="relative z-10 bg-[#c45500] text-white px-2.5 py-0.5 rounded-full text-xs font-bold">
                  {requests.filter((r) => r.status === 'pending').length} pending
                </span>
              ) : (
                <span className="relative z-10 bg-gray-100 text-gray-700 px-2.5 py-0.5 rounded-full text-xs">
                  {requests.length}
                </span>
              )}
            </motion.button>

            <motion.button
              whileTap={{ scale: 0.96 }}
              onClick={() => {
                triggerHaptic('light');
                setActiveSubTab('linker');
              }}
              className={`relative flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors whitespace-nowrap cursor-pointer ${
                activeSubTab === 'linker' ? 'text-white font-bold' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              {activeSubTab === 'linker' && (
                <motion.div
                  layoutId="activeSubTabIndicator"
                  className="absolute inset-0 bg-[#131921] rounded-lg shadow-sm"
                  transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                />
              )}
              <Link2 className="w-4 h-4 relative z-10" />
              <span className="relative z-10">Channel File Linker</span>
              <span className="relative z-10 bg-gray-100 text-gray-700 px-2 py-0.5 rounded-full text-[11px]">
                {books.filter((b) => !b.channelMessageId).length} unlinked
              </span>
            </motion.button>
          </div>

          {activeSubTab === 'requests' ? (
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={fetchRequests}
              disabled={requestsLoading}
              className="text-xs text-[#007185] hover:text-[#c45500] flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-300 hover:border-gray-400 rounded-lg transition-colors self-start sm:self-auto font-medium cursor-pointer shadow-xs"
            >
              <Clock className="w-3.5 h-3.5" />
              {requestsLoading ? 'Refreshing...' : 'Refresh Wishlist'}
            </motion.button>
          ) : (
            <div className="text-xs text-gray-500 hidden sm:block">
              {books.filter((b) => b.channelMessageId).length} of {books.length} titles connected to channel
            </div>
          )}
        </div>
      )}

      {activeSubTab === 'catalog' && (
        <div className="space-y-8">
          {/* 1. BUSIMIND INTELLIGENCE FEATURED SPOTLIGHT CAROUSEL */}
          {loading && books.length === 0 ? (
            <HeroFeatureSkeleton />
          ) : books.length > 0 ? (
            <KindleHeroFeature
              books={heroBooks}
              book={heroBooks[0] || books[0]}
              isAdmin={isAdmin}
              onOpenReader={(b) => setReadingBook(b)}
              onTestDeliver={handleTestDeliver}
              onExtractRAG={handleExtractRAG}
              extractingRAGId={extractingRAGBookId}
              ragSuccessMsg={
                extractingRAGBookId
                  ? undefined
                  : extractedRAGSuccess[
                      (books.find((b) => b.id === heroBookId) ||
                        books.find((b) => b.title.toLowerCase().includes('psychology')) ||
                        books[0]).id
                    ]
              }
              isDelivering={
                deliveringBookId ===
                (books.find((b) => b.id === heroBookId) ||
                  books.find((b) => b.title.toLowerCase().includes('psychology')) ||
                  books[0]).id
              }
            />
          ) : null}

          {/* 2. STOREFRONT DISCOVERY & FILTER TOOLBAR */}
          <div className="space-y-4">
            <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4 bg-white border border-gray-200 p-4 rounded-xl shadow-sm">
              {/* Search Bar */}
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-3" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search titles, authors, keywords, or valuation concepts..."
                  className="w-full bg-white border border-gray-300 rounded-md pl-10 pr-4 py-2 text-xs sm:text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#f3a847] focus:border-[#f3a847]"
                />
              </div>

              {/* View Mode Switcher */}
              <div className={`flex items-center gap-2 ${isAdmin ? '' : 'w-full lg:w-auto flex-1'}`}>
                <div className={`flex items-center bg-gray-100 p-1 rounded-xl border border-gray-200 text-xs ${isAdmin ? '' : 'w-full lg:w-auto'}`}>
                  {(['shelves', 'grid', 'table'] as const).map((mode) => {
                    const isActive = viewMode === mode;
                    const Icon = mode === 'shelves' ? Layers : mode === 'grid' ? LayoutGrid : TableIcon;
                    const label = mode === 'shelves' ? 'Curated Shelves' : mode === 'grid' ? '3D Gallery' : 'Index Table';
                    return (
                      <motion.button
                        key={mode}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => {
                          triggerHaptic('light');
                          setViewMode(mode);
                        }}
                        className={`relative flex-1 lg:flex-none flex justify-center items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition-colors cursor-pointer ${
                          isActive
                            ? 'text-gray-900 font-bold'
                            : 'text-gray-600 hover:text-gray-900'
                        }`}
                      >
                        {isActive && (
                          <motion.div
                            layoutId="activeViewModeIndicator"
                            className="absolute inset-0 bg-white rounded-lg shadow-sm border border-gray-200"
                            transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                          />
                        )}
                        <Icon className="w-3.5 h-3.5 text-[#007185] relative z-10" />
                        <span className="relative z-10">{label}</span>
                      </motion.button>
                    );
                  })}
                </div>

                {isAdmin && (
                  <motion.button
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => {
                      triggerHaptic('medium');
                      setIsAdding(true);
                    }}
                    className="flex items-center gap-2 px-4 py-2 bg-[#ffd814] hover:bg-[#f7ca00] text-[#0f1111] border border-[#fcd200] text-xs sm:text-sm font-bold rounded-lg shadow-sm transition-colors whitespace-nowrap cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Add Book</span>
                  </motion.button>
                )}
              </div>
            </div>

            {/* Category Chips Carousel */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1 custom-scrollbar text-xs">
              <motion.button
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.94 }}
                onClick={() => {
                  triggerHaptic('light');
                  setSelectedCategory('all');
                }}
                className={`relative px-3.5 py-1.5 rounded-full font-medium whitespace-nowrap transition-colors cursor-pointer ${
                  selectedCategory === 'all'
                    ? 'text-white font-bold'
                    : 'bg-white border border-gray-300 text-gray-700 hover:border-gray-400'
                }`}
              >
                {selectedCategory === 'all' && (
                  <motion.div
                    layoutId="activeCategoryPill"
                    className="absolute inset-0 bg-[#131921] rounded-full shadow-sm"
                    transition={{ type: 'spring', stiffness: 450, damping: 30 }}
                  />
                )}
                <span className="relative z-10">All Volumes {isAdmin && `(${books.length})`}</span>
              </motion.button>

              {categories.map((cat) => {
                const isSelected = selectedCategory === cat;
                return (
                  <motion.button
                    key={cat}
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.94 }}
                    onClick={() => {
                      triggerHaptic('light');
                      setSelectedCategory(cat);
                    }}
                    className={`relative px-3.5 py-1.5 rounded-full font-medium whitespace-nowrap transition-colors cursor-pointer ${
                      isSelected
                        ? 'text-white font-bold'
                        : 'bg-white border border-gray-300 text-gray-700 hover:border-gray-400'
                    }`}
                  >
                    {isSelected && (
                      <motion.div
                        layoutId="activeCategoryPill"
                        className="absolute inset-0 bg-[#131921] rounded-full shadow-sm"
                        transition={{ type: 'spring', stiffness: 450, damping: 30 }}
                      />
                    )}
                    <span className="relative z-10">{cat}</span>
                  </motion.button>
                );
              })}
            </div>
          </div>

          {/* 4. MAIN STOREFRONT STAGE */}
          {loading ? (
            viewMode === 'shelves' ? (
              <BookstoreShelvesSkeleton shelfCount={3} />
            ) : viewMode === 'table' ? (
              <BookTableSkeleton rowCount={8} />
            ) : (
              <BookGridSkeleton count={10} />
            )
          ) : filteredBooks.length === 0 ? (
            <div className="text-center py-16 bg-white border border-gray-200 rounded-3xl p-8">
              <BookOpen className="w-12 h-12 text-slate-600 mx-auto mb-3" />
              <h4 className="font-display font-bold text-lg text-gray-800">No volumes found</h4>
              <p className="text-xs text-gray-500 mt-1 max-w-md mx-auto">
                No titles match the selected category or search keyword. Broaden your search or add a new volume.
              </p>
            </div>
          ) : viewMode === 'shelves' && selectedCategory === 'all' && !search ? (
            /* VIEW 1: CURATED SHELVES */
            <BookstoreShelves
              books={filteredBooks}
              onOpenReader={(b) => setReadingBook(b)}
              onTestDeliver={handleTestDeliver}
              onExtractRAG={handleExtractRAG}
              onOpenLinkModal={(b) => {
                setQuickLinkBookId(b.id);
                setActiveSubTab('linker');
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              onDeleteBook={handleDeleteBook}
              isDeliveringId={deliveringBookId}
              extractingRAGId={extractingRAGBookId}
              ragSuccessMessages={extractedRAGSuccess}
              isAdmin={isAdmin}
            />
          ) : viewMode === 'table' ? (
            /* VIEW 2: FINANCIAL INDEX TABLE */
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-gray-50 text-gray-600 font-semibold border-b border-gray-200 uppercase text-[10px] tracking-wider">
                    <tr>
                      <th className="py-3 px-4">Title & Author</th>
                      <th className="py-3 px-4">Category</th>
                      <th className="py-3 px-4">Rating</th>
                      <th className="py-3 px-4">Difficulty</th>
                      {isAdmin ? (
                        <th className="py-3 px-4">Channel File</th>
                      ) : (
                        <th className="py-3 px-4">Availability</th>
                      )}
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filteredBooks.map((book) => (
                      <tr key={book.id} className="hover:bg-gray-50 transition-colors">
                        <td className="py-3 px-4">
                          <button
                            onClick={() => setReadingBook(book)}
                            className="font-bold text-[#0f1111] hover:text-[#007185] hover:underline text-left text-xs sm:text-sm"
                          >
                            {book.title}
                          </button>
                          <p className="text-[11px] text-gray-500">
                            {book.author} {book.publicationYear ? `(${book.publicationYear})` : ''}
                          </p>
                        </td>
                        <td className="py-3 px-4">
                          <span className="px-2 py-0.5 rounded-full bg-gray-100 text-gray-700 text-[11px]">
                            {book.category}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-[#ffa41c] font-bold">★ {book.ratingScore}</td>
                        <td className="py-3 px-4 capitalize text-gray-600">{book.difficulty}</td>
                        <td className="py-3 px-4">
                          {isAdmin ? (
                            book.channelMessageId ? (
                              <span className="text-[11px] font-mono font-semibold text-[#007600] bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                                Msg #{book.channelMessageId}
                              </span>
                            ) : (
                              <span className="text-[11px] text-gray-400">Unlinked</span>
                            )
                          ) : (
                            book.channelMessageId ? (
                              <span className="text-[11px] font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 inline-flex items-center gap-1.5">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                                Available
                              </span>
                            ) : (
                              <span className="text-[11px] text-gray-400">Digital Copy</span>
                            )
                          )}
                        </td>
                        <td className="py-3 px-4 text-right space-x-2">
                          <button
                            onClick={() => setReadingBook(book)}
                            className="px-2.5 py-1 bg-[#ffd814] hover:bg-[#f7ca00] text-[#0f1111] border border-[#fcd200] font-semibold rounded text-[11px] transition-colors"
                          >
                            Read
                          </button>
                          {isAdmin && book.channelMessageId && (
                            <button
                              onClick={() => handleTestDeliver(book)}
                              disabled={deliveringBookId === book.id}
                              className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-[#007600] border border-emerald-200 font-semibold rounded text-[11px] transition-colors"
                            >
                              {deliveringBookId === book.id ? 'Sending...' : 'Deliver'}
                            </button>
                          )}
                          {!isAdmin && book.channelMessageId && (
                            <button
                              onClick={() => handleTestDeliver(book)}
                              title="Get on Telegram"
                              className="px-2.5 py-1 bg-sky-50 hover:bg-sky-100 text-sky-700 border border-sky-200 font-semibold rounded text-[11px] transition-colors"
                            >
                              Get on Telegram
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            /* VIEW 3: 3D REALISTIC BOOK JACKET GALLERY GRID */
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 sm:gap-5">
              {filteredBooks.map((book) => (
                <KindleBookCard
                  key={book.id}
                  book={book}
                  onOpenReader={(b) => setReadingBook(b)}
                  onTestDeliver={handleTestDeliver}
                  onExtractRAG={handleExtractRAG}
                  onOpenLinkModal={(b) => {
                    setQuickLinkBookId(b.id);
                    setActiveSubTab('linker');
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                  onDeleteBook={handleDeleteBook}
                  isDelivering={deliveringBookId === book.id}
                  extractingRAGId={extractingRAGBookId}
                  ragSuccessMsg={extractedRAGSuccess[book.id]}
                  isAdmin={isAdmin}
                />
              ))}
            </div>
          )}

          {/* Delivery Toast with spring physics */}
          <AnimatePresence>
            {deliveryResult && (
              <motion.div
                initial={{ opacity: 0, y: 50, scale: 0.9 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 20, scale: 0.95 }}
                transition={{ type: 'spring', stiffness: 450, damping: 28 }}
                className={`fixed bottom-6 right-6 z-50 p-4 rounded-2xl shadow-2xl text-xs flex items-center gap-2.5 backdrop-blur-md ${
                  deliveryResult.ok
                    ? 'bg-emerald-950/95 border border-emerald-500/80 text-emerald-200 shadow-emerald-900/30'
                    : 'bg-rose-950/95 border border-rose-500/80 text-rose-200 shadow-rose-900/30'
                }`}
              >
                {deliveryResult.ok ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 animate-bounce" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                )}
                <span className="font-medium">{deliveryResult.msg}</span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

  {/* USER WISHLIST & MISSING BOOK REQUESTS SUB-VIEW (Admin Only) */}
  {isAdmin && activeSubTab === 'requests' && (
    <div className="space-y-6">
      {/* Wishlist Explanation Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-amber-950/20 to-slate-900 border border-amber-500/30 rounded-2xl p-6 shadow-xl">
        <div className="flex items-start gap-3">
          <div className="p-2.5 bg-[#f3a847]/10 rounded-xl border border-amber-500/30 text-[#f3a847] mt-0.5">
            <ClipboardList className="w-5 h-5" />
          </div>
          <div className="flex-1">
            <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
              User Book Wishlist & Sourcing Queue
            </h2>
            <p className="text-xs text-gray-700 mt-1.5 leading-relaxed">
              When users type a title or author that is not yet in our repository, BusiMind automatically informs them, recommends immediate alternative titles covering identical business principles, and logs their request here so your team can acquire and link it.
            </p>
            <div className="flex flex-wrap gap-4 mt-4 pt-3 border-t border-gray-200/80 text-xs">
              <div className="flex items-center gap-2 text-gray-700">
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse"></span>
                <span>Pending Sourcing: <strong>{requests.filter((r) => r.status === 'pending').length}</strong></span>
              </div>
              <div className="flex items-center gap-2 text-gray-700">
                <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                <span>Acquired & Cataloged: <strong>{requests.filter((r) => r.status === 'acquired').length}</strong></span>
              </div>
              <div className="flex items-center gap-2 text-gray-700">
                <span className="w-2 h-2 rounded-full bg-slate-500"></span>
                <span>Dismissed: <strong>{requests.filter((r) => r.status === 'dismissed').length}</strong></span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Requests Filter Bar */}
      <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-lg flex flex-col sm:flex-row gap-3 justify-between items-center">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 text-gray-500 absolute left-3.5 top-3" />
          <input
            type="text"
            value={requestSearch}
            onChange={(e) => setRequestSearch(e.target.value)}
            placeholder="Search requested books by title, author, or search query..."
            className="w-full bg-gray-50 border border-gray-200 rounded-xl pl-10 pr-4 py-2 text-sm text-gray-800 placeholder:text-gray-500 focus:outline-none focus:border-indigo-500"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          {(['all', 'pending', 'acquired', 'dismissed'] as const).map((status) => (
            <button
              key={status}
              onClick={() => setRequestFilterStatus(status)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold capitalize transition-all ${
                requestFilterStatus === status
                  ? status === 'pending'
                    ? 'bg-[#f3a847] text-slate-950 shadow-sm'
                    : status === 'acquired'
                    ? 'bg-emerald-600 text-gray-900 shadow-sm'
                    : 'bg-indigo-600 text-gray-900 shadow-sm'
                  : 'bg-gray-100 text-gray-500 hover:text-gray-800'
              }`}
            >
              {status}
            </button>
          ))}
        </div>
      </div>

      {/* Requests List */}
      {requestsLoading ? (
        <RequestsQueueSkeleton />
      ) : filteredRequests.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-2xl p-12 text-center">
          <ClipboardList className="w-12 h-12 text-slate-600 mx-auto mb-3" />
          <h3 className="text-base font-semibold text-gray-700">No requests matching this filter</h3>
          <p className="text-xs text-gray-500 mt-1 max-w-sm mx-auto">
            When users query books or authors outside our current database, they will be logged here with priority indicators.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredRequests.map((req) => (
            <div
              key={req.id}
              className="bg-white border border-gray-200 hover:border-gray-300/80 rounded-2xl p-5 shadow-md flex flex-col justify-between transition-all"
            >
              <div>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-gray-900 text-base">{req.requestedTitle}</h3>
                      {req.requestCount > 1 && (
                        <span className="flex items-center gap-1 bg-[#f3a847]/20 text-[#f3a847] border border-amber-500/40 text-[10px] font-bold px-2 py-0.5 rounded-full">
                          <Flame className="w-3 h-3 text-[#f3a847]" />
                          {req.requestCount}x
                        </span>
                      )}
                    </div>
                    {req.requestedAuthor && (
                      <p className="text-xs text-gray-500 mt-0.5">by <span className="text-gray-700 font-medium">{req.requestedAuthor}</span></p>
                    )}
                  </div>

                  <span
                    className={`text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider ${
                      req.status === 'acquired'
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                        : req.status === 'dismissed'
                        ? 'bg-gray-100 text-gray-500'
                        : 'bg-[#f3a847]/20 text-[#f3a847] border border-amber-500/40'
                    }`}
                  >
                    {req.status}
                  </span>
                </div>

                <div className="mt-3 space-y-1.5 text-xs text-gray-500 bg-gray-50/60 p-3 rounded-xl border border-gray-200/80">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-500">Query Used:</span>
                    <span className="font-mono text-gray-700 truncate max-w-[200px]">"{req.searchQuery}"</span>
                  </div>
                  {req.topic && (
                    <div className="flex items-center justify-between">
                      <span className="text-gray-500">Subject Topic:</span>
                      <span className="text-indigo-300 font-medium">{req.topic}</span>
                    </div>
                  )}
                  <div className="flex items-center justify-between">
                    <span className="text-gray-500">Last Requested:</span>
                    <span className="text-gray-500">{new Date(req.lastRequestedAt).toLocaleDateString()}</span>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="mt-4 pt-3 border-t border-gray-200/80 flex items-center justify-between gap-2">
                <button
                  onClick={() => handleFulfillRequest(req)}
                  className="flex-1 py-2 px-3 bg-indigo-600 hover:bg-indigo-500 text-gray-900 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors shadow-sm"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Fulfill & Add to Library
                </button>

                {req.status !== 'acquired' ? (
                  <button
                    onClick={() => handleUpdateRequestStatus(req.id, 'acquired')}
                    className="py-2 px-2.5 bg-gray-100 hover:bg-emerald-950/40 hover:text-emerald-300 text-gray-700 border border-gray-300/60 rounded-xl text-xs transition-colors flex items-center gap-1"
                    title="Mark Acquired"
                  >
                    <CheckCircle className="w-3.5 h-3.5" />
                  </button>
                ) : (
                  <button
                    onClick={() => handleUpdateRequestStatus(req.id, 'pending')}
                    className="py-2 px-2.5 bg-gray-100 hover:bg-amber-950/40 hover:text-[#f3a847] text-gray-700 border border-gray-300/60 rounded-xl text-xs transition-colors flex items-center gap-1"
                    title="Mark Pending"
                  >
                    <Clock className="w-3.5 h-3.5" />
                  </button>
                )}

                {req.status !== 'dismissed' && (
                  <button
                    onClick={() => handleUpdateRequestStatus(req.id, 'dismissed')}
                    className="py-2 px-2.5 bg-gray-100 hover:bg-slate-700 text-gray-500 hover:text-gray-800 border border-gray-300/60 rounded-xl text-xs transition-colors flex items-center gap-1"
                    title="Dismiss"
                  >
                    <XCircle className="w-3.5 h-3.5" />
                  </button>
                )}

                <button
                  onClick={() => handleDeleteRequest(req.id)}
                  className="p-2 text-gray-500 hover:text-rose-400 bg-gray-100/60 hover:bg-gray-100 rounded-xl transition-colors"
                  title="Delete Request"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )}

  {/* 3. TELEGRAM CHANNEL FILE LINKER SUB-VIEW (Admin Only) */}
  {isAdmin && activeSubTab === 'linker' && (
    <div className="space-y-6">
      {/* File Linker Banner & Instructions */}
      <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-[#f3a847]/15 flex items-center justify-center text-[#c45500]">
              <Link2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-[#0f1111]">
                Telegram Channel Repository Linker
              </h2>
              <p className="text-xs text-gray-600">
                Connect books in the BusiMind library directly to files hosted in your private Telegram channel.
              </p>
            </div>
          </div>
          <span className="text-xs bg-emerald-50 text-[#007600] px-3 py-1 rounded-full font-mono font-semibold border border-emerald-200 self-start sm:self-auto">
            Channel ID: {channelId || '-1003969099877'}
          </span>
        </div>

        <div className="bg-[#f0f8ff] border border-[#d0e8f2] rounded-lg p-4 mb-6">
          <h4 className="text-xs font-bold text-[#007185] mb-1">How to Connect a Telegram Post:</h4>
          <ol className="text-xs text-gray-700 space-y-1 list-decimal list-inside leading-relaxed">
            <li>Open your Telegram channel where you uploaded the book PDF or ePub file.</li>
            <li>Right-click or tap the file message and select <strong>Copy Post Link</strong> (e.g. <code className="bg-white px-1.5 py-0.5 rounded font-mono text-[#007185] border border-gray-200">https://t.me/c/3969099877/234</code>) or use just the message ID number (<code className="bg-white px-1.5 py-0.5 rounded font-mono text-[#007185] border border-gray-200">234</code>).</li>
            <li>Select the corresponding title below and click <strong>Link File to Catalog</strong>.</li>
          </ol>
        </div>

        <form onSubmit={handleQuickLink} className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
          <div className="md:col-span-5">
            <label className="block text-xs font-bold text-gray-700 mb-1.5">
              Telegram Post Link or Message ID
            </label>
            <input
              type="text"
              value={quickLinkUrl}
              onChange={(e) => setQuickLinkUrl(e.target.value)}
              placeholder="https://t.me/c/3969099877/234 or 234"
              className="w-full bg-white border border-gray-300 rounded-md px-3.5 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#f3a847] focus:border-[#f3a847]"
            />
          </div>

          <div className="md:col-span-4">
            <label className="block text-xs font-bold text-gray-700 mb-1.5">
              Target Catalog Volume
            </label>
            <select
              value={quickLinkBookId}
              onChange={(e) => setQuickLinkBookId(e.target.value)}
              className="w-full bg-white border border-gray-300 rounded-md px-3.5 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#f3a847] focus:border-[#f3a847] truncate"
            >
              <option value="">Select a book to link...</option>
              {books.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.channelMessageId ? `✅ [Msg #${b.channelMessageId}] ` : '⭕ [Unlinked] '}
                  {b.title} ({b.author})
                </option>
              ))}
            </select>
          </div>

          <div className="md:col-span-3">
            <button
              type="submit"
              disabled={quickLinkLoading || !quickLinkUrl.trim() || !quickLinkBookId}
              className="w-full px-4 py-2 bg-[#ffd814] hover:bg-[#f7ca00] disabled:opacity-40 text-[#0f1111] border border-[#fcd200] text-sm font-bold rounded-md shadow-sm transition-all flex items-center justify-center gap-2"
            >
              <Link2 className="w-4 h-4" />
              <span>{quickLinkLoading ? 'Linking...' : 'Link File to Catalog'}</span>
            </button>
          </div>
        </form>

        {quickLinkSuccess && (
          <div className="mt-4 p-3 bg-emerald-50 border border-emerald-200 rounded-md text-xs text-[#007600] flex items-center gap-2 font-medium">
            <CheckCircle2 className="w-4 h-4 text-[#007600]" />
            <span>{quickLinkSuccess}</span>
          </div>
        )}
      </div>

      {/* Linked vs Unlinked Summary Table */}
      <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
        <div className="flex items-center justify-between gap-3 mb-4">
          <h3 className="text-sm font-bold text-[#0f1111]">Channel Connection Status</h3>
          <div className="text-xs text-gray-500">
            <strong className="text-[#007600]">{books.filter((b) => b.channelMessageId).length}</strong> linked •{' '}
            <strong className="text-[#c45500]">{books.filter((b) => !b.channelMessageId).length}</strong> unlinked
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead>
              <tr className="border-b border-gray-200 text-gray-500 font-semibold bg-gray-50">
                <th className="py-2.5 px-3">Title & Author</th>
                <th className="py-2.5 px-3">Category</th>
                <th className="py-2.5 px-3">Telegram Msg ID</th>
                <th className="py-2.5 px-3 text-right">Quick Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {books.map((b) => (
                <tr key={b.id} className="hover:bg-gray-50 transition-colors">
                  <td className="py-2.5 px-3">
                    <div className="font-semibold text-gray-900 line-clamp-1">{b.title}</div>
                    <div className="text-gray-500 text-[11px]">{b.author}</div>
                  </td>
                  <td className="py-2.5 px-3">
                    <span className="px-2 py-0.5 rounded-full bg-gray-100 text-gray-700 text-[10px] font-medium">
                      {b.category}
                    </span>
                  </td>
                  <td className="py-2.5 px-3">
                    {b.channelMessageId ? (
                      <span className="inline-flex items-center gap-1 font-mono font-bold text-[#007600] bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                        <CheckCircle2 className="w-3 h-3" /> Msg #{b.channelMessageId}
                      </span>
                    ) : (
                      <span className="text-gray-400 font-mono text-[11px]">Unlinked</span>
                    )}
                  </td>
                  <td className="py-2.5 px-3 text-right">
                    {b.channelMessageId ? (
                      <button
                        onClick={() => handleTestDeliver(b)}
                        disabled={deliveringBookId === b.id}
                        className="px-2.5 py-1 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded border border-gray-300 font-medium text-[11px] inline-flex items-center gap-1"
                      >
                        <Send className="w-3 h-3 text-[#007185]" />
                        {deliveringBookId === b.id ? 'Sending...' : 'Test Send'}
                      </button>
                    ) : (
                      <button
                        onClick={() => {
                          setQuickLinkBookId(b.id);
                          window.scrollTo({ top: 0, behavior: 'smooth' });
                        }}
                        className="px-2.5 py-1 bg-[#ffd814] hover:bg-[#f7ca00] text-[#0f1111] rounded border border-[#fcd200] font-semibold text-[11px] inline-flex items-center gap-1"
                      >
                        <Link2 className="w-3 h-3" /> Link Post
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )}

      

      {/* Modal: Add New Book */}
      {isAdding && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white border border-gray-300 rounded-2xl max-w-xl w-full p-6 shadow-2xl my-8">
            <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <Plus className="w-5 h-5 text-indigo-400" />
              Add Book to BusiMind Catalog
            </h3>
            <p className="text-xs text-gray-500 mt-1">
              Add a new business book. It becomes immediately discoverable by Gemini and Telegram users.
            </p>

            <form onSubmit={handleCreateBook} className="mt-5 space-y-3.5 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-gray-700 font-semibold mb-1">Title *</label>
                  <input
                    type="text"
                    required
                    value={newBook.title}
                    onChange={(e) => setNewBook({ ...newBook, title: e.target.value })}
                    placeholder="e.g. Zero to One"
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-gray-900"
                  />
                </div>
                <div>
                  <label className="block text-gray-700 font-semibold mb-1">Author *</label>
                  <input
                    type="text"
                    required
                    value={newBook.author}
                    onChange={(e) => setNewBook({ ...newBook, author: e.target.value })}
                    placeholder="e.g. Peter Thiel"
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-gray-900"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-gray-700 font-semibold mb-1">Category *</label>
                  <select
                    value={newBook.category}
                    onChange={(e) => setNewBook({ ...newBook, category: e.target.value })}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-gray-900"
                  >
                    <option value="Entrepreneurship">Entrepreneurship</option>
                    <option value="Money & Investing">Money & Investing</option>
                    <option value="Leadership & Management">Leadership & Management</option>
                    <option value="Marketing & Sales">Marketing & Sales</option>
                    <option value="Mindset & Psychology">Mindset & Psychology</option>
                    <option value="Finance & Economics">Finance & Economics</option>
                    <option value="Strategy & Economics">Strategy & Economics</option>
                  </select>
                </div>
                <div>
                  <label className="block text-gray-700 font-semibold mb-1">Difficulty</label>
                  <select
                    value={newBook.difficulty}
                    onChange={(e) => setNewBook({ ...newBook, difficulty: e.target.value as any })}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-gray-900"
                  >
                    <option value="beginner">Beginner</option>
                    <option value="intermediate">Intermediate</option>
                    <option value="advanced">Advanced</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-gray-700 font-semibold mb-1">Description *</label>
                <textarea
                  rows={2}
                  required
                  value={newBook.description}
                  onChange={(e) => setNewBook({ ...newBook, description: e.target.value })}
                  placeholder="Core thesis and summary of the book..."
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-gray-900"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-gray-700 font-semibold mb-1">Why BusiMind Recommends It</label>
                  <input
                    type="text"
                    value={newBook.whyRecommended}
                    onChange={(e) => setNewBook({ ...newBook, whyRecommended: e.target.value })}
                    placeholder="Concise recommendation rationale..."
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-gray-900"
                  />
                </div>
                <div>
                  <label className="block text-gray-700 font-semibold mb-1">Best Suited For</label>
                  <input
                    type="text"
                    value={newBook.bestFor}
                    onChange={(e) => setNewBook({ ...newBook, bestFor: e.target.value })}
                    placeholder="e.g. First-time founders"
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-gray-900"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-gray-700 font-semibold mb-1">Telegram Channel Link or Msg ID</label>
                  <input
                    type="text"
                    value={newBook.channelMessageId}
                    onChange={(e) => setNewBook({ ...newBook, channelMessageId: e.target.value })}
                    placeholder="e.g. https://t.me/c/3969099877/234 or 234"
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-gray-900"
                  />
                </div>

                <div>
                  <label className="block text-gray-700 font-semibold mb-1">Tags (Comma-separated)</label>
                  <input
                    type="text"
                    value={newBook.tags}
                    onChange={(e) => setNewBook({ ...newBook, tags: e.target.value })}
                    placeholder="e.g. startup, leadership, mindset"
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-gray-900"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-gray-700 font-semibold mb-1">Purchase / Publisher URL (Optional)</label>
                  <input
                    type="url"
                    value={newBook.externalPurchaseUrl}
                    onChange={(e) => setNewBook({ ...newBook, externalPurchaseUrl: e.target.value })}
                    placeholder="https://..."
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-gray-900"
                  />
                </div>
                <div>
                  <label className="block text-gray-700 font-semibold mb-1">Library URL (Optional)</label>
                  <input
                    type="url"
                    value={newBook.externalLibraryUrl}
                    onChange={(e) => setNewBook({ ...newBook, externalLibraryUrl: e.target.value })}
                    placeholder="https://openlibrary.org/..."
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-gray-900"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setIsAdding(false)}
                  className="px-4 py-2 rounded-xl text-xs text-gray-500 hover:text-gray-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-gray-900 rounded-xl text-xs font-semibold shadow-md transition-colors"
                >
                  Create Book
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Interactive Amazon Kindle Cloud Reader Modal */}
      <KindleReaderModal
        book={readingBook}
        isAdmin={isAdmin}
        onClose={() => setReadingBook(null)}
        onTestDeliver={handleTestDeliver}
        onExtractRAG={handleExtractRAG}
        isDelivering={deliveringBookId === readingBook?.id}
        extractingRAGId={extractingRAGBookId}
        ragSuccessMsg={readingBook ? extractedRAGSuccess[readingBook.id] : undefined}
      />

      {/* Connect Telegram Delivery Modal */}
      <TelegramConnectModal
        isOpen={Boolean(connectModalBook)}
        book={connectModalBook}
        onClose={() => setConnectModalBook(null)}
        onConnected={(newChatId) => {
          if (connectModalBook) {
            handleTestDeliver(connectModalBook);
          }
        }}
      />
    </div>
  );
};
