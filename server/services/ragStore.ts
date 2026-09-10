import { GoogleGenAI } from '@google/genai';
import { RAGMentalModel } from '../../src/types';
import { store } from '../data/store';
import { safeGenerateContent } from '../utils/geminiHelper';

/**
 * Dynamic RAG Knowledge Base for Financial Intelligence
 * Extensible: Anyone can ingest new books from the BusiMind library to continuously expand the AI's mental models.
 */

// Initial Seed of Foundational Investment Mental Models
const SEED_MENTAL_MODELS: RAGMentalModel[] = [
  {
    id: 'graham-margin-of-safety',
    bookTitle: 'The Intelligent Investor',
    author: 'Benjamin Graham',
    frameworkName: 'Margin of Safety & Graham Number',
    summary: 'True investment requires a substantial discount to conservative intrinsic value so that inevitable forecasting errors, competitive headwinds, or market downturns do not cause permanent capital loss.',
    coreRule: 'Never pay full price for future projections; require at least a 20-30% discount to conservative liquidation or reproduction asset value. Graham Number = sqrt(22.5 * EPS * BVPS).',
    checkQuestions: [
      'Is the stock trading at a discount to tangible asset value or normalized 5-year earnings?',
      'Can the business withstand a 2-year industry recession without risking solvency?',
      'Are current profits elevated by cyclical peaks or accounting one-offs?',
    ],
    redFlags: [
      'Excessive debt-to-equity (>1.5x) paired with volatile cash flows',
      'Unproven turnaround stories trading at premium growth multiples',
      'Dilutive share-based compensation masking poor earnings',
    ],
    extractedAt: '2026-09-01T00:00:00.000Z',
  },
  {
    id: 'damodaran-dcf-frontier',
    bookTitle: 'Investment Valuation (Tools & Techniques for Determining the Value of Any Asset)',
    author: 'Aswath Damodaran',
    frameworkName: 'Cash Flow Realism & Frontier Market Cost of Capital',
    summary: 'The value of any business is the present value of the cash flows it generates over its remaining life, discounted at a rate that reflects the operating and country risk.',
    coreRule: 'In emerging/frontier markets like the Ghana Stock Exchange, discount rates (WACC) must include sovereign risk spreads and local risk-free rates (e.g., 91-day Treasury bill yields), rather than US 10-year Treasury benchmarks.',
    checkQuestions: [
      'Are projected Free Cash Flows (FCF) backed by actual operating cash conversion, or are they being eaten by heavy recurring CapEx?',
      'Has the discount rate accounted for local currency depreciation and sovereign inflation spreads?',
      'Is the terminal growth rate capped strictly at or below the long-term GDP growth rate?',
    ],
    redFlags: [
      'Using US-style 8-10% discount rates for high-inflation frontier economies',
      'Assuming perpetual double-digit FCF growth into year 10+',
      'Ignoring working capital lock-up in accounts receivable',
    ],
    extractedAt: '2026-09-01T00:00:00.000Z',
  },
  {
    id: 'buffett-munger-economic-moats',
    bookTitle: "Poor Charlie's Almanack & Berkshire Hathaway Letters",
    author: 'Warren Buffett & Charlie Munger',
    frameworkName: 'Durable Economic Moats & Inversion Principle',
    summary: 'A truly great business possesses a defensive castle with a wide, durable moat (pricing power, high switching costs, or network effects) that protects returns on invested capital (ROIC) from being eroded by competitors.',
    coreRule: 'Invert, always invert: instead of asking how this company wins, ask what forces could destroy its economics over the next 10 years.',
    checkQuestions: [
      'Does the company have pricing power—can it raise prices during inflation without losing market share (e.g. MTN telecommunications or dominant banks)?',
      'Are returns on capital (ROIC / ROE) consistently above 15% without artificial leverage?',
      'Is management allocating surplus cash intelligently via dividends, smart reinvestment, or non-dilutive buybacks?',
    ],
    redFlags: [
      'Commoditized products where the customer switches strictly on price',
      'Management empire-building via expensive, value-destructive acquisitions',
      'Heavy technological disruption threats that obsolete core assets',
    ],
    extractedAt: '2026-09-01T00:00:00.000Z',
  },
  {
    id: 'lynch-peg-growth',
    bookTitle: 'One Up On Wall Street',
    author: 'Peter Lynch',
    frameworkName: 'Lynch Fair Value & Classification Dynamics',
    summary: 'Classify the company properly (Fast Grower, Stalwart, Slow Grower, Cyclical, Turnaround, or Asset Play) and price it according to sustainable earnings growth.',
    coreRule: 'A fairly valued company has a P/E ratio roughly equal to its sustainable annual earnings growth rate (PEG = 1.0). A PEG under 1.0 signals potential undervaluation; above 2.0 indicates excessive optimism.',
    checkQuestions: [
      'Which of the 6 Lynch categories does this business belong to?',
      'Are inventories piling up faster than revenue growth (warning sign of slowing demand)?',
      'Does the business have a hidden "asset play" (e.g., undervalued real estate, spectrum licenses, or cash balances)?',
    ],
    redFlags: [
      'Fast growers whose PEG exceeds 2.5x in competitive industries',
      'Cyclical companies at the peak of their cycle trading at deceptively low single-digit P/E ratios',
      'Companies diworse-ifying into unrelated, lower-margin ventures',
    ],
    extractedAt: '2026-09-01T00:00:00.000Z',
  },
  {
    id: 'helmer-7-powers',
    bookTitle: '7 Powers: The Foundations of Business Strategy',
    author: 'Hamilton Helmer',
    frameworkName: '7 Powers Strategic Barrier Evaluation',
    summary: 'Persistent differential returns require at least one of the 7 foundational Powers: Scale Economies, Network Economies, Counter-Positioning, Switching Costs, Branding, Cornered Resource, or Process Power.',
    coreRule: 'Without at least one identifiable Power, any excess profit will be competed away to cost of capital.',
    checkQuestions: [
      'Which specific Power from the 7 Powers does this enterprise exploit?',
      'Is the power durable against well-capitalized new entrants or sovereign policy shifts?',
    ],
    redFlags: [
      'Believing operational efficiency alone constitutes a durable strategic moat',
      'Customer churn exceeding 10% annually in subscription/utility businesses',
    ],
    extractedAt: '2026-09-01T00:00:00.000Z',
  },
  {
    id: 'marks-market-cycles',
    bookTitle: 'The Most Important Thing / Mastering the Market Cycle',
    author: 'Howard Marks',
    frameworkName: 'Second-Level Thinking & Market Cycle Positioning',
    summary: 'First-level thinking says: "It is a great company, let us buy the stock." Second-level thinking says: "It is a great company, but everyone thinks it is a great company, so it is priced for perfection and vulnerable to any miss."',
    coreRule: 'Risk is not volatility; risk is the permanent probability of capital loss, which peaks when market psychology is most euphoric and disappears when panic is widespread.',
    checkQuestions: [
      'What expectations are already embedded into the current market price?',
      'Are investors treating this asset as bulletproof (danger) or uninvestable (opportunity)?',
    ],
    redFlags: [
      'Consensus agreement that "this time is different"',
      'Aggressive loosening of credit or debt covenants in the sector',
    ],
    extractedAt: '2026-09-01T00:00:00.000Z',
  },
];

