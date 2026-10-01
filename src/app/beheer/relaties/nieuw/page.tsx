import type { Metadata } from "next";

import { Paginakop } from "@/components/paginakop";
import { vereisBestuur } from "@/lib/auth/server";

import { LEGE_RELATIE, RelatieFormulier } from "../formulier";

export const metadata: Metadata = { title: "Nieuwe relatie" };

export default async function NieuweRelatiePagina() {
  await vereisBestuur();
  return (
    <>
      <Paginakop titel="Nieuwe relatie" />
      <RelatieFormulier waarden={LEGE_RELATIE} />
    </>
  );
}
