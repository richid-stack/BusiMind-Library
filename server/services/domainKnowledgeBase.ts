/**
 * Categorized Domain RAG Knowledge Base
 * 
 * Domains:
 * 1. INVESTING (Value, Growth, Fundamental, Portfolio, Risk, Behavioral, Psychology)
 * 2. FINANCE (Corporate finance, Statements, Valuation, Capital structure, Cash flow)
 * 3. ECONOMICS (Inflation, Interest rates, Monetary policy, FX, Cycles)
 * 4. BUSINESS (Strategy, 7 Powers / Moats, Operations, Pricing power)
 * 5. TRADING (Market structure, Position sizing, Risk/Reward)
 * 6. GHANA_AFRICA (GSE, Bank of Ghana, Treasury Bills, DDEP, Sovereign dynamics)
 */

export type KnowledgeDomain = 'INVESTING' | 'FINANCE' | 'ECONOMICS' | 'BUSINESS' | 'TRADING' | 'GHANA_AFRICA';

export interface GroundedPrinciple {
  id: string;
  domain: KnowledgeDomain;
  title: string;
  sourceBook: string;
  author: string;
  year?: number;
  coreRule: string;
  applicationGuide: string;
  checkQuestions: string[];
  redFlags: string[];
  keywords: string[];
}

