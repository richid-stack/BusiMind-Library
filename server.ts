import express from 'express';
import path from 'path';
import dotenv from 'dotenv';
import { createServer as createViteServer } from 'vite';
import { webhookCallback } from 'grammy';
import { apiRouter, setWebhookLifecycleHooks } from './server/routes/api';
import { bot, isBotTokenConfigured } from './server/telegram/bot';

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json());

// Mount API routes
app.use('/api', apiRouter);

// Telegram Webhook Endpoint
if (bot && isBotTokenConfigured) {
  const handler = webhookCallback(bot, 'express');
  app.use('/telegram/webhook', handler);
  app.use('/api/telegram/webhook', handler);
}

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
    console.error('[BusiMind] Polling loop paused or interrupted:', err?.message || err);
    // Auto-reconnect after 3 seconds if disconnected
    setTimeout(() => {
      if (!isPollingActive && bot && !bot.isRunning()) {
        console.log('[BusiMind] Reconnecting Telegram polling runner...');
        startPollingRunner();
      }
    }, 3000);
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
    console.error('[BusiMind] Telegram bot.init() warning:', err?.message || err);
  }

  // 2. Check if a webhook is currently active on Telegram's side
  try {
    const webhookInfo = await bot.api.getWebhookInfo();
    const hasWebhookUrl = Boolean(webhookInfo.url && webhookInfo.url.trim() !== '');

    if (hasWebhookUrl) {
      console.log(`[BusiMind] Telegram Webhook is ACTIVE at: ${webhookInfo.url}`);
      return;
    }

    // No webhook active: start resilient polling
    console.log('[BusiMind] No Telegram Webhook configured. Starting long polling runner...');
    startPollingRunner();
  } catch (err: any) {
    console.error('[BusiMind] Failed to query webhook info, starting polling runner:', err?.message || err);
    startPollingRunner();
  }
}

// Register webhook toggle hooks
setWebhookLifecycleHooks({
  onSetup: stopPollingRunner,
  onClear: () => startPollingRunner(),
});

// Start bot engine after express router setup
initTelegramBotEngine();

async function startServer() {
  const { store } = await import('./server/data/store');
  await store.initializeFirestore();
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
}

startServer();
