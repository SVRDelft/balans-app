// Toegestane waarden voor de tekstvelden in het schema. Ze staan hier en niet
// als enum in Prisma, omdat SQLite geen enums kent en het schema op elke
// database moet werken.

export const FACTUUR_STATUSSEN = [
  "concept",
  "verstuurd",
  "deels_betaald",
  "betaald",
  "oninbaar",
  "gecrediteerd",
] as const;
export type FactuurStatus = (typeof FACTUUR_STATUSSEN)[number];

export const FACTUUR_STATUS_LABEL: Record<FactuurStatus, string> = {
  concept: "Concept",
  verstuurd: "Verstuurd",
  deels_betaald: "Deels betaald",
  betaald: "Betaald",
  oninbaar: "Oninbaar",
  gecrediteerd: "Gecrediteerd",
};

/// Statussen waarbij de factuur inhoudelijk niet meer te wijzigen is.
/// Corrigeren gaat dan via een creditfactuur.
export const VERGRENDELDE_STATUSSEN: readonly FactuurStatus[] = [
  "verstuurd",
  "deels_betaald",
  "betaald",
  "oninbaar",
  "gecrediteerd",
];

/// Statussen die meetellen als gerealiseerde opbrengst en als debiteur.
export const TELLENDE_STATUSSEN: readonly FactuurStatus[] = [
  "verstuurd",
  "deels_betaald",
  "betaald",
];

/// Statussen waarbij nog geld binnen moet komen.
export const OPENSTAANDE_STATUSSEN: readonly FactuurStatus[] = [
  "verstuurd",
  "deels_betaald",
];

export function isVergrendeld(status: string): boolean {
  return VERGRENDELDE_STATUSSEN.includes(status as FactuurStatus);
}

export const FACTUUR_SOORTEN = ["normaal", "credit"] as const;
export type FactuurSoort = (typeof FACTUUR_SOORTEN)[number];

export const RELATIE_TYPES = [
  "studievereniging",
  "persoon",
  "leverancier",
  "overig",
] as const;
export type RelatieType = (typeof RELATIE_TYPES)[number];

export const RELATIE_TYPE_LABEL: Record<RelatieType, string> = {
  studievereniging: "Studievereniging",
  persoon: "Persoon",
  leverancier: "Leverancier",
  overig: "Overig",
};

export const POST_CATEGORIEEN = ["vast", "omslag"] as const;
export type PostCategorie = (typeof POST_CATEGORIEEN)[number];

export const POST_CATEGORIE_LABEL: Record<PostCategorie, string> = {
  vast: "Vaste posten",
  omslag: "Omslagposten",
};

export const POST_SOORTEN = ["inkomst", "uitgave"] as const;
export type PostSoort = (typeof POST_SOORTEN)[number];

export const POST_SOORT_LABEL: Record<PostSoort, string> = {
  inkomst: "Inkomst",
  uitgave: "Uitgave",
};

export const EVENEMENT_STATUSSEN = [
  "open",
  "omslag_berekend",
  "afgesloten",
] as const;
export type EvenementStatus = (typeof EVENEMENT_STATUSSEN)[number];

export const EVENEMENT_STATUS_LABEL: Record<EvenementStatus, string> = {
  open: "Open",
  omslag_berekend: "Omslag berekend",
  afgesloten: "Afgesloten",
};

export const OMSLAGRONDE_TYPES = ["initieel", "naheffing"] as const;
export type OmslagrondeType = (typeof OMSLAGRONDE_TYPES)[number];

export function label<T extends string>(
  kaart: Record<T, string>,
  waarde: string,
): string {
  return (kaart as Record<string, string>)[waarde] ?? waarde;
}
