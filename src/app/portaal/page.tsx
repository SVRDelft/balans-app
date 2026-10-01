import type { Metadata } from "next";
import Link from "next/link";

import { haalSessie, vereisPortaal } from "@/lib/auth/server";
import { uitloggen } from "../inloggen/acties";

export const metadata: Metadata = {
  title: "Portaal",
  robots: { index: false, follow: false },
};

export default async function PortaalPagina() {
  const sessie = await vereisPortaal();
  await haalSessie();

  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      <h1 className="text-2xl font-semibold">Portaal</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Ingelogd als {sessie.naam}
        {sessie.rol === "SV" ? " (studievereniging)" : " (SVR-bestuur)"}.
      </p>

      <div className="mt-6 rounded-xl border border-border bg-card p-5">
        <h2 className="font-semibold">Nog in aanbouw</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Hier komen de mededelingen van het bestuur, de vergaderingen met hun
          agenda en notulen, en de documenten. Tot die tijd gaat dat nog per
          e-mail.
        </p>
      </div>

      <div className="mt-6 flex flex-wrap gap-3 text-sm">
        <Link className="text-primary underline" href="/wachtwoord">
          Wachtwoord wijzigen
        </Link>
        {sessie.rol === "BESTUUR" ? (
          <Link className="text-primary underline" href="/beheer">
            Naar de administratie
          </Link>
        ) : null}
        <form action={uitloggen}>
          <button type="submit" className="text-primary underline">
            Uitloggen
          </button>
        </form>
      </div>
    </main>
  );
}
