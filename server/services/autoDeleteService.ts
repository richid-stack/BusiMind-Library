import fs from 'fs';
import path from 'path';
import { InlineKeyboard, InputFile } from 'grammy';
import { Book } from '../../src/types';
import { sanitizeBookFileName, generateDeliveryCaption } from './fileSanitizer';

export interface PendingDeletion {
  id: string;
  chatId: number;
  fileMessageId: number;
  alertMessageId?: number;
  bookTitle: string;
  createdAt: number;
  expireAt: number;
}

const STORAGE_FILE = path.join(process.cwd(), 'server', 'data', 'pendingDeletions.json');

class AutoDeleteService {
  private activeTimers = new Map<string, NodeJS.Timeout>();
  private pending: PendingDeletion[] = [];
  private botInstance: any = null;

  constructor() {
    this.loadFromDisk();
  }

  public setBot(bot: any) {
    this.botInstance = bot;
    // Resume or process expired deletions on bot ready
    this.processPendingDeletions();
  }

  private loadFromDisk() {
    try {
      if (fs.existsSync(STORAGE_FILE)) {
        const raw = fs.readFileSync(STORAGE_FILE, 'utf-8');
        this.pending = JSON.parse(raw);
        console.log(`[AutoDeleteService] Loaded ${this.pending.length} pending deletions from disk.`);
      }
    } catch (e) {
      console.warn('[AutoDeleteService] Failed to load pendingDeletions.json:', e);
      this.pending = [];
    }
  }

  private saveToDisk() {
    try {
      const dir = path.dirname(STORAGE_FILE);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(STORAGE_FILE, JSON.stringify(this.pending, null, 2), 'utf-8');
    } catch (e) {
      console.warn('[AutoDeleteService] Failed to save pendingDeletions.json:', e);
    }
  }

  /**
   * Called on boot to either delete overdue messages immediately or schedule remaining time
   */
  public processPendingDeletions() {
    if (!this.botInstance) return;

    const now = Date.now();
    const toProcess = [...this.pending];

    for (const item of toProcess) {
      const remaining = item.expireAt - now;
      if (remaining <= 0) {
        console.log(`[AutoDeleteService] Overdue deletion for "${item.bookTitle}" (chat ${item.chatId}), deleting now.`);
        this.executeDeletion(item);
      } else {
        console.log(`[AutoDeleteService] Resuming deletion timer for "${item.bookTitle}": ${Math.round(remaining / 1000)}s left.`);
        this.armTimer(item, remaining);
      }
    }
  }

  private armTimer(item: PendingDeletion, delayMs: number) {
    // Clear existing timer if any
    if (this.activeTimers.has(item.id)) {
      clearTimeout(this.activeTimers.get(item.id)!);
    }

    const timer = setTimeout(() => {
      this.activeTimers.delete(item.id);
      this.executeDeletion(item);
    }, delayMs);

    this.activeTimers.set(item.id, timer);
  }

  /**
   * Schedule a 2-minute auto-deletion for a delivered book file and alert message
   */
  public scheduleDeletion(params: {
    chatId: number;
    fileMessageId: number;
    alertMessageId?: number;
    bookTitle: string;
    delayMs?: number;
  }) {
    const delayMs = params.delayMs ?? 120_000; // 2 minutes default
    const now = Date.now();
    const item: PendingDeletion = {
      id: `${params.chatId}_${params.fileMessageId}_${now}`,
      chatId: params.chatId,
      fileMessageId: params.fileMessageId,
      alertMessageId: params.alertMessageId,
      bookTitle: params.bookTitle,
      createdAt: now,
      expireAt: now + delayMs,
    };

    this.pending.push(item);
    this.saveToDisk();

    console.log(`[AutoDeleteService] Scheduled 2-minute auto-delete for "${item.bookTitle}" (Chat ${item.chatId}, FileMsg #${item.fileMessageId}).`);
    this.armTimer(item, delayMs);
  }

  /**
   * Executes deletion of the file and warning alert, then posts a confirmation notice
   */
  public async executeDeletion(item: PendingDeletion) {
    if (!this.botInstance) {
      console.warn('[AutoDeleteService] Bot not initialized, cannot delete messages.');
      return;
    }

    const { chatId, fileMessageId, alertMessageId, bookTitle } = item;

    // 1. Delete the book file
    try {
      await this.botInstance.api.deleteMessage(chatId, fileMessageId);
      console.log(`[AutoDeleteService] Deleted book file msg #${fileMessageId} in chat ${chatId}.`);
    } catch (err: any) {
      console.warn(`[AutoDeleteService] Could not delete file msg #${fileMessageId}:`, err?.message || err);
    }

    // 2. Delete the timer warning alert if present
    if (alertMessageId) {
      try {
        await this.botInstance.api.deleteMessage(chatId, alertMessageId);
        console.log(`[AutoDeleteService] Deleted alert msg #${alertMessageId} in chat ${chatId}.`);
      } catch (err: any) {
        console.warn(`[AutoDeleteService] Could not delete alert msg #${alertMessageId}:`, err?.message || err);
      }
    }

    // 3. Post a polite expiration confirmation in chat
    try {
      await this.botInstance.api.sendMessage(
        chatId,
        `🗑️ *File Expired & Auto-Deleted:*\n\n` +
        `The 2-minute temporary window for *${bookTitle}* has elapsed, and the document was removed from this chat.\n\n` +
        `💡 _If you forwarded it to your Saved Messages, it remains safely in your personal account for uninterrupted reading!_`,
        {
          parse_mode: 'Markdown',
          reply_markup: new InlineKeyboard()
            .text('📚 Browse Catalog', 'menu_categories')
            .text('🏠 Main Menu', 'menu_main'),
        }
      );
    } catch (notifyErr: any) {
      console.warn(`[AutoDeleteService] Notice error in chat ${chatId}:`, notifyErr?.message || notifyErr);
    }

    // 4. Remove from pending list and update disk
    this.pending = this.pending.filter((p) => p.id !== item.id);
    this.saveToDisk();
  }

