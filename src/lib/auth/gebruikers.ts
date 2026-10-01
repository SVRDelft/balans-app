import "server-only";

import { db } from "@/lib/db";
import { controleerHash, hashWachtwoord } from "@/lib/auth/wachtwoord";
import type { Rol, Sessie } from "@/lib/auth/sessie";

// Alles rond accounts en inlogpogingen. Niemand kan zichzelf registreren: het
// bestuur maakt accounts aan, en een SV-account hoort bij precies één
// studievereniging.

export const MAX_POGINGEN = 10;
const VENSTER_MS = 15 * 60 * 1000;
const BLOKKADE_MS = 15 * 60 * 1000;

export const normaliseerEmail = (email: string) => email.trim().toLowerCase();

/**
 * Teller per e-mailadres en per IP, in de database. In het geheugen zou het
 * niet werken: Passenger draait meerdere processen naast elkaar.
 */
export async function isGeblokkeerd(sleutels: string[]): Promise<boolean> {
  const nu = new Date();
  const geblokkeerd = await db.inlogpoging.count({
    where: { sleutel: { in: sleutels }, geblokkeerdTot: { gt: nu } },
  });
  return geblokkeerd > 0;
}

export async function telMisluktePoging(sleutels: string[]): Promise<void> {
  const nu = new Date();
  for (const sleutel of sleutels) {
    const bestaand = await db.inlogpoging.findUnique({ where: { sleutel } });
    // Buiten het venster begint de telling opnieuw.
    if (!bestaand || nu.getTime() - bestaand.eerstePoging.getTime() > VENSTER_MS) {
      await db.inlogpoging.upsert({
        where: { sleutel },
        create: { sleutel, aantal: 1, eerstePoging: nu },
        update: { aantal: 1, eerstePoging: nu, geblokkeerdTot: null },
      });
      continue;
    }
    const aantal = bestaand.aantal + 1;
    await db.inlogpoging.update({
      where: { sleutel },
      data: {
        aantal,
        geblokkeerdTot:
          aantal >= MAX_POGINGEN ? new Date(nu.getTime() + BLOKKADE_MS) : null,
      },
    });
  }
}

export async function wisPogingen(sleutels: string[]): Promise<void> {
  await db.inlogpoging.deleteMany({ where: { sleutel: { in: sleutels } } });
}

export interface Inloguitkomst {
  sessie: Pick<Sessie, "gebruikerId" | "naam" | "rol" | "relatieId">;
  moetWijzigen: boolean;
}

/**
 * Controleert e-mailadres en wachtwoord. Geeft niets prijs over de vraag of een
 * adres bestaat: een onbekend adres en een fout wachtwoord leveren hetzelfde op.
 */
export async function controleerInlog(
  email: string,
  wachtwoord: string,
): Promise<Inloguitkomst | undefined> {
  const gebruiker = await db.gebruiker.findUnique({
    where: { email: normaliseerEmail(email) },
  });
  if (!gebruiker || !gebruiker.actief) {
    // Toch een hash berekenen, zodat een onbekend adres niet sneller antwoordt.
    await controleerHash(wachtwoord, "scrypt$16384$8$1$00$00");
    return undefined;
  }
  if (!(await controleerHash(wachtwoord, gebruiker.wachtwoordHash))) return undefined;
  if (gebruiker.rol === "SV" && !gebruiker.relatieId) return undefined;

  await db.gebruiker.update({
    where: { id: gebruiker.id },
    data: { laatsteInlog: new Date() },
  });

  return {
    sessie: {
      gebruikerId: gebruiker.id,
      naam: gebruiker.naam,
      rol: gebruiker.rol as Rol,
      relatieId: gebruiker.relatieId ?? undefined,
    },
    moetWijzigen: gebruiker.moetWijzigen,
  };
}

/** Controleert het wachtwoord van de ingelogde persoon zelf. */
export async function controleerEigenWachtwoord(
  gebruikerId: string,
  wachtwoord: string,
): Promise<boolean> {
  const gebruiker = await db.gebruiker.findUnique({ where: { id: gebruikerId } });
  if (!gebruiker?.actief) return false;
  return controleerHash(wachtwoord, gebruiker.wachtwoordHash);
}

export async function zetWachtwoord(
  gebruikerId: string,
  wachtwoord: string,
  moetWijzigen: boolean,
): Promise<void> {
  await db.gebruiker.update({
    where: { id: gebruikerId },
    data: { wachtwoordHash: await hashWachtwoord(wachtwoord), moetWijzigen },
  });
}
