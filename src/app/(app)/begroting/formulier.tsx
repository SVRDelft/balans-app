"use client";

import Link from "next/link";
import { useActionState } from "react";

import { Bedragveld } from "@/components/ui/bedragveld";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input, Select, Textarea, Veld } from "@/components/ui/input";
import { Melding } from "@/components/ui/melding";
import {
  POST_CATEGORIEEN,
  POST_CATEGORIE_LABEL,
  POST_SOORTEN,
  POST_SOORT_LABEL,
} from "@/lib/domein";
import type { ActieStaat } from "@/lib/acties";

import { bewaarBegrotingspost } from "./acties";

export interface PostWaarden {
  id?: string;
  code: string;
  naam: string;
  categorie: string;
  soort: string;
  begroot: string;
  notities: string;
}

export const LEGE_POST: PostWaarden = {
  code: "",
  naam: "",
  categorie: "vast",
  soort: "uitgave",
  begroot: "",
  notities: "",
};

export function BegrotingspostFormulier({
  waarden,
}: {
  waarden: PostWaarden;
}) {
  const [staat, actie, bezig] = useActionState<ActieStaat, FormData>(
    bewaarBegrotingspost,
    {},
  );

  return (
    <form action={actie} className="max-w-2xl space-y-4">
      {waarden.id ? <input type="hidden" name="id" value={waarden.id} /> : null}

      <Card>
        <CardContent className="grid gap-4 pt-5 sm:grid-cols-2">
          <Veld
            label="Code"
            htmlFor="code"
            verplicht
            fout={staat.veldfouten?.code}
            toelichting="Kort en uniek binnen het boekjaar, bijvoorbeeld LBG-UIT."
          >
            <Input
              id="code"
              name="code"
              defaultValue={waarden.code}
              required
              maxLength={30}
              className="font-mono uppercase"
            />
          </Veld>

          <Veld
            label="Naam"
            htmlFor="naam"
            verplicht
            fout={staat.veldfouten?.naam}
          >
            <Input id="naam" name="naam" defaultValue={waarden.naam} required />
          </Veld>

          <Veld
            label="Categorie"
            htmlFor="categorie"
            verplicht
            toelichting="Vast: betaald uit de bijdragen. Omslag: doorbelast aan deelnemers."
          >
            <Select
              id="categorie"
              name="categorie"
              defaultValue={waarden.categorie}
            >
              {POST_CATEGORIEEN.map((categorie) => (
                <option key={categorie} value={categorie}>
                  {POST_CATEGORIE_LABEL[categorie]}
                </option>
              ))}
            </Select>
          </Veld>

          <Veld label="Soort" htmlFor="soort" verplicht>
            <Select id="soort" name="soort" defaultValue={waarden.soort}>
              {POST_SOORTEN.map((soort) => (
                <option key={soort} value={soort}>
                  {POST_SOORT_LABEL[soort]}
                </option>
              ))}
            </Select>
          </Veld>

          <Veld
            label="Begroot bedrag"
            htmlFor="begroot"
            fout={staat.veldfouten?.begroot}
          >
            <Bedragveld id="begroot" name="begroot" defaultValue={waarden.begroot} />
          </Veld>

          <Veld label="Notities" htmlFor="notities" className="sm:col-span-2">
            <Textarea
              id="notities"
              name="notities"
              defaultValue={waarden.notities}
              rows={2}
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
          <Link href="/begroting">Annuleren</Link>
        </Button>
      </div>
    </form>
  );
}
