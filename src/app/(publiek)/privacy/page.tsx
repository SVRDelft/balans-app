import type { Metadata } from "next";

import { leesTekst } from "@/lib/content";

import { Blokken } from "../blokken";

export const dynamic = "force-static";

export const metadata: Metadata = {
  title: "Privacy",
  description:
    "Wat de site van de SVR Delft bewaart: geen tracking, alleen een sessiecookie na het inloggen.",
};

export default function Privacy() {
  const tekst = leesTekst("privacy");

  return (
    <section className="vlak wit">
      <div className="binnen tekst">
        <h1>{tekst.titel}</h1>
        <Blokken blokken={tekst.blokken} />
        {tekst.secties.map((sectie) => (
          <div key={sectie.kop}>
            <h2>{sectie.kop}</h2>
            <Blokken blokken={sectie.blokken} />
            {sectie.onderdelen.map((onderdeel) => (
              <div key={onderdeel.kop}>
                <h3>{onderdeel.kop}</h3>
                <Blokken blokken={onderdeel.blokken} />
              </div>
            ))}
          </div>
        ))}
      </div>
    </section>
  );
}
