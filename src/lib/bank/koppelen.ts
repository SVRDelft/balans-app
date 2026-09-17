export interface Bankregel {
  datum: Date;
  bedragCenten: number;
  omschrijving: string;
  tegenpartijNaam: string;
  tegenpartijIban: string;
}
export interface FactuurKeuze {
  id: string;
  nummer: string;
  relatieNaam: string;
  iban: string;
  openstaandCenten: number;
  status: string;
}
export interface BetalingKeuze {
  id: string;
  factuurId: string;
  datum: Date;
  bedragCenten: number;
}
export interface UitgaveKeuze {
  id: string;
  omschrijving: string;
  leverancierNaam: string;
  iban: string;
  bedragCenten: number;
  betaald: boolean;
  betaaldOp?: Date | null;
}

/**
 * Hoe zeker een voorstel is. Het koppelscherm vinkt "zeker" en "naam" alvast
 * aan; "bedrag" moet je zelf aanvinken, omdat een bedrag alleen niets bewijst.
 */
export type Zekerheid = "zeker" | "naam" | "bedrag";
export interface Voorstel {
  waarde: string;
  reden: string;
  zekerheid: Zekerheid;
}

const tekst = (waarde: string) =>
  waarde.normalize("NFKD").replace(/[̀-ͯ]/g, "").toUpperCase().replace(/[^A-Z0-9]/g, "");
export const normaliseerRekening = (waarde: string) => waarde.toUpperCase().replace(/[^A-Z0-9]/g, "");
const zelfdeDag = (a: Date, b: Date) => a.toISOString().slice(0, 10) === b.toISOString().slice(0, 10);

const woorden = (waarde: string) =>
  waarde.normalize("NFKD").replace(/[̀-ͯ]/g, "").toUpperCase().split(/[^A-Z0-9]+/).filter(Boolean);

/** Woorden die in veel verenigingsnamen staan en dus niets onderscheiden. */
const ALGEMEEN = new Set([
  "STUDIEVERENIGING", "VERENIGING", "STICHTING", "SV", "DE", "HET", "VAN", "VOOR", "EN", "DER", "DELFT", "TU", "TUDELFT",
]);

/**
 * Staat de naam van een relatie als losse woorden in de tekst? "TG" matcht
 * "LBG 2027 TG" maar niet "TGV"; "YES!Delft" matcht ook "YESDELFT".
 */
export function naamStaatIn(relatieNaam: string, inTekst: string): boolean {
  const alle = woorden(relatieNaam);
  const kern = alle.filter((woord) => !ALGEMEEN.has(woord));
  if (kern.length === 0) return false;
  const tekstWoorden = woorden(inTekst);
  if (tekstWoorden.length === 0) return false;

  for (let i = 0; i + kern.length <= tekstWoorden.length; i += 1) {
    if (kern.every((woord, j) => tekstWoorden[i + j] === woord)) return true;
  }
  // Aan elkaar geschreven, zoals YESDELFT of TG2027 niet: alleen hele woorden.
  const samengevoegd = alle.join("");
  return samengevoegd.length >= 4 && tekstWoorden.includes(samengevoegd);
}

const kanBetaaldWorden = (f: FactuurKeuze, bedrag: number) =>
  f.status !== "concept" && f.status !== "oninbaar" && Math.sign(f.openstaandCenten) === Math.sign(bedrag);

