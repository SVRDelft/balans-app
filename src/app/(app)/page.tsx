import Link from "next/link";
import { ArrowRight, Plus, Receipt, Package } from "lucide-react";

import { Kerngetal, Paginakop } from "@/components/paginakop";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Melding } from "@/components/ui/melding";
import { vandaag, formatteerDatum } from "@/lib/datum";
import { dagenTeLaat } from "@/lib/finance/vervaldatum";
import { formatteerEuro } from "@/lib/geld";
import { vereisBoekjaarContext } from "@/lib/boekjaar";
import { haalBoekjaarCijfers } from "@/lib/rapportage";
import { OUDERDOM_LABEL } from "@/lib/finance/debiteuren";
import { cn } from "@/lib/utils";

export default async function DashboardPagina() {
  const { boekjaar, schrijfbaar } = await vereisBoekjaarContext();
  const cijfers = await haalBoekjaarCijfers(boekjaar.id);

  const peildatum = vandaag();
  const teLaat = cijfers.openstaandeFacturen.filter(
    (factuur) => dagenTeLaat(factuur.vervaldatum, peildatum, factuur.openstaandCenten) > 0,
  );
  const scheveEvenementen = cijfers.evenementen.filter(
    (evenement) => !evenement.afstemming.klopt,
  );

  const aandachtspunten =
    teLaat.length +
    scheveEvenementen.length +
    cijfers.uitgavenZonderPost +
    cijfers.conceptFacturen +
    (cijfers.laatsteBanksaldo ? 0 : 1) +
    (cijfers.balans.bankverschilCenten !== null &&
    cijfers.balans.bankverschilCenten !== 0
      ? 1
      : 0);

  return (
    <>
      <Paginakop
        titel="Dashboard"
        beschrijving={`${boekjaar.naam} — stand van zaken op ${formatteerDatum(peildatum)}.`}
        acties={schrijfbaar ? <>
          <Button variant="outline" asChild><Link href="/uitgaven/nieuw"><Receipt />Uitgave boeken</Link></Button>
          <Button asChild><Link href="/facturen/nieuw"><Plus />Nieuwe factuur</Link></Button>
        </> : null}
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Kerngetal
          label="Banksaldo (laatst ingevoerd)"
          waarde={
            cijfers.laatsteBanksaldo
              ? formatteerEuro(cijfers.laatsteBanksaldo.saldoCenten)
              : "—"
          }
          toelichting={
            cijfers.laatsteBanksaldo
              ? `Stand per ${formatteerDatum(cijfers.laatsteBanksaldo.datum)}`
              : "Nog geen saldo ingevoerd"
          }
        />
        <Kerngetal
          label="Openstaand bij debiteuren"
          waarde={formatteerEuro(cijfers.ouderdom.totaal)}
          toelichting={`${cijfers.openstaandeFacturen.length} ${cijfers.openstaandeFacturen.length === 1 ? "factuur" : "facturen"}`}
        />
        <Kerngetal
          label="Nog te betalen aan leveranciers"
          waarde={formatteerEuro(cijfers.balans.crediteurenCenten)}
          toelichting={`${cijfers.openstaandeUitgaven.length} ${cijfers.openstaandeUitgaven.length === 1 ? "uitgave" : "uitgaven"}`}
        />
        <Kerngetal
          label="Resultaat tot nu toe"
          waarde={formatteerEuro(cijfers.balans.resultaatCenten)}
          toon={cijfers.balans.resultaatCenten < 0 ? "fout" : "goed"}
          toelichting="Inkomsten min kosten, inclusief voorraad"
        />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Card className="order-2 lg:order-1 lg:col-span-2">
          <CardHeader>
            <CardTitle>Begroot tegenover gerealiseerd</CardTitle>
            <CardDescription>
              Per begrotingspost. Zie{" "}
              <Link href="/exploitatie" className="underline">
                Exploitatie
              </Link>{" "}
              voor de volledige opstelling.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {(["vast", "omslag"] as const).map((categorie) => {
              const posten = cijfers.posten.filter(
                (post) => post.categorie === categorie,
              );
              if (posten.length === 0) return null;
              return (
                <div key={categorie}>
                  <p className="mb-2 text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                    {categorie === "vast" ? "Vaste posten" : "Omslagposten"}
                  </p>
                  <div className="space-y-2.5">
                    {posten.map((post) => (
                      <Balkje
                        key={post.id}
                        naam={post.naam}
                        soort={post.soort}
                        begrootCenten={post.begrootCenten}
                        gerealiseerdCenten={post.gerealiseerdCenten}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
            {cijfers.posten.length === 0 ? <p className="text-sm text-muted-foreground">Begin met je begroting om inkomsten en kosten te kunnen boeken. <Link className="font-medium text-primary underline" href="/begroting">Begroting inrichten</Link></p> : null}
          </CardContent>
        </Card>

        <div className="order-1 flex flex-col gap-6 lg:order-2">
          <Card className="order-2">
            <CardHeader>
              <CardTitle>Ouderdom debiteuren</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {(["tot30", "van30tot60", "meer60"] as const).map((groep) => (
                <div
                  key={groep}
                  className="flex items-center justify-between text-sm"
                >
                  <span className="text-muted-foreground">
                    {OUDERDOM_LABEL[groep]}
                  </span>
                  <span
                    className={cn(
                      "cijfers font-medium",
                      groep === "meer60" && cijfers.ouderdom[groep] > 0
                        ? "text-destructive"
                        : undefined,
                    )}
                  >
                    {formatteerEuro(cijfers.ouderdom[groep])}
                  </span>
                </div>
              ))}
              <div className="flex items-center justify-between border-t border-border pt-2 text-sm font-semibold">
                <span>Totaal</span>
                <span className="cijfers">
                  {formatteerEuro(cijfers.ouderdom.totaal)}
                </span>
              </div>
              <Button variant="outline" size="sm" className="mt-1 w-full" asChild>
                <Link href="/facturen?status=openstaand">
                  Naar de facturen
                  <ArrowRight />
                </Link>
              </Button>
            </CardContent>
          </Card>

          <Card className="order-1">
            <CardHeader>
              <CardTitle>
                Te doen{" "}
                {aandachtspunten > 0 ? (
                  <Badge variant="waarschuwing">{aandachtspunten}</Badge>
                ) : null}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2.5">
              {aandachtspunten === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Niets bijzonders. De administratie is bij.
                </p>
              ) : null}

              {teLaat.length > 0 ? (
                <Melding toon="waarschuwing">
                  <p>
                    <Link href="/facturen?status=vervallen" className="underline">
                      {teLaat.length}{" "}
                      {teLaat.length === 1 ? "factuur staat" : "facturen staan"}{" "}
                      voorbij de vervaldatum
                    </Link>{" "}
                    — samen {formatteerEuro(
                      teLaat.reduce(
                        (som, factuur) => som + factuur.openstaandCenten,
                        0,
                      ),
                    )}
                    .
                  </p>
                </Melding>
              ) : null}

              {scheveEvenementen.map((evenement) => (
                <Melding key={evenement.id} toon="fout">
                  <p>
                    <Link
                      href={`/evenementen/${evenement.id}`}
                      className="underline"
                    >
                      {evenement.naam}
                    </Link>
                    :{" "}
                    {evenement.afstemming.nogNietVerdeeldCenten !== 0
                      ? `${formatteerEuro(evenement.afstemming.nogNietVerdeeldCenten)} aan kosten is nog niet doorbelast.`
                      : `het verschil is ${formatteerEuro(evenement.afstemming.dekkingsverschilCenten)}.`}
                  </p>
                </Melding>
              ))}

              {cijfers.balans.bankverschilCenten !== null &&
              cijfers.balans.bankverschilCenten !== 0 ? (
                <Melding toon="waarschuwing">
                  <p>
                    Het ingevoerde banksaldo wijkt{" "}
                    {formatteerEuro(
                      Math.abs(cijfers.balans.bankverschilCenten),
                    )}{" "}
                    af van de administratie.{" "}
                    <Link href="/balans" className="underline">
                      Bekijk de balans
                    </Link>
                    .
                  </p>
                </Melding>
              ) : null}

              {cijfers.uitgavenZonderPost > 0 ? (
                <Melding toon="fout">
                  <p>
                    {cijfers.uitgavenZonderPost} uitgaven hebben geen geldige
                    begrotingspost.
                  </p>
                </Melding>
              ) : null}

              {cijfers.conceptFacturen > 0 ? (
                <Melding toon="info">
                  <p>
                    <Link href="/facturen?status=concept" className="underline">
                      {cijfers.conceptFacturen}{" "}
                      {cijfers.conceptFacturen === 1
                        ? "factuur staat"
                        : "facturen staan"}{" "}
                      nog op concept
                    </Link>{" "}
                    en tellen dus nog niet mee.
                  </p>
                </Melding>
              ) : null}
              {!cijfers.laatsteBanksaldo ? <Melding toon="info"><Link href="/bank" className="underline">Voer je banksaldo in</Link> om te controleren of de administratie aansluit.</Melding> : null}
            </CardContent>
          </Card>
          <Card className="order-3">
            <CardHeader><CardTitle>Spullen & voorraad</CardTitle></CardHeader>
            <CardContent>
              <p className="cijfers text-2xl font-semibold">{formatteerEuro(cijfers.voorraad.waardeCenten)}</p>
              <p className="mt-1 text-sm text-muted-foreground">{cijfers.voorraadposten.length} voorraadposten op de balans</p>
              <Button variant="outline" size="sm" className="mt-4 w-full" asChild><Link href="/voorraad"><Package />Voorraad bekijken</Link></Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}

function Balkje({
  naam,
  soort,
  begrootCenten,
  gerealiseerdCenten,
}: {
  naam: string;
  soort: "inkomst" | "uitgave";
  begrootCenten: number;
  gerealiseerdCenten: number;
}) {
  const aandeel =
    begrootCenten === 0
      ? gerealiseerdCenten === 0
        ? 0
        : 1
      : gerealiseerdCenten / begrootCenten;
  const breedte = Math.min(100, Math.max(0, aandeel * 100));

  // Bij uitgaven is boven de begroting uitkomen een probleem; bij inkomsten juist niet.
  const overschreden = soort === "uitgave" && gerealiseerdCenten > begrootCenten;

  return (
    <div>
      <div className="flex items-baseline justify-between gap-3 text-sm">
        <span className="truncate">{naam}</span>
        <span className="cijfers shrink-0 text-muted-foreground">
          {formatteerEuro(gerealiseerdCenten)}
          <span className="text-muted-foreground/70">
            {" "}
            / {formatteerEuro(begrootCenten)}
          </span>
        </span>
      </div>
      <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div
          className={cn(
            "h-full rounded-full",
            overschreden ? "bg-destructive" : "bg-primary",
          )}
          style={{ width: `${breedte}%` }}
        />
      </div>
    </div>
  );
}
