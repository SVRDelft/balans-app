import type { Metadata } from "next";
import Link from "next/link";
import { Paperclip, Plus } from "lucide-react";

import { Paginakop } from "@/components/paginakop";
import { Badge } from "@/components/ui/badge";
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
import { formatteerDatum } from "@/lib/datum";

export const metadata: Metadata = { title: "Uitgaven" };

export default async function UitgavenPagina({
  searchParams,
}: PageProps<"/uitgaven">) {
  const { boekjaar, schrijfbaar } = await vereisBoekjaarContext();
  const parameters = await searchParams;

  const postFilter = typeof parameters.post === "string" ? parameters.post : "";
  const evenementFilter =
    typeof parameters.evenement === "string" ? parameters.evenement : "";
  const betaaldFilter =
    typeof parameters.betaald === "string" ? parameters.betaald : "";

  const [uitgaven, posten, evenementen] = await Promise.all([
    db.uitgave.findMany({
      where: {
        boekjaarId: boekjaar.id,
        ...(postFilter ? { begrotingspostId: postFilter } : {}),
        ...(evenementFilter ? { evenementId: evenementFilter } : {}),
        ...(betaaldFilter === "ja"
          ? { betaald: true }
          : betaaldFilter === "nee"
            ? { betaald: false }
            : {}),
      },
      include: {
        begrotingspost: { select: { code: true, naam: true } },
        evenement: { select: { id: true, naam: true } },
      },
      orderBy: [{ datum: "desc" }, { aangemaaktOp: "desc" }],
    }),
    db.begrotingspost.findMany({
      where: { boekjaarId: boekjaar.id },
      orderBy: { volgorde: "asc" },
      select: { id: true, code: true, naam: true },
    }),
    db.evenement.findMany({
      where: { boekjaarId: boekjaar.id },
      orderBy: { datum: "asc" },
      select: { id: true, naam: true },
    }),
  ]);

  const totaal = uitgaven.reduce((som, uitgave) => som + uitgave.bedragCenten, 0);
  const onbetaald = uitgaven
    .filter((uitgave) => !uitgave.betaald)
    .reduce((som, uitgave) => som + uitgave.bedragCenten, 0);

  return (
    <>
      <Paginakop
        titel="Uitgaven"
        beschrijving={`${uitgaven.length} ${uitgaven.length === 1 ? "uitgave" : "uitgaven"} in ${boekjaar.naam}.`}
        acties={
          schrijfbaar ? (
            <Button asChild>
              <Link href="/uitgaven/nieuw">
                <Plus />
                Nieuwe uitgave
              </Link>
            </Button>
          ) : null
        }
      />

      <form
        method="get"
        className="mb-4 flex flex-wrap items-end gap-3 niet-afdrukken"
      >
        <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
          Begrotingspost
          <select name="post" defaultValue={postFilter} className="veld w-64">
            <option value="">Alle</option>
            {posten.map((post) => (
              <option key={post.id} value={post.id}>
                {post.code} — {post.naam}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
          Evenement
          <select
            name="evenement"
            defaultValue={evenementFilter}
            className="veld w-52"
          >
            <option value="">Alle</option>
            {evenementen.map((evenement) => (
              <option key={evenement.id} value={evenement.id}>
                {evenement.naam}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
          Betaald
          <select name="betaald" defaultValue={betaaldFilter} className="veld w-36">
            <option value="">Alle</option>
            <option value="ja">Wel betaald</option>
            <option value="nee">Nog niet betaald</option>
          </select>
        </label>

        <Button type="submit" variant="secondary" size="sm">
          Filteren
        </Button>
        {postFilter || evenementFilter || betaaldFilter ? (
          <Button type="button" variant="ghost" size="sm" asChild>
            <Link href="/uitgaven">Wissen</Link>
          </Button>
        ) : null}
      </form>

      {uitgaven.length === 0 ? (
        <Leeg titel="Geen uitgaven gevonden">
          Registreer er een, of pas de filters aan.
        </Leeg>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Datum</TableHead>
                <TableHead>Leverancier</TableHead>
                <TableHead>Omschrijving</TableHead>
                <TableHead>Post</TableHead>
                <TableHead>Evenement</TableHead>
                <TableHead className="text-right">Bedrag</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {uitgaven.map((uitgave) => (
                <TableRow key={uitgave.id}>
                  <TableCell className="cijfers whitespace-nowrap">
                    <Link
                      href={`/uitgaven/${uitgave.id}`}
                      className="hover:underline"
                    >
                      {formatteerDatum(uitgave.datum)}
                    </Link>
                  </TableCell>
                  <TableCell>
                    {uitgave.leverancierNaam}
                    {uitgave.bijlageId ? (
                      <Paperclip className="ml-1 inline size-3 text-muted-foreground" />
                    ) : null}
                  </TableCell>
                  <TableCell className="max-w-64 truncate">
                    <Link
                      href={`/uitgaven/${uitgave.id}`}
                      className="hover:underline"
                    >
                      {uitgave.omschrijving}
                    </Link>
                    <div className="mt-0.5 flex flex-wrap gap-1">
                      {!uitgave.bedragDefinitief ? (
                        <Badge variant="waarschuwing">Nog niet definitief</Badge>
                      ) : null}
                      {!uitgave.betaald ? (
                        <Badge variant="omlijnd">Nog te betalen</Badge>
                      ) : null}
                      {uitgave.tenLasteVanSvr ? (
                        <Badge variant="fout">Ten laste van SVR</Badge>
                      ) : null}
                    </div>
                  </TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    {uitgave.begrotingspost.code}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {uitgave.evenement ? (
                      <Link
                        href={`/evenementen/${uitgave.evenement.id}`}
                        className="hover:underline"
                      >
                        {uitgave.evenement.naam}
                      </Link>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <Bedrag centen={uitgave.bedragCenten} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell colSpan={5}>Totaal</TableCell>
                <TableCell className="text-right">
                  <Bedrag centen={totaal} />
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell colSpan={5}>Waarvan nog te betalen</TableCell>
                <TableCell className="text-right">
                  <Bedrag centen={onbetaald} />
                </TableCell>
              </TableRow>
            </TableFooter>
          </Table>
        </Card>
      )}
    </>
  );
}
