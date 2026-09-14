import { renderToBuffer } from "@react-pdf/renderer";

import { haalSessie } from "@/lib/auth/server";
import { db } from "@/lib/db";
import { betaaldBedrag } from "@/lib/facturen";
import { FactuurDocument } from "@/lib/pdf/factuur-document";

// @react-pdf/renderer draait op Node, niet op de edge runtime.
export const runtime = "nodejs";

export async function GET(
  _verzoek: Request,
  { params }: RouteContext<"/api/facturen/[id]/pdf">,
) {
  // Ook hier opnieuw controleren: een route is los van de interface te benaderen.
  const sessie = await haalSessie();
  if (!sessie) {
    return new Response("Niet ingelogd", { status: 401 });
  }

  const { id } = await params;

  const [factuur, instellingen] = await Promise.all([
    db.factuur.findUnique({
      where: { id },
      include: {
        relatie: true,
        regels: { orderBy: { volgorde: "asc" } },
        betalingen: { select: { bedragCenten: true } },
      },
    }),
    db.instellingen.findUnique({ where: { id: "svr" } }),
  ]);

  if (!factuur) {
    return new Response("Factuur niet gevonden", { status: 404 });
  }

  const buffer = await renderToBuffer(
    FactuurDocument({
      factuur: {
        nummer: factuur.nummer,
        omschrijving: factuur.omschrijving,
        factuurdatum: factuur.factuurdatum,
        vervaldatum: factuur.vervaldatum,
        status: factuur.status,
        isConcept: factuur.status === "concept",
        isCredit: factuur.soort === "credit",
        notities: factuur.notities,
        totaalCenten: factuur.totaalCenten,
        betaaldCenten: betaaldBedrag(factuur.betalingen),
        regels: factuur.regels.map((regel) => ({
          omschrijving: regel.omschrijving,
          aantal: regel.aantal,
          prijsPerStukCenten: regel.prijsPerStukCenten,
          bedragCenten: regel.bedragCenten,
        })),
        relatie: {
          naam: factuur.relatie.naam,
          contactpersoon: factuur.relatie.contactpersoon,
          adres: factuur.relatie.adres,
          postcode: factuur.relatie.postcode,
          plaats: factuur.relatie.plaats,
        },
        afzender: {
          organisatieNaam:
            instellingen?.organisatieNaam ?? "StudieVerenigingenRaad Delft",
          adres: instellingen?.adres ?? "",
          postcode: instellingen?.postcode ?? "",
          plaats: instellingen?.plaats ?? "",
          email: instellingen?.email ?? "",
          iban: instellingen?.iban ?? "",
          kvkNummer: instellingen?.kvkNummer ?? "",
          btwPlichtig: instellingen?.btwPlichtig ?? false,
          btwPercentage: instellingen?.btwPercentage ?? 0,
          voetnoot: instellingen?.factuurVoetnoot ?? "",
        },
      },
    }),
  );

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${factuur.nummer}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
