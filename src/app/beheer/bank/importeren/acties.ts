"use server";

import { createHash } from "node:crypto";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { vergrendelRij } from "@/lib/slot";
import { vereisBestuur } from "@/lib/auth/server";
import { vereisSchrijfbaarBoekjaar } from "@/lib/boekjaar";
import { leesTekst, voerUit, type ActieStaat } from "@/lib/acties";
import { logAudit } from "@/lib/audit";
import { parseerMt940 } from "@/lib/bank/mt940";
import { bankKeuzes } from "@/lib/bank/gegevens";
import { bankVoorstellen, normaliseerRekening } from "@/lib/bank/koppelen";
import { factuurStandRelaties } from "@/lib/factuur-includes";
import { factuurOpenstaand } from "@/lib/finance/factuurstanden";
import { hertelFactuur, vergrendelFactuur, volgendFactuurnummer, type DbClient } from "@/lib/facturen";
import { formatteerDatum } from "@/lib/datum";
import { formatteerEuro } from "@/lib/geld";

const hash = (tekst: string) => createHash("sha256").update(tekst).digest("hex");
const utc = (datum: string) => new Date(`${datum}T00:00:00Z`);
function vernieuw() { revalidatePath("/", "layout"); }
async function vergrendelJaar(tx: DbClient, id: string) {
  await vergrendelRij(tx, "Boekjaar", id);
  // Ook een oud jaar dat in reconstructie staat mag hier geboekt worden: dat is
  // juist de bedoeling als je het opbouwt uit oude afschriften.
  const jaar = await tx.boekjaar.findUnique({ where: { id } });
  if (!jaar?.actief && !jaar?.reconstructie) {
    throw new Error("Dit boekjaar is niet meer actief. Zet het bij Boekjaren op \"Opbouwen\" als je er alsnog in wilt boeken.");
  }
}

