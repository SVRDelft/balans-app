export interface BalansInvoer {
  beginsaldoBankCenten: number;
  beginsaldoEigenVermogenCenten: number;

  /** Som van alle ontvangen betalingen in dit boekjaar. */
  ontvangenBetalingenCenten: number;
  /** Som van de uitgaven die al betaald zijn. */
  betaaldeUitgavenCenten: number;

  /** Openstaand bij de verenigingen en personen. */
  debiteurenCenten: number;
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
  const administratiefBanksaldoCenten =
    invoer.beginsaldoBankCenten +
    invoer.ontvangenBetalingenCenten -
    invoer.betaaldeUitgavenCenten;

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
    voorraadBeginCenten -
    invoer.beginsaldoEigenVermogenCenten;

  const totaalActivaCenten =
    administratiefBanksaldoCenten + invoer.debiteurenCenten + voorraadCenten;

  const totaalPassivaCenten =
    invoer.crediteurenCenten +
    invoer.beginsaldoEigenVermogenCenten +
    resultaatCenten +
    beginbalansverschilCenten;

  return {
    administratiefBanksaldoCenten,
    debiteurenCenten: invoer.debiteurenCenten,
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
  };
}
