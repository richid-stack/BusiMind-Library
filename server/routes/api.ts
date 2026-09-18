import express, { Request, Response } from 'express';
import { store } from '../data/store';
import { bot, isBotTokenConfigured, getBookHelpExplanation, getBookKeyTakeaways } from '../telegram/bot';
import { isGeminiAvailable, searchBooksWithAI, generateReadingPath, askAboutBook, resolveBookOrIntent } from '../gemini';
import { sanitizeBookFileName, generateDeliveryCaption } from '../services/fileSanitizer';
import { enrichCatalog, enrichSingleBook } from '../services/catalogEnricher';
import { getCanonicalPublicationYear } from '../services/canonicalBookDates';
import { Book } from '../../src/types';
import { marketDataService } from '../services/marketData';
import { valuationEngine } from '../services/valuationEngine';
import { ragStore } from '../services/ragStore';
import { journalStore } from '../data/journalStore';
import { financialAgentRouter } from '../services/financialAgentRouter';
import { portfolioService } from '../services/portfolioService';
import { macroIntelligenceEngine } from '../services/macroIntelligenceEngine';
import { comparisonScreeningEngine } from '../services/comparisonScreeningEngine';
import { technicalAnalysisEngine } from '../services/technicalAnalysisEngine';
import { academicResearchService } from '../services/academicResearchService';
import { pairingStore } from '../data/pairingStore';
import { autoDeleteService } from '../services/autoDeleteService';
import {
  handleUserMessage,
  handleConfirmWishlistCandidate,
  handleViewWishlist,
  handleBookClarificationAndWishlist,
} from '../services/conversationalAgent';

export const apiRouter = express.Router();

// Webhook / Polling lifecycle hooks
let onWebhookSetupHook: (() => Promise<void>) | null = null;
let onWebhookClearHook: (() => void) | null = null;
export function setWebhookLifecycleHooks(hooks: { onSetup: () => Promise<void>; onClear: () => void }) {
  onWebhookSetupHook = hooks.onSetup;
  onWebhookClearHook = hooks.onClear;
}

// ------------------------------------------------------------------
// AUTHENTICATION MIDDLEWARE (Only protects administrative routes)
// ------------------------------------------------------------------
const requireAuth = (req: Request, res: Response, next: express.NextFunction) => {
  const adminPassword = process.env.WEB_ADMIN_PASSWORD;
  // If no password is set in .env, allow access
  if (!adminPassword) {
    return next();
  }
  
  const providedPassword = req.headers['x-admin-password'];
  if (providedPassword === adminPassword) {
    return next();
  }
  
  res.status(401).json({ error: 'Unauthorized: Administrative access required' });
};

// POST /api/auth/verify (Used by frontend to check if logged in as Admin)
apiRouter.post('/auth/verify', (req: Request, res: Response) => {
  const adminPassword = process.env.WEB_ADMIN_PASSWORD;
  const providedPassword = req.headers['x-admin-password'];
  
  if (!adminPassword || providedPassword === adminPassword) {
    res.json({ success: true, isAdmin: true });
  } else {
    res.status(401).json({ error: 'Unauthorized: Invalid admin password', isAdmin: false });
  }
});

// GET /api/status/public (Safe public metadata for the public library)
apiRouter.get('/status/public', (req: Request, res: Response) => {
  const books = store.getAllBooks();
  const models = ragStore.getAllModels();
  const categories = Array.from(new Set(books.map(b => b.category).filter(Boolean)));
  const stats = store.getStats();
  
  res.json({
    name: 'BusiMind Library',
    isOnline: true,
    totalBooks: books.length,
    totalModels: models.length,
    categoriesCount: categories.length,
    botConfigured: isBotTokenConfigured,
    channelConfigured: Boolean(process.env.TELEGRAM_CHANNEL_ID),
    stats,
  });
});

// ------------------------------------------------------------------
// ACADEMIC RESEARCH API ROUTES
// ------------------------------------------------------------------

// GET /api/research/papers/curated
apiRouter.get('/research/papers/curated', (req: Request, res: Response) => {
  res.json(academicResearchService.getCuratedPapers());
});

// GET /api/research/papers/search
apiRouter.get('/research/papers/search', async (req: Request, res: Response) => {
  const query = req.query.q as string;
  if (!query) {
    res.status(400).json({ error: 'Search query (q) is required' });
    return;
  }
  try {
    const results = await academicResearchService.searchPapers(query);
    res.json(results);
  } catch (error) {
    console.error('Paper search error:', error);
    res.status(500).json({ error: 'Failed to search papers' });
  }
});

// GET /api/research/papers/resolve
apiRouter.get('/research/papers/resolve', async (req: Request, res: Response) => {
  const identifier = req.query.id as string;
  if (!identifier) {
    res.status(400).json({ error: 'Identifier (id) is required (DOI, ISBN, arXiv)' });
    return;
  }
  try {
    const type = academicResearchService.detectIdentifierType(identifier);
    let paper = null;

    if (type === 'DOI') {
      paper = await academicResearchService.fetchByDoi(identifier);
    } else if (type === 'ARXIV') {
      paper = await academicResearchService.fetchByArxiv(identifier);
    } else if (type === 'ISBN') {
      paper = await academicResearchService.fetchByIsbn(identifier);
    } else {
      // fallback to search
      const results = await academicResearchService.searchPapers(identifier, 1);
      if (results.length > 0) paper = results[0];
    }

    if (!paper) {
      res.status(404).json({ error: 'Paper not found for the given identifier' });
      return;
    }

    res.json(paper);
  } catch (error) {
    console.error('Paper resolve error:', error);
    res.status(500).json({ error: 'Failed to resolve paper' });
  }
});

// POST /api/research/extract-model
apiRouter.post('/research/extract-model', async (req: Request, res: Response) => {
  const paper = req.body;
  if (!paper || !paper.title || !paper.authors) {
    res.status(400).json({ error: 'Valid AcademicPaper object is required' });
    return;
  }
  try {
    const mentalModel = await academicResearchService.extractMentalModelFromPaper(paper);
    res.json(mentalModel);
  } catch (error) {
    console.error('Extract model error:', error);
    res.status(500).json({ error: 'Failed to extract mental model' });
  }
});

