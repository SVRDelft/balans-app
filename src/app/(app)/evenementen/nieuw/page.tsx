import type { Metadata } from "next";

import { Paginakop } from "@/components/paginakop";
import { vereisSchrijfbaarBoekjaar } from "@/lib/boekjaar";
import { db } from "@/lib/db";
import { datumNaarInvoer, vandaag } from "@/lib/datum";

import { EvenementFormulier } from "../formulier";

export const metadata: Metadata = { title: "Nieuw evenement" };

export default async function NieuwEvenementPagina() {
  const boekjaar = await vereisSchrijfbaarBoekjaar("/evenementen");

  const posten = await db.begrotingspost.findMany({
    where: { boekjaarId: boekjaar.id },
    orderBy: { volgorde: "asc" },
    select: { id: true, code: true, naam: true, soort: true },
  });

  return (
    <>
      <Paginakop titel="Nieuw evenement" />
      <EvenementFormulier
        kostenposten={posten.filter((post) => post.soort === "uitgave")}
        opbrengstposten={posten.filter((post) => post.soort === "inkomst")}
        waarden={{
          naam: "",
          datum: datumNaarInvoer(vandaag()),
          kostenpostId: "",
          opbrengstpostId: "",
          notities: "",
        }}
      />
    </>
  );
}
