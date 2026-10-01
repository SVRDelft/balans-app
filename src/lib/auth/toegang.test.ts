import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

// Deze test loopt élke pagina, server action en API-route van de administratie
// langs. Vergeet iemand ooit de rolcontrole in een nieuw scherm, dan valt deze
// test om. Een server action is namelijk ook met een losse POST te bereiken,
// buiten de interface om; proxy.ts alleen is dus niet genoeg.

function bestanden(map: string): string[] {
  const uit: string[] = [];
  for (const naam of readdirSync(map)) {
    const pad = path.join(map, naam);
    if (statSync(pad).isDirectory()) {
      uit.push(...bestanden(pad));
    } else if (/\.tsx?$/.test(naam) && !naam.endsWith(".test.ts")) {
      uit.push(pad);
    }
  }
  return uit;
}

const lees = (pad: string) => readFileSync(pad, "utf8");

/** Bestanden die zelf geen toegang verlenen: losse formulieren en hulpstukken. */
const isPoort = (pad: string, inhoud: string) => {
  const naam = path.basename(pad);
  if (naam === "page.tsx" || naam === "route.ts" || naam === "layout.tsx") return true;
  // Een acties-bestand met "use server" bevat server actions.
  return inhoud.startsWith('"use server"');
};

describe("elke ingang van de administratie controleert de rol", () => {
  const paden = bestanden(path.join("src", "app", "beheer"));

  it("vindt alle schermen en acties", () => {
    expect(paden.length).toBeGreaterThan(30);
  });

  it.each(paden.map((pad) => [path.relative("src/app", pad), pad]))(
    "%s laat alleen het bestuur toe",
    (_naam, pad) => {
      const inhoud = lees(pad as string);
      if (!isPoort(pad as string, inhoud)) return;
      // Of de rol wordt hier gecontroleerd, of via de boekjaarcontext, die het
      // op zijn beurt zelf doet (zie src/lib/boekjaar.ts).
      const controleert =
        /vereisBestuur\(\)/.test(inhoud) ||
        /vereisBoekjaarContext\(\)/.test(inhoud) ||
        /vereisSchrijfbaarBoekjaar\(/.test(inhoud);
      expect(controleert, `${pad} controleert de rol niet`).toBe(true);
    },
  );

  it("gebruikt nergens meer de losse sessiecontrole zonder rol", () => {
    for (const pad of paden) {
      expect(lees(pad), `${pad} gebruikt vereisSessie in plaats van vereisBestuur`).not.toMatch(
        /\bvereisSessie\(\)/,
      );
    }
  });

  it("laat de boekjaarcontext zelf ook op de rol controleren", () => {
    const boekjaar = lees(path.join("src", "lib", "boekjaar.ts"));
    expect(boekjaar).toMatch(/await vereisBestuur\(\)/);
  });

  it("geeft bestanden van de administratie alleen aan het bestuur", () => {
    for (const route of [
      "src/app/api/bijlagen/[id]/route.ts",
      "src/app/api/export/excel/route.ts",
      "src/app/api/export/pdf/route.ts",
      "src/app/api/facturen/[id]/pdf/route.ts",
    ]) {
      expect(lees(route), `${route} controleert de rol niet`).toMatch(
        /rol === "BESTUUR"/,
      );
    }
  });

  it("houdt /beheer, /portaal, /wachtwoord en /api achter het slot", () => {
    const proxy = lees(path.join("src", "proxy.ts"));
    for (const pad of ["/beheer", "/portaal", "/api", "/wachtwoord"]) {
      expect(proxy).toContain(`"${pad}"`);
    }
  });
});