export async function importeerBankbestand(_staat: ActieStaat, formulier: FormData): Promise<ActieStaat> {
  const sessie = await vereisBestuur();
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
    const alleDatums = data.afschriften.flatMap(a => [a.beginDatum, a.eindDatum]).sort();
    if (utc(alleDatums.at(-1)!) > jaar.eindDatum || utc(alleDatums[0]) < jaar.startDatum || data.transacties.some(t => utc(t.boekdatum) < jaar.startDatum || utc(t.boekdatum) > jaar.eindDatum)) {
      return { fout: `Dit bestand loopt van ${formatteerDatum(utc(alleDatums[0]))} t/m ${formatteerDatum(utc(alleDatums.at(-1)!))}, en dat valt buiten ${jaar.naam} (${formatteerDatum(jaar.startDatum)} t/m ${formatteerDatum(jaar.eindDatum)}). Download bij de bank precies de periode van dit boekjaar. Gaat het om een ouder jaar, maak dat boekjaar dan aan en zet het bij Boekjaren op "Opbouwen".` };
    }

    // ABN levert desgevraagd de betaalrekening en de spaarrekening in één
    // bestand. De rekening uit Instellingen is de betaalrekening; een tweede
    // rekening in hetzelfde bestand is dan de spaarrekening.
    const instellingen = await db.instellingen.findUnique({ where: { id: "svr" } });
    const eigenIban = normaliseerRekening(instellingen?.iban ?? "");
    const rekeningen = data.rekeningen.map(normaliseerRekening);
    const isEigen = (nummer: string) =>
      nummer === eigenIban ||
      (/^\d{9,10}$/.test(nummer) && eigenIban.startsWith("NL") && eigenIban.endsWith(nummer.padStart(10, "0")));
    const rekening = eigenIban ? rekeningen.find(isEigen) : rekeningen[0];
    if (!rekening) {
      return { fout: `Geen van de rekeningen in dit bestand (${rekeningen.join(", ")}) is de SVR-rekening uit Instellingen. Controleer of je het juiste afschrift hebt gedownload.` };
    }
    const overige = rekeningen.filter(nummer => nummer !== rekening);
    if (overige.length > 1) {
      return { fout: `Dit bestand bevat ${rekeningen.length} rekeningen. Download de betaalrekening, eventueel samen met de spaarrekening, maar niet meer dan dat.` };
    }
    const spaarRekening = overige[0] ?? null;
    const reeksVan = (nummer: string) => data.afschriften.filter(a => normaliseerRekening(a.rekening) === nummer);
    const eigenReeks = reeksVan(rekening);
    const eerste = eigenReeks[0], laatste = eigenReeks.at(-1)!;
    const spaarReeks = spaarRekening ? reeksVan(spaarRekening) : [];
    const bestandHash = hash(inhoud.replace(/\r\n?/g, "\n").trim());
    const voorkomens = new Map<string, number>();
    // ABN's bank reference can be a transaction code, so never deduplicate on that alone.
    const regels = data.transacties.map(t => {
      const basis = JSON.stringify([normaliseerRekening(t.rekening), t.boekdatum, t.valutadatum, t.bedragCenten, t.bankReferentie, t.klantReferentie, t.omschrijving.replace(/\s+/g, " ").trim()]);
      const keer = (voorkomens.get(basis) ?? 0) + 1;
      voorkomens.set(basis, keer);
      return { sleutel: hash(`${basis}|${keer}`), rekening: normaliseerRekening(t.rekening), datum: utc(t.boekdatum), bedragCenten: t.bedragCenten, omschrijving: t.omschrijving, tegenpartijNaam: t.tegenpartijNaam ?? "", tegenpartijIban: t.tegenpartijIban ?? "", bankReferentie: t.bankReferentie };
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
      const gemaakt = await tx.bankimport.create({ data: {
        boekjaarId: jaar.id, bestandHash, bestandsnaam: bestand.name.slice(0, 200), rekening,
        beginDatum: utc(eerste.beginDatum), eindDatum: utc(laatste.eindDatum),
        beginSaldoCenten: eerste.beginSaldoCenten, eindSaldoCenten: laatste.eindSaldoCenten,
        spaarRekening,
        spaarEindSaldoCenten: spaarReeks.at(-1)?.eindSaldoCenten ?? null,
        spaarEindDatum: spaarReeks.length ? utc(spaarReeks.at(-1)!.eindDatum) : null,
        aantalRegels: regels.length, aangemaaktDoor: sessie.naam,
      } });
      const resultaat = await tx.bankmutatie.createMany({ data: regels.map(r => ({ ...r, importId: gemaakt.id, boekjaarId: jaar.id })), skipDuplicates: true });
      await tx.bankimport.update({ where: { id: gemaakt.id }, data: { duplicaten: regels.length - resultaat.count } });
      await logAudit({ gebruiker: sessie.naam, boekjaarId: jaar.id, entiteit: "Bankimport", entiteitId: gemaakt.id, actie: "ingelezen", samenvatting: `${resultaat.count} nieuwe bankregels ingelezen; ${regels.length - resultaat.count} al aanwezig.${spaarRekening ? ` Inclusief spaarrekening ${spaarRekening}.` : ""}` }, tx);
      importId = gemaakt.id;
    }, { timeout: 30_000 });
  });
  if (resultaat.fout) return resultaat;
  vernieuw();
  redirect(`/beheer/bank/importeren/${importId}`);
}

type Jaar = { id: string; startDatum: Date };

