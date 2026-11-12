import "server-only";

import { db } from "@/lib/db";
import { factuurStandRelaties } from "@/lib/factuur-includes";
import { factuurOpenstaand } from "@/lib/finance/factuurstanden";
import { soortVolgorde } from "@/lib/portaal/vergaderingen";
import { toonNaam } from "@/lib/verenigingen";

// Wat het portaal laat zien. Mededelingen, vergaderingen en documenten zijn voor
// álle aangesloten verenigingen hetzelfde. Daarnaast is er één ding dat per
// vereniging verschilt: haalEigenRekening, met haar eigen facturen. Dat filter op
// de eigen relatie is daar geen detail maar de kern — zie AANNAMES.md.

export async function haalMededelingen(hoeveel = 20) {
  return db.mededeling.findMany({
    orderBy: { geplaatstOp: "desc" },
    take: hoeveel,
  });
}

export async function haalVergaderingen() {
  const vergaderingen = await db.vergadering.findMany({
    orderBy: { datum: "asc" },
    include: {
      gastheer: { select: { naam: true } },
      bestanden: { orderBy: { soort: "asc" } },
    },
  });

  for (const vergadering of vergaderingen) {
    vergadering.bestanden.sort(
      (a, b) => soortVolgorde(a.soort) - soortVolgorde(b.soort) || a.geuploadOp.getTime() - b.geuploadOp.getTime(),
    );
  }

  // Vandaag telt nog als "komend": de notulen komen pas later.
  const vandaag = new Date();
  vandaag.setUTCHours(0, 0, 0, 0);
  const komend = vergaderingen.filter((v) => v.datum >= vandaag);
  const geweest = vergaderingen.filter((v) => v.datum < vandaag).reverse();
  return { komend, geweest, alle: vergaderingen };
}

export async function haalDocumenten() {
  return db.portaalbestand.findMany({
    where: { vergaderingId: null },
    orderBy: { geuploadOp: "desc" },
  });
}

export const gastheerVan = (vergadering: {
  gastheer: { naam: string } | null;
  gastheerNaam: string;
}) => {
  const naam = vergadering.gastheer?.naam || vergadering.gastheerNaam;
  return naam ? toonNaam({ naam }) : "nog niet bekend";
};

/**
 * De eigen rekening van één vereniging: haar facturen en haar
 * rekening-courantsaldo.
 *
 * Dit is het enige in het portaal dat niet voor iedereen hetzelfde is, dus het
 * filter op de eigen relatie is hier geen detail maar de kern. De aanroeper geeft
 * de relatie uit de sessie mee; een vereniging kan dus alleen bij zichzelf.
 * Concepten blijven buiten beeld: die zijn nog niet verstuurd.
 */
export async function haalEigenRekening(relatieId: string) {
  const [facturen, rekeningposten, instellingen] = await Promise.all([
    db.factuur.findMany({
      where: { relatieId, status: { not: "concept" } },
      include: {
        ...factuurStandRelaties,
        betalingen: { select: { bedragCenten: true } },
        boekjaar: { select: { naam: true } },
      },
      orderBy: [{ factuurdatum: "desc" }, { nummer: "desc" }],
    }),
    db.rekeningpost.findMany({
      where: { relatieId },
      orderBy: { datum: "desc" },
      select: { id: true, datum: true, omschrijving: true, bedragCenten: true },
    }),
    db.instellingen.findUnique({
      where: { id: "svr" },
      select: { iban: true, organisatieNaam: true },
    }),
  ]);

  const regels = facturen.map((factuur) => ({
    id: factuur.id,
    nummer: factuur.nummer,
    omschrijving: factuur.omschrijving,
    factuurdatum: factuur.factuurdatum,
    vervaldatum: factuur.vervaldatum,
    status: factuur.status,
    totaalCenten: factuur.totaalCenten,
    openstaandCenten: factuurOpenstaand(factuur),
    boekjaarNaam: factuur.boekjaar.naam,
  }));

  return {
    regels,
    openstaandCenten: regels.reduce(
      (som, regel) => som + regel.openstaandCenten,
      0,
    ),
    rekeningposten,
    rekeningSaldoCenten: rekeningposten.reduce(
      (som, post) => som + post.bedragCenten,
      0,
    ),
    iban: instellingen?.iban ?? "",
  };
}

/**
 * De vergaderingen voor de agenda-feed, eventueel van één overleg. Alleen van
 * de afgelopen drie maanden en later: oudere hebben geen zin in een agenda.
 */
export async function haalAgendaVergaderingen(overleg?: string) {
  const vanaf = new Date();
  vanaf.setUTCMonth(vanaf.getUTCMonth() - 3);
  const vergaderingen = await db.vergadering.findMany({
    where: { datum: { gte: vanaf }, ...(overleg ? { reeks: overleg } : {}) },
    orderBy: { datum: "asc" },
    include: { gastheer: { select: { naam: true } } },
  });
  return vergaderingen.map((vergadering) => ({ ...vergadering, gastheer: gastheerVan(vergadering) }));
}
