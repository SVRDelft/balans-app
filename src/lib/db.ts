import { PrismaMariaDb } from "@prisma/adapter-mariadb";
// Bewust een relatief pad en niet de "@/"-alias: dit bestand wordt ook buiten
// Next.js geladen, door het seed-script.
import { PrismaClient } from "../generated/prisma/client";

function maakClient(): PrismaClient {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString || !/^mysql:\/\//.test(connectionString)) {
    throw new Error(
      "DATABASE_URL moet een MariaDB-adres zijn, bijvoorbeeld mysql://gebruiker:wachtwoord@localhost:3306/svr. Zie .env.example.",
    );
  }
  // De MariaDB-driver is pure JavaScript: geen gecompileerde onderdelen, zodat
  // dezelfde code draait op de webserver van de TU Delft.
  const adres = new URL(connectionString);
  const adapter = new PrismaMariaDb({
    host: adres.hostname,
    port: adres.port ? Number(adres.port) : 3306,
    user: decodeURIComponent(adres.username),
    password: decodeURIComponent(adres.password),
    database: decodeURIComponent(adres.pathname.replace(/^\//, "")),
    // Passenger start meerdere processen naast elkaar; elk proces houdt dus
    // maar een paar verbindingen vast en laat ze niet eindeloos openstaan.
    connectionLimit: 5,
    idleTimeout: 10,
    connectTimeout: 10_000,
    // Datums staan in UTC, net als in de rest van de app.
    timezone: "Z",
  });
  return new PrismaClient({ adapter });
}

// In ontwikkeling wordt deze module bij elke herlaadbeurt opnieuw uitgevoerd;
// zonder deze cache loopt het aantal openstaande verbindingen op.
const globaalVoorPrisma = globalThis as unknown as {
  prismaClient?: PrismaClient;
};

function haalClient(): PrismaClient {
  const bestaand = globaalVoorPrisma.prismaClient;
  if (bestaand) return bestaand;
  const nieuw = maakClient();
  // Eén verbinding per proces: in ontwikkeling omdat deze module bij elke
  // herlaadbeurt opnieuw draait, in productie omdat Passenger meerdere
  // processen start die elk hun eigen verbinding houden.
  globaalVoorPrisma.prismaClient = nieuw;
  return nieuw;
}

/**
 * De verbinding wordt pas gemaakt bij het eerste gebruik, niet bij het laden van
 * dit bestand. Zo kan de app gebouwd worden zonder database (GitHub Actions) en
 * blijft de publieke site overeind als de database even niet bereikbaar is.
 */
export const db: PrismaClient = new Proxy({} as PrismaClient, {
  get(_doel, naam, ontvanger) {
    const client = haalClient();
    const waarde = Reflect.get(client, naam, ontvanger);
    return typeof waarde === "function" ? waarde.bind(client) : waarde;
  },
  has: (_doel, naam) => naam in haalClient(),
});
