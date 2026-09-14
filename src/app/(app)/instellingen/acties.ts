"use server";

import { revalidatePath } from "next/cache";

import { logAudit } from "@/lib/audit";
import { vereisSessie } from "@/lib/auth/server";
import { db } from "@/lib/db";
import { leesGeheelGetal, leesTekst, leesVinkje, voerUit, type ActieStaat } from "@/lib/acties";

export async function bewaarInstellingen(
  _vorigeStaat: ActieStaat,
  formulier: FormData,
): Promise<ActieStaat> {
  const sessie = await vereisSessie();

  return voerUit(async () => {
    const btwPercentage = leesGeheelGetal(formulier, "btwPercentage") ?? 21;
    if (btwPercentage < 0 || btwPercentage > 100) {
      return { fout: "Het btw-percentage moet tussen 0 en 100 liggen." };
    }

    const betaaltermijnDagen = leesGeheelGetal(formulier, "betaaltermijnDagen") ?? 30;
    if (betaaltermijnDagen < 1 || betaaltermijnDagen > 365) {
      return { fout: "De betaaltermijn moet tussen 1 en 365 dagen liggen." };
    }

    const gegevens = {
      organisatieNaam:
        leesTekst(formulier, "organisatieNaam") ?? "StudieVerenigingenRaad Delft",
      adres: leesTekst(formulier, "adres") ?? "",
      postcode: leesTekst(formulier, "postcode") ?? "",
      plaats: leesTekst(formulier, "plaats") ?? "",
      email: leesTekst(formulier, "email") ?? "",
      iban: leesTekst(formulier, "iban") ?? "",
      kvkNummer: leesTekst(formulier, "kvkNummer") ?? "",
      btwPlichtig: leesVinkje(formulier, "btwPlichtig"),
      btwPercentage,
      betaaltermijnDagen,
      factuurVoetnoot: leesTekst(formulier, "factuurVoetnoot") ?? "",
    };

    await db.instellingen.upsert({
      where: { id: "svr" },
      update: gegevens,
      create: { id: "svr", ...gegevens },
    });

    await logAudit({
      gebruiker: sessie.naam,
      entiteit: "Instellingen",
      entiteitId: "svr",
      actie: "gewijzigd",
      samenvatting: "Instellingen van de vereniging gewijzigd",
      details: gegevens,
    });

    revalidatePath("/instellingen");
    return { melding: "Instellingen opgeslagen." };
  });
}
