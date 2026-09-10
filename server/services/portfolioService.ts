import { FinancialAssetQuote } from '../../src/types';
import { marketDataService } from './marketData';

export interface PortfolioHolding {
  id: string;
  symbol: string;
  name: string;
  currency: 'GHS' | 'USD';
  exchange: string;
  shares: number;
  averageCost: number;
  currentPrice: number;
  marketValue: number;
  unrealizedPnL: number;
  unrealizedPnLPercent: number;
  allocationPercent: number;
  sector?: string;
}

export interface PortfolioSummary {
  cashGHS: number;
  cashUSD: number;
  equityValueGHS: number;
  equityValueUSD: number;
  totalValueGHS: number; // Converted at current USD/GHS rate
  totalValueUSD: number;
  holdings: PortfolioHolding[];
  riskMetrics: {
    topHoldingAllocationPercent: number;
    topThreeAllocationPercent: number;
    concentrationLevel: 'LOW' | 'MODERATE' | 'HIGH' | 'EXTREME';
    currencySplit: {
      ghsPercent: number;
      usdPercent: number;
    };
    sectorConcentration: Record<string, number>;
  };
}

export interface StressTestScenarioResult {
  scenarioId: string;
  title: string;
  description: string;
  preTestPortfolioValueUSD: number;
  postTestPortfolioValueUSD: number;
  estimatedDrawdownPercent: number;
  affectedHoldings: {
    symbol: string;
    prePrice: number;
    postPrice: number;
    lossPercent: number;
    impactUSD: number;
    cause: string;
  }[];
  mitigationRecommendations: string[];
}

export class PortfolioService {
  private cashGHS: number = 50000; // Virtual GH₵50,000
  private cashUSD: number = 10000; // Virtual $10,000
  private holdings: Map<string, PortfolioHolding> = new Map();
  private usdGhsExchangeRate: number = 15.65;

  constructor() {
    // Seed standard educational portfolio
    this.seedDefaultHoldings();
  }

  private seedDefaultHoldings() {
    this.holdings.set('MTNGH', {
      id: 'h-mtngh',
      symbol: 'MTNGH',
      name: 'MTN Ghana (Scancom PLC)',
      currency: 'GHS',
      exchange: 'GSE',
      shares: 10000,
      averageCost: 2.30,
      currentPrice: 2.65,
      marketValue: 26500,
      unrealizedPnL: 3500,
      unrealizedPnLPercent: 15.2,
      allocationPercent: 35.0,
      sector: 'Telecommunications',
    });

    this.holdings.set('GCB', {
      id: 'h-gcb',
      symbol: 'GCB',
      name: 'GCB Bank Limited',
      currency: 'GHS',
      exchange: 'GSE',
      shares: 2500,
      averageCost: 5.40,
      currentPrice: 5.90,
      marketValue: 14750,
      unrealizedPnL: 1250,
      unrealizedPnLPercent: 9.3,
      allocationPercent: 19.5,
      sector: 'Financial Services',
    });

    this.holdings.set('NVDA', {
      id: 'h-nvda',
      symbol: 'NVDA',
      name: 'NVIDIA Corporation',
      currency: 'USD',
      exchange: 'NASDAQ',
      shares: 20,
      averageCost: 118.00,
      currentPrice: 132.50,
      marketValue: 2650, // in USD (~41,472 GHS)
      unrealizedPnL: 290,
      unrealizedPnLPercent: 12.3,
      allocationPercent: 32.0,
      sector: 'Technology',
    });
  }

