import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";

import { Paginakop } from "@/components/paginakop";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
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
import {
  POST_CATEGORIEEN,
  POST_CATEGORIE_LABEL,
  POST_SOORTEN,
  POST_SOORT_LABEL,
  type PostCategorie,
  type PostSoort,
} from "@/lib/domein";

export const metadata: Metadata = { title: "Begroting" };

export default async function BegrotingPagina() {
  const { boekjaar, schrijfbaar } = await vereisBoekjaarContext();

  const posten = await db.begrotingspost.findMany({
    where: { boekjaarId: boekjaar.id },
    orderBy: [{ volgorde: "asc" }, { code: "asc" }],
  });

  const totaalInkomsten = posten
    .filter((post) => post.soort === "inkomst")
    .reduce((som, post) => som + post.begrootCenten, 0);
  const totaalUitgaven = posten
    .filter((post) => post.soort === "uitgave")
    .reduce((som, post) => som + post.begrootCenten, 0);

  return (
    <>
      <Paginakop
        titel="Begroting"
        beschrijving={`De posten van ${boekjaar.naam}. Elke factuurregel en elke uitgave wijst naar een van deze posten.`}
        acties={
          schrijfbaar ? (
            <Button asChild>
              <Link href="/begroting/nieuw">
                <Plus />
                Nieuwe post
              </Link>
            </Button>
          ) : null
        }
      />

      {posten.length === 0 ? (
        <Leeg titel="Nog geen begrotingsposten">
          Maak ze aan, of draai <code>npm run db:seed</code> voor de begroting
          van dit boekjaar.
        </Leeg>
      ) : (
        <div className="space-y-6">
          {POST_CATEGORIEEN.map((categorie) =>
            POST_SOORTEN.map((soort) => {
              const groep = posten.filter(
                (post) => post.categorie === categorie && post.soort === soort,
              );
              if (groep.length === 0) return null;

              return (
                <Card key={`${categorie}-${soort}`}>
                  <CardHeader>
                    <CardTitle>
                      {POST_CATEGORIE_LABEL[categorie as PostCategorie]} ·{" "}
                      {POST_SOORT_LABEL[soort as PostSoort].toLowerCase()}
                    </CardTitle>
                  </CardHeader>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-36">Code</TableHead>
                        <TableHead>Naam</TableHead>
                        <TableHead className="text-right">Begroot</TableHead>
                        <TableHead className="w-24" />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {groep.map((post) => (
                        <TableRow key={post.id}>
                          <TableCell className="font-mono text-xs">
                            {post.code}
                          </TableCell>
                          <TableCell>
                            {post.naam}
                            {post.notities ? (
                              <p className="text-xs text-muted-foreground">
                                {post.notities}
                              </p>
                            ) : null}
                          </TableCell>
                          <TableCell className="text-right">
                            <Bedrag centen={post.begrootCenten} />
                          </TableCell>
                          <TableCell className="text-right">
                            <Button variant="ghost" size="sm" asChild>
                              <Link href={`/begroting/${post.id}`}>
                                {schrijfbaar ? "Bewerken" : "Bekijken"}
                              </Link>
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                    <TableFooter>
                      <TableRow>
                        <TableCell colSpan={2}>Subtotaal</TableCell>
                        <TableCell className="text-right">
                          <Bedrag
                            centen={groep.reduce(
                              (som, post) => som + post.begrootCenten,
                              0,
                            )}
                          />
                        </TableCell>
                        <TableCell />
                      </TableRow>
                    </TableFooter>
                  </Table>
                </Card>
              );
            }),
          )}

          <Card>
            <Table>
              <TableFooter>
                <TableRow>
                  <TableCell>Totaal begrote inkomsten</TableCell>
                  <TableCell className="text-right">
                    <Bedrag centen={totaalInkomsten} />
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>Totaal begrote uitgaven</TableCell>
                  <TableCell className="text-right">
                    <Bedrag centen={totaalUitgaven} />
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="font-semibold">
                    Begroot eindsaldo
                  </TableCell>
                  <TableCell className="text-right font-semibold">
                    <Bedrag centen={totaalInkomsten - totaalUitgaven} />
                  </TableCell>
                </TableRow>
              </TableFooter>
            </Table>
          </Card>
        </div>
      )}
    </>
  );
}
