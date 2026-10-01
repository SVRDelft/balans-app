import { randomBytes, scrypt, timingSafeEqual, type ScryptOptions } from "node:crypto";

// Wachtwoorden worden gehasht met scrypt. Dat zit in Node zelf, dus er is geen
// gecompileerde bibliotheek zoals bcrypt nodig — die kan niet mee naar de
// webserver van de TU Delft.
//
// Opslagvorm: scrypt$N$r$p$zout$hash, allebei in hexadecimaal. De instellingen
// staan in de hash zelf, zodat ze later zwaarder gezet kunnen worden zonder dat
// bestaande wachtwoorden ongeldig worden.

function scryptAsync(
  wachtwoord: string,
  zout: Buffer,
  lengte: number,
  instellingen: ScryptOptions,
): Promise<Buffer> {
  return new Promise((klaar, mislukt) => {
    scrypt(wachtwoord, zout, lengte, instellingen, (fout, sleutel) =>
      fout ? mislukt(fout) : klaar(sleutel),
    );
  });
}

const N = 16384; // kostenfactor; ongeveer een tiende seconde per poging
const r = 8;
const p = 1;
const LENGTE = 32;

export async function hashWachtwoord(wachtwoord: string): Promise<string> {
  const zout = randomBytes(16);
  const hash = await scryptAsync(wachtwoord.normalize("NFKC"), zout, LENGTE, {
    N,
    r,
    p,
    maxmem: 64 * 1024 * 1024,
  });
  return `scrypt$${N}$${r}$${p}$${zout.toString("hex")}$${hash.toString("hex")}`;
}

export async function controleerHash(
  wachtwoord: string,
  opgeslagen: string,
): Promise<boolean> {
  const delen = opgeslagen.split("$");
  if (delen.length !== 6 || delen[0] !== "scrypt") return false;
  const [, nTekst, rTekst, pTekst, zoutHex, hashHex] = delen;
  const instellingen = {
    N: Number(nTekst),
    r: Number(rTekst),
    p: Number(pTekst),
    maxmem: 256 * 1024 * 1024,
  };
  if (
    !Number.isInteger(instellingen.N) ||
    !Number.isInteger(instellingen.r) ||
    !Number.isInteger(instellingen.p) ||
    instellingen.N > 1 << 20
  ) {
    return false;
  }
  let verwacht: Buffer;
  try {
    verwacht = Buffer.from(hashHex, "hex");
  } catch {
    return false;
  }
  if (verwacht.length === 0) return false;

  const berekend = await scryptAsync(
    wachtwoord.normalize("NFKC"),
    Buffer.from(zoutHex, "hex"),
    verwacht.length,
    instellingen,
  );
  // Vaste tijd: anders verraadt de duur hoeveel tekens klopten.
  return timingSafeEqual(berekend, verwacht);
}

/**
 * Een wachtwoord dat het bestuur kan voorlezen of doorbellen: kleine letters en
 * cijfers zonder i, l, o, 0 en 1, in groepjes van vier.
 */
export function maakWachtwoord(groepen = 4): string {
  const tekens = "abcdefghjkmnpqrstuvwxyz23456789";
  const bytes = randomBytes(groepen * 4);
  let uit = "";
  for (let i = 0; i < groepen * 4; i += 1) {
    if (i > 0 && i % 4 === 0) uit += "-";
    uit += tekens[bytes[i] % tekens.length];
  }
  return uit;
}

/** Minimale eisen aan een zelfgekozen wachtwoord. */
export function keurWachtwoord(wachtwoord: string): string | undefined {
  if (wachtwoord.length < 12) {
    return "Kies een wachtwoord van minstens 12 tekens. Een zin met spaties mag ook.";
  }
  if (wachtwoord.length > 200) return "Dat wachtwoord is wel erg lang.";
  if (/^\s|\s$/.test(wachtwoord)) {
    return "Het wachtwoord mag niet met een spatie beginnen of eindigen.";
  }
  return undefined;
}
