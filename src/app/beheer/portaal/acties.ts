"use server";

import { revalidatePath } from "next/cache";

import { logAudit } from "@/lib/audit";
import { vereisBestuur } from "@/lib/auth/server";
import { db } from "@/lib/db";
import { datumUitInvoer } from "@/lib/datum";
import { bewaarBestand, MAX_BYTES, verwijderBestand } from "@/lib/portaal/opslag";
import { isReeks } from "@/lib/portaal/vergaderingen";
import { leesTekst, voerUit, type ActieStaat } from "@/lib/acties";

function vernieuw() {
  revalidatePath("/portaal");
  revalidatePath("/beheer/portaal");
}

export async function bewaarMededeling(
  _vorigeStaat: ActieStaat,
  formulier: FormData,
): Promise<ActieStaat> {
  const sessie = await vereisBestuur();

  return voerUit(async () => {
    const id = leesTekst(formulier, "id");
    const titel = leesTekst(formulier, "titel");
    const tekst = leesTekst(formulier, "tekst");
    if (!titel) return { fout: "Vul een titel in." };
    if (!tekst) return { fout: "Vul de mededeling in." };

    if (id) {
      await db.mededeling.update({ where: { id }, data: { titel, tekst } });
    } else {
      await db.mededeling.create({
        data: { titel, tekst, geplaatstDoor: sessie.naam },
      });
    }

    await logAudit({
      gebruiker: sessie.naam,
      entiteit: "Mededeling",
      entiteitId: id ?? undefined,
      actie: id ? "gewijzigd" : "geplaatst",
      samenvatting: `Mededeling "${titel}" ${id ? "gewijzigd" : "geplaatst"}`,
    });

    vernieuw();
    return { melding: id ? "Mededeling bijgewerkt." : "Mededeling geplaatst." };
  });
}

export async function verwijderMededeling(
  _vorigeStaat: ActieStaat,
  formulier: FormData,
): Promise<ActieStaat> {
  const sessie = await vereisBestuur();

  return voerUit(async () => {
    const id = leesTekst(formulier, "id");
    if (!id) return { fout: "Onbekende mededeling." };
    const mededeling = await db.mededeling.findUnique({ where: { id } });
    if (!mededeling) return { fout: "Deze mededeling bestaat niet meer." };

    await db.mededeling.delete({ where: { id } });
    await logAudit({
      gebruiker: sessie.naam,
      entiteit: "Mededeling",
      entiteitId: id,
      actie: "verwijderd",
      samenvatting: `Mededeling "${mededeling.titel}" verwijderd`,
    });

    vernieuw();
    return { melding: "Mededeling verwijderd." };
  });
}

export async function bewaarVergadering(
  _vorigeStaat: ActieStaat,
  formulier: FormData,
): Promise<ActieStaat> {
  const sessie = await vereisBestuur();

  return voerUit(async () => {
    const id = leesTekst(formulier, "id");
    const reeks = String(formulier.get("reeks") ?? "");
    const datum = datumUitInvoer(String(formulier.get("datum") ?? ""));
    const tijd = leesTekst(formulier, "tijd") ?? "14:00";
    const gastheerId = leesTekst(formulier, "gastheerId") ?? null;
    const notitie = leesTekst(formulier, "notitie") ?? null;

    if (!isReeks(reeks)) return { fout: "Kies een van de vier overleggen." };
    if (!datum) return { fout: "Vul een geldige datum in." };
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(tijd)) {
      return { fout: "Vul een tijd in als 14:00." };
    }

    const gastheer = gastheerId
      ? await db.relatie.findUnique({ where: { id: gastheerId }, select: { naam: true } })
      : null;
    if (gastheerId && !gastheer) return { fout: "Die vereniging bestaat niet meer." };

    const gegevens = {
      reeks,
      datum,
      tijd,
      gastheerId,
      gastheerNaam: gastheer?.naam ?? "",
      notitie,
    };

    if (id) {
      await db.vergadering.update({ where: { id }, data: gegevens });
    } else {
      await db.vergadering.create({ data: gegevens });
    }

    await logAudit({
      gebruiker: sessie.naam,
      entiteit: "Vergadering",
      entiteitId: id ?? undefined,
      actie: id ? "gewijzigd" : "aangemaakt",
      samenvatting: `${reeks} van ${datum.toISOString().slice(0, 10)} ${id ? "gewijzigd" : "toegevoegd"}`,
    });

    vernieuw();
    return { melding: id ? "Vergadering bijgewerkt." : "Vergadering toegevoegd." };
  });
}

