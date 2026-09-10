import { GoogleGenAI } from '@google/genai';
import {
  FinancialAssetQuote,
  DualValuationResult,
  DCFValuation,
  MultiplesValuation,
  ThesisScenario,
} from '../../src/types';
import { ragStore } from './ragStore';
import { safeGenerateContent } from '../utils/geminiHelper';

/**
 * Dual Valuation & RAG Synthesis Engine
 * Combines DCF (Intrinsic Cash Flow) with Multiples (Graham Number & Peter Lynch PEG)
 * Grounded in the dynamic library of investment literature.
 */
export class ValuationEngine {
  /**
   * Performs full dual valuation and generative AI synthesis
   */
  public async analyzeAsset(
    asset: FinancialAssetQuote,
    customAssumptions?: { growthRate?: number; discountRate?: number; terminalRate?: number }
  ): Promise<DualValuationResult> {
    // 1. Calculate Discounted Cash Flow (DCF)
    const dcf = this.calculateDCF(asset, customAssumptions);

    // 2. Calculate Multiples & Heuristics (Graham + Peter Lynch)
    const multiples = this.calculateMultiples(asset);

    // 3. Retrieve relevant mental models from the dynamic RAG store
    const activeModels = ragStore.getRelevantModels(asset.symbol, asset.region);

    // 4. Synthesize with Gemini 3.8 Flash (or algorithmic fallback)
    const synthesis = await this.synthesizeWithAI(asset, dcf, multiples, activeModels);

    return synthesis;
  }

  /**
   * Discounted Cash Flow (DCF) Model
   * Adjusts for emerging/frontier risk (Ghana GHS) vs US Dollar assets
   */
  public calculateDCF(
    asset: FinancialAssetQuote,
    assumptions?: { growthRate?: number; discountRate?: number; terminalRate?: number }
  ): DCFValuation {
    const isGse = asset.currency === 'GHS';

    // Baseline growth rate estimation
    const defaultGrowth = isGse ? 12.0 : (asset.symbol === 'NVDA' ? 25.0 : 9.0);
    const growthRate = assumptions?.growthRate ?? defaultGrowth;

    // Discount rate (WACC): Ghana GHS yields require sovereign spread (18-22%), US equities (8.5-10%)
    const defaultDiscount = isGse ? 19.5 : 9.2;
    const discountRate = assumptions?.discountRate ?? defaultDiscount;

    // Terminal growth: nominal GDP growth (GHS nominal ~5%, US nominal ~2.5%)
    const defaultTerminal = isGse ? 5.0 : 2.5;
    const terminalGrowth = assumptions?.terminalRate ?? defaultTerminal;

    // Estimated base annual Free Cash Flow per share
    // Approximate FCF per share ~ 85% of EPS or price/P_FCF
    const baseEPS = asset.eps && asset.eps > 0 ? asset.eps : asset.price / (asset.peRatio || 15);
    const baseFCFPerShare = Math.max(0.05, baseEPS * 0.88);

    const g = growthRate / 100;
    const r = discountRate / 100;
    const gTerm = terminalGrowth / 100;

    let tenYearPV = 0;
    let currentFCF = baseFCFPerShare;
    const projectedCashFlows: { year: number; cashFlow: number; presentValue: number }[] = [];

    // 5-year explicit projection
    for (let year = 1; year <= 5; year++) {
      currentFCF *= 1 + g;
      const discountFactor = Math.pow(1 + r, year);
      const pv = currentFCF / discountFactor;
      tenYearPV += pv;
      projectedCashFlows.push({
        year,
        cashFlow: Number(currentFCF.toFixed(2)),
        presentValue: Number(pv.toFixed(2)),
      });
    }

    // Terminal Value using Gordon Growth
    const terminalCashFlow = currentFCF * (1 + gTerm);
    const terminalValue = terminalCashFlow / Math.max(0.015, r - gTerm);
    const terminalPV = terminalValue / Math.pow(1 + r, 5);

    const rawIntrinsicValue = tenYearPV + terminalPV;
    const intrinsicValue = Number(Math.max(0.1, rawIntrinsicValue).toFixed(2));

    const marginOfSafetyPercent = Number(
      (((intrinsicValue - asset.price) / asset.price) * 100).toFixed(1)
    );

    let verdict: DCFValuation['verdict'] = 'fair_value';
    if (marginOfSafetyPercent >= 25) verdict = 'significantly_undervalued';
    else if (marginOfSafetyPercent >= 10) verdict = 'undervalued';
    else if (marginOfSafetyPercent <= -25) verdict = 'significantly_overvalued';
    else if (marginOfSafetyPercent <= -10) verdict = 'overvalued';

    return {
      intrinsicValue,
      marginOfSafetyPercent,
      projectedFCFGrowthRate: growthRate,
      discountRateWACC: discountRate,
      terminalGrowthRate: terminalGrowth,
      tenYearPV: Number(tenYearPV.toFixed(2)),
      terminalPV: Number(terminalPV.toFixed(2)),
      terminalValue: Number(terminalValue.toFixed(2)),
      projectedCashFlows,
      enterpriseValue: Number((intrinsicValue * (asset.volume * 500)).toFixed(0)),
      sharesOutstanding: Math.round(asset.marketCap / Math.max(0.01, asset.price)),
      verdict,
    };
  }

