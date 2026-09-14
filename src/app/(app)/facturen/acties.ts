"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { logAudit } from "@/lib/audit";
import { vereisSessie } from "@/lib/auth/server";
import { vereisSchrijfbaarBoekjaar } from "@/lib/boekjaar";
import { db } from "@/lib/db";
import { datumUitInvoer, telDagenOp, vandaag } from "@/lib/datum";
import { isVergrendeld } from "@/lib/domein";
import {
  betaaldBedrag,
  hertelFactuur,
  volgendFactuurnummer,
} from "@/lib/facturen";
import { formatteerEuro, parseerBedragNaarCenten, verdeelCenten } from "@/lib/geld";
import { leesTekst, voerUit, type ActieStaat } from "@/lib/acties";

const regelSchema = z.object({
  omschrijving: z.string().trim().min(1, "Elke regel heeft een omschrijving."),
  aantal: z.number().int().min(1, "Een aantal is minimaal 1.").max(100_000),
  prijsPerStukCenten: z.number().int(),
  begrotingspostId: z.string().min(1, "Kies een begrotingspost."),
});

function leesRegels(formulier: FormData) {
  const ruw = String(formulier.get("regelsJson") ?? "[]");
  let ontleed: unknown;
  try {
    ontleed = JSON.parse(ruw);
  } catch {
    return { fout: "De factuurregels konden niet gelezen worden." as const };
  }

  const uitkomst = z.array(regelSchema).min(1).safeParse(ontleed);
  if (!uitkomst.success) {
    return {
      fout:
        uitkomst.error.issues[0]?.message ??
        "Voeg minstens één factuurregel toe.",
    };
  }
  return { regels: uitkomst.data };
}

export async function bewaarFactuur(
  _vorigeStaat: ActieStaat,
  formulier: FormData,
): Promise<ActieStaat> {
  const sessie = await vereisSessie();

  let doel = "/facturen";

  const resultaat = await voerUit(async () => {
    const boekjaar = await vereisSchrijfbaarBoekjaar();

    const id = leesTekst(formulier, "id");
    const relatieId = leesTekst(formulier, "relatieId");
    const omschrijving = leesTekst(formulier, "omschrijving");
    const factuurdatum = datumUitInvoer(String(formulier.get("factuurdatum") ?? ""));
    const vervaldatum = datumUitInvoer(String(formulier.get("vervaldatum") ?? ""));
    const evenementId = leesTekst(formulier, "evenementId") ?? null;

    const veldfouten: Record<string, string> = {};
    if (!relatieId) veldfouten.relatieId = "Kies een relatie.";
    if (!omschrijving) veldfouten.omschrijving = "Vul een omschrijving in.";
    if (!factuurdatum) veldfouten.factuurdatum = "Vul een geldige datum in.";
    if (!vervaldatum) veldfouten.vervaldatum = "Vul een geldige datum in.";
    if (factuurdatum && vervaldatum && vervaldatum < factuurdatum) {
      veldfouten.vervaldatum = "De vervaldatum ligt vóór de factuurdatum.";
    }

    const regelsUitkomst = leesRegels(formulier);
    if ("fout" in regelsUitkomst) {
      return { fout: regelsUitkomst.fout, veldfouten };
    }
    if (Object.keys(veldfouten).length > 0) {
      return { fout: "Controleer de ingevulde gegevens.", veldfouten };
    }

    const regels = regelsUitkomst.regels.map((regel, volgorde) => ({
      omschrijving: regel.omschrijving,
      aantal: regel.aantal,
      prijsPerStukCenten: regel.prijsPerStukCenten,
      bedragCenten: regel.aantal * regel.prijsPerStukCenten,
      begrotingspostId: regel.begrotingspostId,
      volgorde,
    }));

    if (id) {
      const bestaand = await db.factuur.findUnique({ where: { id } });
      if (!bestaand) return { fout: "Deze factuur bestaat niet meer." };
      if (isVergrendeld(bestaand.status)) {
        return {
          fout:
            "Deze factuur is al verstuurd en kan niet meer inhoudelijk gewijzigd worden. Maak een creditfactuur om te corrigeren.",
        };
      }

      await db.$transaction(async (tx) => {
        await tx.factuurregel.deleteMany({ where: { factuurId: id } });
        await tx.factuur.update({
          where: { id },
          data: {
            relatieId: relatieId!,
            omschrijving: omschrijving!,
            factuurdatum: factuurdatum!,
            vervaldatum: vervaldatum!,
            evenementId,
            notities: leesTekst(formulier, "notities") ?? null,
            regels: { create: regels },
          },
        });
        await hertelFactuur(tx, id);
      });

      await logAudit({
        gebruiker: sessie.naam,
        entiteit: "Factuur",
        entiteitId: id,
        actie: "gewijzigd",
        samenvatting: `Concept ${bestaand.nummer} gewijzigd`,
        boekjaarId: boekjaar.id,
      });

      doel = `/facturen/${id}`;
      return;
    }

    const nieuweId = await db.$transaction(async (tx) => {
      const { nummer, volgnummer } = await volgendFactuurnummer(tx, boekjaar.id);
      const factuur = await tx.factuur.create({
        data: {
          boekjaarId: boekjaar.id,
          nummer,
          volgnummer,
          relatieId: relatieId!,
          omschrijving: omschrijving!,
          factuurdatum: factuurdatum!,
          vervaldatum: vervaldatum!,
          evenementId,
          notities: leesTekst(formulier, "notities") ?? null,
          status: "concept",
          regels: { create: regels },
        },
      });
      await hertelFactuur(tx, factuur.id);
      return factuur.id;
    });

    const gemaakt = await db.factuur.findUniqueOrThrow({
      where: { id: nieuweId },
    });
    await logAudit({
      gebruiker: sessie.naam,
      entiteit: "Factuur",
      entiteitId: nieuweId,
      actie: "aangemaakt",
      samenvatting: `Factuur ${gemaakt.nummer} aangemaakt voor ${formatteerEuro(gemaakt.totaalCenten)}`,
      boekjaarId: boekjaar.id,
    });

    doel = `/facturen/${nieuweId}`;
  });

  if (resultaat.fout) return resultaat;

  revalidatePath("/facturen");
  redirect(doel);
}

