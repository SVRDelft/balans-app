import nextEnv from "@next/env";

nextEnv.loadEnvConfig(process.cwd(), false);

const databaseUrl = process.env.NEON_DATABASE_URL ?? process.env.DATABASE_URL;
const password = process.env.APP_WACHTWOORD;
const secret = process.env.AUTH_SECRET;
const errors = [];

if (!databaseUrl || !/^postgres(ql)?:\/\//.test(databaseUrl)) {
  errors.push("Stel NEON_DATABASE_URL of DATABASE_URL in op een Postgres-adres.");
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
