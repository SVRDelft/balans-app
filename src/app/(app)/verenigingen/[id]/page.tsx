import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Kerngetal, Paginakop } from "@/components/paginakop";
import { FactuurStatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
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
import { db } from "@/lib/db";
import { formatteerDatum } from "@/lib/datum";
import { betaaldBedrag } from "@/lib/facturen";
import { factuurOpenstaand, factuurRealisatie } from "@/lib/finance/factuurstanden";
import { factuurStandRelaties } from "@/lib/factuur-includes";
import { formatteerEuro } from "@/lib/geld";

export const metadata: Metadata = { title: "Vereniging" };

export default async function VerenigingPagina({
  params,
}: PageProps<"/verenigingen/[id]">) {
  const { boekjaar } = await vereisBoekjaarContext();
  const { id } = await params;

  const vereniging = await db.relatie.findUnique({
    where: { id },
    include: {
      facturen: {
        where: { boekjaarId: boekjaar.id },
        orderBy: { volgnummer: "asc" },
        include: {
          ...factuurStandRelaties,
          betalingen: { orderBy: { datum: "asc" } },
          evenement: { select: { id: true, naam: true } },
        },
      },
      deelnemers: {
        where: { evenement: { boekjaarId: boekjaar.id } },
        include: { evenement: { select: { id: true, naam: true } } },
      },
    },
  });
  if (!vereniging) notFound();

  const tellend = vereniging.facturen.filter((factuur) =>
    factuur.status !== "concept",
  );
  const verschuldigd = tellend.reduce(
    (som, factuur) => som + factuurRealisatie(factuur),
    0,
  );
  const betaald = tellend.reduce(
    (som, factuur) => som + betaaldBedrag(factuur.betalingen),
    0,
  );
  const openstaand = vereniging.facturen
    .reduce(
      (som, factuur) =>
        som +
        factuurOpenstaand(factuur),
      0,
    );

  return (
    <>
      <Paginakop
        titel={vereniging.naam}
        beschrijving={`Overzicht voor ${boekjaar.naam}.`}
        acties={
          <Button variant="outline" asChild>
            <Link href={`/relaties/${vereniging.id}`}>Gegevens bewerken</Link>
          </Button>
        }
      />

      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        <Kerngetal label="Verschuldigd" waarde={formatteerEuro(verschuldigd)} />
        <Kerngetal label="Betaald" waarde={formatteerEuro(betaald)} toon="goed" />
        <Kerngetal
          label="Nog openstaand"
          waarde={formatteerEuro(openstaand)}
          toon={openstaand > 0 ? "fout" : "goed"}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Facturen</CardTitle>
        </CardHeader>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nummer</TableHead>
              <TableHead>Omschrijving</TableHead>
              <TableHead>Datum</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Bedrag</TableHead>
              <TableHead className="text-right">Betaald</TableHead>
              <TableHead className="text-right">Open</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {vereniging.facturen.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-muted-foreground">
                  Nog geen facturen in dit boekjaar.
                </TableCell>
              </TableRow>
            ) : null}
            {vereniging.facturen.map((factuur) => {
              const factuurBetaald = betaaldBedrag(factuur.betalingen);
              const factuurOpen = factuurOpenstaand(factuur);

              return (
                <TableRow key={factuur.id}>
                  <TableCell>
                    <Link
                      href={`/facturen/${factuur.id}`}
                      className="cijfers hover:underline"
                    >
                      {factuur.nummer}
                    </Link>
                  </TableCell>
                  <TableCell className="max-w-64 truncate">
                    {factuur.omschrijving}
                    {factuur.evenement ? (
                      <span className="block text-xs text-muted-foreground">
                        {factuur.evenement.naam}
                      </span>
                    ) : null}
                  </TableCell>
                  <TableCell className="cijfers whitespace-nowrap text-muted-foreground">
                    {formatteerDatum(factuur.factuurdatum)}
                  </TableCell>
                  <TableCell>
                    <FactuurStatusBadge status={factuur.status} />
                  </TableCell>
                  <TableCell className="text-right">
                    <Bedrag centen={factuur.totaalCenten} />
                  </TableCell>
                  <TableCell className="text-right">
                    <Bedrag centen={factuurBetaald} />
                  </TableCell>
                  <TableCell className="text-right">
                    <Bedrag
                      centen={factuurOpen}
                      className={factuurOpen > 0 ? "text-destructive" : undefined}
                    />
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Card>

      {vereniging.deelnemers.length > 0 ? (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Deelname aan evenementen</CardTitle>
          </CardHeader>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Evenement</TableHead>
                <TableHead className="text-right">Personen</TableHead>
                <TableHead className="text-center">Aangemeld</TableHead>
                <TableHead className="text-center">Bevestigd betalend</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {vereniging.deelnemers.map((deelnemer) => (
                <TableRow key={deelnemer.id}>
                  <TableCell>
                    <Link
                      href={`/evenementen/${deelnemer.evenement.id}`}
                      className="hover:underline"
                    >
                      {deelnemer.evenement.naam}
                    </Link>
                  </TableCell>
                  <TableCell className="cijfers text-right">
                    {deelnemer.aantalPersonen}
                  </TableCell>
                  <TableCell className="text-center">
                    {deelnemer.aangemeld ? "✓" : "—"}
                  </TableCell>
                  <TableCell className="text-center">
                    {deelnemer.bevestigdBetalend ? "✓" : "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      ) : null}
    </>
  );
}
