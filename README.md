# SVR balans-app

Financiële administratie van de StudieVerenigingenRaad Delft: facturen maken en
volgen, uitgaven registreren, evenementen omslaan over de deelnemers, en op elk
moment zien hoe de vereniging ervoor staat.

De app is gebouwd voor twee bestuursleden zonder boekhoudkundige achtergrond,
die met hun bankapp ernaast werken. **Er is geen koppeling met de bank**;
betalingen en het banksaldo voer je handmatig in.

---

## Wat er in deze app zit

| Pad | Voor wie | Wat |
|---|---|---|
| `/`, `/bestuur-worden`, `/privacy` | iedereen | de publieke site van de SVR |
| `/portaal` | ingelogde studieverenigingen | eigen facturen met PDF, mededelingen, vergaderingen met agenda en notulen, en documenten |
| `/beheer` | ingelogd SVR-bestuur | de financiële administratie |

De teksten van de publieke pagina's staan in `content/`; hoe je die aanpast
staat in [BEWERKEN.md](BEWERKEN.md). De publieke pagina's zijn statisch en raken
de database niet, zodat ze blijven staan als de database er even uit ligt.

---

## Starten

Gebruik [Node.js 20.9 of hoger](https://nodejs.org) (de webserver van de TU
Delft draait 20.20) en een MariaDB-database.

```bash
npm install
```

Kopieer `.env.example` naar `.env` en vul je eigen waarden in. Een willekeurige
sleutel genereer je zo:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Start de database. Dat is een MariaDB 10.11 in Docker, dezelfde versie als op de
server van de TU Delft:

```bash
npm run db:start
```

Draait Docker niet, installeer dan MariaDB 10.11 of hoger zelf en zet het adres
van die database in `DATABASE_URL`. Verder verandert er niets.

Database aanmaken en vullen met de startgegevens:

```bash
npm run setup
```

Starten:

```bash
npm run dev
```

Maak het eerste bestuursaccount aan; zonder account kan niemand inloggen:

```bash
npm run account:eerste -- bestuur-svr@tudelft.nl "Je naam"
```

Het wachtwoord verschijnt één keer in de terminal. De app draait op
<http://localhost:3000> en vraagt bij de eerste keer inloggen meteen om een
eigen wachtwoord. Je naam komt bij elke wijziging in het auditlog te staan,
zodat achteraf te zien is wie wat gedaan heeft. Verdere accounts maak je aan bij
*Beheer › Accounts*.

Na het testen kun je onderaan de pagina *Auditlog* het log wissen met je eigen
wachtwoord. Er blijft dan één regel staan met wie het log wanneer gewist heeft.
Boekingen wissen doe je apart bij *Boekjaren*, ook met je wachtwoord.

### Accounts en rollen

| Rol | Mag bij | Hoe |
|---|---|---|
| **SVR-bestuur** | de administratie (`/beheer`) en het portaal | per persoon een account |
| **Studievereniging** | alleen het portaal, en alleen de eigen vereniging | per vereniging één account op het functionele adres, bijvoorbeeld `secretaris@curius.nl` |

Niemand kan zichzelf aanmelden. Accounts worden niet verwijderd maar uitgezet,
zodat het auditlog blijft kloppen. Vergeet iemand zijn wachtwoord, dan geeft het
bestuur bij *Accounts* een nieuw wachtwoord uit; dat wordt één keer getoond.

### Portaal

Bij *Beheer › Portaal* plaatst het bestuur mededelingen, voert het de
vergaderingen in en uploadt het agenda's, notulen en losse documenten. Alles wat
daar staat is zichtbaar voor **alle** aangesloten verenigingen met een account.

De vergaderingen van 2026-2027 staan in het seed-script
(`src/lib/portaal/vergaderingen.ts`); een volgend bestuur voert het nieuwe
rooster in via het scherm.

Uploads mogen PDF, PNG, JPG of DOCX zijn, maximaal 20 MB. De app kijkt naar de
inhoud van het bestand en niet naar de extensie. De bestanden staan in `storage/`
— buiten de map die de webserver uitserveert — met een willekeurige naam; de
oorspronkelijke naam staat in de database. Downloaden kan alleen via
`/api/portaal/bestand/<id>`, en daar wordt eerst gecontroleerd of je ingelogd
bent. **Neem `storage/` mee in de back-up**: die map staat niet in git.

### Testen

```bash
npm run build     # eerst: hiermee maakt Next de typen voor de routes aan
npm test          # alle tests, waaronder de toegangscontrole per scherm
npm run typecheck
npm run lint
```

