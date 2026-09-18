import { Bot, InlineKeyboard, Context, InputFile } from 'grammy';
import { GoogleGenAI, Type } from '@google/genai';
import { db } from '../data/firestoreConfig';
import { doc, setDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { pairingStore } from '../data/pairingStore';
import { store } from '../data/store';
import { searchBooksWithAI, generateReadingPath, askAboutBook, isGeminiAvailable, resolveBookOrIntent } from '../gemini';
import { autoIndexChannelAsset } from '../services/indexer';
import { sanitizeBookFileName, generateDeliveryCaption } from '../services/fileSanitizer';
import { autoDeleteService } from '../services/autoDeleteService';
import { Book } from '../../src/types';
import { safeGenerateContent } from '../utils/geminiHelper';
import { extractPdfSnippetFromFileId } from '../services/pdfExtractor';
import { resolveBookCover } from '../services/coverResolver';
import { marketDataService } from '../services/marketData';
import { valuationEngine } from '../services/valuationEngine';
import { financialAgentRouter } from '../services/financialAgentRouter';
import { portfolioService } from '../services/portfolioService';
import { macroIntelligenceEngine } from '../services/macroIntelligenceEngine';
import { comparisonScreeningEngine } from '../services/comparisonScreeningEngine';
import { academicResearchService } from '../services/academicResearchService';
import {
  handleUserMessage,
  handleConfirmWishlistCandidate,
  handleViewWishlist,
  handleBookClarificationAndWishlist,
  evaluateIntentWithLLM,
} from '../services/conversationalAgent';

const token = process.env.TELEGRAM_BOT_TOKEN;
export const isBotTokenConfigured = Boolean(token && token.trim() !== '' && !token.includes('YOUR_'));

export const bot = isBotTokenConfigured ? new Bot(token!) : null;

if (bot) {
  autoDeleteService.setBot(bot);
}

/**
 * Delivers a book file to the user with the actual Telegram attachment filename
 * rewritten to "[BusiMind] Title - Author.pdf" instead of foreign website tags.
 * Falls back to fast copyMessage if direct upload or fileId stream is unavailable.
 */
async function deliverRenamedBookFile(
  ctx: Context,
  book: Book,
  cleanFileName: string,
  brandedCaption: string,
  channelId: string,
  messageId: number
): Promise<{ message_id: number }> {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;

  // 1. If we have a fileId, stream the bytes through Telegram Bot API getFile
  // and upload with InputFile(buffer, cleanFileName) so Telegram physically stamps the new filename
  if (book.fileId && botToken) {
    try {
      const fileInfo = await ctx.api.getFile(book.fileId);
      if (fileInfo.file_path) {
        const downloadUrl = `https://api.telegram.org/file/bot${botToken}/${fileInfo.file_path}`;
        const fileRes = await fetch(downloadUrl);
        if (fileRes.ok) {
          const arrayBuffer = await fileRes.arrayBuffer();
          const fileBuffer = Buffer.from(arrayBuffer);
          const inputFile = new InputFile(fileBuffer, cleanFileName);

          const docMsg = await ctx.api.sendDocument(ctx.chat!.id, inputFile, {
            caption: brandedCaption,
            parse_mode: 'Markdown',
          });
          return { message_id: docMsg.message_id };
        }
      }
    } catch (streamErr: any) {
      console.warn('[Direct file rename stream failed, falling back to copyMessage]:', streamErr?.message || streamErr);
    }
  }

  // 2. Reliable fallback to copyMessage if direct stream fails or fileId is not yet cached
  return await ctx.api.copyMessage(ctx.chat!.id, channelId, messageId, {
    caption: brandedCaption,
    parse_mode: 'Markdown',
  });
}

/**
 * Resilient Telegram message editor.
 * Automatically strips broken markdown entities if Telegram rejects the payload with 400 Bad Request.
 */
async function safeEditMsg(
  ctx: Context,
  messageId: number | undefined,
  text: string,
  keyboard?: InlineKeyboard
): Promise<void> {
  const chatId = ctx.chat?.id;
  if (!chatId) return;

  if (!messageId) {
    try {
      await ctx.reply(text, { parse_mode: 'Markdown', reply_markup: keyboard });
    } catch {
      const plain = text.replace(/[*_`\[\]()~>#+=|{}.!-]/g, (match) => match === '*' || match === '_' ? '' : match);
      await ctx.reply(plain, { reply_markup: keyboard }).catch(() => {});
    }
    return;
  }

  try {
    await ctx.api.editMessageText(chatId, messageId, text, {
      parse_mode: 'Markdown',
      reply_markup: keyboard,
    });
    return;
  } catch (err: any) {
    const errMsg = err?.message || String(err);
    if (errMsg.includes('message is not modified')) {
      return; // Same content, no action needed
    }

    // If message is a photo, deleted, or markdown parse failed, delete old message and reply cleanly
    try {
      await ctx.api.deleteMessage(chatId, messageId);
    } catch (_) {}

    try {
      await ctx.reply(text, {
        parse_mode: 'Markdown',
        reply_markup: keyboard,
      });
    } catch (fallbackErr: any) {
      const plain = text.replace(/[*_`\[\]()~>#+=|{}.!-]/g, (match) => match === '*' || match === '_' ? '' : match);
      await ctx.reply(plain, {
        reply_markup: keyboard,
      }).catch((e) => console.error('[safeEditMsg catastrophic fallback]:', e));
    }
  }
}

// Track user conversational state for "Ask BusiMind" or search
const userSessionState: Map<number, { action: string; bookId?: string }> = new Map();

// Standard Category Definitions
export const CATEGORY_MAP: Record<string, string> = {
  cat_entrepreneurship: 'Entrepreneurship',
  cat_finance: 'Finance & Economics',
  cat_investing: 'Money & Investing',
  cat_leadership: 'Leadership & Management',
  cat_marketing: 'Marketing & Sales',
  cat_mindset: 'Mindset & Psychology',
  cat_strategy: 'Strategy & Economics',
};

// --- PRACTICAL ROI & KEY TAKEAWAYS HELPERS ---

export function getBookHelpExplanation(book: Book): string {
  if (book.howItHelps && book.howItHelps.trim().length > 0) {
    return book.howItHelps;
  }
  // Category-specific high-impact fallbacks
  switch (book.category) {
    case 'Entrepreneurship':
      return 'Gives you battle-tested frameworks to validate startup ideas, gain early market traction, and avoid burning capital on products customers won’t pay for.';
    case 'Money & Investing':
      return 'Protects your capital by instilling disciplined investing habits, risk management rules, and emotional resilience during volatile market swings.';
    case 'Leadership & Management':
      return 'Elevates your organizational output by teaching you how to run high-leverage 1-on-1s, give candid feedback, and align high-performance teams.';
    case 'Marketing & Sales':
      return 'Sharpens your customer acquisition messaging, conversion mechanics, and ethical persuasion techniques to close higher-ticket deals consistently.';
    case 'Mindset & Psychology':
      return 'Rewires your daily decision-making systems, compounding small productive micro-habits into exponential long-term personal and business results.';
    case 'Finance & Economics':
    case 'Strategy & Economics':
      return 'Demystifies market dynamics, competitive advantages, and strategic diagnosis so you can build defensible moats around your business.';
    default:
      return 'Provides actionable mental models and executive principles to make superior decisions in business and life.';
  }
}

export function getBookKeyTakeaways(book: Book): string[] {
  if (book.keyTakeaways && book.keyTakeaways.length > 0) {
    return book.keyTakeaways;
  }
  return [
    'Focus ruthlessly on highest-leverage priorities.',
    'Systematic iteration outperforms spontaneous guesswork.',
    'Defensible advantages compound steadily over time.',
  ];
}

// --- HELPER KEYBOARDS ---

export function getCategoriesKeyboard(): InlineKeyboard {
  return new InlineKeyboard()
    .text('🚀 Entrepreneurship & Startups', 'cat_entrepreneurship')
    .row()
    .text('💰 Money & Investing', 'cat_investing')
    .row()
    .text('👔 Leadership & Management', 'cat_leadership')
    .row()
    .text('📣 Marketing & Sales', 'cat_marketing')
    .row()
    .text('🏛 Strategy & Business Models', 'cat_strategy')
    .row()
    .text('📊 Finance & Economics', 'cat_finance')
    .row()
    .text('🧠 Mindset & Psychology', 'cat_mindset')
    .row()
    .text('🔎 Search by Title or Author', 'menu_find')
    .text('🏠 Main Menu', 'menu_main');
}

export function getMainMenuKeyboard(userId?: number): InlineKeyboard {
  const usage = userId ? store.getDailyUsage(userId) : null;
  const limitLabel = usage
    ? (usage.isUnlimited ? '👑 Admin (Unlimited)' : `⏳ Limit: ${usage.remaining}/3 left today`)
    : '⏳ Daily Limit (3/day)';

  return new InlineKeyboard()
    .text('🔎 Find a Book', 'menu_find')
    .text('🏆 Best Business Books', 'menu_best')
    .row()
    .text('🚀 Entrepreneurship', 'cat_entrepreneurship')
    .text('💰 Money & Investing', 'cat_investing')
    .row()
    .text('👔 Leadership & Management', 'cat_leadership')
    .text('📣 Marketing & Sales', 'cat_marketing')
    .row()
    .text('🏛 Strategy & Models', 'cat_strategy')
    .text('🧠 Mindset & Habits', 'cat_mindset')
    .row()
    .text('📊 Finance & Economics', 'cat_finance')
    .text('📈 Valuation Lab', 'menu_valuation')
    .row()
    .text('💼 Portfolio & Trade', 'menu_portfolio')
    .text('⚡ Macro Stress-Test', 'stress_test_cedi')
    .row()
    .text('🔗 Link Web Account', 'menu_link_web')
    .text('📚 Reading List', 'menu_reading_list')
    .row()
    .text(limitLabel, 'menu_limit');
}

export function getBookDetailsKeyboard(book: Book, telegramUserId: number): InlineKeyboard {
  const kb = new InlineKeyboard();
  const inList = store.isBookInReadingList(telegramUserId, book.id);

  if (book.distributionType === 'telegram_repository') {
    kb.text('📖 Get Book (2-min Delivery)', `get_book_${book.id}`);
  } else {
    kb.text('🔗 Legitimate Access Options', `get_book_${book.id}`);
  }

  if (inList) {
    kb.text('🗑 Remove from List', `rem_list_${book.id}`);
  } else {
    kb.text('⭐ Add to Reading List', `add_list_${book.id}`);
  }

  kb.row();
  kb.text('🤖 Ask About This Book', `ask_book_${book.id}`);
  kb.text('🔎 Similar Books', `sim_book_${book.id}`);
  kb.row();
  kb.text('⬅️ Back to Categories', 'menu_categories');
  kb.text('🏠 Main Menu', 'menu_main');

  return kb;
}

// --- BOT INITIALIZATION & HANDLERS ---

/**
 * Robust handler for pairing codes and email links from Web UI.
 * Connects Telegram Chat ID to the user's Firestore document and delivers any pending book.
 */
async function handlePairingOrEmailInput(ctx: Context, rawInput: string): Promise<boolean> {
  const input = rawInput.trim();
  const chatIdStr = ctx.from?.id ? String(ctx.from.id) : '';
  const usernameStr = ctx.from?.username || null;
  if (!chatIdStr) return false;

  // 1. Is it a 6-digit pairing code (e.g. "492815" or "p_492815")?
  const cleanCode = input.replace(/^p_/, '').replace(/-/g, '').trim();
  if (/^\d{6}$/.test(cleanCode)) {
    const pairing = pairingStore.consumePairing(cleanCode);
    if (pairing) {
      try {
        // Enforce 1-to-1 mapping: Disconnect any other user accounts currently bound to this Telegram account
        try {
          const conflictQuery = query(collection(db, 'users'), where('telegramChatId', '==', chatIdStr));
          const conflictSnaps = await getDocs(conflictQuery);
          for (const conflictDoc of conflictSnaps.docs) {
            if (conflictDoc.id !== pairing.uid) {
              await setDoc(conflictDoc.ref, {
                telegramChatId: null,
                telegramUsername: null,
                unlinkedAt: new Date().toISOString(),
                unlinkReason: 'relinked_to_another_account',
              }, { merge: true });
            }
          }
        } catch (unifyErr: any) {
          console.warn('[Pairing 1-to-1 conflict check error]:', unifyErr?.message || unifyErr);
        }

        await setDoc(doc(db, 'users', pairing.uid), {
          telegramChatId: chatIdStr,
          telegramUsername: usernameStr,
          updatedAt: new Date().toISOString(),
        }, { merge: true });

        await ctx.reply(
          `✅ *BusiMind Web Profile Connected!*\n\n` +
          `Your Telegram account has been linked to your BusiMind Web session!\n\n` +
          `🆔 *Your Chat ID:* \`${chatIdStr}\`\n\n` +
          (pairing.bookId ? `🚀 Delivering your requested volume immediately...` : `Any books you request on the website will now arrive straight here!`),
          { parse_mode: 'Markdown' }
        );

        if (pairing.bookId) {
          const book = store.getBookById(pairing.bookId);
          if (book && ctx.from?.id) {
            const usage = store.getDailyUsage(ctx.from.id);
            if (!usage.isUnlimited && usage.remaining <= 0) {
              await ctx.reply(
                `⏳ *Daily Limit Reached (3 of 3 requests)*\n\n` +
                `You have already utilized your 3 free book requests for today.\n\n` +
                `🔄 *Reset Schedule:* Midnight 00:00 UTC (in \`${usage.timeUntilReset}\`)\n\n` +
                `_Your account link is active, and your limit will reset tonight!_`,
                { parse_mode: 'Markdown' }
              );
            } else {
              try {
                const delRes = await autoDeleteService.deliverBookWithAutoDelete({
                  chatId: ctx.from.id,
                  book,
                  source: 'pairing',
                });
                if (delRes.success) {
                  store.incrementDailyUsage(ctx.from.id);
                  store.incrementDailyUsage(pairing.uid);
                } else {
                  await ctx.reply(`📖 *${book.title}*\nBy ${book.author}\n\nYour account is linked! Tap below to access:`, {
                    parse_mode: 'Markdown',
                    reply_markup: new InlineKeyboard().text('📖 View Book Card', `book_${book.id}`),
                  });
                }
              } catch (deliverErr: any) {
                console.error('[Pairing delivery error]:', deliverErr?.message || deliverErr);
              }
            }
          }
        }
        return true;
      } catch (err: any) {
        console.error('[handlePairingCode error]:', err);
        await ctx.reply(`⚠️ Account link recorded. Your Chat ID is \`${chatIdStr}\`.`, { parse_mode: 'Markdown' });
        return true;
      }
    } else {
      await ctx.reply(
        `⚠️ Pairing code \`${cleanCode}\` was not found or has expired.\n\n` +
        `💡 *Quick Connect:*\n` +
        `Your Chat ID is \`${chatIdStr}\`. Enter it directly on the BusiMind website modal to link in 1 click!`,
        { parse_mode: 'Markdown' }
      );
      return true;
    }
  }

  // 2. Is it an email address?
  if (/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(input.toLowerCase())) {
    const email = input.toLowerCase();
    try {
      // Enforce 1-to-1: Disconnect any other user holding this Telegram account
      try {
        const conflictQuery = query(collection(db, 'users'), where('telegramChatId', '==', chatIdStr));
        const conflictSnaps = await getDocs(conflictQuery);
        for (const conflictDoc of conflictSnaps.docs) {
          if (conflictDoc.data()?.email !== email) {
            await setDoc(conflictDoc.ref, {
              telegramChatId: null,
              telegramUsername: null,
              unlinkedAt: new Date().toISOString(),
              unlinkReason: 'relinked_to_another_account',
            }, { merge: true });
          }
        }
      } catch (unifyErr: any) {
        console.warn('[Email link 1-to-1 conflict check error]:', unifyErr?.message || unifyErr);
      }

      const q = query(collection(db, 'users'), where('email', '==', email));
      const snaps = await getDocs(q);

      if (!snaps.empty) {
        for (const userDoc of snaps.docs) {
          await setDoc(doc(db, 'users', userDoc.id), {
            telegramChatId: chatIdStr,
            telegramUsername: usernameStr,
            updatedAt: new Date().toISOString(),
          }, { merge: true });
        }
      } else {
        // Create/link a placeholder user doc so future logins connect automatically
        const emailDocId = email.replace(/[^a-z0-9]/g, '_');
        await setDoc(doc(db, 'users', emailDocId), {
          email,
          telegramChatId: chatIdStr,
          telegramUsername: usernameStr,
          updatedAt: new Date().toISOString(),
        }, { merge: true });
      }

      await ctx.reply(
        `✅ *Connected to ${email}!* 🎉\n\n` +
        `Your Telegram account is now linked to your BusiMind account.\n\n` +
        `🆔 *Your Chat ID:* \`${chatIdStr}\`\n\n` +
        `Any book you request on the website will now be delivered directly to this chat!`,
        { parse_mode: 'Markdown' }
      );
      return true;
    } catch (err: any) {
      console.error('[handleEmailLink error]:', err);
      await ctx.reply(`⚠️ Could not link email: ${err.message}. Your Chat ID is \`${chatIdStr}\`.`, { parse_mode: 'Markdown' });
      return true;
    }
  }

  return false;
}

if (bot) {
  // 1. /start command
  bot.command('start', async (ctx) => {
    userSessionState.delete(ctx.from?.id || 0);

    const payload = (ctx.match || '').trim();

    // Handle short pairing code: /start p_123456 or 6-digit code
    if (payload && (payload.startsWith('p_') || /^\d{6}$/.test(payload))) {
      const handled = await handlePairingOrEmailInput(ctx, payload);
      if (handled) return;
    }

    // Handle Telegram linking from Web UI (legacy link_uid_book_id)
    if (payload && payload.startsWith('link_')) {
      const fullLink = payload.replace('link_', '');
      let firebaseUid = fullLink;
      let bookIdToDeliver: string | null = null;
      if (fullLink.includes('_book_')) {
        const parts = fullLink.split('_book_');
        firebaseUid = parts[0];
        bookIdToDeliver = parts[1];
      }

      const chatIdStr = ctx.from?.id ? String(ctx.from.id) : '';
      const usernameStr = ctx.from?.username || null;

      try {
        if (firebaseUid && chatIdStr) {
          // Enforce 1-to-1
          try {
            const conflictQuery = query(collection(db, 'users'), where('telegramChatId', '==', chatIdStr));
            const conflictSnaps = await getDocs(conflictQuery);
            for (const conflictDoc of conflictSnaps.docs) {
              if (conflictDoc.id !== firebaseUid) {
                await setDoc(conflictDoc.ref, {
                  telegramChatId: null,
                  telegramUsername: null,
                  unlinkedAt: new Date().toISOString(),
                  unlinkReason: 'relinked_to_another_account',
                }, { merge: true });
              }
            }
          } catch (unifyErr: any) {
            console.warn('[legacy link 1-to-1 conflict check error]:', unifyErr?.message || unifyErr);
          }

          await setDoc(doc(db, 'users', firebaseUid), {
            telegramChatId: chatIdStr,
            telegramUsername: usernameStr,
            updatedAt: new Date().toISOString(),
          }, { merge: true });
        }

        await ctx.reply(
          '✅ *Telegram Connected!*\n\n' +
          'Your Telegram account has been linked to your BusiMind Web profile. ' +
          `\n\n🆔 *Your Chat ID:* \`${chatIdStr}\`\n\n` +
          'Any books you request on the website will now be sent directly here!',
          { parse_mode: 'Markdown' }
        );

        if (bookIdToDeliver) {
          const book = store.getBookById(bookIdToDeliver);
          if (book && ctx.from?.id) {
            const usage = store.getDailyUsage(ctx.from.id);
            if (!usage.isUnlimited && usage.remaining <= 0) {
              await ctx.reply(
                `⏳ *Daily Limit Reached (3 of 3 requests)*\n\n` +
                `You have already utilized your 3 free book requests for today.\n\n` +
                `🔄 *Reset Schedule:* Midnight 00:00 UTC (in \`${usage.timeUntilReset}\`)\n\n` +
                `_Your account link is active, and your limit will reset tonight!_`,
                { parse_mode: 'Markdown' }
              );
            } else {
              try {
                const delRes = await autoDeleteService.deliverBookWithAutoDelete({
                  chatId: ctx.from.id,
                  book,
                  source: 'link',
                });
                if (delRes.success) {
                  store.incrementDailyUsage(ctx.from.id);
                  if (firebaseUid) store.incrementDailyUsage(firebaseUid);
                } else {
                  await ctx.reply(`📖 *${book.title}*\nBy ${book.author}\n\nYour account is linked! You can also tap below to access this volume:`, {
                    parse_mode: 'Markdown',
                    reply_markup: new InlineKeyboard().text('📖 View Book Card', `book_${book.id}`),
                  });
                }
              } catch (deliverErr: any) {
                console.error('[Auto-deliver on link error]:', deliverErr?.message || deliverErr);
              }
            }
          }
        }
      } catch (err: any) {
        console.error('Failed to link telegram account:', err?.message || err);
        await ctx.reply(`⚠️ Account link recorded locally. Your Chat ID is \`${chatIdStr}\`. You can also enter it on the BusiMind website under your profile.`, { parse_mode: 'Markdown' });
      }
      return;
    }

    // Handle direct book link: /start book_<id>
    if (payload && payload.startsWith('book_')) {
      const bookId = payload.replace('book_', '');
      const book = store.getBookById(bookId);
      if (book && ctx.from?.id) {
        const usage = store.getDailyUsage(ctx.from.id);
        if (!usage.isUnlimited && usage.remaining <= 0) {
          const timeInfo = store.getTimeUntilMidnight();
          await ctx.reply(
            `⏳ *Daily Limit Reached (3 of 3 requests)*\n\n` +
            `You have utilized your 3 free book requests for today.\n\n` +
            `🔄 *Reset Schedule:* Midnight 00:00 UTC\n` +
            `⏱️ *Time until reset:* \`${timeInfo.formatted}\`\n\n` +
            `_See you after midnight for your next 3 requests!_`,
            {
              parse_mode: 'Markdown',
              reply_markup: new InlineKeyboard()
                .text('📖 View Book Details', `book_${book.id}`)
                .text('🏠 Main Menu', 'menu_main'),
            }
          );
          return;
        }

        try {
          const delRes = await autoDeleteService.deliverBookWithAutoDelete({
            chatId: ctx.from.id,
            book,
            source: 'direct_book_start',
          });
          if (delRes.success) {
            store.incrementDailyUsage(ctx.from.id);
            return;
          }
        } catch (deliverErr: any) {
          console.error('[Direct book start delivery error]:', deliverErr?.message || deliverErr);
        }
      }

        // Show book card if direct copyMessage wasn't available
        const cardText = `📖 *${book.title}*\n*By ${book.author}* (${book.publicationYear || 'Classic'})\n\n` +
          `• Category: *${book.category}*\n` +
          `• Rating: *⭐ ${book.ratingScore.toFixed(1)}/5.0*\n\n` +
          `${book.description.slice(0, 350)}...`;
        await ctx.reply(cardText, {
          parse_mode: 'Markdown',
          reply_markup: new InlineKeyboard()
            .text('📖 Get Book Now', `get_book_${book.id}`)
            .row()
            .text('🤖 Ask About This Book', `ask_book_${book.id}`)
            .text('🔎 Similar Books', `sim_book_${book.id}`),
        });
        return;
      }

    const usage = ctx.from?.id ? store.getDailyUsage(ctx.from.id) : null;
    const limitNote = usage
      ? (usage.isUnlimited ? '• *Account:* Administrator (Unlimited Requests)' : `• *Daily Allowance:* ${usage.remaining}/3 requests remaining today (resets at 00:00 UTC)`)
      : '• *Daily Allowance:* 3 requests per day (resets at 00:00 UTC)';

    const chatIdStr = ctx.from?.id ? String(ctx.from.id) : '';
    const chatIdDisplay = chatIdStr ? `\n• *Your Chat ID:* \`${chatIdStr}\`` : '';

    const welcome = `*BusiMind*\n\nYour personal guide to business knowledge.\n\n${limitNote}${chatIdDisplay}\n\n` +
      `🔗 *Website Linking:*\n` +
      `• Enter your Chat ID \`${chatIdStr}\` on the BusiMind website\n` +
      `• Or reply here with your email: \`/link your-email@gmail.com\`\n` +
      `• Or reply with a 6-digit pairing code from the website: \`/pair 123456\`\n\n` +
      `Tell me what you want to learn, discover hand-curated business classics, or choose a category below:`;
    await ctx.reply(welcome, {
      parse_mode: 'Markdown',
      reply_markup: getMainMenuKeyboard(ctx.from?.id),
    });
  });

  // /id or /chatid command to easily get telegram chat id
  bot.command(['id', 'chatid', 'myid', 'whoami'], async (ctx) => {
    const chatId = ctx.from?.id;
    const username = ctx.from?.username ? `@${ctx.from.username}` : '(no username)';
    await ctx.reply(
      `🆔 *Your Telegram Information:*\n\n` +
      `• *Chat ID:* \`${chatId}\`\n` +
      `• *Username:* ${username}\n\n` +
      `You can paste your Chat ID on the BusiMind website under your profile or when requesting a book to connect instantly!`,
      { parse_mode: 'Markdown' }
    );
  });

  // /limit or /allowance command
  bot.command(['limit', 'allowance', 'quota'], async (ctx) => {
    const userId = ctx.from?.id || 0;
    const usage = store.getDailyUsage(userId);

    const text = `📊 *Your Daily Request Allowance:*\n\n` +
      (usage.isUnlimited
        ? `👑 *Account Type:* Administrator (Unlimited Requests)\n\n`
        : `• *Used Today:* ${usage.used} / ${usage.limit} requests\n` +
          `• *Remaining:* ${usage.remaining} requests\n` +
          `• *Next Reset:* Midnight 00:00 UTC (in \`${usage.timeUntilReset}\`)\n\n`
      ) +
      `Each day you receive 3 requests to pull books and resources directly from the private repository. Unused requests do not roll over.\n\n` +
      `_Tip: Browsing summaries, reading lists, and key takeaways does not consume your daily requests!_`;

    await ctx.reply(text, {
      parse_mode: 'Markdown',
      reply_markup: new InlineKeyboard()
        .text('📚 Browse Catalog', 'menu_categories')
        .text('⭐ Reading List', 'menu_reading_list')
        .text('🏠 Main Menu', 'menu_main'),
    });
  });

  // 2. /help command
  bot.command('help', async (ctx) => {
    const text = `*How to use BusiMind:*\n\n` +
      `• *Daily Quota:* 3 requests per day, resetting at midnight 00:00 UTC.\n` +
      `• *Natural Search:* Simply type what you want to achieve (e.g. _"I know nothing about investing"_ or _"Books on leading high-performance teams"_).\n` +
      `• *Reading Path:* Type \`/path starting an online business\` to receive a step-by-step curriculum.\n` +
      `• *Categories:* Tap buttons on the main menu to browse curated titles.\n` +
      `• *Reading List:* Save books to read anytime.\n` +
      `• *Repository:* Legally distributable titles can be copied directly to your chat.`;
    await ctx.reply(text, { parse_mode: 'Markdown', reply_markup: getMainMenuKeyboard(ctx.from?.id) });
  });

  // 3. /admin command (Strict Authorization)
  bot.command('admin', async (ctx) => {
    const adminId = process.env.ADMIN_TELEGRAM_ID ? Number(process.env.ADMIN_TELEGRAM_ID) : null;
    const userId = ctx.from?.id;

    if (!adminId || userId !== adminId) {
      await ctx.reply('⛔ *Access Denied*\n\nThis command is strictly restricted to BusiMind administrators.', {
        parse_mode: 'Markdown',
      });
      return;
    }

    const stats = store.getStats();
    const channelId = process.env.TELEGRAM_CHANNEL_ID || 'Not configured';

    const text = `🛠 *BusiMind Administrator Console*\n\n` +
      `📊 *Catalog & Usage Overview:*\n` +
      `• Total Books in Database: *${stats.totalBooks}*\n` +
      `• Repository (Model A) Files: *${stats.repositoryBooksCount}*\n` +
      `• External / Licensed (Model B): *${stats.externalOnlyBooksCount}*\n` +
      `• Wishlist Requests: *${stats.totalBookRequests || 0}* (*${stats.pendingBookRequests || 0}* pending)\n` +
      `• Total Searches Logged: *${stats.totalSearches}*\n` +
      `• Saved Reading List Items: *${stats.totalReadingListItems}*\n\n` +
      `📡 *Configuration:*\n` +
      `• Target Channel ID: \`${channelId}\`\n` +
      `• Gemini AI Status: *${isGeminiAvailable() ? 'Active ✅' : 'Inactive (Add API Key) ⚠️'}*\n\n` +
      `⚡ *Admin Quick Commands:*\n` +
      `• \`/requests\` — View user book requests & wishlist.\n` +
      `• \`/link <book_id> <message_id>\` — Associate a Telegram channel message with a book.\n` +
      `• \`/books\` — List book IDs in database.`;

    const adminKb = new InlineKeyboard()
      .text('📋 View Book IDs', 'admin_list_books')
      .text(`📝 Requests (${stats.pendingBookRequests || 0})`, 'admin_view_requests')
      .row()
      .text('🔄 Refresh Stats', 'admin_refresh')
      .text('🏠 Main Menu', 'menu_main');

    await ctx.reply(text, { parse_mode: 'Markdown', reply_markup: adminKb });
  });

  // /requests command for admin
  bot.command('requests', async (ctx) => {
    const adminId = process.env.ADMIN_TELEGRAM_ID ? Number(process.env.ADMIN_TELEGRAM_ID) : null;
    if (!adminId || ctx.from?.id !== adminId) {
      return ctx.reply('⛔ Access restricted to BusiMind administrators.');
    }

    const requests = store.getAllBookRequests();
    if (requests.length === 0) {
      return ctx.reply('📝 *No book requests recorded yet.*', { parse_mode: 'Markdown' });
    }

    let text = `📝 *User Book Requests & Wishlist (${requests.length} total):*\n\n`;
    requests.slice(0, 10).forEach((r, i) => {
      const statusIcon = r.status === 'acquired' ? '✅' : r.status === 'dismissed' ? '⚪' : '⏳';
      text += `${i + 1}. ${statusIcon} *${r.requestedTitle}* ${r.requestedAuthor ? `by ${r.requestedAuthor}` : ''}\n` +
        `   • Times Requested: *${r.requestCount}* | Status: \`${r.status.toUpperCase()}\`\n` +
        `   • Topic: ${r.topic || 'Business'}\n\n`;
    });

    const kb = new InlineKeyboard().text('🏠 Admin Menu', 'admin_refresh');
    await ctx.reply(text, { parse_mode: 'Markdown', reply_markup: kb });
  });

  // /pair or /connect command
  bot.command(['pair', 'connect'], async (ctx) => {
    const arg = (ctx.match || '').trim();
    if (!arg) {
      userSessionState.set(ctx.from.id, { action: 'awaiting_web_link' });
      return ctx.reply(
        `🔗 *Connect Telegram to BusiMind Web*\n\n` +
        `🆔 *Your Chat ID:* \`${ctx.from.id}\`\n\n` +
        `Usage:\n` +
        `• \`/pair 123456\` (with 6-digit code from website)\n` +
        `• Or reply with your email: \`/link user@example.com\``,
        { parse_mode: 'Markdown' }
      );
    }
    const handled = await handlePairingOrEmailInput(ctx, arg);
    if (!handled) {
      await ctx.reply(`⚠️ Unrecognized code or format. Send your 6-digit Web code or your account email address.`);
    }
  });

  // 4. /link command: supports both user account linking and admin message linking
  bot.command('link', async (ctx) => {
    const raw = (ctx.match || '').trim();
    const parts = raw.split(/\s+/);
    const adminId = process.env.ADMIN_TELEGRAM_ID ? Number(process.env.ADMIN_TELEGRAM_ID) : null;

    // Check if admin is running channel message link: /link <book_id> <message_id>
    if (parts.length >= 2 && !parts[0].includes('@') && !isNaN(Number(parts[1])) && adminId && ctx.from?.id === adminId) {
      const [bookId, msgIdStr] = parts;
      const msgId = parseInt(msgIdStr, 10);
      const channelId = process.env.TELEGRAM_CHANNEL_ID;
      if (!channelId) {
        return ctx.reply('⚠️ Please set TELEGRAM_CHANNEL_ID in your environment variables first.');
      }

      const repliedDoc = ctx.message?.reply_to_message?.document;
      const repliedAudio = ctx.message?.reply_to_message?.audio;
      const fileId = repliedDoc?.file_id || repliedAudio?.file_id;
      const rawFileName = repliedDoc?.file_name || repliedAudio?.file_name;
      const cleanName = rawFileName ? sanitizeBookFileName(rawFileName) : undefined;

      const updated = store.linkTelegramMessage(bookId, channelId, msgId, cleanName, fileId);
      if (!updated) {
        return ctx.reply(`❌ Book with ID \`${bookId}\` not found in database.`);
      }

      const fileNotice = fileId ? `\n📄 *Direct File Stamped:* \`${cleanName || updated.fileName || 'Attached'}\`` : '';
      return ctx.reply(`✅ Successfully linked book *${updated.title}* to Channel \`${channelId}\` at Message ID \`${msgId}\`!${fileNotice}`, {
        parse_mode: 'Markdown',
      });
    }

    // Otherwise, treat as user account linking (e.g. /link hamiltonyh727@gmail.com or /link 492815)
    if (raw) {
      const handled = await handlePairingOrEmailInput(ctx, raw);
      if (handled) return;
    }

    userSessionState.set(ctx.from.id, { action: 'awaiting_web_link' });
    return ctx.reply(
      `🔗 *Link Your BusiMind Web Account:*\n\n` +
      `🆔 *Your Chat ID:* \`${ctx.from.id}\` (Tap to copy)\n\n` +
      `To link:\n` +
      `1️⃣ Enter \`${ctx.from.id}\` into the website modal\n` +
      `2️⃣ Or reply with your email: \`/link your-email@gmail.com\`\n` +
      `3️⃣ Or reply with a 6-digit code: \`/pair 123456\``,
      { parse_mode: 'Markdown' }
    );
  });

  // 4b. /unlink command: unlinks the user's Telegram Chat ID from BusiMind web account
  bot.command('unlink', async (ctx) => {
    const chatIdStr = String(ctx.from?.id);
    try {
      const q = query(collection(db, 'users'), where('telegramChatId', '==', chatIdStr));
      const snaps = await getDocs(q);
      let count = 0;
      for (const d of snaps.docs) {
        await setDoc(doc(db, 'users', d.id), {
          telegramChatId: null,
          telegramUsername: null,
          unlinkedAt: new Date().toISOString(),
        }, { merge: true });
        count++;
      }
      userSessionState.delete(ctx.from?.id || 0);
      return ctx.reply(
        `🔓 *Telegram Account Unlinked*\n\n` +
        `Your Telegram Chat ID (\`${chatIdStr}\`) has been dissociated from your BusiMind web profile (${count} account${count === 1 ? '' : 's'}).\n\n` +
        `You can connect a new account anytime with \`/pair <code>\` or by entering your Chat ID on the website.`,
        { parse_mode: 'Markdown' }
      );
    } catch (err: any) {
      console.error('[unlink error]:', err);
      return ctx.reply(`⚠️ Could not unlink account: ${err.message}`);
    }
  });

  // 5. /path <goal> command
  bot.command('path', async (ctx) => {
    const goal = (ctx.match || '').trim();
    if (!goal) {
      return ctx.reply('Please specify your goal. For example:\n`/path starting a tech company from scratch`', { parse_mode: 'Markdown' });
    }

    await handleReadingPathRequest(ctx, goal);
  });

  // 6. /analyze <symbol>, /markets, /valuation commands
  bot.command(['analyze', 'valuation', 'markets'], async (ctx) => {
    const raw = (ctx.match || '').trim();
    const symbol = (raw || (ctx.message?.text?.includes('markets') ? 'MTNGH' : 'NVDA')).toUpperCase();
    await ctx.reply(`🔍 Calculating institutional valuation & groundings for *${symbol}*...`, { parse_mode: 'Markdown' });

    try {
      const quote = await marketDataService.getQuote(symbol);
      const val = await valuationEngine.analyzeAsset(quote);

      const summaryText =
        `📊 *Valuation Report: ${quote.name} (${quote.symbol})*\n` +
        `🏢 Exchange: ${quote.exchange}\n` +
        `💵 Market Price: *${quote.currency} ${quote.price.toFixed(2)}*\n\n` +
        `📐 *DUAL VALUATION FOOTBALL FIELD:*\n` +
        `• *Intrinsic DCF Value:* ${quote.currency} ${val.dcf.intrinsicValue.toFixed(2)} (${val.dcf.marginOfSafetyPercent >= 0 ? '+' : ''}${val.dcf.marginOfSafetyPercent}%)\n` +
        (val.multiples.grahamNumber ? `• *Benjamin Graham Number:* ${quote.currency} ${val.multiples.grahamNumber.toFixed(2)} (${val.multiples.grahamMarginPercent}%)\n` : '') +
        (val.multiples.peterLynchFairValue ? `• *Peter Lynch Fair Value:* ${quote.currency} ${val.multiples.peterLynchFairValue.toFixed(2)}\n` : '') +
        `• *Synthesized Fair Value:* *${quote.currency} ${val.synthesizedFairValue.toFixed(2)}*\n` +
        `🎯 *Institutional Verdict:* \`${val.institutionalVerdict}\` (Safety Margin: ${val.synthesizedMarginOfSafety >= 0 ? '+' : ''}${val.synthesizedMarginOfSafety}%)\n\n` +
        `🧠 *Grounded Book Principles Applied:*\n` +
        val.appliedMentalModels.slice(0, 2).map((m) => `• _"${m.bookTitle}"_ (${m.author}): ${m.modelName}`).join('\n') +
        `\n\n💡 *AI Executive Synthesis:*\n${val.aiExecutiveSummary}`;

      const kb = new InlineKeyboard()
        .text('🇬🇭 MTNGH', 'val_MTNGH')
        .text('🇬🇭 GCB', 'val_GCB')
        .text('🌐 NVDA', 'val_NVDA')
        .row()
        .text('🏠 Main Menu', 'menu_main');

      await ctx.reply(summaryText, { parse_mode: 'Markdown', reply_markup: kb });
    } catch (err: any) {
      console.error('[Bot /analyze error]:', err);
      await ctx.reply(`❌ Could not analyze symbol "${symbol}". Please check the ticker symbol (e.g. \`/analyze MTNGH\` or \`/analyze NVDA\`).`, { parse_mode: 'Markdown' });
    }
  });

  // Paper search command
  bot.command('paper', async (ctx) => {
    const query = ctx.match;
    if (!query) {
      await ctx.reply('⚠️ Please provide a paper title, DOI, or arXiv ID. Example: `/paper Common Risk Factors` or `/paper 10.1016/0304-405X(93)90023-5`', { parse_mode: 'Markdown' });
      return;
    }

    try {
      const waitMsg = await ctx.reply(`🔍 Searching open-access academic repositories for: *${query}*...`, { parse_mode: 'Markdown' });
      
      const type = academicResearchService.detectIdentifierType(query);
      let paper = null;
      
      if (type === 'DOI') {
        paper = await academicResearchService.fetchByDoi(query);
      } else if (type === 'ARXIV') {
        paper = await academicResearchService.fetchByArxiv(query);
      } else if (type === 'ISBN') {
        paper = await academicResearchService.fetchByIsbn(query);
      } else {
        const results = await academicResearchService.searchPapers(query, 1);
        if (results.length > 0) paper = results[0];
      }

      if (!paper) {
        await ctx.api.editMessageText(ctx.chat!.id, waitMsg.message_id, `❌ Could not find a matching academic paper for "${query}". Try providing a direct DOI or arXiv ID.`, { parse_mode: 'Markdown' });
        return;
      }

      const text =
        `📄 *${paper.title}*\n` +
        `👤 *Authors:* ${paper.authors.join(', ')} (${paper.year})\n` +
        `🏛 *Journal/Venue:* ${paper.venue || 'Academic Paper'}\n` +
        `📊 *Citations:* ${paper.citationCount?.toLocaleString() || 0} | 🔓 *Open Access:* ${paper.isOpenAccess ? 'Yes' : 'No'}\n\n` +
        `💡 *Core Finding / Abstract:*\n${(paper.tldr || paper.abstract).slice(0, 400)}...\n`;

      const kb = new InlineKeyboard();
      if (paper.pdfUrl) {
        kb.url('📥 Download PDF (Open Access)', paper.pdfUrl).row();
      } else if (paper.landingPageUrl) {
        kb.url('🔗 Publisher Link', paper.landingPageUrl).row();
      }
      kb.text('🧠 Extract Mental Model', `extract_model_${paper.id.substring(0, 20)}`);

      await ctx.api.editMessageText(ctx.chat!.id, waitMsg.message_id, text, { parse_mode: 'Markdown', reply_markup: kb });
    } catch (err) {
      console.error('[Bot /paper error]:', err);
      await ctx.reply(`❌ An error occurred while searching for academic research.`, { parse_mode: 'Markdown' });
    }
  });

  // --- WISHLIST & MANUAL REQUEST COMMANDS ---
  bot.command(['wishlist', 'requests'], async (ctx) => {
    const userId = ctx.from?.id || 0;
    const resp = handleViewWishlist(userId);
    const kb = new InlineKeyboard();
    resp.buttons?.forEach((row) => {
      row.forEach((btn) => kb.text(btn.text, btn.data));
      kb.row();
    });
    await ctx.reply(resp.text, { parse_mode: 'Markdown', reply_markup: kb });
  });

  bot.command('request', async (ctx) => {
    const userId = ctx.from?.id || 0;
    const rawTitle = ctx.match?.trim() || '';
    if (!rawTitle) {
      userSessionState.set(userId, { action: 'awaiting_wishlist_request' });
      await ctx.reply(
        `📝 *What book would you like BusiMind to acquire?*\n\nPlease send the title and author (e.g. \`Zero to One by Peter Thiel\` or \`Never Split the Difference\`).`,
        { parse_mode: 'Markdown' }
      );
      return;
    }

    const waitMsg = await ctx.reply(`🔎 *Checking book metadata and covers...*`, { parse_mode: 'Markdown' });
    const resp = await handleBookClarificationAndWishlist(rawTitle, userId, store.getAllBooks());
    const kb = new InlineKeyboard();
    resp.buttons?.forEach((row) => {
      row.forEach((btn) => kb.text(btn.text, btn.data));
      kb.row();
    });

    if (resp.photoUrl) {
      try {
        await ctx.api.deleteMessage(ctx.chat!.id, waitMsg.message_id);
        await ctx.replyWithPhoto(resp.photoUrl, {
          caption: resp.text,
          parse_mode: 'Markdown',
          reply_markup: kb,
        });
        return;
      } catch (e) {
        // Fallback
      }
    }
    await ctx.api.editMessageText(ctx.chat!.id, waitMsg.message_id, resp.text, {
      parse_mode: 'Markdown',
      reply_markup: kb,
    });
  });

  // --- CALLBACK QUERY HANDLERS (Inline Buttons) ---

  // Global callback query logging and auto-acknowledgment helper
  bot.on('callback_query:data', async (ctx, next) => {
    console.log(`[BusiMind] Button pressed by ${ctx.from?.username || ctx.from?.id}: "${ctx.callbackQuery.data}"`);
    // Immediately acknowledge callback query in background to dismiss button spinner in client
    ctx.answerCallbackQuery().catch(() => {});
    await next();
  });

  // Wishlist & Request Callbacks
  bot.callbackQuery(/^confirm_wishlist_(\d+)$/, async (ctx) => {
    await ctx.answerCallbackQuery('Saving to Wishlist...');
    const index = parseInt(ctx.match[1], 10);
    const userId = ctx.from?.id || 0;
    const resp = handleConfirmWishlistCandidate(userId, index);

    const kb = new InlineKeyboard();
    resp.buttons?.forEach((row) => {
      row.forEach((btn) => kb.text(btn.text, btn.data));
      kb.row();
    });

    if (resp.photoUrl) {
      try {
        await ctx.replyWithPhoto(resp.photoUrl, {
          caption: resp.text,
          parse_mode: 'Markdown',
          reply_markup: kb,
        });
        return;
      } catch (e) {
        // Fallback
      }
    }
    await ctx.reply(resp.text, { parse_mode: 'Markdown', reply_markup: kb });
  });

  bot.callbackQuery('menu_wishlist', async (ctx) => {
    await ctx.answerCallbackQuery();
    const userId = ctx.from?.id || 0;
    const resp = handleViewWishlist(userId);
    const kb = new InlineKeyboard();
    resp.buttons?.forEach((row) => {
      row.forEach((btn) => kb.text(btn.text, btn.data));
      kb.row();
    });
    await ctx.reply(resp.text, { parse_mode: 'Markdown', reply_markup: kb });
  });

  bot.callbackQuery('menu_request_prompt', async (ctx) => {
    await ctx.answerCallbackQuery();
    const userId = ctx.from?.id || 0;
    userSessionState.set(userId, { action: 'awaiting_wishlist_request' });
    await ctx.reply(
      `📝 *What book would you like BusiMind to acquire?*\n\nSend the title and author in your next message (e.g. \`Good to Great by Jim Collins\` or \`Never Split the Difference\`).`,
      { parse_mode: 'Markdown' }
    );
  });

  bot.callbackQuery('recommend_narrative', async (ctx) => {
    await ctx.answerCallbackQuery();
    const allBooks = store.getAllBooks();
    const narrative = allBooks.find((b) => b.title.toLowerCase().includes('shoe') || b.title.toLowerCase().includes('blood')) || allBooks[0];
    if (narrative) {
      const kb = getBookDetailsKeyboard(narrative, ctx.from?.id || 0);
      await ctx.reply(
        `🏃 *Shoe Dog: A Memoir by the Creator of Nike*\n✍️ *Author:* Phil Knight\n\n` +
        `If you love passionate devotion, intense human conflict, and rollercoaster storytelling, *Shoe Dog* reads with all the drama and emotion of a bestselling fiction novel!\n\n` +
        `💡 *Why Recommended:* Phil Knight's authentic, vulnerable recount of surviving against bankruptcy to forge a global athletic empire.`,
        { parse_mode: 'Markdown', reply_markup: kb }
      );
    }
  });

  // Valuation Menu - handled by ['menu_valuation', 'menu_finance']

  bot.callbackQuery(/^val_(.+)$/, async (ctx) => {
    await ctx.answerCallbackQuery();
    const sym = ctx.match[1];
    await ctx.reply(`🔍 Calculating valuation models for *${sym}*...`, { parse_mode: 'Markdown' });

    try {
      const quote = await marketDataService.getQuote(sym);
      const val = await valuationEngine.analyzeAsset(quote);

      const summaryText =
        `📊 *Valuation Report: ${quote.name} (${quote.symbol})*\n` +
        `🏢 Exchange: ${quote.exchange}\n` +
        `💵 Market Price: *${quote.currency} ${quote.price.toFixed(2)}*\n\n` +
        `📐 *DUAL VALUATION FOOTBALL FIELD:*\n` +
        `• *Intrinsic DCF Value:* ${quote.currency} ${val.dcf.intrinsicValue.toFixed(2)} (${val.dcf.marginOfSafetyPercent >= 0 ? '+' : ''}${val.dcf.marginOfSafetyPercent}%)\n` +
        (val.multiples.grahamNumber ? `• *Benjamin Graham Number:* ${quote.currency} ${val.multiples.grahamNumber.toFixed(2)} (${val.multiples.grahamMarginPercent}%)\n` : '') +
        (val.multiples.peterLynchFairValue ? `• *Peter Lynch Fair Value:* ${quote.currency} ${val.multiples.peterLynchFairValue.toFixed(2)}\n` : '') +
        `• *Synthesized Fair Value:* *${quote.currency} ${val.synthesizedFairValue.toFixed(2)}*\n` +
        `🎯 *Verdict:* \`${val.institutionalVerdict}\` (Safety Margin: ${val.synthesizedMarginOfSafety >= 0 ? '+' : ''}${val.synthesizedMarginOfSafety}%)\n\n` +
        `🧠 *Grounded Book Principles Applied:*\n` +
        val.appliedMentalModels.slice(0, 2).map((m) => `• _"${m.bookTitle}"_ (${m.author}): ${m.modelName}`).join('\n') +
        `\n\n💡 *AI Executive Synthesis:*\n${val.aiExecutiveSummary}`;

      const kb = new InlineKeyboard()
        .text('📈 Back to Valuation Lab', 'menu_valuation')
        .text('🏠 Main Menu', 'menu_main');

      await ctx.reply(summaryText, { parse_mode: 'Markdown', reply_markup: kb });
    } catch (err: any) {
      console.error('[Bot val callback error]:', err);
      await ctx.reply(`❌ Could not evaluate asset ${sym}.`, { parse_mode: 'Markdown' });
    }
  });

  // Portfolio Dashboard callback
  bot.callbackQuery('menu_portfolio', async (ctx) => {
    await ctx.answerCallbackQuery();
    try {
      const resp = await financialAgentRouter.handleFinancialQuery('show my portfolio', ctx.from?.id);
      const kb = new InlineKeyboard();
      if (resp.buttons && resp.buttons.length > 0) {
        resp.buttons.forEach((row) => {
          row.forEach((btn) => kb.text(btn.text, btn.data));
          kb.row();
        });
      }
      await ctx.reply(resp.text, { parse_mode: 'Markdown', reply_markup: kb });
    } catch (err: any) {
      await ctx.reply(`❌ Error loading portfolio: ${err.message}`);
    }
  });

  // Stress-Test Cedi callback
  bot.callbackQuery('stress_test_cedi', async (ctx) => {
    await ctx.answerCallbackQuery();
    try {
      const resp = await financialAgentRouter.handleFinancialQuery('what if the cedi depreciates 15%?', ctx.from?.id);
      const kb = new InlineKeyboard();
      if (resp.buttons && resp.buttons.length > 0) {
        resp.buttons.forEach((row) => {
          row.forEach((btn) => kb.text(btn.text, btn.data));
          kb.row();
        });
      }
      await ctx.reply(resp.text, { parse_mode: 'Markdown', reply_markup: kb });
    } catch (err: any) {
      await ctx.reply(`❌ Error running stress test: ${err.message}`);
    }
  });

  // Screen Dividends callback
  bot.callbackQuery('screen_dividends', async (ctx) => {
    await ctx.answerCallbackQuery();
    try {
      const resp = await financialAgentRouter.handleFinancialQuery('find high dividend GSE stocks', ctx.from?.id);
      const kb = new InlineKeyboard();
      if (resp.buttons && resp.buttons.length > 0) {
        resp.buttons.forEach((row) => {
          row.forEach((btn) => kb.text(btn.text, btn.data));
          kb.row();
        });
      }
      await ctx.reply(resp.text, { parse_mode: 'Markdown', reply_markup: kb });
    } catch (err: any) {
      await ctx.reply(`❌ Error running screener: ${err.message}`);
    }
  });

  // Paper Buy Trade callback: trade_buy_SYMBOL_SHARES
  bot.callbackQuery(/^trade_buy_([A-Za-z0-9]+)_(\d+)$/, async (ctx) => {
    await ctx.answerCallbackQuery();
    const symbol = ctx.match[1];
    const shares = parseInt(ctx.match[2], 10);
    try {
      const res = await portfolioService.executeBuy(symbol, shares);
      const kb = new InlineKeyboard()
        .text('💼 View Portfolio', 'menu_portfolio')
        .text('🏠 Main Menu', 'menu_main');
      await ctx.reply(`🛒 *PAPER TRADE EXECUTION:*\n\n${res.message}`, {
        parse_mode: 'Markdown',
        reply_markup: kb,
      });
    } catch (err: any) {
      await ctx.reply(`❌ Paper trade failed: ${err.message}`);
    }
  });

  // Compare callback
  bot.callbackQuery(/^compare_([A-Za-z0-9]+)$/, async (ctx) => {
    await ctx.answerCallbackQuery();
    const symbol = ctx.match[1];
    try {
      const resp = await financialAgentRouter.handleFinancialQuery(`compare ${symbol} and GCB`, ctx.from?.id);
      const kb = new InlineKeyboard();
      if (resp.buttons && resp.buttons.length > 0) {
        resp.buttons.forEach((row) => {
          row.forEach((btn) => kb.text(btn.text, btn.data));
          kb.row();
        });
      }
      await ctx.reply(resp.text, { parse_mode: 'Markdown', reply_markup: kb });
    } catch (err: any) {
      await ctx.reply(`❌ Comparison failed: ${err.message}`);
    }
  });

  // Extract Mental Model callback
  bot.callbackQuery(/^extract_model_(.+)$/, async (ctx) => {
    const paperIdSubstring = ctx.match[1];
    await ctx.answerCallbackQuery({ text: '🧠 Extracting mental model. This may take 10-15 seconds...' });
    
    try {
      // Find the paper in curated list first. 
      // If not there, we'll need to re-fetch or rely on the user searching again, but curated is safe.
      // For a truly robust system, we would cache the search result. For now, we will extract it if it's curated.
      const curated = academicResearchService.getCuratedPapers().find(p => p.id.startsWith(paperIdSubstring));
      if (!curated) {
        await ctx.reply(`⚠️ Sorry, I can only instantly extract mental models from our curated papers at this moment. You requested ID: ${paperIdSubstring}`);
        return;
      }

      const waitMsg = await ctx.reply(`⚙️ Processing "${curated.title}" through Gemini...`);
      const model = await academicResearchService.extractMentalModelFromPaper(curated);
      
      const text = 
        `🧠 *Mental Model Extracted: ${model.frameworkName}*\n\n` +
        `📝 *Summary:*\n${model.summary}\n\n` +
        `💎 *Core Rule:*\n${model.coreRule}\n\n` +
        `✅ *Checklist:*\n` + model.checkQuestions.map(q => `• ${q}`).join('\n') + `\n\n` +
        `🚨 *Red Flags:*\n` + model.redFlags.map(f => `• ${f}`).join('\n');

      const kb = new InlineKeyboard().text('🏠 Main Menu', 'menu_main');
      await ctx.api.editMessageText(ctx.chat!.id, waitMsg.message_id, text, { parse_mode: 'Markdown', reply_markup: kb });
    } catch (err: any) {
      console.error('[Bot /extract_model error]:', err);
      await ctx.reply(`❌ Failed to extract mental model: ${err.message}`);
    }
  });

  // Main menu navigation
  bot.callbackQuery(['menu_main', 'menu_start'], async (ctx) => {
    await ctx.answerCallbackQuery();
    userSessionState.delete(ctx.from?.id || 0);
    const userId = ctx.from?.id;
    const usage = userId ? store.getDailyUsage(userId) : null;
    const limitNote = usage
      ? (usage.isUnlimited ? '• *Account:* Administrator (Unlimited Requests)' : `• *Daily Allowance:* ${usage.remaining}/3 requests remaining today (resets at 00:00 UTC)`)
      : '• *Daily Allowance:* 3 requests per day (resets at 00:00 UTC)';

    const text = `*BusiMind*\n\nYour personal guide to business knowledge.\n\n${limitNote}\n\nSelect an option below or send your goal in chat:`;
    if (ctx.callbackQuery.message?.message_id) {
      await safeEditMsg(ctx, ctx.callbackQuery.message.message_id, text, getMainMenuKeyboard(userId));
    } else {
      await ctx.reply(text, { parse_mode: 'Markdown', reply_markup: getMainMenuKeyboard(userId) });
    }
  });

  bot.callbackQuery(['menu_categories', 'menu_catalog'], async (ctx) => {
    await ctx.answerCallbackQuery().catch(() => {});
    const text = `📂 *Curated Executive Categories:*\n\nSelect a business discipline to explore recommended titles with takeaways and direct access:`;
    if (ctx.callbackQuery.message?.message_id) {
      await safeEditMsg(ctx, ctx.callbackQuery.message.message_id, text, getCategoriesKeyboard());
    } else {
      await ctx.reply(text, { parse_mode: 'Markdown', reply_markup: getCategoriesKeyboard() });
    }
  });

  bot.callbackQuery(['menu_valuation', 'menu_finance'], async (ctx) => {
    await ctx.answerCallbackQuery();
    const text =
      `📈 *BusiMind Wealth & Valuation Lab*\n\n` +
      `Dual Valuation Engine combining *Discounted Cash Flow (DCF)* with *Benjamin Graham* and *Peter Lynch* intrinsic value models.\n\n` +
      `Select a market asset below to run instant institutional analysis, or send \`/analyze <symbol>\` (e.g. \`/analyze MTNGH\` or \`/analyze NVDA\`):\n\n` +
      `🇬🇭 *Ghana Stock Exchange (GSE):*\n` +
      `• *MTNGH* (MTN Ghana) • *GCB* (GCB Bank)\n` +
      `• *TOTAL* (TotalEnergies) • *SCB* (Standard Chartered)\n\n` +
      `🌐 *Global Markets & ETFs:*\n` +
      `• *NVDA* (NVIDIA) • *VOO* (Vanguard S&P 500)\n` +
      `• *AAPL* (Apple) • *MSFT* (Microsoft)`;

    const kb = new InlineKeyboard()
      .text('🇬🇭 Analyze MTNGH', 'val_MTNGH')
      .text('🇬🇭 Analyze GCB', 'val_GCB')
      .row()
      .text('🇬🇭 Analyze TOTAL', 'val_TOTAL')
      .text('🌐 Analyze NVDA', 'val_NVDA')
      .row()
      .text('🌐 Analyze VOO ETF', 'val_VOO')
      .text('🌐 Analyze AAPL', 'val_AAPL')
      .row()
      .text('🏠 Main Menu', 'menu_main');

    if (ctx.callbackQuery.message?.message_id) {
      await safeEditMsg(ctx, ctx.callbackQuery.message.message_id, text, kb);
    } else {
      await ctx.reply(text, { parse_mode: 'Markdown', reply_markup: kb });
    }
  });

  bot.callbackQuery('menu_find', async (ctx) => {
    userSessionState.set(ctx.from.id, { action: 'awaiting_search' });
    const text = `🔎 *Find or Request a Book with BusiMind*\n\n` +
      `Type the book name (title), author name, or your learning goal in chat:\n\n` +
      `*Examples:*\n` +
      `• *Book Title:* _"The Lean Startup"_ or _"Never Split the Difference"_\n` +
      `• *Author:* _"Eric Ries"_, _"Morgan Housel"_, or _"Robert Cialdini"_\n` +
      `• *Learning Goal:* _"I want to improve sales & negotiation"_\n\n` +
      `_💡 If we don't have the book in our repository yet, we will recommend the closest alternatives and automatically log it in our Wishlist to acquire!_`;
    const kb = new InlineKeyboard().text('⬅️ Back to Main Menu', 'menu_main');
    await safeEditMsg(ctx, ctx.callbackQuery.message?.message_id, text, kb);
  });

  bot.callbackQuery('menu_best', async (ctx) => {
    const featured = store.getFeaturedBooks();
    const kb = new InlineKeyboard();

    featured.slice(0, 8).forEach((b) => {
      kb.text(`⭐ ${b.title.length > 32 ? b.title.slice(0, 30) + '…' : b.title}`, `book_${b.id}`).row();
    });
    kb.text('⬅️ Main Menu', 'menu_main');

    const text = `🏆 *Curated Business Classics*\n\nThese titles are recognized by BusiMind as foundational works across strategy, economics, operations, and psychology:`;
    await safeEditMsg(ctx, ctx.callbackQuery.message?.message_id, text, kb);
  });

  bot.callbackQuery('menu_reading_list', async (ctx) => {
    await displayReadingList(ctx);
  });

  bot.callbackQuery('menu_link_web', async (ctx) => {
    await ctx.answerCallbackQuery();
    userSessionState.set(ctx.from.id, { action: 'awaiting_web_link' });
    const text = `🔗 *Link Telegram to BusiMind Web*\n\n` +
      `🆔 *Your Chat ID:* \`${ctx.from.id}\` (Tap to copy)\n\n` +
      `*Options to connect:*\n` +
      `1️⃣ Enter \`${ctx.from.id}\` on the BusiMind website modal.\n` +
      `2️⃣ Or reply directly to this message with your account email (e.g. \`hamiltonyh727@gmail.com\`).\n` +
      `3️⃣ Or reply with the 6-digit code displayed on the website!`;
    const kb = new InlineKeyboard().text('🏠 Main Menu', 'menu_main');
    await safeEditMsg(ctx, ctx.callbackQuery.message?.message_id, text, kb);
  });

  bot.callbackQuery('menu_ask_ai', async (ctx) => {
    userSessionState.set(ctx.from.id, { action: 'awaiting_ask' });
    const text = `🤖 *Ask BusiMind Anything:*\n\nYou can ask:\n• _"What should I read about entrepreneurship?"_\n• _"Which book should I start with as a beginner?"_\n• _"Compare The Lean Startup and Zero to One"_\n• _"Give me a reading plan for management"_\n\nSend your question below:`;
    const kb = new InlineKeyboard().text('⬅️ Main Menu', 'menu_main');
    await safeEditMsg(ctx, ctx.callbackQuery.message?.message_id, text, kb);
  });

  // Helper to render a page of category books
  const renderCategoryPage = async (ctx: Context, categoryKey: string, pageNum: number) => {
    const categoryName = CATEGORY_MAP[categoryKey] || categoryKey;
    const allBooks = store.getBooksByCategory(categoryName);
    const pageSize = 8;
    const totalPages = Math.max(1, Math.ceil(allBooks.length / pageSize));
    const page = Math.max(0, Math.min(pageNum, totalPages - 1));
    const start = page * pageSize;
    const pageBooks = allBooks.slice(start, start + pageSize);

    const kb = new InlineKeyboard();
    if (allBooks.length === 0) {
      kb.text('⬅️ Back to Categories', 'menu_categories');
      await safeEditMsg(ctx, ctx.callbackQuery?.message?.message_id, `📂 *${categoryName}*\n\nNo books in this category yet. Check back soon!`, kb);
      return;
    }

    pageBooks.forEach((b) => {
      const badge = b.distributionType === 'telegram_repository' ? '📖' : '📘';
      const cleanTitle = b.title.length > 34 ? b.title.slice(0, 32) + '…' : b.title;
      kb.text(`${badge} ${cleanTitle}`, `book_${b.id}`).row();
    });

    if (totalPages > 1) {
      if (page > 0) {
        kb.text('⬅️ Prev', `catpg_${categoryKey}_${page - 1}`);
      }
      kb.text(`📄 ${page + 1}/${totalPages}`, `catpg_${categoryKey}_${page}`);
      if (page < totalPages - 1) {
        kb.text('Next ➡️', `catpg_${categoryKey}_${page + 1}`);
      }
      kb.row();
    }

    kb.text('📂 All Categories', 'menu_categories')
      .text('🏠 Main Menu', 'menu_main');

    const text = `📂 *${categoryName}* (Page ${page + 1} of ${totalPages})\n\nShowing titles ${start + 1}–${Math.min(start + pageSize, allBooks.length)} of ${allBooks.length} curated volumes.\n\nTap any title below to view full details, key takeaways, and instant access:`;
    await safeEditMsg(ctx, ctx.callbackQuery?.message?.message_id, text, kb);
  };

  // Category selection handler
  for (const [key] of Object.entries(CATEGORY_MAP)) {
    bot.callbackQuery(key, async (ctx) => {
      await ctx.answerCallbackQuery().catch(() => {});
      await renderCategoryPage(ctx, key, 0);
    });
  }

  // Category pagination handler: catpg_<key>_<page>
  bot.callbackQuery(/^catpg_([a-zA-Z0-9_]+)_(\d+)$/, async (ctx) => {
    await ctx.answerCallbackQuery().catch(() => {});
    const key = ctx.match[1];
    const page = parseInt(ctx.match[2], 10);
    await renderCategoryPage(ctx, key, page);
  });

  // Daily limit menu callback
  bot.callbackQuery('menu_limit', async (ctx) => {
    const userId = ctx.from?.id || 0;
    const usage = store.getDailyUsage(userId);

    const text = `📊 *Your Daily Request Allowance:*\n\n` +
      (usage.isUnlimited
        ? `👑 *Account Type:* Administrator (Unlimited Requests)\n\n`
        : `• *Used Today:* ${usage.used} / ${usage.limit} requests\n` +
          `• *Remaining:* ${usage.remaining} requests\n` +
          `• *Next Reset:* Midnight 00:00 UTC (in \`${usage.timeUntilReset}\`)\n\n`
      ) +
      `Each day you receive 3 requests to pull books and resources directly from the private repository. Unused requests do not roll over.\n\n` +
      `_Tip: Browsing summaries, reading lists, and key takeaways does not consume your daily requests!_`;

    const kb = new InlineKeyboard()
      .text('📚 Browse Catalog', 'menu_categories')
      .text('⭐ Reading List', 'menu_reading_list')
      .text('🏠 Main Menu', 'menu_main');

    await safeEditMsg(ctx, ctx.callbackQuery.message?.message_id, text, kb);
  });

  // Book detail view: book_<id>
  bot.callbackQuery(/^book_(.+)$/, async (ctx) => {
    const bookId = ctx.match[1];
    const book = store.getBookById(bookId);

    if (!book) {
      const kb = new InlineKeyboard().text('⬅️ Main Menu', 'menu_main');
      return safeEditMsg(ctx, ctx.callbackQuery.message?.message_id, '❌ Book not found.', kb);
    }

    const distLabel = book.distributionType === 'telegram_repository'
      ? '📖 Legal Channel Repository'
      : '⚖️ Copyrighted (Authorized External Links)';

    const helps = getBookHelpExplanation(book);
    const takeaways = getBookKeyTakeaways(book);
    const usage = store.getDailyUsage(ctx.from.id);
    const quotaNote = usage.isUnlimited
      ? '👑 _Admin Unlimited_'
      : `📊 _Allowance: ${usage.remaining}/3 left today (resets 00:00 UTC)_`;

    const text = `*${book.title.toUpperCase()}*\n` +
      `✍️ *Author:* ${book.author}\n` +
      `📂 *Category:* ${book.category} (${book.subcategory || 'General'})\n` +
      `📊 *Difficulty:* ${book.difficulty.toUpperCase()} | *Published:* ${book.publicationYear}\n` +
      `📜 *Access:* ${distLabel}\n\n` +
      `🚀 *How This Helps You (Practical ROI):*\n${helps}\n\n` +
      `🔑 *Key Takeaways:*\n${takeaways.map((t) => `• ${t}`).join('\n')}\n\n` +
      `📝 *Executive Overview:*\n${book.description}\n\n` +
      `💡 *Why Recommended:*\n${book.whyRecommended}\n\n` +
      `🎯 *Best Suited For:*\n${book.bestFor}\n\n` +
      `${quotaNote}`;

    await safeEditMsg(ctx, ctx.callbackQuery.message?.message_id, text, getBookDetailsKeyboard(book, ctx.from.id));
  });

  // Get book action: get_book_<id> or dl_<id>
  bot.callbackQuery(/^(?:get_book_|dl_)(.+)$/, async (ctx) => {
    const bookId = ctx.match[1];
    const book = store.getBookById(bookId);

    if (!book) {
      await ctx.answerCallbackQuery({ text: 'Book not found.' });
      return;
    }

    // Model A: Legal Repository Dispatch via copyMessage
    if (book.distributionType === 'telegram_repository' || book.channelMessageId) {
      const channelId = book.channelChatId || process.env.TELEGRAM_CHANNEL_ID;
      const messageId = book.channelMessageId;

      if (channelId && messageId) {
        // Enforce daily request rate limit (3 per day, reset at 00:00 UTC)
        const rate = store.incrementDailyUsage(ctx.from.id);
        if (!rate.allowed) {
          await ctx.answerCallbackQuery({ text: 'Daily limit reached (3/3)!' });
          const timeInfo = store.getTimeUntilMidnight();
          const text = `⏳ *Daily Limit Reached (3 of 3 requests)*\n\n` +
            `You have utilized your 3 free book requests for today.\n\n` +
            `🔄 *Reset Schedule:* Midnight 00:00 UTC\n` +
            `⏱️ *Time until reset:* \`${timeInfo.formatted}\`\n\n` +
            `💡 *What you can do now:*\n` +
            `• Review books you saved in your ⭐ *Reading List*\n` +
            `• Read book summaries and actionable key takeaways in the catalog\n` +
            `• Explore curated categories and learning paths\n\n` +
            `_See you after midnight for your next 3 requests!_`;

          await ctx.reply(text, {
            parse_mode: 'Markdown',
            reply_markup: new InlineKeyboard()
              .text('⭐ My Reading List', 'menu_reading_list')
              .text('🏠 Main Menu', 'menu_main'),
          });
          return;
        }

        try {
          await ctx.answerCallbackQuery({ text: 'Delivering file (2-minute window)...' });
          const delRes = await autoDeleteService.deliverBookWithAutoDelete({
            chatId: ctx.chat!.id,
            book,
            source: 'bot_card',
          });

          if (!delRes.success) {
            await ctx.reply(`⚠️ Delivery error: ${delRes.error || 'Failed to dispatch file'}`);
          }
          return;
        } catch (err: any) {
          console.error('[Telegram copyMessage error]:', err);
          await ctx.reply(
            `⚠️ *Could not copy file from channel library:*\n\n_${err.message}_\n\n` +
            `*Troubleshooting Checklist:*\n` +
            `1. Make sure @BusiMind_bot is added as an **Administrator** in channel \`${channelId}\`.\n` +
            `2. Ensure Message ID \`${messageId}\` actually exists in that channel.`,
            { parse_mode: 'Markdown' }
          );
          return;
        }
      }

      // If channel not yet configured or message missing
      await ctx.answerCallbackQuery();
      const text = `📖 *${book.title}* (Repository Title)\n\n` +
        `This title is registered for direct channel delivery.\n` +
        `*Status:* Awaiting channel post link by administrator.\n\n` +
        `*How to link:* In Telegram, upload the PDF to your private channel, then forward that post to @BusiMind_bot or use \`/link ${book.id} <message_id>\`.`;

      const kb = new InlineKeyboard();
      if (book.externalLibraryUrl) {
        kb.url('🏛️ Read on Open Library / Gutenberg', book.externalLibraryUrl).row();
      }
      kb.text('⬅️ Back to Book', `book_${book.id}`);

      await ctx.reply(text, { parse_mode: 'Markdown', reply_markup: kb });
      return;
    }

    // Model B: Authorized External Access
    await ctx.answerCallbackQuery();
    const text = `⚖️ *Legitimate Access & Copyright Notice*\n\n` +
      `*${book.title}* by ${book.author} is protected by copyright and is not distributed directly as a file in the BusiMind channel.\n\n` +
      `BusiMind encourages supporting authors through official purchase and public library systems:`;

    const kb = new InlineKeyboard();
    if (book.externalPurchaseUrl) {
      kb.url('🛒 Official Publisher / Purchase Link', book.externalPurchaseUrl).row();
    }
    if (book.externalLibraryUrl) {
      kb.url('🏛️ Locate in Public Library (OpenLibrary/WorldCat)', book.externalLibraryUrl).row();
    }
    kb.text('⬅️ Back to Book', `book_${book.id}`);

    await ctx.reply(text, { parse_mode: 'Markdown', reply_markup: kb });
  });

  // Reading List: add_list_<id>
  bot.callbackQuery(/^add_list_(.+)$/, async (ctx) => {
    const bookId = ctx.match[1];
    const book = store.getBookById(bookId);
    if (!book) return ctx.answerCallbackQuery();

    const added = store.addToReadingList(ctx.from.id, book.id);
    await ctx.answerCallbackQuery({
      text: added ? `⭐ Added "${book.title}" to your reading list!` : `Already in your reading list!`,
    });

    // Refresh keyboard
    await ctx.editMessageReplyMarkup({
      reply_markup: getBookDetailsKeyboard(book, ctx.from.id),
    });
  });

  // Reading List: rem_list_<id>
  bot.callbackQuery(/^rem_list_(.+)$/, async (ctx) => {
    const bookId = ctx.match[1];
    const book = store.getBookById(bookId);
    if (!book) return ctx.answerCallbackQuery();

    store.removeFromReadingList(ctx.from.id, book.id);
    await ctx.answerCallbackQuery({ text: `Removed "${book.title}" from your reading list.` });

    await ctx.editMessageReplyMarkup({
      reply_markup: getBookDetailsKeyboard(book, ctx.from.id),
    });
  });

  // Ask about book: ask_book_<id>
  bot.callbackQuery(/^ask_book_(.+)$/, async (ctx) => {
    await ctx.answerCallbackQuery();
    const bookId = ctx.match[1];
    const book = store.getBookById(bookId);
    if (!book) return;

    userSessionState.set(ctx.from.id, { action: 'asking_specific_book', bookId: book.id });
    const text = `🤖 *Ask About: "${book.title}"*\n\nSend any question about this book (e.g. _"Is this suitable for a first-time manager?"_ or _"What is the main takeaway on cash flow?"_):`;
    const kb = new InlineKeyboard().text('⬅️ Back to Book', `book_${book.id}`);
    await safeEditMsg(ctx, ctx.callbackQuery?.message?.message_id, text, kb);
  });

  // Similar books: sim_book_<id>
  bot.callbackQuery(/^sim_book_(.+)$/, async (ctx) => {
    await ctx.answerCallbackQuery();
    const bookId = ctx.match[1];
    const currentBook = store.getBookById(bookId);
    if (!currentBook) return;

    const all = store.getAllBooks();
    const similar = all
      .filter((b) => b.id !== currentBook.id && (b.category === currentBook.category || b.tags?.some((t) => currentBook.tags?.includes(t))))
      .slice(0, 5);

    const kb = new InlineKeyboard();
    similar.forEach((b) => {
      kb.text(`📘 ${b.title}`, `book_${b.id}`).row();
    });
    kb.text('⬅️ Back to Book', `book_${currentBook.id}`);

    const text = `🔎 *Books Similar to "${currentBook.title}":*\n\nCurated based on shared category (${currentBook.category}) and topic tags:`;
    await safeEditMsg(ctx, ctx.callbackQuery?.message?.message_id, text, kb);
  });

  // Admin list books callback
  
  bot.callbackQuery('admin_refresh', async (ctx) => {
    const adminId = process.env.ADMIN_TELEGRAM_ID ? Number(process.env.ADMIN_TELEGRAM_ID) : null;
    if (!adminId || ctx.from?.id !== adminId) return ctx.answerCallbackQuery({ text: '⛔ Unauthorized', show_alert: true });
    
    await ctx.answerCallbackQuery();
    const stats = store.getStats();
    
    const text = `👑 *BusiMind Administrator Dashboard*

` +
      `📊 *System Statistics:*
` +
      `• Total Books/Assets: ${stats.totalBooks}
` +
      `• Pending Requests: ${stats.pendingBookRequests || 0}
` +
      `• Linked Repository Files: ${stats.repositoryBooksCount || 0}

` +
      `*Admin Tools:*
` +
      `Forward any document from your private channel here to auto-index it.`;

    const adminKb = new InlineKeyboard()
      .text('📋 View Book IDs', 'admin_list_books')
      .text(`📝 Requests (${stats.pendingBookRequests || 0})`, 'admin_view_requests')
      .row()
      .text('🔄 Refresh Stats', 'admin_refresh')
      .text('🏠 Main Menu', 'menu_main');

    try {
      await ctx.editMessageText(text, { parse_mode: 'Markdown', reply_markup: adminKb });
    } catch(e) {
      // Ignored if message text hasn't changed
    }
  });
  

  bot.callbackQuery('admin_list_books', async (ctx) => {
    const adminId = process.env.ADMIN_TELEGRAM_ID ? Number(process.env.ADMIN_TELEGRAM_ID) : null;
    if (!adminId || ctx.from?.id !== adminId) return ctx.answerCallbackQuery({ text: '⛔ Unauthorized', show_alert: true });
    await ctx.answerCallbackQuery();
    const books = store.getAllBooks();
    const text = `📋 *Database Book IDs:*\n\n` +
      books.map((b) => `• \`${b.id}\` — *${b.title}* [Msg ID: ${b.channelMessageId || 'None'}]`).join('\n') +
      `\n\nTo link a channel post: \`/link <id> <message_id>\``;

    const kb = new InlineKeyboard().text('⬅️ Admin Console', 'menu_main');
    await ctx.reply(text, { parse_mode: 'Markdown', reply_markup: kb });
  });

  // Admin view requests callback

  bot.callbackQuery(/^scan_(.+)$/, async (ctx) => {
    const adminId = process.env.ADMIN_TELEGRAM_ID ? Number(process.env.ADMIN_TELEGRAM_ID) : null;
    if (!adminId || ctx.from?.id !== adminId) return ctx.answerCallbackQuery({ text: '⛔ Unauthorized', show_alert: true });
    const bookId = ctx.match[1];
    const book = store.getBookById(bookId);
    
    if (!book || !book.fileId) {
      return ctx.answerCallbackQuery({ text: '❌ Cannot scan this file (file ID missing).', show_alert: true });
    }
    
    await ctx.answerCallbackQuery({ text: '🔍 Downloading and deeply analyzing file... This may take a few seconds.' });
    
    try {
      const snippet = await extractPdfSnippetFromFileId(book.fileId);
      
      if (!snippet || snippet.length < 20) {
        return ctx.reply('❌ Could not extract text from this document for a deep scan.');
      }

      if (!process.env.GEMINI_API_KEY) {
        return ctx.reply('❌ GEMINI_API_KEY is not configured in settings.');
      }

      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const prompt = `I am identifying a business book whose filename is unreadable or messy. Read the following text extracted from the first few pages (title/copyright pages) of the document. Based on this excerpt, identify the true canonical title, author, category, publication year, and ISBN-13 of the book. 
      
      TEXT EXCERPT:
      ${snippet}
      
      Return pure JSON matching this schema:
      {
        "title": "Clean Canonical Title",
        "author": "Real Author",
        "category": "Entrepreneurship",
        "publicationYear": 2020,
        "isbn13": "978..."
      }`;

      const aiResponse = await safeGenerateContent(ai, {
        model: 'gemini-3.8-flash',
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              author: { type: Type.STRING },
              category: { type: Type.STRING },
              publicationYear: { type: Type.INTEGER, nullable: true },
              isbn13: { type: Type.STRING, nullable: true }
            },
            required: ['title', 'author', 'category']
          }
        }
      });
      
      const parsed = JSON.parse(aiResponse.text || '{}');
      
      if (parsed.title && parsed.title.toLowerCase() !== 'unknown' && parsed.title.toLowerCase() !== 'untitled business asset') {
        const newCover = await resolveBookCover(parsed.title, parsed.author, parsed.isbn13);
        
        const cleanName = sanitizeBookFileName(book.fileName, parsed.title, parsed.author);
        
        store.updateBook(book.id, {
          title: parsed.title,
          author: parsed.author,
          category: parsed.category || book.category,
          publicationYear: parsed.publicationYear || book.publicationYear,
          ...(newCover ? { coverImageUrl: newCover } : {}),
          fileName: cleanName,
        });
        
        await ctx.reply(`✅ *Deep Scan Complete!*\n\nIdentified as:\n📖 *${parsed.title}*\n✍️ by *${parsed.author}*\n🗂 Category: ${parsed.category || book.category}\n\n✨ Store catalog & cover have been updated automatically.`, {
          parse_mode: 'Markdown',
          reply_markup: new InlineKeyboard().text('📖 View Updated Card', `book_${book.id}`)
        });
      } else {
        await ctx.reply('⚠️ Deep scan completed but could not definitively identify the book from the text excerpt.');
      }
    } catch (err: any) {
      console.error('Deep scan error:', err);
      await ctx.reply(`❌ Error during deep scan: ${err?.message || 'Analysis failed'}`);
    }
  });

  bot.callbackQuery('admin_view_requests', async (ctx) => {
    const adminId = process.env.ADMIN_TELEGRAM_ID ? Number(process.env.ADMIN_TELEGRAM_ID) : null;
    if (!adminId || ctx.from?.id !== adminId) return ctx.answerCallbackQuery({ text: '⛔ Unauthorized', show_alert: true });
    await ctx.answerCallbackQuery();
    const requests = store.getAllBookRequests();
    if (requests.length === 0) {
      return ctx.reply('📝 *No book requests recorded yet.*', {
        parse_mode: 'Markdown',
        reply_markup: new InlineKeyboard().text('⬅️ Back', 'admin_refresh'),
      });
    }

    let text = `📝 *User Book Requests & Wishlist (${requests.length} total):*\n\n`;
    requests.slice(0, 10).forEach((r, i) => {
      const statusIcon = r.status === 'acquired' ? '✅' : r.status === 'dismissed' ? '⚪' : '⏳';
      text += `${i + 1}. ${statusIcon} *${r.requestedTitle}* ${r.requestedAuthor ? `by ${r.requestedAuthor}` : ''}\n` +
        `   • Requests: *${r.requestCount}* | Status: \`${r.status.toUpperCase()}\`\n` +
        `   • Topic: ${r.topic || 'Business'}\n\n`;
    });

    const kb = new InlineKeyboard().text('🔄 Refresh', 'admin_view_requests').text('⬅️ Admin Console', 'admin_refresh');
    await ctx.reply(text, { parse_mode: 'Markdown', reply_markup: kb });
  });

  // --- CHANNEL AUTO-INDEXING HANDLERS ---

  // 1. Direct Channel Post Listener:
  // When files/books are uploaded to the channel, automatically catalog them!
  bot.on('channel_post', async (ctx) => {
    const post = ctx.channelPost;
    const channelId = String(post.chat.id);
    const messageId = post.message_id;

    // Do not index simple text messages, photos, or videos; only index documents and audiobooks
    if (!post.document && !post.audio) {
      return;
    }

    let fileId: string | undefined;
    let fileName: string | undefined;
    let mimeType: string | undefined;
    let fileSize: number | undefined;
    let mediaType: 'document' | 'audio' | 'video' | 'photo' | 'text' = 'text';

    if (post.document) {
      mediaType = 'document';
      fileId = post.document.file_id;
      fileName = post.document.file_name;
      mimeType = post.document.mime_type;
      fileSize = post.document.file_size;
    } else if (post.audio) {
      mediaType = 'audio';
      fileId = post.audio.file_id;
      fileName = post.audio.file_name || `${post.audio.performer || ''} - ${post.audio.title || 'Audiobook'}.mp3`;
      mimeType = post.audio.mime_type;
      fileSize = post.audio.file_size;
    } else if (post.video) {
      mediaType = 'video';
      fileId = post.video.file_id;
      fileName = post.video.file_name;
      mimeType = post.video.mime_type;
    } else if (post.photo) {
      mediaType = 'photo';
    }

    const caption = post.caption;
    const text = (post as any).text;

    try {
      const result = await autoIndexChannelAsset({
        channelId,
        messageId,
        fileId,
        fileName,
        caption,
        text,
        mimeType,
        fileSize,
        mediaType,
      });

      console.log(`[Auto-Indexer] Direct Channel Post #${messageId} indexed: "${result.book.title}" (${result.action})`);

      // Notify admin if configured
      const adminId = process.env.ADMIN_TELEGRAM_ID ? Number(process.env.ADMIN_TELEGRAM_ID) : null;
      if (adminId) {
        const typeEmoji = result.book.resourceType === 'audiobook' ? '🎧' : result.book.resourceType === 'template' ? '📊' : '📘';
        await bot.api.sendMessage(
          adminId,
          `📥 *New Channel Upload Auto-Cataloged!*\n\n` +
          `${typeEmoji} *${result.book.title}*\n` +
          `✍️ *Author / Creator:* ${result.book.author}\n` +
          `📂 *Category:* ${result.book.category}\n` +
          `🏷 *Resource Type:* ${result.book.resourceType || 'book'}\n` +
          `🔢 *Channel Msg ID:* \`#${messageId}\`\n\n` +
          `_Status: ${result.action === 'already_indexed' ? '⚠️ Already indexed previously' : result.action === 'linked' ? 'Linked to existing catalog item' : 'Added as new asset to library'}_`,
          {
            parse_mode: 'Markdown',
            reply_markup: new InlineKeyboard()
              .text('📖 View Asset Card', `book_${result.book.id}`)
              .text('🔍 Deep Scan PDF', `scan_${result.book.id}`)
              .text('🏠 Main Menu', 'menu_main'),
          }
        );
      }
    } catch (err) {
      console.error('[Auto-Indexer channel_post error]:', err);
    }
  });

  // 2. Admin Bulk-Forward Handler:
  // Forward 1 or 100 books from your private channel to @BusiMind_bot and it auto-indexes every single one!
  bot.on('message', async (ctx, next) => {
    const adminId = process.env.ADMIN_TELEGRAM_ID ? Number(process.env.ADMIN_TELEGRAM_ID) : null;
    if (adminId && ctx.from?.id === adminId) {
      const msg = ctx.message;
      let originChannelId: string | number | undefined;
      let originMessageId: number | undefined;

      const anyMsg = msg as any;
      if (anyMsg.forward_origin && anyMsg.forward_origin.type === 'channel') {
        originChannelId = anyMsg.forward_origin.chat?.id;
        originMessageId = anyMsg.forward_origin.message_id;
      } else if (anyMsg.forward_from_chat && anyMsg.forward_from_message_id) {
        originChannelId = anyMsg.forward_from_chat.id;
        originMessageId = anyMsg.forward_from_message_id;
      }

      if (originChannelId && originMessageId) {
        // Do not index simple text messages, photos, or videos forwarded from the channel
        if (!msg.document && !msg.audio) {
          return next();
        }

        let fileId: string | undefined;
        let fileName: string | undefined;
        let mimeType: string | undefined;
        let fileSize: number | undefined;
        let mediaType: 'document' | 'audio' | 'video' | 'photo' | 'text' = 'text';

        if (msg.document) {
          mediaType = 'document';
          fileId = msg.document.file_id;
          fileName = msg.document.file_name;
          mimeType = msg.document.mime_type;
          fileSize = msg.document.file_size;
        } else if (msg.audio) {
          mediaType = 'audio';
          fileId = msg.audio.file_id;
          fileName = msg.audio.file_name || `${msg.audio.performer || ''} - ${msg.audio.title || 'Audiobook'}.mp3`;
          mimeType = msg.audio.mime_type;
          fileSize = msg.audio.file_size;
        } else if (msg.video) {
          mediaType = 'video';
          fileId = msg.video.file_id;
          fileName = msg.video.file_name;
          mimeType = msg.video.mime_type;
        }

        const caption = msg.caption;
        const text = (msg as any).text;

        try {
          const result = await autoIndexChannelAsset({
            channelId: String(originChannelId),
            messageId: originMessageId,
            fileId,
            fileName,
            caption,
            text,
            mimeType,
            fileSize,
            mediaType,
          });

          const typeEmoji = result.book.resourceType === 'audiobook' ? '🎧' : result.book.resourceType === 'template' ? '📊' : '📘';
          const statusText = result.action === 'already_indexed' ? '⚠️ Already indexed' : result.action === 'linked' ? '✅ Linked to existing catalog item' : '🆕 Added as new resource';
          await ctx.reply(
            `⚡ *Auto-Indexed from Channel:*\n\n` +
            `${typeEmoji} *${result.book.title}*\n` +
            `✍️ *Author:* ${result.book.author}\n` +
            `📂 *Category:* ${result.book.category}\n` +
            `🏷 *Type:* ${result.book.resourceType || 'book'}\n` +
            `🔢 *Channel Msg ID:* \`#${originMessageId}\`\n\n` +
            `_Status: ${statusText}_`,
            {
              parse_mode: 'Markdown',
              reply_markup: new InlineKeyboard()
                .text('📖 Open Card', `book_${result.book.id}`)
                .text('⚡ Test Deliver', `dl_${result.book.id}`)
                .text('🔍 Deep Scan PDF', `scan_${result.book.id}`)
                .text('🏠 Menu', 'menu_main'),
            }
          );
          return;
        } catch (err: any) {
          console.error('[Bulk-forward auto-index error]:', err);
          await ctx.reply(`⚠️ Could not auto-index forwarded message #${originMessageId}: ${err.message}`);
          return;
        }
      }
    }
    await next();
  });

  // --- FINANCIAL QUERY DETECTOR ---
  function isFinancialQuery(text: string): boolean {
    const q = text.toLowerCase().trim();
    const financeKeywords = [
      'analyze', 'valuation', 'dcf', 'margin of safety', 'intrinsic', 'graham', 'lynch',
      'damodaran', 'moat', 'pe ratio', 'dividend', 'yield', 'roe', 'eps',
      'cedi', 'inflation', 'treasury bill', 't-bill', 'bog', 'bank of ghana', 'gse',
      'ghana stock', 'portfolio', 'paper trade', 'buy ', 'sell ', 'shares of', 'rsi',
      'macd', 'moving average', 'technical', 'support', 'resistance', 'stress test',
      'undervalued', 'overvalued', 'fair value', 'screener', 'screen', 'compare',
      'mtn', 'mtngh', 'gcb', 'total', 'scb', 'nvda', 'voo', 'aapl', 'msft', 'goil',
      'teach me investing', 'investing from zero', 'thesis', 'journal'
    ];
    return financeKeywords.some((kw) => q.includes(kw));
  }

  // --- GENERAL NATURAL LANGUAGE INPUT ---

  bot.on('message:text', async (ctx) => {
    try {
      const text = ctx.message.text.trim();
      console.log(`[BusiMind] Incoming text from ${ctx.from?.username || ctx.from?.id}: "${text}"`);
      if (text.startsWith('/')) return; // Handled by command dispatchers

      const state = userSessionState.get(ctx.from.id);

      // Check for 6-digit pairing code (e.g. "492815" or "p_492815") or email address
      const cleanCandidate = text.replace(/^p_/, '').replace(/-/g, '').trim();
      if (/^\d{6}$/.test(cleanCandidate) || /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(text)) {
        const handled = await handlePairingOrEmailInput(ctx, text);
        if (handled) return;
      }

      if (state && state.action === 'awaiting_web_link') {
        userSessionState.delete(ctx.from.id);
        const handled = await handlePairingOrEmailInput(ctx, text);
        if (handled) return;
        await ctx.reply(
          `⚠️ We could not match that input to an active pairing code or email.\n\n` +
          `• Your Chat ID is \`${ctx.from.id}\`. You can enter it on the BusiMind website modal to link instantly!\n` +
          `• Or make sure you send a 6-digit code (e.g. \`123456\`) or your account email address.`,
          { parse_mode: 'Markdown' }
        );
        return;
      }

      // If user is responding to "What book would you like to request?"
      if (state && state.action === 'awaiting_wishlist_request') {
        userSessionState.delete(ctx.from.id);
        const waitMsg = await ctx.reply(`🔎 *Checking book metadata and covers...*`, { parse_mode: 'Markdown' });
        const resp = await handleBookClarificationAndWishlist(text, ctx.from.id, store.getAllBooks());
        const kb = new InlineKeyboard();
        resp.buttons?.forEach((row) => {
          row.forEach((btn) => kb.text(btn.text, btn.data));
          kb.row();
        });

        if (resp.photoUrl) {
          try {
            await ctx.api.deleteMessage(ctx.chat.id, waitMsg.message_id);
            await ctx.replyWithPhoto(resp.photoUrl, {
              caption: resp.text,
              parse_mode: 'Markdown',
              reply_markup: kb,
            });
            return;
          } catch (e) {
            // Fallback
          }
        }

        await safeEditMsg(ctx, waitMsg.message_id, resp.text, kb);
        return;
      }

      // If user is asking about a specific book
      if (state && state.action === 'asking_specific_book' && state.bookId) {
        const book = store.getBookById(state.bookId);
        if (book) {
          userSessionState.delete(ctx.from.id);
          const typing = await ctx.reply('🤖 *BusiMind is analyzing the book concepts...*', { parse_mode: 'Markdown' });
          const answer = await askAboutBook(book, text);
          await safeEditMsg(ctx, typing.message_id, `📘 *${book.title}*\n\n${answer}`, getBookDetailsKeyboard(book, ctx.from.id));
          return;
        }
      }

      // Evaluate intent before processing
      const intentData = await evaluateIntentWithLLM(text);

      // Fast, direct reply for greetings, hesitations ("uhmmm"), user corrections, or general conversation/small talk
      if (!intentData.isBookSearch && intentData.reply) {
        const kb = new InlineKeyboard()
          .text('📚 Browse Catalog', 'menu_catalog')
          .text('📊 Valuation Engine', 'menu_finance')
          .row()
          .text('📝 Request a Book', 'menu_find')
          .text('🏠 Main Menu', 'menu_main');
        await ctx.reply(intentData.reply, { parse_mode: 'Markdown', reply_markup: kb }).catch(async () => {
          const plain = intentData.reply!.replace(/[*_`\[\]()~>#+=|{}.!-]/g, (match) => match === '*' || match === '_' ? '' : match);
          await ctx.reply(plain, { reply_markup: kb }).catch(() => {});
        });
        return;
      }

      // Check if query is financial intelligence, but only if it's NOT explicitly a book search
      if (intentData.intent === 'FINANCIAL_ANALYSIS' || (!intentData.isBookSearch && isFinancialQuery(text))) {
        const waitMsg = await ctx.reply(`🧠 *BusiMind Financial Intelligence is researching...*`, { parse_mode: 'Markdown' });
        try {
          const resp = await financialAgentRouter.handleFinancialQuery(text, ctx.from.id);
          const kb = new InlineKeyboard();
          if (resp.buttons && resp.buttons.length > 0) {
            resp.buttons.forEach((row) => {
              row.forEach((btn) => kb.text(btn.text, btn.data));
              kb.row();
            });
          }
          await safeEditMsg(ctx, waitMsg.message_id, resp.text, kb);
          return;
        } catch (err: any) {
          console.error('[Bot Financial Agent Query Error]:', err);
          await safeEditMsg(ctx, waitMsg.message_id, `⚠️ Could not complete financial analysis: ${err.message}`);
          return;
        }
      }

      // If query looks like a request for a reading path
      if (text.toLowerCase().includes('reading path') || text.toLowerCase().includes('reading plan') || text.toLowerCase().includes('from scratch')) {
        await handleReadingPathRequest(ctx, text);
        return;
      }

      // Use the cleaned text if we identified a book search
      const queryToUse = intentData.isBookSearch && intentData.cleanBookTitle ? intentData.cleanBookTitle : text;

      // Native Telegram typing feedback without cluttering chat with temporary messages
      await ctx.replyWithChatAction('typing').catch(() => {});
      const resp = await handleUserMessage(queryToUse, ctx.from.id, store.getAllBooks(), intentData.isBookSearch);

      const kb = new InlineKeyboard();
      if (resp.buttons && resp.buttons.length > 0) {
        resp.buttons.forEach((row) => {
          row.forEach((btn) => kb.text(btn.text, btn.data));
          kb.row();
        });
      }

      if (resp.photoUrl) {
        try {
          await ctx.replyWithPhoto(resp.photoUrl, {
            caption: resp.text,
            parse_mode: 'Markdown',
            reply_markup: kb,
          });
          return;
        } catch (err) {
          // Fallback
        }
      }

      await safeEditMsg(ctx, undefined, resp.text, kb);
    } catch (msgErr: any) {
      console.error('[BusiMind message:text handler error]:', msgErr?.message || msgErr);
      try {
        await ctx.reply(`💡 Welcome to **BusiMind**! You can search for any business book title, or tap /start to open the library menu.`, {
          parse_mode: 'Markdown',
        });
      } catch {}
    }
  });
}

// Helper: Handle reading path requests
async function handleReadingPathRequest(ctx: Context, goal: string) {
  const waitMsg = await ctx.reply(`🧭 *Architecting your personalized business reading path...*`, { parse_mode: 'Markdown' });
  const books = store.getAllBooks();
  const pathSteps = await generateReadingPath(goal, books);

  let output = `🗺 *YOUR BUSINESS READING PATH*\nGoal: _"${goal}"_\n\n`;
  const kb = new InlineKeyboard();

  pathSteps.forEach((step) => {
    output += `*${String(step.stepNumber).padStart(2, '0')} — ${step.phase.toUpperCase()}*\n`;
    output += `📘 *${step.book.title}* by ${step.book.author}\n`;
    output += `_${step.rationale}_\n\n`;

    kb.text(`📖 Step ${step.stepNumber}: ${step.book.title.slice(0, 24)}...`, `book_${step.book.id}`).row();
  });

  kb.text('⬅️ Main Menu', 'menu_main');

  await ctx.api.editMessageText(ctx.chat!.id, waitMsg.message_id, output, {
    parse_mode: 'Markdown',
    reply_markup: kb,
  });
}

// Helper: Handle natural search
async function handleNaturalSearch(ctx: Context, query: string) {
  const waitMsg = await ctx.reply(`🔎 *BusiMind is searching the catalog...*`, { parse_mode: 'Markdown' });
  const allBooks = store.getAllBooks();

  // 1. Direct check: Title or Author in catalog
  const directMatch = store.findBookByTitleOrAuthor(query);

  if (directMatch) {
    const { matchedBook, matchType, relatedBooks } = directMatch;

    // Multiple books by author:
    if (matchType === 'author_match' && relatedBooks && relatedBooks.length > 1) {
      store.logSearch(query, 'author_direct', relatedBooks.length);
      const kb = new InlineKeyboard();
      relatedBooks.forEach((b) => {
        const badge = b.distributionType === 'telegram_repository' ? '📖' : '📘';
        kb.text(`${badge} ${b.title}`, `book_${b.id}`).row();
      });
      kb.text('🏠 Main Menu', 'menu_main');

      const text = `✍️ *Author Found:* *${matchedBook.author}*\n\nFound *${relatedBooks.length} titles* by ${matchedBook.author} in our library repository:\n\n` +
        relatedBooks.map((b, i) => `${i + 1}. *${b.title}* (${b.category})`).join('\n') +
        `\n\n_Select any book below to view executive takeaways and access options:_`;

      await ctx.api.editMessageText(ctx.chat!.id, waitMsg.message_id, text, {
        parse_mode: 'Markdown',
        reply_markup: kb,
      });
      return;
    }

    // Single direct title or author match:
    store.logSearch(query, 'direct_match', 1);
    const helps = getBookHelpExplanation(matchedBook);
    const takeaways = getBookKeyTakeaways(matchedBook);
    const usage = ctx.from?.id ? store.getDailyUsage(ctx.from.id) : null;
    const quotaNote = usage
      ? (usage.isUnlimited ? '👑 _Admin Unlimited_' : `📊 _Allowance: ${usage.remaining}/3 left today (resets 00:00 UTC)_`)
      : '';

    const text = `*${matchedBook.title.toUpperCase()}*\n` +
      `✍️ *Author:* ${matchedBook.author}\n` +
      `📂 *Category:* ${matchedBook.category} (${matchedBook.subcategory || 'General'})\n` +
      `📊 *Difficulty:* ${matchedBook.difficulty.toUpperCase()} | *Published:* ${matchedBook.publicationYear}\n` +
      `📜 *Access Model:* ${matchedBook.distributionType === 'telegram_repository' ? '📖 Legal Repository' : '⚖️ Copyrighted'}\n\n` +
      `🚀 *How This Helps You (Practical ROI):*\n${helps}\n\n` +
      `🔑 *Key Takeaways:*\n${takeaways.map((t) => `• ${t}`).join('\n')}\n\n` +
      `📝 *Executive Overview:*\n${matchedBook.description}\n\n` +
      `💡 *Why Recommended:*\n${matchedBook.whyRecommended}\n\n` +
      `🎯 *Best Suited For:*\n${matchedBook.bestFor}\n\n` +
      quotaNote;

    await ctx.api.editMessageText(ctx.chat!.id, waitMsg.message_id, text, {
      parse_mode: 'Markdown',
      reply_markup: getBookDetailsKeyboard(matchedBook, ctx.from?.id || 0),
    });
    return;
  }

  // 2. Not in catalog: Analyze with AI / Resolver for missing book & alternatives
  const resolution = await resolveBookOrIntent(query, allBooks);

  if (resolution.isSpecificBookOrAuthor) {
    const requestedTitle = resolution.requestedTitle || query;
    const requestedAuthor = resolution.requestedAuthor;

    // Record request in Wishlist
    store.recordBookRequest(
      requestedTitle,
      requestedAuthor,
      query,
      ctx.from?.id,
      resolution.recommendations.map((r) => r.book.id),
      resolution.topic
    );
    store.logSearch(query, 'missing_book_requested', resolution.recommendations.length);

    let msg = `📕 *We currently don't have this book:*\n` +
      `*${requestedTitle}* ${requestedAuthor ? `by _${requestedAuthor}_` : ''}\n\n` +
      `📝 *We've noted your request on our Wishlist!* Our curation team actively tracks user requests to source and link requested business titles to the private repository soon.\n\n` +
      `💡 *Recommended Alternatives in BusiMind:*\n` +
      `While we work on acquiring it, here are the best titles in our library that teach the same core principles:\n\n`;

    const kb = new InlineKeyboard();

    resolution.recommendations.slice(0, 2).forEach((rec, idx) => {
      msg += `*${idx + 1}. ${rec.book.title}* by ${rec.book.author}\n` +
        `🚀 *How it helps:* ${getBookHelpExplanation(rec.book)}\n` +
        `🎯 *Why this alternative:* ${rec.reason}\n\n`;

      kb.text(`📖 View "${rec.book.title}"`, `book_${rec.book.id}`).row();
    });

    kb.text('📚 Browse Categories', 'menu_categories')
      .text('🏠 Main Menu', 'menu_main');

    await ctx.api.editMessageText(ctx.chat!.id, waitMsg.message_id, msg.trim(), {
      parse_mode: 'Markdown',
      reply_markup: kb,
    });
    return;
  }

  // 3. General discovery search
  store.logSearch(query, 'discovery', resolution.recommendations.length);

  if (resolution.recommendations.length === 0) {
    const kb = new InlineKeyboard().text('📚 Browse All Categories', 'menu_categories').row().text('🏠 Main Menu', 'menu_main');
    await ctx.api.editMessageText(
      ctx.chat!.id,
      waitMsg.message_id,
      `I couldn't find a matching book in our database for: _"${query}"_.\n\nTry exploring our curated categories or asking in different words!`,
      { parse_mode: 'Markdown', reply_markup: kb }
    );
    return;
  }

  // Send top recommendations
  const first = resolution.recommendations[0];
  const firstHelps = getBookHelpExplanation(first.book);
  const kb = new InlineKeyboard()
    .text('📖 View Book Details', `book_${first.book.id}`)
    .text('⭐ Add to Reading List', `add_list_${first.book.id}`)
    .row()
    .text('🔎 Similar Books', `sim_book_${first.book.id}`)
    .text('🤖 Ask About This Book', `ask_book_${first.book.id}`)
    .row()
    .text('🏠 Main Menu', 'menu_main');

  let text = `🎯 *Recommended for your goal:*\n\n` +
    `*${first.book.title}*\n` +
    `✍️ *Author:* ${first.book.author}\n` +
    `📂 *Category:* ${first.book.category}\n` +
    `📊 *Difficulty:* ${first.book.difficulty.toUpperCase()}\n\n` +
    `🚀 *How this helps you:*\n${firstHelps}\n\n` +
    `💡 *Why recommended for this goal:*\n${first.reason}\n\n` +
    `🎯 *Best For:* ${first.book.bestFor}`;

  if (resolution.recommendations.length > 1) {
    text += `\n\n*Other strong matches:*`;
    resolution.recommendations.slice(1).forEach((rec) => {
      text += `\n• *${rec.book.title}* (${rec.book.difficulty})`;
      kb.row().text(`👉 View "${rec.book.title}"`, `book_${rec.book.id}`);
    });
  }

  await ctx.api.editMessageText(ctx.chat!.id, waitMsg.message_id, text, {
    parse_mode: 'Markdown',
    reply_markup: kb,
  });
}

// Helper: Display reading list
async function displayReadingList(ctx: Context) {
  const books = store.getReadingList(ctx.from!.id);
  const kb = new InlineKeyboard();

  if (books.length === 0) {
    kb.text('🔎 Find Books to Add', 'menu_find').row().text('🏠 Main Menu', 'menu_main');
    const emptyText = `📚 *Your Reading List is Empty*\n\nTap *⭐ Add to Reading List* on any book card to save books here for quick access.`;
    await safeEditMsg(ctx, ctx.callbackQuery?.message?.message_id, emptyText, kb);
    return;
  }

  books.forEach((b) => {
    const cleanTitle = b.title.length > 34 ? b.title.slice(0, 32) + '…' : b.title;
    kb.text(`📖 ${cleanTitle}`, `book_${b.id}`).row();
  });
  kb.text('⬅️ Main Menu', 'menu_main');

  const text = `📚 *Your Saved Reading List (${books.length} title(s))*\n\nTap any book to view details, notes, or access options:`;
  await safeEditMsg(ctx, ctx.callbackQuery?.message?.message_id, text, kb);
}

// Global error handler for Grammy bot
if (bot) {
  bot.catch((err) => {
    const ctx = err.ctx;
    console.error(`[BusiMind] Error while handling update ${ctx.update.update_id}:`, err.error);
    // Send friendly message to user if possible
    try {
      ctx.reply('⚠️ Something went wrong processing your request. Please tap /start to reopen the main menu.')
        .catch(() => {});
    } catch {}
  });
}
