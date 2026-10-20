"use client";

import { useActionState } from "react";
import { Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { CardContent } from "@/components/ui/card";
import { Input, Select } from "@/components/ui/input";
import { Melding } from "@/components/ui/melding";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { ActieStaat } from "@/lib/acties";

import {
  verwijderDeelnemer,
  voegDeelnemerToe,
  wijzigDeelnemer,
} from "../acties";

export interface DeelnemerRij {
  id: string;
  naam: string;
  aantalPersonen: number;
  aangemeld: boolean;
  bevestigdBetalend: boolean;
  inOmslag: boolean;
}

export function Deelnemerspaneel({
  evenementId,
  deelnemers,
  relaties,
  bewerkbaar,
}: {
  evenementId: string;
  deelnemers: DeelnemerRij[];
  relaties: { id: string; naam: string }[];
  bewerkbaar: boolean;
}) {
  const aangemeld = deelnemers.reduce(
    (som, deelnemer) => (deelnemer.aangemeld ? som + deelnemer.aantalPersonen : som),
    0,
  );
  const bevestigd = deelnemers.reduce(
    (som, deelnemer) =>
      deelnemer.bevestigdBetalend ? som + deelnemer.aantalPersonen : som,
    0,
  );

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Deelnemer</TableHead>
            <TableHead className="text-right">Personen</TableHead>
            <TableHead className="text-center">Aangemeld</TableHead>
            <TableHead className="text-center">Bevestigd betalend</TableHead>
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          {deelnemers.length === 0 ? (
            <TableRow>
              <TableCell colSpan={5} className="text-muted-foreground">
                Nog geen deelnemers.
              </TableCell>
            </TableRow>
          ) : null}

          {deelnemers.map((deelnemer) => (
            <TableRow key={deelnemer.id}>
              <TableCell className="font-medium">{deelnemer.naam}</TableCell>
              <TableCell className="text-right">
                {bewerkbaar && !deelnemer.inOmslag ? (
                  <AantalFormulier
                    id={deelnemer.id}
                    waarde={deelnemer.aantalPersonen}
                  />
                ) : (
                  <span className="cijfers">{deelnemer.aantalPersonen}</span>
                )}
              </TableCell>
              <TableCell className="text-center">
                <VinkjeFormulier
                  id={deelnemer.id}
                  veld="aangemeld"
                  aan={deelnemer.aangemeld}
                  uitgeschakeld={!bewerkbaar}
                />
              </TableCell>
              <TableCell className="text-center">
                <VinkjeFormulier
                  id={deelnemer.id}
                  veld="bevestigdBetalend"
                  aan={deelnemer.bevestigdBetalend}
                  uitgeschakeld={!bewerkbaar || deelnemer.inOmslag}
                />
              </TableCell>
              <TableCell className="text-right">
                {bewerkbaar && !deelnemer.inOmslag ? (
                  <VerwijderDeelnemerFormulier
                    id={deelnemer.id}
                    naam={deelnemer.naam}
                  />
                ) : null}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
        <TableFooter>
          <TableRow>
            <TableCell>Totaal personen</TableCell>
            <TableCell />
            <TableCell className="cijfers text-center">{aangemeld}</TableCell>
            <TableCell className="cijfers text-center font-semibold">
              {bevestigd}
            </TableCell>
            <TableCell />
          </TableRow>
        </TableFooter>
      </Table>

      {bewerkbaar ? (
        <CardContent className="border-t border-border pt-4">
          <NieuweDeelnemerFormulier
            evenementId={evenementId}
            relaties={relaties}
          />
        </CardContent>
      ) : null}
    </>
  );
}

function NieuweDeelnemerFormulier({
  evenementId,
  relaties,
}: {
  evenementId: string;
  relaties: { id: string; naam: string }[];
}) {
  const [staat, actie, bezig] = useActionState<ActieStaat, FormData>(
    voegDeelnemerToe,
    {},
  );

  return (
    <form action={actie} className="space-y-3">
      <input type="hidden" name="evenementId" value={evenementId} />

      <div className="grid gap-3 sm:grid-cols-12">
        <label className="sm:col-span-4">
          <span className="text-xs font-medium text-muted-foreground">
            Bestaande relatie
          </span>
          <Select name="relatieId" defaultValue="">
            <option value="">Losse naam gebruiken…</option>
            {relaties.map((relatie) => (
              <option key={relatie.id} value={relatie.id}>
                {relatie.naam}
              </option>
            ))}
          </Select>
        </label>

        <label className="sm:col-span-4">
          <span className="text-xs font-medium text-muted-foreground">
            Of losse naam
          </span>
          <Input name="naam" placeholder="Naam van de deelnemer" />
        </label>

        <label className="sm:col-span-2">
          <span className="text-xs font-medium text-muted-foreground">
            Personen
          </span>
          <Input
            name="aantalPersonen"
            defaultValue="1"
            inputMode="numeric"
            className="cijfers text-right"
          />
        </label>

        <div className="flex items-end sm:col-span-2">
          <Button type="submit" variant="outline" disabled={bezig} className="w-full">
            <Plus />
            {bezig ? "Bezig…" : "Toevoegen"}
          </Button>
        </div>
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          name="bevestigdBetalend"
          className="size-4 rounded border-input"
        />
        Meteen als bevestigd betalend markeren
      </label>

      {staat.fout ? <Melding toon="fout">{staat.fout}</Melding> : null}
    </form>
  );
}

function VinkjeFormulier({
  id,
  veld,
  aan,
  uitgeschakeld,
}: {
  id: string;
  veld: "aangemeld" | "bevestigdBetalend";
  aan: boolean;
  uitgeschakeld: boolean;
}) {
  const [, actie, bezig] = useActionState<ActieStaat, FormData>(
    wijzigDeelnemer,
    {},
  );

  return (
    <form action={actie} className="inline">
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="veld" value={veld} />
      <button
        type="submit"
        disabled={uitgeschakeld || bezig}
        aria-pressed={aan}
        aria-label={veld === "aangemeld" ? "Aangemeld" : "Bevestigd betalend"}
        className={`size-5 rounded border transition-colors ${
          aan
            ? "border-primary bg-primary text-primary-foreground"
            : "border-input bg-card"
        } ${uitgeschakeld ? "cursor-not-allowed opacity-50" : "cursor-pointer"}`}
      >
        {aan ? "✓" : ""}
      </button>
    </form>
  );
}

function AantalFormulier({ id, waarde }: { id: string; waarde: number }) {
  const [, actie] = useActionState<ActieStaat, FormData>(wijzigDeelnemer, {});

  return (
    <form action={actie} className="inline-flex items-center gap-1">
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="veld" value="aantalPersonen" />
      <Input
        name="waarde"
        defaultValue={String(waarde)}
        inputMode="numeric"
        className="cijfers h-8 w-16 text-right"
        onBlur={(gebeurtenis) => {
          if (gebeurtenis.target.value !== String(waarde)) {
            gebeurtenis.target.form?.requestSubmit();
          }
        }}
      />
    </form>
  );
}

function VerwijderDeelnemerFormulier({
  id,
  naam,
}: {
  id: string;
  naam: string;
}) {
  const [, actie, bezig] = useActionState<ActieStaat, FormData>(
    verwijderDeelnemer,
    {},
  );

  return (
    <form
      action={actie}
      onSubmit={(gebeurtenis) => {
        if (!window.confirm(`${naam} verwijderen als deelnemer?`)) {
          gebeurtenis.preventDefault();
        }
      }}
    >
      <input type="hidden" name="id" value={id} />
      <Button type="submit" variant="ghost" size="sm" disabled={bezig}>
        <Trash2 />
      </Button>
    </form>
  );
}
