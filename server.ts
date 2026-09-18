import express from 'express';
import path from 'path';
import dotenv from 'dotenv';
import { createServer as createViteServer } from 'vite';
import { webhookCallback } from 'grammy';
import { apiRouter, setWebhookLifecycleHooks } from './server/routes/api';
import { bot, isBotTokenConfigured } from './server/telegram/bot';

dotenv.config();

process.on('uncaughtException', (err) => {
  console.error('[Uncaught Exception] CRITICAL ERROR:', err);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('[Unhandled Rejection] Promise:', promise, 'Reason:', reason);
});

const handleShutdown = async (signal: string) => {
  console.log(`[BusiMind] Received ${signal}, closing bot polling cleanly...`);
  await stopPollingRunner();
  process.exit(0);
};

process.on('SIGTERM', () => handleShutdown('SIGTERM'));
process.on('SIGINT', () => handleShutdown('SIGINT'));

const app = express();
const PORT = 3000;

app.use(express.json());

// Mount API routes
app.use('/api', apiRouter);

// Telegram Webhook Endpoint
// We are using long polling exclusively for this deployment to ensure stability across preview domains.
// (webhookCallback is intentionally removed to avoid conflicts with bot.start())

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    botTokenConfigured: isBotTokenConfigured,
    mode: process.env.NODE_ENV === 'production' ? 'webhook' : 'long_polling',
    timestamp: new Date().toISOString(),
  });
});

// Telegram Webhook & Long Polling Engine
let isPollingActive = false;

export async function stopPollingRunner() {
  if (bot && bot.isRunning()) {
    try {
      await bot.stop();
      isPollingActive = false;
      console.log('[BusiMind] Long polling runner stopped cleanly.');
    } catch (e: any) {
      console.warn('[BusiMind] Error stopping polling runner:', e?.message || e);
    }
  }
}

export function startPollingRunner() {
  if (!bot || isPollingActive || (bot.isRunning && bot.isRunning())) return;
  isPollingActive = true;

  bot.start({
    drop_pending_updates: false,
    allowed_updates: ['message', 'callback_query', 'channel_post', 'edited_channel_post'],
    onStart: (botInfo) => {
      console.log(`[BusiMind] Telegram Bot @${botInfo.username} is ONLINE & listening for messages/buttons!`);
    },
  }).catch((err: any) => {
    isPollingActive = false;
    const isConflict = err?.error_code === 409 || err?.message?.includes('409');
    if (isConflict) {
      console.log('[BusiMind] Previous Telegram polling connection closing (409), resuming in 6s...');
      setTimeout(() => {
        if (!isPollingActive && bot && !bot.isRunning()) {
          startPollingRunner();
        }
      }, 6000);
    } else {
      console.warn('[BusiMind] Polling loop paused:', err?.message || err);
      setTimeout(() => {
        if (!isPollingActive && bot && !bot.isRunning()) {
          console.log('[BusiMind] Reconnecting Telegram polling runner...');
          startPollingRunner();
        }
      }, 3000);
    }
  });
}

async function initTelegramBotEngine() {
  if (!bot || !isBotTokenConfigured) {
    console.log('[BusiMind] Telegram Bot Token not yet configured or pending.');
    return;
  }

  try {
    // 1. Initialize bot info metadata upfront so webhookCallback and context handling never fail
    await bot.init();
    console.log(`[BusiMind] Telegram Bot @${bot.botInfo.username} (ID: ${bot.botInfo.id}) initialized successfully.`);
  } catch (err: any) {
    console.warn('[BusiMind] Telegram bot.init() warning:', err?.message || err);
  }

  // 2. Force delete any existing webhook so long polling works flawlessly
  try {
    await bot.api.deleteWebhook({ drop_pending_updates: false });
    console.log('[BusiMind] Cleared any existing webhooks.');
  } catch (e) {
    console.warn('[BusiMind] Non-fatal error deleting webhook:', e);
  }

  console.log('[BusiMind] Starting long polling runner...');
  startPollingRunner();
}

// Register webhook toggle hooks
setWebhookLifecycleHooks({
  onSetup: stopPollingRunner,
  onClear: () => startPollingRunner(),
});

// Start bot engine after express router setup
initTelegramBotEngine();

async function startServer() {
  // Vite middleware in development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[BusiMind] Server active and listening on http://0.0.0.0:${PORT}`);
  });

  // Background store initialization so server starts instantly
  import('./server/data/store')
    .then(({ store }) => store.initializeFirestore())
    .catch((err) => console.warn('[BusiMindStore] Notice during store startup:', err?.message || err));
}

startServer();
