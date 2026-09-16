/** Shared lightweight credit/payment relations for consistent balances in every view. */
export const factuurStandRelaties = {
  creditfactuur: { include: { betalingen: true } },
  crediteertFactuur: { include: { betalingen: true } },
} as const;
