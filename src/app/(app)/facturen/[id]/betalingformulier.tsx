"use client";

import { useActionState } from "react";

import { Bedragveld } from "@/components/ui/bedragveld";
import { Button } from "@/components/ui/button";
import { Input, Veld } from "@/components/ui/input";
import { Melding } from "@/components/ui/melding";
import type { ActieStaat } from "@/lib/acties";

import { registreerBetaling } from "../acties";

export function BetalingFormulier({
  factuurId,
  vandaag,
  openstaandInvoer,
}: {
  factuurId: string;
  vandaag: string;
  openstaandInvoer: string;
}) {
  const [staat, actie, bezig] = useActionState<ActieStaat, FormData>(
    registreerBetaling,
    {},
  );

  return (
    <form action={actie} className="space-y-3">
      <input type="hidden" name="factuurId" value={factuurId} />

      <div className="grid gap-3 sm:grid-cols-2">
        <Veld label="Datum" htmlFor="betaaldatum" verplicht>
          <Input
            id="betaaldatum"
            name="datum"
            type="date"
            defaultValue={vandaag}
            required
          />
        </Veld>

        <Veld
          label="Bedrag"
          htmlFor="betaalbedrag"
          verplicht
          toelichting="Een deelbetaling mag; de status volgt vanzelf."
        >
          <Bedragveld
            id="betaalbedrag"
            name="bedrag"
            defaultValue={openstaandInvoer}
            required
          />
        </Veld>
      </div>

      <Veld label="Notitie" htmlFor="betaalnotitie">
        <Input
          id="betaalnotitie"
          name="notitie"
          placeholder="Bijvoorbeeld: overboeking 12 maart"
        />
      </Veld>

      {staat.fout ? <Melding toon="fout">{staat.fout}</Melding> : null}
      {staat.melding ? <Melding toon="goed">{staat.melding}</Melding> : null}

      <Button type="submit" disabled={bezig}>
        {bezig ? "Bezig…" : "Betaling vastleggen"}
      </Button>
    </form>
  );
}
