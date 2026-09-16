import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import {
  hertelFactuur,
  maakHerinneringstekst,
  type DbClient,
} from "./facturen";
import { factuurOpenstaand } from "./finance/factuurstanden";
import { formatteerEuro } from "./geld";

function administratie(
  creditBedrag: number,
  ontvangen: number,
  terugbetaald = 0,
) {
  const facturen = [
    {
      id: "origineel",
      status: "verstuurd",
      totaalCenten: 10000,
      regels: [{ bedragCenten: 10000 }],
      betalingen: [{ bedragCenten: ontvangen }],
    },
    {
      id: "credit",
      status: "verstuurd",
      totaalCenten: creditBedrag,
      regels: [{ bedragCenten: creditBedrag }],
      betalingen: [{ bedragCenten: -terugbetaald }],
    },
  ];
  const tx = {
    factuur: {
      findUniqueOrThrow: vi.fn(async ({ where }: { where: { id: string } }) => {
        const index = where.id === "origineel" ? 0 : 1;
        return {
          ...facturen[index],
          creditfactuur: index === 0 ? { ...facturen[1] } : null,
          crediteertFactuur: index === 1 ? { ...facturen[0] } : null,
        };
      }),
      update: vi.fn(
        async ({
          where,
          data,
        }: {
          where: { id: string };
          data: { status: string; totaalCenten: number };
        }) => {
          const factuur = facturen.find((f) => f.id === where.id)!;
          Object.assign(factuur, data);
          return factuur;
        },
      ),
    },
  };
  return { facturen, tx: tx as unknown as DbClient, update: tx.factuur.update };
}

describe("herberekenen van een factuur met credit", () => {
  it("houdt het origineel betaalbaar wanneer een gedeeltelijke credit wordt verstuurd", async () => {
    const { facturen, tx, update } = administratie(-2000, 3000);
    await hertelFactuur(tx, "credit");
    expect(facturen.map((f) => f.status)).toEqual(["deels_betaald", "betaald"]);
    expect(update).toHaveBeenCalledTimes(2);
  });
  it("sluit het origineel na betaling van het resterende bedrag", async () => {
    const { facturen, tx } = administratie(-2000, 8000);
    await hertelFactuur(tx, "origineel");
    expect(facturen.map((f) => f.status)).toEqual(["betaald", "betaald"]);
  });
  it("werkt beide statussen bij na een terugbetaling op de credit", async () => {
    const { facturen, tx } = administratie(-10000, 3000, 3000);
    await hertelFactuur(tx, "credit");
    expect(facturen.map((f) => f.status)).toEqual(["gecrediteerd", "betaald"]);
  });
  it("heropent de credit als een terugbetaling wordt verwijderd", async () => {
    const { facturen, tx } = administratie(-10000, 3000);
    facturen[1].status = "betaald";
    await hertelFactuur(tx, "credit");
    expect(facturen.map((f) => f.status)).toEqual([
      "gecrediteerd",
      "verstuurd",
    ]);
  });
});

it("vraagt in de herinnering alleen het nog te ontvangen bedrag na betaling en credit", () => {
  const openstaand = factuurOpenstaand({
    status: "deels_betaald",
    totaalCenten: 10000,
    betalingen: [{ bedragCenten: 3000 }],
    creditfactuur: { status: "betaald", totaalCenten: -2000, betalingen: [] },
  });
  const tekst = maakHerinneringstekst({
    relatieNaam: "Vereniging",
    contactpersoon: null,
    nummer: "TEST-1",
    factuurdatum: "1 september 2026",
    vervaldatum: "8 september 2026",
    openstaandBedrag: formatteerEuro(openstaand),
    omschrijving: "Bijdrage",
    organisatieNaam: "SVR Delft",
    iban: "",
    afzender: "Bestuur",
    dagenOver: 3,
  });
  expect(tekst).toContain(formatteerEuro(5000));
  expect(tekst).not.toContain(formatteerEuro(7000));
  expect(tekst).toContain("3 dagen over de betaaltermijn");
});
