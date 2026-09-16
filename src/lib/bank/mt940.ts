/**
 * Pure MT940 reader for complete EUR statements from one account.
 * Sources: ABN AMRO sepa-formaatverschillen-mt940-mt942.pdf (sections 2.1–2.3),
 * Rabobank MT940 Structured 1.5.3 and ING Mijn ING Zakelijk MT940 (2014).
 * No records are returned unless the entire file and every balance reconcile.
 */
export const MT940_MAX_BYTES = 2 * 1024 * 1024;
export const MT940_MAX_TRANSACTIES = 10_000;
const MAX_CENTEN = 2_147_483_647;

export class Mt940Fout extends Error {
  constructor(message: string) {
    super(message);
    this.name = "Mt940Fout";
  }
}

export interface Mt940Transactie {
  boekdatum: string;
  valutadatum: string;
  bedragCenten: number;
  debetCredit: "C" | "D" | "RC" | "RD";
  omschrijving: string;
  tegenpartijNaam: string | null;
  tegenpartijIban: string | null;
  bankReferentie: string | null;
  klantReferentie: string | null;
  transactieCode: string;
  afschriftNummer: string;
  afschriftVolgnummer: number | null;
  /** One-based position within this statement/page; identical payments stay separate. */
  volgnummer: number;
  ruweInformatie: string;
}

export interface Mt940Afschrift {
  referentie: string;
  nummer: string;
  volgnummer: number | null;
  beginDatum: string;
  eindDatum: string;
  beginSaldoCenten: number;
  eindSaldoCenten: number;
  beginType: "F" | "M";
  eindType: "F" | "M";
  transacties: Mt940Transactie[];
}

export interface Mt940Bestand {
  /** Canonical account identifier: uppercase, no spaces/dots/currency suffix. */
  rekening: string;
  valuta: "EUR";
  afschriften: Mt940Afschrift[];
  transacties: Mt940Transactie[];
}

type Veld = { tag: string; inhoud: string };
const fout = (melding: string): never => { throw new Mt940Fout(melding); };
const tekst = (waarde: string) => waarde.replace(/\s+/g, " ").trim();
const referentie = (waarde: string) => {
  const schoon = tekst(waarde);
  return !schoon || /^(NONREF|NOTPROVIDED)$/i.test(schoon) ? null : schoon;
};

function datum(jaar: number, maand: number, dag: number): string | null {
  const waarde = new Date(Date.UTC(jaar, maand - 1, dag));
  if (waarde.getUTCFullYear() !== jaar || waarde.getUTCMonth() !== maand - 1 || waarde.getUTCDate() !== dag) return null;
  return waarde.toISOString().slice(0, 10);
}

function volledigeDatum(waarde: string): string {
  // A fixed pivot makes replaying the same file deterministic (1970–2069).
  const yy = Number(waarde.slice(0, 2));
  return datum(yy >= 70 ? 1900 + yy : 2000 + yy, Number(waarde.slice(2, 4)), Number(waarde.slice(4, 6)))
    ?? fout("Het MT940-bestand bevat een ongeldige datum.");
}

function boekdatum(waarde: string | undefined, valutadatum: string): string {
  if (!waarde?.trim()) return valutadatum;
  const jaar = Number(valutadatum.slice(0, 4));
  const opties = [jaar - 1, jaar, jaar + 1]
    .map(j => datum(j, Number(waarde.slice(0, 2)), Number(waarde.slice(2))))
    .filter((d): d is string => d !== null)
    .map(d => ({ datum: d, afstand: Math.abs(Date.parse(d) - Date.parse(valutadatum)) }))
    .sort((a, b) => a.afstand - b.afstand);
  if (!opties.length || opties[0].afstand > 183 * 86_400_000 || opties[0].afstand === opties[1]?.afstand) {
    return fout("De boekdatum in het MT940-bestand is ongeldig of niet eenduidig.");
  }
  return opties[0].datum;
}

