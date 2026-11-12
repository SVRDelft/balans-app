"use client";

import { useActionState, useState } from "react";
import { Megaphone, Plus, Save, Upload } from "lucide-react";

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

export interface BestaandeVergadering {
  id: string;
  reeks: string;
  datum: string;
  tijd: string;
  gastheerId: string | null;
  notitie: string | null;
  locatie: string;
  status: string;
  volgnummer: number | null;
}

/**
 * Een vergadering toevoegen, of met `vergadering` erbij: een bestaande
 * bewerken. Bij bewerken blijven de stukken gekoppeld.
 */
export function VergaderingFormulier({
  verenigingen,
  vandaag,
  vergadering,
  ingeklapt = false,
}: {
  verenigingen: { id: string; naam: string }[];
  vandaag: string;
  vergadering?: BestaandeVergadering;
  ingeklapt?: boolean;
}) {
  const [staat, actie, bezig] = useActionState<ActieStaat, FormData>(bewaarVergadering, {});
  const voor = vergadering?.id ?? "nieuw";
  const veld = (naam: string) => `${naam}-${voor}`;

  const formulier = (
    <form action={actie} className="grid gap-4 sm:grid-cols-2">
      {vergadering ? <input type="hidden" name="id" value={vergadering.id} /> : null}
      <Veld label="Overleg" htmlFor={veld("reeks")} verplicht>
        <Select id={veld("reeks")} name="reeks" defaultValue={vergadering?.reeks ?? "SVR"}>
          <option value="SVR">SVR · voorzitters</option>
          <option value="SVR-O">SVR-O · onderwijs</option>
          <option value="SVeuRo">SVeuRo · penningmeesters</option>
          <option value="SVjwR">SVjwR · eerstejaarsweekenden</option>
        </Select>
      </Veld>
      <Veld
        label="Volgnummer"
        htmlFor={veld("volgnummer")}
        toelichting="Optioneel: met 4 staat er “SVR 4”."
      >
        <Input
          id={veld("volgnummer")}
          name="volgnummer"
          type="number"
          min={1}
          max={99}
          defaultValue={vergadering?.volgnummer ?? ""}
        />
      </Veld>
      <Veld label="Datum" htmlFor={veld("datum")} verplicht>
        <Input
          id={veld("datum")}
          name="datum"
          type="date"
          defaultValue={vergadering?.datum ?? vandaag}
          required
        />
      </Veld>
      <Veld label="Begintijd" htmlFor={veld("tijd")} verplicht>
        <Input
          id={veld("tijd")}
          name="tijd"
          defaultValue={vergadering?.tijd ?? "14:00"}
          required
          placeholder="14:00"
        />
      </Veld>
      <Veld label="Ontvangende vereniging" htmlFor={veld("gastheerId")}>
        <Select id={veld("gastheerId")} name="gastheerId" defaultValue={vergadering?.gastheerId ?? ""}>
          <option value="">Nog niet bekend</option>
          {verenigingen.map((vereniging) => (
            <option key={vereniging.id} value={vereniging.id}>
              {vereniging.naam}
            </option>
          ))}
        </Select>
      </Veld>
      <Veld
        label="Locatie"
        htmlFor={veld("locatie")}
        toelichting="Bijvoorbeeld “PSOR” of “Classroom 6”."
      >
        <Input
          id={veld("locatie")}
          name="locatie"
          maxLength={150}
          defaultValue={vergadering?.locatie ?? ""}
        />
      </Veld>
      <Veld
        label="Status"
        htmlFor={veld("status")}
        toelichting="Afgelast blijft doorgestreept in het portaal staan."
      >
        <Select id={veld("status")} name="status" defaultValue={vergadering?.status ?? "gepland"}>
          <option value="gepland">Gepland</option>
          <option value="verplaatst">Verplaatst</option>
          <option value="afgelast">Afgelast</option>
        </Select>
      </Veld>
      <Veld label="Notitie" htmlFor={veld("notitie")} className="sm:col-span-2">
        <Textarea id={veld("notitie")} name="notitie" rows={2} defaultValue={vergadering?.notitie ?? ""} />
      </Veld>
      <div className="sm:col-span-2">
        {staat.fout ? <Melding toon="fout">{staat.fout}</Melding> : null}
        {staat.melding ? <Melding toon="goed">{staat.melding}</Melding> : null}
      </div>
      <div className="sm:col-span-2">
        <Button type="submit" disabled={bezig}>
          {vergadering ? <Save /> : <Plus />}
          {bezig ? "Bezig…" : vergadering ? "Wijzigingen opslaan" : "Vergadering toevoegen"}
        </Button>
      </div>
    </form>
  );

  if (ingeklapt) {
    return (
      <details className="text-left">
        <summary className="cursor-pointer text-sm text-primary underline">Bewerken</summary>
        <div className="mt-3 w-[min(36rem,80vw)] rounded-lg border border-border bg-card p-4">
          {formulier}
        </div>
      </details>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Vergadering toevoegen</CardTitle>
      </CardHeader>
      <CardContent>{formulier}</CardContent>
    </Card>
  );
}

export function UploadFormulier({
  vergaderingen,
  toegestaan,
}: {
  vergaderingen: { id: string; label: string; heeftAgenda: boolean; heeftNotulen: boolean }[];
  toegestaan: string;
}) {
  const [staat, actie, bezig] = useActionState<ActieStaat, FormData>(uploadBestand, {});
  const [soort, setSoort] = useState("agenda");
  const [vergaderingId, setVergaderingId] = useState("");
  const [bestaand, setBestaand] = useState("");

  const gekozen = vergaderingen.find((vergadering) => vergadering.id === vergaderingId);
  // Staat er al een agenda of notulen bij deze vergadering? Dan eerst kiezen.
  const dubbel =
    (soort === "agenda" && gekozen?.heeftAgenda) || (soort === "notulen" && gekozen?.heeftNotulen);
  const titelNodig = soort === "document" || (dubbel && bestaand === "toevoegen");

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
              <option value="presentatie">Presentatie bij een vergadering</option>
              <option value="bijlage">Bijlage bij een vergadering</option>
              <option value="document">Los document, bijvoorbeeld de jaarplanning</option>
            </Select>
          </Veld>

          {soort === "document" ? (
            <div className="hidden sm:block" />
          ) : (
            <Veld label="Vergadering" htmlFor="vergaderingId" verplicht>
              <Select
                id="vergaderingId"
                name="vergaderingId"
                required
                value={vergaderingId}
                onChange={(gebeurtenis) => setVergaderingId(gebeurtenis.target.value)}
              >
                <option value="">Kies…</option>
                {vergaderingen.map((vergadering) => (
                  <option key={vergadering.id} value={vergadering.id}>
                    {vergadering.label}
                  </option>
                ))}
              </Select>
            </Veld>
          )}

          {dubbel ? (
            <fieldset className="sm:col-span-2 rounded-lg border border-warning/40 bg-warning/10 p-3">
              <legend className="px-1 text-sm font-medium">
                Bij deze vergadering staan al {soort === "agenda" ? "een agenda" : "notulen"}
              </legend>
              <label className="mr-6 inline-flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="bestaand"
                  value="vervangen"
                  required
                  checked={bestaand === "vervangen"}
                  onChange={() => setBestaand("vervangen")}
                />
                Vervangen (de oude gaat weg)
              </label>
              <label className="inline-flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="bestaand"
                  value="toevoegen"
                  required
                  checked={bestaand === "toevoegen"}
                  onChange={() => setBestaand("toevoegen")}
                />
                Toevoegen als extra stuk, met een eigen titel
              </label>
            </fieldset>
          ) : null}

          {titelNodig || soort === "presentatie" || soort === "bijlage" ? (
            <Veld
              label="Titel"
              htmlFor="titel"
              verplicht={titelNodig}
              toelichting="Zo komt het in het portaal te staan, bijvoorbeeld “Presentatie begroting”."
            >
              <Input id="titel" name="titel" maxLength={150} required={titelNodig} />
            </Veld>
          ) : null}

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
