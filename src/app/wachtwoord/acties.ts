"use server";

import { redirect } from "next/navigation";

import { logAudit } from "@/lib/audit";
import { vereisSessie } from "@/lib/auth/server";
import { controleerEigenWachtwoord, zetWachtwoord } from "@/lib/auth/gebruikers";
import { keurWachtwoord } from "@/lib/auth/wachtwoord";
import { voerUit, type ActieStaat } from "@/lib/acties";

/** Je eigen wachtwoord wijzigen. Het huidige moet erbij, ook als je ingelogd bent. */
export async function wijzigWachtwoord(
  _vorigeStaat: ActieStaat,
  formulier: FormData,
): Promise<ActieStaat> {
  const sessie = await vereisSessie();
  let doel: string | undefined;

  const resultaat = await voerUit(async () => {
    const huidig = String(formulier.get("huidig") ?? "");
    const nieuw = String(formulier.get("nieuw") ?? "");
    const herhaling = String(formulier.get("herhaling") ?? "");

    if (!(await controleerEigenWachtwoord(sessie.gebruikerId, huidig))) {
      return { fout: "Je huidige wachtwoord klopt niet." };
    }
    const bezwaar = keurWachtwoord(nieuw);
    if (bezwaar) return { fout: bezwaar };
    if (nieuw !== herhaling) return { fout: "De twee nieuwe wachtwoorden zijn niet gelijk." };
    if (nieuw === huidig) return { fout: "Kies een ander wachtwoord dan het huidige." };

    await zetWachtwoord(sessie.gebruikerId, nieuw, false);
    await logAudit({
      gebruiker: sessie.naam,
      entiteit: "Gebruiker",
      entiteitId: sessie.gebruikerId,
      actie: "wachtwoord gewijzigd",
      samenvatting: `${sessie.naam} heeft het eigen wachtwoord gewijzigd`,
    });

    doel = sessie.rol === "BESTUUR" ? "/beheer" : "/portaal";
    return;
  });

  if (resultaat.fout) return resultaat;
  if (doel) redirect(doel);
  return resultaat;
}
