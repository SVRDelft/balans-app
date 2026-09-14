// De omslagmodule. Hier is het eerder misgegaan, dus staan de regels hier als
// code en niet als vrijblijvende waarschuwing in de interface.
//
// Twee fouten uit boekjaar 2025-2026 die dit moet voorkomen:
//  1. omslaan over het aantal aangemelden (195) in plaats van het aantal
//     bevestigd betalenden (181);
//  2. kosten die na de omslag binnenkwamen en nooit zijn doorbelast.

import { deelNaarBoven, formatteerEuro } from "@/lib/geld";

export interface OmslagDeelnemer {
  id: string;
  naam: string;
  aantalPersonen: number;
  aangemeld: boolean;
  bevestigdBetalend: boolean;
}

export interface OmslagUitgave {
  id: string;
  omschrijving: string;
  bedragCenten: number;
  bedragDefinitief: boolean;
  tenLasteVanSvr: boolean;
  omslagrondeId: string | null;
}

export function telPersonen(
  deelnemers: readonly OmslagDeelnemer[],
  kies: (deelnemer: OmslagDeelnemer) => boolean,
): number {
  return deelnemers.reduce(
    (som, deelnemer) => (kies(deelnemer) ? som + deelnemer.aantalPersonen : som),
    0,
  );
}

export function telAangemeld(deelnemers: readonly OmslagDeelnemer[]): number {
  return telPersonen(deelnemers, (d) => d.aangemeld);
}

export function telBevestigd(deelnemers: readonly OmslagDeelnemer[]): number {
  return telPersonen(deelnemers, (d) => d.bevestigdBetalend);
}

/** Uitgaven die nog in geen enkele ronde zijn verdeeld en niet bewust ten
 *  laste van de SVR zijn geboekt. */
export function bepaalTeVerdelenUitgaven(
  uitgaven: readonly OmslagUitgave[],
): OmslagUitgave[] {
  return uitgaven.filter(
    (uitgave) => uitgave.omslagrondeId === null && !uitgave.tenLasteVanSvr,
  );
}

export type BlokkadeCode =
  | "geen_bevestigde_deelnemers"
  | "geen_kosten"
  | "niet_definitieve_uitgaven"
  | "geen_opbrengstpost"
  | "evenement_afgesloten"
  | "prijs_onder_kostprijs";

export interface OmslagBlokkade {
  code: BlokkadeCode;
  melding: string;
  details?: string[];
}

export interface BlokkadeContext {
  evenementStatus: string;
  heeftOpbrengstpost: boolean;
  deelnemers: readonly OmslagDeelnemer[];
  teVerdelenUitgaven: readonly OmslagUitgave[];
  /** Alleen meegeven als de gebruiker zelf een prijs invult. */
  prijsPerPersoonCenten?: number;
}

/**
 * Alles wat het berekenen van de omslag tegenhoudt. Een lege lijst betekent
 * dat er gerekend mag worden.
 */
