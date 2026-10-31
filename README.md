# Jurytafel

Mobiele webapp voor de korfbaljurytafel en voor de coach. Bedoeld voor een telefoon, installeerbaar op het beginscherm, bruikbaar zonder netwerk. Er is geen account en geen server: de wedstrijd staat op het toestel.

Standaardploegen zijn **Thuis** en **Uit**. Namen, spelers en rugnummers vul je per wedstrijd zelf in.

## Installeren

- iPhone Safari → Deel → 'Zet op beginscherm'.
- Android Chrome → menu → 'App installeren'.

Dezelfde aanwijzing staat in de app (eenmalige banner, en tab Info).

## Wat je ermee doet

- Zuivere speeltijd: grote start/stop, resterend en gespeeld tegelijk, plus het totaal over de wedstrijd. Bij helften van 30 minuten is minuut 5 van de tweede helft 35:00 gespeeld. Bij 2×25 is dat 30:00.
- Klok handmatig bijstellen: helftduur, resterend of gespeeld zetten, en correcties van 1 seconde tot 1 minuut. De klok rekent met timestamps, zodat hij klopt na het vergrendelen van het scherm.
- Eigen schotklok (standaard 25 seconden, duur zelf te kiezen), ook als er geen officiële schotklok is. Elke reset bewaart de tijd van ervoor. De laatste vijf staan onder een tik op de schotklok, met herstel.
- Compacte scorebalk met plus en min per team, en een time-outknop per team met het resterende aantal.
- Wissels op nummer of naam als je spelers invult, kaarten, tijdstraf van 4 minuten die alleen meeloopt als de wedstrijdklok loopt, en een time-out van 1 minuut.
- Modus Jurytafel (beide teams) of Coach (eigen team, wissels, gelijke speeltijd). Bestaande juryfuncties blijven beschikbaar.
- Wedstrijdtype Schotklok, A-categorie of Breedte / B, met de bijbehorende limieten. Uitleg staat in de tab Regels, niet op het klokscherm.
- Logboek met de cumulatieve minuut (bijvoorbeeld 37'), delen, kopiëren en als tekst bewaren.
- Checklist, donker thema, scherm wakker houden.
- Archief van afgeronde wedstrijden. Back-up als JSON (delen of downloaden) en weer importeren.

## Gegevens

De app bewaart de stand in IndexedDB en spiegelt de lopende wedstrijd in localStorage. Bij het starten vraagt ze `navigator.storage.persist()`, zodat de browser de gegevens minder snel wist. Dat is geen garantie. Maak een back-up via Info → Exporteer JSON en bewaar het bestand in Bestanden, iCloud of mail.

Een nieuwe versie verschijnt als banner: "Nieuwe versie beschikbaar – tik om te verversen". De app ververst niet uit zichzelf, ook niet tijdens een lopende wedstrijd. De service worker haalt `index.html` en het manifest eerst van het netwerk en valt offline terug op de cache.

## Ontwikkelen

Geen buildstap. De browser laadt de ES-modules in `js/` direct.

```bash
npm install
npm test
npm run test:e2e
```

`npm test` draait de logica van klok, schotklok, wissel, straf, migratie en import. `npm run test:e2e` opent de app headless in een mobiel venster en controleert dat er geen JavaScript-fouten zijn.

## Roadmap

- Toernooi met meerdere wedstrijden op één dag, sneller wisselen van tegenstander.
- Duidelijker signaal wie erin moet voor een gelijke speeltijd, inclusief vak en positie.
- Export die aansluit op het wedstrijdformulier van de bond, zonder dat formulier na te maken.
- Optioneel delen tussen jurytafel en coach. Nu bewust alleen lokaal.

## Licentie

De licentiekeuze staat open. Er is nog geen LICENSE-bestand.
