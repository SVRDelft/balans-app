"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { logAudit } from "@/lib/audit";
import { vereisSessie } from "@/lib/auth/server";
import { vereisSchrijfbaarBoekjaar } from "@/lib/boekjaar";
import { controleerKoppelingen } from "@/lib/boekjaar-koppelingen";
import { db } from "@/lib/db";
import { datumUitInvoer, telDagenOp, vandaag } from "@/lib/datum";
import { hertelFactuur, volgendFactuurnummer } from "@/lib/facturen";
import { formatteerEuro, parseerBedragNaarCenten } from "@/lib/geld";
import {
  bepaalBlokkades,
  bepaalTeVerdelenUitgaven,
  berekenOmslag,
  telAangemeld,
  telBevestigd,
  type OmslagDeelnemer,
} from "@/lib/finance/omslag";
import {
  leesGeheelGetal,
  leesTekst,
  leesVinkje,
  voerUit,
  type ActieStaat,
} from "@/lib/acties";

// ---------------------------------------------------------------------------
// Evenement
// ---------------------------------------------------------------------------

export async function bewaarEvenement(
  _vorigeStaat: ActieStaat,
  formulier: FormData,
): Promise<ActieStaat> {
  const sessie = await vereisSessie();

  let doel = "/evenementen";

  const resultaat = await voerUit(async () => {
    const boekjaar = await vereisSchrijfbaarBoekjaar();

    const naam = leesTekst(formulier, "naam");
    const datum = datumUitInvoer(String(formulier.get("datum") ?? ""));

    const veldfouten: Record<string, string> = {};
    if (!naam) veldfouten.naam = "Vul een naam in.";
    if (!datum) veldfouten.datum = "Vul een geldige datum in.";
    if (Object.keys(veldfouten).length > 0) {
      return { fout: "Controleer de ingevulde gegevens.", veldfouten };
    }

    const gegevens = {
      naam: naam!,
      datum: datum!,
      kostenpostId: leesTekst(formulier, "kostenpostId") ?? null,
      opbrengstpostId: leesTekst(formulier, "opbrengstpostId") ?? null,
      notities: leesTekst(formulier, "notities") ?? null,
    };

    await controleerKoppelingen(boekjaar.id, [gegevens.kostenpostId, gegevens.opbrengstpostId].filter((id): id is string => Boolean(id)));
    const id = leesTekst(formulier, "id");

    if (id) {
      const evenement = await db.evenement.update({
        where: { id, boekjaarId: boekjaar.id },
        data: gegevens,
      });
      await logAudit({
        gebruiker: sessie.naam,
        entiteit: "Evenement",
        entiteitId: evenement.id,
        actie: "gewijzigd",
        samenvatting: `Evenement ${evenement.naam} gewijzigd`,
        boekjaarId: boekjaar.id,
      });
      doel = `/evenementen/${evenement.id}`;
      return;
    }

    const evenement = await db.evenement.create({
      data: { ...gegevens, boekjaarId: boekjaar.id, status: "open" },
    });
    await logAudit({
      gebruiker: sessie.naam,
      entiteit: "Evenement",
      entiteitId: evenement.id,
      actie: "aangemaakt",
      samenvatting: `Evenement ${evenement.naam} aangemaakt`,
      boekjaarId: boekjaar.id,
    });
    doel = `/evenementen/${evenement.id}`;
  });

  if (resultaat.fout) return resultaat;

  revalidatePath("/evenementen");
  redirect(doel);
}

// ---------------------------------------------------------------------------
// Deelnemers
// ---------------------------------------------------------------------------

