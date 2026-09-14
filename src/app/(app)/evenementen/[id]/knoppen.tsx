"use client";

import { useActionState } from "react";
import { Lock, RotateCcw, ShieldAlert } from "lucide-react";

import { BevestigKnop } from "@/components/bevestigknop";
import { Button } from "@/components/ui/button";
import { Melding } from "@/components/ui/melding";
import type { ActieStaat } from "@/lib/acties";

import { boekTenLasteVanSvr, heropenEvenement, sluitEvenement } from "../acties";
import { zetBedragDefinitief } from "../../uitgaven/acties";

export function DefinitiefKnop({ id, aan }: { id: string; aan: boolean }) {
  const [, actie, bezig] = useActionState<ActieStaat, FormData>(
    zetBedragDefinitief,
    {},
  );

  return (
    <form action={actie} className="inline">
      <input type="hidden" name="id" value={id} />
      <button
        type="submit"
        disabled={bezig}
        aria-pressed={aan}
        aria-label="Bedrag definitief"
        className={`size-5 rounded border transition-colors ${
          aan
            ? "border-success bg-success text-success-foreground"
            : "border-warning bg-warning/20"
        }`}
      >
        {aan ? "✓" : ""}
      </button>
    </form>
  );
}

export function TenLasteVanSvrKnop({
  evenementId,
  bedrag,
}: {
  evenementId: string;
  bedrag: string;
}) {
  return (
    <BevestigKnop
      actie={boekTenLasteVanSvr}
      velden={{ evenementId }}
      vraag={`${bedrag} ten laste van de SVR boeken? Dit bedrag wordt niet doorbelast en verslechtert het jaarresultaat met ${bedrag}.`}
      variant="outline"
    >
      <ShieldAlert />
      Ten laste van de SVR boeken
    </BevestigKnop>
  );
}

export function SluitKnop({ evenementId }: { evenementId: string }) {
  const [staat, actie, bezig] = useActionState<ActieStaat, FormData>(
    sluitEvenement,
    {},
  );

  return (
    <form action={actie} className="space-y-2">
      <input type="hidden" name="evenementId" value={evenementId} />
      <Button type="submit" variant="secondary" disabled={bezig}>
        <Lock />
        {bezig ? "Bezig…" : "Evenement afsluiten"}
      </Button>
      {staat.fout ? <Melding toon="fout">{staat.fout}</Melding> : null}
      {staat.melding ? <Melding toon="goed">{staat.melding}</Melding> : null}
    </form>
  );
}

export function HeropenKnop({ evenementId }: { evenementId: string }) {
  return (
    <BevestigKnop
      actie={heropenEvenement}
      velden={{ evenementId }}
      vraag="Dit evenement weer openzetten?"
    >
      <RotateCcw />
      Heropenen
    </BevestigKnop>
  );
}
