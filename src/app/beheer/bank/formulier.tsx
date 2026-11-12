"use client";

import { useActionState } from "react";
import { Plus } from "lucide-react";

import { Bedragveld } from "@/components/ui/bedragveld";
import { Button } from "@/components/ui/button";
import { Input, Veld } from "@/components/ui/input";
import { Melding } from "@/components/ui/melding";
import type { ActieStaat } from "@/lib/acties";

import { bewaarBanksaldo } from "./acties";

/** Het werkelijke saldo van de betaalrekening of van de spaarrekening. */
export function BanksaldoFormulier({
  vandaag,
  rekening = "betaal",
}: {
  vandaag: string;
  rekening?: "betaal" | "spaar";
}) {
  const [staat, actie, bezig] = useActionState<ActieStaat, FormData>(
    bewaarBanksaldo,
    {},
  );
  const prefix = rekening === "spaar" ? "spaarsaldo" : "banksaldo";

  return (
    <form action={actie} className="space-y-3">
      <input type="hidden" name="rekening" value={rekening} />
      <div className="grid gap-3 sm:grid-cols-3">
        <Veld
          label="Datum"
          htmlFor={`${prefix}-datum`}
          verplicht
          fout={staat.veldfouten?.datum}
        >
          <Input
            id={`${prefix}-datum`}
            name="datum"
            type="date"
            defaultValue={vandaag}
            required
          />
        </Veld>

        <Veld
          label="Saldo volgens de bankapp"
          htmlFor={`${prefix}-saldo`}
          verplicht
          fout={staat.veldfouten?.saldo}
        >
          <Bedragveld id={`${prefix}-saldo`} name="saldo" required />
        </Veld>

        <Veld label="Notitie" htmlFor={`${prefix}-notitie`}>
          <Input id={`${prefix}-notitie`} name="notitie" placeholder="Optioneel" />
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