export async function voegDeelnemerToe(
  _vorigeStaat: ActieStaat,
  formulier: FormData,
): Promise<ActieStaat> {
  const sessie = await vereisSessie();

  return voerUit(async () => {
    const boekjaar = await vereisSchrijfbaarBoekjaar();

    const evenementId = leesTekst(formulier, "evenementId");
    if (!evenementId) return { fout: "Onbekend evenement." };

    const relatieId = leesTekst(formulier, "relatieId") ?? null;
    const losseNaam = leesTekst(formulier, "naam");
    const aantalPersonen = leesGeheelGetal(formulier, "aantalPersonen") ?? 1;

    if (aantalPersonen < 1) {
      return { fout: "Het aantal personen is minimaal 1." };
    }

    let naam = losseNaam;
    if (relatieId) {
      const relatie = await db.relatie.findUnique({ where: { id: relatieId } });
      if (!relatie) return { fout: "Deze relatie bestaat niet." };
      naam = relatie.naam;
    }
    if (!naam) return { fout: "Kies een relatie of vul een naam in." };

    if (!await db.evenement.findFirst({ where: { id: evenementId, boekjaarId: boekjaar.id, status: { not: "afgesloten" } } })) return { fout: "Dit evenement is niet beschikbaar in het actieve boekjaar." };
    await db.deelnemer.create({
      data: {
        evenementId,
        relatieId,
        naam,
        aantalPersonen,
        aangemeld: true,
        bevestigdBetalend: leesVinkje(formulier, "bevestigdBetalend"),
        notities: leesTekst(formulier, "notities") ?? null,
      },
    });

    await logAudit({
      gebruiker: sessie.naam,
      entiteit: "Deelnemer",
      entiteitId: evenementId,
      actie: "aangemaakt",
      samenvatting: `${naam} toegevoegd als deelnemer (${aantalPersonen} ${aantalPersonen === 1 ? "persoon" : "personen"})`,
    });

    revalidatePath(`/evenementen/${evenementId}`);
    return { melding: `${naam} toegevoegd.` };
  });
}

export async function wijzigDeelnemer(
  _vorigeStaat: ActieStaat,
  formulier: FormData,
): Promise<ActieStaat> {
  const sessie = await vereisSessie();

  return voerUit(async () => {
    const boekjaar = await vereisSchrijfbaarBoekjaar();

    const id = leesTekst(formulier, "id");
    const veld = leesTekst(formulier, "veld");
    if (!id || !veld) return { fout: "Onvolledige opdracht." };

    const deelnemer = await db.deelnemer.findUnique({ where: { id, evenement: { boekjaarId: boekjaar.id, status: { not: "afgesloten" } } }, include: { _count: { select: { omslagrondeRegels: true } } } });
    if (!deelnemer) return { fout: "Deze deelnemer bestaat niet meer." };
    if (deelnemer._count.omslagrondeRegels > 0 && veld !== "aangemeld") return { fout: "Deze deelnemer is al in een omslag verwerkt. De betaalverdeling staat vast." };

    if (veld === "aantalPersonen") {
      const aantal = leesGeheelGetal(formulier, "waarde") ?? 1;
      if (aantal < 1) return { fout: "Het aantal personen is minimaal 1." };
      await db.deelnemer.update({
        where: { id, evenement: { boekjaarId: boekjaar.id } },
        data: { aantalPersonen: aantal },
      });
      await logAudit({
        gebruiker: sessie.naam,
        entiteit: "Deelnemer",
        entiteitId: deelnemer.evenementId,
        actie: "gewijzigd",
        samenvatting: `${deelnemer.naam}: aantal personen ${deelnemer.aantalPersonen} → ${aantal}`,
      });
    } else if (veld === "aangemeld" || veld === "bevestigdBetalend") {
      const nieuweWaarde = !deelnemer[veld];
      await db.deelnemer.update({
        where: { id, evenement: { boekjaarId: boekjaar.id } },
        data: { [veld]: nieuweWaarde },
      });
      await logAudit({
        gebruiker: sessie.naam,
        entiteit: "Deelnemer",
        entiteitId: deelnemer.evenementId,
        actie: "gewijzigd",
        samenvatting: `${deelnemer.naam}: ${veld === "aangemeld" ? "aangemeld" : "bevestigd betalend"} ${nieuweWaarde ? "aan" : "uit"}`,
      });
    } else {
      return { fout: "Onbekend veld." };
    }

    revalidatePath(`/evenementen/${deelnemer.evenementId}`);
    return {};
  });
}

