// Startgegevens voor een nieuwe installatie. Het script is herhaalbaar: het
// werkt bestaande rijen bij in plaats van ze te verdubbelen.
import "../src/lib/env";

import { db } from "../src/lib/db";
import { maakDag } from "../src/lib/datum";

const BOEKJAAR_NAAM = "SVR 62 · 2026-2027";
const FACTUUR_PREFIX = "SVR62-2026";

/** Aangesloten studieverenigingen. Dit aantal moet het bestuur nog verifiëren. */
const STUDIEVERENIGINGEN = [
  "TG",
  "VvTP",
  "Variscopic",
  "Froude",
  "ETV",
  "PS",
  "LIFE",
  "Curius",
  "CH",
  "ID",
  "VSV",
  "Stylos",
  "MV",
  "Hooke",
  "Leeghwater",
  "Bèta",
];

/** Nemen wel deel aan evenementen, maar betalen geen jaarlijkse bijdrage. */
const OVERIGE_DEELNEMERS = ["ORAS", "YES!Delft"];

type PostInvoer = {
  code: string;
  naam: string;
  categorie: "vast" | "omslag";
  soort: "inkomst" | "uitgave";
  begrootEuro: number;
};

const BEGROTINGSPOSTEN: PostInvoer[] = [
  {
    code: "BIJDRAGE",
    naam: "Bijdrage aangesloten studieverenigingen",
    categorie: "vast",
    soort: "inkomst",
    begrootEuro: 1860,
  },

  { code: "BANKKOSTEN", naam: "Bankkosten", categorie: "vast", soort: "uitgave", begrootEuro: 350 },
  { code: "CONSTITUTIE", naam: "Constitutiekaartjes", categorie: "vast", soort: "uitgave", begrootEuro: 50 },
  { code: "KANTOOR", naam: "Kantoorartikelen", categorie: "vast", soort: "uitgave", begrootEuro: 70 },
  {
    code: "VERZEKERING",
    naam: "Bestuursaansprakelijkheidsverzekering",
    categorie: "vast",
    soort: "uitgave",
    begrootEuro: 200,
  },
  {
    code: "ONVOORZIEN",
    naam: "Overige en onvoorziene kosten",
    categorie: "vast",
    soort: "uitgave",
    begrootEuro: 300,
  },
  { code: "DASSEN", naam: "SVR-dassen en -strikken", categorie: "vast", soort: "uitgave", begrootEuro: 40 },
  { code: "KRANS", naam: "Herdenkingskrans", categorie: "vast", soort: "uitgave", begrootEuro: 300 },
  { code: "KERSTKAARTEN", naam: "Kerstkaarten", categorie: "vast", soort: "uitgave", begrootEuro: 30 },
  { code: "INTEGRATIE", naam: "Integratieactiviteiten", categorie: "vast", soort: "uitgave", begrootEuro: 120 },
  { code: "COBODIES", naam: "SVR cobo en dies", categorie: "vast", soort: "uitgave", begrootEuro: 200 },
  {
    code: "RESERVERING",
    naam: "Reservering eigen vermogen",
    categorie: "vast",
    soort: "uitgave",
    begrootEuro: 200,
  },

  { code: "LBG-IN", naam: "LBG — bijdragen deelnemers", categorie: "omslag", soort: "inkomst", begrootEuro: 9160 },
  { code: "LBG-UIT", naam: "LBG — kosten", categorie: "omslag", soort: "uitgave", begrootEuro: 9160 },
  {
    code: "VERBIND-IN",
    naam: "Verbindende activiteiten — bijdragen deelnemers",
    categorie: "omslag",
    soort: "inkomst",
    begrootEuro: 1500,
  },
  {
    code: "VERBIND-UIT",
    naam: "Verbindende activiteiten — kosten",
    categorie: "omslag",
    soort: "uitgave",
    begrootEuro: 1500,
  },
  {
    code: "AANDENKEN-IN",
    naam: "Aandenken voor besturen — bijdragen deelnemers",
    categorie: "omslag",
    soort: "inkomst",
    begrootEuro: 1500,
  },
  {
    code: "AANDENKEN-UIT",
    naam: "Aandenken voor besturen — kosten",
    categorie: "omslag",
    soort: "uitgave",
    begrootEuro: 1500,
  },
];

