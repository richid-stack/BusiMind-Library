import { collection, doc, setDoc, deleteDoc, getDocs, onSnapshot } from 'firebase/firestore';
import { db } from './firestoreConfig';
import { Book, ReadingListItem, SearchLog, SystemStats, BookRequest } from '../../src/types';
import { INITIAL_BOOKS } from './initialBooks';


interface StoreSchema {
  books: Book[];
  readingLists: ReadingListItem[];
  searchLogs: SearchLog[];
  bookRequests?: BookRequest[];
  dailyUsage?: Record<string, Record<string, number>>; // 'YYYY-MM-DD' -> { [userId]: count }
}

/**
 * Deeply sanitizes an object before writing to Firestore.
 * Firestore throws a hard runtime error if any field is undefined.
 * This recursively removes all undefined properties.
 */
export function sanitizeForFirestore<T>(data: T): T {
  if (data === null || data === undefined) {
    return null as any;
  }
  if (Array.isArray(data)) {
    return data.map((item) => sanitizeForFirestore(item)) as any;
  }
  if (typeof data === 'object' && !(data instanceof Date)) {
    const res: Record<string, any> = {};
    for (const [k, v] of Object.entries(data as Record<string, any>)) {
      if (v !== undefined) {
        res[k] = sanitizeForFirestore(v);
      }
    }
    return res as any;
  }
  return data;
}

class BusiMindStore {
  private memoryStore: StoreSchema;
  public isInitialized = false;
  private initPromise: Promise<void> | null = null;

  constructor() {
    this.memoryStore = {
      books: [],
      readingLists: [],
      searchLogs: [],
      bookRequests: [],
      dailyUsage: {},
    };
    // Eagerly trigger Firestore sync on boot
    this.initPromise = this.initializeFirestore();
  }

  public async ensureInitialized() {
    if (!this.isInitialized && this.initPromise) {
      await this.initPromise;
    }
  }

  public async initializeFirestore() {
    console.log('[BusiMindStore] Connecting to Firestore...');
    try {
      const booksSnap = await getDocs(collection(db, 'books'));
      if (booksSnap.docs.length > 0) {
        this.memoryStore.books = booksSnap.docs.map(d => d.data() as any);
      }
      
      const rlSnap = await getDocs(collection(db, 'readingLists'));
      this.memoryStore.readingLists = rlSnap.docs.map(d => d.data() as any);
      
      const reqSnap = await getDocs(collection(db, 'bookRequests'));
      this.memoryStore.bookRequests = reqSnap.docs.map(d => d.data() as any);
      
      const logsSnap = await getDocs(collection(db, 'searchLogs'));
      this.memoryStore.searchLogs = logsSnap.docs.map(d => d.data() as any);
      
      const usageSnap = await getDocs(collection(db, 'dailyUsage'));
      this.memoryStore.dailyUsage = {};
      usageSnap.docs.forEach(d => {
        const data = d.data();
        if (!this.memoryStore.dailyUsage[data.date]) this.memoryStore.dailyUsage[data.date] = {};
        this.memoryStore.dailyUsage[data.date][data.userId] = data.used;
      });
      
      this.isInitialized = true;
      console.log(`[BusiMindStore] Firestore synced successfully. Total books in catalog: ${this.memoryStore.books.length}`);
      
      // Setup realtime listeners for multi-instance sync
      onSnapshot(collection(db, 'books'), (snap) => {
         this.memoryStore.books = snap.docs.map(d => d.data() as any);
      });
      onSnapshot(collection(db, 'bookRequests'), (snap) => {
         this.memoryStore.bookRequests = snap.docs.map(d => d.data() as any);
      });
      onSnapshot(collection(db, 'readingLists'), (snap) => {
         this.memoryStore.readingLists = snap.docs.map(d => d.data() as any);
      });
    } catch(err) {
      console.error('[BusiMindStore] Failed to initialize Firestore:', err);
    }
  }

  

  private saveToDisk(store: StoreSchema) {
    // Legacy disk save removed in favor of direct Firestore updates on mutation
  }

  // --- BOOK CATALOG METHODS ---

  public getAllBooks(): Book[] {
    return [...this.memoryStore.books];
  }

  public getBookById(id: string): Book | undefined {
    return this.memoryStore.books.find((b) => b.id.toLowerCase() === id.toLowerCase());
  }

