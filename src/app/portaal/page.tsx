import type { Metadata } from "next";
import Link from "next/link";
import { CalendarDays, Download, FileText, Megaphone, Receipt } from "lucide-react";

import { vereisPortaal } from "@/lib/auth/server";
import { formatteerDatum } from "@/lib/datum";
import {
  gastheerVan,
  haalDocumenten,
  haalEigenRekening,
  haalMededelingen,
  haalVergaderingen,
} from "@/lib/portaal/gegevens";
import { FACTUUR_STATUS_LABEL, type FactuurStatus } from "@/lib/domein";
import { formatteerEuro } from "@/lib/geld";
import { REEKS_UITLEG, type Reeks } from "@/lib/portaal/vergaderingen";
import { leesSvr } from "@/lib/content";

import { uitloggen } from "../inloggen/acties";

export const metadata: Metadata = {
  title: "Portaal",
  robots: { index: false, follow: false },
};

function Bestandsknop({
  bestand,
}: {
  bestand: { id: string; titel: string; bestandsnaam: string; grootte: number };
}) {
  return (
    <a
      className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-sm hover:bg-muted/60"
      href={`/api/portaal/bestand/${bestand.id}`}
    >
      <Download className="size-4" />
      {bestand.titel}
      <span className="text-xs text-muted-foreground">
        {Math.max(1, Math.round(bestand.grootte / 1024))} kB
      </span>
    </a>
  );
}

