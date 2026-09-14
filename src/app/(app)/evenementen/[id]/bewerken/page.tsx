import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { Paginakop } from "@/components/paginakop";
import { vereisSchrijfbaarBoekjaar } from "@/lib/boekjaar";
import { db } from "@/lib/db";
import { datumNaarInvoer } from "@/lib/datum";

import { EvenementFormulier } from "../../formulier";

export const metadata: Metadata = { title: "Evenement bewerken" };

export default async function BewerkEvenementPagina({
  params,
}: PageProps<"/evenementen/[id]/bewerken">) {
  const boekjaar = await vereisSchrijfbaarBoekjaar();
  const { id } = await params;

  const evenement = await db.evenement.findUnique({ where: { id } });
  if (!evenement) notFound();

  const posten = await db.begrotingspost.findMany({
    where: { boekjaarId: boekjaar.id },
    orderBy: { volgorde: "asc" },
    select: { id: true, code: true, naam: true, soort: true },
  });

  return (
    <>
      <Paginakop titel={`${evenement.naam} bewerken`} />
      <EvenementFormulier
        kostenposten={posten.filter((post) => post.soort === "uitgave")}
        opbrengstposten={posten.filter((post) => post.soort === "inkomst")}
        waarden={{
          id: evenement.id,
          naam: evenement.naam,
          datum: datumNaarInvoer(evenement.datum),
          kostenpostId: evenement.kostenpostId ?? "",
          opbrengstpostId: evenement.opbrengstpostId ?? "",
          notities: evenement.notities ?? "",
        }}
      />
    </>
  );
}
