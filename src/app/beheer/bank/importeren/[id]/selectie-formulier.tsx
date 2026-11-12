"use client";

import { useActionState, useState } from "react";
import { CheckCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Melding } from "@/components/ui/melding";
import { formatteerEuro } from "@/lib/geld";
import type { ActieStaat } from "@/lib/acties";
import type { Zekerheid } from "@/lib/bank/koppelen";

import { koppelSelectie } from "../acties";

export interface SelectieRegel {
  id: string;
  datum: string;
  tegenpartij: string;
  bedragCenten: number;
  doelLabel: string;
  reden: string;
  zekerheid: Zekerheid;
}

const LABEL: Record<Zekerheid, { tekst: string; variant: "goed" | "default" | "waarschuwing" }> = {
  zeker: { tekst: "Zeker", variant: "goed" },
  naam: { tekst: "Naam en bedrag", variant: "default" },
  bedrag: { tekst: "Alleen bedrag", variant: "waarschuwing" },
};

export function SelectieFormulier({ importId, regels }: { importId: string; regels: SelectieRegel[] }) {
  const [staat, actie, bezig] = useActionState<ActieStaat, FormData>(koppelSelectie, {});
  // Zekere voorstellen en naam-plus-bedrag staan alvast aan; op alleen een
  // bedrag moet je bewust zelf vinken.
  const [aan, setAan] = useState<Set<string>>(
    () => new Set(regels.filter((r) => r.zekerheid !== "bedrag").map((r) => r.id)),
  );

  const zet = (id: string, waarde: boolean) =>
    setAan((vorige) => {
      const volgende = new Set(vorige);
      if (waarde) volgende.add(id);
      else volgende.delete(id);
      return volgende;
    });

  const totaal = regels.filter((r) => aan.has(r.id)).reduce((som, r) => som + r.bedragCenten, 0);

  return (
    <form action={actie} className="space-y-3">
      <input type="hidden" name="importId" value={importId} />
      {[...aan].map((id) => (
        <input key={id} type="hidden" name="mutatieId" value={id} />
      ))}

      <div className="flex flex-wrap gap-2 text-sm">
        <Button type="button" variant="ghost" size="sm" onClick={() => setAan(new Set(regels.map((r) => r.id)))}>
          Alles aanvinken
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={() => setAan(new Set())}>
          Niets aanvinken
        </Button>
      </div>

      <ul className="divide-y divide-border rounded-lg border border-border">
        {regels.map((regel) => (
          <li key={regel.id}>
            <label className="flex cursor-pointer items-start gap-3 px-3 py-2.5 hover:bg-muted/40">
              <input
                type="checkbox"
                className="mt-1 size-4 shrink-0"
                checked={aan.has(regel.id)}
                onChange={(gebeurtenis) => zet(regel.id, gebeurtenis.target.checked)}
              />
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{regel.doelLabel}</span>
                  <Badge variant={LABEL[regel.zekerheid].variant}>{LABEL[regel.zekerheid].tekst}</Badge>
                </span>
                <span className="block text-xs text-muted-foreground">
                  {regel.datum}
                  {regel.tegenpartij ? ` · ${regel.tegenpartij}` : ""} · {regel.reden}
                </span>
              </span>
              <span className="cijfers shrink-0 text-sm font-semibold">{formatteerEuro(regel.bedragCenten)}</span>
            </label>
          </li>
        ))}
      </ul>

      {staat.fout ? <Melding toon="fout">{staat.fout}</Melding> : null}
      {staat.melding ? <Melding toon="goed">{staat.melding}</Melding> : null}

      <Button type="submit" disabled={bezig || aan.size === 0}>
        <CheckCheck />
        {bezig
          ? "Bezig…"
          : `${aan.size} ${aan.size === 1 ? "koppeling" : "koppelingen"} verwerken (${formatteerEuro(totaal)})`}
      </Button>
    </form>
  );
}
