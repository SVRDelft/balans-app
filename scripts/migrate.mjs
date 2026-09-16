import nextEnv from "@next/env";
import pg from "pg";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";

nextEnv.loadEnvConfig(process.cwd());
const [command = "deploy", ...args] = process.argv.slice(2);
if (!["deploy", "dev"].includes(command)) {
  throw new Error("Gebruik scripts/migrate.mjs met deploy of dev.");
}
const connectionString =
  process.env.NEON_DATABASE_URL_UNPOOLED ??
  process.env.NEON_DATABASE_URL ??
  process.env.DATABASE_URL_UNPOOLED ??
  process.env.DIRECT_DATABASE_URL ??
  process.env.DATABASE_URL;
if (!connectionString?.startsWith("postgres")) {
  throw new Error(
    "Een Postgres-databaseverbinding is nodig om migraties uit te voeren.",
  );
}
const client = new pg.Client({ connectionString });
try {
  await client.connect();
  const table = await client.query(
    `SELECT to_regclass('public._prisma_migrations') AS name`,
  );
  if (table.rows[0].name) {
    await client.query("BEGIN");
    // Serialize the one-time repair when two deployment builds start together.
    await client.query(
      'LOCK TABLE "_prisma_migrations" IN SHARE ROW EXCLUSIVE MODE',
    );
    const oldName = "20260914222511_voorraad_begrotingspost";
    const newName = "20260915100000_voorraad_begrotingspost";
    const { rows: history } = await client.query(
      'SELECT * FROM "_prisma_migrations" WHERE migration_name IN ($1, $2) AND rolled_back_at IS NULL',
      [oldName, newName],
    );
    const rows = history.filter((row) => row.migration_name === oldName);
    if (rows.length) {
      const sql = await readFile(
        `prisma/migrations-postgres/${newName}/migration.sql`,
        "utf8",
      );
      // Git can check out either LF or CRLF. The SQL itself is unchanged.
      const hashes = [
        sql,
        sql.replace(/\r\n/g, "\n"),
        sql.replace(/\r?\n/g, "\r\n"),
      ].map((value) => createHash("sha256").update(value).digest("hex"));
      if (
        rows.length !== 1 ||
        history.length !== 1 ||
        !rows[0].finished_at ||
        !hashes.includes(rows[0].checksum)
      ) {
        throw new Error(
          "De oude voorraadmigratie is niet volledig of wijkt af. Controleer de migratiehistorie voordat je doorgaat.",
        );
      }
      await client.query(
        'UPDATE "_prisma_migrations" SET migration_name = $1 WHERE id = $2',
        [newName, rows[0].id],
      );
      console.log(
        "Volgorde voorraadmigratie hersteld; bestaande tabellen en gegevens behouden.",
      );
    }
    await client.query("COMMIT");
  }
} catch (error) {
  await client.query("ROLLBACK").catch(() => {});
  throw error;
} finally {
  await client.end();
}
const result = spawnSync(
  process.execPath,
  ["node_modules/prisma/build/index.js", "migrate", command, ...args],
  { stdio: "inherit" },
);
if (result.error) console.error(result.error.message);
process.exitCode = result.status ?? 1;