export const DOMAIN_PRINCIPLES: GroundedPrinciple[] = [
  // --- INVESTING DOMAIN ---
  {
    id: 'inv-margin-of-safety',
    domain: 'INVESTING',
    title: 'The Margin of Safety Principle',
    sourceBook: 'The Intelligent Investor',
    author: 'Benjamin Graham',
    year: 1949,
    coreRule: 'Never purchase a security without a substantial discount (minimum 25-33%) between the market price and conservative intrinsic value to absorb human error, bad luck, and market turbulence.',
    applicationGuide: 'Calculate intrinsic value using multiple independent models (DCF and Graham Number). Only issue positive accumulation verdicts when market price trades safely below that conservative value.',
    checkQuestions: [
      'Is the purchase price at least 25% below conservative intrinsic valuation?',
      'Does the business possess sufficient tangible asset protection in liquidation or distressed scenarios?',
      'Are cash flows derived from true operational earnings rather than accounting changes?',
    ],
    redFlags: [
      'Valuation justified purely on aggressive terminal growth rates (>4%)',
      'No cushion against unforeseen economic slowdowns or rate hikes',
      'High debt burden consuming operating cash flow',
    ],
    keywords: ['margin of safety', 'value investing', 'graham', 'intrinsic value', 'undervalued', 'discount', 'safety margin'],
  },
  {
    id: 'inv-circle-of-competence',
    domain: 'INVESTING',
    title: 'Circle of Competence & Mental Models',
    sourceBook: "Poor Charlie's Almanack",
    author: 'Charlie Munger',
    year: 2005,
    coreRule: 'Confine investment decisions strictly to businesses whose economics, industry structure, and regulatory drivers you genuinely comprehend. Avoid chasing fads outside this perimeter.',
    applicationGuide: 'Classify complex financial instruments or opaque conglomerates as "Too Hard". Focus capital in straightforward, predictable franchises with durable pricing power.',
    checkQuestions: [
      'Can the investor explain in simple terms how this company earns and defends its profits 5 years out?',
      'Does the analyst truly understand the regulatory risks and supply chain constraints?',
    ],
    redFlags: [
      'Unintelligible balance sheet structure or opaque offshore subsidiaries',
      'Management providing vague guidance and buzzword-heavy investor presentations',
    ],
    keywords: ['munger', 'circle of competence', 'mental models', 'too hard', 'simplicity', 'predictability'],
  },
  {
    id: 'inv-lynch-peg',
    domain: 'INVESTING',
    title: 'Earnings Growth & PEG Valuation (Lynch Fair Value)',
    sourceBook: 'One Up On Wall Street',
    author: 'Peter Lynch',
    year: 1989,
    coreRule: 'A fair P/E ratio is approximately equal to the company\'s sustainable percentage earnings growth rate plus its dividend yield. A PEG ratio significantly below 1.0 indicates undervalued growth.',
    applicationGuide: 'Calculate Lynch Fair Value = EPS * Sustainable Growth Rate (adjusted for dividend yield). Categorize companies into Fast Growers, Stalwarts, and Cyclicals before applying metrics.',
    checkQuestions: [
      'Is the PEG ratio (P/E divided by growth rate) below 1.0 or at least below 1.2?',
      'Does the company have zero or negligible debt on the balance sheet?',
    ],
    redFlags: [
      'P/E multiple exceeds twice the realistic long-term earnings growth rate',
      'Growth driven purely by dilutive debt-fueled acquisitions',
    ],
    keywords: ['peter lynch', 'peg ratio', 'growth at reasonable price', 'stalwarts', 'fast growers', 'lynch fair value'],
  },
  {
    id: 'inv-psychology-of-money',
    domain: 'INVESTING',
    title: 'Behavioral Staying Power & Compounding Survival',
    sourceBook: 'The Psychology of Money',
    author: 'Morgan Housel',
    year: 2020,
    coreRule: 'Financial success is not about making the smartest one-time call; it is about avoiding catastrophic ruin and maintaining staying power so uninterrupted compounding can do the heavy lifting.',
    applicationGuide: 'Emphasize liquidity reserves and cash resilience. Never deploy leverage that could force liquidation during short-term market crashes or systemic shocks.',
    checkQuestions: [
      'Could the portfolio or holding withstand a 40% sudden drawdown without forcing panic sales?',
      'Is the investor confusing luck with skill in a bull market?',
    ],
    redFlags: [
      'Borrowing on margin to buy speculative stocks',
      'Overconfidence leading to 100% allocation in a single volatile asset',
    ],
    keywords: ['psychology of money', 'housel', 'staying power', 'ruin', 'compounding', 'behavioral bias', 'patience'],
  },

  // --- FINANCE DOMAIN ---
  {
    id: 'fin-damodaran-dcf',
    domain: 'FINANCE',
    title: 'Cash Flow Realism & Country Risk Adjusted WACC',
    sourceBook: 'Investment Valuation / Narrative and Numbers',
    author: 'Aswath Damodaran',
    year: 2012,
    coreRule: 'A stock is worth the present value of its future free cash flows to equity or the firm. When valuing frontier or emerging market assets, the discount rate must reflect country risk premiums (CRP) and local currency inflation.',
    applicationGuide: 'Calculate Cost of Equity = Risk-Free Rate (e.g. Ghana 91-Day T-bill or 10-year Sovereign) + Beta * Equity Risk Premium + Country Risk Premium. Discount conservative FCF projections.',
    checkQuestions: [
      'Does the discount rate incorporate local sovereign yield realities rather than generic US 8% benchmarks?',
      'Is terminal growth rate capped strictly at or below long-term GDP growth of the operating economy?',
    ],
    redFlags: [
      'Using a 7-8% discount rate for a frontier market asset where sovereign paper yields >20%',
      'Projecting double-digit cash flow growth into perpetuity',
    ],
    keywords: ['damodaran', 'dcf', 'discounted cash flow', 'wacc', 'country risk premium', 'intrinsic value', 'terminal value'],
  },
  {
    id: 'fin-quality-of-earnings',
    domain: 'FINANCE',
    title: 'Earnings Quality & Cash Flow Divergence',
    sourceBook: 'Financial Shenanigans: How to Detect Accounting Gimmicks',
    author: 'Howard Schilit',
    year: 2010,
    coreRule: 'Operating Cash Flow (OCF) must closely track or exceed reported Net Income. A persistent divergence where Net Income rises while OCF stagnates or turns negative is a primary indicator of aggressive revenue recognition or impending write-downs.',
    applicationGuide: 'Always compare multi-year Net Income trajectory with Cash Flow from Operations and Accounts Receivable growth. If receivables grow faster than sales, flag earnings quality.',
    checkQuestions: [
      'Is Free Cash Flow positive and matching reported net profits?',
      'Are inventory and trade receivables growing in lockstep with revenues, rather than ballooning?',
    ],
    redFlags: [
      'Net Income growing 25% while Operating Cash Flow is declining',
      'Frequent "non-recurring" adjustments appearing every consecutive quarter',
    ],
    keywords: ['financial shenanigans', 'schilit', 'earnings quality', 'cash flow divergence', 'fcf', 'accruals', 'accounting red flags'],
  },

  // --- ECONOMICS DOMAIN ---
  {
    id: 'econ-dalio-debt-cycles',
    domain: 'ECONOMICS',
    title: 'The Economic Machine & Debt Cycles',
    sourceBook: 'Principles for Navigating Big Debt Crises',
    author: 'Ray Dalio',
    year: 2018,
    coreRule: 'An economy is the sum of transactions driven by credit and productivity. Short-term debt cycles (5-8 years) and long-term debt cycles (50-75 years) dictate monetary easing, tightening, inflation, and sovereign deleveraging.',
    applicationGuide: 'Assess central bank policy stances (hawkish vs dovish) and yield curves before making broad sector asset allocations. In high-rate environments, prioritize companies with net cash and pricing power.',
    checkQuestions: [
      'Where is the economy in the monetary cycle (tightening vs easing)?',
      'Are interest rates rising faster than corporate revenue growth?',
    ],
    redFlags: [
      'Highly levered balance sheets entering an aggressive rate-hiking cycle',
      'Excessive foreign currency sovereign borrowing paired with deteriorating trade balance',
    ],
    keywords: ['ray dalio', 'debt cycles', 'macroeconomics', 'central bank', 'inflation', 'interest rates', 'monetary policy'],
  },

  // --- BUSINESS & STRATEGY DOMAIN ---
  {
    id: 'biz-helmer-7powers',
    domain: 'BUSINESS',
    title: 'Economic Moats & Hamilton Helmer 7 Powers',
    sourceBook: '7 Powers: The Foundations of Business Strategy',
    author: 'Hamilton Helmer',
    year: 2016,
    coreRule: 'Persistent economic super-profits require at least one of the 7 Powers: Scale Economies, Network Effects, Counter-Positioning, Switching Costs, Branding, Cornered Resource, or Process Power. Without a Power, returns on capital inevitably regress to cost of capital.',
    applicationGuide: 'Identify the exact structural mechanism protecting the company\'s gross and operating margins. For tech (e.g. NVDA CUDA ecosystem) note high Switching Costs; for telecoms (e.g. MTN MoMo) note Network Effects and Scale.',
    checkQuestions: [
      'Which of the 7 Powers definitively insulates this firm from competitor pricing warfare?',
      'Can competitors duplicate the offering within 18 months by merely spending capital?',
    ],
    redFlags: [
      'Company claims high margins in a commodity industry with zero barrier to entry',
      'Gross margins decaying year-over-year under aggressive competitor discounts',
    ],
    keywords: ['7 powers', 'helmer', 'economic moat', 'network effects', 'switching costs', 'scale economies', 'branding', 'competitive advantage'],
  },

  // --- GHANA & AFRICAN MARKETS DOMAIN ---
  {
    id: 'gse-bog-sovereign-dynamics',
    domain: 'GHANA_AFRICA',
    title: 'Ghana Stock Exchange (GSE) Macro Dynamics & Bank of Ghana Linkages',
    sourceBook: 'Ghana Financial Markets Manual & Bank of Ghana Monetary Policy Review',
    author: 'Bank of Ghana / GSE Research',
    year: 2024,
    coreRule: 'Ghana equities trade in an environment shaped by Bank of Ghana Monetary Policy Rates (~27-29%), high benchmark Treasury Bill yields (91-day T-bill ~24-27%), and USD/GHS exchange rate pass-through. Corporate equities must offer superior cash return yields or structural real growth to compete with sovereign paper.',
    applicationGuide: 'Evaluate GSE banking stocks (GCB, SCB, EGH) for post-DDEP balance sheet repair and Net Interest Margin sustainability. For telecoms and FMCG (MTNGH, UNIL, FML), assess FX pass-through pricing power and MoMo transaction resilience.',
    checkQuestions: [
      'Does the dividend yield + earnings growth adequately exceed the 91-day Government of Ghana T-bill risk-free benchmark?',
      'How does currency depreciation impact the company\'s cost of imported equipment, fuel, or capital expenditure?',
      'Has the institution recovered its Capital Adequacy Ratio (CAR) post-Domestic Debt Exchange Programme (DDEP)?',
    ],
    redFlags: [
      'Heavy unhedged foreign currency debt serviced with declining local cedi revenues',
      'Dividend yield below 6% for an illiquid GSE small-cap during high sovereign rate regimes',
      'Elevated Non-Performing Loans (NPLs) exceeding 20% in commercial loan portfolios',
    ],
    keywords: ['ghana stock exchange', 'gse', 'bank of ghana', 't-bill', 'cedi', 'mtngh', 'gcb', 'ddep', 'treasury bill', 'ghana investing'],
  },
];

