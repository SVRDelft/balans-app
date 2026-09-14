"use client";

import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Melding } from "@/components/ui/melding";

export default function Foutpagina({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <Melding toon="fout" titel="Er ging iets mis">
        <p>{error.message || "Onbekende fout."}</p>
      </Melding>
      <div className="flex gap-2">
        <Button onClick={reset}>Opnieuw proberen</Button>
        <Button variant="outline" asChild>
          <Link href="/">Terug naar het dashboard</Link>
        </Button>
      </div>
    </div>
  );
}
