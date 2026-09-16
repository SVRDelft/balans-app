import type { Metadata } from "next";

import { Paginakop } from "@/components/paginakop";
import { Melding } from "@/components/ui/melding";
import { vereisSchrijfbaarBoekjaar } from "@/lib/boekjaar";
import { db } from "@/lib/db";
import { datumNaarInvoer, telDagenOp, vandaag } from "@/lib/datum";

import { FactuurFormulier } from "../formulier";

export const metadata: Metadata = { title: "Nieuwe factuur" };

export default async function NieuweFactuurPagina() {
  const boekjaar = await vereisSchrijfbaarBoekjaar("/facturen");

  const [relaties, posten, evenementen, instellingen] = await Promise.all([
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
      where: { boekjaarId: boekjaar.id, status: { not: "afgesloten" } },
      orderBy: { datum: "asc" },
      select: { id: true, naam: true },
    }),
    db.instellingen.findUnique({ where: { id: "svr" } }),
  ]);

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
        beschrijving="De factuur wordt als concept opgeslagen. Pas als je hem op verstuurd zet, telt hij mee en wordt hij vergrendeld."
      />
      <FactuurFormulier
        relaties={relaties}
        posten={gesorteerdePosten}
        evenementen={evenementen}
        waarden={{
          relatieId: "",
          omschrijving: "",
          factuurdatum: datumNaarInvoer(vandaagDatum),
          vervaldatum: datumNaarInvoer(telDagenOp(vandaagDatum, termijn)),
          evenementId: "",
          notities: "",
          regels: [],
        }}
      />
    </>
  );
}
