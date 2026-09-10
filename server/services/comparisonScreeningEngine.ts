import { FinancialAssetQuote } from '../../src/types';
import { marketDataService } from './marketData';
import { valuationEngine } from './valuationEngine';
import { financialDataRouter } from './financialDataRouter';

export interface AssetComparisonResult {
  assetA: {
    quote: FinancialAssetQuote;
    pe: number | string;
    pb: number | string;
    dividendYield: number;
    roe: number;
    fcfMargin: number;
    intrinsicDCF: number;
    marginOfSafety: number;
    institutionalVerdict: string;
    moatType: string;
  };
  assetB: {
    quote: FinancialAssetQuote;
    pe: number | string;
    pb: number | string;
    dividendYield: number;
    roe: number;
    fcfMargin: number;
    intrinsicDCF: number;
    marginOfSafety: number;
    institutionalVerdict: string;
    moatType: string;
  };
  keyDifferences: string[];
  headToHeadVerdict: {
    bestForIncome: string;
    bestForGrowth: string;
    bestForSafety: string;
    overallAdvantage: string;
    summary: string;
  };
}

export interface ScreenFilterCriterion {
  minDividendYield?: number;
  maxPE?: number;
  maxPB?: number;
  minMarginOfSafety?: number;
  region?: 'ghana_gse' | 'us_global';
  minROE?: number;
}

export interface ScreenedAsset {
  symbol: string;
  name: string;
  exchange: string;
  currency: string;
  price: number;
  peRatio?: number;
  dividendYield?: number;
  marginOfSafetyPercent: number;
  highlights: string[];
}

export class ComparisonScreeningEngine {
  /**
   * Generates a thorough head-to-head comparison between two assets
   */
  public async compareAssets(symbolA: string, symbolB: string): Promise<AssetComparisonResult> {
    const quoteA = await marketDataService.getQuote(symbolA);
    const quoteB = await marketDataService.getQuote(symbolB);

    const valA = await valuationEngine.analyzeAsset(quoteA);
    const valB = await valuationEngine.analyzeAsset(quoteB);

    const dataA = await financialDataRouter.getNormalizedAssetData(symbolA, quoteA);
    const dataB = await financialDataRouter.getNormalizedAssetData(symbolB, quoteB);

    const latestFundA = dataA.fundamentals?.years.slice(-1)[0];
    const latestFundB = dataB.fundamentals?.years.slice(-1)[0];

    const moatA = symbolA.toUpperCase().includes('MTN')
      ? 'Network Effects & Scale (Helmer)'
      : symbolA.toUpperCase().includes('NVDA')
      ? 'High Switching Costs & CUDA Ecosystem'
      : symbolA.toUpperCase().includes('GCB')
      ? 'Branch Network & Low-Cost Deposit Scale'
      : 'Brand & Distribution Power';

    const moatB = symbolB.toUpperCase().includes('MTN')
      ? 'Network Effects & Scale (Helmer)'
      : symbolB.toUpperCase().includes('NVDA')
      ? 'High Switching Costs & CUDA Ecosystem'
      : symbolB.toUpperCase().includes('GCB')
      ? 'Branch Network & Low-Cost Deposit Scale'
      : 'Brand & Distribution Power';

    const yieldA = quoteA.dividendYield || 0;
    const yieldB = quoteB.dividendYield || 0;

    const bestIncome = yieldA > yieldB ? quoteA.symbol : quoteB.symbol;
    const bestGrowth =
      (latestFundA?.revenueGrowthYoY || 0) > (latestFundB?.revenueGrowthYoY || 0) ? quoteA.symbol : quoteB.symbol;
    const bestSafety = valA.synthesizedMarginOfSafety > valB.synthesizedMarginOfSafety ? quoteA.symbol : quoteB.symbol;

    const summary = `${quoteA.name} trades at ${quoteA.currency} ${quoteA.price.toFixed(2)} (${valA.institutionalVerdict}) while ${quoteB.name} trades at ${quoteB.currency} ${quoteB.price.toFixed(2)} (${valB.institutionalVerdict}). For high immediate cash distributions, ${bestIncome} is superior (${Math.max(yieldA, yieldB)}% yield); for margin of safety, ${bestSafety} provides greater downside buffer (${Math.max(valA.synthesizedMarginOfSafety, valB.synthesizedMarginOfSafety)}%).`;

    return {
      assetA: {
        quote: quoteA,
        pe: quoteA.peRatio || 'N/A',
        pb: quoteA.pbRatio || 'N/A',
        dividendYield: yieldA,
        roe: latestFundA?.returnOnEquity || 20.0,
        fcfMargin: latestFundA?.fcfMargin || 18.0,
        intrinsicDCF: valA.dcf.intrinsicValue,
        marginOfSafety: valA.synthesizedMarginOfSafety,
        institutionalVerdict: valA.institutionalVerdict,
        moatType: moatA,
      },
      assetB: {
        quote: quoteB,
        pe: quoteB.peRatio || 'N/A',
        pb: quoteB.pbRatio || 'N/A',
        dividendYield: yieldB,
        roe: latestFundB?.returnOnEquity || 20.0,
        fcfMargin: latestFundB?.fcfMargin || 18.0,
        intrinsicDCF: valB.dcf.intrinsicValue,
        marginOfSafety: valB.synthesizedMarginOfSafety,
        institutionalVerdict: valB.institutionalVerdict,
        moatType: moatB,
      },
      keyDifferences: [
        `Capital return profile: ${quoteA.symbol} dividend yield is ${yieldA}% vs ${quoteB.symbol} at ${yieldB}%.`,
        `Valuation safety margin: ${quoteA.symbol} has a ${valA.synthesizedMarginOfSafety}% margin vs ${quoteB.symbol} at ${valB.synthesizedMarginOfSafety}%.`,
        `Competitive Moat: ${quoteA.symbol} relies on ${moatA} while ${quoteB.symbol} deploys ${moatB}.`,
      ],
      headToHeadVerdict: {
        bestForIncome: bestIncome,
        bestForGrowth: bestGrowth,
        bestForSafety: bestSafety,
        overallAdvantage: valA.synthesizedMarginOfSafety >= valB.synthesizedMarginOfSafety ? quoteA.symbol : quoteB.symbol,
        summary,
      },
    };
  }

