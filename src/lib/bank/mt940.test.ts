import { describe, expect, it } from "vitest";
import { MT940_MAX_BYTES, MT940_MAX_TRANSACTIES, Mt940Fout, parseerMt940 } from "./mt940";

const rekening = "NL91ABNA0417164300";
const tegenrekening = "NL20INGB0001234567";
function afschrift({
  nummer = "00123/1", ref = "ABN AMRO BANK NV", account = rekening,
  begin = "C260914EUR1000,", eind = "C260915EUR1092,5",
  beginTag = "60F", eindTag = "62F", nummerTag = "28C",
  transacties = ":61:2609150915C100,N654NONREF\n:86:/TRTP/SEPA OVERBOEKING/IBAN/NL20INGB0001234567/BIC/INGBNL2A/NAME/Vereniging Bèta/REMI/Factuur SVR-2026-001/EREF/REF-100\n:61:2609150915D7,5N192NONREF\n:86:Kosten betaalrekening\nseptember 2026",
} = {}) {
  return `:20:${ref}\n:25:${account}\n:${nummerTag}:${nummer}\n:${beginTag}:${begin}\n${transacties ? `${transacties}\n` : ""}:${eindTag}:${eind}`;
}
const swift = (bericht: string) => `{1:F01ABNANL2AXXXX0000000000}{2:O9400000000000ABNANL2AXXXX00000000000000000000N}{3:}{4:\n${bericht}\n-}{5:}`;

describe("ABN AMRO MT940", () => {
  it("leest echte ABN-notaties met lege decimalen, één decimaal en ontbrekende bankreferentie", () => {
    const resultaat = parseerMt940(afschrift());
    expect(resultaat.rekening).toBe(rekening);
    expect(resultaat.valuta).toBe("EUR");
    expect(resultaat.afschriften).toHaveLength(1);
    expect(resultaat.afschriften[0]).toMatchObject({ beginSaldoCenten: 100000, eindSaldoCenten: 109250, beginDatum: "2026-09-14", eindDatum: "2026-09-15" });
    expect(resultaat.transacties[0]).toEqual({
      boekdatum: "2026-09-15", valutadatum: "2026-09-15", bedragCenten: 10000,
      debetCredit: "C", omschrijving: "Factuur SVR-2026-001", tegenpartijNaam: "Vereniging Bèta",
      tegenpartijIban: tegenrekening, bankReferentie: null, klantReferentie: "REF-100",
      transactieCode: "N654", afschriftNummer: "00123", afschriftVolgnummer: 1, volgnummer: 1,
      ruweInformatie: "/TRTP/SEPA OVERBOEKING/IBAN/NL20INGB0001234567/BIC/INGBNL2A/NAME/Vereniging Bèta/REMI/Factuur SVR-2026-001/EREF/REF-100",
    });
    expect(resultaat.transacties[1]).toMatchObject({ bedragCenten: -750, omschrijving: "Kosten betaalrekening september 2026", bankReferentie: null, klantReferentie: null, tegenpartijNaam: null });
  });

  it.each(["28", "28C"])("ondersteunt afschriftnummer in :%s:", nummerTag => {
    expect(parseerMt940(afschrift({ nummerTag })).afschriften[0].nummer).toBe("00123");
  });

  it.each([rekening, `${rekening}EUR`, `${rekening} EUR`, `${rekening}/EUR`, "NL91 ABNA 0417 1643 00"])("normaliseert rekening %s", account => {
    expect(parseerMt940(afschrift({ account })).rekening).toBe(rekening);
  });

  it("behoudt oude BBAN-rekeningen zonder een IBAN te gokken", () => {
    expect(parseerMt940(afschrift({ account: "41.71.64.300" })).rekening).toBe("417164300");
  });

  it("ondersteunt volledige SWIFT- en oude OfficeNet-enveloppen", () => {
    const verwacht = parseerMt940(afschrift());
    expect(parseerMt940(swift(afschrift()))).toEqual(verwacht);
    expect(parseerMt940(`ABNANL2A\n940\nABNANL2A\n${afschrift({ nummerTag: "28" })}\n-`)).toEqual(verwacht);
  });

  it("leest CRLF, CR, LF en een UTF-8 BOM hetzelfde", () => {
    const origineel = parseerMt940(afschrift());
    for (const einde of ["\r\n", "\r", "\n"]) expect(parseerMt940(`\uFEFF${afschrift().replace(/\n/g, einde)}`)).toEqual(origineel);
  });

  it("behoudt een gedeelde ABN-mutatiecode als bankreferentie zonder transacties samen te voegen", () => {
    const invoer = afschrift({ eind: "C260915EUR1200,", transacties: ":61:2609150915C100,NTRFNONREF//654\n:86:Eerste bijdrage\n:61:2609150915C100,NTRFNONREF//654\n:86:Tweede bijdrage" });
    const { transacties } = parseerMt940(invoer);
    expect(transacties.map(t => t.bankReferentie)).toEqual(["654", "654"]);
    expect(transacties.map(t => t.volgnummer)).toEqual([1, 2]);
  });

  it("staat identieke afzonderlijke betalingen toe", () => {
    const regel = ":61:2609150915C100,N654NONREF\n:86:Bijdrage";
    expect(parseerMt940(afschrift({ eind: "C260915EUR1200,", transacties: `${regel}\n${regel}` })).transacties).toHaveLength(2);
  });

  it("laat een expliciet lege bankreferentie leeg", () => {
    const { transacties } = parseerMt940(afschrift({ eind: "C260915EUR1100,", transacties: ":61:2609150915C100,N654NONREF//" }));
    expect(transacties[0].bankReferentie).toBeNull();
    expect(transacties[0].omschrijving).toBe("Banktransactie");
  });

  it("herkent door regels afgebroken codewoorden, IBAN en omschrijving", () => {
    const details = `/TRTP/SEPA OVERBOEKING/IBAN/NL20INGB00012\n34567/NAME/Vereniging Bèta/REM\nI/Factuur SVR-2026-001/EREF/NI\nET-UNIEK`;
    const t = parseerMt940(afschrift({ eind: "C260915EUR1100,", transacties: `:61:2609150915C100,N654NONREF\n:86:${details}` })).transacties[0];
    expect(t).toMatchObject({ tegenpartijIban: tegenrekening, tegenpartijNaam: "Vereniging Bèta", omschrijving: "Factuur SVR-2026-001", klantReferentie: "NIET-UNIEK", ruweInformatie: details });
  });

  it("laat gewone slashes in namen en omschrijvingen intact", () => {
    const t = parseerMt940(afschrift({ eind: "C260915EUR1100,", transacties: ":61:2609150915C100,N654NONREF\n:86:/NAME/SVR/Commissie/REMI/Dassen rood/blauw/EREF/NOTPROVIDED" })).transacties[0];
    expect(t).toMatchObject({ tegenpartijNaam: "SVR/Commissie", omschrijving: "Dassen rood/blauw", klantReferentie: null });
  });
});

