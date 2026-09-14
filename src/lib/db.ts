import path from "node:path";
import { PrismaLibSql } from "@prisma/adapter-libsql";
// Bewust een relatief pad en niet de "@/"-alias: dit bestand wordt ook buiten
// Next.js geladen, door het seed-script.
import { PrismaClient } from "../generated/prisma/client";

/**
 * Een relatief `file:`-pad wordt uitgerekend vanaf de hoofdmap van het project,
 * zodat de Prisma CLI en de applicatie gegarandeerd hetzelfde bestand gebruiken.
 * Een niet-`file:`-adres (libsql of Turso) wordt ongewijzigd doorgegeven.
 */
export function bepaalDatabaseUrl(ruw = process.env.DATABASE_URL): string {
  if (!ruw || ruw.trim() === "") {
    throw new Error(
      "DATABASE_URL ontbreekt. Kopieer .env.example naar .env en vul het in.",
    );
  }
  if (!ruw.startsWith("file:")) return ruw;

  const pad = ruw.slice("file:".length);
  if (pad === "" || path.isAbsolute(pad)) return ruw;

  // turbopackIgnore: de bundler kan het pad niet statisch bepalen en zou
  // anders het hele project meenemen in de build-output.
  const absoluut = path.resolve(/* turbopackIgnore: true */ process.cwd(), pad);
  return `file:${absoluut.replace(/\\/g, "/")}`;
}

function maakClient(): PrismaClient {
  const adapter = new PrismaLibSql({ url: bepaalDatabaseUrl() });
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
