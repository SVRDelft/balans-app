// Zet de administratie eenmalig over van de oude Postgres-database (Neon,
// achter de app op Vercel) naar MariaDB. Daarna controleert het script per
// tabel of de aantallen en de totaalbedragen gelijk zijn.
//
//   npx vercel env pull .env.local     haalt NEON_DATABASE_URL op
//   npx tsx scripts/postgres-naar-mariadb.mts            laat zien wat er staat
//   npx tsx scripts/postgres-naar-mariadb.mts --schrijf  zet het over
//
// De MariaDB-kant moet leeg zijn: het script voegt toe, het overschrijft niets.
import "../src/lib/env";
import pg from "pg";
import { db } from "../src/lib/db";

/** Volgorde telt: een tabel komt pas als alles waarnaar hij verwijst er staat. */
const TABELLEN = [
  "Instellingen",
  "Boekjaar",
  "Relatie",
  "Begrotingspost",
  "Evenement",
  "Omslagronde",
  "Bijlage",
  "Uitgave",
  "Factuur",
  "Factuurregel",
  "Betaling",
  "Deelnemer",
  "OmslagrondeDeelnemer",
  "Banksaldo",
  "Bankimport",
  "Bankmutatie",
  "Voorraadpost",
  "Rekeningpost",
  "Auditlog",
] as const;
type Tabel = (typeof TABELLEN)[number];

const model = (tabel: Tabel) =>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (db as any)[tabel.charAt(0).toLowerCase() + tabel.slice(1)];

const schrijf = process.argv.includes("--schrijf");
// Bewust één eigen variabele: .env.local bevat de ontwikkeldatabase, en die wil
// je hier nooit per ongeluk lezen. Zet BRON_POSTGRES_URL op het adres van de
// database die je echt wilt overzetten.
const adres =
  process.env.BRON_POSTGRES_URL ??
  process.env.NEON_DATABASE_URL_UNPOOLED ??
  process.env.NEON_DATABASE_URL ??
  process.env.POSTGRES_URL;
if (!adres?.startsWith("postgres")) {
  throw new Error(
    "Zet BRON_POSTGRES_URL op het Postgres-adres van de database die je wilt overzetten.",
  );
}
// Laten zien waar gelezen en geschreven wordt, zonder het wachtwoord.
const bronHost = new URL(adres).host;
const doelHost = new URL(process.env.DATABASE_URL ?? "mysql://onbekend").host;
console.log(`Lezen uit Postgres op ${bronHost}`);
console.log(`Schrijven naar MariaDB op ${doelHost}\n`);
if (!process.env.BRON_POSTGRES_URL) {
  console.log(
    "Let op: BRON_POSTGRES_URL is niet gezet, dus dit kan de ontwikkeldatabase zijn.\n",
  );
}

const bron = new pg.Client({ connectionString: adres });
await bron.connect();

/** Som van alle centen-kolommen, zodat een stille afrondingsfout opvalt. */
function centenSom(rijen: Record<string, unknown>[]) {
  let som = 0;
  for (const rij of rijen) {
    for (const [kolom, waarde] of Object.entries(rij)) {
      if (kolom.endsWith("Centen") && typeof waarde === "number") som += waarde;
    }
  }
  return som;
}

const verschillen: string[] = [];
/** Per factuur het boekjaar, om betalingen in het juiste jaar te zetten. */
const factuurJaren = new Map<string, string>();

try {
  for (const tabel of TABELLEN) {
    const { rows } = await bron.query<Record<string, unknown>>(
      `SELECT * FROM "${tabel}"`,
    );
    if (tabel === "Factuur") {
      for (const rij of rows) {
        factuurJaren.set(String(rij.id), String(rij.boekjaarId));
      }
    }
    const alAanwezig = await model(tabel).count();

    if (schrijf && rows.length > 0) {
      if (alAanwezig > 0) {
        throw new Error(
          `In MariaDB staan al ${alAanwezig} rijen in ${tabel}. Maak de database eerst leeg (npm run db:reset) en draai dit script opnieuw.`,
        );
      }
      // Een creditfactuur wijst naar een andere factuur in dezelfde tabel; die
      // koppeling komt in een tweede ronde, als alle facturen er staan.
      const uitgesteld =
        tabel === "Factuur"
          ? rows
              .filter((rij) => rij.crediteertFactuurId)
              .map((rij) => ({
                id: String(rij.id),
                crediteertFactuurId: String(rij.crediteertFactuurId),
              }))
          : [];
      // De oude database kende nog geen boekjaar op een betaling; dat volgt uit
      // de factuur waar de betaling bij hoort.
      const teSchrijven =
        tabel === "Factuur"
          ? rows.map((rij) => ({ ...rij, crediteertFactuurId: null }))
          : tabel === "Betaling"
            ? rows.map((rij) => ({
                ...rij,
                boekjaarId: rij.boekjaarId ?? factuurJaren.get(String(rij.factuurId)),
              }))
            : rows;

      // Bonnetjes kunnen megabytes zijn: in kleine groepjes wegschrijven.
      const groep = tabel === "Bijlage" ? 5 : 200;
      for (let i = 0; i < teSchrijven.length; i += groep) {
        await model(tabel).createMany({ data: teSchrijven.slice(i, i + groep) });
      }
      for (const rij of uitgesteld) {
        await model(tabel).update({
          where: { id: rij.id },
          data: { crediteertFactuurId: rij.crediteertFactuurId },
        });
      }
    }

    const nu = schrijf ? await model(tabel).count() : alAanwezig;
    const doelRijen: Record<string, unknown>[] = schrijf
      ? await model(tabel).findMany()
      : [];
    const bronSom = centenSom(rows);
    const doelSom = schrijf ? centenSom(doelRijen) : 0;

    const regel = `${tabel.padEnd(22)} bron ${String(rows.length).padStart(5)} rijen, ${bronSom
      .toString()
      .padStart(10)} centen${schrijf ? ` → MariaDB ${String(nu).padStart(5)} rijen, ${doelSom.toString().padStart(10)} centen` : ""}`;
    const klopt = !schrijf || (nu === rows.length && doelSom === bronSom);
    if (!klopt) verschillen.push(tabel);
    console.log(`${klopt ? "  " : "!!"} ${regel}`);
  }
} finally {
  await bron.end();
  await db.$disconnect();
}

if (!schrijf) {
  console.log("\nDroge loop: geef --schrijf mee om het echt over te zetten.");
} else if (verschillen.length > 0) {
  console.error(`\nNiet gelijk: ${verschillen.join(", ")}. Controleer dit voordat je verdergaat.`);
  process.exitCode = 1;
} else {
  console.log("\nAlle tabellen gelijk in aantal rijen en totaalbedrag.");
}
