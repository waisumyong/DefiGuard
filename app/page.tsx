"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import { SUPPORTED_TOKENS, type TokenSymbol } from "@/app/lib/tokens";

const TOKEN_OPTIONS = Object.keys(SUPPORTED_TOKENS) as TokenSymbol[];

// Fields we don't have real data for yet. They stay on the panel so the
// full shape of the analysis is visible, but clearly marked as pending.
const NOT_IMPLEMENTED_SECTIONS = ["Transaction Simulation", "Risk Score"];

type Quote = {
  inputAmount: number;
  outputAmount: number;
  route: string;
  priceImpactPct: number;
  slippageBps: number;
};

type Fees = {
  networkFeeSol: number;
  priorityFeeSol: number | null;
  priorityFeeMicroLamportsPerCu: number | null;
};

const inputClasses =
  "rounded-lg border border-border bg-muted px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground/60 focus:border-accent focus:ring-1 focus:ring-accent";

export default function Home() {
  const [inputToken, setInputToken] = useState<TokenSymbol>("SOL");
  const [outputToken, setOutputToken] = useState<TokenSymbol>("USDC");
  const [amount, setAmount] = useState("");
  const [quote, setQuote] = useState<Quote | null>(null);
  const [fees, setFees] = useState<Fees | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleAnalyze(event: FormEvent) {
    event.preventDefault();

    const amountNumber = Number(amount);
    if (!Number.isFinite(amountNumber) || amountNumber <= 0) {
      setError("Amount must be greater than 0.");
      setQuote(null);
      setFees(null);
      return;
    }

    setIsLoading(true);
    setError(null);
    setQuote(null);
    setFees(null);

    try {
      // The quote and the fee estimate are independent: fees don't
      // depend on the token pair or amount, so we fetch both at once.
      const [quoteResponse, feesResponse] = await Promise.all([
        fetch("/api/quote", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ inputToken, outputToken, amount: amountNumber }),
        }),
        fetch("/api/fees"),
      ]);

      const quoteData = await quoteResponse.json();

      if (!quoteResponse.ok) {
        setError(quoteData.error ?? "Something went wrong fetching the quote.");
        return;
      }

      setQuote(quoteData);

      // Fee data is a nice-to-have alongside the quote -- if the RPC
      // call fails, we still show the quote results.
      if (feesResponse.ok) {
        setFees(await feesResponse.json());
      }
    } catch {
      setError("Could not reach the server. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="flex min-h-full flex-col items-center px-4 py-12 sm:px-8">
      <div className="w-full max-w-2xl">
        <header className="mb-10 flex flex-col items-center gap-3 text-center">
          <div className="flex items-center gap-2">
            <ShieldLogo />
            <span className="text-2xl font-semibold tracking-tight text-foreground">
              DeFiGuard
            </span>
          </div>
          <p className="max-w-md text-sm text-muted-foreground">
            Solana DeFi Transaction Risk & Cost Simulator
          </p>
        </header>

        <form
          onSubmit={handleAnalyze}
          className="rounded-xl border border-border bg-card p-6 shadow-lg shadow-black/20"
        >
          <h2 className="mb-4 text-sm font-medium uppercase tracking-wide text-muted-foreground">
            Swap Analysis
          </h2>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Input Token">
              <select
                className={inputClasses}
                value={inputToken}
                onChange={(event) =>
                  setInputToken(event.target.value as TokenSymbol)
                }
              >
                {TOKEN_OPTIONS.map((symbol) => (
                  <option key={symbol} value={symbol}>
                    {symbol}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Output Token">
              <select
                className={inputClasses}
                value={outputToken}
                onChange={(event) =>
                  setOutputToken(event.target.value as TokenSymbol)
                }
              >
                {TOKEN_OPTIONS.map((symbol) => (
                  <option key={symbol} value={symbol}>
                    {symbol}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <div className="mt-4">
            <Field label="Amount">
              <input
                className={inputClasses}
                type="number"
                min="0"
                step="any"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                placeholder="0.00"
              />
            </Field>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="mt-6 w-full rounded-lg bg-accent py-3 text-sm font-semibold text-accent-foreground transition-colors hover:bg-accent/90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {isLoading ? "Analyzing..." : "Analyze Swap"}
          </button>
        </form>

        <section className="mt-8 rounded-xl border border-border bg-card p-6">
          <h2 className="mb-4 text-sm font-medium uppercase tracking-wide text-muted-foreground">
            Transaction Analysis
          </h2>

          {error && (
            <p className="mb-4 rounded-lg border border-red-900/50 bg-red-950/40 px-4 py-3 text-sm text-red-300">
              {error}
            </p>
          )}

          {!quote && !error && !isLoading && (
            <p className="text-sm text-muted-foreground">
              Fill in the swap details above and click &ldquo;Analyze
              Swap&rdquo; to see results here.
            </p>
          )}

          {isLoading && (
            <p className="text-sm text-muted-foreground">
              Fetching quote and network fee data...
            </p>
          )}

          {quote && (
            <div className="grid gap-3 sm:grid-cols-2">
              <ResultTile
                label="Expected Output"
                value={`${quote.outputAmount.toFixed(6)} ${outputToken}`}
              />
              <ResultTile label="Best Route" value={quote.route} />
              <ResultTile
                label="Price Impact"
                value={`${quote.priceImpactPct.toFixed(4)}%`}
              />
              <ResultTile
                label="Slippage"
                value={`${(quote.slippageBps / 100).toFixed(2)}%`}
              />
              <ResultTile
                label="Network Fee"
                value={
                  fees
                    ? `~${fees.networkFeeSol.toFixed(6)} SOL (estimate)`
                    : "Unavailable"
                }
                muted={!fees}
              />
              <ResultTile
                label="Priority Fee"
                value={
                  fees && fees.priorityFeeSol !== null
                    ? `~${fees.priorityFeeSol.toFixed(6)} SOL (estimate, ${Math.round(
                        fees.priorityFeeMicroLamportsPerCu ?? 0
                      )} µ-lamports/CU)`
                    : "Unavailable"
                }
                muted={!fees || fees.priorityFeeSol === null}
              />
              {NOT_IMPLEMENTED_SECTIONS.map((label) => (
                <ResultTile key={label} label={label} value="Not implemented yet" muted />
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function ResultTile({
  label,
  value,
  muted = false,
}: {
  label: string;
  value: string;
  muted?: boolean;
}) {
  return (
    <div className="rounded-lg border border-border bg-muted px-4 py-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p
        className={`mt-1 text-sm font-medium ${
          muted ? "text-muted-foreground" : "text-foreground"
        }`}
      >
        {value}
      </p>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

function ShieldLogo() {
  return (
    <svg
      width="28"
      height="28"
      viewBox="0 0 24 24"
      fill="none"
      className="text-accent"
      aria-hidden="true"
    >
      <path
        d="M12 2 4 5v6c0 5 3.4 8.7 8 10 4.6-1.3 8-5 8-10V5l-8-3Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
        fill="currentColor"
        fillOpacity="0.08"
      />
      <path
        d="M9 12l2 2 4-4"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
