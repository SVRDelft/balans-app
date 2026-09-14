import type { Metadata } from "next";
import Link from "next/link";
import { FileSpreadsheet, FileText } from "lucide-react";

import { Kerngetal, Paginakop } from "@/components/paginakop";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Melding } from "@/components/ui/melding";
import { vereisBoekjaarContext } from "@/lib/boekjaar";
import { formatteerDatum } from "@/lib/datum";
import { formatteerEuro } from "@/lib/geld";
import { haalBoekjaarCijfers } from "@/lib/rapportage";

export const metadata: Metadata = { title: "Overdracht" };

export default async function OverdrachtPagina() {
  const { boekjaar } = await vereisBoekjaarContext();
  const cijfers = await haalBoekjaarCijfers(boekjaar.id);

  const scheveEvenementen = cijfers.evenementen.filter(
    (evenement) => !evenement.afstemming.klopt,
  );
  const bankVerschil = cijfers.balans.bankverschilCenten;

  const punten: string[] = [];
  if (cijfers.conceptFacturen > 0) {
    punten.push(
      `${cijfers.conceptFacturen} ${cijfers.conceptFacturen === 1 ? "factuur staat" : "facturen staan"} nog op concept en tellen niet mee in de cijfers.`,
    );
  }
  if (cijfers.openstaandeFacturen.length > 0) {
    punten.push(
      `${cijfers.openstaandeFacturen.length} facturen staan nog open, samen ${formatteerEuro(cijfers.ouderdom.totaal)}.`,
    );
  }
  if (cijfers.openstaandeUitgaven.length > 0) {
    punten.push(
      `${cijfers.openstaandeUitgaven.length} uitgaven zijn nog niet betaald, samen ${formatteerEuro(cijfers.balans.crediteurenCenten)}.`,
    );
  }
  for (const evenement of scheveEvenementen) {
    punten.push(
      `Bij ${evenement.naam} is het verschil ${formatteerEuro(evenement.afstemming.resultaatCenten)}; op een omslagpost hoort dat nul te zijn.`,
    );
  }
  if (bankVerschil === null) {
    punten.push(
      "Er is nog geen banksaldo ingevoerd, dus de belangrijkste controle kan niet gedaan worden.",
    );
  } else if (bankVerschil !== 0) {
    punten.push(
      `Het ingevoerde banksaldo wijkt ${formatteerEuro(bankVerschil)} af van de administratie.`,
    );
  }

  return (
    <>
      <Paginakop
        titel="Overdracht"
        beschrijving={`Alles van ${boekjaar.naam} in één bestand, voor de kascommissie en het volgende bestuur.`}
      />

      <div className="mb-6 grid gap-3 sm:grid-cols-4">
        <Kerngetal
          label="Resultaat"
          waarde={formatteerEuro(cijfers.balans.resultaatCenten)}
          toon={cijfers.balans.resultaatCenten < 0 ? "fout" : "goed"}
        />
        <Kerngetal
          label="Banksaldo administratie"
          waarde={formatteerEuro(cijfers.balans.administratiefBanksaldoCenten)}
        />
        <Kerngetal
          label="Openstaande debiteuren"
          waarde={formatteerEuro(cijfers.balans.debiteurenCenten)}
        />
        <Kerngetal
          label="Openstaande crediteuren"
          waarde={formatteerEuro(cijfers.balans.crediteurenCenten)}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Downloaden</CardTitle>
            <CardDescription>
              Beide bestanden bevatten de exploitatie, de balans, het
              debiteurenoverzicht, de spullen met aantallen en waarde en de
              afstemming per evenement. Het Excel-bestand bevat daarnaast alle
              facturen en alle uitgaven.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Button asChild>
              <a href="/api/export/excel">
                <FileSpreadsheet />
                Excel downloaden
              </a>
            </Button>
            <Button variant="outline" asChild>
              <a href="/api/export/pdf">
                <FileText />
                PDF downloaden
              </a>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Controleer dit eerst</CardTitle>
            <CardDescription>
              Punten die een kascommissie waarschijnlijk zal opmerken.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {punten.length === 0 ? (
              <Melding toon="goed">
                Er zijn geen openstaande punten. De administratie is rond.
              </Melding>
            ) : (
              punten.map((punt, index) => (
                <Melding key={index} toon="waarschuwing">
                  {punt}
                </Melding>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Wat het volgende bestuur moet weten</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>
            De administratie loopt van {formatteerDatum(boekjaar.startDatum)}{" "}
            tot {formatteerDatum(boekjaar.eindDatum)}. Factuurnummers beginnen
            met <span className="font-mono">{boekjaar.factuurPrefix}</span> en
            lopen door; verwijderde concepten laten een gat achter en hun nummer
            wordt nooit opnieuw uitgegeven.
          </p>
          <p>
            Maak voor het volgende bestuursjaar een nieuw boekjaar aan bij{" "}
            <Link href="/boekjaren" className="underline">
              Beheer › Boekjaren
            </Link>
            , zet het beginsaldo van de bank en het eigen vermogen op de
            eindstand van dit jaar, en activeer het pas als je erin gaat werken.
            Neem vervolgens bij Spullen & voorraad de eindvoorraad over als
            beginvoorraad. Dit jaar blijft daarna gewoon te bekijken.
          </p>
          <p>
            De bonnetjes en het gekozen logo zitten in de Postgres-database. Een
            volledige databaseback-up bevat ook deze bijlagen.
          </p>
        </CardContent>
      </Card>
    </>
  );
}
