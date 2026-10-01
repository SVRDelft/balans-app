"use server";

import { revalidatePath } from "next/cache";

import { logAudit } from "@/lib/audit";
import { vereisBestuur } from "@/lib/auth/server";
import { normaliseerEmail } from "@/lib/auth/gebruikers";
import { hashWachtwoord, maakWachtwoord } from "@/lib/auth/wachtwoord";
import { db } from "@/lib/db";
import { leesTekst, voerUit, type ActieStaat } from "@/lib/acties";

const GELDIG_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/**
 * Maakt een account aan met een wachtwoord dat de app zelf verzint. Dat
 * wachtwoord wordt één keer getoond; daarna staat alleen de hash in de
 * database. De eigenaar kiest bij de eerste keer inloggen een eigen wachtwoord.
 */
export async function maakAccount(
  _vorigeStaat: ActieStaat,
  formulier: FormData,
): Promise<ActieStaat> {
  const sessie = await vereisBestuur();

  return voerUit(async () => {
    const email = normaliseerEmail(String(formulier.get("email") ?? ""));
    const naam = leesTekst(formulier, "naam");
    const rol = String(formulier.get("rol") ?? "");
    const relatieId = leesTekst(formulier, "relatieId") ?? null;

    if (!GELDIG_EMAIL.test(email)) return { fout: "Vul een geldig e-mailadres in." };
    if (!naam) return { fout: "Vul de naam in die in het auditlog moet komen." };
    if (rol !== "BESTUUR" && rol !== "SV") return { fout: "Kies een rol." };
    if (rol === "SV" && !relatieId) {
      return { fout: "Kies bij een verenigingsaccount de studievereniging." };
    }
    if (rol === "BESTUUR" && relatieId) {
      return { fout: "Een bestuursaccount hoort niet bij één vereniging." };
    }

    if (relatieId) {
      const relatie = await db.relatie.findUnique({ where: { id: relatieId } });
      if (!relatie || relatie.type !== "studievereniging") {
        return { fout: "Kies een studievereniging uit de lijst." };
      }
    }

    if (await db.gebruiker.findUnique({ where: { email } })) {
      return { fout: "Er bestaat al een account met dit e-mailadres." };
    }

    const wachtwoord = maakWachtwoord();
    const gebruiker = await db.gebruiker.create({
      data: {
        email,
        naam,
        rol,
        relatieId,
        wachtwoordHash: await hashWachtwoord(wachtwoord),
        moetWijzigen: true,
      },
    });

    await logAudit({
      gebruiker: sessie.naam,
      entiteit: "Gebruiker",
      entiteitId: gebruiker.id,
      actie: "aangemaakt",
      samenvatting: `Account ${email} aangemaakt met rol ${rol}`,
    });

    revalidatePath("/beheer/accounts");
    return {
      melding: `Account ${email} aangemaakt. Geef dit wachtwoord door: ${wachtwoord} — het is hierna niet meer op te vragen.`,
    };
  });
}

/** Zet een account aan of uit. Accounts worden nooit echt verwijderd. */
export async function zetActief(
  _vorigeStaat: ActieStaat,
  formulier: FormData,
): Promise<ActieStaat> {
  const sessie = await vereisBestuur();

  return voerUit(async () => {
    const id = leesTekst(formulier, "id");
    const actief = String(formulier.get("actief") ?? "") === "ja";
    if (!id) return { fout: "Onbekend account." };

    const gebruiker = await db.gebruiker.findUnique({ where: { id } });
    if (!gebruiker) return { fout: "Dit account bestaat niet meer." };

    if (!actief && gebruiker.id === sessie.gebruikerId) {
      return { fout: "Je kunt je eigen account niet uitzetten." };
    }
    if (!actief && gebruiker.rol === "BESTUUR") {
      const overig = await db.gebruiker.count({
        where: { rol: "BESTUUR", actief: true, id: { not: gebruiker.id } },
      });
      if (overig === 0) {
        return {
          fout: "Dit is het laatste actieve bestuursaccount; zonder dat komt niemand meer in de administratie.",
        };
      }
    }

    await db.gebruiker.update({ where: { id }, data: { actief } });
    await logAudit({
      gebruiker: sessie.naam,
      entiteit: "Gebruiker",
      entiteitId: id,
      actie: actief ? "geactiveerd" : "gedeactiveerd",
      samenvatting: `Account ${gebruiker.email} ${actief ? "weer aangezet" : "uitgezet"}`,
    });

    revalidatePath("/beheer/accounts");
    return { melding: `Account ${gebruiker.email} is ${actief ? "weer actief" : "uitgezet"}.` };
  });
}

/** Geeft een nieuw wachtwoord uit, bijvoorbeeld als iemand het kwijt is. */
export async function nieuwWachtwoord(
  _vorigeStaat: ActieStaat,
  formulier: FormData,
): Promise<ActieStaat> {
  const sessie = await vereisBestuur();

  return voerUit(async () => {
    const id = leesTekst(formulier, "id");
    if (!id) return { fout: "Onbekend account." };
    const gebruiker = await db.gebruiker.findUnique({ where: { id } });
    if (!gebruiker) return { fout: "Dit account bestaat niet meer." };

    const wachtwoord = maakWachtwoord();
    await db.gebruiker.update({
      where: { id },
      data: { wachtwoordHash: await hashWachtwoord(wachtwoord), moetWijzigen: true },
    });

    await logAudit({
      gebruiker: sessie.naam,
      entiteit: "Gebruiker",
      entiteitId: id,
      actie: "wachtwoord opnieuw ingesteld",
      samenvatting: `Nieuw wachtwoord uitgegeven voor ${gebruiker.email}`,
    });

    revalidatePath("/beheer/accounts");
    return {
      melding: `Nieuw wachtwoord voor ${gebruiker.email}: ${wachtwoord} — geef het door; het is hierna niet meer op te vragen.`,
    };
  });
}
