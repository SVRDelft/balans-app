import { describe, expect, it } from "vitest";
import { berekenVoorraad } from "./voorraad";
import { berekenBalans, type BalansInvoer } from "./balans";
import { maakExploitatie } from "./exploitatie";

const leeg: BalansInvoer = {
  beginsaldoBankCenten: 100_000,
  beginsaldoEigenVermogenCenten: 100_000,
  ontvangenBetalingenCenten: 0,
  betaaldeUitgavenCenten: 0,
  debiteurenCenten: 0,
  crediteurenCenten: 0,
  gerealiseerdeInkomstenCenten: 0,
  gerealiseerdeUitgavenCenten: 0,
  ingevoerdBanksaldoCenten: null,
};
const dassen = {
  beginAantal: 20,
  beginWaardePerStukCenten: 500,
  aantal: 12,
  waardePerStukCenten: 500,
};

describe("voorraad in de administratie", () => {
  it("geeft nul voor een lege voorraad", () => {
    expect(berekenVoorraad([])).toEqual({
      beginwaardeCenten: 0,
      waardeCenten: 0,
      mutatieCenten: 0,
    });
  });
  it("telt aantallen tegen de bijbehorende waarde op, inclusief afwaardering", () => {
    expect(
      berekenVoorraad([
        dassen,
        {
          beginAantal: 3,
          beginWaardePerStukCenten: 1000,
          aantal: 3,
          waardePerStukCenten: 600,
        },
      ]),
    ).toEqual({
      beginwaardeCenten: 13000,
      waardeCenten: 7800,
      mutatieCenten: -5200,
    });
  });
  it.each([-1, 0.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1])(
    "weigert ongeldige aantallen en waarden: %s",
    (waarde) => {
      for (const veld of Object.keys(dassen))
        expect(() =>
          berekenVoorraad([{ ...dassen, [veld]: waarde }]),
        ).toThrow();
    },
  );
  it("weigert producten en totalen die niet meer exact zijn", () => {
    expect(() =>
      berekenVoorraad([
        { ...dassen, aantal: 2, waardePerStukCenten: Number.MAX_SAFE_INTEGER },
      ]),
    ).toThrow();
    const groot = {
      ...dassen,
      aantal: 1,
      waardePerStukCenten: Number.MAX_SAFE_INTEGER,
    };
    expect(() => berekenVoorraad([groot, dassen])).toThrow();
  });
  it("behandelt overgenomen beginvoorraad als bestaand vermogen", () => {
    const balans = berekenBalans({
      ...leeg,
      beginsaldoEigenVermogenCenten: 110_000,
      voorraadBeginCenten: 10_000,
      voorraadCenten: 10_000,
    });
    expect(balans).toMatchObject({
      totaalActivaCenten: 110_000,
      resultaatCenten: 0,
      beginbalansverschilCenten: 0,
      balansverschilCenten: 0,
    });
  });
  it("rekent alleen verbruikte aankopen als kosten en corrigeert nergens dubbel", () => {
    // Koop 20 dassen van €5; er liggen er nog 12. Acht zijn verbruikt: €40 kosten.
    const voorraad = berekenVoorraad([{ ...dassen, beginAantal: 0 }]);
    const exploitatie = maakExploitatie(
      [
        {
          id: "dassen",
          code: "DAS",
          naam: "Dassen",
          categorie: "vast",
          soort: "uitgave",
          begrootCenten: 10000,
          gerealiseerdCenten: 10000,
          volgorde: 1,
        },
      ],
      voorraad.mutatieCenten,
    );
    const balans = berekenBalans({
      ...leeg,
      betaaldeUitgavenCenten: 10000,
      gerealiseerdeUitgavenCenten: exploitatie.totaalUitgavenGerealiseerdCenten,
      voorraadBeginCenten: voorraad.beginwaardeCenten,
      voorraadCenten: voorraad.waardeCenten,
      ingevoerdBanksaldoCenten: 90000,
    });
    expect(exploitatie.totaalUitgavenGerealiseerdCenten).toBe(10000);
    expect(exploitatie.eindsaldoGerealiseerdCenten).toBe(-4000);
    expect(balans).toMatchObject({
      resultaatCenten: -4000,
      voorraadCenten: 6000,
      totaalActivaCenten: 96000,
      balansverschilCenten: 0,
      bankverschilCenten: 0,
    });
  });
  it("verwerkt verbruik van beginvoorraad zonder nieuwe bankbeweging", () => {
    const balans = berekenBalans({
      ...leeg,
      beginsaldoEigenVermogenCenten: 110000,
      voorraadBeginCenten: 10000,
      voorraadCenten: 6000,
    });
    expect(balans).toMatchObject({
      administratiefBanksaldoCenten: 100000,
      resultaatCenten: -4000,
      balansverschilCenten: 0,
    });
  });
});
