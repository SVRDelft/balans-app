import nextEnv from "@next/env";

nextEnv.loadEnvConfig(process.cwd(), false);

const databaseUrl = process.env.DATABASE_URL;
const password = process.env.APP_WACHTWOORD;
const secret = process.env.AUTH_SECRET;
const errors = [];

if (!databaseUrl || !/^mysql:\/\//.test(databaseUrl)) {
  errors.push("Stel DATABASE_URL in op een MariaDB-adres, bijvoorbeeld mysql://svr:...@localhost:3306/svr.");
}
if (!password || password === "verander-dit-wachtwoord" || password === "[SENSITIVE]") {
  errors.push("Stel APP_WACHTWOORD in op een eigen wachtwoord.");
}
if (!secret || secret.length < 16 || secret.startsWith("verander-dit")) {
  errors.push("Stel AUTH_SECRET in op een lange willekeurige sleutel.");
}
if (errors.length) {
  console.error(errors.join("\n"));
  process.exitCode = 1;
} else {
  console.log("Database- en inloginstellingen zijn aanwezig.");
}
