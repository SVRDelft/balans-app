import { renderToBuffer } from "@react-pdf/renderer";

import { haalSessie } from "@/lib/auth/server";
import { haalBoekjaarContext } from "@/lib/boekjaar";
import { db } from "@/lib/db";
import { haalBoekjaarCijfers } from "@/lib/rapportage";
import { OverdrachtDocument } from "@/lib/pdf/overdracht-document";
import { logoVoorPdf } from "@/lib/logo";

export const runtime = "nodejs";

export async function GET() {
  const sessie = await haalSessie();
  if (!sessie) return new Response("Niet ingelogd", { status: 401 });

  const context = await haalBoekjaarContext();
  if (!context) return new Response("Geen boekjaar gevonden", { status: 404 });

  const { boekjaar } = context;
  const [cijfers, instellingen] = await Promise.all([
    haalBoekjaarCijfers(boekjaar.id),
    db.instellingen.findUnique({ where: { id: "svr" } }),
  ]);

  const buffer = await renderToBuffer(
    OverdrachtDocument({
      gegevens: {
        logoSrc: await logoVoorPdf(instellingen),
        contactregels: instellingen
          ? [
              [
                instellingen.adres,
                `${instellingen.postcode} ${instellingen.plaats}`.trim(),
                instellingen.land,
              ]
                .filter(Boolean)
                .join(" · "),
              [
                instellingen.contactpersoon,
                instellingen.email,
                instellingen.telefoon,
                instellingen.website,
              ]
                .filter(Boolean)
                .join(" · "),
              [
                instellingen.kvkNummer ? `KvK ${instellingen.kvkNummer}` : "",
                instellingen.btwNummer
                  ? `Btw-id ${instellingen.btwNummer}`
                  : "",
                instellingen.iban ? `IBAN ${instellingen.iban}` : "",
              ]
                .filter(Boolean)
                .join(" · "),
            ].filter(Boolean)
          : [],
        voorraadposten: cijfers.voorraadposten,
        organisatieNaam:
          instellingen?.organisatieNaam ?? "StudieVerenigingenRaad Delft",
        boekjaarNaam: boekjaar.naam,
        startDatum: boekjaar.startDatum,
        eindDatum: boekjaar.eindDatum,
        gemaaktOp: new Date(),
        gemaaktDoor: sessie.naam,

        exploitatie: cijfers.exploitatie,
        balans: cijfers.balans,
        ouderdom: cijfers.ouderdom,
        ingevoerdBanksaldoCenten: cijfers.laatsteBanksaldo?.saldoCenten ?? null,
        banksaldoDatum: cijfers.laatsteBanksaldo?.datum ?? null,

        debiteuren: cijfers.openstaandeFacturen.map((factuur) => ({
          nummer: factuur.nummer,
          relatieNaam: factuur.relatieNaam,
          factuurdatum: factuur.factuurdatum,
          openstaandCenten: factuur.openstaandCenten,
        })),

        crediteuren: cijfers.openstaandeUitgaven.map((uitgave) => ({
          datum: uitgave.datum,
          leverancierNaam: uitgave.leverancierNaam,
          omschrijving: uitgave.omschrijving,
          bedragCenten: uitgave.bedragCenten,
        })),

        evenementen: cijfers.evenementen.map((evenement) => ({
          naam: evenement.naam,
          kostenCenten: evenement.afstemming.totaleKostenCenten,
          gefactureerdCenten: evenement.afstemming.gefactureerdCenten,
          ontvangenCenten: evenement.afstemming.ontvangenCenten,
          verschilCenten: evenement.afstemming.resultaatCenten,
        })),
      },
    }),
  );

  const bestandsnaam = `SVR-overdracht-${boekjaar.factuurPrefix}.pdf`;

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${bestandsnaam}"`,
      "Cache-Control": "no-store",
    },
  });
}
