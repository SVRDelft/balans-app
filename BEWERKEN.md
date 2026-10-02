# Teksten en foto's van de website aanpassen

Voor wie nog nooit met git heeft gewerkt. Je hebt alleen een browser nodig en
een account op GitHub dat bij de repository mag.

Alle teksten van de publieke site staan in de map `content/`. Je past ze aan op
github.com; daarna zet het bestuur de site opnieuw live.

## Wat staat waar

| Bestand | Wat erin staat |
|---|---|
| `content/home.md` | de opening van de voorpagina, "Wat we doen" en "Hoe de SVR werkt" |
| `content/overleggen.json` | de vier overleggen: wie, hoe vaak, waarover en wie voorzit |
| `content/jaar.json` | de tijdlijn "Een jaar SVR", en de maand van het Landelijk Bestuursgala |
| `content/evenementen.json` | wat de SVR organiseert, met de bestandsnaam van de foto |
| `content/tradities.json` | de "wist je dat"-blokjes |
| `content/geschiedenis.json` | de mijlpalen op de tijdlijn |
| `content/samenwerking.json` | waar de SVR namens de verenigingen aanschuift |
| `content/vragen.json` | de veelgestelde vragen |
| `content/bestuur-worden.md` | de pagina voor studenten die bestuur willen worden |
| `content/privacy.md` | de privacypagina |
| `content/bestuur.json` | wie er in het bestuur zitten, het bestuursnummer en de startdatum |
| `content/verenigingen.json` | de vijftien verenigingen: naam, faculteit en de link naar hun site |
| `content/svr.json` | e-mailadres, adres, KvK-nummer en oprichtingsdatum |
| `public/img/` | het logo en de portretten, zie `public/img/LEESMIJ.md` |

## Een tekst aanpassen

1. Ga naar de repository op github.com en open de map `content`.
2. Klik op het bestand dat je wilt aanpassen, bijvoorbeeld `home.md`.
3. Klik rechtsboven op het **potloodje** (Edit this file).
4. Pas de tekst aan. Let op de opmaak:
   - een regel die met `#` begint is de titel van de pagina;
   - `##` is een kop van een blok, `###` is een kopje van een kaartje daarbinnen;
   - een lege regel begint een nieuwe alinea;
   - een regel die met `- ` begint is een opsommingspunt;
   - `**zo**` maakt tekst vet, en `[tekst](https://adres)` maakt een link.
5. Klik op **Commit changes**, zet er in één zin bij wat je veranderd hebt en
   bevestig.

Verander niets aan de tekens `#`, `-`, `**` of de haakjes zelf, tenzij je weet
wat je doet. De rest is gewone tekst; typefouten zijn gewoon typefouten.

## Foto's van evenementen en logo's van verenigingen

- Een foto bij een evenement: zet hem in `public/img/events` met precies de naam
  die in `content/evenementen.json` bij `foto` staat (`eoty.jpg`, `ddb.jpg`,
  `dies.jpg`, `lbg.jpg`). Liggend, ongeveer 1200 bij 800 pixels.
- Een logo van een vereniging: zet het in `public/img/sv` met de naam uit
  `slug` in `content/verenigingen.json`, bijvoorbeeld `curius.png`. Vierkant,
  256 bij 256, met een doorzichtige achtergrond.

Ontbreekt een bestand, dan is dat geen fout: bij een evenement verschijnt het
dasmotief, en bij een vereniging de eerste letters van de naam.

## Een bestuurslid of een foto wijzigen

1. Zet de foto in `public/img` (knop **Add file › Upload files**), met een naam
   als `bestuur-naam.jpg`. Lees eerst `public/img/LEESMIJ.md` voor de maten.
2. Open `content/bestuur.json` en pas de lijst aan. Let op de komma's en de
   aanhalingstekens; het bestand moet er zo uitzien:

   ```json
   {
     "nummer": 63,
     "startdatum": "2027-08-24",
     "leden": [
       { "naam": "Voornaam Achternaam", "functie": "Voorzitter", "foto": "bestuur-voornaam.jpg" },
       { "naam": "Voornaam Achternaam", "functie": "Secretaris", "foto": "bestuur-voornaam2.jpg" }
     ]
   }
   ```

Heb je nog geen foto? Laat `"foto"` dan weg. Er verschijnen dan initialen in het
dasmotief, en dat ziet er netjes uit.

## Hoe komt het online?

De site wordt gebouwd vanuit deze bestanden. Na een wijziging moet iemand de
nieuwe versie publiceren; dat staat stap voor stap in `DEPLOY.md`. Tot die tijd
verandert er nog niets aan wat bezoekers zien.

## Iets kapot gemaakt?

Dat kan niet blijvend: elke wijziging staat in de geschiedenis van GitHub. Open
het bestand, klik op **History**, kies de vorige versie en herstel die. Vraag
het anders aan de penningmeester of de secretaris.
