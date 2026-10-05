"use client";

import { useActionState, useState } from "react";
import { Check } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input, Select, Veld } from "@/components/ui/input";
import { Melding } from "@/components/ui/melding";
import type { ActieStaat } from "@/lib/acties";
import { formatteerEuro } from "@/lib/geld";

import { boekBankregelsSnel } from "../acties";

export interface SnelRegel {
  id: string;
  datum: string;
  bedragCenten: number;
  omschrijving: string;
  tegenpartij: string;
  /** Relatie die bij het rekeningnummer of de naam hoort, als die gevonden is. */
  relatieId: string;
}

interface Post {
  id: string;
  code: string;
  naam: string;
}

/**
 * Een oud boekjaar opbouwen uit het afschrift: van elke bijschrijving een
 * betaalde factuur en van elke afschrijving een betaalde uitgave.
 *
 * Alles staat in één formulier, zodat je de hele stapel in één keer nakijkt in
 * plaats van vijftig keer hetzelfde te klikken. Wat je niet aanvinkt, blijft
 * gewoon openstaan.
 */
export function SnelBoeken({
  importId,
  regels,
  relaties,
  inkomstenposten,
  uitgavenposten,
}: {
  importId: string;
  regels: SnelRegel[];
  relaties: { id: string; naam: string }[];
  inkomstenposten: Post[];
  uitgavenposten: Post[];
}) {
  const [staat, actie, bezig] = useActionState<ActieStaat, FormData>(
    boekBankregelsSnel,
    {},
  );
  const [aangevinkt, setAangevinkt] = useState<Record<string, boolean>>({});
  const [soorten, setSoorten] = useState<Record<string, string>>({});
  const alles = regels.every((regel) => aangevinkt[regel.id]);

  return (
    <form action={actie} className="space-y-4" aria-busy={bezig}>
      <input type="hidden" name="importId" value={importId} />
      <fieldset disabled={bezig} className="min-w-0 space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <Veld
            label="Standaard inkomstenpost"
            htmlFor="standaardInkomstenpost"
            toelichting="Gebruikt voor elke bijschrijving waar je zelf geen post kiest."
          >
            <Select
              id="standaardInkomstenpost"
              name="standaardInkomstenpost"
              defaultValue=""
            >
              <option value="">Geen</option>
              {inkomstenposten.map((post) => (
                <option key={post.id} value={post.id}>
                  {post.code} - {post.naam}
                </option>
              ))}
            </Select>
          </Veld>
          <Veld
            label="Standaard uitgavenpost"
            htmlFor="standaardUitgavenpost"
            toelichting="Gebruikt voor elke afschrijving waar je zelf geen post kiest."
          >
            <Select
              id="standaardUitgavenpost"
              name="standaardUitgavenpost"
              defaultValue=""
            >
              <option value="">Geen</option>
              {uitgavenposten.map((post) => (
                <option key={post.id} value={post.id}>
                  {post.code} - {post.naam}
                </option>
              ))}
            </Select>
          </Veld>
        </div>

        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() =>
            setAangevinkt(
              alles
                ? {}
                : Object.fromEntries(regels.map((regel) => [regel.id, true])),
            )
          }
        >
          {alles ? "Niets aanvinken" : "Alle " + regels.length + " aanvinken"}
        </Button>

        <div className="space-y-3">
          {regels.map((regel) => {
            const soort = soorten[regel.id] ?? "boeking";
            const posten =
              regel.bedragCenten > 0 ? inkomstenposten : uitgavenposten;
            return (
              <div
                key={regel.id}
                className="rounded-lg border border-border bg-muted/30 p-3"
              >
                <label className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    name="mutatieId"
                    value={regel.id}
                    checked={aangevinkt[regel.id] ?? false}
                    onChange={(event) =>
                      setAangevinkt((vorig) => ({
                        ...vorig,
                        [regel.id]: event.target.checked,
                      }))
                    }
                    className="mt-1 size-4 shrink-0"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block text-xs text-muted-foreground">
                      {regel.datum}
                      {regel.tegenpartij ? " · " + regel.tegenpartij : ""}
                    </span>
                    <span className="block truncate text-sm">
                      {regel.omschrijving || "Zonder omschrijving"}
                    </span>
                  </span>
                  <span
                    className={
                      "cijfers shrink-0 text-sm font-semibold " +
                      (regel.bedragCenten > 0 ? "text-success" : "")
                    }
                  >
                    {formatteerEuro(regel.bedragCenten)}
                  </span>
                </label>

                {aangevinkt[regel.id] ? (
                  <div className="mt-3 grid gap-3 border-t border-border pt-3 sm:grid-cols-2">
                    <Veld label="Soort" htmlFor={"soort-" + regel.id}>
                      <Select
                        id={"soort-" + regel.id}
                        name={"soort-" + regel.id}
                        value={soort}
                        onChange={(event) =>
                          setSoorten((vorig) => ({
                            ...vorig,
                            [regel.id]: event.target.value,
                          }))
                        }
                      >
                        <option value="boeking">
                          {regel.bedragCenten > 0
                            ? "Inkomst (betaalde factuur)"
                            : "Uitgave (al betaald)"}
                        </option>
                        <option value="rekeningpost">
                          {regel.bedragCenten > 0
                            ? "Terugbetaling op rekening-courant"
                            : "Privé of voorgeschoten"}
                        </option>
                      </Select>
                    </Veld>

                    <Veld
                      label={
                        regel.bedragCenten > 0 || soort === "rekeningpost"
                          ? "Van wie"
                          : "Relatie (mag leeg)"
                      }
                      htmlFor={"relatie-" + regel.id}
                    >
                      <Select
                        id={"relatie-" + regel.id}
                        name={"relatie-" + regel.id}
                        defaultValue={regel.relatieId}
                      >
                        <option value="">Geen</option>
                        {relaties.map((relatie) => (
                          <option key={relatie.id} value={relatie.id}>
                            {relatie.naam}
                          </option>
                        ))}
                      </Select>
                    </Veld>

                    {soort === "rekeningpost" ? null : (
                      <Veld
                        label="Begrotingspost"
                        htmlFor={"post-" + regel.id}
                        toelichting="Leeg laten betekent: de standaardpost hierboven."
                      >
                        <Select
                          id={"post-" + regel.id}
                          name={"post-" + regel.id}
                          defaultValue=""
                        >
                          <option value="">Standaardpost</option>
                          {posten.map((post) => (
                            <option key={post.id} value={post.id}>
                              {post.code} - {post.naam}
                            </option>
                          ))}
                        </Select>
                      </Veld>
                    )}

                    <Veld
                      label="Omschrijving"
                      htmlFor={"omschrijving-" + regel.id}
                    >
                      <Input
                        id={"omschrijving-" + regel.id}
                        name={"omschrijving-" + regel.id}
                        defaultValue={
                          regel.omschrijving.slice(0, 120) ||
                          "Bankregel zonder omschrijving"
                        }
                      />
                    </Veld>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>

        {staat.fout ? <Melding toon="fout">{staat.fout}</Melding> : null}
        {staat.melding ? (
          <div role="status">
            <Melding toon="goed">{staat.melding}</Melding>
          </div>
        ) : null}

        <Button
          type="submit"
          disabled={bezig || !regels.some((regel) => aangevinkt[regel.id])}
        >
          <Check aria-hidden />
          {bezig ? "Bezig…" : "Aangevinkte regels boeken"}
        </Button>
      </fieldset>
    </form>
  );
}
