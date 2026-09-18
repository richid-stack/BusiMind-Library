import { GoogleGenAI } from '@google/genai';
import { safeGenerateContent } from '../utils/geminiHelper';
import { store } from '../data/store';
import { Book, BookRequest } from '../../src/types';
import {
  searchExternalBookCandidates,
  ExternalBookCandidate,
} from './coverResolver';

export interface ConversationalResponse {
  type: 'conversation' | 'catalog_match' | 'off_catalog_clarification' | 'wishlist_view' | 'wishlist_added';
  text: string;
  photoUrl?: string;
  candidates?: ExternalBookCandidate[];
  catalogBook?: Book;
  buttons?: { text: string; data: string }[][];
}

// Temporary in-memory cache for pending clarifications per user
const pendingClarifications = new Map<string, ExternalBookCandidate[]>();

export function storePendingCandidates(userId: string | number, candidates: ExternalBookCandidate[]) {
  pendingClarifications.set(String(userId), candidates);
}

export function getPendingCandidate(userId: string | number, index: number): ExternalBookCandidate | undefined {
  const list = pendingClarifications.get(String(userId));
  return list ? list[index] : undefined;
}

function getGenAI(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey.trim() === '') return null;
  return new GoogleGenAI({ apiKey });
}

// Non-business genre keywords to recognize
const NON_BUSINESS_GENRES = [
  'romance',
  'romantic',
  'fiction',
  'fantasy',
  'sci-fi',
  'science fiction',
  'thriller',
  'mystery',
  'horror',
  'comic',
  'manga',
  'anime',
  'poetry',
  'ya',
  'young adult',
  'erotica',
];

export interface IntentEvaluation {
  intent: 'GREETING_OR_CHITCHAT' | 'USER_CORRECTION' | 'GENRE_CHAT' | 'BOOK_SEARCH' | 'FINANCIAL_ANALYSIS' | 'GENERAL_BUSINESS_QUESTION' | 'UNKNOWN';
  isBookSearch: boolean;
  cleanBookTitle?: string;
  cleanAuthor?: string;
  reply?: string;
}

