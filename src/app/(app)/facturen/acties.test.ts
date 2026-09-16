import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  find: vi.fn(),
  update: vi.fn(),
  transaction: vi.fn(),
  recount: vi.fn(),
  lock: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth/server", () => ({
  vereisSessie: async () => ({ naam: "Testbestuur" }),
}));
vi.mock("@/lib/boekjaar", () => ({
  vereisSchrijfbaarBoekjaar: async () => ({ id: "jaar" }),
}));
vi.mock("@/lib/boekjaar-koppelingen", () => ({
  controleerKoppelingen: vi.fn(),
}));
vi.mock("@/lib/audit", () => ({ logAudit: vi.fn() }));
vi.mock("@/lib/db", () => ({
  db: { factuur: { findUnique: mocks.find }, $transaction: mocks.transaction },
}));
vi.mock("@/lib/facturen", () => ({
  hertelFactuur: mocks.recount,
  vergrendelFactuur: mocks.lock,
  volgendFactuurnummer: vi.fn(),
  betaaldBedrag: (betalingen: { bedragCenten: number }[]) =>
    betalingen.reduce((som, betaling) => som + betaling.bedragCenten, 0),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({
  unstable_rethrow: vi.fn(),
  redirect: vi.fn(),
}));
import { zetStatus, verstuurFactuur, bewaarFactuur } from "./acties";

const credit = {
  id: "credit",
  status: "betaald",
  totaalCenten: -2000,
  betalingen: [],
};
function factuur(overrides: Record<string, unknown> = {}) {
  return {
    id: "origineel",
    nummer: "TEST-1",
    boekjaarId: "jaar",
    status: "deels_betaald",
    totaalCenten: 10000,
    betalingen: [{ bedragCenten: 3000 }],
    creditfactuur: credit,
    crediteertFactuur: null,
    crediteertFactuurId: null,
    relatieId: "relatie",
    evenementId: null,
    regels: [{ bedragCenten: 10000 }],
    ...overrides,
  };
}
function form(waarden: Record<string, string>) {
  const data = new FormData();
  for (const [key, value] of Object.entries(waarden)) data.set(key, value);
  return data;
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
  mocks.find.mockResolvedValue(factuur());
  mocks.transaction.mockImplementation((fn) =>
    fn({ factuur: { findUniqueOrThrow: mocks.find, update: mocks.update } }),
  );
});

describe("afboeken en herstellen met een credit", () => {
  it("kan het resterende bedrag na een gedeeltelijke credit afboeken", async () => {
    const resultaat = await zetStatus(
      {},
      form({ id: "origineel", status: "oninbaar" }),
    );
    expect(resultaat.melding).toBeTruthy();
    expect(mocks.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: "oninbaar" } }),
    );
    expect(mocks.recount).toHaveBeenCalled();
  });
  it.each([
    {
      totaalCenten: -2000,
      crediteertFactuurId: "origineel",
      creditfactuur: null,
    },
    { betalingen: [{ bedragCenten: 12000 }] },
    { creditfactuur: { ...credit, totaalCenten: -10000 } },
  ])(
    "schrijft geen credit, overbetaling of volledig gecrediteerd bedrag af: %j",
    async (overrides) => {
      mocks.find.mockResolvedValue(factuur(overrides));
      expect(
        (await zetStatus({}, form({ id: "origineel", status: "oninbaar" })))
          .fout,
      ).toContain("te ontvangen");
      expect(mocks.update).not.toHaveBeenCalled();
    },
  );
  it("herstelt een oninbaar restant en herberekent de gekoppelde facturen", async () => {
    mocks.find.mockResolvedValue(factuur({ status: "oninbaar" }));
    expect(
      (await zetStatus({}, form({ id: "origineel", status: "verstuurd" })))
        .melding,
    ).toBeTruthy();
    expect(mocks.recount).toHaveBeenCalled();
  });
});

describe("een gekoppelde credit blijft een correctie op dezelfde factuur", () => {
  it("verstuurt geen credit zolang het origineel oninbaar staat", async () => {
    mocks.find.mockResolvedValue(
      factuur({
        id: "credit",
        status: "concept",
        crediteertFactuur: factuur({ status: "oninbaar" }),
        totaalCenten: -2000,
      }),
    );
    expect((await verstuurFactuur({}, form({ id: "credit" }))).fout).toContain(
      "Herstel",
    );
    expect(mocks.update).not.toHaveBeenCalled();
  });
  it("kan een creditconcept niet naar een andere relatie verplaatsen", async () => {
    mocks.find.mockResolvedValue(
      factuur({
        id: "credit",
        status: "concept",
        crediteertFactuur: factuur(),
        totaalCenten: -2000,
      }),
    );
    const resultaat = await bewaarFactuur(
      {},
      form({
        id: "credit",
        relatieId: "andere-relatie",
        omschrijving: "Correctie",
        factuurdatum: "2026-09-15",
        vervaldatum: "2026-09-15",
        regelsJson: JSON.stringify([
          {
            omschrijving: "Correctie",
            aantal: 1,
            prijsPerStukCenten: -2000,
            begrotingspostId: "post",
          },
        ]),
      }),
    );
    expect(resultaat.fout).toContain("dezelfde relatie");
    expect(mocks.transaction).not.toHaveBeenCalled();
  });
});
