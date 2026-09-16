import type { Metadata } from "next";

import { Paginakop } from "@/components/paginakop";
import { Melding } from "@/components/ui/melding";
import { vereisSchrijfbaarBoekjaar } from "@/lib/boekjaar";
import { db } from "@/lib/db";
import { datumNaarInvoer, vandaag } from "@/lib/datum";

import { UitgaveFormulier } from "../formulier";

export const metadata: Metadata = { title: "Nieuwe uitgave" };

export default async function NieuweUitgavePagina({
  searchParams,
}: PageProps<"/uitgaven/nieuw">) {
  const boekjaar = await vereisSchrijfbaarBoekjaar("/uitgaven");
  const parameters = await searchParams;

  const [posten, leveranciers, evenementen] = await Promise.all([
    db.begrotingspost.findMany({
      where: { boekjaarId: boekjaar.id },
      orderBy: [{ soort: "desc" }, { volgorde: "asc" }],
      select: { id: true, code: true, naam: true, soort: true },
    }),
    db.relatie.findMany({
      where: { actief: true },
      orderBy: { naam: "asc" },
      select: { id: true, naam: true },
    }),
    db.evenement.findMany({
      where: { boekjaarId: boekjaar.id, status: { not: "afgesloten" } },
      orderBy: { datum: "asc" },
      select: { id: true, naam: true },
    }),
  ]);

  if (posten.length === 0) {
    return (
      <>
        <Paginakop titel="Nieuwe uitgave" />
        <Melding toon="waarschuwing" titel="Er zijn nog geen begrotingsposten">
          Elke uitgave moet naar een begrotingspost wijzen. Maak die eerst aan bij
          Gegevens › Begroting.
        </Melding>
      </>
    );
  }

  const vooringevuldEvenement =
    typeof parameters.evenement === "string" ? parameters.evenement : "";

  return (
    <>
      <Paginakop titel="Nieuwe uitgave" />
      <UitgaveFormulier
        posten={posten}
        leveranciers={leveranciers}
        evenementen={evenementen}
        waarden={{
          datum: datumNaarInvoer(vandaag()),
          leverancierNaam: "",
          relatieId: "",
          omschrijving: "",
          bedrag: "",
          begrotingspostId: "",
          evenementId: vooringevuldEvenement,
          bedragDefinitief: false,
          betaald: false,
          betaaldOp: "",
          notities: "",
          heeftBijlage: false,
        }}
      />
    </>
  );
}
