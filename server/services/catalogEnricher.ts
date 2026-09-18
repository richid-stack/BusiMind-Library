import { store } from '../data/store';
import { Book } from '../../src/types';
import { cleanRawTitleAndAuthor, sanitizeBookFileName } from './fileSanitizer';
import { resolveBookMetadataAndCover } from './coverResolver';

export interface EnrichmentResult {
  totalProcessed: number;
  enrichedCount: number;
  alreadyCleanCount: number;
  errorsCount: number;
  items: Array<{
    id: string;
    originalTitle: string;
    newTitle: string;
    originalAuthor: string;
    newAuthor: string;
    hasCover: boolean;
  }>;
}

/**
 * Intelligent Catalog Enricher
 * Repairs messy channel file uploads, recognizes real book titles, identifies true authors,
 * fetches high-resolution jacket covers, and sanitizes filenames into "[BusiMind] Title - Author.pdf".
 */
export async function enrichSingleBook(book: Book, force: boolean = false): Promise<Book> {
  const isMessyAuthor = !book.author ||
    book.author.toLowerCase() === 'channel library' ||
    book.author.toLowerCase() === 'curated' ||
    book.author.toLowerCase() === 'curated library' ||
    book.author.toLowerCase() === 'unknown author';

  const hasNoCover = !book.coverImageUrl;

  const isMessyTitle =
    /oceanofpdf|toaz|worldfreebooks|z-library|libgen|\.com|\.org|\.info/i.test(book.title) ||
    /^\d{2}[\s_.-]\d{2}[\s_.-]\d{4}/.test(book.title) ||
    /\s{3,}/.test(book.title) ||
    /\s+by\s*$/i.test(book.title) ||
    /\(\d+\)$/.test(book.title) ||
    (book.title.includes(' - ') && isMessyAuthor) ||
    /^[a-z0-9\s]{2,}\.(pdf|epub)$/i.test(book.title);

  const needsYear = !book.publicationYear || book.publicationYear >= 2025;

  // If already clean and has cover, skip unless forced
  if (!force && !isMessyAuthor && !hasNoCover && !isMessyTitle && !needsYear) {
    return book;
  }

  // 1. Clean title and author strings
  const rawSeed = book.title || book.fileName || 'Business Knowledge Asset';
  const { title: parsedTitle, author: parsedAuthor } = cleanRawTitleAndAuthor(rawSeed);

  const searchAuthor = (!isMessyAuthor && book.author) ? book.author : parsedAuthor;

  // 2. Fetch authoritative metadata & cover from Google Books
  const resolved = await resolveBookMetadataAndCover(parsedTitle, searchAuthor, book.isbn13);

  const finalTitle = resolved.title || parsedTitle || book.title;
  const finalAuthor = resolved.author || searchAuthor || (isMessyAuthor ? 'Curated' : book.author);
  const finalCover = resolved.coverImageUrl || book.coverImageUrl;
  const finalFileName = sanitizeBookFileName(book.fileName, finalTitle, finalAuthor);

  const updates: Partial<Book> = {
    title: finalTitle,
    author: finalAuthor,
    fileName: finalFileName,
  };

  if (finalCover && (!book.coverImageUrl || force)) {
    updates.coverImageUrl = finalCover;
  }

  if (resolved.category && (!book.category || book.category === 'Entrepreneurship')) {
    // Map Google Books category if relevant
    const catLower = resolved.category.toLowerCase();
    if (catLower.includes('invest') || catLower.includes('finance') || catLower.includes('money')) {
      updates.category = 'Finance & Economics';
    } else if (catLower.includes('market') || catLower.includes('sales')) {
      updates.category = 'Marketing & Sales';
    } else if (catLower.includes('leader') || catLower.includes('manage')) {
      updates.category = 'Leadership & Management';
    } else if (catLower.includes('psycholog') || catLower.includes('self-help') || catLower.includes('mind')) {
      updates.category = 'Mindset & Psychology';
    } else if (catLower.includes('strategy') || catLower.includes('econom')) {
      updates.category = 'Strategy & Economics';
    }
  }

  if (resolved.description && (!book.description || book.description.includes('Direct resource uploaded'))) {
    updates.description = resolved.description;
  }

  if (resolved.publishedYear && (!book.publicationYear || book.publicationYear >= 2025 || force)) {
    updates.publicationYear = resolved.publishedYear;
  }

  if (resolved.isbn13 && !book.isbn13) {
    updates.isbn13 = resolved.isbn13;
  }

  const updatedBook = store.updateBook(book.id, updates);
  return updatedBook || { ...book, ...updates };
}

/**
 * Iterates through all books in the catalog and repairs any un-enriched assets
 */
export async function enrichCatalog(options?: {
  forceAll?: boolean;
  limit?: number;
  onProgress?: (processed: number, total: number) => void;
}): Promise<EnrichmentResult> {
  const allBooks = store.getAllBooks();
  // Filter for items that actually need enrichment unless forceAll is specified
  const candidates = options?.forceAll
    ? allBooks
    : allBooks.filter((b) => {
        const needsCover = !b.coverImageUrl;
        const needsAuthor = !b.author || b.author === 'Channel Library' || b.author === 'Curated Library';
        const needsTitle =
          /^\d{2}[\s_.-]\d{2}[\s_.-]\d{4}/.test(b.title) ||
          b.title.toLowerCase().startsWith('oceanofpdf') ||
          b.title.toLowerCase().startsWith('microsoft word');
        const needsYear = !b.publicationYear || b.publicationYear >= 2025;
        return needsCover || needsAuthor || needsTitle || needsYear;
      });

  const total = candidates.length;
  let processed = 0;
  let enrichedCount = 0;
  let alreadyCleanCount = 0;
  let errorsCount = 0;
  const items: EnrichmentResult['items'] = [];

  const maxItems = options?.limit || total;

  for (const book of candidates.slice(0, maxItems)) {
    processed++;
    try {
      const originalTitle = book.title;
      const originalAuthor = book.author;
      const hadCover = Boolean(book.coverImageUrl);

      const enriched = await enrichSingleBook(book, options?.forceAll);

      const isChanged = enriched.title !== originalTitle ||
        enriched.author !== originalAuthor ||
        (!hadCover && Boolean(enriched.coverImageUrl));

      if (isChanged) {
        enrichedCount++;
        items.push({
          id: book.id,
          originalTitle,
          newTitle: enriched.title,
          originalAuthor,
          newAuthor: enriched.author,
          hasCover: Boolean(enriched.coverImageUrl),
        });
      } else {
        alreadyCleanCount++;
      }

      if (options?.onProgress) {
        options.onProgress(processed, total);
      }

      // Small throttle to stay well within Google Books rate limits (100ms)
      await new Promise((r) => setTimeout(r, 120));
    } catch (err) {
      errorsCount++;
      console.warn(`[CatalogEnricher] Error enriching book ${book.id}:`, err);
    }
  }

  return {
    totalProcessed: processed,
    enrichedCount,
    alreadyCleanCount,
    errorsCount,
    items,
  };
}