export async function verstuurFactuur(
  _vorigeStaat: ActieStaat,
  formulier: FormData,
): Promise<ActieStaat> {
  const sessie = await vereisSessie();

  return voerUit(async () => {
    const boekjaar = await vereisSchrijfbaarBoekjaar();
    const id = leesTekst(formulier, "id");
    if (!id) return { fout: "Onbekende factuur." };

    const factuur = await db.factuur.findUnique({
      where: { id },
      include: { regels: true },
    });
    if (!factuur) return { fout: "Deze factuur bestaat niet meer." };
    if (factuur.status !== "concept") {
      return { fout: "Deze factuur is al verstuurd." };
    }
    if (factuur.regels.length === 0) {
      return { fout: "Een factuur zonder regels kan niet verstuurd worden." };
    }

    await db.factuur.update({
      where: { id },
      data: { status: "verstuurd", verstuurdOp: new Date() },
    });

    await logAudit({
      gebruiker: sessie.naam,
      entiteit: "Factuur",
      entiteitId: id,
      actie: "verstuurd",
      samenvatting: `Factuur ${factuur.nummer} op verstuurd gezet (${formatteerEuro(factuur.totaalCenten)})`,
      boekjaarId: boekjaar.id,
    });

    revalidatePath("/facturen");
    revalidatePath(`/facturen/${id}`);
    return { melding: "De factuur staat nu op verstuurd en is vergrendeld." };
  });
}