export async function evaluateIntentWithLLM(query: string): Promise<IntentEvaluation> {
  const cleanQ = query.trim();
  const lower = cleanQ.toLowerCase();

  // Fast heuristic detection for fillers and hesitation ("uhmmm", "hmm", etc.)
  if (/^(uh+|um+|hmm+|er+|ah+|well|let me see|thinking)/i.test(lower)) {
    return {
      intent: 'GREETING_OR_CHITCHAT',
      isBookSearch: false,
      reply: `Take your time! Whenever you're ready, let me know what book, business concept, or financial valuation you'd like to explore.`
    };
  }

  // Fast heuristic detection for casual greetings & "what are you doing" / "how are you"
  if (/^(hi|hello|hey|hey\s+buddy|yo|greetings|good\s+(morning|afternoon|evening)|howdy|sup)\b/i.test(lower)) {
    return {
      intent: 'GREETING_OR_CHITCHAT',
      isBookSearch: false,
      reply: `👋 **Hello!** I'm BusiMind, your private executive library curator and business intelligence partner.\n\nLooking to find a specific book, browse our 190+ curated titles, or analyze a market valuation?`
    };
  }

  // Fast heuristic detection for "what are you doing" / "what's up" / "how are you doing"
  if (/^(what are you doing|what're you doing|what r u doing|what are u doing|what you doing|how are you|how're you doing|what's up|wassup|how is it going)/i.test(lower)) {
    return {
      intent: 'GREETING_OR_CHITCHAT',
      isBookSearch: false,
      reply: `I'm actively curating executive business literature, running financial valuation models, and managing private reading paths for our members!\n\nAre you looking to dive into a specific business topic, explore our library catalog, or run a financial analysis today?`
    };
  }

  // Fast heuristic detection for "who are you" / "what can you do"
  if (/^(who are you|what is your name|who made you|what can you do|help me|tell me about yourself)/i.test(lower)) {
    return {
      intent: 'GREETING_OR_CHITCHAT',
      isBookSearch: false,
      reply: `👋 **I am BusiMind**, your executive knowledge partner and private business library curator.\n\nI can help you:\n• **Find & deliver books** from our curated repository (190+ titles in Finance, Strategy, Leadership, and Investing).\n• **Conduct institutional valuations** (DCF, Graham Margin of Safety, Peter Lynch Fair Value).\n• **Structure personalized reading paths** for your career and investment goals.\n\nWhat would you like to explore today?`
    };
  }

  const ai = getGenAI();

  if (!ai && !process.env.GROQ_API_KEY) {
    throw new Error('AI client is null and no Groq key is provided');
  }

  const prompt = `You are BusiMind AI, an elite executive business library curator and knowledge assistant.
Analyze this user query: "${cleanQ}"

Determine:
1. Is the user just talking, asking a question, making small talk, or asking what you are doing? (e.g. "what are you doing", "how do you work", "give me advice on pricing", "who made you", "tell me a business tip", "stop giving me books").
   -> If YES: intent is "GREETING_OR_CHITCHAT" or "USER_CORRECTION" or "GENERAL_BUSINESS_QUESTION". "isBookSearch" MUST be false.
   -> Provide a concise, engaging, executive, and witty "reply" (under 90 words). DO NOT treat it as a book title.

2. Is the user actually searching for a specific book title or author? (e.g. "Zero to One", "7 Powers", "The Lean Startup", "Good to Great", "Shoe Dog by Phil Knight", "books by Ray Dalio", "The Intelligent Investor", "Thinking Fast and Slow").
   -> If YES: intent is "BOOK_SEARCH". "isBookSearch" is true. "cleanBookTitle" is the title or author. "reply" is null.

3. Is the user asking for financial analysis/valuation? (e.g. "DCF for AAPL", "PE ratio of MTNGH", "valuation of Tesla").
   -> intent is "FINANCIAL_ANALYSIS". "isBookSearch" is false.

Return ONLY valid JSON matching:
{
  "intent": "GREETING_OR_CHITCHAT" | "USER_CORRECTION" | "GENRE_CHAT" | "BOOK_SEARCH" | "FINANCIAL_ANALYSIS" | "GENERAL_BUSINESS_QUESTION",
  "isBookSearch": boolean,
  "cleanBookTitle": string | null,
  "cleanAuthor": string | null,
  "reply": string | null
}`;

  try {
    const res = await safeGenerateContent(ai!, {
      model: 'gemini-3.6-flash',
      contents: prompt,
      config: { responseMimeType: 'application/json' }
    });
    const data = JSON.parse(res.text || '{}');
    return {
      intent: data.intent || 'GREETING_OR_CHITCHAT',
      isBookSearch: Boolean(data.isBookSearch),
      cleanBookTitle: data.cleanBookTitle || undefined,
      cleanAuthor: data.cleanAuthor || undefined,
      reply: data.reply || undefined,
    };
  } catch (e) {
    console.warn('[Intent] LLM Intent fallback to heuristic classifier:', (e as any)?.message || e);
    if (NON_BUSINESS_GENRES.some((g) => lower.includes(g))) {
      return { intent: 'GENRE_CHAT', isBookSearch: false };
    }
    if (/\b(dcf|pe ratio|wacc|valuation|margin of safety|intrinsic value|ghana stock|gse)\b/i.test(lower)) {
      return { intent: 'FINANCIAL_ANALYSIS', isBookSearch: false };
    }
    // Only treat as book search if it contains book-like indicators
    if (lower.includes('book') || lower.includes('read') || lower.includes('author') || lower.includes('by ')) {
      return { intent: 'BOOK_SEARCH', isBookSearch: true, cleanBookTitle: cleanQ };
    }
    return {
      intent: 'GREETING_OR_CHITCHAT',
      isBookSearch: false,
      reply: 'I am here to assist with business knowledge, book curation, and financial valuation! What would you like to explore today?'
    };
  }
}

/**
 * Checks whether a query is asking conversationally about non-business genres or small talk.
 */
function checkConversationalQuery(query: string): { isConversation: boolean; topic?: string } {
  const lower = query.toLowerCase().trim();

  // Explicit questions like "are there romance novels?", "do you have fantasy books?", "got any fiction?"
  for (const genre of NON_BUSINESS_GENRES) {
    if (
      lower.includes(genre) &&
      (lower.includes('are there') ||
        lower.includes('do you have') ||
        lower.includes('got any') ||
        lower.includes('any ') ||
        lower.includes('novels') ||
        lower.includes('what about') ||
        lower.includes('is there') ||
        lower.startsWith('so ') ||
        lower.endsWith('?'))
    ) {
      return { isConversation: true, topic: genre };
    }
  }

  // Greetings, fillers, & casual dialogue
  if (
    /^(hi|hello|hey|yo|greetings|good\s+(morning|afternoon|evening)|howdy|sup|how are you|who are you|what is your name|who made you|what can you do|tell me about yourself|uh+|um+|hmm+|er+|ah+|haha|lol|ok|okay|cool|nice|thanks|thank you|wow|yes|no|help|info|what is this|who is this)/i.test(
      lower
    )
  ) {
    return { isConversation: true, topic: 'greeting' };
  }

  // Conversational questions or inquiries that are NOT specific book titles
  if (
    lower.includes('why read') ||
    lower.includes('how does busimind work') ||
    lower.includes('tell me a joke') ||
    lower.includes('tell me a story') ||
    lower.includes('what should i read') ||
    lower.includes('recommend something') ||
    lower.includes('how are you') ||
    lower.startsWith('what is ') ||
    lower.startsWith('how to ') ||
    lower.startsWith('why do ') ||
    lower.endsWith('?')
  ) {
    // If it's a short question or clearly conversational
    if (!looksLikeBookTitleOrRequest(query)) {
      return { isConversation: true, topic: 'chat' };
    }
  }

  return { isConversation: false };
}

/**
 * Evaluates whether a string looks like a specific book title or request.
 */
function looksLikeBookTitleOrRequest(query: string): boolean {
  const lower = query.toLowerCase().trim();
  if (lower.startsWith('/request') || lower.startsWith('request ') || lower.startsWith('add ')) {
    return true;
  }
  // If it mentions "by <author>" or has quotes
  if (lower.includes(' by ') || /"([^"]+)"/.test(query) || /'([^']+)'/.test(query)) {
    return true;
  }
  // Title-like length and not a long chat sentence
  const words = lower.split(/\s+/);
  if (words.length >= 2 && words.length <= 7 && !lower.includes('?') && !lower.includes('how') && !lower.includes('what')) {
    return true;
  }
  return false;
}

