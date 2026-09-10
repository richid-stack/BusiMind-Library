const fs = require('fs');
let content = fs.readFileSync('src/components/CatalogManager.tsx', 'utf-8');

// Replace the KindleHeroFeature block
content = content.replace(/\{\/\* 1\. AMAZON KINDLE \/ APPLE BOOKS FEATURED SPOTLIGHT \*\/\}[\s\S]*?isDelivering=\{deliveringBookId === .*?\}\n\s*\/>\n\s*\)\}/, 
`{/* 1. BUSIMIND INTELLIGENCE FEATURED SPOTLIGHT */}
          {heroBooks.length > 0 && (
            <KindleHeroFeature
              books={heroBooks}
              onOpenReader={(b) => setReadingBook(b)}
              onTestDeliver={handleTestDeliver}
              onExtractRAG={handleExtractRAG}
              extractingRAGId={extractingRAGBookId}
              ragSuccessMsg={extractedRAGSuccess[heroBooks[0]?.id]}
              isDelivering={deliveringBookId !== null}
            />
          )}`);

// Remove linkingBook modal
content = content.replace(/\{\/\* Modal: Link Telegram Channel Message \*\/\}[\s\S]*?<\/form>\n\s*<\/div>\n\s*<\/div>\n\s*\)\}/, '');

fs.writeFileSync('src/components/CatalogManager.tsx', content);