export async function registreerBetaling(
  _vorigeStaat: ActieStaat,
  formulier: FormData,
): Promise<ActieStaat> {
  const sessie = await vereisSessie();

  return voerUit(async () => {
    const boekjaar = await vereisSchrijfbaarBoekjaar();
    const factuurId = leesTekst(formulier, "factuurId");
    if (!factuurId) return { fout: "Onbekende factuur." };

    const factuur = await db.factuur.findUnique({
      where: { id: factuurId },
      include: { betalingen: true },
    });
    if (!factuur) return { fout: "Deze factuur bestaat niet meer." };
    if (factuur.status === "concept") {
      return {
        fout: "Zet de factuur eerst op verstuurd voordat je een betaling registreert.",
      };
    }

    const bedragCenten = parseerBedragNaarCenten(
      String(formulier.get("bedrag") ?? ""),
    );
    if (bedragCenten === null || bedragCenten === 0) {
      return { fout: "Vul een bedrag in." };
    }

    const datum = datumUitInvoer(String(formulier.get("datum") ?? ""));
    if (!datum) return { fout: "Vul een geldige datum in." };

    await db.$transaction(async (tx) => {
      await tx.betaling.create({
        data: {
          factuurId,
          datum,
          bedragCenten,
          notitie: leesTekst(formulier, "notitie") ?? null,
          geregistreerdDoor: sessie.naam,
        },
      });
      await hertelFactuur(tx, factuurId);
    });

    const nieuwBetaald = betaaldBedrag(factuur.betalingen) + bedragCenten;
    await logAudit({
      gebruiker: sessie.naam,
      entiteit: "Betaling",
      entiteitId: factuurId,
      actie: "aangemaakt",
      samenvatting: `Betaling ${formatteerEuro(bedragCenten)} op ${factuur.nummer}; totaal ontvangen ${formatteerEuro(nieuwBetaald)} van ${formatteerEuro(factuur.totaalCenten)}`,
      boekjaarId: boekjaar.id,
    });

    revalidatePath("/facturen");
    revalidatePath(`/facturen/${factuurId}`);
    return { melding: `Betaling van ${formatteerEuro(bedragCenten)} vastgelegd.` };
  });
}

export async function verwijderBetaling(
  _vorigeStaat: ActieStaat,
  formulier: FormData,
): Promise<ActieStaat> {
  const sessie = await vereisSessie();

  return voerUit(async () => {
    const boekjaar = await vereisSchrijfbaarBoekjaar();
    const id = leesTekst(formulier, "id");
    if (!id) return { fout: "Onbekende betaling." };

    const betaling = await db.betaling.findUnique({
      where: { id },
      include: { factuur: true },
    });
    if (!betaling) return { fout: "Deze betaling bestaat niet meer." };

    await db.$transaction(async (tx) => {
      await tx.betaling.delete({ where: { id } });
      await hertelFactuur(tx, betaling.factuurId);
    });

    await logAudit({
      gebruiker: sessie.naam,
      entiteit: "Betaling",
      entiteitId: betaling.factuurId,
      actie: "verwijderd",
      samenvatting: `Betaling ${formatteerEuro(betaling.bedragCenten)} op ${betaling.factuur.nummer} verwijderd`,
      boekjaarId: boekjaar.id,
    });

    revalidatePath(`/facturen/${betaling.factuurId}`);
    return { melding: "Betaling verwijderd." };
  });
}

export async function zetStatus(
  _vorigeStaat: ActieStaat,
  formulier: FormData,
): Promise<ActieStaat> {
  const sessie = await vereisSessie();

  return voerUit(async () => {
    const boekjaar = await vereisSchrijfbaarBoekjaar();
    const id = leesTekst(formulier, "id");
    const nieuweStatus = leesTekst(formulier, "status");
    if (!id || !nieuweStatus) return { fout: "Onvolledige opdracht." };

    if (nieuweStatus !== "oninbaar" && nieuweStatus !== "verstuurd") {
      return { fout: "Deze status kan niet handmatig gezet worden." };
    }

    const factuur = await db.factuur.findUnique({ where: { id } });
    if (!factuur) return { fout: "Deze factuur bestaat niet meer." };
    if (factuur.status === "concept") {
      return { fout: "Een concept heeft nog geen status om te wijzigen." };
    }
    if (factuur.status === "gecrediteerd") {
      return { fout: "Een gecrediteerde factuur blijft gecrediteerd." };
    }

    await db.$transaction(async (tx) => {
      await tx.factuur.update({ where: { id }, data: { status: nieuweStatus } });
      if (nieuweStatus === "verstuurd") {
        // Terugzetten: de status moet weer uit de betalingen volgen.
        await hertelFactuur(tx, id);
      }
    });

    await logAudit({
      gebruiker: sessie.naam,
      entiteit: "Factuur",
      entiteitId: id,
      actie: "status gewijzigd",
      samenvatting: `Factuur ${factuur.nummer}: ${factuur.status} → ${nieuweStatus}`,
      boekjaarId: boekjaar.id,
    });

    revalidatePath("/facturen");
    revalidatePath(`/facturen/${id}`);
    return { melding: "Status bijgewerkt." };
  });
}