/**
 * Primary Conversational Agent logic
 */
export async function handleUserMessage(
  userQuery: string,
  userId: string | number,
  availableBooks: Book[],
  isExplicitBookSearch?: boolean
): Promise<ConversationalResponse> {
  const q = userQuery.trim();
  const lower = q.toLowerCase();

  // 1. Check if user is asking to see or manage their Wishlist
  if (lower === '/wishlist' || lower === 'wishlist' || lower === 'my wishlist' || lower === 'show wishlist') {
    return handleViewWishlist(userId);
  }

  // 2. Check for manual /request command
  if (lower.startsWith('/request') || lower.startsWith('request:')) {
    const rawTitle = q.replace(/^\/(request|req)[:\s]*/i, '').trim();
    if (!rawTitle) {
      return {
        type: 'conversation',
        text: `📝 *Manual Wishlist Request*\n\nTo request any volume, tell me the title and author:\nExample: \`/request Zero to One by Peter Thiel\`\n\nOr simply type the title directly into this chat!`,
        buttons: [
          [{ text: '📋 View My Wishlist', data: 'menu_wishlist' }],
          [{ text: '🏠 Main Menu', data: 'menu_start' }],
        ],
      };
    }
    return handleBookClarificationAndWishlist(rawTitle, userId, availableBooks);
  }

  // 3. Check for Direct Catalog Matches (Exact or close title/author in BusiMind)
  const exactMatch = availableBooks.find(
    (b) =>
      b.title.toLowerCase() === lower ||
      lower.includes(b.title.toLowerCase()) ||
      (b.title.length > 5 && lower.includes(b.title.toLowerCase().slice(0, -2)))
  );

  if (exactMatch && !lower.includes('not in') && !lower.includes('similar')) {
    return {
      type: 'catalog_match',
      catalogBook: exactMatch,
      text: `📗 *Found in BusiMind Repository!*\n\n**${exactMatch.title}**\nby ${exactMatch.author}\n\n🏷️ *Category:* ${exactMatch.category} • *Level:* ${exactMatch.difficulty}\n\n💡 *Why Recommended:* ${exactMatch.whyRecommended}\n\n⚡ *Instant 2-Minute Bot Delivery Available:*`,
      buttons: [
        [{ text: `📥 Read/Get "${exactMatch.title.slice(0, 22)}..."`, data: `book_${exactMatch.id}` }],
        [{ text: '📑 Add to Reading List', data: `add_list_${exactMatch.id}` }],
        [{ text: '🏠 Main Menu', data: 'menu_start' }],
      ],
    };
  }

  // If this was explicitly evaluated as NOT a book search, answer conversationally!
  if (isExplicitBookSearch === false) {
    return handleGeneralConversation(q, availableBooks);
  }

  // 4. Conversational & Non-Business Inquiries (e.g. "so are there romance novels?")
  const convCheck = checkConversationalQuery(q);
  if (convCheck.isConversation) {
    if (convCheck.topic && NON_BUSINESS_GENRES.includes(convCheck.topic)) {
      return handleNonBusinessGenreConversation(convCheck.topic, availableBooks);
    }
    return handleGeneralConversation(q, availableBooks);
  }

  // If it doesn't look like a book title or request, do NOT call external book search
  if (!isExplicitBookSearch && !looksLikeBookTitleOrRequest(q)) {
    return handleGeneralConversation(q, availableBooks);
  }

  // 5. Intelligent External Discovery & Wishlist Verification
  // The user might be naming a book not in our local library
  const candidates = await searchExternalBookCandidates(q, 3);

  if (candidates.length > 0) {
    storePendingCandidates(userId, candidates);
    const top = candidates[0];

    // Check if the book genre is Romance/Fiction
    const isRomanceOrFiction =
      NON_BUSINESS_GENRES.some((g) => top.genre?.toLowerCase().includes(g)) ||
      /fiction|romance|poetry|drama|novel/i.test(top.genre || '');

    if (isRomanceOrFiction) {
      return {
        type: 'off_catalog_clarification',
        photoUrl: top.coverImageUrl,
        candidates,
        text: `📖 *External Volume Identified:* **${top.title}**\nby ${top.author}${top.publishedYear ? ` (${top.publishedYear})` : ''}\n\n🏷️ *Detected Genre:* **${top.genre || 'Fiction / Novel'}**\n\n🏛️ *BusiMind Curation Perspective:*\nBusiMind is engineered exclusively for business architecture, high-finance, startup scaling, investing, and executive leadership. Because *${top.title}* is a fiction/romance novel, it falls outside our standard business vault.\n\n*Would you still like our curation team to log this to your personal Wishlist?*`,
        buttons: [
          [{ text: `⭐ Log "${top.title.slice(0, 24)}" to Wishlist`, data: `confirm_wishlist_0` }],
          [{ text: '💡 Show Gripping Business Narratives', data: 'recommend_narrative' }],
          [{ text: '🏠 Main Menu', data: 'menu_start' }],
        ],
      };
    }

    // It's a genuine business, finance, or leadership title not in our library!
    const similarBooks = availableBooks
      .filter((b) => b.category.toLowerCase().includes('entrepreneurship') || b.category.toLowerCase().includes('finance'))
      .slice(0, 2);

    const altText = similarBooks.length > 0
      ? `\n\n*In the meantime, similar high-impact titles in our library:*` +
        similarBooks.map((b) => `\n• *${b.title}* by ${b.author}`).join('')
      : '';

    return {
      type: 'off_catalog_clarification',
      photoUrl: top.coverImageUrl,
      candidates,
      text: `📘 *We found:* **${top.title}**\nby ${top.author}${top.publishedYear ? ` (${top.publishedYear})` : ''}\n🏷️ *Category:* ${top.genre || 'Business & Economics'}\n\nWe don't currently have this volume uploaded in our private channel library yet.${altText}\n\n*Would you like to log this to our Wishlist so our curators acquire and upload it for you?*`,
      buttons: [
        [{ text: `⭐ Confirm: Add to Wishlist`, data: `confirm_wishlist_0` }],
        ...(candidates.length > 1
          ? [[{ text: `👉 Or did you mean: ${candidates[1].title.slice(0, 24)}?`, data: `confirm_wishlist_1` }]]
          : []),
        [{ text: '🔍 Search Our Available Catalog', data: 'menu_catalog' }],
        [{ text: '🏠 Main Menu', data: 'menu_start' }],
      ],
    };
  }

  // 6. Fallback: Gemini AI Conversational Assistant
  return handleGeneralConversation(q, availableBooks);
}

