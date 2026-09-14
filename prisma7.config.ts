// Configuratie van de Prisma CLI (Prisma 7). De verbindingsgegevens staan hier
// en niet meer in schema.prisma.
import "./src/lib/env";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations-postgres",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    // Neon levert een apart adres zonder pooler voor migraties.
    url:
      process.env.NEON_DATABASE_URL_UNPOOLED ??
      process.env.NEON_DATABASE_URL ??
      process.env.DATABASE_URL_UNPOOLED ??
      process.env.DIRECT_DATABASE_URL ??
      process.env.DATABASE_URL,
  },
});
