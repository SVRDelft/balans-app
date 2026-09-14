"use client";

import { useActionState } from "react";

import { Button, type buttonVariants } from "@/components/ui/button";
import type { VariantProps } from "class-variance-authority";
import type { ActieStaat } from "@/lib/acties";

/**
 * Knop die een server action uitvoert nadat de gebruiker heeft bevestigd.
 * Gebruikt voor alles wat niet zomaar terug te draaien is.
 */
export function BevestigKnop({
  actie,
  vraag,
  velden,
  children,
  variant = "outline",
  size = "default",
  className,
}: {
  actie: (staat: ActieStaat, formulier: FormData) => Promise<ActieStaat>;
  vraag: string;
  velden: Record<string, string>;
  children: React.ReactNode;
  variant?: VariantProps<typeof buttonVariants>["variant"];
  size?: VariantProps<typeof buttonVariants>["size"];
  className?: string;
}) {
  const [staat, uitvoeren, bezig] = useActionState<ActieStaat, FormData>(
    actie,
    {},
  );

  return (
    <form
      action={uitvoeren}
      className={className}
      onSubmit={(gebeurtenis) => {
        if (!window.confirm(vraag)) gebeurtenis.preventDefault();
      }}
    >
      {Object.entries(velden).map(([naam, waarde]) => (
        <input key={naam} type="hidden" name={naam} value={waarde} />
      ))}
      <Button type="submit" variant={variant} size={size} disabled={bezig}>
        {children}
      </Button>
      {staat.fout ? (
        <p className="mt-1 text-xs text-destructive">{staat.fout}</p>
      ) : null}
    </form>
  );
}