// GET /api/search (Universal Global Search across Books, Models, GSE Tickers, Macro Benchmarks, Papers)
apiRouter.get('/search', async (req: Request, res: Response) => {
  const q = ((req.query.q as string) || '').trim().toLowerCase();
  if (!q) {
    res.json({ books: [], models: [], papers: [], tickers: [], macro: [], totalResults: 0 });
    return;
  }

  // 1. Books search
  const allBooks = store.getAllBooks();
  const matchedBooks = allBooks.filter((b) =>
    (b.title && b.title.toLowerCase().includes(q)) ||
    (b.author && b.author.toLowerCase().includes(q)) ||
    (b.category && b.category.toLowerCase().includes(q)) ||
    (b.description && b.description.toLowerCase().includes(q)) ||
    (b.tags && b.tags.some((t) => t.toLowerCase().includes(q)))
  ).slice(0, 8);

  // 2. Financial Models search
  const allModels = ragStore.getAllModels();
  const matchedModels = allModels.filter((m) =>
    (m.frameworkName && m.frameworkName.toLowerCase().includes(q)) ||
    (m.bookTitle && m.bookTitle.toLowerCase().includes(q)) ||
    (m.author && m.author.toLowerCase().includes(q)) ||
    (m.summary && m.summary.toLowerCase().includes(q)) ||
    (m.coreRule && m.coreRule.toLowerCase().includes(q))
  ).slice(0, 6);

  // 3. Academic Papers search
  const matchedPapers = academicResearchService.getCuratedPapers().filter((p) =>
    (p.title && p.title.toLowerCase().includes(q)) ||
    (p.authors && p.authors.some((a) => a.toLowerCase().includes(q))) ||
    (p.abstract && p.abstract.toLowerCase().includes(q)) ||
    (p.topics && p.topics.some((t) => t.toLowerCase().includes(q)))
  ).slice(0, 5);

  // 4. GSE & Global Equities search
  const equityUniverse = [
    { ticker: 'MTNGH', name: 'MTN Ghana Plc', exchange: 'GSE', sector: 'Telecom', targetPrice: 'GHS 2.45' },
    { ticker: 'GCB', name: 'GCB Bank Plc', exchange: 'GSE', sector: 'Commercial Banking', targetPrice: 'GHS 4.20' },
    { ticker: 'SCB', name: 'Standard Chartered Bank Ghana', exchange: 'GSE', sector: 'Banking', targetPrice: 'GHS 22.00' },
    { ticker: 'EGL', name: 'Enterprise Group Ltd', exchange: 'GSE', sector: 'Insurance', targetPrice: 'GHS 1.85' },
    { ticker: 'TOTAL', name: 'TotalEnergies Marketing Ghana', exchange: 'GSE', sector: 'Energy / Fuel Retail', targetPrice: 'GHS 6.50' },
    { ticker: 'NVDA', name: 'Nvidia Corp', exchange: 'NASDAQ', sector: 'Semiconductors / AI', targetPrice: '$135.00' },
    { ticker: 'AAPL', name: 'Apple Inc', exchange: 'NASDAQ', sector: 'Consumer Technology', targetPrice: '$230.00' },
    { ticker: 'MSFT', name: 'Microsoft Corp', exchange: 'NASDAQ', sector: 'Enterprise Cloud & AI', targetPrice: '$450.00' },
    { ticker: 'GOOGL', name: 'Alphabet Inc', exchange: 'NASDAQ', sector: 'Search & Cloud', targetPrice: '$190.00' },
    { ticker: 'BRK.B', name: 'Berkshire Hathaway', exchange: 'NYSE', sector: 'Conglomerate / Value', targetPrice: '$460.00' },
  ];
  const matchedTickers = equityUniverse.filter((e) =>
    e.ticker.toLowerCase().includes(q) ||
    e.name.toLowerCase().includes(q) ||
    e.sector.toLowerCase().includes(q)
  );

  // 5. Macro Indicators
  const macroItems = [
    { id: 'bog_policy', title: 'Bank of Ghana Monetary Policy Rate', value: '29.00%', relevance: 'Discount Rate Benchmark' },
    { id: 'tbill_91', title: '91-Day Treasury Bill Yield', value: '24.85%', relevance: 'Risk-Free Hurdle Rate' },
    { id: 'usd_ghs', title: 'USD/GHS Interbank Spot Rate', value: '15.65', relevance: 'Foreign Exchange / Import Cost' },
    { id: 'inflation_gh', title: 'Ghana Headline CPI Inflation', value: '20.90%', relevance: 'Purchasing Power & Real Return' },
    { id: 'crude_brent', title: 'Brent Crude Oil Benchmark', value: '$78.40/bbl', relevance: 'Energy & Fiscal Balance' },
    { id: 'gold_spot', title: 'Gold Spot Price', value: '$2,510/oz', relevance: 'Mineral Royalty & Sovereign Reserves' },
  ];
  const matchedMacro = macroItems.filter((m) =>
    m.title.toLowerCase().includes(q) ||
    m.id.toLowerCase().includes(q) ||
    m.relevance.toLowerCase().includes(q)
  );

  res.json({
    query: q,
    books: matchedBooks,
    models: matchedModels,
    papers: matchedPapers,
    tickers: matchedTickers,
    macro: matchedMacro,
    totalResults: matchedBooks.length + matchedModels.length + matchedPapers.length + matchedTickers.length + matchedMacro.length,
  });
});

// GET /api/status (Admin Only)
apiRouter.get('/status', requireAuth, async (req: Request, res: Response) => {
  let botInfo: { id?: number; username?: string; first_name?: string } | null = null;

  if (bot) {
    try {
      const me = await bot.api.getMe();
      botInfo = {
        id: me.id,
        username: me.username,
        first_name: me.first_name,
      };
    } catch (err) {
      console.warn('[Status] Unable to fetch bot info from Telegram API:', err);
    }
  }

  const appUrl = process.env.APP_URL || `http://${req.headers.host}`;
  const webhookUrl = `${appUrl.replace(/\/$/, '')}/telegram/webhook`;

  res.json({
    botTokenConfigured: isBotTokenConfigured,
    botUsername: botInfo?.username || 'BusiMind_bot',
    botId: botInfo?.id,
    geminiKeyConfigured: isGeminiAvailable(),
    channelIdConfigured: Boolean(process.env.TELEGRAM_CHANNEL_ID),
    channelId: process.env.TELEGRAM_CHANNEL_ID || '',
    adminIdConfigured: Boolean(process.env.ADMIN_TELEGRAM_ID),
    adminId: process.env.ADMIN_TELEGRAM_ID || '',
    appUrl,
    webhookUrl,
    stats: store.getStats(),
  });
});

// GET /api/books
apiRouter.get('/books', (req: Request, res: Response) => {
  const category = req.query.category as string | undefined;
  const search = req.query.search as string | undefined;

  let books = store.getAllBooks();
  if (category) {
    books = store.getBooksByCategory(category);
  }
  if (search) {
    books = store.searchBooksKeyword(search);
  }

  res.json(books);
});

// POST /api/books (Admin Only)
apiRouter.post('/books', requireAuth, (req: Request, res: Response) => {
  const {
    title,
    author,
    category,
    subcategory,
    description,
    whyRecommended,
    howItHelps,
    keyTakeaways,
    bestFor,
    difficulty,
    tags,
    publicationYear,
    ratingScore,
    isFeatured,
    distributionType,
    channelChatId,
    channelMessageId,
    fileName,
    coverImageUrl,
    externalPurchaseUrl,
    externalLibraryUrl,
  } = req.body;

  if (!title || !author || !category) {
    res.status(400).json({ error: 'Title, author, and category are required fields.' });
    return;
  }

  const created = store.addBook({
    title,
    author,
    category,
    subcategory: subcategory || '',
    description: description || 'No description provided.',
    whyRecommended: whyRecommended || 'Recommended for foundational business knowledge.',
    howItHelps: howItHelps || undefined,
    keyTakeaways: Array.isArray(keyTakeaways) ? keyTakeaways : typeof keyTakeaways === 'string' ? keyTakeaways.split('\n').filter(Boolean) : undefined,
    bestFor: bestFor || 'General business readers.',
    difficulty: difficulty || 'beginner',
    tags: Array.isArray(tags) ? tags : typeof tags === 'string' ? tags.split(',').map((t: string) => t.trim()) : [],
    publicationYear: Number(publicationYear) || getCanonicalPublicationYear(title, author) || undefined,
    ratingScore: Number(ratingScore) || 4.5,
    isFeatured: Boolean(isFeatured),
    distributionType: distributionType || 'external_only',
    channelChatId: channelChatId || process.env.TELEGRAM_CHANNEL_ID,
    channelMessageId: channelMessageId ? Number(channelMessageId) : undefined,
    fileName: fileName || undefined,
    coverImageUrl: coverImageUrl || undefined,
    externalPurchaseUrl: externalPurchaseUrl || undefined,
    externalLibraryUrl: externalLibraryUrl || undefined,
  });

  res.status(201).json(created);
});

// PUT /api/books/:id (Admin Only)
apiRouter.put('/books/:id', requireAuth, (req: Request, res: Response) => {
  const updated = store.updateBook(req.params.id, req.body);
  if (!updated) {
    res.status(404).json({ error: 'Book not found' });
    return;
  }
  res.json(updated);
});

// DELETE /api/books/:id (Admin Only)
apiRouter.delete('/books/:id', requireAuth, (req: Request, res: Response) => {
  const deleted = store.deleteBook(req.params.id);
  if (!deleted) {
    res.status(404).json({ error: 'Book not found' });
    return;
  }
  res.json({ success: true, message: `Book ${req.params.id} removed.` });
});

// POST /api/books/:id/link-channel (Admin Only)
apiRouter.post('/books/:id/link-channel', requireAuth, async (req: Request, res: Response) => {
  const { channelChatId, channelMessageId, fileName } = req.body;

  const targetChatId = channelChatId || process.env.TELEGRAM_CHANNEL_ID;
  if (!targetChatId || !channelMessageId) {
    res.status(400).json({ error: 'channelMessageId and targetChatId are required.' });
    return;
  }

  const updated = store.linkTelegramMessage(
    req.params.id,
    targetChatId,
    Number(channelMessageId),
    fileName
  );

  if (!updated) {
    res.status(404).json({ error: 'Book not found' });
    return;
  }

  // Background auto-enrichment if book lacks cover or has generic author
  if (!updated.coverImageUrl || updated.author === 'Channel Library') {
    enrichSingleBook(updated).catch((e) => console.warn('[Auto-Enrich on Link Error]:', e));
  }

  res.json({ success: true, book: updated });
});

