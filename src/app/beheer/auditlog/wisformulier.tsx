"use client";

import { useActionState, useState } from "react";
import { Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input, Veld } from "@/components/ui/input";
import { Melding } from "@/components/ui/melding";
import type { ActieStaat } from "@/lib/acties";

import { wisAuditlog } from "./acties";

export function AuditlogWissen({ aantal }: { aantal: number }) {
  const [staat, actie, bezig] = useActionState<ActieStaat, FormData>(wisAuditlog, {});
  const [wachtwoord, setWachtwoord] = useState("");

  return (
    <form
      action={actie}
      className="space-y-4"
      onSubmit={(gebeurtenis) => {
        if (!window.confirm(`Alle ${aantal} regels van het auditlog definitief wissen? Dit kan niet ongedaan worden.`)) {
          gebeurtenis.preventDefault();
        }
      }}
    >
      <Veld
        label="Wachtwoord"
        htmlFor="auditWachtwoord"
        toelichting="Hetzelfde wachtwoord als bij het inloggen."
      >
        <Input
          id="auditWachtwoord"
          name="wachtwoord"
          type="password"
          autoComplete="current-password"
          className="max-w-xs"
          value={wachtwoord}
          onChange={(gebeurtenis) => setWachtwoord(gebeurtenis.target.value)}
        />
      </Veld>
      {staat.fout ? <Melding toon="fout">{staat.fout}</Melding> : null}
      {staat.melding ? <Melding toon="goed">{staat.melding}</Melding> : null}
      <Button type="submit" variant="destructive" disabled={bezig || wachtwoord === ""}>
        <Trash2 />
        {bezig ? "Bezig…" : "Auditlog wissen"}
      </Button>
    </form>
  );
}
