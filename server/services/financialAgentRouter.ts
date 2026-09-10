import { GoogleGenAI } from '@google/genai';
import { safeGenerateContent } from '../utils/geminiHelper';
import { marketDataService } from './marketData';
import { valuationEngine } from './valuationEngine';
import { technicalAnalysisEngine } from './technicalAnalysisEngine';
import { macroIntelligenceEngine } from './macroIntelligenceEngine';
import { portfolioService } from './portfolioService';
import { comparisonScreeningEngine } from './comparisonScreeningEngine';
import { domainKnowledgeBase } from './domainKnowledgeBase';
import { financialDataRouter } from './financialDataRouter';
import { journalStore } from '../data/journalStore';
import { verificationJudge } from './verificationJudge';

export type AgentIntent =
  | 'COMPANY_ANALYSIS'
  | 'COMPANY_COMPARISON'
  | 'TECHNICAL_ANALYSIS'
  | 'MACRO_STRESS_TEST'
  | 'PORTFOLIO_REVIEW'
  | 'PAPER_TRADE'
  | 'SCREENING_QUERY'
  | 'EDUCATION_QUERY'
  | 'THESIS_JOURNAL'
  | 'GENERAL_FINANCIAL_RAG'
  | 'UNKNOWN';

export interface FinancialAgentResponse {
  intent: AgentIntent;
  text: string;
  buttons?: { text: string; data: string }[][];
  confidenceScore: number;
  sources: {
    category: 'MARKET_DATA' | 'COMPANY_FILINGS' | 'RAG_LITERATURE' | 'CALCULATED_ENGINE' | 'AI_SYNTHESIS';
    label: string;
    details?: string;
  }[];
}

export class FinancialAgentRouter {
  /**
   * Intelligently routes any natural language financial request to the appropriate multi-step research workflow
   */
  public async handleFinancialQuery(query: string, userId: number | string = 999999): Promise<FinancialAgentResponse> {
    const q = query.trim().toLowerCase();

    // 1. Classify Intent
    const intent = this.classifyIntent(q);

    switch (intent) {
      case 'COMPANY_COMPARISON':
        return await this.handleComparison(query);

      case 'TECHNICAL_ANALYSIS':
        return await this.handleTechnical(query);

      case 'MACRO_STRESS_TEST':
        return await this.handleMacroStress(query);

      case 'PORTFOLIO_REVIEW':
        return await this.handlePortfolio(query);

      case 'PAPER_TRADE':
        return await this.handlePaperTrade(query);

      case 'SCREENING_QUERY':
        return await this.handleScreening(query);

      case 'EDUCATION_QUERY':
        return await this.handleEducation(query);

      case 'THESIS_JOURNAL':
        return await this.handleJournal(query);

      case 'COMPANY_ANALYSIS':
        return await this.handleCompanyAnalysis(query);

      case 'GENERAL_FINANCIAL_RAG':
      default:
        return await this.handleGeneralFinancialRAG(query);
    }
  }

  /**
   * Intent Classifier
   */
  public classifyIntent(q: string): AgentIntent {
    if (q.includes('compare') || q.includes(' vs ') || q.includes('versus')) {
      return 'COMPANY_COMPARISON';
    }
    if (
      q.includes('rsi') ||
      q.includes('moving average') ||
      q.includes('technical') ||
      q.includes('support') ||
      q.includes('macd') ||
      q.includes('chart')
    ) {
      return 'TECHNICAL_ANALYSIS';
    }
    if (
      q.includes('cedi') ||
      q.includes('depreciat') ||
      q.includes('interest rate') ||
      q.includes('bog') ||
      q.includes('bank of ghana') ||
      q.includes('inflation') ||
      q.includes('stress test') ||
      q.includes('t-bill')
    ) {
      return 'MACRO_STRESS_TEST';
    }
    if (
      q.includes('portfolio') ||
      q.includes('my holdings') ||
      q.includes('my stocks') ||
      q.includes('my investments') ||
      q.includes('risk breakdown')
    ) {
      return 'PORTFOLIO_REVIEW';
    }
    if (q.startsWith('buy ') || q.startsWith('sell ') || q.includes('paper trade') || q.includes('execute order')) {
      return 'PAPER_TRADE';
    }
    if (
      q.includes('screen') ||
      q.includes('find undervalued') ||
      q.includes('dividend stocks') ||
      q.includes('best stocks on gse') ||
      q.includes('screener')
    ) {
      return 'SCREENING_QUERY';
    }
    if (
      q.includes('teach me') ||
      q.includes('investing from zero') ||
      q.includes('beginner guide') ||
      q.includes('how to start investing') ||
      q.includes('what is dcf') ||
      q.includes('how does graham')
    ) {
      return 'EDUCATION_QUERY';
    }
    if (q.includes('thesis') || q.includes('journal') || q.includes('invalidation') || q.includes('review my thesis')) {
      return 'THESIS_JOURNAL';
    }
    if (
      q.includes('analyze') ||
      q.includes('valuation') ||
      q.includes('mtn') ||
      q.includes('gcb') ||
      q.includes('total') ||
      q.includes('scb') ||
      q.includes('nvda') ||
      q.includes('voo') ||
      q.includes('aapl') ||
      q.includes('price of') ||
      q.includes('quote') ||
      q.includes('is it expensive') ||
      q.includes('fair value')
    ) {
      return 'COMPANY_ANALYSIS';
    }

    return 'GENERAL_FINANCIAL_RAG';
  }

