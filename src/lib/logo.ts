import "server-only";

import { readFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

let standaardLogo: Promise<Buffer> | undefined;

export async function logoBestand(
  instellingen: {
    logoData: Uint8Array | null;
    logoMimeType: string | null;
  } | null,
) {
  if (instellingen?.logoData && instellingen.logoMimeType) {
    return {
      data: Buffer.from(instellingen.logoData),
      mimeType: instellingen.logoMimeType,
    };
  }
  standaardLogo ??= readFile(
    path.join(process.cwd(), "public", "svr-logo.jpg"),
  );
  return { data: await standaardLogo, mimeType: "image/jpeg" };
}

export async function logoVoorPdf(
  instellingen: Parameters<typeof logoBestand>[0],
) {
  const logo = await logoBestand(instellingen);
  return `data:${logo.mimeType};base64,${logo.data.toString("base64")}`;
}

export async function controleerLogo(bestand: File) {
  if (bestand.size > 2_000_000)
    throw new Error("Het logo mag maximaal 2 MB zijn.");
  if (!["image/png", "image/jpeg"].includes(bestand.type))
    throw new Error("Kies een PNG- of JPG-bestand voor het logo.");
  const data = Buffer.from(await bestand.arrayBuffer());
  try {
    const afbeelding = sharp(data, {
      limitInputPixels: 16_000_000,
      failOn: "warning",
    });
    const metadata = await afbeelding.metadata();
    if (
      !["png", "jpeg"].includes(metadata.format ?? "") ||
      !metadata.width ||
      !metadata.height ||
      (metadata.pages ?? 1) > 1
    ) {
      throw new Error("invalid image");
    }
    await afbeelding.stats(); // Decodeer ook de pixels om beschadigde bestanden af te wijzen.
    return {
      logoData: new Uint8Array(data),
      logoMimeType: metadata.format === "png" ? "image/png" : "image/jpeg",
      logoNaam: bestand.name.slice(0, 200),
    };
  } catch {
    throw new Error(
      "Dit logo is geen geldige PNG of JPG, of heeft te veel pixels. Kies een afbeelding van maximaal 16 megapixels.",
    );
  }
}
