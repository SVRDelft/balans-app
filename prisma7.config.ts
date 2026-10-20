// Configuratie van de Prisma CLI (Prisma 7). De verbindingsgegevens staan hier
// en niet meer in schema.prisma.
import "./src/lib/env";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    // MariaDB op de server van de TU Delft. De oude Postgres-migraties staan
    // nog in prisma/migrations-postgres, voor de app die nu op Vercel draait.
    path: "prisma/migrations-mysql",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    url: process.env.DATABASE_URL,
  },
});
