/**
 * Authoritative Canonical Book Publication Dates & Metadata Normalizer
 * Provides accurate historical publication dates for prominent business, finance,
 * management, psychology, and general literature volumes in the BusiMind repository.
 */

export const CANONICAL_BOOK_DATES: Record<string, number> = {
  // Classics & Foundational Finance
  "the intelligent investor": 1949,
  "security analysis": 1934,
  "a random walk down wall street": 1973,
  "common stocks and uncommon profits": 1958,
  "one up on wall street": 1989,
  "beating the street": 1993,
  "what works on wall street": 1996,
  "you can be a stock market genius": 1997,
  "the most important thing": 2011,
  "the psychology of money": 2020,
  "your money and your brain": 2007,
  "rich dad poor dad": 1997,
  "cashflow quadrant": 1998,
  "the millionaire next door": 1996,
  "the little book of common sense investing": 2007,
  "the dhandho investor": 2007,
  "margin of safety": 1991,
  "dead aid": 2009,
  "africa rising": 2008,

  // Strategy & Operations
  "zero to one": 2014,
  "good to great": 2001,
  "built to last": 1994,
  "crossing the chasm": 1991,
  "the innovator's dilemma": 1997,
  "blue ocean strategy": 2005,
  "blue ocean shift": 2017,
  "business model generation": 2010,
  "value proposition design": 2014,
  "disciplined entrepreneurship": 2013,
  "the startup owner's manual": 2012,
  "the lean startup": 2011,
  "scaling up": 2014,
  "7 powers": 2016,
  "high output management": 1983,
  "measure what matters": 2018,
  "the effective executive": 1967,
  "principles": 2017,
  "hard thing about hard things": 2014,
  "inspired: how to create tech products": 2008,
  "inspired": 2008,
  "empowered": 2020,
  "the mom test": 2013,
  "obviously awesome": 2019,
  "traction": 2014,
  "hooked": 2014,
  "the 10x rule": 2011,
  "ten times rule": 2011,
  "the one thing": 2013,
  "one thing": 2013,
  "thinking in systems": 2008,
  "awakening the entrepreneur within": 2008,
  "the e-myth revisited": 1995,
  "chase the lion": 2016,
  "memos from the chairman": 1996,
  "never settle": 2019,
  "win every argument": 2023,
  "101 great answers to the toughest interview questions": 1991,
  "101 great answers": 1991,
  "antifragile": 2012,
  "fooled by randomness": 2001,
  "the black swan": 2007,
  "skin in the game": 2018,
  "incerto": 2012,
  "influence: the psychology of persuasion": 1984,
  "influence": 1984,
  "pre-suasion": 2016,
  "thinking, fast and slow": 2011,
  "atomic habits": 2018,

  // Technical & Computer Science / AI
  "introduction to algorithms": 1990,
  "automate the boring stuff with python": 2015,
  "hands on machine learning": 2017,
  "nlp with transformers": 2022,
  "the art of data science": 2016,
  "design patterns": 1994,
  "clean code": 2008,
  "designing data-intensive applications": 2017,

  // Literature & General Classics
  "and then there were none": 1939,
  "on writing well": 1976,
  "zen in the art of writing": 1990,
  "how to win friends and influence people": 1936,
  "think and grow rich": 1937,
  "man's search for meaning": 1946,
  "meditations": 180,
  "the art of war": 500,

  // Channel reversed titles resolution
  "discover the secrets of the most successful entrepreneurs": 2012,
  "mad genius a manifesto for entrepreneurs": 2016,
  "five": 2015,
};

/**
 * Reverses a string if it appears to be backwards text (common in some scraped PDF names)
 */
function normalizeBackwardsText(str: string): string {
  if (!str) return '';
  // Check if text looks like reversed words (e.g. "sruenerpertnE")
  if (/sruenerpertn|lufsseccuS|suineG/i.test(str)) {
    return str.split('').reverse().join('');
  }
  return str;
}

/**
 * Resolves the true historical publication year for a book.
 * Avoids defaulting to container clock year (e.g. 2026).
 */
export function getCanonicalPublicationYear(title: string, author?: string): number | undefined {
  if (!title) return undefined;

  const cleanTitle = normalizeBackwardsText(title).toLowerCase();
  const cleanAuthor = author ? normalizeBackwardsText(author).toLowerCase() : '';
  const combined = `${cleanTitle} ${cleanAuthor}`;

  // 1. Direct and Substring Match against Canonical Dictionary
  for (const [key, year] of Object.entries(CANONICAL_BOOK_DATES)) {
    if (cleanTitle.includes(key) || combined.includes(key)) {
      return year;
    }
  }

  // 2. Extract 4-digit year from title if present (e.g. "Meadows 2008 Thinking in Systems")
  const yearMatch = title.match(/\b(19\d{2}|20[0-1]\d|202[0-4])\b/);
  if (yearMatch) {
    const parsed = parseInt(yearMatch[1], 10);
    if (parsed >= 1800 && parsed <= 2024) {
      return parsed;
    }
  }

  return undefined;
}
