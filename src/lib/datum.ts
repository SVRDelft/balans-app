// Datums staan in de database in UTC. Velden die alleen een dag aanduiden
// (factuurdatum, vervaldatum, datum van een uitgave) worden bewaard als
// middernacht UTC en ook weer als UTC getoond, zodat de dag nooit verschuift.
// Tijdstempels (auditlog) worden wél in Europe/Amsterdam getoond.

export const TIJDZONE = "Europe/Amsterdam";

const DAG_FORMAT = new Intl.DateTimeFormat("nl-NL", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  timeZone: "UTC",
});

const DAG_LANG_FORMAT = new Intl.DateTimeFormat("nl-NL", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

const TIJDSTEMPEL_FORMAT = new Intl.DateTimeFormat("nl-NL", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: TIJDZONE,
});

/** 01-09-2026 */
export function formatteerDatum(datum: Date): string {
  return DAG_FORMAT.format(datum);
}

/** 1 september 2026 */
export function formatteerDatumLang(datum: Date): string {
  return DAG_LANG_FORMAT.format(datum);
}

/** 01-09-2026 14:35, in Europe/Amsterdam */
export function formatteerTijdstempel(datum: Date): string {
  return TIJDSTEMPEL_FORMAT.format(datum);
}

/** Middernacht UTC op de opgegeven dag. */
export function maakDag(jaar: number, maand: number, dag: number): Date {
  return new Date(Date.UTC(jaar, maand - 1, dag));
}

/** Leest "2026-09-01" uit een <input type="date"> als middernacht UTC. */
export function datumUitInvoer(invoer: string): Date | null {
  const overeenkomst = /^(\d{4})-(\d{2})-(\d{2})$/.exec(invoer.trim());
  if (!overeenkomst) return null;
  const jaar = Number(overeenkomst[1]);
  const maand = Number(overeenkomst[2]);
  const dag = Number(overeenkomst[3]);
  if (maand < 1 || maand > 12 || dag < 1 || dag > 31) return null;
  const datum = maakDag(jaar, maand, dag);
  if (datum.getUTCMonth() !== maand - 1 || datum.getUTCDate() !== dag) {
    return null;
  }
  return datum;
}

/** Waarde voor een <input type="date">. */
export function datumNaarInvoer(datum: Date): string {
  const jaar = datum.getUTCFullYear();
  const maand = String(datum.getUTCMonth() + 1).padStart(2, "0");
  const dag = String(datum.getUTCDate()).padStart(2, "0");
  return `${jaar}-${maand}-${dag}`;
}

/** Vandaag, als middernacht UTC — de dag zoals die in Amsterdam geldt. */
export function vandaag(): Date {
  const nu = new Date();
  const delen = new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: TIJDZONE,
  }).format(nu);
  return datumUitInvoer(delen) ?? new Date(Date.UTC(1970, 0, 1));
}

export function telDagenOp(datum: Date, dagen: number): Date {
  return new Date(datum.getTime() + dagen * 24 * 60 * 60 * 1000);
}

/** Aantal hele dagen tussen twee dagen (later − eerder). */
export function dagenTussen(eerder: Date, later: Date): number {
  const verschil = later.getTime() - eerder.getTime();
  return Math.floor(verschil / (24 * 60 * 60 * 1000));
}
