# Aannames

Alles wat tijdens het bouwen is ingevuld zonder dat het in de opdracht stond.
Loop dit door en corrigeer wat niet klopt; de meeste punten zijn in de app zelf
aan te passen.

---

## Moet je verifiëren

### Het aantal aangesloten studieverenigingen

De zestien uit de opdracht zijn geseed: TG, VvTP, Variscopic, Froude, ETV, PS,
LIFE, Curius, CH, ID, VSV, Stylos, MV, Hooke, Leeghwater en Bèta, allemaal
bijdrageplichtig. Je gaf zelf aan dat dit nog geverifieerd moet worden.
Toevoegen en verwijderen kan bij *Gegevens › Relaties*.

De jaarbijdrage wordt verdeeld over álle bijdrageplichtige verenigingen: bij
zestien is dat € 116,25 per stuk (€ 1.860 ÷ 16). Verandert het aantal, dan
verandert het bedrag per vereniging mee. Het scherm *Jaarfacturen bijdrage* laat
de verdeling zien vóórdat je iets aanmaakt.

### Het beginsaldo van het boekjaar

Beginsaldo bank en beginsaldo eigen vermogen staan allebei op € 0,00. Die zijn
niet uit de opdracht af te leiden — het boekjaar 2025-2026 sloot op − € 664,29,
maar dat is een resultaat en geen eindsaldo. Vul ze in bij *Beheer › Boekjaren*
zodra je de eindstand van vorig jaar hebt.

Staan bank en eigen vermogen niet gelijk, dan betekent dat dat er vorderingen of
schulden uit het vorige jaar zijn die niet apart zijn ingevoerd. De balans toont
dat verschil dan als losse regel, zodat hij altijd sluit en het verschil
zichtbaar blijft.

### De datum van het LBG

Het geseede evenement "LBG 2027" staat op 11 maart 2027. Dat is een plaatshouder;
pas hem aan zodra de zaal geboekt is.

### Gegevens van de vereniging

Adres, e-mailadres, IBAN en KvK-nummer zijn leeg. Ze staan op elke factuur en in
de herinneringstekst, dus vul ze in bij *Beheer › Instellingen*.

---

## Keuzes in het ontwerp

### De naam bij het inloggen

De opdracht vraagt één gedeeld wachtwoord én een auditlog dat vastlegt wie wat
wijzigde. Met alleen een gedeeld wachtwoord is die tweede eis niet in te vullen.
Daarom vraagt het inlogscherm naast het wachtwoord om je naam. Die naam wordt
niet gecontroleerd — het is geen beveiliging, het is een handtekening.

Bij echte accounts later vervang je alleen `controleerWachtwoord` en de inhoud
van `Sessie` in `src/lib/auth/sessie.ts`; de rest van de app gebruikt alleen
`sessie.naam`.

### Relaties hangen niet aan een boekjaar

De opdracht zegt dat alle gegevens aan een boekjaar hangen. Voor relaties is dat
bewust niet gedaan: de aangesloten verenigingen wisselen niet per jaar, en het
zou betekenen dat elk bestuur ze opnieuw moet invoeren. Facturen, uitgaven,
begrotingsposten, evenementen en banksaldi hangen wél aan een boekjaar.

### Prijs per persoon bij de omslag

De kosten gedeeld door het aantal bevestigd betalende personen komt zelden op een
heel aantal centen uit. De app rondt de prijs per persoon **naar boven** af, zodat
de kosten altijd gedekt zijn. Het verschil dat daardoor ontstaat is hoogstens
één cent per persoon — bij 181 deelnemers dus minder dan twee euro — en wordt in
de afstemming getoond als afronding, niet als fout.

Je mag een hogere prijs invullen dan de kostprijs, bijvoorbeeld om op een rond
bedrag uit te komen. Een **lagere** prijs weigert de app: daarmee zou het verlies
bij voorbaat vaststaan, en dat is precies wat dit systeem moet voorkomen.

Dit is bij de review van september 2026 bewust zo gehouden. Het alternatief is de
restcent exact verdelen, zodat de som van de deelfacturen precies het totaal is
(de functie `verdeelCenten` doet dat al voor de jaarfacturen). Nadeel daarvan is
dat deelnemers onderling een cent verschillen op hun factuur. De afweging was:
een paar euro overdekking die zichtbaar op de afstemming staat is te verkiezen
boven facturen die niet allemaal hetzelfde bedrag noemen.

### Wanneer telt een factuur mee

