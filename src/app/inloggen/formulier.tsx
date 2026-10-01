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
            label="E-mailadres"
            htmlFor="email"
            verplicht
            toelichting="Het adres waarop het bestuur je account heeft gezet."
          >
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="username"
              autoFocus
              required
              maxLength={200}
              placeholder="bijvoorbeeld: secretaris@curius.nl"
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
