import "server-only";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { db } from "@/lib/db";

import { SESSIE_COOKIE, leesSessieCookie, type Rol, type Sessie } from "./sessie";

// Eén plek waar toegang wordt bepaald. Proxy.ts houdt alleen de deur dicht voor
// wie niet is ingelogd; wélke rol ergens bij mag, wordt hier gecontroleerd, in
// elke pagina, server action en API-route. Een server action is namelijk ook
// rechtstreeks met een POST te bereiken, buiten de interface om.

export async function haalSessie(): Promise<Sessie | null> {
  const koekjes = await cookies();
  const sessie = await leesSessieCookie(koekjes.get(SESSIE_COOKIE)?.value);
  if (!sessie) return null;

  // Het cookie staat 30 dagen; een account dat is uitgezet of een rol die is
  // veranderd moet meteen gelden. Daarom elke keer de database raadplegen.
  const gebruiker = await db.gebruiker.findUnique({
    where: { id: sessie.gebruikerId },
    select: { id: true, naam: true, rol: true, relatieId: true, actief: true },
  });
  if (!gebruiker?.actief) return null;
  if (gebruiker.rol === "SV" && !gebruiker.relatieId) return null;

  return {
    gebruikerId: gebruiker.id,
    naam: gebruiker.naam,
    rol: gebruiker.rol as Rol,
    relatieId: gebruiker.relatieId ?? undefined,
    verlooptOp: sessie.verlooptOp,
  };
}

export async function vereisSessie(): Promise<Sessie> {
  const sessie = await haalSessie();
  if (!sessie) redirect("/inloggen");
  return sessie;
}

/** Alleen het SVR-bestuur. Alles onder /beheer en de financiële API's. */
export async function vereisBestuur(): Promise<Sessie> {
  const sessie = await vereisSessie();
  if (sessie.rol !== "BESTUUR") redirect("/portaal");
  return sessie;
}

/** Het portaal: zowel het bestuur als een vereniging mag hier komen. */
export async function vereisPortaal(): Promise<Sessie> {
  return vereisSessie();
}

/**
 * De vereniging waarvan deze sessie gegevens mag zien. Het bestuur mag alles
 * zien (undefined betekent: geen beperking); een SV-account alleen zichzelf.
 */
export function beperkingOpRelatie(sessie: Sessie): string | undefined {
  return sessie.rol === "SV" ? sessie.relatieId : undefined;
}

/** Gooit als deze sessie niet bij deze vereniging hoort. */
export function vereisEigenRelatie(sessie: Sessie, relatieId: string): void {
  if (sessie.rol === "BESTUUR") return;
  if (sessie.relatieId !== relatieId) {
    throw new Error("Deze gegevens horen bij een andere vereniging.");
  }
}
