import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';
import config from './firebase-applet-config.json';
const app = initializeApp(config);
const db = getFirestore(app, config.firestoreDatabaseId);
getDocs(collection(db, 'test')).then(() => console.log('success')).catch(e => console.log('error', e));
