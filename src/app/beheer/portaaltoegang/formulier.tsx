"use client";

import { useActionState, useRef } from "react";
import { KeyRound, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import type { ActieStaat } from "@/lib/acties";

import { koppelToegangRelatie, stelToegangWachtwoordIn, voegInformantToe } from "./acties";

/** Eén veld en een knop per regel: zo stel je een begin- of nieuw wachtwoord in. */
export function WachtwoordInstellen({ sleutel, naam }: { sleutel: string; naam: string }) {
  const formulier = useRef<HTMLFormElement>(null);
  const [staat, actie, bezig] = useActionState<ActieStaat, FormData>(
    async (vorige, gegevens) => {
      const uitkomst = await stelToegangWachtwoordIn(vorige, gegevens);
      if (uitkomst.melding) formulier.current?.reset();
      return uitkomst;
    },
    {},
  );

  return (
    <form ref={formulier} action={actie} className="flex flex-col gap-1">
      <input type="hidden" name="sleutel" value={sleutel} />
      <div className="flex gap-2">
        <Input
          name="wachtwoord"
          type="text"
          autoComplete="off"
          spellCheck={false}
          required
          minLength={4}
          maxLength={200}
          placeholder="Wachtwoord instellen"
          aria-label={`Nieuw wachtwoord voor ${naam}`}
          className="h-8 min-w-36"
        />
        <Button type="submit" size="sm" variant="outline" disabled={bezig}>
          <KeyRound />
          {bezig ? "Bezig…" : "Opslaan"}
        </Button>
      </div>
      {staat.fout ? (
        <p role="alert" className="text-xs text-destructive">{staat.fout}</p>
      ) : null}
      {staat.melding ? (
        <p role="status" className="text-xs text-success">{staat.melding}</p>
      ) : null}
    </form>
  );
}

export function InformantToevoegen() {
  const formulier = useRef<HTMLFormElement>(null);
  const [staat, actie, bezig] = useActionState<ActieStaat, FormData>(
    async (vorige, gegevens) => {
      const uitkomst = await voegInformantToe(vorige, gegevens);
      if (uitkomst.melding) formulier.current?.reset();
      return uitkomst;
    },
    {},
  );

  return (
    <form ref={formulier} action={actie} className="flex flex-col gap-1">
      <div className="flex flex-wrap gap-2">
        <Input
          name="naam"
          required
          maxLength={80}
          placeholder="Naam, zoals in de lijst"
          aria-label="Naam van de nieuwe informant"
          className="h-8 max-w-64"
        />
        <Button type="submit" size="sm" disabled={bezig}>
          <Plus />
          {bezig ? "Bezig…" : "Informant toevoegen"}
        </Button>
      </div>
      {staat.fout ? (
        <p role="alert" className="text-xs text-destructive">{staat.fout}</p>
      ) : null}
      {staat.melding ? (
        <p role="status" className="text-xs text-success">{staat.melding}</p>
      ) : null}
    </form>
  );
}

/**
 * Van welke relatie deze login de openstaande facturen ziet. Staat er nog
 * niets vast, dan is het voorstel (op naam) al gekozen maar nog niet bewaard.
 */
export function RelatieKoppeling({
  sleutel,
  naam,
  relaties,
  huidig,
  voorstel,
}: {
  sleutel: string;
  naam: string;
  relaties: { id: string; naam: string }[];
  huidig: string | null;
  voorstel: string | undefined;
}) {
  const [staat, actie, bezig] = useActionState<ActieStaat, FormData>(
    koppelToegangRelatie,
    {},
  );

  return (
    <form action={actie} className="flex flex-col gap-1">
      <input type="hidden" name="sleutel" value={sleutel} />
      <div className="flex gap-2">
        <Select
          name="relatieId"
          defaultValue={huidig ?? voorstel ?? ""}
          aria-label={`Facturen van welke relatie ziet ${naam}?`}
          className="h-8 min-w-36"
        >
          <option value="">Geen facturen</option>
          {relaties.map((relatie) => (
            <option key={relatie.id} value={relatie.id}>
              {relatie.naam}
            </option>
          ))}
        </Select>
        <Button type="submit" size="sm" variant="outline" disabled={bezig}>
          {bezig ? "Bezig…" : "Opslaan"}
        </Button>
      </div>
      {!huidig && voorstel && !staat.melding ? (
        <p className="text-xs text-muted-foreground">Voorstel, nog niet opgeslagen</p>
      ) : null}
      {staat.fout ? (
        <p role="alert" className="text-xs text-destructive">{staat.fout}</p>
      ) : null}
      {staat.melding ? (
        <p role="status" className="text-xs text-success">{staat.melding}</p>
      ) : null}
    </form>
  );
}
