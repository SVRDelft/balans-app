import { describe, expect, it } from "vitest";

import { berekenBalans, type BalansInvoer } from "./balans";
import {
  mutatieVanPost,
  rekenVoorraadToe,
  type VoorraadpostToerekening,
} from "./voorraadtoerekening";

function post(
  overschrijf: Partial<VoorraadpostToerekening> = {},
): VoorraadpostToerekening {
  return {
    begrotingspostId: "dassen",
    beginAantal: 10,
    beginWaardePerStukCenten: 500,
    aantal: 10,
    waardePerStukCenten: 500,
    ...overschrijf,
  };
}

const UITGAVENPOSTEN = new Set(["dassen", "kantoor"]);

describe("mutatieVanPost", () => {
  it("is nul zolang er niets verbruikt is", () => {
    expect(mutatieVanPost(post())).toBe(0);
  });

  it("is negatief als er spullen weggaan", () => {
    // Twee dassen van € 5,00 weggegeven.
    expect(mutatieVanPost(post({ aantal: 8 }))).toBe(-1000);
  });

  it("is positief als er spullen bij komen", () => {
    expect(mutatieVanPost(post({ aantal: 30 }))).toBe(10_000);
  });
});

describe("rekenVoorraadToe", () => {
  it("boekt verbruik als kosten op de gekoppelde begrotingspost", () => {
    const { kostenPerBegrotingspost, buitenPostenCenten } = rekenVoorraadToe(
      [post({ aantal: 8 })],
      UITGAVENPOSTEN,
    );

    // Verbruik van € 10,00 wordt € 10,00 aan kosten, dus het teken draait om.
    expect(kostenPerBegrotingspost.get("dassen")).toBe(1000);
    expect(buitenPostenCenten).toBe(0);
  });

  it("laat een aankoop de kosten juist verlagen", () => {
    // Inkoop hoort geen kostenpost te zijn: je ruilt geld voor spullen. De
    // uitgave staat al bij Uitgaven, dus de voorraadgroei haalt hem er weer af.
    const { kostenPerBegrotingspost } = rekenVoorraadToe(
      [post({ aantal: 30 })],
      UITGAVENPOSTEN,
    );

    expect(kostenPerBegrotingspost.get("dassen")).toBe(-10_000);
  });

  it("telt meerdere posten op dezelfde begrotingspost bij elkaar op", () => {
    const { kostenPerBegrotingspost } = rekenVoorraadToe(
      [post({ aantal: 8 }), post({ aantal: 9 })],
      UITGAVENPOSTEN,
    );

    expect(kostenPerBegrotingspost.get("dassen")).toBe(1500);
  });

  it("houdt spullen zonder begrotingspost apart", () => {
    const { kostenPerBegrotingspost, buitenPostenCenten } = rekenVoorraadToe(
      [post({ begrotingspostId: null, aantal: 8 })],
      UITGAVENPOSTEN,
    );

    expect(kostenPerBegrotingspost.size).toBe(0);
    expect(buitenPostenCenten).toBe(-1000);
  });

  it("negeert een koppeling aan een post die geen uitgavenpost is", () => {
    const { kostenPerBegrotingspost, buitenPostenCenten } = rekenVoorraadToe(
      [post({ begrotingspostId: "bijdrage", aantal: 8 })],
      UITGAVENPOSTEN,
    );

    expect(kostenPerBegrotingspost.size).toBe(0);
    expect(buitenPostenCenten).toBe(-1000);
  });
});

describe("samenspel met de balans", () => {
  const BASIS: BalansInvoer = {
    beginsaldoBankCenten: 100_000,
    beginsaldoEigenVermogenCenten: 105_000,
    ontvangenBetalingenCenten: 0,
    betaaldeUitgavenCenten: 0,
    debiteurenCenten: 0,
    crediteurenCenten: 0,
    gerealiseerdeInkomstenCenten: 0,
    gerealiseerdeUitgavenCenten: 0,
    voorraadBeginCenten: 5000,
    voorraadCenten: 5000,
    ingevoerdBanksaldoCenten: null,
  };

  it("telt verbruik één keer, niet twee keer", () => {
    // Twee dassen van € 5,00 verbruikt. Dat staat nu als € 10,00 kosten op de
    // begrotingspost, dus het mag er niet nog eens als mutatie bij.
    const balans = berekenBalans({
      ...BASIS,
      voorraadCenten: 4000,
      gerealiseerdeUitgavenCenten: 1000,
      voorraadMutatieBuitenPostenCenten: 0,
    });

    expect(balans.resultaatCenten).toBe(-1000);
    expect(balans.balansverschilCenten).toBe(0);
  });

  it("komt op hetzelfde resultaat uit als zonder koppeling", () => {
    const metKoppeling = berekenBalans({
      ...BASIS,
      voorraadCenten: 4000,
      gerealiseerdeUitgavenCenten: 1000,
      voorraadMutatieBuitenPostenCenten: 0,
    });

    const zonderKoppeling = berekenBalans({
      ...BASIS,
      voorraadCenten: 4000,
      gerealiseerdeUitgavenCenten: 0,
    });

    expect(metKoppeling.resultaatCenten).toBe(zonderKoppeling.resultaatCenten);
    expect(metKoppeling.totaalActivaCenten).toBe(
      zonderKoppeling.totaalActivaCenten,
    );
    expect(zonderKoppeling.balansverschilCenten).toBe(0);
  });

  it("laat een aankoop het resultaat niet raken", () => {
    // Uitgave van € 100,00 aan nieuwe dassen, voorraad stijgt met € 100,00.
    const balans = berekenBalans({
      ...BASIS,
      beginsaldoBankCenten: 100_000,
      betaaldeUitgavenCenten: 10_000,
      voorraadCenten: 15_000,
      // 100,00 uitgave min 100,00 voorraadgroei op dezelfde post.
      gerealiseerdeUitgavenCenten: 0,
      voorraadMutatieBuitenPostenCenten: 0,
    });

    expect(balans.resultaatCenten).toBe(0);
    expect(balans.balansverschilCenten).toBe(0);
  });
});
