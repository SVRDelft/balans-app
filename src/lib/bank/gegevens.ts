import "server-only";
import { db } from "@/lib/db";
import type { DbClient } from "@/lib/facturen";
import { factuurStandRelaties } from "@/lib/factuur-includes";
import { factuurOpenstaand } from "@/lib/finance/factuurstanden";

/**
 * Waar een bankregel aan gekoppeld kan worden.
 *
 * Facturen uit eerdere boekjaren staan er bewust bij: een vereniging die pas in
 * oktober de factuur van mei betaalt, moet gewoon te koppelen zijn. De betaling
 * wordt dan in het jaar van het afschrift geboekt, terwijl de factuur in zijn
 * eigen jaar blijft staan. Uitgaven en al ingevoerde betalingen blijven bij het
 * boekjaar van het afschrift zelf.
 */
export async function bankKeuzes(boekjaarId: string, client: DbClient = db) {
  const boekjaar = await client.boekjaar.findUniqueOrThrow({
    where: { id: boekjaarId },
    select: { startDatum: true },
  });
  const [facturen, betalingen, uitgaven] = await Promise.all([
    client.factuur.findMany({
      where: {
        status: { not: "concept" },
        boekjaar: { startDatum: { lte: boekjaar.startDatum } },
      },
      include: { betalingen: true, relatie: true, boekjaar: { select: { id: true, naam: true } }, ...factuurStandRelaties },
      orderBy: { nummer: "desc" },
    }),
    client.betaling.findMany({ where: { boekjaarId, bankmutatie: null }, select: { id: true, factuurId: true, datum: true, bedragCenten: true } }),
    client.uitgave.findMany({ where: { boekjaarId, bankmutatie: null }, include: { relatie: true }, orderBy: { datum: "desc" } }),
  ]);
  return {
    facturen: facturen.map(f => ({ id: f.id, nummer: f.nummer, relatieNaam: f.relatie.naam, iban: f.relatie.iban, status: f.status, openstaandCenten: factuurOpenstaand(f), boekjaarId: f.boekjaar.id, boekjaarNaam: f.boekjaar.naam })),
    betalingen,
    uitgaven: uitgaven.map(u => ({ id: u.id, omschrijving: u.omschrijving, leverancierNaam: u.leverancierNaam, iban: u.relatie?.iban ?? "", bedragCenten: u.bedragCenten, betaald: u.betaald })),
  };
}
