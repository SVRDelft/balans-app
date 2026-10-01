"use client";

import { useActionState, useState } from "react";
import { UserPlus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input, Select, Veld } from "@/components/ui/input";
import { Melding } from "@/components/ui/melding";
import type { ActieStaat } from "@/lib/acties";

import { maakAccount } from "./acties";

export function AccountFormulier({
  verenigingen,
}: {
  verenigingen: { id: string; naam: string }[];
}) {
  const [staat, actie, bezig] = useActionState<ActieStaat, FormData>(maakAccount, {});
  const [rol, setRol] = useState("SV");

  return (
    <Card>
      <CardContent className="pt-5">
        <form action={actie} className="grid gap-4 sm:grid-cols-2">
          <Veld label="Rol" htmlFor="rol" verplicht>
            <Select
              id="rol"
              name="rol"
              value={rol}
              onChange={(gebeurtenis) => setRol(gebeurtenis.target.value)}
            >
              <option value="SV">Studievereniging (alleen het portaal)</option>
              <option value="BESTUUR">SVR-bestuur (ook de administratie)</option>
            </Select>
          </Veld>

          {rol === "SV" ? (
            <Veld
              label="Vereniging"
              htmlFor="relatieId"
              verplicht
              toelichting="Dit account ziet alleen gegevens van deze vereniging."
            >
              <Select id="relatieId" name="relatieId" required>
                <option value="">Kies…</option>
                {verenigingen.map((vereniging) => (
                  <option key={vereniging.id} value={vereniging.id}>
                    {vereniging.naam}
                  </option>
                ))}
              </Select>
            </Veld>
          ) : (
            <div className="hidden sm:block" />
          )}

          <Veld
            label="E-mailadres"
            htmlFor="email"
            verplicht
            toelichting={
              rol === "SV"
                ? "Het functionele adres van de vereniging, bijvoorbeeld secretaris@curius.nl. Dat blijft gelijk bij een bestuurswissel."
                : "Het adres waarmee dit bestuurslid inlogt."
            }
          >
            <Input id="email" name="email" type="email" required maxLength={200} />
          </Veld>

          <Veld
            label="Naam"
            htmlFor="naam"
            verplicht
            toelichting="Komt in het auditlog te staan bij alles wat dit account wijzigt."
          >
            <Input id="naam" name="naam" required maxLength={80} />
          </Veld>

          <div className="sm:col-span-2">
            {staat.fout ? <Melding toon="fout">{staat.fout}</Melding> : null}
            {staat.melding ? (
              <Melding toon="goed" titel="Account aangemaakt">
                {staat.melding}
              </Melding>
            ) : null}
          </div>

          <div className="sm:col-span-2">
            <Button type="submit" disabled={bezig}>
              <UserPlus />
              {bezig ? "Bezig…" : "Account aanmaken"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
