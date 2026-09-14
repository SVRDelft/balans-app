"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { Wand2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input, Select, Veld } from "@/components/ui/input";
import { Melding } from "@/components/ui/melding";
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
import { formatteerEuro } from "@/lib/geld";
import type { ActieStaat } from "@/lib/acties";

import { genereerJaarfacturen } from "../acties";

interface Post {
  id: string;
  code: string;
  naam: string;
  begrootCenten: number;
}

export function JaarfactuurFormulier({
  posten,
  verenigingen,
  verdelingPerPost,
  alGefactureerd,
  vandaag,
}: {
  posten: Post[];
  verenigingen: { id: string; naam: string }[];
  verdelingPerPost: Record<string, number[]>;
  alGefactureerd: Record<string, string[]>;
  vandaag: string;
}) {
  const [staat, actie, bezig] = useActionState<ActieStaat, FormData>(
    genereerJaarfacturen,
    {},
  );
  const [postId, setPostId] = useState(posten[0]?.id ?? "");

  const post = posten.find((kandidaat) => kandidaat.id === postId);
  const verdeling = verdelingPerPost[postId] ?? [];
  const gedaan = new Set(alGefactureerd[postId] ?? []);
  const nogTeDoen = verenigingen.filter(
    (vereniging) => !gedaan.has(vereniging.id),
  );

  return (
    <div className="max-w-3xl space-y-4">
      <form action={actie} className="space-y-4">
        <Card>
          <CardContent className="grid gap-4 pt-5 sm:grid-cols-2">
            <Veld label="Begrotingspost" htmlFor="begrotingspostId" verplicht>
              <Select
                id="begrotingspostId"
                name="begrotingspostId"
                value={postId}
                onChange={(gebeurtenis) => setPostId(gebeurtenis.target.value)}
              >
                {posten.map((kandidaat) => (
                  <option key={kandidaat.id} value={kandidaat.id}>
                    {kandidaat.code} — {kandidaat.naam} (
                    {formatteerEuro(kandidaat.begrootCenten)})
                  </option>
                ))}
              </Select>
            </Veld>

            <Veld
              label="Factuurdatum"
              htmlFor="factuurdatum"
              verplicht
              toelichting="De vervaldatum volgt uit de betaaltermijn bij Instellingen."
            >
              <Input
                id="factuurdatum"
                name="factuurdatum"
                type="date"
                defaultValue={vandaag}
                required
              />
            </Veld>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Wat er gemaakt wordt</CardTitle>
            <CardDescription>
              {post
                ? `${formatteerEuro(post.begrootCenten)} wordt exact verdeeld over ${verenigingen.length} bijdrageplichtige verenigingen.`
                : null}
            </CardDescription>
          </CardHeader>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Studievereniging</TableHead>
                <TableHead className="text-right">Bedrag</TableHead>
                <TableHead className="text-right">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {verenigingen.map((vereniging, index) => (
                <TableRow key={vereniging.id}>
                  <TableCell>{vereniging.naam}</TableCell>
                  <TableCell className="text-right">
                    <Bedrag centen={verdeling[index] ?? 0} />
                  </TableCell>
                  <TableCell className="text-right text-xs text-muted-foreground">
                    {gedaan.has(vereniging.id)
                      ? "heeft al een factuur"
                      : "wordt aangemaakt"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell>Totaal</TableCell>
                <TableCell className="text-right">
                  <Bedrag
                    centen={verdeling.reduce((som, bedrag) => som + bedrag, 0)}
                  />
                </TableCell>
                <TableCell className="text-right text-xs text-muted-foreground">
                  {nogTeDoen.length} nieuw
                </TableCell>
              </TableRow>
            </TableFooter>
          </Table>
        </Card>

        {staat.fout ? <Melding toon="fout">{staat.fout}</Melding> : null}
        {staat.melding ? (
          <Melding toon="goed" titel="Gelukt">
            <p>{staat.melding}</p>
            <p className="mt-1">
              <Link href="/facturen?status=concept" className="underline">
                Naar de concepten
              </Link>
            </p>
          </Melding>
        ) : null}

        <Button type="submit" disabled={bezig || nogTeDoen.length === 0}>
          <Wand2 />
          {bezig
            ? "Bezig…"
            : `${nogTeDoen.length} conceptfacturen aanmaken`}
        </Button>
      </form>
    </div>
  );
}
