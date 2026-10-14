import "server-only";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { db } from "@/lib/db";

import {
  SESSIE_COOKIE,
  isGroepSessie,
  leesSessieCookie,
  type AccountRol,
  type AccountSessie,
  type Sessie,
} from "./sessie";

// Eén plek waar toegang wordt bepaald. Proxy.ts houdt alleen de deur dicht voor
// wie niet is ingelogd; wélke rol ergens bij mag, wordt hier gecontroleerd, in
// elke pagina, server action en API-route. Een server action is namelijk ook
// rechtstreeks met een POST te bereiken, buiten de interface om.
//
// Er zijn drie rollen. BESTUUR komt overal. SV (een persoonlijk account van een
// vereniging) komt in het portaal en ziet daar de eigen facturen. PORTAAL (wie
// "als vereniging" inlogt met het gedeelde wachtwoord) komt alleen in het
// portaal en ziet geen enkel gegeven uit de administratie.

export async function haalSessie(): Promise<Sessie | null> {
  const koekjes = await cookies();
  const sessie = await leesSessieCookie(koekjes.get(SESSIE_COOKIE)?.value);
  if (!sessie) return null;

  if (isGroepSessie(sessie)) {
    // Uitgezet, nooit een wachtwoord gekregen, of het wachtwoord is gewijzigd
    // nadat dit cookie werd uitgegeven: dan telt de sessie niet meer.
    const toegang = await db.portaaltoegang.findUnique({
      where: { id: sessie.toegangId },
      select: {
        naam: true,
        actief: true,
        wachtwoordHash: true,
        wachtwoordGewijzigdOp: true,
      },
    });
    if (!toegang?.actief || !toegang.wachtwoordHash) return null;
    if (
      toegang.wachtwoordGewijzigdOp &&
      toegang.wachtwoordGewijzigdOp.getTime() > sessie.uitgegevenOp
    ) {
      return null;
    }
    return { ...sessie, naam: toegang.naam };
  }

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
    rol: gebruiker.rol as AccountRol,
    relatieId: gebruiker.relatieId ?? undefined,
    verlooptOp: sessie.verlooptOp,
  };
}

export async function vereisSessie(): Promise<Sessie> {
  const sessie = await haalSessie();
  if (!sessie) redirect("/inloggen");
  return sessie;
}

/**
 * Alleen het SVR-bestuur. Alles onder /beheer en de financiële API's. Een
 * groepssessie (rol PORTAAL) is nooit BESTUUR en komt hier dus nooit langs.
 */
export async function vereisBestuur(): Promise<AccountSessie> {
  const sessie = await vereisSessie();
  if (sessie.rol !== "BESTUUR" || isGroepSessie(sessie)) redirect("/portaal");
  return sessie;
}

/** Het portaal: het bestuur, een verenigingsaccount en een groepssessie. */
export async function vereisPortaal(): Promise<Sessie> {
  return vereisSessie();
}

/**
 * De vereniging waarvan deze sessie gegevens mag zien. Het bestuur mag alles
 * zien (undefined betekent: geen beperking); een SV-account alleen zichzelf.
 * Een groepssessie hoort bij geen enkele relatie en mag dus niets zien: dat
 * geeft een fout in plaats van "geen beperking".
 */
export function beperkingOpRelatie(sessie: Sessie): string | undefined {
  if (sessie.rol === "BESTUUR") return undefined;
  if (sessie.rol === "SV" && !isGroepSessie(sessie)) return sessie.relatieId;
  throw new Error("Deze sessie mag geen gegevens van een vereniging inzien.");
}

/** Gooit als deze sessie niet bij deze vereniging hoort. */
export function vereisEigenRelatie(sessie: Sessie, relatieId: string): void {
  if (sessie.rol === "BESTUUR") return;
  if (isGroepSessie(sessie) || sessie.relatieId !== relatieId) {
    throw new Error("Deze gegevens horen bij een andere vereniging.");
  }
}
