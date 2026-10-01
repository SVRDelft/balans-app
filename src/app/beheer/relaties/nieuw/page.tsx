import type { Metadata } from "next";

import { Paginakop } from "@/components/paginakop";

import { LEGE_RELATIE, RelatieFormulier } from "../formulier";

export const metadata: Metadata = { title: "Nieuwe relatie" };

export default function NieuweRelatiePagina() {
  return (
    <>
      <Paginakop titel="Nieuwe relatie" />
      <RelatieFormulier waarden={LEGE_RELATIE} />
    </>
  );
}
