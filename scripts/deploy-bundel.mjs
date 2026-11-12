// Zet de gebouwde app klaar in de map deploy/: precies wat de webserver van de
// TU Delft nodig heeft, en niets meer. Geen broncode, geen .env, geen
// ontwikkelgereedschap.
//
//   npm run build && node scripts/deploy-bundel.mjs
//
// GitHub Actions doet hetzelfde en zet het resultaat op de branch `deploy`.
import { cp, mkdir, rm, writeFile, readFile, access } from "node:fs/promises";
import path from "node:path";

const wortel = process.cwd();
const uit = path.join(wortel, "deploy");

const bestaat = async (pad) => {
  try {
    await access(pad);
    return true;
  } catch {
    return false;
  }
};

if (!(await bestaat(path.join(wortel, ".next/standalone/server.js")))) {
  throw new Error("Draai eerst `npm run build`; .next/standalone ontbreekt.");
}

await rm(uit, { recursive: true, force: true });
await mkdir(uit, { recursive: true });

// 1. De standalone build: server.js, .next en de node_modules die echt nodig zijn.
await cp(path.join(wortel, ".next/standalone"), uit, {
  recursive: true,
  // Next legt symlinks in node_modules; Windows mag die niet maken en de
  // server heeft liever gewone bestanden.
  dereference: true,
  // Next kopieert .env mee de standalone-map in; die hoort hier nooit terecht
  // te komen, want de branch is leesbaar voor iedereen met toegang tot de repo.
  filter: (bron) => !/[\\/]\.env(\.|$)/.test(bron),
});

// 2. De statische bestanden van de build en de publieke map.
await cp(path.join(wortel, ".next/static"), path.join(uit, ".next/static"), {
  recursive: true,
});
await cp(path.join(wortel, "public"), path.join(uit, "public"), { recursive: true });

// 3. De migraties, zodat de database op de server bijgewerkt kan worden.
await cp(path.join(wortel, "prisma/schema.prisma"), path.join(uit, "prisma/schema.prisma"));
await cp(
  path.join(wortel, "prisma/migrations-mysql"),
  path.join(uit, "prisma/migrations-mysql"),
  { recursive: true },
);

// 4. Een eigen configuratie voor de Prisma-opdrachtregel op de server: geen
//    verwijzing naar src/, en hij zoekt zelf naar DATABASE_URL.
//
//    Prisma 7 leest .env niet meer vanzelf, en de knop "Run script" in Plesk
//    draait los van de omgevingsvariabelen van de app. Zonder dit faalt
//    `npm run migrate` op de server met een lege datasource. Daarom leest deze
//    configuratie het .env-bestand naast de app zelf, en geeft hij anders een
//    melding waar je iets aan hebt.
await writeFile(
  path.join(uit, "prisma.config.ts"),
  `// Alleen voor \`npm run migrate\` op de server. Dit bestand komt uit
// scripts/deploy-bundel.mjs en wordt bij elke nieuwe versie overschreven:
// pas het dus niet met de hand aan, maar zet de gegevens in .env.
import { readFileSync } from "node:fs";
import path from "node:path";
import { defineConfig } from "prisma/config";

/** Leest één sleutel uit het .env-bestand naast deze app. */
function uitEnvBestand(sleutel: string): string | undefined {
  try {
    const inhoud = readFileSync(path.join(process.cwd(), ".env"), "utf8");
    for (const regel of inhoud.split(/\\r?\\n/)) {
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
`,
);

// 5. Het hulpje om op de server het eerste bestuursaccount te maken.
await cp(path.join(wortel, "scripts/server-account.mjs"), path.join(uit, "account.js"));

// 6. Een kleine package.json. Plesk gebruikt die voor "NPM install" (alleen de
//    Prisma-opdrachtregel) en voor de knop die de migraties draait.
const origineel = JSON.parse(await readFile(path.join(wortel, "package.json"), "utf8"));
await writeFile(
  path.join(uit, "package.json"),
  `${JSON.stringify(
    {
      name: "svr-app",
      version: origineel.version,
      private: true,
      description: "Gebouwde versie voor de webserver van de TU Delft. Niet bewerken; dit komt uit GitHub Actions.",
      scripts: {
        start: "node server.js",
        migrate: "prisma migrate deploy",
        account: "node account.js",
      },
      dependencies: {
        // Alleen nodig om migraties te kunnen draaien; de app zelf heeft zijn
        // afhankelijkheden al in node_modules staan.
        prisma: origineel.devDependencies.prisma,
      },
      engines: { node: ">=20.9.0" },
    },
    null,
    2,
  )}\n`,
);

await writeFile(
  path.join(uit, "LEESMIJ.md"),
  `# Gebouwde versie

Deze map is het resultaat van \`npm run build\` en wordt automatisch gemaakt.
**Bewerk hier niets**: bij de volgende deploy is het weg.

- \`server.js\` is het opstartbestand voor Passenger.
- \`public/\` is de document root in Plesk.
- \`prisma/\` staat erbij om op de server \`npm run migrate\` te kunnen draaien.
- \`storage/\` wordt vanzelf aangemaakt zodra er iets wordt geüpload en blijft
  bij een nieuwe deploy staan.

De stappen in Plesk staan in DEPLOY.md in de hoofdbranch.
`,
);

console.log(`Klaar: ${path.relative(wortel, uit)}/ staat klaar voor de server.`);
