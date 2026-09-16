import { describe, expect, it } from "vitest";
import {
  factuurOpenstaand,
  factuurRealisatie,
  factuurStandStatus,
  factuurRegelRealisaties,
} from "./factuurstanden";

const origineel = (ontvangen = 0) => ({
  status: "gecrediteerd",
  totaalCenten: 10000,
  betalingen: [{ bedragCenten: ontvangen }],
});
const credit = (terugbetaald = 0) => ({
  status: "verstuurd",
  totaalCenten: -10000,
  betalingen: [{ bedragCenten: -terugbetaald }],
});
describe("Factuur, credit en bank sluiten aan", () => {
  it.each([0, 3000, 10000, 12000])(
    "houdt bij %i ontvangen alleen de terugbetaling open",
    (ontvangen) => {
      const f = { ...origineel(ontvangen), creditfactuur: credit() };
      const c = { ...credit(), crediteertFactuur: origineel(ontvangen) };
      expect(factuurRealisatie(f) + factuurRealisatie(c)).toBe(0);
      expect(factuurOpenstaand(f)).toBe(0);
      expect(factuurOpenstaand(c)).toBe(ontvangen === 0 ? 0 : -ontvangen);
      expect(ontvangen + factuurOpenstaand(f) + factuurOpenstaand(c)).toBe(0);
    },
  );
  it("verwerkt de terugbetaling zonder nogmaals inkomsten af te trekken", () => {
    expect(
      factuurOpenstaand({
        ...credit(3000),
        crediteertFactuur: origineel(3000),
      }),
    ).toBe(0);
  });
  it("een conceptcredit wijzigt de openstaande vordering nog niet", () => {
    expect(
      factuurOpenstaand({
        ...origineel(),
        creditfactuur: { ...credit(), status: "concept" },
      }),
    ).toBe(10000);
  });
  it("schrijft bij oninbaar alleen het onbetaalde deel af", () => {
    const f = { ...origineel(3000), status: "oninbaar" };
    expect(factuurRealisatie(f)).toBe(3000);
    expect(factuurOpenstaand(f)).toBe(0);
  });
  it("houdt een te hoge betaling zichtbaar", () => {
    expect(factuurOpenstaand({ ...origineel(12000), status: "betaald" })).toBe(
      -2000,
    );
  });
});

