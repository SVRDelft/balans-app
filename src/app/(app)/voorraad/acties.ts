"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { vereisSessie } from "@/lib/auth/server";
import { vereisSchrijfbaarBoekjaar } from "@/lib/boekjaar";
import { logAudit } from "@/lib/audit";
import { type ActieStaat, voerUit, leesTekst } from "@/lib/acties";
import { formatteerEuro, parseerBedragNaarCenten } from "@/lib/geld";
import { berekenVerbruik, berekenVoorraad } from "@/lib/finance/voorraad";

const geheel = z
  .string()
  .regex(/^\d+$/, "Vul een geheel aantal van nul of meer in.")
  .transform(Number)
  .pipe(z.number().int().min(0).max(1_000_000));
const bedrag = z
  .string()
  .transform(parseerBedragNaarCenten)
  .pipe(
    z
      .number({ error: "Vul een geldig bedrag in." })
      .int()
      .min(0)
      .max(2_147_483_647),
  );
const schema = z.object({
  naam: z.string().trim().min(1, "Vul een naam in.").max(120),
  eenheid: z.string().trim().min(1).max(30),
  beginAantal: geheel,
  beginWaardePerStukCenten: bedrag,
  aantal: geheel,
  waardePerStukCenten: bedrag,
  locatie: z.string().trim().max(200),
  notities: z.string().trim().max(2000),
  begrotingspostId: z.string().trim().max(60),
});

const verbruikSchema = z.object({
  aantal: z
    .string()
    .regex(/^\d+$/, "Vul een geheel aantal in.")
    .transform(Number)
    .pipe(z.number().int().min(1, "Vul een aantal van minstens 1 in.")),
  reden: z
    .string()
    .trim()
    .min(1, "Vul in waar de spullen heen zijn gegaan.")
    .max(200),
});

/**
 * Boekt verbruik af: de waarde verdwijnt uit de voorraad op de balans en telt
 * als kosten mee op de begrotingspost waaraan de spullen hangen.
 */
export async function boekVerbruik(
  _staat: ActieStaat,
  formulier: FormData,
): Promise<ActieStaat> {
  const sessie = await vereisSessie();
  return voerUit(async () => {
    const boekjaar = await vereisSchrijfbaarBoekjaar();
    const id = leesTekst(formulier, "id");
    if (!id) return { fout: "Onbekende voorraadpost." };

    const invoer = verbruikSchema.safeParse({
      aantal: formulier.get("aantal") ?? "",
      reden: formulier.get("reden") ?? "",
    });
    if (!invoer.success) {
      return {
        fout: "Controleer de ingevulde gegevens.",
        veldfouten: Object.fromEntries(
          invoer.error.issues.map((fout) => [
            String(fout.path[0]),
            fout.message,
          ]),
        ),
      };
    }

    let melding = "";
    await db.$transaction(async (tx) => {
      const post = await tx.voorraadpost.findFirst({
        where: { id, boekjaarId: boekjaar.id },
        include: { begrotingspost: { select: { code: true, naam: true } } },
      });
      if (!post) {
        throw new Error("Deze voorraadpost hoort niet bij het actieve boekjaar.");
      }

      const verbruik = berekenVerbruik({
        aantal: post.aantal,
        verbruikt: invoer.data.aantal,
        waardePerStukCenten: post.waardePerStukCenten,
      });

      await tx.voorraadpost.update({
        where: { id },
        data: { aantal: verbruik.nieuwAantal },
      });

      const bestemming = post.begrotingspost
        ? `begrotingspost ${post.begrotingspost.code}`
        : "de verzamelregel Voorraadmutatie";

      await logAudit(
        {
          gebruiker: sessie.naam,
          entiteit: "Voorraadpost",
          entiteitId: post.id,
          actie: "verbruik geboekt",
          samenvatting:
            `${post.naam}: ${invoer.data.aantal} ${post.eenheid} af ` +
            `(${formatteerEuro(verbruik.waardeCenten)}) naar ${bestemming} — ${invoer.data.reden}. ` +
            `Nog ${verbruik.nieuwAantal} over.`,
          details: { ...invoer.data, waardeCenten: verbruik.waardeCenten },
          boekjaarId: boekjaar.id,
        },
        tx,
      );

      melding = post.begrotingspost
        ? `${invoer.data.aantal} ${post.eenheid} afgeboekt. ${formatteerEuro(verbruik.waardeCenten)} is uit de balans gehaald en staat nu als kosten op ${post.begrotingspost.code} — ${post.begrotingspost.naam}.`
        : `${invoer.data.aantal} ${post.eenheid} afgeboekt. ${formatteerEuro(verbruik.waardeCenten)} is uit de balans gehaald, maar staat op de verzamelregel Voorraadmutatie omdat deze spullen nog geen begrotingspost hebben.`;
    });

    revalidatePath("/", "layout");
    return { melding };
  });
}

