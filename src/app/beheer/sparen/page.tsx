import type { Metadata } from "next";
import Link from "next/link";

import { BevestigKnop } from "@/components/bevestigknop";
import { Kerngetal, Paginakop } from "@/components/paginakop";
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
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { vereisBoekjaarContext } from "@/lib/boekjaar";
import { datumNaarInvoer, formatteerDatum, vandaag } from "@/lib/datum";
import { db } from "@/lib/db";
import { SPAAR_SOORT_LABEL, label, type SpaarSoort } from "@/lib/domein";
import { formatteerEuro } from "@/lib/geld";
import { haalBoekjaarCijfers } from "@/lib/rapportage";

import { BanksaldoFormulier } from "../bank/formulier";
import { verwijderBanksaldo } from "../bank/acties";
import { verwijderSpaarmutatie } from "./acties";
import { SpaarmutatieFormulier } from "./formulier";

export const metadata: Metadata = { title: "Spaarrekening" };

/**
 * De spaarrekening staat naast de betaalrekening op de balans.
 *
 * Geld dat je opzij zet is geen uitgave — het is nog steeds van de SVR — dus het
 * verdwijnt niet uit de cijfers maar verhuist naar deze rekening. Rente komt hier
 * rechtstreeks binnen en staat dus nooit op het afschrift van de betaalrekening;
 * daarom kun je die hier invoeren.
 */
