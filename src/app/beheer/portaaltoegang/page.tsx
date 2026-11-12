import type { Metadata } from "next";

import { Paginakop } from "@/components/paginakop";
import { BevestigKnop } from "@/components/bevestigknop";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import {
  haalToegangKeuzes,
  koppelOpNaam,
  type ToegangKeuze,
} from "@/lib/auth/portaaltoegang";
import { ordenRelaties } from "@/lib/verenigingen";
import { portaalStand } from "@/lib/portaal/stand";
import { formatteerTijdstempel } from "@/lib/datum";
import { db } from "@/lib/db";

import { verwijderInformant, zetToegangAanUit } from "./acties";
import {
  BeginwachtwoordenKnop,
  InformantToevoegen,
  RelatieKoppeling,
  WachtwoordInstellen,
} from "./formulier";

export const metadata: Metadata = { title: "Portaaltoegang" };

interface Regel extends ToegangKeuze {
  heeftWachtwoord: boolean;
  gewijzigdOp: Date | null;
  laatsteInlog: Date | null;
  actief: boolean;
  relatieId: string | null;
  voorstel: string | undefined;
}

type Relaties = { id: string; naam: string }[];

export default async function PortaaltoegangPagina() {
  await vereisBestuur();

  // Wie nog niet gekoppeld is en een relatie met exact dezelfde naam heeft,
  // wordt nu gekoppeld. Een keuze van het bestuur zelf blijft staan.
  await koppelOpNaam();

  const [keuzes, rijen, relatiesRuw, stand] = await Promise.all([
    haalToegangKeuzes(),
    db.portaaltoegang.findMany(),
    // Alleen verenigingen en overige relaties: een persoon krijgt geen login.
    db.relatie.findMany({
      where: { actief: true, type: { in: ["studievereniging", "overig"] } },
      select: { id: true, naam: true, type: true },
    }),
    portaalStand(),
  ]);
  const relaties = ordenRelaties(relatiesRuw).map((relatie) => ({
    id: relatie.id,
    naam: relatie.toonNaam,
  }));
  const perSleutel = new Map(rijen.map((rij) => [rij.sleutel, rij]));
  const metStand = (keuze: ToegangKeuze): Regel => {
    const rij = perSleutel.get(keuze.sleutel);
    return {
      ...keuze,
      heeftWachtwoord: Boolean(rij?.wachtwoordHash),
      gewijzigdOp: rij?.wachtwoordGewijzigdOp ?? null,
      laatsteInlog: rij?.laatsteInlog ?? null,
      actief: rij?.actief ?? true,
      relatieId: rij?.relatieId ?? null,
      voorstel: undefined,
    };
  };
  const studieverenigingen = keuzes.studieverenigingen.map(metStand);
  const informanten = keuzes.informanten.map(metStand);

  return (
    <>
      <Paginakop
        titel="Portaaltoegang"
        beschrijving="Inloggen als vereniging: kies je naam uit de lijst en vul het wachtwoord in dat het hele bestuur deelt."
      />

      <Melding toon="info" className="mb-4">
        Elke vereniging en elke informant heeft één wachtwoord, minstens 4
        tekens. Stel het hier in en geef het door; de vereniging kan het daarna
        zelf wijzigen. Vergeten? Stel gewoon een nieuw in: het oude werkt dan
        meteen niet meer en wie nog ingelogd was, moet opnieuw inloggen. Zo&apos;n
        sessie ziet alleen het portaal, nooit de administratie. De persoonlijke
        accounts onder <em>Accounts</em> blijven gewoon werken.
      </Melding>

      <Melding toon="info" className="mb-4" titel="Openstaande facturen">
        Wie als vereniging inlogt, ziet de openstaande facturen van de relatie
        bij <em>Facturen van</em>. Bij een exacte naammatch koppelt de app dat
        zelf; kies je hier iets anders (of “Geen facturen”), dan blijft dat staan.
      </Melding>

      <div className="mb-6 flex flex-wrap items-center justify-between gap-4 rounded-xl border border-border bg-card p-4">
        <p className="text-sm">
          <strong>
            {stand.metWachtwoord} van {stand.totaal}
          </strong>{" "}
          hebben een wachtwoord ·{" "}
          <strong>{stand.recentIngelogd}</strong> hebben de afgelopen 30 dagen ingelogd
        </p>
        {/* Altijd op de pagina: na de actie ververst de pagina, en de lijst met
            wachtwoorden moet dan blijven staan, ook als iedereen er een heeft. */}
        <BeginwachtwoordenKnop zonderWachtwoord={stand.totaal - stand.metWachtwoord} />
      </div>

      <ToegangTabel
        titel="Studieverenigingen"
        toelichting="De lijst komt uit content/verenigingen.json."
        regels={studieverenigingen}
        relaties={relaties}
      />

      <ToegangTabel
        titel="Informanten"
        toelichting="Deze lijst beheer je hier zelf."
        regels={informanten}
        relaties={relaties}
        informanten
      />
    </>
  );
}