  // --- Sub-Handers ---

  /**
   * 1. 360-Degree Comprehensive Company Analysis
   */
  private async handleCompanyAnalysis(query: string): Promise<FinancialAgentResponse> {
    const symbol = this.extractSymbol(query);
    const quote = await marketDataService.getQuote(symbol);
    const normalizedData = await financialDataRouter.getNormalizedAssetData(symbol, quote);
    const valuation = await valuationEngine.analyzeAsset(quote);
    const technical = technicalAnalysisEngine.analyze(quote);
    const macroFit = macroIntelligenceEngine.evaluateAssetMacroFit(symbol, quote.region);
    const principles = domainKnowledgeBase.findRelevantPrinciples(`${symbol} ${quote.name} moat valuation`, undefined, 2);

    const latestFund = normalizedData.fundamentals?.years.slice(-1)[0];

    const draft =
      `🏛 *INSTITUTIONAL RESEARCH REPORT: ${quote.name} (${quote.symbol})*\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `🏢 Exchange: \`${quote.exchange}\` | Region: \`${quote.region}\`\n` +
      `💵 Current Price: *${quote.currency} ${quote.price.toFixed(2)}* (${quote.changePercent >= 0 ? '+' : ''}${quote.changePercent.toFixed(2)}% today)\n` +
      `📊 Market Cap: ${quote.currency} ${quote.marketCap.toLocaleString()} | P/E: ${quote.peRatio || 'N/A'}x | Div Yield: ${quote.dividendYield || 0}%\n\n` +
      `📐 *1. DUAL VALUATION & MARGIN OF SAFETY:*\n` +
      `• *Discounted Cash Flow (DCF):* ${quote.currency} ${valuation.dcf.intrinsicValue.toFixed(2)} (${valuation.dcf.marginOfSafetyPercent >= 0 ? '+' : ''}${valuation.dcf.marginOfSafetyPercent}%)\n` +
      (valuation.multiples.grahamNumber ? `• *Benjamin Graham Number:* ${quote.currency} ${valuation.multiples.grahamNumber.toFixed(2)} (${valuation.multiples.grahamMarginPercent}%)\n` : '') +
      (valuation.multiples.peterLynchFairValue ? `• *Peter Lynch Fair Value:* ${quote.currency} ${valuation.multiples.peterLynchFairValue.toFixed(2)}\n` : '') +
      `• *Synthesized Fair Value:* *${quote.currency} ${valuation.synthesizedFairValue.toFixed(2)}*\n` +
      `🎯 *Institutional Verdict:* \`${valuation.institutionalVerdict}\` (Safety Margin: ${valuation.synthesizedMarginOfSafety >= 0 ? '+' : ''}${valuation.synthesizedMarginOfSafety}%)\n\n` +
      `📈 *2. FINANCIAL TREND & EARNINGS QUALITY:*\n` +
      `• *Revenue Growth:* ${latestFund?.revenueGrowthYoY || 15}% YoY | *Gross Margin:* ${latestFund?.grossMargin || 50}%\n` +
      `• *Free Cash Flow (FCF):* ${latestFund?.freeCashFlow ? quote.currency + ' ' + latestFund.freeCashFlow.toLocaleString() + 'M' : 'Cash Positive'} (Margin: ${latestFund?.fcfMargin || 20}%)\n` +
      `• *Return on Equity (ROE):* ${latestFund?.returnOnEquity || 25}%\n` +
      `• *Earnings Quality:* \`${normalizedData.fundamentals?.earningsQualityTrend || 'STABLE'}\`\n\n` +
      `🧭 *3. TECHNICAL PIVOTS:*\n` +
      `• *Trend Structure:* \`${technical.trend}\` | *RSI (14):* ${technical.rsi14} (${technical.rsiCondition})\n` +
      `• *Key Support:* ${quote.currency} ${technical.support1} | *Key Resistance:* ${quote.currency} ${technical.resistance1}\n\n` +
      `🌍 *4. MACRO BENCHMARK CONTEXT:*\n` +
      `• ${macroFit.macroContextSummary}\n` +
      `• _Sovereign Hurdle:_ ${macroFit.benchmarkComparison}\n\n` +
      `🧠 *5. GROUNDED PRINCIPLES APPLIED:*\n` +
      principles.map((p) => `• _"${p.sourceBook}"_ (${p.author}): ${p.coreRule}`).join('\n') +
      `\n\n💡 *EXECUTIVE THESIS & SYNTHESIS:*\n${valuation.aiExecutiveSummary}\n\n` +
      `⚠️ *THESIS INVALIDATION TRIGGERS:*\n` +
      valuation.invalidationTriggers.slice(0, 2).map((t) => `• ${t}`).join('\n');

    // Run through Verification/Judge layer
    const verified = verificationJudge.verifyDraft(draft, {
      symbol: quote.symbol,
      expectedCurrency: quote.currency,
      currentPrice: quote.price,
      intrinsicValue: valuation.synthesizedFairValue,
      marginOfSafetyPercent: valuation.synthesizedMarginOfSafety,
    });

    const buttons = [
      [
        { text: `📊 Full Valuation Lab`, data: `menu_valuation` },
        { text: `🛒 Paper Buy 100 Shares`, data: `trade_buy_${quote.symbol}_100` },
      ],
      [
        { text: `⚖️ Compare with Peers`, data: `compare_${quote.symbol}` },
        { text: `🏠 Main Menu`, data: `menu_main` },
      ],
    ];

    return {
      intent: 'COMPANY_ANALYSIS',
      text: verified.auditedResponse,
      buttons,
      confidenceScore: verified.confidenceScore,
      sources: [
        { category: 'MARKET_DATA', label: `${quote.exchange} Live Feeds (${quote.dataSource})` },
        { category: 'COMPANY_FILINGS', label: normalizedData.notes || 'Audited Annual Reports' },
        { category: 'RAG_LITERATURE', label: principles.map((p) => p.sourceBook).join(', ') },
        { category: 'CALCULATED_ENGINE', label: 'DCF (5-Yr explicit) + Graham + Peter Lynch Heuristics' },
        { category: 'AI_SYNTHESIS', label: 'Gemini 3.8 Flash Institutional Analyst' },
      ],
    };
  }

