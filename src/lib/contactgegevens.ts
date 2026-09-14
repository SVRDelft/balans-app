import { z } from "zod";

export const contactVelden = {
  contactpersoon: z.string().trim().max(120).default(""),
  email: z
    .union([z.literal(""), z.email("Dit is geen geldig e-mailadres.")])
    .default(""),
  adres: z.string().trim().max(200).default(""),
  postcode: z.string().trim().max(20).default(""),
  plaats: z.string().trim().max(100).default(""),
  land: z.string().trim().max(80).default(""),
  telefoon: z.string().trim().max(50).default(""),
  website: z
    .union([
      z.literal(""),
      z
        .url({
          protocol: /^https?$/,
          error:
            "Gebruik een volledig webadres, bijvoorbeeld https://svr.tudelft.nl.",
        })
        .max(500),
    ])
    .default(""),
  kvkNummer: z.string().trim().max(30).default(""),
  btwNummer: z.string().trim().max(40).default(""),
  iban: z
    .string()
    .trim()
    .max(40)
    .transform((waarde) => waarde.replace(/\s/g, "").toUpperCase())
    .default(""),
};

export function leesContactgegevens(formulier: FormData) {
  return Object.fromEntries(
    Object.keys(contactVelden).map((naam) => [naam, formulier.get(naam) ?? ""]),
  );
}
