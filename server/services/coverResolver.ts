import { stripForeignWatermarks } from './fileSanitizer';

// In-memory cache for fast lookup
const coverCache = new Map<string, string>();
const metaCache = new Map<string, ResolvedBookMetadata>();

export interface ResolvedBookMetadata {
  title: string;
  author: string;
  coverImageUrl?: string;
  category?: string;
  description?: string;
  publishedYear?: number;
  isbn13?: string;
}

/**
 * Cover Image Resolver Service
 * Automatically fetches high-resolution book jackets from Google Books API and OpenLibrary
 */
export async function resolveBookCover(
  title: string,
  author?: string,
  isbn13?: string | null
): Promise<string | undefined> {
  const meta = await resolveBookMetadataAndCover(title, author, isbn13);
  return meta.coverImageUrl;
}

/**
 * Resolves authoritative metadata and cover jacket for a given title/author/isbn.
 */
export async function resolveBookMetadataAndCover(
  title: string,
  author?: string,
  isbn13?: string | null
): Promise<ResolvedBookMetadata> {
  if (!title) {
    return { title: 'Business Knowledge Asset', author: 'Curated Library' };
  }

  const cleanIsbn = isbn13 ? isbn13.replace(/[^0-9X]/gi, '') : null;
  const cleanTitle = stripForeignWatermarks(title)
    .replace(/\.(pdf|epub|mobi)$/i, '')
    .trim();

  const isGenericAuthor = !author ||
    author.toLowerCase() === 'channel library' ||
    author.toLowerCase() === 'curated' ||
    author.toLowerCase() === 'curated library' ||
    author.toLowerCase() === 'unknown author';

  const cleanAuthor = !isGenericAuthor && author ? stripForeignWatermarks(author).trim() : '';

  const cacheKey = `${cleanIsbn || ''}::${cleanTitle.toLowerCase()}::${cleanAuthor.toLowerCase()}`;
  if (metaCache.has(cacheKey)) {
    return metaCache.get(cacheKey)!;
  }

  const mainTitle = cleanTitle.split(/[:\-]/)[0].trim();

  // 1. Google Books API Query (Works with or without optional API key)
  const apiKey = process.env.GOOGLE_BOOKS_API_KEY;
  const queries: string[] = [];
  if (cleanIsbn && cleanIsbn.length >= 10) {
    queries.push(`isbn:${cleanIsbn}`);
  }
  if (cleanAuthor) {
    queries.push(`intitle:${encodeURIComponent(cleanTitle)}+inauthor:${encodeURIComponent(cleanAuthor)}`);
    if (mainTitle && mainTitle !== cleanTitle) {
      queries.push(`intitle:${encodeURIComponent(mainTitle)}+inauthor:${encodeURIComponent(cleanAuthor)}`);
    }
  }
  queries.push(`intitle:${encodeURIComponent(mainTitle || cleanTitle)}`);

  for (const q of queries) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 3500);

      const url = apiKey
        ? `https://www.googleapis.com/books/v1/volumes?q=${q}&key=${apiKey}&maxResults=3`
        : `https://www.googleapis.com/books/v1/volumes?q=${q}&maxResults=3`;

      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(timeout);

      if (res.ok) {
        const data = await res.json();
        if (data.items && data.items.length > 0) {
          for (const item of data.items) {
            const v = item.volumeInfo;
            if (!v) continue;

            let coverUrl = v.imageLinks?.thumbnail || v.imageLinks?.smallThumbnail;
            if (coverUrl) {
              coverUrl = coverUrl.replace('http:', 'https:').replace('&edge=curl', '');
            }

            const resolvedAuthor = (v.authors && v.authors.length > 0)
              ? v.authors.join(', ')
              : (cleanAuthor || 'Curated Library');

            const displayTitle = v.subtitle ? `${v.title}: ${v.subtitle}` : v.title;

            const isbn13Found = v.industryIdentifiers?.find((id: any) => id.type === 'ISBN_13')?.identifier;
            const pubYear = v.publishedDate ? parseInt(v.publishedDate.slice(0, 4), 10) : undefined;

            const result: ResolvedBookMetadata = {
              title: displayTitle || cleanTitle,
              author: resolvedAuthor,
              coverImageUrl: coverUrl,
              category: v.categories?.[0] || 'General Literature',
              description: v.description,
              publishedYear: isNaN(pubYear) ? undefined : pubYear,
              isbn13: isbn13Found || cleanIsbn || undefined,
            };

            metaCache.set(cacheKey, result);
            if (coverUrl) coverCache.set(cacheKey, coverUrl);
            return result;
          }
        }
      }
    } catch (err) {
      // Try next query
    }
  }

  // 2. OpenLibrary Fallback
  const olQueries = [
    cleanAuthor ? `${mainTitle} ${cleanAuthor}`.trim() : mainTitle,
    cleanTitle,
  ];

  for (const olQuery of olQueries) {
    if (!olQuery) continue;
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 3500);

      const res = await fetch(`https://openlibrary.org/search.json?q=${encodeURIComponent(olQuery)}&limit=3`, {
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (res.ok) {
        const data = await res.json();
        if (data?.docs && data.docs.length > 0) {
          for (const doc of data.docs) {
            let coverUrl: string | undefined;
            if (doc.cover_i) {
              coverUrl = `https://covers.openlibrary.org/b/id/${doc.cover_i}-L.jpg`;
            } else if (doc.isbn && doc.isbn.length > 0) {
              const isbn = doc.isbn.find((i: string) => i.length === 13) || doc.isbn[0];
              coverUrl = `https://covers.openlibrary.org/b/isbn/${isbn}-L.jpg`;
            }

            const docAuthor = (doc.author_name && doc.author_name.length > 0)
              ? doc.author_name.join(', ')
              : (cleanAuthor || 'Curated Library');

            const result: ResolvedBookMetadata = {
              title: doc.title || cleanTitle,
              author: docAuthor,
              coverImageUrl: coverUrl,
              publishedYear: doc.first_publish_year,
            };

            metaCache.set(cacheKey, result);
            if (coverUrl) coverCache.set(cacheKey, coverUrl);
            return result;
          }
        }
      }
    } catch (err) {
      // Continue
    }
  }

  const fallbackResult: ResolvedBookMetadata = {
    title: cleanTitle,
    author: cleanAuthor || 'Curated Library',
    coverImageUrl: cleanIsbn && cleanIsbn.length >= 10
      ? `https://covers.openlibrary.org/b/isbn/${cleanIsbn}-L.jpg`
      : undefined,
  };

  metaCache.set(cacheKey, fallbackResult);
  return fallbackResult;
}

