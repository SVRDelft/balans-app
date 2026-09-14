"use client";

import { useActionState, useState } from "react";
import Image from "next/image";
import {
  ExtraContactvelden,
  type ExtraContactWaarden,
} from "@/components/contactvelden";

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

export interface InstellingenWaarden extends ExtraContactWaarden {
  contactpersoon: string;
  logoNaam: string;
  eigenLogo: boolean;
  logoVersie: string;
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
          <CardDescription>
            Deze gegevens staan op elke factuur.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Veld
            label="Naam"
            htmlFor="organisatieNaam"
            verplicht
            className="sm:col-span-2"
          >
            <Input
              id="organisatieNaam"
              name="organisatieNaam"
              maxLength={120}
              defaultValue={waarden.organisatieNaam}
              required
            />
          </Veld>

          <Veld
            label="Contactpersoon"
            htmlFor="contactpersoon"
            fout={staat.veldfouten?.contactpersoon}
          >
            <Input
              id="contactpersoon"
              name="contactpersoon"
              maxLength={120}
              defaultValue={waarden.contactpersoon}
            />
          </Veld>

          <Veld label="Adres" htmlFor="adres" className="sm:col-span-2">
            <Input id="adres" name="adres" defaultValue={waarden.adres} />
          </Veld>

          <Veld label="Postcode" htmlFor="postcode">
            <Input
              id="postcode"
              name="postcode"
              defaultValue={waarden.postcode}
            />
          </Veld>

          <Veld label="Plaats" htmlFor="plaats">
            <Input id="plaats" name="plaats" defaultValue={waarden.plaats} />
          </Veld>

          <Veld
            label="E-mailadres"
            htmlFor="email"
            fout={staat.veldfouten?.email}
          >
            <Input
              id="email"
              name="email"
              type="email"
              defaultValue={waarden.email}
            />
          </Veld>

          <Veld
            label="IBAN"
            htmlFor="iban"
            toelichting="Komt op de factuur en in de herinneringstekst."
          >
            <Input
              id="iban"
              name="iban"
              defaultValue={waarden.iban}
              className="font-mono"
            />
          </Veld>

          <Veld label="KvK-nummer" htmlFor="kvkNummer">
            <Input
              id="kvkNummer"
              name="kvkNummer"
              defaultValue={waarden.kvkNummer}
            />
          </Veld>

          <ExtraContactvelden
            waarden={waarden}
            fouten={staat.veldfouten}
            toonBank={false}
          />

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
              maxLength={500}
              defaultValue={waarden.factuurVoetnoot}
              rows={2}
            />
          </Veld>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Logo op PDF’s</CardTitle>
          <CardDescription>
            Dit logo staat op facturen en de financiële overdracht.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <Image
              src={`/api/logo?v=${encodeURIComponent(waarden.logoVersie)}`}
              alt="Logo van de SVR"
              width={88}
              height={88}
              unoptimized
              className="rounded border bg-white object-contain"
            />
            <span className="text-sm text-muted-foreground">
              {waarden.logoNaam}
            </span>
          </div>
          <Veld
            label="Nieuw logo"
            htmlFor="logo"
            toelichting="PNG of JPG, maximaal 2 MB en 16 megapixels."
          >
            <Input
              id="logo"
              name="logo"
              type="file"
              accept="image/png,image/jpeg"
              onChange={(event) => {
                const invoer = event.currentTarget;
                invoer.setCustomValidity(
                  (invoer.files?.[0]?.size ?? 0) > 2_000_000
                    ? "Het logo mag maximaal 2 MB zijn."
                    : "",
                );
                invoer.reportValidity();
              }}
            />
          </Veld>
          {waarden.eigenLogo ? (
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="standaardLogo" />
              Standaard SVR-logo herstellen
            </label>
          ) : null}
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
              onChange={(gebeurtenis) =>
                setBtwPlichtig(gebeurtenis.target.checked)
              }
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
