// Server-side helpers for estimating Solana transaction fees.
//
// These are ESTIMATES only. DeFiGuard never builds or signs the final
// swap transaction (no wallet is connected), so the real signature
// count and compute units used by an actual swap are unknown until
// that transaction is built. We approximate both using documented
// Solana defaults, and pair that with live network data where we can.

export const LAMPORTS_PER_SOL = 1_000_000_000;

// Solana's base fee is a fixed protocol constant: 5000 lamports per
// signature. See https://solana.com/docs/core/fees#transaction-fees
export const LAMPORTS_PER_SIGNATURE = 5000;

// A simple swap is typically signed once, by the user's own wallet.
// We don't connect a wallet here, so this is an assumption, not a
// measured value -- a swap that also needs to create a token account
// etc. could still end up needing more signatures.
export const ESTIMATED_SIGNATURE_COUNT = 1;

// Solana's default compute unit limit for a transaction that doesn't
// request a custom compute budget. Real swap routes may use more or
// less than this, so it's only used as an estimate baseline for
// turning a priority fee rate (micro-lamports per CU) into a lamport
// amount. See https://solana.com/docs/core/fees#compute-unit-limit
export const ESTIMATED_COMPUTE_UNITS = 200_000;

const DEFAULT_RPC_URL = "https://api.mainnet-beta.solana.com";

// SOLANA_RPC_URL is optional -- if unset we fall back to Solana's
// public RPC endpoint. It's read only on the server and never sent
// to the browser.
export function getSolanaRpcUrl(): string {
  return process.env.SOLANA_RPC_URL || DEFAULT_RPC_URL;
}

export type PrioritizationFeeSample = {
  slot: number;
  prioritizationFee: number;
};

// Calls Solana's `getRecentPrioritizationFees` RPC method. It returns
// the priority fee (in micro-lamports per compute unit) paid by
// recent transactions over the last ~150 slots -- real, live network
// data, not a hardcoded value.
// https://solana.com/docs/rpc/http/getrecentprioritizationfees
export async function getRecentPrioritizationFees(): Promise<
  PrioritizationFeeSample[]
> {
  const response = await fetch(getSolanaRpcUrl(), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: "defiguard-fees",
      method: "getRecentPrioritizationFees",
      params: [],
    }),
  });

  if (!response.ok) {
    throw new Error("Solana RPC request failed.");
  }

  const body = await response.json();

  if (body.error) {
    throw new Error(body.error.message ?? "Solana RPC returned an error.");
  }

  return Array.isArray(body.result) ? body.result : [];
}

// The median is more resistant to outlier spikes than a plain average,
// which matters here since a handful of congested slots can otherwise
// skew the estimate upward.
export function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}