  /**
   * Multiples & Heuristic Valuation
   * Benjamin Graham Number: sqrt(22.5 * EPS * BVPS)
   * Peter Lynch Fair Value: PEG = 1.0 (Price = Growth * EPS)
   */
  public calculateMultiples(asset: FinancialAssetQuote): MultiplesValuation {
    const eps = asset.eps && asset.eps > 0 ? asset.eps : asset.price / (asset.peRatio || 15);
    const bvps = asset.pbRatio && asset.pbRatio > 0 ? asset.price / asset.pbRatio : asset.price * 0.4;

    // 1. Benjamin Graham Number
    let grahamNumber: number | undefined = undefined;
    let grahamMarginPercent: number | undefined = undefined;
    if (eps > 0 && bvps > 0) {
      grahamNumber = Number(Math.sqrt(22.5 * eps * bvps).toFixed(2));
      grahamMarginPercent = Number((((grahamNumber - asset.price) / asset.price) * 100).toFixed(1));
    }

    // 2. Peter Lynch Fair Value (Growth Rate * EPS for PEG = 1.0)
    // Estimate growth rate from PE or historical baseline
    const estimatedGrowth = Math.min(45, Math.max(6, (asset.peRatio || 15) * 0.85));
    const peterLynchFairValue = Number((eps * estimatedGrowth).toFixed(2));
    const lynchMarginPercent = Number(
      (((peterLynchFairValue - asset.price) / asset.price) * 100).toFixed(1)
    );

    const industryMedianPE = asset.currency === 'GHS' ? 6.5 : (asset.sector === 'Technology' ? 28.0 : 18.0);
    const targetPE = Number(((industryMedianPE + (asset.peRatio || industryMedianPE)) / 2).toFixed(1));

    const pegRatio = asset.peRatio && estimatedGrowth > 0 ? Number((asset.peRatio / estimatedGrowth).toFixed(2)) : 1.15;

    let verdict = 'Fair Valuation based on peer metrics';
    if (grahamMarginPercent && grahamMarginPercent > 20 && lynchMarginPercent > 15) {
      verdict = 'Deep Value: Passing both Graham Safety and Lynch Growth filters';
    } else if (grahamMarginPercent && grahamMarginPercent < -25) {
      verdict = 'Multiple Expansion Premium: Priced above tangible asset safety margin';
    }

    return {
      grahamNumber,
      grahamMarginPercent: grahamMarginPercent ?? 0,
      peterLynchFairValue,
      lynchMarginPercent: lynchMarginPercent ?? 0,
      pegRatio,
      targetPE,
      industryMedianPE,
      verdict,
    };
  }