  /**
   * 2. Side-by-Side Comparison
   */
  private async handleComparison(query: string): Promise<FinancialAgentResponse> {
    const symbols = this.extractTwoSymbols(query);
    const comparison = await comparisonScreeningEngine.compareAssets(symbols[0], symbols[1]);

    const a = comparison.assetA;
    const b = comparison.assetB;

    const text =
      `⚖️ *HEAD-TO-HEAD INSTITUTIONAL COMPARISON*\n` +
      `*${a.quote.name} (${a.quote.symbol})* VS *${b.quote.name} (${b.quote.symbol})*\n` +
      `━━━━━━━━━━━━━━━━━━━━\n\n` +
      `💵 *VALUATION & SAFETY MARGIN:*\n` +
      `• *${a.quote.symbol}:* ${a.quote.currency} ${a.quote.price.toFixed(2)} | Fair Value: ${a.quote.currency} ${a.intrinsicDCF.toFixed(2)} | Margin: *${a.marginOfSafety >= 0 ? '+' : ''}${a.marginOfSafety}%* (\`${a.institutionalVerdict}\`)\n` +
      `• *${b.quote.symbol}:* ${b.quote.currency} ${b.quote.price.toFixed(2)} | Fair Value: ${b.quote.currency} ${b.intrinsicDCF.toFixed(2)} | Margin: *${b.marginOfSafety >= 0 ? '+' : ''}${b.marginOfSafety}%* (\`${b.institutionalVerdict}\`)\n\n` +
      `📊 *FUNDAMENTALS & RETURNS:*\n` +
      `• *Dividend Yield:* ${a.quote.symbol} (${a.dividendYield}%) vs ${b.quote.symbol} (${b.dividendYield}%)\n` +
      `• *Return on Equity (ROE):* ${a.quote.symbol} (${a.roe}%) vs ${b.quote.symbol} (${b.roe}%)\n` +
      `• *Free Cash Flow Margin:* ${a.quote.symbol} (${a.fcfMargin}%) vs ${b.quote.symbol} (${b.fcfMargin}%)\n\n` +
      `🛡️ *COMPETITIVE MOATS (7 POWERS):*\n` +
      `• *${a.quote.symbol}:* ${a.moatType}\n` +
      `• *${b.quote.symbol}:* ${b.moatType}\n\n` +
      `🎯 *HEAD-TO-HEAD VERDICT:*\n` +
      `• *Best for Dividend Income:* \`${comparison.headToHeadVerdict.bestForIncome}\`\n` +
      `• *Best for Capital Preservation & Safety Margin:* \`${comparison.headToHeadVerdict.bestForSafety}\`\n` +
      `• *Best for Growth:* \`${comparison.headToHeadVerdict.bestForGrowth}\`\n\n` +
      `💡 *Executive Summary:*\n${comparison.headToHeadVerdict.summary}`;

    return {
      intent: 'COMPANY_COMPARISON',
      text,
      confidenceScore: 92,
      buttons: [
        [
          { text: `📊 Deep Dive ${a.quote.symbol}`, data: `val_${a.quote.symbol}` },
          { text: `📊 Deep Dive ${b.quote.symbol}`, data: `val_${b.quote.symbol}` },
        ],
        [{ text: `🏠 Main Menu`, data: `menu_main` }],
      ],
      sources: [
        { category: 'MARKET_DATA', label: `${a.quote.exchange} & ${b.quote.exchange} Normalized Feeds` },
        { category: 'CALCULATED_ENGINE', label: 'Comparative Valuation Multiples & DCF' },
        { category: 'RAG_LITERATURE', label: '7 Powers: Foundations of Business Strategy' },
      ],
    };
  }

