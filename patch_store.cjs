const fs = require('fs');

let content = fs.readFileSync('server/data/store.ts', 'utf-8');

// Add imports
content = `import { collection, doc, setDoc, deleteDoc, getDocs, onSnapshot } from 'firebase/firestore';\nimport { db } from './firestoreConfig';\n` + content;

// Remove fs
content = content.replace(/import fs from 'fs';\n/, '');
content = content.replace(/import path from 'path';\n/, '');
content = content.replace(/const DATA_DIR = path\.join.*?;\n/, '');
content = content.replace(/const DATA_FILE = path\.join.*?;\n/, '');

// Add initialized flag
content = content.replace(/private memoryStore: StoreSchema;/, 'private memoryStore: StoreSchema;\n  public isInitialized = false;');

// Remove loadFromDisk and replace with init
const constructorRegex = /constructor\(\) \{[\s\S]*?this\.memoryStore = this\.loadFromDisk\(\);\s*\}/;
content = content.replace(constructorRegex, `constructor() {
    this.memoryStore = {
      books: [],
      readingLists: [],
      searchLogs: [],
      bookRequests: [],
      dailyUsage: {},
    };
  }

  public async initializeFirestore() {
    console.log('[BusiMindStore] Connecting to Firestore...');
    try {
      const booksSnap = await getDocs(collection(db, 'books'));
      this.memoryStore.books = booksSnap.docs.map(d => d.data() as any);
      
      const rlSnap = await getDocs(collection(db, 'readingLists'));
      this.memoryStore.readingLists = rlSnap.docs.map(d => d.data() as any);
      
      const reqSnap = await getDocs(collection(db, 'bookRequests'));
      this.memoryStore.bookRequests = reqSnap.docs.map(d => d.data() as any);
      
      const logsSnap = await getDocs(collection(db, 'searchLogs'));
      this.memoryStore.searchLogs = logsSnap.docs.map(d => d.data() as any);
      
      const usageSnap = await getDocs(collection(db, 'dailyUsage'));
      this.memoryStore.dailyUsage = {};
      usageSnap.docs.forEach(d => {
        const data = d.data();
        if (!this.memoryStore.dailyUsage[data.date]) this.memoryStore.dailyUsage[data.date] = {};
        this.memoryStore.dailyUsage[data.date][data.userId] = data.used;
      });
      
      this.isInitialized = true;
      console.log('[BusiMindStore] Firestore synced to memory successfully.');
      
      // Setup realtime listeners for multi-instance sync
      onSnapshot(collection(db, 'books'), (snap) => {
         this.memoryStore.books = snap.docs.map(d => d.data() as any);
      });
      onSnapshot(collection(db, 'bookRequests'), (snap) => {
         this.memoryStore.bookRequests = snap.docs.map(d => d.data() as any);
      });
      onSnapshot(collection(db, 'readingLists'), (snap) => {
         this.memoryStore.readingLists = snap.docs.map(d => d.data() as any);
      });
    } catch(err) {
      console.error('[BusiMindStore] Failed to initialize Firestore:', err);
    }
  }`);

// Remove loadFromDisk
content = content.replace(/private loadFromDisk\(\): StoreSchema \{[\s\S]*?return initial;\n  \}/, '');

// Rewrite saveToDisk
content = content.replace(/private saveToDisk\(store: StoreSchema\) \{[\s\S]*?\}\n/, `private saveToDisk(store: StoreSchema) {
    // Legacy disk save removed in favor of direct Firestore updates on mutation
  }`);

fs.writeFileSync('server/data/store.ts', content);
