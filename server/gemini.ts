import { GoogleGenAI } from '@google/genai';
import { Book, AIRecommendation, ReadingPathStep } from '../src/types';
import { safeGenerateContent } from './utils/geminiHelper';

let genAIClient: GoogleGenAI | null = null;

function getGenAI(): GoogleGenAI | null {
  if (genAIClient) return genAIClient;
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY' || apiKey.trim() === '') {
    return null;
  }
  genAIClient = new GoogleGenAI({ apiKey });
  return genAIClient;
}

export function isGeminiAvailable(): boolean {
  return getGenAI() !== null;
}

export interface ResolvedBookQueryResult {
  isSpecificBookOrAuthor: boolean;
  requestedTitle?: string;
  requestedAuthor?: string;
  topic?: string;
  recommendations: AIRecommendation[];
  explanation?: string;
}

/**
 * Resolves a book title, author, or missing book query with smart recommendations from available catalog.
 */
export async function resolveBookOrIntent(
  userQuery: string,
  availableBooks: Book[]
): Promise<ResolvedBookQueryResult> {
  const ai = getGenAI();

  if (!ai || availableBooks.length === 0) {
    return fallbackResolveBookOrIntent(userQuery, availableBooks);
  }

  const catalogContext = availableBooks.map((b) => ({
    id: b.id,
    title: b.title,
    author: b.author,
    category: b.category,
    subcategory: b.subcategory,
    difficulty: b.difficulty,
    tags: b.tags,
    summary: b.description,
    bestFor: b.bestFor,
  }));

  const systemInstruction = `You are BusiMind AI, an elite business librarian and book curator.
A user entered a query in a business book bot.

Your task:
1. Determine if the user is looking for a specific book title or author (e.g., "Never Split the Difference", "Chris Voss", "Shoe Dog", "Ray Dalio", "Principles", "Rich Dad Poor Dad", "Thinking Fast and Slow", "Good to Great", "Bad Blood", "Zero to Sold").
   - If YES: extract "requestedTitle", "requestedAuthor" (if known), and "topic" (e.g., "Negotiation", "Sales", "Venture Capital", "Biographies", "Habit Formation").
   - If NO: set "isSpecificBookOrAuthor": false and extract the general "topic".

2. From the PROVIDED CATALOG ONLY, recommend the top 1 to 3 BEST ALTERNATIVES that cover the same core business skills, principles, or domain:
   - For each recommendation, provide an exact "bookId" from the catalog.
   - Write a compelling "reason" explaining why this catalog book is an exceptional alternative for someone interested in that requested title/topic.

3. Provide a polite, executive "explanation" stating clearly that while we do not currently have that specific book in our private repository yet, our team tracks requests, and these recommended alternatives provide immediate high-value knowledge.

Return valid JSON adhering strictly to this schema:
{
  "isSpecificBookOrAuthor": true,
  "requestedTitle": "Book Title",
  "requestedAuthor": "Author Name",
  "topic": "Core Subject",
  "explanation": "Executive message explaining we do not have this title yet and introducing alternatives.",
  "recommendations": [
    {
      "bookId": "exact-catalog-book-id",
      "matchScore": 95,
      "reason": "Why this book is the ideal alternative."
    }
  ]
}`;

  try {
    const response = await safeGenerateContent(ai, {
      model: 'gemini-3.8-flash',
      contents: [
        {
          role: 'user',
          parts: [
            {
              text: `USER QUERY: "${userQuery}"\n\nAVAILABLE CATALOG:\n${JSON.stringify(catalogContext, null, 2)}`,
            },
          ],
        },
      ],
      config: {
        systemInstruction,
        responseMimeType: 'application/json',
        temperature: 0.2,
      },
    });

    const responseText = response.text || '{}';
    const parsed = JSON.parse(responseText.trim());

    const recommendations: AIRecommendation[] = [];
    if (Array.isArray(parsed.recommendations)) {
      for (const item of parsed.recommendations) {
        const book = availableBooks.find((b) => b.id.toLowerCase() === item.bookId?.toLowerCase());
        if (book) {
          recommendations.push({
            book,
            matchScore: typeof item.matchScore === 'number' ? item.matchScore : 85,
            reason: item.reason || book.whyRecommended,
          });
        }
      }
    }

    if (recommendations.length === 0) {
      const fallbackRecs = fallbackSearch(userQuery, availableBooks);
      recommendations.push(...fallbackRecs);
    }

    return {
      isSpecificBookOrAuthor: Boolean(parsed.isSpecificBookOrAuthor ?? true),
      requestedTitle: parsed.requestedTitle || userQuery.replace(/^(book|read|get|pdf|find)\s+/i, '').trim(),
      requestedAuthor: parsed.requestedAuthor || undefined,
      topic: parsed.topic || 'Business Strategy & Execution',
      explanation: parsed.explanation,
      recommendations,
    };
  } catch (error) {
    console.warn('[Gemini resolveBookOrIntent fallback triggered]:', (error as any)?.message || error);
    return fallbackResolveBookOrIntent(userQuery, availableBooks);
  }
}