// POST /api/books/:id/enrich (Admin Only)
apiRouter.post('/books/:id/enrich', requireAuth, async (req: Request, res: Response) => {
  const book = store.getBookById(req.params.id);
  if (!book) {
    res.status(404).json({ error: 'Book not found' });
    return;
  }

  try {
    const enriched = await enrichSingleBook(book, true);
    res.json({ success: true, book: enriched });
  } catch (err: any) {
    console.error(`[Book ${req.params.id} Enrich Error]:`, err);
    res.status(500).json({ error: err.message || 'Failed to enrich book' });
  }
});

// POST /api/catalog/enrich (Admin Only)
apiRouter.post('/catalog/enrich', requireAuth, async (req: Request, res: Response) => {
  try {
    const forceAll = Boolean(req.body.forceAll);
    const limit = req.body.limit ? Number(req.body.limit) : undefined;
    const result = await enrichCatalog({ forceAll, limit });
    res.json({ success: true, ...result });
  } catch (err: any) {
    console.error('[Catalog Enrich Error]:', err);
    res.status(500).json({ error: err.message || 'Failed to enrich catalog' });
  }
});

// POST /api/catalog/repair-dates (Repairs 2026/fake dates with canonical authentic publication years)
apiRouter.post('/catalog/repair-dates', async (req: Request, res: Response) => {
  try {
    const result = await store.repairBookDates();
    res.json({ success: true, ...result });
  } catch (err: any) {
    console.error('[Repair Dates Error]:', err);
    res.status(500).json({ error: err.message || 'Failed to repair dates' });
  }
});

// GET /api/catalog/enrich/preview (Admin Only)
apiRouter.get('/catalog/enrich/preview', requireAuth, (req: Request, res: Response) => {
  const books = store.getAllBooks();
  const needingEnrichment = books.filter(
    (b) => !b.coverImageUrl || b.author === 'Channel Library' || !b.author || /^\d{2}[\s_.-]\d{2}[\s_.-]\d{4}/.test(b.title)
  );

  res.json({
    totalBooks: books.length,
    needingEnrichmentCount: needingEnrichment.length,
    sample: needingEnrichment.slice(0, 10).map((b) => ({
      id: b.id,
      title: b.title,
      author: b.author,
      hasCover: Boolean(b.coverImageUrl),
      channelMessageId: b.channelMessageId,
    })),
  });
});

// POST /api/books/:id/deliver (Public User Book Delivery to Telegram or Web)
apiRouter.post('/books/:id/deliver', async (req: Request, res: Response) => {
  const book = store.getBookById(req.params.id);
  if (!book) {
    res.status(404).json({ error: 'Book not found' });
    return;
  }
  const { chatId, uid } = req.body;
  let effectiveChatId = chatId;

  if (!effectiveChatId && uid) {
    try {
      const { db } = await import('../data/firestoreConfig');
      const { doc, getDoc } = await import('firebase/firestore');
      const userSnap = await getDoc(doc(db, 'users', uid));
      if (userSnap.exists()) {
        effectiveChatId = userSnap.data()?.telegramChatId;
      }
    } catch (e: any) {
      console.warn('[Deliver user lookup error]:', e?.message || e);
    }
  }

  const channelId = book.channelChatId || process.env.TELEGRAM_CHANNEL_ID;
  const messageId = book.channelMessageId;

  // 1. Direct Telegram delivery if user provided their chatId or is in Telegram WebApp
  if (effectiveChatId && bot && channelId && messageId) {
    const cleanChatId = String(effectiveChatId).trim();
    // Dual rate limit check: Telegram Chat ID and Web User ID
    const chatUsage = store.getDailyUsage(cleanChatId);
    const uidUsage = uid ? store.getDailyUsage(uid) : null;

    if (!chatUsage.isUnlimited && (chatUsage.remaining <= 0 || (uidUsage && !uidUsage.isUnlimited && uidUsage.remaining <= 0))) {
      res.status(429).json({
        success: false,
        error: `Daily limit reached (3/3 books). Resets at 00:00 UTC (in ${chatUsage.timeUntilReset}).`,
        limitReached: true,
        remaining: 0,
        timeUntilReset: chatUsage.timeUntilReset,
      });
      return;
    }

    try {
      const delRes = await autoDeleteService.deliverBookWithAutoDelete({
        chatId: Number(cleanChatId),
        book,
        source: 'web_deliver',
      });
      if (delRes.success) {
        // Enforce quota consumption across both Telegram recipient and Web session
        store.incrementDailyUsage(cleanChatId);
        if (uid) store.incrementDailyUsage(uid);

        const updatedUsage = store.getDailyUsage(cleanChatId);
        res.json({
          success: true,
          delivered: true,
          method: 'telegram_direct',
          deliveredMessageId: delRes.deliveredMessageId,
          remainingToday: updatedUsage.remaining,
          message: `"${book.title}" delivered directly to your Telegram chat with 2-minute auto-destruction window!`
        });
        return;
      }
    } catch (err: any) {
      console.warn('[Public deliver autoDelete error, fallback to deep-link]:', err.message);
    }
  }

  // 2. Return bot direct deep link with short pairing code (strictly under 64 chars)
  const botUser = process.env.TELEGRAM_BOT_USERNAME || 'BusiMind_bot';
  const pairingCode = uid ? pairingStore.createPairing(uid, book.id) : null;
  const startPayload = pairingCode ? `p_${pairingCode}` : `book_${book.id}`;
  res.json({
    success: true,
    delivered: false,
    method: 'deep_link',
    botUsername: botUser,
    pairingCode,
    deepLink: `https://t.me/${botUser}?start=${startPayload}`,
    message: `Connect your Telegram to receive "${book.title}" instantly!`
  });
});

// POST /api/user/generate-pairing-code
apiRouter.post('/user/generate-pairing-code', (req: Request, res: Response) => {
  const { uid, bookId } = req.body;
  if (!uid) {
    res.status(400).json({ error: 'uid is required' });
    return;
  }
  const code = pairingStore.createPairing(uid, bookId);
  const botUser = process.env.TELEGRAM_BOT_USERNAME || 'BusiMind_bot';
  res.json({
    success: true,
    code,
    botUsername: botUser,
    deepLink: `https://t.me/${botUser}?start=p_${code}`,
    expiresIn: 1200,
  });
});

// POST /api/user/link-telegram
apiRouter.post('/user/link-telegram', async (req: Request, res: Response) => {
  const { uid, telegramChatId, telegramUsername, bookIdToDeliver } = req.body;
  if (!uid || !telegramChatId) {
    res.status(400).json({ error: 'uid and telegramChatId are required' });
    return;
  }

  const cleanChatId = String(telegramChatId).trim();
  const cleanUsername = telegramUsername ? String(telegramUsername).replace(/^@/, '').trim() : null;

  try {
    const { db } = await import('../data/firestoreConfig');
    const { doc, setDoc, collection, query, where, getDocs } = await import('firebase/firestore');

    // 1. Enforce strict 1-to-1 mapping: Unlink any other user accounts currently holding this Telegram Chat ID
    try {
      const usersRef = collection(db, 'users');
      const conflictQuery = query(usersRef, where('telegramChatId', '==', cleanChatId));
      const conflictSnap = await getDocs(conflictQuery);
      for (const conflictingDoc of conflictSnap.docs) {
        if (conflictingDoc.id !== uid) {
          console.log(`[link-telegram] Unlinking duplicate Telegram account from previous user ${conflictingDoc.id}`);
          await setDoc(conflictingDoc.ref, {
            telegramChatId: null,
            telegramUsername: null,
            unlinkedAt: new Date().toISOString(),
            unlinkReason: 'relinked_to_another_account',
          }, { merge: true });
        }
      }
    } catch (unifyErr: any) {
      console.warn('[link-telegram 1-to-1 unification check error]:', unifyErr?.message || unifyErr);
    }

    // 2. Bind to current user
    await setDoc(doc(db, 'users', uid), {
      telegramChatId: cleanChatId,
      telegramUsername: cleanUsername,
      updatedAt: new Date().toISOString(),
    }, { merge: true });

    // Send confirmation message into the Telegram chat so the user immediately sees it worked
    if (bot) {
      try {
        await bot.api.sendMessage(
          Number(cleanChatId),
          `✅ *BusiMind Account Connected!*\n\n` +
          `Your Telegram has been successfully linked to your BusiMind Web session. ` +
          `Any titles you request on the website will now be delivered straight here!`,
          { parse_mode: 'Markdown' }
        );
      } catch (notifyErr: any) {
        console.warn('[link-telegram notify error]:', notifyErr?.message || notifyErr);
      }
    }

    let deliveryResult: any = null;
    if (bookIdToDeliver && bot) {
      const book = store.getBookById(bookIdToDeliver);
      if (book) {
        // Enforce quota on linking delivery
        const chatUsage = store.getDailyUsage(cleanChatId);
        const uidUsage = store.getDailyUsage(uid);

        if (!chatUsage.isUnlimited && (chatUsage.remaining <= 0 || (!uidUsage.isUnlimited && uidUsage.remaining <= 0))) {
          deliveryResult = {
            success: false,
            error: `Daily limit reached (3/3 books). Resets at 00:00 UTC (in ${chatUsage.timeUntilReset}).`,
            limitReached: true,
            timeUntilReset: chatUsage.timeUntilReset,
          };
        } else {
          try {
            const delRes = await autoDeleteService.deliverBookWithAutoDelete({
              chatId: Number(cleanChatId),
              book,
              source: 'link_deliver',
            });
            if (delRes.success) {
              store.incrementDailyUsage(cleanChatId);
              store.incrementDailyUsage(uid);
            }
            deliveryResult = delRes;
          } catch (copyErr: any) {
            console.warn('[link-telegram deliver error]:', copyErr?.message || copyErr);
            deliveryResult = { success: false, error: copyErr?.message };
          }
        }
      }
    }

    res.json({
      success: true,
      telegramChatId: cleanChatId,
      telegramUsername: cleanUsername,
      delivery: deliveryResult,
      message: 'Telegram account successfully linked!'
    });
  } catch (err: any) {
    console.error('[link-telegram error]:', err);
    res.status(500).json({ error: err?.message || 'Failed to link account' });
  }
});

