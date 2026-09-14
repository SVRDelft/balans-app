"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { logAudit } from "@/lib/audit";
import { vereisSessie } from "@/lib/auth/server";
import { vereisSchrijfbaarBoekjaar } from "@/lib/boekjaar";
import { db } from "@/lib/db";
import { POST_CATEGORIEEN, POST_SOORTEN } from "@/lib/domein";
import { parseerBedragNaarCenten } from "@/lib/geld";
import { leesTekst, voerUit, type ActieStaat } from "@/lib/acties";

export async function bewaarBegrotingspost(
  _vorigeStaat: ActieStaat,
  formulier: FormData,
): Promise<ActieStaat> {
  const sessie = await vereisSessie();

  return voerUit(async () => {
    const boekjaar = await vereisSchrijfbaarBoekjaar();

    const code = leesTekst(formulier, "code")?.toUpperCase();
    const naam = leesTekst(formulier, "naam");
    const categorie = String(formulier.get("categorie") ?? "");
    const soort = String(formulier.get("soort") ?? "");
    const begrootTekst = String(formulier.get("begroot") ?? "");

    const veldfouten: Record<string, string> = {};
    if (!code) veldfouten.code = "Vul een code in.";
    if (!naam) veldfouten.naam = "Vul een naam in.";
    if (!POST_CATEGORIEEN.includes(categorie as never)) {
      veldfouten.categorie = "Kies vast of omslag.";
    }
    if (!POST_SOORTEN.includes(soort as never)) {
      veldfouten.soort = "Kies inkomst of uitgave.";
    }

    const begrootCenten = parseerBedragNaarCenten(begrootTekst) ?? 0;
    if (begrootCenten < 0) {
      veldfouten.begroot = "Een begroot bedrag is niet negatief.";
    }

    if (Object.keys(veldfouten).length > 0) {
      return { fout: "Controleer de ingevulde gegevens.", veldfouten };
    }

    const id = leesTekst(formulier, "id");
    const gegevens = {
      code: code!,
      naam: naam!,
      categorie,
      soort,
      begrootCenten,
      notities: leesTekst(formulier, "notities") ?? null,
    };

    if (id) {
      const post = await db.begrotingspost.update({
        where: { id },
        data: gegevens,
      });
      await logAudit({
        gebruiker: sessie.naam,
        entiteit: "Begrotingspost",
        entiteitId: post.id,
        actie: "gewijzigd",
        samenvatting: `Begrotingspost ${post.code} gewijzigd`,
        details: gegevens,
        boekjaarId: boekjaar.id,
      });
    } else {
      const hoogste = await db.begrotingspost.findFirst({
        where: { boekjaarId: boekjaar.id },
        orderBy: { volgorde: "desc" },
        select: { volgorde: true },
      });

      const post = await db.begrotingspost.create({
        data: {
          ...gegevens,
          boekjaarId: boekjaar.id,
          volgorde: (hoogste?.volgorde ?? 0) + 10,
        },
      });
      await logAudit({
        gebruiker: sessie.naam,
        entiteit: "Begrotingspost",
        entiteitId: post.id,
        actie: "aangemaakt",
        samenvatting: `Begrotingspost ${post.code} aangemaakt`,
        details: gegevens,
        boekjaarId: boekjaar.id,
      });
    }

    revalidatePath("/begroting");
    redirect("/begroting");
  });
}

export async function verwijderBegrotingspost(
  _vorigeStaat: ActieStaat,
  formulier: FormData,
): Promise<ActieStaat> {
  const sessie = await vereisSessie();

  return voerUit(async () => {
    const boekjaar = await vereisSchrijfbaarBoekjaar();
    const id = leesTekst(formulier, "id");
    if (!id) return { fout: "Onbekende begrotingspost." };

    const post = await db.begrotingspost.findUnique({
      where: { id },
      include: { _count: { select: { factuurregels: true, uitgaven: true } } },
    });
    if (!post) return { fout: "Deze begrotingspost bestaat niet meer." };

    if (post._count.factuurregels + post._count.uitgaven > 0) {
      return {
        fout: `Er hangen nog ${post._count.factuurregels} factuurregels en ${post._count.uitgaven} uitgaven aan deze post. Verplaats die eerst.`,
      };
    }

    await db.begrotingspost.delete({ where: { id } });
    await logAudit({
      gebruiker: sessie.naam,
      entiteit: "Begrotingspost",
      entiteitId: id,
      actie: "verwijderd",
      samenvatting: `Begrotingspost ${post.code} verwijderd`,
      boekjaarId: boekjaar.id,
    });

    revalidatePath("/begroting");
    redirect("/begroting");
  });
}
