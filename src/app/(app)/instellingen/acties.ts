"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { contactVelden, leesContactgegevens } from "@/lib/contactgegevens";
import { controleerLogo } from "@/lib/logo";

import { logAudit } from "@/lib/audit";
import { vereisSessie } from "@/lib/auth/server";
import { db } from "@/lib/db";
import {
  leesGeheelGetal,
  leesTekst,
  leesVinkje,
  voerUit,
  type ActieStaat,
} from "@/lib/acties";

export async function bewaarInstellingen(
  _vorigeStaat: ActieStaat,
  formulier: FormData,
): Promise<ActieStaat> {
  const sessie = await vereisSessie();

  return voerUit(async () => {
    const contact = z
      .object(contactVelden)
      .safeParse(leesContactgegevens(formulier));
    if (!contact.success)
      return {
        fout: "Controleer de contactgegevens.",
        veldfouten: Object.fromEntries(
          contact.error.issues.map((fout) => [
            String(fout.path[0]),
            fout.message,
          ]),
        ),
      };
    const btwPercentage = leesGeheelGetal(formulier, "btwPercentage") ?? 21;
    if (btwPercentage < 0 || btwPercentage > 100) {
      return { fout: "Het btw-percentage moet tussen 0 en 100 liggen." };
    }

    const betaaltermijnDagen =
      leesGeheelGetal(formulier, "betaaltermijnDagen") ?? 30;
    if (betaaltermijnDagen < 1 || betaaltermijnDagen > 365) {
      return { fout: "De betaaltermijn moet tussen 1 en 365 dagen liggen." };
    }

    const gegevens = {
      ...contact.data,
      organisatieNaam:
        leesTekst(formulier, "organisatieNaam") ??
        "StudieVerenigingenRaad Delft",
      btwPlichtig: leesVinkje(formulier, "btwPlichtig"),
      btwPercentage,
      betaaltermijnDagen,
      factuurVoetnoot: leesTekst(formulier, "factuurVoetnoot") ?? "",
    };
    if (
      gegevens.organisatieNaam.length > 120 ||
      gegevens.factuurVoetnoot.length > 500
    ) {
      return {
        fout: "Gebruik maximaal 120 tekens voor de naam en 500 voor de factuurvoetnoot.",
      };
    }

    const bestand = formulier.get("logo");
    const logo =
      bestand instanceof File && bestand.size > 0
        ? await controleerLogo(bestand)
        : leesVinkje(formulier, "standaardLogo")
          ? { logoData: null, logoMimeType: null, logoNaam: null }
          : {};

    await db.$transaction(async (tx) => {
      await tx.instellingen.upsert({
        where: { id: "svr" },
        update: { ...gegevens, ...logo },
        create: { id: "svr", ...gegevens, ...logo },
      });

      await logAudit(
        {
          gebruiker: sessie.naam,
          entiteit: "Instellingen",
          entiteitId: "svr",
          actie: "gewijzigd",
          samenvatting: "Instellingen van de vereniging gewijzigd",
          details: {
            ...gegevens,
            ...(Object.keys(logo).length ? { logoGewijzigd: true } : {}),
          },
        },
        tx,
      );
    });

    revalidatePath("/", "layout");
    return { melding: "Instellingen opgeslagen." };
  });
}
