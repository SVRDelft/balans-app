import { loadEnvFile } from "node:process";
import { defineConfig, env } from "prisma/config";

// Gebruik voor migraties het databaseadres uit .env.
delete process.env.DATABASE_URL;
loadEnvFile();

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations-mysql",
  },
  datasource: {
    url: env("DATABASE_URL"),
  },
});
