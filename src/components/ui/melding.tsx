import * as React from "react";
import { AlertTriangle, CheckCircle2, Info, OctagonAlert } from "lucide-react";

import { cn } from "@/lib/utils";

type Toon = "info" | "goed" | "waarschuwing" | "fout";

const STIJL: Record<Toon, string> = {
  info: "border-border bg-muted/60 text-foreground",
  goed: "border-success/30 bg-success/8 text-foreground",
  waarschuwing: "border-warning/45 bg-warning/12 text-foreground",
  fout: "border-destructive/35 bg-destructive/8 text-foreground",
};

const ICOON_KLEUR: Record<Toon, string> = {
  info: "text-muted-foreground",
  goed: "text-success",
  waarschuwing: "text-warning-foreground",
  fout: "text-destructive",
};

const ICOON = {
  info: Info,
  goed: CheckCircle2,
  waarschuwing: AlertTriangle,
  fout: OctagonAlert,
};

/** Een blok met uitleg, waarschuwing of foutmelding. */
export function Melding({
  toon = "info",
  titel,
  children,
  className,
}: {
  toon?: Toon;
  titel?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
}) {
  const Icoon = ICOON[toon];
  return (
    <div
      className={cn(
        "flex gap-3 rounded-lg border px-4 py-3 text-sm",
        STIJL[toon],
        className,
      )}
      role={toon === "fout" ? "alert" : undefined}
    >
      <Icoon className={cn("mt-0.5 size-4 shrink-0", ICOON_KLEUR[toon])} />
      <div className="min-w-0 flex-1 space-y-1">
        {titel ? <p className="font-semibold">{titel}</p> : null}
        {children ? <div className="[&_p]:leading-relaxed">{children}</div> : null}
      </div>
    </div>
  );
}

/** Lege staat in een lijst of tabel. */
export function Leeg({
  titel,
  children,
}: {
  titel: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-dashed border-border px-6 py-10 text-center">
      <p className="text-sm font-medium text-foreground">{titel}</p>
      {children ? (
        <div className="mt-1 text-sm text-muted-foreground">{children}</div>
      ) : null}
    </div>
  );
}
