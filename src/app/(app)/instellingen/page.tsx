import type { Metadata } from "next";

import { Paginakop } from "@/components/paginakop";
import { db } from "@/lib/db";

import { InstellingenFormulier } from "./formulier";

export const metadata: Metadata = { title: "Instellingen" };

export default async function InstellingenPagina() {
  const instellingen = await db.instellingen.findUnique({
    where: { id: "svr" },
  });

  return (
    <>
      <Paginakop titel="Instellingen" />
      <InstellingenFormulier
        waarden={{
          organisatieNaam:
            instellingen?.organisatieNaam ?? "StudieVerenigingenRaad Delft",
          adres: instellingen?.adres ?? "",
          postcode: instellingen?.postcode ?? "",
          plaats: instellingen?.plaats ?? "Delft",
          email: instellingen?.email ?? "",
          iban: instellingen?.iban ?? "",
          kvkNummer: instellingen?.kvkNummer ?? "",
          contactpersoon: instellingen?.contactpersoon ?? "",
          telefoon: instellingen?.telefoon ?? "",
          website: instellingen?.website ?? "",
          land: instellingen?.land ?? "Nederland",
          btwNummer: instellingen?.btwNummer ?? "",
          logoNaam: instellingen?.logoNaam ?? "SVR-logo",
          eigenLogo: Boolean(instellingen?.logoData),
          logoVersie: instellingen?.bijgewerktOp.toISOString() ?? "standaard",
          btwPlichtig: instellingen?.btwPlichtig ?? false,
          btwPercentage: instellingen?.btwPercentage ?? 21,
          betaaltermijnDagen: instellingen?.betaaltermijnDagen ?? 30,
          factuurVoetnoot: instellingen?.factuurVoetnoot ?? "",
        }}
      />
    </>
  );
}
