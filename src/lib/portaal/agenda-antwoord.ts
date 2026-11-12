import "server-only";

import { maakAgenda } from "@/lib/portaal/agenda";
import { haalAgendaVergaderingen } from "@/lib/portaal/gegevens";
import { isReeks } from "@/lib/portaal/vergaderingen";

/** Het antwoord van beide agenda-routes: een .ics-bestand, nooit in Google. */
export async function agendaAntwoord(verzoek: Request): Promise<Response> {
  const gevraagd = new URL(verzoek.url).searchParams.get("overleg") ?? "";
  const overleg = isReeks(gevraagd) ? gevraagd : undefined;
  const vergaderingen = await haalAgendaVergaderingen(overleg);
  const naam = overleg ? `SVR Delft · ${overleg}` : "SVR Delft · vergaderingen";

  return new Response(maakAgenda(vergaderingen, { naam }), {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `inline; filename="svr-${(overleg ?? "vergaderingen").toLowerCase()}.ics"`,
      "Cache-Control": "private, max-age=900",
      "X-Robots-Tag": "noindex, nofollow",
    },
  });
}
