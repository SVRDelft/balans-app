import type { Metadata } from "next";
import Link from "next/link";
import { Paginakop } from "@/components/paginakop";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { db } from "@/lib/db";
import { vereisBoekjaarContext } from "@/lib/boekjaar";
import { formatteerDatum, formatteerTijdstempel } from "@/lib/datum";
import { formatteerEuro } from "@/lib/geld";
import { BankimportFormulier } from "./formulier";

export const metadata: Metadata = { title: "Bankafschriften importeren" };
export default async function BankimportsPagina() {
  const { boekjaar, schrijfbaar } = await vereisBoekjaarContext();
  const imports = await db.bankimport.findMany({ where: { boekjaarId: boekjaar.id }, orderBy: { aangemaaktOp: "desc" }, include: { _count: { select: { mutaties: { where: { verwerking: "open" } } } } } });
  return <>
    <Paginakop titel="Bankafschriften" beschrijving="Importeer je ABN AMRO-afschrift en koppel betalingen zonder overtypen." acties={<Button asChild variant="outline"><Link href="/bank">Naar banksaldo</Link></Button>} />
    {schrijfbaar ? <Card className="mb-6 max-w-3xl"><CardHeader><CardTitle>MT940-bestand inlezen</CardTitle></CardHeader><CardContent className="space-y-4">
      <p className="text-sm text-muted-foreground">Download bij ABN AMRO de bij- en afschrijvingen van de SVR-rekening als MT940. Kies een periode binnen dit boekjaar. Na het inlezen zie je het banksaldo en de voorgestelde koppelingen; je bevestigt ze voordat er boekingen veranderen.</p>
      <BankimportFormulier />
      <p className="text-xs text-muted-foreground">Gebruik steeds dezelfde rekening. Overlappende downloads worden gecontroleerd op eerder ingelezen bankregels. Bewaar je originele afschriften voor de overdracht.</p>
    </CardContent></Card> : null}
    <div className="space-y-3">
      {imports.length === 0 ? <p className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">Nog geen bankafschriften ingelezen in dit boekjaar.</p> : imports.map(bestand => <Link key={bestand.id} href={`/bank/importeren/${bestand.id}`} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card p-5 transition-colors hover:border-primary/40">
        <div className="min-w-0"><p className="break-words font-semibold">{bestand.bestandsnaam}</p><p className="mt-1 text-xs text-muted-foreground">t/m {formatteerDatum(bestand.eindDatum)} · {bestand.aantalRegels} bankregels · ingelezen {formatteerTijdstempel(bestand.aangemaaktOp)}</p></div>
        <div className="flex flex-wrap items-center gap-3"><span className="cijfers text-sm">{formatteerEuro(bestand.eindSaldoCenten)}</span><Badge variant={bestand.bevestigdOp && bestand._count.mutaties === 0 ? "goed" : "waarschuwing"}>{!bestand.bevestigdOp ? "Nog bevestigen" : bestand._count.mutaties ? `${bestand._count.mutaties} te controleren` : "Verwerkt"}</Badge></div>
      </Link>)}
    </div>
  </>;
}
