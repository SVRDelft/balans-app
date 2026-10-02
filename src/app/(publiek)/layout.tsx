import type { Metadata } from "next";
import Link from "next/link";

import { leesSvr, logoBestand } from "@/lib/content";

import { Menu } from "./menu";
import "./publiek.css";

const svr = leesSvr();

export const metadata: Metadata = {
  title: {
    default: `${svr.naam}`,
    template: `%s · ${svr.afkorting} Delft`,
  },
  description:
    "De StudieVerenigingenRaad Delft is het overleg van de vijftien studieverenigingen van de TU Delft.",
  metadataBase: new URL("https://svr.tudelft.nl"),
  openGraph: {
    type: "website",
    locale: "nl_NL",
    siteName: `${svr.afkorting} Delft`,
    title: svr.naam,
    description:
      "Het overleg van de vijftien studieverenigingen van de TU Delft.",
    images: [{ url: "/og.png", width: 1200, height: 630, alt: svr.naam }],
  },
  twitter: {
    card: "summary_large_image",
    images: ["/og.png"],
  },
};

export default function PubliekeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const logo = logoBestand();

  return (
    <div className="publiek">
      <a href="#inhoud" className="knop" style={{ position: "absolute", left: "-9999px" }}>
        Naar de inhoud
      </a>
      <header className="kop">
        <div className="binnen">
          <Link className="merk" href="/">
            {logo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={`/img/${logo}`} alt="" width={40} height={40} />
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