/**
 * Handles conversational queries specifically about non-business genres (like romance)
 */
function handleNonBusinessGenreConversation(genre: string, availableBooks: Book[]): ConversationalResponse {
  const narrativeBook =
    availableBooks.find((b) => b.title.toLowerCase().includes('shoe') || b.title.toLowerCase().includes('blood')) ||
    availableBooks[0];

  const capitalizedGenre = genre.charAt(0).toUpperCase() + genre.slice(1);

  return {
    type: 'conversation',
    text: `Haha, good question! 📚\n\n**BusiMind** is strictly curated for high-leverage business thinkers, tech founders, finance analysts, and leadership executives—so you won't find Colleen Hoover, *The Notebook*, or ${capitalizedGenre} novels on our main shelves!\n\nHowever, if you enjoy emotional depth, high-stakes conflict, and intense human drama, books like **Shoe Dog** (Phil Knight's obsessive journey building Nike) or **Bad Blood** (the Silicon Valley thriller) read with all the passion and suspense of a bestselling novel.\n\nWould you like to check out a gripping business memoir, explore our curated shelves, or submit a custom title to your Wishlist?`,
    buttons: [
      ...(narrativeBook
        ? [[{ text: `📖 Check Out "${narrativeBook.title}"`, data: `book_${narrativeBook.id}` }]]
        : []),
      [
        { text: '🔍 Browse Business Shelves', data: 'menu_catalog' },
        { text: '📝 Request a Book / Wishlist', data: 'menu_wishlist' },
      ],
      [{ text: '🏠 Main Menu', data: 'menu_start' }],
    ],
  };
}

