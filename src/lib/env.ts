import { loadEnvConfig } from "@next/env";

// Prisma en losse scripts laden dezelfde .env.local als Next.js.
loadEnvConfig(process.cwd(), process.env.NODE_ENV !== "production");
