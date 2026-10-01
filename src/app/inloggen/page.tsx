import type { Metadata } from "next";
import { headers } from "next/headers";

import { Melding } from "@/components/ui/melding";
import { mageInloggen, onbeveiligdMaarToegestaan } from "@/lib/beveiliging";

import { InlogFormulier } from "./formulier";

export const metadata: Metadata = {
  title: "Inloggen",
  robots: { index: false, follow: false },
};

export default async function InloggenPagina({
  searchParams,
}: PageProps<"/inloggen">) {
  const parameters = await searchParams;
  const kopregels = await headers();
  const kanInloggen = mageInloggen(kopregels);
  const onbeveiligd = onbeveiligdMaarToegestaan(kopregels);
  const verder =
    typeof parameters.verder === "string" ? parameters.verder : "/beheer";

  return (
    <main className="flex min-h-dvh items-center justify-center bg-muted/40 px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <p className="text-xs font-semibold tracking-[0.2em] text-muted-foreground uppercase">
            StudieVerenigingenRaad Delft
          </p>
          <h1 className="mt-1 text-2xl font-semibold">Inloggen</h1>
        </div>

        {onbeveiligd ? (
          <Melding toon="waarschuwing" className="mb-4" titel="Geen beveiligde verbinding">
            Deze verbinding is niet versleuteld (http). Je wachtwoord en je
            sessie gaan leesbaar over het netwerk. Log alleen in op een netwerk
            dat je vertrouwt, tot https is ingesteld.
          </Melding>
        ) : null}

        {kanInloggen ? (
          <InlogFormulier verder={verder} />
        ) : (
          <Melding toon="fout" titel="Inloggen kan nog niet">
            Inloggen kan zodra de beveiligde verbinding (https) is ingesteld.
            De publieke pagina&apos;s werken gewoon.
          </Melding>
        )}

        <p className="mt-6 text-center text-xs text-muted-foreground">
          Accounts worden door het SVR-bestuur aangemaakt. Geen wachtwoord meer?
          Vraag het bestuur om een nieuw wachtwoord.
        </p>
      </div>
    </main>
  );
}
