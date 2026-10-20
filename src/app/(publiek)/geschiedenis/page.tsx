import type { Metadata } from "next";

import { Bereikt, Mijlpalen, PaginaKop, Stamboom, Verhaal, VijftienDoorDeJaren } from "../secties";

export const dynamic = "force-static";

export const metadata: Metadata = {
  title: "Geschiedenis",
  description:
    "De StudieVerenigingenRaad Delft sinds 1963: de mijlpalen, wat de SVR heeft opgezet en de vijftien studieverenigingen door de jaren.",
};

export default function GeschiedenisPagina() {
  return (
    <>
      <PaginaKop titel="Geschiedenis">
        <p>Sinds 26 februari 1963, elk jaar met een nieuw bestuur.</p>
      </PaginaKop>
      <Verhaal />
      <Mijlpalen />
      <Bereikt />
      <Stamboom />
      <VijftienDoorDeJaren />
    </>
  );
}
