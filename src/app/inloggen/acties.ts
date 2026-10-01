"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";

import {
  SESSIE_COOKIE,
  SESSIE_COOKIE_OPTIES,
  maakSessieCookie,
} from "@/lib/auth/sessie";
import {
  controleerInlog,
  isGeblokkeerd,
  normaliseerEmail,
  telMisluktePoging,
  wisPogingen,
} from "@/lib/auth/gebruikers";
import { logAudit } from "@/lib/audit";
import type { ActieStaat } from "@/lib/acties";
import { mageInloggen } from "@/lib/beveiliging";

/** Het IP van de bezoeker, zoals Passenger of een proxy het doorgeeft. */
function haalIp(kopregels: Headers): string {
  const doorgestuurd = kopregels.get("x-forwarded-for");
  if (doorgestuurd) return doorgestuurd.split(",")[0].trim();
  return kopregels.get("x-real-ip") ?? "onbekend";
}

export async function inloggen(
  _vorigeStaat: ActieStaat,
  formulier: FormData,
): Promise<ActieStaat> {
  const kopregels = await headers();
  if (!mageInloggen(kopregels)) {
    return {
      fout: "Inloggen kan zodra de beveiligde verbinding (https) is ingesteld. De publieke pagina's werken wel.",
    };
  }

  const email = normaliseerEmail(String(formulier.get("email") ?? ""));
  const wachtwoord = String(formulier.get("wachtwoord") ?? "");
  const verder = String(formulier.get("verder") ?? "");

  if (!email || !wachtwoord) {
    return { fout: "Vul je e-mailadres en wachtwoord in." };
  }

  const sleutels = [`email:${email}`, `ip:${haalIp(kopregels)}`];
  if (await isGeblokkeerd(sleutels)) {
    return {
      fout: "Te veel pogingen. Probeer het over een kwartier opnieuw, of vraag het bestuur om een nieuw wachtwoord.",
    };
  }

  const uitkomst = await controleerInlog(email, wachtwoord);
  if (!uitkomst) {
    await telMisluktePoging(sleutels);
    // Bewust dezelfde melding bij een onbekend adres: anders is te achterhalen
    // welke adressen een account hebben.
    return { fout: "Dit e-mailadres en wachtwoord horen niet bij elkaar." };
  }

  await wisPogingen(sleutels);
  const koekjes = await cookies();
  koekjes.set(
    SESSIE_COOKIE,
    await maakSessieCookie(uitkomst.sessie),
    SESSIE_COOKIE_OPTIES,
  );

  await logAudit({
    gebruiker: uitkomst.sessie.naam,
    entiteit: "Gebruiker",
    entiteitId: uitkomst.sessie.gebruikerId,
    actie: "ingelogd",
    samenvatting: `${uitkomst.sessie.naam} (${email}) is ingelogd`,
  });

  const standaard = uitkomst.sessie.rol === "BESTUUR" ? "/beheer" : "/portaal";
  if (uitkomst.moetWijzigen) redirect("/wachtwoord");

  // Alleen paden binnen de app, nooit een adres van buiten.
  const gevraagd =
    verder.startsWith("/") && !verder.startsWith("//") ? verder : standaard;
  // Een SV-account hoort niet in de administratie terecht te komen.
  const doel =
    uitkomst.sessie.rol === "SV" && gevraagd.startsWith("/beheer")
      ? "/portaal"
      : gevraagd;
  redirect(doel);
}

export async function uitloggen(): Promise<void> {
  const koekjes = await cookies();
  koekjes.delete(SESSIE_COOKIE);
  redirect("/inloggen");
}