/** Suggereert alleen één eenduidige tegenhanger. */
export function zoekBankVoorstel(
  regel: Bankregel,
  facturen: FactuurKeuze[],
  betalingen: BetalingKeuze[],
  uitgaven: UitgaveKeuze[],
): Voorstel | undefined {
  if (regel.bedragCenten === 0) return;
  const omschrijving = regel.omschrijving.normalize("NFKD").replace(/[̀-ͯ]/g, "").toUpperCase();
  const iban = normaliseerRekening(regel.tegenpartijIban);

  const vermeld = facturen.filter((f) => {
    const nummer = tekst(f.nummer);
    // Het volledige nummer, waarbij de bank scheidingstekens mag weglaten. Een
    // stuk van een ander kenmerk is niet genoeg om op te boeken.
    return nummer.length >= 6 &&
      new RegExp(`(?:^|[^A-Z0-9])${nummer.split("").join("[^A-Z0-9]*")}(?![A-Z0-9])`).test(omschrijving);
  });
  if (vermeld.length > 1) return;

  const herkenbaar = vermeld.length ? vermeld : facturen.filter((f) => iban && normaliseerRekening(f.iban) === iban);
  const bestaand = betalingen.filter((b) =>
    herkenbaar.some((f) => f.id === b.factuurId) && b.bedragCenten === regel.bedragCenten && zelfdeDag(b.datum, regel.datum));
  if (bestaand.length === 1) {
    return { waarde: `betaling:${bestaand[0].id}`, zekerheid: "zeker", reden: "Bedrag en datum komen overeen met een al ingevoerde betaling. Er wordt geen tweede betaling geboekt." };
  }
  if (bestaand.length > 1) return;

  const passend = herkenbaar.filter((f) => kanBetaaldWorden(f, regel.bedragCenten) &&
    (vermeld.length ? Math.abs(regel.bedragCenten) <= Math.abs(f.openstaandCenten) : regel.bedragCenten === f.openstaandCenten));
  if (passend.length === 1) {
    return {
      waarde: `factuur:${passend[0].id}`,
      zekerheid: "zeker",
      reden: vermeld.length
        ? `Factuurnummer ${passend[0].nummer} staat in de omschrijving.`
        : `Rekeningnummer van ${passend[0].relatieNaam} en het openstaande bedrag kloppen.`,
    };
  }
  if (vermeld.length) return;

  // Staat er iets in dat op een factuurnummer lijkt maar niet exact klopt, dan
  // bedoelt de betaler waarschijnlijk een andere factuur. Dan niet op naam of
  // bedrag gokken.
  const kaleOmschrijving = tekst(regel.omschrijving);
  const voorvoegsels = new Set(facturen.map((f) => tekst(f.nummer.replace(/[^A-Za-z0-9]*\d+$/, ""))));
  if ([...voorvoegsels].some((v) => v.length >= 5 && kaleOmschrijving.includes(v))) return;

  if (regel.bedragCenten > 0) {
    // Naam van de vereniging in de naam van de rekeninghouder of de omschrijving,
    // plus precies het openstaande bedrag. Zo herken je LBG-betalingen waarbij
    // niemand het factuurnummer vermeldt.
    const zoektekst = `${regel.tegenpartijNaam} ${regel.omschrijving}`;
    const exact = facturen.filter((f) => kanBetaaldWorden(f, regel.bedragCenten) && f.openstaandCenten === regel.bedragCenten);
    const genoemd = new Set(exact.filter((f) => naamStaatIn(f.relatieNaam, zoektekst)).map((f) => f.relatieNaam));
    if (genoemd.size === 1) {
      const vanRelatie = exact.filter((f) => genoemd.has(f.relatieNaam));
      if (vanRelatie.length === 1) {
        return { waarde: `factuur:${vanRelatie[0].id}`, zekerheid: "naam", reden: `${vanRelatie[0].relatieNaam} en het bedrag kloppen met factuur ${vanRelatie[0].nummer}.` };
      }
      // Meerdere open facturen van dezelfde vereniging met dit bedrag: de oudste.
      const oudste = [...vanRelatie].sort((a, b) => a.nummer.localeCompare(b.nummer))[0];
      return { waarde: `factuur:${oudste.id}`, zekerheid: "bedrag", reden: `${oudste.relatieNaam} heeft meerdere open facturen van dit bedrag; de oudste (${oudste.nummer}) is voorgesteld.` };
    }
    if (genoemd.size === 0 && exact.length === 1) {
      return { waarde: `factuur:${exact[0].id}`, zekerheid: "bedrag", reden: `Alleen het bedrag past, bij factuur ${exact[0].nummer} van ${exact[0].relatieNaam}. Controleer of dit klopt.` };
    }
    return;
  }

  const naam = tekst(regel.tegenpartijNaam);
  const kandidaten = uitgaven.filter((u) => u.bedragCenten === -regel.bedragCenten &&
    (!u.betaald || (u.betaaldOp && zelfdeDag(u.betaaldOp, regel.datum))));
  const kosten = kandidaten.filter((u) =>
    (iban && normaliseerRekening(u.iban) === iban) ||
    (naam.length >= 4 && tekst(u.leverancierNaam).length >= 4 && naam === tekst(u.leverancierNaam)));
  if (kosten.length === 1) {
    return { waarde: `uitgave:${kosten[0].id}`, zekerheid: "zeker", reden: `Leverancier en bedrag komen overeen met één ${kosten[0].betaald ? "al betaalde " : ""}uitgave.` };
  }
  if (kosten.length > 1) return;
  const onbetaald = kandidaten.filter((u) => !u.betaald);
  if (onbetaald.length === 1) {
    return { waarde: `uitgave:${onbetaald[0].id}`, zekerheid: "bedrag", reden: `Alleen het bedrag past, bij de nog niet betaalde uitgave "${onbetaald[0].omschrijving}". Controleer of dit klopt.` };
  }
}

const RANG: Record<Zekerheid, number> = { zeker: 0, naam: 1, bedrag: 2 };

/**
 * Voorstellen voor een hele import. Elke factuur, betaling of uitgave wordt
 * maar één keer voorgesteld, en een zeker voorstel gaat voor een twijfelgeval.
 */
export function bankVoorstellen(
  regels: (Bankregel & { id: string })[],
  facturen: FactuurKeuze[],
  betalingen: BetalingKeuze[],
  uitgaven: UitgaveKeuze[],
) {
  const kandidaten = regels
    .map((regel, volgorde) => ({ regel, volgorde, voorstel: zoekBankVoorstel(regel, facturen, betalingen, uitgaven) }))
    .filter((k): k is typeof k & { voorstel: Voorstel } => k.voorstel !== undefined)
    .sort((a, b) => RANG[a.voorstel.zekerheid] - RANG[b.voorstel.zekerheid] || a.volgorde - b.volgorde);

  const gereserveerd = new Set<string>();
  const gekozen = new Map<string, Voorstel>();
  for (const { regel, voorstel } of kandidaten) {
    if (gereserveerd.has(voorstel.waarde)) continue;
    gekozen.set(regel.id, voorstel);
    gereserveerd.add(voorstel.waarde);
  }
  // Terug in de volgorde van het afschrift.
  return new Map(regels.filter((r) => gekozen.has(r.id)).map((r) => [r.id, gekozen.get(r.id)!]));
}
