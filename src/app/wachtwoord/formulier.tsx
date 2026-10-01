"use client";

import { useActionState } from "react";
import { KeyRound } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input, Veld } from "@/components/ui/input";
import { Melding } from "@/components/ui/melding";
import type { ActieStaat } from "@/lib/acties";

import { wijzigWachtwoord } from "./acties";

export function WachtwoordFormulier() {
  const [staat, actie, bezig] = useActionState<ActieStaat, FormData>(
    wijzigWachtwoord,
    {},
  );

  return (
    <Card>
      <CardContent className="pt-5">
        <form action={actie} className="space-y-4">
          <Veld label="Huidig wachtwoord" htmlFor="huidig" verplicht>
            <Input
              id="huidig"
              name="huidig"
              type="password"
              autoComplete="current-password"
              required
            />
          </Veld>

          <Veld
            label="Nieuw wachtwoord"
            htmlFor="nieuw"
            verplicht
            toelichting="Minstens 12 tekens. Een zin met spaties mag ook en is makkelijker te onthouden."
          >
            <Input
              id="nieuw"
              name="nieuw"
              type="password"
              autoComplete="new-password"
              required
              minLength={12}
            />
          </Veld>

          <Veld label="Nieuw wachtwoord nog een keer" htmlFor="herhaling" verplicht>
            <Input
              id="herhaling"
              name="herhaling"
              type="password"
              autoComplete="new-password"
              required
              minLength={12}
            />
          </Veld>

          {staat.fout ? <Melding toon="fout">{staat.fout}</Melding> : null}

          <Button type="submit" disabled={bezig}>
            <KeyRound />
            {bezig ? "Bezig…" : "Wachtwoord opslaan"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
