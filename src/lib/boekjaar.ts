import "server-only";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { db } from "@/lib/db";
import { BOEKJAAR_COOKIE } from "@/lib/auth/sessie";
import { vereisBestuur } from "@/lib/auth/server";
import type { Boekjaar } from "@/lib/types";

export interface BoekjaarContext {
  /** Het boekjaar waar de gebruiker nu naar kijkt. */
  boekjaar: Boekjaar;
  /** Het boekjaar waarin het dagelijkse werk geboekt wordt. */
  actiefBoekjaar: Boekjaar | null;
  /**
   * Of er in het getoonde boekjaar geschreven mag worden: het actieve jaar, of
   * een oud jaar dat in reconstructie staat.
   */
  schrijfbaar: boolean;
  alleBoekjaren: Boekjaar[];
}

export async function haalBoekjaren(): Promise<Boekjaar[]> {
  return db.boekjaar.findMany({ orderBy: { startDatum: "desc" } });
}

/**
 * Het bekeken boekjaar volgt uit een cookie; zonder cookie is dat het actieve
 * boekjaar. Oudere jaren zijn wel te bekijken maar niet te wijzigen.
 * Geeft null als er nog helemaal geen boekjaar bestaat.
 */
export async function haalBoekjaarContext(): Promise<BoekjaarContext | null> {
  const alleBoekjaren = await haalBoekjaren();
  if (alleBoekjaren.length === 0) return null;

  const actiefBoekjaar = alleBoekjaren.find((jaar) => jaar.actief) ?? null;

  const koekjes = await cookies();
  const gekozenId = koekjes.get(BOEKJAAR_COOKIE)?.value;
  const gekozen = gekozenId
    ? alleBoekjaren.find((jaar) => jaar.id === gekozenId)
    : undefined;

  const boekjaar = gekozen ?? actiefBoekjaar ?? alleBoekjaren[0];

  return {
    boekjaar,
    actiefBoekjaar,
    schrijfbaar: isSchrijfbaar(boekjaar, actiefBoekjaar),
    alleBoekjaren,
  };
}

/**
 * In het actieve boekjaar mag altijd geboekt worden. In een oud jaar alleen als
 * het bewust in reconstructie staat, om het bij de eerste ingebruikname op te
 * bouwen uit oude bankafschriften.
 */
export function isSchrijfbaar(
  boekjaar: Boekjaar,
  actiefBoekjaar: Boekjaar | null,
): boolean {
  if (boekjaar.reconstructie) return true;
  return actiefBoekjaar !== null && boekjaar.id === actiefBoekjaar.id;
}

/**
 * Het boekjaar waarin een datum valt. Bepaalt waar een betaling thuishoort die
 * nu binnenkomt op een factuur van een vorig jaar.
 */
export function boekjaarVoorDatum(
  boekjaren: readonly Boekjaar[],
  datum: Date,
): Boekjaar | undefined {
  return boekjaren.find(
    (jaar) => datum >= jaar.startDatum && datum <= jaar.eindDatum,
  );
}

/**
 * Elke pagina en actie van de administratie begint hier. De rolcontrole staat
 * er met opzet in: zo kan er geen scherm bestaan dat de boekjaarcontext wel
 * ophaalt maar vergeet te controleren wie er kijkt.
 */
export async function vereisBoekjaarContext(): Promise<BoekjaarContext> {
  await vereisBestuur();
  const context = await haalBoekjaarContext();
  if (!context) {
    redirect("/beheer/boekjaren");
  }
  return context;
}

/**
 * Voor elke mutatie: er mag alleen geboekt worden in het actieve boekjaar, of in
 * een oud jaar dat in reconstructie staat. Gooit een fout die de aanroepende
 * action als melding kan tonen.
 */
export async function vereisSchrijfbaarBoekjaar(terugNaar?: string): Promise<Boekjaar> {
  const context = await vereisBoekjaarContext();
  if (!context.schrijfbaar) {
    if (terugNaar) redirect(terugNaar);
    throw new Error(
      `Boekjaar ${context.boekjaar.naam} is afgesloten en kan niet meer gewijzigd worden. Schakel over naar het actieve boekjaar, of zet dit jaar bij Boekjaren in reconstructie om het alsnog op te bouwen.`,
    );
  }
  return context.boekjaar;
}
