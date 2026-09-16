import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Paginakop, Kerngetal } from "@/components/paginakop";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Melding } from "@/components/ui/melding";
import { BevestigKnop } from "@/components/bevestigknop";
import { db } from "@/lib/db";
import { vereisBoekjaarContext } from "@/lib/boekjaar";
import { formatteerDatum } from "@/lib/datum";
import { formatteerEuro } from "@/lib/geld";
import { bankKeuzes } from "@/lib/bank/gegevens";
import { bankVoorstellen } from "@/lib/bank/koppelen";
import { bevestigBankimport, bevestigVoorstellen, ontkoppelBankmutatie } from "../acties";
import { MutatieFormulier } from "./mutatie-formulier";

export const metadata: Metadata = { title: "Bankimport controleren" };
export default async function BankimportPagina({ params }: PageProps<"/bank/importeren/[id]">) {
  const { boekjaar, schrijfbaar } = await vereisBoekjaarContext();
  const { id } = await params;
  const bestand = await db.bankimport.findUnique({ where: { id, boekjaarId: boekjaar.id }, include: { mutaties: { include: { betaling: { include: { factuur: true } }, uitgave: true }, orderBy: [{ datum: "asc" }, { id: "asc" }] } } });
  if (!bestand) notFound();
  const [keuzes, posten] = await Promise.all([bankKeuzes(boekjaar.id), db.begrotingspost.findMany({ where: { boekjaarId: boekjaar.id, soort: "uitgave" }, orderBy: { code: "asc" }, select: { id: true, code: true, naam: true } })]);
  const open = bestand.mutaties.filter(r => r.verwerking === "open");
  const voorstellen = bankVoorstellen(open, keuzes.facturen, keuzes.betalingen, keuzes.uitgaven);
  return <>
    <Paginakop titel="Bankimport controleren" beschrijving={`${bestand.bestandsnaam} · ${bestand.rekening}`} acties={<Button asChild variant="outline"><Link href="/bank/importeren">Alle afschriften</Link></Button>} />
    <div className="mb-6 grid gap-3 sm:grid-cols-3">
      <Kerngetal label={`Banksaldo per ${formatteerDatum(bestand.eindDatum)}`} waarde={formatteerEuro(bestand.eindSaldoCenten)} toelichting={`Beginsaldo afschrift: ${formatteerEuro(bestand.beginSaldoCenten)}`} />
      <Kerngetal label="Te controleren" waarde={String(open.length)} toelichting={`${bestand.mutaties.length - open.length} bankregels verwerkt`} />
      <Kerngetal label="Voorgestelde koppelingen" waarde={String(voorstellen.size)} toelichting="Factuurnummer, IBAN of leverancier herkend" />
    </div>
    {bestand.duplicaten > 0 ? <Melding toon="info" className="mb-4">{bestand.duplicaten} bankregels zijn al eerder ingelezen en zijn overgeslagen. Ze blijven bij hun eerdere import staan. Gelijke regels op dezelfde datum worden op inhoud en aantal vergeleken; controleer bij twijfel het originele afschrift.</Melding> : null}
    {schrijfbaar && !bestand.bevestigdOp ? <Melding toon="info" className="mb-6" titel="Controleer rekening, saldo en voorstellen">
      <p className="mb-3">Bevestigen neemt het eindsaldo over en verwerkt maximaal 50 voorgestelde koppelingen. De overige regels blijven klaarstaan voor controle. Bedragen uit een import worden pas in de administratie opgenomen wanneer je ze koppelt of als uitgave boekt.</p>
      <BevestigKnop actie={bevestigBankimport} velden={{ importId: id }} vraag={`Banksaldo ${formatteerEuro(bestand.eindSaldoCenten)} overnemen en ${Math.min(50, voorstellen.size)} voorgestelde koppelingen verwerken?`} variant="default">Import bevestigen</BevestigKnop>
    </Melding> : bestand.bevestigdOp ? <div className="mb-6 flex flex-wrap items-center gap-3"><Badge variant="goed">Banksaldo overgenomen</Badge><Button asChild variant="outline" size="sm"><Link href="/bank">Controleer het bankverschil</Link></Button>{schrijfbaar && voorstellen.size > 0 ? <BevestigKnop actie={bevestigVoorstellen} velden={{ importId: id }} vraag={`${Math.min(50, voorstellen.size)} voorgestelde koppelingen verwerken?`} size="sm">Voorstellen verwerken</BevestigKnop> : null}</div> : null}
    {bestand.bevestigdOp && !open.length ? <Melding toon="goed" className="mb-4">Alle nieuwe bankregels uit dit bestand zijn afgehandeld. Controleer bij Banksaldo of het verschil met de administratie nul is.</Melding> : null}
    <div className="space-y-3">{bestand.mutaties.map(regel => {
      const voorstel = voorstellen.get(regel.id);
      const opties = [
        ...keuzes.facturen.filter(f => f.status !== "oninbaar" && Math.sign(f.openstaandCenten) === Math.sign(regel.bedragCenten) && Math.abs(f.openstaandCenten) >= Math.abs(regel.bedragCenten)).map(f => ({ waarde: `factuur:${f.id}`, label: `${f.nummer} · ${f.relatieNaam} · ${formatteerEuro(f.openstaandCenten)} open` })),
        ...keuzes.betalingen.filter(b => b.bedragCenten === regel.bedragCenten && b.datum.toISOString().slice(0, 10) === regel.datum.toISOString().slice(0, 10)).map(b => ({ waarde: `betaling:${b.id}`, label: `Al ingevoerd: ${keuzes.facturen.find(f => f.id === b.factuurId)?.nummer ?? "betaling"} · ${formatteerEuro(b.bedragCenten)}` })),
        ...keuzes.uitgaven.filter(u => regel.bedragCenten < 0 && u.bedragCenten === -regel.bedragCenten).map(u => ({ waarde: `uitgave:${u.id}`, label: `${u.betaald ? "Al betaald: " : "Uitgave: "}${u.leverancierNaam} · ${u.omschrijving}` })),
      ];
      return <article key={regel.id} data-bankregel={regel.id} className="rounded-xl border bg-card p-4 sm:p-5">
        <div className="flex items-start justify-between gap-4"><div className="min-w-0"><p className="text-xs text-muted-foreground">{formatteerDatum(regel.datum)}{regel.tegenpartijNaam ? ` · ${regel.tegenpartijNaam}` : ""}</p><p className="mt-1 whitespace-pre-wrap break-words text-sm">{regel.omschrijving || "Zonder omschrijving"}</p>{regel.tegenpartijIban ? <p className="mt-1 break-all text-xs text-muted-foreground">{regel.tegenpartijIban}</p> : null}</div><span className={`cijfers shrink-0 font-semibold ${regel.bedragCenten > 0 ? "text-success" : ""}`}>{formatteerEuro(regel.bedragCenten)}</span></div>
        <div className="mt-3 flex flex-wrap items-center gap-2"><Badge variant={regel.verwerking === "open" ? "waarschuwing" : "goed"}>{regel.verwerking === "open" ? voorstel ? "Voorstel gevonden" : "Zelf koppelen" : regel.verwerking === "genegeerd" ? "Buiten administratie" : "Gekoppeld"}</Badge>{regel.betaling ? <Link className="text-sm text-primary underline" href={`/facturen/${regel.betaling.factuurId}`}>{regel.betaling.factuur.nummer}</Link> : regel.uitgave ? <Link className="text-sm text-primary underline" href={`/uitgaven/${regel.uitgaveId}`}>{regel.uitgave.omschrijving}</Link> : null}</div>
        {voorstel ? <p className="mt-2 text-xs text-muted-foreground">{voorstel.reden}</p> : null}
        {regel.notitie ? <p className="mt-2 text-sm text-muted-foreground">{regel.notitie}</p> : null}
        {schrijfbaar && bestand.bevestigdOp ? regel.verwerking === "open" ? <details className="mt-3 border-t pt-3"><summary className="cursor-pointer text-sm font-medium text-primary">Koppeling kiezen</summary><div className="mt-4 max-w-2xl"><MutatieFormulier key={`${regel.id}-${voorstel?.waarde ?? ""}`} id={regel.id} bedragCenten={regel.bedragCenten} omschrijving={regel.omschrijving} tegenpartij={regel.tegenpartijNaam} voorstel={voorstel} opties={opties} posten={posten} /></div></details> : <div className="mt-3"><BevestigKnop actie={ontkoppelBankmutatie} velden={{ mutatieId: regel.id }} vraag="Deze koppeling ongedaan maken? Een door deze import aangemaakte betaling of uitgave wordt teruggedraaid. Eerder handmatig ingevoerde boekingen blijven behouden." size="sm" variant="ghost">Koppeling ongedaan maken</BevestigKnop></div> : null}
      </article>;
    })}</div>
  </>;
}
