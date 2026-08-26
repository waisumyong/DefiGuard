"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import { SUPPORTED_TOKENS, type TokenSymbol } from "@/app/lib/tokens";
import { calculateRiskScore, type RiskResult } from "@/app/lib/risk";
import {
  calculatePreTradeChecks,
  type CheckStatus,
  type OverallStatus,
  type SafetyChecksResult,
} from "@/app/lib/safetyChecks";

const TOKEN_OPTIONS = Object.keys(SUPPORTED_TOKENS) as TokenSymbol[];

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
  const [risk, setRisk] = useState<RiskResult | null>(null);
  const [safety, setSafety] = useState<SafetyChecksResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [feesNotice, setFeesNotice] = useState<string | null>(null);

  async function handleAnalyze(event: FormEvent) {
    event.preventDefault();

    // Belt-and-suspenders alongside the disabled button: a keyboard
    // Enter-to-submit can still fire while a request is in flight.
    if (isLoading) return;

    const amountNumber = Number(amount);
    if (!Number.isFinite(amountNumber) || amountNumber <= 0) {
      setError("Amount must be greater than 0.");
      setQuote(null);
      setFees(null);
      setRisk(null);
      setSafety(null);
      return;
    }

    setIsLoading(true);
    setError(null);
    setFeesNotice(null);
    setQuote(null);
    setFees(null);
    setRisk(null);
    setSafety(null);

    // Kick off both requests immediately so they still run in
    // parallel, but catch each independently -- otherwise a network
    // failure on the fee request (not just a non-2xx response) would
    // reject the whole Promise.all and wipe out a successful quote.
    const quotePromise = fetch("/api/quote", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ inputToken, outputToken, amount: amountNumber }),
    }).catch(() => null);
    const feesPromise = fetch("/api/fees").catch(() => null);

    try {
      const quoteResponse = await quotePromise;
      if (!quoteResponse) {
        setError(
          "Could not reach the server for the swap quote. Please try again."
        );
        return;
      }

      const quoteData = await quoteResponse.json().catch(() => null);

      if (!quoteResponse.ok || !quoteData) {
        setError(quoteData?.error ?? "Something went wrong fetching the quote.");
        return;
      }

      setQuote(quoteData);

      // Fee data is a nice-to-have alongside the quote -- if it fails,
      // we still show the quote results, with a notice instead of
      // silently leaving the fee tiles blank.
      const feesResponse = await feesPromise;
      const feesData: Fees | null =
        feesResponse && feesResponse.ok
          ? await feesResponse.json().catch(() => null)
          : null;

      if (feesData) {
        setFees(feesData);
      } else {
        setFeesNotice(
          "Fee data is temporarily unavailable. Quote and risk score are still shown below."
        );
      }

      // Risk scoring only runs once we actually have a quote. Route
      // "steps" is the number of hops in the "A -> B -> C" label the
      // /api/quote route already builds.
      const routeSteps = quoteData.route
        .split("->")
        .map((step: string) => step.trim())
        .filter(Boolean).length;

      const riskResult = calculateRiskScore({
        priceImpactPct: quoteData.priceImpactPct,
        slippageBps: quoteData.slippageBps,
        routeSteps: Math.max(routeSteps, 1),
        priorityFeeMicroLamports: feesData?.priorityFeeMicroLamportsPerCu ?? null,
      });
      setRisk(riskResult);

      // Pre-trade safety checks reuse the same quote/fee/risk data --
      // no new API calls, and no transaction is built or simulated.
      setSafety(
        calculatePreTradeChecks({
          outputAmount: quoteData.outputAmount,
          route: quoteData.route,
          priceImpactPct: quoteData.priceImpactPct,
          networkFeeSol: feesData?.networkFeeSol ?? null,
          priorityFeeSol: feesData?.priorityFeeSol ?? null,
          risk: riskResult,
        })
      );
    } catch {
      setError("Something went wrong while analyzing this swap. Please try again.");
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

          {feesNotice && (
            <p className="mb-4 rounded-lg border border-amber-900/50 bg-amber-950/40 px-4 py-3 text-sm text-amber-300">
              {feesNotice}
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
              <ResultTile
                label="Risk Score"
                value={risk ? `${risk.score}/100 — ${risk.level}` : "Unavailable"}
                muted={!risk}
              />
            </div>
          )}

          {risk && (
            <div className="mt-4 rounded-lg border border-border bg-muted px-4 py-3">
              <p className="text-xs font-medium text-muted-foreground">
                Risk Factors
              </p>
              <ul className="mt-2 space-y-1 text-sm text-foreground">
                {risk.reasons.map((reason) => (
                  <li key={reason}>• {reason}</li>
                ))}
              </ul>
            </div>
          )}

          {safety && (
            <div className="mt-4 rounded-lg border border-border bg-muted px-4 py-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs font-medium text-muted-foreground">
                  Pre-Trade Safety Checks
                </p>
                <span
                  className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${overallStatusClasses(
                    safety.overallStatus
                  )}`}
                >
                  {safety.overallStatus}
                </span>
              </div>

              <ul className="mt-3 space-y-2">
                {safety.checks.map((check) => (
                  <li key={check.label} className="flex items-start gap-2 text-sm">
                    <span
                      className={`mt-0.5 shrink-0 rounded-full border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${checkStatusClasses(
                        check.status
                      )}`}
                    >
                      {check.status}
                    </span>
                    <span>
                      <span className="font-medium text-foreground">
                        {check.label}:
                      </span>{" "}
                      <span className="text-muted-foreground">{check.detail}</span>
                    </span>
                  </li>
                ))}
              </ul>

              <p className="mt-3 text-xs text-muted-foreground">
                These checks analyze available quote, fee, and risk data. They
                do not simulate or execute an on-chain transaction.
              </p>
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

function checkStatusClasses(status: CheckStatus): string {
  switch (status) {
    case "pass":
      return "border-emerald-900/50 bg-emerald-950/40 text-emerald-300";
    case "warning":
      return "border-amber-900/50 bg-amber-950/40 text-amber-300";
    case "unavailable":
      return "border-border bg-muted text-muted-foreground";
  }
}

function overallStatusClasses(status: OverallStatus): string {
  switch (status) {
    case "READY FOR REVIEW":
      return "border-emerald-900/50 bg-emerald-950/40 text-emerald-300";
    case "REVIEW CAUTION ADVISED":
      return "border-amber-900/50 bg-amber-950/40 text-amber-300";
    case "INCOMPLETE DATA":
      return "border-border bg-muted text-muted-foreground";
  }
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
