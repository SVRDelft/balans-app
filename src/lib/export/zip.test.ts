import { describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { crc32, maakZip } from "./zip";

const tekst = (waarde: string) => new TextEncoder().encode(waarde);

describe("de kleine ZIP-schrijver", () => {
  it("rekent dezelfde controlegetallen als de standaard", () => {
    // Bekende waarden uit de CRC-32-specificatie.
    expect(crc32(tekst("123456789")).toString(16)).toBe("cbf43926");
    expect(crc32(tekst("")).toString(16)).toBe("0");
  });

  it("maakt een bestand dat met de ZIP-handtekening begint en eindigt", () => {
    const zip = maakZip([{ naam: "een.txt", inhoud: tekst("hallo") }]);
    expect([...zip.subarray(0, 4)]).toEqual([0x50, 0x4b, 0x03, 0x04]);
    expect([...zip.subarray(zip.length - 22, zip.length - 18)]).toEqual([
      0x50, 0x4b, 0x05, 0x06,
    ]);
  });

  // Deze test start PowerShell op; op een drukke machine duurt dat zo tien
  // seconden, en dat is geen reden om de hele suite te laten omvallen.
  it("is met een gewone ontpakker uit te pakken", () => {
    const map = mkdtempSync(path.join(tmpdir(), "svr-zip-"));
    const zip = maakZip([
      { naam: "database.json", inhoud: tekst('{"proef":true}') },
      { naam: "bestanden/notulen.txt", inhoud: tekst("notulen van de SVR") },
    ]);
    const pad = path.join(map, "export.zip");
    writeFileSync(pad, zip);

    // PowerShell zit op elke Windows-machine; op andere systemen slaan we over.
    if (process.platform !== "win32") return;
    execFileSync("powershell", [
      "-NoProfile",
      "-Command",
      `Expand-Archive -LiteralPath '${pad}' -DestinationPath '${map}\\uit' -Force`,
    ]);
    expect(readFileSync(path.join(map, "uit", "database.json"), "utf8")).toBe(
      '{"proef":true}',
    );
    expect(
      readFileSync(path.join(map, "uit", "bestanden", "notulen.txt"), "utf8"),
    ).toBe("notulen van de SVR");
  }, 30_000);
});
