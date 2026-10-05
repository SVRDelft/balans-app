import "server-only";

import { db } from "@/lib/db";
import { vandaag } from "@/lib/datum";
import { type PostCategorie, type PostSoort } from "@/lib/domein";
import { berekenBalans, type Balans } from "@/lib/finance/balans";
import {
  maakExploitatie,
  type Exploitatie,
  type PostRealisatie,
} from "@/lib/finance/exploitatie";
import {
  maakOuderdomsanalyse,
  type Ouderdomsanalyse,
} from "@/lib/finance/debiteuren";
import {
  maakRekeningcourant,
  resultaatEffectCenten,
  type Rekeningcourant,
} from "@/lib/finance/rekeningcourant";
import { berekenAfstemming, type Afstemming } from "@/lib/finance/omslag";
import {
  factuurOpenstaand,
  factuurRegelRealisaties,
} from "@/lib/finance/factuurstanden";
import { factuurStandRelaties } from "@/lib/factuur-includes";
import { berekenVoorraad } from "@/lib/finance/voorraad";
import { rekenVoorraadToe } from "@/lib/finance/voorraadtoerekening";
import type { Voorraadpost } from "@/generated/prisma/client";

export interface OpenstaandeFactuurRegel {
  id: string;
  nummer: string;
  relatieId: string;
  relatieNaam: string;
  factuurdatum: Date;
  vervaldatum: Date;
  totaalCenten: number;
  betaaldCenten: number;
  openstaandCenten: number;
  status: string;
  /** Hoe vaak er al aan herinnerd is, en wanneer voor het laatst. */
  herinneringen: number;
  laatsteHerinneringOp: Date | null;
}

export interface OpenstaandeUitgaveRegel {
  id: string;
  datum: Date;
  leverancierNaam: string;
  omschrijving: string;
  bedragCenten: number;
}

export interface EvenementAfstemming {
  id: string;
  naam: string;
  status: string;
  afstemming: Afstemming;
}

export interface BoekjaarCijfers {
  posten: PostRealisatie[];
  exploitatie: Exploitatie;
  balans: Balans;
  ouderdom: Ouderdomsanalyse;
  openstaandeFacturen: OpenstaandeFactuurRegel[];
  /**
   * Facturen uit eerdere boekjaren waar nog geld van moet komen. Ze horen bij de
   * exploitatie van dat oude jaar, maar het geld komt in dit jaar binnen.
   */
  eerdereOpenstaandeFacturen: (OpenstaandeFactuurRegel & {
    boekjaarNaam: string;
  })[];
  rekeningcourant: Rekeningcourant;
  openstaandeUitgaven: OpenstaandeUitgaveRegel[];
  laatsteBanksaldo: { datum: Date; saldoCenten: number } | null;
  evenementen: EvenementAfstemming[];
  uitgavenZonderPost: number;
  conceptFacturen: number;
  /** Bankregels die zijn ingelezen maar nog niet gekoppeld of genegeerd. */
  openBankregels: number;
  voorraadposten: (Voorraadpost & {
    begrotingspost: { code: string; naam: string } | null;
  })[];
  voorraad: ReturnType<typeof berekenVoorraad>;
}

/**
 * Alle cijfers van één boekjaar in één keer. Dashboard, balans, exploitatie en
 * de overdrachtsexport rekenen allemaal hiermee, zodat ze onderling niet kunnen
 * gaan afwijken.
 *
 * Uitgangspunt is het baten-lastenstelsel: een factuur telt mee zodra hij
 * verstuurd is en een uitgave zodra hij geregistreerd is, ongeacht of er al
 * betaald is.
 */
