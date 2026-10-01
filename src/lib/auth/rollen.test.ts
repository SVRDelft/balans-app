import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  koekje: vi.fn(),
  gebruikerZoeken: vi.fn(),
  omleiding: vi.fn((pad: string) => {
    throw new Error(`REDIRECT:${pad}`);
  }),
}));

vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: mocks.koekje }),
}));
vi.mock("next/navigation", () => ({ redirect: mocks.omleiding }));
vi.mock("@/lib/db", () => ({
  db: { gebruiker: { findUnique: mocks.gebruikerZoeken } },
}));

import {
  beperkingOpRelatie,
  haalSessie,
  vereisBestuur,
  vereisEigenRelatie,
  vereisPortaal,
} from "./server";
import { maakSessieCookie, type Sessie } from "./sessie";

const sessieVan = (overrides: Partial<Sessie> = {}): Sessie => ({
  gebruikerId: "g1",
  naam: "Proefbestuur",
  rol: "BESTUUR",
  verlooptOp: Date.now() + 1000,
  ...overrides,
});

async function zetCookie(sessie: Partial<Sessie> = {}) {
  const inhoud = sessieVan(sessie);
  const waarde = await maakSessieCookie({
    gebruikerId: inhoud.gebruikerId,
    naam: inhoud.naam,
    rol: inhoud.rol,
    relatieId: inhoud.relatieId,
  });
  mocks.koekje.mockReturnValue({ value: waarde });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("AUTH_SECRET", "test-geheim-dat-lang-genoeg-is-1234567890");
});

describe("wie mag waarbij", () => {
  it("laat een bestuursaccount in de administratie", async () => {
    await zetCookie({ rol: "BESTUUR" });
    mocks.gebruikerZoeken.mockResolvedValue({
      id: "g1", naam: "Proefbestuur", rol: "BESTUUR", relatieId: null, actief: true,
    });
    const sessie = await vereisBestuur();
    expect(sessie.rol).toBe("BESTUUR");
    expect(mocks.omleiding).not.toHaveBeenCalled();
  });

  it("stuurt een verenigingsaccount weg bij de administratie", async () => {
    await zetCookie({ rol: "SV", relatieId: "r1", gebruikerId: "g2" });
    mocks.gebruikerZoeken.mockResolvedValue({
      id: "g2", naam: "Curius", rol: "SV", relatieId: "r1", actief: true,
    });
    await expect(vereisBestuur()).rejects.toThrow("REDIRECT:/portaal");
  });

  it("laat hetzelfde verenigingsaccount wel in het portaal", async () => {
    await zetCookie({ rol: "SV", relatieId: "r1", gebruikerId: "g2" });
    mocks.gebruikerZoeken.mockResolvedValue({
      id: "g2", naam: "Curius", rol: "SV", relatieId: "r1", actief: true,
    });
    const sessie = await vereisPortaal();
    expect(sessie.relatieId).toBe("r1");
  });

  it("weigert een uitgezet account, ook met een geldig cookie", async () => {
    await zetCookie({ rol: "BESTUUR" });
    mocks.gebruikerZoeken.mockResolvedValue({
      id: "g1", naam: "Oud-bestuur", rol: "BESTUUR", relatieId: null, actief: false,
    });
    expect(await haalSessie()).toBeNull();
    await expect(vereisBestuur()).rejects.toThrow("REDIRECT:/inloggen");
  });

  it("volgt de rol uit de database, niet die uit het cookie", async () => {
    // Iemand was bestuur, is nu een verenigingsaccount: het oude cookie telt niet.
    await zetCookie({ rol: "BESTUUR", gebruikerId: "g3" });
    mocks.gebruikerZoeken.mockResolvedValue({
      id: "g3", naam: "Oud-bestuurslid", rol: "SV", relatieId: "r9", actief: true,
    });
    const sessie = await haalSessie();
    expect(sessie?.rol).toBe("SV");
    await expect(vereisBestuur()).rejects.toThrow("REDIRECT:/portaal");
  });

  it("weigert een cookie met een onzinnige rol of zonder vereniging", async () => {
    mocks.koekje.mockReturnValue({ value: "geknoeid.handtekening" });
    expect(await haalSessie()).toBeNull();
  });

  it("zonder cookie is er niets", async () => {
    mocks.koekje.mockReturnValue(undefined);
    expect(await haalSessie()).toBeNull();
    await expect(vereisBestuur()).rejects.toThrow("REDIRECT:/inloggen");
  });
});

describe("een vereniging ziet alleen zichzelf", () => {
  it("beperkt de gegevens van een SV-account op de eigen vereniging", () => {
    expect(beperkingOpRelatie(sessieVan({ rol: "SV", relatieId: "r1" }))).toBe("r1");
    expect(beperkingOpRelatie(sessieVan({ rol: "BESTUUR" }))).toBeUndefined();
  });

  it("weigert gegevens van een andere vereniging, ook met een geraden id", () => {
    const curius = sessieVan({ rol: "SV", relatieId: "r1" });
    expect(() => vereisEigenRelatie(curius, "r1")).not.toThrow();
    expect(() => vereisEigenRelatie(curius, "r2")).toThrow("andere vereniging");
  });

  it("laat het bestuur wel bij elke vereniging", () => {
    expect(() => vereisEigenRelatie(sessieVan({ rol: "BESTUUR" }), "r2")).not.toThrow();
  });
});