class DynamicRAGStore {
  private models: Map<string, RAGMentalModel> = new Map();

  constructor() {
    // Seed initial mental models
    for (const model of SEED_MENTAL_MODELS) {
      this.models.set(model.id, model);
    }
  }

  public getAllModels(): RAGMentalModel[] {
    return Array.from(this.models.values());
  }

  public getModelById(id: string): RAGMentalModel | undefined {
    return this.models.get(id);
  }

  /**
   * Ingests a new mental model directly
   */
  public addModel(model: RAGMentalModel): RAGMentalModel {
    this.models.set(model.id, model);
    return model;
  }

  /**
   * Automatically extracts financial mental models & valuation frameworks
   * from any book in the BusiMind catalog (or custom text/author) using Gemini 3.8 Flash!
   */
  public async extractFromBook(
    bookIdOrTitle: string,
    customAuthor?: string,
    customNotes?: string
  ): Promise<RAGMentalModel[]> {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY is required to extract knowledge models.');
    }

    // Check if it matches an existing book in our catalog
    const existingBook = store.getBookById(bookIdOrTitle) ||
      store.getAllBooks().find((b) => b.title.toLowerCase().includes(bookIdOrTitle.toLowerCase()));

    const targetTitle = existingBook ? existingBook.title : bookIdOrTitle;
    const targetAuthor = existingBook ? existingBook.author : (customAuthor || 'Investment Master');
    const contextDescription = existingBook
      ? `Description: ${existingBook.description}\nWhy Recommended: ${existingBook.whyRecommended}\nKey Takeaways: ${existingBook.keyTakeaways?.join('; ')}`
      : (customNotes || 'General investment and business strategy volume.');

    const ai = new GoogleGenAI({ apiKey });

