# Overdracht aan het volgende bestuur

Voor de penningmeester en de secretaris van het nieuwe dagelijks bestuur. Loop
dit lijstje samen met je voorganger door; het duurt een uur en daarna heb je
alles.

---

## 1. Accounts

1. Je voorganger logt in en gaat naar **Beheer › Accounts**.
2. Daar maakt hij voor elk nieuw bestuurslid een account aan: e-mailadres, naam
   en rol **SVR-bestuur**. Het wachtwoord verschijnt één keer op het scherm —
   schrijf het over en log er meteen mee in, want de app vraagt dan om een eigen
   wachtwoord.
3. Werkt jullie account? Zet dan de accounts van het oude bestuur op
   **Uitzetten**. Verwijderen kan niet, en dat is met opzet: het auditlog moet
   blijven kloppen.
4. Controleer de verenigingsaccounts. Die staan op het **functionele** adres van
   elke vereniging (`secretaris@…`), dus bij een bestuurswissel daar hoeft er
   niets te veranderen. Klopt een adres niet meer, maak dan een nieuw account en
   zet het oude uit.

Raakt iemand zijn wachtwoord kwijt: **Accounts › Nieuw wachtwoord**. Het oude
werkt dan meteen niet meer.

---

## 2. Het nieuwe boekjaar

1. **Beheer › Boekjaren › Nieuw boekjaar**: naam (bijvoorbeeld
   `SVR 63 · 2027-2028`), het voorvoegsel voor factuurnummers (`SVR63-2027`), de
   begin- en einddatum, en de beginsaldi.
2. Het beginsaldo bank is het eindsaldo van vorig jaar; het beginsaldo eigen
   vermogen neem je over uit de balans, inclusief de waarde van de voorraad.
3. Neem de begroting en de voorraad over uit het vorige jaar en pas de bedragen
   aan.
4. Zet het nieuwe boekjaar op **actief**. Alleen daarin kun je boeken; oude jaren
   blijven te bekijken.

---

## 3. De vergaderingen van het nieuwe jaar

**Beheer › Portaal** heeft een blok *Vergadering toevoegen*. Voer per overleg de
datum, de tijd en de ontvangende vereniging in. Zodra ze erin staan, zien alle
verenigingen ze in het portaal.

De agenda zet je er vóór de vergadering bij (*Bestand toevoegen › Agenda*), de
notulen erna. Zonder stukken staat er netjes "Nog niet beschikbaar".

---

## 4. Toegang die overgaat

| Wat | Waar | Wat je moet doen |
|---|---|---|
| **Plesk** | plesk.tudelft.nl, abonnement "SVR bestuur" | Vraag ICT om het wachtwoord op het nieuwe bestuur te zetten, of laat je voorganger het resetten. |
| **GitHub** | github.com/SVRDelft | De organisatie staat op `bestuur-svr@tudelft.nl`. Zorg dat jij bij dat mailaccount kunt; daarmee kom je in GitHub. |
| **Mailbox** | `bestuur-svr@tudelft.nl` | Loopt via de TU. Vraag ICT om de doorstuurregels aan te passen. |
| **Database** | MariaDB op de TU-server | Het wachtwoord staat in Plesk bij *Custom environment variables*. Verander het bij een overdracht en pas `DATABASE_URL` aan. |
| **`AUTH_SECRET`** | Plesk, zelfde plek | Verander je die, dan wordt iedereen uitgelogd. Verder gebeurt er niets; dat is een veilige manier om schoon te beginnen. |

Er is géén `noreply@`-mailbox en geen mailserver: de app verstuurt geen e-mail.
Wachtwoorden geef je dus zelf door.

---

## 5. Back-ups

- **Dagelijks, automatisch**: Plesk, *Backup & Restore*. Controleer bij de
  overdracht of die taak nog aanstaat en of er recente back-ups in staan.
- **Zelf bewaren**: log in en klik op **Overdracht › Back-up downloaden**. Dat
  geeft één zip met de hele database als JSON, alle bonnetjes en alle bestanden
  uit het portaal. Bewaar die buiten de TU-server, bijvoorbeeld in de Drive van
  de SVR. Doe dat in elk geval bij de overdracht en na het afsluiten van een
  boekjaar.
- De Excel- en PDF-export bij **Overdracht** zijn rapportages voor de
  kascommissie, geen back-up.

---

## 6. Wie je waarvoor hebt

| Onderwerp | Bij wie |
|---|---|
| Server, domein, certificaat, e-mail | ICT van de TU Delft (servicedesk), abonnement "SVR bestuur", IP 131.180.77.135 |
| De app zelf | De documentatie in deze repository: `README.md` (gebruik), `DEPLOY.md` (live zetten), `AANNAMES.md` (waarom iets zo werkt), `BEWERKEN.md` (teksten en foto's) |
| De website aanpassen | `BEWERKEN.md`; dat kan iedereen met een GitHub-account, zonder programmeerkennis |

---

## 7. Wat je moet weten voordat je iets verandert

- **Facturen die verstuurd zijn, wijzig je niet.** Corrigeren gaat via een
  creditfactuur. Dat is precies wat een kascommissie wil zien.
- **De omslag verdeelt alleen over wie bevestigd heeft te betalen**, niet over
  wie zich heeft aangemeld. Kosten die ná de omslag binnenkomen gaan in een
  naheffing of bewust ten laste van de SVR.
- **Het auditlog** legt elke wijziging vast met naam en tijdstip. Wissen kan,
  met je wachtwoord, maar er blijft altijd één regel staan die zegt dat het
  gewist is.
- **`storage/`** (de bestanden van het portaal) staat niet in git. Die map zit
  wel in de Plesk-back-up en in de volledige export.
