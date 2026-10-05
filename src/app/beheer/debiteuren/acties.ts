"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { leesTekst, voerUit, type ActieStaat } from "@/lib/acties";
import { logAudit } from "@/lib/audit";
import { vereisBestuur } from "@/lib/auth/server";
import { vereisSchrijfbaarBoekjaar } from "@/lib/boekjaar";
import { datumUitInvoer } from "@/lib/datum";
import { db } from "@/lib/db";
import { formatteerEuro, parseerBedragNaarCenten } from "@/lib/geld";

const postSchema = z.object({
  relatieId: z.string().min(1, "Kies een persoon of vereniging."),
  omschrijving: z
    .string()
    .trim()
    .min(1, "Vul in waar dit bedrag over gaat.")
    .max(500),
  notities: z.string().trim().max(2000).optional(),
});

/**
 * Zet een bedrag op de rekening-courant van één relatie.
 *
 * De richting is een keuze in het formulier en geen minteken dat je moet
 * onthouden: "moet ons nog betalen" of "wij moeten nog betalen". Daaronder is
 * het één getal, positief als de relatie de SVR nog iets schuldig is.
 */
export async function bewaarRekeningpost(
  _vorigeStaat: ActieStaat,
  formulier: FormData,
): Promise<ActieStaat> {
  const sessie = await vereisBestuur();

  return voerUit(async () => {
    const boekjaar = await vereisSchrijfbaarBoekjaar();

    const uitkomst = postSchema.safeParse({
      relatieId: formulier.get("relatieId"),
      omschrijving: formulier.get("omschrijving"),
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
      return {
        fout: "Vul een bedrag in.",
        veldfouten: { bedrag: "Vul een bedrag in." },
      };
    }
    const datum = datumUitInvoer(String(formulier.get("datum") ?? ""));
    if (!datum) {
      return {
        fout: "Vul een geldige datum in.",
        veldfouten: { datum: "Vul een geldige datum in." },
      };
    }

    const richting = leesTekst(formulier, "richting") ?? "vordering";
    const bedragCenten = richting === "schuld" ? -Math.abs(bedrag) : Math.abs(bedrag);

    const viaBank = formulier.get("viaBank") !== null;
    const begrotingspostId = leesTekst(formulier, "begrotingspostId") ?? null;
    if (!viaBank && !begrotingspostId) {
      return {
        fout: "Een bedrag dat niet via de SVR-rekening ging, is een correctie. Kies de begrotingspost waarop die thuishoort.",
        veldfouten: { begrotingspostId: "Kies een begrotingspost." },
      };
    }
    if (begrotingspostId) {
      const post = await db.begrotingspost.findUnique({
        where: { id: begrotingspostId, boekjaarId: boekjaar.id },
      });
      if (!post) return { fout: "Kies een begrotingspost uit dit boekjaar." };
    }

    const relatie = await db.relatie.findUnique({
      where: { id: uitkomst.data.relatieId },
    });
    if (!relatie) return { fout: "Deze relatie bestaat niet meer." };

    const post = await db.rekeningpost.create({
      data: {
        boekjaarId: boekjaar.id,
        relatieId: relatie.id,
        datum,
        omschrijving: uitkomst.data.omschrijving,
        bedragCenten,
        viaBank,
        begrotingspostId: viaBank ? null : begrotingspostId,
        notities: uitkomst.data.notities ?? null,
        aangemaaktDoor: sessie.naam,
      },
    });

    await logAudit({
      gebruiker: sessie.naam,
      entiteit: "Rekeningpost",
      entiteitId: post.id,
      actie: "aangemaakt",
      samenvatting: `Rekening-courant ${relatie.naam}: ${formatteerEuro(bedragCenten)} — ${uitkomst.data.omschrijving}`,
      boekjaarId: boekjaar.id,
      details: { viaBank, begrotingspostId: post.begrotingspostId },
    });

    revalidatePath("/", "layout");
    return {
      melding:
        bedragCenten > 0
          ? `${formatteerEuro(bedragCenten)} op de rekening van ${relatie.naam} gezet.`
          : `${formatteerEuro(-bedragCenten)} van de rekening van ${relatie.naam} af.`,
    };
  });
}

export async function verwijderRekeningpost(
  _vorigeStaat: ActieStaat,
  formulier: FormData,
): Promise<ActieStaat> {
  const sessie = await vereisBestuur();

  return voerUit(async () => {
    const boekjaar = await vereisSchrijfbaarBoekjaar();
    const id = leesTekst(formulier, "id");
    if (!id) return { fout: "Onbekende post." };

    const post = await db.rekeningpost.findUnique({
      where: { id, boekjaarId: boekjaar.id },
      include: { relatie: { select: { naam: true } }, bankmutatie: { select: { id: true } } },
    });
    if (!post) {
      return { fout: "Deze post bestaat niet meer in dit boekjaar." };
    }
    if (post.bankmutatie) {
      return {
        fout: "Deze post komt uit een bankimport. Maak daar de koppeling ongedaan, dan verdwijnt de post mee.",
      };
    }

    await db.rekeningpost.delete({ where: { id } });

    await logAudit({
      gebruiker: sessie.naam,
      entiteit: "Rekeningpost",
      entiteitId: id,
      actie: "verwijderd",
      samenvatting: `Rekening-courant ${post.relatie.naam}: ${formatteerEuro(post.bedragCenten)} verwijderd — ${post.omschrijving}`,
      boekjaarId: boekjaar.id,
    });

    revalidatePath("/", "layout");
    return { melding: "Post verwijderd." };
  });
}
