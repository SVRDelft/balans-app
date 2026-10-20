import { beforeEach, describe, expect, it, vi } from "vitest";

// Een deellink opent een agenda of notulen zonder inloggen, maar alleen met de
// juiste sleutel, nooit een los document, en nooit zichtbaar voor Google.

const mocks = vi.hoisted(() => ({
  zoek: vi.fn(),
  bijwerken: vi.fn(),
  lees: vi.fn(),
  sessie: vi.fn(),
  audit: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));
vi.mock("@/lib/db", () => ({
  db: { portaalbestand: { findUnique: mocks.zoek, update: mocks.bijwerken } },
}));
vi.mock("@/lib/portaal/opslag", () => ({ leesBestand: mocks.lees }));
vi.mock("@/lib/auth/server", () => ({ vereisPortaal: mocks.sessie }));
vi.mock("@/lib/audit", () => ({ logAudit: mocks.audit }));

import { GET } from "./route";
import { haalDeellink } from "@/app/portaal/acties";
import { maakDeelsleutel } from "@/lib/portaal/delen";

const SLEUTEL = maakDeelsleutel();
const NOTULEN = {
  id: "b1",
  soort: "notulen",
  titel: "Notulen SVR 10-11",
  bestandsnaam: "notulen svr.pdf",
  mimeType: "application/pdf",
  opslagnaam: "x",
  deelsleutel: SLEUTEL,
};

const open = (sleutel: string) =>
  GET(new Request(`http://localhost/delen/${sleutel}`), {
    params: Promise.resolve({ sleutel }),
  });

beforeEach(() => {
  vi.resetAllMocks();
  mocks.lees.mockResolvedValue(Buffer.from("%PDF-1.4"));
});

describe("een gedeelde link openen", () => {
  it("geeft de notulen zonder in te loggen, en zegt Google dat ze niet in de index mogen", async () => {
    mocks.zoek.mockResolvedValue(NOTULEN);
    const antwoord = await open(SLEUTEL);
    expect(antwoord.status).toBe(200);
    expect(antwoord.headers.get("Content-Type")).toBe("application/pdf");
    expect(antwoord.headers.get("X-Robots-Tag")).toContain("noindex");
    expect(antwoord.headers.get("Cache-Control")).toContain("no-store");
    expect(mocks.zoek).toHaveBeenCalledWith({ where: { deelsleutel: SLEUTEL } });
  });

  it("een onbekende of ingetrokken sleutel werkt niet, ook met noindex", async () => {
    mocks.zoek.mockResolvedValue(null);
    const antwoord = await open(maakDeelsleutel());
    expect(antwoord.status).toBe(404);
    expect(antwoord.headers.get("X-Robots-Tag")).toContain("noindex");
  });

  it("een los document is nooit via een link te openen", async () => {
    mocks.zoek.mockResolvedValue({ ...NOTULEN, soort: "document" });
    expect((await open(SLEUTEL)).status).toBe(404);
    expect(mocks.lees).not.toHaveBeenCalled();
  });

  it("raakt de database niet bij een sleutel die er niet uitziet als een sleutel", async () => {
    for (const onzin of ["", "abc", "../../etc/passwd", "a".repeat(200)]) {
      expect((await open(onzin)).status).toBe(404);
    }
    expect(mocks.zoek).not.toHaveBeenCalled();
  });
});

describe("een deellink maken", () => {
  it("vereist een portaalsessie", async () => {
    mocks.sessie.mockRejectedValue(new Error("REDIRECT:/inloggen"));
    await expect(haalDeellink("b1")).rejects.toThrow("REDIRECT:/inloggen");
    expect(mocks.bijwerken).not.toHaveBeenCalled();
  });

  it("maakt een nieuwe sleutel als het stuk nog niet gedeeld was", async () => {
    mocks.sessie.mockResolvedValue({ soort: "groep", rol: "PORTAAL", naam: "Curius" });
    mocks.zoek.mockResolvedValue({ ...NOTULEN, deelsleutel: null });
    const uitkomst = await haalDeellink("b1");
    expect(uitkomst).toMatchObject({ pad: expect.stringMatching(/^\/delen\/[A-Za-z0-9_-]{43}$/) });
    expect(mocks.bijwerken).toHaveBeenCalledOnce();
  });

  it("geeft de bestaande link terug, zodat eerder gedeelde links blijven werken", async () => {
    mocks.sessie.mockResolvedValue({ rol: "BESTUUR", naam: "Bestuur" });
    mocks.zoek.mockResolvedValue(NOTULEN);
    expect(await haalDeellink("b1")).toEqual({ pad: `/delen/${SLEUTEL}` });
    expect(mocks.bijwerken).not.toHaveBeenCalled();
  });

  it("weigert een los document", async () => {
    mocks.sessie.mockResolvedValue({ rol: "BESTUUR", naam: "Bestuur" });
    mocks.zoek.mockResolvedValue({ ...NOTULEN, soort: "document", deelsleutel: null });
    expect(await haalDeellink("b1")).toHaveProperty("fout");
    expect(mocks.bijwerken).not.toHaveBeenCalled();
  });
});
