"use client";

import { useActionState } from "react";
import { Plus } from "lucide-react";

import { Bedragveld } from "@/components/ui/bedragveld";
import { Button } from "@/components/ui/button";
import { Input, Veld } from "@/components/ui/input";
import { Melding } from "@/components/ui/melding";
import type { ActieStaat } from "@/lib/acties";

import { bewaarBanksaldo } from "./acties";

export function BanksaldoFormulier({ vandaag }: { vandaag: string }) {
  const [staat, actie, bezig] = useActionState<ActieStaat, FormData>(
    bewaarBanksaldo,
    {},
  );

  return (
    <form action={actie} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-3">
        <Veld
          label="Datum"
          htmlFor="datum"
          verplicht
          fout={staat.veldfouten?.datum}
        >
          <Input
            id="datum"
            name="datum"
            type="date"
            defaultValue={vandaag}
            required
          />
        </Veld>

        <Veld
          label="Saldo volgens de bankapp"
          htmlFor="saldo"
          verplicht
          fout={staat.veldfouten?.saldo}
        >
          <Bedragveld id="saldo" name="saldo" required />
        </Veld>

        <Veld label="Notitie" htmlFor="notitie">
          <Input id="notitie" name="notitie" placeholder="Optioneel" />
        </Veld>
      </div>

      {staat.fout ? <Melding toon="fout">{staat.fout}</Melding> : null}
      {staat.melding ? <Melding toon="goed">{staat.melding}</Melding> : null}

      <Button type="submit" disabled={bezig}>
        <Plus />
        {bezig ? "Bezig…" : "Saldo vastleggen"}
      </Button>
    </form>
  );
}
