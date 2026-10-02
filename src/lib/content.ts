import "server-only";

import { readFileSync, existsSync } from "node:fs";
import path from "node:path";

import { leesMarkdown, type Document } from "@/lib/markdown";
import { zonderPlaceholder } from "@/lib/placeholders";

// De teksten van de publieke pagina's staan in `content/`, zodat een opvolger
// ze kan aanpassen zonder de code in te duiken. Alles wordt tijdens de build
// gelezen: de publieke pagina's raken de database niet.

// Paden met een vaste map en alleen de bestandsnaam als variabele: anders
// denkt de bundelaar dat het hele project meegelezen moet worden.
const inhoudspad = (bestand: string) => path.join(process.cwd(), "content", bestand);
const afbeeldingspad = (bestand: string) => path.join(process.cwd(), "public/img", bestand);
const logopad = (bestand: string) => path.join(process.cwd(), "public/img/sv", bestand);
const evenementpad = (bestand: string) => path.join(process.cwd(), "public/img/events", bestand);

export interface Bestuurslid {
  naam: string;
  functie: string;
  /** Bestandsnaam in public/img. Ontbreekt het bestand, dan tonen we initialen. */
  foto?: string;
}

export interface Bestuur {
  nummer: number;
  startdatum: string;
  /** Aantal StOF-bestuursmaanden dat het bestuur samen krijgt. */
  stofMaanden?: number;
  leden: Bestuurslid[];
  /** Grote foto van het hele bestuur, in public/img. */
  samenFoto?: string;
  samenBijschrift?: string;
}

export interface Vereniging {
  naam: string;
  kort: string;
  slug: string;
  faculteit: string;
  /** Officiële website; leeg laten als die niet zeker is. */
  website?: string;
  /** Wordt tijdens de build gevuld als public/img/sv/<slug>.png bestaat. */
  logo?: string;
}

export interface Overleg {
  naam: string;
  wie: string;
  hoeVaak: string;
  waarover: string;
  voorzitter: string;
  /** Bijvoorbeeld "In pak" of "Niet in pak; het OWee-bestuur schuift aan". */
  extra?: string;
}

export interface Jaarmoment {
  wanneer: string;
  wat: string;
  uitleg: string;
  /** Alleen als de datum dit jaar vastligt, zoals bij het gala. */
  datum?: string;
}

export interface Evenement {
  naam: string;
  tekst: string;
  /** Alleen gevuld als de foto in public/img/events bestaat. */
  foto?: string;
}

export interface Traditie {
  titel: string;
  tekst: string;
}

export interface Mijlpaal {
  wanneer: string;
  wat: string;
}

export interface Samenwerking {
  partij: string;
  tekst: string;
}

export interface Vraag {
  vraag: string;
  antwoord: string;
  link?: { tekst: string; naar: string };
}

export interface Svr {
  naam: string;
  afkorting: string;
  stichting: string;
  kvk: string;
  opgericht: string;
  email: string;
  adres: string;
  plaats: string;
}

function leesJson<T>(naam: string): T {
  return JSON.parse(readFileSync(inhoudspad(naam), "utf8")) as T;
}

/**
 * Leest een tekst uit content/. Waarden tussen rechte haken, zoals
 * [STOF-MAANDEN], worden ingevuld; een "[IN TE VULLEN: …]" dat is blijven staan
 * verdwijnt in productie (zie src/lib/placeholders.ts).
 */
export function leesTekst(
  naam: string,
  waarden: Record<string, string | number> = {},
): Document {
  let ruw = readFileSync(inhoudspad(`${naam}.md`), "utf8");
  for (const [sleutel, waarde] of Object.entries(waarden)) {
    ruw = ruw.replaceAll(`[${sleutel}]`, String(waarde));
  }
  return leesMarkdown(zonderPlaceholder(ruw));
}

export const leesSvr = () => leesJson<Svr>("svr.json");

/** De vijftien, met hun logo als dat bestand er is. */
export const leesVerenigingen = (): Vereniging[] =>
  leesJson<Vereniging[]>("verenigingen.json").map((vereniging) => ({
    ...vereniging,
    logo: existsSync(logopad(`${vereniging.slug}.png`))
      ? `${vereniging.slug}.png`
      : undefined,
  }));

export const leesOverleggen = () => leesJson<Overleg[]>("overleggen.json");
export const leesTradities = () => leesJson<Traditie[]>("tradities.json");
export const leesGeschiedenis = () => leesJson<Mijlpaal[]>("geschiedenis.json");
export const leesSamenwerking = () => leesJson<Samenwerking[]>("samenwerking.json");
export const leesVragen = () => leesJson<Vraag[]>("vragen.json");

export const leesJaar = () => leesJson<{ momenten: Jaarmoment[] }>("jaar.json");

/** De evenementen; een foto verschijnt alleen als het bestand er is. */
export const leesEvenementen = (): Evenement[] =>
  leesJson<Evenement[]>("evenementen.json").map((evenement) => ({
    ...evenement,
    foto: evenement.foto && existsSync(evenementpad(evenement.foto)) ? evenement.foto : undefined,
  }));

export function leesBestuur(): Bestuur {
  const bestuur = leesJson<Bestuur>("bestuur.json");
  return {
    ...bestuur,
    leden: bestuur.leden.map((lid) => ({
      ...lid,
      // Tijdens de build bepalen of de foto er is; anders komen er initialen.
      foto: lid.foto && existsSync(afbeeldingspad(lid.foto)) ? lid.foto : undefined,
    })),
    samenFoto:
      bestuur.samenFoto && existsSync(afbeeldingspad(bestuur.samenFoto))
        ? bestuur.samenFoto
        : undefined,
  };
}

/** "Itai Givony" wordt "IG": de terugval als er geen foto is. */
export const initialen = (naam: string) =>
  naam
    .split(/\s+/)
    .filter((woord) => woord.length > 2 || /^[A-Z]/.test(woord))
    .map((woord) => woord[0]?.toUpperCase() ?? "")
    .join("")
    .slice(0, 2) || "SVR";

/** Het logo mag een SVG of een PNG zijn; zonder bestand tonen we het dasmotief. */
export function logoBestand(): string | undefined {
  for (const naam of ["logo.svg", "logo.png"]) {
    if (existsSync(afbeeldingspad(naam))) return naam;
  }
  return undefined;
}
