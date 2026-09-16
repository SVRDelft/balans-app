# Vercel en Postgres

De app gebruikt Postgres via Prisma 7. Het datamodel staat in
`prisma/schema.prisma`; de Postgres-migraties staan in
`prisma/migrations-postgres`. De oude SQLite-migraties in `prisma/migrations`
zijn alleen een archief. De lokale SQLite-database wordt niet verwijderd.

## Project verbinden

Gebruik Node.js 22 of 24 en installeer de afhankelijkheden:

```bash
npm ci
npx vercel login
npx vercel link
```

Kies het project `balans-app` van team `SVR` (`svr-d5ac`).

## Database en inloggen

Koppel via Vercel Storage een Neon Postgres-database in Frankfurt. De huidige
preview-database heet `balans-app-db` en is verbonden met Preview en Development.
Productie gebruikt de aparte database `balans-app-production-db` in Frankfurt.
De integratie gebruikt de prefix `NEON_`, omdat er al een handmatig ingestelde
`DATABASE_URL` in het project stond.

De app gebruikt `NEON_DATABASE_URL` of, zonder prefix, `DATABASE_URL`.
Voor migraties gebruikt Prisma bij voorkeur `NEON_DATABASE_URL_UNPOOLED`,
`DATABASE_URL_UNPOOLED` of `DIRECT_DATABASE_URL` (het directe adres).
De app en migraties moeten altijd naar dezelfde database verwijzen.

Stel daarnaast `APP_WACHTWOORD` en een willekeurige `AUTH_SECRET` van minstens
32 tekens in. Gebruik geen voorbeeldwaarden. Bewaar deze waarden als
servervariabelen, zonder `NEXT_PUBLIC_`.

Haal de ontwikkelinstellingen op:

```bash
npx vercel env pull .env.local
```

Next.js, Prisma en het seed-script laden dezelfde `.env.local`. Dit bestand
heeft voorrang op een eventuele oude `.env` met een SQLite-adres.

## Eerste installatie

Voor een nieuwe, lege database:

```bash
npm run setup
```

Dit maakt de tabellen aan en vult de startgegevens. Draai het seed-script niet
bij iedere deployment: het zet sommige begrotings- en relatiegegevens terug
naar de startwaarden. Gebruik bij een bestaande administratie alleen
`npm run db:deploy`.

Een oude SQLite-administratie wordt niet automatisch geïmporteerd. Bewaar het
originele bestand en controleer bij een import alle tabellen, factuurnummers,
bedragen, datums en bijlagen. Importeer alleen naar een lege database en gebruik
een transactie, zodat een mislukte import geen halve administratie achterlaat.

## Lokaal controleren

```bash
npm run typecheck
npm run lint
npm test
npm run build
npm run dev
```

Open <http://localhost:3000> en log in met je eigen naam en het wachtwoord uit
`APP_WACHTWOORD`. Controleer het dashboard, de verenigingen en de exports.

## Preview publiceren

```bash
npx vercel deploy --target=preview
```

`vercel.json` stelt Frankfurt in als regio en draait bij de build eerst
`prisma migrate deploy`. `postinstall` genereert de Prisma-client. Er wordt
geen lokale database of `.env`-bestand geüpload.

Gebruik voor productie een aparte database en stel de vereiste variabelen ook
voor de Production-omgeving in. Publiceer daarna bewust met
`npx vercel deploy --prod`. Preview- en ontwikkelversies mogen niet naar de
productiedatabase schrijven.

## Als een push niet vanzelf deployt

De repository is privé en het Vercel-project draait op het Hobby-plan. Die
combinatie stelt één eis: Vercel bouwt alleen commits waarvan het e-mailadres
van de **auteur** bekend is op het Vercel-account. Commit je vanaf een ander
adres, dan blijft de deployment hangen met:

> The deployment was blocked because the commit author did not have contributing
> access to the project on Vercel. The Hobby Plan does not support collaboration
> for private repositories.

Dat is geen storing en het betekent ook niet dat je moet upgraden. Er zijn drie
uitwegen, en de eerste twee kosten niets:

1. Commit vanaf het adres dat op het Vercel-account staat. Voor deze repository
   staat dat al ingesteld:

   ```bash
   git config user.email "bestuur-svr@tudelft.nl"
   ```

   Dit geldt alleen in deze map; je andere projecten houden je eigen adres. Doet
   een volgend bestuur dit vanaf een eigen laptop, dan moet het daar opnieuw.

2. Voeg je eigen e-mailadres toe aan het Vercel-account bij de
   accountinstellingen. Vercel vergelijkt de commit-auteur met alle geverifieerde
   adressen op dat account, dus daarna werken je eigen commits ook.

3. Publiceer met de hand: `npx vercel deploy --prod`. Zo'n deploy staat op naam
   van wie er is ingelogd en wordt dus nooit geblokkeerd. Handig als noodgreep,
   maar je moet het dan elke keer zelf doen.

De repository openbaar maken lost het ook op, omdat Vercel deze controle dan
overslaat. Doe dat niet: het zet de hele administratie te grabbel om een
instelling die in een minuut te regelen is.

## Bijlagen en back-ups

Bijlagen staan in Postgres. Uploads zijn beperkt tot 4 MB, zodat het bestand
inclusief formuliergegevens binnen de
[Vercel-requestlimiet](https://vercel.com/docs/functions/limitations) past.
De browser controleert de grootte vóór het versturen; de server controleert
opnieuw.

Controleer in Neon welke herstel- en back-upmogelijkheden bij het gekozen plan
horen. Bewaar daarnaast periodiek een database-export; de Excel- en PDF-export
uit de app zijn rapportages en vervangen geen volledige databaseback-up.
