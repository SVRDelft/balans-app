"use client";

import Link from "next/link";
import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input, Select, Textarea, Veld } from "@/components/ui/input";
import { Melding } from "@/components/ui/melding";
import type { ActieStaat } from "@/lib/acties";

import { bewaarEvenement } from "./acties";

export interface EvenementWaarden {
  id?: string;
  naam: string;
  datum: string;
  kostenpostId: string;
  opbrengstpostId: string;
  notities: string;
}

export function EvenementFormulier({
  waarden,
  kostenposten,
  opbrengstposten,
}: {
  waarden: EvenementWaarden;
  kostenposten: { id: string; code: string; naam: string }[];
  opbrengstposten: { id: string; code: string; naam: string }[];
}) {
  const [staat, actie, bezig] = useActionState<ActieStaat, FormData>(
    bewaarEvenement,
    {},
  );

  return (
    <form action={actie} className="max-w-2xl space-y-4">
      {waarden.id ? <input type="hidden" name="id" value={waarden.id} /> : null}

      <Card>
        <CardContent className="grid gap-4 pt-5 sm:grid-cols-2">
          <Veld
            label="Naam"
            htmlFor="naam"
            verplicht
            fout={staat.veldfouten?.naam}
          >
            <Input
              id="naam"
              name="naam"
              defaultValue={waarden.naam}
              required
              placeholder="Bijvoorbeeld: LBG 2027"
            />
          </Veld>

          <Veld
            label="Datum"
            htmlFor="datum"
            verplicht
            fout={staat.veldfouten?.datum}
          >
            <Input
              id="datum"
              name="datum"
              type="date"
              defaultValue={waarden.datum}
              required
            />
          </Veld>

          <Veld
            label="Kostenpost"
            htmlFor="kostenpostId"
            toelichting="Waar de uitgaven van dit evenement thuishoren."
          >
            <Select
              id="kostenpostId"
              name="kostenpostId"
              defaultValue={waarden.kostenpostId}
            >
              <option value="">Geen</option>
              {kostenposten.map((post) => (
                <option key={post.id} value={post.id}>
                  {post.code} — {post.naam}
                </option>
              ))}
            </Select>
          </Veld>

          <Veld
            label="Opbrengstpost"
            htmlFor="opbrengstpostId"
            toelichting="Verplicht om de omslag te kunnen berekenen: hierop komen de facturen aan de deelnemers."
          >
            <Select
              id="opbrengstpostId"
              name="opbrengstpostId"
              defaultValue={waarden.opbrengstpostId}
            >
              <option value="">Geen</option>
              {opbrengstposten.map((post) => (
                <option key={post.id} value={post.id}>
                  {post.code} — {post.naam}
                </option>
              ))}
            </Select>
          </Veld>

          <Veld label="Notities" htmlFor="notities" className="sm:col-span-2">
            <Textarea
              id="notities"
              name="notities"
              defaultValue={waarden.notities}
              rows={3}
            />
          </Veld>
        </CardContent>
      </Card>

      {staat.fout ? <Melding toon="fout">{staat.fout}</Melding> : null}

      <div className="flex gap-2">
        <Button type="submit" disabled={bezig}>
          {bezig ? "Bezig…" : "Opslaan"}
        </Button>
        <Button type="button" variant="outline" asChild>
          <Link
            href={waarden.id ? `/evenementen/${waarden.id}` : "/evenementen"}
          >
            Annuleren
          </Link>
        </Button>
      </div>
    </form>
  );
}
