"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { logAudit } from "@/lib/audit";
import { vereisSessie } from "@/lib/auth/server";
import { controleerEigenWachtwoord, zetWachtwoord } from "@/lib/auth/gebruikers";
import { zetGroepWachtwoord, zoekKeuze } from "@/lib/auth/portaaltoegang";
import {
  GROEP_SESSIE_COOKIE_OPTIES,
  SESSIE_COOKIE,
  isGroepSessie,
  maakGroepSessieCookie,
} from "@/lib/auth/sessie";
import {
  controleerHash,
  keurPortaalWachtwoord,
  keurWachtwoord,
} from "@/lib/auth/wachtwoord";
import { db } from "@/lib/db";
import { voerUit, type ActieStaat } from "@/lib/acties";

/**
 * Je wachtwoord wijzigen. Het huidige moet erbij, ook als je ingelogd bent.
 *
 * Drie gevallen, met elk hun eigen eis:
 * - een bestuursaccount: de strenge eis, want daarachter zit de administratie;
 * - een persoonlijk verenigingsaccount: minstens 4 tekens;
 * - ingelogd als vereniging: ook minstens 4 tekens, en dan wijzigt het
 *   wachtwoord dat het hele bestuur van die vereniging deelt.
 */
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

    if (isGroepSessie(sessie)) {
      const toegang = await db.portaaltoegang.findUnique({
        where: { id: sessie.toegangId },
      });
      if (!toegang?.wachtwoordHash || !(await controleerHash(huidig, toegang.wachtwoordHash))) {
        return { fout: "Het huidige wachtwoord klopt niet." };
      }
      const bezwaar = keurPortaalWachtwoord(nieuw);
      if (bezwaar) return { fout: bezwaar };
      if (nieuw !== herhaling) return { fout: "De twee nieuwe wachtwoorden zijn niet gelijk." };
      if (nieuw === huidig) return { fout: "Kies een ander wachtwoord dan het huidige." };

      const keuze = await zoekKeuze(toegang.sleutel);
      if (!keuze) return { fout: "Deze vereniging staat niet meer in de lijst." };
      const gezet = await zetGroepWachtwoord(keuze, nieuw);

      // Andere apparaten die nog met het oude wachtwoord binnen waren, moeten
      // opnieuw inloggen. Dit apparaat niet: dat krijgt een vers cookie.
      const koekjes = await cookies();
      koekjes.set(
        SESSIE_COOKIE,
        await maakGroepSessieCookie({ toegangId: gezet.id, naam: gezet.naam }),
        GROEP_SESSIE_COOKIE_OPTIES,
      );

      await logAudit({
        gebruiker: `${gezet.naam} (portaal)`,
        entiteit: "Portaaltoegang",
        entiteitId: gezet.id,
        actie: "wachtwoord gewijzigd",
        samenvatting: `${gezet.naam} heeft het gedeelde wachtwoord gewijzigd`,
      });
      doel = "/portaal";
      return;
    }

    if (!(await controleerEigenWachtwoord(sessie.gebruikerId, huidig))) {
      return { fout: "Je huidige wachtwoord klopt niet." };
    }
    const bezwaar =
      sessie.rol === "BESTUUR" ? keurWachtwoord(nieuw) : keurPortaalWachtwoord(nieuw);
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
