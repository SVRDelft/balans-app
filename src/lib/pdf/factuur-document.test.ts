import { isValidElement, type ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
vi.mock("@react-pdf/renderer", () => ({
  Document: "document",
  Page: "page",
  Image: "image",
  Text: "text",
  View: "view",
  StyleSheet: { create: (value: unknown) => value },
}));
import { FactuurDocument, type FactuurPdfGegevens } from "./factuur-document";

const basis: FactuurPdfGegevens = {
  logoSrc: "logo",
  nummer: "TEST-2",
  omschrijving: "Bijdrage",
  factuurdatum: new Date("2026-09-01"),
  vervaldatum: new Date("2026-09-08"),
  status: "verstuurd",
  isConcept: false,
  isCredit: false,
  notities: null,
  totaalCenten: 10000,
  betaaldCenten: 3000,
  openstaandCenten: 5000,
  afgeboektCenten: 0,
  creditfactuur: { nummer: "TEST-3", bedragCenten: -2000 },
  crediteertFactuurNummer: null,
  regels: [
    {
      omschrijving: "Bijdrage",
      aantal: 1,
      prijsPerStukCenten: 10000,
      bedragCenten: 10000,
    },
  ],
  relatie: {
    naam: "Vereniging",
    contactpersoon: null,
    adres: null,
    postcode: null,
    plaats: null,
    land: "Nederland",
    email: null,
    kvkNummer: "",
    btwNummer: "",
  },
  afzender: {
    organisatieNaam: "SVR Delft",
    adres: "",
    postcode: "",
    plaats: "",
    email: "",
    iban: "",
    kvkNummer: "",
    btwPlichtig: false,
    btwPercentage: 0,
    voetnoot: "Maak het bedrag over naar onze rekening.",
    contactpersoon: "",
    land: "",
    telefoon: "",
    website: "",
    btwNummer: "",
  },
};
function tekst(node: ReactNode): string {
  if (Array.isArray(node)) return node.map(tekst).join(" ");
  if (isValidElement<{ children?: ReactNode }>(node))
    return tekst(node.props.children);
  return typeof node === "string" || typeof node === "number"
    ? String(node)
    : "";
}
function document(overrides: Partial<FactuurPdfGegevens> = {}) {
  return tekst(
    FactuurDocument({ factuur: { ...basis, ...overrides } }),
  ).replace(/\s+/g, " ");
}

describe("betaaltekst op de factuur-PDF", () => {
  it("toont de gedeelde resterende 50 euro in plaats van totaal min alleen betalingen", () => {
    expect(document()).toContain("Nog te voldoen € 50,00");
    expect(document()).toContain("Credit TEST-3");
    expect(document()).not.toContain("€ 70,00");
  });
  it("vraagt bij een credit geen betaling en noemt de terugbetaling", () => {
    const inhoud = document({
      isCredit: true,
      totaalCenten: -10000,
      openstaandCenten: -3000,
      betaaldCenten: 0,
      creditfactuur: null,
      crediteertFactuurNummer: "TEST-1",
    });
    expect(inhoud).toContain("Nog terug te betalen € 30,00");
    expect(inhoud).toContain("Wij betalen nog € 30,00 aan u terug.");
    expect(inhoud).not.toContain("Maak het bedrag over");
  });
  it("vraagt geen betaling op een verrekende credit of afgewikkelde factuur", () => {
    expect(document({ isCredit: true, openstaandCenten: 0 })).toContain(
      "hoeft u niets over te maken",
    );
    expect(document({ openstaandCenten: 0 })).toContain(
      "geen bedrag meer open",
    );
    expect(document({ openstaandCenten: 0 })).not.toContain(
      "Maak het bedrag over",
    );
  });
  it("presenteert een concept niet als betaalverzoek", () => {
    const inhoud = document({ isConcept: true, openstaandCenten: 0 });
    expect(inhoud).toContain("Dit is een concept.");
    expect(inhoud).not.toContain("Nog te voldoen");
  });
});
