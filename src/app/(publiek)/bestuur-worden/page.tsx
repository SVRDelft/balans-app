import type { Metadata } from "next";

import { leesSvr, leesTekst } from "@/lib/content";

import { Blokken } from "../blokken";

export const dynamic = "force-static";

export const metadata: Metadata = {
  title: "Bestuur worden",
  description:
    "Wat het dagelijks bestuur van de StudieVerenigingenRaad Delft doet, de drie functies en hoe je solliciteert.",
  openGraph: {
    title: "Bestuur worden bij de SVR Delft",
    description:
      "Een parttime bestuursjaar naast je studie, samen met bestuurders van andere studieverenigingen.",
  },
};

export default function BestuurWorden() {
  const tekst = leesTekst("bestuur-worden");
  const svr = leesSvr();

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
        <p style={{ marginTop: "2rem" }}>
          <a className="knop" href={`mailto:${svr.email}`}>
            Stel je vraag aan het bestuur
          </a>
        </p>
      </div>
    </section>
  );
}
