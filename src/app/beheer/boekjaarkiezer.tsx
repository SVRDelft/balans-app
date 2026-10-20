"use client";

import { useTransition } from "react";

import { Select } from "@/components/ui/input";

import { kiesBoekjaar } from "./acties";

interface Keuze {
  id: string;
  naam: string;
  actief: boolean;
}

export function Boekjaarkiezer({
  boekjaren,
  huidigId,
}: {
  boekjaren: Keuze[];
  huidigId: string;
}) {
  const [bezig, startOvergang] = useTransition();

  return (
    <label className="flex items-center gap-2 text-sm">
      <span className="sr-only">Boekjaar</span>
      <Select
        className="h-9 w-auto max-w-full min-w-0 text-sm sm:min-w-[15rem]"
        value={huidigId}
        disabled={bezig}
        onChange={(gebeurtenis) => {
          const id = gebeurtenis.target.value;
          startOvergang(async () => {
            await kiesBoekjaar(id);
          });
        }}
      >
        {boekjaren.map((boekjaar) => (
          <option key={boekjaar.id} value={boekjaar.id}>
            {boekjaar.naam}
            {boekjaar.actief ? " (actief)" : ""}
          </option>
        ))}
      </Select>
    </label>
  );
}
