import type { MetadataRoute } from "next";

/** Alleen de publieke pagina's; alles achter het slot hoort hier niet in. */
export default function sitemap(): MetadataRoute.Sitemap {
  const basis = "https://svr.tudelft.nl";
  const nu = new Date();
  return [
    { url: `${basis}/`, lastModified: nu, changeFrequency: "monthly", priority: 1 },
    { url: `${basis}/bestuur-worden`, lastModified: nu, changeFrequency: "yearly", priority: 0.8 },
    { url: `${basis}/privacy`, lastModified: nu, changeFrequency: "yearly", priority: 0.3 },
  ];
}
