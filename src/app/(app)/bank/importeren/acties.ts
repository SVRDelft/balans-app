"use server";

import { createHash } from "node:crypto";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { vereisSessie } from "@/lib/auth/server";
import { vereisSchrijfbaarBoekjaar } from "@/lib/boekjaar";
import { leesTekst, voerUit, type ActieStaat } from "@/lib/acties";
import { logAudit } from "@/lib/audit";
import { parseerMt940 } from "@/lib/bank/mt940";
import { bankKeuzes } from "@/lib/bank/gegevens";
import { bankVoorstellen, normaliseerRekening } from "@/lib/bank/koppelen";
import { factuurStandRelaties } from "@/lib/factuur-includes";
import { factuurOpenstaand } from "@/lib/finance/factuurstanden";
import { hertelFactuur, vergrendelFactuur, volgendFactuurnummer, type DbClient } from "@/lib/facturen";
import { formatteerEuro } from "@/lib/geld";

const hash = (tekst: string) => createHash("sha256").update(tekst).digest("hex");
const utc = (datum: string) => new Date(`${datum}T00:00:00Z`);
function vernieuw() { revalidatePath("/", "layout"); }
async function vergrendelJaar(tx: DbClient, id: string) {
  await tx.$queryRaw`SELECT id FROM "Boekjaar" WHERE id = ${id} FOR UPDATE`;
  if (!(await tx.boekjaar.findUnique({ where: { id } }))?.actief) throw new Error("Dit boekjaar is niet meer actief.");
}

export async function importeerBankbestand(_staat: ActieStaat, formulier: FormData): Promise<ActieStaat> {
  const sessie = await vereisSessie();
  let importId = "";
  const resultaat = await voerUit(async () => {
    const jaar = await vereisSchrijfbaarBoekjaar();
    const bestand = formulier.get("bestand");
    if (!(bestand instanceof File) || !bestand.size || bestand.size > 2 * 1024 * 1024) return { fout: "Kies een MT940-bestand van maximaal 2 MB." };
    const bytes = new Uint8Array(await bestand.arrayBuffer());
    let inhoud: string;
    try { inhoud = new TextDecoder("utf-8", { fatal: true }).decode(bytes); }
    catch { inhoud = new TextDecoder("windows-1252").decode(bytes); }
    const data = parseerMt940(inhoud);
    if (data.transacties.length > 2000) return { fout: "Dit bestand heeft meer dan 2.000 bankregels. Download een kortere periode bij de bank." };
    const eerste = data.afschriften[0], laatste = data.afschriften.at(-1)!;
    if (utc(laatste.eindDatum) > jaar.eindDatum || utc(laatste.eindDatum) < jaar.startDatum || data.transacties.some(t => utc(t.boekdatum) < jaar.startDatum || utc(t.boekdatum) > jaar.eindDatum)) return { fout: "De datums vallen buiten het actieve boekjaar. Download een bestand voor dit boekjaar." };
    const rekening = normaliseerRekening(data.rekening);
    const instellingen = await db.instellingen.findUnique({ where: { id: "svr" } });
    const eigenIban = normaliseerRekening(instellingen?.iban ?? "");
    if (eigenIban && rekening !== eigenIban && !(/^\d{9,10}$/.test(rekening) && eigenIban.startsWith("NL") && eigenIban.endsWith(rekening.padStart(10, "0")) )) return { fout: "De rekening in dit bestand wijkt af van het IBAN bij Instellingen. Controleer of je de SVR-rekening hebt gedownload." };
    const bestandHash = hash(inhoud.replace(/\r\n?/g, "\n").trim());
    const voorkomens = new Map<string, number>();
    // ABN's bank reference can be a transaction code, so never deduplicate on that alone.
    const regels = data.transacties.map(t => {
      const basis = JSON.stringify([rekening, t.boekdatum, t.valutadatum, t.bedragCenten, t.bankReferentie, t.klantReferentie, t.omschrijving.replace(/\s+/g, " ").trim()]);
      const keer = (voorkomens.get(basis) ?? 0) + 1;
      voorkomens.set(basis, keer);
      return { sleutel: hash(`${basis}|${keer}`), rekening, datum: utc(t.boekdatum), bedragCenten: t.bedragCenten, omschrijving: t.omschrijving, tegenpartijNaam: t.tegenpartijNaam ?? "", tegenpartijIban: t.tegenpartijIban ?? "", bankReferentie: t.bankReferentie };
    });
    await db.$transaction(async tx => {
      await vergrendelJaar(tx, jaar.id);
      const bestaand = await tx.bankimport.findUnique({ where: { bestandHash } });
      if (bestaand) {
        if (bestaand.boekjaarId !== jaar.id) throw new Error("Dit bestand is al in een ander boekjaar ingelezen.");
        importId = bestaand.id; return;
      }
      const vorige = await tx.bankimport.findFirst({ where: { boekjaarId: jaar.id } });
      if (vorige && vorige.rekening !== rekening) throw new Error("Dit boekjaar gebruikt al een andere bankrekening. Importeer alleen afschriften van dezelfde SVR-rekening.");
      const gemaakt = await tx.bankimport.create({ data: { boekjaarId: jaar.id, bestandHash, bestandsnaam: bestand.name.slice(0, 200), rekening, beginDatum: utc(eerste.beginDatum), eindDatum: utc(laatste.eindDatum), beginSaldoCenten: eerste.beginSaldoCenten, eindSaldoCenten: laatste.eindSaldoCenten, aantalRegels: regels.length, aangemaaktDoor: sessie.naam } });
      const resultaat = await tx.bankmutatie.createMany({ data: regels.map(r => ({ ...r, importId: gemaakt.id, boekjaarId: jaar.id })), skipDuplicates: true });
      await tx.bankimport.update({ where: { id: gemaakt.id }, data: { duplicaten: regels.length - resultaat.count } });
      await logAudit({ gebruiker: sessie.naam, boekjaarId: jaar.id, entiteit: "Bankimport", entiteitId: gemaakt.id, actie: "ingelezen", samenvatting: `${resultaat.count} nieuwe bankregels ingelezen; ${regels.length - resultaat.count} al aanwezig.` }, tx);
      importId = gemaakt.id;
    }, { timeout: 30_000 });
  });
  if (resultaat.fout) return resultaat;
  vernieuw();
  redirect(`/bank/importeren/${importId}`);
}

