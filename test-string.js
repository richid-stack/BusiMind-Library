const title = "A Very Long Title That Exceeds The Maximum Allowed Length For A Telegram Inline Keyboard Button Callback Data So We Need To Truncate It Carefully";
const safeId = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'asset';
console.log(safeId);
console.log(safeId.length);
console.log(('book_' + safeId).length);
