import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const voorraadpost = {
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    count: vi.fn(),
    createMany: vi.fn(),
  };
  const tx = { voorraadpost, boekjaar: { findFirst: vi.fn() } };
  return {
    tx,
    transaction: vi.fn(),
    auth: vi.fn(),
    year: vi.fn(),
    audit: vi.fn(),
  };
});
vi.mock("server-only", () => ({}));
vi.mock("@/lib/db", () => ({ db: { $transaction: mocks.transaction } }));
vi.mock("@/lib/auth/server", () => ({ vereisSessie: mocks.auth }));
vi.mock("@/lib/boekjaar", () => ({ vereisSchrijfbaarBoekjaar: mocks.year }));
vi.mock("@/lib/audit", () => ({ logAudit: mocks.audit }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({
  redirect: () => {
    throw Object.assign(new Error("redirect"), { digest: "NEXT_REDIRECT;" });
  },
}));
import { bewaarVoorraad, neemVoorraadOver, verwijderVoorraad } from "./acties";

function formulier(extra: Record<string, string | undefined> = {}) {
  const data = new FormData();
  for (const [key, value] of Object.entries({
    naam: "Dassen",
    eenheid: "stuks",
    beginAantal: "20",
    beginWaardePerStukCenten: "5,00",
    aantal: "12",
    waardePerStukCenten: "5,00",
    locatie: "Kast",
    notities: "",
    ...extra,
  }))
    if (value !== undefined) data.set(key, value);
  return data;
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
  mocks.auth.mockResolvedValue({ naam: "Penningmeester" });
  mocks.year.mockResolvedValue({
    id: "actief",
    startDatum: new Date("2026-09-01"),
  });
  mocks.transaction.mockImplementation((fn) => fn(mocks.tx));
});

describe("beveiliging van voorraadwijzigingen", () => {
  it("vereist een sessie voor opslaan, verwijderen en overnemen", async () => {
    mocks.auth.mockRejectedValue(new Error("Niet ingelogd"));
    await expect(bewaarVoorraad({}, formulier())).rejects.toThrow(
      "Niet ingelogd",
    );
    await expect(
      verwijderVoorraad({}, formulier({ id: "post" })),
    ).rejects.toThrow("Niet ingelogd");
    await expect(neemVoorraadOver()).rejects.toThrow("Niet ingelogd");
    expect(mocks.transaction).not.toHaveBeenCalled();
  });
  it("blokkeert elke wijziging in een afgesloten boekjaar", async () => {
    mocks.year.mockRejectedValue(new Error("Boekjaar afgesloten"));
    for (const result of [
      await bewaarVoorraad({}, formulier()),
      await verwijderVoorraad({}, formulier({ id: "post" })),
      await neemVoorraadOver(),
    ])
      expect(result.fout).toContain("afgesloten");
    expect(mocks.transaction).not.toHaveBeenCalled();
  });
  it("kan geen post uit een ander boekjaar wijzigen of verwijderen", async () => {
    mocks.tx.voorraadpost.findFirst.mockResolvedValue(null);
    expect(
      (await bewaarVoorraad({}, formulier({ id: "historisch" }))).fout,
    ).toContain("actieve boekjaar");
    expect(
      (await verwijderVoorraad({}, formulier({ id: "historisch" }))).fout,
    ).toContain("actieve boekjaar");
    expect(mocks.tx.voorraadpost.findFirst).toHaveBeenCalledWith({
      where: { id: "historisch", boekjaarId: "actief" },
    });
    expect(mocks.tx.voorraadpost.update).not.toHaveBeenCalled();
    expect(mocks.tx.voorraadpost.delete).not.toHaveBeenCalled();
  });
  it.each([
    { aantal: "-1" },
    { aantal: "1.5" },
    { waardePerStukCenten: "-5" },
    { naam: "" },
  ])("weigert ongeldige invoer %j", async (extra) => {
    expect(
      (await bewaarVoorraad({}, formulier(extra))).veldfouten,
    ).toBeDefined();
    expect(mocks.transaction).not.toHaveBeenCalled();
  });
  it("behoudt beginvoorraad wanneer alle spullen zijn verbruikt", async () => {
    mocks.tx.voorraadpost.findFirst.mockResolvedValue({
      id: "post",
      beginAantal: 20,
      aantal: 0,
    });
    expect(
      (await verwijderVoorraad({}, formulier({ id: "post" }))).fout,
    ).toContain("beginvoorraad");
    expect(mocks.tx.voorraadpost.delete).not.toHaveBeenCalled();
  });
  it("schrijft de post en het auditspoor in dezelfde transactie", async () => {
    mocks.tx.voorraadpost.create.mockImplementation(({ data }) => ({
      ...data,
      id: "post",
    }));
    await expect(bewaarVoorraad({}, formulier())).rejects.toThrow("redirect");
    expect(mocks.tx.voorraadpost.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        boekjaarId: "actief",
        beginAantal: 20,
        aantal: 12,
        waardePerStukCenten: 500,
      }),
    });
    expect(mocks.audit).toHaveBeenCalledWith(
      expect.objectContaining({ entiteitId: "post", boekjaarId: "actief" }),
      mocks.tx,
    );
  });
  it("overschrijft geen bestaande voorraad bij overnemen", async () => {
    mocks.tx.voorraadpost.count.mockResolvedValue(1);
    expect((await neemVoorraadOver()).fout).toContain(
      "nog geen voorraadposten",
    );
    expect(mocks.tx.voorraadpost.createMany).not.toHaveBeenCalled();
  });
  it("neemt de eindvoorraad over als begin- en huidige voorraad", async () => {
    mocks.tx.voorraadpost.count.mockResolvedValue(0);
    mocks.tx.boekjaar.findFirst.mockResolvedValue({
      naam: "Vorig jaar",
      voorraadposten: [
        {
          naam: "Dassen",
          eenheid: "stuks",
          beginAantal: 99,
          aantal: 12,
          beginWaardePerStukCenten: 700,
          waardePerStukCenten: 500,
          locatie: "Kast",
          notities: "",
        },
      ],
    });
    expect((await neemVoorraadOver()).melding).toContain("overgenomen");
    expect(mocks.tx.voorraadpost.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          boekjaarId: "actief",
          beginAantal: 12,
          aantal: 12,
          beginWaardePerStukCenten: 500,
          waardePerStukCenten: 500,
        }),
      ],
    });
  });
});
