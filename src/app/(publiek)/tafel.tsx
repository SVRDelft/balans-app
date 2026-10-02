import type { Vereniging } from "@/lib/content";

/**
 * De vergadertafel: vijftien stoelen rond één tafel, één per vereniging.
 *
 * Alles zit in SVG en CSS, zonder JavaScript. Elke stoel is een link naar de
 * website van die vereniging en dus met het toetsenbord te bereiken; bij hover
 * of focus licht hij op en verschijnt de faculteit. Verenigingen zonder bekende
 * website worden een groep met een toegankelijke naam, zodat ze wel oplichten
 * maar nergens heen wijzen.
 */
export function Tafel({ verenigingen }: { verenigingen: Vereniging[] }) {
  const midden = 250;
  const straal = 118;

  return (
    <svg
      className="tafel"
      viewBox="0 0 500 500"
      role="group"
      aria-labelledby="tafelkop"
    >
      <title id="tafelkop">
        De vergadertafel van de SVR met de vijftien aangesloten studieverenigingen
      </title>

      <circle className="blad" cx={midden} cy={midden} r={straal} />
      <text className="blad-naam" x={midden} y={midden + 14} textAnchor="middle">
        SVR
      </text>

      {verenigingen.map((vereniging, i) => {
        const hoek = (i / verenigingen.length) * 2 * Math.PI - Math.PI / 2;
        const cos = Math.cos(hoek);
        const sin = Math.sin(hoek);
        const stoelX = midden + cos * (straal + 26);
        const stoelY = midden + sin * (straal + 26);
        const naamX = midden + cos * (straal + 56);
        const naamY = midden + sin * (straal + 56);
        const kant = Math.abs(cos) < 0.3 ? "middle" : cos > 0 ? "start" : "end";
        const stijl = { "--wacht": `${0.1 + i * 0.05}s` } as React.CSSProperties;
        const inhoud = (
          <>
            {/* Groter dan de stip zelf: zo is hij op een telefoon goed te raken. */}
            <circle className="raakvlak" cx={stoelX} cy={stoelY} r={18} />
            <circle className="stoel" cx={stoelX} cy={stoelY} r={8} />
            <text className="stoel-naam" x={naamX} y={naamY} textAnchor={kant}>
              {vereniging.kort}
            </text>
            <text
              className="stoel-faculteit"
              x={naamX}
              y={naamY + 15}
              textAnchor={kant}
            >
              {vereniging.faculteit}
            </text>
          </>
        );

        return vereniging.website ? (
          <a
            key={vereniging.slug}
            className="plek"
            href={vereniging.website}
            target="_blank"
            rel="noopener noreferrer"
            style={stijl}
            aria-label={`${vereniging.naam}, faculteit ${vereniging.faculteit} — naar hun website`}
          >
            {inhoud}
          </a>
        ) : (
          <g
            key={vereniging.slug}
            className="plek"
            style={stijl}
            tabIndex={0}
            role="img"
            aria-label={`${vereniging.naam}, faculteit ${vereniging.faculteit}`}
          >
            {inhoud}
          </g>
        );
      })}
    </svg>
  );
}
