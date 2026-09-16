import type { Metadata } from "next";
import Link from "next/link";
import { Plus, Wand2 } from "lucide-react";

import { Paginakop } from "@/components/paginakop";
import { Zoekveld } from "@/components/zoekveld";
import { dagenTeLaat } from "@/lib/finance/vervaldatum";
import { FactuurStatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { formatteerDatum, vandaag } from "@/lib/datum";
import {
  FACTUUR_STATUSSEN,
  FACTUUR_STATUS_LABEL,
  type FactuurStatus,
} from "@/lib/domein";
import { factuurOpenstaand } from "@/lib/finance/factuurstanden";
import { factuurStandRelaties } from "@/lib/factuur-includes";

export const metadata: Metadata = { title: "Facturen" };

export default async function FacturenPagina({
  searchParams,
}: PageProps<"/facturen">) {
  const { boekjaar, schrijfbaar } = await vereisBoekjaarContext();
  const parameters = await searchParams;
  const zoekterm = typeof parameters.q === "string" ? parameters.q.trim().slice(0, 120) : "";

  const statusFilter =
    typeof parameters.status === "string" ? parameters.status : "";
  const relatieFilter =
    typeof parameters.relatie === "string" ? parameters.relatie : "";
  const evenementFilter =
    typeof parameters.evenement === "string" ? parameters.evenement : "";

  const statusVoorwaarde =
    statusFilter === "openstaand" || statusFilter === "vervallen"
      ? { status: { notIn: ["concept", "oninbaar"] } }
      : FACTUUR_STATUSSEN.includes(statusFilter as FactuurStatus)
        ? { status: statusFilter }
        : {};

  const [gevonden, relaties, evenementen] = await Promise.all([
    db.factuur.findMany({
      where: {
        boekjaarId: boekjaar.id,
        ...statusVoorwaarde,
        ...(statusFilter === "vervallen" ? { vervaldatum: { lt: vandaag() }, totaalCenten: { gt: 0 } } : {}),
        ...(zoekterm ? { OR: [
          { nummer: { contains: zoekterm, mode: "insensitive" as const } },
          { omschrijving: { contains: zoekterm, mode: "insensitive" as const } },
          { relatie: { naam: { contains: zoekterm, mode: "insensitive" as const } } },
        ] } : {}),
        ...(relatieFilter ? { relatieId: relatieFilter } : {}),
        ...(evenementFilter ? { evenementId: evenementFilter } : {}),
      },
      include: {
        ...factuurStandRelaties,
        relatie: { select: { naam: true } },
        betalingen: { select: { bedragCenten: true } },
        evenement: { select: { naam: true } },
      },
      orderBy: { volgnummer: "desc" },
    }),
    db.relatie.findMany({
      where: { facturen: { some: { boekjaarId: boekjaar.id } } },
      orderBy: { naam: "asc" },
      select: { id: true, naam: true },
    }),
    db.evenement.findMany({
      where: { boekjaarId: boekjaar.id },
      orderBy: { datum: "asc" },
      select: { id: true, naam: true },
    }),
  ]);

  const peildatum = vandaag();
  const facturen = gevonden.filter((factuur) => statusFilter === "vervallen" ? dagenTeLaat(factuur.vervaldatum, peildatum, factuurOpenstaand(factuur)) > 0 : statusFilter === "openstaand" ? factuurOpenstaand(factuur) !== 0 : true);
  const totaal = facturen.reduce(
    (som, factuur) => som + factuur.totaalCenten,
    0,
  );
  const totaalOpenstaand = facturen.reduce((som, factuur) => som + factuurOpenstaand(factuur), 0);

  return (
    <>
      <Paginakop
        titel="Facturen"
        beschrijving={`${facturen.length} ${facturen.length === 1 ? "factuur" : "facturen"} in ${boekjaar.naam}.`}
        acties={
          schrijfbaar ? (
            <>
              <Button variant="outline" asChild>
                <Link href="/facturen/jaarfacturen">
                  <Wand2 />
                  Jaarfacturen bijdrage
                </Link>
              </Button>
              <Button asChild>
                <Link href="/facturen/nieuw">
                  <Plus />
                  Nieuwe factuur
                </Link>
              </Button>
            </>
          ) : null
        }
      />

      <form
        key={[zoekterm, statusFilter, relatieFilter, evenementFilter].join("|")}
        method="get"
        className="mb-4 flex flex-wrap items-end gap-3 niet-afdrukken"
      >
        <Zoekveld waarde={zoekterm} placeholder="Nummer, relatie of omschrijving" />
        <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
          Status
          <select name="status" defaultValue={statusFilter} className="veld w-48">
            <option value="">Alle</option>
            <option value="openstaand">Openstaand</option>
            <option value="vervallen">Te laat</option>
            {FACTUUR_STATUSSEN.map((status) => (
              <option key={status} value={status}>
                {FACTUUR_STATUS_LABEL[status]}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
          Relatie
          <select name="relatie" defaultValue={relatieFilter} className="veld w-56">
            <option value="">Alle</option>
            {relaties.map((relatie) => (
              <option key={relatie.id} value={relatie.id}>
                {relatie.naam}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
          Evenement
          <select
            name="evenement"
            defaultValue={evenementFilter}
            className="veld w-56"
          >
            <option value="">Alle</option>
            {evenementen.map((evenement) => (
              <option key={evenement.id} value={evenement.id}>
                {evenement.naam}
              </option>
            ))}
          </select>
        </label>

        <Button type="submit" variant="secondary" size="sm">
          Filteren
        </Button>
        {zoekterm || statusFilter || relatieFilter || evenementFilter ? (
          <Button type="button" variant="ghost" size="sm" asChild>
            <Link href="/facturen">Wissen</Link>
          </Button>
        ) : null}
      </form>

      {facturen.length === 0 ? (
        <Leeg titel="Geen facturen gevonden">
          Pas de filters aan of maak een nieuwe factuur.
        </Leeg>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nummer</TableHead>
                <TableHead>Relatie</TableHead>
                <TableHead>Omschrijving</TableHead>
                <TableHead>Datum</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Bedrag</TableHead>
                <TableHead className="text-right">Openstaand</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {facturen.map((factuur) => {
                const openstaand = factuurOpenstaand(factuur);
                const dagenOpen = dagenTeLaat(factuur.vervaldatum, peildatum, openstaand);
                const teLaat = dagenOpen > 0;

                return (
                  <TableRow key={factuur.id}>
                    <TableCell>
                      <Link
                        href={`/facturen/${factuur.id}`}
                        className="cijfers font-medium hover:underline"
                      >
                        {factuur.nummer}
                      </Link>
                    </TableCell>
                    <TableCell>{factuur.relatie.naam}</TableCell>
                    <TableCell className="max-w-72 truncate text-muted-foreground">
                      {factuur.omschrijving}
                      {factuur.evenement ? (
                        <span className="block text-xs">
                          {factuur.evenement.naam}
                        </span>
                      ) : null}
                    </TableCell>
                    <TableCell className="cijfers whitespace-nowrap text-muted-foreground">
                      {formatteerDatum(factuur.factuurdatum)}
                      {teLaat ? (
                        <span className="block text-xs text-destructive">
                          {dagenOpen} {dagenOpen === 1 ? "dag" : "dagen"} te laat
                        </span>
                      ) : null}
                    </TableCell>
                    <TableCell>
                      <FactuurStatusBadge status={factuur.status} />
                    </TableCell>
                    <TableCell className="text-right">
                      <Bedrag centen={factuur.totaalCenten} />
                    </TableCell>
                    <TableCell className="text-right">
                      {openstaand === 0 ? (
                        <span className="text-muted-foreground">—</span>
                      ) : (
                        <Bedrag
                          centen={openstaand}
                          className={teLaat ? "text-destructive" : undefined}
                        />
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell colSpan={5}>Totaal</TableCell>
                <TableCell className="text-right">
                  <Bedrag centen={totaal} />
                </TableCell>
                <TableCell className="text-right">
                  <Bedrag centen={totaalOpenstaand} />
                </TableCell>
              </TableRow>
            </TableFooter>
          </Table>
        </Card>
      )}
    </>
  );
}
