// Transparent, rule-based risk scoring for a swap quote.
//
// This is NOT AI-generated and does not call any external service --
// every rule below is a fixed, documented threshold applied to data
// DeFiGuard already fetched from Jupiter and Solana's RPC. The intent
// is a score a user can read line by line, not a black box.

export type RiskLevel = "Low" | "Medium" | "High";

export type RiskInput = {
  priceImpactPct: number;
  slippageBps: number;
  routeSteps: number;
  // Median priority fee rate (micro-lamports per compute unit) from
  // Solana's getRecentPrioritizationFees. `null` when that data
  // couldn't be fetched -- see the priority fee rules below for why
  // that's treated differently from a genuine 0.
  priorityFeeMicroLamports: number | null;
};

export type RiskResult = {
  score: number;
  level: RiskLevel;
  reasons: string[];
};

export function calculateRiskScore({
  priceImpactPct,
  slippageBps,
  routeSteps,
  priorityFeeMicroLamports,
}: RiskInput): RiskResult {
  let score = 0;
  const reasons: string[] = [];

  // --- Price impact ---------------------------------------------------
  // Jupiter's priceImpact is a signed percentage, so we score on
  // magnitude regardless of direction.
  const absPriceImpact = Math.abs(priceImpactPct);
  if (absPriceImpact > 3) {
    score += 50;
    reasons.push(
      `Price impact is ${absPriceImpact.toFixed(2)}% (over 3%), a large move for this trade size.`
    );
  } else if (absPriceImpact > 1) {
    score += 30;
    reasons.push(
      `Price impact is ${absPriceImpact.toFixed(2)}% (over 1%), a noticeable move for this trade size.`
    );
  } else if (absPriceImpact > 0.1) {
    score += 15;
    reasons.push(
      `Price impact is ${absPriceImpact.toFixed(2)}% (over 0.1%), a small but non-trivial move.`
    );
  }

  // --- Slippage tolerance ----------------------------------------------
  if (slippageBps > 100) {
    score += 25;
    reasons.push(
      `Slippage tolerance is ${(slippageBps / 100).toFixed(2)}% (over 1%), leaving significant room for price movement before the swap fails.`
    );
  } else if (slippageBps > 50) {
    score += 10;
    reasons.push(
      `Slippage tolerance is ${(slippageBps / 100).toFixed(2)}% (over 0.5%), above the tightest default.`
    );
  }

  // --- Route complexity --------------------------------------------------
  if (routeSteps > 3) {
    score += 20;
    reasons.push(
      `Route has ${routeSteps} hops (more than 3), which adds more points of failure and more accumulated slippage/fees.`
    );
  } else if (routeSteps >= 2) {
    score += 10;
    reasons.push(
      `Route has ${routeSteps} hops, slightly more complex than a direct swap.`
    );
  }

  // --- Priority fee / network congestion ---------------------------------
  // priorityFeeMicroLamports is the current median priority fee rate
  // paid by recent transactions (live from Solana RPC), not a fixed
  // protocol constant. We bucket it using percentile bands commonly
  // used by Solana RPC providers (e.g. Helius/Triton priority-fee
  // APIs) to describe "low/medium/high" fee markets:
  //   - <= 1,000 micro-lamports/CU: normal network conditions
  //   - 1,000-10,000: elevated congestion
  //   - > 10,000: high congestion (quotes are more likely to go stale
  //     or need a bigger tip to land)
  // If the data is unavailable (RPC call failed) or reads exactly 0,
  // we add no risk and invent no reason -- we simply have no signal.
  if (priorityFeeMicroLamports !== null && priorityFeeMicroLamports > 0) {
    if (priorityFeeMicroLamports > 10_000) {
      score += 15;
      reasons.push(
        `Network priority fees are elevated (${Math.round(priorityFeeMicroLamports)} µ-lamports/CU, over 10,000), suggesting high network congestion.`
      );
    } else if (priorityFeeMicroLamports > 1_000) {
      score += 5;
      reasons.push(
        `Network priority fees are moderately elevated (${Math.round(priorityFeeMicroLamports)} µ-lamports/CU, over 1,000).`
      );
    }
  }

  score = Math.min(score, 100);

  const level: RiskLevel = score >= 60 ? "High" : score >= 30 ? "Medium" : "Low";

  if (reasons.length === 0) {
    reasons.push(
      "No elevated risk signals detected from the available quote data."
    );
  }

  return { score, level, reasons };
}
