import type { Blok, Stuk } from "@/lib/markdown";

/** Zet de stukjes van één regel om naar tekst, vet en links. */
export function Regel({ stukken }: { stukken: Stuk[] }) {
  return (
    <>
      {stukken.map((stuk, i) => {
        if (stuk.soort === "sterk") return <strong key={i}>{stuk.tekst}</strong>;
        if (stuk.soort === "link")
          return (
            <a
              key={i}
              href={stuk.naar}
              {...(stuk.naar.startsWith("http")
                ? { target: "_blank", rel: "noopener noreferrer" }
                : {})}
            >
              {stuk.tekst}
            </a>
          );
        return <span key={i}>{stuk.tekst}</span>;
      })}
    </>
  );
}

/** Alinea's en opsommingen uit een tekst in content/. */
export function Blokken({ blokken }: { blokken: Blok[] }) {
  return (
    <>
      {blokken.map((blok, i) =>
        blok.soort === "lijst" ? (
          <ul key={i}>
            {blok.punten.map((punt, j) => (
              <li key={j}>
                <Regel stukken={punt} />
              </li>
            ))}
          </ul>
        ) : (
          <p key={i}>
            <Regel stukken={blok.stukken} />
          </p>
        ),
      )}
    </>
  );
}
