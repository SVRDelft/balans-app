import { describe, expect, it } from "vitest";

import {
  bepaalFactuurStatus,
  isTeveelBetaald,
  openstaandBedrag,
} from "./factuurstatus";

describe("bepaalFactuurStatus", () => {
  it("blijft verstuurd zolang er niets betaald is", () => {
    expect(
      bepaalFactuurStatus({
        huidigeStatus: "verstuurd",
        totaalCenten: 11_625,
        betaaldCenten: 0,
      }),
    ).toBe("verstuurd");
  });

  it("wordt deels betaald bij een gedeeltelijke betaling", () => {
    expect(
      bepaalFactuurStatus({
        huidigeStatus: "verstuurd",
        totaalCenten: 11_625,
        betaaldCenten: 5000,
      }),
    ).toBe("deels_betaald");
  });

  it("wordt betaald zodra de som van de betalingen het totaal dekt", () => {
    expect(
      bepaalFactuurStatus({
        huidigeStatus: "deels_betaald",
        totaalCenten: 11_625,
        betaaldCenten: 11_625,
      }),
    ).toBe("betaald");
  });

  it("telt meerdere deelbetalingen bij elkaar op", () => {
    const betalingen = [5000, 5000, 1625];
    const betaald = betalingen.reduce((som, bedrag) => som + bedrag, 0);
    expect(
      bepaalFactuurStatus({
        huidigeStatus: "verstuurd",
        totaalCenten: 11_625,
        betaaldCenten: betaald,
      }),
    ).toBe("betaald");
  });

  it("valt terug naar deels betaald als een betaling wordt verwijderd", () => {
    expect(
      bepaalFactuurStatus({
        huidigeStatus: "betaald",
        totaalCenten: 11_625,
        betaaldCenten: 5000,
      }),
    ).toBe("deels_betaald");
  });

  it("blijft betaald bij te veel ontvangen geld", () => {
    expect(
      bepaalFactuurStatus({
        huidigeStatus: "verstuurd",
        totaalCenten: 11_625,
        betaaldCenten: 12_000,
      }),
    ).toBe("betaald");
  });

  it("raakt een concept niet aan", () => {
    expect(
      bepaalFactuurStatus({
        huidigeStatus: "concept",
        totaalCenten: 11_625,
        betaaldCenten: 11_625,
      }),
    ).toBe("concept");
  });

  it("draait oninbaar en gecrediteerd niet vanzelf terug", () => {
    expect(
      bepaalFactuurStatus({
        huidigeStatus: "oninbaar",
        totaalCenten: 11_625,
        betaaldCenten: 0,
      }),
    ).toBe("oninbaar");

    expect(
      bepaalFactuurStatus({
        huidigeStatus: "gecrediteerd",
        totaalCenten: 11_625,
        betaaldCenten: 0,
      }),
    ).toBe("gecrediteerd");
  });

  it("handelt een creditfactuur af zodra het bedrag is terugbetaald", () => {
    expect(
      bepaalFactuurStatus({
        huidigeStatus: "verstuurd",
        totaalCenten: -11_625,
        betaaldCenten: -5000,
      }),
    ).toBe("deels_betaald");

    expect(
      bepaalFactuurStatus({
        huidigeStatus: "verstuurd",
        totaalCenten: -11_625,
        betaaldCenten: -11_625,
      }),
    ).toBe("betaald");
  });
});

describe("openstaandBedrag", () => {
  it("geeft wat er nog binnen moet komen", () => {
    expect(openstaandBedrag(11_625, 5000)).toBe(6625);
    expect(openstaandBedrag(11_625, 11_625)).toBe(0);
  });

  it("wordt niet negatief bij te veel betaald", () => {
    expect(openstaandBedrag(11_625, 12_000)).toBe(0);
  });

  it("werkt ook voor creditfacturen", () => {
    expect(openstaandBedrag(-11_625, 0)).toBe(-11_625);
    expect(openstaandBedrag(-11_625, -11_625)).toBe(0);
  });
});

describe("isTeveelBetaald", () => {
  it("herkent een te hoge betaling", () => {
    expect(isTeveelBetaald(11_625, 12_000)).toBe(true);
    expect(isTeveelBetaald(11_625, 11_625)).toBe(false);
    expect(isTeveelBetaald(-11_625, -12_000)).toBe(true);
  });
});
