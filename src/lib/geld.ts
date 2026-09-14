// Alle bedragen zijn gehele aantallen eurocenten. Formatteren gebeurt pas hier,
// in Nederlands formaat.

const EURO_FORMAT = new Intl.NumberFormat("nl-NL", {
  style: "currency",
  currency: "EUR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const GETAL_FORMAT = new Intl.NumberFormat("nl-NL", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** € 1.234,56 */
export function formatteerEuro(centen: number): string {
  return EURO_FORMAT.format(centen / 100);
}

/** 1.234,56 — zonder euroteken, voor tabellen met een eigen kolomkop. */
export function formatteerBedrag(centen: number): string {
  return GETAL_FORMAT.format(centen / 100);
}

/** Waarde voor een tekstveld waarin een bedrag bewerkt wordt: "1234,56". */
export function centenNaarInvoer(centen: number): string {
  const negatief = centen < 0;
  const absolute = Math.abs(centen);
  const heel = Math.floor(absolute / 100);
  const rest = absolute % 100;
  return `${negatief ? "-" : ""}${heel},${String(rest).padStart(2, "0")}`;
}

/**
 * Leest een bedrag zoals een mens het typt. Accepteert "1234,56", "1.234,56",
 * "1234.56", "€ 1.234,56" en "1234". Geeft null bij onleesbare invoer.
 *
 * Een scheidingsteken telt alleen als decimaalteken wanneer er één of twee
 * cijfers achter staan; "1.234" is dus duizendtallen en geen 1 euro 234.
 */
export function parseerBedragNaarCenten(invoer: string): number | null {
  const schoon = invoer.replace(/[\s €]/g, "");
  if (schoon === "") return null;

  let negatief = false;
  let rest = schoon;
  if (rest.startsWith("-")) {
    negatief = true;
    rest = rest.slice(1);
  } else if (rest.startsWith("+")) {
    rest = rest.slice(1);
  }

  if (!/^[0-9]+([.,][0-9]+)*$/.test(rest)) return null;

  const scheiding = Math.max(rest.lastIndexOf("."), rest.lastIndexOf(","));

  let heelTekst: string;
  let centTekst: string;

  if (scheiding === -1) {
    heelTekst = rest;
    centTekst = "00";
  } else {
    const achter = rest.slice(scheiding + 1);
    if (achter.length === 1 || achter.length === 2) {
      heelTekst = rest.slice(0, scheiding);
      centTekst = achter.padEnd(2, "0");
    } else {
      heelTekst = rest;
      centTekst = "00";
    }
  }

  heelTekst = heelTekst.replace(/[.,]/g, "");
  if (heelTekst === "") heelTekst = "0";
  if (!/^\d+$/.test(heelTekst)) return null;

  const centen = Number(heelTekst) * 100 + Number(centTekst);
  if (!Number.isSafeInteger(centen)) return null;
  return negatief ? -centen : centen;
}

/**
 * Verdeelt een bedrag over gewichten zonder centen kwijt te raken: de som van
 * het resultaat is exact het ingevoerde bedrag. De overgebleven centen gaan
 * naar de grootste resten.
 */
export function verdeelCenten(
  totaalCenten: number,
  gewichten: readonly number[],
): number[] {
  if (gewichten.length === 0) return [];

  const somGewicht = gewichten.reduce((a, b) => a + b, 0);
  if (somGewicht <= 0) return gewichten.map(() => 0);

  const teken = totaalCenten < 0 ? -1 : 1;
  const absoluutTotaal = Math.abs(totaalCenten);

  const basis = gewichten.map((gewicht) =>
    Math.floor((absoluutTotaal * gewicht) / somGewicht),
  );
  let teVerdelen = absoluutTotaal - basis.reduce((a, b) => a + b, 0);

  const resten = gewichten
    .map((gewicht, index) => ({
      index,
      rest: (absoluutTotaal * gewicht) % somGewicht,
    }))
    .sort((a, b) => b.rest - a.rest || a.index - b.index);

  const uitkomst = [...basis];
  let i = 0;
  while (teVerdelen > 0) {
    uitkomst[resten[i % resten.length].index] += 1;
    teVerdelen -= 1;
    i += 1;
  }

  return uitkomst.map((bedrag) => bedrag * teken);
}

/** Deelt naar boven af op hele centen; nooit minder dan kostendekkend. */
export function deelNaarBoven(totaalCenten: number, aantal: number): number {
  if (aantal <= 0) return 0;
  return Math.ceil(totaalCenten / aantal);
}
