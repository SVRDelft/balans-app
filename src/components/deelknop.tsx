"use client";

import { useState, useTransition } from "react";
import { Check, Link2 } from "lucide-react";

import { haalDeellink } from "@/app/portaal/acties";
import { cn } from "@/lib/utils";

/**
 * Zet de deellink van een agenda of notulen op het klembord. Wie die link
 * krijgt, kan het stuk openen zonder in te loggen.
 */
export function DeelKnop({ bestandId, className }: { bestandId: string; className?: string }) {
  const [bezig, starten] = useTransition();
  const [staat, setStaat] = useState<{ link?: string; fout?: string; gekopieerd?: boolean }>({});

  function deel() {
    starten(async () => {
      const uitkomst = await haalDeellink(bestandId);
      if ("fout" in uitkomst) {
        setStaat({ fout: uitkomst.fout });
        return;
      }
      const link = new URL(uitkomst.pad, window.location.origin).toString();
      let gekopieerd = false;
      try {
        await navigator.clipboard.writeText(link);
        gekopieerd = true;
      } catch {
        // Geen klembord (oude browser, geen https): dan tonen we de link.
      }
      setStaat({ link, gekopieerd });
    });
  }

  return (
    <span className={cn("inline-flex flex-col gap-1", className)}>
      <button
        type="button"
        onClick={deel}
        disabled={bezig}
        title="Link kopiëren: wie hem krijgt, kan dit stuk openen zonder in te loggen"
        className="inline-flex items-center gap-1 text-xs text-primary underline disabled:opacity-60"
      >
        {staat.gekopieerd ? <Check className="size-3.5" /> : <Link2 className="size-3.5" />}
        {bezig ? "Bezig…" : staat.gekopieerd ? "Link gekopieerd" : "Deel"}
      </button>
      {staat.link && !staat.gekopieerd ? (
        <input
          readOnly
          value={staat.link}
          onFocus={(gebeurtenis) => gebeurtenis.currentTarget.select()}
          aria-label="Deellink"
          className="w-64 rounded border border-border bg-card px-1.5 py-0.5 text-xs"
        />
      ) : null}
      {staat.fout ? (
        <span role="alert" className="text-xs text-destructive">
          {staat.fout}
        </span>
      ) : null}
    </span>
  );
}
