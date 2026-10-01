import { haalSessie } from "@/lib/auth/server";
import { db } from "@/lib/db";
import { leesBestand } from "@/lib/portaal/opslag";

/**
 * Bestanden staan buiten de map die de webserver uitserveert. Downloaden gaat
 * daarom altijd langs hier, en hier wordt eerst gecontroleerd of je ingelogd
 * bent. Zowel het bestuur als een vereniging mag erbij: in het portaal staan
 * stukken die voor alle aangesloten verenigingen bedoeld zijn.
 */
export async function GET(
  _verzoek: Request,
  context: RouteContext<"/api/portaal/bestand/[id]">,
) {
  const sessie = await haalSessie();
  if (!sessie) {
    return new Response("Niet ingelogd", {
      status: 401,
      headers: { "Cache-Control": "no-store" },
    });
  }

  const { id } = await context.params;
  const bestand = await db.portaalbestand.findUnique({ where: { id } });
  if (!bestand) return new Response("Niet gevonden", { status: 404 });

  let inhoud: Buffer;
  try {
    inhoud = await leesBestand(bestand.opslagnaam);
  } catch {
    return new Response("Het bestand staat niet meer op de server", { status: 404 });
  }

  return new Response(new Uint8Array(inhoud), {
    headers: {
      "Content-Type": bestand.mimeType,
      // Als bijlage, nooit uitgevoerd in de browser.
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(bestand.bestandsnaam)}`,
      "Content-Length": String(inhoud.byteLength),
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; sandbox",
      "Cache-Control": "private, no-store",
    },
  });
}