export async function bewaarVoorraad(
  _staat: ActieStaat,
  formulier: FormData,
): Promise<ActieStaat> {
  const sessie = await vereisSessie();
  return voerUit(async () => {
    const boekjaar = await vereisSchrijfbaarBoekjaar();
    const invoer = schema.safeParse(
      Object.fromEntries(
        Object.keys(schema.shape).map((veld) => [
          veld,
          formulier.get(veld) ?? "",
        ]),
      ),
    );
    if (!invoer.success) {
      return {
        fout: "Controleer de ingevulde gegevens.",
        veldfouten: Object.fromEntries(
          invoer.error.issues.map((fout) => [
            String(fout.path[0]),
            fout.message,
          ]),
        ),
      };
    }
    const { begrotingspostId: gekozenPost, ...voorraadgegevens } = invoer.data;
    berekenVoorraad([voorraadgegevens]);

    // Voorraadverbruik is een kostenpost, dus alleen een uitgavenpost van dit
    // boekjaar kan eraan hangen.
    let begrotingspostId: string | null = null;
    if (gekozenPost) {
      const post = await db.begrotingspost.findFirst({
        where: {
          id: gekozenPost,
          boekjaarId: boekjaar.id,
          soort: "uitgave",
        },
        select: { id: true },
      });
      if (!post) {
        return {
          fout: "Kies een uitgavenpost uit de begroting van dit boekjaar.",
          veldfouten: { begrotingspostId: "Deze begrotingspost kan niet." },
        };
      }
      begrotingspostId = post.id;
    }

    const gegevens = { ...voorraadgegevens, begrotingspostId };
    const id = leesTekst(formulier, "id");
    await db.$transaction(async (tx) => {
      if (
        id &&
        !(await tx.voorraadpost.findFirst({
          where: { id, boekjaarId: boekjaar.id },
        }))
      ) {
        throw new Error(
          "Deze voorraadpost hoort niet bij het actieve boekjaar.",
        );
      }
      const post = id
        ? await tx.voorraadpost.update({ where: { id }, data: gegevens })
        : await tx.voorraadpost.create({
            data: { ...gegevens, boekjaarId: boekjaar.id },
          });
      await logAudit(
        {
          gebruiker: sessie.naam,
          entiteit: "Voorraadpost",
          entiteitId: post.id,
          actie: id ? "gewijzigd" : "aangemaakt",
          samenvatting: `${post.naam}: ${post.aantal} ${post.eenheid}`,
          details: gegevens,
          boekjaarId: boekjaar.id,
        },
        tx,
      );
    });
    revalidatePath("/", "layout");
    redirect("/voorraad");
  });
}

export async function verwijderVoorraad(
  _staat: ActieStaat,
  formulier: FormData,
): Promise<ActieStaat> {
  const sessie = await vereisSessie();
  return voerUit(async () => {
    const boekjaar = await vereisSchrijfbaarBoekjaar();
    const id = leesTekst(formulier, "id");
    if (!id) return { fout: "Onbekende voorraadpost." };
    await db.$transaction(async (tx) => {
      const post = await tx.voorraadpost.findFirst({
        where: { id, boekjaarId: boekjaar.id },
      });
      if (!post)
        throw new Error(
          "Deze voorraadpost hoort niet bij het actieve boekjaar.",
        );
      if (post.beginAantal !== 0 || post.aantal !== 0) {
        throw new Error(
          "Een post met beginvoorraad of aanwezige spullen kan niet worden verwijderd. Zet verbruikte spullen op nul; de beginvoorraad blijft staan.",
        );
      }
      await tx.voorraadpost.delete({ where: { id } });
      await logAudit(
        {
          gebruiker: sessie.naam,
          entiteit: "Voorraadpost",
          entiteitId: id,
          actie: "verwijderd",
          samenvatting: `Lege voorraadpost ${post.naam} verwijderd`,
          boekjaarId: boekjaar.id,
        },
        tx,
      );
    });
    revalidatePath("/", "layout");
    redirect("/voorraad");
  });
}

export async function neemVoorraadOver(): Promise<ActieStaat> {
  const sessie = await vereisSessie();
  return voerUit(async () => {
    const boekjaar = await vereisSchrijfbaarBoekjaar();
    await db.$transaction(async (tx) => {
      if (await tx.voorraadpost.count({ where: { boekjaarId: boekjaar.id } })) {
        throw new Error(
          "Overnemen kan alleen als dit boekjaar nog geen voorraadposten heeft.",
        );
      }
      const vorig = await tx.boekjaar.findFirst({
        where: { eindDatum: { lt: boekjaar.startDatum } },
        orderBy: { eindDatum: "desc" },
        include: { voorraadposten: true },
      });
      if (!vorig?.voorraadposten.length)
        throw new Error("In het vorige boekjaar zijn geen spullen gevonden.");
      await tx.voorraadpost.createMany({
        data: vorig.voorraadposten.map((post) => ({
          boekjaarId: boekjaar.id,
          naam: post.naam,
          eenheid: post.eenheid,
          beginAantal: post.aantal,
          beginWaardePerStukCenten: post.waardePerStukCenten,
          aantal: post.aantal,
          waardePerStukCenten: post.waardePerStukCenten,
          locatie: post.locatie,
          notities: post.notities,
        })),
      });
      await logAudit(
        {
          gebruiker: sessie.naam,
          entiteit: "Voorraadpost",
          actie: "overgenomen",
          samenvatting: `Spullen overgenomen uit ${vorig.naam}`,
          boekjaarId: boekjaar.id,
        },
        tx,
      );
    });
    revalidatePath("/", "layout");
    return {
      melding:
        "De eindvoorraad van vorig jaar is als beginvoorraad overgenomen. Controleer ook het beginsaldo eigen vermogen bij Boekjaren.",
    };
  });
}
