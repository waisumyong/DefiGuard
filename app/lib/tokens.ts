// MVP only supports these two tokens. Add more here (and to the
// dropdowns in app/page.tsx) once broader token support is needed.
export const SUPPORTED_TOKENS = {
  SOL: {
    mint: "So11111111111111111111111111111111111111112",
    decimals: 9,
  },
  USDC: {
    mint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
    decimals: 6,
  },
} as const;

export type TokenSymbol = keyof typeof SUPPORTED_TOKENS;
