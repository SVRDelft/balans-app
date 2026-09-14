"use client";

import Link from "next/link";
import { useActionState, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input, Select, Textarea, Veld } from "@/components/ui/input";
import { Melding } from "@/components/ui/melding";
import { RELATIE_TYPES, RELATIE_TYPE_LABEL } from "@/lib/domein";
import type { ActieStaat } from "@/lib/acties";
import {
  ExtraContactvelden,
  type ExtraContactWaarden,
} from "@/components/contactvelden";

import { bewaarRelatie } from "./acties";

export interface RelatieWaarden extends ExtraContactWaarden {
  id?: string;
  type: string;
  naam: string;
  contactpersoon: string;
  email: string;
  adres: string;
  postcode: string;
  plaats: string;
  actief: boolean;
  bijdragePlichtig: boolean;
  notities: string;
}

export const LEGE_RELATIE: RelatieWaarden = {
  type: "studievereniging",
  naam: "",
  contactpersoon: "",
  email: "",
  adres: "",
  postcode: "",
  plaats: "",
  land: "Nederland",
  telefoon: "",
  website: "",
  kvkNummer: "",
  btwNummer: "",
  iban: "",
  actief: true,
  bijdragePlichtig: true,
  notities: "",
};

export function RelatieFormulier({ waarden }: { waarden: RelatieWaarden }) {
  const [staat, actie, bezig] = useActionState<ActieStaat, FormData>(
    bewaarRelatie,
    {},
  );
  const [type, setType] = useState(waarden.type);

  return (
    <form action={actie} className="max-w-2xl space-y-4">
      {waarden.id ? <input type="hidden" name="id" value={waarden.id} /> : null}

      <Card>
        <CardContent className="grid gap-4 pt-5 sm:grid-cols-2">
          <Veld label="Soort relatie" htmlFor="type" verplicht>
            <Select
              id="type"
              name="type"
              defaultValue={waarden.type}
              onChange={(gebeurtenis) => setType(gebeurtenis.target.value)}
            >
              {RELATIE_TYPES.map((soort) => (
                <option key={soort} value={soort}>
                  {RELATIE_TYPE_LABEL[soort]}
                </option>
              ))}
            </Select>
          </Veld>

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
              maxLength={120}
            />
          </Veld>

          <Veld label="Contactpersoon" htmlFor="contactpersoon">
            <Input
              id="contactpersoon"
              name="contactpersoon"
              defaultValue={waarden.contactpersoon}
            />
          </Veld>

          <Veld
            label="E-mailadres"
            htmlFor="email"
            fout={staat.veldfouten?.email}
            toelichting="Gebruikt in de tekst van herinneringsmails."
          >
            <Input
              id="email"
              name="email"
              type="email"
              defaultValue={waarden.email}
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

          <ExtraContactvelden waarden={waarden} fouten={staat.veldfouten} />

          <Veld label="Notities" htmlFor="notities" className="sm:col-span-2">
            <Textarea
              id="notities"
              name="notities"
              defaultValue={waarden.notities}
              rows={3}
            />
          </Veld>

          <div className="space-y-2 sm:col-span-2">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                name="actief"
                defaultChecked={waarden.actief}
                className="size-4 rounded border-input"
              />
              Actief
            </label>

            {type === "studievereniging" ? (
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  name="bijdragePlichtig"
                  defaultChecked={waarden.bijdragePlichtig}
                  className="size-4 rounded border-input"
                />
                Bijdrageplichtig — krijgt de jaarlijkse bijdragefactuur
              </label>
            ) : null}
          </div>
        </CardContent>
      </Card>

      {staat.fout ? <Melding toon="fout">{staat.fout}</Melding> : null}

      <div className="flex gap-2">
        <Button type="submit" disabled={bezig}>
          {bezig ? "Bezig…" : "Opslaan"}
        </Button>
        <Button type="button" variant="outline" asChild>
          <Link href="/relaties">Annuleren</Link>
        </Button>
      </div>
    </form>
  );
}
