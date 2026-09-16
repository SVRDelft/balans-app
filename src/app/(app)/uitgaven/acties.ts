"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { logAudit } from "@/lib/audit";
import { vereisSessie } from "@/lib/auth/server";
import { vereisSchrijfbaarBoekjaar } from "@/lib/boekjaar";
import { controleerKoppelingen } from "@/lib/boekjaar-koppelingen";
import { db } from "@/lib/db";
import { datumUitInvoer } from "@/lib/datum";
import { formatteerEuro, parseerBedragNaarCenten } from "@/lib/geld";
import { leesTekst, leesVinkje, voerUit, type ActieStaat } from "@/lib/acties";
import { BIJLAGE_TE_GROOT, MAX_BIJLAGE_BYTES } from "@/lib/bijlagen";
import type { Prisma } from "@/generated/prisma/client";

const TOEGESTANE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
  "application/pdf",
];

async function leesBijlage(
  formulier: FormData,
  gebruiker: string,
): Promise<{ data?: Prisma.BijlageCreateInput; fout?: string }> {
  const bestand = formulier.get("bijlage");
  if (!(bestand instanceof File) || bestand.size === 0) return {};

  if (bestand.size > MAX_BIJLAGE_BYTES) {
    return { fout: BIJLAGE_TE_GROOT };
  }
  if (!TOEGESTANE_TYPES.includes(bestand.type)) {
    return {
      fout: "Alleen JPG, PNG, WEBP, HEIC of PDF kunnen als bonnetje mee.",
    };
  }

  return {
    data: {
      bestandsnaam: bestand.name,
      mimeType: bestand.type,
      grootte: bestand.size,
      data: Buffer.from(await bestand.arrayBuffer()),
      geuploadDoor: gebruiker,
    },
  };
}

