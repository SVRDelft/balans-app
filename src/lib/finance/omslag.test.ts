import { describe, expect, it } from "vitest";

import {
  bepaalBlokkades,
  bepaalTeVerdelenUitgaven,
  berekenAfstemming,
  berekenDeelnemerBedragen,
  berekenOmslag,
  telAangemeld,
  telBevestigd,
  type OmslagDeelnemer,
  type OmslagUitgave,
} from "./omslag";

function deelnemer(
  overschrijf: Partial<OmslagDeelnemer> & { id: string },
): OmslagDeelnemer {
  return {
    naam: overschrijf.id,
    aantalPersonen: 1,
    aangemeld: true,
    bevestigdBetalend: true,
    ...overschrijf,
  };
}

function uitgave(
  overschrijf: Partial<OmslagUitgave> & { id: string; bedragCenten: number },
): OmslagUitgave {
  return {
    omschrijving: overschrijf.id,
    bedragDefinitief: true,
    tenLasteVanSvr: false,
    omslagrondeId: null,
    ...overschrijf,
  };
}

describe("tellen van deelnemers", () => {
  const deelnemers = [
    deelnemer({ id: "TG", aantalPersonen: 10, bevestigdBetalend: true }),
    deelnemer({ id: "VSV", aantalPersonen: 8, bevestigdBetalend: false }),
    deelnemer({ id: "Stylos", aantalPersonen: 6, bevestigdBetalend: true }),
    deelnemer({
      id: "Afmelding",
      aantalPersonen: 2,
      aangemeld: false,
      bevestigdBetalend: false,
    }),
  ];

  it("telt personen en niet regels", () => {
    expect(telAangemeld(deelnemers)).toBe(24);
    expect(telBevestigd(deelnemers)).toBe(16);
  });
});

describe("berekenOmslag", () => {
  it("deelt door het aantal bevestigd betalenden, niet door het aantal aangemelden", () => {
    const uitkomst = berekenOmslag({
      totaalKostenCenten: 100_000,
      aantalAangemeld: 100,
      aantalBevestigd: 80,
    });

    expect(uitkomst.kostprijsPerPersoonCenten).toBe(1250);
    expect(uitkomst.prijsPerPersoonCenten).toBe(1250);
    expect(uitkomst.totaalGefactureerdCenten).toBe(100_000);
    expect(uitkomst.dekkingsverschilCenten).toBe(0);
  });

  it("dekt de kosten ook als de deling niet opgaat", () => {
    const uitkomst = berekenOmslag({
      totaalKostenCenten: 100_001,
      aantalAangemeld: 3,
      aantalBevestigd: 3,
    });

    // Naar boven afgerond, dus nooit te weinig binnengehaald.
    expect(uitkomst.kostprijsPerPersoonCenten).toBe(33_334);
    expect(uitkomst.totaalGefactureerdCenten).toBe(100_002);
    expect(uitkomst.dekkingsverschilCenten).toBe(1);
    expect(
      Math.abs(uitkomst.dekkingsverschilCenten),
    ).toBeLessThanOrEqual(uitkomst.afrondingsruimteCenten);
  });

  it("laat zien wat delen door het aantal aangemelden gekost zou hebben", () => {
    // De fout uit boekjaar 2025-2026: 195 aangemeld, 181 daadwerkelijk betaald.
    const uitkomst = berekenOmslag({
      totaalKostenCenten: 804_265,
      aantalAangemeld: 195,
      aantalBevestigd: 181,
    });

    expect(uitkomst.verschilAantal).toBe(14);
    expect(uitkomst.prijsPerPersoonCenten).toBe(4444);
    expect(uitkomst.prijsBijAangemeldCenten).toBe(4125);

    // Het verlies dat zo zou ontstaan, ligt rond de 577 euro.
    expect(uitkomst.tekortBijAangemeldCenten).toBeGreaterThan(55_000);
    expect(uitkomst.tekortBijAangemeldCenten).toBeLessThan(60_000);

    // De juiste berekening dekt de kosten wél.
    expect(uitkomst.totaalGefactureerdCenten).toBeGreaterThanOrEqual(
      uitkomst.totaalKostenCenten,
    );
  });

  it("geeft geen tekort als iedereen betaalt", () => {
    const uitkomst = berekenOmslag({
      totaalKostenCenten: 50_000,
      aantalAangemeld: 40,
      aantalBevestigd: 40,
    });
    expect(uitkomst.tekortBijAangemeldCenten).toBe(0);
  });

  it("accepteert een hogere prijs maar nooit een lagere dan de kostprijs", () => {
    const hoger = berekenOmslag({
      totaalKostenCenten: 100_000,
      aantalAangemeld: 80,
      aantalBevestigd: 80,
      prijsPerPersoonCenten: 1500,
    });
    expect(hoger.prijsPerPersoonCenten).toBe(1500);
    expect(hoger.dekkingsverschilCenten).toBe(20_000);

    const teLaag = berekenOmslag({
      totaalKostenCenten: 100_000,
      aantalAangemeld: 80,
      aantalBevestigd: 80,
      prijsPerPersoonCenten: 1000,
    });
    expect(teLaag.prijsPerPersoonCenten).toBe(1250);
  });
});

