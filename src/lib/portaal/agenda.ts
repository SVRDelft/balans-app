import { REEKS_UITLEG, isReeks, vergaderNaam } from "@/lib/portaal/vergaderingen";

// De vergaderingen als iCalendar-feed (.ics), zodat besturen ze in Google
// Calendar of Outlook zetten en niet hoeven in te loggen voor een datum.
//
// De tijden staan in Amsterdamse tijd (met de tijdzone erbij, anders zet
// Outlook ze een uur verkeerd in de zomer). Een vergadering duurt in de feed
// twee uur; de echte eindtijd staat nergens vast. Zie AANNAMES.md.

export const VERGADERDUUR_MINUTEN = 120;

export interface AgendaVergadering {
  id: string;
  reeks: string;
  volgnummer: number | null;
  datum: Date;
  tijd: string;
  status: string;
  locatie: string;
  notitie: string | null;
  gastheer: string;
  bijgewerktOp: Date;
}

/** Tekst veilig in een iCalendar-veld: komma's, puntkomma's en regeleinden. */
const ontsnap = (tekst: string) =>
  tekst.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");

/** Regels langer dan 75 bytes worden gevouwen, zoals de standaard vraagt. */
function vouw(regel: string): string {
  const delen: string[] = [];
  let rest = regel;
  while (Buffer.byteLength(rest, "utf8") > 75) {
    let lengte = 75;
    while (Buffer.byteLength(rest.slice(0, lengte), "utf8") > 75) lengte--;
    delen.push(rest.slice(0, lengte));
    rest = " " + rest.slice(lengte);
  }
  delen.push(rest);
  return delen.join("\r\n");
}

const tweeCijfers = (getal: number) => String(getal).padStart(2, "0");

/** 2026-09-22 + "14:00" → 20260922T140000 (lokale tijd). */
function lokaal(datum: Date, tijd: string, extraMinuten = 0): string {
  const [uur, minuut] = tijd.split(":").map(Number);
  const moment = new Date(
    Date.UTC(datum.getUTCFullYear(), datum.getUTCMonth(), datum.getUTCDate(), uur, minuut + extraMinuten),
  );
  return (
    `${moment.getUTCFullYear()}${tweeCijfers(moment.getUTCMonth() + 1)}${tweeCijfers(moment.getUTCDate())}` +
    `T${tweeCijfers(moment.getUTCHours())}${tweeCijfers(moment.getUTCMinutes())}00`
  );
}

const utc = (moment: Date) => moment.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");

const TIJDZONE = [
  "BEGIN:VTIMEZONE",
  "TZID:Europe/Amsterdam",
  "BEGIN:DAYLIGHT",
  "TZOFFSETFROM:+0100",
  "TZOFFSETTO:+0200",
  "TZNAME:CEST",
  "DTSTART:19700329T020000",
  "RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU",
  "END:DAYLIGHT",
  "BEGIN:STANDARD",
  "TZOFFSETFROM:+0200",
  "TZOFFSETTO:+0100",
  "TZNAME:CET",
  "DTSTART:19701025T030000",
  "RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU",
  "END:STANDARD",
  "END:VTIMEZONE",
];

export function maakAgenda(
  vergaderingen: AgendaVergadering[],
  { naam, nu = new Date() }: { naam: string; nu?: Date },
): string {
  const regels = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//SVR Delft//Portaal//NL",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${ontsnap(naam)}`,
    "X-WR-TIMEZONE:Europe/Amsterdam",
    // Agenda-apps verversen een geabonneerde feed ongeveer elke zes uur.
    "REFRESH-INTERVAL;VALUE=DURATION:PT6H",
    "X-PUBLISHED-TTL:PT6H",
    ...TIJDZONE,
  ];

  for (const vergadering of vergaderingen) {
    const titel = vergaderNaam(vergadering);
    const wie = isReeks(vergadering.reeks) ? REEKS_UITLEG[vergadering.reeks] : "";
    const afgelast = vergadering.status === "afgelast";
    const beschrijving = [
      wie ? `${vergadering.reeks}: overleg van de ${wie.toLowerCase()}.` : "",
      `Bij ${vergadering.gastheer}.`,
      vergadering.status === "verplaatst" ? "Let op: deze vergadering is verplaatst." : "",
      vergadering.notitie ?? "",
      "Agenda en notulen staan in het portaal: https://svr.tudelft.nl/portaal",
    ]
      .filter(Boolean)
      .join("\n");

    regels.push(
      "BEGIN:VEVENT",
      `UID:${vergadering.id}@svr.tudelft.nl`,
      `DTSTAMP:${utc(nu)}`,
      `LAST-MODIFIED:${utc(vergadering.bijgewerktOp)}`,
      `DTSTART;TZID=Europe/Amsterdam:${lokaal(vergadering.datum, vergadering.tijd)}`,
      `DTEND;TZID=Europe/Amsterdam:${lokaal(vergadering.datum, vergadering.tijd, VERGADERDUUR_MINUTEN)}`,
      `SUMMARY:${ontsnap(`${afgelast ? "AFGELAST: " : ""}${titel} bij ${vergadering.gastheer}`)}`,
      `DESCRIPTION:${ontsnap(beschrijving)}`,
      ...(vergadering.locatie ? [`LOCATION:${ontsnap(vergadering.locatie)}`] : []),
      `STATUS:${afgelast ? "CANCELLED" : "CONFIRMED"}`,
      "END:VEVENT",
    );
  }

  regels.push("END:VCALENDAR");
  return regels.map(vouw).join("\r\n") + "\r\n";
}
