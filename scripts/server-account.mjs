// Maakt het eerste bestuursaccount aan op de server, zonder Prisma en zonder
// TypeScript: dit bestand komt mee in de gebouwde versie en draait daar met
// `npm run account`. Het praat rechtstreeks met MariaDB via de driver die toch
// al in de bundel zit.
//
// Het e-mailadres en de naam komen uit de omgevingsvariabelen ACCOUNT_EMAIL en
// ACCOUNT_NAAM (in Plesk tijdelijk in te vullen), of van de opdrachtregel:
//
//   node account.js bestuur-svr@tudelft.nl "Je naam"
import { randomBytes, scrypt } from "node:crypto";
import mariadb from "mariadb";

const [argEmail, argNaam] = process.argv.slice(2);
const email = (argEmail ?? process.env.ACCOUNT_EMAIL ?? "").trim().toLowerCase();
const naam = (argNaam ?? process.env.ACCOUNT_NAAM ?? "").trim();

if (!email || !naam) {
  console.error(
    'Zet ACCOUNT_EMAIL en ACCOUNT_NAAM klaar, of gebruik: node account.js <e-mailadres> "<naam>"',
  );
  process.exit(1);
}

const adres = process.env.DATABASE_URL;
if (!adres?.startsWith("mysql://")) {
  console.error("DATABASE_URL ontbreekt of wijst niet naar MariaDB.");
  process.exit(1);
}

// Zelfde opslagvorm als src/lib/auth/wachtwoord.ts: scrypt$N$r$p$zout$hash.
const N = 16384;
const r = 8;
const p = 1;
const zout = randomBytes(16);
const tekens = "abcdefghjkmnpqrstuvwxyz23456789";
const ruw = randomBytes(16);
let wachtwoord = "";
for (let i = 0; i < 16; i += 1) {
  if (i > 0 && i % 4 === 0) wachtwoord += "-";
  wachtwoord += tekens[ruw[i] % tekens.length];
}

const hash = await new Promise((klaar, mislukt) =>
  scrypt(wachtwoord.normalize("NFKC"), zout, 32, { N, r, p, maxmem: 64 * 1024 * 1024 }, (fout, sleutel) =>
    fout ? mislukt(fout) : klaar(sleutel),
  ),
);
const opgeslagen = `scrypt$${N}$${r}$${p}$${zout.toString("hex")}$${hash.toString("hex")}`;

const url = new URL(adres);
const verbinding = await mariadb.createConnection({
  host: url.hostname,
  port: Number(url.port || 3306),
  user: decodeURIComponent(url.username),
  password: decodeURIComponent(url.password),
  database: decodeURIComponent(url.pathname.replace(/^\//, "")),
});

try {
  const [bestaand] = await verbinding.query(
    "SELECT COUNT(*) AS aantal FROM Gebruiker WHERE rol = 'BESTUUR' AND actief = 1",
  );
  if (Number(bestaand.aantal) > 0) {
    console.error(
      "Er is al een actief bestuursaccount. Maak verdere accounts aan via Beheer › Accounts.",
    );
    process.exit(1);
  }

  const id = randomBytes(12).toString("hex");
  await verbinding.query(
    "INSERT INTO Gebruiker (id, email, naam, rol, wachtwoordHash, moetWijzigen, actief, aangemaaktOp, bijgewerktOp) VALUES (?, ?, ?, 'BESTUUR', ?, 1, 1, NOW(3), NOW(3))",
    [id, email, naam, opgeslagen],
  );
  await verbinding.query(
    "INSERT INTO Auditlog (id, tijdstip, gebruiker, entiteit, entiteitId, actie, samenvatting) VALUES (?, NOW(3), ?, 'Gebruiker', ?, 'aangemaakt', ?)",
    [randomBytes(12).toString("hex"), naam, id, `Eerste bestuursaccount ${email} aangemaakt op de server`],
  );

  console.log(`\nAccount aangemaakt:\n  e-mailadres: ${email}\n  wachtwoord:  ${wachtwoord}\n`);
  console.log("Log hiermee in; de app vraagt meteen om een eigen wachtwoord.\n");
} finally {
  await verbinding.end();
}
