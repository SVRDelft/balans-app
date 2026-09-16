import "server-only";
import { db } from "@/lib/db";
import type { DbClient } from "@/lib/facturen";
import { factuurStandRelaties } from "@/lib/factuur-includes";
import { factuurOpenstaand } from "@/lib/finance/factuurstanden";

export async function bankKeuzes(boekjaarId: string, client: DbClient = db) {
  const [facturen, betalingen, uitgaven] = await Promise.all([
    client.factuur.findMany({ where: { boekjaarId, status: { not: "concept" } }, include: { betalingen: true, relatie: true, ...factuurStandRelaties }, orderBy: { volgnummer: "desc" } }),
    client.betaling.findMany({ where: { factuur: { boekjaarId }, bankmutatie: null }, select: { id: true, factuurId: true, datum: true, bedragCenten: true } }),
    client.uitgave.findMany({ where: { boekjaarId, bankmutatie: null }, include: { relatie: true }, orderBy: { datum: "desc" } }),
  ]);
  return {
    facturen: facturen.map(f => ({ id: f.id, nummer: f.nummer, relatieNaam: f.relatie.naam, iban: f.relatie.iban, status: f.status, openstaandCenten: factuurOpenstaand(f) })),
    betalingen,
    uitgaven: uitgaven.map(u => ({ id: u.id, omschrijving: u.omschrijving, leverancierNaam: u.leverancierNaam, iban: u.relatie?.iban ?? "", bedragCenten: u.bedragCenten, betaald: u.betaald })),
  };
}
