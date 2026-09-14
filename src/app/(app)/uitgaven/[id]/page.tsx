import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Paperclip, Trash2 } from "lucide-react";

import { BevestigKnop } from "@/components/bevestigknop";
import { Paginakop } from "@/components/paginakop";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Melding } from "@/components/ui/melding";
import { vereisBoekjaarContext } from "@/lib/boekjaar";
import { db } from "@/lib/db";
import { datumNaarInvoer, formatteerDatum } from "@/lib/datum";
import { centenNaarInvoer, formatteerEuro } from "@/lib/geld";

import { verwijderUitgave } from "../acties";
import { UitgaveFormulier } from "../formulier";

export const metadata: Metadata = { title: "Uitgave" };

export default async function UitgavePagina({
  params,
}: PageProps<"/uitgaven/[id]">) {
  const { boekjaar, schrijfbaar } = await vereisBoekjaarContext();
  const { id } = await params;

  const uitgave = await db.uitgave.findUnique({
    where: { id },
    include: {
      bijlage: { select: { id: true, bestandsnaam: true, mimeType: true, grootte: true } },
      evenement: { select: { id: true, naam: true } },
      omslagronde: { select: { id: true, rondeNummer: true, type: true } },
    },
  });
  if (!uitgave) notFound();

  const [posten, leveranciers, evenementen] = await Promise.all([
    db.begrotingspost.findMany({
      where: { boekjaarId: boekjaar.id },
      orderBy: [{ soort: "desc" }, { volgorde: "asc" }],
      select: { id: true, code: true, naam: true, soort: true },
    }),
    db.relatie.findMany({
      where: { actief: true },
      orderBy: { naam: "asc" },
      select: { id: true, naam: true },
    }),
    db.evenement.findMany({
      where: { boekjaarId: boekjaar.id },
      orderBy: { datum: "asc" },
      select: { id: true, naam: true },
    }),
  ]);

  return (
    <>
      <Paginakop
        titel={uitgave.omschrijving}
        beschrijving={
          <span className="flex flex-wrap items-center gap-2">
            <span>
              {uitgave.leverancierNaam} · {formatteerDatum(uitgave.datum)} ·{" "}
              {formatteerEuro(uitgave.bedragCenten)}
            </span>
            {uitgave.bedragDefinitief ? (
              <Badge variant="goed">Bedrag definitief</Badge>
            ) : (
              <Badge variant="waarschuwing">Bedrag nog niet definitief</Badge>
            )}
            {uitgave.betaald ? (
              <Badge variant="goed">Betaald</Badge>
            ) : (
              <Badge variant="omlijnd">Nog te betalen</Badge>
            )}
          </span>
        }
        acties={
          schrijfbaar && !uitgave.omslagrondeId ? (
            <BevestigKnop
              actie={verwijderUitgave}
              velden={{ id: uitgave.id }}
              vraag="Deze uitgave verwijderen?"
            >
              <Trash2 />
              Verwijderen
            </BevestigKnop>
          ) : null
        }
      />

      {uitgave.omslagronde ? (
        <Melding toon="info" className="mb-4">
          Deze uitgave is doorbelast in{" "}
          {uitgave.omslagronde.type === "naheffing"
            ? `naheffing ${uitgave.omslagronde.rondeNummer}`
            : "de eerste omslagronde"}{" "}
          van{" "}
          <Link
            href={`/evenementen/${uitgave.evenementId}`}
            className="underline"
          >
            {uitgave.evenement?.naam}
          </Link>
          . Het bedrag kan daarom niet meer gewijzigd worden.
        </Melding>
      ) : null}

      {uitgave.tenLasteVanSvr ? (
        <Melding toon="waarschuwing" className="mb-4" titel="Ten laste van de SVR">
          Deze uitgave is bewust niet doorbelast aan de deelnemers en drukt dus
          op het resultaat van de SVR.
        </Melding>
      ) : null}

      {uitgave.bijlage ? (
        <div className="mb-4">
          <Button variant="outline" asChild>
            <a href={`/api/bijlagen/${uitgave.bijlage.id}`} target="_blank">
              <Paperclip />
              {uitgave.bijlage.bestandsnaam} (
              {Math.round(uitgave.bijlage.grootte / 1024)} kB)
            </a>
          </Button>
        </div>
      ) : null}

      {schrijfbaar ? (
        <UitgaveFormulier
          posten={posten}
          leveranciers={leveranciers}
          evenementen={evenementen}
          waarden={{
            id: uitgave.id,
            datum: datumNaarInvoer(uitgave.datum),
            leverancierNaam: uitgave.leverancierNaam,
            relatieId: uitgave.relatieId ?? "",
            omschrijving: uitgave.omschrijving,
            bedrag: centenNaarInvoer(uitgave.bedragCenten),
            begrotingspostId: uitgave.begrotingspostId,
            evenementId: uitgave.evenementId ?? "",
            bedragDefinitief: uitgave.bedragDefinitief,
            betaald: uitgave.betaald,
            betaaldOp: uitgave.betaaldOp
              ? datumNaarInvoer(uitgave.betaaldOp)
              : "",
            notities: uitgave.notities ?? "",
            heeftBijlage: uitgave.bijlageId !== null,
          }}
        />
      ) : (
        <Melding toon="info">
          Dit boekjaar is niet actief; de uitgave is alleen te bekijken.
        </Melding>
      )}
    </>
  );
}