export interface ExternalBookCandidate {
  title: string;
  author: string;
  coverImageUrl?: string;
  genre: string;
  description?: string;
  publishedYear?: number;
  isbn13?: string;
}

/**
 * Searches external book registries (Google Books API + OpenLibrary) to retrieve
 * verified candidate titles, actual authors, cover jacket images, and authoritative genre categorization.
 */
export async function searchExternalBookCandidates(
  query: string,
  maxResults = 3
): Promise<ExternalBookCandidate[]> {
  const cleanQ = stripForeignWatermarks(query).replace(/\.(pdf|epub|mobi)$/i, '').trim();
  if (!cleanQ || cleanQ.length < 2) return [];

  const candidates: ExternalBookCandidate[] = [];
  const seenTitles = new Set<string>();

  // 1. Google Books Query
  try {
    const apiKey = process.env.GOOGLE_BOOKS_API_KEY;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);

    const url = apiKey
      ? `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(cleanQ)}&key=${apiKey}&maxResults=${maxResults}`
      : `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(cleanQ)}&maxResults=${maxResults}`;

    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);

    if (res.ok) {
      const data = await res.json();
      if (data.items && Array.isArray(data.items)) {
        for (const item of data.items) {
          const v = item.volumeInfo;
          if (!v || !v.title) continue;

          const normTitle = v.title.toLowerCase().trim();
          if (seenTitles.has(normTitle)) continue;
          seenTitles.add(normTitle);

          let coverUrl = v.imageLinks?.thumbnail || v.imageLinks?.smallThumbnail;
          if (coverUrl) {
            coverUrl = coverUrl.replace('http:', 'https:').replace('&edge=curl', '');
          }

          const author = v.authors && v.authors.length > 0 ? v.authors.join(', ') : 'Unknown Author';
          const genre = (v.categories && v.categories.length > 0) ? v.categories[0] : 'General';
          const pubYear = v.publishedDate ? parseInt(v.publishedDate.slice(0, 4), 10) : undefined;
          const isbn13 = v.industryIdentifiers?.find((id: any) => id.type === 'ISBN_13')?.identifier;

          candidates.push({
            title: v.subtitle ? `${v.title}: ${v.subtitle}` : v.title,
            author,
            coverImageUrl: coverUrl,
            genre,
            description: v.description ? v.description.slice(0, 240) + '...' : undefined,
            publishedYear: isNaN(pubYear) ? undefined : pubYear,
            isbn13,
          });

          if (candidates.length >= maxResults) break;
        }
      }
    }
  } catch (err) {
    // Continue to OpenLibrary fallback
  }

  // 2. OpenLibrary Fallback if fewer than 2 results found
  if (candidates.length < 2) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 3500);

      const res = await fetch(`https://openlibrary.org/search.json?q=${encodeURIComponent(cleanQ)}&limit=3`, {
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (res.ok) {
        const data = await res.json();
        if (data?.docs && Array.isArray(data.docs)) {
          for (const doc of data.docs) {
            if (!doc.title) continue;
            const normTitle = doc.title.toLowerCase().trim();
            if (seenTitles.has(normTitle)) continue;
            seenTitles.add(normTitle);

            let coverUrl: string | undefined;
            if (doc.cover_i) {
              coverUrl = `https://covers.openlibrary.org/b/id/${doc.cover_i}-L.jpg`;
            } else if (doc.isbn && doc.isbn.length > 0) {
              const isbn = doc.isbn.find((i: string) => i.length === 13) || doc.isbn[0];
              coverUrl = `https://covers.openlibrary.org/b/isbn/${isbn}-L.jpg`;
            }

            const author = doc.author_name && doc.author_name.length > 0 ? doc.author_name.join(', ') : 'Unknown Author';
            const genre = doc.subject && doc.subject.length > 0 ? doc.subject[0] : 'General';

            candidates.push({
              title: doc.title,
              author,
              coverImageUrl: coverUrl,
              genre,
              publishedYear: doc.first_publish_year,
            });

            if (candidates.length >= maxResults) break;
          }
        }
      }
    } catch (err) {
      // Ignore
    }
  }

  return candidates;
}
