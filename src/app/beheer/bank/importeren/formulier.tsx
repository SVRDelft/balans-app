"use client";

import { useActionState, useState } from "react";
import { Upload } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input, Veld } from "@/components/ui/input";
import { Melding } from "@/components/ui/melding";
import type { ActieStaat } from "@/lib/acties";

import { importeerBankbestand } from "./acties";

const MAX_BESTAND_BYTES = 2 * 1024 * 1024;

export function BankimportFormulier() {
  const [staat, actie, bezig] = useActionState<ActieStaat, FormData>(
    importeerBankbestand,
    {},
  );
  const [bestandsfout, setBestandsfout] = useState("");

  return (
    <form action={actie} className="max-w-xl space-y-4" aria-busy={bezig}>
      <Veld
        label="MT940-bestand"
        htmlFor="bankimport-bestand"
        verplicht
        fout={bestandsfout || staat.veldfouten?.bestand}
        toelichting="Download het MT940-bestand bij je bank. Maximaal 2 MB; .mt940, .sta, .940 of .txt."
      >
        <Input
          id="bankimport-bestand"
          name="bestand"
          type="file"
          accept=".mt940,.sta,.940,.txt"
          required
          disabled={bezig}
          className="h-auto min-h-10 py-2"
          onChange={(event) => {
            const bestand = event.currentTarget.files?.[0];
            const fout =
              bestand && bestand.size > MAX_BESTAND_BYTES
                ? "Dit bestand is te groot. Kies een bestand van maximaal 2 MB."
                : "";
            event.currentTarget.setCustomValidity(fout);
            setBestandsfout(fout);
          }}
        />
      </Veld>

      <p className="text-sm text-muted-foreground">
        Na het inlezen controleer je de voorgestelde koppelingen aan facturen en
        uitgaven. Je bevestigt zelf wat er wordt verwerkt.
      </p>

      {staat.fout ? <Melding toon="fout">{staat.fout}</Melding> : null}
      {staat.melding ? (
        <div role="status">
          <Melding toon="goed">{staat.melding}</Melding>
        </div>
      ) : null}

      <Button type="submit" disabled={bezig || Boolean(bestandsfout)}>
        <Upload aria-hidden />
        {bezig ? "Bestand wordt ingelezen…" : "Bestand inlezen"}
      </Button>
    </form>
  );
}
