import "server-only";

import { leesVerenigingen, type Vereniging } from "@/lib/content";

// Eén naam en één volgorde voor de verenigingen, overal in de app.
//
// De bron is content/verenigingen.json. Een relatie in de administratie heet
// soms anders ("CH", "VSV", "i.d"); die koppelen we hier aan de vereniging op
// korte, gewone of officiële naam. Er wordt niets in de database veranderd:
// facturen blijven op de naam staan waarop ze zijn verstuurd.
//
// Volgorde: de vijftien op oprichtingsjaar (Leeghwater bovenaan), dan de
// overige relaties op alfabet, dan de informanten (ORAS, Lijst Bèta), en
// personen helemaal onderaan.

const vergelijkbaar = (tekst: string) =>
  tekst
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");

/** De informanten. Ze krijgen facturen, maar zijn geen studievereniging. */
const INFORMANTEN = ["oras", "lijstbeta", "beta"];

let index: Map<string, Vereniging> | undefined;
function verenigingIndex() {
  if (!index) {
    index = new Map();
    for (const vereniging of leesVerenigingen()) {
      for (const naam of [vereniging.naam, vereniging.kort, vereniging.officieel, vereniging.slug]) {
        if (naam) index.set(vergelijkbaar(naam), vereniging);
      }
    }
  }
  return index;
}

/** De vereniging uit content/ die bij deze relatienaam hoort, als die er is. */
export const verenigingVan = (naam: string): Vereniging | undefined =>
  verenigingIndex().get(vergelijkbaar(naam));

export const isInformant = (naam: string) => INFORMANTEN.includes(vergelijkbaar(naam));

/** "oras" of "lijstbeta" (ook voor "Bèta"), zodat twee spellingen dezelfde zijn. */
export function informantSleutel(naam: string): string | undefined {
  const sleutel = vergelijkbaar(naam);
  if (sleutel === "oras") return "oras";
  if (sleutel === "lijstbeta" || sleutel === "beta") return "lijstbeta";
  return undefined;
}

/** Hoe een relatie in lijsten heet: bij een vereniging de naam uit content/. */
export const toonNaam = (relatie: { naam: string }) =>
  verenigingVan(relatie.naam)?.naam ?? relatie.naam;

function rang(relatie: { naam: string; type?: string }) {
  if (verenigingVan(relatie.naam)) return 0;
  if (relatie.type === "persoon") return 3;
  if (isInformant(relatie.naam)) return 2;
  return 1;
}

/**
 * Zet relaties in de vaste volgorde en geeft ze hun weergavenaam mee. Werkt op
 * elke lijst met een `naam` (en liefst een `type`).
 */
export function ordenRelaties<T extends { naam: string; type?: string }>(
  relaties: T[],
): (T & { toonNaam: string })[] {
  return relaties
    .map((relatie) => ({ ...relatie, toonNaam: toonNaam(relatie) }))
    .sort((a, b) => {
      const verschil = rang(a) - rang(b);
      if (verschil) return verschil;
      const va = verenigingVan(a.naam);
      const vb = verenigingVan(b.naam);
      if (va && vb) {
        return (va.opgericht ?? 9999) - (vb.opgericht ?? 9999) || va.naam.localeCompare(vb.naam, "nl");
      }
      if (rang(a) === 2) {
        return INFORMANTEN.indexOf(vergelijkbaar(a.naam)) - INFORMANTEN.indexOf(vergelijkbaar(b.naam));
      }
      return a.toonNaam.localeCompare(b.toonNaam, "nl");
    });
}

/** Alleen wat je als vereniging kunt kiezen: geen personen. */
export const zonderPersonen = <T extends { type?: string }>(relaties: T[]) =>
  relaties.filter((relatie) => relatie.type !== "persoon");
