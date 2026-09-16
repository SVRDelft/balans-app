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
import { hertelFactuur, vergrendelFactuur, type DbClient } from "@/lib/facturen";
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
  if (!regel.bankimport.bevestigdOp) throw new Error("Bevestig eerst de import en het banksaldo bovenaan deze pagina.");
  const [soort, id] = doel.split(":");
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

async function voorstellenVerwerken(tx: DbClient, jaarId: string, importId: string, gebruiker: string) {
  const regels = await tx.bankmutatie.findMany({ where: { importId, boekjaarId: jaarId, verwerking: "open" }, orderBy: [{ datum: "asc" }, { id: "asc" }] });
  const keuzes = await bankKeuzes(jaarId, tx);
  const voorstellen = bankVoorstellen(regels, keuzes.facturen, keuzes.betalingen, keuzes.uitgaven);
  let verwerkt = 0;
  for (const [id, voorstel] of [...voorstellen].slice(0, 50)) {
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
      const aantal = await voorstellenVerwerken(tx, jaar.id, bankimport.id, sessie.naam);
      await logAudit({ gebruiker: sessie.naam, boekjaarId: jaar.id, entiteit: "Bankimport", entiteitId: bankimport.id, actie: "bevestigd", samenvatting: `Afschrift bevestigd; banksaldo ${formatteerEuro(bankimport.eindSaldoCenten)} en ${aantal} koppelingen verwerkt.` }, tx);
      return aantal;
    }, { timeout: 60_000 });
    vernieuw(); return { melding: `Banksaldo overgenomen en ${verwerkt} voorgestelde koppelingen verwerkt.` };
  });
}

export async function bevestigVoorstellen(_staat: ActieStaat, formulier: FormData): Promise<ActieStaat> {
  const sessie = await vereisSessie();
  return voerUit(async () => {
    const jaar = await vereisSchrijfbaarBoekjaar();
    const id = leesTekst(formulier, "importId");
    if (!id) throw new Error("Kies een bankimport.");
    const aantal = await db.$transaction(async tx => { await vergrendelJaar(tx, jaar.id); return voorstellenVerwerken(tx, jaar.id, id, sessie.naam); }, { timeout: 60_000 });
    vernieuw(); return { melding: `${aantal} koppelingen verwerkt.` };
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
      const regel = id ? await tx.bankmutatie.findUnique({ where: { id, boekjaarId: jaar.id }, include: { betaling: true, uitgave: true } }) : null;
      if (!regel || regel.verwerking === "open") throw new Error("Deze bankregel is niet gekoppeld.");
      if (regel.verwerking === "nieuwe_uitgave" && (regel.uitgave?.omslagrondeId || regel.uitgave?.bijlageId)) throw new Error("Aan deze uitgave is een bonnetje of omslag gekoppeld. Verwijder die koppeling eerst of boek een correctie.");
      if (regel.betaling) await vergrendelFactuur(tx, regel.betaling.factuurId, jaar.id);
      if (regel.uitgaveId) await tx.$queryRaw`SELECT id FROM "Uitgave" WHERE id = ${regel.uitgaveId} FOR UPDATE`;
      await tx.bankmutatie.update({ where: { id: regel.id }, data: { verwerking: "open", betalingId: null, uitgaveId: null, notitie: null, verwerktOp: null, verwerktDoor: null } });
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
