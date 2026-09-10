/**
 * Macroeconomic & Ghana / African Markets Intelligence Engine
 * 
 * Centralizes:
 * - Bank of Ghana Policy Rates, Inflation, T-bill Yields, USD/GHS trends
 * - Global benchmark interest rates (US Fed Funds, 10Y Treasury)
 * - Key export commodity benchmarks (Gold, Cocoa, Crude Oil)
 * - Sector vulnerability & sensitivity matrices
 * - Macroeconomic shock simulator (e.g. Cedi depreciation shock, rate shock)
 */

export interface MacroeconomicDashboard {
  ghana: {
    bogPolicyRate: number; // e.g. 28.0%
    inflationCPI: number; // e.g. 21.5%
    tBill91DayYield: number; // e.g. 24.8%
    tBill182DayYield: number; // e.g. 26.5%
    usdGhsRate: number; // e.g. 15.65
    usdGhsYoYChangePercent: number; // e.g. 22.4%
    grossInternationalReservesUSD: number; // in billions, e.g. 6.8
    postDdepRecoveryStatus: 'ADVANCING' | 'FRAGILE' | 'CONSOLIDATED';
    lastUpdated: string;
  };
  global: {
    usFedFundsRate: number; // 4.50%
    us10YearTreasuryYield: number; // 4.30%
    brentCrudeOilUSD: number; // $74.50
    goldSpotUSD: number; // $2,860.00
    cocoaFuturesUSD: number; // $7,800.00
    lastUpdated: string;
  };
  sectorSensitivities: Record<string, {
    rateSensitivity: 'POSITIVE' | 'NEUTRAL' | 'NEGATIVE';
    fxSensitivity: 'POSITIVE' | 'NEUTRAL' | 'HIGHLY_NEGATIVE';
    inflationPassThrough: 'HIGH' | 'MODERATE' | 'LOW';
    commentary: string;
  }>;
}

export interface MacroShockResult {
  shockDescription: string;
  assetClassImpacts: {
    assetClass: string;
    impactDirection: 'FAVORABLE' | 'NEUTRAL' | 'ADVERSE';
    estimatedEffect: string;
    actionableGuidance: string;
  }[];
  ghanaSpecificAdvice: string[];
}

export class MacroIntelligenceEngine {
  private dashboard: MacroeconomicDashboard = {
    ghana: {
      bogPolicyRate: 28.0,
      inflationCPI: 21.5,
      tBill91DayYield: 24.8,
      tBill182DayYield: 26.5,
      usdGhsRate: 15.65,
      usdGhsYoYChangePercent: 21.8,
      grossInternationalReservesUSD: 6.9,
      postDdepRecoveryStatus: 'ADVANCING',
      lastUpdated: new Date().toISOString().slice(0, 10),
    },
    global: {
      usFedFundsRate: 4.5,
      us10YearTreasuryYield: 4.28,
      brentCrudeOilUSD: 75.2,
      goldSpotUSD: 2880.0,
      cocoaFuturesUSD: 7950.0,
      lastUpdated: new Date().toISOString().slice(0, 10),
    },
    sectorSensitivities: {
      'Banking & Financials (GCB, SCB, EGH)': {
        rateSensitivity: 'POSITIVE',
        fxSensitivity: 'NEUTRAL',
        inflationPassThrough: 'MODERATE',
        commentary:
          'Net interest margins thrive in high-yield T-bill environment (~25%), but loan impairment provisions (NPLs) must be tracked closely post-DDEP.',
      },
      'Telecommunications (MTNGH)': {
        rateSensitivity: 'NEUTRAL',
        fxSensitivity: 'NEUTRAL',
        inflationPassThrough: 'HIGH',
        commentary:
          'Mobile Money transaction velocity and data consumption hedge against inflation; however, network equipment and foreign software licenses incur US Dollar capex obligations.',
      },
      'Energy & Oil Marketing (TOTAL, GOIL)': {
        rateSensitivity: 'NEGATIVE',
        fxSensitivity: 'HIGHLY_NEGATIVE',
        inflationPassThrough: 'HIGH',
        commentary:
          'Deregulation enables fortnightly retail pump price adjustments to pass through FX depreciation; however, rising pump prices constrain overall fuel demand volume.',
      },
      'Agribusiness & Export (BOPP)': {
        rateSensitivity: 'NEUTRAL',
        fxSensitivity: 'POSITIVE',
        inflationPassThrough: 'HIGH',
        commentary:
          'Crude palm oil is dollar-benchmarked on international markets; Cedi depreciation directly expands local currency revenues while operating costs remain domestic.',
      },
    },
  };

  public getDashboard(): MacroeconomicDashboard {
    return this.dashboard;
  }

