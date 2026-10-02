"use client";

import { useState } from "react";

import type { Vereniging } from "@/lib/content";

/**
 * De vijftien, met een filter op faculteit. Zonder JavaScript staan ze er
 * gewoon allemaal; het filter is een extraatje, geen voorwaarde.
 */
export function Verenigingenlijst({ verenigingen }: { verenigingen: Vereniging[] }) {
  const faculteiten = [...new Set(verenigingen.map((v) => v.faculteit))].sort();
  const [gekozen, setGekozen] = useState<string | null>(null);
  const zichtbaar = gekozen
    ? verenigingen.filter((v) => v.faculteit === gekozen)
    : verenigingen;

  return (
    <>
      <div className="filters" role="group" aria-label="Filter op faculteit">
        <button
          type="button"
          aria-pressed={gekozen === null}
          onClick={() => setGekozen(null)}
        >
          Alle
        </button>
        {faculteiten.map((faculteit) => (
          <button
            key={faculteit}
            type="button"
            aria-pressed={gekozen === faculteit}
            onClick={() => setGekozen(gekozen === faculteit ? null : faculteit)}
          >
            {faculteit}
          </button>
        ))}
      </div>

      <ul className="verenigingen">
        {zichtbaar.map((vereniging) => {
          const binnenkant = (
            <>
              {vereniging.logo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  className="logo"
                  src={`/img/sv/${vereniging.logo}`}
                  alt=""
                  width={48}
                  height={48}
                  loading="lazy"
                />
              ) : (
                <span className="streepje" aria-hidden />
              )}
              <span className="wie">
                <strong>{vereniging.naam}</strong>
                <span>{vereniging.faculteit}</span>
              </span>
              {vereniging.website ? (
                <svg className="naarbuiten" viewBox="0 0 16 16" aria-hidden focusable="false">
                  <path d="M6 2h8v8" />
                  <path d="M14 2 7 9" />
                  <path d="M12 10v4H2V4h4" />
                </svg>
              ) : null}
            </>
          );

          return (
            <li key={vereniging.slug}>
              {vereniging.website ? (
                <a href={vereniging.website} target="_blank" rel="noopener noreferrer">
                  {binnenkant}
                </a>
              ) : (
                <span className="geenlink">{binnenkant}</span>
              )}
            </li>
          );
        })}
      </ul>
    </>
  );
}
