"use server";

import { revalidatePath } from "next/cache";

import { logAudit } from "@/lib/audit";
import { controleerWachtwoord } from "@/lib/auth/sessie";
import { vereisSessie } from "@/lib/auth/server";
import { db } from "@/lib/db";
import { voerUit, type ActieStaat } from "@/lib/acties";

/**
 * Wist het hele auditlog, bijvoorbeeld na het testen. Er blijft één regel over
 * die zegt wie het log wanneer gewist heeft, zodat dat zelf niet onzichtbaar is.
 */
export async function wisAuditlog(
  _vorigeStaat: ActieStaat,
  formulier: FormData,
): Promise<ActieStaat> {
  const sessie = await vereisSessie();

  return voerUit(async () => {
    const wachtwoord = String(formulier.get("wachtwoord") ?? "");
    if (!controleerWachtwoord(wachtwoord)) {
      return { fout: "Het wachtwoord klopt niet. Er is niets gewist." };
    }

    const aantal = await db.$transaction(async (tx) => {
      const gewist = await tx.auditlog.deleteMany({});
      await logAudit(
        {
          gebruiker: sessie.naam,
          entiteit: "Auditlog",
          actie: "gewist",
          samenvatting: `Auditlog gewist (${gewist.count} regels)`,
        },
        tx,
      );
      return gewist.count;
    });

    revalidatePath("/auditlog");
    return { melding: `${aantal} regels gewist.` };
  });
}
