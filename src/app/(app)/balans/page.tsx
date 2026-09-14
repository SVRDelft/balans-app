import type { Metadata } from "next";
import Link from "next/link";

import { Paginakop } from "@/components/paginakop";
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
  TableFooter,
  TableRow,
} from "@/components/ui/table";
import { vereisBoekjaarContext } from "@/lib/boekjaar";
import { formatteerDatum } from "@/lib/datum";
import { formatteerEuro } from "@/lib/geld";
import { haalBoekjaarCijfers } from "@/lib/rapportage";

export const metadata: Metadata = { title: "Balans" };

export default async function BalansPagina() {
  const { boekjaar } = await vereisBoekjaarContext();
  const cijfers = await haalBoekjaarCijfers(boekjaar.id);
  const { balans } = cijfers;

  return (
    <>
      <Paginakop
        titel="Balans"
        beschrijving={`Stand van ${boekjaar.naam}. Bedragen volgen uit de administratie; het banksaldo voer je zelf in.`}
      />

      {balans.bankverschilCenten !== null && balans.bankverschilCenten !== 0 ? (
        <Melding
          toon="waarschuwing"
          className="mb-6"
          titel="Het ingevoerde banksaldo wijkt af van de administratie"
        >
          <p>
            Verschil: {formatteerEuro(balans.bankverschilCenten)}. Dit is het
            beste signaal dat er iets vergeten is — een niet-geregistreerde
            ontvangst, een ontbrekende uitgave, of een beginsaldo dat niet
            klopt.{" "}
            <Link href="/bank" className="underline">
              Naar het banksaldo
            </Link>
            .
          </p>
        </Melding>
      ) : null}

      {balans.bankverschilCenten === null ? (
        <Melding toon="info" className="mb-6">
          Er is nog geen banksaldo ingevoerd, dus de controle op het werkelijke
          saldo kan niet gedaan worden.{" "}
          <Link href="/bank" className="underline">
            Voer het saldo in
          </Link>
          .
        </Melding>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Activa</CardTitle>
            <CardDescription>Wat de SVR bezit of nog krijgt</CardDescription>
          </CardHeader>
          <Table>
            <TableBody>
              <TableRow>
                <TableCell>
                  Banksaldo volgens de administratie
                  <span className="block text-xs text-muted-foreground">
                    beginsaldo {formatteerEuro(boekjaar.beginsaldoBankCenten)}{" "}
                    plus ontvangsten min betaalde uitgaven
                  </span>
                </TableCell>
                <TableCell className="text-right">
                  <Bedrag centen={balans.administratiefBanksaldoCenten} />
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell>
                  Openstaande debiteuren
                  <span className="block text-xs text-muted-foreground">
                    {cijfers.openstaandeFacturen.length} openstaande facturen
                  </span>
                </TableCell>
                <TableCell className="text-right">
                  <Bedrag centen={balans.debiteurenCenten} />
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell>
                  <Link href="/voorraad" className="hover:underline">
                    Spullen & voorraad
                  </Link>
                  <span className="block text-xs text-muted-foreground">
                    {cijfers.voorraadposten.length} soorten spullen, tegen
                    boekwaarde
                  </span>
                </TableCell>
                <TableCell className="text-right">
                  <Bedrag centen={balans.voorraadCenten} />
                </TableCell>
              </TableRow>
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell className="font-semibold">Totaal activa</TableCell>
                <TableCell className="text-right font-semibold">
                  <Bedrag centen={balans.totaalActivaCenten} />
                </TableCell>
              </TableRow>
            </TableFooter>
          </Table>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Passiva</CardTitle>
            <CardDescription>
              Wat de SVR schuldig is en het vermogen
            </CardDescription>
          </CardHeader>
          <Table>
            <TableBody>
              <TableRow>
                <TableCell>
                  Openstaande crediteuren
                  <span className="block text-xs text-muted-foreground">
                    {cijfers.openstaandeUitgaven.length} nog te betalen uitgaven
                  </span>
                </TableCell>
                <TableCell className="text-right">
                  <Bedrag centen={balans.crediteurenCenten} />
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell>Eigen vermogen begin boekjaar</TableCell>
                <TableCell className="text-right">
                  <Bedrag centen={balans.eigenVermogenBeginCenten} />
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell>
                  Resultaat lopend boekjaar
                  <span className="block text-xs text-muted-foreground">
                    inkomsten min uitgaven, plus de voorraadmutatie
                  </span>
                </TableCell>
                <TableCell className="text-right">
                  <Bedrag centen={balans.resultaatCenten} />
                </TableCell>
              </TableRow>
              {balans.beginbalansverschilCenten !== 0 ? (
                <TableRow>
                  <TableCell>
                    Beginbalans: overige vorderingen en schulden
                    <span className="block text-xs text-muted-foreground">
                      beginsaldo bank plus beginvoorraad, min het eigen vermogen
                      aan het begin van het jaar
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <Bedrag centen={balans.beginbalansverschilCenten} />
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell className="font-semibold">Totaal passiva</TableCell>
                <TableCell className="text-right font-semibold">
                  <Bedrag centen={balans.totaalPassivaCenten} />
                </TableCell>
              </TableRow>
            </TableFooter>
          </Table>
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Controles</CardTitle>
        </CardHeader>
        <Table>
          <TableBody>
            <TableRow>
              <TableCell>Activa min passiva</TableCell>
              <TableCell className="text-right">
                <Bedrag
                  centen={balans.balansverschilCenten}
                  className={
                    balans.balansverschilCenten === 0
                      ? "text-success"
                      : "text-destructive"
                  }
                />
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {balans.balansverschilCenten === 0
                  ? "De balans sluit."
                  : "De balans sluit niet; neem contact op met de bouwer."}
              </TableCell>
            </TableRow>
            <TableRow>
              <TableCell>
                Ingevoerd banksaldo
                {cijfers.laatsteBanksaldo ? (
                  <span className="block text-xs text-muted-foreground">
                    per {formatteerDatum(cijfers.laatsteBanksaldo.datum)}
                  </span>
                ) : null}
              </TableCell>
              <TableCell className="text-right">
                {cijfers.laatsteBanksaldo ? (
                  <Bedrag centen={cijfers.laatsteBanksaldo.saldoCenten} />
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </TableCell>
              <TableCell />
            </TableRow>
            <TableRow>
              <TableCell>Verschil met de administratie</TableCell>
              <TableCell className="text-right">
                {balans.bankverschilCenten === null ? (
                  <span className="text-muted-foreground">—</span>
                ) : (
                  <Bedrag
                    centen={balans.bankverschilCenten}
                    className={
                      balans.bankverschilCenten === 0
                        ? "text-success"
                        : "text-destructive"
                    }
                  />
                )}
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">
                Hoort nul te zijn.
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </Card>
    </>
  );
}