export async function verwijderDeelnemer(
  _vorigeStaat: ActieStaat,
  formulier: FormData,
): Promise<ActieStaat> {
  const sessie = await vereisSessie();

  return voerUit(async () => {
    const boekjaar = await vereisSchrijfbaarBoekjaar();

    const id = leesTekst(formulier, "id");
    if (!id) return { fout: "Onbekende deelnemer." };

    const deelnemer = await db.deelnemer.findUnique({
      where: { id, evenement: { boekjaarId: boekjaar.id } },
      include: { _count: { select: { omslagrondeRegels: true } } },
    });
    if (!deelnemer) return { fout: "Deze deelnemer bestaat niet meer." };

    if (deelnemer._count.omslagrondeRegels > 0) {
      return {
        fout:
          "Deze deelnemer zit al in een berekende omslag. Crediteer eerst de bijbehorende factuur.",
      };
    }

    await db.deelnemer.delete({ where: { id, evenement: { boekjaarId: boekjaar.id } } });
    await logAudit({
      gebruiker: sessie.naam,
      entiteit: "Deelnemer",
      entiteitId: deelnemer.evenementId,
      actie: "verwijderd",
      samenvatting: `${deelnemer.naam} verwijderd als deelnemer`,
    });

    revalidatePath(`/evenementen/${deelnemer.evenementId}`);
    return {};
  });
}

// ---------------------------------------------------------------------------
// Omslag
// ---------------------------------------------------------------------------

/**
 * Berekent de omslag en maakt de facturen. Deelt altijd door het aantal
 * bevestigd betalende personen en weigert zolang er nog uitgaven openstaan
 * waarvan het bedrag niet definitief is.
 */