  public getBooksByCategory(category: string): Book[] {
    const norm = category.toLowerCase().trim();

    // Semantic category matching rules for rich, balanced library shelves
    let semanticFilter: ((b: Book) => boolean) | null = null;

    if (norm.includes('leadership') || norm.includes('management')) {
      semanticFilter = (b) => {
        const text = (b.title + ' ' + b.author + ' ' + (b.description || '') + ' ' + (b.category || '') + ' ' + (b.tags?.join(' ') || '')).toLowerCase();
        return text.includes('leadership') || text.includes('management') || text.includes('leader') || text.includes('executive') || text.includes('team') || text.includes('scaling up') || text.includes('built to last') || text.includes('hard thing') || text.includes('dysfunctions') || text.includes('start with why') || text.includes('effective executive') || text.includes('drucker') || text.includes('empowered') || text.includes('culture') || text.includes('manager');
      };
    } else if (norm.includes('marketing') || norm.includes('sales')) {
      semanticFilter = (b) => {
        const text = (b.title + ' ' + b.author + ' ' + (b.description || '') + ' ' + (b.category || '') + ' ' + (b.tags?.join(' ') || '')).toLowerCase();
        return text.includes('marketing') || text.includes('sales') || text.includes('selling') || text.includes('leads') || text.includes('offers') || text.includes('traction') || text.includes('chasm') || text.includes('customer') || text.includes('ted') || text.includes('hormozi') || text.includes('value proposition') || text.includes('mom test') || text.includes('positioning') || text.includes('copywriting');
      };
    } else if (norm.includes('investing') || norm.includes('money')) {
      semanticFilter = (b) => {
        const text = (b.title + ' ' + b.author + ' ' + (b.description || '') + ' ' + (b.category || '') + ' ' + (b.tags?.join(' ') || '')).toLowerCase();
        return text.includes('investing') || text.includes('investor') || text.includes('buffett') || text.includes('wall street') || text.includes('wealth') || text.includes('rich dad') || text.includes('stock') || text.includes('bogle') || text.includes('intelligent investor') || text.includes('cashflow') || text.includes('psychology of money') || text.includes('portfolio') || text.includes('quant');
      };
    } else if (norm.includes('finance') || norm.includes('economics')) {
      semanticFilter = (b) => {
        const text = (b.title + ' ' + b.author + ' ' + (b.description || '') + ' ' + (b.category || '') + ' ' + (b.tags?.join(' ') || '')).toLowerCase();
        return text.includes('finance') || text.includes('financial') || text.includes('economic') || text.includes('big short') || text.includes('too big to fail') || text.includes('genius failed') || text.includes('dead aid') || text.includes('capital') || text.includes('currency') || text.includes('valuation') || text.includes('banking');
      };
    } else if (norm.includes('strategy')) {
      semanticFilter = (b) => {
        const text = (b.title + ' ' + b.author + ' ' + (b.description || '') + ' ' + (b.category || '') + ' ' + (b.tags?.join(' ') || '')).toLowerCase();
        return text.includes('strategy') || text.includes('innovator\'s dilemma') || text.includes('blue ocean') || text.includes('80/20') || text.includes('good to great') || text.includes('powers') || text.includes('competitive') || text.includes('business model');
      };
    } else if (norm.includes('entrepreneurship') || norm.includes('startup')) {
      semanticFilter = (b) => {
        const text = (b.title + ' ' + b.author + ' ' + (b.description || '') + ' ' + (b.category || '') + ' ' + (b.tags?.join(' ') || '')).toLowerCase();
        return text.includes('entrepreneur') || text.includes('startup') || text.includes('lean startup') || text.includes('zero to one') || text.includes('business model') || text.includes('shoe dog') || text.includes('e myth') || text.includes('venture');
      };
    } else if (norm.includes('mindset') || norm.includes('psychology')) {
      semanticFilter = (b) => {
        const text = (b.title + ' ' + b.author + ' ' + (b.description || '') + ' ' + (b.category || '') + ' ' + (b.tags?.join(' ') || '')).toLowerCase();
        return text.includes('mindset') || text.includes('psychology') || text.includes('habits') || text.includes('thinking, fast') || text.includes('richest man') || text.includes('ultralearning') || text.includes('frankl') || text.includes('covey') || text.includes('focus');
      };
    }

    if (!semanticFilter) {
      return this.memoryStore.books.filter((b) => b.category.toLowerCase().includes(norm));
    }

    const seenIds = new Set<string>();
    const result: Book[] = [];
    for (const b of this.memoryStore.books) {
      if (semanticFilter(b) && !seenIds.has(b.id)) {
        seenIds.add(b.id);
        result.push(b);
      }
    }
    return result;
  }