Uitgangspunt is het baten-lastenstelsel: een factuur telt mee als opbrengst zodra
hij op *verstuurd* staat, en een uitgave telt mee zodra hij geregistreerd is,
ongeacht of er al betaald is. Dat past bij de balans die de opdracht beschrijft,
met debiteuren aan de ene en crediteuren aan de andere kant.

Concepten tellen niet mee. Oninbaar afgeboekte en gecrediteerde facturen ook
niet: geld dat niet komt, is geen opbrengst.

Eén uitzondering: in de **afstemming per evenement** tellen concepten wél mee.
Daar is de vraag of de kosten volledig zijn doorbelast, en dat zijn ze zodra de
facturen gemaakt zijn. Dat de factuur nog verstuurd moet worden, wordt er apart
bij vermeld.

### Ouderdom van debiteuren

Gerekend vanaf de **factuurdatum**, niet vanaf de vervaldatum. Bij de standaard
betaaltermijn van 30 dagen valt "meer dan 30 dagen open" samen met "over de
vervaldatum heen".

### Doorbelasting op een uitgavenpost

Staat er een factuurregel op een uitgavenpost, dan wordt dat bedrag van de
gerealiseerde kosten op die post afgetrokken in plaats van als opbrengst
geteld. Dat is wat een doorbelasting is. In de praktijk zul je facturen bijna
altijd op een inkomstenpost boeken; het formulier zet die daarom bovenaan.

### Bonnetjes in de database

Bonnetjes en leveranciersfacturen worden als bestand in de database bewaard, niet
op schijf. Twee redenen: een back-up van de database bevat dan de volledige
administratie inclusief bijlagen, wat de overdracht een stuk simpeler maakt, en
de app heeft geen schrijfbaar bestandssysteem nodig — dat is op Vercel ook niet
beschikbaar.

Maximaal 4 MB per bestand, in JPG, PNG, WEBP, HEIC of PDF. Die grens staat in
`src/lib/bijlagen.ts` en hoort samen met `bodySizeLimit` in `next.config.ts`, dat
op 4,5 MB staat: het verschil is de ruimte voor de rest van het formulier binnen
de requestlimiet van Vercel. Verhoog je de een, doe dan ook de ander.

### Losse namen als deelnemer

Een deelnemer mag een losse naam zijn in plaats van een bestaande relatie. Op het
moment dat de omslag berekend wordt heeft de app wél een relatie nodig, want een
factuur gaat naar iemand. Voor losse namen maakt de app dan eenmalig een relatie
van het type *persoon* aan, of hergebruikt een bestaande relatie met dezelfde
naam.

### Naheffing over dezelfde deelnemers

Een naheffing gaat over de deelnemers uit de **eerste** omslagronde, ook als de
deelnemerslijst daarna is gewijzigd. Dat is wat de opdracht vraagt en het is ook
het enige dat verdedigbaar is: iemand die er bij het evenement niet was, kun je
achteraf geen extra rekening sturen.

### De bankimport wijkt af van de oorspronkelijke opdracht

De opdracht was uitdrukkelijk: *"Er komt geen koppeling met de bank — niet nu, en
ontwerp er ook niet omheen."* Er zit nu wél een import van MT940-afschriften in.

Het verschil met wat toen bedoeld werd: de app praat niet met de bank. Er is geen
API, geen inloggegevens, geen machtiging. Je downloadt zelf een bestand bij ABN
AMRO en leest dat in, en elke voorgestelde koppeling bevestig je met de hand
voordat er geboekt wordt. In die zin is het hetzelfde handwerk als overtypen,
alleen zonder de typefouten.

Maar het is wel degelijk "eromheen ontworpen": er zijn twee modellen bijgekomen
(`Bankimport` en `Bankmutatie`), een schermenreeks en een MT940-parser die
onderhouden moet worden. Wie dit niet wil, kan het scherm uit de navigatie halen;
de rest van de administratie werkt er niet van afhankelijk.

### Betalingen kunnen hard verwijderd worden

Een factuur kan alleen weg zolang hij concept is, en een uitgave alleen zolang
hij niet in een omslag verdeeld is. Voor **betalingen** geldt die bescherming
niet: een geregistreerde betaling kan verwijderd worden, en dan is hij weg. Ook
het terugdraaien van een bankimport verwijdert betalingen en uitgaven definitief.

Er blijft wel een spoor: elke verwijdering komt met bedrag, factuurnummer en
gebruiker in het auditlog. Voor een kascommissie is dat meestal genoeg, maar het
is geen echte softe verwijdering.

Ook dit is bij de review van september 2026 bewust zo gelaten. Wil een volgend
bestuur het strenger, dan is dat een schemawijziging (een `verwijderdOp`-kolom op
`Betaling`) plus aanpassing van elke plek die betalingen optelt — met name
`hertelFactuur` en `haalBoekjaarCijfers`.

