export interface VoorraadInvoer {
  beginAantal: number;
  beginWaardePerStukCenten: number;
  aantal: number;
  waardePerStukCenten: number;
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
