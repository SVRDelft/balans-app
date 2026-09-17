import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Paginakop, Kerngetal } from "@/components/paginakop";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Melding } from "@/components/ui/melding";
import { BevestigKnop } from "@/components/bevestigknop";
import { db } from "@/lib/db";
import { vereisBoekjaarContext } from "@/lib/boekjaar";
import { formatteerDatum } from "@/lib/datum";
import { formatteerEuro } from "@/lib/geld";
import { bankKeuzes } from "@/lib/bank/gegevens";
import { bankVoorstellen } from "@/lib/bank/koppelen";
import { bevestigBankimport, ontkoppelBankmutatie } from "../acties";
import { MutatieFormulier } from "./mutatie-formulier";
import { SelectieFormulier } from "./selectie-formulier";

export const metadata: Metadata = { title: "Bankimport controleren" };

export default async function BankimportPagina({ params }: PageProps<"/bank/importeren/[id]">) {
  const { boekjaar, schrijfbaar } = await vereisBoekjaarContext();
  const { id } = await params;
  const bestand = await db.bankimport.findUnique({
    where: { id, boekjaarId: boekjaar.id },
    include: { mutaties: { include: { betaling: { include: { factuur: true } }, uitgave: true }, orderBy: [{ datum: "asc" }, { id: "asc" }] } },
  });
  if (!bestand) notFound();

  const [keuzes, posten, relaties] = await Promise.all([
    bankKeuzes(boekjaar.id),
    db.begrotingspost.findMany({ where: { boekjaarId: boekjaar.id }, orderBy: { code: "asc" }, select: { id: true, code: true, naam: true, soort: true } }),
    db.relatie.findMany({ where: { actief: true }, orderBy: { naam: "asc" }, select: { id: true, naam: true } }),
  ]);
  const uitgavenposten = posten.filter((p) => p.soort === "uitgave");
  const inkomstenposten = posten.filter((p) => p.soort === "inkomst");

  const open = bestand.mutaties.filter((r) => r.verwerking === "open");
  const voorstellen = bankVoorstellen(open, keuzes.facturen, keuzes.betalingen, keuzes.uitgaven);

  const doelLabel = (waarde: string) => {
    const [soort, doelId] = waarde.split(":");
    if (soort === "factuur") {
      const f = keuzes.facturen.find((x) => x.id === doelId);
      return f ? `Factuur ${f.nummer} · ${f.relatieNaam}` : "Factuur";
    }
    if (soort === "betaling") {
      const b = keuzes.betalingen.find((x) => x.id === doelId);
      const f = keuzes.facturen.find((x) => x.id === b?.factuurId);
      return `Al ingevoerde betaling op ${f?.nummer ?? "factuur"}`;
    }
    const u = keuzes.uitgaven.find((x) => x.id === doelId);
    return u ? `Uitgave · ${u.leverancierNaam} · ${u.omschrijving}` : "Uitgave";
  };

  const selectie = open
    .filter((r) => voorstellen.has(r.id))
    .map((r) => {
      const v = voorstellen.get(r.id)!;
      return { id: r.id, datum: formatteerDatum(r.datum), tegenpartij: r.tegenpartijNaam, bedragCenten: r.bedragCenten, doelLabel: doelLabel(v.waarde), reden: v.reden, zekerheid: v.zekerheid };
    });
  const zonderVoorstel = open.length - selectie.length;

  return <>
    <Paginakop titel="Bankimport controleren" beschrijving={`${bestand.bestandsnaam} · ${bestand.rekening}`} acties={<Button asChild variant="outline"><Link href="/bank/importeren">Alle afschriften</Link></Button>} />

    <div className="mb-6 grid gap-3 sm:grid-cols-3">
      <Kerngetal label={`Banksaldo per ${formatteerDatum(bestand.eindDatum)}`} waarde={formatteerEuro(bestand.eindSaldoCenten)} toelichting={bestand.bevestigdOp ? "Overgenomen als banksaldo" : "Nog niet overgenomen"} />
      <Kerngetal label="Herkend" waarde={String(selectie.length)} toelichting="Voorstellen klaar om te koppelen" />
      <Kerngetal label="Zelf doen" waarde={String(zonderVoorstel)} toelichting={`${bestand.mutaties.length - open.length} al verwerkt`} />
    </div>

    {bestand.duplicaten > 0 ? <Melding toon="info" className="mb-4">{bestand.duplicaten} bankregels waren al eerder ingelezen en zijn overgeslagen.</Melding> : null}

    {schrijfbaar && selectie.length > 0 ? (
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Herkende betalingen koppelen</CardTitle>
          <CardDescription>
            Wat de app zeker weet, of waarbij naam en bedrag kloppen, staat al aangevinkt.
            Twijfelgevallen op alleen het bedrag vink je zelf aan. Klopt er achteraf iets niet,
            dan draai je die regel hieronder terug.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <SelectieFormulier importId={id} regels={selectie} />
        </CardContent>
      </Card>
    ) : null}

    {schrijfbaar && !bestand.bevestigdOp ? (
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Banksaldo overnemen</CardTitle>
          <CardDescription>
            Neemt het eindsaldo van dit afschrift over als banksaldo, zodat de app het kan
            vergelijken met de administratie. Dit boekt verder niets en staat los van het koppelen.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <BevestigKnop actie={bevestigBankimport} velden={{ importId: id }} vraag={`Banksaldo ${formatteerEuro(bestand.eindSaldoCenten)} per ${formatteerDatum(bestand.eindDatum)} overnemen?`} variant="outline">
            Saldo {formatteerEuro(bestand.eindSaldoCenten)} overnemen
          </BevestigKnop>
        </CardContent>
      </Card>
    ) : bestand.bevestigdOp ? (
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <Badge variant="goed">Banksaldo overgenomen</Badge>
        <Button asChild variant="outline" size="sm"><Link href="/bank">Controleer het bankverschil</Link></Button>
      </div>
    ) : null}

    {!open.length ? <Melding toon="goed" className="mb-4">Alle bankregels uit dit bestand zijn afgehandeld. Controleer bij Banksaldo of het verschil met de administratie nul is.</Melding> : null}

    {open.length > 0 ? <h2 className="mb-3 mt-8 text-lg font-semibold">Alle bankregels</h2> : null}
    <div className="space-y-3">{bestand.mutaties.map((regel) => {
      const voorstel = voorstellen.get(regel.id);
      const opties = [
        ...keuzes.facturen.filter((f) => f.status !== "oninbaar" && Math.sign(f.openstaandCenten) === Math.sign(regel.bedragCenten) && Math.abs(f.openstaandCenten) >= Math.abs(regel.bedragCenten)).map((f) => ({ waarde: `factuur:${f.id}`, label: `${f.nummer} · ${f.relatieNaam} · ${formatteerEuro(f.openstaandCenten)} open` })),
        ...keuzes.betalingen.filter((b) => b.bedragCenten === regel.bedragCenten && b.datum.toISOString().slice(0, 10) === regel.datum.toISOString().slice(0, 10)).map((b) => ({ waarde: `betaling:${b.id}`, label: `Al ingevoerd: ${keuzes.facturen.find((f) => f.id === b.factuurId)?.nummer ?? "betaling"} · ${formatteerEuro(b.bedragCenten)}` })),
        ...keuzes.uitgaven.filter((u) => regel.bedragCenten < 0 && u.bedragCenten === -regel.bedragCenten).map((u) => ({ waarde: `uitgave:${u.id}`, label: `${u.betaald ? "Al betaald: " : "Uitgave: "}${u.leverancierNaam} · ${u.omschrijving}` })),
      ];
      const status = regel.verwerking !== "open" ? (regel.verwerking === "genegeerd" ? "Buiten administratie" : "Gekoppeld") : voorstel ? "Herkend" : "Zelf koppelen";

      return <article key={regel.id} data-bankregel={regel.id} className="rounded-xl border bg-card p-4 sm:p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground">{formatteerDatum(regel.datum)}{regel.tegenpartijNaam ? ` · ${regel.tegenpartijNaam}` : ""}</p>
            <p className="mt-1 whitespace-pre-wrap break-words text-sm">{regel.omschrijving || "Zonder omschrijving"}</p>
            {regel.tegenpartijIban ? <p className="mt-1 break-all text-xs text-muted-foreground">{regel.tegenpartijIban}</p> : null}
          </div>
          <span className={`cijfers shrink-0 font-semibold ${regel.bedragCenten > 0 ? "text-success" : ""}`}>{formatteerEuro(regel.bedragCenten)}</span>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Badge variant={regel.verwerking === "open" ? (voorstel ? "default" : "waarschuwing") : "goed"}>{status}</Badge>
          {regel.betaling ? <Link className="text-sm text-primary underline" href={`/facturen/${regel.betaling.factuurId}`}>{regel.betaling.factuur.nummer}</Link> : regel.uitgave ? <Link className="text-sm text-primary underline" href={`/uitgaven/${regel.uitgaveId}`}>{regel.uitgave.omschrijving}</Link> : null}
        </div>
        {voorstel && regel.verwerking === "open" ? <p className="mt-2 text-xs text-muted-foreground">{voorstel.reden}</p> : null}
        {regel.notitie ? <p className="mt-2 text-sm text-muted-foreground">{regel.notitie}</p> : null}
        {schrijfbaar ? regel.verwerking === "open" ? (
          <details className="mt-3 border-t pt-3" open={!voorstel}>
            <summary className="cursor-pointer text-sm font-medium text-primary">{voorstel ? "Anders koppelen" : "Koppeling kiezen"}</summary>
            <div className="mt-4 max-w-2xl">
              <MutatieFormulier key={`${regel.id}-${voorstel?.waarde ?? ""}`} id={regel.id} bedragCenten={regel.bedragCenten} omschrijving={regel.omschrijving} tegenpartij={regel.tegenpartijNaam} voorstel={voorstel} opties={opties} posten={uitgavenposten} inkomstenposten={inkomstenposten} relaties={relaties} />
            </div>
          </details>
        ) : (
          <div className="mt-3">
            <BevestigKnop actie={ontkoppelBankmutatie} velden={{ mutatieId: regel.id }} vraag="Deze koppeling ongedaan maken? Een door deze import aangemaakte betaling, uitgave of inkomst wordt teruggedraaid. Eerder handmatig ingevoerde boekingen blijven behouden." size="sm" variant="ghost">Koppeling ongedaan maken</BevestigKnop>
          </div>
        ) : null}
      </article>;
    })}</div>
  </>;
}