/**
 * Handles general conversations, greetings, and helpful guidance with Gemini AI
 */
async function handleGeneralConversation(query: string, availableBooks: Book[]): Promise<ConversationalResponse> {
  const ai = getGenAI();

  if (!ai) {
    return {
      type: 'conversation',
      text: `👋 Hello! I'm the **BusiMind Curation Agent**.\n\nI can help you:\n• Find executive business books in our private vault\n• Discover reading paths for investing, management, and startups\n• Request new books for our curators to acquire\n\nWhat would you like to explore today?`,
      buttons: [
        [{ text: '📚 Browse Full Catalog', data: 'menu_catalog' }],
        [{ text: '📋 View Wishlist & Requests', data: 'menu_wishlist' }],
        [{ text: '📊 Financial Intelligence', data: 'menu_finance' }],
      ],
    };
  }

  const catalogSummary = availableBooks.slice(0, 10).map((b) => `• "${b.title}" by ${b.author} (${b.category})`).join('\n');

  try {
    const response = await safeGenerateContent(ai, {
      model: 'gemini-3.8-flash',
      contents: [
        {
          role: 'user',
          parts: [
            {
              text: `You are the witty, deeply knowledgeable, and warm AI host of "BusiMind Library", a premier private repository of business, finance, leadership, economics, and psychology books.
The user said: "${query}"

Available sample books in library:
${catalogSummary}

Respond naturally, conversationally, and concisely (under 100 words). Answer warmly and intelligently like a knowledgeable business advisor.
CRITICAL: NEVER start with "Hello! I am BusiMind..." or repeat an unrequested self-introduction. Directly respond to what the user said.`,
            },
          ],
        },
      ],
      config: {
        temperature: 0.7,
      },
    });

    const reply = response.text?.trim() || `What's on your mind? Looking for a specific business book, financial valuation, or reading recommendation?`;

    return {
      type: 'conversation',
      text: reply,
      buttons: [
        [{ text: '📚 Browse Catalog', data: 'menu_catalog' }],
        [{ text: '📝 Request a Book', data: 'menu_request_prompt' }],
        [{ text: '🏠 Main Menu', data: 'menu_start' }],
      ],
    };
  } catch (err) {
    return {
      type: 'conversation',
      text: `I'm here to help you navigate our curated business repository. Tell me what topic or book title you have in mind!`,
      buttons: [
        [{ text: '📚 Browse Catalog', data: 'menu_catalog' }],
        [{ text: '🏠 Main Menu', data: 'menu_start' }],
      ],
    };
  }
}

/**
 * Handles looking up external candidates and asking the user clarifying questions
 */
