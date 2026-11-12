import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Melding } from "@/components/ui/melding";

// Komt langs als een factuur, uitgave of relatie niet in dit boekjaar bestaat.
// Dat is meestal geen typefout maar het verkeerde boekjaar, dus dat staat erbij.
export default function NietGevonden() {
  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <Melding toon="waarschuwing" titel="Niet gevonden in dit boekjaar">
        <p>
          Deze pagina bestaat niet, of hoort bij een ander boekjaar. Wissel
          bovenin van boekjaar, of zoek het op met Ctrl+K.
        </p>
      </Melding>
      <div className="flex flex-wrap gap-2">
        <Button asChild>
          <Link href="/beheer">Naar het dashboard</Link>
        </Button>
        <Button variant="outline" asChild>
          <Link href="/beheer/facturen">Naar de facturen</Link>
        </Button>
      </div>
    </div>
  );
}