export function bepaalBlokkades(context: BlokkadeContext): OmslagBlokkade[] {
  const blokkades: OmslagBlokkade[] = [];

  if (context.evenementStatus === "afgesloten") {
    blokkades.push({
      code: "evenement_afgesloten",
      melding: "Dit evenement is afgesloten. Er kan niets meer omgeslagen worden.",
    });
  }

  if (!context.heeftOpbrengstpost) {
    blokkades.push({
      code: "geen_opbrengstpost",
      melding:
        "Kies eerst de begrotingspost waarop de bijdragen van de deelnemers geboekt worden.",
    });
  }

  const nietDefinitief = context.teVerdelenUitgaven.filter(
    (uitgave) => !uitgave.bedragDefinitief,
  );
  if (nietDefinitief.length > 0) {
    blokkades.push({
      code: "niet_definitieve_uitgaven",
      melding:
        nietDefinitief.length === 1
          ? "Er staat nog één uitgave open waarvan het bedrag niet definitief is."
          : `Er staan nog ${nietDefinitief.length} uitgaven open waarvan het bedrag niet definitief is.`,
      details: nietDefinitief.map(
        (uitgave) =>
          `${uitgave.omschrijving} — ${formatteerEuro(uitgave.bedragCenten)}`,
      ),
    });
  }

  const aantalBevestigd = telBevestigd(context.deelnemers);
  if (aantalBevestigd <= 0) {
    blokkades.push({
      code: "geen_bevestigde_deelnemers",
      melding:
        "Er is nog geen enkele deelnemer als bevestigd betalend gemarkeerd. Er is dus niets om over te verdelen.",
    });
  }

  const totaalKostenCenten = context.teVerdelenUitgaven.reduce(
    (som, uitgave) => som + uitgave.bedragCenten,
    0,
  );
  if (totaalKostenCenten <= 0) {
    blokkades.push({
      code: "geen_kosten",
      melding:
        "Er staan geen nog te verdelen kosten op dit evenement. Koppel eerst de uitgaven.",
    });
  }

  if (
    context.prijsPerPersoonCenten !== undefined &&
    aantalBevestigd > 0 &&
    totaalKostenCenten > 0
  ) {
    const kostprijs = deelNaarBoven(totaalKostenCenten, aantalBevestigd);
    if (context.prijsPerPersoonCenten < kostprijs) {
      blokkades.push({
        code: "prijs_onder_kostprijs",
        melding:
          "De prijs per persoon ligt onder de kostprijs. Daarmee staat het verlies bij voorbaat vast.",
      });
    }
  }

  return blokkades;
}

export interface OmslagInvoer {
  totaalKostenCenten: number;
  aantalAangemeld: number;
  aantalBevestigd: number;
  /** Laat weg om de kostprijs te gebruiken; nooit lager dan de kostprijs. */
  prijsPerPersoonCenten?: number;
}

export interface OmslagBerekening {
  totaalKostenCenten: number;
  aantalAangemeld: number;
  aantalBevestigd: number;
  verschilAantal: number;

  kostprijsPerPersoonCenten: number;
  prijsPerPersoonCenten: number;
  totaalGefactureerdCenten: number;
  /** Gefactureerd minus kosten. Hoort nul of een paar cent te zijn. */
  dekkingsverschilCenten: number;
  /** Het hoogste verschil dat alleen door afronding op hele centen kan ontstaan. */
  afrondingsruimteCenten: number;

  /** Wat er gebeurd zou zijn bij delen door het aantal aangemelden. */
  prijsBijAangemeldCenten: number;
  opbrengstBijAangemeldCenten: number;
  tekortBijAangemeldCenten: number;
}

/**
 * Berekent de omslag. Er wordt altijd gedeeld door het aantal **bevestigd
 * betalende** personen. Het scenario met het aantal aangemelden wordt er
 * naast berekend, zodat zichtbaar is wat die keuze zou kosten.
 */
export function berekenOmslag({
  totaalKostenCenten,
  aantalAangemeld,
  aantalBevestigd,
  prijsPerPersoonCenten,
}: OmslagInvoer): OmslagBerekening {
  const kostprijsPerPersoonCenten = deelNaarBoven(
    totaalKostenCenten,
    aantalBevestigd,
  );

  const prijs = Math.max(
    kostprijsPerPersoonCenten,
    prijsPerPersoonCenten ?? kostprijsPerPersoonCenten,
  );

  const totaalGefactureerdCenten = prijs * aantalBevestigd;

  const prijsBijAangemeldCenten = deelNaarBoven(
    totaalKostenCenten,
    aantalAangemeld,
  );
  const opbrengstBijAangemeldCenten = prijsBijAangemeldCenten * aantalBevestigd;

  return {
    totaalKostenCenten,
    aantalAangemeld,
    aantalBevestigd,
    verschilAantal: aantalAangemeld - aantalBevestigd,

    kostprijsPerPersoonCenten,
    prijsPerPersoonCenten: prijs,
    totaalGefactureerdCenten,
    dekkingsverschilCenten: totaalGefactureerdCenten - totaalKostenCenten,
    afrondingsruimteCenten: aantalBevestigd,

    prijsBijAangemeldCenten,
    opbrengstBijAangemeldCenten,
    tekortBijAangemeldCenten: Math.max(
      0,
      totaalKostenCenten - opbrengstBijAangemeldCenten,
    ),
  };
}

