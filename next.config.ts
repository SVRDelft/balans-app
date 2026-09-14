import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  outputFileTracingIncludes: {
    "/api/**": ["./public/svr-logo.jpg"],
  },
  // Bonnetjes gaan als bestand door een server action heen; de standaardlimiet
  // van 1 MB is daarvoor te krap.
  experimental: {
    serverActions: {
      bodySizeLimit: "4.5mb",
      // In een GitHub Codespace draait de app achter een tunnel op een ander
      // adres dan de server zelf ziet.
      allowedOrigins: ["*.app.github.dev", "*.github.dev"],
    },
  },
  allowedDevOrigins: ["*.app.github.dev", "*.github.dev"],
};

export default nextConfig;
