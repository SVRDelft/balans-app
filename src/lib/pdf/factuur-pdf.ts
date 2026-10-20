import "server-only";

import { renderToBuffer } from "@react-pdf/renderer";

import { db } from "@/lib/db";
import { betaaldBedrag } from "@/lib/facturen";
import { factuurStandRelaties } from "@/lib/factuur-includes";
import {
  factuurOpenstaand,
  factuurRealisatie,
} from "@/lib/finance/factuurstanden";
import { logoVoorPdf } from "@/lib/logo";
import { FactuurDocument } from "@/lib/pdf/factuur-document";

/**
 * Eén factuur als PDF. Staat hier en niet in de route, zodat de losse download
 * en de bundel van alle facturen gegarandeerd hetzelfde document opleveren.
 */
export async function maakFactuurPdf(
  id: string,
): Promise<{ nummer: string; relatieId: string; status: string; bytes: Uint8Array } | null> {
  const [factuur, instellingen] = await Promise.all([
    db.factuur.findUnique({
      where: { id },
      include: {
        ...factuurStandRelaties,
        relatie: true,
        regels: { orderBy: { volgorde: "asc" } },
        betalingen: { select: { bedragCenten: true } },
      },
    }),
    db.instellingen.findUnique({ where: { id: "svr" } }),
  ]);

  if (!factuur) return null;

  const buffer = await renderToBuffer(
    FactuurDocument({
      factuur: {
        logoSrc: await logoVoorPdf(instellingen),
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
        openstaandCenten: factuurOpenstaand(factuur),
        afgeboektCenten:
          factuur.status === "oninbaar"
            ? Math.max(0, factuur.totaalCenten - factuurRealisatie(factuur))
            : 0,
        creditfactuur:
          factuur.creditfactuur &&
          !["concept", "oninbaar"].includes(factuur.creditfactuur.status)
            ? {
                nummer: factuur.creditfactuur.nummer,
                bedragCenten: factuur.creditfactuur.totaalCenten,
              }
            : null,
        crediteertFactuurNummer: factuur.crediteertFactuur?.nummer ?? null,
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
          land: factuur.relatie.land,
          email: factuur.relatie.email,
          kvkNummer: factuur.relatie.kvkNummer,
          btwNummer: factuur.relatie.btwNummer,
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
          contactpersoon: instellingen?.contactpersoon ?? "",
          land: instellingen?.land ?? "",
          telefoon: instellingen?.telefoon ?? "",
          website: instellingen?.website ?? "",
          btwNummer: instellingen?.btwNummer ?? "",
        },
      },
    }),
  );

  return {
    nummer: factuur.nummer,
    relatieId: factuur.relatieId,
    status: factuur.status,
    bytes: new Uint8Array(buffer),
  };
}
