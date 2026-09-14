import { describe, expect, it } from "vitest";

import {
  centenNaarInvoer,
  deelNaarBoven,
  formatteerEuro,
  parseerBedragNaarCenten,
  verdeelCenten,
} from "./geld";

describe("formatteerEuro", () => {
  it("toont Nederlands formaat", () => {
    // Intl gebruikt een vaste spatie na het euroteken; die normaliseren we hier.
    expect(formatteerEuro(123_456).replace(/ /g, " ")).toBe("€ 1.234,56");
    expect(formatteerEuro(0).replace(/ /g, " ")).toBe("€ 0,00");
    expect(formatteerEuro(-66_429).replace(/ /g, " ")).toBe("€ -664,29");
  });
});

describe("parseerBedragNaarCenten", () => {
  it("leest de manieren waarop een mens een bedrag typt", () => {
    expect(parseerBedragNaarCenten("1234,56")).toBe(123_456);
    expect(parseerBedragNaarCenten("1.234,56")).toBe(123_456);
    expect(parseerBedragNaarCenten("1234.56")).toBe(123_456);
    expect(parseerBedragNaarCenten("€ 1.234,56")).toBe(123_456);
    expect(parseerBedragNaarCenten("1234")).toBe(123_400);
    expect(parseerBedragNaarCenten("0,05")).toBe(5);
    expect(parseerBedragNaarCenten("1,5")).toBe(150);
  });

  it("ziet een punt met drie cijfers erachter als duizendtal", () => {
    expect(parseerBedragNaarCenten("1.234")).toBe(123_400);
    expect(parseerBedragNaarCenten("9.160")).toBe(916_000);
  });

  it("leest negatieve bedragen", () => {
    expect(parseerBedragNaarCenten("-664,29")).toBe(-66_429);
  });

  it("geeft null bij onleesbare invoer", () => {
    expect(parseerBedragNaarCenten("")).toBeNull();
    expect(parseerBedragNaarCenten("   ")).toBeNull();
    expect(parseerBedragNaarCenten("abc")).toBeNull();
    expect(parseerBedragNaarCenten("12,34,56,78x")).toBeNull();
  });

  it("is het omgekeerde van centenNaarInvoer", () => {
    for (const centen of [0, 5, 150, 11_625, 123_456, -66_429]) {
      expect(parseerBedragNaarCenten(centenNaarInvoer(centen))).toBe(centen);
    }
  });
});

describe("verdeelCenten", () => {
  it("verdeelt zonder centen kwijt te raken", () => {
    const delen = verdeelCenten(100, [1, 1, 1]);
    expect(delen.reduce((som, deel) => som + deel, 0)).toBe(100);
    expect(delen).toEqual([34, 33, 33]);
  });

  it("verdeelt de jaarbijdrage over zestien verenigingen", () => {
    const delen = verdeelCenten(186_000, Array.from({ length: 16 }, () => 1));
    expect(delen.every((deel) => deel === 11_625)).toBe(true);
    expect(delen.reduce((som, deel) => som + deel, 0)).toBe(186_000);
  });

  it("houdt rekening met gewichten", () => {
    const delen = verdeelCenten(1000, [3, 1]);
    expect(delen).toEqual([750, 250]);
  });

  it("blijft sluitend bij lastige verhoudingen", () => {
    const gewichten = [7, 3, 11, 1];
    const delen = verdeelCenten(100_001, gewichten);
    expect(delen.reduce((som, deel) => som + deel, 0)).toBe(100_001);
  });

  it("geeft nul terug zonder gewicht", () => {
    expect(verdeelCenten(1000, [0, 0])).toEqual([0, 0]);
    expect(verdeelCenten(1000, [])).toEqual([]);
  });
});

describe("deelNaarBoven", () => {
  it("rondt naar boven af zodat de kosten gedekt zijn", () => {
    expect(deelNaarBoven(100_001, 3)).toBe(33_334);
    expect(deelNaarBoven(100_000, 80)).toBe(1250);
    expect(deelNaarBoven(0, 10)).toBe(0);
  });

  it("geeft nul bij een deler van nul", () => {
    expect(deelNaarBoven(1000, 0)).toBe(0);
  });
});
