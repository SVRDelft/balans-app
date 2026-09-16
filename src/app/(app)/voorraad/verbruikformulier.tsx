"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { MinusCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input, Veld } from "@/components/ui/input";
import { Melding } from "@/components/ui/melding";
import { formatteerEuro } from "@/lib/geld";
import type { ActieStaat } from "@/lib/acties";

import { boekVerbruik } from "./acties";

export function VerbruikFormulier({
  id,
  naam,
  eenheid,
  aantal,
  waardePerStukCenten,
  begrotingspost,
}: {
  id: string;
  naam: string;
  eenheid: string;
  aantal: number;
  waardePerStukCenten: number;
  begrotingspost: { code: string; naam: string } | null;
}) {
  const [staat, actie, bezig] = useActionState<ActieStaat, FormData>(
    boekVerbruik,
    {},
  );
  const [invoer, setInvoer] = useState("1");

  const gekozen = Number(invoer);
  const geldig = Number.isInteger(gekozen) && gekozen >= 1 && gekozen <= aantal;
  const waarde = geldig ? gekozen * waardePerStukCenten : 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Verbruik boeken — {naam}</CardTitle>
        <CardDescription>
          Hiermee haal je de waarde uit de voorraad op de balans en boek je hem
          als kosten. Gebruik dit als spullen weggegeven of opgemaakt zijn; voor
          een aankoop hoor je juist het aantal te verhogen.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action={actie} className="space-y-4">
          <input type="hidden" name="id" value={id} />

          <div className="grid gap-4 sm:grid-cols-2">
            <Veld
              label={`Hoeveel ${eenheid} gaan eraf?`}
              htmlFor="verbruikAantal"
              verplicht
              fout={staat.veldfouten?.aantal}
              toelichting={`Er liggen er nu ${aantal}.`}
            >
              <Input
                id="verbruikAantal"
                name="aantal"
                inputMode="numeric"
                value={invoer}
                onChange={(gebeurtenis) => setInvoer(gebeurtenis.target.value)}
                className="cijfers"
                required
              />
            </Veld>

            <Veld
              label="Waarvoor?"
              htmlFor="verbruikReden"
              verplicht
              fout={staat.veldfouten?.reden}
              toelichting="Blijft in het auditlog staan, zodat later te zien is waar ze heen gingen."
            >
              <Input
                id="verbruikReden"
                name="reden"
                maxLength={200}
                placeholder="Bijvoorbeeld: nieuw bestuur"
                required
              />
            </Veld>
          </div>

          <div className="rounded-lg border border-border px-4 py-3 text-sm">
            {geldig ? (
              <>
                <p>
                  <span className="cijfers font-semibold">
                    {formatteerEuro(waarde)}
                  </span>{" "}
                  verdwijnt uit de voorraad op de balans en wordt geboekt als
                  kosten op{" "}
                  {begrotingspost ? (
                    <>
                      <span className="font-mono">{begrotingspost.code}</span> —{" "}
                      {begrotingspost.naam}
                    </>
                  ) : (
                    "de verzamelregel Voorraadmutatie"
                  )}
                  .
                </p>
                <p className="mt-1 text-muted-foreground">
                  Er blijven er dan {aantal - gekozen} over.
                </p>
              </>
            ) : (
              <p className="text-muted-foreground">
                Vul een aantal tussen 1 en {aantal} in.
              </p>
            )}
          </div>

          {waardePerStukCenten === 0 ? (
            <Melding toon="waarschuwing">
              Bij deze spullen staat geen waarde per stuk, dus er verschuift
              € 0,00 en je ziet er niets van terug op de balans of in de
              begroting. Vul eerst de waarde per stuk in bij{" "}
              <Link href={`/voorraad?bewerken=${id}`} className="underline">
                bewerken
              </Link>
              .
            </Melding>
          ) : null}

          {!begrotingspost ? (
            <Melding toon="info">
              Deze spullen hangen nog niet aan een begrotingspost, dus het
              verbruik komt op de verzamelregel te staan in plaats van bij een
              post in de begroting.{" "}
              <Link href={`/voorraad?bewerken=${id}`} className="underline">
                Koppel er een
              </Link>
              .
            </Melding>
          ) : null}

          {staat.fout ? <Melding toon="fout">{staat.fout}</Melding> : null}
          {staat.melding ? (
            <Melding toon="goed">{staat.melding}</Melding>
          ) : null}

          <div className="flex gap-2">
            <Button type="submit" disabled={bezig || !geldig}>
              <MinusCircle />
              {bezig ? "Bezig…" : "Verbruik boeken"}
            </Button>
            <Button type="button" variant="outline" asChild>
              <Link href="/voorraad">Klaar</Link>
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
