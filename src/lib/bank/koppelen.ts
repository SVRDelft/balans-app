export interface Bankregel {
  datum: Date;
  bedragCenten: number;
  omschrijving: string;
  tegenpartijNaam: string;
  tegenpartijIban: string;
}
export interface FactuurKeuze {
  id: string;
  nummer: string;
  relatieNaam: string;
  iban: string;
  openstaandCenten: number;
  status: string;
}
export interface BetalingKeuze {
  id: string;
  factuurId: string;
  datum: Date;
  bedragCenten: number;
}
export interface UitgaveKeuze {
  id: string;
  omschrijving: string;
  leverancierNaam: string;
  iban: string;
  bedragCenten: number;
  betaald: boolean;
  betaaldOp?: Date | null;
}
export interface Voorstel { waarde: string; reden: string }

const tekst = (waarde: string) => waarde.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toUpperCase().replace(/[^A-Z0-9]/g, "");
export const normaliseerRekening = (waarde: string) => waarde.toUpperCase().replace(/[^A-Z0-9]/g, "");
const zelfdeDag = (a: Date, b: Date) => a.toISOString().slice(0, 10) === b.toISOString().slice(0, 10);

/** Suggest only a single, identifiable counterpart. An amount alone is insufficient. */
export function zoekBankVoorstel(regel: Bankregel, facturen: FactuurKeuze[], betalingen: BetalingKeuze[], uitgaven: UitgaveKeuze[]): Voorstel | undefined {
  if (regel.bedragCenten === 0) return;
  const omschrijving = regel.omschrijving.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toUpperCase();
  const iban = normaliseerRekening(regel.tegenpartijIban);
  const vermeld = facturen.filter(f => {
    const nummer = tekst(f.nummer);
    // Match the complete identifier, allowing banks to replace its separators.
    // A substring of another invoice/reference is not sufficient for booking.
    return nummer.length >= 6 && new RegExp(`(?:^|[^A-Z0-9])${nummer.split("").join("[^A-Z0-9]*")}(?![A-Z0-9])`).test(omschrijving);
  });
  if (vermeld.length > 1) return;
  const herkenbaar = vermeld.length ? vermeld : facturen.filter(f => iban && normaliseerRekening(f.iban) === iban);
  const bestaand = betalingen.filter(b => herkenbaar.some(f => f.id === b.factuurId) && b.bedragCenten === regel.bedragCenten && zelfdeDag(b.datum, regel.datum));
  if (bestaand.length === 1) return { waarde: `betaling:${bestaand[0].id}`, reden: "Bedrag en datum komen overeen met een al ingevoerde betaling. Er wordt geen tweede betaling geboekt." };
  if (bestaand.length > 1) return;
  const passend = herkenbaar.filter(f => f.status !== "concept" && f.status !== "oninbaar" && Math.sign(f.openstaandCenten) === Math.sign(regel.bedragCenten) && (vermeld.length ? Math.abs(regel.bedragCenten) <= Math.abs(f.openstaandCenten) : regel.bedragCenten === f.openstaandCenten));
  if (passend.length === 1) return { waarde: `factuur:${passend[0].id}`, reden: vermeld.length ? `Factuurnummer ${passend[0].nummer} herkend; het bedrag past bij het openstaande saldo.` : "IBAN en openstaand bedrag komen overeen met één factuur." };
  if (vermeld.length || regel.bedragCenten >= 0) return;
  const naam = tekst(regel.tegenpartijNaam);
  const kosten = uitgaven.filter(u => u.bedragCenten === -regel.bedragCenten &&
    (!u.betaald || (u.betaaldOp && zelfdeDag(u.betaaldOp, regel.datum))) &&
    ((iban && normaliseerRekening(u.iban) === iban) || (naam.length >= 4 && tekst(u.leverancierNaam).length >= 4 && naam === tekst(u.leverancierNaam))));
  if (kosten.length === 1) return { waarde: `uitgave:${kosten[0].id}`, reden: `Leverancier en bedrag komen overeen met één ${kosten[0].betaald ? "al betaalde " : ""}uitgave.` };
}

/** Reserve suggested targets so a bulk confirmation never allocates one item twice. */
export function bankVoorstellen(regels: (Bankregel & { id: string })[], facturen: FactuurKeuze[], betalingen: BetalingKeuze[], uitgaven: UitgaveKeuze[]) {
  const voorstellen = new Map<string, Voorstel>();
  const gereserveerd = new Set<string>();
  for (const regel of regels) {
    const voorstel = zoekBankVoorstel(regel, facturen, betalingen, uitgaven);
    if (voorstel && !gereserveerd.has(voorstel.waarde)) {
      voorstellen.set(regel.id, voorstel);
      gereserveerd.add(voorstel.waarde);
    }
  }
  return voorstellen;
}
