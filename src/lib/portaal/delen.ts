import "server-only";

import { randomBytes } from "node:crypto";

import { db } from "@/lib/db";

// Agenda's en notulen kunnen buiten het portaal gedeeld worden met een link
// die een geheime sleutel bevat. Wie de link heeft, kan het stuk openen zonder
// in te loggen; wie hem niet heeft, kan hem niet raden (32 willekeurige bytes).
// Zoekmachines krijgen bij elk antwoord "noindex" mee, en /delen staat niet in
// de sitemap: een gedeelde link komt dus niet in Google terecht.

/** Alleen deze soorten mogen gedeeld worden; losse documenten blijven binnen. */
export const DEELBARE_SOORTEN = ["agenda", "notulen"] as const;

export const isDeelbaar = (soort: string) =>
  (DEELBARE_SOORTEN as readonly string[]).includes(soort);

export const deelpad = (sleutel: string) => `/delen/${sleutel}`;

/** Een sleutel die in een adres past: alleen letters, cijfers, - en _. */
export const maakDeelsleutel = () => randomBytes(32).toString("base64url");

/** Ziet eruit als een sleutel? Zo gaat er geen onzin naar de database. */
export const lijktOpDeelsleutel = (sleutel: string) => /^[A-Za-z0-9_-]{43}$/.test(sleutel);

/**
 * De deellink van een agenda of notulen. Bestaat er al een, dan blijft die
 * gelden: iedereen die hem al heeft, kan er dan nog steeds bij.
 */
export async function zorgVoorDeellink(
  bestandId: string,
): Promise<{ pad: string; titel: string } | { fout: string }> {
  const bestand = await db.portaalbestand.findUnique({
    where: { id: bestandId },
    select: { soort: true, titel: true, deelsleutel: true },
  });
  if (!bestand) return { fout: "Dit stuk bestaat niet meer." };
  if (!isDeelbaar(bestand.soort)) {
    return { fout: "Alleen agenda's en notulen kunnen gedeeld worden." };
  }
  if (bestand.deelsleutel) return { pad: deelpad(bestand.deelsleutel), titel: bestand.titel };

  const sleutel = maakDeelsleutel();
  await db.portaalbestand.update({
    where: { id: bestandId },
    data: { deelsleutel: sleutel, gedeeldOp: new Date() },
  });
  return { pad: deelpad(sleutel), titel: bestand.titel };
}

/** Het stuk achter een deellink, of niets. */
export async function zoekGedeeldBestand(sleutel: string) {
  if (!lijktOpDeelsleutel(sleutel)) return null;
  const bestand = await db.portaalbestand.findUnique({ where: { deelsleutel: sleutel } });
  if (!bestand || !isDeelbaar(bestand.soort)) return null;
  return bestand;
}
