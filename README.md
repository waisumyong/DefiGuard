# 🛡️ DeFiGuard

A pre-trade analysis tool for Solana token swaps.

DeFiGuard helps users analyze a token swap before trading by showing live quote data, estimated fees, price impact, risk signals, pre-trade safety checks, and an overall analysis summary.

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
|---|---|
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

## 🛠️ Tech Stack

- Next.js
- TypeScript
- React
- Tailwind CSS
- Jupiter API
- Solana RPC

## 📦 Getting Started

### Clone the repository

```bash
git clone https://github.com/waisumyong/DefiGuard.git
cd DefiGuard

### Install dependencies

```bash
npm install
```

### Create your environment file

```bash
cp .env.example .env.local
```

Configure the required API keys in `.env.local`.

### Run the development server

```bash
npm run dev
```

Open:

```text
http://localhost:3000
```

## ⚠️ Disclaimer

DeFiGuard provides **pre-trade analysis only**.

It does **not**:

- Connect to a wallet
- Sign transactions
- Execute swaps
- Guarantee that a transaction will succeed on-chain

Analysis is based on available quote, fee, and rule-based risk data.