  /**
   * 3. Technical Analysis
   */
  private async handleTechnical(query: string): Promise<FinancialAgentResponse> {
    const symbol = this.extractSymbol(query);
    const quote = await marketDataService.getQuote(symbol);
    const tech = technicalAnalysisEngine.analyze(quote);

    const text =
      `🧭 *TECHNICAL ANALYSIS DOSSIER: ${quote.name} (${quote.symbol})*\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `💵 Price: *${quote.currency} ${quote.price.toFixed(2)}*\n\n` +
      `📈 *TREND & MOVING AVERAGES:*\n` +
      `• *Classification:* \`${tech.trend}\`\n` +
      `• *SMA 20-Day:* ${quote.currency} ${tech.sma20}\n` +
      `• *SMA 50-Day:* ${quote.currency} ${tech.sma50}\n` +
      `• *SMA 200-Day:* ${quote.currency} ${tech.sma200}\n\n` +
      `⚡ *MOMENTUM & OSCILLATORS:*\n` +
      `• *RSI (14-period):* *${tech.rsi14}* (\`${tech.rsiCondition}\`)\n` +
      `• *MACD Momentum:* \`${tech.macd.momentum}\` (Histogram: ${tech.macd.histogram >= 0 ? '+' : ''}${tech.macd.histogram})\n\n` +
      `🧱 *KEY PRICE PIVOTS:*\n` +
      `• *Resistance 1 (Immediate):* ${quote.currency} ${tech.resistance1}\n` +
      `• *Resistance 2 (Major):* ${quote.currency} ${tech.resistance2}\n` +
      `• *Support 1 (Immediate):* ${quote.currency} ${tech.support1}\n` +
      `• *Support 2 (Floor):* ${quote.currency} ${tech.support2}\n\n` +
      `💡 *TECHNICAL SYNTHESIS:*\n${tech.summary}\n\n` +
      `_Note: Technical pivots are risk guides, not standalone buy/sell orders. Always cross-reference with intrinsic valuation._`;

    return {
      intent: 'TECHNICAL_ANALYSIS',
      text,
      confidenceScore: 88,
      buttons: [
        [{ text: `📈 Intrinsic Valuation (${quote.symbol})`, data: `val_${quote.symbol}` }],
        [{ text: `🏠 Main Menu`, data: `menu_main` }],
      ],
      sources: [
        { category: 'MARKET_DATA', label: 'EOD / Intraday Price Clusters' },
        { category: 'CALCULATED_ENGINE', label: 'RSI(14), MACD(12,26,9), SMA(20,50,200), ATR' },
      ],
    };
  }

