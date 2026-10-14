"use client";

import { useActionState, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input, Select, Veld } from "@/components/ui/input";
import { Melding } from "@/components/ui/melding";
import type { ActieStaat } from "@/lib/acties";
import { cn } from "@/lib/utils";

import { inloggen, inloggenAlsVereniging } from "./acties";

interface Keuze {
  sleutel: string;
  naam: string;
}

export type Tab = "vereniging" | "account";

/**
 * Twee manieren van inloggen naast elkaar. "Als vereniging" staat voorop: zo
 * logt een verenigingsbestuur in voor het portaal. "Met je eigen account" is het
 * inloggen zoals het altijd was, en daar logt ook het SVR-bestuur in.
 */
export function InlogTabs({
  verder,
  standaard,
  studieverenigingen,
  informanten,
}: {
  verder: string;
  standaard: Tab;
  studieverenigingen: Keuze[];
  informanten: Keuze[];
}) {
  const [tab, setTab] = useState<Tab>(standaard);

  const knop = (waarde: Tab, label: string) => (
    <button
      type="button"
      role="tab"
      id={`tab-${waarde}`}
      aria-selected={tab === waarde}
      aria-controls={`paneel-${waarde}`}
      onClick={() => setTab(waarde)}
      className={cn(
        "flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors",
        tab === waarde
          ? "bg-card text-foreground shadow-sm"
          : "text-muted-foreground hover:text-foreground",
      )}
    >
      {label}
    </button>
  );

  return (
    <div>
      <div
        role="tablist"
        aria-label="Hoe wil je inloggen?"
        className="mb-4 flex gap-1 rounded-lg bg-muted p-1"
      >
        {knop("vereniging", "Als vereniging")}
        {knop("account", "Met je eigen account")}
      </div>

      <div
        role="tabpanel"
        id="paneel-vereniging"
        aria-labelledby="tab-vereniging"
        hidden={tab !== "vereniging"}
      >
        <VerenigingFormulier
          verder={verder}
          studieverenigingen={studieverenigingen}
          informanten={informanten}
        />
      </div>
      <div
        role="tabpanel"
        id="paneel-account"
        aria-labelledby="tab-account"
        hidden={tab !== "account"}
      >
        <InlogFormulier verder={verder} />
      </div>
    </div>
  );
}

function VerenigingFormulier({
  verder,
  studieverenigingen,
  informanten,
}: {
  verder: string;
  studieverenigingen: Keuze[];
  informanten: Keuze[];
}) {
  const [staat, actie, bezig] = useActionState<ActieStaat, FormData>(
    inloggenAlsVereniging,
    {},
  );

  return (
    <Card>
      <CardContent className="pt-5">
        <form action={actie} className="space-y-4">
          <input type="hidden" name="verder" value={verder} />

          <Veld label="Wie ben je?" htmlFor="wie" verplicht>
            <Select id="wie" name="wie" required defaultValue="">
              <option value="" disabled>
                Kies je vereniging…
              </option>
              <optgroup label="Studieverenigingen">
                {studieverenigingen.map((keuze) => (
                  <option key={keuze.sleutel} value={keuze.sleutel}>
                    {keuze.naam}
                  </option>
                ))}
              </optgroup>
              {informanten.length > 0 ? (
                <optgroup label="Informanten">
                  {informanten.map((keuze) => (
                    <option key={keuze.sleutel} value={keuze.sleutel}>
                      {keuze.naam}
                    </option>
                  ))}
                </optgroup>
              ) : null}
            </Select>
          </Veld>

          <Veld
            label="Wachtwoord"
            htmlFor="vereniging-wachtwoord"
            verplicht
            toelichting="Het wachtwoord dat jullie bestuur deelt."
          >
            <Input
              id="vereniging-wachtwoord"
              name="wachtwoord"
              type="password"
              autoComplete="current-password"
              required
            />
          </Veld>

          {staat.fout ? <Melding toon="fout">{staat.fout}</Melding> : null}

          <Button type="submit" className="w-full" disabled={bezig}>
            {bezig ? "Bezig…" : "Naar het portaal"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

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
