# Database en hosting

De app gebruikt **MariaDB** via Prisma 7 met de driver adapter
`@prisma/adapter-mariadb`. Die adapter is pure JavaScript; er wordt niets
gecompileerd. Dat is de voorwaarde om op de webserver van de TU Delft te kunnen
draaien, waar we het besturingssysteem niet in de hand hebben.

Het datamodel staat in `prisma/schema.prisma`. De MariaDB-migraties staan in
`prisma/migrations-mysql`. De mappen `prisma/migrations-postgres` en
`prisma/migrations` zijn een archief van de Postgres- en SQLite-tijd; ze worden
niet meer gebruikt, maar blijven staan zolang de oude app op Vercel nog draait.

## Lokaal werken

```bash
npm install
cp .env.example .env     # en vul je eigen waarden in
npm run db:start         # MariaDB 10.11 in Docker
npm run setup            # tabellen aanmaken en startgegevens vullen
npm run dev
```

`npm run db:stop` stopt de database, `docker compose down -v` gooit hem ook leeg.
Zonder Docker kan elke MariaDB 10.11 of hoger; zet dan alleen `DATABASE_URL` in
`.env` goed.

## Van Postgres naar MariaDB

Zolang de oude app op Vercel met Neon Postgres draait, staat de echte
administratie daar. Overzetten gaat met één script:

```bash
npx vercel env pull .env.local                       # geeft NEON_DATABASE_URL
npx tsx scripts/postgres-naar-mariadb.mts            # droge loop: alleen tellen
npx tsx scripts/postgres-naar-mariadb.mts --schrijf  # echt overzetten
```

Het script schrijft alleen naar een **lege** MariaDB (`npm run db:reset` maakt
hem leeg) en controleert daarna per tabel het aantal rijen en de som van alle
bedragen in centen. Komt er één tabel niet overeen, dan stopt het met een
foutmelding en gebruik je de uitkomst niet.

Draai dit pas op het moment van de echte overstap opnieuw, zodat je niets mist
wat er in de tussentijd op Vercel is bijgeboekt.

## Verschillen tussen Postgres en MariaDB

Deze dingen zijn bij de overstap aangepast. Houd er rekening mee als je code
toevoegt:

- **Lange tekst.** MySQL maakt van een `String` standaard een `VARCHAR(191)`.
  Alle vrije tekst (omschrijvingen, notities, auditregels) heeft daarom
  `@db.Text` in het schema. Vergeet je dat bij een nieuw veld, dan wordt tekst
  stilletjes afgekapt.
- **Zoeken op hoofdletters.** Prisma's `mode: "insensitive"` bestaat alleen voor
  Postgres en is verwijderd. MariaDB vergelijkt met `utf8mb4_unicode_ci` al
  hoofdletterongevoelig, dus zoeken werkt hetzelfde.
- **Tekenset.** De database draait op `utf8mb4`, zodat bijvoorbeeld "Bèta" en
  een euroteken goed gaan.
- **Bonnetjes.** Bijlagen staan als bytes in de database. MariaDB weigert
  standaard pakketten boven 16 MB; `docker-compose.yml` zet
  `max-allowed-packet=64M`. Doet Plesk dat niet, dan is de bovengrens voor een
  upload lager dan de 20 MB uit de opdracht. Controleer dat op de server.
- **Datums** blijven UTC; de driver krijgt `timezone: "Z"` mee.

## Hosting op de TU-server

De app draait op de webhosting van de TU Delft (Plesk, Node.js via Passenger).
De stappen in Plesk staan in [DEPLOY.md](DEPLOY.md); die wordt in fase 5
geschreven.

Afspraken die daaruit volgen en die in de code gelden:

- Node 20.9 of hoger (`engines` in `package.json`); de server draait 20.20.
- Geen gecompileerde modules: geen `sharp`, `bcrypt` of `better-sqlite3`.
  Het controleren van een geüpload logo gebeurt in `src/lib/afbeelding.ts`.
- De build draait lokaal of in GitHub Actions, nooit op de server.
- Niets wat gedeeld moet zijn in het geheugen van het proces bewaren: Passenger
  draait meerdere processen naast elkaar.

## Uitweg terug naar Vercel

Als ICT de app op de TU-server niet toestaat, kan hij terug naar Vercel. Er zit
geen Plesk-specifieke code in de app. Nodig is dan:

1. Een MySQL-database die van buitenaf bereikbaar is (bijvoorbeeld PlanetScale
   of een MySQL bij een andere aanbieder), of terug naar Postgres door in
   `prisma/schema.prisma` de provider op `postgresql` te zetten, met
   `@prisma/adapter-pg` in `src/lib/db.ts` en een nieuwe migratiemap. De
   `@db.Text`-aanduidingen mogen dan blijven staan.
2. `DATABASE_URL` als omgevingsvariabele in Vercel, plus `APP_WACHTWOORD` en
   `AUTH_SECRET`.
3. De uploads: op Plesk staan die in `storage/` op schijf. Op Vercel is het
   bestandssysteem niet blijvend, dus dan is opslag bij een dienst als Vercel
   Blob of S3 nodig. De opslag zit achter één interface, zodat alleen die
   implementatie vervangen hoeft te worden.
4. De limiet van 4,5 MB per request van Vercel geldt dan weer voor uploads.

## Back-ups

Op de TU-server regel je een dagelijkse back-up van de database en de map
`storage/` in Plesk (*Backup & Restore*). Daarnaast heeft het bestuur in de app
een exportknop die de hele database als JSON en de uploads als zip downloadt;
bewaar die buiten de TU-server. De Excel- en PDF-exports zijn rapportages en
vervangen geen back-up.
