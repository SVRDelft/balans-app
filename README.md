# SVR balans-app

Financiële administratie van de StudieVerenigingenRaad Delft: facturen maken en
volgen, uitgaven registreren, evenementen omslaan over de deelnemers, en op elk
moment zien hoe de vereniging ervoor staat.

De app is gebouwd voor twee bestuursleden zonder boekhoudkundige achtergrond,
die met hun bankapp ernaast werken. **Er is geen koppeling met de bank**;
betalingen en het banksaldo voer je handmatig in.

---

## Starten

Je hebt alleen [Node.js 20.9 of nieuwer](https://nodejs.org) nodig. Er is geen
database-installatie nodig: de app draait op een SQLite-bestand.

```bash
npm install
```

```bash
cp .env.example .env
```

Zet daarna in `.env` een eigen wachtwoord en een eigen `AUTH_SECRET`. Een
willekeurige sleutel genereer je zo:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Database aanmaken en vullen met de startgegevens:

```bash
npm run setup
```

Starten:

```bash
npm run dev
```

De app draait nu op <http://localhost:3000>. Log in met je eigen naam en het
wachtwoord uit `.env`. Die naam komt bij elke wijziging in het auditlog te staan,
zodat achteraf te zien is wie wat gedaan heeft.

---

## Testen zonder iets te installeren

Open de repository op GitHub en kies **Code › Codespaces › Create codespace on
main**. De Codespace installeert alles, maakt de database aan en vult hem met de
startgegevens. Start daarna:

```bash
npm run dev
```

Het inlogwachtwoord staat in het bestand `.env` dat de Codespace voor je heeft
aangemaakt.

> GitHub Pages werkt niet voor deze app: die host alleen statische bestanden en
> deze app heeft een server en een database nodig. Voor een echt online versie
> zie [MIGRATIE.md](MIGRATIE.md).

---

## Alle commando's

| Commando             | Wat het doet                                              |
| -------------------- | --------------------------------------------------------- |
| `npm run dev`        | Start de app voor dagelijks gebruik                        |
| `npm run build`      | Maakt een productieversie                                  |
| `npm start`          | Draait de productieversie (na `npm run build`)             |
| `npm test`           | Draait de tests op de financiële berekeningen              |
| `npm run typecheck`  | Controleert de types zonder te bouwen                      |
| `npm run lint`       | Controleert de code                                        |
| `npm run setup`      | Database aanmaken en startgegevens laden                   |
| `npm run db:seed`    | Alleen de startgegevens (opnieuw) laden                    |
| `npm run db:migrate` | Nieuwe migratie maken na een wijziging in het datamodel    |
| `npm run db:studio`  | Bladert door de database in de browser                     |
| `npm run db:reset`   | **Gooit alle gegevens weg** en begint opnieuw              |

---

## Hoe de app werkt

### Boekjaren

Er is altijd precies één **actief** boekjaar. Alleen daarin kun je schrijven;
oudere jaren zijn wel te bekijken. Bovenin wissel je van boekjaar. Relaties
(studieverenigingen, personen, leveranciers) blijven over boekjaren heen
bestaan; begrotingsposten maak je per jaar opnieuw.

### Begroting

De begroting kent twee soorten posten:

- **Vaste posten** — betaald uit de jaarlijkse bijdrage van de aangesloten
  studieverenigingen. Dit is de enige plek waar de SVR zelf risico loopt.
- **Omslagposten** — evenementen waarvan de SVR de kosten voorschiet en achteraf
  verdeelt. Hierop hoort per definitie geen winst of verlies te ontstaan.

Elke factuurregel en elke uitgave wijst verplicht naar een begrotingspost.
Zonder die koppeling is begroting tegenover realisatie onmogelijk.

### Facturen

Een nieuwe factuur is altijd eerst een **concept**. Zodra je hem op *verstuurd*
zet, is hij niet meer inhoudelijk te wijzigen; corrigeren gaat dan via een
creditfactuur. Dat is geen bureaucratie maar precies wat een kascommissie wil
zien.

Factuurnummers (`SVR62-2026-0001`) lopen door per boekjaar en worden **nooit
hergebruikt**, ook niet als je een concept verwijdert. Een gat in de reeks is
verklaarbaar; een hergebruikt nummer niet.

Deelbetalingen kunnen: de status volgt automatisch uit de som van de betalingen.

Met **Jaarfacturen bijdrage** maak je in één klik voor alle bijdrageplichtige
studieverenigingen een conceptfactuur met het bedrag uit de begroting.

Bij een openstaande factuur staat een knop die de tekst voor een
herinneringsmail op je klembord zet. Versturen doe je zelf.

### Uitgaven

Registreer een uitgave zodra de factuur binnenkomt, ook als hij nog niet betaald
is. Koppel hem meteen aan het evenement waar hij bij hoort, anders valt hij
buiten de omslag.

Het vinkje **bedrag is definitief** is belangrijk: zolang dat uit staat,
blokkeert de uitgave de omslagberekening van het evenement. Een open bar wordt
pas weken later afgerekend, en dat moet de omslag tegenhouden.

Je kunt een bonnetje of leveranciersfactuur uploaden (JPG, PNG, WEBP, HEIC of
PDF, maximaal 5 MB). Die bestanden staan in de database zelf, zodat een kopie
van het databasebestand de volledige administratie bevat.

### Evenementen en de omslag

Dit is het belangrijkste onderdeel. Een evenement doorloopt drie fases.

**1. Open.** Je koppelt uitgaven zodra ze binnenkomen en houdt de deelnemerslijst
bij. Per deelnemer maak je onderscheid tussen *aangemeld* en *bevestigd
betalend*.

**2. Omslag berekenen.** De app deelt **altijd** door het aantal bevestigd
betalende personen, nooit door het aantal aangemelde. Beide getallen staan naast
elkaar, met in euro's wat de verkeerde keuze zou kosten. De berekening wordt
geweigerd zolang er gekoppelde uitgaven staan waarvan het bedrag niet definitief
is, en je moet eerst een korte checklist afvinken. De app maakt daarna per
deelnemer een conceptfactuur.

**3. Afgesloten.** Kan pas als alle gegenereerde facturen betaald of afgeboekt
zijn en er geen onverdeelde kosten meer staan.

Komt er ná de omslag alsnog een uitgave binnen, dan meldt de app dat opvallend en
biedt twee keuzes, met bij allebei het gevolg voor het resultaat:

1. een **naheffing** over dezelfde deelnemers, of
2. het bedrag **ten laste van de SVR** boeken.

Onderaan het evenement staat permanent een afstemming: totale kosten, totaal
gefactureerd, totaal ontvangen en het verschil. Dat verschil hoort nul te zijn.

### Balans en banksaldo

Voer het banksaldo regelmatig in vanuit je bankapp. De app zet dat af tegen het
saldo dat uit de administratie volgt. **Dat verschil is het beste signaal dat er
iets vergeten is.**

### Overdracht

Onder *Overdracht* download je het hele boekjaar als Excel en als PDF:
exploitatie, balans, debiteurenoverzicht, alle facturen en alle uitgaven. Dat is
wat de kascommissie en het volgende bestuur krijgen.

---

## Techniek

- **Next.js 16** (App Router) met **TypeScript** en **React 19**
- **Prisma 7** met **SQLite** via een driver adapter; geen ruwe SQL en geen
  SQLite-specifieke functies, zodat overstappen op Postgres alleen een wijziging
  van de provider en de adapter is — zie [MIGRATIE.md](MIGRATIE.md)
- **Tailwind CSS 4** met componenten in de conventie van **shadcn/ui**
- **@react-pdf/renderer** voor de PDF's (geen headless Chromium, werkt op Vercel)
- **ExcelJS** voor de Excel-export
- Authenticatie met één gedeeld wachtwoord uit een omgevingsvariabele,
  afgeschermd via `src/proxy.ts`, met een ondertekend sessiecookie
- Alle bedragen als **geheel aantal eurocenten**, nooit als kommagetal
- Alle datums in UTC opgeslagen, in Europe/Amsterdam getoond
- Interface volledig in het Nederlands

### Waar wat staat

```
prisma/schema.prisma          het datamodel
prisma/seed.ts                de startgegevens
src/proxy.ts                  het slot op de app
src/lib/finance/              de financiële berekeningen (met tests)
src/lib/rapportage.ts         alle cijfers van een boekjaar op één plek
src/lib/facturen.ts           factuurnummers en statusberekening
src/app/(app)/                de schermen
src/app/api/                  PDF's, bijlagen en exports
```

De berekeningen in `src/lib/finance/` zijn losse functies zonder database, zodat
ze te testen zijn. Draai `npm test` na elke wijziging daaraan.

---

## Verder lezen

- [MIGRATIE.md](MIGRATIE.md) — overstappen op Vercel met Postgres
- [AANNAMES.md](AANNAMES.md) — de aannames die tijdens het bouwen zijn gedaan
