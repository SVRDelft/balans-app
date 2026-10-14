import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Deze tests draaien de echte server actions (inloggen, wachtwoord wijzigen,
// wachtwoord instellen door het bestuur) tegen een database in het geheugen.
// Alleen Next.js zelf en de database zijn nagebootst.

interface Toegang {
  id: string;
  sleutel: string;
  groep: string;
  naam: string;
  volgorde: number;
  wachtwoordHash: string | null;
  wachtwoordGewijzigdOp: Date | null;
  laatsteInlog: Date | null;
  actief: boolean;
}
interface Gebruiker {
  id: string;
  email: string;
  naam: string;
  rol: string;
  relatieId: string | null;
  actief: boolean;
  moetWijzigen: boolean;
  wachtwoordHash: string;
  laatsteInlog: Date | null;
}
interface Poging {
  sleutel: string;
  aantal: number;
  eerstePoging: Date;
  geblokkeerdTot: Date | null;
}

const mocks = vi.hoisted(() => ({
  koekjes: new Map<string, string>(),
  toegangen: [] as Toegang[],
  gebruikers: [] as Gebruiker[],
  pogingen: [] as Poging[],
  audit: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (naam: string) =>
      mocks.koekjes.has(naam) ? { value: mocks.koekjes.get(naam) } : undefined,
    set: (naam: string, waarde: string) => mocks.koekjes.set(naam, waarde),
    delete: (naam: string) => mocks.koekjes.delete(naam),
  }),
  headers: async () => new Headers({ "x-forwarded-proto": "https" }),
}));
vi.mock("next/navigation", () => ({
  redirect: (pad: string) => {
    throw new Error(`REDIRECT:${pad}`);
  },
  unstable_rethrow: (fout: unknown) => {
    if (fout instanceof Error && fout.message.startsWith("REDIRECT:")) throw fout;
  },
}));
vi.mock("@/lib/beveiliging", () => ({
  mageInloggen: () => true,
  cookieAlleenOverHttps: () => true,
}));
vi.mock("@/lib/audit", () => ({ logAudit: mocks.audit }));
vi.mock("@/lib/content", () => ({
  leesVerenigingen: () => [
    { slug: "leeghwater", naam: "W.S.V. 'Leeghwater'" },
    { slug: "curius", naam: "W.i.s.V. Christiaan Huygens" },
  ],
}));
vi.mock("@/lib/db", () => {
  const { toegangen, gebruikers, pogingen } = mocks;
  let teller = 0;
  const zoekToegang = (where: { id?: string; sleutel?: string }) =>
    toegangen.find((t) => (where.id ? t.id === where.id : t.sleutel === where.sleutel));
  return {
    db: {
      portaaltoegang: {
        findUnique: async ({ where }: { where: { id?: string; sleutel?: string } }) =>
          zoekToegang(where) ?? null,
        findMany: async ({ where }: { where?: { groep?: string } } = {}) =>
          toegangen
            .filter((t) => !where?.groep || t.groep === where.groep)
            .sort((a, b) => a.volgorde - b.volgorde),
        findFirst: async ({ where }: { where: { groep: string } }) =>
          toegangen
            .filter((t) => t.groep === where.groep)
            .sort((a, b) => b.volgorde - a.volgorde)[0] ?? null,
        create: async ({ data }: { data: Partial<Toegang> }) => {
          const rij = {
            id: `t${++teller}`,
            volgorde: 0,
            wachtwoordHash: null,
            wachtwoordGewijzigdOp: null,
            laatsteInlog: null,
            actief: true,
            ...data,
          } as Toegang;
          toegangen.push(rij);
          return rij;
        },
        update: async ({ where, data }: { where: { id: string }; data: Partial<Toegang> }) =>
          Object.assign(zoekToegang(where)!, data),
        upsert: async ({
          where,
          create,
          update,
        }: {
          where: { sleutel: string };
          create: Partial<Toegang>;
          update: Partial<Toegang>;
        }) => {
          const bestaand = zoekToegang(where);
          if (bestaand) return Object.assign(bestaand, update);
          const rij = {
            id: `t${++teller}`,
            volgorde: 0,
            wachtwoordHash: null,
            wachtwoordGewijzigdOp: null,
            laatsteInlog: null,
            actief: true,
            ...create,
          } as Toegang;
          toegangen.push(rij);
          return rij;
        },
        delete: async ({ where }: { where: { id: string } }) => {
          const plek = toegangen.findIndex((t) => t.id === where.id);
          return toegangen.splice(plek, 1)[0];
        },
      },
      gebruiker: {
        findUnique: async ({ where }: { where: { id?: string; email?: string } }) =>
          gebruikers.find((g) => (where.id ? g.id === where.id : g.email === where.email)) ??
          null,
        update: async ({ where, data }: { where: { id: string }; data: Partial<Gebruiker> }) =>
          Object.assign(gebruikers.find((g) => g.id === where.id)!, data),
      },
      inlogpoging: {
        count: async ({ where }: { where: { sleutel: { in: string[] }; geblokkeerdTot: { gt: Date } } }) =>
          pogingen.filter(
            (p) =>
              where.sleutel.in.includes(p.sleutel) &&
              p.geblokkeerdTot !== null &&
              p.geblokkeerdTot > where.geblokkeerdTot.gt,
          ).length,
        findUnique: async ({ where }: { where: { sleutel: string } }) =>
          pogingen.find((p) => p.sleutel === where.sleutel) ?? null,
        upsert: async ({
          where,
          create,
          update,
        }: {
          where: { sleutel: string };
          create: Omit<Poging, "geblokkeerdTot">;
          update: Partial<Poging>;
        }) => {
          const bestaand = pogingen.find((p) => p.sleutel === where.sleutel);
          if (bestaand) return Object.assign(bestaand, update);
          const rij = { geblokkeerdTot: null, ...create };
          pogingen.push(rij);
          return rij;
        },
        update: async ({ where, data }: { where: { sleutel: string }; data: Partial<Poging> }) =>
          Object.assign(pogingen.find((p) => p.sleutel === where.sleutel)!, data),
        deleteMany: async ({ where }: { where: { sleutel: { in: string[] } } }) => {
          for (let i = pogingen.length - 1; i >= 0; i--) {
            if (where.sleutel.in.includes(pogingen[i].sleutel)) pogingen.splice(i, 1);
          }
        },
      },
    },
  };
});

