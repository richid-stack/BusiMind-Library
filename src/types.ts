export type BookDifficulty = 'beginner' | 'intermediate' | 'advanced';

export type DistributionType = 'telegram_repository' | 'external_only' | 'both';

export type ResourceType = 'book' | 'audiobook' | 'framework' | 'template' | 'case_study' | 'summary';

export interface Book {
  id: string;
  title: string;
  author: string;
  category: string;
  subcategory?: string;
  resourceType?: ResourceType;
  description: string;
  whyRecommended: string;
  howItHelps?: string;
  keyTakeaways?: string[];
  bestFor: string;
  difficulty: BookDifficulty;
  tags: string[];
  publicationYear: number;
  ratingScore: number;
  isFeatured: boolean;
  distributionType: DistributionType;
  channelChatId?: string;
  channelMessageId?: number;
  fileId?: string;
  fileName?: string;
  fileType?: string;
  coverImageUrl?: string;
  isbn13?: string;
  externalPurchaseUrl?: string;
  externalLibraryUrl?: string;
  createdAt: string;
  updatedAt: string;
}

export interface DailyUsageInfo {
  used: number;
  limit: number;
  remaining: number;
  resetAt: string;
  isUnlimited?: boolean;
}

export interface ReadingListItem {
  id: string;
  telegramUserId: number | string;
  bookId: string;
  status: 'want_to_read' | 'reading' | 'completed';
  addedAt: string;
}

export interface SearchLog {
  id: string;
  query: string;
  intent: string;
  matchedCount: number;
  timestamp: string;
}

export interface BookRequest {
  id: string;
  requestedTitle: string;
  requestedAuthor?: string;
  query: string;
  topic?: string;
  genre?: string;
  coverImageUrl?: string;
  publicationYear?: number;
  requestCount: number;
  lastRequestedAt: string;
  requestedByUserIds: (number | string)[];
  status: 'pending' | 'acquired' | 'dismissed';
  suggestedAlternativeIds?: string[];
  notes?: string;
}

export interface SystemStats {
  totalBooks: number;
  repositoryBooksCount: number;
  externalOnlyBooksCount: number;
  totalSearches: number;
  totalReadingListItems: number;
  totalBookRequests?: number;
  pendingBookRequests?: number;
  categoriesCount: Record<string, number>;
  recentSearches: SearchLog[];
}

export interface BotConfigStatus {
  botTokenConfigured: boolean;
  botUsername?: string;
  botId?: number;
  geminiKeyConfigured: boolean;
  channelIdConfigured: boolean;
  channelId?: string;
  adminIdConfigured: boolean;
  adminId?: string;
  webhookUrl?: string;
  webhookConfigured: boolean;
  appUrl?: string;
}

export interface AIRecommendation {
  book: Book;
  matchScore: number;
  reason: string;
}

export interface ReadingPathStep {
  stepNumber: number;
  phase: string;
  book: Book;
  rationale: string;
}

// --- FINANCIAL INTELLIGENCE & VALUATION TYPES ---

export type MarketRegion = 'ghana_gse' | 'us_global' | 'etf_fund';

export interface FinancialAssetQuote {
  symbol: string;
  name: string;
  exchange: string;
  region: MarketRegion;
  currency: 'GHS' | 'USD';
  price: number;
  change: number;
  changePercent: number;
  marketCap: number;
  volume: number;
  peRatio?: number;
  pbRatio?: number;
  eps?: number;
  dividendYield?: number;
  fiftyTwoWeekHigh?: number;
  fiftyTwoWeekLow?: number;
  beta?: number;
  sector?: string;
  industry?: string;
  dataSource: 'EODHD' | 'FMP' | 'TwelveData' | 'Finnhub' | 'AlphaVantage' | 'GSE_Direct' | 'GhanaAPI';
  lastUpdated: string;
}

export interface DCFValuation {
  intrinsicValue: number;
  marginOfSafetyPercent: number; // e.g. +24.5% undervalued or -12% overvalued
  projectedFCFGrowthRate: number; // e.g. 10%
  discountRateWACC: number; // e.g. 9.5% for US or 18-22% for GSE adjusted
  terminalGrowthRate: number; // e.g. 2.5%
  tenYearPV: number;
  terminalPV: number;
  terminalValue?: number;
  enterpriseValue: number;
  sharesOutstanding: number;
  verdict: 'significantly_undervalued' | 'undervalued' | 'fair_value' | 'overvalued' | 'significantly_overvalued';
  projectedCashFlows?: { year: number; cashFlow: number; presentValue: number }[];
}

export interface MultiplesValuation {
  grahamNumber?: number; // sqrt(22.5 * EPS * BVPS)
  grahamMarginPercent?: number;
  peterLynchFairValue?: number; // Growth Rate * EPS
  lynchMarginPercent?: number;
  pegRatio?: number;
  targetPE: number;
  industryMedianPE: number;
  verdict: string;
}

export interface ThesisScenario {
  type: 'bull' | 'base' | 'bear';
  probability: number;
  targetPrice: number;
  upsideDownsidePercent: number;
  keyDrivers: string[];
}

export interface DualValuationResult {
  asset: FinancialAssetQuote;
  dcf: DCFValuation;
  multiples: MultiplesValuation;
  synthesizedFairValue: number;
  synthesizedMarginOfSafety: number;
  institutionalVerdict: 'STRONG_BUY' | 'ACCUMULATE' | 'FAIR_HOLD' | 'TRIM_OVERVALUED' | 'SPECULATIVE';
  confidenceScore: number; // 0 - 100
  scenarios: ThesisScenario[];
  invalidationTriggers: string[];
  appliedMentalModels: {
    id?: string;
    bookTitle: string;
    author: string;
    modelName: string;
    rationale?: string;
    category?: string;
    corePrinciple?: string;
    valuationApplication?: string;
  }[];
  aiExecutiveSummary: string;
}

export interface RAGMentalModel {
  id: string;
  bookId?: string;
  bookTitle: string;
  author: string;
  frameworkName: string;
  summary: string;
  coreRule: string;
  checkQuestions: string[];
  redFlags: string[];
  extractedAt: string;
}

export interface JournalEntry {
  id: string;
  symbol: string;
  assetName: string;
  action: 'BUY' | 'WATCH' | 'TRIM' | 'PASS';
  entryPrice: number;
  targetPrice: number;
  stopOrReviewPrice?: number;
  currency: 'GHS' | 'USD';
  thesis: string;
  invalidationCriteria: string;
  appliedBooks: string[];
  status: 'active' | 'closed' | 'invalidated';
  createdAt: string;
  lastReviewedAt?: string;
}

export interface AcademicPaper {
  id: string;
  doi?: string;
  arxivId?: string;
  title: string;
  authors: string[];
  year: number;
  venue?: string;
  citationCount: number;
  abstract: string;
  tldr?: string;
  isOpenAccess: boolean;
  pdfUrl?: string;
  landingPageUrl?: string;
  bibtex?: string;
  keyFindings?: string[];
  fieldOfStudy?: string;
  topics?: string[];
  isCurated?: boolean;
}
