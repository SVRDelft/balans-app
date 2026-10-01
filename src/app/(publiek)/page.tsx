import Link from "next/link";

import {
  initialen,
  leesBestuur,
  leesSvr,
  leesTekst,
  leesVerenigingen,
} from "@/lib/content";

import { Blokken } from "./blokken";

// Alles komt uit content/ en wordt tijdens de build vastgelegd: deze pagina
// raakt de database niet en blijft dus staan als die even weg is.
export const dynamic = "force-static";

/** De vijftien rond de tafel, zoals bij een echte vergadering. */
function Ring({ namen }: { namen: string[] }) {
  const midden = 240;
  const straal = 118;
  return (
    <svg className="ring" viewBox="0 0 480 440" role="img" aria-labelledby="ringkop">
      <title id="ringkop">
        De vijftien aangesloten studieverenigingen rond de tafel van de SVR
      </title>
      <circle className="tafel" cx={midden} cy={220} r={straal} />
      <text className="midden" x={midden} y={226} textAnchor="middle">
        SVR
      </text>
      {namen.map((naam, i) => {
        const hoek = (i / namen.length) * 2 * Math.PI - Math.PI / 2;
        const stoelX = midden + Math.cos(hoek) * (straal + 20);
        const stoelY = 220 + Math.sin(hoek) * (straal + 20);
        const tekstX = midden + Math.cos(hoek) * (straal + 48);
        const tekstY = 220 + Math.sin(hoek) * (straal + 48) + 5;
        const kant =
          Math.abs(Math.cos(hoek)) < 0.25
            ? "middle"
            : Math.cos(hoek) > 0
              ? "start"
              : "end";
        const wacht = { "--wacht": `${0.15 + i * 0.06}s` } as React.CSSProperties;
        return (
          <g key={naam}>
            <circle className="stoel" cx={stoelX} cy={stoelY} r={7} style={wacht} />
            <text
              className="naam"
              x={tekstX}
              y={tekstY}
              textAnchor={kant}
              style={wacht}
            >
              {naam}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

export default function Home() {
  const tekst = leesTekst("home");
  const svr = leesSvr();
  const verenigingen = leesVerenigingen();
  const bestuur = leesBestuur();

  return (
    <>
      <section className="hero">
        <div className="binnen">
          <div>
            <h1>{tekst.titel}</h1>
            <div className="lead">
              <Blokken blokken={tekst.blokken} />
            </div>
            <div className="acties">
              <Link className="knop" href="/bestuur-worden">
                Bestuur worden
              </Link>
              <a className="knop licht" href={`mailto:${svr.email}`}>
                Mail het bestuur
              </a>
            </div>
          </div>
          <Ring namen={verenigingen.map((vereniging) => vereniging.kort)} />
        </div>
      </section>

      {tekst.secties.map((sectie, i) => (
        <section key={sectie.kop} className={`vlak ${i % 2 === 0 ? "wit" : ""}`}>
          <div className="binnen">
            <h2>{sectie.kop}</h2>
            <Blokken blokken={sectie.blokken} />
            {sectie.onderdelen.length > 0 ? (
              <div className="kaarten">
                {sectie.onderdelen.map((onderdeel) => (
                  <article className="kaart" key={onderdeel.kop}>
                    <h3>{onderdeel.kop}</h3>
                    <Blokken blokken={onderdeel.blokken} />
                  </article>
                ))}
              </div>
            ) : null}
          </div>
        </section>
      ))}

      <section className="vlak" id="verenigingen">
        <div className="binnen">
          <h2>De vijftien</h2>
          <p>Deze studieverenigingen zijn aangesloten bij de SVR.</p>
          <ul className="verenigingen">
            {verenigingen.map((vereniging) => (
              <li key={vereniging.naam}>
                <strong>{vereniging.naam}</strong>
                <span>{vereniging.faculteit}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="vlak wit" id="bestuur">
        <div className="binnen">
          <h2>Bestuur {bestuur.nummer}</h2>
          <p>
            Het {bestuur.nummer}e dagelijks bestuur, sinds{" "}
            {new Date(bestuur.startdatum).toLocaleDateString("nl-NL", {
              day: "numeric",
              month: "long",
              year: "numeric",
              timeZone: "UTC",
            })}
            .
          </p>
          <ul className="personen">
            {bestuur.leden.map((lid) => (
              <li key={lid.naam}>
                {lid.foto ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={`/img/${lid.foto}`} alt="" width={80} height={80} />
                ) : (
                  <span className="geenfoto strepen" aria-hidden>
                    {initialen(lid.naam)}
                  </span>
                )}
                <span>
                  <strong>{lid.naam}</strong>
                  <span>{lid.functie}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="vlak" id="contact">
        <div className="binnen">
          <h2>Contact</h2>
          <div className="contact">
            <div>
              <p>
                Vragen over de SVR, een vergadering of samenwerken? Mail het
                bestuur; we lezen alles.
              </p>
              <address>
                <a href={`mailto:${svr.email}`}>{svr.email}</a>
                <br />
                {svr.adres}
                <br />
                {svr.plaats}
              </address>
            </div>
            <div>
              <p>
                Ben je bestuurder van een aangesloten vereniging? Agenda&apos;s en
                notulen staan in het portaal.
              </p>
              <Link className="knop" href="/inloggen">
                Naar het portaal
              </Link>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
