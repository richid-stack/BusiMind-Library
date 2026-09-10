const fs = require('fs');
let code = fs.readFileSync('server/telegram/bot.ts', 'utf8');

// We need to add admin auth checks to the callback queries: admin_refresh, admin_list_books, admin_view_requests, and scan_

function addAuthCheck(strToFind, replacement) {
  code = code.replace(strToFind, replacement);
}

// 1. admin_list_books
addAuthCheck(
  "bot.callbackQuery('admin_list_books', async (ctx) => {",
  `bot.callbackQuery('admin_list_books', async (ctx) => {
    const adminId = process.env.ADMIN_TELEGRAM_ID ? Number(process.env.ADMIN_TELEGRAM_ID) : null;
    if (!adminId || ctx.from?.id !== adminId) return ctx.answerCallbackQuery({ text: '⛔ Unauthorized', show_alert: true });`
);

// 2. admin_view_requests
addAuthCheck(
  "bot.callbackQuery('admin_view_requests', async (ctx) => {",
  `bot.callbackQuery('admin_view_requests', async (ctx) => {
    const adminId = process.env.ADMIN_TELEGRAM_ID ? Number(process.env.ADMIN_TELEGRAM_ID) : null;
    if (!adminId || ctx.from?.id !== adminId) return ctx.answerCallbackQuery({ text: '⛔ Unauthorized', show_alert: true });`
);

// 3. scan_
addAuthCheck(
  "bot.callbackQuery(/^scan_(.+)$/, async (ctx) => {",
  `bot.callbackQuery(/^scan_(.+)$/, async (ctx) => {
    const adminId = process.env.ADMIN_TELEGRAM_ID ? Number(process.env.ADMIN_TELEGRAM_ID) : null;
    if (!adminId || ctx.from?.id !== adminId) return ctx.answerCallbackQuery({ text: '⛔ Unauthorized', show_alert: true });`
);

// 4. Also missing admin_refresh which was referenced but not implemented? Let's check if it exists.
if (!code.includes("bot.callbackQuery('admin_refresh'")) {
  const adminRefreshCode = `
  bot.callbackQuery('admin_refresh', async (ctx) => {
    const adminId = process.env.ADMIN_TELEGRAM_ID ? Number(process.env.ADMIN_TELEGRAM_ID) : null;
    if (!adminId || ctx.from?.id !== adminId) return ctx.answerCallbackQuery({ text: '⛔ Unauthorized', show_alert: true });
    
    await ctx.answerCallbackQuery();
    const stats = store.getStoreStats();
    
    const text = \`👑 *BusiMind Administrator Dashboard*\n\n\` +
      \`📊 *System Statistics:*\n\` +
      \`• Total Books/Assets: \${stats.totalBooks}\n\` +
      \`• Pending Requests: \${stats.pendingBookRequests || 0}\n\` +
      \`• Registered Users: \${stats.totalUsers || 0}\n\n\` +
      \`*Admin Tools:*\n\` +
      \`Forward any document from your private channel here to auto-index it.\`;

    const adminKb = new InlineKeyboard()
      .text('📋 View Book IDs', 'admin_list_books')
      .text(\`📝 Requests (\${stats.pendingBookRequests || 0})\`, 'admin_view_requests')
      .row()
      .text('🔄 Refresh Stats', 'admin_refresh')
      .text('🏠 Main Menu', 'menu_main');

    try {
      await ctx.editMessageText(text, { parse_mode: 'Markdown', reply_markup: adminKb });
    } catch(e) {
      // Ignored if message text hasn't changed
    }
  });
  `;
  
  code = code.replace(
    "bot.callbackQuery('admin_list_books',",
    adminRefreshCode + "\n\n  bot.callbackQuery('admin_list_books',"
  );
}

fs.writeFileSync('server/telegram/bot.ts', code);