import { inloggen, inloggenAlsVereniging } from "@/app/inloggen/acties";
import { wijzigWachtwoord } from "@/app/wachtwoord/acties";
import { stelToegangWachtwoordIn } from "@/app/beheer/portaaltoegang/acties";
import { beperkingOpRelatie, haalSessie, vereisBestuur, vereisPortaal } from "./server";
import { SESSIE_COOKIE, leesSessieCookie } from "./sessie";
import { hashWachtwoord } from "./wachtwoord";

function formulier(velden: Record<string, string>): FormData {
  const gegevens = new FormData();
  for (const [naam, waarde] of Object.entries(velden)) gegevens.set(naam, waarde);
  return gegevens;
}

/** Een server action die met redirect() eindigt: geeft het doel terug. */
async function omleidingVan(actie: Promise<unknown>): Promise<string> {
  try {
    const uitkomst = await actie;
    throw new Error(`geen redirect maar ${JSON.stringify(uitkomst)}`);
  } catch (fout) {
    const bericht = (fout as Error).message;
    if (!bericht.startsWith("REDIRECT:")) throw fout;
    return bericht.slice("REDIRECT:".length);
  }
}

const alsVereniging = (wie: string, wachtwoord: string) =>
  inloggenAlsVereniging({}, formulier({ wie, wachtwoord, verder: "" }));

let nu = new Date("2026-10-15T12:00:00Z").getTime();
/** De klok een stukje vooruit, zodat "voor" en "na" een wijziging te onderscheiden zijn. */
function wacht(ms = 1000) {
  nu += ms;
  vi.setSystemTime(nu);
}

