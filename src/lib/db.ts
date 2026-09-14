import { PrismaPg } from "@prisma/adapter-pg";
// Bewust een relatief pad en niet de "@/"-alias: dit bestand wordt ook buiten
// Next.js geladen, door het seed-script.
import { PrismaClient } from "../generated/prisma/client";

function maakClient(): PrismaClient {
  const connectionString =
    process.env.NEON_DATABASE_URL ?? process.env.DATABASE_URL;
  if (!connectionString || !/^postgres(ql)?:\/\//.test(connectionString)) {
    throw new Error(
      "DATABASE_URL moet een Postgres-adres zijn. Haal de Vercel-variabelen op met vercel env pull .env.local.",
    );
  }
  const adapter = new PrismaPg({
    connectionString,
    max: 5,
    connectionTimeoutMillis: 10_000,
    idleTimeoutMillis: 10_000,
  });
  return new PrismaClient({ adapter });
}

// In ontwikkeling wordt deze module bij elke herlaadbeurt opnieuw uitgevoerd;
// zonder deze cache loopt het aantal openstaande verbindingen op.
const globaalVoorPrisma = globalThis as unknown as {
  prismaClient?: PrismaClient;
};

export const db: PrismaClient = globaalVoorPrisma.prismaClient ?? maakClient();

if (process.env.NODE_ENV !== "production") {
  globaalVoorPrisma.prismaClient = db;
}
