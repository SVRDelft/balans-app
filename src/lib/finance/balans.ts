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

  /** Laatst handmatig ingevoerde banksaldo, of null als dat er niet is. */
  ingevoerdBanksaldoCenten: number | null;
}

export interface Balans {
  /** Saldo dat uit de administratie volgt. */
  administratiefBanksaldoCenten: number;
  debiteurenCenten: number;
  totaalActivaCenten: number;

  crediteurenCenten: number;
  eigenVermogenBeginCenten: number;
  resultaatCenten: number;
  /**
   * Verschil tussen het beginsaldo van de bank en het beginsaldo van het eigen
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
 * De balans van het lopende boekjaar. Activa zijn het banksaldo en de
 * openstaande debiteuren; passiva de crediteuren, het eigen vermogen aan het
 * begin van het jaar en het resultaat tot nu toe.
 */
export function berekenBalans(invoer: BalansInvoer): Balans {
  const administratiefBanksaldoCenten =
    invoer.beginsaldoBankCenten +
    invoer.ontvangenBetalingenCenten -
    invoer.betaaldeUitgavenCenten;

  const resultaatCenten =
    invoer.gerealiseerdeInkomstenCenten - invoer.gerealiseerdeUitgavenCenten;

  const beginbalansverschilCenten =
    invoer.beginsaldoBankCenten - invoer.beginsaldoEigenVermogenCenten;

  const totaalActivaCenten =
    administratiefBanksaldoCenten + invoer.debiteurenCenten;

  const totaalPassivaCenten =
    invoer.crediteurenCenten +
    invoer.beginsaldoEigenVermogenCenten +
    resultaatCenten +
    beginbalansverschilCenten;

  return {
    administratiefBanksaldoCenten,
    debiteurenCenten: invoer.debiteurenCenten,
    totaalActivaCenten,

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
