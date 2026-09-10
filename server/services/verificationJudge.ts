export interface VerificationReport {
  passed: boolean;
  currencyConsistency: boolean;
  mathematicalSanity: boolean;
  claimFactualGrounded: boolean;
  confidenceScore: number; // 0 - 100
  uncertaintyFlags: string[];
  auditedResponse: string;
}

export class VerificationJudge {
  /**
   * Reviews an AI analysis draft, verifies facts and math, and finalizes with confidence metadata
   */
  public verifyDraft(
    draftText: string,
    context: {
      symbol: string;
      expectedCurrency: 'GHS' | 'USD';
      currentPrice: number;
      intrinsicValue?: number;
      marginOfSafetyPercent?: number;
      groundedSources?: string[];
    }
  ): VerificationReport {
    const uncertaintyFlags: string[] = [];
    let passed = true;
    let confidenceScore = 90;

    // 1. Currency Consistency Check
    let currencyConsistency = true;
    if (context.expectedCurrency === 'GHS') {
      if (draftText.includes('$') && !draftText.includes('USD') && !draftText.includes('export')) {
        // Flag inadvertent dollar symbol usage for Ghanaian cedi stock
        currencyConsistency = false;
        confidenceScore -= 15;
        uncertaintyFlags.push('Detected Dollar sign ($) referenced in Ghana Cedi (GHS) denominated asset.');
      }
    }

    // 2. Mathematical Sanity Check
    let mathematicalSanity = true;
    if (context.intrinsicValue !== undefined && context.currentPrice > 0 && context.marginOfSafetyPercent !== undefined) {
      const computedMargin = Number((((context.intrinsicValue - context.currentPrice) / context.currentPrice) * 100).toFixed(1));
      const diff = Math.abs(computedMargin - context.marginOfSafetyPercent);
      if (diff > 5.0) {
        mathematicalSanity = false;
        confidenceScore -= 20;
        uncertaintyFlags.push(`Margin of safety discrepancy: calculated ${computedMargin}% vs stated ${context.marginOfSafetyPercent}%.`);
      }
    }

    // 3. Hallucination & Fact Check (Extreme language detector)
    let claimFactualGrounded = true;
    const extremeClaims = [
      'guaranteed return',
      'risk-free 100%',
      'cannot lose money',
      'will definitely 10x',
      'certainly double',
    ];
    for (const ec of extremeClaims) {
      if (draftText.toLowerCase().includes(ec)) {
        claimFactualGrounded = false;
        passed = false;
        confidenceScore -= 30;
        uncertaintyFlags.push(`Forbidden absolute certainty phrase detected: "${ec}".`);
      }
    }

    // 4. Preserve Real Uncertainty
    if (draftText.toLowerCase().includes('assumption') || draftText.toLowerCase().includes('sensitivity') || draftText.toLowerCase().includes('risk')) {
      confidenceScore = Math.min(95, confidenceScore + 5);
    } else {
      uncertaintyFlags.push('Analysis lacked explicit sensitivity and downside scenario acknowledgment.');
      confidenceScore -= 10;
    }

    confidenceScore = Math.max(40, Math.min(98, confidenceScore));

    // 5. Finalize response with audit stamp
    let auditedResponse = draftText;
    if (!currencyConsistency) {
      // Auto-correct inadvertent dollar signs to GHS for Ghana assets
      auditedResponse = auditedResponse.replace(/\$(\d+(\.\d+)?)/g, 'GH₵$1');
    }

    return {
      passed,
      currencyConsistency,
      mathematicalSanity,
      claimFactualGrounded,
      confidenceScore,
      uncertaintyFlags,
      auditedResponse,
    };
  }
}

export const verificationJudge = new VerificationJudge();
