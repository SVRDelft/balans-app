// Een heel klein stukje Markdown, genoeg voor de teksten in `content/`.
//
// Bewust geen bibliotheek: de publieke pagina's moeten ook draaien op de
// webserver van de TU Delft, en een opvolger die een tekst aanpast hoeft alleen
// koppen (#), alinea's, opsommingen (-), **vet** en [links](https://...) te
// kennen. Alles wat daar niet in past komt er als gewone tekst doorheen.

export type Stuk =
  | { soort: "tekst"; tekst: string }
  | { soort: "sterk"; tekst: string }
  | { soort: "link"; tekst: string; naar: string };

export type Blok =
  | { soort: "alinea"; stukken: Stuk[] }
  | { soort: "lijst"; punten: Stuk[][] };

export interface Onderdeel {
  kop: string;
  blokken: Blok[];
}

export interface Sectie {
  kop: string;
  blokken: Blok[];
  onderdelen: Onderdeel[];
}

export interface Document {
  titel: string;
  blokken: Blok[];
  secties: Sectie[];
}

/** **vet** en [tekst](adres) binnen een regel. */
export function leesRegel(regel: string): Stuk[] {
  const stukken: Stuk[] = [];
  const patroon = /\*\*([^*]+)\*\*|\[([^\]]+)\]\(([^)\s]+)\)/g;
  let plek = 0;
  let treffer: RegExpExecArray | null;
  while ((treffer = patroon.exec(regel)) !== null) {
    if (treffer.index > plek) {
      stukken.push({ soort: "tekst", tekst: regel.slice(plek, treffer.index) });
    }
    if (treffer[1] !== undefined) {
      stukken.push({ soort: "sterk", tekst: treffer[1] });
    } else {
      stukken.push({ soort: "link", tekst: treffer[2], naar: treffer[3] });
    }
    plek = treffer.index + treffer[0].length;
  }
  if (plek < regel.length) {
    stukken.push({ soort: "tekst", tekst: regel.slice(plek) });
  }
  return stukken;
}

export function leesMarkdown(bron: string): Document {
  const document: Document = { titel: "", blokken: [], secties: [] };
  let sectie: Sectie | undefined;
  let onderdeel: Onderdeel | undefined;
  let alinea: string[] = [];
  let lijst: string[] = [];

  const doel = () => onderdeel ?? sectie ?? document;

  const sluitAlinea = () => {
    if (alinea.length > 0) {
      doel().blokken.push({ soort: "alinea", stukken: leesRegel(alinea.join(" ")) });
      alinea = [];
    }
  };
  const sluitLijst = () => {
    if (lijst.length > 0) {
      doel().blokken.push({ soort: "lijst", punten: lijst.map(leesRegel) });
      lijst = [];
    }
  };
  const sluit = () => {
    sluitAlinea();
    sluitLijst();
  };

  for (const ruwe of bron.replace(/\r\n/g, "\n").split("\n")) {
    const regel = ruwe.trimEnd();
    if (regel.trim() === "") {
      sluit();
      continue;
    }
    if (regel.startsWith("# ")) {
      sluit();
      document.titel = regel.slice(2).trim();
      sectie = undefined;
      onderdeel = undefined;
      continue;
    }
    if (regel.startsWith("## ")) {
      sluit();
      sectie = { kop: regel.slice(3).trim(), blokken: [], onderdelen: [] };
      onderdeel = undefined;
      document.secties.push(sectie);
      continue;
    }
    if (regel.startsWith("### ")) {
      sluit();
      onderdeel = { kop: regel.slice(4).trim(), blokken: [] };
      if (!sectie) {
        sectie = { kop: "", blokken: [], onderdelen: [] };
        document.secties.push(sectie);
      }
      sectie.onderdelen.push(onderdeel);
      continue;
    }
    if (/^[-*] /.test(regel)) {
      sluitAlinea();
      lijst.push(regel.slice(2).trim());
      continue;
    }
    // Een regel die binnen een opsomming doorloopt hoort bij het vorige punt.
    if (lijst.length > 0 && /^\s/.test(ruwe)) {
      lijst[lijst.length - 1] += ` ${regel.trim()}`;
      continue;
    }
    sluitLijst();
    alinea.push(regel.trim());
  }
  sluit();
  return document;
}
