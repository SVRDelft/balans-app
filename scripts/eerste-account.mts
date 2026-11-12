// Maakt het eerste bestuursaccount aan. Zonder account kan niemand inloggen,
// en dus ook niemand anderen toevoegen.
//
//   npx tsx scripts/eerste-account.mts bestuur-svr@tudelft.nl "Teun van den Corput"
//
// Het wachtwoord wordt verzonnen en één keer getoond. Bestaat er al een
// bestuursaccount, dan doet het script niets: verder beheer gaat via de app.
import "../src/lib/env";
import { db } from "../src/lib/db";
import { hashWachtwoord, maakWachtwoord } from "../src/lib/auth/wachtwoord";

const [email, naam] = process.argv.slice(2);
if (!email || !naam) {
  console.error(
    'Gebruik: npx tsx scripts/eerste-account.mts <e-mailadres> "<naam>"',
  );
  process.exit(1);
}

const bestaand = await db.gebruiker.count({ where: { rol: "BESTUUR", actief: true } });
if (bestaand > 0) {
  console.error(
    `Er ${bestaand === 1 ? "is al een actief bestuursaccount" : `zijn al ${bestaand} actieve bestuursaccounts`}. Maak verdere accounts aan via Beheer › Accounts.`,
  );
  await db.$disconnect();
  process.exit(1);
}

const wachtwoord = maakWachtwoord();
const gebruiker = await db.gebruiker.create({
  data: {
    email: email.trim().toLowerCase(),
    naam: naam.trim(),
    rol: "BESTUUR",
    wachtwoordHash: await hashWachtwoord(wachtwoord),
    moetWijzigen: true,
  },
});

await db.auditlog.create({
  data: {
    gebruiker: naam.trim(),
    entiteit: "Gebruiker",
    entiteitId: gebruiker.id,
    actie: "aangemaakt",
    samenvatting: `Eerste bestuursaccount ${gebruiker.email} aangemaakt via de opdrachtregel`,
  },
});

console.log(`\nAccount aangemaakt:\n  e-mailadres: ${gebruiker.email}\n  wachtwoord:  ${wachtwoord}\n`);
console.log("Log hiermee in; de app vraagt meteen om een eigen wachtwoord.\n");
await db.$disconnect();