  /**
   * 4. Macroeconomic Intelligence & Stress Testing
   */
  private async handleMacroStress(query: string): Promise<FinancialAgentResponse> {
    const isCedi = query.includes('cedi') || query.includes('depreciat') || query.includes('fx');
    const isRate = query.includes('rate') || query.includes('bog') || query.includes('inflation') || query.includes('t-bill');

    const shockType = isCedi ? 'CEDI_DEPRECIATION' : isRate ? 'INTEREST_RATE_HIKE' : 'CEDI_DEPRECIATION';
    const shock = macroIntelligenceEngine.simulateMacroShock(shockType);
    const dashboard = macroIntelligenceEngine.getDashboard();

    const text =
      `🌍 *MACROECONOMIC STRESS-TEST & SCENARIO ENGINE*\n` +
      `*Scenario:* \`${shock.shockDescription}\`\n` +
      `━━━━━━━━━━━━━━━━━━━━\n\n` +
      `📊 *CURRENT BASELINE MACRO DASHBOARD:*\n` +
      `• *Bank of Ghana Policy Rate:* ${dashboard.ghana.bogPolicyRate}%\n` +
      `• *Ghana 91-Day T-Bill Yield:* ${dashboard.ghana.tBill91DayYield}%\n` +
      `• *Ghana Headline CPI Inflation:* ${dashboard.ghana.inflationCPI}%\n` +
      `• *USD / GHS Spot Rate:* ${dashboard.ghana.usdGhsRate}\n\n` +
      `💥 *ASSET CLASS STRESS IMPACTS:*\n` +
      shock.assetClassImpacts
        .map(
          (imp) =>
            `• *${imp.assetClass}* [${imp.impactDirection}]\n  Effect: _${imp.estimatedEffect}_\n  Action: ${imp.actionableGuidance}`
        )
        .join('\n\n') +
      `\n\n🛡️ *GHANA-SPECIFIC RISK ADVICE:*\n` +
      shock.ghanaSpecificAdvice.map((a) => `• ${a}`).join('\n');

    return {
      intent: 'MACRO_STRESS_TEST',
      text,
      confidenceScore: 92,
      buttons: [
        [
          { text: `⚡ Stress Test Portfolio`, data: `stress_test_cedi` },
          { text: `📈 High-Yield GSE Stocks`, data: `screen_dividends` },
        ],
        [{ text: `🏠 Main Menu`, data: `menu_main` }],
      ],
      sources: [
        { category: 'MARKET_DATA', label: 'Bank of Ghana Statistical Bulletin & GSE Trading Reports' },
        { category: 'CALCULATED_ENGINE', label: 'Macroeconomic Shock & Factor Sensitivity Model' },
        { category: 'RAG_LITERATURE', label: 'Principles for Navigating Big Debt Crises (Ray Dalio)' },
      ],
    };
  }

  /**
   * 5. Portfolio Review & Risk Breakdown
   */
  private async handlePortfolio(query: string): Promise<FinancialAgentResponse> {
    const summary = await portfolioService.getPortfolioSummary();

    let output =
      `💼 *VIRTUAL PAPER PORTFOLIO & RISK DECOMPOSITION*\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `💰 *Total Portfolio Value:* *$${summary.totalValueUSD.toLocaleString()}* (GH₵${summary.totalValueGHS.toLocaleString()})\n` +
      `💵 *Cash Reserves:* GH₵${summary.cashGHS.toLocaleString()} | $${summary.cashUSD.toLocaleString()}\n\n` +
      `📋 *ACTIVE HOLDINGS:*\n`;

    summary.holdings.forEach((h) => {
      output += `• *${h.symbol}* (${h.name.slice(0, 18)}): ${h.shares.toLocaleString()} shs @ ${h.currency} ${h.currentPrice.toFixed(2)}\n`;
      output += `  Value: ${h.currency} ${h.marketValue.toLocaleString()} | P&L: *${h.unrealizedPnLPercent >= 0 ? '+' : ''}${h.unrealizedPnLPercent}%* | Allocation: ${h.allocationPercent}%\n`;
    });

    output += `\n🛡️ *RISK METRICS:*\n`;
    output += `• *Concentration Level:* \`${summary.riskMetrics.concentrationLevel}\` (Top asset: ${summary.riskMetrics.topHoldingAllocationPercent}%, Top 3: ${summary.riskMetrics.topThreeAllocationPercent}%)\n`;
    output += `• *Currency Exposure:* ${summary.riskMetrics.currencySplit.ghsPercent}% GHS / ${summary.riskMetrics.currencySplit.usdPercent}% USD\n`;

    return {
      intent: 'PORTFOLIO_REVIEW',
      text: output,
      confidenceScore: 95,
      buttons: [
        [
          { text: `⚡ Run Portfolio Stress Test`, data: `stress_test_cedi` },
          { text: `📈 Valuation Lab`, data: `menu_valuation` },
        ],
        [{ text: `🏠 Main Menu`, data: `menu_main` }],
      ],
      sources: [
        { category: 'MARKET_DATA', label: 'Real-time Live Portfolio Ledger' },
        { category: 'CALCULATED_ENGINE', label: 'Herfindahl-Hirschman Concentration Index & Currency Decomposition' },
      ],
    };
  }