  /**
   * Natural Language & Multi-Factor Screener
   */
  public async screenUniverse(criteria: ScreenFilterCriterion): Promise<ScreenedAsset[]> {
    const universe = ['MTNGH', 'GCB', 'TOTAL', 'SCB', 'NVDA', 'AAPL', 'VOO'];
    const results: ScreenedAsset[] = [];

    for (const sym of universe) {
      try {
        const quote = await marketDataService.getQuote(sym);
        if (criteria.region && quote.region !== criteria.region) continue;

        if (criteria.minDividendYield && (quote.dividendYield || 0) < criteria.minDividendYield) {
          continue;
        }

        if (criteria.maxPE && quote.peRatio && quote.peRatio > criteria.maxPE) {
          continue;
        }

        if (criteria.maxPB && quote.pbRatio && quote.pbRatio > criteria.maxPB) {
          continue;
        }

        const val = await valuationEngine.analyzeAsset(quote);
        if (criteria.minMarginOfSafety && val.synthesizedMarginOfSafety < criteria.minMarginOfSafety) {
          continue;
        }

        const highlights: string[] = [];
        if (quote.dividendYield && quote.dividendYield >= 7) {
          highlights.push(`High Cash Distribution (${quote.dividendYield}% Yield)`);
        }
        if (val.synthesizedMarginOfSafety > 15) {
          highlights.push(`Margin of Safety (${val.synthesizedMarginOfSafety}%)`);
        }
        if (quote.peRatio && quote.peRatio < 10) {
          highlights.push(`Depressed Valuation Multiple (${quote.peRatio}x P/E)`);
        }

        results.push({
          symbol: quote.symbol,
          name: quote.name,
          exchange: quote.exchange,
          currency: quote.currency,
          price: quote.price,
          peRatio: quote.peRatio,
          dividendYield: quote.dividendYield,
          marginOfSafetyPercent: val.synthesizedMarginOfSafety,
          highlights,
        });
      } catch {
        continue;
      }
    }

    results.sort((a, b) => b.marginOfSafetyPercent - a.marginOfSafetyPercent);
    return results;
  }
}

export const comparisonScreeningEngine = new ComparisonScreeningEngine();