export async function maakCreditfactuur(
  _vorigeStaat: ActieStaat,
  formulier: FormData,
): Promise<ActieStaat> {
  const sessie = await vereisSessie();

  let doel = "/facturen";

  const resultaat = await voerUit(async () => {
    const boekjaar = await vereisSchrijfbaarBoekjaar();
    const id = leesTekst(formulier, "id");
    if (!id) return { fout: "Onbekende factuur." };

    const origineel = await db.factuur.findUnique({
      where: { id },
      include: { regels: true, creditfactuur: true },
    });
    if (!origineel) return { fout: "Deze factuur bestaat niet meer." };
    if (origineel.status === "concept") {
      return {
        fout: "Een concept hoef je niet te crediteren; je kunt het gewoon aanpassen of verwijderen.",
      };
    }
    if (origineel.creditfactuur) {
      return { fout: "Voor deze factuur bestaat al een creditfactuur." };
    }

    const creditId = await db.$transaction(async (tx) => {
      const { nummer, volgnummer } = await volgendFactuurnummer(tx, boekjaar.id);
      const credit = await tx.factuur.create({
        data: {
          boekjaarId: boekjaar.id,
          nummer,
          volgnummer,
          relatieId: origineel.relatieId,
          omschrijving: `Creditering van ${origineel.nummer} — ${origineel.omschrijving}`,
          factuurdatum: vandaag(),
          vervaldatum: vandaag(),
          status: "concept",
          soort: "credit",
          evenementId: origineel.evenementId,
          omslagrondeId: origineel.omslagrondeId,
          crediteertFactuurId: origineel.id,
          regels: {
            create: origineel.regels.map((regel, volgorde) => ({
              omschrijving: regel.omschrijving,
              aantal: regel.aantal,
              prijsPerStukCenten: -regel.prijsPerStukCenten,
              bedragCenten: -regel.bedragCenten,
              begrotingspostId: regel.begrotingspostId,
              volgorde,
            })),
          },
        },
      });

      await tx.factuur.update({
        where: { id: origineel.id },
        data: { status: "gecrediteerd" },
      });

      await hertelFactuur(tx, credit.id);
      return credit.id;
    });

    await logAudit({
      gebruiker: sessie.naam,
      entiteit: "Factuur",
      entiteitId: creditId,
      actie: "gecrediteerd",
      samenvatting: `Creditfactuur aangemaakt voor ${origineel.nummer}`,
      boekjaarId: boekjaar.id,
    });

    doel = `/facturen/${creditId}`;
  });

  if (resultaat.fout) return resultaat;

  revalidatePath("/facturen");
  redirect(doel);
}

export async function verwijderConcept(
  _vorigeStaat: ActieStaat,
  formulier: FormData,
): Promise<ActieStaat> {
  const sessie = await vereisSessie();

  const resultaat = await voerUit(async () => {
    const boekjaar = await vereisSchrijfbaarBoekjaar();
    const id = leesTekst(formulier, "id");
    if (!id) return { fout: "Onbekende factuur." };

    const factuur = await db.factuur.findUnique({ where: { id } });
    if (!factuur) return { fout: "Deze factuur bestaat niet meer." };
    if (factuur.status !== "concept") {
      return {
        fout: "Alleen een concept kan verwijderd worden. Gebruik anders een creditfactuur.",
      };
    }

    await db.factuur.delete({ where: { id } });

    await logAudit({
      gebruiker: sessie.naam,
      entiteit: "Factuur",
      entiteitId: id,
      actie: "verwijderd",
      // Het nummer komt niet terug in omloop.
      samenvatting: `Concept ${factuur.nummer} verwijderd; het nummer wordt niet hergebruikt`,
      boekjaarId: boekjaar.id,
    });
  });

  if (resultaat.fout) return resultaat;

  revalidatePath("/facturen");
  redirect("/facturen");
}