  /**
   * AI Synthesis using Gemini 3.8 Flash grounded in active RAG literature
   */
  private async synthesizeWithAI(
    asset: FinancialAssetQuote,
    dcf: DCFValuation,
    multiples: MultiplesValuation,
    activeModels: any[]
  ): Promise<DualValuationResult> {
    const apiKey = process.env.GEMINI_API_KEY;

    // Baseline algorithmic synthesis if no key
    const avgFairValue = Number(
      (
        (dcf.intrinsicValue +
          (multiples.peterLynchFairValue || dcf.intrinsicValue) +
          (multiples.grahamNumber || dcf.intrinsicValue)) /
        3
      ).toFixed(2)
    );
    const avgMargin = Number((((avgFairValue - asset.price) / asset.price) * 100).toFixed(1));

    let defaultVerdict: DualValuationResult['institutionalVerdict'] = 'FAIR_HOLD';
    if (avgMargin >= 25) defaultVerdict = 'STRONG_BUY';
    else if (avgMargin >= 10) defaultVerdict = 'ACCUMULATE';
    else if (avgMargin <= -25) defaultVerdict = 'TRIM_OVERVALUED';
    else if (asset.peRatio && asset.peRatio > 45) defaultVerdict = 'SPECULATIVE';

    const defaultScenarios: ThesisScenario[] = [
      {
        type: 'bull',
        probability: 30,
        targetPrice: Number((avgFairValue * 1.35).toFixed(2)),
        upsideDownsidePercent: Number((((avgFairValue * 1.35 - asset.price) / asset.price) * 100).toFixed(1)),
        keyDrivers: [
          `Acceleration of market share gains in ${asset.industry || 'core segment'}`,
          `Sustained return on equity (ROE) above historical median`,
          asset.currency === 'GHS' ? 'Macro-stabilization in Ghana inflation and GHS foreign exchange' : 'Multiple expansion toward top decile peers',
        ],
      },
      {
        type: 'base',
        probability: 50,
        targetPrice: avgFairValue,
        upsideDownsidePercent: avgMargin,
        keyDrivers: [
          `DCF Free Cash Flow trajectory compounding at ${dcf.projectedFCFGrowthRate}%`,
          `Disciplined capital allocation and steady dividend payouts`,
        ],
      },
      {
        type: 'bear',
        probability: 20,
        targetPrice: Number((asset.price * 0.75).toFixed(2)),
        upsideDownsidePercent: -25.0,
        keyDrivers: [
          `Margin compression from competitive entrance or tariff shifts`,
          asset.currency === 'GHS' ? 'Spike in Treasury yields increasing domestic cost of capital' : 'Broader valuation multiple compression across tech/equities',
        ],
      },
    ];

    const defaultInvalidations = [
      `Deterioration of gross margins by >200bps over consecutive quarters`,
      `Loss of competitive advantage or pricing power identified in ${activeModels[0]?.bookTitle || 'strategic analysis'}`,
      `Debt service coverage ratio declining below 3.0x during a downturn`,
    ];

    const defaultAppliedModels = activeModels.slice(0, 3).map((m, idx) => ({
      id: m.id || `applied_${idx}`,
      bookTitle: m.bookTitle,
      author: m.author,
      modelName: m.frameworkName,
      category: m.category || 'Fundamental Valuation',
      corePrinciple: m.coreRule || m.summary,
      valuationApplication: `Applied to evaluate margin of safety, moat durability, and forecasting risk for ${asset.name}.`,
      rationale: `Applied to test durability of ${asset.name}'s cash generation and ensure price paid contains a genuine margin of safety against forecasting errors.`,
    }));

    if (!apiKey) {
      return {
        asset,
        dcf,
        multiples,
        synthesizedFairValue: avgFairValue,
        synthesizedMarginOfSafety: avgMargin,
        institutionalVerdict: defaultVerdict,
        confidenceScore: 82,
        scenarios: defaultScenarios,
        invalidationTriggers: defaultInvalidations,
        appliedMentalModels: defaultAppliedModels,
        aiExecutiveSummary: `${asset.name} (${asset.symbol}) presents a dual valuation assessment with an intrinsic DCF of ${asset.currency} ${dcf.intrinsicValue} vs current market price of ${asset.currency} ${asset.price}. Integrating Graham Number (${multiples.grahamNumber ? asset.currency + ' ' + multiples.grahamNumber : 'N/A'}) and Lynch Fair Value (${multiples.peterLynchFairValue ? asset.currency + ' ' + multiples.peterLynchFairValue : 'N/A'}), the asset reflects a ${avgMargin >= 0 ? '+' : ''}${avgMargin}% margin of safety.`,
      };
    }

    try {
      const ai = new GoogleGenAI({ apiKey });

      const modelsContext = activeModels
        .map(
          (m, idx) =>
            `${idx + 1}. Book: "${m.bookTitle}" by ${m.author}\n   Model: ${m.frameworkName}\n   Core Rule: ${m.coreRule}\n   Red Flags: ${m.redFlags.join(', ')}`
        )
        .join('\n\n');

      const prompt = `You are the Lead Portfolio Manager & Senior Valuations Specialist at BusiMind Institutional Intelligence.
Perform a rigorous, grounded dual-valuation synthesis for:

ASSET DETAILS:
- Symbol: ${asset.symbol} (${asset.name})
- Exchange/Region: ${asset.exchange} (${asset.region === 'ghana_gse' ? 'Ghana Stock Exchange / Frontier Africa' : 'Global / US Markets'})
- Current Price: ${asset.currency} ${asset.price}
- Market Cap: ${asset.currency} ${asset.marketCap.toLocaleString()}
- P/E Ratio: ${asset.peRatio || 'N/A'}, P/B Ratio: ${asset.pbRatio || 'N/A'}, EPS: ${asset.eps || 'N/A'}, Div Yield: ${asset.dividendYield || 'N/A'}%

VALUATION ENGINE CALCULATIONS:
- Discounted Cash Flow (DCF): Intrinsic Value = ${asset.currency} ${dcf.intrinsicValue} (Margin of Safety: ${dcf.marginOfSafetyPercent}%)
  Assumptions: FCF Growth = ${dcf.projectedFCFGrowthRate}%, Discount Rate WACC = ${dcf.discountRateWACC}%, Terminal Growth = ${dcf.terminalGrowthRate}%
- Benjamin Graham Number: ${multiples.grahamNumber ? asset.currency + ' ' + multiples.grahamNumber : 'N/A'} (Margin: ${multiples.grahamMarginPercent}%)
- Peter Lynch Fair Value (PEG=1.0): ${multiples.peterLynchFairValue ? asset.currency + ' ' + multiples.peterLynchFairValue : 'N/A'} (Margin: ${multiples.lynchMarginPercent}%)
- Industry Target P/E: ${multiples.targetPE}x vs Peer Median ${multiples.industryMedianPE}x

ACTIVE RAG INVESTMENT KNOWLEDGE BASE (Mental Models to apply):
${modelsContext}

Analyze whether the DCF and the Multiples models corroborate or conflict, and why.
For Ghana Stock Exchange assets, factor in local macro realities (Ghana 91-day T-Bill rate dynamics, currency effects, dividend dependability).
For Global assets, factor in durability of moats and competitive sustainability.

Return a STRICT JSON object matching this schema:
{
  "synthesizedFairValue": number,
  "synthesizedMarginOfSafety": number,
  "institutionalVerdict": "STRONG_BUY" | "ACCUMULATE" | "FAIR_HOLD" | "TRIM_OVERVALUED" | "SPECULATIVE",
  "confidenceScore": number (0-100),
  "aiExecutiveSummary": "3-4 concise, institutional-grade sentences summarizing the verdict, why DCF and Multiples align/diverge, and the final risk-adjusted posture.",
  "scenarios": [
    {
      "type": "bull",
      "probability": number,
      "targetPrice": number,
      "upsideDownsidePercent": number,
      "keyDrivers": ["driver 1", "driver 2", "driver 3"]
    },
    {
      "type": "base",
      "probability": number,
      "targetPrice": number,
      "upsideDownsidePercent": number,
      "keyDrivers": ["driver 1", "driver 2"]
    },
    {
      "type": "bear",
      "probability": number,
      "targetPrice": number,
      "upsideDownsidePercent": number,
      "keyDrivers": ["driver 1", "driver 2"]
    }
  ],
  "invalidationTriggers": [
    "Specific trigger 1 that would invalidate this investment thesis",
    "Specific trigger 2",
    "Specific trigger 3"
  ],
  "appliedMentalModels": [
    {
      "bookTitle": "Exact book title from the RAG context",
      "author": "Author",
      "modelName": "Mental model name",
      "rationale": "Directly explains how this book's principle applies to this specific company."
    }
  ]
}
`;

      const response = await safeGenerateContent(ai, {
        model: 'gemini-3.8-flash',
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          temperature: 0.2,
        },
      });

      const text = response.text || '{}';
      const parsed = JSON.parse(text);

      const appliedModels = Array.isArray(parsed.appliedMentalModels)
        ? parsed.appliedMentalModels.map((m: any, idx: number) => ({
            id: m.id || `applied_${idx}`,
            bookTitle: m.bookTitle || activeModels[idx % activeModels.length]?.bookTitle || 'Investment Principle',
            author: m.author || activeModels[idx % activeModels.length]?.author || 'Institutional Author',
            modelName: m.modelName || activeModels[idx % activeModels.length]?.frameworkName || 'Fundamental Model',
            category: m.category || 'Strategic Valuation',
            corePrinciple: m.corePrinciple || m.rationale || 'Margin of Safety & Intrinsic Value',
            valuationApplication: m.valuationApplication || m.rationale || 'Applied to test forecasting durability against uncertainty.',
            rationale: m.rationale || 'Applied to stress test cash flows and moat defensibility.',
          }))
        : defaultAppliedModels;

      return {
        asset,
        dcf,
        multiples,
        synthesizedFairValue: Number(parsed.synthesizedFairValue) || avgFairValue,
        synthesizedMarginOfSafety: Number(parsed.synthesizedMarginOfSafety) || avgMargin,
        institutionalVerdict: parsed.institutionalVerdict || defaultVerdict,
        confidenceScore: Number(parsed.confidenceScore) || 85,
        aiExecutiveSummary: parsed.aiExecutiveSummary || `${asset.name} (${asset.symbol}) has been evaluated across DCF and Multiples with a ${avgMargin >= 0 ? '+' : ''}${avgMargin}% margin of safety.`,
        scenarios: Array.isArray(parsed.scenarios) ? parsed.scenarios : defaultScenarios,
        invalidationTriggers: Array.isArray(parsed.invalidationTriggers) ? parsed.invalidationTriggers : defaultInvalidations,
        appliedMentalModels: appliedModels,
      };
    } catch (err) {
      console.warn('[ValuationEngine synthesizeWithAI fallback triggered]:', (err as any)?.message || err);
      return {
        asset,
        dcf,
        multiples,
        synthesizedFairValue: avgFairValue,
        synthesizedMarginOfSafety: avgMargin,
        institutionalVerdict: defaultVerdict,
        confidenceScore: 80,
        scenarios: defaultScenarios,
        invalidationTriggers: defaultInvalidations,
        appliedMentalModels: defaultAppliedModels,
        aiExecutiveSummary: `${asset.name} (${asset.symbol}) has been analyzed across DCF (${asset.currency} ${dcf.intrinsicValue}) and Multiples (${asset.currency} ${multiples.peterLynchFairValue || 'N/A'}). Overall posture remains ${defaultVerdict} with a ${avgMargin >= 0 ? '+' : ''}${avgMargin}% margin of safety.`,
      };
    }
  }
}

export const valuationEngine = new ValuationEngine();
