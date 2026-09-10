const fs = require('fs');

function refineChips(file) {
  let content = fs.readFileSync(file, 'utf-8');
  content = content.replace(/className="flex flex-wrap items-center gap-1\.5 mt-2"/g, 'className="flex flex-wrap items-center gap-1.5 mt-2 overflow-hidden"');
  fs.writeFileSync(file, content);
}
refineChips('src/components/bookstore/KindleBookCard.tsx');

