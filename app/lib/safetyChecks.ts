// Pre-trade safety checks built entirely from data DeFiGuard already
// has on hand: the Jupiter quote, the Solana fee estimates, and the
// rule-based risk score.
//
// This is NOT an on-chain transaction simulation. DeFiGuard never
// builds, signs, or sends a transaction, so nothing here can
// guarantee the swap will actually succeed on-chain -- these are
// sanity checks on the data we already fetched.

import type { RiskResult } from "@/app/lib/risk";

export type CheckStatus = "pass" | "warning" | "unavailable";

export type SafetyCheck = {
  label: string;
  status: CheckStatus;
  detail: string;
};

export type OverallStatus =
  | "READY FOR REVIEW"
  | "REVIEW CAUTION ADVISED"
  | "INCOMPLETE DATA";

export type SafetyChecksResult = {
  checks: SafetyCheck[];
  overallStatus: OverallStatus;
};

export type SafetyChecksInput = {
  outputAmount: number;
  route: string;
  priceImpactPct: number | null | undefined;
  networkFeeSol: number | null | undefined;
  priorityFeeSol: number | null | undefined;
  risk: RiskResult | null;
};

// Price impact above this magnitude is flagged as a warning. Matches
// the "large move" threshold risk.ts already uses, so the two stay
// consistent with each other.
const HIGH_PRICE_IMPACT_PCT = 3;

export function calculatePreTradeChecks({
  outputAmount,
  route,
  priceImpactPct,
  networkFeeSol,
  priorityFeeSol,
  risk,
}: SafetyChecksInput): SafetyChecksResult {
  const checks: SafetyCheck[] = [];

  // 1. Valid swap quote -- Jupiter returned a usable expected output.
  if (Number.isFinite(outputAmount) && outputAmount > 0) {
    checks.push({
      label: "Valid swap quote",
      status: "pass",
      detail: `Jupiter returned a positive expected output (${outputAmount}).`,
    });
  } else {
    checks.push({
      label: "Valid swap quote",
      status: "unavailable",
      detail: "No positive expected output was returned by Jupiter.",
    });
  }

  // 2. Valid route -- Jupiter found at least one route for this pair.
  if (route && route !== "Unknown") {
    checks.push({
      label: "Valid route",
      status: "pass",
      detail: `Route found: ${route}.`,
    });
  } else {
    checks.push({
      label: "Valid route",
      status: "unavailable",
      detail: "Jupiter did not return a named route for this swap.",
    });
  }

  // 3. Price impact -- present, and flagged if it's large.
  if (typeof priceImpactPct === "number" && Number.isFinite(priceImpactPct)) {
    const absImpact = Math.abs(priceImpactPct);
    if (absImpact > HIGH_PRICE_IMPACT_PCT) {
      checks.push({
        label: "Price impact",
        status: "warning",
        detail: `Price impact is ${absImpact.toFixed(2)}%, above the ${HIGH_PRICE_IMPACT_PCT}% caution threshold.`,
      });
    } else {
      checks.push({
        label: "Price impact",
        status: "pass",
        detail: `Price impact is ${absImpact.toFixed(2)}%, within normal range.`,
      });
    }
  } else {
    checks.push({
      label: "Price impact",
      status: "unavailable",
      detail: "No price impact data was returned by Jupiter.",
    });
  }

  // 4a. Network fee data -- did the estimate come through at all?
  if (typeof networkFeeSol === "number" && Number.isFinite(networkFeeSol)) {
    checks.push({
      label: "Network fee data",
      status: "pass",
      detail: `Estimated network fee is ${networkFeeSol.toFixed(6)} SOL.`,
    });
  } else {
    checks.push({
      label: "Network fee data",
      status: "unavailable",
      detail: "Network fee estimate could not be retrieved.",
    });
  }

  // 4b. Priority fee data -- separate check, since the RPC call for
  // this can fail independently of the network fee estimate.
  if (typeof priorityFeeSol === "number" && Number.isFinite(priorityFeeSol)) {
    checks.push({
      label: "Priority fee data",
      status: "pass",
      detail: `Estimated priority fee is ${priorityFeeSol.toFixed(6)} SOL.`,
    });
  } else {
    checks.push({
      label: "Priority fee data",
      status: "unavailable",
      detail: "Priority fee estimate could not be retrieved from Solana RPC.",
    });
  }

  // 5. Risk score -- did scoring run, and what did it find?
  if (risk) {
    checks.push({
      label: "Risk score",
      status: risk.level === "Low" ? "pass" : "warning",
      detail: `Risk score is ${risk.score}/100 (${risk.level}).`,
    });
  } else {
    checks.push({
      label: "Risk score",
      status: "unavailable",
      detail: "Risk score could not be calculated.",
    });
  }

  return { checks, overallStatus: deriveOverallStatus(checks) };
}

// Any single "unavailable" check means we're missing data needed to
// form a full picture, so it takes priority over a mere "warning".
function deriveOverallStatus(checks: SafetyCheck[]): OverallStatus {
  if (checks.some((check) => check.status === "unavailable")) {
    return "INCOMPLETE DATA";
  }
  if (checks.some((check) => check.status === "warning")) {
    return "REVIEW CAUTION ADVISED";
  }
  return "READY FOR REVIEW";
}
