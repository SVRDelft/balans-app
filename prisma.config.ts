// Alleen voor `npm run migrate` op de server.
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { path: "prisma/migrations-mysql" },
  datasource: { url: process.env.DATABASE_URL },
});
