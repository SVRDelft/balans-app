import type { MetadataRoute } from "next";

/** Publieke pagina's mogen in Google; alles achter het slot niet. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/beheer", "/portaal", "/inloggen", "/api"],
    },
  };
}
