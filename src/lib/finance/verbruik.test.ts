import { describe, expect, it } from "vitest";

import { berekenVerbruik } from "./voorraad";

describe("berekenVerbruik", () => {
  it("haalt het aantal eraf en rekent de waarde uit", () => {
    // Twee dassen van € 5,00 naar het nieuwe bestuur.
    expect(
      berekenVerbruik({ aantal: 10, verbruikt: 2, waardePerStukCenten: 500 }),
    ).toEqual({ nieuwAantal: 8, waardeCenten: 1000 });
  });

  it("kan de laatste spullen afboeken", () => {
    expect(
      berekenVerbruik({ aantal: 3, verbruikt: 3, waardePerStukCenten: 250 }),
    ).toEqual({ nieuwAantal: 0, waardeCenten: 750 });
  });

  it("weigert meer te verbruiken dan er ligt", () => {
    expect(() =>
      berekenVerbruik({ aantal: 2, verbruikt: 3, waardePerStukCenten: 500 }),
    ).toThrow("Er liggen er maar 2");
  });

  it("weigert nul of een negatief aantal", () => {
    expect(() =>
      berekenVerbruik({ aantal: 10, verbruikt: 0, waardePerStukCenten: 500 }),
    ).toThrow("minstens 1");
    expect(() =>
      berekenVerbruik({ aantal: 10, verbruikt: -2, waardePerStukCenten: 500 }),
    ).toThrow("minstens 1");
  });

  it("geeft nul waarde als er geen waarde per stuk is ingevuld", () => {
    // Dan verschuift er niets op de balans; de app waarschuwt daarvoor.
    expect(
      berekenVerbruik({ aantal: 10, verbruikt: 2, waardePerStukCenten: 0 }),
    ).toEqual({ nieuwAantal: 8, waardeCenten: 0 });
  });
});