export async function berekenOmslagActie(
  _vorigeStaat: ActieStaat,
  formulier: FormData,
): Promise<ActieStaat> {
  const sessie = await vereisSessie();

  return voerUit(async () => {
    const boekjaar = await vereisSchrijfbaarBoekjaar();

    const evenementId = leesTekst(formulier, "evenementId");
    if (!evenementId) return { fout: "Onbekend evenement." };

    if (!leesVinkje(formulier, "bevestigLeveranciers")) {
      return {
        fout: "Bevestig eerst dat alle leveranciersfacturen binnen zijn.",
      };
    }
    if (!leesVinkje(formulier, "bevestigDeelnemers")) {
      return { fout: "Bevestig eerst dat de deelnemerslijst definitief is." };
    }

    const evenement = await db.evenement.findUnique({
      where: { id: evenementId, boekjaarId: boekjaar.id },
      include: {
        deelnemers: true,
        uitgaven: true,
        omslagrondes: {
          orderBy: { rondeNummer: "asc" },
          include: { regels: true },
        },
      },
    });
    if (!evenement) return { fout: "Dit evenement bestaat niet meer." };
    if (!evenement.opbrengstpostId) {
      return {
        fout: "Kies eerst de begrotingspost waarop de bijdragen geboekt worden.",
      };
    }

    const isNaheffing = evenement.omslagrondes.length > 0;

    const deelnemersVoorBerekening: OmslagDeelnemer[] = evenement.deelnemers.map(
      (deelnemer) => ({
        id: deelnemer.id,
        naam: deelnemer.naam,
        aantalPersonen: deelnemer.aantalPersonen,
        aangemeld: deelnemer.aangemeld,
        bevestigdBetalend: deelnemer.bevestigdBetalend,
      }),
    );

    // Een naheffing gaat over dezelfde deelnemers als de eerste ronde, ook als
    // de lijst daarna nog is veranderd.
    const eersteRonde = evenement.omslagrondes[0];
    const teFacturerenDeelnemers: {
      deelnemerId: string;
      naam: string;
      aantalPersonen: number;
    }[] = isNaheffing
      ? eersteRonde.regels.map((regel) => ({
          deelnemerId: regel.deelnemerId,
          naam: regel.naam,
          aantalPersonen: regel.aantalPersonen,
        }))
      : deelnemersVoorBerekening
          .filter((deelnemer) => deelnemer.bevestigdBetalend)
          .map((deelnemer) => ({
            deelnemerId: deelnemer.id,
            naam: deelnemer.naam,
            aantalPersonen: deelnemer.aantalPersonen,
          }));

    const teVerdelen = bepaalTeVerdelenUitgaven(
      evenement.uitgaven.map((uitgave) => ({
        id: uitgave.id,
        omschrijving: uitgave.omschrijving,
        bedragCenten: uitgave.bedragCenten,
        bedragDefinitief: uitgave.bedragDefinitief,
        tenLasteVanSvr: uitgave.tenLasteVanSvr,
        omslagrondeId: uitgave.omslagrondeId,
      })),
    );

    const aantalBevestigd = isNaheffing
      ? teFacturerenDeelnemers.reduce(
          (som, deelnemer) => som + deelnemer.aantalPersonen,
          0,
        )
      : telBevestigd(deelnemersVoorBerekening);

    const aantalAangemeld = isNaheffing
      ? eersteRonde.aantalAangemeld
      : telAangemeld(deelnemersVoorBerekening);

    const prijsInvoer = parseerBedragNaarCenten(
      String(formulier.get("prijsPerPersoon") ?? ""),
    );

    const blokkades = bepaalBlokkades({
      evenementStatus: evenement.status,
      heeftOpbrengstpost: true,
      deelnemers: isNaheffing
        ? teFacturerenDeelnemers.map((deelnemer) => ({
            id: deelnemer.deelnemerId,
            naam: deelnemer.naam,
            aantalPersonen: deelnemer.aantalPersonen,
            aangemeld: true,
            bevestigdBetalend: true,
          }))
        : deelnemersVoorBerekening,
      teVerdelenUitgaven: teVerdelen,
      ...(prijsInvoer !== null ? { prijsPerPersoonCenten: prijsInvoer } : {}),
    });

    if (blokkades.length > 0) {
      return { fout: blokkades.map((blokkade) => blokkade.melding).join(" ") };
    }

    const totaalKostenCenten = teVerdelen.reduce(
      (som, uitgave) => som + uitgave.bedragCenten,
      0,
    );

    const berekening = berekenOmslag({
      totaalKostenCenten,
      aantalAangemeld,
      aantalBevestigd,
      ...(prijsInvoer !== null ? { prijsPerPersoonCenten: prijsInvoer } : {}),
    });

    const factuurdatum = vandaag();
    const instellingen = await db.instellingen.findUnique({
      where: { id: "svr" },
    });
    const vervaldatum = telDagenOp(
      factuurdatum,
      instellingen?.betaaltermijnDagen ?? 30,
    );

    const rondeNummer = evenement.omslagrondes.length + 1;

    await db.$transaction(async (tx) => {
      const ronde = await tx.omslagronde.create({
        data: {
          evenementId: evenement.id,
          rondeNummer,
          type: isNaheffing ? "naheffing" : "initieel",
          berekendDoor: sessie.naam,
          totaalKostenCenten,
          aantalAangemeld,
          aantalBevestigd,
          kostprijsPerPersoonCenten: berekening.kostprijsPerPersoonCenten,
          prijsPerPersoonCenten: berekening.prijsPerPersoonCenten,
          totaalGefactureerdCenten: berekening.totaalGefactureerdCenten,
          notities: leesTekst(formulier, "notities") ?? null,
        },
      });

      for (const deelnemer of teFacturerenDeelnemers) {
        const bedragCenten =
          deelnemer.aantalPersonen * berekening.prijsPerPersoonCenten;

        // Een factuur heeft een relatie nodig. Voor een losse naam maken we
        // eenmalig een persoonsrelatie aan.
        const huidigeDeelnemer = await tx.deelnemer.findUnique({
          where: { id: deelnemer.deelnemerId },
        });
        let relatieId = huidigeDeelnemer?.relatieId ?? null;

        if (!relatieId) {
          const bestaande = await tx.relatie.findUnique({
            where: { naam: deelnemer.naam },
          });
          relatieId =
            bestaande?.id ??
            (
              await tx.relatie.create({
                data: {
                  naam: deelnemer.naam,
                  type: "persoon",
                  notities: `Automatisch aangemaakt bij de omslag van ${evenement.naam}.`,
                },
              })
            ).id;

          await tx.deelnemer.update({
            where: { id: deelnemer.deelnemerId },
            data: { relatieId },
          });
        }

        const { nummer, volgnummer } = await volgendFactuurnummer(
          tx,
          boekjaar.id,
        );

        const factuur = await tx.factuur.create({
          data: {
            boekjaarId: boekjaar.id,
            nummer,
            volgnummer,
            relatieId,
            factuurdatum,
            vervaldatum,
            omschrijving: isNaheffing
              ? `Naheffing ${evenement.naam}`
              : `Deelname ${evenement.naam}`,
            status: "concept",
            evenementId: evenement.id,
            omslagrondeId: ronde.id,
            regels: {
              create: [
                {
                  omschrijving: `${isNaheffing ? "Naheffing" : "Deelname"} ${evenement.naam}`,
                  aantal: deelnemer.aantalPersonen,
                  prijsPerStukCenten: berekening.prijsPerPersoonCenten,
                  bedragCenten,
                  begrotingspostId: evenement.opbrengstpostId!,
                  volgorde: 0,
                },
              ],
            },
          },
        });

        await hertelFactuur(tx, factuur.id);

        await tx.omslagrondeDeelnemer.create({
          data: {
            omslagrondeId: ronde.id,
            deelnemerId: deelnemer.deelnemerId,
            naam: deelnemer.naam,
            aantalPersonen: deelnemer.aantalPersonen,
            bedragCenten,
            factuurId: factuur.id,
          },
        });
      }

      // Deze uitgaven zijn nu verdeeld.
      await tx.uitgave.updateMany({
        where: { id: { in: teVerdelen.map((uitgave) => uitgave.id) } },
        data: { omslagrondeId: ronde.id },
      });

      await tx.evenement.update({
        where: { id: evenement.id },
        data: { status: "omslag_berekend" },
      });
    });

    await logAudit({
      gebruiker: sessie.naam,
      entiteit: "Omslagronde",
      entiteitId: evenement.id,
      actie: isNaheffing ? "naheffing berekend" : "omslag berekend",
      samenvatting:
        `${evenement.naam} ronde ${rondeNummer}: ${formatteerEuro(totaalKostenCenten)} over ` +
        `${aantalBevestigd} bevestigd betalende personen (${aantalAangemeld} aangemeld) ` +
        `= ${formatteerEuro(berekening.prijsPerPersoonCenten)} per persoon`,
      details: berekening,
      boekjaarId: boekjaar.id,
    });

    revalidatePath(`/evenementen/${evenement.id}`);
    revalidatePath("/facturen");

    return {
      melding:
        `${teFacturerenDeelnemers.length} conceptfacturen aangemaakt van ` +
        `${formatteerEuro(berekening.prijsPerPersoonCenten)} per persoon. Controleer ze en zet ze op verstuurd.`,
    };
  });
}