  /**
   * Evaluates how an asset is situated against the current macro backdrop
   */
  public evaluateAssetMacroFit(symbol: string, region: 'ghana_gse' | 'us_global' | 'etf_fund' | string): {
    macroContextSummary: string;
    benchmarkComparison: string;
    hurdleRatePercent: number;
    headwinds: string[];
    tailwinds: string[];
  } {
    if (region === 'ghana_gse') {
      const hurdle = this.dashboard.ghana.tBill91DayYield; // ~24.8%
      const isMtn = symbol.toUpperCase().includes('MTN');
      const isBank = symbol.toUpperCase().includes('GCB') || symbol.toUpperCase().includes('SCB');

      return {
        macroContextSummary: `Operating in Ghana macro environment: BoG Policy Rate ${this.dashboard.ghana.bogPolicyRate}%, 91-Day T-bill benchmark ${hurdle}%, and Headline Inflation ${this.dashboard.ghana.inflationCPI}%.`,
        benchmarkComparison: `To justify equity risk over Government of Ghana 91-day paper, total projected return (Dividend Yield + Capital Gain) must clear the ${hurdle}% sovereign risk-free hurdle rate.`,
        hurdleRatePercent: hurdle,
        headwinds: [
          'High sovereign yield draws domestic institutional capital into T-bills rather than equities',
          'Persistent foreign exchange currency depreciation pressure on imported inputs',
        ],
        tailwinds: [
          isMtn ? 'Dominant mobile money pricing power with network scale' : isBank ? 'Sovereign paper reinvestment at ~25% yields widening net interest spreads' : 'Strong export commodity terms of trade (Gold and Cocoa)',
          'Substantial post-DDEP operational recovery across Tier-1 institutions',
        ],
      };
    } else {
      const hurdle = this.dashboard.global.us10YearTreasuryYield; // ~4.28%
      return {
        macroContextSummary: `Operating in Global/US environment: US Fed Funds ${this.dashboard.global.usFedFundsRate}%, 10-Year Benchmark ${hurdle}%, Gold $${this.dashboard.global.goldSpotUSD}/oz.`,
        benchmarkComparison: `Equity risk premium benchmarked against the US 10-Year Treasury yield of ${hurdle}%.`,
        hurdleRatePercent: hurdle + 5.0, // ~9.28% Cost of Equity
        headwinds: [
          'High for longer interest rates pressuring growth stock valuation multiples',
          'Enterprise IT capital expenditure scrutiny and cloud optimization cycles',
        ],
        tailwinds: [
          'Secular tailwind in accelerated computing and AI infrastructure spend',
          'Robust US corporate balance sheets and resilient consumer spending',
        ],
      };
    }
  }

  /**
   * Simulates macroeconomic shocks for portfolio stress-testing
   */
  public simulateMacroShock(shock: 'CEDI_DEPRECIATION' | 'INTEREST_RATE_HIKE' | 'COMMODITY_CRUNCH'): MacroShockResult {
    if (shock === 'CEDI_DEPRECIATION') {
      return {
        shockDescription: 'Sudden 15% Cedi Depreciation against the US Dollar (USD/GHS moves from 15.65 to 18.00)',
        assetClassImpacts: [
          {
            assetClass: 'GSE Domestic Equities (Consumer/Retail)',
            impactDirection: 'ADVERSE',
            estimatedEffect: 'Margin compression of 150-300 bps due to higher imported packaging and inventory costs.',
            actionableGuidance: 'Favor cash-generative franchises with documented pricing power over small import-reliant firms.',
          },
          {
            assetClass: 'GSE Export Equities (BOPP, Palm Oil, Cocoa)',
            impactDirection: 'FAVORABLE',
            estimatedEffect: 'Local cedi revenue expands ~12-15% as export prices are denominated in USD or EUR.',
            actionableGuidance: 'Hold as a direct domestic natural FX hedge.',
          },
          {
            assetClass: 'Global / US Equities (Held in USD)',
            impactDirection: 'FAVORABLE',
            estimatedEffect: 'Purchasing power in Cedi terms increases by 15%, defending real wealth against inflation.',
            actionableGuidance: 'Maintain international asset diversification.',
          },
        ],
        ghanaSpecificAdvice: [
          'Bank of Ghana will likely deploy foreign exchange reserve interventions and tighten open market operations.',
          'Investors should monitor corporate FX debt footnotes in quarterly financial statements.',
        ],
      };
    } else if (shock === 'INTEREST_RATE_HIKE') {
      return {
        shockDescription: 'Bank of Ghana / Central Bank raises benchmark interest rate by 300 bps',
        assetClassImpacts: [
          {
            assetClass: 'Equities (Valuation Multiples)',
            impactDirection: 'ADVERSE',
            estimatedEffect: 'Discount rates rise, compressing fair value multiples by 8-12%. High-multiple growth equities hit hardest.',
            actionableGuidance: 'Rotate toward high-dividend stalwarts with immediate cash yields > 9%.',
          },
          {
            assetClass: 'Government Treasury Bills',
            impactDirection: 'FAVORABLE',
            estimatedEffect: 'Yields on new 91-day and 182-day paper rise to 28-29%, increasing risk-free income.',
            actionableGuidance: 'Utilize short-term laddering to capture higher reinvestment rates.',
          },
        ],
        ghanaSpecificAdvice: [
          'Borrowing costs for SMEs will surge above 35%, increasing bank loan default risks (NPLs).',
        ],
      };
    } else {
      return {
        shockDescription: 'Severe 25% drop in Cocoa and Crude Oil international export prices',
        assetClassImpacts: [
          {
            assetClass: 'Sovereign FX Balance & Currency',
            impactDirection: 'ADVERSE',
            estimatedEffect: 'Reduces Bank of Ghana foreign exchange reserves, accelerating local currency depreciation pressure.',
            actionableGuidance: 'Increase allocation to defensive dollar-denominated assets and gold.',
          },
        ],
        ghanaSpecificAdvice: [
          'Government fiscal deficit widens, increasing dependence on domestic Treasury bill issuance.',
        ],
      };
    }
  }
}

export const macroIntelligenceEngine = new MacroIntelligenceEngine();
