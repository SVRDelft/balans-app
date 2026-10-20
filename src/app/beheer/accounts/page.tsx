import type { Metadata } from "next";

import { Paginakop } from "@/components/paginakop";
import { BevestigKnop } from "@/components/bevestigknop";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Melding } from "@/components/ui/melding";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { vereisBestuur } from "@/lib/auth/server";
import { db } from "@/lib/db";
import { formatteerTijdstempel } from "@/lib/datum";

import { AccountFormulier } from "./formulier";
import { nieuwWachtwoord, zetActief } from "./acties";

export const metadata: Metadata = { title: "Accounts" };

export default async function AccountsPagina() {
  const sessie = await vereisBestuur();

  const [gebruikers, verenigingen] = await Promise.all([
    db.gebruiker.findMany({
      orderBy: [{ rol: "asc" }, { email: "asc" }],
      include: { relatie: { select: { naam: true } } },
    }),
    // Elke actieve relatie kan een portaalaccount krijgen; wie facturen van de
    // SVR ontvangt, hoort ze te kunnen inzien.
    db.relatie.findMany({
      where: { actief: true },
      orderBy: [{ type: "asc" }, { naam: "asc" }],
      select: { id: true, naam: true, type: true },
    }),
  ]);

  return (
    <>
      <Paginakop
        titel="Accounts"
        beschrijving="Wie mag inloggen, en waarvoor. Niemand kan zichzelf aanmelden."
      />

      <Melding toon="info" className="mb-4">
        Een <strong>bestuursaccount</strong> mag bij de administratie en het
        portaal. Een <strong>verenigingsaccount</strong> ziet alleen het portaal
        en alleen de eigen vereniging. Het wachtwoord wordt één keer getoond bij
        het aanmaken; daarna staat er alleen nog een versleutelde versie in de
        database.
      </Melding>

      <div className="mb-6">
        <AccountFormulier verenigingen={verenigingen} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{gebruikers.length} accounts</CardTitle>
        </CardHeader>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>E-mailadres</TableHead>
              <TableHead>Naam</TableHead>
              <TableHead>Rol</TableHead>
              <TableHead>Laatste inlog</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Acties</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {gebruikers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-muted-foreground">
                  Nog geen accounts.
                </TableCell>
              </TableRow>
            ) : null}
            {gebruikers.map((gebruiker) => (
              <TableRow key={gebruiker.id}>
                <TableCell className="font-medium">{gebruiker.email}</TableCell>
                <TableCell>{gebruiker.naam}</TableCell>
                <TableCell>
                  {gebruiker.rol === "BESTUUR"
                    ? "SVR-bestuur"
                    : (gebruiker.relatie?.naam ?? "Vereniging")}
                </TableCell>
                <TableCell className="cijfers whitespace-nowrap text-muted-foreground">
                  {gebruiker.laatsteInlog
                    ? formatteerTijdstempel(gebruiker.laatsteInlog)
                    : "nog nooit"}
                </TableCell>
                <TableCell>
                  {gebruiker.actief ? (
                    gebruiker.moetWijzigen ? (
                      <Badge variant="waarschuwing">Wachtwoord nog niet gewijzigd</Badge>
                    ) : (
                      <Badge variant="goed">Actief</Badge>
                    )
                  ) : (
                    <Badge variant="waarschuwing">Uitgezet</Badge>
                  )}
                </TableCell>
                <TableCell>
                  <div className="flex flex-wrap justify-end gap-2">
                    <BevestigKnop
                      actie={nieuwWachtwoord}
                      velden={{ id: gebruiker.id }}
                      vraag={`Een nieuw wachtwoord uitgeven voor ${gebruiker.email}? Het oude werkt daarna niet meer.`}
                      size="sm"
                      variant="outline"
                    >
                      Nieuw wachtwoord
                    </BevestigKnop>
                    {gebruiker.id === sessie.gebruikerId ? null : (
                      <BevestigKnop
                        actie={zetActief}
                        velden={{ id: gebruiker.id, actief: gebruiker.actief ? "nee" : "ja" }}
                        vraag={
                          gebruiker.actief
                            ? `${gebruiker.email} uitzetten? Dit account kan daarna niet meer inloggen.`
                            : `${gebruiker.email} weer aanzetten?`
                        }
                        size="sm"
                        variant="ghost"
                      >
                        {gebruiker.actief ? "Uitzetten" : "Aanzetten"}
                      </BevestigKnop>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </>
  );
}
