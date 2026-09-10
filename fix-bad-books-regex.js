const fs = require('fs');
const path = 'data/busimind-store.json';

let data = JSON.parse(fs.readFileSync(path, 'utf8'));
let booksToFix = data.books.filter(b => b.author === 'Channel Library');

console.log(`Found ${booksToFix.length} books to fix.`);
let fixed = 0;

const manualOverrides = {
  'cad861e978996747a1a43ae25805507d': { title: 'Unknown Business Book', author: 'Unknown Author', category: 'Entrepreneurship' },
  'Talk Like TED By Carmine Gallo': { title: 'Talk Like TED', author: 'Carmine Gallo', category: 'Marketing & Sales', isbn13: '9781250041128' },
  'The Goal A Process of Ongoing Improvement 30th': { title: 'The Goal: A Process of Ongoing Improvement', author: 'Eliyahu M. Goldratt', category: 'Leadership & Management', isbn13: '9780884271956' },
  'The Effective Executive By Peter F  Drucker': { title: 'The Effective Executive', author: 'Peter F. Drucker', category: 'Leadership & Management', isbn13: '9780060833459' },
  'The Effective Executive By Peter F  Drucker (1)': { title: 'The Effective Executive', author: 'Peter F. Drucker', category: 'Leadership & Management', isbn13: '9780060833459' },
  'Atomic Habits': { title: 'Atomic Habits', author: 'James Clear', category: 'Mindset & Psychology', isbn13: '9780735211292' },
  'The Psychology of Money  Timele   Morgan Housel': { title: 'The Psychology of Money', author: 'Morgan Housel', category: 'Money & Investing', isbn13: '9780857197689' }
};

for (let book of booksToFix) {
  const override = manualOverrides[book.title];
  if (override) {
    book.title = override.title;
    book.author = override.author;
    book.category = override.category;
    if (override.isbn13) {
      const cleanIsbn = override.isbn13.replace(/[^0-9X]/gi, '');
      book.coverImageUrl = `https://covers.openlibrary.org/b/isbn/${cleanIsbn}-L.jpg`;
    }
    fixed++;
    console.log(` -> Fixed as: ${book.title} by ${book.author}`);
  }
}

if (fixed > 0) {
  fs.writeFileSync(path, JSON.stringify(data, null, 2));
  console.log('Saved fixed books to store.');
}
