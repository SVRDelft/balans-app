"use client";

import { useActionState } from "react";
import { Send } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Melding } from "@/components/ui/melding";
import { formatteerEuro } from "@/lib/geld";
import type { ActieStaat } from "@/lib/acties";

import { verstuurConcepten } from "./acties";

/** Zet alle concepten die nu in de lijst staan in één keer op verstuurd. */
export function ConceptenVersturen({
  concepten,
}: {
  concepten: { id: string; totaalCenten: number }[];
}) {
  const [staat, actie, bezig] = useActionState<ActieStaat, FormData>(
    verstuurConcepten,
    {},
  );
  const totaal = concepten.reduce((som, concept) => som + concept.totaalCenten, 0);
  const tekst = `${concepten.length} ${concepten.length === 1 ? "concept" : "concepten"} op verstuurd zetten`;

  return (
    <div className="mb-4 space-y-2 niet-afdrukken">
      {concepten.length > 0 ? (
        <form
          action={actie}
          className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-card px-4 py-3"
          onSubmit={(gebeurtenis) => {
            if (
              !window.confirm(
                `${tekst} (${formatteerEuro(totaal)})? Daarna tellen ze mee, kunnen betalingen eraan gekoppeld worden en zijn ze vergrendeld.`,
              )
            ) {
              gebeurtenis.preventDefault();
            }
          }}
        >
          {concepten.map((concept) => (
            <input key={concept.id} type="hidden" name="factuurId" value={concept.id} />
          ))}
          <p className="flex-1 text-sm text-muted-foreground">
            In deze lijst staan {concepten.length} concepten die nog niet verstuurd zijn. Filter eerst als je er maar een deel wilt versturen.
          </p>
          <Button type="submit" size="sm" disabled={bezig}>
            <Send />
            {bezig ? "Bezig…" : `${tekst} (${formatteerEuro(totaal)})`}
          </Button>
        </form>
      ) : null}
      {staat.fout ? <Melding toon="fout">{staat.fout}</Melding> : null}
      {staat.melding ? <Melding toon="goed">{staat.melding}</Melding> : null}
    </div>
  );
}
