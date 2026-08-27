# 🛡️ DeFiGuard

A pre-trade analysis tool for Solana token swaps.

DeFiGuard helps users analyze a token swap **before** trading by showing live quote data, estimated fees, price impact, transparent rule-based risk signals, pre-trade safety checks, and an overall analysis summary — without ever connecting a wallet.

## 📌 Problem

Swap UIs on Solana are optimized for speed, not scrutiny. A user pastes in an amount, sees an output number, and hits confirm. Price impact, slippage tolerance, route complexity, and fee conditions are either buried in an "advanced" panel or not surfaced at all. Bad outcomes — a swap that eats an unexpectedly large price impact, or lands during a fee spike — are usually discoverable in the data *before* the trade, but nothing puts that data in front of the user in a way they can quickly read and act on.

## 💡 Solution

DeFiGuard sits in front of the swap, not inside it. You describe the trade you're considering (token pair and amount), and it fetches a real quote from Jupiter and live Solana network fee data, then runs that data through a fixed set of transparent, documented rules to produce a risk score, a set of pre-trade safety checks, and a plain-language overall summary — all before any transaction exists. It never connects a wallet or touches signing, so there is nothing to approve and nothing at stake in using it.

## 🚀 Features

### Live Swap Analysis

- Live expected output
- Best swap route
- Price impact information
- Slippage information
- Estimated Solana network fee
- Estimated priority fee

### Transparent Risk Scoring

DeFiGuard uses transparent rule-based scoring based on:

- Price impact
- Slippage
- Route complexity
- Priority fee

### Risk Levels

| Score | Risk Level |
| --- | --- |
| 0–29 | Low |
| 30–59 | Medium |
| 60–100 | High |

### Pre-Trade Safety Checks

Checks available data including:

- Valid swap quote
- Valid route
- Price impact
- Network fee data
- Priority fee data
- Risk score

Possible results:

- READY FOR REVIEW
- REVIEW CAUTION ADVISED
- INCOMPLETE DATA

### Overall Analysis Summary

Provides a final summary including:

- Overall risk level
- Risk score
- Best route
- Price impact
- Slippage
- Network and priority fees
- Pre-trade safety status

## 🔎 How the Analysis Works

1. **Quote** — the app sends your input token, output token, and amount to Jupiter's Swap V2 order API (server-side, via `/api/quote`) and receives an expected output amount, a route, a price impact percentage, and the slippage tolerance used.
2. **Fees** — in parallel, the app asks a Solana RPC endpoint (via `/api/fees`) for recent prioritization fee data and combines it with Solana's fixed per-signature fee to produce an estimated network fee and priority fee.
3. **Risk score** — the quote and fee data are run through a fixed set of threshold rules (see below) to produce a 0–100 score, a Low/Medium/High level, and a list of the specific reasons behind it.
4. **Pre-trade safety checks** — the same data is checked against a short list of sanity conditions (valid quote returned, valid route found, price impact within range, fee data available, risk score computed) and each is marked pass, warning, or unavailable.
5. **Overall Analysis Summary** — the risk level and safety-check status are combined into one headline and a short, plain-language recommendation.

No step in this pipeline builds, signs, sends, or simulates a transaction. Every number shown comes from Jupiter or Solana RPC responses already fetched for the steps above — nothing is inferred or generated beyond that.

## 📐 Risk Scoring Explanation

The risk score is a simple additive model over four factors, entirely rule-based (no machine learning, no AI call):

| Factor | Condition | Points added |
| --- | --- | --- |
| Price impact | > 3% | +50 |
| Price impact | > 1% | +30 |
| Price impact | > 0.1% | +15 |
| Slippage tolerance | > 1% | +25 |
| Slippage tolerance | > 0.5% | +10 |
| Route complexity | > 3 hops | +20 |
| Route complexity | 2–3 hops | +10 |
| Priority fee / congestion | > 10,000 µ-lamports/CU | +15 |
| Priority fee / congestion | > 1,000 µ-lamports/CU | +5 |

Points are summed and capped at 100, then mapped to the Risk Levels table above. Every rule that contributes points also adds a corresponding, specific reason to the Risk Factors list — the score is never a black box. If no rule triggers, the app says so explicitly rather than showing an empty list.

## 🛠️ Tech Stack

- Next.js
- TypeScript
- React
- Tailwind CSS
- Jupiter API
- Solana RPC

## 🗂️ Project Structure

```
app/
  page.tsx           Main UI: swap form, results, risk factors,
                     safety checks, and overall summary
  api/
    quote/route.ts   Server route: fetches a quote from Jupiter
    fees/route.ts    Server route: fetches fee data from Solana RPC
  lib/
    tokens.ts        Supported token list (SOL, USDC) and mint addresses
    solana.ts        Solana RPC helpers and fee constants
    risk.ts          Rule-based risk scoring
    safetyChecks.ts  Pre-trade safety check logic
    summary.ts       Overall Analysis Summary logic
```

## 📦 Getting Started

### Clone the repository

```bash
git clone https://github.com/waisumyong/DefiGuard.git
cd DefiGuard
```

### Install dependencies

```bash
npm install
```

### Create your environment file

```bash
cp .env.example .env.local
```

Configure the required API keys in `.env.local` (see [Environment Variables](#-environment-variables) below).

### Run the development server

```bash
npm run dev
```

Open:

```text
http://localhost:3000
```

Other scripts: `npm run build`, `npm start`, `npm run lint`, `npx tsc --noEmit`.

## 🔑 Environment Variables

See `.env.example` for full descriptions. In summary:

- `JUPITER_API_KEY` — **required**. Used server-side only (in `app/api/quote/route.ts`) to call Jupiter's Swap V2 order API. Never sent to the browser.
- `SOLANA_RPC_URL` — optional. Used server-side only (in `app/api/fees/route.ts`) to fetch live priority fee data. Falls back to the public mainnet-beta RPC endpoint if unset, which is rate-limited; a free RPC URL from a provider like Helius or QuickNode is recommended for reliable use.

No secrets are committed to this repository. Do not commit your `.env.local` file.

## ⚠️ Disclaimer

DeFiGuard provides **pre-trade analysis only**. It is not a trading or execution product.

It does **not**:

- Connect to a wallet
- Request or handle private keys
- Sign transactions
- Execute swaps
- Simulate a transaction on-chain
- Use an AI-based risk engine — all scoring is fixed, rule-based logic
- Guarantee that a transaction will succeed on-chain

Analysis is based on available quote, fee, and rule-based risk data at the time of the request. Market conditions, liquidity, and network state can change between viewing an analysis and any trade a user might separately choose to make. DeFiGuard should not be treated as financial advice.

## 🔮 Future Improvements

- Support for additional token pairs beyond SOL/USDC
- Historical price impact / slippage trends for a given pair
- Configurable risk thresholds
- Read-only wallet balance check (still no signing) to flag insufficient-balance trades before the user goes elsewhere to swap
- Export/share a given analysis as a permalink or report
