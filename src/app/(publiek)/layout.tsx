import type { Metadata } from "next";
import Link from "next/link";
import localFont from "next/font/local";

import { heeftLogo, leesSvr } from "@/lib/content";

import { Menu } from "./menu";
import "./publiek.css";

// Zelf gehost, niet via Google Fonts: dan gaat er geen verzoek van de bezoeker
// naar een server van iemand anders.
const kop = localFont({
  src: "../../../public/fonts/young-serif-latin.woff2",
  variable: "--lettertype-kop",
  display: "swap",
  fallback: ["Georgia", "Times New Roman", "serif"],
});

const tekst = localFont({
  src: "../../../public/fonts/instrument-sans-latin.woff2",
  variable: "--lettertype-tekst",
  display: "swap",
  weight: "400 700",
  fallback: ["system-ui", "Segoe UI", "Arial", "sans-serif"],
});

const svr = leesSvr();

export const metadata: Metadata = {
  title: {
    default: `${svr.naam}`,
    template: `%s · ${svr.afkorting} Delft`,
  },
  description:
    "De StudieVerenigingenRaad Delft is het overleg van de vijftien studieverenigingen van de TU Delft.",
  openGraph: {
    type: "website",
    locale: "nl_NL",
    siteName: `${svr.afkorting} Delft`,
    title: svr.naam,
    description:
      "Het overleg van de vijftien studieverenigingen van de TU Delft.",
  },
};

export default function PubliekeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const logo = heeftLogo();

  return (
    <div className={`publiek ${kop.variable} ${tekst.variable}`}>
      <a href="#inhoud" className="knop" style={{ position: "absolute", left: "-9999px" }}>
        Naar de inhoud
      </a>
      <header className="kop">
        <div className="binnen">
          <Link className="merk" href="/">
            {logo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src="/img/logo.png" alt="" width={40} height={40} />
            ) : (
              <span className="teken strepen" aria-hidden>
                SVR
              </span>
            )}
            <span>
              <strong>{svr.afkorting} Delft</strong>
              <span>StudieVerenigingenRaad</span>
            </span>
          </Link>
          <Menu />
        </div>
      </header>
      <div className="streeprand strepen" aria-hidden />

      <main id="inhoud">{children}</main>

      <footer className="voet">
        <div className="binnen">
          <span>
            {svr.stichting}, KvK {svr.kvk}
            <br />
            Opgericht {svr.opgericht}
          </span>
          <ul>
            <li>
              <a href={`mailto:${svr.email}`}>{svr.email}</a>
            </li>
            <li>
              <Link href="/privacy">Privacy</Link>
            </li>
            <li>
              <Link href="/inloggen">Inloggen</Link>
            </li>
          </ul>
        </div>
      </footer>
    </div>
  );
}
