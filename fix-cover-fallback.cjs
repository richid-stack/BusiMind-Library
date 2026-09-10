const fs = require('fs');
let store = JSON.parse(fs.readFileSync('data/busimind-store.json', 'utf8'));

// If a book lacks a coverImageUrl but it has an ISBN-13 (we might not store ISBN directly, but maybe we can trigger a Google Books API fetch or just rely on a default fallback in the frontend). 
// Wait, the frontend *does* have a fallback (the stylized jacket). The user is complaining that "storefront still shows a lot of the ones that have no covers". 
// To really fix missing covers, we can use the OpenLibrary Search API or Google Books API based on the title and author, and retroactively add covers.

const fetch = require('node-fetch');

async function fixMissingCovers() {
  let booksToFix = store.books.filter(b => !b.coverImageUrl);
  console.log(`Found ${booksToFix.length} books missing covers.`);
  
  let fixed = 0;
  for (let book of booksToFix) {
    if (book.title && book.title !== 'Unknown Business Book') {
      try {
        console.log(`Searching cover for: ${book.title} by ${book.author}`);
        // Use OpenLibrary Search API
        const query = encodeURIComponent(`${book.title} ${book.author || ''}`.trim());
        const response = await fetch(`https://openlibrary.org/search.json?q=${query}&limit=1`);
        const data = await response.json();
        
        if (data.docs && data.docs.length > 0) {
          const doc = data.docs[0];
          if (doc.cover_i) {
            book.coverImageUrl = `https://covers.openlibrary.org/b/id/${doc.cover_i}-L.jpg`;
            fixed++;
            console.log(` -> Found cover: ${book.coverImageUrl}`);
          } else if (doc.isbn && doc.isbn.length > 0) {
            // Find an isbn13 if possible
            const isbn = doc.isbn.find(i => i.length === 13) || doc.isbn[0];
            book.coverImageUrl = `https://covers.openlibrary.org/b/isbn/${isbn}-L.jpg`;
            fixed++;
            console.log(` -> Found ISBN cover: ${book.coverImageUrl}`);
          }
        }
      } catch (err) {
        console.log(` -> Failed to search for ${book.title}`);
      }
      // slight delay
      await new Promise(r => setTimeout(r, 1000));
    }
  }
  
  if (fixed > 0) {
    fs.writeFileSync('data/busimind-store.json', JSON.stringify(store, null, 2));
    console.log(`Fixed ${fixed} covers.`);
  } else {
    console.log("No new covers found.");
  }
}

fixMissingCovers();
