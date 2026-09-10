const fs = require('fs');

let content = fs.readFileSync('server/data/store.ts', 'utf-8');

// Replace this.saveToDisk(this.memoryStore) with fire-and-forget Firestore updates
content = content.replace(/this\.memoryStore\.books\.push\(book\);\s*this\.saveToDisk\(this\.memoryStore\);/, `this.memoryStore.books.push(book);\n    setDoc(doc(db, 'books', book.id), book).catch(e => console.error('[Firestore] Error adding book:', e));`);

content = content.replace(/this\.memoryStore\.books\[index\] = updated;\s*this\.saveToDisk\(this\.memoryStore\);/, `this.memoryStore.books[index] = updated;\n    setDoc(doc(db, 'books', updated.id), updated, { merge: true }).catch(e => console.error('[Firestore] Error updating book:', e));`);

content = content.replace(/this\.memoryStore\.books = this\.memoryStore\.books\.filter\(\(b\) => b\.id !== id\);\s*if \(this\.memoryStore\.books\.length !== initialLen\) \{\s*this\.saveToDisk\(this\.memoryStore\);\s*return true;\s*\}/, `this.memoryStore.books = this.memoryStore.books.filter((b) => b.id !== id);\n    if (this.memoryStore.books.length !== initialLen) {\n      deleteDoc(doc(db, 'books', id)).catch(e => console.error('[Firestore] Error deleting book:', e));\n      return true;\n    }`);

content = content.replace(/this\.memoryStore\.readingLists\.unshift\(\{[\s\S]*?\}\);\s*this\.saveToDisk\(this\.memoryStore\);/, (match) => {
  return match.replace(/this\.saveToDisk\(this\.memoryStore\);/, `setDoc(doc(db, 'readingLists', id), this.memoryStore.readingLists[0]).catch(e => console.error('[Firestore]', e));`);
});

content = content.replace(/this\.memoryStore\.readingLists = this\.memoryStore\.readingLists\.filter\([\s\S]*?\);\s*if \(this\.memoryStore\.readingLists\.length !== initialLen\) \{\s*this\.saveToDisk\(this\.memoryStore\);/, (match) => {
  return `// Find the item to delete in Firestore before removing it from memory
    const itemToDelete = this.memoryStore.readingLists.find((item) => String(item.telegramUserId) === userStr && item.bookId === bookId);
    if (itemToDelete) deleteDoc(doc(db, 'readingLists', itemToDelete.id)).catch(e => console.error('[Firestore]', e));
    ` + match.replace(/this\.saveToDisk\(this\.memoryStore\);/, '');
});

content = content.replace(/this\.memoryStore\.bookRequests\[existingIndex\] = updated;\s*this\.saveToDisk\(this\.memoryStore\);/, `this.memoryStore.bookRequests[existingIndex] = updated;\n      setDoc(doc(db, 'bookRequests', updated.id), updated).catch(e => console.error('[Firestore]', e));`);

content = content.replace(/this\.memoryStore\.bookRequests\.unshift\(newReq\);\s*this\.saveToDisk\(this\.memoryStore\);/, `this.memoryStore.bookRequests.unshift(newReq);\n    setDoc(doc(db, 'bookRequests', newReq.id), newReq).catch(e => console.error('[Firestore]', e));`);

content = content.replace(/item\.status = status;\s*this\.saveToDisk\(this\.memoryStore\);/, `item.status = status;\n    setDoc(doc(db, 'bookRequests', item.id), item, { merge: true }).catch(e => console.error('[Firestore]', e));`);

content = content.replace(/this\.memoryStore\.bookRequests = this\.memoryStore\.bookRequests\.filter\(\(r\) => r\.id !== id\);\s*if \(this\.memoryStore\.bookRequests\.length !== initialLen\) \{\s*this\.saveToDisk\(this\.memoryStore\);/, `this.memoryStore.bookRequests = this.memoryStore.bookRequests.filter((r) => r.id !== id);\n    if (this.memoryStore.bookRequests.length !== initialLen) {\n      deleteDoc(doc(db, 'bookRequests', id)).catch(e => console.error('[Firestore]', e));`);

content = content.replace(/this\.memoryStore\.searchLogs\.unshift\(\{([\s\S]*?)\}\);\s*\/\/ Keep last 100 searches[\s\S]*?this\.saveToDisk\(this\.memoryStore\);/, (match) => {
  // We'll just write it fire and forget
  return `const newLog = { $1 };
    this.memoryStore.searchLogs.unshift(newLog);
    setDoc(doc(db, 'searchLogs', newLog.id), newLog).catch(e=>console.error(e));
    if (this.memoryStore.searchLogs.length > 100) {
      this.memoryStore.searchLogs = this.memoryStore.searchLogs.slice(0, 100);
    }`;
});

content = content.replace(/this\.memoryStore\.dailyUsage\[today\]\[strId\] = newUsed;\s*this\.saveToDisk\(this\.memoryStore\);/, `this.memoryStore.dailyUsage[today][strId] = newUsed;\n    setDoc(doc(db, 'dailyUsage', today + '_' + strId), { date: today, userId: strId, used: newUsed }).catch(e => console.error(e));`);

fs.writeFileSync('server/data/store.ts', content);
