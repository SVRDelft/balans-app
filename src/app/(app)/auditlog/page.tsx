import type { Metadata } from "next";
import Link from "next/link";

import { Paginakop } from "@/components/paginakop";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Leeg } from "@/components/ui/melding";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { db } from "@/lib/db";
import { formatteerTijdstempel } from "@/lib/datum";

export const metadata: Metadata = { title: "Auditlog" };

const PER_PAGINA = 100;

export default async function AuditlogPagina({
  searchParams,
}: PageProps<"/auditlog">) {
  const parameters = await searchParams;
  const pagina = Math.max(
    1,
    Number.parseInt(
      typeof parameters.pagina === "string" ? parameters.pagina : "1",
      10,
    ) || 1,
  );

  const [regels, totaal] = await Promise.all([
    db.auditlog.findMany({
      orderBy: { tijdstip: "desc" },
      skip: (pagina - 1) * PER_PAGINA,
      take: PER_PAGINA,
    }),
    db.auditlog.count(),
  ]);

  const laatstePagina = Math.max(1, Math.ceil(totaal / PER_PAGINA));

  return (
    <>
      <Paginakop
        titel="Auditlog"
        beschrijving="Wie wijzigde wat en wanneer. Twee mensen werken in hetzelfde systeem, dus dit spoor is de enige manier om achteraf te zien wat er gebeurd is."
      />

      {regels.length === 0 ? (
        <Leeg titel="Nog niets vastgelegd">
          Zodra er iets gewijzigd wordt, komt dat hier te staan.
        </Leeg>
      ) : (
        <>
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-44">Wanneer</TableHead>
                  <TableHead className="w-32">Wie</TableHead>
                  <TableHead className="w-36">Onderdeel</TableHead>
                  <TableHead>Wat</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {regels.map((regel) => (
                  <TableRow key={regel.id}>
                    <TableCell className="cijfers whitespace-nowrap text-muted-foreground">
                      {formatteerTijdstempel(regel.tijdstip)}
                    </TableCell>
                    <TableCell className="font-medium">{regel.gebruiker}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {regel.entiteit}
                      <span className="block text-xs">{regel.actie}</span>
                    </TableCell>
                    <TableCell>{regel.samenvatting}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>

          {laatstePagina > 1 ? (
            <div className="mt-4 flex items-center justify-between">
              <span className="text-sm text-muted-foreground">
                Pagina {pagina} van {laatstePagina} · {totaal} regels
              </span>
              <div className="flex gap-2">
                {pagina > 1 ? (
                  <Button variant="outline" size="sm" asChild>
                    <Link href={`/auditlog?pagina=${pagina - 1}`}>Vorige</Link>
                  </Button>
                ) : null}
                {pagina < laatstePagina ? (
                  <Button variant="outline" size="sm" asChild>
                    <Link href={`/auditlog?pagina=${pagina + 1}`}>Volgende</Link>
                  </Button>
                ) : null}
              </div>
            </div>
          ) : null}
        </>
      )}
    </>
  );
}
