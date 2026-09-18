import { initializeApp, getApps, App } from 'firebase-admin/app';
import { getFirestore, Firestore } from 'firebase-admin/firestore';
import config from '../../firebase-applet-config.json';

const app: App = getApps().length > 0
  ? getApps()[0]
  : initializeApp({
      projectId: config.projectId,
    });

export const adminDb: Firestore = getFirestore(app, config.firestoreDatabaseId);