// POST /api/user/unlink-telegram - Unlink Telegram Chat ID from User Profile
apiRouter.post('/user/unlink-telegram', async (req: Request, res: Response) => {
  const { uid, email, chatId } = req.body;
  if (!uid && !email && !chatId) {
    res.status(400).json({ error: 'uid, email, or chatId is required' });
    return;
  }
  try {
    const { doc, setDoc, collection, query, where, getDocs } = await import('firebase/firestore');
    const { db } = await import('../data/firestoreConfig');

    let unlinkedCount = 0;

    if (uid) {
      await setDoc(doc(db, 'users', uid), {
        telegramChatId: null,
        telegramUsername: null,
        unlinkedAt: new Date().toISOString(),
      }, { merge: true });
      unlinkedCount++;
    }

    if (email) {
      const q = query(collection(db, 'users'), where('email', '==', email.toLowerCase().trim()));
      const snaps = await getDocs(q);
      for (const d of snaps.docs) {
        await setDoc(doc(db, 'users', d.id), {
          telegramChatId: null,
          telegramUsername: null,
          unlinkedAt: new Date().toISOString(),
        }, { merge: true });
        unlinkedCount++;
      }
    }

    if (chatId) {
      const q = query(collection(db, 'users'), where('telegramChatId', '==', String(chatId).trim()));
      const snaps = await getDocs(q);
      for (const d of snaps.docs) {
        await setDoc(doc(db, 'users', d.id), {
          telegramChatId: null,
          telegramUsername: null,
          unlinkedAt: new Date().toISOString(),
        }, { merge: true });
        unlinkedCount++;
      }
    }

    res.json({
      success: true,
      unlinkedCount,
      message: 'Telegram account unlinked successfully.'
    });
  } catch (err: any) {
    console.error('[unlink-telegram error]:', err);
    res.status(500).json({ error: err?.message || 'Failed to unlink Telegram' });
  }
});

// POST /api/books/:id/test-deliver (Admin & Testing Delivery)
apiRouter.post('/books/:id/test-deliver', requireAuth, async (req: Request, res: Response) => {
  const book = store.getBookById(req.params.id);
  if (!book) {
    res.status(404).json({ error: 'Book not found' });
    return;
  }
  const channelId = book.channelChatId || process.env.TELEGRAM_CHANNEL_ID;
  const messageId = book.channelMessageId;
  const targetChatId = req.body.chatId
    ? Number(req.body.chatId)
    : (process.env.ADMIN_TELEGRAM_ID ? Number(process.env.ADMIN_TELEGRAM_ID) : null);

  if (!bot) {
    res.status(400).json({ error: 'Bot is not active' });
    return;
  }
  if (!channelId || !messageId) {
    res.status(400).json({ error: 'This book does not have a channel message ID linked yet.' });
    return;
  }
  if (!targetChatId) {
    res.status(400).json({ error: 'Telegram Chat ID is not configured.' });
    return;
  }

  try {
    const delRes = await autoDeleteService.deliverBookWithAutoDelete({
      chatId: targetChatId,
      book,
      source: 'test_deliver',
    });

    if (delRes.success) {
      res.json({
        success: true,
        deliveredMessageId: delRes.deliveredMessageId,
        message: `Delivered "${book.title}" to Telegram (with 2-minute auto-destruction window).`,
      });
      return;
    } else {
      res.status(500).json({ error: delRes.error || 'Failed to deliver message' });
      return;
    }
  } catch (err: any) {
    console.error('[test-deliver error]:', err);
    res.status(500).json({ error: err.message || 'Failed to deliver message from channel' });
  }
});

// POST /api/webhook/setup (Admin Only)
apiRouter.post('/webhook/setup', requireAuth, async (req: Request, res: Response) => {
  if (!bot) {
    res.status(400).json({ error: 'Telegram Bot Token not configured yet. Add it to Secrets / Environment.' });
    return;
  }

  const host = req.body.hostUrl || process.env.APP_URL || `https://${req.headers.host}`;
  const webhookUrl = `${host.replace(/\/$/, '')}/telegram/webhook`;
  const secretToken = process.env.TELEGRAM_WEBHOOK_SECRET || undefined;

  try {
    await bot.api.setWebhook(webhookUrl, {
      secret_token: secretToken,
      drop_pending_updates: true,
      allowed_updates: ['message', 'callback_query', 'channel_post', 'edited_channel_post'],
    });

    const info = await bot.api.getWebhookInfo();
    if (onWebhookSetupHook) {
      await onWebhookSetupHook().catch(() => {});
    }
    res.json({
      success: true,
      webhookUrl: info.url,
      hasCustomCertificate: info.has_custom_certificate,
      pendingUpdateCount: info.pending_update_count,
    });
  } catch (err: any) {
    console.error('[Webhook Setup Error]:', err);
    res.status(500).json({ error: err.message || 'Failed to set webhook' });
  }
});

// POST /api/webhook/clear (Clear webhook to switch to polling)
apiRouter.post('/webhook/clear', requireAuth, async (req: Request, res: Response) => {
  if (!bot) {
    res.status(400).json({ error: 'Telegram Bot Token not configured yet.' });
    return;
  }

  try {
    await bot.api.deleteWebhook({ drop_pending_updates: false });
    const info = await bot.api.getWebhookInfo();
    if (onWebhookClearHook) {
      onWebhookClearHook();
    }
    res.json({ success: true, message: 'Webhook cleared. Long polling active in development mode.', webhookInfo: info });
  } catch (err: any) {
    console.error('[Webhook Clear Error]:', err);
    res.status(500).json({ error: err.message || 'Failed to clear webhook' });
  }
});

