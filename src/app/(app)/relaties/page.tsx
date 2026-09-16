import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";

import { Paginakop } from "@/components/paginakop";
import { Zoekveld } from "@/components/zoekveld";
import { Badge } from "@/components/ui/badge";
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
import { RELATIE_TYPES, RELATIE_TYPE_LABEL, type RelatieType } from "@/lib/domein";

export const metadata: Metadata = { title: "Relaties" };

export default async function RelatiesPagina({
  searchParams,
}: PageProps<"/relaties">) {
  const parameters = await searchParams;
  const zoekterm = typeof parameters.q === "string" ? parameters.q.trim().slice(0, 120) : "";
  const gekozenType =
    typeof parameters.type === "string" &&
    RELATIE_TYPES.includes(parameters.type as RelatieType)
      ? (parameters.type as RelatieType)
      : null;
  const toonInactief = parameters.inactief === "1";

  const relaties = await db.relatie.findMany({
    where: {
      ...(gekozenType ? { type: gekozenType } : {}),
      ...(toonInactief ? {} : { actief: true }),
      ...(zoekterm ? { OR: ["naam", "contactpersoon", "email", "plaats", "kvkNummer"].map((veld) => ({ [veld]: { contains: zoekterm, mode: "insensitive" } })) } : {}),
    },
    orderBy: [{ type: "asc" }, { naam: "asc" }],
    include: { _count: { select: { facturen: true } } },
  });

  return (
    <>
      <Paginakop
        titel="Relaties"
        beschrijving="Studieverenigingen, personen en leveranciers. Relaties blijven over boekjaren heen bestaan."
        acties={
          <Button asChild>
            <Link href="/relaties/nieuw">
              <Plus />
              Nieuwe relatie
            </Link>
          </Button>
        }
      />

      <form key={`${zoekterm}|${gekozenType}|${toonInactief}`} method="get" className="mb-3 flex flex-wrap items-end gap-3 niet-afdrukken">
        <Zoekveld waarde={zoekterm} placeholder="Naam, e-mail, plaats of KvK" />
        {gekozenType ? <input type="hidden" name="type" value={gekozenType} /> : null}
        {toonInactief ? <input type="hidden" name="inactief" value="1" /> : null}
        <Button type="submit" variant="secondary">Zoeken</Button>
        {zoekterm ? <Button variant="ghost" asChild><Link href="/relaties">Wis filters</Link></Button> : null}
      </form>
      <div className="mb-4 flex flex-wrap gap-2 niet-afdrukken">
        <FilterKnop
          href={`/relaties?${new URLSearchParams({ ...(toonInactief ? { inactief: "1" } : {}), ...(zoekterm ? { q: zoekterm } : {}) })}`}
          actief={gekozenType === null}
        >
          Alle
        </FilterKnop>
        {RELATIE_TYPES.map((soort) => (
          <FilterKnop
            key={soort}
            href={`/relaties?type=${soort}${toonInactief ? "&inactief=1" : ""}${zoekterm ? `&q=${encodeURIComponent(zoekterm)}` : ""}`}
            actief={gekozenType === soort}
          >
            {RELATIE_TYPE_LABEL[soort]}
          </FilterKnop>
        ))}
        <FilterKnop
          href={`/relaties?${gekozenType ? `type=${gekozenType}&` : ""}${toonInactief ? "" : "inactief=1"}${zoekterm ? `&q=${encodeURIComponent(zoekterm)}` : ""}`}
          actief={toonInactief}
        >
          Ook niet-actieve
        </FilterKnop>
      </div>

      {relaties.length === 0 ? (
        <Leeg titel="Geen relaties gevonden">
          {zoekterm || gekozenType ? "Probeer een andere zoekterm of wis de filters." : "Voeg je eerste vereniging, persoon of leverancier toe met Nieuwe relatie."}
        </Leeg>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Naam</TableHead>
                <TableHead>Soort</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead className="text-right">Facturen</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {relaties.map((relatie) => (
                <TableRow key={relatie.id}>
                  <TableCell>
                    <Link
                      href={`/relaties/${relatie.id}`}
                      className="font-medium hover:underline"
                    >
                      {relatie.naam}
                    </Link>
                    <div className="mt-0.5 flex flex-wrap gap-1">
                      {!relatie.actief ? (
                        <Badge variant="neutraal">Niet actief</Badge>
                      ) : null}
                      {relatie.bijdragePlichtig ? (
                        <Badge variant="omlijnd">Bijdrageplichtig</Badge>
                      ) : null}
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {RELATIE_TYPE_LABEL[relatie.type as RelatieType] ??
                      relatie.type}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {relatie.contactpersoon ? (
                      <div>{relatie.contactpersoon}</div>
                    ) : null}
                    {relatie.email ? (
                      <a href={`mailto:${relatie.email}`} className="block text-xs text-primary hover:underline">{relatie.email}</a>
                    ) : null}
                    {relatie.telefoon ? <a href={`tel:${relatie.telefoon.replace(/[^+\d]/g, "")}`} className="block text-xs hover:underline">{relatie.telefoon}</a> : null}
                  </TableCell>
                  <TableCell className="cijfers text-right text-muted-foreground">
                    {relatie._count.facturen}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm" asChild>
                      <Link href={`/relaties/${relatie.id}`}>Bewerken</Link>
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </>
  );
}

function FilterKnop({
  href,
  actief,
  children,
}: {
  href: string;
  actief: boolean;
  children: React.ReactNode;
}) {
  return (
    <Button variant={actief ? "secondary" : "ghost"} size="sm" asChild>
      <Link href={href}>{children}</Link>
    </Button>
  );
}
