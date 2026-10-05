/** Eén resultaat uit het zoekvenster. Staat los van de route, zodat de client
 *  het type kan gebruiken zonder serverbestand te importeren. */
export interface Zoekresultaat {
  /** "Factuur", "Relatie", "Uitgave", "Evenement" of "Pagina". */
  soort: string;
  titel: string;
  onderschrift: string;
  href: string;
}
