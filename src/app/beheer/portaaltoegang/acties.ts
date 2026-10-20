"use server";

import { revalidatePath } from "next/cache";

import { leesTekst, voerUit, type ActieStaat } from "@/lib/acties";
import { logAudit } from "@/lib/audit";
import { vereisBestuur } from "@/lib/auth/server";
import {
  haalToegangKeuzes,
  maakSleutel,
  stelRelatieVoor,
  zetGroepActief,
  zetGroepRelatie,
  zetGroepWachtwoord,
  zoekKeuze,
  type ToegangKeuze,
} from "@/lib/auth/portaaltoegang";
import { keurPortaalWachtwoord } from "@/lib/auth/wachtwoord";
import { leesVerenigingen } from "@/lib/content";
import { db } from "@/lib/db";

const haalRelaties = () =>
  db.relatie.findMany({
    where: { actief: true },
    select: { id: true, naam: true },
  });

/** Nog niet gekoppeld en er is een duidelijk voorstel? Dan dat vastleggen. */
async function koppelVoorstel(keuze: ToegangKeuze): Promise<string | undefined> {
  const bestaand = await db.portaaltoegang.findUnique({
    where: { sleutel: keuze.sleutel },
    select: { relatieId: true },
  });
  if (bestaand?.relatieId) return undefined;
  const relaties = await haalRelaties();
  const voorstel = stelRelatieVoor(keuze, relaties);
  if (!voorstel) return undefined;
  await zetGroepRelatie(keuze, voorstel);
  return relaties.find((relatie) => relatie.id === voorstel)?.naam;
}

function vernieuw() {
  revalidatePath("/beheer/portaaltoegang");
  revalidatePath("/inloggen");
}

/**
 * Een beginwachtwoord of een nieuw wachtwoord voor een vereniging die het kwijt
 * is. Het oude werkt daarna niet meer, en wie er nog mee ingelogd was, moet
 * opnieuw inloggen.
 */
export async function stelToegangWachtwoordIn(
  _vorigeStaat: ActieStaat,
  formulier: FormData,
): Promise<ActieStaat> {
  const sessie = await vereisBestuur();

  return voerUit(async () => {
    const sleutel = leesTekst(formulier, "sleutel") ?? "";
    const wachtwoord = String(formulier.get("wachtwoord") ?? "");
    const keuze = await zoekKeuze(sleutel);
    if (!keuze) return { fout: "Deze vereniging staat niet in de lijst." };
    const bezwaar = keurPortaalWachtwoord(wachtwoord);
    if (bezwaar) return { fout: bezwaar };

    const gezet = await zetGroepWachtwoord(keuze, wachtwoord);
    const gekoppeld = await koppelVoorstel(keuze);
    await logAudit({
      gebruiker: sessie.naam,
      entiteit: "Portaaltoegang",
      entiteitId: gezet.id,
      actie: "wachtwoord ingesteld",
      // Het wachtwoord zelf komt nooit in het auditlog.
      samenvatting: `Nieuw gedeeld wachtwoord ingesteld voor ${keuze.naam}${
        gekoppeld ? `; facturen van relatie ${gekoppeld}` : ""
      }`,
    });

    vernieuw();
    return {
      melding: `Wachtwoord voor ${keuze.naam} ingesteld${
        gekoppeld ? ` en gekoppeld aan de facturen van ${gekoppeld}` : ""
      }. Geef het door aan hun bestuur.`,
    };
  });
}

/** Aan of uit. Uit geldt meteen, ook voor wie op dit moment ingelogd is. */
export async function zetToegangAanUit(
  _vorigeStaat: ActieStaat,
  formulier: FormData,
): Promise<ActieStaat> {
  const sessie = await vereisBestuur();

  return voerUit(async () => {
    const keuze = await zoekKeuze(leesTekst(formulier, "sleutel") ?? "");
    if (!keuze) return { fout: "Deze vereniging staat niet in de lijst." };
    const aan = leesTekst(formulier, "aan") === "ja";

    const toegang = await zetGroepActief(keuze, aan);
    await logAudit({
      gebruiker: sessie.naam,
      entiteit: "Portaaltoegang",
      entiteitId: toegang.id,
      actie: aan ? "aangezet" : "uitgezet",
      samenvatting: `Portaaltoegang voor ${keuze.naam} ${aan ? "weer aangezet" : "uitgezet"}`,
    });

    vernieuw();
    return { melding: `${keuze.naam} staat ${aan ? "weer aan" : "uit"}.` };
  });
}

