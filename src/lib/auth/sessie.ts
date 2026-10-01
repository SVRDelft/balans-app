// Ondertekend sessiecookie. Gebruikt alleen Web Crypto, zodat dezelfde code
// werkt in proxy.ts (edge) en in server components (node).
//
// In het cookie staat wie je bent en welke rol je had bij het inloggen. Of het
// account nog bestaat en nog actief is, wordt bij elk verzoek opnieuw in de
// database gecontroleerd (src/lib/auth/server.ts): een cookie dat blijft
// hangen mag nooit toegang houden nadat een account is uitgezet.

import { cookieAlleenOverHttps } from "@/lib/beveiliging";

export const SESSIE_COOKIE = "svr_sessie";
export const BOEKJAAR_COOKIE = "svr_boekjaar";

const SESSIE_DUUR_MS = 30 * 24 * 60 * 60 * 1000;

export type Rol = "BESTUUR" | "SV";

export interface Sessie {
  /** Id van het account. */
  gebruikerId: string;
  /** Naam die in het auditlog komt te staan. */
  naam: string;
  rol: Rol;
  /** Alleen bij een SV-account: de vereniging waar dit account bij hoort. */
  relatieId?: string;
  /** Epoch in milliseconden. */
  verlooptOp: number;
}

function tekstNaarBytes(tekst: string): Uint8Array<ArrayBuffer> {
  // TextEncoder levert altijd een gewone ArrayBuffer; het bredere type dat
  // TypeScript eraan geeft past niet op BufferSource.
  return new TextEncoder().encode(tekst) as Uint8Array<ArrayBuffer>;
}

function naarBase64Url(bytes: Uint8Array): string {
  let binair = "";
  for (const byte of bytes) binair += String.fromCharCode(byte);
  return btoa(binair).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function uitBase64Url(tekst: string): Uint8Array | null {
  try {
    const hersteld = tekst.replace(/-/g, "+").replace(/_/g, "/");
    const opvulling = (4 - (hersteld.length % 4)) % 4;
    const binair = atob(hersteld + "=".repeat(opvulling));
    const bytes = new Uint8Array(binair.length);
    for (let i = 0; i < binair.length; i += 1) bytes[i] = binair.charCodeAt(i);
    return bytes;
  } catch {
    return null;
  }
}

function haalGeheim(): string {
  const geheim = process.env.AUTH_SECRET;
  if (!geheim || geheim.length < 16) {
    throw new Error(
      "AUTH_SECRET ontbreekt of is te kort. Zet er een lange willekeurige waarde in .env.",
    );
  }
  return geheim;
}

async function maakSleutel(geheim: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    tekstNaarBytes(geheim),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
}

async function onderteken(inhoud: string, geheim: string): Promise<string> {
  const sleutel = await maakSleutel(geheim);
  const handtekening = await crypto.subtle.sign(
    "HMAC",
    sleutel,
    tekstNaarBytes(inhoud),
  );
  return naarBase64Url(new Uint8Array(handtekening));
}

/** Vergelijking die niet eerder stopt bij het eerste verschil. */
function gelijkInVasteTijd(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let verschil = 0;
  for (let i = 0; i < a.length; i += 1) {
    verschil |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return verschil === 0;
}

export async function maakSessieCookie(
  gebruiker: Pick<Sessie, "gebruikerId" | "naam" | "rol" | "relatieId">,
): Promise<string> {
  const sessie: Sessie = {
    ...gebruiker,
    verlooptOp: Date.now() + SESSIE_DUUR_MS,
  };
  const inhoud = naarBase64Url(tekstNaarBytes(JSON.stringify(sessie)));
  const handtekening = await onderteken(inhoud, haalGeheim());
  return `${inhoud}.${handtekening}`;
}

export async function leesSessieCookie(
  waarde: string | undefined | null,
): Promise<Sessie | null> {
  if (!waarde) return null;

  const scheiding = waarde.lastIndexOf(".");
  if (scheiding <= 0) return null;

  const inhoud = waarde.slice(0, scheiding);
  const handtekening = waarde.slice(scheiding + 1);

  let verwacht: string;
  try {
    verwacht = await onderteken(inhoud, haalGeheim());
  } catch {
    return null;
  }
  if (!gelijkInVasteTijd(handtekening, verwacht)) return null;

  const bytes = uitBase64Url(inhoud);
  if (!bytes) return null;

  try {
    const sessie = JSON.parse(new TextDecoder().decode(bytes)) as Sessie;
    if (typeof sessie.naam !== "string" || sessie.naam.trim() === "") {
      return null;
    }
    if (typeof sessie.gebruikerId !== "string" || sessie.gebruikerId === "") {
      return null;
    }
    if (sessie.rol !== "BESTUUR" && sessie.rol !== "SV") return null;
    if (sessie.rol === "SV" && typeof sessie.relatieId !== "string") return null;
    if (typeof sessie.verlooptOp !== "number" || sessie.verlooptOp < Date.now()) {
      return null;
    }
    return sessie;
  } catch {
    return null;
  }
}

export const SESSIE_COOKIE_OPTIES = {
  httpOnly: true,
  sameSite: "lax",
  path: "/",
  maxAge: SESSIE_DUUR_MS / 1000,
  // Zonder https zou een `Secure`-cookie nooit meegestuurd worden; dan kun je
  // dus ook niet inloggen. Zie src/lib/beveiliging.ts.
  secure: cookieAlleenOverHttps(),
} as const;
