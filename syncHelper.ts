import { collection, doc, setDoc, onSnapshot, getDocs, deleteDoc } from 'firebase/firestore';
import { db } from './server/data/firestoreConfig';

export async function initialLoad(memoryStore: any) {
  // Load books
  const booksSnap = await getDocs(collection(db, 'books'));
  memoryStore.books = booksSnap.docs.map(d => d.data());
  
  const readingListsSnap = await getDocs(collection(db, 'readingLists'));
  memoryStore.readingLists = readingListsSnap.docs.map(d => d.data());
  
  const requestsSnap = await getDocs(collection(db, 'bookRequests'));
  memoryStore.bookRequests = requestsSnap.docs.map(d => d.data());
  
  const logsSnap = await getDocs(collection(db, 'searchLogs'));
  memoryStore.searchLogs = logsSnap.docs.map(d => d.data());
  
  const usageSnap = await getDocs(collection(db, 'dailyUsage'));
  memoryStore.dailyUsage = {};
  usageSnap.docs.forEach(d => {
    const data = d.data();
    if (!memoryStore.dailyUsage[data.date]) memoryStore.dailyUsage[data.date] = {};
    memoryStore.dailyUsage[data.date][data.userId] = data.used;
  });
}
