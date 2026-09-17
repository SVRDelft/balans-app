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
  type?: string;
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
  const nieuw = !waarden.id;
  const [gekozenRelaties, setGekozenRelaties] = useState<string[]>(
    waarden.relatieId ? [waarden.relatieId] : [],
  );
  const [verstuurNu, setVerstuurNu] = useState(false);
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
        const aantal = Number(regel.aantal);
        const prijsCenten = parseerBedragNaarCenten(regel.prijs);
        const geldig =
          Number.isInteger(aantal) && aantal > 0 && prijsCenten !== null;
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
            label={nieuw ? "Voor wie" : "Relatie"}
            htmlFor={nieuw ? "relatieZoeken" : "relatieId"}
            className={nieuw ? "sm:col-span-2" : undefined}
            toelichting={nieuw ? "Kies je meerdere relaties, dan krijgt elk een eigen factuur met dezelfde regels." : undefined}
            verplicht
            fout={staat.veldfouten?.relatieId}
          >
            {nieuw ? (
              <RelatieKiezer
                relaties={relaties}
                gekozen={gekozenRelaties}
                onChange={setGekozenRelaties}
              />
            ) : (
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
            )}
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
                  aria-label={`Omschrijving regel ${index + 1}`}
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
                  aria-label={`Begrotingspost regel ${index + 1}`}
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
                  aria-label={`Aantal regel ${index + 1}`}
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
                  aria-label={`Prijs per stuk regel ${index + 1}`}
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

      {nieuw ? (
        <label className="flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            name="verstuurNu"
            value="aan"
            className="mt-0.5 size-4"
            checked={verstuurNu}
            onChange={(gebeurtenis) => setVerstuurNu(gebeurtenis.target.checked)}
          />
          <span>
            Meteen op verstuurd zetten
            <span className="block text-xs text-muted-foreground">
              Dan telt de factuur direct mee en kan een bankbetaling er meteen aan gekoppeld worden. Wijzigen kan daarna alleen nog via een creditfactuur.
            </span>
          </span>
        </label>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={bezig || (nieuw && gekozenRelaties.length === 0)}>
          {bezig
            ? "Bezig…"
            : !nieuw
              ? "Opslaan als concept"
              : gekozenRelaties.length > 1
                ? `${gekozenRelaties.length} facturen ${verstuurNu ? "aanmaken en versturen" : "als concept opslaan"} (${formatteerEuro(totaalCenten * gekozenRelaties.length)})`
                : verstuurNu
                  ? "Aanmaken en op verstuurd zetten"
                  : "Opslaan als concept"}
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

/** Eén of meer relaties kiezen, met snelkeuzes per soort relatie. */
function RelatieKiezer({
  relaties,
  gekozen,
  onChange,
}: {
  relaties: KeuzeRelatie[];
  gekozen: string[];
  onChange: (ids: string[]) => void;
}) {
  const [zoek, setZoek] = useState("");
  const aan = new Set(gekozen);
  const zichtbaar = relaties.filter((relatie) =>
    relatie.naam.toLowerCase().includes(zoek.trim().toLowerCase()),
  );
  const verenigingen = relaties.filter((relatie) => relatie.type === "studievereniging");

  const zet = (id: string, waarde: boolean) => {
    const volgende = new Set(aan);
    if (waarde) volgende.add(id);
    else volgende.delete(id);
    // Volgorde van de lijst aanhouden, zodat de nummers alfabetisch oplopen.
    onChange(relaties.filter((relatie) => volgende.has(relatie.id)).map((relatie) => relatie.id));
  };

  return (
    <div className="space-y-2">
      {gekozen.map((id) => (
        <input key={id} type="hidden" name="relatieId" value={id} />
      ))}
      <div className="flex flex-wrap items-center gap-2">
        <Input
          id="relatieZoeken"
          value={zoek}
          onChange={(gebeurtenis) => setZoek(gebeurtenis.target.value)}
          placeholder="Zoek een relatie…"
          className="min-w-0 flex-1"
        />
        {verenigingen.length > 0 ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onChange(relaties.filter((relatie) => aan.has(relatie.id) || relatie.type === "studievereniging").map((relatie) => relatie.id))}
          >
            Alle studieverenigingen
          </Button>
        ) : null}
        {gekozen.length > 0 ? (
          <Button type="button" variant="ghost" size="sm" onClick={() => onChange([])}>
            Wissen
          </Button>
        ) : null}
      </div>
      <ul className="max-h-56 divide-y divide-border overflow-y-auto rounded-lg border border-border">
        {zichtbaar.map((relatie) => (
          <li key={relatie.id}>
            <label className="flex cursor-pointer items-center gap-2 px-3 py-1.5 text-sm hover:bg-muted/40">
              <input
                type="checkbox"
                className="size-4"
                checked={aan.has(relatie.id)}
                onChange={(gebeurtenis) => zet(relatie.id, gebeurtenis.target.checked)}
              />
              {relatie.naam}
            </label>
          </li>
        ))}
        {zichtbaar.length === 0 ? (
          <li className="px-3 py-2 text-sm text-muted-foreground">Geen relatie gevonden.</li>
        ) : null}
      </ul>
      <p className="text-xs text-muted-foreground">
        {gekozen.length === 0
          ? "Nog niemand gekozen."
          : `${gekozen.length} gekozen: ${relaties.filter((relatie) => aan.has(relatie.id)).map((relatie) => relatie.naam).join(", ")}`}
      </p>
    </div>
  );
}