export interface DeelnemerBedrag {
  deelnemerId: string;
  naam: string;
  aantalPersonen: number;
  bedragCenten: number;
}

/** Wat elke bevestigd betalende deelnemer gefactureerd krijgt. */
export function berekenDeelnemerBedragen(
  deelnemers: readonly OmslagDeelnemer[],
  prijsPerPersoonCenten: number,
): DeelnemerBedrag[] {
  return deelnemers
    .filter((deelnemer) => deelnemer.bevestigdBetalend)
    .map((deelnemer) => ({
      deelnemerId: deelnemer.id,
      naam: deelnemer.naam,
      aantalPersonen: deelnemer.aantalPersonen,
      bedragCenten: deelnemer.aantalPersonen * prijsPerPersoonCenten,
    }));
}

export interface AfstemmingInvoer {
  /** Alle uitgaven op het evenement, verdeeld of niet. */
  totaleKostenCenten: number;
  /** Deel daarvan dat bewust ten laste van de SVR is geboekt. */
  tenLasteVanSvrCenten: number;
  /** Deel daarvan dat nog nergens in zit. */
  nogNietVerdeeldCenten: number;
  /**
   * Som van álle facturen op het evenement, ook de concepten. De vraag hier is
   * of de kosten volledig zijn doorbelast; of de factuur ook al verstuurd is,
   * is een aparte stap die apart wordt gemeld.
   */
  gefactureerdCenten: number;
  /** Deel daarvan dat nog op concept staat en dus nog niet meetelt in de exploitatie. */
  conceptCenten: number;
  /** Som van de betalingen daarop. */
  ontvangenCenten: number;
  aantalBevestigd: number;
}

export interface Afstemming {
  totaleKostenCenten: number;
  doorTeBelastenKostenCenten: number;
  gefactureerdCenten: number;
  conceptCenten: number;
  ontvangenCenten: number;
  nogNietVerdeeldCenten: number;
  tenLasteVanSvrCenten: number;

  /** Gefactureerd minus de kosten die doorbelast hadden moeten worden. */
  dekkingsverschilCenten: number;
  /** Nog binnen te halen bij de deelnemers. */
  nogTeOntvangenCenten: number;
  /** Effect van dit evenement op het jaarresultaat. Hoort nul te zijn. */
  resultaatCenten: number;

  binnenAfronding: boolean;
  klopt: boolean;
}

/**
 * De afstemming die permanent bij een evenement staat: totale kosten, totaal
 * gefactureerd, totaal ontvangen en het verschil.
 */
export function berekenAfstemming(invoer: AfstemmingInvoer): Afstemming {
  const doorTeBelastenKostenCenten =
    invoer.totaleKostenCenten - invoer.tenLasteVanSvrCenten;

  const dekkingsverschilCenten =
    invoer.gefactureerdCenten - doorTeBelastenKostenCenten;

  const resultaatCenten = invoer.gefactureerdCenten - invoer.totaleKostenCenten;

  const binnenAfronding =
    Math.abs(dekkingsverschilCenten) <= Math.max(1, invoer.aantalBevestigd);

  return {
    totaleKostenCenten: invoer.totaleKostenCenten,
    doorTeBelastenKostenCenten,
    gefactureerdCenten: invoer.gefactureerdCenten,
    conceptCenten: invoer.conceptCenten,
    ontvangenCenten: invoer.ontvangenCenten,
    nogNietVerdeeldCenten: invoer.nogNietVerdeeldCenten,
    tenLasteVanSvrCenten: invoer.tenLasteVanSvrCenten,

    dekkingsverschilCenten,
    nogTeOntvangenCenten: invoer.gefactureerdCenten - invoer.ontvangenCenten,
    resultaatCenten,

    binnenAfronding,
    klopt:
      invoer.nogNietVerdeeldCenten === 0 &&
      dekkingsverschilCenten >= 0 &&
      binnenAfronding,
  };
}
