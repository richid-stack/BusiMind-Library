import { initializeApp } from 'firebase/app';
import { initializeFirestore } from 'firebase/firestore';
import config from '../../firebase-applet-config.json';

export const firebaseApp = initializeApp(config);
export const db = initializeFirestore(firebaseApp, {
  experimentalForceLongPolling: true
}, config.firestoreDatabaseId);