function centen(waarde: string): number {
  // ABN leaves trailing decimal zeroes out: 7,5 = 7.50 and 150, = 150.00.
  if (!/^\d{1,14},\d{0,2}$/.test(waarde) || waarde.length > 15) {
    return fout("Het MT940-bestand bevat een ongeldig eurobedrag.");
  }
  const [heel, fractie] = waarde.split(",");
  const bedrag = Number(heel) * 100 + Number(fractie.padEnd(2, "0"));
  if (!Number.isSafeInteger(bedrag) || bedrag > MAX_CENTEN) return fout("Een bedrag in het MT940-bestand is te groot.");
  return bedrag;
}

function saldo(veld: Veld) {
  const match = /^([CD])(\d{6})([A-Z]{3})(\d+,\d*)$/.exec(veld.inhoud.trim());
  if (!match) return fout(`Het saldo in veld ${veld.tag} ontbreekt of is ongeldig.`);
  if (match[3] !== "EUR") return fout("Alleen MT940-bestanden in euro's (EUR) worden ondersteund.");
  const bedrag = centen(match[4]);
  return { datum: volledigeDatum(match[2]), centen: bedrag === 0 ? 0 : match[1] === "D" ? -bedrag : bedrag };
}

function rekeningnummer(waarde: string): string {
  let rekening = waarde.trim().toUpperCase();
  const valuta = /(?:\s|\/)([A-Z]{3})$/.exec(rekening);
  if (valuta) {
    if (valuta[1] !== "EUR") return fout("Alleen MT940-bestanden in euro's (EUR) worden ondersteund.");
    rekening = rekening.slice(0, valuta.index);
  }
  rekening = rekening.replace(/[ .]/g, "");
  // ING also appends EUR without a separator. NL IBANs have a fixed length.
  if (/^NL\d{2}[A-Z]{4}\d{10}[A-Z]{3}$/.test(rekening)) {
    if (!rekening.endsWith("EUR")) return fout("Alleen MT940-bestanden in euro's (EUR) worden ondersteund.");
    rekening = rekening.slice(0, -3);
  }
  if (!/^(?:[A-Z]{2}\d{2}[A-Z0-9]{11,30}|\d{6,18})$/.test(rekening)) {
    return fout("Het rekeningnummer in veld 25 ontbreekt of wordt niet herkend.");
  }
  if (rekening.startsWith("NL") && !/^NL\d{2}[A-Z]{4}\d{10}$/.test(rekening)) return fout("Het Nederlandse IBAN in veld 25 is ongeldig.");
  return rekening;
}

