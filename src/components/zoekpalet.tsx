"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";

import type { Zoekresultaat } from "@/lib/zoeken";

/**
 * Zoeken over de hele administratie met Ctrl+K (of Cmd+K).
 *
 * Eén veld voor alles: factuurnummers, verenigingen, uitgaven, evenementen en de
 * pagina's zelf. Zonder dit is de weg naar een factuur van vorig jaar: van
 * boekjaar wisselen, naar Facturen, filteren. Nu is het typen en Enter.
 *
 * Het staat in een <dialog>: die vangt de focus, sluit op Escape en werkt ook
 * zonder dat wij dat allemaal zelf naprogrammeren.
 */

interface Pagina {
  titel: string;
  href: string;
  woorden: string;
}

const PAGINAS: Pagina[] = [
  { titel: "Dashboard", href: "/beheer", woorden: "overzicht start home" },
  { titel: "Exploitatie", href: "/beheer/exploitatie", woorden: "begroot realisatie resultaat winst verlies" },
  { titel: "Balans", href: "/beheer/balans", woorden: "activa passiva vermogen" },
  { titel: "Debiteuren", href: "/beheer/debiteuren", woorden: "openstaand rekening-courant prive schuld vordering" },
  { titel: "Facturen", href: "/beheer/facturen", woorden: "factuur rekening" },
  { titel: "Nieuwe factuur", href: "/beheer/facturen/nieuw", woorden: "factuur maken aanmaken" },
  { titel: "Jaarfacturen bijdrage", href: "/beheer/facturen/jaarfacturen", woorden: "bijdrage contributie alle verenigingen" },
  { titel: "Uitgaven", href: "/beheer/uitgaven", woorden: "kosten bonnetje leverancier" },
  { titel: "Uitgave boeken", href: "/beheer/uitgaven/nieuw", woorden: "kosten bonnetje invoeren" },
  { titel: "Evenementen", href: "/beheer/evenementen", woorden: "lbg borrel gala omslag deelnemers" },
  { titel: "Banksaldo", href: "/beheer/bank", woorden: "saldo controle" },
  { titel: "Bankafschriften", href: "/beheer/bank/importeren", woorden: "mt940 import afschrift koppelen" },
  { titel: "Spullen & voorraad", href: "/beheer/voorraad", woorden: "spullen inventaris" },
  { titel: "Per vereniging", href: "/beheer/verenigingen", woorden: "studievereniging overzicht" },
  { titel: "Relaties", href: "/beheer/relaties", woorden: "adresboek contact leverancier persoon" },
  { titel: "Begroting", href: "/beheer/begroting", woorden: "posten begroten" },
  { titel: "Overdracht", href: "/beheer/overdracht", woorden: "volgend bestuur export backup" },
  { titel: "Boekjaren", href: "/beheer/boekjaren", woorden: "jaar reconstructie opbouwen" },
  { titel: "Portaal", href: "/beheer/portaal", woorden: "mededelingen vergaderingen notulen agenda" },
  { titel: "Accounts", href: "/beheer/accounts", woorden: "gebruikers wachtwoord inloggen" },
  { titel: "Auditlog", href: "/beheer/auditlog", woorden: "geschiedenis wie wat wanneer" },
  { titel: "Instellingen", href: "/beheer/instellingen", woorden: "logo iban adres btw" },
];

const schoon = (tekst: string) =>
  tekst
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();