export class DomainKnowledgeBase {
  /**
   * Retrieves relevant principles by semantic keywords and domain filters
   */
  public findRelevantPrinciples(
    queryOrTopic: string,
    domainFilter?: KnowledgeDomain,
    limit: number = 3
  ): GroundedPrinciple[] {
    const q = queryOrTopic.toLowerCase();
    const tokens = q.split(/\s+/).filter((t) => t.length > 2);

    const scored = DOMAIN_PRINCIPLES.filter((p) => {
      if (domainFilter && p.domain !== domainFilter) return false;
      return true;
    }).map((p) => {
      let score = 0;
      // Check title match
      if (p.title.toLowerCase().includes(q)) score += 10;
      // Check book / author match
      if (p.sourceBook.toLowerCase().includes(q) || p.author.toLowerCase().includes(q)) score += 8;
      // Check keywords
      for (const kw of p.keywords) {
        if (q.includes(kw.toLowerCase())) score += 6;
      }
      // Token overlap
      for (const token of tokens) {
        if (p.coreRule.toLowerCase().includes(token)) score += 2;
        if (p.applicationGuide.toLowerCase().includes(token)) score += 1.5;
        if (p.keywords.some((k) => k.toLowerCase().includes(token))) score += 2;
      }
      return { principle: p, score };
    });

    scored.sort((a, b) => b.score - a.score);

    // If no strong match found, return top defaults based on domain
    if (scored.length === 0 || scored[0].score === 0) {
      if (domainFilter) {
        return DOMAIN_PRINCIPLES.filter((p) => p.domain === domainFilter).slice(0, limit);
      }
      return [DOMAIN_PRINCIPLES[0], DOMAIN_PRINCIPLES[1], DOMAIN_PRINCIPLES[8]].slice(0, limit);
    }

    return scored.slice(0, limit).map((s) => s.principle);
  }

