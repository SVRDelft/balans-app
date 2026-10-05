import type { Metadata } from "next";
import Link from "next/link";

import { BevestigKnop } from "@/components/bevestigknop";
import { Kerngetal, Paginakop } from "@/components/paginakop";
import { Badge } from "@/components/ui/badge";
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
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { vereisBoekjaarContext } from "@/lib/boekjaar";
import { datumNaarInvoer, formatteerDatum, vandaag } from "@/lib/datum";
import { db } from "@/lib/db";
import { OUDERDOM_LABEL } from "@/lib/finance/debiteuren";
import { formatteerEuro } from "@/lib/geld";
import { haalBoekjaarCijfers } from "@/lib/rapportage";

import { verwijderRekeningpost } from "./acties";
import { RekeningpostFormulier } from "./formulier";

export const metadata: Metadata = { title: "Debiteuren" };

/**
 * Alles wat de SVR nog moet krijgen, op één pagina: openstaande facturen en de
 * rekening-courant van personen en verenigingen.
 *
 * Die twee staan los van elkaar. Een factuur is een vordering met een nummer en
 * een vervaldatum; de rekening-courant is het schuifwerk daarbuiten — iets dat
 * privé met de SVR-pas betaald is, of een voorschot dat nog terug moet.
 */
export default async function DebiteurenPagina() {
  const { boekjaar, schrijfbaar } = await vereisBoekjaarContext();
  const [cijfers, posten, relaties, begrotingsposten] = await Promise.all([
    haalBoekjaarCijfers(boekjaar.id),
    db.rekeningpost.findMany({
      orderBy: [{ datum: "desc" }, { aangemaaktOp: "desc" }],
      include: {
        relatie: { select: { id: true, naam: true } },
        boekjaar: { select: { id: true, naam: true, startDatum: true } },
        begrotingspost: { select: { code: true, naam: true } },
        bankmutatie: { select: { id: true } },
      },
    }),
    db.relatie.findMany({
      where: { actief: true },
      orderBy: { naam: "asc" },
      select: { id: true, naam: true, type: true },
    }),
    db.begrotingspost.findMany({
      where: { boekjaarId: boekjaar.id },
      orderBy: { code: "asc" },
      select: { id: true, code: true, naam: true, soort: true },
    }),
  ]);

  const { rekeningcourant, ouderdom } = cijfers;
  // Alleen de posten tot en met dit boekjaar: latere jaren horen hier niet bij.
  const zichtbaar = posten.filter(
    (post) => post.boekjaar.startDatum <= boekjaar.startDatum,
  );
  const aantalFacturen =
    cijfers.openstaandeFacturen.length + cijfers.eerdereOpenstaandeFacturen.length;
  const factuurDebiteurenCenten =
    cijfers.balans.debiteurenCenten + cijfers.balans.eerdereDebiteurenCenten;

  return (
    <>
      <Paginakop
        titel="Debiteuren"
        beschrijving={`Wat de SVR nog moet ontvangen in ${boekjaar.naam}: openstaande facturen en de rekening-courant.`}
      />

      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        <Kerngetal
          label="Openstaande facturen"
          waarde={formatteerEuro(factuurDebiteurenCenten)}
          toelichting={aantalFacturen === 1 ? "1 factuur" : `${aantalFacturen} facturen, waarvan ${cijfers.eerdereOpenstaandeFacturen.length} uit een eerder jaar`}
        />
        <Kerngetal
          label="Te vorderen van personen"
          waarde={formatteerEuro(rekeningcourant.teVorderenCenten)}
          toelichting="Rekening-courant: moet nog aan de SVR betaald worden"
        />
        <Kerngetal
          label="Nog terug te betalen"
          waarde={formatteerEuro(rekeningcourant.teBetalenCenten)}
          toelichting="Rekening-courant: wat de SVR nog aan anderen moet"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Rekening-courant per relatie</CardTitle>
            <CardDescription>
              Geld dat buiten facturen om heen en weer gaat. Een saldo loopt door
              over boekjaren heen, tot het is verrekend.
            </CardDescription>
          </CardHeader>
          <CardContent className="px-0">
            {rekeningcourant.saldi.length === 0 ? (
              <p className="px-6 text-sm text-muted-foreground">
                Nog niets op de rekening-courant. Zet hier bijvoorbeeld een
                privébestelling op die met de SVR-pas is betaald.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Wie</TableHead>
                    <TableHead className="text-right">Saldo</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rekeningcourant.saldi.map((saldo) => (
                    <TableRow key={saldo.relatieId}>
                      <TableCell>
                        <Link
                          href={`/beheer/relaties/${saldo.relatieId}`}
                          className="font-medium hover:underline"
                        >
                          {saldo.relatieNaam}
                        </Link>
                        <span className="block text-xs text-muted-foreground">
                          {saldo.aantalPosten}{" "}
                          {saldo.aantalPosten === 1 ? "post" : "posten"}, laatste
                          op {formatteerDatum(saldo.laatsteDatum)}
                          {saldo.overgenomenCenten !== 0
                            ? ` · ${formatteerEuro(saldo.overgenomenCenten)} uit eerdere jaren`
                            : ""}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <Bedrag centen={saldo.saldoCenten} />
                        <span className="block text-xs text-muted-foreground">
                          {saldo.saldoCenten > 0
                            ? "moet nog betalen"
                            : saldo.saldoCenten < 0
                              ? "krijgt nog terug"
                              : "verrekend"}
                        </span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
                <TableFooter>
                  <TableRow>
                    <TableCell className="font-semibold">Samen</TableCell>
                    <TableCell className="text-right font-semibold">
                      <Bedrag centen={rekeningcourant.nettoCenten} />
                    </TableCell>
                  </TableRow>
                </TableFooter>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Bedrag op een rekening zetten</CardTitle>
            <CardDescription>
              Voor iedereen die je wilt bijhouden, niet alleen het bestuur. Een
              terugbetaling boek je met dezelfde knop, als &ldquo;de SVR moet nog
              betalen&rdquo;.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {schrijfbaar ? (
              <RekeningpostFormulier
                relaties={relaties}
                posten={begrotingsposten}
                vandaag={datumNaarInvoer(vandaag())}
              />
            ) : (
              <Melding toon="info">
                {boekjaar.naam} is niet het actieve boekjaar. Schakel om, of zet dit
                jaar bij{" "}
                <Link href="/beheer/boekjaren" className="underline">
                  Boekjaren
                </Link>{" "}
                in reconstructie om het alsnog op te bouwen.
              </Melding>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Alle posten op de rekening-courant</CardTitle>
          <CardDescription>
            Van nieuw naar oud. Een bedrag met &ldquo;buiten de bank&rdquo; is een
            correctie en staat als kosten of opbrengst in de exploitatie.
          </CardDescription>
        </CardHeader>
        <CardContent className="px-0">
          {zichtbaar.length === 0 ? (
            <p className="px-6 text-sm text-muted-foreground">
              Nog geen posten.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Datum</TableHead>
                  <TableHead>Wie</TableHead>
                  <TableHead>Waarvoor</TableHead>
                  <TableHead className="text-right">Bedrag</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {zichtbaar.map((post) => (
                  <TableRow key={post.id}>
                    <TableCell className="cijfers whitespace-nowrap">
                      {formatteerDatum(post.datum)}
                      {post.boekjaar.id !== boekjaar.id ? (
                        <span className="block text-xs text-muted-foreground">
                          {post.boekjaar.naam}
                        </span>
                      ) : null}
                    </TableCell>
                    <TableCell>{post.relatie.naam}</TableCell>
                    <TableCell>
                      {post.omschrijving}
                      <span className="block text-xs text-muted-foreground">
                        {post.viaBank
                          ? "via de SVR-rekening"
                          : `buiten de bank · ${post.begrotingspost ? `${post.begrotingspost.code} ${post.begrotingspost.naam}` : "zonder post"}`}
                        {post.bankmutatie ? " · uit de bankimport" : ""}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <Bedrag centen={post.bedragCenten} />
                    </TableCell>
                    <TableCell className="text-right">
                      {schrijfbaar &&
                      post.boekjaar.id === boekjaar.id &&
                      !post.bankmutatie ? (
                        <BevestigKnop
                          actie={verwijderRekeningpost}
                          velden={{ id: post.id }}
                          vraag="Deze post van de rekening-courant verwijderen?"
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
          )}
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Openstaande facturen</CardTitle>
          <CardDescription>
            Gerekend vanaf de factuurdatum. Facturen uit een eerder boekjaar staan
            erbij: het geld daarvan komt in dit jaar binnen.
          </CardDescription>
        </CardHeader>
        <CardContent className="px-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Ouderdom</TableHead>
                <TableHead className="text-right">Bedrag</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(["tot30", "van30tot60", "meer60"] as const).map((groep) => (
                <TableRow key={groep}>
                  <TableCell>{OUDERDOM_LABEL[groep]}</TableCell>
                  <TableCell className="text-right">
                    <Bedrag centen={ouderdom[groep]} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell className="font-semibold">Samen</TableCell>
                <TableCell className="text-right font-semibold">
                  <Bedrag centen={ouderdom.totaal} />
                </TableCell>
              </TableRow>
            </TableFooter>
          </Table>

          {cijfers.eerdereOpenstaandeFacturen.length > 0 ? (
            <div className="mt-6 px-6">
              <h3 className="mb-2 text-sm font-semibold">
                Nog open uit eerdere boekjaren
              </h3>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Factuur</TableHead>
                    <TableHead>Wie</TableHead>
                    <TableHead className="text-right">Openstaand</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {cijfers.eerdereOpenstaandeFacturen.map((factuur) => (
                    <TableRow key={factuur.id}>
                      <TableCell className="whitespace-nowrap">
                        {factuur.nummer}
                        <Badge variant="waarschuwing" className="ml-2">
                          {factuur.boekjaarNaam}
                        </Badge>
                      </TableCell>
                      <TableCell>{factuur.relatieNaam}</TableCell>
                      <TableCell className="text-right">
                        <Bedrag centen={factuur.openstaandCenten} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <p className="mt-2 text-sm text-muted-foreground">
                Komt dit geld nu binnen? Importeer het afschrift bij{" "}
                <Link href="/beheer/bank/importeren" className="underline">
                  Bankimport
                </Link>
                ; deze facturen staan daar gewoon tussen de keuzes. De betaling
                wordt dan in {boekjaar.naam} geboekt.
              </p>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </>
  );
}