async function koppel(tx: DbClient, jaar: Jaar, mutatieId: string, doel: string, gebruiker: string, formulier?: FormData) {
  const jaarId = jaar.id;
  const regel = await tx.bankmutatie.findUnique({ where: { id: mutatieId, boekjaarId: jaarId }, include: { bankimport: true } });
  if (!regel || regel.verwerking !== "open") throw new Error("Deze bankregel is niet meer beschikbaar. Vernieuw de pagina.");
  const [soort, id] = doel.split(":");
  // Regels van de spaarrekening kunnen niet aan een factuur of uitgave hangen:
  // daar gaat geen geld van de SVR in of uit, het staat alleen ergens anders.
  const spaarRekening = regel.bankimport.spaarRekening;
  const isSpaarregel =
    spaarRekening !== null &&
    normaliseerRekening(regel.rekening) === normaliseerRekening(spaarRekening);
  if (isSpaarregel && !["spaarpost", "tegenkant", "negeren"].includes(soort)) {
    throw new Error("Dit is een regel van de spaarrekening. Kies rente, kosten of een correctie, of markeer hem als de tegenkant van een overboeking.");
  }
  if (!isSpaarregel && ["spaarpost", "tegenkant"].includes(soort)) {
    throw new Error("Deze keuze hoort bij een regel van de spaarrekening.");
  }
  const tegenIban = normaliseerRekening(regel.tegenpartijIban);
  // Het rekeningnummer van de betaler onthouden bij de relatie, zodat de
  // volgende betaling van dezelfde rekening zeker herkend wordt. Een al
  // ingevuld IBAN wordt nooit overschreven.
  const onthoudIban = async (relatieId: string | null | undefined) => {
    if (!relatieId || !tegenIban) return;
    await tx.relatie.updateMany({ where: { id: relatieId, iban: "" }, data: { iban: tegenIban } });
  };
  let verwerking = "", betalingId: string | undefined, uitgaveId: string | undefined, rekeningpostId: string | undefined, spaarmutatieId: string | undefined;
  const notitie = formulier ? leesTekst(formulier, "notitie") : undefined;
  if (soort === "factuur" && id) {
    // Ook een factuur uit een eerder boekjaar: geld komt soms maanden later
    // binnen. De betaling wordt dan geboekt in het jaar van dit afschrift,
    // terwijl de factuur in zijn eigen jaar blijft staan.
    const factuur = await tx.factuur.findUnique({ where: { id }, include: { betalingen: true, boekjaar: { select: { startDatum: true } }, ...factuurStandRelaties } });
    if (!factuur || factuur.boekjaar.startDatum > jaar.startDatum) throw new Error("Kies een factuur uit dit boekjaar of uit een eerder jaar.");
    await vergrendelFactuur(tx, id, factuur.boekjaarId);
    if (factuur.status === "concept" || factuur.status === "oninbaar") throw new Error("Kies een verstuurde factuur. Herstel een oninbare factuur eerst.");
    const open = factuurOpenstaand(factuur);
    if (Math.sign(open) !== Math.sign(regel.bedragCenten) || Math.abs(regel.bedragCenten) > Math.abs(open)) throw new Error("Het bedrag past niet bij het openstaande saldo. Controleer eerdere betalingen en kies zo nodig een al ingevoerde betaling.");
    betalingId = (await tx.betaling.create({ data: { factuurId: id, boekjaarId: jaarId, datum: regel.datum, bedragCenten: regel.bedragCenten, notitie: `Bankimport: ${regel.omschrijving}`, geregistreerdDoor: gebruiker } })).id;
    verwerking = "nieuwe_betaling";
    await hertelFactuur(tx, id);
    if (regel.bedragCenten > 0) await onthoudIban(factuur.relatieId);
  } else if (soort === "betaling" && id) {
    const betaling = await tx.betaling.findUnique({ where: { id, boekjaarId: jaarId, bankmutatie: null }, include: { factuur: { select: { boekjaarId: true } } } });
    if (!betaling || betaling.bedragCenten !== regel.bedragCenten || betaling.datum.toISOString().slice(0, 10) !== regel.datum.toISOString().slice(0, 10)) throw new Error("Deze bestaande betaling past niet bij bedrag en datum van de bankregel, of is al gekoppeld.");
    await vergrendelFactuur(tx, betaling.factuurId, betaling.factuur.boekjaarId);
    betalingId = betaling.id; verwerking = "bestaande_betaling";
  } else if (soort === "uitgave" && id) {
    await vergrendelRij(tx, "Uitgave", id);
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
    betalingId = (await tx.betaling.create({ data: { factuurId: factuur.id, boekjaarId: jaarId, datum: regel.datum, bedragCenten: regel.bedragCenten, notitie: `Bankimport: ${regel.omschrijving}`, geregistreerdDoor: gebruiker } })).id;
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
  } else if (soort === "rekeningpost" && formulier) {
    // Privegeld dat door de SVR-rekening liep: geen kosten of opbrengst, maar een
    // vordering op of een schuld aan een persoon. Een afschrijving betekent dat
    // die persoon de SVR nog moet betalen, een bijschrijving dat hij terugbetaalt.
    const relatieId = leesTekst(formulier, "relatieId");
    const omschrijving = leesTekst(formulier, "omschrijving");
    if (!relatieId || !omschrijving) throw new Error("Kies de persoon en vul een omschrijving in.");
    if (!await tx.relatie.findUnique({ where: { id: relatieId } })) throw new Error("Deze relatie bestaat niet meer.");
    rekeningpostId = (await tx.rekeningpost.create({ data: {
      boekjaarId: jaarId, relatieId, datum: regel.datum, omschrijving,
      bedragCenten: -regel.bedragCenten, viaBank: true, aangemaaktDoor: gebruiker,
      notities: `Uit de bankimport: ${regel.omschrijving}`.slice(0, 2000),
    } })).id;
    verwerking = "rekeningpost";
  } else if (soort === "spaarpost" && formulier) {
    // Rente of kosten op de spaarrekening zelf: die staan niet op het afschrift
    // van de betaalrekening, dus hier hoort een begrotingspost bij.
    const postId = leesTekst(formulier, "begrotingspostId");
    const omschrijving = leesTekst(formulier, "omschrijving");
    const spaarsoort = leesTekst(formulier, "spaarsoort") ?? "rente";
    if (!["rente", "kosten", "correctie"].includes(spaarsoort)) throw new Error("Kies rente, kosten of een correctie.");
    if (!postId || !omschrijving) throw new Error("Kies een begrotingspost en vul een omschrijving in.");
    if (!await tx.begrotingspost.findUnique({ where: { id: postId, boekjaarId: jaarId } })) throw new Error("Kies een begrotingspost uit dit boekjaar.");
    spaarmutatieId = (await tx.spaarmutatie.create({ data: {
      boekjaarId: jaarId, datum: regel.datum, omschrijving,
      bedragCenten: regel.bedragCenten, soort: spaarsoort, viaBetaalrekening: false,
      begrotingspostId: postId, aangemaaktDoor: gebruiker,
      notities: `Uit de bankimport: ${regel.omschrijving}`.slice(0, 2000),
    } })).id;
    verwerking = "spaarmutatie";
  } else if (soort === "tegenkant") {
    // De andere helft van een overboeking tussen de eigen rekeningen. Die is al
    // geboekt op de regel van de betaalrekening; hier alleen afvinken, anders
    // zou hetzelfde geld twee keer verhuizen.
    verwerking = "spaar_tegenkant";
  } else if (soort === "spaar" && formulier) {
    // Geld naar of van de eigen spaarrekening. Geen uitgave en geen opbrengst:
    // het blijft van de SVR en staat alleen op een andere rekening.
    const omschrijving = leesTekst(formulier, "omschrijving");
    if (!omschrijving) throw new Error("Vul een omschrijving in.");
    spaarmutatieId = (await tx.spaarmutatie.create({ data: {
      boekjaarId: jaarId, datum: regel.datum, omschrijving,
      bedragCenten: -regel.bedragCenten, soort: "overboeking", viaBetaalrekening: true,
      aangemaaktDoor: gebruiker,
      notities: `Uit de bankimport: ${regel.omschrijving}`.slice(0, 2000),
    } })).id;
    verwerking = "spaarmutatie";
  } else if (soort === "negeren" && notitie) verwerking = "genegeerd";
  else throw new Error("Kies een koppeling, of geef een reden om deze bankregel buiten de administratie te laten.");
  await tx.bankmutatie.update({ where: { id: regel.id, verwerking: "open" }, data: { verwerking, betalingId, uitgaveId, rekeningpostId, spaarmutatieId, notitie, verwerktOp: new Date(), verwerktDoor: gebruiker } });
  await logAudit({ gebruiker, boekjaarId: jaarId, entiteit: "Bankmutatie", entiteitId: regel.id, actie: "gekoppeld", samenvatting: `Bankregel ${formatteerEuro(regel.bedragCenten)} verwerkt: ${verwerking}.`, details: { betalingId, uitgaveId, rekeningpostId, spaarmutatieId, notitie } }, tx);
}

