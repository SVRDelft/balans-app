# De app op de webserver van de TU Delft zetten

Voor wie Plesk alleen van buiten kent. Je hebt nodig: toegang tot Plesk
(abonnement **SVR bestuur**, systeemgebruiker `svr`, IP 131.180.77.135) en
toegang tot de GitHub-repository.

De app bouwt zichzelf in GitHub; de server krijgt alleen het resultaat. Er gaat
nooit iets vanzelf live: jij drukt in Plesk op de knop.

---

## Eenmalig instellen

### 1. Bekijk wat er nu staat

In Plesk staat de huidige tijdelijke pagina in de map `httpdocs`. Die laten we
voorlopig met rust. De app komt in een eigen map, zodat je kunt terugvallen als
er iets misgaat.

Open in Plesk **Files** en maak naast `httpdocs` een map **`svr-app`** aan.

### 2. Git koppelen

1. Ga naar **Websites & Domains › svr.tudelft.nl › Git**.
2. Klik **Add Repository**.
3. Kies **Remote Git hosting** en vul bij *Remote Git repository URL* in:
   `https://github.com/SVRDelft/balans-app.git`
4. Is de repository privé, dan toont Plesk een **deploy key** (een lange tekst
   die begint met `ssh-rsa` of `ssh-ed25519`). Kopieer die en zet hem op
   github.com onder **Settings › Deploy keys › Add deploy key**. Geef hem een
   naam als "Plesk TU-server" en laat *Allow write access* uít. Gebruik dan in
   stap 3 het SSH-adres `git@github.com:SVRDelft/balans-app.git`.
5. Bij *Server repository name* zet je `svr-app`.
6. Zet **Deployment mode** op **Manual**. Dit is belangrijk: er gaat alleen iets
   live als jij op *Deploy* drukt.
7. Bij *Branch to track* kies je **`deploy`**. Dat is de branch met de gebouwde
   versie, niet de broncode.
8. Bij *Deployment path* zet je `/svr-app`.
9. Klik **OK** en daarna op **Pull updates** om de eerste versie op te halen.

### 3. Node.js aanzetten

1. Ga naar **Websites & Domains › svr.tudelft.nl › Node.js**.
2. **Node.js version**: `20.20.2`.
3. **Document root**: `/svr-app/public`
   *Dit moet echt `public` zijn.* Staat hier de hoofdmap, dan zijn `.env` en de
   rest van de bestanden via de browser op te vragen; Plesk waarschuwt daar zelf
   ook voor.
4. **Application mode**: `production`.
5. **Application root**: `/svr-app`
6. **Application startup file**: `server.js`
7. Klik **NPM install**. Dat installeert alleen de Prisma-opdrachtregel, die
   nodig is om de database bij te werken; de app zelf heeft alles al bij zich.

### 4. Database aanmaken

1. **Websites & Domains › Databases › Add Database**.
2. Naam: `svr` (Plesk maakt er `svr-bestuur_svr` van).
3. Maak een databasegebruiker aan, bijvoorbeeld `app`, met een lang wachtwoord
   dat Plesk zelf genereert. Schrijf het ergens veilig op.
4. Noteer de volledige naam van database en gebruiker zoals Plesk ze toont; die
   komen in de volgende stap terug.

### 5. Omgevingsvariabelen invullen

Op dezelfde **Node.js**-pagina staat **Custom environment variables**. Voeg toe:

| Naam | Waarde |
|---|---|
| `DATABASE_URL` | `mysql://svr-bestuur_app:HETWACHTWOORD@localhost:3306/svr-bestuur_svr` |
| `AUTH_SECRET` | een lange willekeurige reeks, zie hieronder |
| `NODE_ENV` | `production` |

Een sleutel maak je op je eigen laptop met:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Zolang er nog geen https is en je toch wilt kunnen inloggen, voeg je er tijdelijk
aan toe:

