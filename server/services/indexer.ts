import { GoogleGenAI, Type } from '@google/genai';
import { safeGenerateContent } from '../utils/geminiHelper';
import { Book, ResourceType, BookDifficulty } from '../../src/types';
import { store } from '../data/store';
import { sanitizeBookFileName, cleanRawTitleAndAuthor } from './fileSanitizer';
import { ragStore } from './ragStore';
import { extractPdfSnippetFromFileId } from './pdfExtractor';
import { resolveBookCover, resolveBookMetadataAndCover } from './coverResolver';

let aiClient: GoogleGenAI | null = null;

function getAIClient(): GoogleGenAI | null {
  if (!aiClient && process.env.GEMINI_API_KEY) {
    aiClient = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  }
  return aiClient;
}

export interface ChannelMessageAsset {
  channelId: string;
  messageId: number;
  fileId?: string;
  fileName?: string;
  caption?: string;
  text?: string;
  mimeType?: string;
  fileSize?: number;
  mediaType: 'document' | 'audio' | 'video' | 'text' | 'photo';
}

export interface IndexResult {
  action: 'linked' | 'created' | 'already_indexed';
  book: Book;
  rationale?: string;
}

/**
 * Intelligent Channel Asset Auto-Indexer
 * Automatically extracts title, author, category, resource type from channel post
 * and indexes it into the BusiMind catalog.
 */