describe("andere Nederlandse MT940-varianten", () => {
  it("leest ING CNTP, REMI/USTD en aanvullende gegevens uit :61:", () => {
    const t = parseerMt940(afschrift({ account: "NL91ABNA0417164300EUR", eind: "C260915EUR1100,", transacties: ":61:2609150915C100,00NTRFEREF//26000123456789\n/TRCD/00100/\n:86:/EREF/ING-REFERENTIE//CNTP/NL20INGB0001234567/INGBNL2A/Vereniging Test/Delft//REMI/USTD//Contributie 2026/" })).transacties[0];
    expect(t).toMatchObject({ tegenpartijNaam: "Vereniging Test", tegenpartijIban: tegenrekening, klantReferentie: "ING-REFERENTIE", bankReferentie: "26000123456789", omschrijving: "Contributie 2026" });
    expect(t.ruweInformatie).toContain("/TRCD/00100/");
  });

  it("leest Rabo :940:, bedragen met voorloopnullen en tegenrekening uit de vervolgregel", () => {
    const invoer = `:940:\n${afschrift({ account: `${rekening} EUR`, nummer: "26258", eind: "C260915EUR000000001100,00", transacties: ":61:260915C000000000100,00N045NONREF\nNL20INGB0001234567\n:86:/ORDP//NAME/Vereniging Test/REMI/Jaarbijdrage" })}`;
    expect(parseerMt940(invoer).transacties[0]).toMatchObject({ bedragCenten: 10000, boekdatum: "2026-09-15", tegenpartijNaam: "Vereniging Test", tegenpartijIban: tegenrekening, omschrijving: "Jaarbijdrage" });
  });

  it("koppelt een :86: na het eindsaldo niet aan de laatste betaling", () => {
    const resultaat = parseerMt940(`${afschrift()}\n:64:C260915EUR1092,50\n:65:C260916EUR1092,50\n:86:/SUM/1/1/7,50/100,00/`);
    expect(resultaat.transacties[1].omschrijving).toBe("Kosten betaalrekening september 2026");
    expect(resultaat.transacties[1].ruweInformatie).not.toContain("SUM");
  });

  it("accepteert een afschrift zonder transacties als de saldi gelijk zijn", () => {
    expect(parseerMt940(afschrift({ eind: "C260915EUR1000,", transacties: "" })).transacties).toEqual([]);
  });
});