async function zetBestuurIn() {
  mocks.gebruikers.push({
    id: "g-bestuur",
    email: "penningmeester@svr.nl",
    naam: "Penningmeester",
    rol: "BESTUUR",
    relatieId: null,
    actief: true,
    moetWijzigen: false,
    wachtwoordHash: await hashWachtwoord("een-lang-bestuurswachtwoord"),
    laatsteInlog: null,
  });
  await omleidingVan(
    inloggen({}, formulier({ email: "penningmeester@svr.nl", wachtwoord: "een-lang-bestuurswachtwoord", verder: "" })),
  );
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(nu);
  vi.stubEnv("AUTH_SECRET", "test-geheim-dat-lang-genoeg-is-1234567890");
  mocks.koekjes.clear();
  mocks.toegangen.length = 0;
  mocks.gebruikers.length = 0;
  mocks.pogingen.length = 0;
  mocks.audit.mockClear();
  mocks.toegangen.push({
    id: "informant-oras",
    sleutel: "oras",
    groep: "informant",
    naam: "ORAS",
    volgorde: 1,
    wachtwoordHash: null,
    wachtwoordGewijzigdOp: null,
    laatsteInlog: null,
    actief: true,
  });
});

afterEach(() => {
  vi.useRealTimers();
});

describe("een bestaand account logt in zoals altijd", () => {
  it("een persoonlijk verenigingsaccount komt in het portaal, met de eigen relatie", async () => {
    mocks.gebruikers.push({
      id: "g-curius",
      email: "penningmeester@curius.nl",
      naam: "Penningmeester Curius",
      rol: "SV",
      relatieId: "r-curius",
      actief: true,
      moetWijzigen: false,
      wachtwoordHash: await hashWachtwoord("oud-maar-goed"),
      laatsteInlog: null,
    });

    const doel = await omleidingVan(
      inloggen({}, formulier({ email: "Penningmeester@Curius.nl", wachtwoord: "oud-maar-goed", verder: "" })),
    );
    expect(doel).toBe("/portaal");

    const sessie = await haalSessie();
    expect(sessie).toMatchObject({ rol: "SV", relatieId: "r-curius", gebruikerId: "g-curius" });
    expect(beperkingOpRelatie(sessie!)).toBe("r-curius");
  });

  it("het bestuur komt nog steeds in /beheer", async () => {
    await zetBestuurIn();
    expect((await vereisBestuur()).gebruikerId).toBe("g-bestuur");
  });

  it("een fout wachtwoord geeft dezelfde melding als voorheen", async () => {
    const uitkomst = await inloggen(
      {},
      formulier({ email: "niemand@curius.nl", wachtwoord: "x", verder: "" }),
    );
    expect(uitkomst.fout).toBe("Dit e-mailadres en wachtwoord horen niet bij elkaar.");
  });
});