  /**
   * Get all principles formatted for prompt context
   */
  public getPrinciplesForPrompt(principles: GroundedPrinciple[]): string {
    return principles
      .map(
        (p, i) =>
          `[PRINCIPLE ${i + 1}: ${p.title}]\n` +
          `• Source: "${p.sourceBook}" (${p.author}, ${p.year || 'Classic'})\n` +
          `• Domain: ${p.domain}\n` +
          `• Core Rule: ${p.coreRule}\n` +
          `• Application Guide: ${p.applicationGuide}\n` +
          `• Red Flags: ${p.redFlags.join('; ')}`
      )
      .join('\n\n');
  }

  /**
   * Add an extracted mental model directly to the active knowledge base
   */
  public addMentalModel(model: {
    id: string;
    bookTitle: string;
    author: string;
    frameworkName: string;
    summary: string;
    coreRule: string;
    checkQuestions: string[];
    redFlags: string[];
  }): void {
    const principle: GroundedPrinciple = {
      id: model.id,
      domain: 'INVESTING',
      title: model.frameworkName,
      sourceBook: model.bookTitle,
      author: model.author,
      coreRule: model.coreRule,
      applicationGuide: model.summary,
      checkQuestions: Array.isArray(model.checkQuestions) ? model.checkQuestions : [],
      redFlags: Array.isArray(model.redFlags) ? model.redFlags : [],
      keywords: [model.frameworkName, model.author, ...model.frameworkName.split(/\s+/)],
    };
    DOMAIN_PRINCIPLES.push(principle);
  }
}

export const domainKnowledgeBase = new DomainKnowledgeBase();
