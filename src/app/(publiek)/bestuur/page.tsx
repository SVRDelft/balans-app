import type { Metadata } from "next";

import { leesBestuur } from "@/lib/content";

import { HuidigBestuur, OudBesturen, PaginaKop } from "../secties";

export const dynamic = "force-static";

export const metadata: Metadata = {
  title: "Bestuur",
  description:
    "Het dagelijks bestuur van de StudieVerenigingenRaad Delft, en de besturen die hen voorgingen.",
};

export default function BestuurPagina() {
  const bestuur = leesBestuur();
  return (
    <>
      <PaginaKop titel="Bestuur">
        <p>
          Elk jaar neemt een nieuw dagelijks bestuur de SVR over. Dit jaar is dat
          het {bestuur.nummer}e.
        </p>
      </PaginaKop>
      <HuidigBestuur />
      <OudBesturen />
    </>
  );
}
