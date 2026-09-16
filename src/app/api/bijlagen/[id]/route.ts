import { haalSessie } from "@/lib/auth/server";
import { db } from "@/lib/db";

export const runtime = "nodejs";

/** Bonnetjes staan in de database; deze route levert ze uit aan de browser. */
export async function GET(
  _verzoek: Request,
  { params }: RouteContext<"/api/bijlagen/[id]">,
) {
  const sessie = await haalSessie();
  if (!sessie) return new Response("Niet ingelogd", { status: 401 });

  const { id } = await params;
  const bijlage = await db.bijlage.findUnique({ where: { id } });
  if (!bijlage) return new Response("Bijlage niet gevonden", { status: 404 });

  // Bestandsnamen komen van gebruikers; alleen veilige tekens in de header.
  const veiligeNaam = bijlage.bestandsnaam.replace(/[^\w.\-() ]+/g, "_");

  return new Response(new Uint8Array(bijlage.data), {
    headers: {
      "Content-Type": bijlage.mimeType,
      "Content-Disposition": `inline; filename="${veiligeNaam}"`,
      "Content-Length": String(bijlage.grootte),
      "Cache-Control": "private, max-age=3600",
      // Het mimetype komt van de browser bij het uploaden. Het wordt bij het
      // opslaan getoetst aan een vaste lijst, maar zonder nosniff kan een
      // browser een verkeerd gelabeld bestand alsnog anders interpreteren.
      "X-Content-Type-Options": "nosniff",
      // Een bonnetje hoort niets uit te voeren en niets in te laden.
      "Content-Security-Policy": "default-src 'none'; img-src 'self'; object-src 'none'; sandbox",
    },
  });
}
