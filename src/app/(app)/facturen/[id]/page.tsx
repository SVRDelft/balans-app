import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Copy, Download, Pencil } from "lucide-react";

import { BevestigKnop } from "@/components/bevestigknop";
import { Paginakop } from "@/components/paginakop";
import { Badge, FactuurStatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
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
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { vereisBoekjaarContext } from "@/lib/boekjaar";
import { db } from "@/lib/db";
import {
  dagenTussen,
  datumNaarInvoer,
  formatteerDatum,
  formatteerTijdstempel,
  vandaag,
} from "@/lib/datum";

import { betaaldBedrag, maakHerinneringstekst } from "@/lib/facturen";
import { isTeveelBetaald } from "@/lib/finance/factuurstatus";
import { factuurOpenstaand } from "@/lib/finance/factuurstanden";
import { factuurStandRelaties } from "@/lib/factuur-includes";
import { dagenTeLaat } from "@/lib/finance/vervaldatum";
import { centenNaarInvoer, formatteerEuro } from "@/lib/geld";
import { haalSessie } from "@/lib/auth/server";

import { verwijderBetaling } from "../acties";
import { BetalingFormulier } from "./betalingformulier";
import {
  CreditKnop,
  HerinneringKnop,
  HerstelKnop,
  OninbaarKnop,
  VerstuurKnop,
  VerwijderConceptKnop,
} from "./acties-knoppen";

export const metadata: Metadata = { title: "Factuur" };

export default async function FactuurPagina({
  params,
}: PageProps<"/facturen/[id]">) {
  const { boekjaar, schrijfbaar } = await vereisBoekjaarContext();
  const { id } = await params;

  const factuur = await db.factuur.findUnique({
    where: { id, boekjaarId: boekjaar.id },
    include: {
      relatie: true,
      regels: {
        orderBy: { volgorde: "asc" },
        include: { begrotingspost: { select: { code: true, naam: true } } },
      },
      betalingen: { orderBy: { datum: "asc" } },
      evenement: { select: { id: true, naam: true } },
      ...factuurStandRelaties,
    },
  });
  if (!factuur) notFound();

  const [instellingen, sessie] = await Promise.all([
    db.instellingen.findUnique({ where: { id: "svr" } }),
    haalSessie(),
  ]);

  const betaald = betaaldBedrag(factuur.betalingen);
  const openstaand = factuurOpenstaand(factuur);
  const teveel = isTeveelBetaald(factuur.totaalCenten, betaald);
  const isConcept = factuur.status === "concept";
  const isOpenstaand = openstaand > 0;
  const dagenOpen = dagenTeLaat(factuur.vervaldatum, vandaag(), openstaand);

  const herinneringstekst = maakHerinneringstekst({
    relatieNaam: factuur.relatie.naam,
    contactpersoon: factuur.relatie.contactpersoon,
    nummer: factuur.nummer,
    factuurdatum: formatteerDatum(factuur.factuurdatum),
    vervaldatum: formatteerDatum(factuur.vervaldatum),
    openstaandBedrag: formatteerEuro(openstaand),
    omschrijving: factuur.omschrijving,
    organisatieNaam:
      instellingen?.organisatieNaam ?? "StudieVerenigingenRaad Delft",
    iban: instellingen?.iban ?? "",
    afzender: sessie?.naam ?? "",
    dagenOver: dagenTussen(factuur.vervaldatum, vandaag()),
  });

  return (
    <>
      <Paginakop
        titel={`Factuur ${factuur.nummer}`}
        beschrijving={
          <span className="flex flex-wrap items-center gap-2">
            <FactuurStatusBadge status={factuur.status} />
            {factuur.soort === "credit" ? (
              <Badge variant="omlijnd">Creditfactuur</Badge>
            ) : null}
            <span>
              {factuur.relatie.naam} · {formatteerDatum(factuur.factuurdatum)}
            </span>
          </span>
        }
        acties={
          <>
            <Button variant="outline" asChild>
              <a href={`/api/facturen/${factuur.id}/pdf`} target="_blank">
                <Download />
                PDF
              </a>
            </Button>
            {schrijfbaar && factuur.soort !== "credit" ? (
              <Button variant="outline" asChild>
                <Link href={`/facturen/nieuw?van=${factuur.id}`}>
                  <Copy />
                  Kopiëren
                </Link>
              </Button>
            ) : null}
            {isConcept && schrijfbaar ? (
              <Button variant="outline" asChild>
                <Link href={`/facturen/${factuur.id}/bewerken`}>
                  <Pencil />
                  Bewerken
                </Link>
              </Button>
            ) : null}
          </>
        }
      />

      {factuur.crediteertFactuur ? (
        <Melding toon="info" className="mb-4">
          Deze creditfactuur corrigeert{" "}
          <Link
            href={`/facturen/${factuur.crediteertFactuur.id}`}
            className="underline"
          >
            {factuur.crediteertFactuur.nummer}
          </Link>
          .
        </Melding>
      ) : null}

      {factuur.creditfactuur ? (
        <Melding toon="waarschuwing" className="mb-4">
          Bij deze factuur hoort creditfactuur{" "}
          <Link
            href={`/facturen/${factuur.creditfactuur.id}`}
            className="underline"
          >
            {factuur.creditfactuur.nummer}
          </Link>
          .
        </Melding>
      ) : null}

      {teveel ? (
        <Melding toon="waarschuwing" className="mb-4" titel="Te veel ontvangen">
          Er is {formatteerEuro(Math.abs(betaald - factuur.totaalCenten))} meer
          binnengekomen dan gefactureerd.
        </Melding>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>{factuur.omschrijving}</CardTitle>
              <CardDescription>
                Vervaldatum {formatteerDatum(factuur.vervaldatum)}
                {isOpenstaand && dagenOpen > 0 ? (
                  <span className="text-destructive">
                    {" "}
                    · {dagenOpen} dagen te laat
                  </span>
                ) : null}
                {factuur.evenement ? (
                  <>
                    {" · "}
                    <Link
                      href={`/evenementen/${factuur.evenement.id}`}
                      className="underline"
                    >
                      {factuur.evenement.naam}
                    </Link>
                  </>
                ) : null}
              </CardDescription>
            </CardHeader>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Omschrijving</TableHead>
                  <TableHead>Begrotingspost</TableHead>
                  <TableHead className="text-right">Aantal</TableHead>
                  <TableHead className="text-right">Per stuk</TableHead>
                  <TableHead className="text-right">Bedrag</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {factuur.regels.map((regel) => (
                  <TableRow key={regel.id}>
                    <TableCell>{regel.omschrijving}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      <span className="font-mono">
                        {regel.begrotingspost.code}
                      </span>{" "}
                      {regel.begrotingspost.naam}
                    </TableCell>
                    <TableCell className="cijfers text-right">
                      {regel.aantal}
                    </TableCell>
                    <TableCell className="text-right">
                      <Bedrag centen={regel.prijsPerStukCenten} />
                    </TableCell>
                    <TableCell className="text-right">
                      <Bedrag centen={regel.bedragCenten} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
              <TableFooter>
                <TableRow>
                  <TableCell colSpan={4}>Totaal</TableCell>
                  <TableCell className="text-right">
                    <Bedrag centen={factuur.totaalCenten} />
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell colSpan={4}>Ontvangen</TableCell>
                  <TableCell className="text-right">
                    <Bedrag centen={betaald} />
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell colSpan={4} className="font-semibold">
                    Openstaand
                  </TableCell>
                  <TableCell className="text-right font-semibold">
                    <Bedrag centen={openstaand} />
                  </TableCell>
                </TableRow>
              </TableFooter>
            </Table>
            {factuur.notities ? (
              <CardContent className="pt-3">
                <p className="text-xs font-medium text-muted-foreground">
                  Notities
                </p>
                <p className="text-sm whitespace-pre-wrap">
                  {factuur.notities}
                </p>
              </CardContent>
            ) : null}
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Betalingen</CardTitle>
              <CardDescription>
                Het bestuur voert betalingen handmatig in vanuit de bankapp.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {factuur.betalingen.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Nog geen betalingen geregistreerd.
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Datum</TableHead>
                      <TableHead>Notitie</TableHead>
                      <TableHead className="text-right">Bedrag</TableHead>
                      <TableHead />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {factuur.betalingen.map((betaling) => (
                      <TableRow key={betaling.id}>
                        <TableCell className="cijfers whitespace-nowrap">
                          {formatteerDatum(betaling.datum)}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {betaling.notitie ?? "—"}
                          {betaling.geregistreerdDoor ? (
                            <span className="block text-xs">
                              ingevoerd door {betaling.geregistreerdDoor}
                            </span>
                          ) : null}
                        </TableCell>
                        <TableCell className="text-right">
                          <Bedrag centen={betaling.bedragCenten} />
                        </TableCell>
                        <TableCell className="text-right">
                          {schrijfbaar ? (
                            <BevestigKnop
                              actie={verwijderBetaling}
                              velden={{ id: betaling.id }}
                              vraag="Deze betaling verwijderen? De status van de factuur wordt opnieuw berekend."
                              variant="ghost"
                              size="sm"
                            >
                              Verwijderen
                            </BevestigKnop>
                          ) : null}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}

              {schrijfbaar &&
              !isConcept &&
              (factuur.status !== "gecrediteerd" || openstaand > 0) ? (
                <div className="border-t border-border pt-4">
                  <BetalingFormulier
                    factuurId={factuur.id}
                    vandaag={datumNaarInvoer(vandaag())}
                    openstaandInvoer={
                      openstaand === 0 ? "" : centenNaarInvoer(openstaand)
                    }
                  />
                </div>
              ) : null}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Gefactureerd aan</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1 text-sm">
              <p className="font-medium">
                <Link
                  href={`/relaties/${factuur.relatie.id}`}
                  className="hover:underline"
                >
                  {factuur.relatie.naam}
                </Link>
              </p>
              {factuur.relatie.contactpersoon ? (
                <p>{factuur.relatie.contactpersoon}</p>
              ) : null}
              {factuur.relatie.adres ? <p>{factuur.relatie.adres}</p> : null}
              {factuur.relatie.postcode || factuur.relatie.plaats ? (
                <p>
                  {factuur.relatie.postcode} {factuur.relatie.plaats}
                </p>
              ) : null}
              {factuur.relatie.email ? (
                <p className="text-muted-foreground">{factuur.relatie.email}</p>
              ) : null}
            </CardContent>
          </Card>

          {schrijfbaar ? (
            <Card>
              <CardHeader>
                <CardTitle>Acties</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {isConcept ? (
                  <>
                    <VerstuurKnop id={factuur.id} />
                    <VerwijderConceptKnop
                      id={factuur.id}
                      nummer={factuur.nummer}
                    />
                  </>
                ) : null}

                {isOpenstaand && !factuur.crediteertFactuurId ? (
                  <>
                    <OninbaarKnop id={factuur.id} nummer={factuur.nummer} />
                    {!factuur.creditfactuur ? (
                      <CreditKnop id={factuur.id} nummer={factuur.nummer} />
                    ) : null}
                  </>
                ) : null}

                {factuur.status === "oninbaar" ? (
                  <HerstelKnop id={factuur.id} nummer={factuur.nummer} />
                ) : null}

                {factuur.status === "betaald" &&
                factuur.soort !== "credit" &&
                !factuur.creditfactuur ? (
                  <CreditKnop id={factuur.id} nummer={factuur.nummer} />
                ) : null}
              </CardContent>
            </Card>
          ) : null}

          {isOpenstaand ? (
            <Card>
              <CardHeader>
                <CardTitle>Herinnering</CardTitle>
                <CardDescription>
                  De tekst komt op je klembord; je verstuurt zelf.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <HerinneringKnop tekst={herinneringstekst} />
              </CardContent>
            </Card>
          ) : null}

          <Card>
            <CardHeader>
              <CardTitle>Historie</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1 text-xs text-muted-foreground">
              <p>Aangemaakt {formatteerTijdstempel(factuur.aangemaaktOp)}</p>
              {factuur.verstuurdOp ? (
                <p>Verstuurd {formatteerTijdstempel(factuur.verstuurdOp)}</p>
              ) : null}
              <p>Bijgewerkt {formatteerTijdstempel(factuur.bijgewerktOp)}</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