/** Boekt de uitgaven die na de omslag binnenkwamen ten laste van de SVR. */
export async function boekTenLasteVanSvr(
  _vorigeStaat: ActieStaat,
  formulier: FormData,
): Promise<ActieStaat> {
  const sessie = await vereisSessie();

  return voerUit(async () => {
    const boekjaar = await vereisSchrijfbaarBoekjaar();

    const evenementId = leesTekst(formulier, "evenementId");
    if (!evenementId) return { fout: "Onbekend evenement." };

    const evenement = await db.evenement.findUnique({
      where: { id: evenementId, boekjaarId: boekjaar.id },
      include: { uitgaven: true },
    });
    if (!evenement) return { fout: "Dit evenement bestaat niet meer." };

    const nakomers = evenement.uitgaven.filter(
      (uitgave) => uitgave.omslagrondeId === null && !uitgave.tenLasteVanSvr,
    );
    if (nakomers.length === 0) {
      return { fout: "Er zijn geen onverdeelde uitgaven op dit evenement." };
    }

    const bedrag = nakomers.reduce(
      (som, uitgave) => som + uitgave.bedragCenten,
      0,
    );

    await db.uitgave.updateMany({
      where: { id: { in: nakomers.map((uitgave) => uitgave.id) } },
      data: { tenLasteVanSvr: true },
    });

    await logAudit({
      gebruiker: sessie.naam,
      entiteit: "Evenement",
      entiteitId: evenementId,
      actie: "kosten ten laste van SVR",
      samenvatting: `${evenement.naam}: ${formatteerEuro(bedrag)} aan nagekomen kosten bewust niet doorbelast`,
      details: { uitgaven: nakomers.map((uitgave) => uitgave.omschrijving) },
      boekjaarId: boekjaar.id,
    });

    revalidatePath(`/evenementen/${evenementId}`);
    return {
      melding: `${formatteerEuro(bedrag)} is ten laste van de SVR geboekt en drukt dus op het jaarresultaat.`,
    };
  });
}

