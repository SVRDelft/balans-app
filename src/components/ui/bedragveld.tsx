"use client";

import { useState } from "react";

import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { formatteerEuro, parseerBedragNaarCenten } from "@/lib/geld";

/**
 * Tekstveld voor een bedrag in euro's. Accepteert "1234,56", "1.234,56" en
 * "1234.56"; de server leest het met dezelfde functie terug naar centen.
 */
export function Bedragveld({
  name,
  id,
  defaultValue = "",
  required,
  className,
  placeholder = "0,00",
}: {
  name: string;
  id?: string;
  defaultValue?: string;
  required?: boolean;
  className?: string;
  placeholder?: string;
}) {
  const [waarde, setWaarde] = useState(defaultValue);
  const centen = parseerBedragNaarCenten(waarde);
  const onleesbaar = waarde.trim() !== "" && centen === null;

  return (
    <div>
      <div className="relative">
        <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm text-muted-foreground">
          €
        </span>
        <Input
          id={id}
          name={name}
          value={waarde}
          onChange={(gebeurtenis) => setWaarde(gebeurtenis.target.value)}
          required={required}
          inputMode="decimal"
          autoComplete="off"
          placeholder={placeholder}
          className={cn(
            "cijfers pl-7 text-right",
            onleesbaar && "border-destructive",
            className,
          )}
        />
      </div>
      <p
        className={cn(
          "mt-1 text-xs",
          onleesbaar ? "text-destructive" : "text-muted-foreground",
        )}
      >
        {onleesbaar
          ? "Dit bedrag is niet te lezen."
          : centen === null
            ? " "
            : formatteerEuro(centen)}
      </p>
    </div>
  );
}
