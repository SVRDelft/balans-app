import "server-only";

import { readFile } from "node:fs/promises";
import path from "node:path";
import { leesAfbeelding } from "./afbeelding";

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
  const afbeelding = leesAfbeelding(data);
  if (!afbeelding || afbeelding.breedte * afbeelding.hoogte > 16_000_000) {
    throw new Error(
      "Dit logo is geen geldige PNG of JPG, of heeft te veel pixels. Kies een afbeelding van maximaal 16 megapixels.",
    );
  }
  // Het bestand wordt bewaard zoals het is: verkleinen zou een gecompileerde
  // bibliotheek vragen, en die kan niet mee naar de server van de TU Delft.
  return {
    logoData: new Uint8Array(data),
    logoMimeType: afbeelding.formaat === "png" ? "image/png" : "image/jpeg",
    logoNaam: bestand.name.slice(0, 200),
  };
}
