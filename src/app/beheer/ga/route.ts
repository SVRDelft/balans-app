import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { BOEKJAAR_COOKIE } from "@/lib/auth/sessie";
import { vereisBestuur } from "@/lib/auth/server";
import { db } from "@/lib/db";

/**
 * Wisselt van boekjaar en stuurt daarna door.
 *
 * Nodig voor het zoekvenster: een factuur uit een eerder jaar bestaat niet op de
 * pagina's van het huidige jaar. In plaats van de gebruiker eerst zelf van
 * boekjaar te laten wisselen, doet deze route dat onderweg.
 */
export async function GET(verzoek: Request) {
  await vereisBestuur();

  const parameters = new URL(verzoek.url).searchParams;
  const naar = parameters.get("naar") ?? "/beheer";
  const boekjaarId = parameters.get("boekjaar") ?? "";

  // Alleen binnen de administratie, en nooit naar een ander domein.
  const bestemming = /^\/beheer(\/[\w\-/[\]]*)?$/.test(naar) ? naar : "/beheer";

  if (boekjaarId) {
    const boekjaar = await db.boekjaar.findUnique({
      where: { id: boekjaarId },
      select: { id: true },
    });
    if (boekjaar) {
      (await cookies()).set(BOEKJAAR_COOKIE, boekjaar.id, {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        maxAge: 31536000,
      });
    }
  }

  redirect(bestemming);
}