/**
 * Verwerkt de voorstellen van de aangevinkte bankregels. De voorstellen worden
 * hier opnieuw berekend, zodat er alleen geboekt wordt wat nu nog klopt.
 */
async function voorstellenVerwerken(tx: DbClient, jaar: Jaar, importId: string, gebruiker: string, gekozen: Set<string>) {
  const regels = await tx.bankmutatie.findMany({ where: { importId, boekjaarId: jaar.id, verwerking: "open" }, orderBy: [{ datum: "asc" }, { id: "asc" }] });
  const keuzes = await bankKeuzes(jaar.id, tx);
  const voorstellen = bankVoorstellen(regels, keuzes.facturen, keuzes.betalingen, keuzes.uitgaven);
  let verwerkt = 0;
  for (const [id, voorstel] of voorstellen) {
    if (!gekozen.has(id)) continue;
    await koppel(tx, jaar, id, voorstel.waarde, gebruiker);
    verwerkt++;
  }
  return verwerkt;
}

export async function bevestigBankimport(_staat: ActieStaat, formulier: FormData): Promise<ActieStaat> {
  const sessie = await vereisBestuur();
  return voerUit(async () => {
    const jaar = await vereisSchrijfbaarBoekjaar();
    const id = leesTekst(formulier, "importId");
    const verwerkt = await db.$transaction(async tx => {
      await vergrendelJaar(tx, jaar.id);
      const bankimport = id ? await tx.bankimport.findUnique({ where: { id, boekjaarId: jaar.id } }) : null;
      if (!bankimport) throw new Error("Deze bankimport bestaat niet in dit boekjaar.");
      if (bankimport.bevestigdOp) throw new Error("Deze import is al bevestigd. Het banksaldo wordt niet nogmaals opgeslagen.");
      const saldo = await tx.banksaldo.create({ data: { boekjaarId: jaar.id, rekening: "betaal", datum: bankimport.eindDatum, saldoCenten: bankimport.eindSaldoCenten, notitie: `MT940: ${bankimport.bestandsnaam}`, ingevoerdDoor: sessie.naam } });
      if (bankimport.spaarEindSaldoCenten !== null && bankimport.spaarEindDatum) {
        await tx.banksaldo.create({ data: { boekjaarId: jaar.id, rekening: "spaar", datum: bankimport.spaarEindDatum, saldoCenten: bankimport.spaarEindSaldoCenten, notitie: `MT940: ${bankimport.bestandsnaam}`, ingevoerdDoor: sessie.naam } });
      }
      await tx.bankimport.update({ where: { id: bankimport.id }, data: { bevestigdOp: new Date(), banksaldoId: saldo.id } });
      await logAudit({ gebruiker: sessie.naam, boekjaarId: jaar.id, entiteit: "Bankimport", entiteitId: bankimport.id, actie: "bevestigd", samenvatting: `Afschrift bevestigd; banksaldo ${formatteerEuro(bankimport.eindSaldoCenten)}${bankimport.spaarEindSaldoCenten !== null ? ` en spaarsaldo ${formatteerEuro(bankimport.spaarEindSaldoCenten)}` : ""} overgenomen.` }, tx);
      return bankimport.eindSaldoCenten;
    }, { timeout: 60_000 });
    vernieuw(); return { melding: `Banksaldo van ${formatteerEuro(verwerkt)} overgenomen.` };
  });
}