export async function sluitEvenement(
  _vorigeStaat: ActieStaat,
  formulier: FormData,
): Promise<ActieStaat> {
  const sessie = await vereisSessie();

  return voerUit(async () => {
    const boekjaar = await vereisSchrijfbaarBoekjaar();

    const evenementId = leesTekst(formulier, "evenementId");
    if (!evenementId) return { fout: "Onbekend evenement." };

    const evenement = await db.evenement.findUnique({
      where: { id: evenementId, boekjaarId: boekjaar.id },
      include: { facturen: true, uitgaven: true },
    });
    if (!evenement) return { fout: "Dit evenement bestaat niet meer." };

    const openstaand = evenement.facturen.filter(
      (factuur) =>
        factuur.status === "concept" ||
        factuur.status === "verstuurd" ||
        factuur.status === "deels_betaald",
    );
    if (openstaand.length > 0) {
      return {
        fout: `Er ${openstaand.length === 1 ? "staat nog 1 factuur" : `staan nog ${openstaand.length} facturen`} open. Afsluiten kan pas als alles betaald of afgeboekt is.`,
      };
    }

    const onverdeeld = evenement.uitgaven.filter(
      (uitgave) => uitgave.omslagrondeId === null && !uitgave.tenLasteVanSvr,
    );
    if (onverdeeld.length > 0) {
      return {
        fout:
          "Er staan nog uitgaven die niet zijn doorbelast. Maak eerst een naheffing of boek ze ten laste van de SVR.",
      };
    }

    await db.evenement.update({
      where: { id: evenementId, boekjaarId: boekjaar.id },
      data: { status: "afgesloten" },
    });

    await logAudit({
      gebruiker: sessie.naam,
      entiteit: "Evenement",
      entiteitId: evenementId,
      actie: "afgesloten",
      samenvatting: `Evenement ${evenement.naam} afgesloten`,
      boekjaarId: boekjaar.id,
    });

    revalidatePath(`/evenementen/${evenementId}`);
    return { melding: "Het evenement is afgesloten." };
  });
}

export async function heropenEvenement(
  _vorigeStaat: ActieStaat,
  formulier: FormData,
): Promise<ActieStaat> {
  const sessie = await vereisSessie();

  return voerUit(async () => {
    const boekjaar = await vereisSchrijfbaarBoekjaar();

    const evenementId = leesTekst(formulier, "evenementId");
    if (!evenementId) return { fout: "Onbekend evenement." };

    const evenement = await db.evenement.findUnique({
      where: { id: evenementId, boekjaarId: boekjaar.id },
      include: { omslagrondes: { select: { id: true } } },
    });
    if (!evenement) return { fout: "Dit evenement bestaat niet meer." };

    await db.evenement.update({
      where: { id: evenementId, boekjaarId: boekjaar.id },
      data: {
        status: evenement.omslagrondes.length > 0 ? "omslag_berekend" : "open",
      },
    });

    await logAudit({
      gebruiker: sessie.naam,
      entiteit: "Evenement",
      entiteitId: evenementId,
      actie: "heropend",
      samenvatting: `Evenement ${evenement.naam} heropend`,
      boekjaarId: boekjaar.id,
    });

    revalidatePath(`/evenementen/${evenementId}`);
    return { melding: "Het evenement staat weer open." };
  });
}
