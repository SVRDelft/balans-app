import "server-only";

import { db } from "@/lib/db";

// Wat het portaal laat zien. Alles wat hier staat is voor álle aangesloten
// verenigingen bedoeld; er zit bewust niets vereniging-eigens in. Komt dat er
// later wel (bijvoorbeeld de eigen openstaande facturen), dan hoort daar een
// filter op de eigen relatie bij — zie AANNAMES.md.

export async function haalMededelingen(hoeveel = 20) {
  return db.mededeling.findMany({
    orderBy: { geplaatstOp: "desc" },
    take: hoeveel,
  });
}

export async function haalVergaderingen() {
  const vergaderingen = await db.vergadering.findMany({
    orderBy: { datum: "asc" },
    include: {
      gastheer: { select: { naam: true } },
      bestanden: { orderBy: { soort: "asc" } },
    },
  });

  // Vandaag telt nog als "komend": de notulen komen pas later.
  const vandaag = new Date();
  vandaag.setUTCHours(0, 0, 0, 0);
  const komend = vergaderingen.filter((v) => v.datum >= vandaag);
  const geweest = vergaderingen.filter((v) => v.datum < vandaag).reverse();
  return { komend, geweest, alle: vergaderingen };
}

export async function haalDocumenten() {
  return db.portaalbestand.findMany({
    where: { vergaderingId: null },
    orderBy: { geuploadOp: "desc" },
  });
}

export const gastheerVan = (vergadering: {
  gastheer: { naam: string } | null;
  gastheerNaam: string;
}) => vergadering.gastheer?.naam || vergadering.gastheerNaam || "nog niet bekend";
