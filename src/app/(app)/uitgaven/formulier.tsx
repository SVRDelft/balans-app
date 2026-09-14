"use client";

import Link from "next/link";
import { useActionState, useState } from "react";

import { Bedragveld } from "@/components/ui/bedragveld";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input, Select, Textarea, Veld } from "@/components/ui/input";
import { Melding } from "@/components/ui/melding";
import type { ActieStaat } from "@/lib/acties";
import { BIJLAGE_TE_GROOT, MAX_BIJLAGE_BYTES } from "@/lib/bijlagen";

import { bewaarUitgave } from "./acties";

export interface UitgaveWaarden {
  id?: string;
  datum: string;
  leverancierNaam: string;
  relatieId: string;
  omschrijving: string;
  bedrag: string;
  begrotingspostId: string;
  evenementId: string;
  bedragDefinitief: boolean;
  betaald: boolean;
  betaaldOp: string;
  notities: string;
  heeftBijlage: boolean;
}

export function UitgaveFormulier({
  waarden,
  posten,
  leveranciers,
  evenementen,
}: {
  waarden: UitgaveWaarden;
  posten: { id: string; code: string; naam: string; soort: string }[];
  leveranciers: { id: string; naam: string }[];
  evenementen: { id: string; naam: string }[];
}) {
  const [staat, actie, bezig] = useActionState<ActieStaat, FormData>(
    bewaarUitgave,
    {},
  );
  const [betaald, setBetaald] = useState(waarden.betaald);
  const [evenementId, setEvenementId] = useState(waarden.evenementId);

  return (
    <form action={actie} className="max-w-3xl space-y-4">
      {waarden.id ? <input type="hidden" name="id" value={waarden.id} /> : null}

      <Card>
        <CardContent className="grid gap-4 pt-5 sm:grid-cols-2">
          <Veld
            label="Datum"
            htmlFor="datum"
            verplicht
            fout={staat.veldfouten?.datum}
          >
            <Input
              id="datum"
              name="datum"
              type="date"
              defaultValue={waarden.datum}
              required
            />
          </Veld>

          <Veld
            label="Bedrag"
            htmlFor="bedrag"
            verplicht
            fout={staat.veldfouten?.bedrag}
          >
            <Bedragveld
              id="bedrag"
              name="bedrag"
              defaultValue={waarden.bedrag}
              required
            />
          </Veld>

          <Veld
            label="Leverancier"
            htmlFor="leverancierNaam"
            verplicht
            fout={staat.veldfouten?.leverancierNaam}
            toelichting="Vrije tekst; koppel hiernaast eventueel een bestaande relatie."
          >
            <Input
              id="leverancierNaam"
              name="leverancierNaam"
              defaultValue={waarden.leverancierNaam}
              required
              list="leverancierslijst"
            />
            <datalist id="leverancierslijst">
              {leveranciers.map((leverancier) => (
                <option key={leverancier.id} value={leverancier.naam} />
              ))}
            </datalist>
          </Veld>

          <Veld label="Gekoppelde relatie" htmlFor="relatieId">
            <Select
              id="relatieId"
              name="relatieId"
              defaultValue={waarden.relatieId}
            >
              <option value="">Geen</option>
              {leveranciers.map((leverancier) => (
                <option key={leverancier.id} value={leverancier.id}>
                  {leverancier.naam}
                </option>
              ))}
            </Select>
          </Veld>

          <Veld
            label="Omschrijving"
            htmlFor="omschrijving"
            verplicht
            fout={staat.veldfouten?.omschrijving}
            className="sm:col-span-2"
          >
            <Input
              id="omschrijving"
              name="omschrijving"
              defaultValue={waarden.omschrijving}
              required
              placeholder="Waar was deze uitgave voor?"
            />
          </Veld>

          <Veld
            label="Begrotingspost"
            htmlFor="begrotingspostId"
            verplicht
            fout={staat.veldfouten?.begrotingspostId}
            toelichting="Verplicht: zonder post is begroting tegenover realisatie onmogelijk."
          >
            <Select
              id="begrotingspostId"
              name="begrotingspostId"
              defaultValue={waarden.begrotingspostId}
              required
            >
              <option value="">Kies…</option>
              {posten.map((post) => (
                <option key={post.id} value={post.id}>
                  {post.code} — {post.naam}
                </option>
              ))}
            </Select>
          </Veld>

          <Veld
            label="Evenement"
            htmlFor="evenementId"
            toelichting="Koppel de uitgave meteen, anders valt hij buiten de omslag."
          >
            <Select
              id="evenementId"
              name="evenementId"
              value={evenementId}
              onChange={(gebeurtenis) =>
                setEvenementId(gebeurtenis.target.value)
              }
            >
              <option value="">Geen</option>
              {evenementen.map((evenement) => (
                <option key={evenement.id} value={evenement.id}>
                  {evenement.naam}
                </option>
              ))}
            </Select>
          </Veld>

          <Veld
            label="Bonnetje of leveranciersfactuur"
            htmlFor="bijlage"
            className="sm:col-span-2"
            toelichting={
              waarden.heeftBijlage
                ? "Er is al een bestand gekoppeld. Een nieuw bestand vervangt het oude."
                : "JPG, PNG, WEBP, HEIC of PDF, maximaal 4 MB."
            }
          >
            <Input
              id="bijlage"
              name="bijlage"
              type="file"
              onChange={(gebeurtenis) => {
                const invoer = gebeurtenis.currentTarget;
                const bestand = invoer.files?.[0];
                invoer.setCustomValidity(
                  bestand && bestand.size > MAX_BIJLAGE_BYTES
                    ? BIJLAGE_TE_GROOT
                    : "",
                );
                invoer.reportValidity();
              }}
              accept="image/jpeg,image/png,image/webp,image/heic,image/heif,application/pdf"
              className="py-1.5"
            />
          </Veld>

          <div className="space-y-2 sm:col-span-2">
            <label className="flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                name="bedragDefinitief"
                defaultChecked={waarden.bedragDefinitief}
                className="mt-0.5 size-4 rounded border-input"
              />
              <span>
                Het bedrag is definitief
                {evenementId ? (
                  <span className="block text-xs text-muted-foreground">
                    Zolang dit uit staat blokkeert deze uitgave de omslag van
                    het evenement. Laat het uit bij bijvoorbeeld een open bar,
                    waarvan de eindafrekening later komt.
                  </span>
                ) : null}
              </span>
            </label>

            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                name="betaald"
                checked={betaald}
                onChange={(gebeurtenis) =>
                  setBetaald(gebeurtenis.target.checked)
                }
                className="size-4 rounded border-input"
              />
              Al betaald aan de leverancier
            </label>

            {betaald ? (
              <Veld label="Betaald op" htmlFor="betaaldOp" className="max-w-56">
                <Input
                  id="betaaldOp"
                  name="betaaldOp"
                  type="date"
                  defaultValue={waarden.betaaldOp || waarden.datum}
                />
              </Veld>
            ) : null}
          </div>

          <Veld label="Notities" htmlFor="notities" className="sm:col-span-2">
            <Textarea
              id="notities"
              name="notities"
              defaultValue={waarden.notities}
              rows={2}
            />
          </Veld>
        </CardContent>
      </Card>

      {staat.fout ? <Melding toon="fout">{staat.fout}</Melding> : null}

      <div className="flex gap-2">
        <Button type="submit" disabled={bezig}>
          {bezig ? "Bezig…" : "Opslaan"}
        </Button>
        <Button type="button" variant="outline" asChild>
          <Link href={waarden.id ? `/uitgaven/${waarden.id}` : "/uitgaven"}>
            Annuleren
          </Link>
        </Button>
      </div>
    </form>
  );
}
