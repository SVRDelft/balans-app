// De rekening-courant: geld dat buiten facturen om heen en weer gaat tussen de
// SVR en één persoon of vereniging.
//
// De aanleiding is de praktijk. Er wordt iets privés met de SVR-pinpas betaald,
// of iemand schiet iets voor en krijgt het later terug. Zonder administratie
// daarvan verdwijnt zoiets in het bankverschil en weet niemand een jaar later
// meer wie wat nog moet betalen.
//
// Afspraak over het teken, overal gelijk: positief betekent dat de relatie de
// SVR nog moet betalen (een vordering), negatief dat de SVR de relatie nog iets
// schuldig is.

export interface RekeningpostInvoer {
  relatieId: string;
  relatieNaam: string;
  relatieType: string;
  datum: Date;
  bedragCenten: number;
  /** Is het bedrag echt over de SVR-rekening gegaan? */
  viaBank: boolean;
  /** Hoort deze post bij een eerder boekjaar dan het boekjaar dat je bekijkt? */
  eerderBoekjaar?: boolean;
}

export interface RelatieSaldo {
  relatieId: string;
  relatieNaam: string;
  relatieType: string;
  /** Positief: de relatie moet nog betalen. Negatief: de SVR moet nog betalen. */
  saldoCenten: number;
  /** Deel van het saldo dat uit eerdere boekjaren komt. */
  overgenomenCenten: number;
  aantalPosten: number;
  laatsteDatum: Date;
}

export interface Rekeningcourant {
  /** Alleen relaties waar nog iets staat of iets gebeurd is, grootste eerst. */
  saldi: RelatieSaldo[];
  /** Som van de saldi die nog binnen moeten komen. */
  teVorderenCenten: number;
  /** Som van de saldi die de SVR nog moet terugbetalen, als positief getal. */
  teBetalenCenten: number;
  /** Te vorderen min te betalen. */
  nettoCenten: number;
  /** Wat in dit boekjaar via de bank is gegaan; nodig voor het banksaldo. */
  viaBankCenten: number;
  /** Het saldo dat bij het begin van dit boekjaar al openstond. */
  overgenomenCenten: number;
}

/**
 * Telt de posten op tot één stand per relatie. Een saldo loopt door over
 * boekjaren heen: wie in mei nog iets moest betalen, moet dat in september nog.
 */
export function maakRekeningcourant(
  posten: readonly RekeningpostInvoer[],
): Rekeningcourant {
  const perRelatie = new Map<string, RelatieSaldo>();
  let viaBankCenten = 0;
  let overgenomenCenten = 0;

  for (const post of posten) {
    if (post.viaBank && !post.eerderBoekjaar) viaBankCenten += post.bedragCenten;
    if (post.eerderBoekjaar) overgenomenCenten += post.bedragCenten;

    const bestaand = perRelatie.get(post.relatieId);
    if (bestaand) {
      bestaand.saldoCenten += post.bedragCenten;
      bestaand.aantalPosten += 1;
      if (post.eerderBoekjaar) bestaand.overgenomenCenten += post.bedragCenten;
      if (post.datum > bestaand.laatsteDatum) bestaand.laatsteDatum = post.datum;
      continue;
    }
    perRelatie.set(post.relatieId, {
      relatieId: post.relatieId,
      relatieNaam: post.relatieNaam,
      relatieType: post.relatieType,
      saldoCenten: post.bedragCenten,
      overgenomenCenten: post.eerderBoekjaar ? post.bedragCenten : 0,
      aantalPosten: 1,
      laatsteDatum: post.datum,
    });
  }

  const saldi = [...perRelatie.values()].sort(
    (a, b) =>
      Math.abs(b.saldoCenten) - Math.abs(a.saldoCenten) ||
      a.relatieNaam.localeCompare(b.relatieNaam, "nl"),
  );

  const teVorderenCenten = saldi
    .filter((saldo) => saldo.saldoCenten > 0)
    .reduce((som, saldo) => som + saldo.saldoCenten, 0);
  const teBetalenCenten = saldi
    .filter((saldo) => saldo.saldoCenten < 0)
    .reduce((som, saldo) => som - saldo.saldoCenten, 0);

  return {
    saldi,
    teVorderenCenten,
    teBetalenCenten,
    nettoCenten: teVorderenCenten - teBetalenCenten,
    viaBankCenten,
    overgenomenCenten,
  };
}

/**
 * Wat een post met de kosten of opbrengsten doet. Een post die niet via de bank
 * is gegaan, is een correctie: het bedrag wordt afgeboekt op een begrotingspost
 * en komt dus in de exploitatie terecht. Gaat het wél via de bank, dan is het
 * alleen geld schuiven en raakt het de exploitatie niet.
 */
export function resultaatEffectCenten(post: {
  viaBank: boolean;
  bedragCenten: number;
}): number {
  return post.viaBank ? 0 : post.bedragCenten;
}
