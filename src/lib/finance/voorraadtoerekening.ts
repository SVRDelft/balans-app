// Verdeelt de waardeverandering van de spullen over de begrotingsposten.
//
// Het verbruik van spullen is een kostenpost: geef je twee dassen weg, dan
// verlaat die waarde de vereniging. Hangt een voorraadpost aan een
// begrotingspost, dan telt dat verbruik daar mee, zodat begroot tegenover
// gerealiseerd klopt. Hangt hij nergens aan, dan blijft de mutatie op één
// verzamelregel in de exploitatie staan.

export interface VoorraadpostToerekening {
  begrotingspostId: string | null;
  beginAantal: number;
  beginWaardePerStukCenten: number;
  aantal: number;
  waardePerStukCenten: number;
}

export interface Toerekening {
  /** Per begrotingspost het bedrag dat als kosten meetelt. */
  kostenPerBegrotingspost: Map<string, number>;
  /** Mutatie van spullen zonder begrotingspost. */
  buitenPostenCenten: number;
}

export function mutatieVanPost(post: VoorraadpostToerekening): number {
  return (
    post.aantal * post.waardePerStukCenten -
    post.beginAantal * post.beginWaardePerStukCenten
  );
}

/**
 * @param uitgavenpostIds de begrotingsposten van soort 'uitgave'. Alleen daar
 *   hoort voorraadverbruik thuis; een koppeling aan een inkomstenpost wordt
 *   genegeerd en valt terug op de verzamelregel.
 */
export function rekenVoorraadToe(
  posten: readonly VoorraadpostToerekening[],
  uitgavenpostIds: ReadonlySet<string>,
): Toerekening {
  const kostenPerBegrotingspost = new Map<string, number>();
  let buitenPostenCenten = 0;

  for (const post of posten) {
    const mutatie = mutatieVanPost(post);

    if (post.begrotingspostId && uitgavenpostIds.has(post.begrotingspostId)) {
      // Een dalende voorraad is een kostenpost, dus het teken draait om:
      // mutatie −1000 betekent 1000 aan kosten.
      const huidig = kostenPerBegrotingspost.get(post.begrotingspostId) ?? 0;
      kostenPerBegrotingspost.set(post.begrotingspostId, huidig - mutatie);
    } else {
      buitenPostenCenten += mutatie;
    }
  }

  return { kostenPerBegrotingspost, buitenPostenCenten };
}