export async function bewaarUitgave(
  _vorigeStaat: ActieStaat,
  formulier: FormData,
): Promise<ActieStaat> {
  const sessie = await vereisSessie();

  let doel = "/uitgaven";

  const resultaat = await voerUit(async () => {
    const boekjaar = await vereisSchrijfbaarBoekjaar();

    const id = leesTekst(formulier, "id");
    const omschrijving = leesTekst(formulier, "omschrijving");
    const leverancierNaam = leesTekst(formulier, "leverancierNaam");
    const begrotingspostId = leesTekst(formulier, "begrotingspostId");
    const datum = datumUitInvoer(String(formulier.get("datum") ?? ""));
    const bedragCenten = parseerBedragNaarCenten(
      String(formulier.get("bedrag") ?? ""),
    );

    const veldfouten: Record<string, string> = {};
    if (!omschrijving) veldfouten.omschrijving = "Vul een omschrijving in.";
    if (!leverancierNaam) veldfouten.leverancierNaam = "Vul de leverancier in.";
    if (!begrotingspostId)
      veldfouten.begrotingspostId = "Kies een begrotingspost.";
    if (!datum) veldfouten.datum = "Vul een geldige datum in.";
    if (bedragCenten === null) veldfouten.bedrag = "Vul een bedrag in.";

    if (Object.keys(veldfouten).length > 0) {
      return { fout: "Controleer de ingevulde gegevens.", veldfouten };
    }

    await controleerKoppelingen(boekjaar.id, [begrotingspostId!], leesTekst(formulier, "evenementId"));
    if (id && !await db.uitgave.findFirst({ where: { id, boekjaarId: boekjaar.id } })) return { fout: "Deze uitgave hoort niet bij het actieve boekjaar." };

    const bijlage = await leesBijlage(formulier, sessie.naam);
    if (bijlage.fout) return { fout: bijlage.fout, veldfouten };

    const betaald = leesVinkje(formulier, "betaald");
    const betaaldOpInvoer = datumUitInvoer(
      String(formulier.get("betaaldOp") ?? ""),
    );

    const gegevens = {
      datum: datum!,
      omschrijving: omschrijving!,
      leverancierNaam: leverancierNaam!,
      bedragCenten: bedragCenten!,
      begrotingspostId: begrotingspostId!,
      relatieId: leesTekst(formulier, "relatieId") ?? null,
      evenementId: leesTekst(formulier, "evenementId") ?? null,
      bedragDefinitief: leesVinkje(formulier, "bedragDefinitief"),
      betaald,
      betaaldOp: betaald ? (betaaldOpInvoer ?? datum!) : null,
      notities: leesTekst(formulier, "notities") ?? null,
    };

    if (id) {
      const bestaand = await db.uitgave.findUnique({ where: { id, boekjaarId: boekjaar.id }, include: { bankmutatie: true } });
      if (!bestaand) return { fout: "Deze uitgave bestaat niet meer." };
      if (bestaand.bankmutatie && (gegevens.bedragCenten !== bestaand.bedragCenten || gegevens.betaald !== bestaand.betaald || gegevens.betaaldOp?.getTime() !== bestaand.betaaldOp?.getTime())) return { fout: "Deze uitgave is gekoppeld aan een bankregel. Ontkoppel die eerst bij Bankafschriften voordat je bedrag of betaling wijzigt." };

      if (
        bestaand.omslagrondeId &&
        (bestaand.bedragCenten !== gegevens.bedragCenten || bestaand.evenementId !== gegevens.evenementId || bestaand.begrotingspostId !== gegevens.begrotingspostId || !gegevens.bedragDefinitief)
      ) {
        return {
          fout: "Deze uitgave is al in een omslag verdeeld. Bedrag, evenement en begrotingspost staan daarom vast. Boek een correctie als nieuwe uitgave.",
        };
      }

      const uitgave = await db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "Uitgave" WHERE id = ${id} AND "boekjaarId" = ${boekjaar.id} FOR UPDATE`;
      const actueel = await tx.uitgave.findUniqueOrThrow({ where: { id, boekjaarId: boekjaar.id }, include: { bankmutatie: true } });
      if (actueel.bankmutatie && (gegevens.bedragCenten !== actueel.bedragCenten || gegevens.betaald !== actueel.betaald || gegevens.betaaldOp?.getTime() !== actueel.betaaldOp?.getTime())) throw new Error("Ontkoppel de bankregel eerst voordat je bedrag of betaling wijzigt.");
      if (actueel.omslagrondeId && (actueel.bedragCenten !== gegevens.bedragCenten || actueel.evenementId !== gegevens.evenementId || actueel.begrotingspostId !== gegevens.begrotingspostId || !gegevens.bedragDefinitief)) throw new Error("Deze uitgave is al in een omslag verdeeld en kan zo niet meer worden gewijzigd.");
      const nieuw = bijlage.data ? await tx.bijlage.create({ data: bijlage.data }) : null;
      const opgeslagen = await tx.uitgave.update({
        where: { id, boekjaarId: boekjaar.id },
        data: {
          ...gegevens,
          ...(nieuw ? { bijlageId: nieuw.id } : {}),
        },
      });
      if (nieuw && actueel.bijlageId) await tx.bijlage.delete({ where: { id: actueel.bijlageId } });
      return opgeslagen;
      });

      await logAudit({
        gebruiker: sessie.naam,
        entiteit: "Uitgave",
        entiteitId: uitgave.id,
        actie: "gewijzigd",
        samenvatting: `Uitgave ${uitgave.omschrijving} (${formatteerEuro(uitgave.bedragCenten)}) gewijzigd`,
        details: gegevens,
        boekjaarId: boekjaar.id,
      });

      doel = `/uitgaven/${uitgave.id}`;
      return;
    }

    const uitgave = await db.$transaction(async (tx) => {
    const nieuw = bijlage.data ? await tx.bijlage.create({ data: bijlage.data }) : null;
    return tx.uitgave.create({
      data: {
        ...gegevens,
        boekjaarId: boekjaar.id,
        bijlageId: nieuw?.id ?? null,
      },
    });
    });

    await logAudit({
      gebruiker: sessie.naam,
      entiteit: "Uitgave",
      entiteitId: uitgave.id,
      actie: "aangemaakt",
      samenvatting: `Uitgave ${uitgave.omschrijving} (${formatteerEuro(uitgave.bedragCenten)}) geregistreerd`,
      details: gegevens,
      boekjaarId: boekjaar.id,
    });

    doel = `/uitgaven/${uitgave.id}`;
  });

  if (resultaat.fout) return resultaat;

  revalidatePath("/uitgaven");
  redirect(doel);
}

export async function verwijderUitgave(
  _vorigeStaat: ActieStaat,
  formulier: FormData,
): Promise<ActieStaat> {
  const sessie = await vereisSessie();

  const resultaat = await voerUit(async () => {
    const boekjaar = await vereisSchrijfbaarBoekjaar();
    const id = leesTekst(formulier, "id");
    if (!id) return { fout: "Onbekende uitgave." };

    const uitgave = await db.uitgave.findUnique({ where: { id, boekjaarId: boekjaar.id } });
    if (!uitgave) return { fout: "Deze uitgave bestaat niet meer." };

    if (uitgave.omslagrondeId) {
      return {
        fout: "Deze uitgave is al in een omslag verdeeld en kan niet verwijderd worden. Corrigeer via een creditfactuur of een tegenboeking.",
      };
    }

    await db.$transaction(async (tx) => {
      await tx.uitgave.delete({ where: { id, boekjaarId: boekjaar.id } });
      if (uitgave.bijlageId) {
        await tx.bijlage.delete({ where: { id: uitgave.bijlageId } });
      }
    });

    await logAudit({
      gebruiker: sessie.naam,
      entiteit: "Uitgave",
      entiteitId: id,
      actie: "verwijderd",
      samenvatting: `Uitgave ${uitgave.omschrijving} (${formatteerEuro(uitgave.bedragCenten)}) verwijderd`,
      boekjaarId: boekjaar.id,
    });
  });

  if (resultaat.fout) return resultaat;

  revalidatePath("/uitgaven");
  redirect("/uitgaven");
}

/** Snelle schakelaar vanuit de lijst en vanuit het evenement. */
export async function zetBedragDefinitief(
  _vorigeStaat: ActieStaat,
  formulier: FormData,
): Promise<ActieStaat> {
  const sessie = await vereisSessie();

  return voerUit(async () => {
    const boekjaar = await vereisSchrijfbaarBoekjaar();
    const id = leesTekst(formulier, "id");
    if (!id) return { fout: "Onbekende uitgave." };

    const uitgave = await db.uitgave.findUnique({ where: { id, boekjaarId: boekjaar.id } });
    if (!uitgave) return { fout: "Deze uitgave bestaat niet meer." };

    const nieuweWaarde = !uitgave.bedragDefinitief;
    if (!nieuweWaarde && uitgave.omslagrondeId) return { fout: "Een uitgave in een berekende omslag blijft definitief." };
    await db.uitgave.update({
      where: { id, boekjaarId: boekjaar.id },
      data: { bedragDefinitief: nieuweWaarde },
    });

    await logAudit({
      gebruiker: sessie.naam,
      entiteit: "Uitgave",
      entiteitId: id,
      actie: nieuweWaarde ? "bedrag definitief" : "bedrag weer voorlopig",
      samenvatting: `${uitgave.omschrijving}: bedrag ${nieuweWaarde ? "definitief" : "weer voorlopig"}`,
      boekjaarId: boekjaar.id,
    });

    revalidatePath("/uitgaven");
    if (uitgave.evenementId) {
      revalidatePath(`/evenementen/${uitgave.evenementId}`);
    }
    return {};
  });
}

export async function zetBetaald(
  _vorigeStaat: ActieStaat,
  formulier: FormData,
): Promise<ActieStaat> {
  const sessie = await vereisSessie();

  return voerUit(async () => {
    const boekjaar = await vereisSchrijfbaarBoekjaar();
    const id = leesTekst(formulier, "id");
    if (!id) return { fout: "Onbekende uitgave." };

    const uitgave = await db.uitgave.findUnique({ where: { id, boekjaarId: boekjaar.id } });
    if (!uitgave) return { fout: "Deze uitgave bestaat niet meer." };

    const nieuweWaarde = !uitgave.betaald;
    await db.uitgave.update({
      where: { id, boekjaarId: boekjaar.id },
      data: {
        betaald: nieuweWaarde,
        betaaldOp: nieuweWaarde ? new Date() : null,
      },
    });

    await logAudit({
      gebruiker: sessie.naam,
      entiteit: "Uitgave",
      entiteitId: id,
      actie: nieuweWaarde ? "betaald" : "betaling teruggedraaid",
      samenvatting: `${uitgave.omschrijving} (${formatteerEuro(uitgave.bedragCenten)}) ${nieuweWaarde ? "afgevinkt als betaald" : "weer op onbetaald gezet"}`,
      boekjaarId: boekjaar.id,
    });

    revalidatePath("/uitgaven");
    revalidatePath(`/uitgaven/${id}`);
    return {};
  });
}
