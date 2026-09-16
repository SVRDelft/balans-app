"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { Check } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input, Select, Textarea, Veld } from "@/components/ui/input";
import { Melding } from "@/components/ui/melding";
import type { ActieStaat } from "@/lib/acties";
import { formatteerEuro } from "@/lib/geld";

import { verwerkBankmutatie } from "../acties";

export interface MutatieFormulierProps {
  id: string;
  bedragCenten: number;
  omschrijving: string;
  tegenpartij: string;
  voorstel?: { waarde: string; reden: string };
  opties: { waarde: string; label: string }[];
  posten: { id: string; code: string; naam: string }[];
}

export function MutatieFormulier({
  id,
  bedragCenten,
  omschrijving,
  tegenpartij,
  voorstel,
  opties,
  posten,
}: MutatieFormulierProps) {
  const [staat, actie, bezig] = useActionState<ActieStaat, FormData>(
    verwerkBankmutatie,
    {},
  );
  const [doel, setDoel] = useState(
    voorstel && opties.some((optie) => optie.waarde === voorstel.waarde)
      ? voorstel.waarde
      : "",
  );
  const prefix = `bankmutatie-${id}`;
  const nieuweUitgave = doel === "nieuw" && bedragCenten < 0;

  return (
    <form action={actie} className="space-y-3" aria-busy={bezig}>
      <input type="hidden" name="mutatieId" value={id} />
      <fieldset disabled={bezig} className="min-w-0 space-y-3">
        <Veld
          label="Koppeling"
          htmlFor={`${prefix}-doel`}
          verplicht
          fout={staat.veldfouten?.doel}
        >
          <Select
            id={`${prefix}-doel`}
            name="doel"
            value={doel}
            onChange={(event) => setDoel(event.target.value)}
            required
          >
            <option value="">Kies een koppeling</option>
            {opties.map((optie) => (
              <option key={optie.waarde} value={optie.waarde}>
                {optie.label}
              </option>
            ))}
            {bedragCenten < 0 ? (
              <option value="nieuw">Nieuwe uitgave aanmaken</option>
            ) : null}
            <option value="negeren">Niet verwerken in de administratie</option>
          </Select>
        </Veld>

        {voorstel && doel === voorstel.waarde ? (
          <p className="text-sm text-muted-foreground">
            Voorstel: {voorstel.reden}
          </p>
        ) : null}

        {bedragCenten > 0 && doel === "" ? (
          <p className="text-sm text-muted-foreground">
            Staat de bijbehorende factuur er nog niet tussen?{" "}
            <Link
              href="/facturen/nieuw"
              className="font-medium text-primary underline underline-offset-2"
            >
              Maak eerst een factuur aan
            </Link>{" "}
            en markeer die als verstuurd. Daarna kun je deze ontvangst koppelen.
          </p>
        ) : null}

        {nieuweUitgave ? (
          <div className="space-y-3 rounded-lg border border-border bg-muted/40 p-3">
            <p className="text-sm">
              Je maakt een betaalde uitgave van{" "}
              <strong>{formatteerEuro(Math.abs(bedragCenten))}</strong> aan. De
              datum wordt overgenomen van deze bankmutatie.
            </p>
            <Veld
              label="Begrotingspost"
              htmlFor={`${prefix}-begrotingspostId`}
              verplicht
              fout={staat.veldfouten?.begrotingspostId}
            >
              <Select
                id={`${prefix}-begrotingspostId`}
                name="begrotingspostId"
                defaultValue=""
                required
              >
                <option value="">Kies een uitgavenpost</option>
                {posten.map((post) => (
                  <option key={post.id} value={post.id}>
                    {post.code} - {post.naam}
                  </option>
                ))}
              </Select>
            </Veld>
            {posten.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Voeg eerst een uitgavenpost toe aan de{" "}
                <Link
                  href="/begroting/nieuw"
                  className="font-medium text-primary underline underline-offset-2"
                >
                  begroting
                </Link>
                .
              </p>
            ) : null}
            <Veld
              label="Leverancier"
              htmlFor={`${prefix}-leverancierNaam`}
              verplicht
              fout={staat.veldfouten?.leverancierNaam}
            >
              <Input
                id={`${prefix}-leverancierNaam`}
                name="leverancierNaam"
                defaultValue={tegenpartij}
                required
              />
            </Veld>
            <Veld
              label="Omschrijving"
              htmlFor={`${prefix}-omschrijving`}
              verplicht
              fout={staat.veldfouten?.omschrijving}
            >
              <Textarea
                id={`${prefix}-omschrijving`}
                name="omschrijving"
                defaultValue={omschrijving}
                rows={2}
                required
              />
            </Veld>
          </div>
        ) : null}

        {doel === "negeren" ? (
          <Veld
            label="Reden om niet te verwerken"
            htmlFor={`${prefix}-notitie`}
            verplicht
            fout={staat.veldfouten?.notitie}
            toelichting="Hiermee verandert er niets aan je facturen, uitgaven of administratieve banksaldo. Leg vast waarom deze mutatie niet verwerkt hoeft te worden."
          >
            <Textarea
              id={`${prefix}-notitie`}
              name="notitie"
              rows={2}
              required
            />
          </Veld>
        ) : null}

        {staat.fout ? <Melding toon="fout">{staat.fout}</Melding> : null}
        {staat.melding ? (
          <div role="status">
            <Melding toon="goed">{staat.melding}</Melding>
          </div>
        ) : null}

        <Button
          type="submit"
          disabled={bezig || !doel || (nieuweUitgave && posten.length === 0)}
        >
          <Check aria-hidden />
          {bezig ? "Bezig…" : "Koppeling bevestigen"}
        </Button>
      </fieldset>
    </form>
  );
}