/** Strip only recognized envelopes, never arbitrary text before/after a statement. */
function berichten(invoer: string): string[] {
  const inhoud = invoer.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n").trim();
  if (!inhoud.startsWith("{")) return [inhoud];
  const resultaat: string[] = [];
  let positie = 0;
  const spaties = () => { while (/\s/.test(inhoud[positie] ?? "") && positie < inhoud.length) positie++; };
  const blok = (nummer: string) => {
    spaties();
    if (!inhoud.startsWith(`{${nummer}:`, positie)) return fout("De SWIFT-envelop van het MT940-bestand is onvolledig.");
    const start = positie;
    let diepte = 0;
    do {
      if (inhoud[positie] === "{") diepte++;
      if (inhoud[positie] === "}") diepte--;
      positie++;
      if (positie > inhoud.length || diepte > 10) return fout("De SWIFT-envelop van het MT940-bestand is ongeldig.");
    } while (diepte > 0);
    return inhoud.slice(start, positie);
  };
  while (positie < inhoud.length) {
    blok("1");
    if (!/^\{2:[IO]940/.test(blok("2"))) return fout("Dit bestand is geen MT940-rekeningafschrift.");
    spaties();
    if (inhoud.startsWith("{3:", positie)) blok("3");
    spaties();
    if (!inhoud.startsWith("{4:", positie)) return fout("De inhoud van het MT940-bericht ontbreekt.");
    positie += 3;
    const eind = inhoud.indexOf("\n-}", positie);
    if (eind < 0) return fout("Het MT940-bestand is afgebroken: de SWIFT-afsluiting ontbreekt.");
    resultaat.push(inhoud.slice(positie, eind));
    positie = eind + 3;
    spaties();
    if (inhoud.startsWith("{5:", positie)) blok("5");
    spaties();
    if (inhoud[positie] === "$") { positie++; spaties(); }
  }
  return resultaat;
}

function velden(bericht: string): Veld[] {
  const regels = bericht.trim().split("\n");
  // Legacy ABN OfficeNet envelope: sender BIC, 940, receiver BIC.
  if (/^[A-Z]{6}[A-Z0-9]{2}(?:[A-Z0-9]{3,4})?$/.test(regels[0]?.trim()) && regels[1]?.trim() === "940") {
    if (!/^[A-Z]{6}[A-Z0-9]{2}(?:[A-Z0-9]{3,4})?$/.test(regels[2]?.trim())) return fout("De ABN AMRO-bestandskop is onvolledig.");
    regels.splice(0, 3);
  } else if (regels[0]?.trim() === "940") regels.shift();
  const resultaat: Veld[] = [];
  for (const regel of regels) {
    if (!regel.trim()) continue;
    if (regel.trim() === "-" || regel.trim() === "-}") {
      resultaat.push({ tag: "einde", inhoud: "" });
      continue;
    }
    const match = /^:(\d{2,3}[A-Z]?):(.*)$/.exec(regel);
    if (match) {
      resultaat.push({ tag: match[1], inhoud: match[2] });
    } else {
      const vorig = resultaat.at(-1);
      if (!vorig || !["61", "86"].includes(vorig.tag) || /^:\d/.test(regel)) return fout("Het MT940-bestand bevat een ongeldige regel of onbekende bestandskop.");
      vorig.inhoud += `\n${regel}`;
    }
    if ((resultaat.at(-1)?.inhoud.length ?? 0) > 4096) return fout("Een omschrijving in het MT940-bestand is te lang.");
  }
  return resultaat;
}

// Keep wrapped structured code words intact. Preserve spaces inside names and references.
function informatie(ruw: string, aanvullend: string) {
  const compact = ruw.replace(/\n/g, "");
  const codes = new Map<string, string>();
  const patroon = /\/(TRTP|IBAN|BIC|NAME|REMI|EREF|PREF|MARF|MREF|CSID|CNTP|ORDP|BENM|ULTD|ULTB|ULTC|RTRN|PURP|ID|ADDR|ISDT|NRTX|SWOD)\//g;
  const gevonden = [...compact.matchAll(patroon)];
  for (let i = 0; i < gevonden.length; i++) {
    const match = gevonden[i];
    const waarde = compact.slice(match.index! + match[0].length, gevonden[i + 1]?.index ?? compact.length).replace(/^\/+|\/+$/g, "");
    if (!codes.has(match[1])) codes.set(match[1], waarde);
  }
  const cntp = codes.get("CNTP")?.split("/");
  let iban = codes.get("IBAN") ?? cntp?.[0] ?? null;
  if (!iban) iban = /\b([A-Z]{2}\d{2}[A-Z0-9]{11,30})\b/.exec(aanvullend)?.[1] ?? null;
  if (iban) {
    iban = iban.replace(/\s/g, "").toUpperCase();
    if (!/^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/.test(iban)) iban = null;
  }
  const naam = codes.get("NAME") ?? cntp?.[2] ?? null;
  let omschrijving = codes.get("REMI")?.replace(/^(?:USTD\/\/|STRD\/(?:CUR|ISO)\/)/, "");
  if (!omschrijving) omschrijving = codes.size ? [codes.get("TRTP"), codes.get("EREF"), naam].filter(Boolean).join(" · ") : ruw.replace(/\n/g, " ");
  return {
    omschrijving: tekst(omschrijving || aanvullend || "Banktransactie"),
    tegenpartijNaam: naam ? tekst(naam) : null,
    tegenpartijIban: iban,
    langeReferentie: referentie(codes.get("EREF") ?? ""),
  };
}

function transactie(veld: Veld, details: string, afschrift: Pick<Mt940Afschrift, "nummer" | "volgnummer">, positie: number): Mt940Transactie {
  const [eersteRegel, ...overige] = veld.inhoud.split("\n");
  const match = /^(\d{6})(\d{4}| {4})?(RC|RD|C|D)([A-Z])?(\d+,\d*)([NSF][A-Z0-9]{3})(.*)$/.exec(eersteRegel.trim());
  if (!match) return fout(`Transactie ${positie} van afschrift ${afschrift.nummer} is ongeldig of onvolledig.`);
  if (match[4] && match[4] !== "R") return fout("Een transactie bevat een onbekende valuta-aanduiding.");
  // "NONREF" is de vaste markering voor "geen referentie". Staat die direct na
  // het bedrag, dan ontbreekt het transactietype en leest de regex hierboven
  // NONR als code, met EF als referentie. Dat levert stilzwijgend een verzonnen
  // code en een onbruikbare referentie op, en juist daarop wordt gekoppeld.
  if (`${match[6]}${match[7]}`.startsWith("NONREF")) {
    return fout(
      `Transactie ${positie} van afschrift ${afschrift.nummer} mist het transactietype.`,
    );
  }
  const refs = match[7].split("//");
  if (refs.length > 2 || refs.some(r => r.length > 34)) return fout("Een transactiereferentie in het MT940-bestand is ongeldig.");
  const valutadatum = volledigeDatum(match[1]);
  const bedrag = centen(match[5]);
  const debetCredit = match[3] as Mt940Transactie["debetCredit"];
  const aanvullend = overige.join("\n");
  const info = informatie(details, aanvullend);
  return {
    boekdatum: boekdatum(match[2], valutadatum), valutadatum,
    bedragCenten: bedrag === 0 ? 0 : ["D", "RC"].includes(debetCredit) ? -bedrag : bedrag,
    debetCredit,
    omschrijving: info.omschrijving,
    tegenpartijNaam: info.tegenpartijNaam, tegenpartijIban: info.tegenpartijIban,
    bankReferentie: referentie(refs[1] ?? ""),
    klantReferentie: info.langeReferentie ?? referentie(refs[0]),
    transactieCode: match[6], afschriftNummer: afschrift.nummer,
    afschriftVolgnummer: afschrift.volgnummer, volgnummer: positie,
    ruweInformatie: [aanvullend, details].filter(Boolean).join("\n"),
  };
}

/**
 * Dates are ISO calendar dates. Amounts are signed integer eurocents.
 * Stable references and statement/page/line positions are preserved for matching;
 * bankReferentie is NOT unique (ABN can put a shared transaction code there).
 * Throws Mt940Fout with a Dutch, displayable message; never returns partial data.
 */
export function parseerMt940(invoer: string): Mt940Bestand {
  if (typeof invoer !== "string" || !invoer.trim()) return fout("Het MT940-bestand is leeg.");
  if (invoer.length > MT940_MAX_BYTES || new TextEncoder().encode(invoer).length > MT940_MAX_BYTES) return fout("Het MT940-bestand is te groot. Kies een bestand van maximaal 2 MB.");
  if (/[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFD]/.test(invoer)) return fout("Het bestand bevat onleesbare tekens. Download het opnieuw als MT940.");
  const afschriften: Mt940Afschrift[] = [];
  let rekening: string | undefined;
  let totaalTransacties = 0;
  for (const bericht of berichten(invoer)) {
    const lijst = velden(bericht);
    let i = 0;
    while (i < lijst.length) {
      if (lijst[i].tag === "940") {
        if (lijst[i].inhoud.trim()) return fout("De MT940-bestandskop is ongeldig.");
        i++;
      }
      const neem = (...tags: string[]) => {
        const veld = lijst[i++];
        if (!veld || !tags.includes(veld.tag)) return fout(`Het MT940-bestand is onvolledig of heeft een ongeldige volgorde: veld ${tags.join("/")} verwacht.`);
        return veld;
      };
      const ref = neem("20").inhoud.trim();
      if (!ref || ref.length > 35) return fout("De afschriftreferentie in veld 20 is ongeldig.");
      if (lijst[i]?.tag === "21") neem("21");
      const account = rekeningnummer(neem("25").inhoud);
      if (rekening && account !== rekening) return fout("Het bestand bevat meerdere bankrekeningen. Download één rekening per bestand.");
      rekening = account;
      const nummer = /^(\d{1,5})(?:\/(\d{1,5}))?$/.exec(neem("28", "28C").inhoud.trim());
      if (!nummer || (nummer[2] && Number(nummer[2]) < 1)) return fout("Het afschrift- of paginanummer in veld 28 is ongeldig.");
      const begin = neem("60F", "60M");
      const beginSaldo = saldo(begin);
      const basis = { nummer: nummer[1], volgnummer: nummer[2] ? Number(nummer[2]) : null };
      const transacties: Mt940Transactie[] = [];
      while (lijst[i]?.tag === "61") {
        const regel = neem("61");
        const details: string[] = [];
        while (lijst[i]?.tag === "86") details.push(neem("86").inhoud);
        if (++totaalTransacties > MT940_MAX_TRANSACTIES) return fout("Het bestand bevat te veel transacties. Download maximaal 10.000 transacties per bestand.");
        if (details.join("\n").length > 4096) return fout("Een transactieomschrijving is te lang.");
        transacties.push(transactie(regel, details.join("\n"), basis, transacties.length + 1));
      }
      const eind = neem("62F", "62M");
      const eindSaldo = saldo(eind);
      if (eindSaldo.datum < beginSaldo.datum) return fout("De einddatum van een afschrift ligt vóór de begindatum.");
      const verwacht = transacties.reduce((som, t) => som + t.bedragCenten, beginSaldo.centen);
      if (!Number.isSafeInteger(verwacht) || verwacht !== eindSaldo.centen) return fout(`Afschrift ${basis.nummer} sluit niet aan: beginsaldo plus transacties is niet gelijk aan het eindsaldo. Download het volledige afschrift opnieuw.`);
      if (lijst[i]?.tag === "64") saldo(neem("64"));
      while (lijst[i]?.tag === "65") saldo(neem("65"));
      // A final :86: describes the whole statement, not the last transaction.
      if (lijst[i]?.tag === "86") neem("86");
      if (lijst[i]?.tag === "einde") neem("einde");
      afschriften.push({ ...basis, referentie: ref, beginDatum: beginSaldo.datum, eindDatum: eindSaldo.datum,
        beginSaldoCenten: beginSaldo.centen, eindSaldoCenten: eindSaldo.centen,
        beginType: begin.tag === "60F" ? "F" : "M", eindType: eind.tag === "62F" ? "F" : "M", transacties });
      if (afschriften.length > 2000) return fout("Het bestand bevat te veel afschriften. Kies een kortere periode.");
    }
  }
  if (!rekening || !afschriften.length) return fout("Het bestand bevat geen volledig MT940-rekeningafschrift.");
  if (afschriften[0].beginType !== "F" || afschriften.at(-1)!.eindType !== "F") return fout("Het bestand bevat slechts een deel van een afschrift. Download alle pagina's.");
  for (let i = 1; i < afschriften.length; i++) {
    const vorig = afschriften[i - 1];
    const huidig = afschriften[i];
    if (vorig.eindSaldoCenten !== huidig.beginSaldoCenten || vorig.eindDatum > huidig.beginDatum) return fout("De afschriften sluiten niet op elkaar aan of staan niet op datumvolgorde.");
    if (vorig.eindType === "M") {
      if (huidig.beginType !== "M" || vorig.nummer !== huidig.nummer || vorig.volgnummer === null || huidig.volgnummer !== vorig.volgnummer + 1 || vorig.eindDatum !== huidig.beginDatum) return fout("Er ontbreekt een pagina van het afschrift of de pagina's staan niet op volgorde.");
    } else if (huidig.beginType !== "F") return fout("Een vervolgpagina staat zonder bijbehorende beginpagina in het bestand.");
  }
  for (const a of afschriften) {
    if (a.beginType === "F" && a.volgnummer !== null && a.volgnummer !== 1) return fout("De eerste pagina van een afschrift ontbreekt.");
  }
  return { rekening, valuta: "EUR", afschriften, transacties: afschriften.flatMap(a => a.transacties) };
}
