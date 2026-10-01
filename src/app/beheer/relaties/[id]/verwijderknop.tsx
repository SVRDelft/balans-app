"use client";

import { Trash2 } from "lucide-react";

import { BevestigKnop } from "@/components/bevestigknop";

import { verwijderRelatie } from "../acties";

export function VerwijderRelatieKnop({
  id,
  naam,
}: {
  id: string;
  naam: string;
}) {
  return (
    <BevestigKnop
      actie={verwijderRelatie}
      velden={{ id }}
      vraag={`${naam} verwijderen? Als er al facturen of uitgaven aan hangen, wordt de relatie alleen op non-actief gezet.`}
      variant="outline"
    >
      <Trash2 />
      Verwijderen
    </BevestigKnop>
  );
}
