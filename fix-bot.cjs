const fs = require('fs');
let code = fs.readFileSync('server/telegram/bot.ts', 'utf8');

const imports = `import { autoIndexChannelAsset, getBookHelpExplanation, queryBookForRAG } from '../services/indexer';
import pdfParse from 'pdf-parse';
import { GoogleGenAI, Type } from '@google/genai';`;

code = code.replace(
  `import { autoIndexChannelAsset, getBookHelpExplanation, queryBookForRAG } from '../services/indexer';`, 
  imports
);


const deepScanCode = `
  bot.callbackQuery(/^scan_(.+)$/, async (ctx) => {
    const bookId = ctx.match[1];
    const book = store.getBookById(bookId);
    
    if (!book || !book.fileId) {
      return ctx.answerCallbackQuery({ text: '❌ Cannot scan this file (file ID missing).', show_alert: true });
    }
    
    await ctx.answerCallbackQuery({ text: '🔍 Downloading and deeply analyzing file... This may take up to 20 seconds.' });
    
    try {
      const file = await bot.api.getFile(book.fileId);
      const url = \`https://api.telegram.org/file/bot\${process.env.TELEGRAM_BOT_TOKEN}/\${file.file_path}\`;
      
      const response = await fetch(url);
      const buffer = await response.arrayBuffer();
      
      let snippet = "";
      if (book.fileType === 'application/pdf' || (file.file_path && file.file_path.endsWith('.pdf'))) {
        const pdfData = await pdfParse(Buffer.from(buffer));
        snippet = pdfData.text.substring(0, 4000); 
      } else {
        // Fallback for epubs or txt, grab first 4000 raw bytes and strip non text
        snippet = Buffer.from(buffer).toString('utf8').replace(/[^a-zA-Z0-9 \\n.,;:'"?!()]/g, '').substring(0, 4000);
      }
      
      if (!snippet || snippet.length < 50) {
        return ctx.reply('❌ Could not extract enough text from the file for a deep scan.');
      }

      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const prompt = \`I am trying to identify a book whose filename is unreadable. Read the following text extracted from the first few pages of the document. Based on this excerpt, identify the true canonical title, author, category, and ISBN-13 of the book. 
      
      TEXT EXCERPT:
      \${snippet}
      
      Return pure JSON matching this schema:
      {
        "title": "Clean Canonical Title",
        "author": "Real Author",
        "category": "Entrepreneurship",
        "isbn13": "978..."
      }\`;

      const aiResponse = await ai.models.generateContent({
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
              isbn13: { type: Type.STRING, nullable: true }
            },
            required: ['title', 'author', 'category']
          }
        }
      });
      
      const parsed = JSON.parse(aiResponse.text || '{}');
      
      if (parsed.title && parsed.title.toLowerCase() !== 'unknown') {
        let newCover = book.coverImageUrl;
        if (parsed.isbn13) {
          const cleanIsbn = parsed.isbn13.replace(/[^0-9X]/gi, '');
          if (cleanIsbn.length >= 10) newCover = \`https://covers.openlibrary.org/b/isbn/\${cleanIsbn}-L.jpg\`;
        }
        
        book.title = parsed.title;
        book.author = parsed.author;
        book.category = parsed.category || book.category;
        book.coverImageUrl = newCover;
        // In this architecture, we update directly and save:
        store.addBook(book); 
        
        await ctx.reply(\`✅ **Deep Scan Complete!**\\n\\nIdentified as:\\n📖 *\${parsed.title}*\\n✍️ by \${parsed.author}\\n\\nThe store has been updated automatically.\`, {
          parse_mode: 'Markdown',
          reply_markup: new InlineKeyboard().text('📖 View Updated Card', \`book_\${book.id}\`)
        });
      } else {
        await ctx.reply('⚠️ Deep scan completed but could not definitively identify the book from the text excerpt.');
      }
    } catch (err) {
      console.error('Deep scan error:', err);
      await ctx.reply(\`❌ Error during deep scan: \${err.message}\`);
    }
  });

  bot.callbackQuery('admin_view_requests',`;

code = code.replace(`  bot.callbackQuery('admin_view_requests',`, deepScanCode);


const viewAssetCard = `.text('📖 View Asset Card', \`book_\${result.book.id}\`)
              .text('🔍 Deep Scan PDF', \`scan_\${result.book.id}\`)`;

code = code.replace(`.text('📖 View Asset Card', \`book_\${result.book.id}\`)`, viewAssetCard);


const openCard = `.text('📖 Open Card', \`book_\${result.book.id}\`)
                .text('⚡ Test Deliver', \`dl_\${result.book.id}\`)
                .text('🔍 Deep Scan PDF', \`scan_\${result.book.id}\`)`;

code = code.replace(
  `.text('📖 Open Card', \`book_\${result.book.id}\`)
                .text('⚡ Test Deliver', \`dl_\${result.book.id}\`)`,
  openCard
);

fs.writeFileSync('server/telegram/bot.ts', code);
