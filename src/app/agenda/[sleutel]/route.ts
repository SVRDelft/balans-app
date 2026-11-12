import { db } from "@/lib/db";
import { agendaAntwoord } from "@/lib/portaal/agenda-antwoord";
import { lijktOpDeelsleutel } from "@/lib/portaal/delen";

/**
 * De agenda-feed voor agenda-apps, die niet kunnen inloggen. Alleen met de
 * geheime sleutel uit Beheer › Instellingen; een nieuwe sleutel trekt de oude in.
 * Erin staan alleen datums, tijden en wie ontvangt: geen stukken, geen bedragen.
 */
export async function GET(verzoek: Request, context: RouteContext<"/agenda/[sleutel]">) {
  const { sleutel } = await context.params;
  const geldig =
    lijktOpDeelsleutel(sleutel) &&
    (await db.instellingen.findFirst({ where: { agendaSleutel: sleutel }, select: { id: true } }));
  if (!geldig) {
    return new Response("Deze agendalink werkt niet (meer). Vraag het SVR-bestuur om de nieuwe.", {
      status: 404,
      headers: { "Content-Type": "text/plain; charset=utf-8", "X-Robots-Tag": "noindex" },
    });
  }
  return agendaAntwoord(verzoek);
}
