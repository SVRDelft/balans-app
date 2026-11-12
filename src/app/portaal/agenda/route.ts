import { haalSessie } from "@/lib/auth/server";
import { agendaAntwoord } from "@/lib/portaal/agenda-antwoord";

/** Dezelfde feed, voor wie in het portaal is ingelogd (bijvoorbeeld om te downloaden). */
export async function GET(verzoek: Request) {
  if (!(await haalSessie())) {
    return new Response("Niet ingelogd", { status: 401, headers: { "Cache-Control": "no-store" } });
  }
  return agendaAntwoord(verzoek);
}
