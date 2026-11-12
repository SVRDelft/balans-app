import "server-only";

import { haalToegangKeuzes } from "@/lib/auth/portaaltoegang";
import { db } from "@/lib/db";

/**
 * Hoeveel verenigingen en informanten kunnen inloggen, en hoeveel deden dat
 * de afgelopen 30 dagen. Voor Beheer › Portaaltoegang en het dashboard.
 */
export async function portaalStand() {
  const grens = new Date();
  grens.setUTCDate(grens.getUTCDate() - 30);
  const [{ studieverenigingen, informanten }, rijen] = await Promise.all([
    haalToegangKeuzes(),
    db.portaaltoegang.findMany({
      select: { sleutel: true, wachtwoordHash: true, actief: true, laatsteInlog: true },
    }),
  ]);
  const sleutels = new Set([...studieverenigingen, ...informanten].map((keuze) => keuze.sleutel));
  const telt = rijen.filter((rij) => sleutels.has(rij.sleutel));
  return {
    totaal: sleutels.size,
    metWachtwoord: telt.filter((rij) => rij.wachtwoordHash && rij.actief).length,
    recentIngelogd: telt.filter((rij) => rij.laatsteInlog && rij.laatsteInlog >= grens).length,
  };
}
