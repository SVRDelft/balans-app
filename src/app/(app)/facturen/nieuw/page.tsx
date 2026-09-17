import type { Metadata } from "next";

import { Paginakop } from "@/components/paginakop";
import { Melding } from "@/components/ui/melding";
import { vereisSchrijfbaarBoekjaar } from "@/lib/boekjaar";
import { db } from "@/lib/db";
import { datumNaarInvoer, telDagenOp, vandaag } from "@/lib/datum";
import { centenNaarInvoer } from "@/lib/geld";

import { FactuurFormulier } from "../formulier";

export const metadata: Metadata = { title: "Nieuwe factuur" };

export default async function NieuweFactuurPagina({
  searchParams,
}: PageProps<"/facturen/nieuw">) {
  const boekjaar = await vereisSchrijfbaarBoekjaar("/facturen");
  const parameters = await searchParams;
  const vanId = typeof parameters.van === "string" ? parameters.van : "";

  const [relaties, posten, evenementen, instellingen] = await Promise.all([
    db.relatie.findMany({
      where: { actief: true },
      orderBy: [{ type: "asc" }, { naam: "asc" }],
      select: { id: true, naam: true, type: true },
    }),
    db.begrotingspost.findMany({
      where: { boekjaarId: boekjaar.id },
      orderBy: [{ soort: "asc" }, { volgorde: "asc" }],
      select: { id: true, code: true, naam: true, soort: true },
    }),
    db.evenement.findMany({
      where: { boekjaarId: boekjaar.id, status: { not: "afgesloten" } },
      orderBy: { datum: "asc" },
      select: { id: true, naam: true },
    }),
    db.instellingen.findUnique({ where: { id: "svr" } }),
  ]);

  // "Kopiëren": dezelfde omschrijving en regels, nieuwe datums en nog geen
  // relatie gekozen, zodat je hem makkelijk voor iemand anders maakt.
  const bron = vanId
    ? await db.factuur.findUnique({
        where: { id: vanId, boekjaarId: boekjaar.id },
        include: { regels: { orderBy: { volgorde: "asc" } } },
      })
    : null;

  const vandaagDatum = vandaag();
  const termijn = instellingen?.betaaltermijnDagen ?? 30;

  if (posten.length === 0) {
    return (
      <>
        <Paginakop titel="Nieuwe factuur" />
        <Melding toon="waarschuwing" titel="Er zijn nog geen begrotingsposten">
          Elke factuurregel moet naar een begrotingspost wijzen. Maak die eerst
          aan bij Gegevens › Begroting.
        </Melding>
      </>
    );
  }

  // Inkomstenposten eerst: daar hoort een factuurregel vrijwel altijd thuis.
  const gesorteerdePosten = [
    ...posten.filter((post) => post.soort === "inkomst"),
    ...posten.filter((post) => post.soort !== "inkomst"),
  ];

  return (
    <>
      <Paginakop
        titel="Nieuwe factuur"
        beschrijving={bron
          ? `Kopie van ${bron.nummer}. Kies voor wie de nieuwe factuur is.`
          : "Kies één of meer relaties. De factuur wordt als concept opgeslagen, tenzij je hem meteen op verstuurd zet."}
      />
      <FactuurFormulier
        relaties={relaties}
        posten={gesorteerdePosten}
        evenementen={evenementen}
        waarden={{
          relatieId: "",
          omschrijving: bron?.omschrijving ?? "",
          factuurdatum: datumNaarInvoer(vandaagDatum),
          vervaldatum: datumNaarInvoer(telDagenOp(vandaagDatum, termijn)),
          evenementId:
            bron?.evenementId && evenementen.some((evenement) => evenement.id === bron.evenementId)
              ? bron.evenementId
              : "",
          notities: "",
          regels: bron && bron.soort !== "credit"
            ? bron.regels.map((regel) => ({
                omschrijving: regel.omschrijving,
                aantal: String(regel.aantal),
                prijs: centenNaarInvoer(regel.prijsPerStukCenten),
                begrotingspostId: regel.begrotingspostId,
              }))
            : [],
        }}
      />
    </>
  );
}
