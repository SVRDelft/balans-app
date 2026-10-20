import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // De app draait op de webserver van de TU Delft (Plesk met Passenger). Een
  // standalone build neemt alleen mee wat nodig is; de server krijgt dus geen
  // broncode en hoeft zelf niets te installeren.
  output: "standalone",
  // Verkleinen van afbeeldingen vraagt een gecompileerde bibliotheek; die kan
  // daar niet draaien. Afbeeldingen gaan zoals ze zijn.
  images: { unoptimized: true },
  distDir: process.env.E2E_BASE_URL ? ".next-e2e" : ".next",
  outputFileTracingIncludes: {
    "/api/**": ["./public/svr-logo.jpg"],
  },
  // Bonnetjes gaan als bestand door een server action heen; de standaardlimiet
  // van 1 MB is daarvoor te krap.
  experimental: {
    serverActions: {
      // Agenda's en notulen mogen 20 MB zijn; de bonnetjes blijven kleiner.
      bodySizeLimit: "21mb",
      // In een GitHub Codespace draait de app achter een tunnel op een ander
      // adres dan de server zelf ziet.
      allowedOrigins: ["*.app.github.dev", "*.github.dev"],
    },
  },
  allowedDevOrigins: ["*.app.github.dev", "*.github.dev"],
};

export default nextConfig;
