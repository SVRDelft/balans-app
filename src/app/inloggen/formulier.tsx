"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input, Veld } from "@/components/ui/input";
import { Melding } from "@/components/ui/melding";
import type { ActieStaat } from "@/lib/acties";

import { inloggen } from "./acties";

export function InlogFormulier({ verder }: { verder: string }) {
  const [staat, actie, bezig] = useActionState<ActieStaat, FormData>(
    inloggen,
    {},
  );

  return (
    <Card>
      <CardContent className="pt-5">
        <form action={actie} className="space-y-4">
          <input type="hidden" name="verder" value={verder} />

          <Veld
            label="Je naam"
            htmlFor="naam"
            verplicht
            toelichting="Komt in het auditlog te staan bij alles wat je wijzigt."
          >
            <Input
              id="naam"
              name="naam"
              autoComplete="name"
              autoFocus
              required
              maxLength={60}
              placeholder="Bijvoorbeeld: Teun"
            />
          </Veld>

          <Veld label="Wachtwoord" htmlFor="wachtwoord" verplicht>
            <Input
              id="wachtwoord"
              name="wachtwoord"
              type="password"
              autoComplete="current-password"
              required
            />
          </Veld>

          {staat.fout ? <Melding toon="fout">{staat.fout}</Melding> : null}

          <Button type="submit" className="w-full" disabled={bezig}>
            {bezig ? "Bezig…" : "Inloggen"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