/**
 * Maakt in één keer voor alle bijdrageplichtige studieverenigingen een factuur
 * met het bedrag uit de begroting.
 */
export async function genereerJaarfacturen(
  _vorigeStaat: ActieStaat,
  formulier: FormData,
): Promise<ActieStaat> {
  const sessie = await vereisSessie();

  return voerUit(async () => {
    const boekjaar = await vereisSchrijfbaarBoekjaar();

    const begrotingspostId = leesTekst(formulier, "begrotingspostId");
    if (!begrotingspostId) return { fout: "Kies de begrotingspost." };

    const post = await db.begrotingspost.findUnique({
      where: { id: begrotingspostId },
    });
    if (!post || post.boekjaarId !== boekjaar.id) {
      return { fout: "Deze begrotingspost hoort niet bij dit boekjaar." };
    }

    const factuurdatum = datumUitInvoer(String(formulier.get("factuurdatum") ?? ""));
    if (!factuurdatum) return { fout: "Vul een geldige factuurdatum in." };

    const instellingen = await db.instellingen.findUnique({ where: { id: "svr" } });
    const vervaldatum = telDagenOp(
      factuurdatum,
      instellingen?.betaaltermijnDagen ?? 30,
    );

    const verenigingen = await db.relatie.findMany({
      where: { type: "studievereniging", bijdragePlichtig: true, actief: true },
      orderBy: { naam: "asc" },
    });
    if (verenigingen.length === 0) {
      return { fout: "Er zijn geen actieve bijdrageplichtige studieverenigingen." };
    }

    const alBestaand = await db.factuur.findMany({
      where: {
        boekjaarId: boekjaar.id,
        relatieId: { in: verenigingen.map((vereniging) => vereniging.id) },
        regels: { some: { begrotingspostId } },
      },
      select: { relatieId: true },
    });
    const alGehad = new Set(alBestaand.map((factuur) => factuur.relatieId));

    const teMaken = verenigingen.filter(
      (vereniging) => !alGehad.has(vereniging.id),
    );
    if (teMaken.length === 0) {
      return {
        fout: "Alle bijdrageplichtige verenigingen hebben al een factuur voor deze post.",
      };
    }

    // Het begrote totaal wordt exact verdeeld over álle bijdrageplichtige
    // verenigingen, ook de verenigingen die al een factuur hebben.
    const bedragen = verdeelCenten(
      post.begrootCenten,
      verenigingen.map(() => 1),
    );
    const bedragPerVereniging = new Map(
      verenigingen.map((vereniging, index) => [vereniging.id, bedragen[index]]),
    );

    const gemaakt: string[] = [];

    await db.$transaction(async (tx) => {
      for (const vereniging of teMaken) {
        const { nummer, volgnummer } = await volgendFactuurnummer(
          tx,
          boekjaar.id,
        );
        const bedragCenten = bedragPerVereniging.get(vereniging.id) ?? 0;

        const factuur = await tx.factuur.create({
          data: {
            boekjaarId: boekjaar.id,
            nummer,
            volgnummer,
            relatieId: vereniging.id,
            omschrijving: `Jaarlijkse bijdrage ${boekjaar.naam}`,
            factuurdatum,
            vervaldatum,
            status: "concept",
            regels: {
              create: [
                {
                  omschrijving: `Bijdrage aangesloten studievereniging ${boekjaar.naam}`,
                  aantal: 1,
                  prijsPerStukCenten: bedragCenten,
                  bedragCenten,
                  begrotingspostId,
                  volgorde: 0,
                },
              ],
            },
          },
        });
        await hertelFactuur(tx, factuur.id);
        gemaakt.push(nummer);
      }
    });

    await logAudit({
      gebruiker: sessie.naam,
      entiteit: "Factuur",
      actie: "jaarfacturen gegenereerd",
      samenvatting: `${gemaakt.length} jaarfacturen aangemaakt voor post ${post.code}`,
      details: { nummers: gemaakt },
      boekjaarId: boekjaar.id,
    });

    revalidatePath("/facturen");
    return {
      melding: `${gemaakt.length} concepten aangemaakt (${gemaakt[0]} t/m ${gemaakt[gemaakt.length - 1]}). Controleer ze en zet ze daarna op verstuurd.`,
    };
  });
}
