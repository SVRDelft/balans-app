// Controleert of een upload echt een PNG of JPG is, puur in JavaScript.
//
// Bewust zonder sharp of een andere gecompileerde bibliotheek: de app moet ook
// draaien op de webserver van de TU Delft, waar een binary die niet bij het
// besturingssysteem past de hele app sloopt. We lezen daarom alleen de kop van
// het bestand; de afbeelding zelf wordt niet gedecodeerd.

export interface Afbeelding {
  formaat: "png" | "jpeg";
  breedte: number;
  hoogte: number;
}

const PNG_MAGISCH = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

function leesPng(data: Uint8Array): Afbeelding | undefined {
  if (data.length < 24) return;
  if (PNG_MAGISCH.some((byte, i) => data[i] !== byte)) return;
  const kijk = new DataView(data.buffer, data.byteOffset, data.byteLength);
  // Het eerste blok hoort IHDR te zijn, met de afmetingen.
  if (kijk.getUint32(12) !== 0x49484452) return;
  const breedte = kijk.getUint32(16);
  const hoogte = kijk.getUint32(20);
  if (breedte === 0 || hoogte === 0) return;

  // Blokken aflopen: een geldig bestand eindigt met IEND, en een APNG (acTL)
  // is een animatie en dus geen gewone afbeelding.
  let plek = 8;
  let einde = false;
  while (plek + 8 <= data.length) {
    const lengte = kijk.getUint32(plek);
    const soort = kijk.getUint32(plek + 4);
    if (lengte > data.length) return;
    if (soort === 0x6163544c) return; // acTL
    if (soort === 0x49454e44) {
      einde = true;
      break;
    }
    plek += 12 + lengte; // lengte + soort + inhoud + controlegetal
  }
  if (!einde) return;
  return { formaat: "png", breedte, hoogte };
}

function leesJpeg(data: Uint8Array): Afbeelding | undefined {
  if (data.length < 4 || data[0] !== 0xff || data[1] !== 0xd8) return;
  const kijk = new DataView(data.buffer, data.byteOffset, data.byteLength);
  let plek = 2;
  let gevonden: Afbeelding | undefined;

  while (plek + 4 <= data.length) {
    if (data[plek] !== 0xff) return;
    const markering = data[plek + 1];
    if (markering === 0xd8) return; // een tweede bestand aan elkaar geplakt
    if (markering === 0xd9) break; // einde
    if (markering === 0xda) {
      // Begin van de beeldgegevens; verder zoeken heeft geen zin.
      return gevonden;
    }
    if (markering === 0xff || (markering >= 0xd0 && markering <= 0xd7)) {
      plek += 1;
      continue;
    }
    const lengte = kijk.getUint16(plek + 2);
    if (lengte < 2 || plek + 2 + lengte > data.length) return;
    // SOF0 t/m SOF15, behalve de blokken die geen beeldkop zijn.
    const isKop =
      markering >= 0xc0 &&
      markering <= 0xcf &&
      markering !== 0xc4 &&
      markering !== 0xc8 &&
      markering !== 0xcc;
    if (isKop) {
      if (gevonden) return; // meerdere beelden in één bestand
      const hoogte = kijk.getUint16(plek + 5);
      const breedte = kijk.getUint16(plek + 7);
      if (breedte === 0 || hoogte === 0) return;
      gevonden = { formaat: "jpeg", breedte, hoogte };
    }
    plek += 2 + lengte;
  }
  return gevonden;
}

/** Leest het echte type en de afmetingen, of undefined als het geen PNG/JPG is. */
export function leesAfbeelding(data: Uint8Array): Afbeelding | undefined {
  return leesPng(data) ?? leesJpeg(data);
}
