import type { Metadata } from "next";

import { InlogFormulier } from "./formulier";

export const metadata: Metadata = { title: "Inloggen" };

export default async function InloggenPagina({
  searchParams,
}: PageProps<"/inloggen">) {
  const parameters = await searchParams;
  const verder =
    typeof parameters.verder === "string" ? parameters.verder : "/";

  return (
    <main className="flex min-h-dvh items-center justify-center bg-muted/40 px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <p className="text-xs font-semibold tracking-[0.2em] text-muted-foreground uppercase">
            StudieVerenigingenRaad Delft
          </p>
          <h1 className="mt-1 text-2xl font-semibold">Financiële administratie</h1>
        </div>

        <InlogFormulier verder={verder} />

        <p className="mt-6 text-center text-xs text-muted-foreground">
          Het bestuur deelt één wachtwoord. Je naam wordt bij elke wijziging
          vastgelegd.
        </p>
      </div>
    </main>
  );
}
