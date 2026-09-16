import "server-only";

import type { FactuurStatus } from "@/lib/domein";
import type { Prisma } from "@/generated/prisma/client";
import { factuurStandRelaties } from "@/lib/factuur-includes";
import { factuurStandStatus } from "@/lib/finance/factuurstanden";

/**
 * Werkt zowel met de gewone client als binnen een transactie: de gewone client
 * is toewijsbaar aan dit type.
 */
export type DbClient = Prisma.TransactionClient;

/** Lock the original first for every mutation of an invoice/credit pair. */
export async function vergrendelFactuur(
  tx: DbClient,
  factuurId: string,
  boekjaarId: string,
) {
  await tx.$queryRaw`SELECT id FROM "Factuur" WHERE id = (
    SELECT COALESCE("crediteertFactuurId", id) FROM "Factuur"
    WHERE id = ${factuurId} AND "boekjaarId" = ${boekjaarId}
  ) FOR UPDATE`;
}

/**
 * Geeft het volgende factuurnummer van een boekjaar uit, bijvoorbeeld
 * SVR62-2026-0001.
 *
 * De teller op het boekjaar loopt alleen op. Een verwijderd concept geeft zijn
 * nummer dus niet terug; een gat in de reeks is voor een kascommissie
 * verklaarbaar, een hergebruikt nummer niet.
 */
export async function volgendFactuurnummer(
  tx: DbClient,
  boekjaarId: string,
): Promise<{ nummer: string; volgnummer: number }> {
  const boekjaar = await tx.boekjaar.update({
    where: { id: boekjaarId },
    data: { factuurTeller: { increment: 1 } },
    select: { factuurTeller: true, factuurPrefix: true },
  });

  const volgnummer = boekjaar.factuurTeller;
  return {
    volgnummer,
    nummer: `${boekjaar.factuurPrefix}-${String(volgnummer).padStart(4, "0")}`,
  };
}

/**
 * Berekent het totaal van een factuur opnieuw uit de regels en leidt de status
 * af uit de betalingen. Aanroepen na elke wijziging aan regels of betalingen.
 */
export async function hertelFactuur(
  tx: DbClient,
  factuurId: string,
  herberekenGerelateerde = true,
): Promise<{
  totaalCenten: number;
  betaaldCenten: number;
  status: FactuurStatus;
}> {
  const factuur = await tx.factuur.findUniqueOrThrow({
    where: { id: factuurId },
    include: { regels: true, betalingen: true, ...factuurStandRelaties },
  });

  const totaalCenten = factuur.regels.reduce(
    (som, regel) => som + regel.bedragCenten,
    0,
  );
  const betaaldCenten = factuur.betalingen.reduce(
    (som, betaling) => som + betaling.bedragCenten,
    0,
  );

  const status = factuurStandStatus({ ...factuur, totaalCenten });

  await tx.factuur.update({
    where: { id: factuurId },
    data: { totaalCenten, status },
  });
  if (herberekenGerelateerde) {
    const gerelateerdeId =
      factuur.crediteertFactuur?.id ?? factuur.creditfactuur?.id;
    if (gerelateerdeId) await hertelFactuur(tx, gerelateerdeId, false);
  }

  return { totaalCenten, betaaldCenten, status };
}

export function betaaldBedrag(
  betalingen: readonly { bedragCenten: number }[],
): number {
  return betalingen.reduce((som, betaling) => som + betaling.bedragCenten, 0);
}

/** Tekst voor een herinneringsmail. Het bestuur verstuurt zelf. */
export function maakHerinneringstekst(gegevens: {
  relatieNaam: string;
  contactpersoon: string | null;
  nummer: string;
  factuurdatum: string;
  vervaldatum: string;
  openstaandBedrag: string;
  omschrijving: string;
  organisatieNaam: string;
  iban: string;
  afzender: string;
  dagenOver: number;
}): string {
  const aanhef = gegevens.contactpersoon
    ? `Beste ${gegevens.contactpersoon},`
    : `Beste ${gegevens.relatieNaam},`;

  const zin =
    gegevens.dagenOver > 0
      ? `Onze factuur ${gegevens.nummer} van ${gegevens.factuurdatum} is inmiddels ${gegevens.dagenOver} dagen over de betaaltermijn; de vervaldatum was ${gegevens.vervaldatum}.`
      : `Onze factuur ${gegevens.nummer} van ${gegevens.factuurdatum} vervalt op ${gegevens.vervaldatum}.`;

  return [
    aanhef,
    "",
    zin,
    "",
    `Het gaat om ${gegevens.omschrijving}, waarvan nog ${gegevens.openstaandBedrag} openstaat.`,
    gegevens.iban
      ? `Wij verzoeken je het bedrag over te maken naar ${gegevens.iban} onder vermelding van ${gegevens.nummer}.`
      : `Wij verzoeken je het bedrag over te maken onder vermelding van ${gegevens.nummer}.`,
    "",
    "Is de betaling inmiddels gedaan? Dan kun je dit bericht als niet verzonden beschouwen.",
    "",
    "Met vriendelijke groet,",
    gegevens.afzender,
    gegevens.organisatieNaam,
  ].join("\n");
}