| Naam | Waarde |
|---|---|
| `ZONDER_HTTPS_INLOGGEN` | `ja` |

Haal die weg zodra het certificaat werkt. Zie "Zonder https" onderaan.

Klik **Apply** en daarna **Restart App**.

### 6. De database vullen

De database is alleen vanaf de server zelf bereikbaar, dus de tabellen worden
daar aangemaakt:

- Op de **Node.js**-pagina staat **Run script**. Vul daar `migrate` in en klik
  op uitvoeren. Dat draait `prisma migrate deploy` en maakt alle tabellen aan.
- Heb je SSH-toegang, dan kan het ook met:
  ```bash
  cd ~/svr-app && npm run migrate
  ```

Daarna maak je het eerste bestuursaccount aan; zonder account kan niemand
inloggen en dus ook niemand anderen toevoegen.

Zet bij **Custom environment variables** tijdelijk twee waarden klaar:

| Naam | Waarde |
|---|---|
| `ACCOUNT_EMAIL` | `bestuur-svr@tudelft.nl` |
| `ACCOUNT_NAAM` | `Je naam` |

Klik **Apply**, en daarna **Run script** met `account`. In de uitvoer staat het
wachtwoord — schrijf het meteen over, het is daarna niet meer op te vragen.
**Haal de twee variabelen daarna weer weg** en klik nog eens op **Apply**.

Met SSH kan het ook in één regel:

```bash
cd ~/svr-app && npm run account -- bestuur-svr@tudelft.nl "Je naam"
```

### 7. Controleren

Open in de browser:

- `svr.tudelft.nl` — de publieke site, met het logo en de vijftien verenigingen.
- `svr.tudelft.nl/bestuur-worden` en `/privacy`.
- `svr.tudelft.nl/robots.txt` — hier hoort `Disallow: /beheer` in te staan.
- `svr.tudelft.nl/beheer` — stuurt je naar het inlogscherm.
- Log in, wijzig je wachtwoord, open **Beheer › Portaal** en upload een
  testbestand. Download het daarna weer.
- Log uit en probeer `/beheer` nog eens: je moet weer op het inlogscherm komen.

---

## Een nieuwe versie live zetten

1. De wijziging staat in de hoofdbranch op GitHub. GitHub Actions bouwt hem en
   zet het resultaat op de branch `deploy` (zie **Actions** op github.com; een
   groen vinkje betekent klaar).
2. Plesk: **Git › Pull updates**.
3. Zijn er databasewijzigingen? Dan **Node.js › Run script › `migrate`**.
4. **Node.js › Restart App**.
5. Loop de controlelijst hierboven nog eens kort langs.

Gaat er iets mis, dan staat de vorige versie nog in de geschiedenis van de
`deploy`-branch: in Plesk kun je bij **Git** terug naar een eerdere commit en
opnieuw deployen.

---

## Gegevens overzetten vanuit de huidige app

De database op de TU-server is alleen vanaf die server zelf bereikbaar, dus je
kunt er niet rechtstreeks naartoe schrijven. De route is: op je laptop een
SQL-bestand maken en dat in Plesk importeren.

**Doe dit als laatste stap, en boek daarna niets meer op Vercel.**

### Op je laptop

```bash
npm run db:start                                   # lokale MariaDB
npx vercel env pull .env.local                     # haalt de adressen op
```

Zoek in `.env.local` het adres van de **productiedatabase**. Let op: er staan
ook adressen van de ontwikkeldatabase in. Zet het goede adres in één commando:

```bash
# Windows PowerShell
$env:BRON_POSTGRES_URL = "postgresql://...het productie-adres..."
npx tsx scripts/postgres-naar-mariadb.mts            # droge loop: alleen tellen
npx tsx scripts/postgres-naar-mariadb.mts --schrijf  # echt overzetten
npx tsx prisma/seed.ts vergaderingen                 # vergaderrooster aanvullen
node scripts/exporteer-sql.mjs                       # maakt svr-gegevens.sql
```