describe("gedeeltelijke credit en afboeken", () => {
  const paar = (ontvangen: number, terugbetaald = 0, status = "verstuurd") => {
    const f = { ...origineel(ontvangen), status };
    const c = { ...credit(terugbetaald), totaalCenten: -2000 };
    return [
      { ...f, creditfactuur: c },
      { ...c, crediteertFactuur: f },
    ] as const;
  };

  it.each([
    [0, 8000, "verstuurd"],
    [3000, 5000, "deels_betaald"],
    [8000, 0, "betaald"],
    [10000, 0, "betaald"],
  ])(
    "houdt het restant na %i ontvangen betaalbaar",
    (ontvangen, openstaand, status) => {
      const [f, c] = paar(ontvangen as number);
      expect(factuurStandStatus(f)).toBe(status);
      expect(factuurOpenstaand(f)).toBe(openstaand);
      expect(factuurOpenstaand(c)).toBe(Math.min(0, 8000 - Number(ontvangen)));
      expect(
        Number(ontvangen) + factuurOpenstaand(f) + factuurOpenstaand(c),
      ).toBe(8000);
    },
  );

  it.each([0, 3000, 8000, 10000, 12000])(
    "laat bank, openstaande bedragen en resultaat aansluiten na afboeken met %i ontvangen",
    (ontvangen) => {
      const [f, c] = paar(ontvangen, 0, "oninbaar");
      const resultaat = factuurRealisatie(f) + factuurRealisatie(c);
      expect(resultaat).toBe(Math.min(8000, ontvangen));
      expect(factuurOpenstaand(f)).toBe(0);
      expect(ontvangen + factuurOpenstaand(f) + factuurOpenstaand(c)).toBe(
        resultaat,
      );
    },
  );

  it("verwerkt ook een terugbetaling na een gedeeltelijke credit en afboeking", () => {
    const [f, c] = paar(10000, 2000, "oninbaar");
    expect(factuurOpenstaand(f) + factuurOpenstaand(c)).toBe(0);
    expect(factuurRealisatie(f) + factuurRealisatie(c)).toBe(8000);
    expect(factuurStandStatus(c)).toBe("betaald");
  });

  it("houdt overbetaling na afboeken zichtbaar zonder extra opbrengst", () => {
    const f = { ...origineel(12000), status: "oninbaar" };
    expect(factuurRealisatie(f)).toBe(10000);
    expect(factuurOpenstaand(f)).toBe(-2000);
    expect(12000 + factuurOpenstaand(f)).toBe(factuurRealisatie(f));
  });

  it("herstel van oninbaar heropent alleen het bedrag na de credit", () => {
    const [f] = paar(3000, 0, "oninbaar");
    const hersteld = { ...f, status: "verstuurd" };
    expect(factuurStandStatus(hersteld)).toBe("deels_betaald");
    expect(factuurOpenstaand(hersteld)).toBe(5000);
    expect(factuurRealisatie(hersteld)).toBe(10000);
  });

  it("sluit een volledige credit en herstelt oude gecrediteerd-statussen zonder verstuurde credit", () => {
    expect(
      factuurStandStatus({ ...origineel(3000), creditfactuur: credit() }),
    ).toBe("gecrediteerd");
    expect(
      factuurStandStatus({
        ...origineel(3000),
        creditfactuur: { ...credit(), status: "concept" },
      }),
    ).toBe("deels_betaald");
    expect(factuurStandStatus(origineel())).toBe("verstuurd");
  });
});

describe("realisatie op getekende factuurregels", () => {
  const afgeschreven = (totaalCenten: number, ontvangen: number) => ({
    status: "oninbaar",
    totaalCenten,
    betalingen: [{ bedragCenten: ontvangen }],
  });

  it("behoudt het negatieve teken van korting op een andere begrotingspost", () => {
    expect(
      factuurRegelRealisaties(afgeschreven(10000, 5000), [20000, -10000]),
    ).toEqual([10000, -5000]);
  });

  it.each([
    [[101, -1], 33],
    [[101, 100, -100], 50],
    [[1, 1, 1], 1],
    [[2147483647, -147483647], 1999999999],
  ] as const)(
    "verdeelt centen exact over %j bij %i ontvangen",
    (regels, ontvangen) => {
      const totaal = regels.reduce((som: number, bedrag) => som + bedrag, 0);
      const bedragen = factuurRegelRealisaties(
        afgeschreven(totaal, ontvangen),
        regels,
      );
      expect(bedragen.reduce((som, bedrag) => som + bedrag, 0)).toBe(ontvangen);
      for (let i = 0; i < regels.length; i++) {
        expect(Number.isInteger(bedragen[i])).toBe(true);
        expect(
          Math.abs(bedragen[i] - (ontvangen * regels[i]) / totaal),
        ).toBeLessThan(1.000001);
      }
    },
  );

  it("boekt bij nul ontvangen alle regels af, en telt concepten niet mee", () => {
    expect(
      factuurRegelRealisaties(afgeschreven(10000, 0), [20000, -10000]),
    ).toEqual([0, 0]);
    expect(
      factuurRegelRealisaties(
        { ...origineel(), status: "concept" },
        [20000, -10000],
      ),
    ).toEqual([0, 0]);
  });

  it("laat regels van verstuurde facturen en credits intact", () => {
    expect(factuurRegelRealisaties(origineel(), [20000, -10000])).toEqual([
      20000, -10000,
    ]);
    expect(factuurRegelRealisaties(credit(), [-20000, 10000])).toEqual([
      -20000, 10000,
    ]);
  });
});