export async function koppelSelectie(_staat: ActieStaat, formulier: FormData): Promise<ActieStaat> {
  const sessie = await vereisBestuur();
  return voerUit(async () => {
    const jaar = await vereisSchrijfbaarBoekjaar();
    const id = leesTekst(formulier, "importId");
    if (!id) throw new Error("Kies een bankimport.");
    const gekozen = new Set(formulier.getAll("mutatieId").map(String));
    if (gekozen.size === 0) return { fout: "Vink minstens één voorstel aan." };
    const aantal = await db.$transaction(async tx => { await vergrendelJaar(tx, jaar.id); return voorstellenVerwerken(tx, jaar, id, sessie.naam, gekozen); }, { timeout: 120_000 });
    vernieuw();
    const overgeslagen = gekozen.size - aantal;
    return { melding: `${aantal} ${aantal === 1 ? "bankregel" : "bankregels"} gekoppeld.${overgeslagen > 0 ? ` ${overgeslagen} voorstel${overgeslagen === 1 ? " klopte" : "len klopten"} inmiddels niet meer en ${overgeslagen === 1 ? "is" : "zijn"} overgeslagen.` : ""}` };
  });
}

export async function verwerkBankmutatie(_staat: ActieStaat, formulier: FormData): Promise<ActieStaat> {
  const sessie = await vereisBestuur();
  return voerUit(async () => {
    const jaar = await vereisSchrijfbaarBoekjaar();
    await db.$transaction(async tx => { await vergrendelJaar(tx, jaar.id); await koppel(tx, jaar, leesTekst(formulier, "mutatieId") ?? "", leesTekst(formulier, "doel") ?? "", sessie.naam, formulier); }, { timeout: 30_000 });
    vernieuw(); return { melding: "Bankregel verwerkt." };
  });
}

