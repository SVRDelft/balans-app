import type { Metadata } from "next";

import { vereisSessie } from "@/lib/auth/server";
import { isGroepSessie } from "@/lib/auth/sessie";
import { PORTAAL_MINIMUM } from "@/lib/auth/wachtwoord";

import { WachtwoordFormulier } from "./formulier";

export const metadata: Metadata = {
  title: "Wachtwoord wijzigen",
  robots: { index: false, follow: false },
};

export default async function WachtwoordPagina() {
  const sessie = await vereisSessie();
  const bestuur = sessie.rol === "BESTUUR";
  const groep = isGroepSessie(sessie);

  return (
    <main className="mx-auto max-w-lg px-4 py-10">
      <h1 className="text-2xl font-semibold">Wachtwoord wijzigen</h1>
      <p className="mt-2 mb-6 text-sm text-muted-foreground">
        {groep ? (
          <>
            Je bent ingelogd als {sessie.naam}. Dit wachtwoord deel je met het hele
            bestuur van je vereniging: na het wijzigen moeten de anderen opnieuw
            inloggen met het nieuwe wachtwoord.
          </>
        ) : (
          <>
            Je bent ingelogd als {sessie.naam}. Heb je een wachtwoord van het
            bestuur gekregen, kies dan nu een eigen wachtwoord dat je verder
            nergens gebruikt.
          </>
        )}
      </p>
      <WachtwoordFormulier
        minimum={bestuur ? 12 : PORTAAL_MINIMUM}
        toelichting={
          bestuur
            ? "Minstens 12 tekens. Een zin met spaties mag ook en is makkelijker te onthouden."
            : `Minstens ${PORTAAL_MINIMUM} tekens.`
        }
        terug={bestuur ? "/beheer" : "/portaal"}
      />
    </main>
  );
}
