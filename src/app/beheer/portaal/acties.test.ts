import { beforeEach, describe, expect, it, vi } from "vitest";

// Een tweede agenda gaat nooit stilletjes bij een vergadering, en bewerken
// laat de stukken aan de vergadering hangen.

const mocks = vi.hoisted(() => ({
  bestanden: [] as { id: string; soort: string; vergaderingId: string | null; opslagnaam: string; titel: string }[],
  vergadering: { id: "v1" } as { id: string } | null,
  update: vi.fn(),
  verwijderd: [] as string[],
}));

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));
vi.mock("next/navigation", () => ({ unstable_rethrow: () => {} }));
vi.mock("@/lib/auth/server", () => ({ vereisBestuur: async () => ({ naam: "Bestuur" }) }));
vi.mock("@/lib/audit", () => ({ logAudit: async () => {} }));
vi.mock("@/lib/portaal/opslag", () => ({
  MAX_BYTES: 20 * 1024 * 1024,
  bewaarBestand: async () => ({ opslagnaam: "nieuw", mimeType: "application/pdf", grootte: 10 }),
  verwijderBestand: async (naam: string) => {
    mocks.verwijderd.push(naam);
  },
}));
vi.mock("@/lib/db", () => ({
  db: {
    vergadering: {
      findUnique: async () => mocks.vergadering,
      update: mocks.update,
      create: vi.fn(),
    },
    relatie: { findUnique: async () => ({ naam: "ETV" }) },
    portaalbestand: {
      findMany: async ({ where }: { where: { vergaderingId: string; soort: string } }) =>
        mocks.bestanden.filter((b) => b.vergaderingId === where.vergaderingId && b.soort === where.soort),
      create: async ({ data }: { data: { soort: string; titel: string; vergaderingId: string | null } }) => {
        const rij = { id: `b${mocks.bestanden.length + 1}`, opslagnaam: "nieuw", ...data };
        mocks.bestanden.push(rij);
        return rij;
      },
      delete: async ({ where }: { where: { id: string } }) => {
        mocks.bestanden = mocks.bestanden.filter((b) => b.id !== where.id);
      },
    },
  },
}));

import { bewaarVergadering, uploadBestand } from "./acties";

const pdf = () => new File([new Uint8Array([37, 80, 68, 70])], "agenda.pdf", { type: "application/pdf" });
const formulier = (velden: Record<string, string | File>) => {
  const gegevens = new FormData();
  for (const [naam, waarde] of Object.entries(velden)) gegevens.set(naam, waarde);
  return gegevens;
};

beforeEach(() => {
  mocks.bestanden = [{ id: "oud", soort: "agenda", vergaderingId: "v1", opslagnaam: "oud-bestand", titel: "Agenda" }];
  mocks.vergadering = { id: "v1" };
  mocks.verwijderd = [];
  mocks.update.mockReset();
});

describe("een tweede agenda bij dezelfde vergadering", () => {
  it("wordt niet stilletjes toegevoegd", async () => {
    const uitkomst = await uploadBestand({}, formulier({ soort: "agenda", vergaderingId: "v1", bestand: pdf() }));
    expect(uitkomst.fout).toContain("Kies vervangen of toevoegen");
    expect(mocks.bestanden).toHaveLength(1);
  });

  it("vervangen haalt de oude weg, ook van de server", async () => {
    const uitkomst = await uploadBestand(
      {},
      formulier({ soort: "agenda", vergaderingId: "v1", bestand: pdf(), bestaand: "vervangen" }),
    );
    expect(uitkomst.melding).toBeTruthy();
    expect(mocks.bestanden.map((b) => b.soort)).toEqual(["agenda"]);
    expect(mocks.bestanden[0].id).not.toBe("oud");
    expect(mocks.verwijderd).toEqual(["oud-bestand"]);
  });

  it("toevoegen als extra stuk vraagt een eigen titel en wordt een bijlage", async () => {
    const zonderTitel = await uploadBestand(
      {},
      formulier({ soort: "agenda", vergaderingId: "v1", bestand: pdf(), bestaand: "toevoegen" }),
    );
    expect(zonderTitel.fout).toContain("eigen titel");

    await uploadBestand(
      {},
      formulier({ soort: "agenda", vergaderingId: "v1", bestand: pdf(), bestaand: "toevoegen", titel: "Presentatie" }),
    );
    expect(mocks.bestanden.map((b) => [b.soort, b.titel])).toEqual([
      ["agenda", "Agenda"],
      ["bijlage", "Presentatie"],
    ]);
  });

  it("een presentatie hoort bij een vergadering", async () => {
    const uitkomst = await uploadBestand({}, formulier({ soort: "presentatie", bestand: pdf() }));
    expect(uitkomst.fout).toContain("hoort bij een vergadering");
  });
});

describe("een vergadering bewerken", () => {
  it("werkt dezelfde vergadering bij, met status, locatie en volgnummer", async () => {
    const uitkomst = await bewaarVergadering(
      {},
      formulier({
        id: "v1",
        reeks: "SVR",
        datum: "2027-02-09",
        tijd: "14:00",
        locatie: "Classroom 6",
        status: "verplaatst",
        volgnummer: "6",
      }),
    );
    expect(uitkomst.melding).toBe("Vergadering bijgewerkt.");
    expect(mocks.update).toHaveBeenCalledWith({
      where: { id: "v1" },
      data: expect.objectContaining({ locatie: "Classroom 6", status: "verplaatst", volgnummer: 6 }),
    });
    // De stukken hangen aan het id, en dat blijft gelijk.
    expect(mocks.bestanden.map((b) => b.vergaderingId)).toEqual(["v1"]);
  });

  it("weigert een onbekende status", async () => {
    const uitkomst = await bewaarVergadering(
      {},
      formulier({ id: "v1", reeks: "SVR", datum: "2027-02-09", tijd: "14:00", status: "weg" }),
    );
    expect(uitkomst.fout).toContain("gepland, verplaatst of afgelast");
  });
});