// GET /api/webhook/info (Check webhook state)
apiRouter.get('/webhook/info', async (req: Request, res: Response) => {
  if (!bot) {
    res.status(400).json({ error: 'Telegram Bot Token not configured yet.' });
    return;
  }

  try {
    const info = await bot.api.getWebhookInfo();
    res.json({
      success: true,
      isWebhookActive: Boolean(info.url),
      webhookUrl: info.url,
      pendingUpdateCount: info.pending_update_count,
      lastErrorMessage: info.last_error_message,
      lastErrorDate: info.last_error_date,
      mode: info.url ? 'webhook' : 'long_polling',
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to get webhook info' });
  }
});

// GET /api/stats (Public library statistics)
apiRouter.get('/stats', (req: Request, res: Response) => {
  res.json(store.getStats());
});

// GET /api/requests (Get user-requested books & wishlist)
apiRouter.get('/requests', (req: Request, res: Response) => {
  res.json(store.getAllBookRequests());
});

// POST /api/requests (Public User Book Wishlist Submission)
apiRouter.post('/requests', (req: Request, res: Response) => {
  const { title, author, query, userId, topic } = req.body;
  if (!title) {
    res.status(400).json({ error: 'Title is required' });
    return;
  }
  const result = store.recordBookRequest(
    title,
    author || 'Unknown',
    query || title,
    userId || 'web_reader',
    undefined,
    topic || 'General Business'
  );
  res.status(201).json({ success: true, ...result });
});

// POST /api/requests/:id/status (Admin Only)
apiRouter.post('/requests/:id/status', requireAuth, (req: Request, res: Response) => {
  const { id } = req.params;
  const { status } = req.body;
  if (!['pending', 'acquired', 'dismissed'].includes(status)) {
    res.status(400).json({ error: 'Invalid status' });
    return;
  }
  const ok = store.updateBookRequestStatus(id, status);
  res.json({ success: ok });
});

// DELETE /api/requests/:id (Admin Only)
apiRouter.delete('/requests/:id', requireAuth, (req: Request, res: Response) => {
  const { id } = req.params;
  const ok = store.deleteBookRequest(id);
  res.json({ success: ok });
});

// --- FINANCIAL INTELLIGENCE & VALUATION ROUTES ---

// GET /api/finance/quote?symbol=...
apiRouter.get('/finance/quote', async (req: Request, res: Response) => {
  try {
    const symbol = (req.query.symbol as string) || 'MTNGH';
    const quote = await marketDataService.getQuote(symbol);
    res.json(quote);
  } catch (err: any) {
    console.error('[Finance Quote Error]:', err);
    res.status(500).json({ error: err.message || 'Failed to fetch quote' });
  }
});

// GET /api/finance/search?q=...
apiRouter.get('/finance/search', (req: Request, res: Response) => {
  const q = (req.query.q as string) || '';
  const results = marketDataService.searchTickers(q);
  res.json(results);
});

// POST /api/finance/valuation
apiRouter.post('/finance/valuation', async (req: Request, res: Response) => {
  try {
    const { symbol, growthRate, discountRate, terminalRate } = req.body;
    if (!symbol) {
      res.status(400).json({ error: 'Symbol is required' });
      return;
    }
    const quote = await marketDataService.getQuote(symbol);
    const valuation = await valuationEngine.analyzeAsset(quote, {
      growthRate: growthRate !== undefined ? Number(growthRate) : undefined,
      discountRate: discountRate !== undefined ? Number(discountRate) : undefined,
      terminalRate: terminalRate !== undefined ? Number(terminalRate) : undefined,
    });
    res.json(valuation);
  } catch (err: any) {
    console.error('[Finance Valuation Error]:', err);
    res.status(500).json({ error: err.message || 'Valuation failed' });
  }
});

// GET /api/finance/rag/models
apiRouter.get('/finance/rag/models', (req: Request, res: Response) => {
  const models = ragStore.getAllModels();
  res.json(models);
});

// POST /api/finance/rag/extract
apiRouter.post('/finance/rag/extract', async (req: Request, res: Response) => {
  try {
    const { bookIdOrTitle, author, notes } = req.body;
    if (!bookIdOrTitle) {
      res.status(400).json({ error: 'bookIdOrTitle is required' });
      return;
    }
    const extracted = await ragStore.extractFromBook(bookIdOrTitle, author, notes);
    res.json({ success: true, extracted });
  } catch (err: any) {
    console.error('[RAG Extraction Error]:', err);
    res.status(500).json({ error: err.message || 'Failed to extract mental models' });
  }
});

// GET /api/finance/journal
apiRouter.get('/finance/journal', (req: Request, res: Response) => {
  const entries = journalStore.getAll();
  res.json(entries);
});

// POST /api/finance/journal
apiRouter.post('/finance/journal', (req: Request, res: Response) => {
  try {
    const entry = req.body;
    if (!entry.symbol || !entry.thesis) {
      res.status(400).json({ error: 'Symbol and thesis are required' });
      return;
    }
    const created = journalStore.add(entry);
    res.json(created);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to create journal entry' });
  }
});

// PATCH /api/finance/journal/:id
apiRouter.patch('/finance/journal/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  const updated = journalStore.update(id, req.body);
  if (!updated) {
    res.status(404).json({ error: 'Journal entry not found' });
    return;
  }
  res.json(updated);
});

// DELETE /api/finance/journal/:id
apiRouter.delete('/finance/journal/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  const ok = journalStore.delete(id);
  res.json({ success: ok });
});

// POST /api/finance/agent (Unified Financial Intelligence Engine)
apiRouter.post('/finance/agent', async (req: Request, res: Response) => {
  try {
    const { query, userId } = req.body;
    if (!query) {
      res.status(400).json({ error: 'Query is required' });
      return;
    }
    const response = await financialAgentRouter.handleFinancialQuery(query, userId || 999999);
    res.json(response);
  } catch (err: any) {
    console.error('[API Finance Agent Error]:', err);
    res.status(500).json({ error: err.message || 'Failed to process financial query' });
  }
});

// GET /api/finance/portfolio
apiRouter.get('/finance/portfolio', async (req: Request, res: Response) => {
  try {
    const summary = await portfolioService.getPortfolioSummary();
    res.json(summary);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to fetch portfolio' });
  }
});

// POST /api/finance/trade
apiRouter.post('/finance/trade', async (req: Request, res: Response) => {
  try {
    const { action, symbol, shares } = req.body;
    if (!action || !symbol || !shares) {
      res.status(400).json({ error: 'Action (BUY/SELL), symbol, and shares count are required' });
      return;
    }
    if (action.toUpperCase() === 'BUY') {
      const result = await portfolioService.executeBuy(symbol, Number(shares));
      res.json(result);
    } else {
      const result = await portfolioService.executeSell(symbol, Number(shares));
      res.json(result);
    }
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to execute trade' });
  }
});

// POST /api/finance/stress-test
apiRouter.post('/finance/stress-test', async (req: Request, res: Response) => {
  try {
    const { scenario } = req.body;
    const scenarioType = scenario || 'CEDI_DEPRECIATION_15';
    const result = await portfolioService.runStressTest(scenarioType);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to execute stress test' });
  }
});

// GET /api/finance/compare
apiRouter.get('/finance/compare', async (req: Request, res: Response) => {
  try {
    const symbolA = (req.query.symbolA as string) || 'MTNGH';
    const symbolB = (req.query.symbolB as string) || 'GCB';
    const comparison = await comparisonScreeningEngine.compareAssets(symbolA, symbolB);
    res.json(comparison);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to compare assets' });
  }
});

// GET /api/finance/technical
apiRouter.get('/finance/technical', async (req: Request, res: Response) => {
  try {
    const symbol = (req.query.symbol as string) || 'MTNGH';
    const quote = await marketDataService.getQuote(symbol);
    const tech = technicalAnalysisEngine.analyze(quote);
    res.json(tech);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to run technical analysis' });
  }
});

// GET /api/finance/macro
apiRouter.get('/finance/macro', (req: Request, res: Response) => {
  try {
    const dashboard = macroIntelligenceEngine.getDashboard();
    res.json(dashboard);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to fetch macro dashboard' });
  }
});

// GET /api/finance/screen
apiRouter.get('/finance/screen', async (req: Request, res: Response) => {
  try {
    const minYield = req.query.minYield ? Number(req.query.minYield) : undefined;
    const maxPE = req.query.maxPE ? Number(req.query.maxPE) : undefined;
    const region = req.query.region as any;
    const minMarginOfSafety = req.query.minMarginOfSafety ? Number(req.query.minMarginOfSafety) : undefined;

    const results = await comparisonScreeningEngine.screenUniverse({
      minDividendYield: minYield,
      maxPE,
      region,
      minMarginOfSafety,
    });
    res.json(results);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to screen assets' });
  }
});

