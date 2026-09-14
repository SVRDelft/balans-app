import "server-only";

import { db } from "@/lib/db";
import { vandaag } from "@/lib/datum";
import {
  OPENSTAANDE_STATUSSEN,
  TELLENDE_STATUSSEN,
  type PostCategorie,
  type PostSoort,
} from "@/lib/domein";
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
import { berekenAfstemming, type Afstemming } from "@/lib/finance/omslag";
import { openstaandBedrag } from "@/lib/finance/factuurstatus";
import { berekenVoorraad } from "@/lib/finance/voorraad";
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
  openstaandeUitgaven: OpenstaandeUitgaveRegel[];
  laatsteBanksaldo: { datum: Date; saldoCenten: number } | null;
  evenementen: EvenementAfstemming[];
  uitgavenZonderPost: number;
  conceptFacturen: number;
  voorraadposten: Voorraadpost[];
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
    }),
  ]);

  // --- realisatie per begrotingspost -------------------------------------
  const inkomstenPerPost = new Map<string, number>();
  const uitgavenPerPost = new Map<string, number>();

  for (const factuur of facturen) {
    if (!TELLENDE_STATUSSEN.includes(factuur.status as never)) continue;
    for (const regel of factuur.regels) {
      const huidig = inkomstenPerPost.get(regel.begrotingspostId) ?? 0;
      inkomstenPerPost.set(regel.begrotingspostId, huidig + regel.bedragCenten);
    }
  }

  for (const uitgave of uitgaven) {
    const huidig = uitgavenPerPost.get(uitgave.begrotingspostId) ?? 0;
    uitgavenPerPost.set(
      uitgave.begrotingspostId,
      huidig + uitgave.bedragCenten,
    );
  }

  const postRealisaties: PostRealisatie[] = posten.map((post) => {
    const viaFacturen = inkomstenPerPost.get(post.id) ?? 0;
    const viaUitgaven = uitgavenPerPost.get(post.id) ?? 0;

    // Een factuurregel op een uitgavenpost is een doorbelasting en verlaagt
    // dus de kosten op die post.
    const gerealiseerdCenten =
      post.soort === "inkomst" ? viaFacturen : viaUitgaven - viaFacturen;

    return {
      id: post.id,
      code: post.code,
      naam: post.naam,
      categorie: post.categorie as PostCategorie,
      soort: post.soort as PostSoort,
      begrootCenten: post.begrootCenten,
      gerealiseerdCenten,
      volgorde: post.volgorde,
    };
  });

  const voorraad = berekenVoorraad(voorraadposten);
  const exploitatie = maakExploitatie(postRealisaties, voorraad.mutatieCenten);

  // --- debiteuren en crediteuren -----------------------------------------
  const openstaandeFacturen: OpenstaandeFactuurRegel[] = [];
  let ontvangenBetalingenCenten = 0;

  for (const factuur of facturen) {
    const betaaldCenten = factuur.betalingen.reduce(
      (som, betaling) => som + betaling.bedragCenten,
      0,
    );
    if (factuur.status !== "concept") {
      ontvangenBetalingenCenten += betaaldCenten;
    }

    if (!OPENSTAANDE_STATUSSEN.includes(factuur.status as never)) continue;

    const openstaandCenten = openstaandBedrag(
      factuur.totaalCenten,
      betaaldCenten,
    );
    if (openstaandCenten === 0) continue;

    openstaandeFacturen.push({
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
    });
  }

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
    crediteurenCenten,
    gerealiseerdeInkomstenCenten: exploitatie.totaalInkomstenGerealiseerdCenten,
    gerealiseerdeUitgavenCenten: exploitatie.totaalUitgavenGerealiseerdCenten,
    ingevoerdBanksaldoCenten: banksaldo?.saldoCenten ?? null,
    voorraadBeginCenten: voorraad.beginwaardeCenten,
    voorraadCenten: voorraad.waardeCenten,
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
    ouderdom: maakOuderdomsanalyse(openstaandeFacturen, vandaag()),
    openstaandeFacturen,
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
  };
}
