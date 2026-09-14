"use client";

import Link from "next/link";
import { useActionState, useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input, Select, Textarea, Veld } from "@/components/ui/input";
import { Melding } from "@/components/ui/melding";
import { formatteerEuro, parseerBedragNaarCenten } from "@/lib/geld";
import type { ActieStaat } from "@/lib/acties";

import { bewaarFactuur } from "./acties";

export interface KeuzePost {
  id: string;
  code: string;
  naam: string;
  soort: string;
}

export interface KeuzeRelatie {
  id: string;
  naam: string;
}

export interface KeuzeEvenement {
  id: string;
  naam: string;
}

export interface RegelWaarden {
  omschrijving: string;
  aantal: string;
  prijs: string;
  begrotingspostId: string;
}

export interface FactuurWaarden {
  id?: string;
  nummer?: string;
  relatieId: string;
  omschrijving: string;
  factuurdatum: string;
  vervaldatum: string;
  evenementId: string;
  notities: string;
  regels: RegelWaarden[];
}

export function FactuurFormulier({
  waarden,
  relaties,
  posten,
  evenementen,
}: {
  waarden: FactuurWaarden;
  relaties: KeuzeRelatie[];
  posten: KeuzePost[];
  evenementen: KeuzeEvenement[];
}) {
  const [staat, actie, bezig] = useActionState<ActieStaat, FormData>(
    bewaarFactuur,
    {},
  );
  const [regels, setRegels] = useState<RegelWaarden[]>(
    waarden.regels.length > 0
      ? waarden.regels
      : [
          {
            omschrijving: "",
            aantal: "1",
            prijs: "",
            begrotingspostId: posten[0]?.id ?? "",
          },
        ],
  );

  const berekend = useMemo(
    () =>
      regels.map((regel) => {
        const aantal = Number.parseInt(regel.aantal, 10);
        const prijsCenten = parseerBedragNaarCenten(regel.prijs);
        const geldig =
          Number.isFinite(aantal) && aantal > 0 && prijsCenten !== null;
        return {
          aantal: geldig ? aantal : 0,
          prijsPerStukCenten: prijsCenten ?? 0,
          bedragCenten: geldig ? aantal * (prijsCenten ?? 0) : 0,
          geldig,
        };
      }),
    [regels],
  );

  const totaalCenten = berekend.reduce(
    (som, regel) => som + regel.bedragCenten,
    0,
  );

  const regelsJson = JSON.stringify(
    regels.map((regel, index) => ({
      omschrijving: regel.omschrijving.trim(),
      aantal: berekend[index].aantal,
      prijsPerStukCenten: berekend[index].prijsPerStukCenten,
      begrotingspostId: regel.begrotingspostId,
    })),
  );

  function wijzigRegel(index: number, deel: Partial<RegelWaarden>) {
    setRegels((vorige) =>
      vorige.map((regel, i) => (i === index ? { ...regel, ...deel } : regel)),
    );
  }

  return (
    <form action={actie} className="space-y-4">
      {waarden.id ? <input type="hidden" name="id" value={waarden.id} /> : null}
      <input type="hidden" name="regelsJson" value={regelsJson} />

      <Card>
        <CardContent className="grid gap-4 pt-5 sm:grid-cols-2">
          <Veld
            label="Relatie"
            htmlFor="relatieId"
            verplicht
            fout={staat.veldfouten?.relatieId}
          >
            <Select
              id="relatieId"
              name="relatieId"
              defaultValue={waarden.relatieId}
              required
            >
              <option value="">Kies een relatie…</option>
              {relaties.map((relatie) => (
                <option key={relatie.id} value={relatie.id}>
                  {relatie.naam}
                </option>
              ))}
            </Select>
          </Veld>

          <Veld
            label="Omschrijving"
            htmlFor="omschrijving"
            verplicht
            fout={staat.veldfouten?.omschrijving}
          >
            <Input
              id="omschrijving"
              name="omschrijving"
              defaultValue={waarden.omschrijving}
              required
              placeholder="Bijvoorbeeld: Deelname LBG 2027"
            />
          </Veld>

          <Veld
            label="Factuurdatum"
            htmlFor="factuurdatum"
            verplicht
            fout={staat.veldfouten?.factuurdatum}
          >
            <Input
              id="factuurdatum"
              name="factuurdatum"
              type="date"
              defaultValue={waarden.factuurdatum}
              required
            />
          </Veld>

          <Veld
            label="Vervaldatum"
            htmlFor="vervaldatum"
            verplicht
            fout={staat.veldfouten?.vervaldatum}
          >
            <Input
              id="vervaldatum"
              name="vervaldatum"
              type="date"
              defaultValue={waarden.vervaldatum}
              required
            />
          </Veld>

          {evenementen.length > 0 ? (
            <Veld
              label="Evenement"
              htmlFor="evenementId"
              toelichting="Alleen invullen als deze factuur bij een evenement hoort."
            >
              <Select
                id="evenementId"
                name="evenementId"
                defaultValue={waarden.evenementId}
              >
                <option value="">Geen</option>
                {evenementen.map((evenement) => (
                  <option key={evenement.id} value={evenement.id}>
                    {evenement.naam}
                  </option>
                ))}
              </Select>
            </Veld>
          ) : null}

          <Veld label="Notities" htmlFor="notities">
            <Textarea
              id="notities"
              name="notities"
              defaultValue={waarden.notities}
              rows={2}
            />
          </Veld>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Factuurregels</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {regels.map((regel, index) => (
            <div
              key={index}
              className="grid gap-3 rounded-lg border border-border p-3 sm:grid-cols-12"
            >
              <div className="sm:col-span-5">
                <label className="text-xs font-medium text-muted-foreground">
                  Omschrijving
                </label>
                <Input
                  value={regel.omschrijving}
                  onChange={(gebeurtenis) =>
                    wijzigRegel(index, { omschrijving: gebeurtenis.target.value })
                  }
                  placeholder="Waar gaat deze regel over?"
                />
              </div>

              <div className="sm:col-span-4">
                <label className="text-xs font-medium text-muted-foreground">
                  Begrotingspost
                </label>
                <Select
                  value={regel.begrotingspostId}
                  onChange={(gebeurtenis) =>
                    wijzigRegel(index, {
                      begrotingspostId: gebeurtenis.target.value,
                    })
                  }
                >
                  <option value="">Kies…</option>
                  {posten.map((post) => (
                    <option key={post.id} value={post.id}>
                      {post.code} — {post.naam}
                    </option>
                  ))}
                </Select>
              </div>

              <div className="sm:col-span-1">
                <label className="text-xs font-medium text-muted-foreground">
                  Aantal
                </label>
                <Input
                  value={regel.aantal}
                  inputMode="numeric"
                  className="cijfers text-right"
                  onChange={(gebeurtenis) =>
                    wijzigRegel(index, { aantal: gebeurtenis.target.value })
                  }
                />
              </div>

              <div className="sm:col-span-2">
                <label className="text-xs font-medium text-muted-foreground">
                  Prijs per stuk
                </label>
                <Input
                  value={regel.prijs}
                  inputMode="decimal"
                  placeholder="0,00"
                  className="cijfers text-right"
                  onChange={(gebeurtenis) =>
                    wijzigRegel(index, { prijs: gebeurtenis.target.value })
                  }
                />
              </div>

              <div className="flex items-center justify-between gap-2 sm:col-span-12">
                <span className="cijfers text-sm text-muted-foreground">
                  Regelbedrag: {formatteerEuro(berekend[index].bedragCenten)}
                </span>
                {regels.length > 1 ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      setRegels((vorige) =>
                        vorige.filter((_, i) => i !== index),
                      )
                    }
                  >
                    <Trash2 />
                    Regel verwijderen
                  </Button>
                ) : null}
              </div>
            </div>
          ))}

          <div className="flex flex-wrap items-center justify-between gap-3">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() =>
                setRegels((vorige) => [
                  ...vorige,
                  {
                    omschrijving: "",
                    aantal: "1",
                    prijs: "",
                    begrotingspostId: posten[0]?.id ?? "",
                  },
                ])
              }
            >
              <Plus />
              Regel toevoegen
            </Button>
            <p className="cijfers text-base font-semibold">
              Totaal: {formatteerEuro(totaalCenten)}
            </p>
          </div>
        </CardContent>
      </Card>

      {staat.fout ? <Melding toon="fout">{staat.fout}</Melding> : null}

      <div className="flex gap-2">
        <Button type="submit" disabled={bezig}>
          {bezig ? "Bezig…" : "Opslaan als concept"}
        </Button>
        <Button type="button" variant="outline" asChild>
          <Link href={waarden.id ? `/facturen/${waarden.id}` : "/facturen"}>
            Annuleren
          </Link>
        </Button>
      </div>
    </form>
  );
}
