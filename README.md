# SVR balans-app

Financiële administratie van de StudieVerenigingenRaad Delft: facturen maken en
volgen, uitgaven registreren, evenementen omslaan over de deelnemers, en op elk
moment zien hoe de vereniging ervoor staat.

De app is gebouwd voor twee bestuursleden zonder boekhoudkundige achtergrond,
die met hun bankapp ernaast werken. **Er is geen koppeling met de bank**;
betalingen en het banksaldo voer je handmatig in.

---

## Starten

Gebruik [Node.js 22 of 24](https://nodejs.org) en een Postgres-database.
De app kan via Vercel met Neon worden verbonden; zie [MIGRATIE.md](MIGRATIE.md).

```bash
npm install
```

```bash
npx vercel link
npx vercel env pull .env.local
```

Zet in Vercel een eigen `APP_WACHTWOORD` en `AUTH_SECRET` en haal de variabelen
opnieuw op. Zonder Vercel kun je `.env.example` naar `.env.local` kopiëren en
je eigen Postgres-adres invullen. Een
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
wachtwoord uit `APP_WACHTWOORD`. Die naam komt bij elke wijziging in het auditlog te staan,
zodat achteraf te zien is wie wat gedaan heeft.

---

## Testen zonder iets te installeren

Open de repository op GitHub en kies **Code › Codespaces › Create codespace on
main**. De Codespace installeert de afhankelijkheden. Verbind daarna het
Vercel-project en haal de ontwikkelvariabelen op zoals hierboven beschreven.
Gebruik `npm run setup` alleen voor een lege database. Start daarna:

```bash
npm run dev
```

Het inlogwachtwoord staat in `APP_WACHTWOORD` in `.env.local`.

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
| `npm run test:e2e`   | Test de gebruikersstromen in Chromium met een tijdelijke database |
| `npm run typecheck`  | Controleert de types zonder te bouwen                      |
| `npm run lint`       | Controleert de code                                        |
| `npm run setup`      | Database aanmaken en startgegevens laden                   |
| `npm run db:seed`    | Alleen de startgegevens (opnieuw) laden                    |
| `npm run db:migrate` | Nieuwe migratie maken na een wijziging in het datamodel    |
| `npm run db:deploy`  | Past bestaande migraties toe, met behoud van gegevens      |
| `npm run db:studio`  | Bladert door de database in de browser                     |
| `npm run db:reset`   | **Gooit alle gegevens weg** en begint opnieuw              |

---

## Hoe de app werkt

### Boekjaren

Er is altijd precies één **actief** boekjaar. Alleen daarin kun je schrijven;
oudere jaren zijn wel te bekijken. Bovenin wissel je van boekjaar. Relaties
(studieverenigingen, personen, leveranciers) blijven over boekjaren heen
bestaan. Het eerste boekjaar wordt automatisch actief. Bij het aanmaken van een
volgend jaar kun je de begrotingsposten en bedragen kopiëren. Activeer dat jaar
wanneer je erin wilt gaan werken en neem de voorraad over via *Spullen & voorraad*.

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

Een creditfactuur telt mee zodra je deze op *verstuurd* zet. De app verrekent
de credit met het origineel en laat een eventuele terugbetaling apart zien.
Bij *Oninbaar afboeken* blijven ontvangen bedragen als inkomsten staan; alleen
het nog te ontvangen bedrag wordt afgeboekt. Je kunt de afboeking herstellen.

Zoek op nummer, omschrijving of relatie. Het filter *Vervallen* kijkt naar de
werkelijke vervaldatum. Ook uitgaven en relaties hebben een zoekveld.

Met **Jaarfacturen bijdrage** maak je in één klik voor alle bijdrageplichtige
studieverenigingen een conceptfactuur met het bedrag uit de begroting.

Bij **Nieuwe factuur** kun je meerdere relaties aanvinken (of *Alle
studieverenigingen*). Elke relatie krijgt dan een eigen factuur met dezelfde
regels, bijvoorbeeld de LBG-factuur voor vijftien verenigingen. Vink *Meteen op
verstuurd zetten* aan als je ze niet eerst als concept wilt nakijken. Met
**Kopiëren** op een factuur begin je een nieuwe met dezelfde omschrijving en
regels. Staan er concepten in het overzicht, dan zet je die met één knop allemaal
op verstuurd; filter eerst op evenement of zoekterm als het maar een deel is.

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
PDF, maximaal 4 MB). Die bestanden staan in de database zelf en worden
meegenomen in een volledige databaseback-up.

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

### Bankafschriften inlezen

Onder *Banksaldo › Bankafschriften* lees je een MT940-bestand in dat je bij ABN
AMRO downloadt. De app stelt koppelingen voor tussen de mutaties en je openstaande
facturen en uitgaven; je bevestigt die zelf voordat er iets geboekt wordt.

