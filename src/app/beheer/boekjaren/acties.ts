"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { BOEKJAAR_COOKIE } from "@/lib/auth/sessie";
import { controleerEigenWachtwoord } from "@/lib/auth/gebruikers";

import { logAudit } from "@/lib/audit";
import { vereisBestuur } from "@/lib/auth/server";
import { db } from "@/lib/db";
import { vergrendelBoekjaren } from "@/lib/slot";
import { datumUitInvoer } from "@/lib/datum";
import { formatteerEuro, parseerBedragNaarCenten } from "@/lib/geld";
import { leesTekst, voerUit, type ActieStaat } from "@/lib/acties";
import { vereisSchrijfbaarBoekjaar } from "@/lib/boekjaar";

export async function bewaarBoekjaar(
  _vorigeStaat: ActieStaat,
  formulier: FormData,
): Promise<ActieStaat> {
  const sessie = await vereisBestuur();

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
    const beginsaldoSpaarCenten =
      parseerBedragNaarCenten(String(formulier.get("beginsaldoSpaar") || "0"));
    const beginsaldoEigenVermogenCenten =
      parseerBedragNaarCenten(
        String(formulier.get("beginsaldoEigenVermogen") || "0"),
      );
    if (beginsaldoBankCenten === null) veldfouten.beginsaldoBank = "Vul een geldig bedrag in.";
    if (beginsaldoSpaarCenten === null) veldfouten.beginsaldoSpaar = "Vul een geldig bedrag in.";
    if (beginsaldoEigenVermogenCenten === null) veldfouten.beginsaldoEigenVermogen = "Vul een geldig bedrag in.";
    if (Object.keys(veldfouten).length > 0) return { fout: "Controleer de ingevulde gegevens.", veldfouten };

    const id = leesTekst(formulier, "id");

    if (id) {
      const bestaand = await db.boekjaar.findUnique({ where: { id } });
      if (!bestaand?.actief && !bestaand?.reconstructie) {
        return { fout: "Alleen het actieve boekjaar, of een boekjaar in reconstructie, kan gewijzigd worden." };
      }
      const boekjaar = await db.boekjaar.update({
        where: { id },
        data: {
          naam: naam!,
          startDatum: startDatum!,
          eindDatum: eindDatum!,
          beginsaldoBankCenten: beginsaldoBankCenten!,
          beginsaldoSpaarCenten: beginsaldoSpaarCenten!,
          beginsaldoEigenVermogenCenten: beginsaldoEigenVermogenCenten!,
          notities: leesTekst(formulier, "notities") ?? null,
        },
      });

      await logAudit({
        gebruiker: sessie.naam,
        entiteit: "Boekjaar",
        entiteitId: boekjaar.id,
        actie: "gewijzigd",
        samenvatting: `Boekjaar ${boekjaar.naam}: beginsaldo bank ${formatteerEuro(beginsaldoBankCenten!)}, spaarrekening ${formatteerEuro(beginsaldoSpaarCenten!)}, eigen vermogen ${formatteerEuro(beginsaldoEigenVermogenCenten!)}`,
        boekjaarId: boekjaar.id,
      });
    } else {
      const boekjaar = await db.$transaction(async (tx) => {
      await vergrendelBoekjaren(tx);
      const eerste = (await tx.boekjaar.count()) === 0;
      const nieuw = await tx.boekjaar.create({
        data: {
          naam: naam!,
          factuurPrefix: factuurPrefix!,
          startDatum: startDatum!,
          eindDatum: eindDatum!,
          beginsaldoBankCenten: beginsaldoBankCenten!,
          beginsaldoSpaarCenten: beginsaldoSpaarCenten!,
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

    revalidatePath("/beheer/boekjaren");
    revalidatePath("/", "layout");
    return { melding: "Boekjaar opgeslagen." };
  });
}

/**
 * Zet een afgesloten boekjaar open om het alsnog op te bouwen, of sluit het weer.
 *
 * Dit is bedoeld voor de eerste ingebruikname: het vorige bestuursjaar staat nog
 * nergens in de app, en je wilt het invoeren uit de oude bankafschriften. Zolang
 * de schakelaar aanstaat, mag er in dat jaar geboekt worden alsof het actief is.
 * Daarom staat het in het auditlog en is het één knop om het weer dicht te zetten.
 */
export async function zetReconstructie(
  _vorigeStaat: ActieStaat,
  formulier: FormData,
): Promise<ActieStaat> {
  const sessie = await vereisBestuur();

  return voerUit(async () => {
    const id = leesTekst(formulier, "id");
    const aan = leesTekst(formulier, "aan") === "ja";
    if (!id) return { fout: "Onbekend boekjaar." };

    const boekjaar = await db.boekjaar.findUnique({ where: { id } });
    if (!boekjaar) return { fout: "Dit boekjaar bestaat niet meer." };
    if (boekjaar.actief) {
      return { fout: "Het actieve boekjaar is altijd al te bewerken; reconstructie is daar niet voor nodig." };
    }

    await db.boekjaar.update({ where: { id }, data: { reconstructie: aan } });
    if (aan) {
      // Meteen naar dat jaar kijken, anders boek je per ongeluk in het actieve.
      (await cookies()).set(BOEKJAAR_COOKIE, id, { httpOnly: true, sameSite: "lax", path: "/", maxAge: 31536000 });
    }

    await logAudit({
      gebruiker: sessie.naam,
      entiteit: "Boekjaar",
      entiteitId: id,
      actie: aan ? "reconstructie gestart" : "reconstructie afgesloten",
      samenvatting: aan
        ? `Boekjaar ${boekjaar.naam} staat open om op te bouwen uit oude afschriften`
        : `Boekjaar ${boekjaar.naam} is weer alleen-lezen`,
      boekjaarId: id,
    });

    revalidatePath("/", "layout");
    return {
      melding: aan
        ? `${boekjaar.naam} staat open. Je kijkt er nu naar; vergeet hem niet weer te sluiten als je klaar bent.`
        : `${boekjaar.naam} is weer alleen-lezen.`,
    };
  });
}

/** Er is altijd precies één actief boekjaar. */
export async function activeerBoekjaar(
  _vorigeStaat: ActieStaat,
  formulier: FormData,
): Promise<ActieStaat> {
  const sessie = await vereisBestuur();

  return voerUit(async () => {
    const id = leesTekst(formulier, "id");
    if (!id) return { fout: "Onbekend boekjaar." };

    const boekjaar = await db.boekjaar.findUnique({ where: { id } });
    if (!boekjaar) return { fout: "Dit boekjaar bestaat niet meer." };

    await db.$transaction(async (tx) => {
      await vergrendelBoekjaren(tx);
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

    revalidatePath("/beheer/boekjaren");
    revalidatePath("/", "layout");
    return { melding: `${boekjaar.naam} is nu het actieve boekjaar.` };
  });
}

/**
 * Wist alle boekingen van het actieve boekjaar, zodat je opnieuw kunt testen.
 *
 * De inrichting blijft staan: begrotingsposten, evenementen, relaties,
 * instellingen en de soorten spullen. Weg gaan facturen met hun regels en
 * betalingen, uitgaven met bonnetjes, banksaldi, bankimports, deelnemers en
 * omslagrondes. Evenementen gaan terug naar open en de voorraad terug naar de
 * beginstand. Het auditlog blijft bewaard, met een regel over het wissen.
 */
export async function wisBoekingen(
  _vorigeStaat: ActieStaat,
  formulier: FormData,
): Promise<ActieStaat> {
  const sessie = await vereisBestuur();

  return voerUit(async () => {
    const boekjaar = await vereisSchrijfbaarBoekjaar();
    // Het inlogwachtwoord in plaats van de boekjaarnaam overtypen: die naam
    // bevat een middenpunt dat op een toetsenbord lastig te typen is.
    const wachtwoord = String(formulier.get("wachtwoord") ?? "");
    if (!(await controleerEigenWachtwoord(sessie.gebruikerId, wachtwoord))) {
      return { fout: "Het wachtwoord klopt niet. Er is niets gewist." };
    }

    const jaar = boekjaar.id;
    const telling = await db.$transaction(
      async (tx) => {
        await vergrendelBoekjaren(tx);

        // Volgorde telt: bankmutaties verwijzen naar betalingen en uitgaven,
        // en een bankimport naar een banksaldo.
        await tx.bankmutatie.deleteMany({ where: { boekjaarId: jaar } });
        await tx.bankimport.deleteMany({ where: { boekjaarId: jaar } });
        const banksaldi = await tx.banksaldo.deleteMany({ where: { boekjaarId: jaar } });

        const facturen = await tx.factuur.deleteMany({ where: { boekjaarId: jaar } });

        const bijlagen = await tx.uitgave.findMany({
          where: { boekjaarId: jaar, bijlageId: { not: null } },
          select: { bijlageId: true },
        });
        const uitgaven = await tx.uitgave.deleteMany({ where: { boekjaarId: jaar } });
        await tx.bijlage.deleteMany({
          where: { id: { in: bijlagen.map((u) => u.bijlageId!) } },
        });

        await tx.omslagronde.deleteMany({ where: { evenement: { boekjaarId: jaar } } });
        await tx.deelnemer.deleteMany({ where: { evenement: { boekjaarId: jaar } } });
        await tx.evenement.updateMany({ where: { boekjaarId: jaar }, data: { status: "open" } });

        const spullen = await tx.voorraadpost.findMany({ where: { boekjaarId: jaar } });
        for (const post of spullen) {
          await tx.voorraadpost.update({
            where: { id: post.id },
            data: { aantal: post.beginAantal, waardePerStukCenten: post.beginWaardePerStukCenten },
          });
        }

        // Er bestaat geen enkel factuurnummer meer, dus er kan niets dubbel
        // uitgegeven worden.
        await tx.boekjaar.update({ where: { id: jaar }, data: { factuurTeller: 0 } });

        const samenvatting =
          `Alle boekingen van ${boekjaar.naam} gewist: ${facturen.count} facturen, ` +
          `${uitgaven.count} uitgaven, ${banksaldi.count} banksaldi. Inrichting behouden.`;
        await logAudit(
          { gebruiker: sessie.naam, entiteit: "Boekjaar", entiteitId: jaar, actie: "boekingen gewist", samenvatting, boekjaarId: jaar },
          tx,
        );
        return { facturen: facturen.count, uitgaven: uitgaven.count };
      },
      { timeout: 60_000 },
    );

    revalidatePath("/", "layout");
    return {
      melding: `Gewist: ${telling.facturen} facturen en ${telling.uitgaven} uitgaven, plus banksaldi, bankimports en deelnemers. Begroting, evenementen en relaties staan er nog.`,
    };
  });
}
