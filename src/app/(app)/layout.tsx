import Link from "next/link";
import { LogOut, Lock } from "lucide-react";

import { Navigatie } from "@/components/navigatie";
import { Melding } from "@/components/ui/melding";
import { Button } from "@/components/ui/button";
import { vereisSessie } from "@/lib/auth/server";
import { haalBoekjaarContext } from "@/lib/boekjaar";
import { formatteerDatum } from "@/lib/datum";

import { uitloggen } from "../inloggen/acties";
import { Boekjaarkiezer } from "./boekjaarkiezer";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const sessie = await vereisSessie();
  const context = await haalBoekjaarContext();

  return (
    <div className="min-h-dvh lg:flex">
      <aside className="border-b border-border bg-card lg:h-dvh lg:w-60 lg:shrink-0 lg:overflow-y-auto lg:border-r lg:border-b-0">
        <div className="flex items-center justify-between px-4 py-3 lg:block lg:py-4">
          <Link href="/" className="block">
            <p className="text-[0.68rem] font-semibold tracking-[0.18em] text-muted-foreground uppercase">
              SVR Delft
            </p>
            <p className="text-sm font-semibold">Administratie</p>
          </Link>
        </div>
        <Navigatie />
        <div className="hidden px-4 py-4 lg:block">
          <p className="text-xs text-muted-foreground">Ingelogd als</p>
          <p className="truncate text-sm font-medium">{sessie.naam}</p>
          <form action={uitloggen} className="mt-2">
            <Button type="submit" variant="ghost" size="sm" className="-ml-2.5">
              <LogOut />
              Uitloggen
            </Button>
          </form>
        </div>
      </aside>

      <div className="min-w-0 flex-1 lg:h-dvh lg:overflow-y-auto">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-card px-4 py-2.5 lg:px-8">
          {context ? (
            <>
              <div className="flex flex-wrap items-center gap-3">
                <Boekjaarkiezer
                  boekjaren={context.alleBoekjaren.map((jaar) => ({
                    id: jaar.id,
                    naam: jaar.naam,
                    actief: jaar.actief,
                  }))}
                  huidigId={context.boekjaar.id}
                />
                <span className="text-xs text-muted-foreground">
                  {formatteerDatum(context.boekjaar.startDatum)} t/m{" "}
                  {formatteerDatum(context.boekjaar.eindDatum)}
                </span>
              </div>
              {!context.schrijfbaar ? (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-warning/20 px-2.5 py-1 text-xs font-medium">
                  <Lock className="size-3.5" />
                  Alleen lezen — dit boekjaar is niet actief
                </span>
              ) : null}
            </>
          ) : (
            <span className="text-sm text-muted-foreground">
              Nog geen boekjaar ingericht
            </span>
          )}
          <form action={uitloggen} className="lg:hidden">
            <Button type="submit" variant="ghost" size="sm">
              <LogOut />
              Uitloggen
            </Button>
          </form>
        </header>

        <main className="px-4 py-6 lg:px-8 lg:py-8">
          {context ? (
            children
          ) : (
            <Melding toon="waarschuwing" titel="Er is nog geen boekjaar">
              <p>
                Draai <code className="font-mono">npm run db:seed</code> om de
                startgegevens te laden, of maak zelf een boekjaar aan bij{" "}
                <Link href="/boekjaren" className="underline">
                  Beheer › Boekjaren
                </Link>
                .
              </p>
            </Melding>
          )}
        </main>
      </div>
    </div>
  );
}
