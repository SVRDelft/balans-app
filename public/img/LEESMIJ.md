# Afbeeldingen van de website

Alle afbeeldingen van de publieke site staan in deze map. De namen liggen vast:
de site zoekt precies deze bestanden en toont iets anders als ze er niet zijn.

| Bestand | Waarvoor | Formaat | Advies |
|---|---|---|---|
| `logo.svg` of `logo.png` | logo linksboven in de kop | SVG (het mooiste) of PNG met doorzichtige achtergrond | vierkant; een SVG schaalt vanzelf mee |
| `bestuur-<naam>.jpg` | portret van een bestuurslid | JPG | vierkant, 400 × 400 pixels, max 300 kB |
| `bestuur-samen.jpg` | foto van het hele bestuur op de voorpagina | JPG | staand, ongeveer 1000 pixels breed, max 300 kB |

De bestandsnaam van een portret zet je in `content/bestuur.json` bij `foto`; die
van de groepsfoto bij `samenFoto`, met de tekst eronder bij `samenBijschrift`.
Staat er een `logo.svg` én een `logo.png`, dan wint de SVG.

**Ontbreekt een bestand?** Dan is er geen fout: in plaats van het logo komt het
dasmotief met "SVR" te staan, en in plaats van een portret de initialen van het
bestuurslid. Dat wordt tijdens de build bepaald, dus je moet de site wel opnieuw
publiceren nadat je een foto toevoegt.

Houd de bestanden klein. Ze worden niet automatisch verkleind: verkleinen vraagt
software die niet op de webserver van de TU Delft kan draaien. Een foto van meer
dan een halve megabyte maakt de site merkbaar traag op een telefoon.