export async function handleBookClarificationAndWishlist(
  bookTitleOrQuery: string,
  userId: string | number,
  availableBooks: Book[]
): Promise<ConversationalResponse> {
  const candidates = await searchExternalBookCandidates(bookTitleOrQuery, 3);

  if (candidates.length === 0) {
    // Record raw title directly
    const res = store.recordBookRequest(bookTitleOrQuery, undefined, bookTitleOrQuery, userId);
    return {
      type: 'wishlist_added',
      text: `📝 *Added to Wishlist!*\n\n**"${bookTitleOrQuery}"** has been logged into our curation queue.\nOur curators review requests weekly and will link the volume as soon as it is sourced.`,
      buttons: [
        [{ text: '📋 View My Wishlist', data: 'menu_wishlist' }],
        [{ text: '📚 Browse Catalog', data: 'menu_catalog' }],
        [{ text: '🏠 Main Menu', data: 'menu_start' }],
      ],
    };
  }

  storePendingCandidates(userId, candidates);
  const top = candidates[0];

  return {
    type: 'off_catalog_clarification',
    photoUrl: top.coverImageUrl,
    candidates,
    text: `📘 *We found:* **${top.title}**\nby ${top.author}${top.publishedYear ? ` (${top.publishedYear})` : ''}\n🏷️ *Genre:* ${top.genre || 'General'}\n\n${top.description || ''}\n\n*Would you like to log this title to your BusiMind Wishlist?*`,
    buttons: [
      [{ text: `⭐ Confirm: Add "${top.title.slice(0, 24)}"`, data: `confirm_wishlist_0` }],
      ...(candidates.length > 1
        ? [[{ text: `👉 Select "${candidates[1].title.slice(0, 24)}" instead`, data: `confirm_wishlist_1` }]]
        : []),
      [{ text: '🏠 Main Menu', data: 'menu_start' }],
    ],
  };
}

/**
 * Shows the user their personal wishlist & requests
 */
export function handleViewWishlist(userId: string | number): ConversationalResponse {
  const userRequests = store.getUserBookRequests(userId);
  const pending = userRequests.filter((r) => r.status === 'pending');
  const acquired = userRequests.filter((r) => r.status === 'acquired');

  let text = `📋 *Your BusiMind Wishlist & Requests*\n\n`;

  if (userRequests.length === 0) {
    text += `You have no pending book requests yet.\n\nIf there is any business, finance, or leadership book you'd like our curators to acquire, simply send the title or use \`/request <title>\`!`;
  } else {
    if (pending.length > 0) {
      text += `⏳ *Pending Curation (${pending.length}):*\n`;
      pending.forEach((r, idx) => {
        text += `${idx + 1}. **${r.requestedTitle}**${r.requestedAuthor ? ` by ${r.requestedAuthor}` : ''}${r.genre ? ` _[${r.genre}]_` : ''}\n`;
      });
      text += `\n`;
    }

    if (acquired.length > 0) {
      text += `✅ *Acquired & In Vault (${acquired.length}):*\n`;
      acquired.forEach((r, idx) => {
        text += `• **${r.requestedTitle}** (Available now!)\n`;
      });
      text += `\n`;
    }
  }

  return {
    type: 'wishlist_view',
    text,
    buttons: [
      [{ text: '➕ Request a New Book', data: 'menu_request_prompt' }],
      [{ text: '📚 Browse Current Catalog', data: 'menu_catalog' }],
      [{ text: '🏠 Main Menu', data: 'menu_start' }],
    ],
  };
}

/**
 * Confirms adding a candidate to the user's wishlist
 */
export function handleConfirmWishlistCandidate(
  userId: string | number,
  candidateIndex: number
): ConversationalResponse {
  const candidate = getPendingCandidate(userId, candidateIndex);
  if (!candidate) {
    return {
      type: 'conversation',
      text: `⚠️ No pending book selection found. Please type the title of the book you want to request!`,
      buttons: [
        [{ text: '➕ Request a Book', data: 'menu_request_prompt' }],
        [{ text: '🏠 Main Menu', data: 'menu_start' }],
      ],
    };
  }

  const { request, isNew } = store.recordBookRequest(
    candidate.title,
    candidate.author,
    candidate.title,
    userId,
    undefined,
    candidate.genre,
    {
      genre: candidate.genre,
      coverImageUrl: candidate.coverImageUrl,
      publicationYear: candidate.publishedYear,
    }
  );

  return {
    type: 'wishlist_added',
    photoUrl: candidate.coverImageUrl,
    text: `⭐ **Added to Your BusiMind Wishlist!**\n\n📖 **${candidate.title}**\nby ${candidate.author}${candidate.publishedYear ? ` (${candidate.publishedYear})` : ''}\n🏷️ *Genre:* ${candidate.genre || 'Business'}\n\nOur curation team has received your request (Priority #${request.requestCount}). As soon as this title is sourced and uploaded to our channel, it will be automatically indexed!`,
    buttons: [
      [{ text: '📋 View My Wishlist', data: 'menu_wishlist' }],
      [{ text: '➕ Request Another Book', data: 'menu_request_prompt' }],
      [{ text: '🏠 Main Menu', data: 'menu_start' }],
    ],
  };
}
