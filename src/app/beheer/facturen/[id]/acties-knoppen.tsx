"use client";

import { useActionState, useState } from "react";
import { Check, ClipboardCopy, RotateCcw, Send, Trash2, Undo2 } from "lucide-react";

import { BevestigKnop } from "@/components/bevestigknop";
import { Button } from "@/components/ui/button";
import { Melding } from "@/components/ui/melding";
import type { ActieStaat } from "@/lib/acties";

import {
  legHerinneringVast,
  maakCreditfactuur,
  verstuurFactuur,
  verwijderConcept,
  zetStatus,
} from "../acties";

export function VerstuurKnop({ id }: { id: string }) {
  const [staat, actie, bezig] = useActionState<ActieStaat, FormData>(
    verstuurFactuur,
    {},
  );

  return (
    <form
      action={actie}
      onSubmit={(gebeurtenis) => {
        if (
          !window.confirm(
            "Op verstuurd zetten? Daarna is de factuur niet meer inhoudelijk te wijzigen; corrigeren gaat via een creditfactuur.",
          )
        ) {
          gebeurtenis.preventDefault();
        }
      }}
    >
      <input type="hidden" name="id" value={id} />
      <Button type="submit" disabled={bezig}>
        <Send />
        {bezig ? "Bezig…" : "Op verstuurd zetten"}
      </Button>
      {staat.fout ? (
        <p className="mt-1 text-xs text-destructive">{staat.fout}</p>
      ) : null}
    </form>
  );
}

export function CreditKnop({ id, nummer }: { id: string; nummer: string }) {
  return (
    <BevestigKnop
      actie={maakCreditfactuur}
      velden={{ id }}
      vraag={`Creditfactuur maken voor ${nummer}? Controleer het concept en zet het daarna op verstuurd om de creditering te verwerken.`}
    >
      <Undo2 />
      Crediteren
    </BevestigKnop>
  );
}

export function OninbaarKnop({ id, nummer }: { id: string; nummer: string }) {
  return (
    <BevestigKnop
      actie={zetStatus}
      velden={{ id, status: "oninbaar" }}
      vraag={`${nummer} als oninbaar afboeken? Alleen het nog onbetaalde deel wordt afgeboekt.`}
    >
      <Check />
      Oninbaar afboeken
    </BevestigKnop>
  );
}

export function HerstelKnop({ id, nummer }: { id: string; nummer: string }) {
  return (
    <BevestigKnop
      actie={zetStatus}
      velden={{ id, status: "verstuurd" }}
      vraag={`${nummer} terugzetten naar openstaand?`}
    >
      <RotateCcw />
      Terugzetten naar openstaand
    </BevestigKnop>
  );
}

export function VerwijderConceptKnop({
  id,
  nummer,
}: {
  id: string;
  nummer: string;
}) {
  return (
    <BevestigKnop
      actie={verwijderConcept}
      velden={{ id }}
      vraag={`Concept ${nummer} verwijderen? Het factuurnummer wordt niet opnieuw uitgegeven.`}
    >
      <Trash2 />
      Concept verwijderen
    </BevestigKnop>
  );
}

/** Zet de tekst voor een herinneringsmail op het klembord; versturen doet het
 *  bestuur zelf. Daarna kun je aantekenen dat het gebeurd is, zodat je later
 *  weet wie je al hebt aangemaand. */
export function HerinneringKnop({
  tekst,
  id,
  herinneringen,
  laatsteOp,
}: {
  tekst: string;
  id: string;
  herinneringen: number;
  laatsteOp: string | null;
}) {
  const [gekopieerd, setGekopieerd] = useState(false);
  const [toonTekst, setToonTekst] = useState(false);
  const [staat, vastleggen, bezig] = useActionState<ActieStaat, FormData>(
    legHerinneringVast,
    {},
  );

  async function kopieer() {
    try {
      await navigator.clipboard.writeText(tekst);
      setGekopieerd(true);
      window.setTimeout(() => setGekopieerd(false), 2500);
    } catch {
      // Zonder toestemming voor het klembord: de tekst gewoon tonen.
      setToonTekst(true);
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" onClick={kopieer}>
          <ClipboardCopy />
          {gekopieerd ? "Gekopieerd" : "Herinneringstekst kopiëren"}
        </Button>
        <Button
          type="button"
          variant="ghost"
          onClick={() => setToonTekst((vorige) => !vorige)}
        >
          {toonTekst ? "Verbergen" : "Tekst bekijken"}
        </Button>
      </div>

      <form action={vastleggen}>
        <input type="hidden" name="id" value={id} />
        <Button type="submit" variant="secondary" size="sm" disabled={bezig}>
          <Check />
          {bezig ? "Bezig…" : "Aantekenen dat hij verstuurd is"}
        </Button>
      </form>

      {herinneringen > 0 ? (
        <p className="text-xs text-muted-foreground">
          {herinneringen === 1 ? "Eén herinnering" : `${herinneringen} herinneringen`}
          {laatsteOp ? `, laatste op ${laatsteOp}` : ""}.
        </p>
      ) : (
        <p className="text-xs text-muted-foreground">
          Nog geen herinnering aangetekend.
        </p>
      )}

      {staat.fout ? <Melding toon="fout">{staat.fout}</Melding> : null}
      {staat.melding ? (
        <div role="status">
          <Melding toon="goed">{staat.melding}</Melding>
        </div>
      ) : null}

      {toonTekst ? (
        <textarea
          readOnly
          value={tekst}
          rows={14}
          className="w-full rounded-md border border-input bg-card p-3 font-mono text-xs"
        />
      ) : null}

      {gekopieerd ? (
        <Melding toon="goed">
          De tekst staat op je klembord. Plak hem in je mailprogramma en verstuur
          zelf.
        </Melding>
      ) : null}
    </div>
  );
}