/**
 * Boekt een hele stapel bankregels in één keer als nieuwe uitgave, nieuwe
 * inkomst of rekening-courantpost.
 *
 * Hiermee bouw je een oud boekjaar op uit het afschrift: van elke bijschrijving
 * een betaalde factuur, van elke afschrijving een betaalde uitgave. Elke regel
 * gaat in zijn eigen transactie, zodat één regel die niet klopt de rest niet
 * tegenhoudt.
 */
export async function boekBankregelsSnel(_staat: ActieStaat, formulier: FormData): Promise<ActieStaat> {
  const sessie = await vereisBestuur();
  return voerUit(async () => {
    const jaar = await vereisSchrijfbaarBoekjaar();
    const importId = leesTekst(formulier, "importId");
    if (!importId) throw new Error("Kies een bankimport.");
    const ids = formulier.getAll("mutatieId").map(String);
    if (ids.length === 0) return { fout: "Vink minstens één bankregel aan." };
    const standaardInkomst = leesTekst(formulier, "standaardInkomstenpost");
    const standaardUitgave = leesTekst(formulier, "standaardUitgavenpost");

    let geboekt = 0;
    const fouten: string[] = [];
    for (const id of ids) {
      const regel = await db.bankmutatie.findUnique({ where: { id, boekjaarId: jaar.id, importId } });
      if (!regel || regel.verwerking !== "open") continue;
      const gekozenSoort = leesTekst(formulier, `soort-${id}`);
      const doel =
        gekozenSoort === "rekeningpost" || gekozenSoort === "spaar"
          ? gekozenSoort
          : regel.bedragCenten > 0
            ? "inkomst"
            : "nieuw";
      const rij = new FormData();
      const relatieId = leesTekst(formulier, `relatie-${id}`);
      if (relatieId) rij.set("relatieId", relatieId);
      const post = leesTekst(formulier, `post-${id}`) ?? (regel.bedragCenten > 0 ? standaardInkomst : standaardUitgave);
      if (post) rij.set("begrotingspostId", post);
      rij.set("omschrijving", leesTekst(formulier, `omschrijving-${id}`) ?? (regel.omschrijving.trim() || "Bankregel zonder omschrijving"));
      rij.set("leverancierNaam", leesTekst(formulier, `leverancier-${id}`) ?? (regel.tegenpartijNaam.trim() || "Onbekend"));
      try {
        await db.$transaction(async tx => {
          await vergrendelJaar(tx, jaar.id);
          await koppel(tx, jaar, id, doel, sessie.naam, rij);
        }, { timeout: 30_000 });
        geboekt++;
      } catch (fout) {
        const bericht = fout instanceof Error ? fout.message : "onbekende fout";
        fouten.push(`${formatteerEuro(regel.bedragCenten)} op ${regel.datum.toISOString().slice(0, 10)}: ${bericht}`);
      }
    }
    vernieuw();
    if (geboekt === 0) return { fout: fouten[0] ?? "Er is niets geboekt." };
    return {
      melding: `${geboekt} ${geboekt === 1 ? "bankregel" : "bankregels"} geboekt.` +
        (fouten.length ? ` ${fouten.length} overgeslagen — ${fouten.slice(0, 3).join("; ")}` : ""),
    };
  });
}

export async function ontkoppelBankmutatie(_staat: ActieStaat, formulier: FormData): Promise<ActieStaat> {
  const sessie = await vereisBestuur();
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
      if (regel.uitgaveId) await vergrendelRij(tx, "Uitgave", regel.uitgaveId);
      await tx.bankmutatie.update({ where: { id: regel.id }, data: { verwerking: "open", betalingId: null, uitgaveId: null, rekeningpostId: null, spaarmutatieId: null, notitie: null, verwerktOp: null, verwerktDoor: null } });
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
      if (regel.verwerking === "rekeningpost" && regel.rekeningpostId) await tx.rekeningpost.delete({ where: { id: regel.rekeningpostId } });
      if (regel.verwerking === "spaarmutatie" && regel.spaarmutatieId) await tx.spaarmutatie.delete({ where: { id: regel.spaarmutatieId } });
      await logAudit({ gebruiker: sessie.naam, boekjaarId: jaar.id, entiteit: "Bankmutatie", entiteitId: regel.id, actie: "ontkoppeld", samenvatting: `Bankregel ${formatteerEuro(regel.bedragCenten)} ontkoppeld; door de import aangemaakte boeking teruggedraaid.` }, tx);
    }, { timeout: 30_000 });
    vernieuw(); return { melding: "Koppeling ongedaan gemaakt." };
  });
}
