import type { Metadata } from "next";
import Link from "next/link";

import { Paginakop } from "@/components/paginakop";
import { BevestigKnop } from "@/components/bevestigknop";
import { Button } from "@/components/ui/button";
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
import { datumNaarInvoer, formatteerDatum, vandaag } from "@/lib/datum";
import { gastheerVan, haalMededelingen, haalVergaderingen } from "@/lib/portaal/gegevens";
import { TOEGESTAAN } from "@/lib/portaal/opslag";

import {
  MededelingFormulier,
  UploadFormulier,
  VergaderingFormulier,
} from "./formulieren";
import {
  verwijderMededeling,
  verwijderPortaalbestand,
  verwijderVergadering,
} from "./acties";

export const metadata: Metadata = { title: "Portaal beheren" };

export default async function PortaalBeheerPagina() {
  await vereisBestuur();

  const [mededelingen, vergaderingen, documenten, verenigingen] = await Promise.all([
    haalMededelingen(50),
    haalVergaderingen(),
    db.portaalbestand.findMany({
      where: { vergaderingId: null },
      orderBy: { geuploadOp: "desc" },
    }),
    db.relatie.findMany({
      where: { type: "studievereniging", actief: true },
      orderBy: { naam: "asc" },
      select: { id: true, naam: true },
    }),
  ]);

  const keuzelijst = [...vergaderingen.komend, ...vergaderingen.geweest].map(
    (vergadering) => ({
      id: vergadering.id,
      label: `${vergadering.reeks} · ${formatteerDatum(vergadering.datum)} · ${gastheerVan(vergadering)}`,
    }),
  );

  return (
    <>
      <Paginakop
        titel="Portaal beheren"
        beschrijving="Wat de aangesloten verenigingen te zien krijgen."
        acties={
          <Button variant="outline" asChild>
            <Link href="/portaal">Bekijk het portaal</Link>
          </Button>
        }
      />

      <Melding toon="info" className="mb-6">
        Alles op deze pagina is zichtbaar voor <strong>alle</strong> aangesloten
        verenigingen die een account hebben. Zet er dus niets in dat maar voor
        één vereniging bedoeld is.
      </Melding>

      <div className="mb-6 grid gap-6 lg:grid-cols-2">
        <MededelingFormulier />
        <VergaderingFormulier
          verenigingen={verenigingen}
          vandaag={datumNaarInvoer(vandaag())}
        />
      </div>

      <div className="mb-8">
        <UploadFormulier vergaderingen={keuzelijst} toegestaan={TOEGESTAAN} />
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Mededelingen ({mededelingen.length})</CardTitle>
        </CardHeader>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Titel</TableHead>
              <TableHead>Geplaatst</TableHead>
              <TableHead className="text-right">Actie</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {mededelingen.length === 0 ? (
              <TableRow>
                <TableCell colSpan={3} className="text-muted-foreground">
                  Nog geen mededelingen.
                </TableCell>
              </TableRow>
            ) : null}
            {mededelingen.map((mededeling) => (
              <TableRow key={mededeling.id}>
                <TableCell>
                  <p className="font-medium">{mededeling.titel}</p>
                  <p className="max-w-xl truncate text-xs text-muted-foreground">
                    {mededeling.tekst}
                  </p>
                </TableCell>
                <TableCell className="cijfers whitespace-nowrap text-muted-foreground">
                  {formatteerDatum(mededeling.geplaatstOp)} · {mededeling.geplaatstDoor}
                </TableCell>
                <TableCell className="text-right">
                  <BevestigKnop
                    actie={verwijderMededeling}
                    velden={{ id: mededeling.id }}
                    vraag={`"${mededeling.titel}" verwijderen?`}
                    size="sm"
                    variant="ghost"
                  >
                    Verwijderen
                  </BevestigKnop>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Vergaderingen ({vergaderingen.alle.length})</CardTitle>
        </CardHeader>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Overleg</TableHead>
              <TableHead>Wanneer</TableHead>
              <TableHead>Bij</TableHead>
              <TableHead>Stukken</TableHead>
              <TableHead className="text-right">Actie</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {[...vergaderingen.komend, ...vergaderingen.geweest].map((vergadering) => (
              <TableRow key={vergadering.id}>
                <TableCell className="font-medium">{vergadering.reeks}</TableCell>
                <TableCell className="cijfers whitespace-nowrap">
                  {formatteerDatum(vergadering.datum)} · {vergadering.tijd}
                </TableCell>
                <TableCell>{gastheerVan(vergadering)}</TableCell>
                <TableCell>
                  {vergadering.bestanden.length === 0 ? (
                    <span className="text-muted-foreground">—</span>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {vergadering.bestanden.map((bestand) => (
                        <span key={bestand.id} className="flex items-center gap-1 text-xs">
                          <a className="text-primary underline" href={`/api/portaal/bestand/${bestand.id}`}>
                            {bestand.titel}
                          </a>
                          <BevestigKnop
                            actie={verwijderPortaalbestand}
                            velden={{ id: bestand.id }}
                            vraag={`"${bestand.titel}" verwijderen? Het bestand gaat ook van de server af.`}
                            size="sm"
                            variant="ghost"
                          >
                            ×
                          </BevestigKnop>
                        </span>
                      ))}
                    </div>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  <BevestigKnop
                    actie={verwijderVergadering}
                    velden={{ id: vergadering.id }}
                    vraag={`Deze vergadering verwijderen? De agenda en notulen gaan mee.`}
                    size="sm"
                    variant="ghost"
                  >
                    Verwijderen
                  </BevestigKnop>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Losse documenten ({documenten.length})</CardTitle>
        </CardHeader>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Titel</TableHead>
              <TableHead>Bestand</TableHead>
              <TableHead>Geüpload</TableHead>
              <TableHead className="text-right">Actie</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {documenten.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-muted-foreground">
                  Nog geen losse documenten.
                </TableCell>
              </TableRow>
            ) : null}
            {documenten.map((bestand) => (
              <TableRow key={bestand.id}>
                <TableCell>
                  <a className="font-medium text-primary underline" href={`/api/portaal/bestand/${bestand.id}`}>
                    {bestand.titel}
                  </a>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {bestand.bestandsnaam} · {Math.max(1, Math.round(bestand.grootte / 1024))} kB
                </TableCell>
                <TableCell className="cijfers whitespace-nowrap text-muted-foreground">
                  {formatteerDatum(bestand.geuploadOp)} · {bestand.geuploadDoor}
                </TableCell>
                <TableCell className="text-right">
                  <BevestigKnop
                    actie={verwijderPortaalbestand}
                    velden={{ id: bestand.id }}
                    vraag={`"${bestand.titel}" verwijderen? Het bestand gaat ook van de server af.`}
                    size="sm"
                    variant="ghost"
                  >
                    Verwijderen
                  </BevestigKnop>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </>
  );
}