async function koppel(tx: DbClient, jaarId: string, mutatieId: string, doel: string, gebruiker: string, formulier?: FormData) {
  const regel = await tx.bankmutatie.findUnique({ where: { id: mutatieId, boekjaarId: jaarId }, include: { bankimport: true } });
  if (!regel || regel.verwerking !== "open") throw new Error("Deze bankregel is niet meer beschikbaar. Vernieuw de pagina.");
  const [soort, id] = doel.split(":");
  const tegenIban = normaliseerRekening(regel.tegenpartijIban);
  // Het rekeningnummer van de betaler onthouden bij de relatie, zodat de
  // volgende betaling van dezelfde rekening zeker herkend wordt. Een al
  // ingevuld IBAN wordt nooit overschreven.
  const onthoudIban = async (relatieId: string | null | undefined) => {
    if (!relatieId || !tegenIban) return;
    await tx.relatie.updateMany({ where: { id: relatieId, iban: "" }, data: { iban: tegenIban } });
  };
  let verwerking = "", betalingId: string | undefined, uitgaveId: string | undefined;
  const notitie = formulier ? leesTekst(formulier, "notitie") : undefined;
  if (soort === "factuur" && id) {
    await vergrendelFactuur(tx, id, jaarId);
    const factuur = await tx.factuur.findUnique({ where: { id, boekjaarId: jaarId }, include: { betalingen: true, ...factuurStandRelaties } });
    if (!factuur || factuur.status === "concept" || factuur.status === "oninbaar") throw new Error("Kies een verstuurde factuur. Herstel een oninbare factuur eerst.");
    const open = factuurOpenstaand(factuur);
    if (Math.sign(open) !== Math.sign(regel.bedragCenten) || Math.abs(regel.bedragCenten) > Math.abs(open)) throw new Error("Het bedrag past niet bij het openstaande saldo. Controleer eerdere betalingen en kies zo nodig een al ingevoerde betaling.");
    betalingId = (await tx.betaling.create({ data: { factuurId: id, datum: regel.datum, bedragCenten: regel.bedragCenten, notitie: `Bankimport: ${regel.omschrijving}`, geregistreerdDoor: gebruiker } })).id;
    verwerking = "nieuwe_betaling";
    await hertelFactuur(tx, id);
    if (regel.bedragCenten > 0) await onthoudIban(factuur.relatieId);
  } else if (soort === "betaling" && id) {
    const betaling = await tx.betaling.findUnique({ where: { id, factuur: { boekjaarId: jaarId }, bankmutatie: null } });
    if (!betaling || betaling.bedragCenten !== regel.bedragCenten || betaling.datum.toISOString().slice(0, 10) !== regel.datum.toISOString().slice(0, 10)) throw new Error("Deze bestaande betaling past niet bij bedrag en datum van de bankregel, of is al gekoppeld.");
    await vergrendelFactuur(tx, betaling.factuurId, jaarId);
    betalingId = betaling.id; verwerking = "bestaande_betaling";
  } else if (soort === "uitgave" && id) {
    await tx.$queryRaw`SELECT id FROM "Uitgave" WHERE id = ${id} AND "boekjaarId" = ${jaarId} FOR UPDATE`;
    const uitgave = await tx.uitgave.findUnique({ where: { id, boekjaarId: jaarId, bankmutatie: null } });
    if (!uitgave || regel.bedragCenten >= 0 || uitgave.bedragCenten !== -regel.bedragCenten) throw new Error("Kies een ongekoppelde uitgave met hetzelfde bedrag als deze afschrijving.");
    uitgaveId = id; verwerking = uitgave.betaald ? "bestaande_uitgave" : "uitgave_betaald";
    if (!uitgave.betaald) await tx.uitgave.update({ where: { id }, data: { betaald: true, betaaldOp: regel.datum } });
    await onthoudIban(uitgave.relatieId);
  } else if (soort === "inkomst" && formulier && regel.bedragCenten > 0) {
    // Geld dat binnenkomt zonder factuur, zoals een sponsorbijdrage. In deze
    // administratie telt opbrengst via facturen, dus de import maakt er een
    // betaalde factuur van op de gekozen inkomstenpost.
    const postId = leesTekst(formulier, "begrotingspostId");
    const relatieId = leesTekst(formulier, "relatieId");
    const omschrijving = leesTekst(formulier, "omschrijving");
    if (!postId || !relatieId || !omschrijving) throw new Error("Kies een relatie en een inkomstenpost, en vul een omschrijving in.");
    if (!await tx.begrotingspost.findUnique({ where: { id: postId, boekjaarId: jaarId, soort: "inkomst" } })) throw new Error("Kies een inkomstenpost uit dit boekjaar.");
    if (!await tx.relatie.findUnique({ where: { id: relatieId } })) throw new Error("Deze relatie bestaat niet meer.");
    const { nummer, volgnummer } = await volgendFactuurnummer(tx, jaarId);
    const factuur = await tx.factuur.create({ data: {
      boekjaarId: jaarId, nummer, volgnummer, relatieId, omschrijving,
      factuurdatum: regel.datum, vervaldatum: regel.datum, status: "verstuurd", verstuurdOp: regel.datum,
      notities: `Aangemaakt vanuit de bankimport: ${regel.omschrijving}`.slice(0, 2000),
      regels: { create: [{ omschrijving, aantal: 1, prijsPerStukCenten: regel.bedragCenten, bedragCenten: regel.bedragCenten, begrotingspostId: postId, volgorde: 0 }] },
    } });
    await hertelFactuur(tx, factuur.id);
    betalingId = (await tx.betaling.create({ data: { factuurId: factuur.id, datum: regel.datum, bedragCenten: regel.bedragCenten, notitie: `Bankimport: ${regel.omschrijving}`, geregistreerdDoor: gebruiker } })).id;
    await hertelFactuur(tx, factuur.id);
    await onthoudIban(relatieId);
    verwerking = "nieuwe_inkomst";
  } else if (soort === "nieuw" && formulier && regel.bedragCenten < 0) {
    const postId = leesTekst(formulier, "begrotingspostId");
    const leverancierNaam = leesTekst(formulier, "leverancierNaam");
    const omschrijving = leesTekst(formulier, "omschrijving");
    if (!leverancierNaam || !omschrijving || !postId || !await tx.begrotingspost.findUnique({ where: { id: postId, boekjaarId: jaarId, soort: "uitgave" } })) throw new Error("Vul een leverancier, omschrijving en kostenpost uit dit boekjaar in.");
    uitgaveId = (await tx.uitgave.create({ data: { boekjaarId: jaarId, datum: regel.datum, leverancierNaam, omschrijving, bedragCenten: -regel.bedragCenten, begrotingspostId: postId, betaald: true, betaaldOp: regel.datum, bedragDefinitief: true } })).id;
    verwerking = "nieuwe_uitgave";
  } else if (soort === "negeren" && notitie) verwerking = "genegeerd";
  else throw new Error("Kies een koppeling, of geef een reden om deze bankregel buiten de administratie te laten.");
  await tx.bankmutatie.update({ where: { id: regel.id, verwerking: "open" }, data: { verwerking, betalingId, uitgaveId, notitie, verwerktOp: new Date(), verwerktDoor: gebruiker } });
  await logAudit({ gebruiker, boekjaarId: jaarId, entiteit: "Bankmutatie", entiteitId: regel.id, actie: "gekoppeld", samenvatting: `Bankregel ${formatteerEuro(regel.bedragCenten)} verwerkt: ${verwerking}.`, details: { betalingId, uitgaveId, notitie } }, tx);
}

