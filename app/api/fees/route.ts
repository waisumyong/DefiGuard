import { NextResponse } from "next/server";
import {
  ESTIMATED_COMPUTE_UNITS,
  ESTIMATED_SIGNATURE_COUNT,
  LAMPORTS_PER_SIGNATURE,
  LAMPORTS_PER_SOL,
  getRecentPrioritizationFees,
  median,
} from "@/app/lib/solana";

// Estimates the network fee and priority fee for a Solana swap.
//
// Neither value is exact: DeFiGuard never builds or signs the final
// swap transaction (no wallet is connected), so the real signature
// count and compute units used are unknown until that happens. Both
// are estimates, and the priority fee is derived from live Solana RPC
// data rather than a fixed number.
export async function GET() {
  // Network fee: Solana charges a fixed 5000 lamports per signature.
  // We assume one signature, typical for a swap signed only by the
  // user's own wallet.
  const networkFeeLamports = LAMPORTS_PER_SIGNATURE * ESTIMATED_SIGNATURE_COUNT;

  // Priority fee: ask the Solana RPC what recent transactions actually
  // paid, then convert that rate into a lamport amount using an
  // assumed compute unit budget (see app/lib/solana.ts for why).
  let priorityFeeMicroLamportsPerCu: number | null = null;
  let priorityFeeLamports: number | null = null;

  try {
    const samples = await getRecentPrioritizationFees();
    const nonZeroFees = samples
      .map((sample) => sample.prioritizationFee)
      .filter((fee) => fee > 0);

    priorityFeeMicroLamportsPerCu = median(nonZeroFees);
    priorityFeeLamports = Math.ceil(
      (priorityFeeMicroLamportsPerCu * ESTIMATED_COMPUTE_UNITS) / 1_000_000
    );
  } catch {
    // Leave both fields as `null` -- the RPC endpoint was unreachable
    // or returned an error. The UI shows this as "unavailable" rather
    // than a misleading 0.
  }

  return NextResponse.json({
    networkFeeLamports,
    networkFeeSol: networkFeeLamports / LAMPORTS_PER_SOL,
    priorityFeeLamports,
    priorityFeeSol:
      priorityFeeLamports === null
        ? null
        : priorityFeeLamports / LAMPORTS_PER_SOL,
    priorityFeeMicroLamportsPerCu,
  });
}
