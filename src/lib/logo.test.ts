import { describe, expect, it, vi } from "vitest";
import sharp from "sharp";
vi.mock("server-only", () => ({}));
import { controleerLogo, logoBestand } from "./logo";

describe("logo upload", () => {
  it("bewaart een geldige afbeelding ongewijzigd en herkent het echte formaat", async () => {
    const bytes = await sharp({
      create: { width: 2, height: 2, channels: 3, background: "white" },
    })
      .png()
      .toBuffer();
    const logo = await controleerLogo(
      new File([new Uint8Array(bytes)], "logo.png", { type: "image/jpeg" }),
    );
    expect(logo.logoMimeType).toBe("image/png");
    expect(Buffer.from(logo.logoData)).toEqual(bytes);
    expect((await logoBestand(logo)).data).toEqual(bytes);
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
