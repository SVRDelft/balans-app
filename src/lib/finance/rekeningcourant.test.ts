import { describe, expect, it } from "vitest";

import { maakRekeningcourant, resultaatEffectCenten } from "./rekeningcourant";

const post = (
  relatieId: string,
  bedragCenten: number,
  extra: Partial<Parameters<typeof maakRekeningcourant>[0][number]> = {},
) => ({
  relatieId,
  relatieNaam: relatieId,
  relatieType: "persoon",
  datum: new Date("2026-10-01T00:00:00Z"),
  bedragCenten,
  viaBank: true,
  ...extra,
});

describe("maakRekeningcourant", () => {
  it("telt per relatie op en houdt de tekens gescheiden", () => {
    const stand = maakRekeningcourant([
      post("teun", 4_500),
      post("teun", -2_000),
      post("itai", 1_000),
      post("svr-bestuur", -3_000),
    ]);

    expect(stand.saldi.find((s) => s.relatieId === "teun")?.saldoCenten).toBe(
      2_500,
    );
    expect(stand.teVorderenCenten).toBe(3_500);
    expect(stand.teBetalenCenten).toBe(3_000);
    expect(stand.nettoCenten).toBe(500);
  });

  it("laat een relatie met saldo nul staan, zodat de geschiedenis zichtbaar blijft", () => {
    const stand = maakRekeningcourant([post("teun", 2_000), post("teun", -2_000)]);

    expect(stand.saldi).toHaveLength(1);
    expect(stand.saldi[0].saldoCenten).toBe(0);
    expect(stand.saldi[0].aantalPosten).toBe(2);
    expect(stand.teVorderenCenten).toBe(0);
  });

  it("rekent alleen de posten van dit jaar mee voor het banksaldo", () => {
    const stand = maakRekeningcourant([
      post("teun", 5_000, { eerderBoekjaar: true }),
      post("teun", -1_500),
      post("itai", 800, { viaBank: false }),
    ]);

    expect(stand.viaBankCenten).toBe(-1_500);
    expect(stand.overgenomenCenten).toBe(5_000);
    expect(stand.saldi.find((s) => s.relatieId === "teun")?.saldoCenten).toBe(
      3_500,
    );
  });

  it("zet het grootste saldo bovenaan", () => {
    const stand = maakRekeningcourant([
      post("klein", 100),
      post("groot", -9_000),
      post("midden", 500),
    ]);

    expect(stand.saldi.map((s) => s.relatieId)).toEqual([
      "groot",
      "midden",
      "klein",
    ]);
  });
});

describe("resultaatEffectCenten", () => {
  it("laat geld schuiven buiten de exploitatie", () => {
    expect(resultaatEffectCenten({ viaBank: true, bedragCenten: 5_000 })).toBe(0);
  });

  it("boekt een correctie wel op het resultaat", () => {
    expect(resultaatEffectCenten({ viaBank: false, bedragCenten: -5_000 })).toBe(
      -5_000,
    );
  });
});
