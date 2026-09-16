import * as React from "react";

import { cn } from "@/lib/utils";

export function Paginakop({
  titel,
  beschrijving,
  acties,
  className,
}: {
  titel: string;
  beschrijving?: React.ReactNode;
  acties?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "mb-6 flex flex-wrap items-start justify-between gap-3",
        className,
      )}
    >
      <div className="min-w-0">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-[1.75rem]">{titel}</h1>
        {beschrijving ? (
          <div className="mt-1 max-w-2xl text-sm text-muted-foreground">
            {beschrijving}
          </div>
        ) : null}
      </div>
      {acties ? (
        <div className="flex max-w-full flex-wrap gap-2 niet-afdrukken">
          {acties}
        </div>
      ) : null}
    </div>
  );
}

export function Kerngetal({
  label,
  waarde,
  toelichting,
  toon = "neutraal",
}: {
  label: string;
  waarde: React.ReactNode;
  toelichting?: React.ReactNode;
  toon?: "neutraal" | "goed" | "waarschuwing" | "fout";
}) {
  const kleur = {
    neutraal: "text-foreground",
    goed: "text-success",
    waarschuwing: "text-warning-foreground",
    fout: "text-destructive",
  }[toon];

  return (
    <div className="rounded-xl border border-border bg-card px-5 py-4 shadow-xs">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className={cn("cijfers mt-2 text-2xl font-semibold tracking-tight", kleur)}>{waarde}</p>
      {toelichting ? (
        <p className="mt-0.5 text-xs text-muted-foreground">{toelichting}</p>
      ) : null}
    </div>
  );
}
