import { beforeEach, describe, expect, it, vi } from "vitest";

// Een vereniging mag haar eigen factuur downloaden — dat scheelt het bestuur een
// hoop mailtjes — maar die van een ander nooit, en een concept ook niet: dat is
// nog niet verstuurd en kan nog wijzigen.

const mocks = vi.hoisted(() => ({
  sessie: vi.fn(),
  factuur: vi.fn(),
  pdf: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth/server", () => ({ haalSessie: mocks.sessie }));
vi.mock("@/lib/db", () => ({ db: { factuur: { findUnique: mocks.factuur } } }));
vi.mock("@/lib/pdf/factuur-pdf", () => ({ maakFactuurPdf: mocks.pdf }));

import { GET } from "./route";

const BESTUUR = { gebruikerId: "b1", naam: "Bestuur", rol: "BESTUUR" };
const EIGEN_SV = { gebruikerId: "s1", naam: "Bèta", rol: "SV", relatieId: "beta" };
const ANDERE_SV = { gebruikerId: "s2", naam: "Curius", rol: "SV", relatieId: "curius" };

const haal = () =>
  GET(new Request("http://localhost/api/facturen/f1/pdf"), {
    params: Promise.resolve({ id: "f1" }),
  });

beforeEach(() => {
  mocks.sessie.mockReset();
  mocks.factuur.mockReset();
  mocks.pdf.mockReset();
  mocks.factuur.mockResolvedValue({ relatieId: "beta", status: "verstuurd" });
  mocks.pdf.mockResolvedValue({
    nummer: "SVR62-2026-0001",
    relatieId: "beta",
    status: "verstuurd",
    bytes: new Uint8Array([1, 2, 3]),
  });
});

describe("factuur-PDF", () => {
  it("weigert wie niet is ingelogd", async () => {
    mocks.sessie.mockResolvedValue(null);
    expect((await haal()).status).toBe(401);
    expect(mocks.pdf).not.toHaveBeenCalled();
  });

  it("geeft het bestuur elke factuur", async () => {
    mocks.sessie.mockResolvedValue(BESTUUR);
    expect((await haal()).status).toBe(200);
  });

  it("geeft een vereniging haar eigen factuur", async () => {
    mocks.sessie.mockResolvedValue(EIGEN_SV);
    const antwoord = await haal();
    expect(antwoord.status).toBe(200);
    expect(antwoord.headers.get("Content-Type")).toBe("application/pdf");
  });

  it("weigert de factuur van een andere vereniging", async () => {
    mocks.sessie.mockResolvedValue(ANDERE_SV);
    expect((await haal()).status).toBe(403);
    // En maakt het document dan ook niet aan.
    expect(mocks.pdf).not.toHaveBeenCalled();
  });

  it("weigert een concept, ook aan de eigen vereniging", async () => {
    mocks.sessie.mockResolvedValue(EIGEN_SV);
    mocks.factuur.mockResolvedValue({ relatieId: "beta", status: "concept" });
    expect((await haal()).status).toBe(403);
    expect(mocks.pdf).not.toHaveBeenCalled();
  });

  it("geeft het bestuur wél een concept, om te controleren", async () => {
    mocks.sessie.mockResolvedValue(BESTUUR);
    mocks.factuur.mockResolvedValue({ relatieId: "beta", status: "concept" });
    expect((await haal()).status).toBe(200);
  });

  it("meldt een factuur die niet bestaat", async () => {
    mocks.sessie.mockResolvedValue(BESTUUR);
    mocks.factuur.mockResolvedValue(null);
    expect((await haal()).status).toBe(404);
  });
});