describe("berekenDeelnemerBedragen", () => {
  it("factureert per persoon en slaat niet-bevestigde deelnemers over", () => {
    const bedragen = berekenDeelnemerBedragen(
      [
        deelnemer({ id: "TG", aantalPersonen: 10 }),
        deelnemer({ id: "VSV", aantalPersonen: 8, bevestigdBetalend: false }),
        deelnemer({ id: "Jan", aantalPersonen: 1 }),
      ],
      4444,
    );

    expect(bedragen).toHaveLength(2);
    expect(bedragen[0]).toMatchObject({ naam: "TG", bedragCenten: 44_440 });
    expect(bedragen[1]).toMatchObject({ naam: "Jan", bedragCenten: 4444 });
  });

  it("de som van de facturen is precies prijs maal aantal personen", () => {
    const deelnemers = [
      deelnemer({ id: "a", aantalPersonen: 7 }),
      deelnemer({ id: "b", aantalPersonen: 3 }),
      deelnemer({ id: "c", aantalPersonen: 11 }),
    ];
    const prijs = 1234;
    const som = berekenDeelnemerBedragen(deelnemers, prijs).reduce(
      (totaal, regel) => totaal + regel.bedragCenten,
      0,
    );
    expect(som).toBe(prijs * telBevestigd(deelnemers));
  });
});

describe("bepaalBlokkades", () => {
  const basis = {
    evenementStatus: "open",
    heeftOpbrengstpost: true,
    deelnemers: [deelnemer({ id: "TG", aantalPersonen: 10 })],
    teVerdelenUitgaven: [uitgave({ id: "zaal", bedragCenten: 50_000 })],
  };

  it("laat rekenen toe als alles klaar is", () => {
    expect(bepaalBlokkades(basis)).toEqual([]);
  });

  it("blokkeert zolang een bedrag nog niet definitief is", () => {
    // De eindafrekening van een open bar komt weken later binnen.
    const blokkades = bepaalBlokkades({
      ...basis,
      teVerdelenUitgaven: [
        uitgave({ id: "zaal", bedragCenten: 50_000 }),
        uitgave({ id: "bar", bedragCenten: 0, bedragDefinitief: false }),
      ],
    });

    expect(blokkades.map((blokkade) => blokkade.code)).toContain(
      "niet_definitieve_uitgaven",
    );
  });

  it("blokkeert zonder bevestigd betalende deelnemers", () => {
    const blokkades = bepaalBlokkades({
      ...basis,
      deelnemers: [deelnemer({ id: "TG", bevestigdBetalend: false })],
    });
    expect(blokkades.map((blokkade) => blokkade.code)).toContain(
      "geen_bevestigde_deelnemers",
    );
  });

  it("blokkeert zonder opbrengstpost en bij een afgesloten evenement", () => {
    expect(
      bepaalBlokkades({ ...basis, heeftOpbrengstpost: false }).map((b) => b.code),
    ).toContain("geen_opbrengstpost");

    expect(
      bepaalBlokkades({ ...basis, evenementStatus: "afgesloten" }).map(
        (b) => b.code,
      ),
    ).toContain("evenement_afgesloten");
  });

  it("blokkeert een prijs onder de kostprijs", () => {
    const blokkades = bepaalBlokkades({ ...basis, prijsPerPersoonCenten: 1 });
    expect(blokkades.map((blokkade) => blokkade.code)).toContain(
      "prijs_onder_kostprijs",
    );
  });
});

