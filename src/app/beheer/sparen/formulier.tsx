"use client";

import { useActionState, useState } from "react";

import { Bedragveld } from "@/components/ui/bedragveld";
import { Button } from "@/components/ui/button";
import { Input, Select, Textarea, Veld } from "@/components/ui/input";
import { Melding } from "@/components/ui/melding";
import type { ActieStaat } from "@/lib/acties";
import { SPAAR_SOORTEN, SPAAR_SOORT_LABEL } from "@/lib/domein";

import { bewaarSpaarmutatie } from "./acties";

/**
 * Een bedrag op de spaarrekening bijschrijven of eraf halen.
 *
 * De richting staat in woorden en niet als minteken: "naar de spaarrekening" of
 * "naar de betaalrekening" is wat je in je bankapp ook ziet staan.
 */
export function SpaarmutatieFormulier({
  posten,
  vandaag,
}: {
  posten: { id: string; code: string; naam: string; soort: string }[];
  vandaag: string;
}) {
  const [staat, actie, bezig] = useActionState<ActieStaat, FormData>(
    bewaarSpaarmutatie,
    {},
  );
  const [soort, setSoort] = useState<string>("overboeking");
  const overboeking = soort === "overboeking";

  return (
    <form action={actie} className="space-y-3" aria-busy={bezig}>
      <fieldset disabled={bezig} className="min-w-0 space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <Veld label="Wat is het" htmlFor="spaar-soort" verplicht>
            <Select
              id="spaar-soort"
              name="soort"
              value={soort}
              onChange={(gebeurtenis) => setSoort(gebeurtenis.target.value)}
            >
              {SPAAR_SOORTEN.map((waarde) => (
                <option key={waarde} value={waarde}>
                  {SPAAR_SOORT_LABEL[waarde]}
                </option>
              ))}
            </Select>
          </Veld>

          <Veld label="Richting" htmlFor="spaar-richting" verplicht>
            <Select id="spaar-richting" name="richting" defaultValue="bij">
              <option value="bij">
                {overboeking ? "Naar de spaarrekening" : "Erbij op de spaarrekening"}
              </option>
              <option value="af">
                {overboeking ? "Naar de betaalrekening" : "Eraf van de spaarrekening"}
              </option>
            </Select>
          </Veld>

          <Veld
            label="Bedrag"
            htmlFor="spaar-bedrag"
            verplicht
            fout={staat.veldfouten?.bedrag}
          >
            <Bedragveld id="spaar-bedrag" name="bedrag" required />
          </Veld>

          <Veld
            label="Datum"
            htmlFor="spaar-datum"
            verplicht
            fout={staat.veldfouten?.datum}
          >
            <Input
              id="spaar-datum"
              name="datum"
              type="date"
              defaultValue={vandaag}
              required
            />
          </Veld>
        </div>

        <Veld
          label="Omschrijving"
          htmlFor="spaar-omschrijving"
          verplicht
          fout={staat.veldfouten?.omschrijving}
        >
          <Input
            id="spaar-omschrijving"
            name="omschrijving"
            placeholder={
              overboeking ? "Bijvoorbeeld: buffer opzij gezet" : "Bijvoorbeeld: rente 2026"
            }
            required
          />
        </Veld>

        {overboeking ? (
          <Melding toon="info">
            Een overboeking tussen de eigen rekeningen is geen uitgave: het geld
            gaat van de betaalrekening af en komt op de spaarrekening erbij. De
            begroting verandert er niet van.
          </Melding>
        ) : (
          <Veld
            label="Begrotingspost"
            htmlFor="spaar-post"
            verplicht
            fout={staat.veldfouten?.begrotingspostId}
            toelichting="Rente is een opbrengst en kosten zijn kosten; daarom hoort hier een post bij. Dit bedrag loopt niet over de betaalrekening."
          >
            <Select id="spaar-post" name="begrotingspostId" defaultValue="">
              <option value="">Kies een begrotingspost</option>
              {posten.map((post) => (
                <option key={post.id} value={post.id}>
                  {post.code} - {post.naam} (
                  {post.soort === "inkomst" ? "inkomst" : "uitgave"})
                </option>
              ))}
            </Select>
          </Veld>
        )}

        <Veld label="Notities" htmlFor="spaar-notities">
          <Textarea id="spaar-notities" name="notities" rows={2} />
        </Veld>

        {staat.fout ? <Melding toon="fout">{staat.fout}</Melding> : null}
        {staat.melding ? (
          <div role="status">
            <Melding toon="goed">{staat.melding}</Melding>
          </div>
        ) : null}

        <Button type="submit" disabled={bezig}>
          {bezig ? "Bezig…" : "Mutatie vastleggen"}
        </Button>
      </fieldset>
    </form>
  );
}
