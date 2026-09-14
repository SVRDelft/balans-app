import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";
import {
  FACTUUR_STATUS_LABEL,
  EVENEMENT_STATUS_LABEL,
  type FactuurStatus,
  type EvenementStatus,
} from "@/lib/domein";

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium whitespace-nowrap",
  {
    variants: {
      variant: {
        default: "border-transparent bg-primary/10 text-primary",
        neutraal: "border-border bg-muted text-muted-foreground",
        goed: "border-transparent bg-success/12 text-success",
        waarschuwing: "border-transparent bg-warning/20 text-warning-foreground",
        fout: "border-transparent bg-destructive/12 text-destructive",
        omlijnd: "border-border bg-card text-foreground",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

function Badge({
  className,
  variant,
  ...props
}: React.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return (
    <span className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

const FACTUUR_STATUS_VARIANT: Record<
  FactuurStatus,
  VariantProps<typeof badgeVariants>["variant"]
> = {
  concept: "neutraal",
  verstuurd: "default",
  deels_betaald: "waarschuwing",
  betaald: "goed",
  oninbaar: "fout",
  gecrediteerd: "neutraal",
};

function FactuurStatusBadge({ status }: { status: string }) {
  const sleutel = status as FactuurStatus;
  return (
    <Badge variant={FACTUUR_STATUS_VARIANT[sleutel] ?? "neutraal"}>
      {FACTUUR_STATUS_LABEL[sleutel] ?? status}
    </Badge>
  );
}

const EVENEMENT_STATUS_VARIANT: Record<
  EvenementStatus,
  VariantProps<typeof badgeVariants>["variant"]
> = {
  open: "default",
  omslag_berekend: "waarschuwing",
  afgesloten: "goed",
};

function EvenementStatusBadge({ status }: { status: string }) {
  const sleutel = status as EvenementStatus;
  return (
    <Badge variant={EVENEMENT_STATUS_VARIANT[sleutel] ?? "neutraal"}>
      {EVENEMENT_STATUS_LABEL[sleutel] ?? status}
    </Badge>
  );
}

export { Badge, badgeVariants, FactuurStatusBadge, EvenementStatusBadge };