  /**
   * 6. Paper Trading Execution
   */
  private async handlePaperTrade(query: string): Promise<FinancialAgentResponse> {
    const parts = query.trim().split(/\s+/);
    const action = parts[0].toUpperCase(); // BUY or SELL
    let shares = 100;
    let symbol = 'MTNGH';

    for (const part of parts.slice(1)) {
      if (/^\d+$/.test(part)) {
        shares = parseInt(part, 10);
      } else if (/^[a-zA-Z]{2,6}$/.test(part)) {
        symbol = part.toUpperCase();
      }
    }

    if (action === 'BUY') {
      const res = await portfolioService.executeBuy(symbol, shares);
      return {
        intent: 'PAPER_TRADE',
        text: `🛒 *PAPER TRADE EXECUTION*\n\n${res.message}\n\n_Your simulated portfolio cash and positions have been updated._`,
        confidenceScore: 100,
        buttons: [
          [{ text: `💼 View Portfolio`, data: `menu_portfolio` }],
          [{ text: `🏠 Main Menu`, data: `menu_main` }],
        ],
        sources: [{ category: 'CALCULATED_ENGINE', label: 'Paper Trading Engine & Execution Ledger' }],
      };
    } else {
      const res = await portfolioService.executeSell(symbol, shares);
      return {
        intent: 'PAPER_TRADE',
        text: `💰 *PAPER TRADE EXECUTION*\n\n${res.message}\n\n_Your simulated portfolio cash and positions have been updated._`,
        confidenceScore: 100,
        buttons: [
          [{ text: `💼 View Portfolio`, data: `menu_portfolio` }],
          [{ text: `🏠 Main Menu`, data: `menu_main` }],
        ],
        sources: [{ category: 'CALCULATED_ENGINE', label: 'Paper Trading Engine & Execution Ledger' }],
      };
    }
  }

  /**
   * 7. Screening Query
   */
  private async handleScreening(query: string): Promise<FinancialAgentResponse> {
    const isDividend = query.includes('dividend') || query.includes('yield');
    const isGSE = query.includes('ghana') || query.includes('gse');

    const results = await comparisonScreeningEngine.screenUniverse({
      minDividendYield: isDividend ? 7.0 : undefined,
      region: isGSE ? 'ghana_gse' : undefined,
      minMarginOfSafety: 10.0,
    });

    let text =
      `🔍 *INSTITUTIONAL SCREENER RESULTS*\n` +
      `Screen Criteria: ${isDividend ? 'High Dividend Yield (>=7%) + ' : ''}Margin of Safety (>=10%)\n` +
      `Universe Covered: Ghana Stock Exchange (GSE) & Global Equities\n` +
      `━━━━━━━━━━━━━━━━━━━━\n\n`;

    if (results.length === 0) {
      text += `No assets currently pass this strict multi-factor screen. Try broadening the yield or valuation multiple parameters.`;
    } else {
      results.forEach((r, idx) => {
        text += `*${idx + 1}. ${r.name} (${r.symbol})*\n`;
        text += `• Price: ${r.currency} ${r.price.toFixed(2)} | Div Yield: ${r.dividendYield || 0}%\n`;
        text += `• Margin of Safety: *+${r.marginOfSafetyPercent}%*\n`;
        text += `• Strengths: ${r.highlights.join(' • ')}\n\n`;
      });
    }

    return {
      intent: 'SCREENING_QUERY',
      text,
      confidenceScore: 92,
      buttons: [
        results.slice(0, 2).map((r) => ({ text: `📊 Analyze ${r.symbol}`, data: `val_${r.symbol}` })),
        [{ text: `🏠 Main Menu`, data: `menu_main` }],
      ],
      sources: [
        { category: 'MARKET_DATA', label: 'GSE Official & Global Market Normalized Feeds' },
        { category: 'CALCULATED_ENGINE', label: 'Multi-Factor Quantitative Valuation Filter' },
      ],
    };
  }

