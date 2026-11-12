"use client";

import { useState } from "react";
import Link from "next/link";

/**
 * Het menu. Op een telefoon zit het achter een knop, maar het staat er wél:
 * verbergen zonder knop (zoals in de referentie) betekent geen menu.
 */
export function Menu() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        className="menuknop"
        aria-expanded={open}
        aria-controls="hoofdmenu"
        onClick={() => setOpen((vorige) => !vorige)}
      >
        {open ? "Sluiten" : "Menu"}
      </button>
      <nav
        id="hoofdmenu"
        className="menu"
        aria-label="Hoofdmenu"
        data-open={open ? "ja" : "nee"}
      >
        <ul>
          {[
            ["/wat-we-doen", "Wat we doen"],
            ["/geschiedenis", "Geschiedenis"],
            ["/bestuur", "Bestuur"],
            ["/#verenigingen", "De vijftien"],
            ["/bestuur-worden", "Bestuur worden"],
            ["/#contact", "Contact"],
          ].map(([href, label]) => (
            <li key={href}>
              <Link href={href} onClick={() => setOpen(false)}>
                {label}
              </Link>
            </li>
          ))}
          <li>
            <Link className="knop" href="/inloggen" onClick={() => setOpen(false)}>
              Inloggen
            </Link>
          </li>
        </ul>
      </nav>
    </>
  );
}
