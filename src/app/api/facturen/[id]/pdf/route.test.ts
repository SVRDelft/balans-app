import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ factuur: vi.fn(), document: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@react-pdf/renderer", () => ({
  renderToBuffer: async () => Buffer.from("%PDF-test"),
}));
vi.mock("@/lib/auth/server", () => ({
  haalSessie: async () => ({ naam: "Bestuur" }),
}));
vi.mock("@/lib/db", () => ({
  db: {
    factuur: { findUnique: mocks.factuur },
    instellingen: { findUnique: async () => null },
  },
}));
vi.mock("@/lib/logo", () => ({ logoVoorPdf: async () => "logo" }));
vi.mock("@/lib/pdf/factuur-document", () => ({
  FactuurDocument: mocks.document,
}));
import { GET } from "./route";

function factuur(overrides: Record<string, unknown> = {}) {
  return {
    id: "origineel",
    nummer: "TEST-1",
    status: "deels_betaald",
    soort: "gewoon",
    totaalCenten: 10000,
    betalingen: [{ bedragCenten: 3000 }],
    creditfactuur: {
      nummer: "TEST-2",
      status: "betaald",
      totaalCenten: -2000,
      betalingen: [],
    },
    crediteertFactuur: null,
    relatie: { naam: "Vereniging" },
    regels: [],
    ...overrides,
  };
}
async function download() {
  const response = await GET(
    new Request("http://localhost/api/facturen/test/pdf"),
    { params: Promise.resolve({ id: "test" }) },
  );
  expect(response.status).toBe(200);
  expect(response.headers.get("Content-Type")).toBe("application/pdf");
  return mocks.document.mock.calls[0][0].factuur;
}
beforeEach(() => vi.resetAllMocks());

describe("de PDF gebruikt dezelfde openstaande bedragen als de administratie", () => {
  it("verrekent een gedeeltelijke credit en betaling", async () => {
    mocks.factuur.mockResolvedValue(factuur());
    const pdf = await download();
    expect(pdf.openstaandCenten).toBe(5000);
    expect(pdf.creditfactuur).toEqual({
      nummer: "TEST-2",
      bedragCenten: -2000,
    });
  });
  it("toont op een volledige credit alleen de werkelijk terug te betalen ontvangst", async () => {
    mocks.factuur.mockResolvedValue(
      factuur({
        soort: "credit",
        status: "verstuurd",
        totaalCenten: -10000,
        betalingen: [],
        creditfactuur: null,
        crediteertFactuur: factuur({ status: "gecrediteerd" }),
      }),
    );
    const pdf = await download();
    expect(pdf.openstaandCenten).toBe(-3000);
    expect(pdf.crediteertFactuurNummer).toBe("TEST-1");
    expect(pdf.isCredit).toBe(true);
  });
  it("behoudt een terugbetaling na oninbaar afboeken", async () => {
    mocks.factuur.mockResolvedValue(
      factuur({
        status: "oninbaar",
        betalingen: [{ bedragCenten: 12000 }],
        creditfactuur: null,
      }),
    );
    const pdf = await download();
    expect(pdf.openstaandCenten).toBe(-2000);
    expect(pdf.afgeboektCenten).toBe(0);
  });
  it("toont alleen het afgeboekte restant na een gedeeltelijke credit", async () => {
    mocks.factuur.mockResolvedValue(factuur({ status: "oninbaar" }));
    const pdf = await download();
    expect(pdf.openstaandCenten).toBe(0);
    expect(pdf.afgeboektCenten).toBe(5000);
  });
});
