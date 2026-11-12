"use client";

import { useActionState, useState } from "react";
import { Calculator } from "lucide-react";

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
import { formatteerEuro, parseerBedragNaarCenten } from "@/lib/geld";
import { berekenOmslag, type OmslagBlokkade } from "@/lib/finance/omslag";
import { cn } from "@/lib/utils";
import type { ActieStaat } from "@/lib/acties";

import { berekenOmslagActie } from "../acties";

export function OmslagPaneel({
  evenementId,
  isNaheffing,
  totaalKostenCenten,
  aantalAangemeld,
  aantalBevestigd,
  blokkades,
}: {
  evenementId: string;
  isNaheffing: boolean;
  totaalKostenCenten: number;
  aantalAangemeld: number;
  aantalBevestigd: number;
  blokkades: OmslagBlokkade[];
}) {
  const [staat, actie, bezig] = useActionState<ActieStaat, FormData>(
    berekenOmslagActie,
    {},
  );
  const [prijsInvoer, setPrijsInvoer] = useState("");
  const [leveranciersOk, setLeveranciersOk] = useState(false);
  const [deelnemersOk, setDeelnemersOk] = useState(false);

  const kanRekenen = aantalBevestigd > 0 && totaalKostenCenten > 0;

  const berekening = kanRekenen
    ? berekenOmslag({
        totaalKostenCenten,
        aantalAangemeld,
        aantalBevestigd,
        ...(parseerBedragNaarCenten(prijsInvoer) !== null
          ? { prijsPerPersoonCenten: parseerBedragNaarCenten(prijsInvoer)! }
          : {}),
      })
    : null;

  const ingevoerdePrijs = parseerBedragNaarCenten(prijsInvoer);
  const prijsTeLaag =
    berekening !== null &&
    ingevoerdePrijs !== null &&
    ingevoerdePrijs < berekening.kostprijsPerPersoonCenten;

  const geblokkeerd = blokkades.length > 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          {isNaheffing ? "Naheffing berekenen" : "Omslag berekenen"}
        </CardTitle>
        <CardDescription>
          {isNaheffing
            ? "De naheffing gaat over dezelfde deelnemers als de eerste omslag."
            : "Er wordt altijd gedeeld door het aantal bevestigd betalende personen."}
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-5">
        {geblokkeerd ? (
          <Melding toon="fout" titel="Rekenen kan nog niet">
            <ul className="mt-1 list-disc space-y-1 pl-5">
              {blokkades.map((blokkade) => (
                <li key={blokkade.code}>
                  {blokkade.melding}
                  {blokkade.details && blokkade.details.length > 0 ? (
                    <ul className="mt-0.5 list-[circle] pl-5 text-xs text-muted-foreground">
                      {blokkade.details.map((detail, index) => (
                        <li key={index}>{detail}</li>
                      ))}
                    </ul>
                  ) : null}
                </li>
              ))}
            </ul>
          </Melding>
        ) : null}

        {berekening ? (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left">
                    <th className="pb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                      Verdeling over
                    </th>
                    <th className="pb-2 text-right text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                      Personen
                    </th>
                    <th className="pb-2 text-right text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                      Per persoon
                    </th>
                    <th className="pb-2 text-right text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                      Brengt op
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-border">
                    <td className="py-2">Aangemelde personen</td>
                    <td className="cijfers py-2 text-right">
                      {berekening.aantalAangemeld}
                    </td>
                    <td className="cijfers py-2 text-right">
                      {formatteerEuro(berekening.prijsBijAangemeldCenten)}
                    </td>
                    <td className="cijfers py-2 text-right">
                      {formatteerEuro(berekening.opbrengstBijAangemeldCenten)}
                    </td>
                  </tr>
                  <tr className="border-b border-border bg-success/5">
                    <td className="py-2 font-medium">
                      Bevestigd betalende personen
                      <span className="block text-xs text-muted-foreground">
                        dit is wat de app gebruikt
                      </span>
                    </td>
                    <td className="cijfers py-2 text-right font-medium">
                      {berekening.aantalBevestigd}
                    </td>
                    <td className="cijfers py-2 text-right font-medium">
                      {formatteerEuro(berekening.prijsPerPersoonCenten)}
                    </td>
                    <td className="cijfers py-2 text-right font-medium">
                      {formatteerEuro(berekening.totaalGefactureerdCenten)}
                    </td>
                  </tr>
                  <tr>
                    <td className="py-2 text-muted-foreground">
                      Totale kosten om te verdelen
                    </td>
                    <td />
                    <td />
                    <td className="cijfers py-2 text-right">
                      {formatteerEuro(berekening.totaalKostenCenten)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {berekening.tekortBijAangemeldCenten > 0 ? (
              <Melding toon="waarschuwing" titel="Wat de verkeerde keuze zou kosten">
                <p>
                  Er zijn {berekening.verschilAantal} personen wel aangemeld maar
                  niet bevestigd betalend. Zou je door{" "}
                  {berekening.aantalAangemeld} delen, dan kwam er{" "}
                  <strong>
                    {formatteerEuro(berekening.tekortBijAangemeldCenten)}
                  </strong>{" "}
                  te weinig binnen. Dat verlies komt dan voor rekening van de SVR.
                </p>
              </Melding>
            ) : null}

            <div className="grid gap-4 sm:grid-cols-2">
              <Veld
                label="Prijs per persoon"
                htmlFor="prijsPerPersoon"
                toelichting={`Leeg laten voor de kostprijs van ${formatteerEuro(berekening.kostprijsPerPersoonCenten)}. Een hogere prijs mag, een lagere niet.`}
              >
                <Input
                  id="prijsPerPersoon"
                  name="prijsPerPersoon"
                  form="omslagformulier"
                  value={prijsInvoer}
                  onChange={(gebeurtenis) =>
                    setPrijsInvoer(gebeurtenis.target.value)
                  }
                  inputMode="decimal"
                  placeholder={String(
                    (berekening.kostprijsPerPersoonCenten / 100)
                      .toFixed(2)
                      .replace(".", ","),
                  )}
                  className={cn("cijfers", prijsTeLaag && "border-destructive")}
                />
              </Veld>

              <div className="rounded-lg border border-border p-3 text-sm">
                <p className="text-xs font-medium text-muted-foreground">
                  Dekkingsverschil
                </p>
                <p
                  className={cn(
                    "cijfers mt-0.5 text-lg font-semibold",
                    berekening.dekkingsverschilCenten < 0
                      ? "text-destructive"
                      : berekening.dekkingsverschilCenten >
                          berekening.afrondingsruimteCenten
                        ? "text-warning-foreground"
                        : "text-success",
                  )}
                >
                  {formatteerEuro(berekening.dekkingsverschilCenten)}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {berekening.dekkingsverschilCenten === 0
                    ? "Precies kostendekkend."
                    : berekening.dekkingsverschilCenten <=
                        berekening.afrondingsruimteCenten
                      ? "Alleen afronding op hele centen."
                      : "Bewuste opslag boven de kostprijs."}
                </p>
              </div>
            </div>

            {prijsTeLaag ? (
              <Melding toon="fout">
                Deze prijs ligt onder de kostprijs van{" "}
                {formatteerEuro(berekening.kostprijsPerPersoonCenten)}. Daarmee
                staat het verlies bij voorbaat vast.
              </Melding>
            ) : null}
          </>
        ) : null}

        <form id="omslagformulier" action={actie} className="space-y-4">
          <input type="hidden" name="evenementId" value={evenementId} />

          <fieldset className="space-y-2 rounded-lg border border-border p-3">
            <legend className="px-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              Controleer voordat je rekent
            </legend>

            <label className="flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                name="bevestigLeveranciers"
                checked={leveranciersOk}
                onChange={(gebeurtenis) =>
                  setLeveranciersOk(gebeurtenis.target.checked)
                }
                className="mt-0.5 size-4 rounded border-input"
              />
              <span>
                Alle leveranciersfacturen zijn binnen
                <span className="block text-xs text-muted-foreground">
                  Denk aan de eindafrekening van de locatie en de open bar; die
                  komt vaak weken later.
                </span>
              </span>
            </label>

            <label className="flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                name="bevestigDeelnemers"
                checked={deelnemersOk}
                onChange={(gebeurtenis) =>
                  setDeelnemersOk(gebeurtenis.target.checked)
                }
                className="mt-0.5 size-4 rounded border-input"
              />
              <span>
                De deelnemerslijst is definitief
                <span className="block text-xs text-muted-foreground">
                  Iedereen die betaalt staat als bevestigd betalend aangevinkt.
                </span>
              </span>
            </label>
          </fieldset>

          {staat.fout ? <Melding toon="fout">{staat.fout}</Melding> : null}
          {staat.melding ? (
            <Melding toon="goed" titel="Omslag berekend">
              {staat.melding}
            </Melding>
          ) : null}

          <Button
            type="submit"
            disabled={
              bezig ||
              geblokkeerd ||
              prijsTeLaag ||
              !leveranciersOk ||
              !deelnemersOk ||
              !kanRekenen
            }
          >
            <Calculator />
            {bezig
              ? "Bezig…"
              : isNaheffing
                ? "Naheffing berekenen en facturen maken"
                : "Omslag berekenen en facturen maken"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
