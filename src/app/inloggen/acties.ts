"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";

import {
  GROEP_SESSIE_COOKIE_OPTIES,
  SESSIE_COOKIE,
  SESSIE_COOKIE_OPTIES,
  maakGroepSessieCookie,
  maakSessieCookie,
} from "@/lib/auth/sessie";
import {
  controleerInlog,
  isGeblokkeerd,
  normaliseerEmail,
  telMisluktePoging,
  wisPogingen,
} from "@/lib/auth/gebruikers";
import {
  GROEP_BLOKKADE_MS,
  controleerGroepInlog,
  pogingSleutel,
} from "@/lib/auth/portaaltoegang";
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

/**
 * Inloggen als vereniging of informant: kies wie je bent, vul het wachtwoord in
 * dat je bestuur deelt. Je komt alleen in het portaal, en blijft een jaar
 * ingelogd.
 */
export async function inloggenAlsVereniging(
  _vorigeStaat: ActieStaat,
  formulier: FormData,
): Promise<ActieStaat> {
  const kopregels = await headers();
  if (!mageInloggen(kopregels)) {
    return {
      fout: "Inloggen kan zodra de beveiligde verbinding (https) is ingesteld. De publieke pagina's werken wel.",
    };
  }

  const sleutel = String(formulier.get("wie") ?? "").trim();
  const wachtwoord = String(formulier.get("wachtwoord") ?? "");
  const verder = String(formulier.get("verder") ?? "");

  if (!sleutel) return { fout: "Kies wie je bent." };
  if (!wachtwoord) return { fout: "Vul het wachtwoord van je vereniging in." };

  // De rem staat per vereniging, niet per bezoeker: het wachtwoord is gedeeld.
  const sleutels = [pogingSleutel(sleutel)];
  if (await isGeblokkeerd(sleutels)) {
    return {
      fout: "Te veel pogingen voor deze vereniging. Wacht een minuut en probeer het dan opnieuw.",
    };
  }

  const uitkomst = await controleerGroepInlog(sleutel, wachtwoord);
  if (uitkomst.soort === "onbekend") return { fout: "Kies wie je bent uit de lijst." };
  if (uitkomst.soort === "geenWachtwoord") {
    return {
      fout: `Voor ${uitkomst.naam} is nog geen wachtwoord ingesteld. Vraag het SVR-bestuur om er een.`,
    };
  }
  if (uitkomst.soort === "uit") {
    return {
      fout: `De toegang voor ${uitkomst.naam} staat op dit moment uit. Neem contact op met het SVR-bestuur.`,
    };
  }
  if (uitkomst.soort === "fout") {
    await telMisluktePoging(sleutels, GROEP_BLOKKADE_MS);
    return { fout: "Dat wachtwoord klopt niet." };
  }

  await wisPogingen(sleutels);
  const koekjes = await cookies();
  koekjes.set(
    SESSIE_COOKIE,
    await maakGroepSessieCookie({
      toegangId: uitkomst.toegang.id,
      naam: uitkomst.toegang.naam,
    }),
    GROEP_SESSIE_COOKIE_OPTIES,
  );

  await logAudit({
    gebruiker: `${uitkomst.toegang.naam} (portaal)`,
    entiteit: "Portaaltoegang",
    entiteitId: uitkomst.toegang.id,
    actie: "ingelogd",
    samenvatting: `${uitkomst.toegang.naam} is als vereniging ingelogd op het portaal`,
  });

  // Alleen binnen het portaal; /beheer is voor deze sessie toch dicht.
  redirect(verder.startsWith("/portaal") ? verder : "/portaal");
}

export async function uitloggen(): Promise<void> {
  const koekjes = await cookies();
  koekjes.delete(SESSIE_COOKIE);
  redirect("/inloggen");
}
