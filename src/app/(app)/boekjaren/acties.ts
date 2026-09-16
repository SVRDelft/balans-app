"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { BOEKJAAR_COOKIE } from "@/lib/auth/sessie";

import { logAudit } from "@/lib/audit";
import { vereisSessie } from "@/lib/auth/server";
import { db } from "@/lib/db";
import { datumUitInvoer } from "@/lib/datum";
import { formatteerEuro, parseerBedragNaarCenten } from "@/lib/geld";
import { leesTekst, voerUit, type ActieStaat } from "@/lib/acties";

export async function bewaarBoekjaar(
  _vorigeStaat: ActieStaat,
  formulier: FormData,
): Promise<ActieStaat> {
  const sessie = await vereisSessie();

  return voerUit(async () => {
    const naam = leesTekst(formulier, "naam");
    const factuurPrefix = leesTekst(formulier, "factuurPrefix");
    const startDatum = datumUitInvoer(String(formulier.get("startDatum") ?? ""));
    const eindDatum = datumUitInvoer(String(formulier.get("eindDatum") ?? ""));

    const veldfouten: Record<string, string> = {};
    if (!naam) veldfouten.naam = "Vul een naam in.";
    if (!factuurPrefix) {
      veldfouten.factuurPrefix = "Vul een voorvoegsel voor factuurnummers in.";
    } else if (!/^[A-Za-z0-9-]+$/.test(factuurPrefix)) {
      veldfouten.factuurPrefix =
        "Gebruik alleen letters, cijfers en streepjes, bijvoorbeeld SVR62-2026.";
    }
    if (!startDatum) veldfouten.startDatum = "Vul een geldige datum in.";
    if (!eindDatum) veldfouten.eindDatum = "Vul een geldige datum in.";
    if (startDatum && eindDatum && eindDatum <= startDatum) {
      veldfouten.eindDatum = "De einddatum ligt vóór de startdatum.";
    }
    const beginsaldoBankCenten =
      parseerBedragNaarCenten(String(formulier.get("beginsaldoBank") || "0"));
    const beginsaldoEigenVermogenCenten =
      parseerBedragNaarCenten(
        String(formulier.get("beginsaldoEigenVermogen") || "0"),
      );
    if (beginsaldoBankCenten === null) veldfouten.beginsaldoBank = "Vul een geldig bedrag in.";
    if (beginsaldoEigenVermogenCenten === null) veldfouten.beginsaldoEigenVermogen = "Vul een geldig bedrag in.";
    if (Object.keys(veldfouten).length > 0) return { fout: "Controleer de ingevulde gegevens.", veldfouten };

    const id = leesTekst(formulier, "id");

    if (id) {
      const bestaand = await db.boekjaar.findUnique({ where: { id } });
      if (!bestaand?.actief) return { fout: "Alleen het actieve boekjaar kan gewijzigd worden." };
      const boekjaar = await db.boekjaar.update({
        where: { id, actief: true },
        data: {
          naam: naam!,
          startDatum: startDatum!,
          eindDatum: eindDatum!,
          beginsaldoBankCenten: beginsaldoBankCenten!,
          beginsaldoEigenVermogenCenten: beginsaldoEigenVermogenCenten!,
          notities: leesTekst(formulier, "notities") ?? null,
        },
      });

      await logAudit({
        gebruiker: sessie.naam,
        entiteit: "Boekjaar",
        entiteitId: boekjaar.id,
        actie: "gewijzigd",
        samenvatting: `Boekjaar ${boekjaar.naam}: beginsaldo bank ${formatteerEuro(beginsaldoBankCenten!)}, eigen vermogen ${formatteerEuro(beginsaldoEigenVermogenCenten!)}`,
        boekjaarId: boekjaar.id,
      });
    } else {
      const boekjaar = await db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(6282026)::text`;
      const eerste = (await tx.boekjaar.count()) === 0;
      const nieuw = await tx.boekjaar.create({
        data: {
          naam: naam!,
          factuurPrefix: factuurPrefix!,
          startDatum: startDatum!,
          eindDatum: eindDatum!,
          beginsaldoBankCenten: beginsaldoBankCenten!,
          beginsaldoEigenVermogenCenten: beginsaldoEigenVermogenCenten!,
          notities: leesTekst(formulier, "notities") ?? null,
          actief: eerste,
        },
      });
      const bronId = leesTekst(formulier, "kopieerVan");
      if (bronId) {
        const bron = await tx.boekjaar.findUnique({ where: { id: bronId }, include: { begrotingsposten: true } });
        if (!bron) throw new Error("Het gekozen boekjaar bestaat niet meer.");
        await tx.begrotingspost.createMany({ data: bron.begrotingsposten.map(({ code, naam, categorie, soort, begrootCenten, volgorde, notities }) => ({ boekjaarId: nieuw.id, code, naam, categorie, soort, begrootCenten, volgorde, notities })) });
      }
      return nieuw;
      });
      if (boekjaar.actief) (await cookies()).set(BOEKJAAR_COOKIE, boekjaar.id, { httpOnly: true, sameSite: "lax", path: "/", maxAge: 31536000 });

      await logAudit({
        gebruiker: sessie.naam,
        entiteit: "Boekjaar",
        entiteitId: boekjaar.id,
        actie: "aangemaakt",
        samenvatting: `Boekjaar ${boekjaar.naam} aangemaakt`,
        boekjaarId: boekjaar.id,
      });
    }

    revalidatePath("/boekjaren");
    revalidatePath("/", "layout");
    return { melding: "Boekjaar opgeslagen." };
  });
}

/** Er is altijd precies één actief boekjaar. */
export async function activeerBoekjaar(
  _vorigeStaat: ActieStaat,
  formulier: FormData,
): Promise<ActieStaat> {
  const sessie = await vereisSessie();

  return voerUit(async () => {
    const id = leesTekst(formulier, "id");
    if (!id) return { fout: "Onbekend boekjaar." };

    const boekjaar = await db.boekjaar.findUnique({ where: { id } });
    if (!boekjaar) return { fout: "Dit boekjaar bestaat niet meer." };

    await db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(6282026)::text`;
      await tx.boekjaar.updateMany({
        where: { actief: true },
        data: { actief: false },
      });
      await tx.boekjaar.update({ where: { id }, data: { actief: true } });
    });
    (await cookies()).set(BOEKJAAR_COOKIE, id, { httpOnly: true, sameSite: "lax", path: "/", maxAge: 31536000 });

    await logAudit({
      gebruiker: sessie.naam,
      entiteit: "Boekjaar",
      entiteitId: id,
      actie: "geactiveerd",
      samenvatting: `Boekjaar ${boekjaar.naam} is nu het actieve boekjaar`,
      boekjaarId: id,
    });

    revalidatePath("/boekjaren");
    revalidatePath("/", "layout");
    return { melding: `${boekjaar.naam} is nu het actieve boekjaar.` };
  });
}
