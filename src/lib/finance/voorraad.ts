export interface VoorraadInvoer {
  beginAantal: number;
  beginWaardePerStukCenten: number;
  aantal: number;
  waardePerStukCenten: number;
}

export interface VerbruikInvoer {
  /** Wat er nu ligt. */
  aantal: number;
  /** Hoeveel er af gaan. */
  verbruikt: number;
  waardePerStukCenten: number;
}

export interface Verbruik {
  nieuwAantal: number;
  /** Waarde die uit de balans verdwijnt en als kosten geboekt wordt. */
  waardeCenten: number;
}

/**
 * Boekt verbruik af van wat er ligt. Meer verbruiken dan er is kan niet: dan
 * zou de voorraad negatief worden en klopt de balans niet meer.
 */
export function berekenVerbruik({
  aantal,
  verbruikt,
  waardePerStukCenten,
}: VerbruikInvoer): Verbruik {
  if (!Number.isSafeInteger(verbruikt) || verbruikt < 1) {
    throw new Error("Vul een aantal van minstens 1 in.");
  }
  if (verbruikt > aantal) {
    throw new Error(
      `Er liggen er maar ${aantal}, dus er kunnen er geen ${verbruikt} af.`,
    );
  }
  return {
    nieuwAantal: aantal - verbruikt,
    waardeCenten: verbruikt * waardePerStukCenten,
  };
}

export function berekenVoorraad(posten: readonly VoorraadInvoer[]) {
  let beginwaardeCenten = 0;
  let waardeCenten = 0;
  for (const post of posten) {
    for (const getal of [
      post.beginAantal,
      post.beginWaardePerStukCenten,
      post.aantal,
      post.waardePerStukCenten,
    ]) {
      if (!Number.isSafeInteger(getal) || getal < 0) {
        throw new Error(
          "Voorraadaantallen en waarden moeten positieve gehele getallen of nul zijn.",
        );
      }
    }
    beginwaardeCenten += post.beginAantal * post.beginWaardePerStukCenten;
    waardeCenten += post.aantal * post.waardePerStukCenten;
    if (
      !Number.isSafeInteger(beginwaardeCenten) ||
      !Number.isSafeInteger(waardeCenten)
    ) {
      throw new Error(
        "De voorraadwaarde is te groot om nauwkeurig te berekenen.",
      );
    }
  }
  return {
    beginwaardeCenten,
    waardeCenten,
    mutatieCenten: waardeCenten - beginwaardeCenten,
  };
}
