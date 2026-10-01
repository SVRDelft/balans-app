# Teksten en foto's van de website aanpassen

Voor wie nog nooit met git heeft gewerkt. Je hebt alleen een browser nodig en
een account op GitHub dat bij de repository mag.

Alle teksten van de publieke site staan in de map `content/`. Je past ze aan op
github.com; daarna zet het bestuur de site opnieuw live.

## Wat staat waar

| Bestand | Wat erin staat |
|---|---|
| `content/home.md` | de voorpagina: de opening, "Wat we doen", "Aan tafel" en "Wat we organiseren" |
| `content/bestuur-worden.md` | de pagina voor studenten die bestuur willen worden |
| `content/privacy.md` | de privacypagina |
| `content/bestuur.json` | wie er in het bestuur zitten, het bestuursnummer en de startdatum |
| `content/verenigingen.json` | de vijftien aangesloten verenigingen |
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