export async function voegInformantToe(
  _vorigeStaat: ActieStaat,
  formulier: FormData,
): Promise<ActieStaat> {
  const sessie = await vereisBestuur();

  return voerUit(async () => {
    const naam = leesTekst(formulier, "naam");
    if (!naam) return { fout: "Vul de naam in zoals die in de lijst moet komen." };
    if (naam.length > 80) return { fout: "Die naam is te lang voor de lijst." };

    const sleutel = maakSleutel(naam);
    if (!sleutel) return { fout: "Gebruik ten minste één letter of cijfer in de naam." };
    // Een informant mag niet dezelfde sleutel krijgen als een studievereniging.
    if (leesVerenigingen().some((vereniging) => vereniging.slug === sleutel)) {
      return { fout: "Die naam lijkt te veel op een studievereniging uit de lijst." };
    }
    if (await db.portaaltoegang.findUnique({ where: { sleutel } })) {
      return { fout: "Deze informant staat al in de lijst." };
    }

    const laatste = await db.portaaltoegang.findFirst({
      where: { groep: "informant" },
      orderBy: { volgorde: "desc" },
      select: { volgorde: true },
    });
    const informant = await db.portaaltoegang.create({
      data: {
        sleutel,
        naam,
        groep: "informant",
        volgorde: (laatste?.volgorde ?? 0) + 1,
      },
    });
    await logAudit({
      gebruiker: sessie.naam,
      entiteit: "Portaaltoegang",
      entiteitId: informant.id,
      actie: "aangemaakt",
      samenvatting: `Informant ${naam} toegevoegd aan de lijst`,
    });

    vernieuw();
    return { melding: `${naam} staat in de lijst. Stel nog een wachtwoord in voordat ze kunnen inloggen.` };
  });
}

/** Weg uit de lijst. Wie als deze informant ingelogd was, is dat meteen niet meer. */
export async function verwijderInformant(
  _vorigeStaat: ActieStaat,
  formulier: FormData,
): Promise<ActieStaat> {
  const sessie = await vereisBestuur();

  return voerUit(async () => {
    const sleutel = leesTekst(formulier, "sleutel") ?? "";
    const informant = await db.portaaltoegang.findUnique({ where: { sleutel } });
    if (!informant || informant.groep !== "informant") {
      return { fout: "Alleen informanten kunnen uit de lijst; studieverenigingen staan in content/verenigingen.json." };
    }

    await db.portaaltoegang.delete({ where: { id: informant.id } });
    await logAudit({
      gebruiker: sessie.naam,
      entiteit: "Portaaltoegang",
      entiteitId: informant.id,
      actie: "verwijderd",
      samenvatting: `Informant ${informant.naam} uit de lijst gehaald`,
    });

    vernieuw();
    return { melding: `${informant.naam} staat niet meer in de lijst.` };
  });
}

/** Van welke relatie ziet deze login de openstaande facturen? Leeg: van geen. */
export async function koppelToegangRelatie(
  _vorigeStaat: ActieStaat,
  formulier: FormData,
): Promise<ActieStaat> {
  const sessie = await vereisBestuur();

  return voerUit(async () => {
    const keuze = await zoekKeuze(leesTekst(formulier, "sleutel") ?? "");
    if (!keuze) return { fout: "Deze vereniging staat niet in de lijst." };
    const relatieId = leesTekst(formulier, "relatieId") || null;
    const relatie = relatieId
      ? await db.relatie.findUnique({ where: { id: relatieId }, select: { naam: true } })
      : null;
    if (relatieId && !relatie) return { fout: "Die relatie bestaat niet meer." };

    const toegang = await zetGroepRelatie(keuze, relatieId);
    await logAudit({
      gebruiker: sessie.naam,
      entiteit: "Portaaltoegang",
      entiteitId: toegang.id,
      actie: "facturen gekoppeld",
      samenvatting: relatie
        ? `${keuze.naam} ziet de openstaande facturen van ${relatie.naam}`
        : `${keuze.naam} ziet geen facturen meer`,
    });

    vernieuw();
    return { melding: relatie ? "Gekoppeld." : "Ontkoppeld." };
  });
}

/** Elke nog niet gekoppelde regel met een duidelijk voorstel in één keer koppelen. */
export async function koppelAlleVoorstellen(): Promise<ActieStaat> {
  const sessie = await vereisBestuur();

  return voerUit(async () => {
    const { studieverenigingen, informanten } = await haalToegangKeuzes();
    const gekoppeld: string[] = [];
    for (const keuze of [...studieverenigingen, ...informanten]) {
      const relatie = await koppelVoorstel(keuze);
      if (relatie) gekoppeld.push(`${keuze.naam} → ${relatie}`);
    }
    if (gekoppeld.length === 0) return { melding: "Er viel niets meer te koppelen." };

    await logAudit({
      gebruiker: sessie.naam,
      entiteit: "Portaaltoegang",
      entiteitId: "alle",
      actie: "facturen gekoppeld",
      samenvatting: `Op naam gekoppeld: ${gekoppeld.join(", ")}`,
    });
    vernieuw();
    return { melding: `${gekoppeld.length} gekoppeld.` };
  });
}
