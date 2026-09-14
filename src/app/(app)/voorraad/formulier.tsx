"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Bedragveld } from "@/components/ui/bedragveld";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Textarea, Veld } from "@/components/ui/input";
import { Melding } from "@/components/ui/melding";
import type { ActieStaat } from "@/lib/acties";
import { bewaarVoorraad, neemVoorraadOver, verwijderVoorraad } from "./acties";

export interface VoorraadWaarden {
  id?: string;
  naam: string;
  eenheid: string;
  beginAantal: number;
  beginWaardePerStukCenten: number;
  aantal: number;
  waardePerStukCenten: number;
  locatie: string;
  notities: string;
}

export const LEGE_VOORRAAD: VoorraadWaarden = {
  naam: "",
  eenheid: "stuks",
  beginAantal: 0,
  beginWaardePerStukCenten: 0,
  aantal: 0,
  waardePerStukCenten: 0,
  locatie: "",
  notities: "",
};

export function VoorraadFormulier({
  waarden = LEGE_VOORRAAD,
}: {
  waarden?: VoorraadWaarden;
}) {
  const [staat, actie, bezig] = useActionState<ActieStaat, FormData>(
    bewaarVoorraad,
    {},
  );
  return (
    <form action={actie} className="max-w-3xl space-y-4">
      {waarden.id ? <input type="hidden" name="id" value={waarden.id} /> : null}
      <Card>
        <CardHeader>
          <CardTitle>
            {waarden.id ? "Spullen bewerken" : "Spullen toevoegen"}
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Veld
            label="Naam"
            htmlFor="naam"
            verplicht
            fout={staat.veldfouten?.naam}
          >
            <Input
              id="naam"
              name="naam"
              required
              maxLength={120}
              defaultValue={waarden.naam}
              placeholder="Bijvoorbeeld: SVR-dassen"
            />
          </Veld>
          <Veld
            label="Eenheid"
            htmlFor="eenheid"
            verplicht
            fout={staat.veldfouten?.eenheid}
          >
            <Input
              id="eenheid"
              name="eenheid"
              required
              maxLength={30}
              defaultValue={waarden.eenheid}
              placeholder="stuks, dozen, sets"
            />
          </Veld>
          <Veld
            label="Aantal begin boekjaar"
            htmlFor="beginAantal"
            verplicht
            fout={staat.veldfouten?.beginAantal}
          >
            <Input
              id="beginAantal"
              name="beginAantal"
              type="number"
              min={0}
              max={1_000_000}
              step={1}
              required
              defaultValue={waarden.beginAantal}
            />
          </Veld>
          <Veld
            label="Beginwaarde per stuk"
            htmlFor="beginWaardePerStukCenten"
            verplicht
            fout={staat.veldfouten?.beginWaardePerStukCenten}
          >
            <Bedragveld
              id="beginWaardePerStukCenten"
              name="beginWaardePerStukCenten"
              required
              defaultValue={(waarden.beginWaardePerStukCenten / 100).toFixed(2)}
            />
          </Veld>
          <Veld
            label="Aantal nu aanwezig"
            htmlFor="aantal"
            verplicht
            fout={staat.veldfouten?.aantal}
          >
            <Input
              id="aantal"
              name="aantal"
              type="number"
              min={0}
              max={1_000_000}
              step={1}
              required
              defaultValue={waarden.aantal}
            />
          </Veld>
          <Veld
            label="Huidige waarde per stuk"
            htmlFor="waardePerStukCenten"
            verplicht
            fout={staat.veldfouten?.waardePerStukCenten}
            toelichting="Gebruik de kostprijs of een lagere boekwaarde, niet de verkoopprijs."
          >
            <Bedragveld
              id="waardePerStukCenten"
              name="waardePerStukCenten"
              required
              defaultValue={(waarden.waardePerStukCenten / 100).toFixed(2)}
            />
          </Veld>
          <Veld
            label="Bewaarplaats"
            htmlFor="locatie"
            className="sm:col-span-2"
            fout={staat.veldfouten?.locatie}
          >
            <Input
              id="locatie"
              name="locatie"
              maxLength={200}
              defaultValue={waarden.locatie}
              placeholder="Bijvoorbeeld: kast op het SVR-hok"
            />
          </Veld>
          <Veld
            label="Toelichting op aantallen en waarde"
            htmlFor="notities"
            className="sm:col-span-2"
            fout={staat.veldfouten?.notities}
          >
            <Textarea
              id="notities"
              name="notities"
              maxLength={2000}
              rows={3}
              defaultValue={waarden.notities}
            />
          </Veld>
        </CardContent>
      </Card>
      <Melding toon="info">
        Registreer nieuwe aankopen ook bij Uitgaven. De verandering in
        voorraadwaarde wordt apart in het resultaat verwerkt. Spullen die er bij
        de start al waren, vul je ook bij de beginvoorraad in.
      </Melding>
      {staat.fout ? <Melding toon="fout">{staat.fout}</Melding> : null}
      <div className="flex gap-2">
        <Button disabled={bezig}>{bezig ? "Bezig…" : "Opslaan"}</Button>
        <Button type="button" variant="outline" asChild>
          <Link href="/voorraad">Annuleren</Link>
        </Button>
      </div>
    </form>
  );
}

export function VoorraadOvernemen() {
  const [staat, actie, bezig] = useActionState<ActieStaat, FormData>(
    neemVoorraadOver,
    {},
  );
  return (
    <form action={actie} className="space-y-3">
      <Button variant="outline" disabled={bezig}>
        Neem vorig boekjaar over
      </Button>
      {staat.fout ? <Melding toon="fout">{staat.fout}</Melding> : null}
      {staat.melding ? <Melding toon="goed">{staat.melding}</Melding> : null}
    </form>
  );
}

export function LegeVoorraadVerwijderen({ id }: { id: string }) {
  const [staat, actie, bezig] = useActionState<ActieStaat, FormData>(
    verwijderVoorraad,
    {},
  );
  return (
    <form
      action={actie}
      className="mt-6 space-y-2"
      onSubmit={(event) => {
        if (!window.confirm("Deze lege voorraadpost verwijderen?"))
          event.preventDefault();
      }}
    >
      <input type="hidden" name="id" value={id} />
      <Button variant="outline" disabled={bezig}>
        Lege post verwijderen
      </Button>
      {staat.fout ? <Melding toon="fout">{staat.fout}</Melding> : null}
    </form>
  );
}
