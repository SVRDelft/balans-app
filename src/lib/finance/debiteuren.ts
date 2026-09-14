import { dagenTussen } from "@/lib/datum";

export const OUDERDOM_GROEPEN = ["tot30", "van30tot60", "meer60"] as const;
export type OuderdomGroep = (typeof OUDERDOM_GROEPEN)[number];

export const OUDERDOM_LABEL: Record<OuderdomGroep, string> = {
  tot30: "Tot 30 dagen",
  van30tot60: "30 tot 60 dagen",
  meer60: "Meer dan 60 dagen",
};

/** Ouderdom gerekend vanaf de factuurdatum. */
export function bepaalOuderdom(
  factuurdatum: Date,
  peildatum: Date,
): OuderdomGroep {
  const dagen = dagenTussen(factuurdatum, peildatum);
  if (dagen < 30) return "tot30";
  if (dagen < 60) return "van30tot60";
  return "meer60";
}

export interface OpenstaandeFactuur {
  id: string;
  factuurdatum: Date;
  openstaandCenten: number;
}

export interface Ouderdomsanalyse {
  tot30: number;
  van30tot60: number;
  meer60: number;
  totaal: number;
}

export function maakOuderdomsanalyse(
  facturen: readonly OpenstaandeFactuur[],
  peildatum: Date,
): Ouderdomsanalyse {
  const analyse: Ouderdomsanalyse = {
    tot30: 0,
    van30tot60: 0,
    meer60: 0,
    totaal: 0,
  };

  for (const factuur of facturen) {
    const groep = bepaalOuderdom(factuur.factuurdatum, peildatum);
    analyse[groep] += factuur.openstaandCenten;
    analyse.totaal += factuur.openstaandCenten;
  }

  return analyse;
}
