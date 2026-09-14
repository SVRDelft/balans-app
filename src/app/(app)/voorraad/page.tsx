import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Plus } from "lucide-react";
import { Paginakop, Kerngetal } from "@/components/paginakop";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Melding } from "@/components/ui/melding";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Bedrag,
} from "@/components/ui/table";
import { vereisBoekjaarContext } from "@/lib/boekjaar";
import { db } from "@/lib/db";
import { berekenVoorraad } from "@/lib/finance/voorraad";
import { formatteerEuro } from "@/lib/geld";
import {
  VoorraadFormulier,
  VoorraadOvernemen,
  LegeVoorraadVerwijderen,
} from "./formulier";

export const metadata: Metadata = { title: "Spullen & voorraad" };

export default async function VoorraadPagina({
  searchParams,
}: {
  searchParams: Promise<{ bewerken?: string; nieuw?: string }>;
}) {
  const [{ boekjaar, schrijfbaar, alleBoekjaren }, parameters] =
    await Promise.all([vereisBoekjaarContext(), searchParams]);
  const [posten, uitgavenposten] = await Promise.all([
    db.voorraadpost.findMany({
      where: { boekjaarId: boekjaar.id },
      orderBy: { naam: "asc" },
      include: { begrotingspost: { select: { code: true, naam: true } } },
    }),
    db.begrotingspost.findMany({
      where: { boekjaarId: boekjaar.id, soort: "uitgave" },
      orderBy: [{ volgorde: "asc" }, { code: "asc" }],
      select: { id: true, code: true, naam: true },
    }),
  ]);
  const totaal = berekenVoorraad(posten);
  const gekozen = parameters.bewerken
    ? posten.find((post) => post.id === parameters.bewerken)
    : null;
  if (parameters.bewerken && !gekozen) notFound();

  return (
    <>
      <Paginakop
        titel="Spullen & voorraad"
        beschrijving={`Aantallen en waarde van de spullen van de SVR in ${boekjaar.naam}, zoals dassen, strikken en kantoorvoorraad.`}
        acties={
          schrijfbaar ? (
            <Button asChild>
              <Link href="/voorraad?nieuw=1">
                <Plus />
                Spullen toevoegen
              </Link>
            </Button>
          ) : undefined
        }
      />
      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        <Kerngetal
          label="Waarde begin boekjaar"
          waarde={formatteerEuro(totaal.beginwaardeCenten)}
        />
        <Kerngetal
          label="Huidige waarde op de balans"
          waarde={formatteerEuro(totaal.waardeCenten)}
        />
        <Kerngetal
          label="Verandering in voorraadwaarde"
          waarde={formatteerEuro(totaal.mutatieCenten)}
        />
      </div>
      {!schrijfbaar ? (
        <Melding toon="info" className="mb-4">
          Dit boekjaar is afgesloten. De spullen zijn alleen te bekijken.
        </Melding>
      ) : null}
      {schrijfbaar && (parameters.nieuw === "1" || gekozen) ? (
        <div className="mb-6">
          <VoorraadFormulier
            key={gekozen?.id ?? "nieuw"}
            uitgavenposten={uitgavenposten}
            waarden={
              gekozen
                ? {
                    id: gekozen.id,
                    naam: gekozen.naam,
                    eenheid: gekozen.eenheid,
                    beginAantal: gekozen.beginAantal,
                    beginWaardePerStukCenten: gekozen.beginWaardePerStukCenten,
                    aantal: gekozen.aantal,
                    waardePerStukCenten: gekozen.waardePerStukCenten,
                    locatie: gekozen.locatie,
                    notities: gekozen.notities,
                    begrotingspostId: gekozen.begrotingspostId ?? "",
                  }
                : undefined
            }
          />
          {gekozen && gekozen.beginAantal === 0 && gekozen.aantal === 0 ? (
            <LegeVoorraadVerwijderen id={gekozen.id} />
          ) : null}
        </div>
      ) : null}
      {posten.length ? (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Spullen</TableHead>
                <TableHead>Begin</TableHead>
                <TableHead>Nu</TableHead>
                <TableHead className="text-right">Per stuk</TableHead>
                <TableHead className="text-right">Huidige waarde</TableHead>
                <TableHead>Begrotingspost</TableHead>
                <TableHead>Bewaarplaats</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {posten.map((post) => (
                <TableRow key={post.id}>
                  <TableCell>
                    {schrijfbaar ? (
                      <Link
                        className="font-medium underline"
                        href={`/voorraad?bewerken=${post.id}`}
                      >
                        {post.naam}
                      </Link>
                    ) : (
                      post.naam
                    )}
                    {post.notities ? (
                      <p className="mt-1 max-w-xs whitespace-pre-wrap text-xs text-muted-foreground">
                        {post.notities}
                      </p>
                    ) : null}
                  </TableCell>
                  <TableCell>
                    {post.beginAantal} {post.eenheid}
                  </TableCell>
                  <TableCell>
                    {post.aantal} {post.eenheid}
                  </TableCell>
                  <TableCell className="text-right">
                    <Bedrag centen={post.waardePerStukCenten} />
                  </TableCell>
                  <TableCell className="text-right">
                    <Bedrag centen={post.aantal * post.waardePerStukCenten} />
                  </TableCell>
                  <TableCell className="text-xs">
                    {post.begrotingspost ? (
                      <>
                        <span className="font-mono">
                          {post.begrotingspost.code}
                        </span>
                        <span className="block text-muted-foreground">
                          {post.begrotingspost.naam}
                        </span>
                      </>
                    ) : (
                      <span className="text-muted-foreground">
                        niet gekoppeld
                      </span>
                    )}
                  </TableCell>
                  <TableCell>{post.locatie || "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      ) : (
        <Melding toon="info">
          Er zijn nog geen spullen vastgelegd voor dit boekjaar.
        </Melding>
      )}
      {schrijfbaar &&
      !posten.length &&
      alleBoekjaren.some((jaar) => jaar.eindDatum < boekjaar.startDatum) ? (
        <div className="mt-4">
          <VoorraadOvernemen />
        </div>
      ) : null}
      <p className="mt-4 text-sm text-muted-foreground">
        De huidige waarde telt mee bij de activa op de{" "}
        <Link href="/balans" className="underline">
          balans
        </Link>
        . De voorraadmutatie staat apart in de{" "}
        <Link href="/exploitatie" className="underline">
          exploitatie
        </Link>
        . Bij verbruik verlaag je het huidige aantal; de beginvoorraad blijft
        staan.
      </p>
    </>
  );
}