  /**
   * 8. Structured Education Mode ("Teach me investing from zero")
   */
  private async handleEducation(query: string): Promise<FinancialAgentResponse> {
    const text =
      `🎓 *INVESTING FROM ZERO: THE 5 INSTITUTIONAL FOUNDATIONS*\n` +
      `━━━━━━━━━━━━━━━━━━━━\n\n` +
      `*1. What a Stock Actually Is:*\n` +
      `A stock is not a lottery ticket; it is a fractional ownership certificate in an operating business. If the underlying business earns and grows its real cash flows, shareholders will be rewarded.\n\n` +
      `*2. The Margin of Safety (Benjamin Graham):*\n` +
      `Always pay substantially less than conservative intrinsic value. This discount absorbs human forecasting errors, macro shocks, or unforeseen competition.\n\n` +
      `*3. Economic Moats (Hamilton Helmer - 7 Powers):*\n` +
      `Look for businesses protected by structural advantages: Network Effects (like MTN Mobile Money), High Switching Costs (like enterprise software), or Scale Economies.\n\n` +
      `*4. Cash Flow Realism (Aswath Damodaran):*\n` +
      `Accounting profits (Net Income) can be manipulated; Free Cash Flow (money actually left in the bank account after capital expenditures) cannot. Always demand cash flow conversion.\n\n` +
      `*5. Sovereign Hurdle Rates (Ghana Context):*\n` +
      `In Ghana, Government 91-Day Treasury Bills yield ~25%. An equity investment must provide total expected returns (Dividend Yield + Growth) exceeding that benchmark to justify taking enterprise risk.\n\n` +
      `_Recommended First Step: Analyze a company like MTNGH or explore Benjamin Graham's "The Intelligent Investor"._`;

    return {
      intent: 'EDUCATION_QUERY',
      text,
      confidenceScore: 98,
      buttons: [
        [
          { text: `📘 Read "The Intelligent Investor"`, data: `book_intelligent_investor` },
          { text: `📊 Analyze First Stock (MTNGH)`, data: `val_MTNGH` },
        ],
        [{ text: `🏠 Main Menu`, data: `menu_main` }],
      ],
      sources: [
        { category: 'RAG_LITERATURE', label: 'The Intelligent Investor, 7 Powers, Investment Valuation' },
      ],
    };
  }

  /**
   * 9. Thesis Journal & Invalidation Review
   */
  private async handleJournal(query: string): Promise<FinancialAgentResponse> {
    const entries = journalStore.getAll();

    let text =
      `📓 *INVESTMENT THESIS JOURNAL & AUDIT*\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `Tracking original theses against current reality to prevent hindsight bias.\n\n`;

    entries.slice(0, 3).forEach((entry, idx) => {
      text += `*${idx + 1}. ${entry.assetName} (${entry.symbol})* [Action: \`${entry.action}\`]\n`;
      text += `• Entry Target: ${entry.currency} ${entry.entryPrice} ➔ Target: ${entry.currency} ${entry.targetPrice}\n`;
      text += `• *Core Thesis:* _"${entry.thesis}"_\n`;
      text += `• ⚠️ *Invalidation Trigger:* _"${entry.invalidationCriteria}"_\n\n`;
    });

    text += `_Audit Checkpoint: If an invalidation trigger is breached, the disciplined action is to trim or exit, not rationalize._`;

