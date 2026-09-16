import "server-only";
import { unstable_rethrow } from "next/navigation";

/** Wat een server action teruggeeft aan het formulier. */
export interface ActieStaat {
  fout?: string;
  melding?: string;
  /** Per veldnaam een foutmelding. */
  veldfouten?: Record<string, string>;
}

/**
 * redirect() en notFound() werken door een speciale fout te gooien. Die mag een
 * catch nooit opslokken.
 */

/**
 * Voert een mutatie uit en zet een onverwachte fout om in een nette melding,
 * zodat de gebruiker niet op een foutpagina belandt en zijn invoer kwijt is.
 */
export async function voerUit(
  taak: () => Promise<ActieStaat | void>,
): Promise<ActieStaat> {
  try {
    return (await taak()) ?? {};
  } catch (fout) {
    unstable_rethrow(fout);

    const bericht =
      fout instanceof Error ? fout.message : "Er ging iets mis bij het opslaan.";

    // Databasefouten zijn voor een penningmeester onleesbaar; de meest
    // voorkomende vertalen we naar gewone taal.
    if (bericht.includes("Unique constraint")) {
      return { fout: "Deze waarde bestaat al. Kies een andere." };
    }
    if (bericht.includes("Foreign key constraint")) {
      return {
        fout: "Dit onderdeel is nog ergens aan gekoppeld en kan daarom niet verwijderd worden.",
      };
    }

    console.error(fout);
    if (fout instanceof Error && (fout.name.startsWith("Prisma") || "code" in fout)) {
      return { fout: "Opslaan is niet gelukt. Vernieuw de pagina en probeer het opnieuw." };
    }
    return { fout: bericht };
  }
}

export function leesTekst(
  formulier: FormData,
  naam: string,
): string | undefined {
  const waarde = formulier.get(naam);
  if (typeof waarde !== "string") return undefined;
  const geschoond = waarde.trim();
  return geschoond === "" ? undefined : geschoond;
}

export function leesVinkje(formulier: FormData, naam: string): boolean {
  const waarde = formulier.get(naam);
  return waarde === "on" || waarde === "true" || waarde === "1";
}

export function leesGeheelGetal(
  formulier: FormData,
  naam: string,
): number | undefined {
  const tekst = leesTekst(formulier, naam);
  if (tekst === undefined) return undefined;
  const getal = Number(tekst.replace(",", "."));
  if (!Number.isFinite(getal)) return undefined;
  return Math.round(getal);
}
