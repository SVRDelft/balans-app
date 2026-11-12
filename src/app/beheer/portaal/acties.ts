"use server";

import { revalidatePath } from "next/cache";

import { logAudit } from "@/lib/audit";
import { vereisBestuur } from "@/lib/auth/server";
import { db } from "@/lib/db";
import { datumUitInvoer } from "@/lib/datum";
import { bewaarBestand, MAX_BYTES, verwijderBestand } from "@/lib/portaal/opslag";
import {
  BESTAND_SOORT_LABEL,
  isBestandSoort,
  isReeks,
  isStatus,
  vergaderNaam,
  type BestandSoort,
} from "@/lib/portaal/vergaderingen";
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
    const locatie = (leesTekst(formulier, "locatie") ?? "").slice(0, 150);
    const status = leesTekst(formulier, "status") ?? "gepland";
    const volgnummerTekst = leesTekst(formulier, "volgnummer");
    const volgnummer = volgnummerTekst ? Number(volgnummerTekst) : null;

    if (!isReeks(reeks)) return { fout: "Kies een van de vier overleggen." };
    if (!isStatus(status)) return { fout: "Kies gepland, verplaatst of afgelast." };
    if (volgnummer !== null && (!Number.isInteger(volgnummer) || volgnummer < 1 || volgnummer > 99)) {
      return { fout: "Het volgnummer is een heel getal, bijvoorbeeld 4." };
    }
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
      locatie,
      status,
      volgnummer,
    };

    // Bij bewerken blijft het id hetzelfde, en daarmee blijven de agenda en
    // notulen gewoon aan deze vergadering hangen.
    if (id) {
      const bestaand = await db.vergadering.findUnique({ where: { id }, select: { id: true } });
      if (!bestaand) return { fout: "Deze vergadering bestaat niet meer." };
      await db.vergadering.update({ where: { id }, data: gegevens });
    } else {
      await db.vergadering.create({ data: gegevens });
    }

    await logAudit({
      gebruiker: sessie.naam,
      entiteit: "Vergadering",
      entiteitId: id ?? undefined,
      actie: id ? "gewijzigd" : "aangemaakt",
      samenvatting: `${vergaderNaam({ reeks, volgnummer })} van ${datum.toISOString().slice(0, 10)} ${id ? "gewijzigd" : "toegevoegd"}${status !== "gepland" ? ` (${status})` : ""}`,
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
    let soort = String(formulier.get("soort") ?? "document");
    if (!isBestandSoort(soort)) {
      return { fout: "Kies agenda, notulen, presentatie, bijlage of document." };
    }
    const vergaderingId = leesTekst(formulier, "vergaderingId") ?? null;
    if (soort !== "document" && !vergaderingId) {
      return { fout: "Dit stuk hoort bij een vergadering. Kies er een." };
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

    // Een tweede agenda of tweede notulen gaat nooit stilletjes erbij: eerst
    // kiezen tussen vervangen en toevoegen als extra stuk met een eigen titel.
    let teVervangen: { id: string; opslagnaam: string }[] = [];
    if ((soort === "agenda" || soort === "notulen") && vergaderingId) {
      const bestaand = await db.portaalbestand.findMany({
        where: { vergaderingId, soort },
        select: { id: true, opslagnaam: true },
      });
      if (bestaand.length > 0) {
        const keuze = leesTekst(formulier, "bestaand");
        if (keuze === "vervangen") {
          teVervangen = bestaand;
        } else if (keuze === "toevoegen") {
          if (!leesTekst(formulier, "titel")) {
            return { fout: "Geef het extra stuk een eigen titel, bijvoorbeeld “Presentatie”." };
          }
          soort = "bijlage";
        } else {
          return {
            fout: `Bij deze vergadering staan al ${soort === "agenda" ? "een agenda" : "notulen"}. Kies vervangen of toevoegen als extra stuk.`,
          };
        }
      }
    }

    const data = new Uint8Array(await bestand.arrayBuffer());
    const opgeslagen = await bewaarBestand(data);

    const titel =
      leesTekst(formulier, "titel") ??
      (soort === "document" ? bestand.name : BESTAND_SOORT_LABEL[soort as BestandSoort]);

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

    for (const oud of teVervangen) {
      await db.portaalbestand.delete({ where: { id: oud.id } });
      await verwijderBestand(oud.opslagnaam);
    }

    await logAudit({
      gebruiker: sessie.naam,
      entiteit: "Portaalbestand",
      entiteitId: rij.id,
      actie: teVervangen.length ? "vervangen" : "geüpload",
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


/**
 * Een deellink intrekken: de oude link werkt meteen niet meer. Wie daarna weer
 * op "Deel" klikt, krijgt een nieuwe.
 */
export async function trekDeellinkIn(
  _vorigeStaat: ActieStaat,
  formulier: FormData,
): Promise<ActieStaat> {
  const sessie = await vereisBestuur();

  return voerUit(async () => {
    const id = leesTekst(formulier, "id");
    if (!id) return { fout: "Onbekend bestand." };
    const bestand = await db.portaalbestand.findUnique({ where: { id } });
    if (!bestand) return { fout: "Dit bestand bestaat niet meer." };
    if (!bestand.deelsleutel) return { melding: "Dit stuk was niet gedeeld." };

    await db.portaalbestand.update({
      where: { id },
      data: { deelsleutel: null, gedeeldOp: null },
    });
    await logAudit({
      gebruiker: sessie.naam,
      entiteit: "Portaalbestand",
      entiteitId: id,
      actie: "deellink ingetrokken",
      samenvatting: `Deellink van "${bestand.titel}" ingetrokken`,
    });

    vernieuw();
    return { melding: "De link werkt niet meer." };
  });
}