function fallbackResolveBookOrIntent(userQuery: string, availableBooks: Book[]): ResolvedBookQueryResult {
  const cleanTitle = userQuery
    .replace(/^(book|read|get|pdf|find|i want|looking for)\s+/i, '')
    .replace(/["']/g, '')
    .trim();

  const recs = fallbackSearch(userQuery, availableBooks);

  return {
    isSpecificBookOrAuthor: cleanTitle.length > 2,
    requestedTitle: cleanTitle,
    topic: 'Business & Management',
    explanation: `We currently don't have "${cleanTitle}" in our private repository library yet, but we've noted it for our curation team!`,
    recommendations: recs.slice(0, 3),
  };
}

/**
 * Searches and ranks books from the BusiMind catalog based on user intent.
 * Anti-hallucination constraint strictly enforces that ONLY books present in availableBooks can be returned.
 */
export async function searchBooksWithAI(
  userQuery: string,
  availableBooks: Book[]
): Promise<AIRecommendation[]> {
  const ai = getGenAI();

  if (!ai || availableBooks.length === 0) {
    // Graceful smart keyword/tag fallback if AI key not configured
    return fallbackSearch(userQuery, availableBooks);
  }

  const catalogContext = availableBooks.map((b) => ({
    id: b.id,
    title: b.title,
    author: b.author,
    category: b.category,
    subcategory: b.subcategory,
    difficulty: b.difficulty,
    tags: b.tags,
    summary: b.description,
    bestFor: b.bestFor,
  }));

  const systemInstruction = `You are BusiMind AI, an elite business librarian and executive book curator.
Your mission: Given a user's stated learning goal, challenge, or question, recommend the top 1 to 4 most relevant business books from the PROVIDED CATALOG ONLY.

STRICT ANTI-HALLUCINATION RULES:
1. You are FORBIDDEN from inventing books, authors, or publication information.
2. You can ONLY recommend books that exist in the JSON catalog below. Use their exact "id".
3. If no book in the catalog fits the user query, return an empty array [].
4. Analyze the user's intent: Are they a complete beginner? Are they dealing with teams, cash flow, mindset, or product launch?
5. For each recommendation, provide a compelling, personalized "reason" (2 sentences max) directly connecting the book's core lesson to what the user asked.

Return valid JSON adhering strictly to this schema:
[
  {
    "bookId": "exact-book-id",
    "matchScore": 95,
    "reason": "Personalized explanation of why this book directly solves the user's challenge."
  }
]`;

  try {
    const response = await safeGenerateContent(ai, {
      model: 'gemini-3.8-flash',
      contents: [
        {
          role: 'user',
          parts: [
            {
              text: `USER GOAL/QUERY: "${userQuery}"\n\nAVAILABLE CATALOG:\n${JSON.stringify(catalogContext, null, 2)}`,
            },
          ],
        },
      ],
      config: {
        systemInstruction,
        responseMimeType: 'application/json',
        temperature: 0.2, // Low temperature for high adherence
      },
    });

    const responseText = response.text || '[]';
    const parsed = JSON.parse(responseText.trim());

    if (!Array.isArray(parsed)) {
      return fallbackSearch(userQuery, availableBooks);
    }

    const recommendations: AIRecommendation[] = [];
    for (const item of parsed) {
      const book = availableBooks.find((b) => b.id.toLowerCase() === item.bookId?.toLowerCase());
      if (book) {
        recommendations.push({
          book,
          matchScore: typeof item.matchScore === 'number' ? item.matchScore : 85,
          reason: item.reason || book.whyRecommended,
        });
      }
    }

    if (recommendations.length === 0) {
      return fallbackSearch(userQuery, availableBooks);
    }

    return recommendations;
  } catch (error) {
    console.warn('[Gemini Discovery Fallback triggered]:', (error as any)?.message || error);
    return fallbackSearch(userQuery, availableBooks);
  }
}

/**
 * Generates a structured reading path (01 Foundation, 02 Core, etc.)
 */
export async function generateReadingPath(
  goal: string,
  availableBooks: Book[]
): Promise<ReadingPathStep[]> {
  const ai = getGenAI();

  if (!ai || availableBooks.length === 0) {
    return fallbackReadingPath(goal, availableBooks);
  }

  const catalogContext = availableBooks.map((b) => ({
    id: b.id,
    title: b.title,
    author: b.author,
    category: b.category,
    difficulty: b.difficulty,
    tags: b.tags,
  }));

  const systemInstruction = `You are BusiMind AI. The user wants a structured, progressive business reading path for a specific learning goal.
Select 3 to 5 books from the PROVIDED CATALOG ONLY and order them in a logical learning progression:
Phase 1: Foundation (Principles & Mindset)
Phase 2: Core Methodology (Strategy or Technique)
Phase 3: Execution & Operations (Tactics & Leadership)
Phase 4: Advanced Mastery / Scaling (if applicable)

STRICT ANTI-HALLUCINATION RULES:
1. ONLY select books from the provided catalog using their exact "id".
2. Explain why each book follows the previous one.

Return JSON in this format:
[
  {
    "stepNumber": 1,
    "phase": "Foundation",
    "bookId": "exact-book-id",
    "rationale": "Why this book should be read first."
  }
]`;

  try {
    const response = await safeGenerateContent(ai, {
      model: 'gemini-3.8-flash',
      contents: [
        {
          role: 'user',
          parts: [
            {
              text: `LEARNING GOAL: "${goal}"\n\nCATALOG:\n${JSON.stringify(catalogContext, null, 2)}`,
            },
          ],
        },
      ],
      config: {
        systemInstruction,
        responseMimeType: 'application/json',
        temperature: 0.2,
      },
    });

    const parsed = JSON.parse(response.text?.trim() || '[]');
    if (!Array.isArray(parsed)) return fallbackReadingPath(goal, availableBooks);

    const steps: ReadingPathStep[] = [];
    for (const item of parsed) {
      const book = availableBooks.find((b) => b.id.toLowerCase() === item.bookId?.toLowerCase());
      if (book) {
        steps.push({
          stepNumber: item.stepNumber || steps.length + 1,
          phase: item.phase || `Stage ${steps.length + 1}`,
          book,
          rationale: item.rationale || book.whyRecommended,
        });
      }
    }

    return steps.length > 0 ? steps : fallbackReadingPath(goal, availableBooks);
  } catch (err) {
    console.warn('[Gemini Reading Path Fallback triggered]:', (err as any)?.message || err);
    return fallbackReadingPath(goal, availableBooks);
  }
}

/**
 * Answers questions about a book strictly grounded in its recorded description & metadata
 */
export async function askAboutBook(book: Book, question: string): Promise<string> {
  const ai = getGenAI();
  if (!ai) {
    return `📘 **${book.title}** by ${book.author}\n\n${book.description}\n\n💡 *Why BusiMind Recommends It:* ${book.whyRecommended}\n🎯 *Best For:* ${book.bestFor}`;
  }

  try {
    const response = await safeGenerateContent(ai, {
      model: 'gemini-3.8-flash',
      contents: [
        {
          role: 'user',
          parts: [
            {
              text: `User asks: "${question}" about this business book:
Title: ${book.title}
Author: ${book.author}
Category: ${book.category} (${book.subcategory || ''})
Difficulty: ${book.difficulty}
Core Description: ${book.description}
Why Recommended: ${book.whyRecommended}
Best For: ${book.bestFor}
Tags: ${book.tags?.join(', ')}

Please provide a concise, high-impact answer (under 120 words) explaining how this book addresses their question. Do not claim to possess the full proprietary text unless grounded in the concepts above.`,
            },
          ],
        },
      ],
      config: {
        temperature: 0.2,
      },
    });

    return response.text || `📘 **${book.title}** offers vital frameworks relevant to: "${question}". Explore its key takeaways in BusiMind.`;
  } catch (err) {
    console.warn('[Gemini askAboutBook Fallback triggered]:', (err as any)?.message || err);
    return `📘 **${book.title}** by ${book.author}\n\n${book.description}\n\n💡 *Why BusiMind Recommends It:* ${book.whyRecommended}\n🎯 *Best For:* ${book.bestFor}`;
  }
}

// Fallback search logic based on token matching and category weights
function fallbackSearch(query: string, books: Book[]): AIRecommendation[] {
  const q = query.toLowerCase();
  const tokens = q.split(/\s+/).filter((t) => t.length > 2);

  const scored = books.map((b) => {
    let score = 0;
    const combined = `${b.title} ${b.author} ${b.category} ${b.subcategory || ''} ${b.description} ${b.tags?.join(' ') || ''} ${b.bestFor}`.toLowerCase();

    for (const token of tokens) {
      if (b.title.toLowerCase().includes(token)) score += 30;
      if (b.category.toLowerCase().includes(token)) score += 20;
      if (b.tags?.some((t) => t.toLowerCase().includes(token))) score += 15;
      if (combined.includes(token)) score += 10;
    }

    if (q.includes('beginner') && b.difficulty === 'beginner') score += 20;
    if (q.includes('start') || q.includes('found')) {
      if (b.category.includes('Entrepreneurship')) score += 25;
    }
    if (q.includes('money') || q.includes('invest')) {
      if (b.category.includes('Money') || b.category.includes('Finance')) score += 25;
    }
    if (q.includes('lead') || q.includes('manage')) {
      if (b.category.includes('Leadership')) score += 25;
    }

    return { book: b, score };
  });

  const filtered = scored.filter((s) => s.score > 0).sort((a, b) => b.score - a.score);
  const candidates = filtered.length > 0 ? filtered.slice(0, 3) : scored.slice(0, 2);

  return candidates.map((c) => ({
    book: c.book,
    matchScore: Math.min(95, 60 + c.score),
    reason: c.book.whyRecommended,
  }));
}

function fallbackReadingPath(goal: string, books: Book[]): ReadingPathStep[] {
  const phases = ['Foundation', 'Core Strategy', 'Execution & Operations', 'Mastery & Scale'];
  const steps: ReadingPathStep[] = [];

  const selected = books.filter((b) => b.isFeatured).slice(0, 4);
  selected.forEach((book, idx) => {
    steps.push({
      stepNumber: idx + 1,
      phase: phases[idx] || `Step ${idx + 1}`,
      book,
      rationale: book.whyRecommended,
    });
  });

  return steps;
}
