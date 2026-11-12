import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { Melding } from "@/components/ui/melding";
import { haalSessie } from "@/lib/auth/server";
import { haalToegangKeuzes } from "@/lib/auth/portaaltoegang";
import { mageInloggen, onbeveiligdMaarToegestaan } from "@/lib/beveiliging";

import { InlogTabs, type Tab } from "./formulier";

export const metadata: Metadata = {
  title: "Inloggen",
  robots: { index: false, follow: false },
};

export default async function InloggenPagina({
  searchParams,
}: PageProps<"/inloggen">) {
  // Al ingelogd met een sessie die nog klopt? Dan meteen door. Dit staat hier
  // en niet in proxy.ts: alleen hier wordt de database geraadpleegd, en een
  // cookie van een uitgezette vereniging zou anders heen en weer blijven
  // sturen tussen het inloggen en het portaal.
  const sessie = await haalSessie();
  if (sessie) redirect(sessie.rol === "BESTUUR" ? "/beheer" : "/portaal");

  const parameters = await searchParams;
  const kopregels = await headers();
  const kanInloggen = mageInloggen(kopregels);
  const onbeveiligd = onbeveiligdMaarToegestaan(kopregels);
  // Leeg als niemand ergens heen wilde: dan kiest elke manier van inloggen zelf
  // waar je uitkomt (het bestuur in /beheer, al het andere in het portaal).
  const verder = typeof parameters.verder === "string" ? parameters.verder : "";
  // Wie vanuit de administratie hierheen werd gestuurd, is het bestuur: dan
  // staat het eigen account al open. Verder begint iedereen bij de vereniging.
  const standaard: Tab =
    parameters.tab === "account" || verder.startsWith("/beheer")
      ? "account"
      : "vereniging";
  const keuzes = kanInloggen ? await haalToegangKeuzes() : null;

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

        {kanInloggen && keuzes ? (
          <InlogTabs
            verder={verder}
            standaard={standaard}
            studieverenigingen={keuzes.studieverenigingen}
            informanten={keuzes.informanten}
          />
        ) : (
          <Melding toon="fout" titel="Inloggen kan nog niet">
            Inloggen kan zodra de beveiligde verbinding (https) is ingesteld.
            De publieke pagina&apos;s werken gewoon.
          </Melding>
        )}

        <p className="mt-6 text-center text-xs text-muted-foreground">
          Wachtwoord vergeten? Vraag het SVR-bestuur om een nieuw wachtwoord.
        </p>
      </div>
    </main>
  );
}
