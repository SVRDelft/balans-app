import type { Metadata } from "next";

import { AanTafel, EenJaar, Evenementen, HoeHetWerkt, PaginaKop, Tradities, WatWeDoen } from "../secties";

export const dynamic = "force-static";

export const metadata: Metadata = {
  title: "Wat we doen",
  description:
    "Hoe de StudieVerenigingenRaad Delft de vijftien studieverenigingen laat samenwerken, vertegenwoordigt en verbindt: de overleggen, het jaar en de evenementen.",
};

export default function WatWeDoenPagina() {
  return (
    <>
      <PaginaKop titel="Wat we doen">
        <p>
          De SVR is er voor de besturen van de studieverenigingen: om van elkaar
          te leren, om samen met één stem te spreken en om elkaar te kennen.
        </p>
      </PaginaKop>
      <WatWeDoen kop="Drie pijlers" />
      <HoeHetWerkt />
      <AanTafel />
      <EenJaar />
      <Evenementen />
      <Tradities />
    </>
  );
}