### Verwijderen versus archiveren

Een relatie die al aan facturen, uitgaven of evenementen hangt wordt bij
"verwijderen" op non-actief gezet in plaats van weggegooid. De historie moet
overdraagbaar blijven.

Een uitgave die al in een omslag is verdeeld is niet meer te verwijderen en het
bedrag ervan niet meer te wijzigen: de facturen die eruit volgden zijn dan al
verstuurd.

### PDF's worden niet opgeslagen

De factuur-PDF wordt gemaakt op het moment dat je hem opvraagt. Dat kan omdat een
verstuurde factuur niet meer te wijzigen is, dus het resultaat is elke keer
hetzelfde. Een concept-PDF krijgt een duidelijk stempel CONCEPT.

### Geen btw

De SVR is niet btw-plichtig, dus facturen tonen geen btw. De schakelaar en het
percentage staan op één plek, bij *Beheer › Instellingen*. Let op: er wordt op dit
moment alleen een regel op de factuur mee aangepast; gaat de SVR echt btw
afdragen, dan moet er ook btw-berekening per factuurregel bij komen.

---

## Technische keuzes die afwijken

### Prisma met Postgres voor Vercel

Prisma 7 gebruikt `@prisma/adapter-pg`. De administratie, bijlagen en gekozen
logo's staan in Neon Postgres in Frankfurt. Productie heeft een aparte database;
Preview en Development delen de ontwikkelgegevens. De oude SQLite-migraties
blijven als archief beschikbaar. Zie [MIGRATIE.md](MIGRATIE.md).

### Voorraad per boekjaar

Aantallen en boekwaarde per stuk worden voor de begin- en huidige stand bewaard.
De huidige waarde staat op de balans; de mutatie telt mee in het resultaat.
Beginnende voorraad is bestaand vermogen en geen opbrengst. Aankopen moeten ook
bij Uitgaven worden geregistreerd. Een voorraadpost met beginvoorraad wordt niet
verwijderd wanneer hij is opgebruikt; het huidige aantal wordt dan nul.

### Verbruik van spullen telt op de begrotingspost

Aan een voorraadpost kan een begrotingspost hangen. Verlaag je het aantal, dan
telt de waarde die daarmee verdwijnt als kosten op die post, zodat begroot
tegenover gerealiseerd blijft kloppen. Geef je twee dassen van € 5,00 weg, dan
staat er € 10,00 gerealiseerd op *SVR-dassen en -strikken*, met eronder de
toelichting dat het om voorraadverbruik gaat.

**Voer dat verbruik niet óók in bij Uitgaven.** Dan zou het dubbel geteld worden,
en bovendien komt er een betaling of een schuld aan een leverancier in de
administratie die er niet is; dat loopt meteen mis in de controle op het
banksaldo. Uitgaven zijn voor geld dat de deur uit gaat, voorraadverbruik voor
waarde die de deur uit gaat.

Het teken werkt beide kanten op. Koop je voor € 100,00 nieuwe dassen, dan staat
die € 100,00 als uitgave in de administratie en groeit de voorraad met € 100,00;
per saldo nul, want je hebt geld voor spullen geruild. Pas als je ze weggeeft
worden het kosten. Verkoop je spullen, maak dan gewoon een factuur voor de
opbrengst; de voorraaddaling is dan de kostprijs ervan.

Spullen zonder begrotingspost blijven op één verzamelregel *Voorraadmutatie* in
de exploitatie staan, precies zoals daarvoor. De berekening zit in
`src/lib/finance/voorraadtoerekening.ts` en is getest op dubbeltelling.

### shadcn/ui zonder Radix

De componenten in `src/components/ui/` volgen de conventies van shadcn/ui: zelfde
mappen, zelfde `cn`-helper, zelfde CSS-variabelen. Voor keuzelijsten,
aankruisvakjes en dialogen zijn gewone HTML-elementen gebruikt in plaats van
Radix. Die versturen vanzelf mee met het formulier, werken zonder JavaScript en
schelen een hoop code.

`components.json` staat er wel, dus `npx shadcn@latest add dialog` werkt gewoon
als je later iets van shadcn nodig hebt.

### Geen enums in het datamodel

SQLite kent geen enums. De toegestane waarden staan als constanten in
`src/lib/domein.ts`. Zo werkt hetzelfde schema op SQLite en op Postgres.

### Vitest 4 in plaats van 5

Vitest 5 vraagt om `@types/node` 22 of nieuwer en liep vast op de npm-versie die
bij Node 20 hoort. Vitest 4 doet hetzelfde werk.
