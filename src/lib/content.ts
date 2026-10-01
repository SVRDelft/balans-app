import "server-only";

import { readFileSync, existsSync } from "node:fs";
import path from "node:path";

import { leesMarkdown, type Document } from "@/lib/markdown";

// De teksten van de publieke pagina's staan in `content/`, zodat een opvolger
// ze kan aanpassen zonder de code in te duiken. Alles wordt tijdens de build
// gelezen: de publieke pagina's raken de database niet.

// Paden met een vaste map en alleen de bestandsnaam als variabele: anders
// denkt de bundelaar dat het hele project meegelezen moet worden.
const inhoudspad = (bestand: string) => path.join(process.cwd(), "content", bestand);
const afbeeldingspad = (bestand: string) => path.join(process.cwd(), "public/img", bestand);

export interface Bestuurslid {
  naam: string;
  functie: string;
  /** Bestandsnaam in public/img. Ontbreekt het bestand, dan tonen we initialen. */
  foto?: string;
}

export interface Bestuur {
  nummer: number;
  startdatum: string;
  leden: Bestuurslid[];
  /** Grote foto van het hele bestuur, in public/img. */
  samenFoto?: string;
  samenBijschrift?: string;
}

export interface Vereniging {
  naam: string;
  kort: string;
  faculteit: string;
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

export const leesTekst = (naam: string): Document =>
  leesMarkdown(readFileSync(inhoudspad(`${naam}.md`), "utf8"));

export const leesSvr = () => leesJson<Svr>("svr.json");
export const leesVerenigingen = () => leesJson<Vereniging[]>("verenigingen.json");

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
