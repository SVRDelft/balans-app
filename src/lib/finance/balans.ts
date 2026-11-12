export interface BalansInvoer {
  beginsaldoBankCenten: number;
  beginsaldoEigenVermogenCenten: number;

  /** Som van alle ontvangen betalingen in dit boekjaar. */
  ontvangenBetalingenCenten: number;
  /** Som van de uitgaven die al betaald zijn. */
  betaaldeUitgavenCenten: number;

  /** Openstaande facturen uit dit boekjaar. */
  debiteurenCenten: number;
  /**
   * Facturen uit eerdere boekjaren die aan het begin van dit jaar nog openstonden,
   * plus het rekening-courantsaldo van toen. Dit zijn de vorderingen die het jaar
   * is binnengekomen; ze staan ook in het beginbalansverschil, zodat ze de balans
   * niet uit elkaar trekken.
   */
  overgenomenVorderingenCenten?: number;
  /** Nog openstaande facturen uit eerdere boekjaren, nu gemeten. */
  eerdereDebiteurenCenten?: number;
  /** Rekening-courant: wat nog van personen en verenigingen moet komen. */
  teVorderenRekeningcourantCenten?: number;
  /** Rekening-courant: wat de SVR nog moet terugbetalen, als positief getal. */
  teBetalenRekeningcourantCenten?: number;
  /** Rekening-courantbedragen die in dit jaar over de SVR-rekening gingen. */
  rekeningcourantViaBankCenten?: number;

  /** Saldo van de spaarrekening op de eerste dag van het boekjaar. */
  beginsaldoSpaarCenten?: number;
  /** Wat er dit jaar bij of af ging op de spaarrekening. */
  spaarMutatieCenten?: number;
  /**
   * Het deel daarvan dat over de betaalrekening liep: overboekingen tussen de
   * eigen rekeningen. Rente komt rechtstreeks op de spaarrekening binnen en zit
   * hier dus niet in.
   */
  spaarViaBetaalrekeningCenten?: number;
  /** Laatst ingevoerde werkelijke spaarsaldo, of null als dat er niet is. */
  ingevoerdSpaarsaldoCenten?: number | null;
  /** Nog te betalen aan leveranciers. */
  crediteurenCenten: number;

  gerealiseerdeInkomstenCenten: number;
  gerealiseerdeUitgavenCenten: number;
  voorraadBeginCenten?: number;
  voorraadCenten?: number;
  /**
   * Het deel van de voorraadmutatie dat nog niet in
   * `gerealiseerdeUitgavenCenten` verwerkt is.
   *
   * Hangt een voorraadpost aan een begrotingspost, dan telt het verbruik daar
   * al mee als kosten. Dat deel mag hier niet nog een keer bij, anders wordt
   * het dubbel geteld. Laat het veld weg en de hele mutatie wordt meegenomen —
   * dat is het gedrag zonder gekoppelde voorraadposten.
   */
  voorraadMutatieBuitenPostenCenten?: number;

  /** Laatst handmatig ingevoerde banksaldo, of null als dat er niet is. */
  ingevoerdBanksaldoCenten: number | null;
}

export interface Balans {
  /** Saldo dat uit de administratie volgt. */
  administratiefBanksaldoCenten: number;
  debiteurenCenten: number;
  eerdereDebiteurenCenten: number;
  teVorderenRekeningcourantCenten: number;
  teBetalenRekeningcourantCenten: number;
  /** Wat er op de spaarrekening staat volgens de administratie. */
  spaarsaldoCenten: number;
  totaalActivaCenten: number;
  voorraadCenten: number;
  voorraadMutatieCenten: number;

  crediteurenCenten: number;
  eigenVermogenBeginCenten: number;
  resultaatCenten: number;
  /**
   * Verschil tussen bank plus voorraad bij aanvang en het beginsaldo van het eigen
   * vermogen. Dat verschil zijn vorderingen of schulden uit het vorige jaar die
   * niet apart zijn ingevoerd. Staat als losse regel op de balans, zodat de
   * balans altijd sluit en het verschil zichtbaar blijft.
   */
  beginbalansverschilCenten: number;
  totaalPassivaCenten: number;

  /** Hoort nul te zijn. */
  balansverschilCenten: number;

  /** Ingevoerd banksaldo min het administratieve saldo. */
  bankverschilCenten: number | null;
  /** Hetzelfde, maar voor de spaarrekening. */
  spaarverschilCenten: number | null;
}