describe("bepaalTeVerdelenUitgaven", () => {
  it("laat verdeelde uitgaven en bewuste SVR-kosten buiten beschouwing", () => {
    const teVerdelen = bepaalTeVerdelenUitgaven([
      uitgave({ id: "nieuw", bedragCenten: 100 }),
      uitgave({ id: "al-verdeeld", bedragCenten: 100, omslagrondeId: "r1" }),
      uitgave({ id: "svr", bedragCenten: 100, tenLasteVanSvr: true }),
    ]);

    expect(teVerdelen.map((item) => item.id)).toEqual(["nieuw"]);
  });
});

describe("berekenAfstemming", () => {
  it("komt op nul uit als alles verdeeld, gefactureerd en ontvangen is", () => {
    const afstemming = berekenAfstemming({
      totaleKostenCenten: 100_000,
      tenLasteVanSvrCenten: 0,
      nogNietVerdeeldCenten: 0,
      conceptCenten: 0,
      gefactureerdCenten: 100_000,
      ontvangenCenten: 100_000,
      aantalBevestigd: 80,
    });

    expect(afstemming.dekkingsverschilCenten).toBe(0);
    expect(afstemming.nogTeOntvangenCenten).toBe(0);
    expect(afstemming.resultaatCenten).toBe(0);
    expect(afstemming.klopt).toBe(true);
  });

  it("signaleert kosten die na de omslag binnenkwamen", () => {
    // De tweede fout uit 2025-2026: 236,50 euro aan facturen viel buiten de
    // evenementenadministratie en is nooit doorbelast.
    const afstemming = berekenAfstemming({
      totaleKostenCenten: 123_650,
      tenLasteVanSvrCenten: 0,
      nogNietVerdeeldCenten: 23_650,
      conceptCenten: 0,
      gefactureerdCenten: 100_000,
      ontvangenCenten: 100_000,
      aantalBevestigd: 80,
    });

    expect(afstemming.dekkingsverschilCenten).toBe(-23_650);
    expect(afstemming.resultaatCenten).toBe(-23_650);
    expect(afstemming.klopt).toBe(false);
  });

  it("boekt bewust overgenomen kosten als verlies van de SVR maar houdt de dekking sluitend", () => {
    const afstemming = berekenAfstemming({
      totaleKostenCenten: 123_650,
      tenLasteVanSvrCenten: 23_650,
      nogNietVerdeeldCenten: 0,
      conceptCenten: 0,
      gefactureerdCenten: 100_000,
      ontvangenCenten: 100_000,
      aantalBevestigd: 80,
    });

    expect(afstemming.dekkingsverschilCenten).toBe(0);
    expect(afstemming.resultaatCenten).toBe(-23_650);
    expect(afstemming.klopt).toBe(true);
  });

  it("laat openstaande facturen zien", () => {
    const afstemming = berekenAfstemming({
      totaleKostenCenten: 100_000,
      tenLasteVanSvrCenten: 0,
      nogNietVerdeeldCenten: 0,
      conceptCenten: 0,
      gefactureerdCenten: 100_000,
      ontvangenCenten: 60_000,
      aantalBevestigd: 80,
    });

    expect(afstemming.nogTeOntvangenCenten).toBe(40_000);
  });

  it("rekent net berekende concepten mee als doorbelast", () => {
    // Direct na het berekenen van de omslag staan alle facturen nog op concept.
    // De kosten zijn dan wel degelijk verdeeld; alleen versturen moet nog.
    const afstemming = berekenAfstemming({
      totaleKostenCenten: 700_000,
      tenLasteVanSvrCenten: 0,
      nogNietVerdeeldCenten: 0,
      conceptCenten: 700_108,
      gefactureerdCenten: 700_108,
      ontvangenCenten: 0,
      aantalBevestigd: 181,
    });

    expect(afstemming.dekkingsverschilCenten).toBe(108);
    expect(afstemming.binnenAfronding).toBe(true);
    expect(afstemming.klopt).toBe(true);
    expect(afstemming.conceptCenten).toBe(700_108);
  });
});