describe("inloggen als vereniging", () => {
  it("werkt voor een studievereniging en voor een informant", async () => {
    await zetBestuurIn();
    for (const [sleutel, naam] of [
      ["leeghwater", "W.S.V. 'Leeghwater'"],
      ["oras", "ORAS"],
    ]) {
      expect(
        await stelToegangWachtwoordIn({}, formulier({ sleutel, wachtwoord: "boot" })),
      ).toMatchObject({ melding: expect.stringContaining(naam) });
    }

    mocks.koekjes.clear();
    expect(await omleidingVan(alsVereniging("leeghwater", "boot"))).toBe("/portaal");
    expect(await vereisPortaal()).toMatchObject({ soort: "groep", naam: "W.S.V. 'Leeghwater'" });

    mocks.koekjes.clear();
    expect(await omleidingVan(alsVereniging("oras", "boot"))).toBe("/portaal");
    expect(await haalSessie()).toMatchObject({ soort: "groep", naam: "ORAS" });
    expect(mocks.toegangen.find((t) => t.sleutel === "oras")?.laatsteInlog).not.toBeNull();
  });

  it("blijft een jaar ingelogd", async () => {
    await zetBestuurIn();
    await stelToegangWachtwoordIn({}, formulier({ sleutel: "curius", wachtwoord: "pi314" }));
    mocks.koekjes.clear();
    await omleidingVan(alsVereniging("curius", "pi314"));

    const sessie = await leesSessieCookie(mocks.koekjes.get(SESSIE_COOKIE));
    expect(sessie!.verlooptOp - Date.now()).toBe(365 * 24 * 60 * 60 * 1000);
  });

  it("weigert een keuze die niet in de lijst staat, of zonder wachtwoord", async () => {
    expect((await alsVereniging("verzonnen", "boot")).fout).toBe("Kies wie je bent uit de lijst.");
    expect((await alsVereniging("curius", "boot")).fout).toContain("nog geen wachtwoord");
  });

  it("na tien keer mis een minuut wachten, daarna weer", async () => {
    await zetBestuurIn();
    await stelToegangWachtwoordIn({}, formulier({ sleutel: "curius", wachtwoord: "pi314" }));
    mocks.koekjes.clear();

    for (let i = 0; i < 10; i++) {
      expect((await alsVereniging("curius", "fout")).fout).toBe("Dat wachtwoord klopt niet.");
    }
    // Ook het goede wachtwoord wacht nu even.
    expect((await alsVereniging("curius", "pi314")).fout).toContain("Wacht een minuut");
    // Een andere vereniging heeft er geen last van.
    expect((await alsVereniging("oras", "x")).fout).toContain("nog geen wachtwoord");

    wacht(61 * 1000);
    expect(await omleidingVan(alsVereniging("curius", "pi314"))).toBe("/portaal");
  });
});

describe("een portaalsessie komt nooit in de administratie", () => {
  async function logInAlsLeeghwater() {
    await zetBestuurIn();
    await stelToegangWachtwoordIn({}, formulier({ sleutel: "leeghwater", wachtwoord: "boot" }));
    mocks.koekjes.clear();
    await omleidingVan(alsVereniging("leeghwater", "boot"));
  }

  it("vereisBestuur stuurt naar het portaal", async () => {
    await logInAlsLeeghwater();
    await expect(vereisBestuur()).rejects.toThrow("REDIRECT:/portaal");
  });

  it("een beheeractie weigert ook", async () => {
    await logInAlsLeeghwater();
    await expect(
      stelToegangWachtwoordIn({}, formulier({ sleutel: "oras", wachtwoord: "inbraak" })),
    ).rejects.toThrow("REDIRECT:/portaal");
    expect(mocks.toegangen.find((t) => t.sleutel === "oras")?.wachtwoordHash).toBeNull();
  });

  it("vraagt nooit gegevens van een relatie op", async () => {
    await logInAlsLeeghwater();
    const sessie = await haalSessie();
    expect(() => beperkingOpRelatie(sessie!)).toThrow();
  });

  it("een vervalst cookie met rol BESTUUR en soort groep telt niet", async () => {
    await logInAlsLeeghwater();
    const echt = mocks.koekjes.get(SESSIE_COOKIE)!;
    const [inhoud, handtekening] = echt.split(".");
    const gegevens = JSON.parse(Buffer.from(inhoud, "base64url").toString());
    const vervalst = Buffer.from(JSON.stringify({ ...gegevens, rol: "BESTUUR" })).toString("base64url");
    mocks.koekjes.set(SESSIE_COOKIE, `${vervalst}.${handtekening}`);
    expect(await haalSessie()).toBeNull();
    await expect(vereisBestuur()).rejects.toThrow("REDIRECT:/inloggen");
  });

  it("uitzetten werkt meteen, ook voor wie al ingelogd is", async () => {
    await logInAlsLeeghwater();
    mocks.toegangen.find((t) => t.sleutel === "leeghwater")!.actief = false;
    expect(await haalSessie()).toBeNull();
  });
});