export function Zoekpalet() {
  const router = useRouter();
  const venster = useRef<HTMLDialogElement>(null);
  const veld = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [term, setTerm] = useState("");
  const [uitDatabase, setUitDatabase] = useState<Zoekresultaat[]>([]);
  const [bezig, setBezig] = useState(false);
  const [gekozen, setGekozen] = useState(0);

  // Ctrl+K of Cmd+K vanaf elke pagina. Niet in een tekstveld, behalve als het
  // zoekveld zelf open staat.
  useEffect(() => {
    function opToets(gebeurtenis: KeyboardEvent) {
      if ((gebeurtenis.metaKey || gebeurtenis.ctrlKey) && gebeurtenis.key.toLowerCase() === "k") {
        gebeurtenis.preventDefault();
        setOpen((vorige) => !vorige);
      }
    }
    window.addEventListener("keydown", opToets);
    return () => window.removeEventListener("keydown", opToets);
  }, []);

  useEffect(() => {
    const element = venster.current;
    if (!element) return;
    if (open && !element.open) {
      element.showModal();
      veld.current?.focus();
    }
    if (!open && element.open) element.close();
  }, [open]);

  // Zoeken terwijl je typt, maar niet bij elke toetsaanslag een verzoek. Het
  // wachten zelf zet geen staat: dat gebeurt pas in de afloop hieronder.
  useEffect(() => {
    const vraag = term.trim();
    const afbreken = new AbortController();
    const wachten = window.setTimeout(async () => {
      if (vraag.length < 2) {
        setUitDatabase([]);
        setBezig(false);
        return;
      }
      try {
        const antwoord = await fetch(`/api/zoeken?q=${encodeURIComponent(vraag)}`, {
          signal: afbreken.signal,
        });
        const gegevens = (await antwoord.json()) as { resultaten?: Zoekresultaat[] };
        setUitDatabase(gegevens.resultaten ?? []);
      } catch {
        // Afgebroken of offline: dan gewoon alleen de pagina's laten staan.
      } finally {
        setBezig(false);
      }
    }, 180);
    return () => {
      window.clearTimeout(wachten);
      afbreken.abort();
    };
  }, [term]);

  const vraag = schoon(term.trim());
  const paginas: Zoekresultaat[] = (
    vraag.length === 0
      ? PAGINAS.slice(0, 6)
      : PAGINAS.filter(
          (pagina) =>
            schoon(pagina.titel).includes(vraag) || pagina.woorden.includes(vraag),
        ).slice(0, 5)
  ).map((pagina) => ({
    soort: "Pagina",
    titel: pagina.titel,
    onderschrift: "",
    href: pagina.href,
  }));

  const alles = [...paginas, ...uitDatabase];
  const huidig = Math.min(gekozen, Math.max(0, alles.length - 1));

  function ga(resultaat: Zoekresultaat | undefined) {
    if (!resultaat) return;
    setOpen(false);
    setTerm("");
    setUitDatabase([]);
    setGekozen(0);
    router.push(resultaat.href);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs text-muted-foreground hover:bg-muted/60"
      >
        <Search aria-hidden className="size-3.5" />
        Zoeken
        <kbd className="hidden rounded border border-border px-1 py-0.5 text-[0.65rem] sm:inline">
          Ctrl K
        </kbd>
      </button>

      <dialog
        ref={venster}
        onClose={() => setOpen(false)}
        aria-label="Zoeken in de administratie"
        className="m-0 w-full max-w-xl rounded-xl border border-border bg-card p-0 text-foreground shadow-xl backdrop:bg-black/40 sm:mt-24 sm:ml-[50%] sm:-translate-x-1/2"
      >
        <div className="flex items-center gap-2 border-b border-border px-4 py-3">
          <Search aria-hidden className="size-4 text-muted-foreground" />
          <input
            ref={veld}
            type="text"
            value={term}
            onChange={(gebeurtenis) => {
              const waarde = gebeurtenis.target.value;
              setTerm(waarde);
              setGekozen(0);
              setBezig(waarde.trim().length >= 2);
            }}
            onKeyDown={(gebeurtenis) => {
              if (gebeurtenis.key === "ArrowDown") {
                gebeurtenis.preventDefault();
                setGekozen((vorige) => Math.min(vorige + 1, alles.length - 1));
              }
              if (gebeurtenis.key === "ArrowUp") {
                gebeurtenis.preventDefault();
                setGekozen((vorige) => Math.max(vorige - 1, 0));
              }
              if (gebeurtenis.key === "Enter") {
                gebeurtenis.preventDefault();
                ga(alles[huidig]);
              }
            }}
            placeholder="Factuurnummer, vereniging, uitgave of pagina"
            aria-label="Zoekterm"
            className="min-w-0 flex-1 bg-transparent text-sm outline-none"
          />
          <span className="text-xs text-muted-foreground">
            {bezig ? "Zoeken…" : "Esc sluit"}
          </span>
        </div>

        <ul className="max-h-80 overflow-y-auto py-1">
          {alles.length === 0 ? (
            <li className="px-4 py-6 text-center text-sm text-muted-foreground">
              {term.trim().length < 2
                ? "Typ minstens twee letters."
                : "Niets gevonden."}
            </li>
          ) : null}
          {alles.map((resultaat, index) => (
            <li key={`${resultaat.href}-${index}`}>
              <button
                type="button"
                onClick={() => ga(resultaat)}
                onMouseEnter={() => setGekozen(index)}
                aria-current={index === huidig ? "true" : undefined}
                className={`flex w-full items-baseline gap-3 px-4 py-2 text-left text-sm ${
                  index === huidig ? "bg-muted" : ""
                }`}
              >
                <span className="w-20 shrink-0 text-xs text-muted-foreground">
                  {resultaat.soort}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate">{resultaat.titel}</span>
                  {resultaat.onderschrift ? (
                    <span className="block truncate text-xs text-muted-foreground">
                      {resultaat.onderschrift}
                    </span>
                  ) : null}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </dialog>
    </>
  );
}
