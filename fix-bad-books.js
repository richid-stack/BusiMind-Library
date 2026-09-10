const fs = require('fs');
const { GoogleGenAI, Type } = require('@google/genai');
const path = 'data/busimind-store.json';

async function fixBooks() {
  if (!process.env.GEMINI_API_KEY) {
    console.error("No API key");
    return;
  }
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  let data = JSON.parse(fs.readFileSync(path, 'utf8'));
  let booksToFix = data.books.filter(b => b.author === 'Channel Library');
  
  console.log(`Found ${booksToFix.length} books to fix.`);
  let fixed = 0;

  for (let book of booksToFix) {
    console.log(`Fixing: ${book.title}...`);
    const prompt = `Identify the real business/management/startup book from this messy filename: "${book.title}".
    Provide the canonical title, author, and isbn13.
    Return pure JSON matching this schema:
    {
      "title": "Clean Canonical Title",
      "author": "Real Author",
      "category": "Entrepreneurship | Money & Investing | Leadership & Management",
      "isbn13": "978..."
    }`;

    try {
      const response = await ai.models.generateContent({
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
      const parsed = JSON.parse(response.text || '{}');
      if (parsed.title) {
        book.title = parsed.title;
        book.author = parsed.author || book.author;
        book.category = parsed.category || book.category;
        if (parsed.isbn13) {
          const cleanIsbn = parsed.isbn13.replace(/[^0-9X]/gi, '');
          if (cleanIsbn.length >= 10) {
            book.coverImageUrl = `https://covers.openlibrary.org/b/isbn/${cleanIsbn}-L.jpg`;
          }
        }
        fixed++;
        console.log(` -> Fixed as: ${book.title} by ${book.author}`);
      }
    } catch(err) {
      console.log(` -> Failed: ${err.message}`);
    }
    // Sleep to prevent rate limits
    await new Promise(r => setTimeout(r, 2000));
  }
  
  if (fixed > 0) {
    fs.writeFileSync(path, JSON.stringify(data, null, 2));
    console.log('Saved fixed books to store.');
  }
}

fixBooks();