De app herkent een betaling op, van zeker naar minder zeker:

- **Zeker**: het factuurnummer staat in de omschrijving, of het rekeningnummer
  van de relatie is bekend en het openstaande bedrag klopt precies.
- **Naam en bedrag**: de naam van de vereniging staat bij de betaler of in de
  omschrijving, en het bedrag is precies wat er nog openstaat. Zo worden tien
  betaalde LBG-facturen van de vijftien vanzelf herkend, ook als niemand het
  factuurnummer vermeldt.
- **Alleen bedrag**: er is precies één open factuur of uitgave met dit bedrag.
  Dit staat niet aangevinkt; vink het zelf aan als het klopt.

Zekere voorstellen en naam-plus-bedrag staan alvast aangevinkt; met één knop
koppel je ze allemaal. Wat niet herkend is koppel je per regel, of boek je als
nieuwe uitgave of als *inkomst zonder factuur* (dan maakt de app een betaalde
factuur aan, zodat de ontvangst in de administratie staat). Na een koppeling
onthoudt de app het rekeningnummer van de relatie, zodat die de volgende keer
zeker herkend wordt. Draai je de koppeling terug, dan vergeet hij dat nummer weer.
Het banksaldo overnemen is een aparte knop en boekt niets.

Dit is een **handmatige import van een bestand dat jij downloadt**, geen
koppeling met de bank: de app praat nooit zelf met ABN AMRO en heeft geen
bankgegevens van je nodig. Je kunt de app volledig gebruiken zonder ooit een
afschrift in te lezen; alles is ook met de hand in te voeren.

### Spullen en voorraad

Bij *Spullen & voorraad* houd je per boekjaar aantallen, boekwaarde per stuk,
bewaarplaats en notities bij, bijvoorbeeld voor dassen. Vul voor bestaande spullen
ook de aantallen en waarde aan het begin van het boekjaar in. De huidige waarde
staat bij de activa op de balans. De huidige waarde min de beginwaarde staat als
voorraadmutatie in het resultaat; aankopen leg je ook vast bij *Uitgaven*.
Voorbeeld: 20 dassen van €5 gekocht, waarvan 12 over zijn, betekent €60 voorraad
en €40 verbruik. De aankoop van €100 blijft zichtbaar bij de uitgaven.

Bij een nieuw boekjaar kun je de eindvoorraad van vorig jaar overnemen. Neem de
beginvoorraad ook mee in het beginsaldo eigen vermogen bij *Boekjaren*.
Afgesloten jaren zijn alleen te bekijken. Wijzigingen worden gelogd.

### Contactgegevens en logo

Vul bij *Instellingen* de gegevens van de SVR in: adres, contactpersoon, e-mail,
telefoon, website, KvK, btw-nummer en IBAN. Bij *Relaties* zijn dezelfde velden
beschikbaar. Facturen tonen de afzender en de adres- en registratiedetails van
de ontvanger. Niet-ingevulde gegevens blijven weg.

Het meegeleverde SVR-logo staat standaard op facturen en de overdrachts-PDF.
Bij *Instellingen* kun je een eigen PNG/JPG uploaden (maximaal 2 MB en 16 megapixels)
of het standaardlogo herstellen. Het gekozen logo wordt in de database opgeslagen.

### Overdrachtbestanden

Onder *Overdracht* download je het hele boekjaar als Excel en als PDF:
exploitatie, balans, debiteurenoverzicht en spullen met aantallen en waarde.
Het Excel-bestand bevat daarnaast alle facturen en uitgaven. Dat is
wat de kascommissie en het volgende bestuur krijgen.

---

## Techniek

### Controles voor publicatie

```bash
npm test
npm run typecheck
npm run lint
npm run build
npm run test:e2e
```

Installeer voor de browsertests eenmalig Chromium met
`npx playwright install chromium`. De testgebruiker van de ontwikkel-database
moet databases mogen aanmaken. De runner maakt een unieke tijdelijke database,
past de migraties toe en test op poort 3101. Na afloop verwijdert hij uitsluitend
die testdatabase. Gebruik hiervoor ontwikkelvariabelen, geen productievariabelen.
Testresultaten, sessiegegevens en exports blijven buiten Git.

- **Next.js 16** (App Router) met **TypeScript** en **React 19**
- **Prisma 7** met **Postgres** via de `@prisma/adapter-pg` driver adapter;
  hosting op Vercel met Neon — zie [MIGRATIE.md](MIGRATIE.md)
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

- [MIGRATIE.md](MIGRATIE.md) — Vercel en Postgres instellen en publiceren
- [AANNAMES.md](AANNAMES.md) — de aannames die tijdens het bouwen zijn gedaan
