"use client";

import { useActionState, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input, Textarea, Veld } from "@/components/ui/input";
import { Melding } from "@/components/ui/melding";
import type { ActieStaat } from "@/lib/acties";

import { bewaarInstellingen } from "./acties";

export interface InstellingenWaarden {
  organisatieNaam: string;
  adres: string;
  postcode: string;
  plaats: string;
  email: string;
  iban: string;
  kvkNummer: string;
  btwPlichtig: boolean;
  btwPercentage: number;
  betaaltermijnDagen: number;
  factuurVoetnoot: string;
}

export function InstellingenFormulier({
  waarden,
}: {
  waarden: InstellingenWaarden;
}) {
  const [staat, actie, bezig] = useActionState<ActieStaat, FormData>(
    bewaarInstellingen,
    {},
  );
  const [btwPlichtig, setBtwPlichtig] = useState(waarden.btwPlichtig);

  return (
    <form action={actie} className="max-w-3xl space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Gegevens van de vereniging</CardTitle>
          <CardDescription>Deze gegevens staan op elke factuur.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Veld label="Naam" htmlFor="organisatieNaam" verplicht className="sm:col-span-2">
            <Input
              id="organisatieNaam"
              name="organisatieNaam"
              defaultValue={waarden.organisatieNaam}
              required
            />
          </Veld>

          <Veld label="Adres" htmlFor="adres" className="sm:col-span-2">
            <Input id="adres" name="adres" defaultValue={waarden.adres} />
          </Veld>

          <Veld label="Postcode" htmlFor="postcode">
            <Input id="postcode" name="postcode" defaultValue={waarden.postcode} />
          </Veld>

          <Veld label="Plaats" htmlFor="plaats">
            <Input id="plaats" name="plaats" defaultValue={waarden.plaats} />
          </Veld>

          <Veld label="E-mailadres" htmlFor="email">
            <Input id="email" name="email" type="email" defaultValue={waarden.email} />
          </Veld>

          <Veld
            label="IBAN"
            htmlFor="iban"
            toelichting="Komt op de factuur en in de herinneringstekst."
          >
            <Input id="iban" name="iban" defaultValue={waarden.iban} className="font-mono" />
          </Veld>

          <Veld label="KvK-nummer" htmlFor="kvkNummer">
            <Input id="kvkNummer" name="kvkNummer" defaultValue={waarden.kvkNummer} />
          </Veld>

          <Veld
            label="Betaaltermijn in dagen"
            htmlFor="betaaltermijnDagen"
            toelichting="Bepaalt de standaard vervaldatum van nieuwe facturen."
          >
            <Input
              id="betaaltermijnDagen"
              name="betaaltermijnDagen"
              inputMode="numeric"
              defaultValue={String(waarden.betaaltermijnDagen)}
              className="cijfers"
            />
          </Veld>

          <Veld
            label="Voetnoot op de factuur"
            htmlFor="factuurVoetnoot"
            className="sm:col-span-2"
          >
            <Textarea
              id="factuurVoetnoot"
              name="factuurVoetnoot"
              defaultValue={waarden.factuurVoetnoot}
              rows={2}
            />
          </Veld>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Btw</CardTitle>
          <CardDescription>
            De SVR is niet btw-plichtig, dus facturen tonen geen btw. Verandert
            dat, dan is dit de enige plek die je hoeft aan te passen.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              name="btwPlichtig"
              checked={btwPlichtig}
              onChange={(gebeurtenis) => setBtwPlichtig(gebeurtenis.target.checked)}
              className="size-4 rounded border-input"
            />
            De SVR is btw-plichtig
          </label>

          {btwPlichtig ? (
            <Veld
              label="Btw-percentage"
              htmlFor="btwPercentage"
              className="max-w-40"
            >
              <Input
                id="btwPercentage"
                name="btwPercentage"
                inputMode="numeric"
                defaultValue={String(waarden.btwPercentage)}
                className="cijfers"
              />
            </Veld>
          ) : (
            <input
              type="hidden"
              name="btwPercentage"
              value={String(waarden.btwPercentage)}
            />
          )}
        </CardContent>
      </Card>

      {staat.fout ? <Melding toon="fout">{staat.fout}</Melding> : null}
      {staat.melding ? <Melding toon="goed">{staat.melding}</Melding> : null}

      <Button type="submit" disabled={bezig}>
        {bezig ? "Bezig…" : "Opslaan"}
      </Button>
    </form>
  );
}
