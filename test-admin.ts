import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
const app = initializeApp();
const db = getFirestore(app);
db.collection('test').get().then(() => console.log('success')).catch(e => console.log('error', e));
