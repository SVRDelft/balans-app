import type { Metadata } from "next";
import Link from "next/link";
import { Upload } from "lucide-react";
import { Button } from "@/components/ui/button";

import { BevestigKnop } from "@/components/bevestigknop";
import { Kerngetal, Paginakop } from "@/components/paginakop";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Melding } from "@/components/ui/melding";
import {
  Bedrag,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { vereisBoekjaarContext } from "@/lib/boekjaar";
import { db } from "@/lib/db";
import { datumNaarInvoer, formatteerDatum, vandaag } from "@/lib/datum";
import { formatteerEuro } from "@/lib/geld";
import { haalBoekjaarCijfers } from "@/lib/rapportage";

import { verwijderBanksaldo } from "./acties";
import { BanksaldoFormulier } from "./formulier";

export const metadata: Metadata = { title: "Banksaldo" };

export default async function BankPagina() {
  const { boekjaar, schrijfbaar } = await vereisBoekjaarContext();

  const [saldi, cijfers] = await Promise.all([
    db.banksaldo.findMany({
      where: { boekjaarId: boekjaar.id },
      orderBy: [{ datum: "desc" }, { ingevoerdOp: "desc" }],
    }),
    haalBoekjaarCijfers(boekjaar.id),
  ]);

  const verschil = cijfers.balans.bankverschilCenten;

  return (
    <>
      <Paginakop
        titel="Banksaldo"
        beschrijving="Importeer je bankafschrift of voer het saldo in. Controleer daarna het verschil met de administratie."
        acties={<Button asChild><Link href="/bank/importeren"><Upload />Bankafschrift importeren</Link></Button>}
      />

      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        <Kerngetal
          label="Laatst ingevoerd saldo"
          waarde={
            cijfers.laatsteBanksaldo
              ? formatteerEuro(cijfers.laatsteBanksaldo.saldoCenten)
              : "—"
          }
          toelichting={
            cijfers.laatsteBanksaldo
              ? `Per ${formatteerDatum(cijfers.laatsteBanksaldo.datum)}`
              : "Nog niets ingevoerd"
          }
        />
        <Kerngetal
          label="Saldo volgens de administratie"
          waarde={formatteerEuro(cijfers.balans.administratiefBanksaldoCenten)}
          toelichting="Beginsaldo plus ontvangsten min betaalde uitgaven"
        />
        <Kerngetal
          label="Verschil"
          waarde={verschil === null ? "—" : formatteerEuro(verschil)}
          toon={verschil === null ? "neutraal" : verschil === 0 ? "goed" : "fout"}
          toelichting="Hoort nul te zijn"
        />
      </div>

      {verschil !== null && verschil !== 0 ? (
        <Melding
          toon="waarschuwing"
          className="mb-6"
          titel="Het saldo klopt niet met de administratie"
        >
          <p>
            Er staat {formatteerEuro(Math.abs(verschil))}{" "}
            {verschil > 0 ? "méér" : "minder"} op de bank dan uit de
            administratie volgt. Meestal betekent dat: een ontvangen betaling is
            nog niet geregistreerd, een uitgave is nog niet ingevoerd of nog niet
            als betaald afgevinkt, of het beginsaldo van het boekjaar klopt niet.
          </p>
        </Melding>
      ) : null}

      {schrijfbaar ? (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Nieuw saldo vastleggen</CardTitle>
            <CardDescription>
              Leg het saldo regelmatig vast, bijvoorbeeld aan het einde van elke
              maand. Elke invoer blijft bewaard.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <BanksaldoFormulier vandaag={datumNaarInvoer(vandaag())} />
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Vastgelegde saldi</CardTitle>
        </CardHeader>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Datum</TableHead>
              <TableHead>Notitie</TableHead>
              <TableHead>Ingevoerd door</TableHead>
              <TableHead className="text-right">Saldo</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {saldi.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-muted-foreground">
                  Nog geen saldi vastgelegd.
                </TableCell>
              </TableRow>
            ) : null}
            {saldi.map((saldo) => (
              <TableRow key={saldo.id}>
                <TableCell className="cijfers whitespace-nowrap">
                  {formatteerDatum(saldo.datum)}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {saldo.notitie ?? "—"}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {saldo.ingevoerdDoor ?? "—"}
                </TableCell>
                <TableCell className="text-right">
                  <Bedrag centen={saldo.saldoCenten} />
                </TableCell>
                <TableCell className="text-right">
                  {schrijfbaar ? (
                    <BevestigKnop
                      actie={verwijderBanksaldo}
                      velden={{ id: saldo.id }}
                      vraag="Dit vastgelegde saldo verwijderen?"
                      variant="ghost"
                      size="sm"
                    >
                      Verwijderen
                    </BevestigKnop>
                  ) : null}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </>
  );
}