Op een verse kopie van de repository faalt `npm run typecheck` tot je één keer
hebt gebouwd: `PageProps` en `RouteContext` komen uit bestanden die de build
genereert. GitHub Actions doet daarom hetzelfde: eerst bouwen, dan controleren.

`npm run test:e2e` (de browsertest met Playwright) is **nog niet omgezet** naar
MariaDB en de nieuwe accounts; die staat tijdelijk stil.

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

### Snel ergens komen

**Ctrl+K** (op een Mac Cmd+K) opent het zoekvenster, vanaf elke pagina van de
administratie. Daarin typ je een factuurnummer, de naam van een vereniging, een
uitgave, een evenement of de naam van een pagina; Enter brengt je erheen. Het
zoekt over **alle boekjaren**: een factuur van vorig jaar wisselt onderweg zelf
van boekjaar, zodat je niet op een leeg scherm belandt.

### Boekjaren

Er is altijd precies één **actief** boekjaar. Alleen daarin kun je schrijven;
oudere jaren zijn wel te bekijken. Bovenin wissel je van boekjaar. Relaties
(studieverenigingen, personen, leveranciers) blijven over boekjaren heen
bestaan. Het eerste boekjaar wordt automatisch actief. Bij het aanmaken van een
volgend jaar kun je de begrotingsposten en bedragen kopiëren. Activeer dat jaar
wanneer je erin wilt gaan werken en neem de voorraad over via *Spullen & voorraad*.

**Een oud jaar alsnog invoeren.** Begin je net met de app, dan staat het vorige
bestuursjaar nog nergens in. Maak dat jaar aan en zet het bij *Boekjaren* op
**Opbouwen**: zolang die schakelaar aanstaat mag je in dat afgesloten jaar boeken,
precies zoals in het actieve jaar. Lees daarna het MT940-afschrift van dat jaar in
en gebruik *Alles in één keer boeken*: van elke bijschrijving maakt de app een
factuur die al op betaald staat, van elke afschrijving een betaalde uitgave.
Facturen die nooit betaald zijn staan niet op het afschrift; die voer je er met de
hand bij. Zet de schakelaar daarna weer uit. Elke keer dat je hem omzet komt in
het auditlog te staan.

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

Bij een openstaande factuur maakt de app de tekst voor een herinnering; versturen
doe je zelf uit je eigen mail. Met één knop teken je aan dát je hem hebt verstuurd,
en dan houdt de app bij hoe vaak en wanneer dat gebeurde. Zo zie je in de lijst
welke facturen nog **niet** herinnerd zijn, en staat op het dashboard hoeveel te
late facturen daar nog op wachten.

Staat er een hele ronde facturen in de lijst — bijvoorbeeld alle LBG-facturen —
dan haal je met **PDF's als zip downloaden** alle PDF's in één keer op, met de
naam van de vereniging in de bestandsnaam. De knop volgt de filters die boven de
lijst staan.

Een betaling hoort bij het boekjaar waarin het **geld** binnenkwam, en dat is niet
altijd het jaar van de factuur. Betaalt een vereniging in oktober de factuur van
mei, dan kies je bij de betaling het nieuwe jaar: de vordering blijft in het oude
jaar staan en het geld telt in het nieuwe jaar mee. Beide balansen blijven zo
kloppen. Daarom mag je een betaling ook vastleggen op een factuur uit een
afgesloten boekjaar — als enige handeling in zo'n jaar.

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

### De spaarrekening

Naast de betaalrekening heeft de SVR een spaarrekening. Geld dat je daarheen
overmaakt is **geen uitgave**: het blijft van de SVR en staat alleen ergens
anders. Op de balans staat het daarom als apart bezit, en in de exploitatie zie je
er niets van terug.

Onder *Spaarrekening* leg je de mutaties vast:

- **Overboeking** tussen de eigen rekeningen. Die staat ook op je afschrift, dus
  meestal boek je hem bij de bankimport: kies daar *Naar de eigen spaarrekening*.
- **Rente** en **bankkosten**. Die komen rechtstreeks op de spaarrekening binnen
  en staan dus nooit op het afschrift van de betaalrekening. Daarom kies je er een
  begrotingspost bij: rente is een opbrengst, kosten zijn kosten.
- **Correctie**, voor het geval het saldo om een andere reden afwijkt.

Het beginsaldo van de spaarrekening zet je per boekjaar bij *Boekjaren*, naast het
beginsaldo van de bank. Net als bij de betaalrekening kun je het werkelijke saldo
uit je bankapp invoeren; het verschil met de administratie hoort nul te zijn en
staat ook op de balans.

### Debiteuren en de rekening-courant

Onder *Debiteuren* staat alles wat de SVR nog moet krijgen. Dat zijn twee dingen
die los van elkaar staan:

