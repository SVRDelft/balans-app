import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { controleerLogo, logoBestand } from "./logo";
import { leesAfbeelding } from "./afbeelding";

// Vaste voorbeeldbestanden: een PNG van 2×2 en een JPG van 4×3. Zo is er geen
// bibliotheek nodig om tijdens de test een afbeelding te maken.
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAACXBIWXMAAAPoAAAD6AG1e1JrAAAADklEQVQImWP4DwYMEAoAU7oL9W/sIDEAAAAASUVORK5CYII=",
  "base64",
);
const JPG = Buffer.from(
  "/9j/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAADAAQDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAj/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFAEBAAAAAAAAAAAAAAAAAAAAAP/EABQRAQAAAAAAAAAAAAAAAAAAAAD/2gAMAwEAAhEDEQA/AKpAB//Z",
  "base64",
);

describe("afbeelding herkennen zonder gecompileerde bibliotheek", () => {
  it("leest het formaat en de afmetingen van een PNG en een JPG", () => {
    expect(leesAfbeelding(PNG)).toEqual({ formaat: "png", breedte: 2, hoogte: 2 });
    expect(leesAfbeelding(JPG)).toEqual({ formaat: "jpeg", breedte: 4, hoogte: 3 });
  });
  it("weigert tekst, een afgekapt bestand en een PNG zonder afsluiting", () => {
    expect(leesAfbeelding(Buffer.from("geen afbeelding"))).toBeUndefined();
    expect(leesAfbeelding(PNG.subarray(0, 20))).toBeUndefined();
    expect(leesAfbeelding(PNG.subarray(0, PNG.length - 12))).toBeUndefined();
    expect(leesAfbeelding(Buffer.from("<svg/>"))).toBeUndefined();
  });
});

describe("logo upload", () => {
  it("bewaart een geldige afbeelding ongewijzigd en herkent het echte formaat", async () => {
    const logo = await controleerLogo(
      new File([new Uint8Array(PNG)], "logo.png", { type: "image/jpeg" }),
    );
    expect(logo.logoMimeType).toBe("image/png");
    expect(Buffer.from(logo.logoData)).toEqual(PNG);
    expect((await logoBestand(logo)).data).toEqual(PNG);
  });
  it("weigert bestanden die alleen doen alsof ze een afbeelding zijn", async () => {
    await expect(
      controleerLogo(
        new File(["geen afbeelding"], "logo.png", { type: "image/png" }),
      ),
    ).rejects.toThrow("geen geldige");
    await expect(
      controleerLogo(
        new File(["<svg/>"], "logo.svg", { type: "image/svg+xml" }),
      ),
    ).rejects.toThrow("PNG- of JPG");
  });
  it("weigert een te groot bestand voordat het wordt gedecodeerd", async () => {
    await expect(
      controleerLogo(
        new File([new Uint8Array(2_000_001)], "logo.jpg", {
          type: "image/jpeg",
        }),
      ),
    ).rejects.toThrow("2 MB");
  });
});
