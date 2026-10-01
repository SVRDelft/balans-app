import type { Metadata } from "next";
import Link from "next/link";
import { CalendarDays, Download, FileText, Megaphone } from "lucide-react";

import { vereisPortaal } from "@/lib/auth/server";
import { formatteerDatum } from "@/lib/datum";
import { gastheerVan, haalDocumenten, haalMededelingen, haalVergaderingen } from "@/lib/portaal/gegevens";
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
  const [mededelingen, vergaderingen, documenten] = await Promise.all([
    haalMededelingen(),
    haalVergaderingen(),
    haalDocumenten(),
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
