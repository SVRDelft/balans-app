# Overstappen op Vercel met Postgres

De app draait nu op een SQLite-bestand op je eigen laptop. Dat is prima om mee
te beginnen, maar op Vercel werkt het niet: het bestandssysteem daar is niet
blijvend schrijfbaar, dus een SQLite-bestand raak je bij elke nieuwe versie
kwijt.

Het schema is bewust zo gebouwd dat de overstap klein is. Er staat nergens ruwe
SQL, er zijn geen SQLite-specifieke functies en geen enums. Wat je verandert is
de provider, de driver adapter en de omgevingsvariabelen.

Reken op een uur, inclusief het overzetten van de bestaande gegevens.

---

## 1. Een database aanmaken

Kies er één:

- **Neon** — <https://neon.tech>, gratis niveau is ruim genoeg voor de SVR.
- **Vercel Postgres** — aan te maken vanuit je Vercel-project onder *Storage*.

Beide geven je een connection string in de vorm:

```
postgresql://gebruiker:wachtwoord@host/database?sslmode=require
```

Neon geeft er twee: een *pooled* en een *direct* adres. Gebruik de pooled voor de
app en de directe voor de migraties.

---

## 2. Pakketten wisselen

```bash
npm uninstall @prisma/adapter-libsql @libsql/client
```

```bash
npm install @prisma/adapter-pg pg
```

```bash
npm install --save-dev @types/pg
```

---

## 3. `prisma/schema.prisma`

Eén regel:

```diff
 datasource db {
-  provider = "sqlite"
+  provider = "postgresql"
 }
```

---

## 4. `prisma7.config.ts`

Voeg het directe adres toe, zodat migraties niet via de pooler lopen:

```diff
   datasource: {
     url: env("DATABASE_URL"),
+    directUrl: env("DIRECT_DATABASE_URL"),
   },
```

---

## 5. `src/lib/db.ts`

Vervang de adapter. De rest van het bestand blijft zoals het is; de functie
`bepaalDatabaseUrl` mag weg, want die is er alleen voor `file:`-paden.

```ts
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client";

function maakClient(): PrismaClient {
  const adapter = new PrismaPg({
    connectionString: process.env.DATABASE_URL,
  });
  return new PrismaClient({ adapter });
}

const globaalVoorPrisma = globalThis as unknown as {
  prismaClient?: PrismaClient;
};

export const db: PrismaClient = globaalVoorPrisma.prismaClient ?? maakClient();

if (process.env.NODE_ENV !== "production") {
  globaalVoorPrisma.prismaClient = db;
}
```

---

## 6. Omgevingsvariabelen

Lokaal in `.env`:

```
DATABASE_URL="postgresql://…?sslmode=require"        # pooled
DIRECT_DATABASE_URL="postgresql://…?sslmode=require" # direct
APP_WACHTWOORD="…"
AUTH_SECRET="…"
```

In Vercel zet je dezelfde vier onder *Settings › Environment Variables*, voor
*Production*, *Preview* en *Development*. Gebruik daar een **ander en langer**
wachtwoord dan lokaal, en een verse `AUTH_SECRET`:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

---

## 7. Migraties opnieuw aanmaken

De bestaande migraties in `prisma/migrations/` zijn SQLite-SQL en werken niet op
Postgres. Gooi ze weg en maak er één nieuwe van:

```bash
rm -rf prisma/migrations
```

```bash
npx prisma migrate dev --name initieel-postgres
```

Controleer of het werkt:

```bash
npm run db:seed
```

```bash
npm run dev
```

---

## 8. Bestaande gegevens meenemen

Sla deze stap over als je op Vercel opnieuw wilt beginnen; draai dan alleen
`npm run db:seed` tegen de nieuwe database.

Wil je de administratie van dit jaar wél meenemen, gebruik dan het script
hieronder. Het leest de oude SQLite-database en schrijft alles in de juiste
volgorde naar Postgres, inclusief de bonnetjes.

Zet het in `scripts/overzetten.mts`:

```ts
import "dotenv/config";
import { PrismaLibSql } from "@prisma/adapter-libsql";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const oud = new PrismaClient({
  adapter: new PrismaLibSql({ url: "file:./prisma/dev.db" }),
});
const nieuw = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

// De volgorde is belangrijk: een tabel komt pas nadat alles waar hij naar
// verwijst er al staat.
const volgorde = [
  "instellingen",
  "boekjaar",
  "relatie",
  "begrotingspost",
  "evenement",
  "deelnemer",
  "omslagronde",
  "bijlage",
  "uitgave",
  "factuur",
  "factuurregel",
  "betaling",
  "omslagrondeDeelnemer",
  "banksaldo",
  "auditlog",
] as const;

for (const tabel of volgorde) {
  const rijen = await (oud as never as Record<string, { findMany: () => Promise<unknown[]> }>)[tabel].findMany();
  for (const rij of rijen) {
    await (nieuw as never as Record<string, { create: (a: unknown) => Promise<unknown> }>)[tabel].create({ data: rij });
  }
  console.log(`${tabel}: ${rijen.length}`);
}

// De factuurteller staat al goed omdat het boekjaar één-op-één is overgezet.
await oud.$disconnect();
await nieuw.$disconnect();
```

Draaien (houd `@prisma/adapter-libsql` nog even geïnstalleerd, of installeer hem
tijdelijk opnieuw):

```bash
npx tsx scripts/overzetten.mts
```

Controleer daarna in de app of het aantal facturen, het resultaat en de balans
overeenkomen met de oude situatie. Verwijder het script en
`@prisma/adapter-libsql` als het klopt.

---

## 9. Naar Vercel

```bash
npm install -g vercel
```

```bash
vercel link
```

```bash
vercel --prod
```

`prisma generate` draait vanzelf mee, want dat staat als `postinstall` in
`package.json`.

De migraties draaien niet vanzelf. Doe dat één keer vanaf je eigen machine met de
productie-`DATABASE_URL` in je `.env`:

```bash
npx prisma migrate deploy
```

Of laat Vercel het bij elke build doen door het build-commando in
`package.json` te veranderen:

```json
"build": "prisma migrate deploy && next build"
```

---

## 10. Nalopen

- [ ] Inloggen werkt met het wachtwoord uit de Vercel-omgevingsvariabelen
- [ ] Het dashboard toont de juiste cijfers
- [ ] Een factuur-PDF opent (`/api/facturen/…/pdf`)
- [ ] De Excel-export downloadt (`/api/export/excel`)
- [ ] Een bonnetje uploaden werkt en is daarna te openen
- [ ] De balans sluit en het bankverschil is hetzelfde als daarvoor

---

## Wat je op Vercel niet moet vergeten

**Bestandsgrootte.** Bonnetjes staan in de database. Dat werkt prima op
Postgres, maar de limiet van 5 MB per bestand in `src/app/(app)/uitgaven/acties.ts`
en `bodySizeLimit` in `next.config.ts` horen bij elkaar. Verhoog je de een, doe
dan ook de ander.

**Back-ups.** SQLite kon je kopiëren door het bestand te kopiëren. Bij Neon zet
je back-ups aan in het dashboard; doe dat meteen, want de administratie van een
heel bestuursjaar staat erin.

**Geen koppeling met de bank.** Die was er niet en hoort er niet te komen; de
app is er niet omheen ontworpen.