- **Openstaande facturen**, met de ouderdom gerekend vanaf de factuurdatum.
  Facturen uit eerdere boekjaren staan er apart bij, want dat geld komt in dit jaar
  binnen.
- **De rekening-courant**: geld dat buiten facturen om heen en weer gaat met één
  persoon of vereniging. De aanleiding is de praktijk — er wordt iets privés met de
  SVR-pas betaald, of iemand schiet iets voor. Zonder administratie daarvan
  verdwijnt zoiets in het bankverschil en weet een jaar later niemand meer wie wat
  moet betalen.

Een post op de rekening-courant heeft een richting in woorden en geen minteken dat
je moet onthouden: *moet de SVR nog betalen* of *de SVR moet nog betalen*. Een
saldo loopt door over boekjaren heen, tot het verrekend is. Dit geldt voor
iedereen die je wilt bijhouden, niet alleen voor het bestuur zelf.

Het vinkje **dit bedrag ging via de SVR-rekening** bepaalt wat er met de cijfers
gebeurt:

- **Aan** (het normale geval): het bedrag staat op het afschrift en gaat van het
  banksaldo af, met een vordering op die persoon ertegenover. Het raakt de
  begroting niet, want het is geen uitgave van de SVR.
- **Uit**: er is geen bankmutatie, dus het is een correctie — bijvoorbeeld een
  bedrag dat de SVR alsnog voor eigen rekening neemt. Dan hoort er een
  begrotingspost bij en komt het als kosten of opbrengst in de exploitatie.

Bij een bankimport zet je zo'n bedrag met één keuze op de rekening-courant van de
juiste persoon; een terugbetaling boek je op dezelfde manier en haalt het saldo
weer omlaag.

### Bankafschriften inlezen

Onder *Banksaldo › Bankafschriften* lees je een MT940-bestand in dat je bij ABN
AMRO downloadt onder **Bij- en afschrijvingen**, met *Bestandsformaat: MT940* en
een periode die binnen het boekjaar valt. Vink je daar zowel de bestuurrekening
als de spaarrekening aan, dan zet ABN ze in één bestand; de app herkent dat en
houdt de twee uit elkaar. De regels van de spaarrekening krijgen hun eigen blok,
want daar hoort nooit een factuur of uitgave bij: een overboeking tussen de eigen
rekeningen boek je op de regel van de betaalrekening en vink je bij de
spaarrekening alleen af, en rente of bankkosten boek je daar met een
begrotingspost erbij. Het eindsaldo van beide rekeningen wordt in één keer
overgenomen. De app stelt koppelingen voor tussen de mutaties en je openstaande
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

Openstaande facturen uit **eerdere boekjaren** staan gewoon tussen de keuzes: komt
het geld van vorig jaar nu binnen, dan koppel je dat hier en wordt de betaling in
dit jaar geboekt.

Zekere voorstellen en naam-plus-bedrag staan alvast aangevinkt; met één knop
koppel je ze allemaal. Wat niet herkend is koppel je per regel, of boek je als
nieuwe uitgave, als *inkomst zonder factuur* (dan maakt de app een betaalde
factuur aan, zodat de ontvangst in de administratie staat) of op de
**rekening-courant** van een persoon. Met *Alles in één keer boeken* doe je dat
voor een hele stapel regels tegelijk; dat is bedoeld voor het opbouwen van een oud
boekjaar. Na een koppeling
onthoudt de app het rekeningnummer van de relatie, zodat die de volgende keer
zeker herkend wordt. Draai je de koppeling terug, dan vergeet hij dat nummer weer.
Het banksaldo overnemen is een aparte knop en boekt niets.

Loopt de download over een jaargrens heen, dan zegt de app welke periode in het
bestand staat en welke bij dit boekjaar hoort. Download in dat geval per boekjaar
een apart bestand; voor een jaar dat je achteraf opbouwt, zet je dat boekjaar
eerst op *Opbouwen* (zie Boekjaren).

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
- **Prisma 7** met **MariaDB** via de `@prisma/adapter-mariadb` driver adapter:
  pure JavaScript, zodat de app ook draait op de webserver van de TU Delft —
  zie [MIGRATIE.md](MIGRATIE.md)
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

- [BEWERKEN.md](BEWERKEN.md) — teksten en foto's van de website aanpassen
- [DEPLOY.md](DEPLOY.md) — de app op de webserver van de TU Delft zetten
- [OVERDRACHT.md](OVERDRACHT.md) — overdracht aan het volgende bestuur
- [MIGRATIE.md](MIGRATIE.md) — de database en het publiceren van de app
- [AANNAMES.md](AANNAMES.md) — de aannames die tijdens het bouwen zijn gedaan
