"use client";

import { useActionState, useState } from "react";
import { Megaphone, Plus, Upload } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Select, Textarea, Veld } from "@/components/ui/input";
import { Melding } from "@/components/ui/melding";
import type { ActieStaat } from "@/lib/acties";

import { bewaarMededeling, bewaarVergadering, uploadBestand } from "./acties";

export function MededelingFormulier() {
  const [staat, actie, bezig] = useActionState<ActieStaat, FormData>(bewaarMededeling, {});

  return (
    <Card>
      <CardHeader>
        <CardTitle>Mededeling plaatsen</CardTitle>
      </CardHeader>
      <CardContent>
        <form action={actie} className="space-y-4">
          <Veld label="Titel" htmlFor="titel" verplicht>
            <Input id="titel" name="titel" required maxLength={150} />
          </Veld>
          <Veld
            label="Bericht"
            htmlFor="tekst"
            verplicht
            toelichting="Komt bovenaan in het portaal te staan, voor alle verenigingen."
          >
            <Textarea id="tekst" name="tekst" required rows={4} />
          </Veld>
          {staat.fout ? <Melding toon="fout">{staat.fout}</Melding> : null}
          {staat.melding ? <Melding toon="goed">{staat.melding}</Melding> : null}
          <Button type="submit" disabled={bezig}>
            <Megaphone />
            {bezig ? "Bezig…" : "Plaatsen"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

export function VergaderingFormulier({
  verenigingen,
  vandaag,
}: {
  verenigingen: { id: string; naam: string }[];
  vandaag: string;
}) {
  const [staat, actie, bezig] = useActionState<ActieStaat, FormData>(bewaarVergadering, {});

  return (
    <Card>
      <CardHeader>
        <CardTitle>Vergadering toevoegen</CardTitle>
      </CardHeader>
      <CardContent>
        <form action={actie} className="grid gap-4 sm:grid-cols-2">
          <Veld label="Overleg" htmlFor="reeks" verplicht>
            <Select id="reeks" name="reeks" defaultValue="SVR">
              <option value="SVR">SVR · voorzitters</option>
              <option value="SVR-O">SVR-O · onderwijs</option>
              <option value="SVeuRo">SVeuRo · penningmeesters</option>
              <option value="SVjwR">SVjwR · eerstejaarsweekenden</option>
            </Select>
          </Veld>
          <Veld label="Ontvangende vereniging" htmlFor="gastheerId">
            <Select id="gastheerId" name="gastheerId" defaultValue="">
              <option value="">Nog niet bekend</option>
              {verenigingen.map((vereniging) => (
                <option key={vereniging.id} value={vereniging.id}>
                  {vereniging.naam}
                </option>
              ))}
            </Select>
          </Veld>
          <Veld label="Datum" htmlFor="datum" verplicht>
            <Input id="datum" name="datum" type="date" defaultValue={vandaag} required />
          </Veld>
          <Veld label="Begintijd" htmlFor="tijd" verplicht>
            <Input id="tijd" name="tijd" defaultValue="14:00" required placeholder="14:00" />
          </Veld>
          <Veld label="Notitie" htmlFor="notitie" className="sm:col-span-2">
            <Textarea id="notitie" name="notitie" rows={2} />
          </Veld>
          <div className="sm:col-span-2">
            {staat.fout ? <Melding toon="fout">{staat.fout}</Melding> : null}
            {staat.melding ? <Melding toon="goed">{staat.melding}</Melding> : null}
          </div>
          <div className="sm:col-span-2">
            <Button type="submit" disabled={bezig}>
              <Plus />
              {bezig ? "Bezig…" : "Vergadering toevoegen"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

export function UploadFormulier({
  vergaderingen,
  toegestaan,
}: {
  vergaderingen: { id: string; label: string }[];
  toegestaan: string;
}) {
  const [staat, actie, bezig] = useActionState<ActieStaat, FormData>(uploadBestand, {});
  const [soort, setSoort] = useState("agenda");

  return (
    <Card>
      <CardHeader>
        <CardTitle>Bestand toevoegen</CardTitle>
      </CardHeader>
      <CardContent>
        <form action={actie} className="grid gap-4 sm:grid-cols-2">
          <Veld label="Soort" htmlFor="soort" verplicht>
            <Select
              id="soort"
              name="soort"
              value={soort}
              onChange={(gebeurtenis) => setSoort(gebeurtenis.target.value)}
            >
              <option value="agenda">Agenda bij een vergadering</option>
              <option value="notulen">Notulen bij een vergadering</option>
              <option value="document">Los document, bijvoorbeeld de jaarplanning</option>
            </Select>
          </Veld>

          {soort === "document" ? (
            <Veld label="Titel" htmlFor="titel" toelichting="Zo komt het in het portaal te staan.">
              <Input id="titel" name="titel" maxLength={150} />
            </Veld>
          ) : (
            <Veld label="Vergadering" htmlFor="vergaderingId" verplicht>
              <Select id="vergaderingId" name="vergaderingId" required>
                <option value="">Kies…</option>
                {vergaderingen.map((vergadering) => (
                  <option key={vergadering.id} value={vergadering.id}>
                    {vergadering.label}
                  </option>
                ))}
              </Select>
            </Veld>
          )}

          <Veld
            label="Bestand"
            htmlFor="bestand"
            verplicht
            className="sm:col-span-2"
            toelichting={`${toegestaan}, maximaal 20 MB. De app controleert de inhoud, niet alleen de naam.`}
          >
            <Input
              id="bestand"
              name="bestand"
              type="file"
              required
              accept=".pdf,.png,.jpg,.jpeg,.docx"
            />
          </Veld>

          <div className="sm:col-span-2">
            {staat.fout ? <Melding toon="fout">{staat.fout}</Melding> : null}
            {staat.melding ? <Melding toon="goed">{staat.melding}</Melding> : null}
          </div>
          <div className="sm:col-span-2">
            <Button type="submit" disabled={bezig}>
              <Upload />
              {bezig ? "Bezig…" : "Uploaden"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
