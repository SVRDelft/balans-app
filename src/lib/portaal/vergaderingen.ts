/** De vier overleggen van de SVR. */
export const REEKSEN = ["SVR", "SVR-O", "SVeuRo", "SVjwR"] as const;
export type Reeks = (typeof REEKSEN)[number];

export const REEKS_UITLEG: Record<Reeks, string> = {
  SVR: "Voorzitters",
  "SVR-O": "Commissarissen onderwijs",
  SVeuRo: "Penningmeesters",
  SVjwR: "Eerstejaarsweekenden",
};

/**
 * De vergaderingen van 2026-2027, zoals ze in het jaarrooster staan. Een
 * volgend bestuur voert ze zelf in bij Beheer › Portaal; deze lijst zit in het
 * seed-script zodat het eerste jaar niet met de hand getypt hoeft te worden.
 */
export const VERGADERINGEN_2026_2027: {
  reeks: Reeks;
  datum: string;
  tijd: string;
  gastheer: string;
}[] = [
  { reeks: "SVR", datum: "2026-09-22", tijd: "14:00", gastheer: "Stylos" },
  { reeks: "SVR-O", datum: "2026-09-29", tijd: "14:00", gastheer: "Leeghwater" },
  { reeks: "SVeuRo", datum: "2026-10-06", tijd: "14:00", gastheer: "Variscopic" },
  { reeks: "SVR", datum: "2026-10-13", tijd: "14:00", gastheer: "Froude" },
  { reeks: "SVR", datum: "2026-11-10", tijd: "14:00", gastheer: "VvTP" },
  { reeks: "SVeuRo", datum: "2026-12-01", tijd: "14:00", gastheer: "MV" },
  { reeks: "SVR", datum: "2026-12-08", tijd: "14:00", gastheer: "ETV" },
  { reeks: "SVR-O", datum: "2026-12-15", tijd: "14:00", gastheer: "PS" },
  { reeks: "SVR", datum: "2027-01-12", tijd: "14:00", gastheer: "CH" },
  { reeks: "SVR", datum: "2027-02-16", tijd: "14:00", gastheer: "Curius" },
  { reeks: "SVR-O", datum: "2027-02-23", tijd: "14:00", gastheer: "ID" },
  { reeks: "SVjwR", datum: "2027-03-02", tijd: "16:00", gastheer: "Stylos" },
  { reeks: "SVeuRo", datum: "2027-03-09", tijd: "14:00", gastheer: "Hooke" },
  { reeks: "SVR", datum: "2027-03-16", tijd: "14:00", gastheer: "Leeghwater" },
  { reeks: "SVjwR", datum: "2027-03-23", tijd: "16:00", gastheer: "VSV" },
  { reeks: "SVR", datum: "2027-04-20", tijd: "14:00", gastheer: "LIFE" },
  { reeks: "SVR-O", datum: "2027-05-11", tijd: "14:00", gastheer: "ETV" },
  { reeks: "SVR", datum: "2027-05-18", tijd: "14:00", gastheer: "VSV" },
  { reeks: "SVeuRo", datum: "2027-05-25", tijd: "14:00", gastheer: "PS" },
  { reeks: "SVjwR", datum: "2027-06-01", tijd: "16:00", gastheer: "VvTP" },
  { reeks: "SVR", datum: "2027-06-08", tijd: "14:00", gastheer: "TG" },
];

export const isReeks = (waarde: string): waarde is Reeks =>
  (REEKSEN as readonly string[]).includes(waarde);