export default async function SparenPagina() {
  const { boekjaar, schrijfbaar } = await vereisBoekjaarContext();
  const [cijfers, saldi, posten] = await Promise.all([
    haalBoekjaarCijfers(boekjaar.id),
    db.banksaldo.findMany({
      where: { boekjaarId: boekjaar.id, rekening: "spaar" },
      orderBy: [{ datum: "desc" }, { ingevoerdOp: "desc" }],
    }),
    db.begrotingspost.findMany({
      where: { boekjaarId: boekjaar.id },
      orderBy: { code: "asc" },
      select: { id: true, code: true, naam: true, soort: true },
    }),
  ]);

  const { balans, spaarmutaties } = cijfers;
  const verschil = balans.spaarverschilCenten;
  const renteCenten = spaarmutaties
    .filter((mutatie) => mutatie.soort === "rente")
    .reduce((som, mutatie) => som + mutatie.bedragCenten, 0);

  return (
    <>
      <Paginakop
        titel="Spaarrekening"
        beschrijving={`Wat er opzij staat in ${boekjaar.naam}. Overboeken tussen je eigen rekeningen is geen uitgave; rente is dat wel een opbrengst.`}
      />

      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        <Kerngetal
          label="Spaarsaldo volgens de administratie"
          waarde={formatteerEuro(balans.spaarsaldoCenten)}
          toelichting={`beginsaldo ${formatteerEuro(boekjaar.beginsaldoSpaarCenten)} plus de mutaties van dit jaar`}
        />
        <Kerngetal
          label="Laatst ingevoerd saldo"
          waarde={
            cijfers.laatsteSpaarsaldo
              ? formatteerEuro(cijfers.laatsteSpaarsaldo.saldoCenten)
              : "—"
          }
          toelichting={
            cijfers.laatsteSpaarsaldo
              ? `Stand per ${formatteerDatum(cijfers.laatsteSpaarsaldo.datum)}`
              : "Nog niet ingevoerd"
          }
        />
        <Kerngetal
          label="Rente dit boekjaar"
          waarde={formatteerEuro(renteCenten)}
          toon={renteCenten > 0 ? "goed" : undefined}
          toelichting="Telt mee als opbrengst in de exploitatie"
        />
      </div>

      {verschil !== null && verschil !== 0 ? (
        <Melding
          toon="waarschuwing"
          className="mb-6"
          titel="Het ingevoerde spaarsaldo wijkt af van de administratie"
        >
          <p>
            Verschil: {formatteerEuro(verschil)}. Meestal is er rente
            bijgeschreven die nog niet is ingevoerd, of een overboeking die nog
            niet geboekt is.
          </p>
        </Melding>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Mutatie vastleggen</CardTitle>
            <CardDescription>
              Een overboeking van of naar de betaalrekening kun je ook vanuit de{" "}
              <Link href="/beheer/bank/importeren" className="underline">
                bankimport
              </Link>{" "}
              boeken; die regel staat immers op je afschrift.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {schrijfbaar ? (
              <SpaarmutatieFormulier
                posten={posten}
                vandaag={datumNaarInvoer(vandaag())}
              />
            ) : (
              <Melding toon="info">
                {boekjaar.naam} is niet het actieve boekjaar, dus hier kan niets
                bij.
              </Melding>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Werkelijk saldo invoeren</CardTitle>
            <CardDescription>
              Het saldo zoals het in je bankapp staat. Het verschil met de
              administratie is het signaal dat er iets mist.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {schrijfbaar ? (
              <BanksaldoFormulier
                rekening="spaar"
                vandaag={datumNaarInvoer(vandaag())}
              />
            ) : null}

            {saldi.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Nog geen spaarsaldo ingevoerd.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Datum</TableHead>
                    <TableHead className="text-right">Saldo</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {saldi.map((saldo) => (
                    <TableRow key={saldo.id}>
                      <TableCell className="cijfers whitespace-nowrap">
                        {formatteerDatum(saldo.datum)}
                        {saldo.notitie ? (
                          <span className="block text-xs text-muted-foreground">
                            {saldo.notitie}
                          </span>
                        ) : null}
                      </TableCell>
                      <TableCell className="text-right">
                        <Bedrag centen={saldo.saldoCenten} />
                      </TableCell>
                      <TableCell className="text-right">
                        {schrijfbaar ? (
                          <BevestigKnop
                            actie={verwijderBanksaldo}
                            velden={{ id: saldo.id }}
                            vraag="Dit ingevoerde spaarsaldo verwijderen?"
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
          </CardContent>
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Mutaties in {boekjaar.naam}</CardTitle>
          <CardDescription>
            Positief is erbij op de spaarrekening, negatief is eraf.
          </CardDescription>
        </CardHeader>
        <CardContent className="px-0">
          {spaarmutaties.length === 0 ? (
            <p className="px-6 text-sm text-muted-foreground">
              Nog geen mutaties in dit boekjaar.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Datum</TableHead>
                  <TableHead>Wat</TableHead>
                  <TableHead>Soort</TableHead>
                  <TableHead className="text-right">Bedrag</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {spaarmutaties.map((mutatie) => (
                  <TableRow key={mutatie.id}>
                    <TableCell className="cijfers whitespace-nowrap">
                      {formatteerDatum(mutatie.datum)}
                    </TableCell>
                    <TableCell>
                      {mutatie.omschrijving}
                      {mutatie.uitBankimport ? (
                        <span className="block text-xs text-muted-foreground">
                          uit de bankimport
                        </span>
                      ) : null}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {label(SPAAR_SOORT_LABEL, mutatie.soort as SpaarSoort)}
                      {mutatie.begrotingspost ? (
                        <span className="block text-xs">
                          {mutatie.begrotingspost.code}{" "}
                          {mutatie.begrotingspost.naam}
                        </span>
                      ) : null}
                    </TableCell>
                    <TableCell className="text-right">
                      <Bedrag centen={mutatie.bedragCenten} />
                    </TableCell>
                    <TableCell className="text-right">
                      {schrijfbaar && !mutatie.uitBankimport ? (
                        <BevestigKnop
                          actie={verwijderSpaarmutatie}
                          velden={{ id: mutatie.id }}
                          vraag="Deze mutatie op de spaarrekening verwijderen?"
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
        </CardContent>
      </Card>

      <p className="mt-4 text-sm text-muted-foreground">
        Het beginsaldo van de spaarrekening stel je in bij{" "}
        <Link href="/beheer/boekjaren" className="underline">
          Boekjaren
        </Link>
        . Op de{" "}
        <Link href="/beheer/balans" className="underline">
          balans
        </Link>{" "}
        staat de spaarrekening als apart bezit.
      </p>
    </>
  );
}