/**
 * Verwerkt de voorstellen van de aangevinkte bankregels. De voorstellen worden
 * hier opnieuw berekend, zodat er alleen geboekt wordt wat nu nog klopt.
 */
async function voorstellenVerwerken(tx: DbClient, jaarId: string, importId: string, gebruiker: string, gekozen: Set<string>) {
  const regels = await tx.bankmutatie.findMany({ where: { importId, boekjaarId: jaarId, verwerking: "open" }, orderBy: [{ datum: "asc" }, { id: "asc" }] });
  const keuzes = await bankKeuzes(jaarId, tx);
  const voorstellen = bankVoorstellen(regels, keuzes.facturen, keuzes.betalingen, keuzes.uitgaven);
  let verwerkt = 0;
  for (const [id, voorstel] of voorstellen) {
    if (!gekozen.has(id)) continue;
    await koppel(tx, jaarId, id, voorstel.waarde, gebruiker);
    verwerkt++;
  }
  return verwerkt;
}

export async function bevestigBankimport(_staat: ActieStaat, formulier: FormData): Promise<ActieStaat> {
  const sessie = await vereisSessie();
  return voerUit(async () => {
    const jaar = await vereisSchrijfbaarBoekjaar();
    const id = leesTekst(formulier, "importId");
    const verwerkt = await db.$transaction(async tx => {
      await vergrendelJaar(tx, jaar.id);
      const bankimport = id ? await tx.bankimport.findUnique({ where: { id, boekjaarId: jaar.id } }) : null;
      if (!bankimport) throw new Error("Deze bankimport bestaat niet in dit boekjaar.");
      if (bankimport.bevestigdOp) throw new Error("Deze import is al bevestigd. Het banksaldo wordt niet nogmaals opgeslagen.");
      const saldo = await tx.banksaldo.create({ data: { boekjaarId: jaar.id, datum: bankimport.eindDatum, saldoCenten: bankimport.eindSaldoCenten, notitie: `MT940: ${bankimport.bestandsnaam}`, ingevoerdDoor: sessie.naam } });
      await tx.bankimport.update({ where: { id: bankimport.id }, data: { bevestigdOp: new Date(), banksaldoId: saldo.id } });
      await logAudit({ gebruiker: sessie.naam, boekjaarId: jaar.id, entiteit: "Bankimport", entiteitId: bankimport.id, actie: "bevestigd", samenvatting: `Afschrift bevestigd; banksaldo ${formatteerEuro(bankimport.eindSaldoCenten)} overgenomen.` }, tx);
      return bankimport.eindSaldoCenten;
    }, { timeout: 60_000 });
    vernieuw(); return { melding: `Banksaldo van ${formatteerEuro(verwerkt)} overgenomen.` };
  });
}

