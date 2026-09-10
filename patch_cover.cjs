const fs = require('fs');

let content = fs.readFileSync('server/services/coverResolver.ts', 'utf-8');

content = `/**
 * Cover Image Resolver Service
 * Automatically fetches high-resolution book jackets from Google Books API and OpenLibrary
 */
export async function resolveBookCover(
  title: string,
  author?: string,
  isbn13?: string | null
): Promise<string | undefined> {
  const cleanIsbn = isbn13 ? isbn13.replace(/[^0-9X]/gi, '') : null;
  const cleanTitle = title
    .replace(/^OceanofPDF(\\.com)?\\s*/i, '')
    .replace(/^toaz(\\.info)?\\s*/i, '')
    .replace(/\\.(pdf|epub|mobi)$/i, '')
    .replace(/[_.-]+/g, ' ')
    .trim();
  const cleanAuthor = author && author.toLowerCase() !== 'channel library' && author.toLowerCase() !== 'unknown author'
    ? author.trim()
    : '';

  if (!cleanTitle || cleanTitle.toLowerCase() === 'untitled business asset' || cleanTitle.toLowerCase() === 'unknown business book') {
    return undefined;
  }

  // 1. Try Google Books API First (if key is configured)
  if (process.env.GOOGLE_BOOKS_API_KEY) {
    try {
      const apiKey = process.env.GOOGLE_BOOKS_API_KEY;
      let query = '';
      if (cleanIsbn && cleanIsbn.length >= 10) {
        query = \`isbn:\${cleanIsbn}\`;
      } else {
        query = \`intitle:\${encodeURIComponent(cleanTitle)}\`;
        if (cleanAuthor) query += \`+inauthor:\${encodeURIComponent(cleanAuthor)}\`;
      }

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 3500);
      
      const res = await fetch(\`https://www.googleapis.com/books/v1/volumes?q=\${query}&key=\${apiKey}&maxResults=1\`, {
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (res.ok) {
        const data = await res.json();
        if (data.items && data.items.length > 0) {
          const volumeInfo = data.items[0].volumeInfo;
          if (volumeInfo.imageLinks) {
            let imageUrl = volumeInfo.imageLinks.thumbnail || volumeInfo.imageLinks.smallThumbnail;
            if (imageUrl) {
              imageUrl = imageUrl.replace('http:', 'https:').replace('&edge=curl', '');
              return imageUrl;
            }
          }
        }
      }
    } catch (err) {
      console.warn('[CoverResolver] Google Books API failed, falling back to OpenLibrary...', err);
    }
  }

  // 2. OpenLibrary Fallback (Direct ISBN)
  if (cleanIsbn && cleanIsbn.length >= 10) {
    return \`https://covers.openlibrary.org/b/isbn/\${cleanIsbn}-L.jpg\`;
  }

  // 3. OpenLibrary Fallback (Search API)
  try {
    const query = encodeURIComponent(\`\${cleanTitle} \${cleanAuthor}\`.trim());
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3500);
    
    const res = await fetch(\`https://openlibrary.org/search.json?q=\${query}&limit=1\`, {
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (res.ok) {
      const data = await res.json();
      if (data?.docs && data.docs.length > 0) {
        const doc = data.docs[0];
        if (doc.cover_i) {
          return \`https://covers.openlibrary.org/b/id/\${doc.cover_i}-L.jpg\`;
        }
        if (doc.isbn && doc.isbn.length > 0) {
          const isbn = doc.isbn.find((i) => i.length === 13) || doc.isbn[0];
          return \`https://covers.openlibrary.org/b/isbn/\${isbn}-L.jpg\`;
        }
      }
    }
  } catch (err) {
    // Timeout or network glitch, fail gracefully
  }

  return undefined;
}`;

fs.writeFileSync('server/services/coverResolver.ts', content);