Het script zegt bovenaan uit welke server het leest; controleer dat het de
productiedatabase is. Het vergelijkt daarna per tabel het aantal rijen en de som
van alle bedragen, en stopt als er iets niet klopt. De lokale database moet leeg
zijn; leeggooien doe je met:

```bash
docker exec svr-mariadb mariadb -uroot -psvr-lokaal -e "DROP DATABASE svr; CREATE DATABASE svr CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
npx prisma migrate deploy
```

### In Plesk

1. Zorg dat de tabellen bestaan: **Node.js › Run script › `migrate`**.
2. Ga naar **Websites & Domains › Databases**.
3. Klik bij de database `svr-bestuur_svr` op **Import Dump**, kies
   `svr-gegevens.sql` van je laptop en bevestig. Staat die knop er niet, open dan
   **phpMyAdmin**, kies links de database, tabblad **Importeren**, bestand
   kiezen, **Starten**.
4. Onderaan `svr-gegevens.sql` staat een lijstje met het aantal rijen en het
   totaalbedrag per tabel. Controleer dat in de app: open **Exploitatie** en
   **Facturen** en kijk of de bedragen kloppen.

Accounts en inlogpogingen zitten **niet** in het bestand: die staan al op de
server en wachtwoorden horen niet door een webformulier te gaan.

### Daarna

- Zet de app op Vercel uit (of laat hem staan, maar boek er niets meer in).
- Bewaar `svr-gegevens.sql` nog even, en haal daarna een verse back-up op via
  **Overdracht › Back-up downloaden**.

## Back-ups

1. **Plesk › Websites & Domains › Backup & Restore › Schedule**.
2. Zet **Run this backup task** op **Daily**, bijvoorbeeld om 03:00.
3. Kies **Backup content: Configuration and content**, zodat zowel de database
   als de map `svr-app/storage` meegaat.
4. Zet **Keep backup files** op bijvoorbeeld 14 dagen.
5. Bewaar daarnaast af en toe een kopie buiten de TU-server: log in als bestuur
   en klik op **Overdracht › Back-up downloaden**. Dat geeft één zip met de hele
   database als JSON, de bonnetjes en de bestanden uit het portaal.

**Let op:** de map `storage/` staat niet in git. Een back-up van alleen de
database mist dus de agenda's en notulen.

---

## Zonder https

Zolang er geen certificaat is:

- De publieke pagina's werken gewoon over `http://`.
- Inloggen weigert de app, tenzij je `ZONDER_HTTPS_INLOGGEN=ja` zet bij de
  omgevingsvariabelen. Dan staat er een waarschuwing op de inlogpagina en boven
  in de administratie, en krijgt het sessiecookie geen `Secure`-vlag.
- Vraag ICT om een certificaat (de TU heeft een wildcard voor `*.tudelft.nl`) of
  om Let's Encrypt in Plesk. Zodra dat werkt: variabele weghalen, **Apply**,
  **Restart App**.

---

## Als iets niet werkt

| Wat je ziet | Wat het meestal is |
|---|---|
| 503 of "Application error" | Kijk bij **Node.js › Logs**. Meestal ontbreekt een omgevingsvariabele of staat het opstartbestand verkeerd. |
| Pagina's zonder opmaak | De document root staat niet op `/svr-app/public`. |
| "DATABASE_URL moet een MariaDB-adres zijn" | De variabele ontbreekt of begint niet met `mysql://`. |
| Inloggen zegt dat het nog niet kan | Er is geen https en `ZONDER_HTTPS_INLOGGEN` staat niet aan. |
| Foutmelding over migraties | Draai **Run script › `migrate`** en kijk bij Logs wat er precies misging. |
| Uploads mislukken boven een paar MB | Plesk kan een eigen uploadlimiet hebben (`client_max_body_size`); vraag ICT die op 25 MB te zetten. |
