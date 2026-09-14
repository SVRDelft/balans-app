import "server-only";

import { cookies } from "next/headers";

import { db } from "@/lib/db";
import { BOEKJAAR_COOKIE } from "@/lib/auth/sessie";
import type { Boekjaar } from "@/lib/types";

export interface BoekjaarContext {
  /** Het boekjaar waar de gebruiker nu naar kijkt. */
  boekjaar: Boekjaar;
  /** Het enige boekjaar waarin geschreven mag worden. */
  actiefBoekjaar: Boekjaar | null;
  /** Of het getoonde boekjaar ook het actieve is. */
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
    schrijfbaar: actiefBoekjaar !== null && boekjaar.id === actiefBoekjaar.id,
    alleBoekjaren,
  };
}

export async function vereisBoekjaarContext(): Promise<BoekjaarContext> {
  const context = await haalBoekjaarContext();
  if (!context) {
    throw new Error(
      "Er is nog geen boekjaar. Draai `npm run db:seed` of maak er een aan bij Beheer › Boekjaren.",
    );
  }
  return context;
}

/**
 * Voor elke mutatie: er mag alleen in het actieve boekjaar geschreven worden.
 * Gooit een fout die de aanroepende action als melding kan tonen.
 */
export async function vereisSchrijfbaarBoekjaar(): Promise<Boekjaar> {
  const context = await vereisBoekjaarContext();
  if (!context.schrijfbaar) {
    throw new Error(
      `Boekjaar ${context.boekjaar.naam} is afgesloten en kan niet meer gewijzigd worden. Schakel eerst over naar het actieve boekjaar.`,
    );
  }
  return context.boekjaar;
}
