import Link from "next/link";
import { LogOut, Lock } from "lucide-react";

import { Navigatie } from "@/components/navigatie";
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
      <a href="#inhoud" className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-lg focus:bg-primary focus:px-4 focus:py-3 focus:text-white">Naar de inhoud</a>
      <aside className="niet-afdrukken border-b border-border bg-card lg:sticky lg:top-0 lg:flex lg:h-dvh lg:w-60 lg:shrink-0 lg:flex-col lg:overflow-y-auto lg:border-r lg:border-b-0">
        <div className="flex items-center justify-between px-4 py-3 lg:block lg:py-4">
          <Link href="/" className="flex items-center gap-3">
            {/* The authenticated logo endpoint also supplies the built-in SVR logo. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/api/logo" alt="" className="size-10 rounded-lg object-contain" />
            <div>
            <p className="text-[0.68rem] font-semibold tracking-[0.18em] text-muted-foreground uppercase">
              SVR Delft
            </p>
            <p className="text-sm font-semibold">Administratie</p>
            </div>
          </Link>
        </div>
        <Navigatie />
        <div className="mt-auto hidden border-t border-border px-4 py-4 lg:block">
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

      <div className="min-w-0 flex-1">
        <header className="niet-afdrukken flex flex-wrap items-center justify-between gap-3 border-b border-border bg-card px-4 py-3 lg:px-8">
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

        <main key={context?.boekjaar.id ?? "begin"} id="inhoud" tabIndex={-1} className="mx-auto max-w-[1600px] px-4 py-6 outline-none lg:px-8 lg:py-8">
          {children}
        </main>
      </div>
    </div>
  );
}
