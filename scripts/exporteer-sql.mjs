// Maakt één SQL-bestand van de administratie, klaar om in Plesk te importeren.
//
// De database op de server van de TU Delft is alleen vanaf die server zelf
// bereikbaar. Dit script leest daarom de lokale MariaDB (die je eerst vult met
// scripts/postgres-naar-mariadb.mts) en schrijft er INSERT-regels van.
//
//   node scripts/exporteer-sql.mjs                 → svr-gegevens.sql
//   node scripts/exporteer-sql.mjs mijnnaam.sql
//
// Accounts gaan bewust niet mee: die staan al op de server, en wachtwoorden
// horen niet in een bestand dat je door een webformulier haalt.
import nextEnv from "@next/env";
import mariadb from "mariadb";
import { writeFile } from "node:fs/promises";

nextEnv.loadEnvConfig(process.cwd());

/** Volgorde van de tabellen; met de sleutelcontrole uit maakt het niet uit, maar leesbaar is fijn. */
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
  "Spaarmutatie",
  "Mededeling",
  "Vergadering",
  "Portaalbestand",
  "Auditlog",
];

const uitBestand = process.argv[2] ?? "svr-gegevens.sql";
const adres = process.env.DATABASE_URL;
if (!adres?.startsWith("mysql://")) {
  throw new Error("DATABASE_URL moet naar de lokale MariaDB wijzen.");
}

const url = new URL(adres);
const verbinding = await mariadb.createConnection({
  host: url.hostname,
  port: Number(url.port || 3306),
  user: decodeURIComponent(url.username),
  password: decodeURIComponent(url.password),
  database: decodeURIComponent(url.pathname.replace(/^\//, "")),
  timezone: "Z",
  dateStrings: true,
});

/** Eén waarde als SQL. Tekst gaat met enkele aanhalingstekens, bytes hexadecimaal. */
function alsSql(waarde) {
  if (waarde === null || waarde === undefined) return "NULL";
  if (typeof waarde === "number") return String(waarde);
  if (typeof waarde === "bigint") return waarde.toString();
  if (typeof waarde === "boolean") return waarde ? "1" : "0";
  if (Buffer.isBuffer(waarde)) return `0x${waarde.toString("hex")}`;
  if (waarde instanceof Date) return `'${waarde.toISOString().slice(0, 23).replace("T", " ")}'`;
  const tekst = String(waarde)
    .replace(/\\/g, "\\\\")
    .replace(/'/g, "\\'")
    .replace(/\n/g, "\\n")
    .replace(/\r/g, "\\r")
    .replace(/\0/g, "\\0")
    .replace(/\x1a/g, "\\Z");
  return `'${tekst}'`;
}

const regels = [
  "-- Administratie van de StudieVerenigingenRaad Delft.",
  `-- Gemaakt op ${new Date().toISOString()} met scripts/exporteer-sql.mjs.`,
  "-- Importeer dit in een database waarin de tabellen al bestaan (npm run migrate)",
  "-- en waarin nog geen boekingen staan. Accounts en inlogpogingen zitten er niet in.",
  "",
  "SET NAMES utf8mb4;",
  "SET FOREIGN_KEY_CHECKS = 0;",
  "SET SQL_MODE = 'NO_AUTO_VALUE_ON_ZERO';",
  "",
];

const telling = [];

try {
  for (const tabel of TABELLEN) {
    const rijen = await verbinding.query(`SELECT * FROM \`${tabel}\``);
    const kolommen = rijen.meta?.map((kolom) => kolom.name()) ?? [];
    let centen = 0;
    for (const rij of rijen) {
      for (const [naam, waarde] of Object.entries(rij)) {
        if (naam.endsWith("Centen") && typeof waarde === "number") centen += waarde;
      }
    }
    telling.push({ tabel, rijen: rijen.length, centen });

    regels.push(`-- ${tabel}: ${rijen.length} rijen`);
    if (rijen.length === 0) {
      regels.push("");
      continue;
    }

    const kolomlijst = kolommen.map((naam) => `\`${naam}\``).join(", ");
    // In groepjes, zodat één regel niet megabytes lang wordt.
    for (let i = 0; i < rijen.length; i += 50) {
      const groep = rijen.slice(i, i + 50);
      const waarden = groep
        .map((rij) => `  (${kolommen.map((naam) => alsSql(rij[naam])).join(", ")})`)
        .join(",\n");
      regels.push(`INSERT INTO \`${tabel}\` (${kolomlijst}) VALUES\n${waarden};`);
    }
    regels.push("");
  }
} finally {
  await verbinding.end();
}

regels.push("SET FOREIGN_KEY_CHECKS = 1;", "");
regels.push("-- Controleer na het importeren of dit klopt:");
for (const regel of telling) {
  regels.push(`--   ${regel.tabel.padEnd(22)} ${String(regel.rijen).padStart(5)} rijen, ${regel.centen} centen`);
}
regels.push("");

await writeFile(uitBestand, regels.join("\n"), "utf8");

console.log(`\n${uitBestand} geschreven.\n`);
for (const regel of telling) {
  if (regel.rijen > 0) {
    console.log(
      `  ${regel.tabel.padEnd(22)} ${String(regel.rijen).padStart(5)} rijen${regel.centen ? `, ${(regel.centen / 100).toFixed(2)} euro` : ""}`,
    );
  }
}
console.log("\nImporteer het bestand in Plesk; zie DEPLOY.md, kopje \"Gegevens overzetten\".");
