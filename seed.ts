import { doc, setDoc } from 'firebase/firestore';
import { db } from './server/data/firestoreConfig';
import { INITIAL_BOOKS } from './server/data/initialBooks';

async function seed() {
  console.log(`Seeding ${INITIAL_BOOKS.length} books...`);
  let count = 0;
  for (const book of INITIAL_BOOKS) {
    try {
      await setDoc(doc(db, 'books', book.id), book);
      count++;
    } catch (e) {
      console.error(`Failed to seed ${book.title}`, e);
    }
  }
  console.log(`Successfully seeded ${count} books.`);
  process.exit(0);
}
seed();
