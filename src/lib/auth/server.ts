import "server-only";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { SESSIE_COOKIE, leesSessieCookie, type Sessie } from "./sessie";

export async function haalSessie(): Promise<Sessie | null> {
  const koekjes = await cookies();
  return leesSessieCookie(koekjes.get(SESSIE_COOKIE)?.value);
}

/**
 * Elke server action is ook rechtstreeks met een POST te bereiken, buiten de
 * interface om. Daarom controleert elke mutatie hier opnieuw de sessie, en niet
 * alleen proxy.ts.
 */
export async function vereisSessie(): Promise<Sessie> {
  const sessie = await haalSessie();
  if (!sessie) redirect("/inloggen");
  return sessie;
}