export async function koppelSelectie(_staat: ActieStaat, formulier: FormData): Promise<ActieStaat> {
  const sessie = await vereisSessie();
  return voerUit(async () => {
    const jaar = await vereisSchrijfbaarBoekjaar();
    const id = leesTekst(formulier, "importId");
    if (!id) throw new Error("Kies een bankimport.");
    const gekozen = new Set(formulier.getAll("mutatieId").map(String));
    if (gekozen.size === 0) return { fout: "Vink minstens één voorstel aan." };
    const aantal = await db.$transaction(async tx => { await vergrendelJaar(tx, jaar.id); return voorstellenVerwerken(tx, jaar.id, id, sessie.naam, gekozen); }, { timeout: 120_000 });
    vernieuw();
    const overgeslagen = gekozen.size - aantal;
    return { melding: `${aantal} ${aantal === 1 ? "bankregel" : "bankregels"} gekoppeld.${overgeslagen > 0 ? ` ${overgeslagen} voorstel${overgeslagen === 1 ? " klopte" : "len klopten"} inmiddels niet meer en ${overgeslagen === 1 ? "is" : "zijn"} overgeslagen.` : ""}` };
  });
}

export async function verwerkBankmutatie(_staat: ActieStaat, formulier: FormData): Promise<ActieStaat> {
  const sessie = await vereisSessie();
  return voerUit(async () => {
    const jaar = await vereisSchrijfbaarBoekjaar();
    await db.$transaction(async tx => { await vergrendelJaar(tx, jaar.id); await koppel(tx, jaar.id, leesTekst(formulier, "mutatieId") ?? "", leesTekst(formulier, "doel") ?? "", sessie.naam, formulier); }, { timeout: 30_000 });
    vernieuw(); return { melding: "Bankregel verwerkt." };
  });
}

