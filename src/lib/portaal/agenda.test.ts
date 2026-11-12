import { describe, expect, it } from "vitest";

import { maakAgenda, type AgendaVergadering } from "./agenda";

const vergadering = (extra: Partial<AgendaVergadering> = {}): AgendaVergadering => ({
  id: "v1",
  reeks: "SVR",
  volgnummer: 4,
  datum: new Date("2026-12-08T00:00:00Z"),
  tijd: "14:00",
  status: "gepland",
  locatie: "PSOR",
  notitie: null,
  gastheer: "ETV",
  bijgewerktOp: new Date("2026-11-01T10:00:00Z"),
  ...extra,
});

const nu = new Date("2026-11-12T09:00:00Z");

describe("de agenda-feed", () => {
  it("is een geldig iCalendar-bestand met CRLF en een tijdzone", () => {
    const ics = maakAgenda([vergadering()], { naam: "SVR Delft", nu });
    expect(ics.startsWith("BEGIN:VCALENDAR\r\n")).toBe(true);
    expect(ics.endsWith("END:VCALENDAR\r\n")).toBe(true);
    expect(ics).not.toMatch(/[^\r]\n/);
    expect(ics).toContain("BEGIN:VTIMEZONE\r\nTZID:Europe/Amsterdam");
  });

  it("zet de vergadering in Amsterdamse tijd, twee uur lang, met nummer en locatie", () => {
    const ics = maakAgenda([vergadering()], { naam: "SVR Delft", nu });
    expect(ics).toContain("DTSTART;TZID=Europe/Amsterdam:20261208T140000");
    expect(ics).toContain("DTEND;TZID=Europe/Amsterdam:20261208T160000");
    expect(ics).toContain("SUMMARY:SVR 4 bij ETV");
    expect(ics).toContain("LOCATION:PSOR");
    expect(ics).toContain("UID:v1@svr.tudelft.nl");
    expect(ics).toContain("STATUS:CONFIRMED");
  });

  it("markeert een afgelaste vergadering, zodat agenda's hem doorhalen", () => {
    const ics = maakAgenda([vergadering({ status: "afgelast" })], { naam: "SVR Delft", nu });
    expect(ics).toContain("STATUS:CANCELLED");
    expect(ics).toContain("SUMMARY:AFGELAST: SVR 4 bij ETV");
  });

  it("ontsnapt komma's en puntkomma's en vouwt lange regels", () => {
    const ics = maakAgenda(
      [vergadering({ notitie: "Neem mee: laptop, pen; en " + "heel veel geduld ".repeat(10) })],
      { naam: "SVR Delft", nu },
    );
    // Een agenda-app plakt gevouwen regels weer aan elkaar (CRLF + spatie).
    expect(ics.replace(/\r\n /g, "")).toContain("laptop\\, pen\\; en");
    for (const regel of ics.split("\r\n")) {
      expect(Buffer.byteLength(regel, "utf8")).toBeLessThanOrEqual(75);
    }
  });
});
