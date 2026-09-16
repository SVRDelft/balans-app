"use client";

import { useActionState } from "react";

import { Bedragveld } from "@/components/ui/bedragveld";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input, Textarea, Veld } from "@/components/ui/input";
import { Melding } from "@/components/ui/melding";
import type { ActieStaat } from "@/lib/acties";

import { bewaarBoekjaar } from "./acties";

export interface BoekjaarWaarden {
  id?: string;
  naam: string;
  factuurPrefix: string;
  startDatum: string;
  eindDatum: string;
  beginsaldoBank: string;
  beginsaldoEigenVermogen: string;
  notities: string;
}

export function BoekjaarFormulier({
  waarden,
  knoptekst = "Opslaan",
  boekjaren = [],
}: {
  waarden: BoekjaarWaarden;
  knoptekst?: string;
  boekjaren?: { id: string; naam: string }[];
}) {
  const [staat, actie, bezig] = useActionState<ActieStaat, FormData>(
    bewaarBoekjaar,
    {},
  );

  return (
    <form action={actie} className="space-y-4">
      {waarden.id ? <input type="hidden" name="id" value={waarden.id} /> : null}

      <Card>
        <CardContent className="grid gap-4 pt-5 sm:grid-cols-2">
          <Veld
            label="Naam"
            htmlFor={`naam-${waarden.id ?? "nieuw"}`}
            verplicht
            fout={staat.veldfouten?.naam}
          >
            <Input
              id={`naam-${waarden.id ?? "nieuw"}`}
              name="naam"
              defaultValue={waarden.naam}
              required
              placeholder="SVR 63 · 2027-2028"
            />
          </Veld>

          <Veld
            label="Voorvoegsel factuurnummers"
            htmlFor={`prefix-${waarden.id ?? "nieuw"}`}
            verplicht
            fout={staat.veldfouten?.factuurPrefix}
            toelichting={
              waarden.id
                ? "Kan niet meer gewijzigd worden: bestaande factuurnummers moeten blijven kloppen."
                : "Levert nummers op als SVR62-2026-0001."
            }
          >
            <Input
              id={`prefix-${waarden.id ?? "nieuw"}`}
              name="factuurPrefix"
              defaultValue={waarden.factuurPrefix}
              required
              readOnly={Boolean(waarden.id)}
              className="font-mono"
              placeholder="SVR63-2027"
            />
          </Veld>

          <Veld
            label="Startdatum"
            htmlFor={`start-${waarden.id ?? "nieuw"}`}
            verplicht
            fout={staat.veldfouten?.startDatum}
            toelichting="Het boekjaar van de SVR start in september."
          >
            <Input
              id={`start-${waarden.id ?? "nieuw"}`}
              name="startDatum"
              type="date"
              defaultValue={waarden.startDatum}
              required
            />
          </Veld>

          <Veld
            label="Einddatum"
            htmlFor={`eind-${waarden.id ?? "nieuw"}`}
            verplicht
            fout={staat.veldfouten?.eindDatum}
          >
            <Input
              id={`eind-${waarden.id ?? "nieuw"}`}
              name="eindDatum"
              type="date"
              defaultValue={waarden.eindDatum}
              required
            />
          </Veld>

          <Veld
            label="Beginsaldo bank"
            fout={staat.veldfouten?.beginsaldoBank}
            htmlFor={`bank-${waarden.id ?? "nieuw"}`}
            toelichting="Het banksaldo op de startdatum van het boekjaar."
          >
            <Bedragveld
              id={`bank-${waarden.id ?? "nieuw"}`}
              name="beginsaldoBank"
              defaultValue={waarden.beginsaldoBank}
            />
          </Veld>

          <Veld
            label="Beginsaldo eigen vermogen"
            fout={staat.veldfouten?.beginsaldoEigenVermogen}
            htmlFor={`ev-${waarden.id ?? "nieuw"}`}
            toelichting="Meestal gelijk aan het banksaldo, tenzij er nog vorderingen of schulden uit het vorige jaar openstaan."
          >
            <Bedragveld
              id={`ev-${waarden.id ?? "nieuw"}`}
              name="beginsaldoEigenVermogen"
              defaultValue={waarden.beginsaldoEigenVermogen}
            />
          </Veld>

          {!waarden.id && boekjaren.length > 0 ? (
            <Veld label="Begroting overnemen" htmlFor="kopieerVan" className="sm:col-span-2" toelichting="Neem de posten en begrote bedragen over. Je kunt ze daarna aanpassen; boekingen blijven in hun eigen jaar.">
              <select id="kopieerVan" name="kopieerVan" defaultValue="" className="veld">
                <option value="">Begin met een lege begroting</option>
                {boekjaren.map((jaar) => <option key={jaar.id} value={jaar.id}>{jaar.naam}</option>)}
              </select>
            </Veld>
          ) : null}
          <Veld
            label="Notities"
            htmlFor={`notities-${waarden.id ?? "nieuw"}`}
            className="sm:col-span-2"
          >
            <Textarea
              id={`notities-${waarden.id ?? "nieuw"}`}
              name="notities"
              defaultValue={waarden.notities}
              rows={2}
            />
          </Veld>
        </CardContent>
      </Card>

      {staat.fout ? <Melding toon="fout">{staat.fout}</Melding> : null}
      {staat.melding ? <Melding toon="goed">{staat.melding}</Melding> : null}

      <Button type="submit" disabled={bezig}>
        {bezig ? "Bezig…" : knoptekst}
      </Button>
    </form>
  );
}