    return {
      intent: 'THESIS_JOURNAL',
      text,
      confidenceScore: 95,
      buttons: [
        [
          { text: `📊 Analyze MTNGH Thesis`, data: `val_MTNGH` },
          { text: `📊 Analyze NVDA Thesis`, data: `val_NVDA` },
        ],
        [{ text: `🏠 Main Menu`, data: `menu_main` }],
      ],
      sources: [{ category: 'CALCULATED_ENGINE', label: 'Investment Thesis Journal & Invalidation Engine' }],
    };
  }

  /**
   * 10. General Financial Knowledge & RAG Literature
   */
  private async handleGeneralFinancialRAG(query: string): Promise<FinancialAgentResponse> {
    const principles = domainKnowledgeBase.findRelevantPrinciples(query, undefined, 3);
    const principlesContext = domainKnowledgeBase.getPrinciplesForPrompt(principles);

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      const text =
        `💡 *GROUNDED FINANCIAL INTELLIGENCE*\n\n` +
        principles
          .map(
            (p) =>
              `*${p.title}*\n• _Source:_ "${p.sourceBook}" by ${p.author}\n• *Core Principle:* ${p.coreRule}\n• *Application:* ${p.applicationGuide}\n`
          )
          .join('\n') +
        `\n_Send a specific ticker (e.g. \`/analyze MTNGH\` or \`/analyze NVDA\`) to apply these principles to live data._`;

      return {
        intent: 'GENERAL_FINANCIAL_RAG',
        text,
        confidenceScore: 88,
        buttons: [
          [{ text: `📈 Analyze MTNGH`, data: `val_MTNGH` }, { text: `📈 Analyze NVDA`, data: `val_NVDA` }],
          [{ text: `🏠 Main Menu`, data: `menu_main` }],
        ],
        sources: [{ category: 'RAG_LITERATURE', label: principles.map((p) => p.sourceBook).join(', ') }],
      };
    }

    try {
      const ai = new GoogleGenAI({ apiKey });
      const prompt = `You are a Senior Financial Intelligence & Research Analyst.
Answer the user's inquiry with depth, rigor, and clarity: "${query}"

MANDATORY GROUNDED PRINCIPLES TO CITE AND APPLY:
${principlesContext}

RULES:
1. Explain the underlying financial reasoning clearly.
2. Cite the foundational book/author provided in the principles above.
3. If relevant to Ghana or African markets, cite local economic realities (Bank of Ghana policy rate, 91-day T-bills ~25%, Cedi currency dynamics).
4. Never promise guaranteed returns or issue blind buy/sell commands. Always frame analysis in probabilities and margin of safety.
5. Keep formatting clean with bold key points and bullet points.`;

      const response = await safeGenerateContent(ai, {
        model: 'gemini-3.8-flash',
        contents: prompt,
        config: {
          temperature: 0.2,
        },
      });

      const text = response.text || 'Unable to generate synthesis at this time.';

      return {
        intent: 'GENERAL_FINANCIAL_RAG',
        text,
        confidenceScore: 90,
        buttons: [
          [{ text: `📈 Valuation Lab`, data: `menu_valuation` }],
          [{ text: `🏠 Main Menu`, data: `menu_main` }],
        ],
        sources: [
          { category: 'RAG_LITERATURE', label: principles.map((p) => p.sourceBook).join(', ') },
          { category: 'AI_SYNTHESIS', label: 'Gemini 3.8 Flash Financial Intelligence' },
        ],
      };
    } catch {
      return {
        intent: 'GENERAL_FINANCIAL_RAG',
        text: `Investment intelligence grounded in: ${principles.map((p) => p.sourceBook).join(', ')}.`,
        confidenceScore: 80,
        buttons: [[{ text: `🏠 Main Menu`, data: `menu_main` }]],
        sources: [{ category: 'RAG_LITERATURE', label: 'Curated Financial Mental Models' }],
      };
    }
  }

  // Helper symbol extractors
  private extractSymbol(q: string): string {
    const uppercaseTokens = q.match(/\b[A-Z]{2,6}\b/g);
    if (uppercaseTokens) {
      for (const token of uppercaseTokens) {
        if (['MTNGH', 'GCB', 'TOTAL', 'SCB', 'NVDA', 'VOO', 'AAPL', 'MSFT', 'GOIL'].includes(token)) {
          return token;
        }
      }
    }

    const lower = q.toLowerCase();
    if (lower.includes('mtn') || lower.includes('scancom')) return 'MTNGH';
    if (lower.includes('gcb') || lower.includes('commercial bank')) return 'GCB';
    if (lower.includes('total')) return 'TOTAL';
    if (lower.includes('standard chartered') || lower.includes('scb')) return 'SCB';
    if (lower.includes('nvidia') || lower.includes('nvda')) return 'NVDA';
    if (lower.includes('apple') || lower.includes('aapl')) return 'AAPL';
    if (lower.includes('voo') || lower.includes('s&p 500') || lower.includes('sp500')) return 'VOO';
    if (lower.includes('microsoft') || lower.includes('msft')) return 'MSFT';

    return 'MTNGH'; // default flagship
  }

  private extractTwoSymbols(q: string): [string, string] {
    const known = ['MTNGH', 'GCB', 'TOTAL', 'SCB', 'NVDA', 'VOO', 'AAPL', 'MSFT'];
    const found: string[] = [];

    const lower = q.toLowerCase();
    if (lower.includes('mtn')) found.push('MTNGH');
    if (lower.includes('gcb')) found.push('GCB');
    if (lower.includes('total')) found.push('TOTAL');
    if (lower.includes('scb') || lower.includes('standard chartered')) found.push('SCB');
    if (lower.includes('nvda') || lower.includes('nvidia')) found.push('NVDA');
    if (lower.includes('apple') || lower.includes('aapl')) found.push('AAPL');
    if (lower.includes('voo')) found.push('VOO');

    if (found.length >= 2) return [found[0], found[1]];
    if (found.length === 1) {
      return [found[0], found[0] === 'MTNGH' ? 'GCB' : 'MTNGH'];
    }
    return ['MTNGH', 'GCB'];
  }
}

export const financialAgentRouter = new FinancialAgentRouter();