export async function autoIndexChannelAsset(asset: ChannelMessageAsset): Promise<IndexResult> {
  const existingBooks = store.getAllBooks();

  // 1. DUPLICATION CHECK: Check if exact same channel message was already indexed
  const alreadyIndexed = existingBooks.find(
    (b) => String(b.channelChatId) === String(asset.channelId) && Number(b.channelMessageId) === Number(asset.messageId)
  );

  if (alreadyIndexed) {
    return {
      action: 'already_indexed',
      book: alreadyIndexed,
      rationale: 'Already indexed previously.'
    };
  }

  const rawQuery = [
    asset.fileName ? `File: ${asset.fileName}` : '',
    asset.caption ? `Caption: ${asset.caption}` : '',
    asset.text ? `Text: ${asset.text}` : '',
    `Media: ${asset.mediaType}`,
    asset.mimeType ? `MIME: ${asset.mimeType}` : '',
  ]
    .filter(Boolean)
    .join(' | ');

  // Automatic Deep Scan: If this is a PDF with a fileId, extract the first few pages automatically
  let pdfSnippet: string | null = null;
  if (asset.fileId && (asset.mimeType === 'application/pdf' || asset.fileName?.toLowerCase().endsWith('.pdf'))) {
    try {
      pdfSnippet = await extractPdfSnippetFromFileId(asset.fileId);
      if (pdfSnippet) {
        console.log(`[Auto-Indexer] Extracted ${pdfSnippet.length} chars from PDF excerpt for "${asset.fileName || asset.fileId}"`);
      }
    } catch (e) {
      console.warn('[Auto-Indexer] PDF excerpt extraction skipped:', e);
    }
  }

  const ai = getAIClient();

  if (ai && (rawQuery || pdfSnippet)) {
    try {
      const catalogSummary = existingBooks.map((b) => ({
        id: b.id,
        title: b.title,
        author: b.author,
      }));

      const prompt = `You are the Master BusiMind Curator & Executive Bibliographer.
We have an uploaded file or message in our private Telegram channel:
"${rawQuery}"
${pdfSnippet ? `\nDOCUMENT FIRST PAGES EXCERPT (ACTUAL BOOK TEXT):\n"""\n${pdfSnippet}\n"""\nCRITICAL INSTRUCTION: If the filename is messy, scrambled, or truncated, use the ACTUAL document text above (title page, copyright page, author name) to identify the REAL book canonical title, true author, publication year, and ISBN-13!\n` : ''}
CRITICAL INSTRUCTION FOR MINIMAL FILENAMES/POSTS:
Often the upload only contains a raw filename (e.g. "Shoe_Dog.epub", "Never_Split_the_Difference.pdf", "Think_and_Grow_Rich.pdf", "The_Almanack_of_Naval_Ravikant.pdf", "Good_to_Great.pdf", "Hard_Things.pdf", "Zero to One.pdf") with NO description and NO author mentioned.
You MUST recognize the underlying business, investing, management, or startup book using your world knowledge of literature!
Identify the true author, real publication year, and authoritative summary.

MOST IMPORTANT - HOW THIS BOOK HELPS THE USER:
1. "howItHelps": Write 2-3 sentences explaining exactly how reading this book directly helps the user in their business, career, mindset, or financial growth. Focus on practical ROI (e.g. "How this helps you: It teaches you how to negotiate without giving away margin, spot manipulative bargaining tactics, and turn high-stakes deadlock into win-win agreements").
2. "keyTakeaways": Provide exactly 3 actionable, high-impact bullet points summarizing the core mental models or frameworks the user can apply today.

Existing Catalog Sample:
${JSON.stringify(catalogSummary.slice(0, 30))}

Task:
1. Determine if this file/post matches any existing book ID in our catalog. If it matches an existing book, set "matchedBookId" to that ID.
2. If it does not match, extract clean metadata for a new business knowledge asset:
   - title: Canonical title (e.g. "Never Split the Difference: Negotiating As If Your Life Depended On It")
   - author: Canonical author (e.g. "Chris Voss & Tahl Raz")
   - category: One of: ["Entrepreneurship", "Money & Investing", "Leadership & Management", "Marketing & Sales", "Mindset & Psychology", "Finance & Economics", "Strategy & Economics"]
   - resourceType: One of: ["book", "audiobook", "framework", "template", "case_study", "summary"]
   - description: 2-3 sentences explaining core thesis and practical value.
   - whyRecommended: 1 punchy sentence why a founder, investor, or leader must read/use it.
   - howItHelps: 2-3 sentences detailing how this book transforms the reader's skills or decisions.
   - keyTakeaways: Exactly 3 practical, actionable principles.
   - bestFor: Target audience (e.g. "First-time founders, sales executives, and dealmakers")
   - difficulty: "beginner" | "intermediate" | "advanced"
   - publicationYear: Real publication year (e.g. 2016)
   - isbn13: The ISBN-13 of the book if known. Used to fetch the book cover. (e.g. "9780063138870")
   - tags: 4 to 6 lowercase keywords (e.g. ["negotiation", "persuasion", "sales", "communication"])

Return pure JSON.`;

      let response;
      let retries = 0;
      const maxRetries = 6;
      while (retries <= maxRetries) {
        try {
          response = await safeGenerateContent(ai, {
            model: 'gemini-3.6-flash',
            contents: prompt,
            config: {
              responseMimeType: 'application/json',
              responseSchema: {
                type: Type.OBJECT,
                properties: {
                  matchedBookId: { type: Type.STRING, nullable: true },
                  title: { type: Type.STRING },
                  author: { type: Type.STRING },
                  category: { type: Type.STRING },
                  resourceType: { type: Type.STRING },
                  description: { type: Type.STRING },
                  whyRecommended: { type: Type.STRING },
                  howItHelps: { type: Type.STRING },
                  keyTakeaways: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING },
                  },
                  bestFor: { type: Type.STRING },
                  difficulty: { type: Type.STRING },
                  publicationYear: { type: Type.INTEGER },
                  isbn13: { type: Type.STRING, nullable: true },
                  tags: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING },
                  },
                },
                required: ['title', 'author', 'category', 'description', 'whyRecommended', 'howItHelps', 'keyTakeaways', 'tags'],
              },
            },
          });
          break;
        } catch (err) {
          if (err?.status === 429 || String(err).includes('429') || String(err).includes('RESOURCE_EXHAUSTED')) {
            retries++;
            if (retries > maxRetries) throw err;
            const waitTime = Math.pow(2, retries) * 1000 + Math.random() * 1000;
            console.log(`[Indexer] Rate limit hit. Retrying in ${Math.round(waitTime/1000)}s...`);
            await new Promise((resolve) => setTimeout(resolve, waitTime));
          } else {
            throw err;
          }
        }
      }

      const parsed = JSON.parse(response.text || '{}');

      // Case 1: Matched existing book
      if (parsed.matchedBookId && existingBooks.some((b) => b.id === parsed.matchedBookId)) {
        const matched = existingBooks.find((b) => b.id === parsed.matchedBookId);
        const cleanName = sanitizeBookFileName(asset.fileName, matched?.title, matched?.author);
        const updated = store.linkTelegramMessage(
          parsed.matchedBookId,
          asset.channelId,
          asset.messageId,
          cleanName,
          asset.fileId
        );
        if (updated) {
          const enrichUpdates: Partial<Book> = {};
          if (parsed.howItHelps && !updated.howItHelps) enrichUpdates.howItHelps = parsed.howItHelps;
          if (parsed.keyTakeaways && (!updated.keyTakeaways || updated.keyTakeaways.length === 0)) {
            enrichUpdates.keyTakeaways = parsed.keyTakeaways;
          }
          if (!updated.coverImageUrl) {
            const cover = await resolveBookCover(updated.title, updated.author, parsed.isbn13);
            if (cover) enrichUpdates.coverImageUrl = cover;
          }
          if (Object.keys(enrichUpdates).length > 0) {
            store.updateBook(updated.id, enrichUpdates);
          }
          return { action: 'linked', book: store.getBookById(updated.id) || updated, rationale: `Matched existing title "${updated.title}"` };
        }
      }

      // Case 2: New asset or book
      const safeId = (parsed.title || 'asset')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .substring(0, 40) || `asset-${Date.now()}`;

      // Check if ID exists to avoid collision
      const finalId = existingBooks.some((b) => b.id === safeId)
        ? `${safeId}-${Date.now().toString().slice(-4)}`
        : safeId;

      let validCategory = parsed.category || 'Entrepreneurship';
      const validCategories = [
        'Entrepreneurship',
        'Money & Investing',
        'Leadership & Management',
        'Marketing & Sales',
        'Mindset & Psychology',
        'Finance & Economics',
        'Strategy & Economics',
      ];
      if (!validCategories.includes(validCategory)) {
        validCategory = 'Entrepreneurship';
      }

      let validResourceType: ResourceType = 'book';
      if (asset.mediaType === 'audio') validResourceType = 'audiobook';
      else if (asset.fileName?.endsWith('.xlsx') || asset.fileName?.endsWith('.csv') || asset.fileName?.endsWith('.xls')) validResourceType = 'template';
      else if (['book', 'audiobook', 'framework', 'template', 'case_study', 'summary'].includes(parsed.resourceType)) {
        validResourceType = parsed.resourceType as ResourceType;
      }

      const pubYear = typeof parsed.publicationYear === 'number' && parsed.publicationYear > 1800 && parsed.publicationYear <= 2030
        ? parsed.publicationYear
        : new Date().getFullYear();

      // Automatically fetch cover from ISBN or Title+Author
      const coverImageUrl = await resolveBookCover(parsed.title, parsed.author, parsed.isbn13);

      const newAsset = store.addBook({
        id: finalId,
        title: parsed.title || 'Untitled Business Asset',
        author: parsed.author || 'Curated',
        category: validCategory,
        resourceType: validResourceType,
        description: parsed.description || 'Curated business knowledge resource from channel repository.',
        whyRecommended: parsed.whyRecommended || 'Selected for practical business insights.',
        howItHelps: parsed.howItHelps || 'Provides proven principles and mental models to accelerate your decision-making and performance.',
        keyTakeaways: Array.isArray(parsed.keyTakeaways) && parsed.keyTakeaways.length > 0 ? parsed.keyTakeaways : [
          'Focus on highest-leverage priorities.',
          'Execute with disciplined iteration.',
          'Build sustainable competitive advantages.',
        ],
        bestFor: parsed.bestFor || 'Business professionals and entrepreneurs.',
        difficulty: (['beginner', 'intermediate', 'advanced'].includes(parsed.difficulty) ? parsed.difficulty : 'intermediate') as BookDifficulty,
        tags: Array.isArray(parsed.tags) ? parsed.tags : ['business'],
        publicationYear: pubYear,
        coverImageUrl,
        ratingScore: 4.8,
        isFeatured: false,
        distributionType: 'telegram_repository',
        channelChatId: asset.channelId,
        channelMessageId: asset.messageId,
        fileId: asset.fileId,
        fileName: sanitizeBookFileName(asset.fileName, parsed.title, parsed.author),
        fileType: asset.mimeType || asset.mediaType,
      });

      // Automatically trigger dynamic RAG mental model extraction in background
      ragStore
        .extractFromBook(
          newAsset.title,
          newAsset.author,
          `${newAsset.description} ${newAsset.whyRecommended} ${newAsset.howItHelps} ${(newAsset.keyTakeaways || []).join(' ')}`
        )
        .catch((e) => console.warn('[RAG Auto-Extract Warning]:', e));

      return { action: 'created', book: newAsset, rationale: `Cataloged as new ${validResourceType}` };
    } catch (err) {
      console.error('[autoIndexChannelAsset AI error]:', err);
    }
  }

  // Fallback heuristic: Clean title & author from filename/caption and resolve authoritative metadata & cover
  const rawCandidate = (asset.fileName || asset.caption || asset.text || 'Business Knowledge Asset').trim();
  const { title: parsedTitle, author: parsedAuthor, category: parsedCategory } = cleanRawTitleAndAuthor(rawCandidate);
  const resolvedMeta = await resolveBookMetadataAndCover(parsedTitle, parsedAuthor);

  const cleanTitle = resolvedMeta.title || parsedTitle || 'Business Knowledge Asset';
  const cleanAuthor = resolvedMeta.author || parsedAuthor || 'Curated';
  const coverImageUrl = resolvedMeta.coverImageUrl;
  const validCategory = resolvedMeta.category || parsedCategory || 'Entrepreneurship';

  const safeId = cleanTitle
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, 45) || `asset-${Date.now()}`;

  const existing = existingBooks.find(
    (b) => b.title.toLowerCase() === cleanTitle.toLowerCase() || b.id === safeId
  );

  const cleanFileName = sanitizeBookFileName(asset.fileName, cleanTitle, cleanAuthor);

  if (existing) {
    const updated = store.linkTelegramMessage(
      existing.id,
      asset.channelId,
      asset.messageId,
      cleanFileName,
      asset.fileId
    );
    // If existing has no cover, update cover
    if (!existing.coverImageUrl && coverImageUrl) {
      store.updateBook(existing.id, { coverImageUrl });
    }
    return { action: 'linked', book: updated || existing };
  }

  const created = store.addBook({
    id: safeId,
    title: cleanTitle,
    author: cleanAuthor,
    category: validCategory,
    resourceType: asset.mediaType === 'audio' ? 'audiobook' : 'book',
    description: resolvedMeta.description || 'Curated business and strategy resource from channel repository.',
    whyRecommended: 'Essential principles and practical frameworks for high-leverage decision-making.',
    howItHelps: 'Provides battle-tested mental models to sharpen strategic execution, resource allocation, and leadership judgment.',
    keyTakeaways: [
      'Focus relentlessly on compounding high-leverage activities.',
      'Calibrate risk and asymmetric upside before committing capital or time.',
      'Synthesize empirical market feedback to refine your competitive moat.',
    ],
    bestFor: 'Entrepreneurs, founders, and institutional operators.',
    difficulty: 'intermediate',
    tags: ['business', 'strategy', 'reference'],
    publicationYear: resolvedMeta.publishedYear || undefined,
    coverImageUrl,
    ratingScore: 4.8,
    isFeatured: false,
    distributionType: 'telegram_repository',
    channelChatId: asset.channelId,
    channelMessageId: asset.messageId,
    fileId: asset.fileId,
    fileName: cleanFileName,
    fileType: asset.mimeType,
  });

  return { action: 'created', book: created };
}
