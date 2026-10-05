"use client";

import { useActionState, useState } from "react";

import { Bedragveld } from "@/components/ui/bedragveld";
import { Button } from "@/components/ui/button";
import { Input, Select, Veld } from "@/components/ui/input";
import { Melding } from "@/components/ui/melding";
import type { ActieStaat } from "@/lib/acties";

import { registreerBetaling } from "../acties";

export interface BoekjaarKeuze {
  id: string;
  naam: string;
  actief: boolean;
}

export function BetalingFormulier({
  factuurId,
  vandaag,
  openstaandInvoer,
  boekjaren,
  standaardBoekjaarId,
  factuurBoekjaarId,
}: {
  factuurId: string;
  vandaag: string;
  openstaandInvoer: string;
  /** Alle boekjaren, zodat geld in het jaar komt waarin het binnenkwam. */
  boekjaren: BoekjaarKeuze[];
  standaardBoekjaarId: string;
  factuurBoekjaarId: string;
}) {
  const [staat, actie, bezig] = useActionState<ActieStaat, FormData>(
    registreerBetaling,
    {},
  );
  const [boekjaarId, setBoekjaarId] = useState(standaardBoekjaarId);
  const anderJaar = boekjaarId !== factuurBoekjaarId;

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

      {boekjaren.length > 1 ? (
        <Veld
          label="Geld hoort in boekjaar"
          htmlFor="betaalboekjaar"
          verplicht
          toelichting="De factuur blijft in zijn eigen jaar staan. Kies hier het jaar waarin het geld op de rekening kwam."
        >
          <Select
            id="betaalboekjaar"
            name="boekjaarId"
            value={boekjaarId}
            onChange={(event) => setBoekjaarId(event.target.value)}
            required
          >
            {boekjaren.map((jaar) => (
              <option key={jaar.id} value={jaar.id}>
                {jaar.naam}
                {jaar.actief ? " (actief)" : ""}
              </option>
            ))}
          </Select>
        </Veld>
      ) : (
        <input type="hidden" name="boekjaarId" value={boekjaarId} />
      )}

      <Veld label="Notitie" htmlFor="betaalnotitie">
        <Input
          id="betaalnotitie"
          name="notitie"
          placeholder="Bijvoorbeeld: overboeking 12 maart"
        />
      </Veld>

      {anderJaar ? (
        <Melding toon="info">
          Deze betaling komt in een ander boekjaar dan de factuur. De vordering
          blijft bij het jaar van de factuur staan, het geld telt mee in het jaar
          dat je hier kiest. Zo blijven beide jaren kloppen.
        </Melding>
      ) : null}

      {staat.fout ? <Melding toon="fout">{staat.fout}</Melding> : null}
      {staat.melding ? <Melding toon="goed">{staat.melding}</Melding> : null}

      <Button type="submit" disabled={bezig}>
        {bezig ? "Bezig…" : "Betaling vastleggen"}
      </Button>
    </form>
  );
}
