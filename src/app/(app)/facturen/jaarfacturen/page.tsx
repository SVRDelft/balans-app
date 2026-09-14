import type { Metadata } from "next";

import { Paginakop } from "@/components/paginakop";
import { Melding } from "@/components/ui/melding";
import { vereisSchrijfbaarBoekjaar } from "@/lib/boekjaar";
import { db } from "@/lib/db";
import { datumNaarInvoer, vandaag } from "@/lib/datum";
import { verdeelCenten } from "@/lib/geld";

import { JaarfactuurFormulier } from "./formulier";

export const metadata: Metadata = { title: "Jaarfacturen bijdrage" };

export default async function JaarfacturenPagina() {
  const boekjaar = await vereisSchrijfbaarBoekjaar();

  const [posten, verenigingen] = await Promise.all([
    db.begrotingspost.findMany({
      where: { boekjaarId: boekjaar.id, categorie: "vast", soort: "inkomst" },
      orderBy: { volgorde: "asc" },
    }),
    db.relatie.findMany({
      where: { type: "studievereniging", bijdragePlichtig: true, actief: true },
      orderBy: { naam: "asc" },
      select: { id: true, naam: true },
    }),
  ]);

  if (posten.length === 0) {
    return (
      <>
        <Paginakop titel="Jaarfacturen bijdrage" />
        <Melding toon="waarschuwing" titel="Geen vaste inkomstenpost gevonden">
          Maak eerst een begrotingspost aan met categorie <em>vast</em> en soort{" "}
          <em>inkomst</em>, bijvoorbeeld de bijdrage van de aangesloten
          studieverenigingen.
        </Melding>
      </>
    );
  }

  if (verenigingen.length === 0) {
    return (
      <>
        <Paginakop titel="Jaarfacturen bijdrage" />
        <Melding
          toon="waarschuwing"
          titel="Geen bijdrageplichtige studieverenigingen"
        >
          Zet bij de betreffende relaties de vlag <em>bijdrageplichtig</em> aan.
        </Melding>
      </>
    );
  }

  // Al gemaakt: per post bijhouden welke verenigingen al een factuur hebben.
  const bestaande = await db.factuur.findMany({
    where: {
      boekjaarId: boekjaar.id,
      relatieId: { in: verenigingen.map((vereniging) => vereniging.id) },
      regels: { some: { begrotingspostId: { in: posten.map((post) => post.id) } } },
    },
    select: {
      relatieId: true,
      regels: { select: { begrotingspostId: true } },
    },
  });

  const alGefactureerd: Record<string, string[]> = {};
  for (const post of posten) {
    alGefactureerd[post.id] = bestaande
      .filter((factuur) =>
        factuur.regels.some((regel) => regel.begrotingspostId === post.id),
      )
      .map((factuur) => factuur.relatieId);
  }

  const verdelingPerPost: Record<string, number[]> = {};
  for (const post of posten) {
    verdelingPerPost[post.id] = verdeelCenten(
      post.begrootCenten,
      verenigingen.map(() => 1),
    );
  }

  return (
    <>
      <Paginakop
        titel="Jaarfacturen bijdrage"
        beschrijving="Maakt in één keer voor elke bijdrageplichtige studievereniging een conceptfactuur met het bedrag uit de begroting."
      />

      <JaarfactuurFormulier
        posten={posten.map((post) => ({
          id: post.id,
          code: post.code,
          naam: post.naam,
          begrootCenten: post.begrootCenten,
        }))}
        verenigingen={verenigingen}
        verdelingPerPost={verdelingPerPost}
        alGefactureerd={alGefactureerd}
        vandaag={datumNaarInvoer(vandaag())}
      />
    </>
  );
}
