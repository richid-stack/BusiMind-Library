import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import config from './firebase-applet-config.json';
const app = initializeApp({ projectId: config.projectId });
const db = getFirestore(app);
db.settings({ databaseId: config.firestoreDatabaseId, ignoreUndefinedProperties: true });
db.collection('test').get().then(() => console.log('success admin3')).catch(e => console.log('error admin3', e));
