import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { ordenRelaties, toonNaam, zonderPersonen } from "./verenigingen";

const relatie = (naam: string, type = "studievereniging") => ({ naam, type });

describe("één naam en één volgorde voor de verenigingen", () => {
  it("gebruikt de naam uit content/, hoe de relatie ook heet", () => {
    expect(toonNaam({ naam: "CH" })).toBe("Christiaan Huygens");
    expect(toonNaam({ naam: "i.d" })).toBe("ID");
    expect(toonNaam({ naam: "VSV" })).toBe("VSV 'Leonardo da Vinci'");
    expect(toonNaam({ naam: "Albert Heijn" })).toBe("Albert Heijn");
  });

  it("zet de vijftien op oprichtingsjaar, dan de rest, dan de informanten, dan personen", () => {
    const lijst = ordenRelaties([
      relatie("Jan Jansen", "persoon"),
      relatie("Bèta", "overig"),
      relatie("ORAS", "overig"),
      relatie("Variscopic"),
      relatie("Albert Heijn", "leverancier"),
      relatie("CH"),
      relatie("TG"),
      relatie("Leeghwater"),
    ]).map((r) => r.toonNaam);

    expect(lijst).toEqual([
      "Leeghwater",
      "TG",
      "Christiaan Huygens",
      "Variscopic",
      "Albert Heijn",
      "ORAS",
      "Bèta",
      "Jan Jansen",
    ]);
  });

  it("laat personen weg waar je een vereniging kiest", () => {
    expect(zonderPersonen([relatie("CH"), relatie("Jan", "persoon")]).map((r) => r.naam)).toEqual(["CH"]);
  });
});