describe("wachtwoorden van een vereniging", () => {
  async function ingelogdMet(wachtwoord: string) {
    await zetBestuurIn();
    await stelToegangWachtwoordIn({}, formulier({ sleutel: "curius", wachtwoord }));
    mocks.koekjes.clear();
    wacht();
    await omleidingVan(alsVereniging("curius", wachtwoord));
  }

  it("de vereniging wijzigt het zelf: 4 tekens mag, 3 niet", async () => {
    await ingelogdMet("pi314");

    const teKort = await wijzigWachtwoord(
      {},
      formulier({ huidig: "pi314", nieuw: "abc", herhaling: "abc" }),
    );
    expect(teKort.fout).toBe("Kies een wachtwoord van minstens 4 tekens.");

    wacht();
    expect(
      await omleidingVan(
        wijzigWachtwoord({}, formulier({ huidig: "pi314", nieuw: "abcd", herhaling: "abcd" })),
      ),
    ).toBe("/portaal");
    // Dit apparaat blijft ingelogd.
    expect(await haalSessie()).toMatchObject({ soort: "groep" });

    mocks.koekjes.clear();
    expect((await alsVereniging("curius", "pi314")).fout).toBe("Dat wachtwoord klopt niet.");
    expect(await omleidingVan(alsVereniging("curius", "abcd"))).toBe("/portaal");
  });

  it("het bestuur stelt een nieuw in: dat werkt, het oude niet meer", async () => {
    await ingelogdMet("pi314");
    const oudApparaat = mocks.koekjes.get(SESSIE_COOKIE)!;

    // Het bestuur logt in en zet een nieuw wachtwoord.
    mocks.koekjes.clear();
    wacht();
    await omleidingVan(
      inloggen({}, formulier({ email: "penningmeester@svr.nl", wachtwoord: "een-lang-bestuurswachtwoord", verder: "" })),
    );
    const melding = await stelToegangWachtwoordIn({}, formulier({ sleutel: "curius", wachtwoord: "nieuw" }));
    expect(melding.melding).toContain("ingesteld");
    // Het wachtwoord zelf staat nergens in het auditlog.
    expect(JSON.stringify(mocks.audit.mock.calls)).not.toContain("nieuw\"");

    mocks.koekjes.clear();
    wacht();
    expect((await alsVereniging("curius", "pi314")).fout).toBe("Dat wachtwoord klopt niet.");
    expect(await omleidingVan(alsVereniging("curius", "nieuw"))).toBe("/portaal");

    // Wie nog met het oude wachtwoord ingelogd was, moet opnieuw.
    mocks.koekjes.set(SESSIE_COOKIE, oudApparaat);
    expect(await haalSessie()).toBeNull();
  });

  it("het bestuur kan geen wachtwoord van 3 tekens zetten", async () => {
    await zetBestuurIn();
    const uitkomst = await stelToegangWachtwoordIn({}, formulier({ sleutel: "curius", wachtwoord: "abc" }));
    expect(uitkomst.fout).toBe("Kies een wachtwoord van minstens 4 tekens.");
  });

  it("een persoonlijk verenigingsaccount mag ook 4 tekens kiezen, het bestuur niet", async () => {
    mocks.gebruikers.push({
      id: "g-curius",
      email: "penningmeester@curius.nl",
      naam: "Penningmeester Curius",
      rol: "SV",
      relatieId: "r-curius",
      actief: true,
      moetWijzigen: false,
      wachtwoordHash: await hashWachtwoord("oud-maar-goed"),
      laatsteInlog: null,
    });
    await omleidingVan(
      inloggen({}, formulier({ email: "penningmeester@curius.nl", wachtwoord: "oud-maar-goed", verder: "" })),
    );
    expect(
      await omleidingVan(
        wijzigWachtwoord({}, formulier({ huidig: "oud-maar-goed", nieuw: "kort", herhaling: "kort" })),
      ),
    ).toBe("/portaal");

    mocks.koekjes.clear();
    await zetBestuurIn();
    const bestuur = await wijzigWachtwoord(
      {},
      formulier({ huidig: "een-lang-bestuurswachtwoord", nieuw: "kort", herhaling: "kort" }),
    );
    expect(bestuur.fout).toBeTruthy();
  });
});
