import "server-only";

import { db } from "@/lib/db";
import { leesVerenigingen } from "@/lib/content";
import { controleerHash, hashWachtwoord } from "@/lib/auth/wachtwoord";

// Inloggen "als vereniging": kies wie je bent uit een lijst en vul het
// wachtwoord in dat je hele bestuur deelt.
//
// De lijst heeft twee groepen. De studieverenigingen komen uit
// content/verenigingen.json, zodat er één plek is waar de vijftien staan. De
// informanten (ORAS, Lijst Bèta, …) beheert het bestuur zelf in de app.
//
// Wat zo'n sessie mag, staat in src/lib/auth/server.ts: alleen het portaal.

/** Tien keer mis, dan een minuut wachten. Meer is niet afgesproken. */
export const GROEP_BLOKKADE_MS = 60 * 1000;

export type ToegangGroep = "studievereniging" | "informant";

export interface ToegangKeuze {
  sleutel: string;
  naam: string;
  groep: ToegangGroep;
}

export const pogingSleutel = (sleutel: string) => `portaal:${sleutel}`;

/** Een sleutel van een informant: kleine letters en streepjes. */
export function maakSleutel(naam: string): string {
  return naam
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

/** Wat er in het keuzemenu staat, in twee groepen. */
export async function haalToegangKeuzes(): Promise<{
  studieverenigingen: ToegangKeuze[];
  informanten: ToegangKeuze[];
}> {
  const informanten = await db.portaaltoegang.findMany({
    where: { groep: "informant" },
    orderBy: [{ volgorde: "asc" }, { naam: "asc" }],
    select: { sleutel: true, naam: true },
  });
  return {
    studieverenigingen: leesVerenigingen().map((vereniging) => ({
      sleutel: vereniging.slug,
      naam: vereniging.naam,
      groep: "studievereniging" as const,
    })),
    informanten: informanten.map((informant) => ({
      ...informant,
      groep: "informant" as const,
    })),
  };
}

/** Bestaat deze keuze? Het keuzemenu is te vervalsen, deze controle niet. */
export async function zoekKeuze(sleutel: string): Promise<ToegangKeuze | undefined> {
  const { studieverenigingen, informanten } = await haalToegangKeuzes();
  return [...studieverenigingen, ...informanten].find(
    (keuze) => keuze.sleutel === sleutel,
  );
}

export type GroepInloguitkomst =
  | { soort: "ok"; toegang: { id: string; naam: string } }
  | { soort: "onbekend" }
  | { soort: "geenWachtwoord"; naam: string }
  | { soort: "uit"; naam: string }
  | { soort: "fout" };

/**
 * Controleert de keuze en het wachtwoord. Anders dan bij de persoonlijke
 * accounts mag hier wel gezegd worden dat er nog geen wachtwoord is, of dat de
 * toegang uit staat: de lijst met namen is toch al openbaar.
 */
export async function controleerGroepInlog(
  sleutel: string,
  wachtwoord: string,
): Promise<GroepInloguitkomst> {
  const keuze = await zoekKeuze(sleutel);
  if (!keuze) return { soort: "onbekend" };

  const toegang = await db.portaaltoegang.findUnique({ where: { sleutel } });
  if (!toegang?.wachtwoordHash) return { soort: "geenWachtwoord", naam: keuze.naam };
  if (!toegang.actief) return { soort: "uit", naam: keuze.naam };
  if (!(await controleerHash(wachtwoord, toegang.wachtwoordHash))) {
    return { soort: "fout" };
  }

  await db.portaaltoegang.update({
    where: { id: toegang.id },
    data: { laatsteInlog: new Date() },
  });
  return { soort: "ok", toegang: { id: toegang.id, naam: keuze.naam } };
}

/**
 * Zet een nieuw wachtwoord, door het bestuur of door de vereniging zelf. Bestaat
 * er voor een studievereniging nog geen rij, dan komt die er nu. Elke sessie die
 * vóór dit moment is uitgegeven, vervalt: daarom hoort wie zelf wijzigt daarna
 * een nieuw cookie te krijgen.
 */
export async function zetGroepWachtwoord(
  keuze: ToegangKeuze,
  wachtwoord: string,
): Promise<{ id: string; naam: string; gewijzigdOp: Date }> {
  const wachtwoordHash = await hashWachtwoord(wachtwoord);
  const gewijzigdOp = new Date();
  const toegang = await db.portaaltoegang.upsert({
    where: { sleutel: keuze.sleutel },
    create: {
      sleutel: keuze.sleutel,
      groep: keuze.groep,
      naam: keuze.naam,
      wachtwoordHash,
      wachtwoordGewijzigdOp: gewijzigdOp,
    },
    update: {
      naam: keuze.naam,
      wachtwoordHash,
      wachtwoordGewijzigdOp: gewijzigdOp,
    },
  });
  return { id: toegang.id, naam: toegang.naam, gewijzigdOp };
}

/** Zet de toegang aan of uit. Uit geldt meteen, ook voor wie al ingelogd is. */
export async function zetGroepActief(keuze: ToegangKeuze, actief: boolean) {
  return db.portaaltoegang.upsert({
    where: { sleutel: keuze.sleutel },
    create: {
      sleutel: keuze.sleutel,
      groep: keuze.groep,
      naam: keuze.naam,
      actief,
    },
    update: { actief, naam: keuze.naam },
  });
}