describe("bedragen en kalenderdatums", () => {
  it.each([["C", 100], ["D", -100], ["RC", -100], ["RD", 100]] as const)("verwerkt %s met het juiste teken", (code, bedragCenten) => {
    const eind = bedragCenten > 0 ? "C260915EUR1001," : "C260915EUR999,";
    expect(parseerMt940(afschrift({ eind, transacties: `:61:2609150915${code}1,NTRFNONREF` })).transacties[0].bedragCenten).toBe(bedragCenten);
  });

  it("verwerkt een negatief openings- en eindsaldo", () => {
    expect(parseerMt940(afschrift({ begin: "D260914EUR100,", eind: "D260915EUR101,", transacties: ":61:2609150915D1,NTRFNONREF" })).afschriften[0]).toMatchObject({ beginSaldoCenten: -10000, eindSaldoCenten: -10100 });
  });

  it("houdt nul gelijk aan nul, zonder negatieve nul", () => {
    const r = parseerMt940(afschrift({ begin: "D260914EUR0,", eind: "D260915EUR0,", transacties: ":61:2609150915D0,NTRFNONREF" }));
    expect(Object.is(r.transacties[0].bedragCenten, -0)).toBe(false);
    expect(Object.is(r.afschriften[0].beginSaldoCenten, -0)).toBe(false);
  });

  it.each([
    ["2512310101", "2025-12-31", "2026-01-01"],
    ["2601011231", "2026-01-01", "2025-12-31"],
    ["2609150914", "2026-09-15", "2026-09-14"],
    ["2402290229", "2024-02-29", "2024-02-29"],
    ["260915", "2026-09-15", "2026-09-15"],
    ["260915    ", "2026-09-15", "2026-09-15"],
  ])("leidt de boekdatum correct af uit %s", (input, valutadatum, boekdatum) => {
    const t = parseerMt940(afschrift({ eind: "C260915EUR1001,", transacties: `:61:${input}C1,NTRFNONREF` })).transacties[0];
    expect(t).toMatchObject({ boekdatum, valutadatum });
  });

  it("ondersteunt de optionele EUR-fondscode R", () => {
    expect(parseerMt940(afschrift({ eind: "C260915EUR1001,", transacties: ":61:2609150915CR1,NTRFNONREF" })).transacties[0].bedragCenten).toBe(100);
  });

  it("telt veel kleine bedragen exact zonder afrondingsverschil", () => {
    const regels = Array.from({ length: 1000 }, (_, i) => `:61:2609150915C0,01NTRFREF${i}`).join("\n");
    const r = parseerMt940(afschrift({ eind: "C260915EUR1010,", transacties: regels }));
    expect(r.transacties.reduce((som, t) => som + t.bedragCenten, 0)).toBe(1000);
  });
});

describe("meerdere afschriften en vervolgpagina's", () => {
  const eerste = () => afschrift({ eindTag: "62M", eind: "C260915EUR1100,", transacties: ":61:2609150915C100,N654NONREF" });
  const tweede = () => afschrift({ nummer: "00123/2", beginTag: "60M", begin: "C260915EUR1100,", eind: "C260915EUR1092,5", transacties: ":61:2609150915D7,5N192NONREF" });
  it("combineert uitsluitend aansluitende pagina's", () => {
    const r = parseerMt940(`${swift(eerste())}\n${swift(tweede())}`);
    expect(r.afschriften).toHaveLength(2);
    expect(r.transacties.map(t => t.afschriftVolgnummer)).toEqual([1, 2]);
    expect(r.transacties.map(t => t.bedragCenten)).toEqual([10000, -750]);
  });
  it("combineert volledige opeenvolgende dagafschriften", () => {
    const tweedeDag = afschrift({ nummer: "00124/1", begin: "C260915EUR1092,5", eind: "C260916EUR1093,5", transacties: ":61:2609160916C1,N654NONREF" });
    const r = parseerMt940(`${afschrift()}\n${tweedeDag}`);
    expect(r.afschriften).toHaveLength(2);
    expect(r.transacties).toHaveLength(3);
  });
  it.each([
    ["ontbrekende eerste pagina", () => tweede()],
    ["ontbrekende laatste pagina", () => eerste()],
    ["ontbrekende tussenpagina", () => `${eerste()}\n${tweede().replace("00123/2", "00123/3")}`],
    ["verkeerd afschrift op vervolgpagina", () => `${eerste()}\n${tweede().replace("00123/2", "00124/2")}`],
    ["onverwachte vervolgpagina", () => `${afschrift()}\n${tweede()}`],
    ["pagina twee als eerste pagina", () => afschrift({ nummer: "123/2" })],
  ] as const)("weigert %s", (_, input) => { expect(() => parseerMt940(input())).toThrow(Mt940Fout); });
});

