import type { FactuurStatus } from "@/lib/domein";

export interface StatusInvoer {
  huidigeStatus: FactuurStatus;
  totaalCenten: number;
  betaaldCenten: number;
}

/**
 * De status van een factuur volgt uit de som van de betalingen. Deelbetalingen
 * komen in de praktijk voor, dus het is niet alleen "wel of niet betaald".
 *
 * Een concept heeft nog geen betalingen; oninbaar en gecrediteerd zijn
 * eindstanden die het bestuur bewust heeft gezet en die niet vanzelf
 * terugdraaien.
 */
export function bepaalFactuurStatus({
  huidigeStatus,
  totaalCenten,
  betaaldCenten,
}: StatusInvoer): FactuurStatus {
  if (
    huidigeStatus === "concept" ||
    huidigeStatus === "oninbaar" ||
    huidigeStatus === "gecrediteerd"
  ) {
    return huidigeStatus;
  }

  if (totaalCenten === 0) return "betaald";
  if (betaaldCenten === 0) return "verstuurd";

  const openstaand = totaalCenten - betaaldCenten;

  // Bij een creditfactuur zijn beide bedragen negatief; "helemaal afgehandeld"
  // betekent dan dat er niets meer terug te betalen valt.
  const afgehandeld = totaalCenten > 0 ? openstaand <= 0 : openstaand >= 0;
  if (afgehandeld) return "betaald";

  return "deels_betaald";
}

/** Wat er nog binnen moet komen. Nul zodra de factuur volledig betaald is. */
export function openstaandBedrag(
  totaalCenten: number,
  betaaldCenten: number,
): number {
  const openstaand = totaalCenten - betaaldCenten;
  if (totaalCenten >= 0) return Math.max(0, openstaand);
  return Math.min(0, openstaand);
}

/** Meer ontvangen dan gefactureerd. Zeldzaam, maar het moet opvallen. */
export function isTeveelBetaald(
  totaalCenten: number,
  betaaldCenten: number,
): boolean {
  if (totaalCenten >= 0) return betaaldCenten > totaalCenten;
  return betaaldCenten < totaalCenten;
}
