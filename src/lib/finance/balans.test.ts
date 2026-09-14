import { describe, expect, it } from "vitest";

import { berekenBalans, type BalansInvoer } from "./balans";

const LEEG: BalansInvoer = {
  beginsaldoBankCenten: 0,
  beginsaldoEigenVermogenCenten: 0,
  ontvangenBetalingenCenten: 0,
  betaaldeUitgavenCenten: 0,
  debiteurenCenten: 0,
  crediteurenCenten: 0,
  gerealiseerdeInkomstenCenten: 0,
  gerealiseerdeUitgavenCenten: 0,
  ingevoerdBanksaldoCenten: null,
};

describe("berekenBalans", () => {
  it("sluit op een leeg boekjaar", () => {
    const balans = berekenBalans(LEEG);
    expect(balans.totaalActivaCenten).toBe(0);
    expect(balans.totaalPassivaCenten).toBe(0);
    expect(balans.balansverschilCenten).toBe(0);
  });

  it("rekent het banksaldo uit de administratie", () => {
    const balans = berekenBalans({
      ...LEEG,
      beginsaldoBankCenten: 100_000,
      beginsaldoEigenVermogenCenten: 100_000,
      ontvangenBetalingenCenten: 50_000,
      betaaldeUitgavenCenten: 20_000,
      gerealiseerdeInkomstenCenten: 50_000,
      gerealiseerdeUitgavenCenten: 20_000,
    });

    expect(balans.administratiefBanksaldoCenten).toBe(130_000);
    expect(balans.resultaatCenten).toBe(30_000);
    expect(balans.balansverschilCenten).toBe(0);
  });

  it("sluit met openstaande debiteuren en crediteuren", () => {
    // Gefactureerd 186.000, waarvan 100.000 ontvangen.
    // Uitgaven 50.000, waarvan 30.000 betaald.
    const balans = berekenBalans({
      ...LEEG,
      beginsaldoBankCenten: 200_000,
      beginsaldoEigenVermogenCenten: 200_000,
      ontvangenBetalingenCenten: 100_000,
      betaaldeUitgavenCenten: 30_000,
      debiteurenCenten: 86_000,
      crediteurenCenten: 20_000,
      gerealiseerdeInkomstenCenten: 186_000,
      gerealiseerdeUitgavenCenten: 50_000,
    });

    expect(balans.administratiefBanksaldoCenten).toBe(270_000);
    expect(balans.totaalActivaCenten).toBe(356_000);
    expect(balans.resultaatCenten).toBe(136_000);
    expect(balans.totaalPassivaCenten).toBe(356_000);
    expect(balans.balansverschilCenten).toBe(0);
  });

  it("sluit ook als het beginsaldo van de bank afwijkt van het eigen vermogen", () => {
    const balans = berekenBalans({
      ...LEEG,
      beginsaldoBankCenten: 150_000,
      beginsaldoEigenVermogenCenten: 100_000,
    });

    expect(balans.beginbalansverschilCenten).toBe(50_000);
    expect(balans.balansverschilCenten).toBe(0);
  });

  it("toont het verschil tussen het ingevoerde en het administratieve banksaldo", () => {
    const balans = berekenBalans({
      ...LEEG,
      beginsaldoBankCenten: 100_000,
      beginsaldoEigenVermogenCenten: 100_000,
      ontvangenBetalingenCenten: 20_000,
      gerealiseerdeInkomstenCenten: 20_000,
      ingevoerdBanksaldoCenten: 118_000,
    });

    expect(balans.administratiefBanksaldoCenten).toBe(120_000);
    // Er staat 20 euro minder op de bank dan de administratie zegt: signaal dat
    // er iets vergeten is.
    expect(balans.bankverschilCenten).toBe(-2000);
  });

  it("geeft geen bankverschil zonder ingevoerd saldo", () => {
    expect(berekenBalans(LEEG).bankverschilCenten).toBeNull();
  });

  it("verwerkt een negatief resultaat", () => {
    // Het boekjaar 2025-2026 sloot op -664,29.
    const balans = berekenBalans({
      ...LEEG,
      beginsaldoBankCenten: 500_000,
      beginsaldoEigenVermogenCenten: 500_000,
      ontvangenBetalingenCenten: 100_000,
      betaaldeUitgavenCenten: 166_429,
      gerealiseerdeInkomstenCenten: 100_000,
      gerealiseerdeUitgavenCenten: 166_429,
    });

    expect(balans.resultaatCenten).toBe(-66_429);
    expect(balans.balansverschilCenten).toBe(0);
  });
});
