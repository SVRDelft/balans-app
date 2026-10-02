import Link from "next/link";

import {
  initialen,
  leesBestuur,
  leesEvenementen,
  leesGeschiedenis,
  leesJaar,
  leesOverleggen,
  leesSamenwerking,
  leesSvr,
  leesTekst,
  leesTradities,
  leesVerenigingen,
  leesVragen,
  logoBestand,
} from "@/lib/content";

import { Blokken } from "./blokken";
import { Tafel } from "./tafel";
import { Verenigingenlijst } from "./verenigingenlijst";

// Alles komt uit content/ en wordt tijdens de build vastgelegd: deze pagina
// raakt de database niet en blijft dus staan als die even weg is.
export const dynamic = "force-static";

export default function Home() {
  const tekst = leesTekst("home");
  const svr = leesSvr();
  const verenigingen = leesVerenigingen();
  const bestuur = leesBestuur();
  const overleggen = leesOverleggen();
  const jaar = leesJaar();
  const evenementen = leesEvenementen();
  const tradities = leesTradities();
  const geschiedenis = leesGeschiedenis();
  const samenwerking = leesSamenwerking();
  const vragen = leesVragen();

  const watWeDoen = tekst.secties.find((sectie) => sectie.kop === "Wat we doen");
  const hoeHetWerkt = tekst.secties.find((sectie) => sectie.kop === "Hoe de SVR werkt");

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
              <a className="knop" href="#wat-we-doen">
                Wat we doen
              </a>
              <Link className="knop licht" href="/bestuur-worden">
                Bestuur worden
              </Link>
            </div>
          </div>
          <div className="hero-tafel">
            <Tafel verenigingen={verenigingen} logo={logoBestand()} />
            <p className="tafel-uitleg">
              Vijftien stoelen, vijftien verenigingen. Wijs een stoel aan voor de
              faculteit, of klik door naar hun site.
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

      {/* 3. Wat we doen */}
      <section className="vlak wit" id="wat-we-doen">
        <div className="binnen">
          <h2>Wat we doen</h2>
          <div className="pijlers">
            {watWeDoen?.onderdelen.map((pijler) => (
              <div key={pijler.kop}>
                <h3>{pijler.kop}</h3>
                <Blokken blokken={pijler.blokken} />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 4. Hoe de SVR werkt */}
      <section className="vlak donker" id="hoe-het-werkt">
        <div className="binnen">
          <h2>Hoe de SVR werkt</h2>
          <div className="schema">
            <svg className="schematekening" viewBox="0 0 320 240" role="img" aria-labelledby="schemakop">
              <title id="schemakop">
                Het Algemeen Bestuur beslist; het dagelijks bestuur en de informanten
                hebben geen stemrecht
              </title>
              <rect x="40" y="16" width="240" height="64" rx="10" className="doos ab" />
              <text x="160" y="42" textAnchor="middle" className="doos-naam">
                Algemeen Bestuur
              </text>
              <text x="160" y="62" textAnchor="middle" className="doos-uitleg">
                15 verenigingen · beslist
              </text>

              <line x1="100" y1="80" x2="100" y2="150" className="lijn" />
              <line x1="220" y1="80" x2="220" y2="150" className="lijn" />

              <rect x="20" y="150" width="160" height="62" rx="10" className="doos" />
              <text x="100" y="176" textAnchor="middle" className="doos-naam">
                Dagelijks Bestuur
              </text>
              <text x="100" y="195" textAnchor="middle" className="doos-uitleg">
                zit voor · geen stem
              </text>

              <rect x="196" y="150" width="104" height="62" rx="10" className="doos" />
              <text x="248" y="176" textAnchor="middle" className="doos-naam">
                Informanten
              </text>
              <text x="248" y="195" textAnchor="middle" className="doos-uitleg">
                geen stem
              </text>
            </svg>

            <div className="schema-tekst">
              {hoeHetWerkt?.onderdelen.map((onderdeel) => (
                <div key={onderdeel.kop}>
                  <h3>{onderdeel.kop}</h3>
                  <Blokken blokken={onderdeel.blokken} />
                </div>
              ))}
            </div>
          </div>

          <div className="namens">
            <h3>Namens de verenigingen</h3>
            <dl className="samenwerking">
              {samenwerking.map((partij) => (
                <div key={partij.partij}>
                  <dt>{partij.partij}</dt>
                  <dd>{partij.tekst}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </section>

      {/* 5. Aan tafel */}
      <section className="vlak" id="overleggen">
        <div className="binnen">
          <h2>Aan tafel</h2>
          <p>Vier overleggen, elk met zijn eigen gezelschap.</p>
          <div className="overleggen">
            {overleggen.map((overleg) => (
              <article key={overleg.naam}>
                <h3>{overleg.naam}</h3>
                <div>
                  <p className="wie">{overleg.wie}.</p>
                  <p className="details">
                    {overleg.hoeVaak}
                    {overleg.extra ? ` · ${overleg.extra}` : ""}. Over{" "}
                    {overleg.waarover.charAt(0).toLowerCase() + overleg.waarover.slice(1)}.
                    Voorgezeten door de {overleg.voorzitter.toLowerCase()}.
                  </p>
                </div>
              </article>
            ))}
          </div>
          <p className="terzijde">
            Bestuurslid van een studievereniging? De agenda&apos;s en notulen staan in{" "}
            <Link href="/inloggen">het portaal</Link>.
          </p>
        </div>
      </section>

      {/* 6. Een jaar SVR */}
      <section className="vlak wit" id="het-jaar">
        <div className="binnen">
          <h2>Een jaar SVR</h2>
          <p>Van de wissel in augustus tot de wissel daarna.</p>
          <ol
            className="tijdlijn"
            tabIndex={0}
            aria-label="Het jaar van de SVR, van augustus tot augustus"
          >
            {jaar.momenten.map((moment) => (
              <li key={moment.wanneer + moment.wat}>
                <span className="stip strepen" aria-hidden />
                <p className="wanneer">{moment.wanneer}</p>
                <p className="wat">{moment.wat}</p>
                {moment.datum ? <p className="datum">{moment.datum}</p> : null}
                <p className="uitleg">{moment.uitleg}</p>
              </li>
            ))}
          </ol>
          <p className="schuifhint">Schuif opzij voor de rest van het jaar.</p>
        </div>
      </section>

      {/* 7. Waar je ons tegenkomt */}
      <section className="vlak" id="organiseren">
        <div className="binnen">
          <h2>Waar je ons tegenkomt</h2>
          <div className="evenementen">
            {evenementen.map((evenement, i) => (
              <article key={evenement.naam} className={i === 0 ? "groot" : undefined}>
                {evenement.foto ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    className="foto"
                    src={`/img/events/${evenement.foto}`}
                    alt=""
                    loading="lazy"
                  />
                ) : (
                  <span className="foto leeg" aria-hidden />
                )}
                <div className="inhoud">
                  <h3>{evenement.naam}</h3>
                  <p>{evenement.tekst}</p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* 9. De vijftien */}
      <section className="vlak wit" id="verenigingen">
        <div className="binnen">
          <h2>De vijftien</h2>
          <p>Deze studieverenigingen zijn aangesloten bij de SVR.</p>
          <Verenigingenlijst verenigingen={verenigingen} />
        </div>
      </section>

      {/* 10. Tradities */}
      <section className="vlak" id="tradities">
        <div className="binnen">
          <h2>Tradities</h2>
          <div className="tradities">
            {tradities.map((traditie) => (
              <article key={traditie.titel}>
                <span className="merkje strepen" aria-hidden />
                <h3>{traditie.titel}</h3>
                <p>{traditie.tekst}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* 11. Geschiedenis */}
      <section className="vlak donker" id="geschiedenis">
        <div className="binnen">
          <h2>Geschiedenis</h2>
          <div className="geschiedenisblok">
          <ol className="mijlpalen">
            {geschiedenis.map((mijlpaal) => (
              <li key={mijlpaal.wanneer + mijlpaal.wat}>
                <p className="wanneer">{mijlpaal.wanneer}</p>
                <p className="wat">{mijlpaal.wat}</p>
              </li>
            ))}
          </ol>
          <span className="groot-getal omtrek" aria-hidden>
            1963
          </span>
          </div>
        </div>
      </section>

      {/* 12. Bestuur 62 */}
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

          <div className="bestuurblok">
            <span className="groot-getal" aria-hidden>
              {bestuur.nummer}
            </span>
            {bestuur.samenFoto ? (
              <figure className="samenfoto">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`/img/${bestuur.samenFoto}`}
                  alt={bestuur.samenBijschrift ?? `Het bestuur van de ${svr.afkorting}`}
                  width={1000}
                  height={1499}
                  loading="lazy"
                />
                {bestuur.samenBijschrift ? (
                  <figcaption>{bestuur.samenBijschrift}</figcaption>
                ) : null}
              </figure>
            ) : null}
          </div>

          <ul className="personen">
            {bestuur.leden.map((lid) => (
              <li key={lid.naam}>
                {lid.foto ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={`/img/${lid.foto}`} alt="" width={128} height={128} loading="lazy" />
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

          <p className="uitnodiging">
            Zelf in het bestuur?{" "}
            <Link href="/bestuur-worden">Lees wat het inhoudt</Link>.
          </p>
        </div>
      </section>

      {/* 13. Vragen */}
      <section className="vlak" id="vragen">
        <div className="binnen">
          <h2>Veelgestelde vragen</h2>
          <div className="vragen">
            {vragen.map((vraag) => (
              <details key={vraag.vraag}>
                <summary>{vraag.vraag}</summary>
                <p>
                  {vraag.antwoord}
                  {vraag.link ? (
                    <>
                      {" "}
                      <Link href={vraag.link.naar}>{vraag.link.tekst}</Link>
                    </>
                  ) : null}
                </p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* 14. Contact */}
      <section className="vlak donker" id="contact">
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
              <Link className="knop licht" href="/inloggen">
                Naar het portaal
              </Link>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
