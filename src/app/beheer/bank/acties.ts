"use server";

import { revalidatePath } from "next/cache";

import { logAudit } from "@/lib/audit";
import { vereisBestuur } from "@/lib/auth/server";
import { vereisSchrijfbaarBoekjaar } from "@/lib/boekjaar";
import { db } from "@/lib/db";
import { datumUitInvoer, formatteerDatum } from "@/lib/datum";
import { formatteerEuro, parseerBedragNaarCenten } from "@/lib/geld";
import { leesTekst, voerUit, type ActieStaat } from "@/lib/acties";

export async function bewaarBanksaldo(
  _vorigeStaat: ActieStaat,
  formulier: FormData,
): Promise<ActieStaat> {
  const sessie = await vereisBestuur();

  return voerUit(async () => {
    const boekjaar = await vereisSchrijfbaarBoekjaar();

    const datum = datumUitInvoer(String(formulier.get("datum") ?? ""));
    const saldoCenten = parseerBedragNaarCenten(
      String(formulier.get("saldo") ?? ""),
    );

    const veldfouten: Record<string, string> = {};
    if (!datum) veldfouten.datum = "Vul een geldige datum in.";
    if (saldoCenten === null) veldfouten.saldo = "Vul het saldo in.";
    if (Object.keys(veldfouten).length > 0) {
      return { fout: "Controleer de ingevulde gegevens.", veldfouten };
    }

    // 'betaal' of 'spaar'; alles wat daar niet op lijkt is de betaalrekening.
    const rekening = leesTekst(formulier, "rekening") === "spaar" ? "spaar" : "betaal";

    await db.banksaldo.create({
      data: {
        boekjaarId: boekjaar.id,
        rekening,
        datum: datum!,
        saldoCenten: saldoCenten!,
        notitie: leesTekst(formulier, "notitie") ?? null,
        ingevoerdDoor: sessie.naam,
      },
    });

    await logAudit({
      gebruiker: sessie.naam,
      entiteit: "Banksaldo",
      actie: "aangemaakt",
      samenvatting: `${rekening === "spaar" ? "Spaarsaldo" : "Banksaldo"} per ${formatteerDatum(datum!)}: ${formatteerEuro(saldoCenten!)}`,
      boekjaarId: boekjaar.id,
    });

    revalidatePath("/", "layout");
    return {
      melding: rekening === "spaar" ? "Spaarsaldo vastgelegd." : "Banksaldo vastgelegd.",
    };
  });
}

export async function verwijderBanksaldo(
  _vorigeStaat: ActieStaat,
  formulier: FormData,
): Promise<ActieStaat> {
  const sessie = await vereisBestuur();

  return voerUit(async () => {
    const boekjaar = await vereisSchrijfbaarBoekjaar();
    const id = leesTekst(formulier, "id");
    if (!id) return { fout: "Onbekend banksaldo." };

    const saldo = await db.banksaldo.findUnique({ where: { id, boekjaarId: boekjaar.id }, include: { bankimport: true } });
    if (!saldo) return { fout: "Dit banksaldo bestaat niet meer." };
    if (saldo.bankimport) return { fout: "Dit saldo hoort bij een bevestigd bankafschrift. Het blijft bewaard bij de import." };

    await db.banksaldo.delete({ where: { id, boekjaarId: boekjaar.id } });

    await logAudit({
      gebruiker: sessie.naam,
      entiteit: "Banksaldo",
      actie: "verwijderd",
      samenvatting: `${saldo.rekening === "spaar" ? "Spaarsaldo" : "Banksaldo"} per ${formatteerDatum(saldo.datum)} (${formatteerEuro(saldo.saldoCenten)}) verwijderd`,
      boekjaarId: boekjaar.id,
    });

    revalidatePath("/", "layout");
    return {};
  });
}
