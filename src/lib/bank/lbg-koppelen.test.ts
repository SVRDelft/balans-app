import { describe, expect, it } from "vitest";

import { bankVoorstellen, naamStaatIn, zoekBankVoorstel, type FactuurKeuze } from "./koppelen";

const datum = new Date("2026-09-15T00:00:00Z");

describe("LBG: vijftien facturen van hetzelfde bedrag, tien betalen", () => {
  const namen = ["TG", "VvTP", "Variscopic", "Froude", "ETV", "PS", "LIFE", "Curius", "CH", "ID", "VSV", "Stylos", "MV", "Hooke", "Leeghwater"];
  const lbg: FactuurKeuze[] = namen.map((naam, i) => ({
    id: naam,
    nummer: `SVR62-2026-${String(i + 20).padStart(4, "0")}`,
    relatieNaam: naam,
    iban: "",
    openstaandCenten: 44440,
    status: "verstuurd",
  }));
  const betaler = (naam: string, i: number) => ({
    id: `bank-${i}`,
    datum,
    bedragCenten: 44440,
    omschrijving: `LBG 2027 ${naam}`,
    tegenpartijNaam: `Studievereniging ${naam}`,
    tegenpartijIban: `NL00TEST${String(i).padStart(10, "0")}`,
  });

  it("koppelt elke betaling aan de factuur van de juiste vereniging", () => {
    const betalers = namen.slice(0, 10);
    const voorstellen = bankVoorstellen(betalers.map(betaler), lbg, [], []);
    expect(voorstellen.size).toBe(10);
    betalers.forEach((naam, i) => {
      expect(voorstellen.get(`bank-${i}`)).toMatchObject({ waarde: `factuur:${naam}`, zekerheid: "naam" });
    });
  });

  it("gokt niet als de naam ontbreekt en het bedrag bij meerdere facturen past", () => {
    const regel = { datum, bedragCenten: 44440, omschrijving: "LBG", tegenpartijNaam: "J. Jansen", tegenpartijIban: "" };
    expect(zoekBankVoorstel(regel, lbg, [], [])).toBeUndefined();
  });

  it("koppelt niet als het bedrag niet exact het openstaande bedrag is", () => {
    expect(zoekBankVoorstel({ ...betaler("TG", 0), bedragCenten: 40000 }, lbg, [], [])).toBeUndefined();
  });

  it("gokt niet als twee verenigingen genoemd worden", () => {
    const regel = { ...betaler("TG", 0), omschrijving: "LBG TG en PS", tegenpartijNaam: "" };
    expect(zoekBankVoorstel(regel, lbg, [], [])).toBeUndefined();
  });

  it("herkent een vereniging aan een geleerd rekeningnummer als zeker", () => {
    const metIban = lbg.map((f) => (f.id === "TG" ? { ...f, iban: "NL00TEST0000000000" } : f));
    const regel = { ...betaler("TG", 0), omschrijving: "bijdrage", tegenpartijNaam: "Penningmeester" };
    expect(zoekBankVoorstel(regel, metIban, [], [])).toMatchObject({ waarde: "factuur:TG", zekerheid: "zeker" });
  });

  it("laat een zeker voorstel voorgaan op een twijfelgeval voor dezelfde factuur", () => {
    const regels = [
      { id: "twijfel", datum, bedragCenten: 44440, omschrijving: "onbekend", tegenpartijNaam: "", tegenpartijIban: "" },
      { id: "zeker", datum, bedragCenten: 44440, omschrijving: "Betaling SVR62-2026-0020", tegenpartijNaam: "", tegenpartijIban: "" },
    ];
    const voorstellen = bankVoorstellen(regels, [lbg[0]], [], []);
    expect(voorstellen.get("zeker")?.zekerheid).toBe("zeker");
    expect(voorstellen.has("twijfel")).toBe(false);
  });
});

describe("naamStaatIn", () => {
  it.each([
    ["TG", "LBG 2027 TG", true],
    ["TG", "Studievereniging TG", true],
    ["TG", "TGV reizen", false],
    ["YES!Delft", "YESDELFT BV", true],
    ["Bèta", "SV BETA", true],
    ["Studievereniging", "Studievereniging TG", false],
    ["Leeghwater", "W.V.T.P. Leeghwater", true],
  ] as const)("%s in '%s' is %s", (naam, tekst, verwacht) => {
    expect(naamStaatIn(naam, tekst)).toBe(verwacht);
  });
});
