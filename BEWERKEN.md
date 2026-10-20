# Teksten en foto's van de website aanpassen

Voor wie nog nooit met git heeft gewerkt. Je hebt alleen een browser nodig en
een account op GitHub dat bij de repository mag.

Alle teksten van de publieke site staan in de map `content/`. Je past ze aan op
github.com; daarna zet het bestuur de site opnieuw live.

> **Eerst de goede branch kiezen.** De site op svr.tudelft.nl wordt gebouwd
> vanuit de branch **`tu-server`**, niet vanuit `main`. Klik op github.com
> linksboven op de knop met `main` en kies `tu-server` voordat je iets opent.
> Wat je op `main` aanpast, komt niet op de site.

## Wat staat waar

| Bestand | Wat erin staat |
|---|---|
| `content/home.md` | de opening van de voorpagina, "Wat we doen" en "Hoe de SVR werkt" |
| `content/overleggen.json` | de vier overleggen: wie, hoe vaak, waarover en wie voorzit |
| `content/jaar.json` | de tijdlijn "Een jaar SVR"; bij het gala staat ook de datum van dit jaar |
| `content/evenementen.json` | wat de SVR organiseert, met de bestandsnaam van de foto |
| `content/tradities.json` | de "wist je dat"-blokjes |
| `content/geschiedenis.json` | de mijlpalen op de tijdlijn (pagina Geschiedenis) |
| `content/geschiedenis.md` | het verhaal bovenaan de pagina Geschiedenis |
| `content/bereikt.json` | "Wat we bereikt hebben" op de pagina Geschiedenis |
| `content/stamboom.json` | de stamboom van de vijftien op de pagina Geschiedenis: uit welke vereniging of welk corps elke studievereniging voortkwam. Elke vereniging moet er precies één keer in staan |
| `public/img/sv/<slug>.png` | het logo van een vereniging, voor de lijst van de vijftien en de stamboom; vierkant, doorzichtige achtergrond |
| `content/oud-besturen.json` | de oud-besturen op de pagina Bestuur, zie hieronder |
| `content/beleid.md` | "Ons beleid dit jaar" op de pagina Bestuur; elk nieuw bestuur schrijft hier een korte samenvatting van het eigen beleidsplan |
| `content/samenwerking.json` | waar de SVR namens de verenigingen aanschuift |
| `content/vragen.json` | de veelgestelde vragen |
| `content/bestuur-worden.md` | de pagina voor studenten die bestuur willen worden |
| `content/privacy.md` | de privacypagina |
| `content/bestuur.json` | wie er in het bestuur zitten, het bestuursnummer, de startdatum en het aantal StOF-maanden |
| `content/verenigingen.json` | de vijftien verenigingen: naam, officiële naam, studie, faculteit, oprichtingsjaar en de link naar hun site. De site zet ze zelf op volgorde van oprichting; pas je een jaar aan, dan schuift de vereniging vanzelf mee |
| `content/svr.json` | e-mailadres, adres, KvK-nummer, oprichtingsdatum en de links naar LinkedIn en Facebook (onderaan elke pagina) |
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

## Een oud-bestuur toevoegen

Bij de wissel zet je het vertrekkende bestuur bovenaan in
`content/oud-besturen.json`; de site sorteert zelf op nummer. De lijst loopt nu
van bestuur 43 (2007-2008) tot en met 61, overgenomen van de oude website en de
beleidsplannen. Van 59 en 61 staan alleen voornamen: vul ze gerust aan.

```json
{
  "nummer": 62,
  "jaar": "2026-2027",
  "leden": ["Itai Givony (voorzitter)", "Teun van den Corput (secretaris en penningmeester)"],
  "foto": "besturen/62.jpg",
  "beleid": "/beleid/beleid-62.pdf"
},
```

- `foto`: de groepsfoto in `public/img/besturen/`, liggend of staand, ongeveer
  900 pixels breed en kleiner dan 200 kB.
- `beleid`: het beleidsplan in `public/beleid/`. Laat weg als er geen is.

## De wissel: een nieuw bestuur op de site

Doe dit in één keer, op de branch **`tu-server`** (zie boven).

1. **De foto's uploaden.** Open de map `public/img`, klik op **Add file ›
   Upload files** en sleep de portretten erin, met namen als
   `bestuur-voornaam.jpg` (vierkant, 400 × 400, max 300 kB). De groepsfoto heet
   `bestuur-samen.jpg`. Zet onderaan **Commit changes**.
2. **Het oude bestuur bij de oud-besturen zetten.** Open
   `content/oud-besturen.json`, klik op het potloodje en zet bovenaan, direct na
   de eerste `[`, een nieuw blok. Let op de komma na de `}`:

   ```json
   [
     {
       "nummer": 62,
       "jaar": "2026-2027",
       "leden": [
         "Itai Givony (voorzitter)",
         "Teun van den Corput (secretaris en penningmeester)"
       ],
       "foto": "besturen/62.jpg",
       "beleid": "/beleid/beleid-62.pdf"
     },
     {
       "nummer": 61,
   ```

   Upload de groepsfoto van het oude bestuur als `public/img/besturen/62.jpg` en
   het beleidsplan als `public/beleid/beleid-62.pdf`. Heb je die niet, laat de
   regels `"foto"` en `"beleid"` dan weg (en de komma ervoor).
3. **Het nieuwe bestuur invullen.** Open `content/bestuur.json` en pas het
   nummer, de startdatum en de leden aan:

   ```json
   {
     "nummer": 63,
     "startdatum": "2027-08-24",
     "leden": [
       { "naam": "Voornaam Achternaam", "functie": "Voorzitter", "foto": "bestuur-voornaam.jpg" },
       { "naam": "Voornaam Achternaam", "functie": "Secretaris", "foto": "bestuur-voornaam2.jpg" },
       { "naam": "Voornaam Achternaam", "functie": "Penningmeester", "foto": "bestuur-voornaam3.jpg" }
     ],
     "samenFoto": "bestuur-samen.jpg",
     "samenBijschrift": "Een zin onder de groepsfoto",
     "stofMaanden": 9
   }
   ```

4. **Het beleid.** Vervang de tekst in `content/beleid.md` door een korte
   samenvatting van jullie eigen beleidsplan: een `#`-titel, een inleiding en
   per beleidspunt een `##`-kop met een paar zinnen.
5. **Online zetten.** In Plesk: **Git › Pull updates** en dan **Node.js ›
   Restart App** (zie `DEPLOY.md`). Kijk daarna op /bestuur of alles klopt.

**Gaat er iets mis?** Een JSON-bestand is streng: één vergeten komma of
aanhalingsteken en de site bouwt niet. De bouw op GitHub (tabblad **Actions**)
wordt dan rood en de oude site blijft gewoon staan. Plak het bestand in
[jsonlint.com](https://jsonlint.com) om te zien welke regel fout is, of zet de
vorige versie terug (zie onderaan).

## Hoe komt het online?

De site wordt gebouwd vanuit deze bestanden, op de branch `tu-server`. Na een
wijziging bouwt GitHub de nieuwe versie (tabblad **Actions**, een paar minuten);
daarna moet iemand hem in Plesk ophalen met **Git › Pull updates** en **Node.js ›
Restart App**. Dat staat stap voor stap in `DEPLOY.md`. Tot die tijd
verandert er nog niets aan wat bezoekers zien.

## Iets kapot gemaakt?

Dat kan niet blijvend: elke wijziging staat in de geschiedenis van GitHub. Open
het bestand, klik op **History**, kies de vorige versie en herstel die. Vraag
het anders aan de penningmeester of de secretaris.
