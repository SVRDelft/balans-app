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
  leesBereikt,
  leesOudBesturen,
} from "@/lib/content";

import { Blokken } from "./blokken";
import { Verenigingenlijst } from "./verenigingenlijst";

// De onderdelen van de publieke site. Elk onderdeel leest zelf zijn tekst uit
// content/, zodat de voorpagina en de losse pagina's ze vrij kunnen combineren.

export function WatWeDoen({ kop = "Wat we doen" }: { kop?: string }) {
  const watWeDoen = leesTekst("home").secties.find((sectie) => sectie.kop === "Wat we doen");
  return (
    <section className="vlak wit" id="wat-we-doen">
      <div className="binnen">
        <h2>{kop}</h2>
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
  );
}

export function HoeHetWerkt() {
  const hoeHetWerkt = leesTekst("home").secties.find((sectie) => sectie.kop === "Hoe de SVR werkt");
  const samenwerking = leesSamenwerking();
  return (
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
  );
}

export function AanTafel() {
  const overleggen = leesOverleggen();
  return (
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
  );
}

export function EenJaar() {
  const jaar = leesJaar();
  return (
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
  );
}

export function Evenementen() {
  const evenementen = leesEvenementen();
  return (
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
  );
}

export function DeVijftien() {
  const verenigingen = leesVerenigingen();
  return (
    <section className="vlak wit" id="verenigingen">
      <div className="binnen">
        <h2>De vijftien</h2>
        <p>
          Deze studieverenigingen zijn aangesloten bij de SVR, op volgorde van
          oprichting.
        </p>
        <Verenigingenlijst verenigingen={verenigingen} />
      </div>
    </section>
  );
}

export function Tradities() {
  const tradities = leesTradities();
  return (
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
  );
}

export function Mijlpalen() {
  const geschiedenis = leesGeschiedenis();
  return (
    <section className="vlak donker" id="geschiedenis">
      <div className="binnen">
        <h2>Mijlpalen</h2>
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
  );
}

export function HuidigBestuur() {
  const bestuur = leesBestuur();
  const svr = leesSvr();
  return (
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
  );
}

export function Vragen() {
  const vragen = leesVragen();
  return (
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
  );
}

export function Contact() {
  const svr = leesSvr();
  return (
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
  );
}

/** De kop van een losse pagina: titel en een korte inleiding. */
export function PaginaKop({ titel, children }: { titel: string; children?: React.ReactNode }) {
  return (
    <section className="vlak donker paginakop">
      <div className="binnen">
        <h1>{titel}</h1>
        {children ? <div className="lead">{children}</div> : null}
      </div>
    </section>
  );
}

/** Het verhaal uit content/geschiedenis.md. */
export function Verhaal() {
  const tekst = leesTekst("geschiedenis");
  return (
    <section className="vlak wit">
      <div className="binnen tekst">
        <Blokken blokken={tekst.blokken} />
        {tekst.secties.map((sectie) => (
          <div key={sectie.kop}>
            <h2>{sectie.kop}</h2>
            <Blokken blokken={sectie.blokken} />
          </div>
        ))}
      </div>
    </section>
  );
}

export function Bereikt() {
  const bereikt = leesBereikt();
  return (
    <section className="vlak" id="bereikt">
      <div className="binnen">
        <h2>Wat we bereikt hebben</h2>
        <p>Wat de SVR in de loop der jaren heeft opgezet, en wat er nog steeds is.</p>
        <div className="tradities">
          {bereikt.map((prestatie) => (
            <article key={prestatie.titel}>
              <span className="merkje strepen" aria-hidden />
              <h3>{prestatie.titel}</h3>
              <p>{prestatie.tekst}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

/** De vijftien op de tijdlijn, van de oudste tot de jongste, met de SVR ertussen. */
export function VijftienDoorDeJaren() {
  const verenigingen = leesVerenigingen();
  const momenten = [
    ...verenigingen
      .filter((vereniging) => vereniging.opgericht)
      .map((vereniging) => ({
        jaar: vereniging.opgericht!,
        wat: `${vereniging.naam} opgericht`,
        svr: false,
      })),
    { jaar: 1963, wat: "De SVR opgericht, op 26 februari", svr: true },
  ].sort((a, b) => a.jaar - b.jaar || Number(b.svr) - Number(a.svr));

  return (
    <section className="vlak donker" id="door-de-jaren">
      <div className="binnen">
        <h2>De vijftien door de jaren</h2>
        <p>De oudste vereniging is bijna honderd jaar ouder dan de SVR zelf.</p>
        <ol className="mijlpalen">
          {momenten.map((moment) => (
            <li key={moment.wat} className={moment.svr ? "svr" : undefined}>
              <p className="wanneer">{moment.jaar}</p>
              <p className="wat">{moment.svr ? <strong>{moment.wat}</strong> : moment.wat}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

export function OudBesturen() {
  const besturen = leesOudBesturen();
  const svr = leesSvr();
  return (
    <section className="vlak" id="oud-besturen">
      <div className="binnen">
        <h2>Oud-besturen</h2>
        {besturen.length === 0 ? (
          <p>
            Deze lijst wordt aangevuld. Zat jij in een eerder bestuur van de SVR?{" "}
            <a href={`mailto:${svr.email}`}>Laat het ons weten</a>.
          </p>
        ) : (
          <>
            <p>
              Elk jaar een nieuw dagelijks bestuur, sinds 1963. Ontbreekt er
              iemand? <a href={`mailto:${svr.email}`}>Laat het ons weten</a>.
            </p>
            <dl className="samenwerking oudbesturen">
              {besturen.map((bestuur) => (
                <div key={bestuur.nummer}>
                  <dt>
                    Bestuur {bestuur.nummer}
                    <span>{bestuur.jaar}</span>
                  </dt>
                  <dd>{bestuur.leden.join(" · ")}</dd>
                </div>
              ))}
            </dl>
          </>
        )}
      </div>
    </section>
  );
}

const ONTDEK = [
  { href: "/wat-we-doen", titel: "Wat we doen", tekst: "Samenwerken, vertegenwoordigen en verbinden: de overleggen, het jaar en de evenementen." },
  { href: "/geschiedenis", titel: "Geschiedenis", tekst: "Sinds 1963. Wat de SVR heeft opgezet, en de vijftien door de jaren." },
  { href: "/bestuur", titel: "Het bestuur", tekst: "Wie het dagelijks bestuur dit jaar vormen, en wie hen voorgingen." },
  { href: "/bestuur-worden", titel: "Bestuur worden", tekst: "Een bestuursjaar naast je studie, met bestuurders van andere verenigingen." },
];

/** De wegwijzer op de voorpagina naar de losse pagina's. */
export function Ontdek() {
  return (
    <section className="vlak" id="ontdek">
      <div className="binnen">
        <h2>Meer over de SVR</h2>
        <div className="tradities ontdek">
          {ONTDEK.map((pagina) => (
            <Link key={pagina.href} href={pagina.href} className="ontdekkaart">
              <span className="merkje strepen" aria-hidden />
              <h3>{pagina.titel} →</h3>
              <p>{pagina.tekst}</p>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