async function main() {
  console.log("Startgegevens wegschrijven…");

  await db.instellingen.upsert({
    where: { id: "svr" },
    update: {},
    create: {
      id: "svr",
      organisatieNaam: "StudieVerenigingenRaad Delft",
      plaats: "Delft",
      btwPlichtig: false,
      betaaltermijnDagen: 30,
      factuurVoetnoot:
        "Wij verzoeken u het bedrag binnen de betaaltermijn over te maken onder vermelding van het factuurnummer.",
    },
  });

  const boekjaar = await db.boekjaar.upsert({
    where: { naam: BOEKJAAR_NAAM },
    update: {},
    create: {
      naam: BOEKJAAR_NAAM,
      factuurPrefix: FACTUUR_PREFIX,
      startDatum: maakDag(2026, 9, 1),
      eindDatum: maakDag(2027, 8, 31),
      actief: true,
      beginsaldoBankCenten: 0,
      beginsaldoEigenVermogenCenten: 0,
      notities:
        "Vul het beginsaldo van de bank en het eigen vermogen in bij de start van het jaar.",
    },
  });
  console.log(`  boekjaar: ${boekjaar.naam}`);

  for (const naam of STUDIEVERENIGINGEN) {
    await db.relatie.upsert({
      where: { naam },
      update: { type: "studievereniging", bijdragePlichtig: true, actief: true },
      create: {
        naam,
        type: "studievereniging",
        bijdragePlichtig: true,
        actief: true,
      },
    });
  }
  console.log(`  ${STUDIEVERENIGINGEN.length} studieverenigingen`);

  for (const naam of OVERIGE_DEELNEMERS) {
    await db.relatie.upsert({
      where: { naam },
      update: { bijdragePlichtig: false, actief: true },
      create: {
        naam,
        type: "overig",
        bijdragePlichtig: false,
        actief: true,
        notities: "Neemt deel aan evenementen, betaalt geen jaarlijkse bijdrage.",
      },
    });
  }
  console.log(`  ${OVERIGE_DEELNEMERS.length} overige relaties`);

  let volgorde = 0;
  for (const post of BEGROTINGSPOSTEN) {
    volgorde += 10;
    await db.begrotingspost.upsert({
      where: {
        boekjaarId_code: { boekjaarId: boekjaar.id, code: post.code },
      },
      update: {
        naam: post.naam,
        categorie: post.categorie,
        soort: post.soort,
        begrootCenten: post.begrootEuro * 100,
        volgorde,
      },
      create: {
        boekjaarId: boekjaar.id,
        code: post.code,
        naam: post.naam,
        categorie: post.categorie,
        soort: post.soort,
        begrootCenten: post.begrootEuro * 100,
        volgorde,
      },
    });
  }
  console.log(`  ${BEGROTINGSPOSTEN.length} begrotingsposten`);

  const kostenpost = await db.begrotingspost.findUnique({
    where: { boekjaarId_code: { boekjaarId: boekjaar.id, code: "LBG-UIT" } },
  });
  const opbrengstpost = await db.begrotingspost.findUnique({
    where: { boekjaarId_code: { boekjaarId: boekjaar.id, code: "LBG-IN" } },
  });

  const bestaandLbg = await db.evenement.findFirst({
    where: { boekjaarId: boekjaar.id, naam: "LBG 2027" },
  });
  if (!bestaandLbg) {
    await db.evenement.create({
      data: {
        boekjaarId: boekjaar.id,
        naam: "LBG 2027",
        // Voorlopige datum; pas hem aan zodra de zaal geboekt is.
        datum: maakDag(2027, 3, 11),
        status: "open",
        kostenpostId: kostenpost?.id ?? null,
        opbrengstpostId: opbrengstpost?.id ?? null,
      },
    });
    console.log("  evenement: LBG 2027");
  } else {
    console.log("  evenement: LBG 2027 bestond al");
  }

  console.log("Klaar.");
}

main()
  .catch((fout) => {
    console.error(fout);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
