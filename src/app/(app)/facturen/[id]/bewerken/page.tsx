import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { Paginakop } from "@/components/paginakop";
import { Melding } from "@/components/ui/melding";
import { vereisSchrijfbaarBoekjaar } from "@/lib/boekjaar";
import { db } from "@/lib/db";
import { datumNaarInvoer } from "@/lib/datum";
import { isVergrendeld } from "@/lib/domein";
import { centenNaarInvoer } from "@/lib/geld";

import { FactuurFormulier } from "../../formulier";

export const metadata: Metadata = { title: "Factuur bewerken" };

export default async function BewerkFactuurPagina({
  params,
}: PageProps<"/facturen/[id]/bewerken">) {
  const boekjaar = await vereisSchrijfbaarBoekjaar("/facturen");
  const { id } = await params;

  const factuur = await db.factuur.findUnique({
    where: { id, boekjaarId: boekjaar.id },
    include: { regels: { orderBy: { volgorde: "asc" } } },
  });
  if (!factuur) notFound();

  if (isVergrendeld(factuur.status)) {
    return (
      <>
        <Paginakop titel={`Factuur ${factuur.nummer}`} />
        <Melding toon="waarschuwing" titel="Deze factuur is vergrendeld">
          Een factuur die verstuurd is, wordt niet meer inhoudelijk gewijzigd.
          Corrigeren gaat via een creditfactuur; dat is precies wat een
          kascommissie wil zien.
        </Melding>
      </>
    );
  }

  const [relaties, posten, evenementen] = await Promise.all([
    db.relatie.findMany({
      where: { actief: true },
      orderBy: [{ type: "asc" }, { naam: "asc" }],
      select: { id: true, naam: true },
    }),
    db.begrotingspost.findMany({
      where: { boekjaarId: boekjaar.id },
      orderBy: [{ soort: "asc" }, { volgorde: "asc" }],
      select: { id: true, code: true, naam: true, soort: true },
    }),
    db.evenement.findMany({
      where: { boekjaarId: boekjaar.id },
      orderBy: { datum: "asc" },
      select: { id: true, naam: true },
    }),
  ]);

  return (
    <>
      <Paginakop titel={`Concept ${factuur.nummer} bewerken`} />
      <FactuurFormulier
        relaties={relaties}
        posten={posten}
        evenementen={evenementen}
        waarden={{
          id: factuur.id,
          nummer: factuur.nummer,
          relatieId: factuur.relatieId,
          omschrijving: factuur.omschrijving,
          factuurdatum: datumNaarInvoer(factuur.factuurdatum),
          vervaldatum: datumNaarInvoer(factuur.vervaldatum),
          evenementId: factuur.evenementId ?? "",
          notities: factuur.notities ?? "",
          regels: factuur.regels.map((regel) => ({
            omschrijving: regel.omschrijving,
            aantal: String(regel.aantal),
            prijs: centenNaarInvoer(regel.prijsPerStukCenten),
            begrotingspostId: regel.begrotingspostId,
          })),
        }}
      />
    </>
  );
}