  public getFeaturedBooks(): Book[] {
    return this.memoryStore.books.filter((b) => b.isFeatured);
  }

  public searchBooksKeyword(query: string): Book[] {
    const q = query.toLowerCase().trim();
    if (!q) return this.getAllBooks();

    return this.memoryStore.books.filter((b) => {
      const titleMatch = b.title.toLowerCase().includes(q);
      const authorMatch = b.author.toLowerCase().includes(q);
      const descMatch = b.description.toLowerCase().includes(q);
      const catMatch = b.category.toLowerCase().includes(q);
      const tagMatch = b.tags?.some((t) => t.toLowerCase().includes(q));
      return titleMatch || authorMatch || descMatch || catMatch || tagMatch;
    });
  }

  /**
   * Specifically resolves whether a query is asking for an exact or near-match
   * book title or author in our existing catalog.
   */
  public findBookByTitleOrAuthor(query: string): {
    matchedBook: Book;
    matchType: 'exact_title' | 'title_match' | 'author_match';
    relatedBooks?: Book[];
  } | null {
    const clean = (s: string) =>
      s.toLowerCase()
        .replace(/[^a-z0-9\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

    const qNorm = clean(query);
    if (!qNorm || qNorm.length < 2) return null;

    const stripArticle = (s: string) => s.replace(/^(the|a|an)\s+/, '');
    const qNoArticle = stripArticle(qNorm);

    // 1. Exact title check
    for (const b of this.memoryStore.books) {
      const bTitleNorm = clean(b.title);
      const bNoArticle = stripArticle(bTitleNorm);
      if (bTitleNorm === qNorm || bNoArticle === qNoArticle) {
        return { matchedBook: b, matchType: 'exact_title' };
      }
    }

    // 2. Exact author check
    for (const b of this.memoryStore.books) {
      const bAuthorNorm = clean(b.author);
      if (bAuthorNorm === qNorm) {
        const authorBooks = this.memoryStore.books.filter((x) => clean(x.author) === bAuthorNorm);
        return { matchedBook: b, matchType: 'author_match', relatedBooks: authorBooks };
      }
    }

    // 3. Author last name or distinct author token check (e.g. "Housel", "Cialdini", "Peter Thiel")
    for (const b of this.memoryStore.books) {
      const bAuthorNorm = clean(b.author);
      const authorTokens = bAuthorNorm.split(' ').filter((t) => t.length >= 4);
      if (authorTokens.some((token) => qNorm === token || qNorm.includes(token))) {
        const authorBooks = this.memoryStore.books.filter((x) => clean(x.author) === bAuthorNorm);
        return { matchedBook: b, matchType: 'author_match', relatedBooks: authorBooks };
      }
    }

    // 4. Substring title check (if query is sufficiently descriptive >= 4 chars)
    if (qNoArticle.length >= 4) {
      for (const b of this.memoryStore.books) {
        const bTitleNorm = clean(b.title);
        const bNoArticle = stripArticle(bTitleNorm);
        if (bNoArticle.includes(qNoArticle) || (qNoArticle.length >= 6 && qNoArticle.includes(bNoArticle))) {
          return { matchedBook: b, matchType: 'title_match' };
        }
      }
    }

    return null;
  }

  public addBook(newBook: Omit<Book, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }): Book {
    const now = new Date().toISOString();
    const id = newBook.id || newBook.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') + '-' + Date.now().toString().slice(-4);

    const book: Book = {
      ...newBook,
      id,
      createdAt: now,
      updatedAt: now,
    };

    this.memoryStore.books.push(book);
    setDoc(doc(db, 'books', book.id), sanitizeForFirestore(book)).catch(e => console.error('[Firestore] Error adding book:', e));
    return book;
  }

  public updateBook(id: string, updates: Partial<Book>): Book | null {
    const index = this.memoryStore.books.findIndex((b) => b.id === id);
    if (index === -1) return null;

    const existing = this.memoryStore.books[index];
    const updated: Book = {
      ...existing,
      ...updates,
      id: existing.id, // prevent ID change
      updatedAt: new Date().toISOString(),
    };

    this.memoryStore.books[index] = updated;
    setDoc(doc(db, 'books', updated.id), sanitizeForFirestore(updated), { merge: true }).catch(e => console.error('[Firestore] Error updating book:', e));
    return updated;
  }

  public deleteBook(id: string): boolean {
    const initialLen = this.memoryStore.books.length;
    this.memoryStore.books = this.memoryStore.books.filter((b) => b.id !== id);
    if (this.memoryStore.books.length !== initialLen) {
      deleteDoc(doc(db, 'books', id)).catch(e => console.error('[Firestore] Error deleting book:', e));
      return true;
    }
    return false;
  }

  public linkTelegramMessage(bookId: string, chatId: string, messageId: number, fileName?: string, fileId?: string): Book | null {
    return this.updateBook(bookId, {
      distributionType: 'telegram_repository',
      channelChatId: chatId,
      channelMessageId: messageId,
      ...(fileName ? { fileName } : {}),
      ...(fileId ? { fileId } : {}),
    });
  }

  // --- READING LIST METHODS ---

  public getReadingList(telegramUserId: number | string): Book[] {
    const userStr = String(telegramUserId);
    const bookIds = this.memoryStore.readingLists
      .filter((item) => String(item.telegramUserId) === userStr)
      .map((item) => item.bookId);

    return this.memoryStore.books.filter((b) => bookIds.includes(b.id));
  }

  public isBookInReadingList(telegramUserId: number | string, bookId: string): boolean {
    const userStr = String(telegramUserId);
    return this.memoryStore.readingLists.some(
      (item) => String(item.telegramUserId) === userStr && item.bookId === bookId
    );
  }

  public addToReadingList(telegramUserId: number | string, bookId: string): boolean {
    if (this.isBookInReadingList(telegramUserId, bookId)) return false;

    const newItem = {
      id: `${telegramUserId}_${bookId}`,
      telegramUserId: String(telegramUserId),
      bookId,
      status: 'want_to_read' as const,
      addedAt: new Date().toISOString(),
    };
    this.memoryStore.readingLists.push(newItem);
    setDoc(doc(db, 'readingLists', newItem.id), sanitizeForFirestore(newItem)).catch(e => console.error(e));
    return true;
  }

  public removeFromReadingList(telegramUserId: number | string, bookId: string): boolean {
    const userStr = String(telegramUserId);
    const initialLen = this.memoryStore.readingLists.length;
    // Find the item to delete in Firestore before removing it from memory
    const itemToDelete = this.memoryStore.readingLists.find((item) => String(item.telegramUserId) === userStr && item.bookId === bookId);
    if (itemToDelete) deleteDoc(doc(db, 'readingLists', itemToDelete.id)).catch(e => console.error('[Firestore]', e));
    this.memoryStore.readingLists = this.memoryStore.readingLists.filter(
      (item) => !(String(item.telegramUserId) === userStr && item.bookId === bookId)
    );

    if (this.memoryStore.readingLists.length !== initialLen) {
      
      return true;
    }
    return false;
  }

  // --- BOOK REQUESTS & WISHLIST (WHEN BOOKS ARE NOT IN LIBRARY) ---

  public getAllBookRequests(): BookRequest[] {
    return [...(this.memoryStore.bookRequests || [])];
  }

  public getPendingBookRequests(): BookRequest[] {
    return (this.memoryStore.bookRequests || []).filter((r) => r.status === 'pending');
  }

  public getUserBookRequests(userId: number | string): BookRequest[] {
    const userStr = String(userId);
    return (this.memoryStore.bookRequests || []).filter((r) =>
      r.requestedByUserIds && r.requestedByUserIds.some((u) => String(u) === userStr)
    );
  }

  public recordBookRequest(
    requestedTitle: string,
    requestedAuthor?: string,
    query?: string,
    userId?: number | string,
    suggestedAlternativeIds?: string[],
    topic?: string,
    metadata?: { genre?: string; coverImageUrl?: string; publicationYear?: number }
  ): { request: BookRequest; isNew: boolean } {
    if (!this.memoryStore.bookRequests) {
      this.memoryStore.bookRequests = [];
    }

    const clean = (s: string) =>
      s.toLowerCase()
        .replace(/[^a-z0-9\s]/g, '')
        .trim();

    const titleNorm = clean(requestedTitle);
    const existingIndex = this.memoryStore.bookRequests.findIndex(
      (r) => clean(r.requestedTitle) === titleNorm || (r.query && clean(r.query) === clean(query || ''))
    );

    const now = new Date().toISOString();
    const userStr = userId ? String(userId) : undefined;

    if (existingIndex !== -1) {
      const existing = this.memoryStore.bookRequests[existingIndex];
      const users = existing.requestedByUserIds || [];
      if (userStr && !users.includes(userStr)) {
        users.push(userStr);
      }

      const updated: BookRequest = {
        ...existing,
        requestCount: existing.requestCount + 1,
        lastRequestedAt: now,
        requestedByUserIds: users,
        requestedAuthor: requestedAuthor || existing.requestedAuthor,
        topic: topic || existing.topic,
        genre: metadata?.genre || existing.genre,
        coverImageUrl: metadata?.coverImageUrl || existing.coverImageUrl,
        publicationYear: metadata?.publicationYear || existing.publicationYear,
        suggestedAlternativeIds: suggestedAlternativeIds || existing.suggestedAlternativeIds,
      };

      this.memoryStore.bookRequests[existingIndex] = updated;
      setDoc(doc(db, 'bookRequests', updated.id), sanitizeForFirestore(updated)).catch(e => console.error('[Firestore]', e));
      return { request: updated, isNew: false };
    }

    const newReq: BookRequest = {
      id: 'req_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
      requestedTitle,
      requestedAuthor: requestedAuthor || undefined,
      query: query || requestedTitle,
      topic: topic || undefined,
      genre: metadata?.genre || undefined,
      coverImageUrl: metadata?.coverImageUrl || undefined,
      publicationYear: metadata?.publicationYear || undefined,
      requestCount: 1,
      lastRequestedAt: now,
      requestedByUserIds: userStr ? [userStr] : [],
      status: 'pending',
      suggestedAlternativeIds: suggestedAlternativeIds || [],
    };

    this.memoryStore.bookRequests.unshift(newReq);
    setDoc(doc(db, 'bookRequests', newReq.id), sanitizeForFirestore(newReq)).catch(e => console.error('[Firestore]', e));
    return { request: newReq, isNew: true };
  }

  public updateBookRequestStatus(id: string, status: 'pending' | 'acquired' | 'dismissed'): boolean {
    if (!this.memoryStore.bookRequests) return false;
    const item = this.memoryStore.bookRequests.find((r) => r.id === id);
    if (!item) return false;

    item.status = status;
    setDoc(doc(db, 'bookRequests', item.id), sanitizeForFirestore(item), { merge: true }).catch(e => console.error('[Firestore]', e));
    return true;
  }

  public deleteBookRequest(id: string): boolean {
    if (!this.memoryStore.bookRequests) return false;
    const initialLen = this.memoryStore.bookRequests.length;
    this.memoryStore.bookRequests = this.memoryStore.bookRequests.filter((r) => r.id !== id);
    if (this.memoryStore.bookRequests.length !== initialLen) {
      deleteDoc(doc(db, 'bookRequests', id)).catch(e => console.error('[Firestore]', e));
      return true;
    }
    return false;
  }

  // --- SEARCH LOGS & STATS ---

  public logSearch(query: string, intent: string, matchedCount: number) {
    const newLog = {
      id: `log_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      query,
      intent,
      matchedCount,
      timestamp: new Date().toISOString(),
    };
    this.memoryStore.searchLogs.unshift(newLog);
    setDoc(doc(db, 'searchLogs', newLog.id), sanitizeForFirestore(newLog)).catch(e => console.error(e));
    if (this.memoryStore.searchLogs.length > 100) {
      this.memoryStore.searchLogs = this.memoryStore.searchLogs.slice(0, 100);
    }
  }

  public getStats(): SystemStats {
    const categoriesCount: Record<string, number> = {};
    let repositoryCount = 0;
    let externalCount = 0;

    for (const b of this.memoryStore.books) {
      categoriesCount[b.category] = (categoriesCount[b.category] || 0) + 1;
      if (b.distributionType === 'telegram_repository') {
        repositoryCount++;
      } else {
        externalCount++;
      }
    }

    const requests = this.memoryStore.bookRequests || [];
    const pendingReqs = requests.filter((r) => r.status === 'pending').length;

    return {
      totalBooks: this.memoryStore.books.length,
      repositoryBooksCount: repositoryCount,
      externalOnlyBooksCount: externalCount,
      totalSearches: this.memoryStore.searchLogs.length,
      totalReadingListItems: this.memoryStore.readingLists.length,
      totalBookRequests: requests.length,
      pendingBookRequests: pendingReqs,
      categoriesCount,
      recentSearches: this.memoryStore.searchLogs.slice(0, 10),
    };
  }

  // --- USER RATE LIMITING (3 REQUESTS / DAY, RESET AT MIDNIGHT 00:00 UTC) ---

  public getTimeUntilMidnight(): { formatted: string; resetAtIso: string; hoursLeft: number; minutesLeft: number } {
    const now = new Date();
    const midnight = new Date(now);
    midnight.setUTCHours(24, 0, 0, 0); // Next 00:00 UTC

    const diffMs = Math.max(0, midnight.getTime() - now.getTime());
    const totalMinutes = Math.floor(diffMs / (1000 * 60));
    const hoursLeft = Math.floor(totalMinutes / 60);
    const minutesLeft = totalMinutes % 60;

    return {
      formatted: `${hoursLeft}h ${minutesLeft}m`,
      resetAtIso: midnight.toISOString(),
      hoursLeft,
      minutesLeft,
    };
  }

  public getDailyUsage(userId: number | string): {
    used: number;
    limit: number;
    remaining: number;
    isUnlimited: boolean;
    timeUntilReset: string;
    resetAt: string;
  } {
    const adminId = process.env.ADMIN_TELEGRAM_ID ? String(process.env.ADMIN_TELEGRAM_ID) : null;
    const strId = String(userId);
    const isMasterAdmin = Boolean(adminId && strId === adminId);

    const today = new Date().toISOString().slice(0, 10);
    const dateBucket = this.memoryStore.dailyUsage?.[today] || {};
    const used = dateBucket[strId] || 0;
    const limit = 3;
    const remaining = isMasterAdmin ? 999 : Math.max(0, limit - used);

    const timeInfo = this.getTimeUntilMidnight();

    return {
      used,
      limit,
      remaining,
      isUnlimited: isMasterAdmin,
      timeUntilReset: timeInfo.formatted,
      resetAt: timeInfo.resetAtIso,
    };
  }

  public incrementDailyUsage(userId: number | string): {
    allowed: boolean;
    used: number;
    limit: number;
    remaining: number;
    isUnlimited: boolean;
    timeUntilReset: string;
  } {
    const adminId = process.env.ADMIN_TELEGRAM_ID ? String(process.env.ADMIN_TELEGRAM_ID) : null;
    const strId = String(userId);
    const isMasterAdmin = Boolean(adminId && strId === adminId);

    const today = new Date().toISOString().slice(0, 10);
    if (!this.memoryStore.dailyUsage) {
      this.memoryStore.dailyUsage = {};
    }
    if (!this.memoryStore.dailyUsage[today]) {
      this.memoryStore.dailyUsage[today] = {};
    }

    const currentUsed = this.memoryStore.dailyUsage[today][strId] || 0;
    const limit = 3;
    const timeInfo = this.getTimeUntilMidnight();

    if (!isMasterAdmin && currentUsed >= limit) {
      return {
        allowed: false,
        used: currentUsed,
        limit,
        remaining: 0,
        isUnlimited: false,
        timeUntilReset: timeInfo.formatted,
      };
    }

    const newUsed = currentUsed + 1;
    this.memoryStore.dailyUsage[today][strId] = newUsed;
    setDoc(doc(db, 'dailyUsage', today + '_' + strId), sanitizeForFirestore({ date: today, userId: strId, used: newUsed })).catch(e => console.error(e));

    return {
      allowed: true,
      used: newUsed,
      limit,
      remaining: isMasterAdmin ? 999 : Math.max(0, limit - newUsed),
      isUnlimited: isMasterAdmin,
      timeUntilReset: timeInfo.formatted,
    };
  }
}

export const store = new BusiMindStore();
