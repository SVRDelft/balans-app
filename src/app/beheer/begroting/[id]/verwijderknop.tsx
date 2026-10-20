"use client";

import { Trash2 } from "lucide-react";

import { BevestigKnop } from "@/components/bevestigknop";

import { verwijderBegrotingspost } from "../acties";

export function VerwijderPostKnop({ id, code }: { id: string; code: string }) {
  return (
    <BevestigKnop
      actie={verwijderBegrotingspost}
      velden={{ id }}
      vraag={`Begrotingspost ${code} verwijderen?`}
    >
      <Trash2 />
      Verwijderen
    </BevestigKnop>
  );
}
