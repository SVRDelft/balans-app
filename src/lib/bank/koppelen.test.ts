import { describe, expect, it } from 'vitest';
import { bankVoorstellen, normaliseerRekening, zoekBankVoorstel, type Bankregel, type FactuurKeuze, type UitgaveKeuze } from './koppelen';

const datum = new Date('2026-09-15T00:00:00Z');
const iban = 'NL91ABNA0417164300';
const factuur: FactuurKeuze = { id: 'factuur', nummer: 'SVR62-2026-0001', relatieNaam: 'Vereniging', iban,
  openstaandCenten: 10000, status: 'verstuurd' };
const regel: Bankregel = { datum, bedragCenten: 10000, omschrijving: 'Bijdrage', tegenpartijNaam: 'Vereniging', tegenpartijIban: '' };
const uitgave: UitgaveKeuze = { id: 'uitgave', leverancierNaam: 'Café Delft', omschrijving: 'Drankjes', iban,
  bedragCenten: 10000, betaald: false, betaaldOp: null };
const voorstel = (r: Partial<Bankregel> = {}, f: FactuurKeuze[] = [factuur], u: UitgaveKeuze[] = []) => zoekBankVoorstel({ ...regel, ...r }, f, [], u);

describe('herkennen van facturen zonder gokken op alleen het bedrag', () => {
  it.each(['Betaling SVR62-2026-0001', '/REMI/SVR62 2026 0001', 'svr6220260001', 'Factuur: SVR62/2026/0001.'])('herkent een volledig nummer in %s', omschrijving => {
    expect(voorstel({ omschrijving })?.waarde).toBe('factuur:factuur');
  });
  it.each(['SVR62-2026-00010', 'SVR62-2026-0001A', 'XSVR62-2026-0001', '99SVR6220260001'])('koppelt geen onderdeel van een ander kenmerk: %s', omschrijving => {
    expect(voorstel({ omschrijving })).toBeUndefined();
  });
  it('staat deelbetaling toe bij een expliciet nummer, maar geen teveel ontvangen', () => {
    expect(voorstel({ omschrijving: factuur.nummer, bedragCenten: 3000 })?.waarde).toBe('factuur:factuur');
    expect(voorstel({ omschrijving: factuur.nummer, bedragCenten: 12000 })).toBeUndefined();
  });
  it('koppelt op IBAN alleen bij een exact en uniek openstaand bedrag', () => {
    expect(voorstel({ tegenpartijIban: 'nl91 abna 0417 1643 00' })?.waarde).toBe('factuur:factuur');
    expect(voorstel({ tegenpartijIban: iban, bedragCenten: 3000 })).toBeUndefined();
    expect(voorstel({ tegenpartijIban: iban }, [factuur, { ...factuur, id: 'tweede', nummer: 'SVR62-2026-0002' }])).toBeUndefined();
  });
  it('gebruikt nooit uitsluitend bedrag of naam', () => {
    expect(voorstel()).toBeUndefined();
  });
  it('geeft geen voorstel voor meerdere vermelde facturen', () => {
    expect(voorstel({ omschrijving: `${factuur.nummer} en SVR62-2026-0002`, tegenpartijIban: iban }, [factuur, { ...factuur, id: 'tweede', nummer: 'SVR62-2026-0002' }])).toBeUndefined();
  });
  it.each(['concept', 'oninbaar'])('boekt niet nieuw op een factuur met status %s', status => {
    expect(voorstel({ omschrijving: factuur.nummer }, [{ ...factuur, status }])).toBeUndefined();
  });
  it('herkent een negatieve terugbetaling alleen bij een negatief openstaand bedrag', () => {
    expect(voorstel({ omschrijving: factuur.nummer, bedragCenten: -3000 })).toBeUndefined();
    expect(voorstel({ omschrijving: factuur.nummer, bedragCenten: -3000 }, [{ ...factuur, openstaandCenten: -3000 }])?.waarde).toBe('factuur:factuur');
  });
  it('boekt geen nulbedragen', () => {
    expect(voorstel({ omschrijving: factuur.nummer, bedragCenten: 0 }, [{ ...factuur, openstaandCenten: 0 }])).toBeUndefined();
  });
});

