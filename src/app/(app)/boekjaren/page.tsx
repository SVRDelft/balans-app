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
import { db } from "@/lib/db";
import { datumNaarInvoer, formatteerDatum } from "@/lib/datum";
import { centenNaarInvoer } from "@/lib/geld";
import { haalBoekjaarContext } from "@/lib/boekjaar";

import { activeerBoekjaar } from "./acties";
import { BoekjaarFormulier } from "./formulier";

export const metadata: Metadata = { title: "Boekjaren" };

export default async function BoekjarenPagina() {
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
        beschrijving="Er is altijd precies één actief boekjaar. In de andere kan wel gekeken worden, maar niet geschreven."
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
                    <BevestigKnop
                      actie={activeerBoekjaar}
                      velden={{ id: boekjaar.id }}
                      vraag={`${boekjaar.naam} het actieve boekjaar maken? Het huidige actieve boekjaar wordt daarmee alleen-lezen.`}
                      variant="outline"
                      size="sm"
                    >
                      Activeren
                    </BevestigKnop>
                  ) : null}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      {huidig ? (
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
              waarden={{
                id: huidig.id,
                naam: huidig.naam,
                factuurPrefix: huidig.factuurPrefix,
                startDatum: datumNaarInvoer(huidig.startDatum),
                eindDatum: datumNaarInvoer(huidig.eindDatum),
                beginsaldoBank: centenNaarInvoer(huidig.beginsaldoBankCenten),
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

      <Card>
        <CardHeader>
          <CardTitle>Nieuw boekjaar aanmaken</CardTitle>
          <CardDescription>
            Voor het volgende bestuur. Relaties blijven bestaan; begrotingsposten
            maak je opnieuw aan voor het nieuwe jaar.
          </CardDescription>
        </CardHeader>
        <div className="px-5 pb-5">
          <Melding toon="info" className="mb-4">
            Het nieuwe boekjaar wordt niet meteen actief. Activeer het pas als je
            er echt in gaat werken.
          </Melding>
          <BoekjaarFormulier
            waarden={{
              naam: "",
              factuurPrefix: "",
              startDatum: "",
              eindDatum: "",
              beginsaldoBank: "",
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
