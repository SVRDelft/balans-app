"use client";

import { useActionState, useMemo, useState } from "react";
import { BellRing, Check, Copy, FileArchive } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Melding } from "@/components/ui/melding";
import type { ActieStaat } from "@/lib/acties";

import { legHerinneringenVast } from "./acties";

export interface TeLateFactuur {
  id: string;
  nummer: string;
  relatieId: string;
  relatieNaam: string;
  openstaandCenten: number;
  vervaldatum: string;
  herinneringen: number;
  laatsteHerinneringOp: string | null;
}

const euro = (centen: number) =>
  new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR" }).format(centen / 100);

/** De tekst die je zelf mailt of appt. De app verstuurt niets. */
function herinneringTekst(
  relatieNaam: string,
  facturen: TeLateFactuur[],
  { iban, organisatie }: { iban: string; organisatie: string },
) {
  const totaal = facturen.reduce((som, factuur) => som + factuur.openstaandCenten, 0);
  const regels = facturen.map(
    (factuur) => `- ${factuur.nummer}: ${euro(factuur.openstaandCenten)}, vervaldatum ${factuur.vervaldatum}`,
  );
  return [
    `Beste penningmeester van ${relatieNaam},`,
    "",
    facturen.length === 1
      ? "Volgens onze administratie staat deze factuur van de SVR nog open:"
      : "Volgens onze administratie staan deze facturen van de SVR nog open:",
    ...regels,
    "",
    `Totaal: ${euro(totaal)}. Wil je dit overmaken naar ${iban || "[IBAN]"} t.n.v. ${organisatie}, onder vermelding van het factuurnummer? Heb je al betaald, dan kun je dit bericht negeren.`,
    "",
    "Met vriendelijke groet,",
    `Het bestuur van de ${organisatie}`,
  ].join("\n");
}

export function Herinneringen({
  facturen,
  iban,
  organisatie,
}: {
  facturen: TeLateFactuur[];
  iban: string;
  organisatie: string;
}) {
  const [gekozen, setGekozen] = useState<Set<string>>(() => new Set(facturen.map((f) => f.id)));
  const [toonTeksten, setToonTeksten] = useState(false);
  const [staat, actie, bezig] = useActionState<ActieStaat, FormData>(legHerinneringenVast, {});

  const selectie = facturen.filter((factuur) => gekozen.has(factuur.id));
  const perVereniging = useMemo(() => {
    const groepen = new Map<string, TeLateFactuur[]>();
    for (const factuur of selectie) {
      groepen.set(factuur.relatieId, [...(groepen.get(factuur.relatieId) ?? []), factuur]);
    }
    return [...groepen.values()];
  }, [selectie]);

  const wissel = (id: string) =>
    setGekozen((vorige) => {
      const nieuw = new Set(vorige);
      if (nieuw.has(id)) nieuw.delete(id);
      else nieuw.add(id);
      return nieuw;
    });

  return (
    <Card className="mb-6 niet-afdrukken">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BellRing className="size-5" /> Herinneringen
        </CardTitle>
        <CardDescription>
          {facturen.length} {facturen.length === 1 ? "factuur staat" : "facturen staan"} voorbij de
          vervaldatum. Kies welke je herinnert, download de PDF&apos;s, kopieer per vereniging de
          tekst en leg daarna vast dat je ze hebt gestuurd. De app verstuurt zelf niets.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <ul className="divide-y divide-border rounded-lg border border-border">
          {facturen.map((factuur) => (
            <li key={factuur.id}>
              <label className="flex cursor-pointer flex-wrap items-center gap-x-4 gap-y-1 px-3 py-2 text-sm">
                <input
                  type="checkbox"
                  checked={gekozen.has(factuur.id)}
                  onChange={() => wissel(factuur.id)}
                />
                <span className="cijfers font-medium">{factuur.nummer}</span>
                <span className="min-w-40 flex-1">{factuur.relatieNaam}</span>
                <span className="cijfers">{euro(factuur.openstaandCenten)}</span>
                <span className="cijfers text-muted-foreground">verviel {factuur.vervaldatum}</span>
                <span className="text-xs text-muted-foreground">
                  {factuur.herinneringen > 0
                    ? `${factuur.herinneringen}× herinnerd${factuur.laatsteHerinneringOp ? `, ${factuur.laatsteHerinneringOp}` : ""}`
                    : "nog niet herinnerd"}
                </span>
              </label>
            </li>
          ))}
        </ul>

        <div className="flex flex-wrap items-center gap-2">
          <form method="post" action="/api/facturen/bundel">
            {selectie.map((factuur) => (
              <input key={factuur.id} type="hidden" name="id" value={factuur.id} />
            ))}
            <Button type="submit" variant="outline" size="sm" disabled={selectie.length === 0}>
              <FileArchive />
              (a) PDF&apos;s downloaden ({selectie.length})
            </Button>
          </form>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={selectie.length === 0}
            onClick={() => setToonTeksten((v) => !v)}
          >
            <Copy />
            (b) Herinneringstekst per vereniging
          </Button>
          <form
            action={actie}
            onSubmit={(gebeurtenis) => {
              if (
                !window.confirm(
                  `${selectie.length} ${selectie.length === 1 ? "factuur" : "facturen"} markeren als herinnerd op vandaag?`,
                )
              )
                gebeurtenis.preventDefault();
            }}
          >
            {selectie.map((factuur) => (
              <input key={factuur.id} type="hidden" name="id" value={factuur.id} />
            ))}
            <Button type="submit" size="sm" disabled={bezig || selectie.length === 0}>
              <Check />
              {bezig ? "Bezig…" : "(c) Markeren als herinnerd"}
            </Button>
          </form>
        </div>
        {staat.fout ? <Melding toon="fout">{staat.fout}</Melding> : null}
        {staat.melding ? <Melding toon="goed">{staat.melding}</Melding> : null}

        {toonTeksten ? (
          <div className="space-y-3">
            {perVereniging.map((groep) => (
              <TekstBlok
                key={groep[0].relatieId}
                titel={groep[0].relatieNaam}
                tekst={herinneringTekst(groep[0].relatieNaam, groep, { iban, organisatie })}
              />
            ))}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function TekstBlok({ titel, tekst }: { titel: string; tekst: string }) {
  const [gekopieerd, setGekopieerd] = useState(false);
  return (
    <div className="rounded-lg border border-border bg-muted/40 p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="font-medium">{titel}</p>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(tekst);
              setGekopieerd(true);
            } catch {
              // Geen klembord: selecteer de tekst hieronder.
            }
          }}
        >
          {gekopieerd ? <Check /> : <Copy />}
          {gekopieerd ? "Gekopieerd" : "Kopieer"}
        </Button>
      </div>
      <pre className="whitespace-pre-wrap font-sans text-sm">{tekst}</pre>
    </div>
  );
}
