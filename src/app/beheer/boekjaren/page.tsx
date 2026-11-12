import type { Metadata } from "next";

import { BevestigKnop } from "@/components/bevestigknop";
import { Paginakop } from "@/components/paginakop";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Melding } from "@/components/ui/melding";
import {
  Bedrag,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { vereisBestuur } from "@/lib/auth/server";
import { db } from "@/lib/db";
import { datumNaarInvoer, formatteerDatum } from "@/lib/datum";
import { centenNaarInvoer } from "@/lib/geld";
import { haalBoekjaarContext } from "@/lib/boekjaar";

import { activeerBoekjaar, zetReconstructie } from "./acties";
import { BoekjaarFormulier } from "./formulier";
import { WisFormulier } from "./wisformulier";

export const metadata: Metadata = { title: "Boekjaren" };

export default async function BoekjarenPagina() {
  await vereisBestuur();
  const context = await haalBoekjaarContext();

  const boekjaren = await db.boekjaar.findMany({
    orderBy: { startDatum: "desc" },
    include: {
      _count: { select: { facturen: true, uitgaven: true, evenementen: true } },
    },
  });

  const huidig = context?.boekjaar ?? null;

  return (
    <>
      <Paginakop
        titel="Boekjaren"
        beschrijving="Er is altijd precies één actief boekjaar. In de andere kan wel gekeken worden, maar niet geschreven — tenzij je een oud jaar bewust openzet om het op te bouwen."
      />

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Bestaande boekjaren</CardTitle>
        </CardHeader>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Naam</TableHead>
              <TableHead>Periode</TableHead>
              <TableHead>Voorvoegsel</TableHead>
              <TableHead className="text-right">Inhoud</TableHead>
              <TableHead className="text-right">Beginsaldo bank</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {boekjaren.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-muted-foreground">
                  Nog geen boekjaren.
                </TableCell>
              </TableRow>
            ) : null}
            {boekjaren.map((boekjaar) => (
              <TableRow key={boekjaar.id}>
                <TableCell>
                  <span className="font-medium">{boekjaar.naam}</span>
                  {boekjaar.actief ? (
                    <Badge variant="goed" className="ml-2">
                      Actief
                    </Badge>
                  ) : null}
                  {boekjaar.reconstructie ? (
                    <Badge variant="waarschuwing" className="ml-2">
                      In reconstructie
                    </Badge>
                  ) : null}
                </TableCell>
                <TableCell className="cijfers whitespace-nowrap text-muted-foreground">
                  {formatteerDatum(boekjaar.startDatum)} —{" "}
                  {formatteerDatum(boekjaar.eindDatum)}
                </TableCell>
                <TableCell className="font-mono text-xs">
                  {boekjaar.factuurPrefix}
                </TableCell>
                <TableCell className="text-right text-xs text-muted-foreground">
                  {boekjaar._count.facturen} facturen ·{" "}
                  {boekjaar._count.uitgaven} uitgaven ·{" "}
                  {boekjaar._count.evenementen} evenementen
                </TableCell>
                <TableCell className="text-right">
                  <Bedrag centen={boekjaar.beginsaldoBankCenten} />
                </TableCell>
                <TableCell className="text-right">
                  {!boekjaar.actief ? (
                    <div className="flex flex-wrap justify-end gap-2">
                      <BevestigKnop
                        actie={activeerBoekjaar}
                        velden={{ id: boekjaar.id }}
                        vraag={`${boekjaar.naam} het actieve boekjaar maken? Het huidige actieve boekjaar wordt daarmee alleen-lezen.`}
                        variant="outline"
                        size="sm"
                      >
                        Activeren
                      </BevestigKnop>
                      <BevestigKnop
                        actie={zetReconstructie}
                        velden={{ id: boekjaar.id, aan: boekjaar.reconstructie ? "nee" : "ja" }}
                        vraag={
                          boekjaar.reconstructie
                            ? `${boekjaar.naam} weer op alleen-lezen zetten?`
                            : `${boekjaar.naam} openzetten om op te bouwen? Zolang dat aanstaat kun je in dit afgesloten jaar boeken, en dat staat in het auditlog.`
                        }
                        variant="ghost"
                        size="sm"
                      >
                        {boekjaar.reconstructie ? "Sluiten" : "Opbouwen"}
                      </BevestigKnop>
                    </div>
                  ) : null}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      {huidig && context?.schrijfbaar ? (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>{huidig.naam} bewerken</CardTitle>
            <CardDescription>
              Het beginsaldo van de bank en het eigen vermogen bepalen de balans
              van dit jaar. Vul ze in bij de start van het bestuursjaar.
            </CardDescription>
          </CardHeader>
          <div className="px-5 pb-5">
            <BoekjaarFormulier
              key={huidig.id}
              waarden={{
                id: huidig.id,
                naam: huidig.naam,
                factuurPrefix: huidig.factuurPrefix,
                startDatum: datumNaarInvoer(huidig.startDatum),
                eindDatum: datumNaarInvoer(huidig.eindDatum),
                beginsaldoBank: centenNaarInvoer(huidig.beginsaldoBankCenten),
                beginsaldoSpaar: centenNaarInvoer(huidig.beginsaldoSpaarCenten),
                beginsaldoEigenVermogen: centenNaarInvoer(
                  huidig.beginsaldoEigenVermogenCenten,
                ),
                notities: huidig.notities ?? "",
              }}
              knoptekst="Wijzigingen opslaan"
            />
          </div>
        </Card>
      ) : null}

      {huidig && context?.schrijfbaar ? (
        <Card className="mb-6 border-destructive/40">
          <CardHeader>
            <CardTitle>Opnieuw beginnen met testen</CardTitle>
            <CardDescription>
              Wist alle facturen, betalingen, uitgaven, bonnetjes, banksaldi,
              bankimports, deelnemers en omslagrondes van {huidig.naam}.
              Evenementen gaan terug naar open en de spullen naar hun
              beginstand. De begroting, evenementen, relaties en instellingen
              blijven staan.
            </CardDescription>
          </CardHeader>
          <div className="px-5 pb-5">
            <Melding toon="waarschuwing" className="mb-4">
              Gebruik dit alleen zolang je aan het testen bent. Zodra de echte
              administratie begint, wis je hiermee echte boekingen.
            </Melding>
            <WisFormulier naam={huidig.naam} />
          </div>
        </Card>
      ) : null}

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Een oud boekjaar opbouwen</CardTitle>
          <CardDescription>
            Begin je net met de app en staat vorig jaar nog nergens in? Dan hoef je
            het niet met de hand na te typen.
          </CardDescription>
        </CardHeader>
        <div className="px-5 pb-5">
          <ol className="list-decimal space-y-2 pl-5 text-sm text-muted-foreground">
            <li>
              Maak dat oude boekjaar aan met de juiste begin- en einddatum en het
              beginsaldo van de bank op de eerste dag.
            </li>
            <li>
              Zet het met <strong>Opbouwen</strong> open. Je kijkt er dan naar en
              mag erin boeken; het echte actieve jaar blijft ongemoeid.
            </li>
            <li>
              Neem de begroting over van een ander jaar, of maak een paar posten
              aan — elke factuur en uitgave heeft er één nodig.
            </li>
            <li>
              Download bij de bank het MT940-afschrift van dat jaar en lees het in
              bij <strong>Bankimport</strong>. Kies daar{" "}
              <strong>Alles in één keer boeken</strong>: van elke bijschrijving
              maakt de app een factuur die al op betaald staat, van elke
              afschrijving een betaalde uitgave.
            </li>
            <li>
              Facturen die nooit betaald zijn, voer je er met de hand bij; die staan
              niet op het afschrift. Daarna sluit je het jaar weer met{" "}
              <strong>Sluiten</strong>.
            </li>
          </ol>
          <Melding toon="info" className="mt-4">
            Komt er daarna nog geld binnen van een factuur uit dat oude jaar? Boek
            dat gewoon in het huidige jaar: bij de bankimport staan openstaande
            facturen van eerdere jaren er automatisch tussen.
          </Melding>
        </div>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Nieuw boekjaar aanmaken</CardTitle>
          <CardDescription>
            Relaties blijven bestaan. Je kunt de begroting van een bestaand boekjaar overnemen.
          </CardDescription>
        </CardHeader>
        <div className="px-5 pb-5">
          <Melding toon="info" className="mb-4">
            {boekjaren.length === 0 ? "Maak je eerste boekjaar aan om te beginnen. Dit wordt meteen het actieve boekjaar." : "Het nieuwe boekjaar wordt niet meteen actief. Activeer het pas als je er echt in gaat werken."}
          </Melding>
          <BoekjaarFormulier
            boekjaren={boekjaren.map(({ id, naam }) => ({ id, naam }))}
            waarden={{
              naam: "",
              factuurPrefix: "",
              startDatum: "",
              eindDatum: "",
              beginsaldoBank: "",
              beginsaldoSpaar: "",
              beginsaldoEigenVermogen: "",
              notities: "",
            }}
            knoptekst="Boekjaar aanmaken"
          />
        </div>
      </Card>
    </>
  );
}
