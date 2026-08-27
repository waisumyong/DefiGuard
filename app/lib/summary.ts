// Overall Analysis Summary: a single, transparent recap built entirely
// from data DeFiGuard already computed for this swap -- the Jupiter
// quote, the fee estimates, the rule-based risk score, and the
// pre-trade safety checks. This module fetches nothing new, calls no
// external or AI service, and does not build/sign/send/simulate a
// transaction. It only reads the same numbers already shown elsewhere
// on the page and turns them into one short, readable verdict.

import type { RiskLevel, RiskResult } from "@/app/lib/risk";
import type { SafetyChecksResult } from "@/app/lib/safetyChecks";

export type AnalysisSummaryInput = {
  quote: {
    route: string;
    priceImpactPct: number;
    slippageBps: number;
  };
  fees: {
    networkFeeSol: number | null;
    priorityFeeSol: number | null;
  } | null;
  risk: RiskResult;
  safety: SafetyChecksResult;
};

export type AnalysisSummary = {
  level: RiskLevel;
  headline: string;
  recommendation: string;
  disclaimer: string;
};

const DISCLAIMER =
  "This is a pre-trade analysis based on the quote, fee, and rule-based risk data above. It is not a transaction simulation and does not guarantee the swap will succeed on-chain.";

export function buildAnalysisSummary({
  quote,
  fees,
  risk,
  safety,
}: AnalysisSummaryInput): AnalysisSummary {
  // The overall level IS the risk level already computed in risk.ts
  // (price impact, slippage, route hops, network congestion) -- this
  // summary doesn't recompute or override it, only explains what it
  // means for this swap and folds in the safety-check status.
  const level = risk.level;

  const headline =
    level === "Low" ? "Low Risk" : level === "Medium" ? "Medium Risk" : "High Risk";

  const recommendation = buildRecommendation({ quote, fees, risk, safety });

  return { level, headline, recommendation, disclaimer: DISCLAIMER };
}

function buildRecommendation({
  risk,
  safety,
}: AnalysisSummaryInput): string {
  const sentences: string[] = [];

  if (safety.overallStatus === "INCOMPLETE DATA") {
    sentences.push(
      "Some fee or quote data could not be retrieved, so this analysis is incomplete -- re-run the analysis before relying on it."
    );
  }

  if (risk.level === "High") {
    sentences.push(
      `Risk score is ${risk.score}/100 (High). Review the risk factors below closely, and consider a smaller trade size, a tighter slippage setting, or a different route before proceeding.`
    );
  } else if (risk.level === "Medium") {
    sentences.push(
      `Risk score is ${risk.score}/100 (Medium). A few factors are worth a second look in the Risk Factors list below before proceeding.`
    );
  } else {
    sentences.push(
      `Risk score is ${risk.score}/100 (Low). No elevated risk signals were found in the available data.`
    );
  }

  if (safety.overallStatus === "REVIEW CAUTION ADVISED" && risk.level !== "High") {
    sentences.push(
      "At least one pre-trade check is flagged for caution -- see Pre-Trade Safety Checks below."
    );
  }

  return sentences.join(" ");
}
