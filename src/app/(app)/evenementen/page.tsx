import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";

import { Paginakop } from "@/components/paginakop";
import { EvenementStatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Leeg } from "@/components/ui/melding";
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
import { formatteerDatum } from "@/lib/datum";
import { db } from "@/lib/db";
import { haalBoekjaarCijfers } from "@/lib/rapportage";

export const metadata: Metadata = { title: "Evenementen" };

export default async function EvenementenPagina() {
  const { boekjaar, schrijfbaar } = await vereisBoekjaarContext();

  const [evenementen, cijfers] = await Promise.all([
    db.evenement.findMany({
      where: { boekjaarId: boekjaar.id },
      orderBy: { datum: "asc" },
      include: {
        _count: { select: { deelnemers: true, uitgaven: true, facturen: true } },
      },
    }),
    haalBoekjaarCijfers(boekjaar.id),
  ]);

  const afstemmingPerEvenement = new Map(
    cijfers.evenementen.map((evenement) => [evenement.id, evenement.afstemming]),
  );

  return (
    <>
      <Paginakop
        titel="Evenementen"
        beschrijving="De SVR schiet de kosten voor en verdeelt ze daarna over de deelnemers. Op deze posten hoort geen winst of verlies te ontstaan."
        acties={
          schrijfbaar ? (
            <Button asChild>
              <Link href="/evenementen/nieuw">
                <Plus />
                Nieuw evenement
              </Link>
            </Button>
          ) : null
        }
      />

      {evenementen.length === 0 ? (
        <Leeg titel="Nog geen evenementen">
          Maak er een aan om kosten en deelnemers bij te houden.
        </Leeg>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Evenement</TableHead>
                <TableHead>Datum</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Kosten</TableHead>
                <TableHead className="text-right">Gefactureerd</TableHead>
                <TableHead className="text-right">Ontvangen</TableHead>
                <TableHead className="text-right">Verschil</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {evenementen.map((evenement) => {
                const afstemming = afstemmingPerEvenement.get(evenement.id);
                const verschil = afstemming?.resultaatCenten ?? 0;

                return (
                  <TableRow key={evenement.id}>
                    <TableCell>
                      <Link
                        href={`/evenementen/${evenement.id}`}
                        className="font-medium hover:underline"
                      >
                        {evenement.naam}
                      </Link>
                      <span className="block text-xs text-muted-foreground">
                        {evenement._count.deelnemers} deelnemers ·{" "}
                        {evenement._count.uitgaven} uitgaven ·{" "}
                        {evenement._count.facturen} facturen
                      </span>
                    </TableCell>
                    <TableCell className="cijfers whitespace-nowrap text-muted-foreground">
                      {formatteerDatum(evenement.datum)}
                    </TableCell>
                    <TableCell>
                      <EvenementStatusBadge status={evenement.status} />
                    </TableCell>
                    <TableCell className="text-right">
                      <Bedrag centen={afstemming?.totaleKostenCenten ?? 0} />
                    </TableCell>
                    <TableCell className="text-right">
                      <Bedrag centen={afstemming?.gefactureerdCenten ?? 0} />
                    </TableCell>
                    <TableCell className="text-right">
                      <Bedrag centen={afstemming?.ontvangenCenten ?? 0} />
                    </TableCell>
                    <TableCell className="text-right">
                      <Bedrag
                        centen={verschil}
                        className={
                          verschil === 0 ? "text-success" : "text-destructive"
                        }
                      />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      )}
    </>
  );
}