export async function verwijderVergadering(
  _vorigeStaat: ActieStaat,
  formulier: FormData,
): Promise<ActieStaat> {
  const sessie = await vereisBestuur();

  return voerUit(async () => {
    const id = leesTekst(formulier, "id");
    if (!id) return { fout: "Onbekende vergadering." };
    const vergadering = await db.vergadering.findUnique({
      where: { id },
      include: { bestanden: true },
    });
    if (!vergadering) return { fout: "Deze vergadering bestaat niet meer." };

    for (const bestand of vergadering.bestanden) {
      await verwijderBestand(bestand.opslagnaam);
    }
    await db.vergadering.delete({ where: { id } });

    await logAudit({
      gebruiker: sessie.naam,
      entiteit: "Vergadering",
      entiteitId: id,
      actie: "verwijderd",
      samenvatting: `${vergadering.reeks} van ${vergadering.datum.toISOString().slice(0, 10)} verwijderd, inclusief ${vergadering.bestanden.length} bestanden`,
    });

    vernieuw();
    return { melding: "Vergadering verwijderd." };
  });
}

/** Agenda, notulen of een los document uploaden. */
export async function uploadBestand(
  _vorigeStaat: ActieStaat,
  formulier: FormData,
): Promise<ActieStaat> {
  const sessie = await vereisBestuur();

  return voerUit(async () => {
    const soort = String(formulier.get("soort") ?? "document");
    if (!["agenda", "notulen", "document"].includes(soort)) {
      return { fout: "Kies agenda, notulen of document." };
    }
    const vergaderingId = leesTekst(formulier, "vergaderingId") ?? null;
    if ((soort === "agenda" || soort === "notulen") && !vergaderingId) {
      return { fout: "Een agenda of notulen horen bij een vergadering." };
    }

    const bestand = formulier.get("bestand");
    if (!(bestand instanceof File) || bestand.size === 0) {
      return { fout: "Kies een bestand." };
    }
    if (bestand.size > MAX_BYTES) {
      return { fout: "Het bestand mag maximaal 20 MB zijn." };
    }

    if (vergaderingId) {
      const vergadering = await db.vergadering.findUnique({ where: { id: vergaderingId } });
      if (!vergadering) return { fout: "Die vergadering bestaat niet meer." };
    }

    const data = new Uint8Array(await bestand.arrayBuffer());
    const opgeslagen = await bewaarBestand(data);

    const titel =
      leesTekst(formulier, "titel") ??
      (soort === "agenda" ? "Agenda" : soort === "notulen" ? "Notulen" : bestand.name);

    const rij = await db.portaalbestand.create({
      data: {
        soort,
        titel: titel.slice(0, 150),
        vergaderingId,
        bestandsnaam: bestand.name.slice(0, 200),
        mimeType: opgeslagen.mimeType,
        grootte: opgeslagen.grootte,
        opslagnaam: opgeslagen.opslagnaam,
        geuploadDoor: sessie.naam,
      },
    });

    await logAudit({
      gebruiker: sessie.naam,
      entiteit: "Portaalbestand",
      entiteitId: rij.id,
      actie: "geüpload",
      samenvatting: `${soort} "${titel}" geüpload (${Math.round(opgeslagen.grootte / 1024)} kB)`,
    });

    vernieuw();
    return { melding: `"${titel}" staat in het portaal.` };
  });
}

export async function verwijderPortaalbestand(
  _vorigeStaat: ActieStaat,
  formulier: FormData,
): Promise<ActieStaat> {
  const sessie = await vereisBestuur();

  return voerUit(async () => {
    const id = leesTekst(formulier, "id");
    if (!id) return { fout: "Onbekend bestand." };
    const bestand = await db.portaalbestand.findUnique({ where: { id } });
    if (!bestand) return { fout: "Dit bestand bestaat niet meer." };

    await db.portaalbestand.delete({ where: { id } });
    await verwijderBestand(bestand.opslagnaam);

    await logAudit({
      gebruiker: sessie.naam,
      entiteit: "Portaalbestand",
      entiteitId: id,
      actie: "verwijderd",
      samenvatting: `${bestand.soort} "${bestand.titel}" verwijderd`,
    });

    vernieuw();
    return { melding: `"${bestand.titel}" is verwijderd.` };
  });
}

