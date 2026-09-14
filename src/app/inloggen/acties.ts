"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import {
  SESSIE_COOKIE,
  SESSIE_COOKIE_OPTIES,
  controleerWachtwoord,
  maakSessieCookie,
} from "@/lib/auth/sessie";
import type { ActieStaat } from "@/lib/acties";

export async function inloggen(
  _vorigeStaat: ActieStaat,
  formulier: FormData,
): Promise<ActieStaat> {
  const naam = String(formulier.get("naam") ?? "").trim();
  const wachtwoord = String(formulier.get("wachtwoord") ?? "");
  const verder = String(formulier.get("verder") ?? "");

  if (naam.length < 2) {
    return { fout: "Vul je naam in, zodat wijzigingen herleidbaar blijven." };
  }
  if (naam.length > 60) {
    return { fout: "Die naam is wel erg lang." };
  }

  if (!process.env.APP_WACHTWOORD) {
    return {
      fout: "APP_WACHTWOORD is niet ingesteld. Zet het in .env en start de app opnieuw.",
    };
  }

  if (!controleerWachtwoord(wachtwoord)) {
    return { fout: "Het wachtwoord klopt niet." };
  }

  const koekjes = await cookies();
  koekjes.set(SESSIE_COOKIE, await maakSessieCookie(naam), SESSIE_COOKIE_OPTIES);

  // Alleen paden binnen de app, nooit een adres van buiten.
  const doel = verder.startsWith("/") && !verder.startsWith("//") ? verder : "/";
  redirect(doel);
}

export async function uitloggen(): Promise<void> {
  const koekjes = await cookies();
  koekjes.delete(SESSIE_COOKIE);
  redirect("/inloggen");
}
