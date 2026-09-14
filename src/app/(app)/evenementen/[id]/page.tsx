import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Pencil, Plus } from "lucide-react";

import { Paginakop } from "@/components/paginakop";
import {
  Badge,
  EvenementStatusBadge,
  FactuurStatusBadge,
} from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { formatteerDatum, formatteerTijdstempel } from "@/lib/datum";
import { formatteerEuro } from "@/lib/geld";
import {
  bepaalBlokkades,
  bepaalTeVerdelenUitgaven,
  berekenAfstemming,
  telAangemeld,
  telBevestigd,
} from "@/lib/finance/omslag";
import { cn } from "@/lib/utils";

import { Deelnemerspaneel } from "./deelnemerspaneel";
import { OmslagPaneel } from "./omslagpaneel";
import {
  DefinitiefKnop,
  HeropenKnop,
  SluitKnop,
  TenLasteVanSvrKnop,
} from "./knoppen";

export const metadata: Metadata = { title: "Evenement" };

export default async function EvenementPagina({
  params,
}: PageProps<"/evenementen/[id]">) {
  const { schrijfbaar } = await vereisBoekjaarContext();
  const { id } = await params;

  const evenement = await db.evenement.findUnique({
    where: { id },
    include: {
      kostenpost: { select: { code: true, naam: true } },
      opbrengstpost: { select: { code: true, naam: true } },
      deelnemers: {
        orderBy: { naam: "asc" },
        include: { _count: { select: { omslagrondeRegels: true } } },
      },
      uitgaven: { orderBy: { datum: "asc" } },
      facturen: {
        orderBy: { volgnummer: "asc" },
        include: {
          relatie: { select: { naam: true } },
          betalingen: { select: { bedragCenten: true } },
        },
      },
      omslagrondes: {
        orderBy: { rondeNummer: "asc" },
        include: { regels: true },
      },
    },
  });
  if (!evenement) notFound();

  const relaties = await db.relatie.findMany({
    where: { actief: true },
    orderBy: [{ type: "asc" }, { naam: "asc" }],
    select: { id: true, naam: true },
  });

  const deelnemersVoorRekenen = evenement.deelnemers.map((deelnemer) => ({
    id: deelnemer.id,
    naam: deelnemer.naam,
    aantalPersonen: deelnemer.aantalPersonen,
    aangemeld: deelnemer.aangemeld,
    bevestigdBetalend: deelnemer.bevestigdBetalend,
  }));

  const uitgavenVoorRekenen = evenement.uitgaven.map((uitgave) => ({
    id: uitgave.id,
    omschrijving: uitgave.omschrijving,
    bedragCenten: uitgave.bedragCenten,
    bedragDefinitief: uitgave.bedragDefinitief,
    tenLasteVanSvr: uitgave.tenLasteVanSvr,
    omslagrondeId: uitgave.omslagrondeId,
  }));

  const teVerdelen = bepaalTeVerdelenUitgaven(uitgavenVoorRekenen);
  const teVerdelenCenten = teVerdelen.reduce(
    (som, uitgave) => som + uitgave.bedragCenten,
    0,
  );

  const totaleKostenCenten = evenement.uitgaven.reduce(
    (som, uitgave) => som + uitgave.bedragCenten,
    0,
  );
  const tenLasteVanSvrCenten = evenement.uitgaven
    .filter((uitgave) => uitgave.tenLasteVanSvr)
    .reduce((som, uitgave) => som + uitgave.bedragCenten, 0);

  // Ook de concepten tellen mee: de vraag is of de kosten zijn doorbelast.
  const gefactureerdCenten = evenement.facturen.reduce(
    (som, factuur) => som + factuur.totaalCenten,
    0,
  );
  const conceptCenten = evenement.facturen
    .filter((factuur) => factuur.status === "concept")
    .reduce((som, factuur) => som + factuur.totaalCenten, 0);
  const ontvangenCenten = evenement.facturen.reduce(
    (som, factuur) =>
      som +
      factuur.betalingen.reduce((deel, betaling) => deel + betaling.bedragCenten, 0),
    0,
  );

  const aantalBevestigd = telBevestigd(deelnemersVoorRekenen);
  const aantalAangemeld = telAangemeld(deelnemersVoorRekenen);

  const afstemming = berekenAfstemming({
    totaleKostenCenten,
    tenLasteVanSvrCenten,
    nogNietVerdeeldCenten: teVerdelenCenten,
    gefactureerdCenten,
    conceptCenten,
    ontvangenCenten,
    aantalBevestigd,
  });

  const heeftOmslag = evenement.omslagrondes.length > 0;
  const nakomers = heeftOmslag && teVerdelen.length > 0;
  const bewerkbaar = schrijfbaar && evenement.status !== "afgesloten";

  const blokkades = bepaalBlokkades({
    evenementStatus: evenement.status,
    heeftOpbrengstpost: evenement.opbrengstpostId !== null,
    deelnemers: deelnemersVoorRekenen,
    teVerdelenUitgaven: teVerdelen,
  });

  return (
    <>
      <Paginakop
        titel={evenement.naam}
        beschrijving={
          <span className="flex flex-wrap items-center gap-2">
            <EvenementStatusBadge status={evenement.status} />
            <span>{formatteerDatum(evenement.datum)}</span>
            {evenement.opbrengstpost ? (
              <span className="text-xs">
                Opbrengsten op{" "}
                <span className="font-mono">{evenement.opbrengstpost.code}</span>
              </span>
            ) : null}
          </span>
        }
        acties={
          <>
            {bewerkbaar ? (
              <Button variant="outline" asChild>
                <Link href={`/evenementen/${evenement.id}/bewerken`}>
                  <Pencil />
                  Bewerken
                </Link>
              </Button>
            ) : null}
            {schrijfbaar && evenement.status === "afgesloten" ? (
              <HeropenKnop evenementId={evenement.id} />
            ) : null}
          </>
        }
      />

      {nakomers ? (
        <Melding
          toon="fout"
          className="mb-5"
          titel="Er zijn kosten binnengekomen ná de omslag"
        >
          <p>
            {formatteerEuro(teVerdelenCenten)} aan uitgaven is nog niet
            doorbelast. Zolang dit blijft staan, draait de SVR ervoor op.
          </p>
          <ul className="mt-2 list-disc space-y-0.5 pl-5 text-sm">
            {teVerdelen.map((uitgave) => (
              <li key={uitgave.id}>
                {uitgave.omschrijving} — {formatteerEuro(uitgave.bedragCenten)}
                {!uitgave.bedragDefinitief ? (
                  <span className="text-muted-foreground">
                    {" "}
                    (bedrag nog niet definitief)
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
          <p className="mt-2">Je hebt twee keuzes:</p>
          <ol className="mt-1 list-decimal space-y-1 pl-5 text-sm">
            <li>
              Een <strong>naheffing</strong> over dezelfde deelnemers. Dat is{" "}
              {aantalBevestigd > 0
                ? formatteerEuro(Math.ceil(teVerdelenCenten / aantalBevestigd))
                : "—"}{" "}
              per persoon en het resultaat van het evenement blijft nul.
            </li>
            <li>
              Het bedrag <strong>ten laste van de SVR</strong> boeken. Het
              jaarresultaat wordt dan{" "}
              {formatteerEuro(-teVerdelenCenten)} slechter.
            </li>
          </ol>
          {schrijfbaar ? (
            <div className="mt-3">
              <TenLasteVanSvrKnop
                evenementId={evenement.id}
                bedrag={formatteerEuro(teVerdelenCenten)}
              />
            </div>
          ) : null}
        </Melding>
      ) : null}

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Afstemming</CardTitle>
          <CardDescription>
            Op een omslagpost hoort geen winst of verlies te ontstaan.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Regel label="Totale kosten" centen={afstemming.totaleKostenCenten} />
            <Regel label="Totaal gefactureerd" centen={afstemming.gefactureerdCenten} />
            <Regel label="Totaal ontvangen" centen={afstemming.ontvangenCenten} />
            <Regel
              label="Verschil"
              centen={afstemming.resultaatCenten}
              toon={
                afstemming.resultaatCenten < 0
                  ? "fout"
                  : afstemming.resultaatCenten === 0
                    ? "goed"
                    : "waarschuwing"
              }
            />
          </div>

          <div className="mt-3 space-y-1 text-sm">
            {afstemming.conceptCenten !== 0 ? (
              <p className="text-warning-foreground">
                {formatteerEuro(afstemming.conceptCenten)} staat nog op concept.
                Die facturen zijn wel aangemaakt, maar tellen pas mee in de
                exploitatie zodra je ze op verstuurd zet.
              </p>
            ) : null}
            {afstemming.nogNietVerdeeldCenten !== 0 ? (
              <p className="text-destructive">
                {formatteerEuro(afstemming.nogNietVerdeeldCenten)} aan kosten is
                nog niet verdeeld.
              </p>
            ) : null}
            {afstemming.tenLasteVanSvrCenten !== 0 ? (
              <p className="text-warning-foreground">
                {formatteerEuro(afstemming.tenLasteVanSvrCenten)} is bewust ten
                laste van de SVR geboekt.
              </p>
            ) : null}
            {afstemming.nogTeOntvangenCenten !== 0 ? (
              <p className="text-muted-foreground">
                Nog te ontvangen van deelnemers:{" "}
                {formatteerEuro(afstemming.nogTeOntvangenCenten)}.
              </p>
            ) : null}
            {afstemming.klopt &&
            afstemming.nogTeOntvangenCenten === 0 &&
            afstemming.conceptCenten === 0 ? (
              <p className="text-success">
                Alles klopt: kosten, facturen en ontvangsten sluiten op elkaar
                aan.
              </p>
            ) : null}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Uitgaven op dit evenement</CardTitle>
            <CardDescription>
              Zolang een bedrag niet definitief is, blokkeert het de omslag.
            </CardDescription>
          </CardHeader>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Omschrijving</TableHead>
                <TableHead className="text-right">Bedrag</TableHead>
                <TableHead className="text-center">Definitief</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {evenement.uitgaven.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-muted-foreground">
                    Nog geen uitgaven gekoppeld.
                  </TableCell>
                </TableRow>
              ) : null}
              {evenement.uitgaven.map((uitgave) => (
                <TableRow key={uitgave.id}>
                  <TableCell>
                    <Link
                      href={`/uitgaven/${uitgave.id}`}
                      className="hover:underline"
                    >
                      {uitgave.omschrijving}
                    </Link>
                    <span className="block text-xs text-muted-foreground">
                      {uitgave.leverancierNaam} ·{" "}
                      {formatteerDatum(uitgave.datum)}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <Bedrag centen={uitgave.bedragCenten} />
                  </TableCell>
                  <TableCell className="text-center">
                    {schrijfbaar && !uitgave.omslagrondeId ? (
                      <DefinitiefKnop
                        id={uitgave.id}
                        aan={uitgave.bedragDefinitief}
                      />
                    ) : uitgave.bedragDefinitief ? (
                      "✓"
                    ) : (
                      "—"
                    )}
                  </TableCell>
                  <TableCell className="text-xs">
                    {uitgave.tenLasteVanSvr ? (
                      <Badge variant="fout">Ten laste van SVR</Badge>
                    ) : uitgave.omslagrondeId ? (
                      <Badge variant="goed">Verdeeld</Badge>
                    ) : (
                      <Badge variant="waarschuwing">Nog te verdelen</Badge>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {bewerkbaar ? (
            <CardContent className="border-t border-border pt-4">
              <Button variant="outline" size="sm" asChild>
                <Link href={`/uitgaven/nieuw?evenement=${evenement.id}`}>
                  <Plus />
                  Uitgave toevoegen
                </Link>
              </Button>
            </CardContent>
          ) : null}
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Deelnemers</CardTitle>
            <CardDescription>
              Er wordt omgeslagen over de bevestigd betalende personen, niet over
              de aangemelde.
            </CardDescription>
          </CardHeader>
          <Deelnemerspaneel
            evenementId={evenement.id}
            relaties={relaties}
            bewerkbaar={bewerkbaar}
            deelnemers={evenement.deelnemers.map((deelnemer) => ({
              id: deelnemer.id,
              naam: deelnemer.naam,
              aantalPersonen: deelnemer.aantalPersonen,
              aangemeld: deelnemer.aangemeld,
              bevestigdBetalend: deelnemer.bevestigdBetalend,
              inOmslag: deelnemer._count.omslagrondeRegels > 0,
            }))}
          />
        </Card>
      </div>

      {bewerkbaar ? (
        <div className="mt-6">
          <OmslagPaneel
            evenementId={evenement.id}
            isNaheffing={heeftOmslag}
            totaalKostenCenten={teVerdelenCenten}
            aantalAangemeld={aantalAangemeld}
            aantalBevestigd={
              heeftOmslag
                ? evenement.omslagrondes[0].regels.reduce(
                    (som, regel) => som + regel.aantalPersonen,
                    0,
                  )
                : aantalBevestigd
            }
            blokkades={blokkades}
          />
        </div>
      ) : null}

      {evenement.omslagrondes.length > 0 ? (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Berekende omslagrondes</CardTitle>
          </CardHeader>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Ronde</TableHead>
                <TableHead>Berekend</TableHead>
                <TableHead className="text-right">Kosten</TableHead>
                <TableHead className="text-right">Aangemeld</TableHead>
                <TableHead className="text-right">Bevestigd</TableHead>
                <TableHead className="text-right">Per persoon</TableHead>
                <TableHead className="text-right">Gefactureerd</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {evenement.omslagrondes.map((ronde) => (
                <TableRow key={ronde.id}>
                  <TableCell>
                    {ronde.rondeNummer}{" "}
                    {ronde.type === "naheffing" ? (
                      <Badge variant="waarschuwing">Naheffing</Badge>
                    ) : null}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {formatteerTijdstempel(ronde.berekendOp)}
                    <span className="block">door {ronde.berekendDoor}</span>
                  </TableCell>
                  <TableCell className="text-right">
                    <Bedrag centen={ronde.totaalKostenCenten} />
                  </TableCell>
                  <TableCell className="cijfers text-right text-muted-foreground">
                    {ronde.aantalAangemeld}
                  </TableCell>
                  <TableCell className="cijfers text-right font-medium">
                    {ronde.aantalBevestigd}
                  </TableCell>
                  <TableCell className="text-right">
                    <Bedrag centen={ronde.prijsPerPersoonCenten} />
                  </TableCell>
                  <TableCell className="text-right">
                    <Bedrag centen={ronde.totaalGefactureerdCenten} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      ) : null}

      {evenement.facturen.length > 0 ? (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Facturen van dit evenement</CardTitle>
          </CardHeader>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nummer</TableHead>
                <TableHead>Relatie</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Bedrag</TableHead>
                <TableHead className="text-right">Ontvangen</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {evenement.facturen.map((factuur) => (
                <TableRow key={factuur.id}>
                  <TableCell>
                    <Link
                      href={`/facturen/${factuur.id}`}
                      className="cijfers hover:underline"
                    >
                      {factuur.nummer}
                    </Link>
                  </TableCell>
                  <TableCell>{factuur.relatie.naam}</TableCell>
                  <TableCell>
                    <FactuurStatusBadge status={factuur.status} />
                  </TableCell>
                  <TableCell className="text-right">
                    <Bedrag centen={factuur.totaalCenten} />
                  </TableCell>
                  <TableCell className="text-right">
                    <Bedrag
                      centen={factuur.betalingen.reduce(
                        (som, betaling) => som + betaling.bedragCenten,
                        0,
                      )}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      ) : null}

      {schrijfbaar && evenement.status === "omslag_berekend" ? (
        <div className="mt-6">
          <SluitKnop evenementId={evenement.id} />
        </div>
      ) : null}
    </>
  );
}

function Regel({
  label,
  centen,
  toon = "neutraal",
}: {
  label: string;
  centen: number;
  toon?: "neutraal" | "goed" | "waarschuwing" | "fout";
}) {
  const kleur = {
    neutraal: "text-foreground",
    goed: "text-success",
    waarschuwing: "text-warning-foreground",
    fout: "text-destructive",
  }[toon];

  return (
    <div className="rounded-lg border border-border px-3 py-2.5">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className={cn("cijfers mt-0.5 text-lg font-semibold", kleur)}>
        {formatteerEuro(centen)}
      </p>
    </div>
  );
}
