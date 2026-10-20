import { zoekGedeeldBestand } from "@/lib/portaal/delen";
import { leesBestand } from "@/lib/portaal/opslag";

/** Nooit in een zoekmachine, nooit in een gedeelde cache. */
const AFSCHERMING = {
  "X-Robots-Tag": "noindex, nofollow, noarchive, nosnippet",
  "Cache-Control": "private, no-store",
  "Referrer-Policy": "no-referrer",
};

/**
 * Een gedeelde agenda of notulen openen zonder in te loggen. De sleutel in het
 * adres is het enige wat toegang geeft; een onbekende of ingetrokken sleutel
 * geeft hetzelfde antwoord als een die nooit heeft bestaan.
 */
export async function GET(_verzoek: Request, context: RouteContext<"/delen/[sleutel]">) {
  const { sleutel } = await context.params;
  const bestand = await zoekGedeeldBestand(sleutel);
  if (!bestand) {
    return new Response(
      "Deze link werkt niet (meer). Vraag degene die hem stuurde om een nieuwe.",
      { status: 404, headers: { ...AFSCHERMING, "Content-Type": "text/plain; charset=utf-8" } },
    );
  }

  let inhoud: Buffer;
  try {
    inhoud = await leesBestand(bestand.opslagnaam);
  } catch {
    return new Response("Het bestand staat niet meer op de server.", {
      status: 404,
      headers: { ...AFSCHERMING, "Content-Type": "text/plain; charset=utf-8" },
    });
  }

  // Een PDF meteen in de browser tonen is handig voor wie de link opent; al
  // het andere als download, met een sandbox. (Een sandbox op een PDF laat
  // Chrome hem niet tonen; de PDF-lezer van de browser voert zelf geen
  // scripts van de pagina uit.)
  const inline = bestand.mimeType === "application/pdf";
  return new Response(new Uint8Array(inhoud), {
    headers: {
      ...AFSCHERMING,
      "Content-Type": bestand.mimeType,
      "Content-Disposition": `${inline ? "inline" : "attachment"}; filename*=UTF-8''${encodeURIComponent(bestand.bestandsnaam)}`,
      "Content-Length": String(inhoud.byteLength),
      "X-Content-Type-Options": "nosniff",
      ...(inline ? {} : { "Content-Security-Policy": "default-src 'none'; sandbox" }),
    },
  });
}
