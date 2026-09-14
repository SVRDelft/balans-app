"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { logAudit } from "@/lib/audit";
import { vereisSessie } from "@/lib/auth/server";
import { db } from "@/lib/db";
import { RELATIE_TYPES } from "@/lib/domein";
import { voerUit, type ActieStaat } from "@/lib/acties";

const relatieSchema = z.object({
  type: z.enum(RELATIE_TYPES),
  naam: z.string().trim().min(1, "Vul een naam in.").max(120),
  contactpersoon: z.string().trim().max(120).optional(),
  email: z.union([z.literal(""), z.email("Dit is geen geldig e-mailadres.")]),
  adres: z.string().trim().max(200).optional(),
  postcode: z.string().trim().max(20).optional(),
  plaats: z.string().trim().max(100).optional(),
  notities: z.string().trim().max(2000).optional(),
});

function leesFormulier(formulier: FormData) {
  return relatieSchema.safeParse({
    type: formulier.get("type"),
    naam: formulier.get("naam"),
    contactpersoon: formulier.get("contactpersoon") ?? undefined,
    email: formulier.get("email") ?? "",
    adres: formulier.get("adres") ?? undefined,
    postcode: formulier.get("postcode") ?? undefined,
    plaats: formulier.get("plaats") ?? undefined,
    notities: formulier.get("notities") ?? undefined,
  });
}

export async function bewaarRelatie(
  _vorigeStaat: ActieStaat,
  formulier: FormData,
): Promise<ActieStaat> {
  const sessie = await vereisSessie();

  return voerUit(async () => {
    const uitkomst = leesFormulier(formulier);
    if (!uitkomst.success) {
      const veldfouten: Record<string, string> = {};
      for (const probleem of uitkomst.error.issues) {
        const veld = String(probleem.path[0] ?? "");
        if (veld && !veldfouten[veld]) veldfouten[veld] = probleem.message;
      }
      return { fout: "Controleer de ingevulde gegevens.", veldfouten };
    }

    const gegevens = {
      ...uitkomst.data,
      email: uitkomst.data.email === "" ? null : uitkomst.data.email,
      contactpersoon: uitkomst.data.contactpersoon ?? null,
      adres: uitkomst.data.adres ?? null,
      postcode: uitkomst.data.postcode ?? null,
      plaats: uitkomst.data.plaats ?? null,
      notities: uitkomst.data.notities ?? null,
      actief: formulier.get("actief") !== null,
      bijdragePlichtig:
        uitkomst.data.type === "studievereniging" &&
        formulier.get("bijdragePlichtig") !== null,
    };

    const id = String(formulier.get("id") ?? "");

    if (id) {
      const relatie = await db.relatie.update({ where: { id }, data: gegevens });
      await logAudit({
        gebruiker: sessie.naam,
        entiteit: "Relatie",
        entiteitId: relatie.id,
        actie: "gewijzigd",
        samenvatting: `Relatie ${relatie.naam} gewijzigd`,
        details: gegevens,
      });
    } else {
      const relatie = await db.relatie.create({ data: gegevens });
      await logAudit({
        gebruiker: sessie.naam,
        entiteit: "Relatie",
        entiteitId: relatie.id,
        actie: "aangemaakt",
        samenvatting: `Relatie ${relatie.naam} aangemaakt`,
        details: gegevens,
      });
    }

    revalidatePath("/relaties");
    redirect("/relaties");
  });
}

export async function verwijderRelatie(
  _vorigeStaat: ActieStaat,
  formulier: FormData,
): Promise<ActieStaat> {
  const sessie = await vereisSessie();

  return voerUit(async () => {
    const id = String(formulier.get("id") ?? "");
    if (!id) return { fout: "Onbekende relatie." };

    const relatie = await db.relatie.findUnique({
      where: { id },
      include: {
        _count: { select: { facturen: true, uitgaven: true, deelnemers: true } },
      },
    });
    if (!relatie) return { fout: "Deze relatie bestaat niet meer." };

    const inGebruik =
      relatie._count.facturen +
      relatie._count.uitgaven +
      relatie._count.deelnemers;

    if (inGebruik > 0) {
      // Historie moet overdraagbaar blijven; daarom op non-actief zetten in
      // plaats van weggooien.
      await db.relatie.update({ where: { id }, data: { actief: false } });
      await logAudit({
        gebruiker: sessie.naam,
        entiteit: "Relatie",
        entiteitId: id,
        actie: "gearchiveerd",
        samenvatting: `Relatie ${relatie.naam} op non-actief gezet (nog ${inGebruik} koppelingen)`,
      });
      revalidatePath("/relaties");
      redirect("/relaties");
    }

    await db.relatie.delete({ where: { id } });
    await logAudit({
      gebruiker: sessie.naam,
      entiteit: "Relatie",
      entiteitId: id,
      actie: "verwijderd",
      samenvatting: `Relatie ${relatie.naam} verwijderd`,
    });

    revalidatePath("/relaties");
    redirect("/relaties");
  });
}
