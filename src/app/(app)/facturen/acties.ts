"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { logAudit } from "@/lib/audit";
import { vereisSessie } from "@/lib/auth/server";
import { vereisSchrijfbaarBoekjaar } from "@/lib/boekjaar";
import { controleerKoppelingen } from "@/lib/boekjaar-koppelingen";
import { db } from "@/lib/db";
import { datumUitInvoer, telDagenOp, vandaag } from "@/lib/datum";
import { isVergrendeld } from "@/lib/domein";
import {
  type DbClient,
  betaaldBedrag,
  hertelFactuur,
  vergrendelFactuur,
  volgendFactuurnummer,
} from "@/lib/facturen";
import {
  formatteerEuro,
  parseerBedragNaarCenten,
  verdeelCenten,
} from "@/lib/geld";
import { leesTekst, voerUit, type ActieStaat } from "@/lib/acties";
import { factuurOpenstaand } from "@/lib/finance/factuurstanden";
import { factuurStandRelaties } from "@/lib/factuur-includes";

const regelSchema = z
  .object({
    omschrijving: z
      .string()
      .trim()
      .min(1, "Elke regel heeft een omschrijving."),
    aantal: z.number().int().min(1, "Een aantal is minimaal 1.").max(100_000),
    prijsPerStukCenten: z.number().int(),
    begrotingspostId: z.string().min(1, "Kies een begrotingspost."),
  })
  .refine(
    (regel) =>
      Math.abs(regel.aantal * regel.prijsPerStukCenten) <= 2_147_483_647,
    "Het regelbedrag is te groot.",
  );

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
  if (
    Math.abs(
      uitkomst.data.reduce(
        (som, regel) => som + regel.aantal * regel.prijsPerStukCenten,
        0,
      ),
    ) > 2_147_483_647
  )
    return { fout: "Het factuurtotaal is te groot." };
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
    // Een nieuwe factuur mag voor meerdere relaties tegelijk: dan krijgt elke
    // relatie een eigen factuur met dezelfde regels, zoals bij een LBG.
    const relatieIds = [
      ...new Set(
        formulier
          .getAll("relatieId")
          .filter((waarde): waarde is string => typeof waarde === "string" && waarde.trim() !== "")
          .map((waarde) => waarde.trim()),
      ),
    ];
    const relatieId = relatieIds[0];
    const verstuurNu = !id && formulier.get("verstuurNu") === "aan";
    const omschrijving = leesTekst(formulier, "omschrijving");
    const factuurdatum = datumUitInvoer(
      String(formulier.get("factuurdatum") ?? ""),
    );
    const vervaldatum = datumUitInvoer(
      String(formulier.get("vervaldatum") ?? ""),
    );
    const evenementId = leesTekst(formulier, "evenementId") ?? null;

    const veldfouten: Record<string, string> = {};
    if (!relatieId) veldfouten.relatieId = "Kies een relatie.";
    if (id && relatieIds.length > 1) veldfouten.relatieId = "Een bestaand concept hoort bij één relatie.";
    if (relatieIds.length > 200) veldfouten.relatieId = "Kies maximaal 200 relaties tegelijk.";
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

    await controleerKoppelingen(
      boekjaar.id,
      regelsUitkomst.regels.map((regel) => regel.begrotingspostId),
      evenementId,
    );

    const regels = regelsUitkomst.regels.map((regel, volgorde) => ({
      omschrijving: regel.omschrijving,
      aantal: regel.aantal,
      prijsPerStukCenten: regel.prijsPerStukCenten,
      bedragCenten: regel.aantal * regel.prijsPerStukCenten,
      begrotingspostId: regel.begrotingspostId,
      volgorde,
    }));

    if (id) {
      const bestaand = await db.factuur.findUnique({
        where: { id, boekjaarId: boekjaar.id },
        include: { crediteertFactuur: true },
      });
      if (!bestaand) return { fout: "Deze factuur bestaat niet meer." };
      if (isVergrendeld(bestaand.status)) {
        return {
          fout: "Deze factuur is al verstuurd en kan niet meer inhoudelijk gewijzigd worden. Maak een creditfactuur om te corrigeren.",
        };
      }
      if (
        bestaand.crediteertFactuur &&
        (relatieId !== bestaand.crediteertFactuur.relatieId ||
          evenementId !== bestaand.crediteertFactuur.evenementId)
      ) {
        return {
          fout: "Een creditfactuur houdt dezelfde relatie en hetzelfde evenement als de oorspronkelijke factuur.",
        };
      }
      if (
        bestaand.crediteertFactuur &&
        (regels.reduce((som, regel) => som + regel.bedragCenten, 0) > 0 ||
          regels.reduce((som, regel) => som + regel.bedragCenten, 0) <
            -bestaand.crediteertFactuur.totaalCenten)
      ) {
        return {
          fout: "Het creditbedrag ligt tussen nul en het negatieve bedrag van de oorspronkelijke factuur.",
        };
      }

      await db.$transaction(async (tx) => {
        await vergrendelFactuur(tx, id, boekjaar.id);
        await tx.factuurregel.deleteMany({ where: { factuurId: id } });
        await tx.factuur.update({
          where: { id, boekjaarId: boekjaar.id, status: "concept" },
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

    const bestaandeRelaties = await db.relatie.count({ where: { id: { in: relatieIds } } });
    if (bestaandeRelaties !== relatieIds.length) {
      return { fout: "Een van de gekozen relaties bestaat niet meer. Ververs de pagina." };
    }

    const gemaakt = await db.$transaction(
      async (tx) => {
        const facturen: { id: string; nummer: string; totaalCenten: number }[] = [];
        for (const voorRelatie of relatieIds) {
          const { nummer, volgnummer } = await volgendFactuurnummer(
            tx,
            boekjaar.id,
          );
          const factuur = await tx.factuur.create({
            data: {
              boekjaarId: boekjaar.id,
              nummer,
              volgnummer,
              relatieId: voorRelatie,
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
          if (verstuurNu) await zetOpVerstuurd(tx, factuur.id, boekjaar.id);
          const totaal = regels.reduce((som, regel) => som + regel.bedragCenten, 0);
          facturen.push({ id: factuur.id, nummer, totaalCenten: totaal });
        }
        return facturen;
      },
      { timeout: 120_000 },
    );

    for (const factuur of gemaakt) {
      await logAudit({
        gebruiker: sessie.naam,
        entiteit: "Factuur",
        entiteitId: factuur.id,
        actie: verstuurNu ? "aangemaakt en verstuurd" : "aangemaakt",
        samenvatting: `Factuur ${factuur.nummer} aangemaakt${verstuurNu ? " en op verstuurd gezet" : ""} voor ${formatteerEuro(factuur.totaalCenten)}`,
        boekjaarId: boekjaar.id,
      });
    }

    doel =
      gemaakt.length === 1
        ? `/facturen/${gemaakt[0].id}`
        : `/facturen?q=${encodeURIComponent(omschrijving!)}`;
  });

  if (resultaat.fout) return resultaat;

  revalidatePath("/facturen");
  redirect(doel);
}

/** Zet één concept op verstuurd, met dezelfde controles als de losse knop. */
async function zetOpVerstuurd(tx: DbClient, id: string, boekjaarId: string) {
  await vergrendelFactuur(tx, id, boekjaarId);
  const actueel = await tx.factuur.findUniqueOrThrow({
    where: { id, boekjaarId },
    include: { crediteertFactuur: true },
  });
  if (actueel.crediteertFactuur?.status === "oninbaar")
    throw new Error(
      "Herstel de oorspronkelijke factuur voordat je de credit verstuurt.",
    );
  if (
    actueel.crediteertFactuur &&
    (actueel.relatieId !== actueel.crediteertFactuur.relatieId ||
      actueel.evenementId !== actueel.crediteertFactuur.evenementId ||
      actueel.totaalCenten > 0 ||
      actueel.totaalCenten < -actueel.crediteertFactuur.totaalCenten)
  ) {
    throw new Error(
      "Controleer het creditconcept: relatie, evenement en bedrag moeten aansluiten op de oorspronkelijke factuur.",
    );
  }
  await tx.factuur.update({
    where: { id, boekjaarId, status: "concept" },
    data: { status: "verstuurd", verstuurdOp: new Date() },
  });
  await hertelFactuur(tx, id);
}

/**
 * Zet een reeks concepten in één keer op verstuurd, bijvoorbeeld de facturen
 * van een omslag of een LBG. Creditconcepten en lege concepten blijven staan.
 */
export async function verstuurConcepten(
  _vorigeStaat: ActieStaat,
  formulier: FormData,
): Promise<ActieStaat> {
  const sessie = await vereisSessie();

  return voerUit(async () => {
    const boekjaar = await vereisSchrijfbaarBoekjaar();
    const ids = [
      ...new Set(
        formulier
          .getAll("factuurId")
          .filter((waarde): waarde is string => typeof waarde === "string" && waarde !== ""),
      ),
    ];
    if (ids.length === 0) return { fout: "Kies minstens één concept." };

    const concepten = await db.factuur.findMany({
      where: {
        id: { in: ids },
        boekjaarId: boekjaar.id,
        status: "concept",
        crediteertFactuurId: null,
        regels: { some: {} },
      },
      select: { id: true, nummer: true, totaalCenten: true },
      orderBy: { volgnummer: "asc" },
    });
    if (concepten.length === 0) {
      return { fout: "Geen van deze facturen kan nog op verstuurd; ververs de pagina." };
    }

    await db.$transaction(
      async (tx) => {
        for (const concept of concepten) await zetOpVerstuurd(tx, concept.id, boekjaar.id);
      },
      { timeout: 120_000 },
    );

    const totaal = concepten.reduce((som, concept) => som + concept.totaalCenten, 0);
    await logAudit({
      gebruiker: sessie.naam,
      entiteit: "Factuur",
      actie: "verstuurd",
      samenvatting: `${concepten.length} concepten op verstuurd gezet (${formatteerEuro(totaal)})`,
      details: { nummers: concepten.map((concept) => concept.nummer) },
      boekjaarId: boekjaar.id,
    });

    revalidatePath("/facturen");
    const overgeslagen = ids.length - concepten.length;
    return {
      melding: `${concepten.length} ${concepten.length === 1 ? "factuur staat" : "facturen staan"} nu op verstuurd (${formatteerEuro(totaal)}).${overgeslagen ? ` ${overgeslagen} overgeslagen: creditconcept, leeg of al verstuurd.` : ""}`,
    };
  });
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
      where: { id, boekjaarId: boekjaar.id },
      include: { regels: true },
    });
    if (!factuur) return { fout: "Deze factuur bestaat niet meer." };
    if (factuur.status !== "concept") {
      return { fout: "Deze factuur is al verstuurd." };
    }
    if (factuur.regels.length === 0) {
      return { fout: "Een factuur zonder regels kan niet verstuurd worden." };
    }

    await db.$transaction((tx) => zetOpVerstuurd(tx, id, boekjaar.id));

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
      where: { id: factuurId, boekjaarId: boekjaar.id },
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
      await vergrendelFactuur(tx, factuurId, boekjaar.id);
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
    return {
      melding: `Betaling van ${formatteerEuro(bedragCenten)} vastgelegd.`,
    };
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
      where: { id, factuur: { boekjaarId: boekjaar.id } },
      include: { factuur: true },
    });
    if (!betaling) return { fout: "Deze betaling bestaat niet meer." };

    await db.$transaction(async (tx) => {
      await vergrendelFactuur(tx, betaling.factuurId, boekjaar.id);
      await tx.betaling.delete({
        where: { id, factuur: { boekjaarId: boekjaar.id } },
      });
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

    const factuur = await db.factuur.findUnique({
      where: { id, boekjaarId: boekjaar.id },
      include: { betalingen: true, ...factuurStandRelaties },
    });
    if (!factuur) return { fout: "Deze factuur bestaat niet meer." };
    if (factuur.status === "concept") {
      return { fout: "Een concept heeft nog geen status om te wijzigen." };
    }
    await db.$transaction(async (tx) => {
      await vergrendelFactuur(tx, id, boekjaar.id);
      const actueel = await tx.factuur.findUniqueOrThrow({
        where: { id, boekjaarId: boekjaar.id },
        include: { betalingen: true, ...factuurStandRelaties },
      });
      if (
        nieuweStatus === "oninbaar" &&
        (actueel.crediteertFactuurId || factuurOpenstaand(actueel) <= 0)
      ) {
        throw new Error(
          "Alleen een nog te ontvangen bedrag op de oorspronkelijke factuur kan oninbaar worden afgeboekt.",
        );
      }
      if (nieuweStatus === "verstuurd" && actueel.status !== "oninbaar")
        throw new Error("Alleen een oninbare factuur kan worden hersteld.");
      await tx.factuur.update({
        where: { id, boekjaarId: boekjaar.id },
        data: { status: nieuweStatus },
      });
      await hertelFactuur(tx, id);
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
      where: { id, boekjaarId: boekjaar.id },
      include: { regels: true, creditfactuur: true },
    });
    if (!origineel) return { fout: "Deze factuur bestaat niet meer." };
    if (origineel.totaalCenten <= 0)
      return {
        fout: "Maak een credit voor een factuur met een positief totaal.",
      };
    if (origineel.soort === "credit" || origineel.status === "oninbaar")
      return {
        fout: "Crediteer een gewone factuur. Herstel een oninbare factuur eerst.",
      };
    if (origineel.status === "concept") {
      return {
        fout: "Een concept hoef je niet te crediteren; je kunt het gewoon aanpassen of verwijderen.",
      };
    }
    if (origineel.creditfactuur) {
      return { fout: "Voor deze factuur bestaat al een creditfactuur." };
    }

    const creditId = await db.$transaction(async (tx) => {
      const { nummer, volgnummer } = await volgendFactuurnummer(
        tx,
        boekjaar.id,
      );
      await vergrendelFactuur(tx, origineel.id, boekjaar.id);
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

    const factuur = await db.factuur.findUnique({
      where: { id, boekjaarId: boekjaar.id },
    });
    if (!factuur) return { fout: "Deze factuur bestaat niet meer." };
    if (factuur.status !== "concept") {
      return {
        fout: "Alleen een concept kan verwijderd worden. Gebruik anders een creditfactuur.",
      };
    }

    await db.$transaction(async (tx) => {
      await vergrendelFactuur(tx, id, boekjaar.id);
      await tx.factuur.delete({
        where: { id, boekjaarId: boekjaar.id, status: "concept" },
      });
      if (factuur.crediteertFactuurId)
        await hertelFactuur(tx, factuur.crediteertFactuurId);
    });

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

    const factuurdatum = datumUitInvoer(
      String(formulier.get("factuurdatum") ?? ""),
    );
    if (!factuurdatum) return { fout: "Vul een geldige factuurdatum in." };

    const instellingen = await db.instellingen.findUnique({
      where: { id: "svr" },
    });
    const vervaldatum = telDagenOp(
      factuurdatum,
      instellingen?.betaaltermijnDagen ?? 30,
    );

    const verenigingen = await db.relatie.findMany({
      where: { type: "studievereniging", bijdragePlichtig: true, actief: true },
      orderBy: { naam: "asc" },
    });
    if (verenigingen.length === 0) {
      return {
        fout: "Er zijn geen actieve bijdrageplichtige studieverenigingen.",
      };
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
