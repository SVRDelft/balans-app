// Een heel kleine ZIP-schrijver, zonder compressie en zonder bibliotheek.
//
// Een back-up moet ook over tien jaar nog te openen zijn met het eerste het
// beste programma, en de app mag geen gecompileerde afhankelijkheden hebben.
// Daarom: het "stored"-formaat, dat elke ontpakker begrijpt. PDF's en JPG's
// zijn toch al gecomprimeerd, dus veel scheelt het niet.

const TABEL = (() => {
  const tabel = new Uint32Array(256);
  for (let i = 0; i < 256; i += 1) {
    let waarde = i;
    for (let bit = 0; bit < 8; bit += 1) {
      waarde = waarde & 1 ? 0xedb88320 ^ (waarde >>> 1) : waarde >>> 1;
    }
    tabel[i] = waarde >>> 0;
  }
  return tabel;
})();

export function crc32(data: Uint8Array): number {
  let rest = 0xffffffff;
  for (const byte of data) rest = TABEL[(rest ^ byte) & 0xff] ^ (rest >>> 8);
  return (rest ^ 0xffffffff) >>> 0;
}

export interface ZipBestand {
  naam: string;
  inhoud: Uint8Array;
  datum?: Date;
}

/** Datum en tijd in het formaat dat MS-DOS gebruikte en ZIP nog steeds. */
function dosTijd(datum: Date) {
  const jaar = Math.max(1980, datum.getFullYear());
  return {
    tijd:
      (datum.getHours() << 11) | (datum.getMinutes() << 5) | (datum.getSeconds() >> 1),
    datum: ((jaar - 1980) << 9) | ((datum.getMonth() + 1) << 5) | datum.getDate(),
  };
}

export function maakZip(bestanden: ZipBestand[]): Uint8Array {
  const delen: Uint8Array[] = [];
  const centraal: Uint8Array[] = [];
  let plek = 0;

  for (const bestand of bestanden) {
    const naam = new TextEncoder().encode(bestand.naam);
    const controle = crc32(bestand.inhoud);
    const { tijd, datum } = dosTijd(bestand.datum ?? new Date());

    const kop = new DataView(new ArrayBuffer(30));
    kop.setUint32(0, 0x04034b50, true); // handtekening
    kop.setUint16(4, 20, true); // benodigde versie
    kop.setUint16(6, 0x0800, true); // vlag: namen in UTF-8
    kop.setUint16(8, 0, true); // geen compressie
    kop.setUint16(10, tijd, true);
    kop.setUint16(12, datum, true);
    kop.setUint32(14, controle, true);
    kop.setUint32(18, bestand.inhoud.length, true);
    kop.setUint32(22, bestand.inhoud.length, true);
    kop.setUint16(26, naam.length, true);
    kop.setUint16(28, 0, true);

    delen.push(new Uint8Array(kop.buffer), naam, bestand.inhoud);

    const ingang = new DataView(new ArrayBuffer(46));
    ingang.setUint32(0, 0x02014b50, true);
    ingang.setUint16(4, 20, true);
    ingang.setUint16(6, 20, true);
    ingang.setUint16(8, 0x0800, true);
    ingang.setUint16(10, 0, true);
    ingang.setUint16(12, tijd, true);
    ingang.setUint16(14, datum, true);
    ingang.setUint32(16, controle, true);
    ingang.setUint32(20, bestand.inhoud.length, true);
    ingang.setUint32(24, bestand.inhoud.length, true);
    ingang.setUint16(28, naam.length, true);
    ingang.setUint32(42, plek, true);
    centraal.push(new Uint8Array(ingang.buffer), naam);

    plek += 30 + naam.length + bestand.inhoud.length;
  }

  const centraalLengte = centraal.reduce((som, deel) => som + deel.length, 0);
  const slot = new DataView(new ArrayBuffer(22));
  slot.setUint32(0, 0x06054b50, true);
  slot.setUint16(8, bestanden.length, true);
  slot.setUint16(10, bestanden.length, true);
  slot.setUint32(12, centraalLengte, true);
  slot.setUint32(16, plek, true);

  const alles = [...delen, ...centraal, new Uint8Array(slot.buffer)];
  const totaal = alles.reduce((som, deel) => som + deel.length, 0);
  const uit = new Uint8Array(totaal);
  let positie = 0;
  for (const deel of alles) {
    uit.set(deel, positie);
    positie += deel.length;
  }
  return uit;
}