  /**
   * Recalculates all portfolio values with current quotes
   */
  public async getPortfolioSummary(): Promise<PortfolioSummary> {
    const list: PortfolioHolding[] = [];
    let equityGHS = 0;
    let equityUSD = 0;

    for (const h of this.holdings.values()) {
      try {
        const quote = await marketDataService.getQuote(h.symbol);
        const curPrice = quote.price;
        const mktVal = Number((curPrice * h.shares).toFixed(2));
        const costBasis = h.averageCost * h.shares;
        const pnl = Number((mktVal - costBasis).toFixed(2));
        const pnlPercent = Number((((curPrice - h.averageCost) / h.averageCost) * 100).toFixed(1));

        const updated: PortfolioHolding = {
          ...h,
          currentPrice: curPrice,
          marketValue: mktVal,
          unrealizedPnL: pnl,
          unrealizedPnLPercent: pnlPercent,
          sector: quote.sector || h.sector || 'General',
        };

        if (h.currency === 'GHS') {
          equityGHS += mktVal;
        } else {
          equityUSD += mktVal;
        }
        list.push(updated);
      } catch {
        if (h.currency === 'GHS') equityGHS += h.marketValue;
        else equityUSD += h.marketValue;
        list.push(h);
      }
    }

    const totalEquityUSD = equityUSD + equityGHS / this.usdGhsExchangeRate;
    const totalCashUSD = this.cashUSD + this.cashGHS / this.usdGhsExchangeRate;
    const totalPortfolioUSD = totalEquityUSD + totalCashUSD;

    // Calculate allocations
    const sectorMap: Record<string, number> = {};
    let totalGhsInUsd = this.cashGHS / this.usdGhsExchangeRate;
    let totalUsdInUsd = this.cashUSD;

    for (const item of list) {
      const valueInUSD = item.currency === 'USD' ? item.marketValue : item.marketValue / this.usdGhsExchangeRate;
      item.allocationPercent = Number(((valueInUSD / Math.max(1, totalPortfolioUSD)) * 100).toFixed(1));

      const sec = item.sector || 'Unassigned';
      sectorMap[sec] = Number(((sectorMap[sec] || 0) + item.allocationPercent).toFixed(1));

      if (item.currency === 'GHS') totalGhsInUsd += valueInUSD;
      else totalUsdInUsd += valueInUSD;
    }

    list.sort((a, b) => b.marketValue - a.marketValue);

    const top1 = list[0]?.allocationPercent || 0;
    const top3 = list.slice(0, 3).reduce((acc, curr) => acc + curr.allocationPercent, 0);

    let concentrationLevel: PortfolioSummary['riskMetrics']['concentrationLevel'] = 'LOW';
    if (top1 > 40 || top3 > 75) concentrationLevel = 'EXTREME';
    else if (top1 > 25 || top3 > 60) concentrationLevel = 'HIGH';
    else if (top1 > 15) concentrationLevel = 'MODERATE';

    const ghsPercent = Number(((totalGhsInUsd / Math.max(1, totalPortfolioUSD)) * 100).toFixed(1));
    const usdPercent = Number(((totalUsdInUsd / Math.max(1, totalPortfolioUSD)) * 100).toFixed(1));

    return {
      cashGHS: Number(this.cashGHS.toFixed(2)),
      cashUSD: Number(this.cashUSD.toFixed(2)),
      equityValueGHS: Number(equityGHS.toFixed(2)),
      equityValueUSD: Number(equityUSD.toFixed(2)),
      totalValueGHS: Number((totalPortfolioUSD * this.usdGhsExchangeRate).toFixed(2)),
      totalValueUSD: Number(totalPortfolioUSD.toFixed(2)),
      holdings: list,
      riskMetrics: {
        topHoldingAllocationPercent: top1,
        topThreeAllocationPercent: Number(top3.toFixed(1)),
        concentrationLevel,
        currencySplit: {
          ghsPercent,
          usdPercent,
        },
        sectorConcentration: sectorMap,
      },
    };
  }

