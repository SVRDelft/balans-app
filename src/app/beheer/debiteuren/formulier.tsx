"use client";

import { useActionState, useState } from "react";

import { Bedragveld } from "@/components/ui/bedragveld";
import { Button } from "@/components/ui/button";
import { Input, Select, Textarea, Veld } from "@/components/ui/input";
import { Melding } from "@/components/ui/melding";
import type { ActieStaat } from "@/lib/acties";

import { bewaarRekeningpost } from "./acties";

/**
 * Een bedrag op iemands rekening-courant zetten.
 *
 * De richting is een keuze in woorden en geen minteken: wie onder tijdsdruk een
 * pinbetaling terugboekt, moet niet hoeven nadenken over een teken.
 */
export function RekeningpostFormulier({
  relaties,
  posten,
  vandaag,
}: {
  relaties: { id: string; naam: string; type: string }[];
  posten: { id: string; code: string; naam: string; soort: string }[];
  vandaag: string;
}) {
  const [staat, actie, bezig] = useActionState<ActieStaat, FormData>(
    bewaarRekeningpost,
    {},
  );
  const [viaBank, setViaBank] = useState(true);
  const [richting, setRichting] = useState("vordering");

  return (
    <form action={actie} className="space-y-3" aria-busy={bezig}>
      <fieldset disabled={bezig} className="min-w-0 space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <Veld
            label="Wie"
            htmlFor="rc-relatie"
            verplicht
            fout={staat.veldfouten?.relatieId}
            toelichting="Staat deze persoon er niet tussen? Voeg hem toe bij Relaties."
          >
            <Select id="rc-relatie" name="relatieId" defaultValue="" required>
              <option value="">Kies een persoon of vereniging</option>
              {relaties.map((relatie) => (
                <option key={relatie.id} value={relatie.id}>
                  {relatie.naam}
                </option>
              ))}
            </Select>
          </Veld>

          <Veld label="Richting" htmlFor="rc-richting" verplicht>
            <Select
              id="rc-richting"
              name="richting"
              value={richting}
              onChange={(event) => setRichting(event.target.value)}
            >
              <option value="vordering">Moet de SVR nog betalen</option>
              <option value="schuld">De SVR moet nog betalen / terugbetaald</option>
            </Select>
          </Veld>

          <Veld
            label="Bedrag"
            htmlFor="rc-bedrag"
            verplicht
            fout={staat.veldfouten?.bedrag}
          >
            <Bedragveld id="rc-bedrag" name="bedrag" required />
          </Veld>

          <Veld
            label="Datum"
            htmlFor="rc-datum"
            verplicht
            fout={staat.veldfouten?.datum}
          >
            <Input
              id="rc-datum"
              name="datum"
              type="date"
              defaultValue={vandaag}
              required
            />
          </Veld>
        </div>

        <Veld
          label="Waarvoor"
          htmlFor="rc-omschrijving"
          verplicht
          fout={staat.veldfouten?.omschrijving}
        >
          <Input
            id="rc-omschrijving"
            name="omschrijving"
            placeholder="Bijvoorbeeld: privé besteld met de SVR-pas"
            required
          />
        </Veld>

        <label className="flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            name="viaBank"
            checked={viaBank}
            onChange={(event) => setViaBank(event.target.checked)}
            className="mt-0.5 size-4 shrink-0"
          />
          <span>
            Dit bedrag ging via de SVR-rekening
            <span className="block text-xs text-muted-foreground">
              Aan: het staat op het afschrift en wordt van het banksaldo af
              gehaald. Uit: het is alleen een correctie, bijvoorbeeld een bedrag
              dat de SVR alsnog voor eigen rekening neemt.
            </span>
          </span>
        </label>

        {!viaBank ? (
          <Veld
            label="Begrotingspost voor de correctie"
            htmlFor="rc-post"
            verplicht
            fout={staat.veldfouten?.begrotingspostId}
            toelichting="Zonder bankmutatie is dit een kostenpost of een opbrengst; daarom hoort er een post bij."
          >
            <Select id="rc-post" name="begrotingspostId" defaultValue="">
              <option value="">Kies een begrotingspost</option>
              {posten.map((post) => (
                <option key={post.id} value={post.id}>
                  {post.code} - {post.naam} (
                  {post.soort === "inkomst" ? "inkomst" : "uitgave"})
                </option>
              ))}
            </Select>
          </Veld>
        ) : null}

        <Veld label="Notities" htmlFor="rc-notities">
          <Textarea id="rc-notities" name="notities" rows={2} />
        </Veld>

        {staat.fout ? <Melding toon="fout">{staat.fout}</Melding> : null}
        {staat.melding ? (
          <div role="status">
            <Melding toon="goed">{staat.melding}</Melding>
          </div>
        ) : null}

        <Button type="submit" disabled={bezig}>
          {bezig ? "Bezig…" : "Op de rekening zetten"}
        </Button>
      </fieldset>
    </form>
  );
}
