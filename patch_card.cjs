const fs = require('fs');
let content = fs.readFileSync('src/components/bookstore/KindleBookCard.tsx', 'utf-8');

// Replace styling
content = content.replace(/bg-white hover:bg-gray-50 border border-gray-200\/90 hover:border-amber-500\/30 rounded-2xl p-4 transition-all duration-300 shadow-lg hover:shadow-2xl hover:shadow-black\/60 relative/g,
'flex flex-col bg-white hover:bg-gray-50 border border-gray-200 hover:border-[#f3a847] rounded-sm p-4 transition-all duration-200 shadow-sm hover:shadow-md relative');

// Adjust gradient if missing cover
content = content.replace(/bg-gradient-to-b \$\{jacketStyle\}/g, 'bg-[#131921] border-l-4 border-[#f3a847]');

// Remove truncate wrapping issues
content = content.replace(/className="flex flex-wrap items-center gap-1.5 mt-2"/g, 'className="flex flex-wrap items-center gap-1.5 mt-2 overflow-hidden"');

fs.writeFileSync('src/components/bookstore/KindleBookCard.tsx', content);
