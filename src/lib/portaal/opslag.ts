import "server-only";

import { randomBytes } from "node:crypto";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

// Bestanden staan op schijf in storage/, buiten de map die de webserver
// uitserveert. Alles loopt via deze ene plek, zodat een verhuizing naar
// bijvoorbeeld Vercel Blob later alleen hier hoeft te gebeuren.

const MAP = path.join(process.cwd(), "storage/portaal");

export const MAX_BYTES = 20 * 1024 * 1024;

export interface Bestandssoort {
  mimeType: string;
  extensie: string;
  omschrijving: string;
}

const PDF: Bestandssoort = { mimeType: "application/pdf", extensie: "pdf", omschrijving: "PDF" };
const PNG: Bestandssoort = { mimeType: "image/png", extensie: "png", omschrijving: "PNG" };
const JPG: Bestandssoort = { mimeType: "image/jpeg", extensie: "jpg", omschrijving: "JPG" };
const DOCX: Bestandssoort = {
  mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  extensie: "docx",
  omschrijving: "Word-document",
};

const begintMet = (data: Uint8Array, bytes: number[]) =>
  bytes.every((byte, i) => data[i] === byte);

/**
 * Kijkt naar de inhoud, niet naar de extensie: een .pdf die eigenlijk iets
 * anders is, komt er niet door.
 */
export function herkenBestand(data: Uint8Array): Bestandssoort | undefined {
  if (begintMet(data, [0x25, 0x50, 0x44, 0x46, 0x2d])) return PDF; // %PDF-
  if (begintMet(data, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return PNG;
  if (begintMet(data, [0xff, 0xd8, 0xff])) return JPG;
  // DOCX is een zip; in de eerste bytes staat de naam van het eerste bestand.
  if (begintMet(data, [0x50, 0x4b, 0x03, 0x04])) {
    const kop = new TextDecoder("latin1").decode(data.subarray(0, 4096));
    if (kop.includes("word/") || kop.includes("[Content_Types].xml")) return DOCX;
  }
  return undefined;
}

export const TOEGESTAAN = "PDF, PNG, JPG of DOCX";

export interface Opgeslagen {
  opslagnaam: string;
  mimeType: string;
  grootte: number;
}

export async function bewaarBestand(data: Uint8Array): Promise<Opgeslagen> {
  const soort = herkenBestand(data);
  if (!soort) throw new Error(`Dit bestandstype kan niet: kies ${TOEGESTAAN}.`);
  if (data.byteLength > MAX_BYTES) throw new Error("Het bestand mag maximaal 20 MB zijn.");

  const opslagnaam = `${randomBytes(16).toString("hex")}.${soort.extensie}`;
  await mkdir(MAP, { recursive: true });
  await writeFile(path.join(MAP, opslagnaam), data);
  return { opslagnaam, mimeType: soort.mimeType, grootte: data.byteLength };
}

/** Alleen namen die dit programma zelf heeft gemaakt. */
const isVeiligeNaam = (naam: string) => /^[0-9a-f]{32}\.(pdf|png|jpg|docx)$/.test(naam);

export async function leesBestand(opslagnaam: string): Promise<Buffer> {
  if (!isVeiligeNaam(opslagnaam)) throw new Error("Onbekend bestand.");
  return readFile(path.join(MAP, opslagnaam));
}

export async function verwijderBestand(opslagnaam: string): Promise<void> {
  if (!isVeiligeNaam(opslagnaam)) return;
  await unlink(path.join(MAP, opslagnaam)).catch(() => {
    // Al weg: dan is het doel ook bereikt.
  });
}