describe('bestaande betalingen koppelen zonder dubbelboeken', () => {
  const betaling = { id: 'betaling', factuurId: factuur.id, datum, bedragCenten: 10000 };
  it('verkiest de al ingevoerde betaling met dezelfde factuur, datum en bedrag', () => {
    expect(zoekBankVoorstel({ ...regel, omschrijving: factuur.nummer }, [{ ...factuur, status: 'betaald', openstaandCenten: 0 }], [betaling], [])?.waarde).toBe('betaling:betaling');
  });
  it('ziet een betaling op een andere dag niet als dezelfde ontvangst', () => {
    expect(zoekBankVoorstel({ ...regel, omschrijving: factuur.nummer }, [{ ...factuur, status: 'betaald', openstaandCenten: 0 }], [{ ...betaling, datum: new Date('2026-09-14') }], [])).toBeUndefined();
  });
  it('laat identieke handmatige betalingen voor een menselijke keuze staan', () => {
    expect(zoekBankVoorstel({ ...regel, omschrijving: factuur.nummer }, [factuur], [betaling, { ...betaling, id: 'dubbel' }], [])).toBeUndefined();
  });
});

describe('uitgaven en reserveren bij meerdere bankregels', () => {
  it('herkent een ongekoppelde kostenpost op exact leverancier en bedrag', () => {
    expect(voorstel({ bedragCenten: -10000, tegenpartijNaam: 'CAFE DELFT' }, [], [uitgave])?.waarde).toBe('uitgave:uitgave');
    expect(voorstel({ bedragCenten: -10000, tegenpartijNaam: 'Café Delft BV' }, [], [uitgave])).toBeUndefined();
  });
  it('matcht een al betaalde uitgave alleen op dezelfde betaal-datum', () => {
    const bank = { bedragCenten: -10000, tegenpartijIban: iban };
    expect(voorstel(bank, [], [{ ...uitgave, betaald: true, betaaldOp: datum }])?.waarde).toBe('uitgave:uitgave');
    expect(voorstel(bank, [], [{ ...uitgave, betaald: true, betaaldOp: new Date('2026-08-15') }])).toBeUndefined();
    expect(voorstel(bank, [], [{ ...uitgave, betaald: true }])).toBeUndefined();
  });
  it('kiest niet bij twee passende uitgaven en leidt een herkend factuurnummer niet om naar kosten', () => {
    expect(voorstel({ bedragCenten: -10000, tegenpartijIban: iban }, [], [uitgave, { ...uitgave, id: 'twee' }])).toBeUndefined();
    expect(voorstel({ bedragCenten: -10000, tegenpartijIban: iban, omschrijving: factuur.nummer }, [factuur], [uitgave])).toBeUndefined();
  });
  it('reserveert een factuur, bestaande betaling of uitgave maar eenmaal per batch', () => {
    for (const type of ['factuur', 'betaling', 'uitgave']) {
      const r = { ...regel, omschrijving: factuur.nummer, ...(type === 'uitgave' ? { bedragCenten: -10000, omschrijving: 'Kosten', tegenpartijIban: iban } : {}) };
      const voorstellen = bankVoorstellen([{ ...r, id: 'een' }, { ...r, id: 'twee' }], [factuur], type === 'betaling' ? [{ id: 'betaling', factuurId: factuur.id, datum, bedragCenten: 10000 }] : [], [uitgave]);
      expect([...voorstellen.keys()]).toEqual(['een']);
      expect(voorstellen.get('een')?.waarde.startsWith(`${type}:`)).toBe(true);
    }
  });
  it('normaliseert spaties en kleine letters in een IBAN', () => {
    expect(normaliseerRekening('nl91 abna 0417 1643 00')).toBe(iban);
  });
});
