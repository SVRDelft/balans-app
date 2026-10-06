// Alleen voor `npm run migrate` op de server. Dit bestand komt uit
// scripts/deploy-bundel.mjs en wordt bij elke nieuwe versie overschreven:
// pas het dus niet met de hand aan, maar zet de gegevens in .env.
import { readFileSync } from "node:fs";
import path from "node:path";
import { defineConfig } from "prisma/config";

/** Leest één sleutel uit het .env-bestand naast deze app. */
function uitEnvBestand(sleutel: string): string | undefined {
  try {
    const inhoud = readFileSync(path.join(process.cwd(), ".env"), "utf8");
    for (const regel of inhoud.split(/\r?\n/)) {
      const schoon = regel.trim();
      if (!schoon || schoon.startsWith("#")) continue;
      const scheiding = schoon.indexOf("=");
      if (scheiding === -1) continue;
      if (schoon.slice(0, scheiding).trim() !== sleutel) continue;
      return schoon
        .slice(scheiding + 1)
        .trim()
        .replace(/^["']|["']$/g, "");
    }
  } catch {
    // Geen .env naast de app: dan moet de omgevingsvariabele er al zijn.
  }
  return undefined;
}

const url = process.env.DATABASE_URL ?? uitEnvBestand("DATABASE_URL");
if (!url) {
  throw new Error(
    "DATABASE_URL is nergens gevonden. Zet hem in het bestand .env naast deze app (dezelfde map als server.js), of in de omgevingsvariabelen van Node.js in Plesk.",
  );
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { path: "prisma/migrations-mysql" },
  datasource: { url },
});
