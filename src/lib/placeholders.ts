// Een vangnet voor teksten die nog ingevuld moeten worden.
//
// In content/ mag "[IN TE VULLEN: …]" staan. Lokaal zie je dat gewoon staan,
// zodat het opvalt. Op de echte site wordt het weggelaten: een bezoeker hoort
// nooit een notitie aan onszelf te lezen.

const PATROON = /\[IN TE VULLEN[^\]]*\]/gi;

export const isPlaceholder = (tekst: string) => /\[IN TE VULLEN/i.test(tekst);

/** Vervangt placeholders door niets in productie, en laat ze staan tijdens het bouwen. */
export function zonderPlaceholder(tekst: string): string {
  if (process.env.NODE_ENV !== "production") return tekst;
  // Alleen spaties en tabs binnen een regel samenvoegen. Regeleindes zijn de
  // opmaak van Markdown en moeten blijven staan.
  return tekst.replace(PATROON, "").replace(/[ \t]{2,}/g, " ");
}

/**
 * Hele blokken (een tijdlijnitem, een alinea) die alleen uit een placeholder
 * bestaan, verdwijnen in productie helemaal.
 */
export const toonBlok = (tekst: string) =>
  process.env.NODE_ENV !== "production" || !isPlaceholder(tekst);