  /**
   * Virtual Paper Trade execution: Buy
   */
  public async executeBuy(
    symbolRaw: string,
    shares: number
  ): Promise<{ success: boolean; message: string; holding?: PortfolioHolding }> {
    const symbol = symbolRaw.toUpperCase().trim();
    const quote = await marketDataService.getQuote(symbol);
    const cost = quote.price * shares;

    if (quote.currency === 'GHS') {
      if (this.cashGHS < cost) {
        return {
          success: false,
          message: `Insufficient GHS cash. Required GH₵${cost.toFixed(2)}, Available GH₵${this.cashGHS.toFixed(2)}.`,
        };
      }
      this.cashGHS -= cost;
    } else {
      if (this.cashUSD < cost) {
        return {
          success: false,
          message: `Insufficient USD cash. Required $${cost.toFixed(2)}, Available $${this.cashUSD.toFixed(2)}.`,
        };
      }
      this.cashUSD -= cost;
    }

    const existing = this.holdings.get(symbol);
    let updatedHolding: PortfolioHolding;

    if (existing) {
      const totalShares = existing.shares + shares;
      const totalCost = existing.shares * existing.averageCost + cost;
      const avgCost = totalCost / totalShares;

      updatedHolding = {
        ...existing,
        shares: totalShares,
        averageCost: Number(avgCost.toFixed(2)),
        currentPrice: quote.price,
        marketValue: Number((totalShares * quote.price).toFixed(2)),
        unrealizedPnL: Number(((quote.price - avgCost) * totalShares).toFixed(2)),
        unrealizedPnLPercent: Number((((quote.price - avgCost) / avgCost) * 100).toFixed(1)),
      };
    } else {
      updatedHolding = {
        id: `h-${symbol.toLowerCase()}-${Date.now()}`,
        symbol,
        name: quote.name,
        currency: quote.currency,
        exchange: quote.exchange,
        shares,
        averageCost: quote.price,
        currentPrice: quote.price,
        marketValue: Number((shares * quote.price).toFixed(2)),
        unrealizedPnL: 0,
        unrealizedPnLPercent: 0,
        allocationPercent: 0,
        sector: quote.sector,
      };
    }

    this.holdings.set(symbol, updatedHolding);

    return {
      success: true,
      message: `Successfully bought ${shares} shares of ${symbol} (${quote.name}) at ${quote.currency} ${quote.price.toFixed(2)}.`,
      holding: updatedHolding,
    };
  }

  /**
   * Virtual Paper Trade execution: Sell
   */
  public async executeSell(
    symbolRaw: string,
    shares: number
  ): Promise<{ success: boolean; message: string; realizedPnL?: number }> {
    const symbol = symbolRaw.toUpperCase().trim();
    const existing = this.holdings.get(symbol);

    if (!existing || existing.shares < shares) {
      return {
        success: false,
        message: `Cannot sell ${shares} shares. You currently own ${existing?.shares || 0} shares of ${symbol}.`,
      };
    }

    const quote = await marketDataService.getQuote(symbol);
    const proceeds = quote.price * shares;
    const costBasis = existing.averageCost * shares;
    const realizedPnL = Number((proceeds - costBasis).toFixed(2));

    if (existing.currency === 'GHS') {
      this.cashGHS += proceeds;
    } else {
      this.cashUSD += proceeds;
    }

    if (existing.shares === shares) {
      this.holdings.delete(symbol);
    } else {
      const remainingShares = existing.shares - shares;
      this.holdings.set(symbol, {
        ...existing,
        shares: remainingShares,
        marketValue: Number((remainingShares * quote.price).toFixed(2)),
        unrealizedPnL: Number(((quote.price - existing.averageCost) * remainingShares).toFixed(2)),
      });
    }

    return {
      success: true,
      message: `Sold ${shares} shares of ${symbol} at ${existing.currency} ${quote.price.toFixed(2)} (Realized P&L: ${existing.currency} ${realizedPnL >= 0 ? '+' : ''}${realizedPnL}).`,
      realizedPnL,
    };
  }

