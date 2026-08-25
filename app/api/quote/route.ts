import { NextResponse } from "next/server";
import { SUPPORTED_TOKENS, type TokenSymbol } from "@/app/lib/tokens";

// Jupiter's Swap V2 "order" endpoint (the old /swap/v1/quote endpoint
// is deprecated). Omitting the `taker` param returns a quote only —
// no transaction is built, since DeFiGuard doesn't connect a wallet.
// The API key is only ever used here, on the server — it never
// reaches the browser.
const JUPITER_ORDER_URL = "https://api.jup.ag/swap/v2/order";

function isSupportedToken(value: unknown): value is TokenSymbol {
  return typeof value === "string" && value in SUPPORTED_TOKENS;
}

export async function POST(request: Request) {
  const apiKey = process.env.JUPITER_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "Server is missing JUPITER_API_KEY. See .env.example." },
      { status: 500 }
    );
  }

  const body = await request.json().catch(() => null);
  const { inputToken, outputToken, amount } = body ?? {};

  if (!isSupportedToken(inputToken) || !isSupportedToken(outputToken)) {
    return NextResponse.json(
      { error: "Only SOL and USDC are supported for this MVP." },
      { status: 400 }
    );
  }

  const amountNumber = Number(amount);
  if (!Number.isFinite(amountNumber) || amountNumber <= 0) {
    return NextResponse.json(
      { error: "Amount must be a number greater than 0." },
      { status: 400 }
    );
  }

  if (inputToken === outputToken) {
    return NextResponse.json(
      { error: "Input and output token must be different." },
      { status: 400 }
    );
  }

  const input = SUPPORTED_TOKENS[inputToken];
  const output = SUPPORTED_TOKENS[outputToken];
  const amountInBaseUnits = Math.round(amountNumber * 10 ** input.decimals);

  const orderUrl = new URL(JUPITER_ORDER_URL);
  orderUrl.searchParams.set("inputMint", input.mint);
  orderUrl.searchParams.set("outputMint", output.mint);
  orderUrl.searchParams.set("amount", String(amountInBaseUnits));
  orderUrl.searchParams.set("slippageBps", "50"); // 0.5% default slippage
  // No `taker` param on purpose — this app never builds or signs a
  // transaction, so we only want the quote portion of the response.

  let jupiterResponse: Response;
  try {
    jupiterResponse = await fetch(orderUrl, {
      headers: {
        Accept: "application/json",
        "x-api-key": apiKey,
      },
    });
  } catch {
    return NextResponse.json(
      { error: "Could not reach the Jupiter order API." },
      { status: 502 }
    );
  }

  if (!jupiterResponse.ok) {
    return NextResponse.json(
      { error: "Jupiter could not produce a quote for this swap." },
      { status: 502 }
    );
  }

  const quote = await jupiterResponse.json();

  // Jupiter can return HTTP 200 with an error payload (e.g. no route
  // found for this pair/amount) instead of a non-2xx status.
  if (quote.errorMessage) {
    return NextResponse.json({ error: quote.errorMessage }, { status: 502 });
  }

  const outputAmount = Number(quote.outAmount) / 10 ** output.decimals;

  const routeLabels = Array.isArray(quote.routePlan)
    ? quote.routePlan
        .map((leg: { swapInfo?: { label?: string } }) => leg.swapInfo?.label)
        .filter(Boolean)
        .join(" -> ")
    : "";
  // Fall back to the router name (e.g. "metis") if no per-hop route
  // labels were returned.
  const route = routeLabels || quote.router || "Unknown";

  return NextResponse.json({
    inputAmount: amountNumber,
    outputAmount,
    route,
    // `priceImpact` is Jupiter's current field, already expressed in
    // percentage points (e.g. -0.1 means -0.1%). The old `priceImpactPct`
    // fraction field is deprecated, so we no longer multiply by 100.
    priceImpactPct: Number(quote.priceImpact),
    slippageBps: Number(quote.slippageBps),
  });
}