  /**
   * Unified single-entry-point method to deliver a book with guaranteed 2-minute auto-deletion
   */
  public async deliverBookWithAutoDelete(options: {
    chatId: number;
    book: Book;
    source?: string;
    customNote?: string;
  }): Promise<{ success: boolean; deliveredMessageId?: number; error?: string }> {
    if (!this.botInstance) {
      return { success: false, error: 'Telegram bot is not initialized' };
    }

    const { chatId, book } = options;
    const channelId = book.channelChatId || process.env.TELEGRAM_CHANNEL_ID;
    const messageId = book.channelMessageId;

    if (!channelId || !messageId) {
      return { success: false, error: 'Book does not have a channel message ID linked yet.' };
    }

    const cleanFileName = sanitizeBookFileName(book.fileName, book.title, book.author);
    const brandedCaption = generateDeliveryCaption(book.title, book.author, cleanFileName);

    let deliveredMsgId: number | undefined;

    try {
      // 1. If we have a fileId, stream the bytes through Telegram Bot API getFile
      // to upload with InputFile(buffer, cleanFileName)
      const botToken = process.env.TELEGRAM_BOT_TOKEN;
      if (book.fileId && botToken) {
        try {
          const fileInfo = await this.botInstance.api.getFile(book.fileId);
          if (fileInfo.file_path) {
            const downloadUrl = `https://api.telegram.org/file/bot${botToken}/${fileInfo.file_path}`;
            const fileRes = await fetch(downloadUrl);
            if (fileRes.ok) {
              const arrayBuffer = await fileRes.arrayBuffer();
              const fileBuffer = Buffer.from(arrayBuffer);
              const inputFile = new InputFile(fileBuffer, cleanFileName);

              const docMsg = await this.botInstance.api.sendDocument(chatId, inputFile, {
                caption: brandedCaption,
                parse_mode: 'Markdown',
              });
              deliveredMsgId = docMsg.message_id;
            }
          }
        } catch (streamErr: any) {
          console.warn('[AutoDeleteService direct file upload fallback]:', streamErr?.message || streamErr);
        }
      }

      // 2. Fast copyMessage fallback
      if (!deliveredMsgId) {
        const copyResult = await this.botInstance.api.copyMessage(chatId, channelId, messageId, {
          caption: brandedCaption,
          parse_mode: 'Markdown',
        });
        deliveredMsgId = copyResult.message_id;
      }

      if (!deliveredMsgId) {
        return { success: false, error: 'Failed to deliver message via Telegram' };
      }

      // 3. Send the explicit 2-minute self-destruct warning message
      let alertMsgId: number | undefined;
      try {
        const alert = await this.botInstance.api.sendMessage(
          chatId,
          `✅ *${book.title}* [Delivered to this chat]\n` +
          `📄 *Document:* \`${cleanFileName}\`\n\n` +
          `⏳ *SELF-DESTRUCT TIMER ACTIVATED (2 MINUTES)* ⏳\n` +
          `⚠️ *Important Notice:* This book file will be *automatically deleted from this chat in exactly 2 minutes* (120 seconds)!\n\n` +
          `📲 *HOW TO KEEP THIS FILE PERMANENTLY:*\n` +
          `👉 *Forward the document above to your "Saved Messages" right now!*\n` +
          `_Once saved in your personal Saved Messages (or forwarded to your private chat), it will remain accessible forever, even after it vanishes from this chat._`,
          {
            parse_mode: 'Markdown',
            reply_markup: new InlineKeyboard()
              .text('⭐ Save to Reading List', `add_list_${book.id}`)
              .text('🏠 Main Menu', 'menu_main'),
          }
        );
        alertMsgId = alert.message_id;
      } catch (alertErr: any) {
        console.warn('[AutoDeleteService alert send warning]:', alertErr?.message || alertErr);
      }

      // 4. Register and start the 2-minute auto-deletion timer
      this.scheduleDeletion({
        chatId,
        fileMessageId: deliveredMsgId,
        alertMessageId: alertMsgId,
        bookTitle: book.title,
        delayMs: 120_000, // 2 minutes
      });

      return { success: true, deliveredMessageId: deliveredMsgId };
    } catch (err: any) {
      console.error('[AutoDeleteService delivery error]:', err);
      return { success: false, error: err?.message || 'Failed to deliver file' };
    }
  }
}

export const autoDeleteService = new AutoDeleteService();