export async function haalBoekjaarCijfers(
  boekjaarId: string,
): Promise<BoekjaarCijfers> {
  const [
    boekjaar,
    posten,
    facturen,
    uitgaven,
    banksaldo,
    evenementen,
    voorraadposten,
  ] = await Promise.all([
    db.boekjaar.findUniqueOrThrow({ where: { id: boekjaarId } }),
    db.begrotingspost.findMany({
      where: { boekjaarId },
      orderBy: [{ volgorde: "asc" }, { code: "asc" }],
    }),
    db.factuur.findMany({
      where: { boekjaarId },
      include: {
        ...factuurStandRelaties,
        regels: true,
        betalingen: true,
        relatie: { select: { id: true, naam: true } },
      },
      orderBy: { volgnummer: "asc" },
    }),
    db.uitgave.findMany({
      where: { boekjaarId },
      orderBy: { datum: "asc" },
    }),
    db.banksaldo.findFirst({
      where: { boekjaarId },
      orderBy: [{ datum: "desc" }, { ingevoerdOp: "desc" }],
    }),
    db.evenement.findMany({
      where: { boekjaarId },
      include: {
        deelnemers: true,
        uitgaven: true,
        facturen: { include: { betalingen: true } },
      },
      orderBy: { datum: "asc" },
    }),
    db.voorraadpost.findMany({
      where: { boekjaarId },
      orderBy: { naam: "asc" },
      include: { begrotingspost: { select: { code: true, naam: true } } },
    }),
  ]);

  // Geld stroomt niet netjes binnen de grenzen van een boekjaar. Een factuur van
  // vorig jaar kan dit jaar betaald worden, en iemand kan een privébedrag van de
  // SVR-rekening pas een jaar later terugbetalen. Daarom wordt hier gekeken naar
  // alle boekjaren tot en met dit jaar.
  const alleBoekjaren = await db.boekjaar.findMany({
    select: { id: true, naam: true, startDatum: true },
  });
  const jaarStart = new Map(
    alleBoekjaren.map((jaar) => [jaar.id, jaar.startDatum]),
  );
  const jaarNaam = new Map(alleBoekjaren.map((jaar) => [jaar.id, jaar.naam]));
  const startVan = (id: string) => jaarStart.get(id) ?? boekjaar.startDatum;
  /** Hoort dit boekjaar bij dit jaar of een jaar daarvoor? */
  const totEnMetNu = (id: string) => startVan(id) <= boekjaar.startDatum;
  const eerderJaar = (id: string) => startVan(id) < boekjaar.startDatum;

  const [eerdereFacturen, ontvangen, rekeningposten, openBankregels] = await Promise.all([
    db.factuur.findMany({
      where: { boekjaarId: { not: boekjaarId }, status: { not: "concept" } },
      include: {
        ...factuurStandRelaties,
        betalingen: true,
        relatie: { select: { id: true, naam: true } },
      },
      orderBy: { nummer: "asc" },
    }),
    db.betaling.aggregate({
      where: { boekjaarId, factuur: { status: { not: "concept" } } },
      _sum: { bedragCenten: true },
    }),
    db.rekeningpost.findMany({
      include: {
        relatie: { select: { id: true, naam: true, type: true } },
        begrotingspost: { select: { id: true, soort: true } },
      },
      orderBy: { datum: "asc" },
    }),
    db.bankmutatie.count({ where: { boekjaarId, verwerking: "open" } }),
  ]);

  // De stand van een factuur zoals die bij dit boekjaar hoort: een betaling die
  // in een later jaar is geboekt, telt hier nog niet mee.
  type MetBetalingen = {
    betalingen: { bedragCenten: number; boekjaarId: string }[];
  };
  const tot = <T extends MetBetalingen>(factuur: T): T => ({
    ...factuur,
    betalingen: factuur.betalingen.filter((betaling) =>
      totEnMetNu(betaling.boekjaarId),
    ),
  });
  const stand = <
    T extends MetBetalingen & {
      creditfactuur?: MetBetalingen | null;
      crediteertFactuur?: MetBetalingen | null;
    },
  >(
    factuur: T,
  ): T => ({
    ...tot(factuur),
    creditfactuur: factuur.creditfactuur ? tot(factuur.creditfactuur) : factuur.creditfactuur,
    crediteertFactuur: factuur.crediteertFactuur
      ? tot(factuur.crediteertFactuur)
      : factuur.crediteertFactuur,
  });

  // --- realisatie per begrotingspost -------------------------------------
  const inkomstenPerPost = new Map<string, number>();
  const uitgavenPerPost = new Map<string, number>();

  for (const factuur of facturen) {
    if (factuur.status === "concept") continue;
    const bedragen = factuurRegelRealisaties(
      stand(factuur),
      factuur.regels.map((regel) => regel.bedragCenten),
    );
    for (const [index, regel] of factuur.regels.entries()) {
      const huidig = inkomstenPerPost.get(regel.begrotingspostId) ?? 0;
      inkomstenPerPost.set(regel.begrotingspostId, huidig + bedragen[index]);
    }
  }

  for (const uitgave of uitgaven) {
    const huidig = uitgavenPerPost.get(uitgave.begrotingspostId) ?? 0;
    uitgavenPerPost.set(
      uitgave.begrotingspostId,
      huidig + uitgave.bedragCenten,
    );
  }

  // Een rekening-courantpost die niet via de bank liep, is een correctie: een
  // bedrag dat de SVR voor eigen rekening neemt of alsnog als opbrengst boekt.
  // Alleen die posten raken de exploitatie; geld dat alleen maar heen en weer
  // gaat, is geen kostenpost.
  const rekeningpostenDitJaar = rekeningposten.filter(
    (post) => post.boekjaarId === boekjaarId,
  );
  for (const post of rekeningpostenDitJaar) {
    const effect = resultaatEffectCenten(post);
    if (effect === 0 || !post.begrotingspost) continue;
    if (post.begrotingspost.soort === "inkomst") {
      const huidig = inkomstenPerPost.get(post.begrotingspost.id) ?? 0;
      inkomstenPerPost.set(post.begrotingspost.id, huidig + effect);
    } else {
      const huidig = uitgavenPerPost.get(post.begrotingspost.id) ?? 0;
      uitgavenPerPost.set(post.begrotingspost.id, huidig - effect);
    }
  }

  // Het verbruik van spullen telt mee als kosten op de begrotingspost waaraan
  // ze hangen; de rest blijft op de verzamelregel staan.
  const toerekening = rekenVoorraadToe(
    voorraadposten,
    new Set(
      posten.filter((post) => post.soort === "uitgave").map((post) => post.id),
    ),
  );

  const postRealisaties: PostRealisatie[] = posten.map((post) => {
    const viaFacturen = inkomstenPerPost.get(post.id) ?? 0;
    const viaUitgaven = uitgavenPerPost.get(post.id) ?? 0;
    const viaVoorraad = toerekening.kostenPerBegrotingspost.get(post.id) ?? 0;

    // Een factuurregel op een uitgavenpost is een doorbelasting en verlaagt
    // dus de kosten op die post.
    const gerealiseerdCenten =
      post.soort === "inkomst"
        ? viaFacturen
        : viaUitgaven - viaFacturen + viaVoorraad;

    return {
      id: post.id,
      code: post.code,
      naam: post.naam,
      categorie: post.categorie as PostCategorie,
      soort: post.soort as PostSoort,
      begrootCenten: post.begrootCenten,
      gerealiseerdCenten,
      voorraadVerbruikCenten: viaVoorraad,
      volgorde: post.volgorde,
    };
  });

  const voorraad = berekenVoorraad(voorraadposten);
  const exploitatie = maakExploitatie(
    postRealisaties,
    toerekening.buitenPostenCenten,
  );

  // --- debiteuren en crediteuren -----------------------------------------
  // Alle ontvangsten die in dit boekjaar zijn geboekt, ook die op een factuur uit
  // een eerder jaar. Het geld zit immers nu op de rekening.
  const ontvangenBetalingenCenten = ontvangen._sum.bedragCenten ?? 0;

  const maakRegel = (
    factuur: (typeof facturen)[number] | (typeof eerdereFacturen)[number],
  ): OpenstaandeFactuurRegel | null => {
    const nu = stand(factuur);
    const betaaldCenten = nu.betalingen.reduce(
      (som, betaling) => som + betaling.bedragCenten,
      0,
    );
    const openstaandCenten = factuurOpenstaand(nu);
    if (openstaandCenten === 0) return null;
    return {
      id: factuur.id,
      nummer: factuur.nummer,
      relatieId: factuur.relatie.id,
      relatieNaam: factuur.relatie.naam,
      factuurdatum: factuur.factuurdatum,
      vervaldatum: factuur.vervaldatum,
      totaalCenten: factuur.totaalCenten,
      betaaldCenten,
      openstaandCenten,
      status: factuur.status,
      herinneringen: factuur.herinneringen,
      laatsteHerinneringOp: factuur.laatsteHerinneringOp,
    };
  };

  const openstaandeFacturen = facturen
    .map(maakRegel)
    .filter((regel): regel is OpenstaandeFactuurRegel => regel !== null);

  const eerdereOpenstaandeFacturen = eerdereFacturen
    .filter((factuur) => eerderJaar(factuur.boekjaarId))
    .map((factuur) => {
      const regel = maakRegel(factuur);
      return regel
        ? { ...regel, boekjaarNaam: jaarNaam.get(factuur.boekjaarId) ?? "" }
        : null;
    })
    .filter((regel): regel is OpenstaandeFactuurRegel & { boekjaarNaam: string } =>
      regel !== null,
    );

  // De vorderingen waarmee dit boekjaar begon: facturen uit eerdere jaren die bij
  // de jaarwissel nog openstonden, plus het rekening-courantsaldo van toen.
  const eerdereDebiteurenCenten = eerdereOpenstaandeFacturen.reduce(
    (som, factuur) => som + factuur.openstaandCenten,
    0,
  );
  const openBijJaarwissel = eerdereFacturen
    .filter((factuur) => eerderJaar(factuur.boekjaarId))
    .reduce((som, factuur) => {
      const toen = {
        ...factuur,
        betalingen: factuur.betalingen.filter((betaling) =>
          eerderJaar(betaling.boekjaarId),
        ),
        creditfactuur: factuur.creditfactuur
          ? {
              ...factuur.creditfactuur,
              betalingen: factuur.creditfactuur.betalingen.filter((betaling) =>
                eerderJaar(betaling.boekjaarId),
              ),
            }
          : factuur.creditfactuur,
        crediteertFactuur: factuur.crediteertFactuur
          ? {
              ...factuur.crediteertFactuur,
              betalingen: factuur.crediteertFactuur.betalingen.filter(
                (betaling) => eerderJaar(betaling.boekjaarId),
              ),
            }
          : factuur.crediteertFactuur,
      };
      return som + factuurOpenstaand(toen);
    }, 0);

  const rekeningcourant = maakRekeningcourant(
    rekeningposten
      .filter((post) => totEnMetNu(post.boekjaarId))
      .map((post) => ({
        relatieId: post.relatie.id,
        relatieNaam: post.relatie.naam,
        relatieType: post.relatie.type,
        datum: post.datum,
        bedragCenten: post.bedragCenten,
        viaBank: post.viaBank,
        eerderBoekjaar: eerderJaar(post.boekjaarId),
      })),
  );

  const openstaandeUitgaven: OpenstaandeUitgaveRegel[] = uitgaven
    .filter((uitgave) => !uitgave.betaald)
    .map((uitgave) => ({
      id: uitgave.id,
      datum: uitgave.datum,
      leverancierNaam: uitgave.leverancierNaam,
      omschrijving: uitgave.omschrijving,
      bedragCenten: uitgave.bedragCenten,
    }));

  const debiteurenCenten = openstaandeFacturen.reduce(
    (som, factuur) => som + factuur.openstaandCenten,
    0,
  );
  const crediteurenCenten = openstaandeUitgaven.reduce(
    (som, uitgave) => som + uitgave.bedragCenten,
    0,
  );
  const betaaldeUitgavenCenten = uitgaven
    .filter((uitgave) => uitgave.betaald)
    .reduce((som, uitgave) => som + uitgave.bedragCenten, 0);

  const balans = berekenBalans({
    beginsaldoBankCenten: boekjaar.beginsaldoBankCenten,
    beginsaldoEigenVermogenCenten: boekjaar.beginsaldoEigenVermogenCenten,
    ontvangenBetalingenCenten,
    betaaldeUitgavenCenten,
    debiteurenCenten,
    eerdereDebiteurenCenten,
    overgenomenVorderingenCenten:
      openBijJaarwissel + rekeningcourant.overgenomenCenten,
    teVorderenRekeningcourantCenten: rekeningcourant.teVorderenCenten,
    teBetalenRekeningcourantCenten: rekeningcourant.teBetalenCenten,
    rekeningcourantViaBankCenten: rekeningcourant.viaBankCenten,
    crediteurenCenten,
    gerealiseerdeInkomstenCenten: exploitatie.totaalInkomstenGerealiseerdCenten,
    gerealiseerdeUitgavenCenten: exploitatie.totaalUitgavenGerealiseerdCenten,
    ingevoerdBanksaldoCenten: banksaldo?.saldoCenten ?? null,
    voorraadBeginCenten: voorraad.beginwaardeCenten,
    voorraadCenten: voorraad.waardeCenten,
    // Het toegerekende deel zit al in de gerealiseerde uitgaven hierboven.
    voorraadMutatieBuitenPostenCenten: toerekening.buitenPostenCenten,
  });

  // --- afstemming per evenement ------------------------------------------
  const evenementAfstemmingen: EvenementAfstemming[] = evenementen.map(
    (evenement) => {
      const totaleKostenCenten = evenement.uitgaven.reduce(
        (som, uitgave) => som + uitgave.bedragCenten,
        0,
      );
      const tenLasteVanSvrCenten = evenement.uitgaven
        .filter((uitgave) => uitgave.tenLasteVanSvr)
        .reduce((som, uitgave) => som + uitgave.bedragCenten, 0);
      const nogNietVerdeeldCenten = evenement.uitgaven
        .filter(
          (uitgave) =>
            uitgave.omslagrondeId === null && !uitgave.tenLasteVanSvr,
        )
        .reduce((som, uitgave) => som + uitgave.bedragCenten, 0);

      // Voor de afstemming tellen álle facturen mee, ook de concepten: de vraag
      // is of de kosten volledig zijn doorbelast. Een gecrediteerde factuur en
      // zijn creditfactuur heffen elkaar vanzelf op.
      const gefactureerdCenten = evenement.facturen.reduce(
        (som, factuur) => som + factuur.totaalCenten,
        0,
      );
      const conceptCenten = evenement.facturen
        .filter((factuur) => factuur.status === "concept")
        .reduce((som, factuur) => som + factuur.totaalCenten, 0);
      const ontvangenCenten = evenement.facturen.reduce(
        (som, factuur) =>
          som +
          factuur.betalingen.reduce(
            (deel, betaling) => deel + betaling.bedragCenten,
            0,
          ),
        0,
      );

      const aantalBevestigd = evenement.deelnemers.reduce(
        (som, deelnemer) =>
          deelnemer.bevestigdBetalend ? som + deelnemer.aantalPersonen : som,
        0,
      );

      return {
        id: evenement.id,
        naam: evenement.naam,
        status: evenement.status,
        afstemming: berekenAfstemming({
          totaleKostenCenten,
          tenLasteVanSvrCenten,
          nogNietVerdeeldCenten,
          gefactureerdCenten,
          conceptCenten,
          ontvangenCenten,
          aantalBevestigd,
        }),
      };
    },
  );

  const bekendePostIds = new Set(posten.map((post) => post.id));

  return {
    posten: postRealisaties,
    exploitatie,
    balans,
    voorraad,
    voorraadposten,
    ouderdom: maakOuderdomsanalyse(
      [...openstaandeFacturen, ...eerdereOpenstaandeFacturen],
      vandaag(),
    ),
    openstaandeFacturen,
    eerdereOpenstaandeFacturen,
    rekeningcourant,
    openstaandeUitgaven,
    laatsteBanksaldo: banksaldo
      ? { datum: banksaldo.datum, saldoCenten: banksaldo.saldoCenten }
      : null,
    evenementen: evenementAfstemmingen,
    // Hoort altijd nul te zijn: de begrotingspost is verplicht. Blijft staan als
    // controle op gegevens die van buitenaf in de database komen.
    uitgavenZonderPost: uitgaven.filter(
      (uitgave) => !bekendePostIds.has(uitgave.begrotingspostId),
    ).length,
    conceptFacturen: facturen.filter((factuur) => factuur.status === "concept")
      .length,
    openBankregels,
  };
}
