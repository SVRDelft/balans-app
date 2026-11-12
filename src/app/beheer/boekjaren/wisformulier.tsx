"use client";

import { useActionState, useState } from "react";
import { Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input, Veld } from "@/components/ui/input";
import { Melding } from "@/components/ui/melding";
import type { ActieStaat } from "@/lib/acties";

import { wisBoekingen } from "./acties";

export function WisFormulier({ naam }: { naam: string }) {
  const [staat, actie, bezig] = useActionState<ActieStaat, FormData>(wisBoekingen, {});
  const [wachtwoord, setWachtwoord] = useState("");

  return (
    <form
      action={actie}
      className="space-y-4"
      onSubmit={(gebeurtenis) => {
        if (!window.confirm(`Alle boekingen van ${naam} definitief wissen? Dit kan niet ongedaan worden.`)) {
          gebeurtenis.preventDefault();
        }
      }}
    >
      <Veld
        label="Wachtwoord"
        htmlFor="wisWachtwoord"
        toelichting="Hetzelfde wachtwoord als bij het inloggen. Zo gebeurt dit nooit per ongeluk."
      >
        <Input
          id="wisWachtwoord"
          name="wachtwoord"
          type="password"
          autoComplete="current-password"
          value={wachtwoord}
          onChange={(gebeurtenis) => setWachtwoord(gebeurtenis.target.value)}
        />
      </Veld>
      {staat.fout ? <Melding toon="fout">{staat.fout}</Melding> : null}
      {staat.melding ? <Melding toon="goed">{staat.melding}</Melding> : null}
      <Button type="submit" variant="destructive" disabled={bezig || wachtwoord === ""}>
        <Trash2 />
        {bezig ? "Bezig…" : "Alle boekingen wissen"}
      </Button>
    </form>
  );
}
