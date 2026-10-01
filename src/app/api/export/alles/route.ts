import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

import { haalSessie } from "@/lib/auth/server";
import { db } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { maakZip, type ZipBestand } from "@/lib/export/zip";

// Een volledige back-up om buiten de TU-server te bewaren: de hele database als
// JSON plus alle geüploade bestanden. Alleen voor het bestuur.
//
// Dit vervangt de back-up in Plesk niet; het is de kopie die je zelf in handen
// hebt, bijvoorbeeld bij een overdracht.

export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function GET() {
  const sessie = await haalSessie();
  if (sessie?.rol !== "BESTUUR") {
    return new Response("Niet ingelogd", {
      status: 401,
      headers: { "Cache-Control": "no-store" },
    });
  }

  const [
    instellingen, boekjaren, relaties, begrotingsposten, facturen, factuurregels,
    betalingen, uitgaven, evenementen, deelnemers, omslagrondes, omslagrondeDeelnemers,
    banksaldi, bankimports, bankmutaties, voorraadposten, auditlog, gebruikers,
    mededelingen, vergaderingen, portaalbestanden, bijlagen,
  ] = await Promise.all([
    db.instellingen.findMany(),
    db.boekjaar.findMany(),
    db.relatie.findMany(),
    db.begrotingspost.findMany(),
    db.factuur.findMany(),
    db.factuurregel.findMany(),
    db.betaling.findMany(),
    db.uitgave.findMany(),
    db.evenement.findMany(),
    db.deelnemer.findMany(),
    db.omslagronde.findMany(),
    db.omslagrondeDeelnemer.findMany(),
    db.banksaldo.findMany(),
    db.bankimport.findMany(),
    db.bankmutatie.findMany(),
    db.voorraadpost.findMany(),
    db.auditlog.findMany(),
    // Zonder de wachtwoorden: die horen in geen enkele kopie thuis.
    db.gebruiker.findMany({
      select: {
        id: true, email: true, naam: true, rol: true, relatieId: true,
        actief: true, laatsteInlog: true, aangemaaktOp: true,
      },
    }),
    db.mededeling.findMany(),
    db.vergadering.findMany(),
    db.portaalbestand.findMany(),
    db.bijlage.findMany(),
  ]);

  const nu = new Date();
  const bestanden: ZipBestand[] = [];

  // Bonnetjes staan als bytes in de database; die gaan als los bestand mee.
  const bijlagenZonderData = bijlagen.map(({ data, ...rest }) => {
    const naam = `bonnetjes/${rest.id}-${rest.bestandsnaam.replace(/[^\w.\- ]+/g, "_")}`;
    bestanden.push({ naam, inhoud: new Uint8Array(data), datum: rest.geuploadOp });
    return { ...rest, bestand: naam };
  });

  // De bestanden van het portaal staan op schijf.
  const portaalmap = path.join(process.cwd(), "storage/portaal");
  const opSchijf = await readdir(portaalmap).catch(() => [] as string[]);
  const perOpslagnaam = new Map(portaalbestanden.map((b) => [b.opslagnaam, b]));
  for (const naam of opSchijf) {
    const rij = perOpslagnaam.get(naam);
    const inhoud = await readFile(path.join(portaalmap, naam)).catch(() => null);
    if (!inhoud) continue;
    bestanden.push({
      naam: `portaal/${rij ? `${rij.id}-${rij.bestandsnaam.replace(/[^\w.\- ]+/g, "_")}` : naam}`,
      inhoud: new Uint8Array(inhoud),
      datum: rij?.geuploadOp ?? nu,
    });
  }

  const database = {
    gemaaktOp: nu.toISOString(),
    gemaaktDoor: sessie.naam,
    uitleg:
      "Volledige kopie van de SVR-administratie. De map bonnetjes/ en portaal/ horen bij de verwijzingen in deze JSON.",
    instellingen, boekjaren, relaties, begrotingsposten, facturen, factuurregels,
    betalingen, uitgaven, bijlagen: bijlagenZonderData, evenementen, deelnemers,
    omslagrondes, omslagrondeDeelnemers, banksaldi, bankimports, bankmutaties,
    voorraadposten, gebruikers, mededelingen, vergaderingen, portaalbestanden,
    auditlog,
  };

  bestanden.unshift({
    naam: "database.json",
    inhoud: new TextEncoder().encode(JSON.stringify(database, null, 2)),
    datum: nu,
  });

  const zip = maakZip(bestanden);

  await logAudit({
    gebruiker: sessie.naam,
    entiteit: "Export",
    actie: "volledige export",
    samenvatting: `Volledige back-up gedownload (${bestanden.length} bestanden, ${Math.round(zip.byteLength / 1024)} kB)`,
  });

  const datumnaam = nu.toISOString().slice(0, 10);
  return new Response(new Uint8Array(zip), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="svr-backup-${datumnaam}.zip"`,
      "Content-Length": String(zip.byteLength),
      "Cache-Control": "private, no-store",
    },
  });
}
