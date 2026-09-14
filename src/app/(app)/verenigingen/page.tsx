import type { Metadata } from "next";
import Link from "next/link";

import { Paginakop } from "@/components/paginakop";
import { Card } from "@/components/ui/card";
import { Leeg } from "@/components/ui/melding";
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
import { TELLENDE_STATUSSEN, OPENSTAANDE_STATUSSEN } from "@/lib/domein";
import { betaaldBedrag } from "@/lib/facturen";
import { openstaandBedrag } from "@/lib/finance/factuurstatus";

export const metadata: Metadata = { title: "Per vereniging" };

export default async function VerenigingenPagina() {
  const { boekjaar } = await vereisBoekjaarContext();

  const verenigingen = await db.relatie.findMany({
    where: { type: "studievereniging" },
    orderBy: { naam: "asc" },
    include: {
      facturen: {
        where: { boekjaarId: boekjaar.id },
        include: { betalingen: { select: { bedragCenten: true } } },
      },
    },
  });

  const rijen = verenigingen.map((vereniging) => {
    const tellend = vereniging.facturen.filter((factuur) =>
      TELLENDE_STATUSSEN.includes(factuur.status as never),
    );

    const verschuldigd = tellend.reduce(
      (som, factuur) => som + factuur.totaalCenten,
      0,
    );
    const betaald = tellend.reduce(
      (som, factuur) => som + betaaldBedrag(factuur.betalingen),
      0,
    );
    const openstaand = vereniging.facturen
      .filter((factuur) =>
        OPENSTAANDE_STATUSSEN.includes(factuur.status as never),
      )
      .reduce(
        (som, factuur) =>
          som +
          openstaandBedrag(factuur.totaalCenten, betaaldBedrag(factuur.betalingen)),
        0,
      );

    return {
      id: vereniging.id,
      naam: vereniging.naam,
      bijdragePlichtig: vereniging.bijdragePlichtig,
      actief: vereniging.actief,
      aantalFacturen: vereniging.facturen.length,
      verschuldigd,
      betaald,
      openstaand,
    };
  });

  const totaal = rijen.reduce(
    (som, rij) => ({
      verschuldigd: som.verschuldigd + rij.verschuldigd,
      betaald: som.betaald + rij.betaald,
      openstaand: som.openstaand + rij.openstaand,
    }),
    { verschuldigd: 0, betaald: 0, openstaand: 0 },
  );

  return (
    <>
      <Paginakop
        titel="Per studievereniging"
        beschrijving={`Wat elke vereniging in ${boekjaar.naam} verschuldigd was, betaald heeft en nog openstaat. Handig tijdens de vergaderingen.`}
      />

      {rijen.length === 0 ? (
        <Leeg titel="Nog geen studieverenigingen">
          Voeg ze toe bij Gegevens › Relaties.
        </Leeg>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Vereniging</TableHead>
                <TableHead className="text-right">Facturen</TableHead>
                <TableHead className="text-right">Verschuldigd</TableHead>
                <TableHead className="text-right">Betaald</TableHead>
                <TableHead className="text-right">Openstaand</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rijen.map((rij) => (
                <TableRow key={rij.id}>
                  <TableCell>
                    <Link
                      href={`/verenigingen/${rij.id}`}
                      className="font-medium hover:underline"
                    >
                      {rij.naam}
                    </Link>
                    {!rij.bijdragePlichtig ? (
                      <span className="block text-xs text-muted-foreground">
                        niet bijdrageplichtig
                      </span>
                    ) : null}
                    {!rij.actief ? (
                      <span className="block text-xs text-muted-foreground">
                        niet actief
                      </span>
                    ) : null}
                  </TableCell>
                  <TableCell className="cijfers text-right text-muted-foreground">
                    {rij.aantalFacturen}
                  </TableCell>
                  <TableCell className="text-right">
                    <Bedrag centen={rij.verschuldigd} />
                  </TableCell>
                  <TableCell className="text-right">
                    <Bedrag centen={rij.betaald} />
                  </TableCell>
                  <TableCell className="text-right">
                    <Bedrag
                      centen={rij.openstaand}
                      className={
                        rij.openstaand > 0 ? "text-destructive" : undefined
                      }
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell colSpan={2}>Totaal</TableCell>
                <TableCell className="text-right">
                  <Bedrag centen={totaal.verschuldigd} />
                </TableCell>
                <TableCell className="text-right">
                  <Bedrag centen={totaal.betaald} />
                </TableCell>
                <TableCell className="text-right">
                  <Bedrag centen={totaal.openstaand} />
                </TableCell>
              </TableRow>
            </TableFooter>
          </Table>
        </Card>
      )}
    </>
  );
}
