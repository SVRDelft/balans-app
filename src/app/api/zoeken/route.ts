import { haalSessie } from "@/lib/auth/server";
import { db } from "@/lib/db";
import { formatteerDatum } from "@/lib/datum";
import { formatteerEuro } from "@/lib/geld";
import type { Zoekresultaat } from "@/lib/zoeken";

/**
 * Zoeken over de hele administratie, voor het zoekvenster (Ctrl+K).
 *
 * Bewust over alle boekjaren heen: de vraag is meestal "waar stond die factuur
 * van vorig jaar?". Een resultaat uit een ander boekjaar wijst naar /beheer/ga,
 * dat eerst van boekjaar wisselt en daarna doorstuurt — anders kijk je naar een
 * pagina die in het huidige jaar niet bestaat.
 */
export const dynamic = "force-dynamic";

const PER_SOORT = 6;

export async function GET(verzoek: Request) {
  // Hier komt alles uit de administratie langs, dus alleen het bestuur.
  const sessie = await haalSessie();
  const magErbij = sessie?.rol === "BESTUUR";
  if (!magErbij) {
    return Response.json({ resultaten: [] }, { status: 401 });
  }

  const zoekterm = new URL(verzoek.url).searchParams.get("q")?.trim().slice(0, 80) ?? "";
  if (zoekterm.length < 2) return Response.json({ resultaten: [] });

  const bevat = { contains: zoekterm };
  const [huidigBoekjaar, facturen, relaties, uitgaven, evenementen] = await Promise.all([
    db.boekjaar.findFirst({ where: { actief: true }, select: { id: true } }),
    db.factuur.findMany({
      where: {
        OR: [
          { nummer: bevat },
          { omschrijving: bevat },
          { relatie: { naam: bevat } },
        ],
      },
      select: {
        id: true,
        nummer: true,
        omschrijving: true,
        totaalCenten: true,
        status: true,
        boekjaarId: true,
        relatie: { select: { naam: true } },
        boekjaar: { select: { naam: true } },
      },
      orderBy: { nummer: "desc" },
      take: PER_SOORT,
    }),
    db.relatie.findMany({
      where: { OR: [{ naam: bevat }, { contactpersoon: bevat }, { email: bevat }] },
      select: { id: true, naam: true, type: true, plaats: true },
      orderBy: { naam: "asc" },
      take: PER_SOORT,
    }),
    db.uitgave.findMany({
      where: { OR: [{ omschrijving: bevat }, { leverancierNaam: bevat }] },
      select: {
        id: true,
        omschrijving: true,
        leverancierNaam: true,
        bedragCenten: true,
        datum: true,
        boekjaarId: true,
        boekjaar: { select: { naam: true } },
      },
      orderBy: { datum: "desc" },
      take: PER_SOORT,
    }),
    db.evenement.findMany({
      where: { naam: bevat },
      select: {
        id: true,
        naam: true,
        datum: true,
        boekjaarId: true,
        boekjaar: { select: { naam: true } },
      },
      orderBy: { datum: "desc" },
      take: PER_SOORT,
    }),
  ]);

  // Hoort dit bij een ander boekjaar dan het actieve? Dan eerst wisselen.
  const heen = (pad: string, boekjaarId: string) =>
    boekjaarId === huidigBoekjaar?.id
      ? pad
      : `/beheer/ga?naar=${encodeURIComponent(pad)}&boekjaar=${boekjaarId}`;
  const jaarErbij = (naam: string, boekjaarId: string) =>
    boekjaarId === huidigBoekjaar?.id ? "" : ` · ${naam}`;

  const resultaten: Zoekresultaat[] = [
    ...facturen.map((factuur) => ({
      soort: "Factuur",
      titel: `${factuur.nummer} · ${factuur.relatie.naam}`,
      onderschrift: `${formatteerEuro(factuur.totaalCenten)} · ${factuur.omschrijving.slice(0, 60)}${jaarErbij(factuur.boekjaar.naam, factuur.boekjaarId)}`,
      href: heen(`/beheer/facturen/${factuur.id}`, factuur.boekjaarId),
    })),
    ...relaties.map((relatie) => ({
      soort: "Relatie",
      titel: relatie.naam,
      onderschrift: [relatie.type, relatie.plaats].filter(Boolean).join(" · "),
      href: `/beheer/relaties/${relatie.id}`,
    })),
    ...uitgaven.map((uitgave) => ({
      soort: "Uitgave",
      titel: `${uitgave.omschrijving.slice(0, 60)} · ${uitgave.leverancierNaam}`,
      onderschrift: `${formatteerEuro(uitgave.bedragCenten)} · ${formatteerDatum(uitgave.datum)}${jaarErbij(uitgave.boekjaar.naam, uitgave.boekjaarId)}`,
      href: heen(`/beheer/uitgaven/${uitgave.id}`, uitgave.boekjaarId),
    })),
    ...evenementen.map((evenement) => ({
      soort: "Evenement",
      titel: evenement.naam,
      onderschrift: `${formatteerDatum(evenement.datum)}${jaarErbij(evenement.boekjaar.naam, evenement.boekjaarId)}`,
      href: heen(`/beheer/evenementen/${evenement.id}`, evenement.boekjaarId),
    })),
  ];

  return Response.json(
    { resultaten },
    { headers: { "Cache-Control": "no-store" } },
  );
}