/**
 * De balans van het lopende boekjaar. Activa zijn bank, voorraad en
 * openstaande debiteuren; passiva de crediteuren, het eigen vermogen aan het
 * begin van het jaar en het resultaat tot nu toe.
 */
export function berekenBalans(invoer: BalansInvoer): Balans {
  const voorraadBeginCenten = invoer.voorraadBeginCenten ?? 0;
  const voorraadCenten = invoer.voorraadCenten ?? 0;
  const voorraadMutatieCenten = voorraadCenten - voorraadBeginCenten;
  const eerdereDebiteurenCenten = invoer.eerdereDebiteurenCenten ?? 0;
  const teVorderenRekeningcourantCenten =
    invoer.teVorderenRekeningcourantCenten ?? 0;
  const teBetalenRekeningcourantCenten =
    invoer.teBetalenRekeningcourantCenten ?? 0;

  // Geld dat naar de spaarrekening gaat is geen uitgave: het is nog steeds van
  // de SVR, maar het staat ergens anders. Daarom gaat het hier van de
  // betaalrekening af en komt het hieronder bij de activa terug.
  const beginsaldoSpaarCenten = invoer.beginsaldoSpaarCenten ?? 0;
  const spaarsaldoCenten = beginsaldoSpaarCenten + (invoer.spaarMutatieCenten ?? 0);

  // Geld dat privé door de SVR-rekening liep, is wél van de rekening af. Zonder
  // deze regel zou dat in het bankverschil blijven hangen.
  const administratiefBanksaldoCenten =
    invoer.beginsaldoBankCenten +
    invoer.ontvangenBetalingenCenten -
    invoer.betaaldeUitgavenCenten -
    (invoer.rekeningcourantViaBankCenten ?? 0) -
    (invoer.spaarViaBetaalrekeningCenten ?? 0);

  // Alleen het deel dat nog nergens in zit; de rest zit al in de uitgaven van
  // de begrotingsposten waaraan de spullen hangen.
  const voorraadMutatieBuitenPostenCenten =
    invoer.voorraadMutatieBuitenPostenCenten ?? voorraadMutatieCenten;

  const resultaatCenten =
    invoer.gerealiseerdeInkomstenCenten -
    invoer.gerealiseerdeUitgavenCenten +
    voorraadMutatieBuitenPostenCenten;

  const beginbalansverschilCenten =
    invoer.beginsaldoBankCenten +
    beginsaldoSpaarCenten +
    voorraadBeginCenten +
    (invoer.overgenomenVorderingenCenten ?? 0) -
    invoer.beginsaldoEigenVermogenCenten;

  const totaalActivaCenten =
    administratiefBanksaldoCenten +
    spaarsaldoCenten +
    invoer.debiteurenCenten +
    eerdereDebiteurenCenten +
    teVorderenRekeningcourantCenten +
    voorraadCenten;

  const totaalPassivaCenten =
    invoer.crediteurenCenten +
    teBetalenRekeningcourantCenten +
    invoer.beginsaldoEigenVermogenCenten +
    resultaatCenten +
    beginbalansverschilCenten;

  return {
    administratiefBanksaldoCenten,
    debiteurenCenten: invoer.debiteurenCenten,
    eerdereDebiteurenCenten,
    teVorderenRekeningcourantCenten,
    teBetalenRekeningcourantCenten,
    spaarsaldoCenten,
    totaalActivaCenten,
    voorraadCenten,
    voorraadMutatieCenten,

    crediteurenCenten: invoer.crediteurenCenten,
    eigenVermogenBeginCenten: invoer.beginsaldoEigenVermogenCenten,
    resultaatCenten,
    beginbalansverschilCenten,
    totaalPassivaCenten,

    balansverschilCenten: totaalActivaCenten - totaalPassivaCenten,

    bankverschilCenten:
      invoer.ingevoerdBanksaldoCenten === null
        ? null
        : invoer.ingevoerdBanksaldoCenten - administratiefBanksaldoCenten,

    spaarverschilCenten:
      invoer.ingevoerdSpaarsaldoCenten === null ||
      invoer.ingevoerdSpaarsaldoCenten === undefined
        ? null
        : invoer.ingevoerdSpaarsaldoCenten - spaarsaldoCenten,
  };
}
