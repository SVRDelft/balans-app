import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { Paginakop } from "@/components/paginakop";
import { db } from "@/lib/db";
import { vereisSchrijfbaarBoekjaar } from "@/lib/boekjaar";
import { centenNaarInvoer } from "@/lib/geld";

import { BegrotingspostFormulier } from "../formulier";
import { VerwijderPostKnop } from "./verwijderknop";

export const metadata: Metadata = { title: "Begrotingspost" };

export default async function BegrotingspostPagina({
  params,
}: PageProps<"/begroting/[id]">) {
  const { id } = await params;
  const boekjaar = await vereisSchrijfbaarBoekjaar("/begroting");

  const post = await db.begrotingspost.findUnique({
    where: { id, boekjaarId: boekjaar.id },
    include: { _count: { select: { factuurregels: true, uitgaven: true } } },
  });
  if (!post) notFound();

  return (
    <>
      <Paginakop
        titel={post.naam}
        beschrijving={`${post._count.factuurregels} factuurregels en ${post._count.uitgaven} uitgaven wijzen naar deze post.`}
        acties={<VerwijderPostKnop id={post.id} code={post.code} />}
      />

      <BegrotingspostFormulier
        waarden={{
          id: post.id,
          code: post.code,
          naam: post.naam,
          categorie: post.categorie,
          soort: post.soort,
          begroot: centenNaarInvoer(post.begrootCenten),
          notities: post.notities ?? "",
        }}
      />
    </>
  );
}
