import { haalSessie } from "@/lib/auth/server";
import { db } from "@/lib/db";
import { maakFactuurPdf } from "@/lib/pdf/factuur-pdf";

// @react-pdf/renderer draait op Node, niet op de edge runtime.
export const runtime = "nodejs";

export async function GET(
  _verzoek: Request,
  { params }: RouteContext<"/api/facturen/[id]/pdf">,
) {
  // Ook hier opnieuw controleren: een route is los van de interface te benaderen.
  const sessie = await haalSessie();
  if (!sessie) return new Response("Niet ingelogd", { status: 401 });

  const { id } = await params;

  // Eerst kijken of deze factuur voor deze gebruiker is, en pas daarna het
  // document maken: anders renderen we een factuur die niemand mag zien.
  const factuur = await db.factuur.findUnique({
    where: { id },
    select: { relatieId: true, status: true },
  });
  if (!factuur) return new Response("Factuur niet gevonden", { status: 404 });

  // Het bestuur mag elke factuur. Een vereniging alleen haar eigen facturen, en
  // nooit een concept: dat is nog niet verstuurd en hoort nog nergens rond te gaan.
  const magErbij =
    sessie.rol === "BESTUUR" ||
    (sessie.relatieId === factuur.relatieId && factuur.status !== "concept");
  if (!magErbij) return new Response("Geen toegang", { status: 403 });

  const pdf = await maakFactuurPdf(id);
  if (!pdf) return new Response("Factuur niet gevonden", { status: 404 });

  return new Response(new Uint8Array(pdf.bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${pdf.nummer}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