// POST /api/simulate (Interactive Telegram Web Preview Simulator)
apiRouter.post('/simulate', async (req: Request, res: Response) => {
  const { text, callbackData, simUserId } = req.body;
  const userId = simUserId || 999999;

  try {
    if (callbackData) {
      // Handle simulate callback queries
      if (callbackData === 'menu_main') {
        const usage = store.getDailyUsage(userId);
        res.json({
          text: `*BusiMind*\n\nYour personal guide to business knowledge.\n\n📊 *Daily Allowance:* ${usage.remaining}/3 requests left today (resets at 00:00 UTC)\n\nSelect an option below or send your goal in chat:`,
          buttons: [
            [{ text: '🔎 Find a Book', data: 'menu_find' }, { text: '🏆 Best Business Books', data: 'menu_best' }],
            [{ text: '🚀 Entrepreneurship', data: 'cat_entrepreneurship' }, { text: '💰 Money & Investing', data: 'cat_investing' }],
            [{ text: '👔 Leadership & Management', data: 'cat_leadership' }, { text: '📣 Marketing & Sales', data: 'cat_marketing' }],
            [{ text: '🧠 Mindset & Psychology', data: 'cat_mindset' }, { text: '📊 Finance & Economics', data: 'cat_finance' }],
            [{ text: '📈 Wealth & Valuation Lab', data: 'menu_valuation' }, { text: '💼 Portfolio & Paper Trade', data: 'menu_portfolio' }],
            [{ text: '⚡ Macro Stress-Test', data: 'stress_test_cedi' }, { text: '🤖 Ask Financial AI', data: 'menu_ask_ai' }],
            [{ text: '📚 Reading List', data: 'menu_reading_list' }, { text: `⏳ Limit: ${usage.remaining}/3 left`, data: 'menu_limit' }],
          ],
        });
        return;
      }

      if (callbackData === 'menu_wishlist') {
        const resp = handleViewWishlist(userId);
        res.json({
          text: resp.text,
          buttons: resp.buttons,
        });
        return;
      }

      if (callbackData === 'menu_request_prompt') {
        res.json({
          text: `📝 *What book would you like BusiMind to acquire?*\n\nSend the title and author in your next message (e.g. \`Zero to One by Peter Thiel\` or \`Never Split the Difference\`).`,
          buttons: [
            [{ text: '📋 View Current Wishlist', data: 'menu_wishlist' }],
            [{ text: '🏠 Main Menu', data: 'menu_main' }],
          ],
        });
        return;
      }

      if (callbackData.startsWith('confirm_wishlist_')) {
        const index = parseInt(callbackData.replace('confirm_wishlist_', ''), 10);
        const resp = handleConfirmWishlistCandidate(userId, index);
        res.json({
          text: resp.text,
          photoUrl: resp.photoUrl,
          buttons: resp.buttons,
        });
        return;
      }

      if (callbackData === 'recommend_narrative') {
        const narrative = store.getAllBooks().find((b) => b.title.toLowerCase().includes('shoe') || b.title.toLowerCase().includes('blood')) || store.getAllBooks()[0];
        res.json({
          text: `🏃 *Shoe Dog: A Memoir by the Creator of Nike*\n✍️ *Author:* Phil Knight\n\nIf you love passionate drama, obsessive devotion, and high-stakes conflict, *Shoe Dog* reads with all the intensity of a bestselling fiction novel!\n\n💡 *Why Recommended:* Phil Knight's authentic recount of surviving against bankruptcy to forge a global footwear empire.`,
          buttons: [
            ...(narrative ? [[{ text: `📖 View "${narrative.title}"`, data: `book_${narrative.id}` }]] : []),
            [{ text: '📚 Browse Business Shelves', data: 'menu_catalog' }],
            [{ text: '🏠 Main Menu', data: 'menu_main' }],
          ],
        });
        return;
      }

      if (callbackData === 'menu_portfolio') {
        const resp = await financialAgentRouter.handleFinancialQuery('show my portfolio', userId);
        res.json({
          text: resp.text,
          buttons: resp.buttons,
          sources: resp.sources,
        });
        return;
      }

      if (callbackData === 'stress_test_cedi') {
        const resp = await financialAgentRouter.handleFinancialQuery('what if the cedi depreciates 15%?', userId);
        res.json({
          text: resp.text,
          buttons: resp.buttons,
          sources: resp.sources,
        });
        return;
      }

      if (callbackData === 'screen_dividends') {
        const resp = await financialAgentRouter.handleFinancialQuery('find high dividend GSE stocks', userId);
        res.json({
          text: resp.text,
          buttons: resp.buttons,
          sources: resp.sources,
        });
        return;
      }

      if (callbackData.startsWith('trade_buy_')) {
        const parts = callbackData.split('_');
        const symbol = parts[2];
        const shares = parseInt(parts[3] || '100', 10);
        const tradeRes = await portfolioService.executeBuy(symbol, shares);
        res.json({
          text: `🛒 *PAPER TRADE EXECUTION:*\n\n${tradeRes.message}`,
          buttons: [
            [{ text: '💼 View Portfolio', data: 'menu_portfolio' }],
            [{ text: '🏠 Main Menu', data: 'menu_main' }],
          ],
        });
        return;
      }

      if (callbackData.startsWith('compare_')) {
        const sym = callbackData.replace('compare_', '');
        const compResp = await financialAgentRouter.handleFinancialQuery(`compare ${sym} and GCB`, userId);
        res.json({
          text: compResp.text,
          buttons: compResp.buttons,
          sources: compResp.sources,
        });
        return;
      }

      if (callbackData === 'menu_limit') {
        const usage = store.getDailyUsage(userId);
        res.json({
          text: `📊 *Your Daily Request Allowance:*\n\n` +
            `• *Used Today:* ${usage.used} / ${usage.limit} requests\n` +
            `• *Remaining:* ${usage.remaining} requests\n` +
            `• *Next Reset:* Midnight 00:00 UTC (in \`${usage.timeUntilReset}\`)\n\n` +
            `Each day you receive 3 requests to pull books and resources directly from the private repository. Unused requests do not roll over.\n\n` +
            `_Tip: Browsing summaries, reading lists, and key takeaways does not consume your daily requests!_`,
          buttons: [
            [{ text: '📚 Browse Categories', data: 'menu_categories' }],
            [{ text: '⭐ Reading List', data: 'menu_reading_list' }],
            [{ text: '🏠 Main Menu', data: 'menu_main' }],
          ],
        });
        return;
      }

      if (callbackData.startsWith('cat_')) {
        const catMap: Record<string, string> = {
          cat_entrepreneurship: 'Entrepreneurship',
          cat_finance: 'Finance & Economics',
          cat_investing: 'Money & Investing',
          cat_leadership: 'Leadership & Management',
          cat_marketing: 'Marketing & Sales',
          cat_mindset: 'Mindset & Psychology',
          cat_strategy: 'Strategy & Economics',
        };
        const catName = catMap[callbackData] || 'Curated Books';
        const books = store.getBooksByCategory(catName);
        res.json({
          text: `📂 *${catName}*\n\nShowing ${books.length} curated title(s). Select any book:`,
          buttons: [
            ...books.map((b) => [{ text: `${b.distributionType === 'telegram_repository' ? '📖' : '📘'} ${b.title}`, data: `book_${b.id}` }]),
            [{ text: '🏠 Main Menu', data: 'menu_main' }],
          ],
        });
        return;
      }

      if (callbackData.startsWith('book_')) {
        const bookId = callbackData.replace('book_', '');
        const book = store.getBookById(bookId);
        if (!book) {
          res.json({ text: 'Book not found.', buttons: [[{ text: '🏠 Main Menu', data: 'menu_main' }]] });
          return;
        }

        const inList = store.isBookInReadingList(userId, book.id);
        const helps = getBookHelpExplanation(book);
        const takeaways = getBookKeyTakeaways(book);
        const usage = store.getDailyUsage(userId);
        const quotaNote = usage.isUnlimited
          ? '👑 _Admin: Unlimited Access_'
          : `📊 _Allowance: ${usage.remaining}/3 left today (resets 00:00 UTC)_`;

        res.json({
          text: `*${book.title.toUpperCase()}*\n✍️ *Author:* ${book.author}\n📂 *Category:* ${book.category} (${book.subcategory || 'General'})\n📊 *Difficulty:* ${book.difficulty.toUpperCase()} | *Published:* ${book.publicationYear}\n📜 *Access Model:* ${book.distributionType === 'telegram_repository' ? '📖 Legal Repository' : '⚖️ Copyrighted'}\n\n🚀 *How This Helps You (Practical ROI):*\n${helps}\n\n🔑 *Key Takeaways:*\n${takeaways.map((t) => `• ${t}`).join('\n')}\n\n📝 *Executive Overview:*\n${book.description}\n\n💡 *Why Recommended:*\n${book.whyRecommended}\n\n🎯 *Best Suited For:*\n${book.bestFor}\n\n${quotaNote}`,
          buttons: [
            [
              { text: book.distributionType === 'telegram_repository' ? '📖 Get Book (Repository)' : '🔗 Legitimate Access Options', data: `get_book_${book.id}` },
              { text: inList ? '🗑 Remove from List' : '⭐ Add to Reading List', data: inList ? `rem_list_${book.id}` : `add_list_${book.id}` },
            ],
            [{ text: '🤖 Ask About This Book', data: `ask_book_${book.id}` }, { text: '🔎 Similar Books', data: `sim_book_${book.id}` }],
            [{ text: '🏠 Main Menu', data: 'menu_main' }],
          ],
        });
        return;
      }

      if (callbackData.startsWith('get_book_')) {
        const bookId = callbackData.replace('get_book_', '');
        const book = store.getBookById(bookId);
        if (!book) {
          res.json({ text: 'Book not found.' });
          return;
        }

        if (book.distributionType === 'telegram_repository') {
          // Enforce 3 requests/day limit
          const rate = store.incrementDailyUsage(userId);
          if (!rate.allowed) {
            const timeInfo = store.getTimeUntilMidnight();
            res.json({
              text: `⏳ *Daily Limit Reached (3 of 3 requests)*\n\n` +
                `You have used your 3 free book requests for today.\n\n` +
                `🔄 *Reset Schedule:* Midnight 00:00 UTC\n` +
                `⏱️ *Time until reset:* \`${timeInfo.formatted}\`\n\n` +
                `💡 *In the meantime:*\n` +
                `• Re-read books in your ⭐ *Reading List*\n` +
                `• Browse summaries, categories, and key takeaways\n\n` +
                `_See you after midnight for your next 3 requests!_`,
              buttons: [
                [{ text: '⭐ My Reading List', data: 'menu_reading_list' }],
                [{ text: '🏠 Main Menu', data: 'menu_main' }],
              ],
            });
            return;
          }

          const quotaMsg = rate.isUnlimited
            ? '👑 _Admin Unlimited Access_'
            : `📊 _Daily Requests: ${rate.used}/3 used (${rate.remaining} remaining today | Resets at 00:00 UTC in ${rate.timeUntilReset})_`;

          const cleanFileName = sanitizeBookFileName(book.fileName, book.title, book.author);

          res.json({
            text: `📖 *${book.title}* [Legal Repository File Delivered]\n\n` +
              `📄 Document: \`${cleanFileName}\`\n\n` +
              `⏳ *SELF-DESTRUCT TIMER ACTIVATED (2 MINUTES)* ⏳\n` +
              `⚠️ *Notice:* This file will be *automatically deleted from this chat in exactly 2 minutes* (120 seconds)!\n\n` +
              `📲 *HOW TO KEEP THIS FILE PERMANENTLY:*\n` +
              `👉 *Forward this file to your "Saved Messages" right now!*\n` +
              `_Once forwarded to your Saved Messages, it will stay in your personal Telegram account forever._\n\n` +
              `${quotaMsg}`,
            buttons: [
              [{ text: '⭐ Save to Reading List', data: `add_list_${book.id}` }],
              [{ text: '🏠 Main Menu', data: 'menu_main' }]
            ],
            autoDeleteSeconds: 120,
            bookTitle: book.title,
            fileName: cleanFileName,
          });
          return;
        } else {
          res.json({
            text: `⚖️ *Legitimate Access & Copyright Notice*\n\n*${book.title}* by ${book.author} is protected by copyright.\n\nAuthorized links:\n• Purchase: ${book.externalPurchaseUrl || 'Author website'}\n• Library: ${book.externalLibraryUrl || 'OpenLibrary'}`,
            buttons: [[{ text: '⭐ Save to Reading List', data: `add_list_${book.id}` }], [{ text: '🏠 Main Menu', data: 'menu_main' }]],
          });
          return;
        }
      }

      if (callbackData.startsWith('add_list_')) {
        const bookId = callbackData.replace('add_list_', '');
        store.addToReadingList(userId, bookId);
        const book = store.getBookById(bookId);
        res.json({
          text: `⭐ Added *"${book?.title}"* to your reading list!`,
          buttons: [[{ text: '📚 View Reading List', data: 'menu_reading_list' }], [{ text: '🏠 Main Menu', data: 'menu_main' }]],
        });
        return;
      }

      if (callbackData === 'menu_reading_list') {
        const books = store.getReadingList(userId);
        res.json({
          text: books.length > 0 ? `📚 *Your Reading List (${books.length} saved titles)*:` : `📚 Your reading list is currently empty.`,
          buttons: [
            ...books.map((b) => [{ text: `📖 ${b.title}`, data: `book_${b.id}` }]),
            [{ text: '🏠 Main Menu', data: 'menu_main' }],
          ],
        });
        return;
      }

      if (callbackData === 'menu_valuation') {
        res.json({
          text: `📈 *BusiMind Wealth & Valuation Lab*\n\n` +
            `Dual Valuation Engine combining *Discounted Cash Flow (DCF)* with *Benjamin Graham* and *Peter Lynch* intrinsic value models.\n\n` +
            `Select a market asset below to run instant institutional analysis, or send \`/analyze <symbol>\` (e.g. \`/analyze MTNGH\` or \`/analyze NVDA\`):\n\n` +
            `🇬🇭 *Ghana Stock Exchange (GSE):*\n` +
            `• *MTNGH* (MTN Ghana) • *GCB* (GCB Bank)\n` +
            `• *TOTAL* (TotalEnergies) • *SCB* (Standard Chartered)\n\n` +
            `🌐 *Global Markets & ETFs:*\n` +
            `• *NVDA* (NVIDIA) • *VOO* (Vanguard S&P 500)\n` +
            `• *AAPL* (Apple) • *MSFT* (Microsoft)`,
          buttons: [
            [
              { text: '🇬🇭 Analyze MTNGH', data: 'val_MTNGH' },
              { text: '🇬🇭 Analyze GCB', data: 'val_GCB' },
            ],
            [
              { text: '🇬🇭 Analyze TOTAL', data: 'val_TOTAL' },
              { text: '🌐 Analyze NVDA', data: 'val_NVDA' },
            ],
            [
              { text: '🌐 Analyze VOO ETF', data: 'val_VOO' },
              { text: '🌐 Analyze AAPL', data: 'val_AAPL' },
            ],
            [{ text: '🏠 Main Menu', data: 'menu_main' }],
          ],
        });
        return;
      }

      if (callbackData.startsWith('val_')) {
        const sym = callbackData.replace('val_', '');
        const quote = await marketDataService.getQuote(sym);
        const val = await valuationEngine.analyzeAsset(quote);

        const summaryText =
          `📊 *Valuation Report: ${quote.name} (${quote.symbol})*\n` +
          `🏢 Exchange: ${quote.exchange}\n` +
          `💵 Market Price: *${quote.currency} ${quote.price.toFixed(2)}*\n\n` +
          `📐 *DUAL VALUATION FOOTBALL FIELD:*\n` +
          `• *Intrinsic DCF Value:* ${quote.currency} ${val.dcf.intrinsicValue.toFixed(2)} (${val.dcf.marginOfSafetyPercent >= 0 ? '+' : ''}${val.dcf.marginOfSafetyPercent}%)\n` +
          (val.multiples.grahamNumber ? `• *Benjamin Graham Number:* ${quote.currency} ${val.multiples.grahamNumber.toFixed(2)} (${val.multiples.grahamMarginPercent}%\n` : '') +
          (val.multiples.peterLynchFairValue ? `• *Peter Lynch Fair Value:* ${quote.currency} ${val.multiples.peterLynchFairValue.toFixed(2)}\n` : '') +
          `• *Synthesized Fair Value:* *${quote.currency} ${val.synthesizedFairValue.toFixed(2)}*\n` +
          `🎯 *Verdict:* \`${val.institutionalVerdict}\` (Safety Margin: ${val.synthesizedMarginOfSafety >= 0 ? '+' : ''}${val.synthesizedMarginOfSafety}%)\n\n` +
          `🧠 *Grounded Book Principles Applied:*\n` +
          val.appliedMentalModels.slice(0, 2).map((m) => `• _"${m.bookTitle}"_ (${m.author}): ${m.modelName}`).join('\n') +
          `\n\n💡 *AI Executive Synthesis:*\n${val.aiExecutiveSummary}`;

        res.json({
          text: summaryText,
          buttons: [
            [{ text: '📈 Valuation Lab (Web View)', data: 'menu_valuation' }],
            [{ text: '🏠 Main Menu', data: 'menu_main' }],
          ],
        });
        return;
      }
    }

    // Handle incoming text
    const query = (text || '').trim();

    if (query === '/limit' || query === '/allowance' || query === '/quota') {
      const usage = store.getDailyUsage(userId);
      res.json({
        text: `📊 *Your Daily Request Allowance:*\n\n` +
          `• *Used Today:* ${usage.used} / ${usage.limit} requests\n` +
          `• *Remaining:* ${usage.remaining} requests\n` +
          `• *Next Reset:* Midnight 00:00 UTC (in \`${usage.timeUntilReset}\`)\n\n` +
          `Each day you receive 3 requests to pull books and resources directly from the private repository. Unused requests do not roll over.\n\n` +
          `_Tip: Browsing summaries, reading lists, and key takeaways does not consume your daily requests!_`,
        buttons: [
          [{ text: '📚 Browse Categories', data: 'menu_categories' }],
          [{ text: '⭐ Reading List', data: 'menu_reading_list' }],
          [{ text: '🏠 Main Menu', data: 'menu_main' }],
        ],
      });
      return;
    }

    if (query === '/start') {
      const usage = store.getDailyUsage(userId);
      res.json({
        text: `*BusiMind*\n\nYour personal guide to business knowledge.\n\n📊 *Daily Allowance:* ${usage.remaining}/3 requests left today (resets at 00:00 UTC)\n\nTell me what you want to learn, discover hand-curated business classics, or choose a category below:`,
        buttons: [
          [{ text: '🔎 Find a Book', data: 'menu_find' }, { text: '🏆 Best Business Books', data: 'menu_best' }],
          [{ text: '🚀 Entrepreneurship', data: 'cat_entrepreneurship' }, { text: '💰 Money & Investing', data: 'cat_investing' }],
          [{ text: '👔 Leadership & Management', data: 'cat_leadership' }, { text: '📣 Marketing & Sales', data: 'cat_marketing' }],
          [{ text: '🧠 Mindset & Psychology', data: 'cat_mindset' }, { text: '📊 Finance & Economics', data: 'cat_finance' }],
          [{ text: '📈 Wealth & Valuation Lab', data: 'menu_valuation' }, { text: '🤖 Ask BusiMind', data: 'menu_ask_ai' }],
          [{ text: '📚 Reading List', data: 'menu_reading_list' }, { text: `⏳ Limit: ${usage.remaining}/3 left`, data: 'menu_limit' }],
        ],
      });
      return;
    }

    // Financial Query (Unified Multi-Step Financial Intelligence Engine)
    const isFin = (q: string) => {
      const lower = q.toLowerCase();
      const kws = [
        'analyze', 'valuation', 'dcf', 'margin of safety', 'intrinsic', 'graham', 'lynch',
        'damodaran', 'moat', '7 powers', 'pe ratio', 'dividend', 'yield', 'roe', 'eps',
        'cedi', 'inflation', 'treasury bill', 't-bill', 'bog', 'bank of ghana', 'gse',
        'ghana stock', 'portfolio', 'paper trade', 'buy ', 'sell ', 'shares of', 'rsi',
        'macd', 'moving average', 'technical', 'support', 'resistance', 'stress test',
        'undervalued', 'overvalued', 'fair value', 'screener', 'screen', 'compare',
        'mtn', 'mtngh', 'gcb', 'total', 'scb', 'nvda', 'voo', 'aapl', 'msft', 'goil',
        'teach me investing', 'investing from zero', 'thesis', 'journal', '/markets'
      ];
      return kws.some((kw) => lower.includes(kw));
    };

    if (isFin(query)) {
      const resp = await financialAgentRouter.handleFinancialQuery(query, userId);
      res.json({
        text: resp.text,
        buttons: resp.buttons,
        confidenceScore: resp.confidenceScore,
        sources: resp.sources,
      });
      return;
    }

    if (query.toLowerCase().includes('reading path') || query.startsWith('/path')) {
      const goal = query.replace('/path', '').replace(/reading path (for|on)?/i, '').trim() || 'General Business Mastery';
      const steps = await generateReadingPath(goal, store.getAllBooks());

      let output = `🗺 *YOUR BUSINESS READING PATH*\nGoal: _"${goal}"_\n\n`;
      steps.forEach((s) => {
        output += `*${String(s.stepNumber).padStart(2, '0')} — ${s.phase.toUpperCase()}*\n📘 *${s.book.title}* by ${s.book.author}\n_${s.rationale}_\n\n`;
      });

      res.json({
        text: output,
        buttons: [
          ...steps.map((s) => [{ text: `Step ${s.stepNumber}: ${s.book.title}`, data: `book_${s.book.id}` }]),
          [{ text: '🏠 Main Menu', data: 'menu_main' }],
        ],
      });
      return;
    }

    // 1. Direct check: Title or Author in catalog
    const directMatch = store.findBookByTitleOrAuthor(query);

    if (directMatch) {
      const { matchedBook, matchType, relatedBooks } = directMatch;

      // If matched by author with multiple books, show author collection
      if (matchType === 'author_match' && relatedBooks && relatedBooks.length > 1) {
        store.logSearch(query, 'author_direct', relatedBooks.length);
        const text = `✍️ *Author Found:* *${matchedBook.author}*\n\nFound *${relatedBooks.length} titles* by ${matchedBook.author} in our library repository:\n\n` +
          relatedBooks.map((b, i) => `${i + 1}. *${b.title}* (${b.category})`).join('\n') +
          `\n\n_Select any book below to view executive takeaways and access options:_`;

        res.json({
          text,
          buttons: [
            ...relatedBooks.map((b) => [{ text: `📖 ${b.title}`, data: `book_${b.id}` }]),
            [{ text: '🏠 Main Menu', data: 'menu_main' }],
          ],
        });
        return;
      }

      // Single or direct title match: Bring up full book card immediately!
      store.logSearch(query, 'direct_match', 1);
      const helps = getBookHelpExplanation(matchedBook);
      const takeaways = getBookKeyTakeaways(matchedBook);
      const usage = store.getDailyUsage(userId);
      const quotaNote = usage.isUnlimited
        ? '👑 _Admin: Unlimited Access_'
        : `📊 _Allowance: ${usage.remaining}/3 left today (resets 00:00 UTC)_`;

      res.json({
        text: `*${matchedBook.title.toUpperCase()}*\n✍️ *Author:* ${matchedBook.author}\n📂 *Category:* ${matchedBook.category} (${matchedBook.subcategory || 'General'})\n📊 *Difficulty:* ${matchedBook.difficulty.toUpperCase()} | *Published:* ${matchedBook.publicationYear}\n📜 *Access Model:* ${matchedBook.distributionType === 'telegram_repository' ? '📖 Legal Repository' : '⚖️ Copyrighted'}\n\n🚀 *How This Helps You (Practical ROI):*\n${helps}\n\n🔑 *Key Takeaways:*\n${takeaways.map((t) => `• ${t}`).join('\n')}\n\n📝 *Executive Overview:*\n${matchedBook.description}\n\n💡 *Why Recommended:*\n${matchedBook.whyRecommended}\n\n🎯 *Best Suited For:*\n${matchedBook.bestFor}\n\n${quotaNote}`,
        buttons: [
          [
            { text: matchedBook.distributionType === 'telegram_repository' ? '📖 Get Book (Repository)' : '🔗 Legitimate Access Options', data: `get_book_${matchedBook.id}` },
            { text: '⭐ Add to Reading List', data: `add_list_${matchedBook.id}` },
          ],
          [
            { text: '🤖 Ask About This Book', data: `ask_book_${matchedBook.id}` },
            { text: '🔎 Similar Books', data: `sim_book_${matchedBook.id}` },
          ],
          [{ text: '🏠 Main Menu', data: 'menu_main' }],
        ],
      });
      return;
    }

    // 2. Intelligent Conversational Agent: handles natural conversations, romance inquiries, off-catalog verification & wishlist
    const allBooks = store.getAllBooks();
    const convResp = await handleUserMessage(query, userId, allBooks);
    res.json({
      text: convResp.text,
      photoUrl: convResp.photoUrl,
      candidates: convResp.candidates,
      buttons: convResp.buttons,
    });
    return;
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Simulation error' });
  }
});
