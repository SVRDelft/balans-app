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
        className="h-8 w-auto min-w-[15rem] text-sm"
        value={huidigId}
        disabled={bezig}
        onChange={(gebeurtenis) => {
          const id = gebeurtenis.target.value;
          startOvergang(() => {
            void kiesBoekjaar(id);
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
