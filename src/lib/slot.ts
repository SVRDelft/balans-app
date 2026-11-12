import "server-only";

import type { DbClient } from "@/lib/facturen";

// Sloten op rijen, zodat twee mensen die tegelijk op dezelfde knop drukken
// elkaar niet in de weg zitten. Alles gaat via `FOR UPDATE` binnen een
// transactie: MariaDB geeft het slot dan vanzelf terug als de transactie klaar
// is of mislukt. (Postgres had hiervoor advisory locks; die bestaan in MariaDB
// alleen per verbinding en moeten met de hand worden vrijgegeven.)

/** Vergrendelt één rij tot het einde van de transactie. */
export async function vergrendelRij(
  tx: DbClient,
  tabel: "Boekjaar" | "Uitgave" | "Voorraadpost" | "Factuur",
  id: string,
) {
  // De tabelnaam komt uit het type hierboven en nooit uit invoer van buiten.
  await tx.$queryRawUnsafe(
    `SELECT id FROM \`${tabel}\` WHERE id = ? FOR UPDATE`,
    id,
  );
}

/**
 * Vergrendelt alle boekjaren. Gebruikt bij handelingen die over het hele
 * boekjaar gaan: aanmaken, activeren en boekingen wissen. Op een lege tabel
 * houdt InnoDB het bereik vast, zodat ook twee gelijktijdige aanmaakpogingen
 * netjes op elkaar wachten.
 */
export async function vergrendelBoekjaren(tx: DbClient) {
  await tx.$queryRawUnsafe("SELECT id FROM `Boekjaar` FOR UPDATE");
}
