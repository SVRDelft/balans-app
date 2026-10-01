import type { Metadata } from "next";

import { vereisSessie } from "@/lib/auth/server";

import { WachtwoordFormulier } from "./formulier";

export const metadata: Metadata = {
  title: "Wachtwoord wijzigen",
  robots: { index: false, follow: false },
};

export default async function WachtwoordPagina() {
  const sessie = await vereisSessie();

  return (
    <main className="mx-auto max-w-lg px-4 py-10">
      <h1 className="text-2xl font-semibold">Wachtwoord wijzigen</h1>
      <p className="mt-2 mb-6 text-sm text-muted-foreground">
        Je bent ingelogd als {sessie.naam}. Heb je een wachtwoord van het bestuur
        gekregen, kies dan nu een eigen wachtwoord dat je verder nergens gebruikt.
      </p>
      <WachtwoordFormulier />
    </main>
  );
}
