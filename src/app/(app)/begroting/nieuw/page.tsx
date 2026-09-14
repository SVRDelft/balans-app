import type { Metadata } from "next";

import { Paginakop } from "@/components/paginakop";
import { vereisSchrijfbaarBoekjaar } from "@/lib/boekjaar";

import { BegrotingspostFormulier, LEGE_POST } from "../formulier";

export const metadata: Metadata = { title: "Nieuwe begrotingspost" };

export default async function NieuweBegrotingspostPagina() {
  await vereisSchrijfbaarBoekjaar();

  return (
    <>
      <Paginakop titel="Nieuwe begrotingspost" />
      <BegrotingspostFormulier waarden={LEGE_POST} />
    </>
  );
}
