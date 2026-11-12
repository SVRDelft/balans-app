"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { Check } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Select, Textarea, Veld } from "@/components/ui/input";
import { Melding } from "@/components/ui/melding";
import type { ActieStaat } from "@/lib/acties";

import { verwerkBankmutatie } from "../acties";

/**
 * Een regel van de spaarrekening verwerken.
 *
 * Hier kan maar weinig: een factuur of uitgave hoort nooit bij deze rekening. Er
 * blijven twee gevallen over. Een overboeking tussen de eigen rekeningen staat op
 * beide afschriften; die boek je op de regel van de betaalrekening en hier vink
 * je hem alleen af, anders verhuist hetzelfde geld twee keer. Rente en kosten
 * staan alléén hier, en die krijgen een begrotingspost zodat ze in de exploitatie
 * terechtkomen.
 */
export function SpaarRegelFormulier({
  id,
  bedragCenten,
  omschrijving,
  posten,
}: {
  id: string;
  bedragCenten: number;
  omschrijving: string;
  posten: { id: string; code: string; naam: string; soort: string }[];
}) {
  const [staat, actie, bezig] = useActionState<ActieStaat, FormData>(
    verwerkBankmutatie,
    {},
  );
  const [doel, setDoel] = useState("");
  const prefix = `spaarregel-${id}`;
  const boeking = doel === "spaarpost";

  return (
    <form action={actie} className="space-y-3" aria-busy={bezig}>
      <input type="hidden" name="mutatieId" value={id} />
      <fieldset disabled={bezig} className="min-w-0 space-y-3">
        <Veld label="Wat is dit" htmlFor={`${prefix}-doel`} verplicht>
          <Select
            id={`${prefix}-doel`}
            name="doel"
            value={doel}
            onChange={(gebeurtenis) => setDoel(gebeurtenis.target.value)}
            required
          >
            <option value="">Kies wat deze regel is</option>
            <option value="tegenkant">
              Overboeking met de betaalrekening — al geboekt, alleen afvinken
            </option>
            <option value="spaarpost">
              {bedragCenten > 0 ? "Rente of andere bijschrijving" : "Kosten of andere afschrijving"}
            </option>
            <option value="negeren">Niet verwerken in de administratie</option>
          </Select>
        </Veld>

        {doel === "tegenkant" ? (
          <Melding toon="info">
            De overboeking zelf boek je op de regel van de betaalrekening (
            <em>Naar de eigen spaarrekening</em>). Hier bevestig je alleen dat je
            deze kant gezien hebt; er verandert niets aan de cijfers.
          </Melding>
        ) : null}

        {boeking ? (
          <div className="space-y-3 rounded-lg border border-border bg-muted/40 p-3">
            <p className="text-sm">
              Dit bedrag staat alleen op de spaarrekening en niet op het afschrift
              van de betaalrekening. Het telt mee in de{" "}
              <Link
                href="/beheer/exploitatie"
                className="font-medium text-primary underline underline-offset-2"
              >
                exploitatie
              </Link>
              , dus kies er een begrotingspost bij.
            </p>
            <Veld label="Soort" htmlFor={`${prefix}-soort`} verplicht>
              <Select
                id={`${prefix}-soort`}
                name="spaarsoort"
                defaultValue={bedragCenten > 0 ? "rente" : "kosten"}
              >
                <option value="rente">Rente</option>
                <option value="kosten">Bankkosten</option>
                <option value="correctie">Correctie</option>
              </Select>
            </Veld>
            <Veld label="Begrotingspost" htmlFor={`${prefix}-post`} verplicht>
              <Select id={`${prefix}-post`} name="begrotingspostId" defaultValue="" required>
                <option value="">Kies een begrotingspost</option>
                {posten.map((post) => (
                  <option key={post.id} value={post.id}>
                    {post.code} - {post.naam} (
                    {post.soort === "inkomst" ? "inkomst" : "uitgave"})
                  </option>
                ))}
              </Select>
            </Veld>
            <Veld label="Omschrijving" htmlFor={`${prefix}-omschrijving`} verplicht>
              <Textarea
                id={`${prefix}-omschrijving`}
                name="omschrijving"
                defaultValue={omschrijving}
                rows={2}
                required
              />
            </Veld>
          </div>
        ) : null}

        {doel === "negeren" ? (
          <Veld
            label="Reden om niet te verwerken"
            htmlFor={`${prefix}-notitie`}
            verplicht
            toelichting="Er verandert niets aan je cijfers; leg vast waarom deze regel buiten de administratie blijft."
          >
            <Textarea id={`${prefix}-notitie`} name="notitie" rows={2} required />
          </Veld>
        ) : null}

        {staat.fout ? <Melding toon="fout">{staat.fout}</Melding> : null}
        {staat.melding ? (
          <div role="status">
            <Melding toon="goed">{staat.melding}</Melding>
          </div>
        ) : null}

        <Button type="submit" disabled={bezig || !doel}>
          <Check aria-hidden />
          {bezig ? "Bezig…" : "Verwerken"}
        </Button>
      </fieldset>
    </form>
  );
}
