import { initializeApp } from 'firebase/app';
import { initializeFirestore, collection, getDocs } from 'firebase/firestore';
import config from './firebase-applet-config.json';
const app = initializeApp(config);
const db = initializeFirestore(app, { experimentalForceLongPolling: true }, config.firestoreDatabaseId);
getDocs(collection(db, 'books')).then(() => {
  console.log('success');
  process.exit(0);
}).catch(e => {
  console.log('error', e);
  process.exit(1);
});
