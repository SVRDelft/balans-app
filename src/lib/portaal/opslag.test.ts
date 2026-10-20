import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { herkenBestand, MAX_BYTES, TOEGESTAAN } from "./opslag";

const maak = (...bytes: number[]) => new Uint8Array(bytes);
const zip = (inhoud: string) => {
  const kop = maak(0x50, 0x4b, 0x03, 0x04);
  const rest = new TextEncoder().encode(inhoud);
  const samen = new Uint8Array(kop.length + rest.length);
  samen.set(kop);
  samen.set(rest, kop.length);
  return samen;
};

describe("uploads herkennen aan de inhoud", () => {
  it("herkent PDF, PNG, JPG en DOCX", () => {
    expect(herkenBestand(maak(0x25, 0x50, 0x44, 0x46, 0x2d, 0x31))?.extensie).toBe("pdf");
    expect(herkenBestand(maak(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a))?.extensie).toBe("png");
    expect(herkenBestand(maak(0xff, 0xd8, 0xff, 0xe0))?.extensie).toBe("jpg");
    expect(herkenBestand(zip("word/document.xml"))?.extensie).toBe("docx");
  });

  it("weigert een bestand dat alleen zo heet", () => {
    // Tekst met de naam agenda.pdf is geen PDF.
    expect(herkenBestand(new TextEncoder().encode("gewoon tekst"))).toBeUndefined();
    // Een zip die geen Word-document is (bijvoorbeeld een zip vol bestanden).
    expect(herkenBestand(zip("vakantiefotos/strand.jpg"))).toBeUndefined();
    expect(herkenBestand(maak())).toBeUndefined();
  });

  it("houdt de grens op 20 MB en noemt de toegestane soorten", () => {
    expect(MAX_BYTES).toBe(20 * 1024 * 1024);
    expect(TOEGESTAAN).toContain("PDF");
    expect(TOEGESTAAN).toContain("DOCX");
  });
});
