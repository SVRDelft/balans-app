// Vult lege contactvelden van bekende relaties aan met openbare gegevens
// (websites van de verenigingen en de TU Delft-verenigingenpagina's, september
// 2026). Een veld dat al is ingevuld wordt nooit overschreven.
//
//   npx tsx scripts/relaties-aanvullen.mts          laat zien wat er zou veranderen
//   npx tsx scripts/relaties-aanvullen.mts --schrijf  schrijft het weg
import "../src/lib/env";
import { db } from "../src/lib/db";

type Velden = Partial<{
  email: string;
  adres: string;
  postcode: string;
  plaats: string;
  telefoon: string;
  website: string;
  kvkNummer: string;
  btwNummer: string;
  iban: string;
  notities: string;
}>;

const GEGEVENS: Record<string, Velden> = {
  "Bèta": { email: "info@lijstbeta.nl", adres: "Van der Burghweg 2 (gebouw 26B, kamer 1.150)", postcode: "2628 CS", plaats: "Delft", telefoon: "015 278 7289", website: "https://lijstbeta.nl" },
  CH: { email: "board@ch.tudelft.nl", adres: "Mekelweg 4", postcode: "2628 CD", plaats: "Delft", telefoon: "015 278 2532", website: "https://ch.tudelft.nl", kvkNummer: "40397077", iban: "NL54INGB0000455530" },
  Curius: { email: "info@curius.nl", adres: "Jaffalaan 5 (gebouw 31)", postcode: "2628 BX", plaats: "Delft", telefoon: "015 278 3406", website: "https://curius.nl", kvkNummer: "40398488" },
  ETV: { email: "bestuur-etv@tudelft.nl", adres: "Mekelweg 4", postcode: "2628 CD", plaats: "Delft", telefoon: "015 278 6189", website: "https://etv.tudelft.nl", kvkNummer: "40397067", iban: "NL50ABNA0439649056" },
  Froude: { email: "secretaris@froude.nl", adres: "Mekelweg 2", postcode: "2628 CD", plaats: "Delft", telefoon: "015 278 9772", website: "https://froude.nl", iban: "NL28INGB0000129884" },
  Hooke: { email: "bestuur-hooke@tudelft.nl", adres: "Van der Maasweg 9 (C0.010)", postcode: "2629 HZ", plaats: "Delft", telefoon: "015 278 1639", website: "https://svnbhooke.nl", kvkNummer: "61921068" },
  ID: { email: "svid@tudelft.nl", adres: "Landbergstraat 15", postcode: "2628 CE", plaats: "Delft", telefoon: "015 278 3012", website: "https://www.studieverenigingid.nl", kvkNummer: "40397069", btwNummer: "NL805824352B01", iban: "NL08RABO0319423239" },
  LIFE: { email: "bestuur@svlife.nl", adres: "Van der Maasweg 9 (C0.090)", postcode: "2629 HZ", plaats: "Delft", telefoon: "015 278 2785", website: "https://www.svlife.nl" },
  Leeghwater: { email: "info@leeghwater.nl", adres: "Mekelweg 2", postcode: "2628 CD", plaats: "Delft", telefoon: "015 278 6501", website: "https://www.leeghwater.nl", kvkNummer: "40397140", iban: "NL56ABNA0442310919" },
  MV: { email: "mv@tudelft.nl", adres: "Stevinweg 1 (kamer 01.120)", postcode: "2628 CN", plaats: "Delft", telefoon: "015 278 6039", website: "https://mv.tudelft.nl" },
  PS: { email: "info-ps@tudelft.nl", adres: "Stevinweg 1 (k1.65)", postcode: "2628 CN", plaats: "Delft", telefoon: "015 278 5465", website: "https://practischestudie.nl", kvkNummer: "40397319", iban: "NL78INGB0000088147" },
  Stylos: { email: "info@stylos.nl", adres: "Julianalaan 132-134", postcode: "2628 BL", plaats: "Delft", telefoon: "015 278 3697", website: "https://www.stylos.nl" },
  // TG heeft twee rekeningen; welke ze gebruiken wisselt, dus geen vaste IBAN.
  // De app leert het nummer vanzelf bij de eerste gekoppelde betaling.
  TG: { email: "bestuur-tg@tudelft.nl", adres: "Van der Maasweg 9 (C0.050)", postcode: "2629 HZ", plaats: "Delft", telefoon: "015 278 4315", website: "https://www.technologischgezelschap.nl", kvkNummer: "40397699", notities: "Rekeningen: NL64 ABNA 0619 0181 00 (ABN AMRO) en NL47 INGB 0000 0170 22 (ING)." },
  VSV: { email: "vsv@tudelft.nl", adres: "Kluyverweg 1", postcode: "2629 HS", plaats: "Delft", telefoon: "015 278 5366", website: "https://vsv.tudelft.nl", kvkNummer: "40397684" },
  Variscopic: { email: "info@variscopic.nl", adres: "Mekelweg 2 (gebouw 34)", postcode: "2628 CD", plaats: "Delft", telefoon: "015 278 5947", website: "https://variscopic.nl", kvkNummer: "60706597" },
  VvTP: { email: "vvtp@vvtp.tudelft.nl", adres: "Lorentzweg 1 (kamer A109)", postcode: "2628 CJ", plaats: "Delft", telefoon: "015 278 6122", website: "https://vvtp.nl" },
  ORAS: { email: "info@oras.nl", adres: "Van der Burghweg 2 (gebouw 26B)", postcode: "2628 CE", plaats: "Delft", telefoon: "015 278 1289", website: "https://oras.nl" },
  "YES!Delft": { email: "info@yesdelft.nl", adres: "Molengraaffsingel 12", postcode: "2629 JD", plaats: "Delft", telefoon: "015 278 9589", website: "https://www.yesdelft.com", kvkNummer: "27379977" },
};

const schrijf = process.argv.includes("--schrijf");
const relaties = await db.relatie.findMany({ where: { naam: { in: Object.keys(GEGEVENS) } } });
const ontbrekend = Object.keys(GEGEVENS).filter((naam) => !relaties.some((r) => r.naam === naam));

let aangepast = 0;
for (const relatie of relaties) {
  const nieuw: Velden = {};
  for (const [veld, waarde] of Object.entries(GEGEVENS[relatie.naam]) as [keyof Velden, string][]) {
    const huidig = relatie[veld];
    if (veld === "notities") {
      if (!(huidig ?? "").includes(waarde)) nieuw.notities = huidig ? `${huidig}\n${waarde}` : waarde;
    } else if (!huidig || huidig.trim() === "") {
      nieuw[veld] = waarde;
    }
  }
  const velden = Object.keys(nieuw);
  if (velden.length === 0) continue;
  aangepast += 1;
  console.log(`${relatie.naam}: ${velden.join(", ")}`);
  if (schrijf) {
    await db.$transaction(async (tx) => {
      await tx.relatie.update({ where: { id: relatie.id }, data: nieuw });
      await tx.auditlog.create({
        data: {
          gebruiker: "Gegevens aanvullen",
          entiteit: "Relatie",
          entiteitId: relatie.id,
          actie: "gewijzigd",
          samenvatting: `Contactgegevens van ${relatie.naam} aangevuld: ${velden.join(", ")}`,
        },
      });
    });
  }
}

console.log(`\n${aangepast} relaties ${schrijf ? "aangevuld" : "zouden aangevuld worden (droog, geef --schrijf mee)"}.`);
if (ontbrekend.length) console.log(`Niet gevonden in deze database: ${ontbrekend.join(", ")}`);
await db.$disconnect();