    const prompt = `You are an elite institutional financial analyst and knowledge architect for BusiMind.
Analyze the business/investment book titled "${targetTitle}" by ${targetAuthor}.
${contextDescription}

Extract 1 to 2 distinct, actionable Financial & Valuation Mental Models from this book that can be applied to evaluate public stocks, local equities (such as on the Ghana Stock Exchange), or global tech/value businesses.

Return a strict JSON ARRAY of objects with the following schema:
[
  {
    "id": "slug-id",
    "bookTitle": "${targetTitle}",
    "author": "${targetAuthor}",
    "frameworkName": "Name of the principle or mental model",
    "summary": "2-3 sentences explaining the core philosophy",
    "coreRule": "1-2 sentences stating the rigorous decision rule or valuation formula",
    "checkQuestions": ["Question 1 to ask when analyzing a company", "Question 2", "Question 3"],
    "redFlags": ["Red flag 1 that signals invalidation", "Red flag 2", "Red flag 3"]
  }
]
`;

    try {
      const response = await safeGenerateContent(ai, {
        model: 'gemini-3.8-flash',
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          temperature: 0.2,
        },
      });

      const text = response.text || '[]';
      const extracted: any[] = JSON.parse(text);

      const addedList: RAGMentalModel[] = [];
      for (const item of extracted) {
        const id = (item.id || `${targetTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${Date.now()}`).slice(0, 50);
        const newModel: RAGMentalModel = {
          id,
          bookId: existingBook?.id,
          bookTitle: targetTitle,
          author: targetAuthor,
          frameworkName: item.frameworkName || 'Strategic Investment Principle',
          summary: item.summary || 'Analytical framework for equity valuation.',
          coreRule: item.coreRule || 'Measure margin of safety against conservative earnings power.',
          checkQuestions: Array.isArray(item.checkQuestions) ? item.checkQuestions : ['Does this asset possess durable competitive advantages?'],
          redFlags: Array.isArray(item.redFlags) ? item.redFlags : ['High financial leverage during demand contraction.'],
          extractedAt: new Date().toISOString(),
        };

        this.models.set(id, newModel);
        addedList.push(newModel);
      }

      return addedList;
    } catch (err: any) {
      console.warn('[ragStore extractFromBook AI limit/unavailable, using synthesized model fallback]:', err?.message);
      
      // Resilient fallback: build a rich domain mental model from the book's metadata
      const fallbackId = `rag-${targetTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${Date.now()}`.slice(0, 50);
      const takeaways = existingBook?.keyTakeaways || [];
      const whyRec = existingBook?.whyRecommended || existingBook?.howItHelps || 'Provides rigorous financial and managerial frameworks.';
      
      const fallbackModel: RAGMentalModel = {
        id: fallbackId,
        bookId: existingBook?.id,
        bookTitle: targetTitle,
        author: targetAuthor,
        frameworkName: `${targetTitle} Strategic Framework`,
        summary: existingBook?.description || `${targetTitle} presents foundational principles for business valuation and management.`,
        coreRule: takeaways[0] || whyRec || 'Evaluate assets based on conservative cash flow generation and durable competitive advantages.',
        checkQuestions: takeaways.length >= 2 
          ? takeaways.slice(0, 3) 
          : [
              `How does ${targetTitle}'s core thesis apply to current asset valuation?`,
              'Does the target company exhibit the pricing power and discipline emphasized in this volume?',
              'Are financial returns resilient against macroeconomic inflation and currency fluctuations?'
            ],
        redFlags: [
          'High debt burdens paired with declining return on invested capital',
          'Management capital misallocation during industry cyclical peaks',
          'Lack of transparent accounting and cash flow disclosures'
        ],
        extractedAt: new Date().toISOString(),
      };

      this.models.set(fallbackId, fallbackModel);
      return [fallbackModel];
    }
  }

  /**
   * Retrieves all mental models relevant for a specific asset analysis context
   */
  public getRelevantModels(symbol: string, region: 'ghana_gse' | 'us_global' | 'etf_fund'): RAGMentalModel[] {
    const all = this.getAllModels();
    if (region === 'ghana_gse') {
      // Prioritize Damodaran (frontier cost of capital), Buffett (pricing power/utilities like MTN/Banks), and Graham (margin of safety)
      return all.sort((a, b) => {
        const aIsGse = a.id.includes('damodaran') || a.id.includes('graham');
        const bIsGse = b.id.includes('damodaran') || b.id.includes('graham');
        return (bIsGse ? 1 : 0) - (aIsGse ? 1 : 0);
      });
    }
    return all;
  }
}

export const ragStore = new DynamicRAGStore();