export async function ontkoppelBankmutatie(_staat: ActieStaat, formulier: FormData): Promise<ActieStaat> {
  const sessie = await vereisSessie();
  return voerUit(async () => {
    const jaar = await vereisSchrijfbaarBoekjaar();
    const id = leesTekst(formulier, "mutatieId");
    await db.$transaction(async tx => {
      await vergrendelJaar(tx, jaar.id);
      const regel = id ? await tx.bankmutatie.findUnique({ where: { id, boekjaarId: jaar.id }, include: { betaling: { include: { factuur: { select: { relatieId: true } } } }, uitgave: true } }) : null;
      if (!regel || regel.verwerking === "open") throw new Error("Deze bankregel is niet gekoppeld.");
      // Een rekeningnummer dat door deze koppeling is geleerd, hoort bij een
      // verkeerde keuze ook weer weg; anders koppelt de app die rekening
      // voortaan zeker aan de verkeerde relatie. Het blijft staan als een andere,
      // nog gekoppelde bankregel van dezelfde rekening het bevestigt.
      const relatieId = regel.betaling?.factuur.relatieId ?? regel.uitgave?.relatieId ?? null;
      const geleerd = normaliseerRekening(regel.tegenpartijIban);
      if (relatieId && geleerd) {
        const bevestigd = await tx.bankmutatie.count({
          where: {
            id: { not: regel.id },
            tegenpartijIban: regel.tegenpartijIban,
            verwerking: { not: "open" },
            OR: [{ betaling: { factuur: { relatieId } } }, { uitgave: { relatieId } }],
          },
        });
        if (bevestigd === 0) await tx.relatie.updateMany({ where: { id: relatieId, iban: geleerd }, data: { iban: "" } });
      }
      if (regel.verwerking === "nieuwe_uitgave" && (regel.uitgave?.omslagrondeId || regel.uitgave?.bijlageId)) throw new Error("Aan deze uitgave is een bonnetje of omslag gekoppeld. Verwijder die koppeling eerst of boek een correctie.");
      if (regel.betaling) await vergrendelFactuur(tx, regel.betaling.factuurId, jaar.id);
      if (regel.uitgaveId) await tx.$queryRaw`SELECT id FROM "Uitgave" WHERE id = ${regel.uitgaveId} FOR UPDATE`;
      await tx.bankmutatie.update({ where: { id: regel.id }, data: { verwerking: "open", betalingId: null, uitgaveId: null, notitie: null, verwerktOp: null, verwerktDoor: null } });
      if (regel.verwerking === "nieuwe_inkomst" && regel.betaling) {
        // De factuur is door de import zelf aangemaakt; die gaat mee terug.
        await tx.betaling.delete({ where: { id: regel.betaling.id } });
        await tx.factuur.delete({ where: { id: regel.betaling.factuurId } });
      }
      if (regel.verwerking === "nieuwe_betaling" && regel.betaling) {
        await tx.betaling.delete({ where: { id: regel.betaling.id } });
        await hertelFactuur(tx, regel.betaling.factuurId);
      }
      if (regel.verwerking === "uitgave_betaald" && regel.uitgaveId) await tx.uitgave.update({ where: { id: regel.uitgaveId }, data: { betaald: false, betaaldOp: null } });
      if (regel.verwerking === "nieuwe_uitgave" && regel.uitgaveId) await tx.uitgave.delete({ where: { id: regel.uitgaveId } });
      await logAudit({ gebruiker: sessie.naam, boekjaarId: jaar.id, entiteit: "Bankmutatie", entiteitId: regel.id, actie: "ontkoppeld", samenvatting: `Bankregel ${formatteerEuro(regel.bedragCenten)} ontkoppeld; door de import aangemaakte boeking teruggedraaid.` }, tx);
    }, { timeout: 30_000 });
    vernieuw(); return { melding: "Koppeling ongedaan gemaakt." };
  });
}