  /**
   * Stress Testing Engine across major macro & company shocks
   */
  public async runStressTest(
    scenarioType: 'CEDI_DEPRECIATION_15' | 'RATE_HIKE_300BPS' | 'TECH_DRAWDOWN_25' | 'TOP_HOLDING_CRASH_30'
  ): Promise<StressTestScenarioResult> {
    const summary = await this.getPortfolioSummary();
    const preUSD = summary.totalValueUSD;
    let postUSD = preUSD;

    const affected: StressTestScenarioResult['affectedHoldings'] = [];
    let title = '';
    let description = '';
    const recs: string[] = [];

    if (scenarioType === 'CEDI_DEPRECIATION_15') {
      title = 'Ghana Cedi 15% Currency Depreciation Shock';
      description = 'Simulates a 15% drop in the value of the Ghana Cedi against the US Dollar (from 15.65 to ~18.00 USD/GHS).';

      // GHS cash and equity loses 15% purchasing power when measured in USD
      for (const h of summary.holdings) {
        if (h.currency === 'GHS') {
          const preInUSD = h.marketValue / this.usdGhsExchangeRate;
          const postInUSD = h.marketValue / (this.usdGhsExchangeRate * 1.15);
          const lossUSD = preInUSD - postInUSD;
          postUSD -= lossUSD;

          affected.push({
            symbol: h.symbol,
            prePrice: h.currentPrice,
            postPrice: Number((h.currentPrice / 1.15).toFixed(2)), // in USD terms
            lossPercent: -13.0,
            impactUSD: Number(lossUSD.toFixed(2)),
            cause: 'Local currency denomination diluted against USD standard.',
          });
        }
      }

      const cashLossUSD = (summary.cashGHS / this.usdGhsExchangeRate) * 0.13;
      postUSD -= cashLossUSD;

      recs.push('Increase allocation to dollar-earning exporters (e.g. BOPP palm oil on GSE) or global ETFs (VOO).');
      recs.push('Ensure telecom and banking holdings possess high domestic dividend yields to outpace currency erosion.');
    } else if (scenarioType === 'RATE_HIKE_300BPS') {
      title = 'Central Bank 300 bps Interest Rate Hike';
      description = 'Central banks hike policy rates by 300 bps, raising discount rates and compressing valuation multiples.';

      for (const h of summary.holdings) {
        const dropPercent = h.sector === 'Technology' ? 18.0 : 8.0;
        const valUSD = h.currency === 'USD' ? h.marketValue : h.marketValue / this.usdGhsExchangeRate;
        const lossUSD = valUSD * (dropPercent / 100);
        postUSD -= lossUSD;

        affected.push({
          symbol: h.symbol,
          prePrice: h.currentPrice,
          postPrice: Number((h.currentPrice * (1 - dropPercent / 100)).toFixed(2)),
          lossPercent: -dropPercent,
          impactUSD: Number(lossUSD.toFixed(2)),
          cause: 'Multiple compression from higher risk-free discount hurdle.',
        });
      }

      recs.push('Hold higher cash reserves in high-yielding short-term Treasury bills (91-day yields ~25%+).');
      recs.push('Favor low-debt, high-cash businesses over capital-intensive growth firms.');
    } else if (scenarioType === 'TOP_HOLDING_CRASH_30') {
      const top = summary.holdings[0];
      title = `Single-Asset Shock: 30% Crash in Top Holding (${top.symbol})`;
      description = `Tests the portfolio resilience if the largest holding (${top.symbol}, representing ${top.allocationPercent}% of portfolio) drops 30% on earnings miss or regulatory penalty.`;

      const valUSD = top.currency === 'USD' ? top.marketValue : top.marketValue / this.usdGhsExchangeRate;
      const lossUSD = valUSD * 0.3;
      postUSD -= lossUSD;

      affected.push({
        symbol: top.symbol,
        prePrice: top.currentPrice,
        postPrice: Number((top.currentPrice * 0.7).toFixed(2)),
        lossPercent: -30.0,
        impactUSD: Number(lossUSD.toFixed(2)),
        cause: `30% price re-rating in largest position (${top.symbol}).`,
      });

      recs.push(`Trim ${top.symbol} so no single asset exceeds 20-25% of total capital.`);
      recs.push('Introduce non-correlated assets (e.g. commodities, government T-bills, gold).');
    } else {
      title = 'Global Technology Multiple Retraction (25%)';
      description = 'Tech sector experiences a 25% correction due to AI capital expenditure digestion.';

      for (const h of summary.holdings) {
        if (h.sector === 'Technology') {
          const valUSD = h.currency === 'USD' ? h.marketValue : h.marketValue / this.usdGhsExchangeRate;
          const lossUSD = valUSD * 0.25;
          postUSD -= lossUSD;

          affected.push({
            symbol: h.symbol,
            prePrice: h.currentPrice,
            postPrice: Number((h.currentPrice * 0.75).toFixed(2)),
            lossPercent: -25.0,
            impactUSD: Number(lossUSD.toFixed(2)),
            cause: 'Sector-wide multiple contraction.',
          });
        }
      }

      recs.push('Balance high-multiple growth equities with defensive dividend stalwarts and value holdings.');
    }

    const drawdownPercent = Number((((postUSD - preUSD) / preUSD) * 100).toFixed(1));

    return {
      scenarioId: scenarioType,
      title,
      description,
      preTestPortfolioValueUSD: Number(preUSD.toFixed(2)),
      postTestPortfolioValueUSD: Number(postUSD.toFixed(2)),
      estimatedDrawdownPercent: drawdownPercent,
      affectedHoldings: affected,
      mitigationRecommendations: recs,
    };
  }
}

export const portfolioService = new PortfolioService();
