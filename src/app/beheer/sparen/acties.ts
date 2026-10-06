"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { leesTekst, voerUit, type ActieStaat } from "@/lib/acties";
import { logAudit } from "@/lib/audit";
import { vereisBestuur } from "@/lib/auth/server";
import { vereisSchrijfbaarBoekjaar } from "@/lib/boekjaar";
import { datumUitInvoer } from "@/lib/datum";
import { db } from "@/lib/db";
import { SPAAR_SOORTEN, type SpaarSoort } from "@/lib/domein";
import { formatteerEuro, parseerBedragNaarCenten } from "@/lib/geld";

const mutatieSchema = z.object({
  omschrijving: z
    .string()
    .trim()
    .min(1, "Vul in waar deze mutatie over gaat.")
    .max(500),
  soort: z.enum(SPAAR_SOORTEN),
  notities: z.string().trim().max(2000).optional(),
});

/**
 * Een bedrag erbij of eraf op de spaarrekening.
 *
 * Een overboeking tussen de eigen rekeningen is geen uitgave: het geld blijft van
 * de SVR en staat alleen ergens anders. Rente en bankkosten zijn dat wél, en die
 * komen rechtstreeks op de spaarrekening binnen — daarom hoort daar een
 * begrotingspost bij.
 */
export async function bewaarSpaarmutatie(
  _vorigeStaat: ActieStaat,
  formulier: FormData,
): Promise<ActieStaat> {
  const sessie = await vereisBestuur();

  return voerUit(async () => {
    const boekjaar = await vereisSchrijfbaarBoekjaar();

    const uitkomst = mutatieSchema.safeParse({
      omschrijving: formulier.get("omschrijving"),
      soort: formulier.get("soort"),
      notities: formulier.get("notities") ?? undefined,
    });
    if (!uitkomst.success) {
      const veldfouten: Record<string, string> = {};
      for (const probleem of uitkomst.error.issues) {
        const veld = String(probleem.path[0] ?? "");
        if (veld && !veldfouten[veld]) veldfouten[veld] = probleem.message;
      }
      return { fout: "Controleer de ingevulde gegevens.", veldfouten };
    }

    const bedrag = parseerBedragNaarCenten(String(formulier.get("bedrag") ?? ""));
    if (bedrag === null || bedrag === 0) {
      return { fout: "Vul een bedrag in.", veldfouten: { bedrag: "Vul een bedrag in." } };
    }
    const datum = datumUitInvoer(String(formulier.get("datum") ?? ""));
    if (!datum) {
      return { fout: "Vul een geldige datum in.", veldfouten: { datum: "Vul een geldige datum in." } };
    }

    const richting = leesTekst(formulier, "richting") ?? "bij";
    const bedragCenten = richting === "af" ? -Math.abs(bedrag) : Math.abs(bedrag);

    const soort = uitkomst.data.soort as SpaarSoort;
    const viaBetaalrekening = soort === "overboeking";
    const begrotingspostId = leesTekst(formulier, "begrotingspostId") ?? null;
    if (!viaBetaalrekening && !begrotingspostId) {
      return {
        fout: "Rente, kosten en correcties lopen niet via de betaalrekening. Kies de begrotingspost waarop dat thuishoort.",
        veldfouten: { begrotingspostId: "Kies een begrotingspost." },
      };
    }
    if (begrotingspostId) {
      const post = await db.begrotingspost.findUnique({
        where: { id: begrotingspostId, boekjaarId: boekjaar.id },
      });
      if (!post) return { fout: "Kies een begrotingspost uit dit boekjaar." };
    }

    const mutatie = await db.spaarmutatie.create({
      data: {
        boekjaarId: boekjaar.id,
        datum,
        omschrijving: uitkomst.data.omschrijving,
        bedragCenten,
        soort,
        viaBetaalrekening,
        begrotingspostId: viaBetaalrekening ? null : begrotingspostId,
        notities: uitkomst.data.notities ?? null,
        aangemaaktDoor: sessie.naam,
      },
    });

    await logAudit({
      gebruiker: sessie.naam,
      entiteit: "Spaarmutatie",
      entiteitId: mutatie.id,
      actie: "aangemaakt",
      samenvatting: `Spaarrekening ${formatteerEuro(bedragCenten)} (${soort}) — ${uitkomst.data.omschrijving}`,
      boekjaarId: boekjaar.id,
    });

    revalidatePath("/", "layout");
    return {
      melding:
        bedragCenten > 0
          ? `${formatteerEuro(bedragCenten)} bijgeschreven op de spaarrekening.`
          : `${formatteerEuro(-bedragCenten)} van de spaarrekening af.`,
    };
  });
}

export async function verwijderSpaarmutatie(
  _vorigeStaat: ActieStaat,
  formulier: FormData,
): Promise<ActieStaat> {
  const sessie = await vereisBestuur();

  return voerUit(async () => {
    const boekjaar = await vereisSchrijfbaarBoekjaar();
    const id = leesTekst(formulier, "id");
    if (!id) return { fout: "Onbekende mutatie." };

    const mutatie = await db.spaarmutatie.findUnique({
      where: { id, boekjaarId: boekjaar.id },
      include: { bankmutatie: { select: { id: true } } },
    });
    if (!mutatie) return { fout: "Deze mutatie bestaat niet meer in dit boekjaar." };
    if (mutatie.bankmutatie) {
      return {
        fout: "Deze mutatie komt uit een bankimport. Maak daar de koppeling ongedaan, dan verdwijnt hij mee.",
      };
    }

    await db.spaarmutatie.delete({ where: { id } });

    await logAudit({
      gebruiker: sessie.naam,
      entiteit: "Spaarmutatie",
      entiteitId: id,
      actie: "verwijderd",
      samenvatting: `Spaarmutatie ${formatteerEuro(mutatie.bedragCenten)} verwijderd — ${mutatie.omschrijving}`,
      boekjaarId: boekjaar.id,
    });

    revalidatePath("/", "layout");
    return { melding: "Mutatie verwijderd." };
  });
}
