import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { Paginakop } from "@/components/paginakop";
import { db } from "@/lib/db";

import { RelatieFormulier } from "../formulier";
import { VerwijderRelatieKnop } from "./verwijderknop";

export const metadata: Metadata = { title: "Relatie bewerken" };

export default async function RelatiePagina({
  params,
}: PageProps<"/relaties/[id]">) {
  const { id } = await params;

  const relatie = await db.relatie.findUnique({
    where: { id },
    include: {
      _count: { select: { facturen: true, uitgaven: true, deelnemers: true } },
    },
  });
  if (!relatie) notFound();

  const koppelingen =
    relatie._count.facturen + relatie._count.uitgaven + relatie._count.deelnemers;

  return (
    <>
      <Paginakop
        titel={relatie.naam}
        beschrijving={
          koppelingen > 0
            ? `Deze relatie is aan ${koppelingen} ${koppelingen === 1 ? "onderdeel" : "onderdelen"} gekoppeld en wordt daarom bij verwijderen op non-actief gezet.`
            : undefined
        }
        acties={<VerwijderRelatieKnop id={relatie.id} naam={relatie.naam} />}
      />

      <RelatieFormulier
        waarden={{
          id: relatie.id,
          type: relatie.type,
          naam: relatie.naam,
          contactpersoon: relatie.contactpersoon ?? "",
          email: relatie.email ?? "",
          adres: relatie.adres ?? "",
          postcode: relatie.postcode ?? "",
          plaats: relatie.plaats ?? "",
          actief: relatie.actief,
          bijdragePlichtig: relatie.bijdragePlichtig,
          notities: relatie.notities ?? "",
        }}
      />
    </>
  );
}
