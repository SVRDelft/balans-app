import Link from "next/link";

import "./(publiek)/publiek.css";

export default function NietGevonden() {
  return (
    <div className="publiek">
      <section className="vlak wit">
      <div className="binnen tekst">
        <h1>Deze pagina bestaat niet</h1>
        <p>
          Misschien is de link verouderd, of staat de pagina achter het slot.
          Agenda&apos;s en notulen staan in het portaal, dus daarvoor moet je
          eerst inloggen.
        </p>
        <p style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
          <Link className="knop" href="/">
            Naar de voorpagina
          </Link>
          <Link className="knop licht" href="/inloggen">
            Inloggen
          </Link>
        </p>
      </div>
      </section>
    </div>
  );
}