function ToegangTabel({
  titel,
  toelichting,
  regels,
  relaties,
  informanten = false,
}: {
  titel: string;
  toelichting: string;
  regels: Regel[];
  relaties: Relaties;
  informanten?: boolean;
}) {
  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle>{titel}</CardTitle>
        <p className="text-sm text-muted-foreground">{toelichting}</p>
      </CardHeader>
      {informanten ? (
        <CardContent>
          <InformantToevoegen />
        </CardContent>
      ) : null}
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Naam</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Wachtwoord laatst gewijzigd</TableHead>
            <TableHead>Laatst ingelogd</TableHead>
            <TableHead>Wachtwoord instellen</TableHead>
            <TableHead>Facturen van</TableHead>
            <TableHead className="text-right">Acties</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {regels.length === 0 ? (
            <TableRow>
              <TableCell colSpan={7} className="text-muted-foreground">
                Nog niemand in deze lijst.
              </TableCell>
            </TableRow>
          ) : null}
          {regels.map((regel) => (
            <TableRow key={regel.sleutel}>
              <TableCell className="font-medium">{regel.naam}</TableCell>
              <TableCell>
                {!regel.actief ? (
                  <Badge variant="waarschuwing">Uit</Badge>
                ) : regel.heeftWachtwoord ? (
                  <Badge variant="goed">Aan</Badge>
                ) : (
                  <Badge variant="waarschuwing">Nog geen wachtwoord</Badge>
                )}
              </TableCell>
              <TableCell className="cijfers whitespace-nowrap text-muted-foreground">
                {regel.gewijzigdOp ? formatteerTijdstempel(regel.gewijzigdOp) : "—"}
              </TableCell>
              <TableCell className="cijfers whitespace-nowrap text-muted-foreground">
                {regel.laatsteInlog ? formatteerTijdstempel(regel.laatsteInlog) : "nog nooit"}
              </TableCell>
              <TableCell>
                <WachtwoordInstellen sleutel={regel.sleutel} naam={regel.naam} />
              </TableCell>
              <TableCell>
                <RelatieKoppeling
                  sleutel={regel.sleutel}
                  naam={regel.naam}
                  relaties={relaties}
                  huidig={regel.relatieId}
                  voorstel={regel.voorstel}
                />
              </TableCell>
              <TableCell>
                <div className="flex flex-wrap justify-end gap-2">
                  <BevestigKnop
                    actie={zetToegangAanUit}
                    velden={{ sleutel: regel.sleutel, aan: regel.actief ? "nee" : "ja" }}
                    vraag={
                      regel.actief
                        ? `Toegang voor ${regel.naam} uitzetten? Wie nu ingelogd is, wordt meteen uitgelogd.`
                        : `Toegang voor ${regel.naam} weer aanzetten?`
                    }
                    size="sm"
                    variant="ghost"
                  >
                    {regel.actief ? "Uitzetten" : "Aanzetten"}
                  </BevestigKnop>
                  {informanten ? (
                    <BevestigKnop
                      actie={verwijderInformant}
                      velden={{ sleutel: regel.sleutel }}
                      vraag={`${regel.naam} uit de lijst halen? Het wachtwoord vervalt en wie ingelogd is, wordt uitgelogd.`}
                      size="sm"
                      variant="ghost"
                    >
                      Verwijderen
                    </BevestigKnop>
                  ) : null}
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
  );
}
