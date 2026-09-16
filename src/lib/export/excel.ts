import "server-only";

import ExcelJS from "exceljs";

import { db } from "@/lib/db";
import { formatteerDatum } from "@/lib/datum";
import {
  FACTUUR_STATUS_LABEL,
  POST_CATEGORIE_LABEL,
  POST_SOORT_LABEL,
  type FactuurStatus,
  type PostCategorie,
  type PostSoort,
} from "@/lib/domein";
import { betaaldBedrag } from "@/lib/facturen";
import { haalBoekjaarCijfers } from "@/lib/rapportage";

const EURO = '"€" #,##0.00;[Red]-"€" #,##0.00';

function kopRij(werkblad: ExcelJS.Worksheet, rij: number) {
  const regel = werkblad.getRow(rij);
  regel.font = { bold: true };
  regel.eachCell((cel) => {
    cel.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFEFF2F6" },
    };
    cel.border = { bottom: { style: "thin", color: { argb: "FFB8C0CC" } } };
  });
}

/**
 * Bouwt het Excel-bestand voor de overdracht: exploitatie, balans,
 * debiteuren, alle facturen en alle uitgaven.
 */
export async function maakOverdrachtWerkboek(
  boekjaarId: string,
): Promise<ExcelJS.Buffer> {
  const boekjaar = await db.boekjaar.findUniqueOrThrow({
    where: { id: boekjaarId },
  });
  const cijfers = await haalBoekjaarCijfers(boekjaarId);

  const [facturen, uitgaven, evenementen] = await Promise.all([
    db.factuur.findMany({
      where: { boekjaarId },
      orderBy: { volgnummer: "asc" },
      include: {
        relatie: { select: { naam: true } },
        betalingen: { select: { bedragCenten: true } },
        evenement: { select: { naam: true } },
        regels: {
          include: { begrotingspost: { select: { code: true } } },
        },
      },
    }),
    db.uitgave.findMany({
      where: { boekjaarId },
      orderBy: { datum: "asc" },
      include: {
        begrotingspost: { select: { code: true, naam: true } },
        evenement: { select: { naam: true } },
      },
    }),
    db.evenement.findMany({
      where: { boekjaarId },
      orderBy: { datum: "asc" },
    }),
  ]);

  const werkboek = new ExcelJS.Workbook();
  werkboek.creator = "SVR balans-app";
  werkboek.created = new Date();

  // --- Exploitatie -------------------------------------------------------
  const exploitatie = werkboek.addWorksheet("Exploitatie");
  exploitatie.columns = [
    { header: "Categorie", width: 18 },
    { header: "Soort", width: 12 },
    { header: "Code", width: 16 },
    { header: "Post", width: 44 },
    { header: "Begroot", width: 14, style: { numFmt: EURO } },
    { header: "Gerealiseerd", width: 14, style: { numFmt: EURO } },
    { header: "Verschil", width: 14, style: { numFmt: EURO } },
  ];
  kopRij(exploitatie, 1);

  for (const post of cijfers.posten) {
    exploitatie.addRow([
      POST_CATEGORIE_LABEL[post.categorie as PostCategorie],
      POST_SOORT_LABEL[post.soort as PostSoort],
      post.code,
      post.naam,
      post.begrootCenten / 100,
      post.gerealiseerdCenten / 100,
      (post.gerealiseerdCenten - post.begrootCenten) / 100,
    ]);
  }

  exploitatie.addRow([]);
  exploitatie.addRow([
    "Voorraad",
    "Correctie",
    "",
    "Voorraadmutatie (huidig min begin)",
    0,
    cijfers.voorraad.mutatieCenten / 100,
    cijfers.voorraad.mutatieCenten / 100,
  ]);
  const totaalRij = exploitatie.addRow([
    "Eindsaldo",
    "",
    "",
    "",
    cijfers.exploitatie.eindsaldoBegrootCenten / 100,
    cijfers.exploitatie.eindsaldoGerealiseerdCenten / 100,
    (cijfers.exploitatie.eindsaldoGerealiseerdCenten -
      cijfers.exploitatie.eindsaldoBegrootCenten) /
      100,
  ]);
  totaalRij.font = { bold: true };

  // --- Balans ------------------------------------------------------------
  const balans = werkboek.addWorksheet("Balans");
  balans.columns = [
    { header: "Post", width: 46 },
    { header: "Bedrag", width: 16, style: { numFmt: EURO } },
  ];
  kopRij(balans, 1);

  const b = cijfers.balans;
  balans.addRow(["ACTIVA", null]).font = { bold: true };
  balans.addRow([
    "Banksaldo volgens de administratie",
    b.administratiefBanksaldoCenten / 100,
  ]);
  balans.addRow(["Openstaande debiteuren", b.debiteurenCenten / 100]);
  balans.addRow(["Spullen & voorraad", b.voorraadCenten / 100]);
  balans.addRow(["Totaal activa", b.totaalActivaCenten / 100]).font = {
    bold: true,
  };
  balans.addRow([]);
  balans.addRow(["PASSIVA", null]).font = { bold: true };
  balans.addRow(["Openstaande crediteuren", b.crediteurenCenten / 100]);
  balans.addRow([
    "Eigen vermogen begin boekjaar",
    b.eigenVermogenBeginCenten / 100,
  ]);
  balans.addRow(["Resultaat lopend boekjaar", b.resultaatCenten / 100]);
  if (b.beginbalansverschilCenten !== 0) {
    balans.addRow([
      "Beginbalans: overige vorderingen en schulden",
      b.beginbalansverschilCenten / 100,
    ]);
  }
  balans.addRow(["Totaal passiva", b.totaalPassivaCenten / 100]).font = {
    bold: true,
  };
  balans.addRow([]);
  balans.addRow(["CONTROLES", null]).font = { bold: true };
  balans.addRow(["Activa min passiva", b.balansverschilCenten / 100]);
  balans.addRow([
    "Laatst ingevoerd banksaldo",
    cijfers.laatsteBanksaldo
      ? cijfers.laatsteBanksaldo.saldoCenten / 100
      : null,
  ]);
  balans.addRow([
    "Verschil met de administratie",
    b.bankverschilCenten === null ? null : b.bankverschilCenten / 100,
  ]);

  const voorraad = werkboek.addWorksheet("Spullen & voorraad");
  voorraad.columns = [
    { header: "Spullen", width: 30 },
    { header: "Eenheid", width: 12 },
    { header: "Beginaantal", width: 14 },
    { header: "Beginwaarde per stuk", width: 22, style: { numFmt: EURO } },
    { header: "Beginwaarde totaal", width: 20, style: { numFmt: EURO } },
    { header: "Huidig aantal", width: 14 },
    { header: "Huidige waarde per stuk", width: 24, style: { numFmt: EURO } },
    { header: "Huidige waarde totaal", width: 22, style: { numFmt: EURO } },
    { header: "Begrotingspost", width: 34 },
    { header: "Bewaarplaats", width: 24 },
    { header: "Notities", width: 50 },
  ];
  kopRij(voorraad, 1);
  voorraad.views = [{ state: "frozen", ySplit: 1 }];
  for (const post of cijfers.voorraadposten) {
    voorraad.addRow([
      post.naam,
      post.eenheid,
      post.beginAantal,
      post.beginWaardePerStukCenten / 100,
      (post.beginAantal * post.beginWaardePerStukCenten) / 100,
      post.aantal,
      post.waardePerStukCenten / 100,
      (post.aantal * post.waardePerStukCenten) / 100,
      post.begrotingspost
        ? `${post.begrotingspost.code} — ${post.begrotingspost.naam}`
        : "niet gekoppeld",
      post.locatie,
      post.notities,
    ]);
  }
  voorraad.addRow([
    "Totaal",
    "",
    null,
    null,
    cijfers.voorraad.beginwaardeCenten / 100,
    null,
    null,
    cijfers.voorraad.waardeCenten / 100,
  ]).font = { bold: true };

  // --- Debiteuren --------------------------------------------------------
  const debiteuren = werkboek.addWorksheet("Debiteuren");
  debiteuren.columns = [
    { header: "Factuurnummer", width: 18 },
    { header: "Relatie", width: 28 },
    { header: "Factuurdatum", width: 14 },
    { header: "Vervaldatum", width: 14 },
    { header: "Status", width: 16 },
    { header: "Bedrag", width: 14, style: { numFmt: EURO } },
    { header: "Betaald", width: 14, style: { numFmt: EURO } },
    { header: "Openstaand", width: 14, style: { numFmt: EURO } },
  ];
  kopRij(debiteuren, 1);

  for (const factuur of cijfers.openstaandeFacturen) {
    debiteuren.addRow([
      factuur.nummer,
      factuur.relatieNaam,
      formatteerDatum(factuur.factuurdatum),
      formatteerDatum(factuur.vervaldatum),
      FACTUUR_STATUS_LABEL[factuur.status as FactuurStatus] ?? factuur.status,
      factuur.totaalCenten / 100,
      factuur.betaaldCenten / 100,
      factuur.openstaandCenten / 100,
    ]);
  }

  debiteuren.addRow([]);
  debiteuren.addRow(["Ouderdom", "tot 30 dagen", cijfers.ouderdom.tot30 / 100]);
  debiteuren.addRow(["", "30 tot 60 dagen", cijfers.ouderdom.van30tot60 / 100]);
  debiteuren.addRow(["", "meer dan 60 dagen", cijfers.ouderdom.meer60 / 100]);

  // --- Facturen ----------------------------------------------------------
  const facturenBlad = werkboek.addWorksheet("Facturen");
  facturenBlad.columns = [
    { header: "Nummer", width: 18 },
    { header: "Datum", width: 13 },
    { header: "Vervaldatum", width: 13 },
    { header: "Relatie", width: 26 },
    { header: "Omschrijving", width: 40 },
    { header: "Evenement", width: 20 },
    { header: "Begrotingsposten", width: 22 },
    { header: "Status", width: 15 },
    { header: "Bedrag", width: 14, style: { numFmt: EURO } },
    { header: "Ontvangen", width: 14, style: { numFmt: EURO } },
  ];
  kopRij(facturenBlad, 1);

  for (const factuur of facturen) {
    const posten = [
      ...new Set(factuur.regels.map((regel) => regel.begrotingspost.code)),
    ].join(", ");

    facturenBlad.addRow([
      factuur.nummer,
      formatteerDatum(factuur.factuurdatum),
      formatteerDatum(factuur.vervaldatum),
      factuur.relatie.naam,
      factuur.omschrijving,
      factuur.evenement?.naam ?? "",
      posten,
      FACTUUR_STATUS_LABEL[factuur.status as FactuurStatus] ?? factuur.status,
      factuur.totaalCenten / 100,
      betaaldBedrag(factuur.betalingen) / 100,
    ]);
  }

  // --- Uitgaven ----------------------------------------------------------
  const uitgavenBlad = werkboek.addWorksheet("Uitgaven");
  uitgavenBlad.columns = [
    { header: "Datum", width: 13 },
    { header: "Leverancier", width: 26 },
    { header: "Omschrijving", width: 40 },
    { header: "Begrotingspost", width: 30 },
    { header: "Evenement", width: 20 },
    { header: "Definitief", width: 11 },
    { header: "Betaald", width: 11 },
    { header: "Ten laste van SVR", width: 17 },
    { header: "Bedrag", width: 14, style: { numFmt: EURO } },
  ];
  kopRij(uitgavenBlad, 1);

  for (const uitgave of uitgaven) {
    uitgavenBlad.addRow([
      formatteerDatum(uitgave.datum),
      uitgave.leverancierNaam,
      uitgave.omschrijving,
      `${uitgave.begrotingspost.code} — ${uitgave.begrotingspost.naam}`,
      uitgave.evenement?.naam ?? "",
      uitgave.bedragDefinitief ? "ja" : "nee",
      uitgave.betaald ? "ja" : "nee",
      uitgave.tenLasteVanSvr ? "ja" : "nee",
      uitgave.bedragCenten / 100,
    ]);
  }

  // --- Evenementen -------------------------------------------------------
  const evenementenBlad = werkboek.addWorksheet("Evenementen");
  evenementenBlad.columns = [
    { header: "Evenement", width: 26 },
    { header: "Datum", width: 13 },
    { header: "Status", width: 18 },
    { header: "Totale kosten", width: 15, style: { numFmt: EURO } },
    { header: "Gefactureerd", width: 15, style: { numFmt: EURO } },
    { header: "Ontvangen", width: 15, style: { numFmt: EURO } },
    { header: "Nog niet verdeeld", width: 17, style: { numFmt: EURO } },
    { header: "Ten laste van SVR", width: 17, style: { numFmt: EURO } },
    { header: "Verschil", width: 14, style: { numFmt: EURO } },
  ];
  kopRij(evenementenBlad, 1);

  for (const evenement of evenementen) {
    const cijfersVanEvenement = cijfers.evenementen.find(
      (kandidaat) => kandidaat.id === evenement.id,
    );
    if (!cijfersVanEvenement) continue;
    const a = cijfersVanEvenement.afstemming;

    evenementenBlad.addRow([
      evenement.naam,
      formatteerDatum(evenement.datum),
      evenement.status,
      a.totaleKostenCenten / 100,
      a.gefactureerdCenten / 100,
      a.ontvangenCenten / 100,
      a.nogNietVerdeeldCenten / 100,
      a.tenLasteVanSvrCenten / 100,
      a.resultaatCenten / 100,
    ]);
  }

  // --- Toelichting -------------------------------------------------------
  const toelichting = werkboek.addWorksheet("Toelichting");
  toelichting.columns = [
    { header: "Onderwerp", width: 30 },
    { header: "Waarde", width: 70 },
  ];
  kopRij(toelichting, 1);
  toelichting.addRow(["Boekjaar", boekjaar.naam]);
  toelichting.addRow([
    "Periode",
    `${formatteerDatum(boekjaar.startDatum)} t/m ${formatteerDatum(boekjaar.eindDatum)}`,
  ]);
  toelichting.addRow(["Voorvoegsel factuurnummers", boekjaar.factuurPrefix]);
  toelichting.addRow(["Beginsaldo bank", boekjaar.beginsaldoBankCenten / 100]);
  toelichting.addRow([
    "Beginvoorraad",
    cijfers.voorraad.beginwaardeCenten / 100,
  ]);
  toelichting.addRow([
    "Voorraadmutatie",
    "De huidige voorraadwaarde min de beginwaarde telt mee in het resultaat. Aankopen worden ook als uitgave vastgelegd; verbruik verlaagt het huidige aantal.",
  ]);
  toelichting.addRow([
    "Beginsaldo eigen vermogen",
    boekjaar.beginsaldoEigenVermogenCenten / 100,
  ]);
  toelichting.addRow(["Geëxporteerd op", formatteerDatum(new Date())]);
  toelichting.addRow([]);
  toelichting.addRow([
    "Uitgangspunt",
    "Baten-lastenstelsel: een factuur telt mee zodra hij verstuurd is, een uitgave zodra hij geregistreerd is.",
  ]);
  toelichting.addRow([
    "Meegeteld als opbrengst",
    "Facturen tellen vanaf versturen. Verstuurde credits corrigeren de oorspronkelijke opbrengst. Bij oninbaar blijft het ontvangen deel meetellen; concepten tellen niet mee.",
  ]);
  toelichting.addRow([
    "Bedragen",
    "Alle bedragen staan in de database als hele eurocenten en zijn hier gedeeld door 100.",
  ]);

  return werkboek.xlsx.writeBuffer();
}
