import Link from "next/link";
import { ArrowRight } from "lucide-react";

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
import { vandaag, formatteerDatum, dagenTussen } from "@/lib/datum";
import { formatteerEuro } from "@/lib/geld";
import { vereisBoekjaarContext } from "@/lib/boekjaar";
import { haalBoekjaarCijfers } from "@/lib/rapportage";
import { OUDERDOM_LABEL } from "@/lib/finance/debiteuren";
import { cn } from "@/lib/utils";

export default async function DashboardPagina() {
  const { boekjaar } = await vereisBoekjaarContext();
  const cijfers = await haalBoekjaarCijfers(boekjaar.id);

  const peildatum = vandaag();
  const teLaat = cijfers.openstaandeFacturen.filter(
    (factuur) => dagenTussen(factuur.factuurdatum, peildatum) > 30,
  );
  const scheveEvenementen = cijfers.evenementen.filter(
    (evenement) => !evenement.afstemming.klopt,
  );

  const aandachtspunten =
    teLaat.length +
    scheveEvenementen.length +
    cijfers.uitgavenZonderPost +
    (cijfers.balans.bankverschilCenten !== null &&
    cijfers.balans.bankverschilCenten !== 0
      ? 1
      : 0);

  return (
    <>
      <Paginakop
        titel="Dashboard"
        beschrijving={`${boekjaar.naam} — stand van zaken op ${formatteerDatum(peildatum)}.`}
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
          toelichting="Gerealiseerde inkomsten min uitgaven"
        />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
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
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
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

          <Card>
            <CardHeader>
              <CardTitle>
                Aandachtspunten{" "}
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
                    <Link href="/facturen?status=openstaand" className="underline">
                      {teLaat.length}{" "}
                      {teLaat.length === 1 ? "factuur staat" : "facturen staan"}{" "}
                      langer dan 30 dagen open
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