function Vergaderingen({
  vergaderingen,
  leeg,
}: {
  vergaderingen: Awaited<ReturnType<typeof haalVergaderingen>>["komend"];
  leeg: string;
}) {
  if (vergaderingen.length === 0) {
    return <p className="text-sm text-muted-foreground">{leeg}</p>;
  }
  return (
    <ul className="space-y-3">
      {vergaderingen.map((vergadering) => {
        const agenda = vergadering.bestanden.filter((b) => b.soort === "agenda");
        const notulen = vergadering.bestanden.filter((b) => b.soort === "notulen");
        return (
          <li key={vergadering.id} className="rounded-xl border border-border bg-card p-4">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <p className="font-semibold">
                {vergadering.reeks}
                <span className="ml-2 text-sm font-normal text-muted-foreground">
                  {REEKS_UITLEG[vergadering.reeks as Reeks] ?? ""}
                </span>
              </p>
              <p className="cijfers text-sm text-muted-foreground">
                {formatteerDatum(vergadering.datum)} · {vergadering.tijd} · bij{" "}
                {gastheerVan(vergadering)}
              </p>
            </div>
            {vergadering.notitie ? (
              <p className="mt-2 whitespace-pre-wrap text-sm">{vergadering.notitie}</p>
            ) : null}
            <div className="mt-3 flex flex-wrap gap-2">
              {agenda.length === 0 && notulen.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nog niet beschikbaar</p>
              ) : (
                [...agenda, ...notulen].map((bestand) => (
                  <Bestandsknop key={bestand.id} bestand={bestand} />
                ))
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

export default async function PortaalPagina() {
  const sessie = await vereisPortaal();
  const svr = leesSvr();
  const [mededelingen, vergaderingen, documenten, rekening] = await Promise.all([
    haalMededelingen(),
    haalVergaderingen(),
    haalDocumenten(),
    // Alleen een vereniging heeft een eigen rekening; het bestuur ziet die in de
    // administratie, niet hier.
    sessie.relatieId ? haalEigenRekening(sessie.relatieId) : null,
  ]);

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <header className="mb-8 flex flex-wrap items-start justify-between gap-3 border-b border-border pb-5">
        <div>
          <p className="text-[0.68rem] font-semibold tracking-[0.18em] text-muted-foreground uppercase">
            SVR Delft
          </p>
          <h1 className="text-2xl font-semibold">Portaal</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Ingelogd als {sessie.naam}
            {sessie.rol === "SV" ? "" : " (SVR-bestuur)"}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3 text-sm">
          {sessie.rol === "BESTUUR" ? (
            <Link className="text-primary underline" href="/beheer">
              Administratie
            </Link>
          ) : null}
          <Link className="text-primary underline" href="/wachtwoord">
            Wachtwoord
          </Link>
          <form action={uitloggen}>
            <button type="submit" className="text-primary underline">
              Uitloggen
            </button>
          </form>
        </div>
      </header>

      {rekening ? (
        <section className="mb-10">
          <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold">
            <Receipt className="size-5" /> Jullie facturen
          </h2>

          {rekening.regels.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Er staan nog geen facturen voor jullie klaar.
            </p>
          ) : (
            <>
              <div className="rounded-xl border border-border bg-card p-4">
                <p className="text-sm text-muted-foreground">Nu openstaand</p>
                <p className="cijfers text-2xl font-semibold">
                  {formatteerEuro(rekening.openstaandCenten)}
                </p>
                {rekening.openstaandCenten !== 0 && rekening.iban ? (
                  <p className="mt-2 text-sm text-muted-foreground">
                    Over te maken naar{" "}
                    <span className="cijfers">{rekening.iban}</span>, onder
                    vermelding van het factuurnummer. Betalingen worden met de hand
                    bijgewerkt, dus het kan een paar dagen duren voordat je het hier
                    ziet staan.
                  </p>
                ) : null}
                {rekening.openstaandCenten === 0 ? (
                  <p className="mt-2 text-sm text-muted-foreground">
                    Alles is betaald — niets meer te doen.
                  </p>
                ) : null}
              </div>

              <div className="mt-3 overflow-x-auto rounded-xl border border-border bg-card">
                <table className="w-full text-sm">
                  <thead className="border-b border-border text-left text-xs text-muted-foreground uppercase">
                    <tr>
                      <th className="px-4 py-2 font-medium">Factuur</th>
                      <th className="px-4 py-2 font-medium">Waarvoor</th>
                      <th className="px-4 py-2 font-medium">Vervalt</th>
                      <th className="px-4 py-2 text-right font-medium">Bedrag</th>
                      <th className="px-4 py-2 text-right font-medium">Openstaand</th>
                      <th className="px-4 py-2" />
                    </tr>
                  </thead>
                  <tbody>
                    {rekening.regels.map((regel) => (
                      <tr key={regel.id} className="border-b border-border last:border-0">
                        <td className="px-4 py-2">
                          <span className="cijfers">{regel.nummer}</span>
                          <span className="block text-xs text-muted-foreground">
                            {FACTUUR_STATUS_LABEL[regel.status as FactuurStatus] ??
                              regel.status}{" "}
                            · {regel.boekjaarNaam}
                          </span>
                        </td>
                        <td className="px-4 py-2">{regel.omschrijving}</td>
                        <td className="cijfers px-4 py-2 whitespace-nowrap text-muted-foreground">
                          {formatteerDatum(regel.vervaldatum)}
                        </td>
                        <td className="cijfers px-4 py-2 text-right whitespace-nowrap">
                          {formatteerEuro(regel.totaalCenten)}
                        </td>
                        <td className="cijfers px-4 py-2 text-right whitespace-nowrap">
                          {regel.openstaandCenten === 0
                            ? "—"
                            : formatteerEuro(regel.openstaandCenten)}
                        </td>
                        <td className="px-4 py-2 text-right">
                          <a
                            className="inline-flex items-center gap-1.5 text-primary underline"
                            href={`/api/facturen/${regel.id}/pdf`}
                          >
                            <Download className="size-4" />
                            PDF
                          </a>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {rekening.rekeningSaldoCenten !== 0 ? (
            <div className="mt-3 rounded-xl border border-border bg-card p-4">
              <p className="font-semibold">
                {rekening.rekeningSaldoCenten > 0
                  ? "Daarnaast nog te verrekenen"
                  : "De SVR moet jullie nog terugbetalen"}
                : {formatteerEuro(Math.abs(rekening.rekeningSaldoCenten))}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                Dit loopt buiten facturen om — bijvoorbeeld iets dat de SVR heeft
                voorgeschoten of juist van jullie heeft gekregen.
              </p>
              <ul className="mt-2 space-y-1 text-sm">
                {rekening.rekeningposten.slice(0, 5).map((post) => (
                  <li key={post.id} className="flex justify-between gap-3">
                    <span>
                      <span className="cijfers text-muted-foreground">
                        {formatteerDatum(post.datum)}
                      </span>{" "}
                      {post.omschrijving}
                    </span>
                    <span className="cijfers whitespace-nowrap">
                      {formatteerEuro(post.bedragCenten)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </section>
      ) : null}

      <section className="mb-10">
        <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold">
          <Megaphone className="size-5" /> Mededelingen
        </h2>
        {mededelingen.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nog geen mededelingen van het bestuur.
          </p>
        ) : (
          <ul className="space-y-3">
            {mededelingen.map((mededeling) => (
              <li key={mededeling.id} className="rounded-xl border border-border bg-card p-4">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="font-semibold">{mededeling.titel}</p>
                  <p className="cijfers text-xs text-muted-foreground">
                    {formatteerDatum(mededeling.geplaatstOp)} · {mededeling.geplaatstDoor}
                  </p>
                </div>
                <p className="mt-2 whitespace-pre-wrap text-sm">{mededeling.tekst}</p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mb-10">
        <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold">
          <CalendarDays className="size-5" /> Komende vergaderingen
        </h2>
        <Vergaderingen
          vergaderingen={vergaderingen.komend}
          leeg="Er staan geen vergaderingen meer gepland. Het bestuur voert het nieuwe rooster in."
        />
      </section>

      {vergaderingen.geweest.length > 0 ? (
        <section className="mb-10">
          <h2 className="mb-3 text-lg font-semibold">Geweest</h2>
          <Vergaderingen vergaderingen={vergaderingen.geweest} leeg="" />
        </section>
      ) : null}

      <section className="mb-10">
        <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold">
          <FileText className="size-5" /> Documenten
        </h2>
        {documenten.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nog geen losse documenten, zoals de jaarplanning of het cobo-schema.
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {documenten.map((bestand) => (
              <Bestandsknop key={bestand.id} bestand={bestand} />
            ))}
          </div>
        )}
      </section>

      <section className="rounded-xl border border-border bg-card p-4">
        <h2 className="font-semibold">Contact</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Vragen aan het SVR-bestuur? Mail{" "}
          <a className="text-primary underline" href={`mailto:${svr.email}`}>
            {svr.email}
          </a>
          . Dat adres blijft hetzelfde bij een bestuurswissel.
        </p>
      </section>
    </main>
  );
}