describe("veilig afwijzen zonder gedeeltelijk resultaat", () => {
  it.each([
    ["leeg bestand", ""],
    ["willekeurige tekst", "geen bankbestand"],
    ["ander formaat", "<Document>camt.053</Document>"],
    ["ontbrekende afsluiting", swift(afschrift()).replace("-}{5:}", "")],
    ["verkeerd SWIFT-berichttype", swift(afschrift()).replace("O940", "O942")],
    ["lege datum", afschrift().replace("C260914EUR", "CEUR")],
    ["ongeldige kalenderdag", afschrift().replace("2609150915C100", "2602310915C100")],
    ["ongeldige boekdag", afschrift().replace("2609150915C100", "2609150230C100")],
    ["boekdatum op 29 februari buiten schrikkeljaar", afschrift().replace("2609150915C100", "2503010229C100")],
    ["ongeldige saldodag", afschrift().replace("260914EUR", "260231EUR")],
    ["omgekeerde saldodatums", afschrift().replace("260914EUR", "260916EUR")],
    ["valuta USD", afschrift().replaceAll("EUR", "USD")],
    ["valuta in rekeningnummer", afschrift({ account: `${rekening} USD` })],
    ["valuta zonder spatie", afschrift({ account: `${rekening}USD` })],
    ["vreemde fondscode", afschrift().replace("C100,N654", "CU100,N654")],
    ["bedrag met punt", afschrift().replace("D7,5N192", "D7.50N192")],
    ["bedrag zonder komma", afschrift().replace("D7,5N192", "D750N192")],
    ["bedrag met drie decimalen", afschrift().replace("D7,5N192", "D7,500N192")],
    ["negatief absoluut bedrag", afschrift().replace("D7,5N192", "D-7,5N192")],
    ["int32-overloop transactie", afschrift().replace("C100,N654", "C21474836,48N654")],
    ["int32-overloop saldo", afschrift().replace("EUR1000,", "EUR21474836,48")],
    ["extreem bedrag", afschrift().replace("C100,N654", "C999999999999999999999,N654")],
    ["onbekende C/D-code", afschrift().replace("D7,5N192", "X7,5N192")],
    ["ontbrekend transactietype", afschrift().replace("N654NONREF", "NONREF")],
    ["ontbrekend openingssaldo", afschrift().replace(":60F:C260914EUR1000,\n", "")],
    ["ontbrekend eindsaldo", afschrift().replace(/\n:62F:.*/, "")],
    ["ontbrekend afschriftnummer", afschrift().replace(":28C:00123/1\n", "")],
    ["ontbrekend rekeningnummer", afschrift().replace(`:25:${rekening}\n`, "")],
    ["dubbel openingssaldo", afschrift().replace(":60F:", ":60F:C260914EUR1000,\n:60F:")],
    ["fout in saldo", afschrift().replace("EUR1092,5", "EUR1092,51")],
    ["onbekend tag", afschrift().replace(":62F:", ":99:ONBEKEND\n:62F:")],
    ["transactie na saldo", `${afschrift()}\n:61:2609150915C100,NTRFNONREF`],
    ["vreemde tekst na saldo", `${afschrift()}\nonbekende staart`],
    ["onleesbare tekens", `${afschrift()}\u0000`],
    ["kapotte UTF-8", afschrift().replace("Bèta", "B\uFFFDta")],
    ["meerdere rekeningen", `${afschrift()}\n${afschrift({ account: tegenrekening })}`],
    ["niet-aansluitende saldi", `${afschrift()}\n${afschrift({ nummer: "00124/1" })}`],
  ])("weigert %s met een leesbare fout", (_, input) => {
    expect(() => parseerMt940(input)).toThrow(Mt940Fout);
  });

  it("weigert een te groot bestand voordat het parserwerk begint", () => {
    expect(() => parseerMt940("x".repeat(MT940_MAX_BYTES + 1))).toThrow(/maximaal 2 MB/);
    expect(() => parseerMt940("é".repeat(MT940_MAX_BYTES / 2 + 1))).toThrow(/maximaal 2 MB/);
  });

  it("weigert meer dan 10.000 transacties", () => {
    const regels = Array.from({ length: MT940_MAX_TRANSACTIES + 1 }, () => ":61:2609150915C0,NTRFNONREF").join("\n");
    expect(() => parseerMt940(afschrift({ eind: "C260915EUR1000,", transacties: regels }))).toThrow(/te veel transacties/);
  });
});
