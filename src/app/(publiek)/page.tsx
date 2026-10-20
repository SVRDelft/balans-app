import Link from "next/link";

import {
  leesBestuur,
  leesOverleggen,
  leesTekst,
  leesVerenigingen,
  logoBestand,
} from "@/lib/content";

import { Blokken } from "./blokken";
import { Contact, DeVijftien, Ontdek, Vragen, WatWeDoen } from "./secties";
import { Tafel } from "./tafel";

// Alles komt uit content/ en wordt tijdens de build vastgelegd: deze pagina
// raakt de database niet en blijft dus staan als die even weg is.
export const dynamic = "force-static";

export default function Home() {
  const tekst = leesTekst("home");
  const verenigingen = leesVerenigingen();
  const bestuur = leesBestuur();
  const overleggen = leesOverleggen();

  return (
    <>
      {/* 1. Opening */}
      <section className="hero">
        <div className="binnen">
          <div className="hero-tekst">
            <h1>{tekst.titel}</h1>
            <div className="lead">
              <Blokken blokken={tekst.blokken} />
            </div>
            <div className="acties">
              <Link className="knop" href="/wat-we-doen">
                Wat we doen
              </Link>
              <Link className="knop licht" href="/bestuur-worden">
                Bestuur worden
              </Link>
            </div>
          </div>
          <div className="hero-tafel">
            <Tafel verenigingen={verenigingen} logo={logoBestand()} />
            <p className="tafel-uitleg">
              Vijftien stoelen, vijftien verenigingen, op volgorde van oprichting
              met de oudste bovenaan. Wijs een stoel aan voor de faculteit, of klik
              door naar hun site.
            </p>
          </div>
        </div>
      </section>

      {/* De band met de namen, in het motief van de das. */}
      <div className="band strepen" aria-hidden>
        <div className="bandloop">
          {[0, 1].map((herhaling) => (
            <span key={herhaling}>
              {verenigingen.map((vereniging) => (
                <span key={vereniging.slug}>{vereniging.naam}</span>
              ))}
            </span>
          ))}
        </div>
      </div>

      {/* 2. Vier feiten */}
      <section className="vlak feiten">
        <div className="binnen">
          <p className="feitenzin">
            Opgericht op <strong>26 februari 1963</strong>, vertegenwoordigt de SVR{" "}
            <strong>{verenigingen.length}</strong> studieverenigingen, die elkaar in{" "}
            <strong>{overleggen.length}</strong> vaste overleggen spreken. Dit jaar
            onder leiding van het <strong>{bestuur.nummer}e</strong> dagelijks bestuur.
          </p>
        </div>
      </section>

      {/* 3. Wat we doen, kort; de rest staat op de losse pagina's */}
      <WatWeDoen />
      <Ontdek />
      <DeVijftien />
      <Vragen />
      <Contact />
    </>
  );
}
