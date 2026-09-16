import type { FactuurStatus } from "@/lib/domein";
import { bepaalFactuurStatus } from "./factuurstatus";

interface FactuurBasis {
  status: string;
  totaalCenten: number;
  betalingen: readonly { bedragCenten: number }[];
}
export interface FactuurStandInvoer extends FactuurBasis {
  creditfactuur?: FactuurBasis | null;
  crediteertFactuur?: FactuurBasis | null;
}
const betaald = (factuur: FactuurBasis) =>
  factuur.betalingen.reduce((som, betaling) => som + betaling.bedragCenten, 0);

function verstuurdeCredit(factuur: FactuurStandInvoer) {
  const credit = factuur.creditfactuur;
  return credit && credit.status !== "concept" && credit.status !== "oninbaar"
    ? credit
    : null;
}

/** A credit offsets its original once. Refunds stay on the credit invoice. */
export function factuurOpenstaand(factuur: FactuurStandInvoer): number {
  if (factuur.status === "concept") return 0;
  const credit = verstuurdeCredit(factuur);
  if (credit) {
    const restant =
      factuur.totaalCenten +
      credit.totaalCenten -
      betaald(factuur) -
      betaald(credit);
    return factuur.status === "oninbaar" ? 0 : Math.max(0, restant);
  }
  const origineel = factuur.crediteertFactuur;
  if (origineel) {
    return Math.min(
      0,
      origineel.totaalCenten +
        factuur.totaalCenten -
        betaald(origineel) -
        betaald(factuur),
    );
  }
  const restant = factuur.totaalCenten - betaald(factuur);
  if (factuur.status === "oninbaar") {
    // Only the unpaid remainder is written off; a surplus is still owed back.
    return factuur.totaalCenten >= 0
      ? Math.min(0, restant)
      : Math.max(0, restant);
  }
  return restant;
}

/** Recognise receipts up to the net invoice value, retaining any sent credit. */
export function factuurRealisatie(factuur: FactuurStandInvoer): number {
  if (factuur.status === "concept") return 0;
  if (factuur.status !== "oninbaar") return factuur.totaalCenten;
  const credit = verstuurdeCredit(factuur);
  const creditCenten = credit?.totaalCenten ?? 0;
  const netto = factuur.totaalCenten + creditCenten;
  const ontvangen = betaald(factuur) + (credit ? betaald(credit) : 0);
  const gerealiseerd =
    netto >= 0 ? Math.min(netto, ontvangen) : Math.max(netto, ontvangen);
  return gerealiseerd - creditCenten;
}

/** Partial credits keep the remainder payable; a full credit closes its original. */
export function factuurStandStatus(factuur: FactuurStandInvoer): FactuurStatus {
  if (factuur.status === "concept" || factuur.status === "oninbaar")
    return factuur.status;
  const credit = verstuurdeCredit(factuur);
  if (credit) {
    if (factuur.totaalCenten + credit.totaalCenten === 0) return "gecrediteerd";
    if (factuurOpenstaand(factuur) === 0) return "betaald";
    return betaald(factuur) + betaald(credit) === 0
      ? "verstuurd"
      : "deels_betaald";
  }
  if (factuur.crediteertFactuur) {
    if (factuurOpenstaand(factuur) === 0) return "betaald";
    return betaald(factuur) === 0 ? "verstuurd" : "deels_betaald";
  }
  return bepaalFactuurStatus({
    huidigeStatus:
      factuur.status === "gecrediteerd"
        ? "verstuurd"
        : (factuur.status as FactuurStatus),
    totaalCenten: factuur.totaalCenten,
    betaaldCenten: betaald(factuur),
  });
}

/** Allocate retained revenue proportionally, including negative discount lines. */
export function factuurRegelRealisaties(
  factuur: FactuurStandInvoer,
  regelbedragen: readonly number[],
): number[] {
  if (factuur.status === "concept") return regelbedragen.map(() => 0);
  if (factuur.status !== "oninbaar") return [...regelbedragen];
  const realisatie = factuurRealisatie(factuur);
  if (realisatie === 0) return regelbedragen.map(() => 0);
  const totaal = regelbedragen.reduce((som, bedrag) => som + bedrag, 0);
  if (totaal === 0)
    return regelbedragen.map((_, index) => (index === 0 ? realisatie : 0));

  // BigInt keeps cent rounding exact when a price times a weight exceeds 2^53.
  const noemer = BigInt(Math.abs(totaal));
  const richting = BigInt(totaal < 0 ? -1 : 1);
  const delen = regelbedragen.map((bedrag, index) => {
    const teller = BigInt(realisatie) * BigInt(bedrag) * richting;
    let basis = teller / noemer;
    if (teller % noemer < 0) basis -= BigInt(1);
    return { index, bedrag: Number(basis), rest: teller - basis * noemer };
  });
  const resterend =
    realisatie - delen.reduce((som, deel) => som + deel.bedrag, 0);
  const volgorde = [...delen].sort((a, b) =>
    a.rest === b.rest ? a.index - b.index : a.rest > b.rest ? -1 : 1,
  );
  for (let i = 0; i < resterend; i++) volgorde[i].bedrag += 1;
  return delen.map((deel) => deel.bedrag);
}
