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
          <li>
            <Link href="/#wat-we-doen" onClick={() => setOpen(false)}>
              Wat we doen
            </Link>
          </li>
          <li>
            <Link href="/#overleggen" onClick={() => setOpen(false)}>
              Overleggen
            </Link>
          </li>
          <li>
            <Link href="/#verenigingen" onClick={() => setOpen(false)}>
              De vijftien
            </Link>
          </li>
          <li>
            <Link href="/bestuur-worden" onClick={() => setOpen(false)}>
              Bestuur worden
            </Link>
          </li>
          <li>
            <Link href="/#contact" onClick={() => setOpen(false)}>
              Contact
            </Link>
          </li>
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
