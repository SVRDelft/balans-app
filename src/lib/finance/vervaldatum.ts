import { dagenTussen } from "../datum";

/** A due date itself is still within the payment term. Only an outstanding receivable can be late. */
export function dagenTeLaat(vervaldatum: Date, peildatum: Date, openstaandCenten: number): number {
  return openstaandCenten > 0 ? Math.max(0, dagenTussen(vervaldatum, peildatum)) : 0;
}
