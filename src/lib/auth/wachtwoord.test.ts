import { describe, expect, it } from "vitest";
import {
  controleerHash,
  hashWachtwoord,
  keurWachtwoord,
  maakWachtwoord,
} from "./wachtwoord";

describe("wachtwoorden bewaren zonder bcrypt", () => {
  it("herkent het juiste wachtwoord en wijst een fout wachtwoord af", async () => {
    const hash = await hashWachtwoord("een lang genoeg wachtwoord");
    expect(hash.startsWith("scrypt$")).toBe(true);
    expect(hash).not.toContain("een lang genoeg wachtwoord");
    expect(await controleerHash("een lang genoeg wachtwoord", hash)).toBe(true);
    expect(await controleerHash("Een lang genoeg wachtwoord", hash)).toBe(false);
    expect(await controleerHash("", hash)).toBe(false);
  });

  it("geeft twee keer hetzelfde wachtwoord een andere hash", async () => {
    const een = await hashWachtwoord("zelfde wachtwoord hier");
    const twee = await hashWachtwoord("zelfde wachtwoord hier");
    expect(een).not.toBe(twee);
    expect(await controleerHash("zelfde wachtwoord hier", twee)).toBe(true);
  });

  it("valt niet om over een beschadigde of onbekende hash", async () => {
    for (const rommel of ["", "x", "bcrypt$2a$10$abc", "scrypt$1$2$3", "scrypt$16384$8$1$zz$zz"]) {
      expect(await controleerHash("wat dan ook", rommel)).toBe(false);
    }
  });

  it("maakt een uit te spreken wachtwoord zonder i, l, o, 0 en 1", () => {
    for (let keer = 0; keer < 20; keer += 1) {
      const wachtwoord = maakWachtwoord();
      expect(wachtwoord).toMatch(/^[a-z2-9]{4}(-[a-z2-9]{4}){3}$/);
      expect(wachtwoord).not.toMatch(/[ilo01]/);
    }
    expect(maakWachtwoord()).not.toBe(maakWachtwoord());
  });

  it("vraagt om een wachtwoord van enige lengte", () => {
    expect(keurWachtwoord("kort")).toContain("12 tekens");
    expect(keurWachtwoord(" begint met spatie")).toContain("spatie");
    expect(keurWachtwoord("een zin die lang genoeg is")).toBeUndefined();
  });
});
