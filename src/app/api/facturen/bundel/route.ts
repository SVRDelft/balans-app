import { vereisBestuur } from "@/lib/auth/server";
import { db } from "@/lib/db";
import { maakZip, type ZipBestand } from "@/lib/export/zip";
import { maakFactuurPdf } from "@/lib/pdf/factuur-pdf";

// @react-pdf/renderer draait op Node, niet op de edge runtime.
export const runtime = "nodejs";

/** Meer dan dit duurt te lang voor één verzoek; filter dan eerst de lijst. */
const MAX = 60;

/**
 * Alle facturen uit de lijst als één zip met PDF's.
 *
 * Vijftien LBG-facturen één voor één openen en opslaan is het soort werk waar je
 * fouten in maakt. Dit levert ze in één keer op, met de naam van de vereniging in
 * de bestandsnaam zodat je ze zo kunt bijvoegen.
 */
export async function POST(verzoek: Request) {
  await vereisBestuur();

  const formulier = await verzoek.formData();
  const gevraagd = [...new Set(formulier.getAll("id").map(String))].slice(0, MAX);
  if (gevraagd.length === 0) {
    return new Response("Geen facturen gekozen", { status: 400 });
  }

  const facturen = await db.factuur.findMany({
    where: { id: { in: gevraagd } },
    select: {
      id: true,
      nummer: true,
      relatie: { select: { naam: true } },
      boekjaar: { select: { factuurPrefix: true } },
    },
    orderBy: { nummer: "asc" },
  });
  if (facturen.length === 0) {
    return new Response("Facturen niet gevonden", { status: 404 });
  }

  const bestanden: ZipBestand[] = [];
  for (const factuur of facturen) {
    const pdf = await maakFactuurPdf(factuur.id);
    if (!pdf) continue;
    const naam = `${factuur.nummer} ${factuur.relatie.naam}`.replace(
      /[^\w.\- ]+/g,
      "_",
    );
    bestanden.push({ naam: `${naam}.pdf`, inhoud: pdf.bytes });
  }

  const prefix = facturen[0].boekjaar.factuurPrefix || "facturen";
  const zip = maakZip(bestanden);
  return new Response(new Uint8Array(zip), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${prefix}-facturen.zip"`,
      "Content-Length": String(zip.byteLength),
      "Cache-Control": "no-store",
    },
  });
}
