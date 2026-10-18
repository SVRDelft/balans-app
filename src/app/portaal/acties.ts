"use server";

import { revalidatePath } from "next/cache";

import { logAudit } from "@/lib/audit";
import { vereisPortaal } from "@/lib/auth/server";
import { zorgVoorDeellink } from "@/lib/portaal/delen";

/**
 * De deellink van een agenda of notulen, voor iedereen die in het portaal mag.
 * Geeft een pad terug; de knop maakt er met het eigen adres een volledige link
 * van en zet die op het klembord.
 */
export async function haalDeellink(
  bestandId: string,
): Promise<{ pad: string } | { fout: string }> {
  const sessie = await vereisPortaal();
  const uitkomst = await zorgVoorDeellink(String(bestandId));
  if ("fout" in uitkomst) return uitkomst;

  await logAudit({
    gebruiker: sessie.rol === "PORTAAL" ? `${sessie.naam} (portaal)` : sessie.naam,
    entiteit: "Portaalbestand",
    entiteitId: String(bestandId),
    actie: "deellink",
    samenvatting: `Deellink opgevraagd voor "${uitkomst.titel}"`,
  });
  revalidatePath("/beheer/portaal");
  return { pad: uitkomst.pad };
}
