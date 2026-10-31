# Changelog

## 2.0.1 - 2026-10-31

- Het wedstrijdscherm past op een iPhone van 360 tot 430 px: modusknoppen blijven volledig zichtbaar, de score staat symmetrisch per team, en de schotklok scrollt vrij van de vaste balk.
- Labels bij de klok staan gecentreerd. De pagina houdt rekening met de safe area boven en onder.

## 2.0.0 - 2026-10-31

- Ploegnamen zijn vrij invulbaar. Standaard Thuis en Uit. Optionele spelerslijst met rugnummers, te gebruiken bij een wissel.
- Modus Jurytafel en Coach. Coach volgt het eigen team en de gelijke speeltijd. Juryfuncties blijven beschikbaar.
- Wedstrijdklok toont resterend, gespeeld in de periode en het totaal. Logregels beginnen met de cumulatieve minuut, bijvoorbeeld 37'.
- Klok handmatig te zetten en te corrigeren. Start en stop met één tik. Timestamps, zodat de tijd klopt na vergrendelen.
- Eigen schotklok, duur instelbaar, standaard 25 seconden. De laatste vijf resets zijn te herstellen.
- Score en time-outs zitten in één compacte balk. Regels, limieten en bronnen staan in een aparte tab.
- IndexedDB, verzoek om permanente opslag, archief, JSON-back-up en tekstexport van het logboek.
- Service worker versie `jurytafel-2`: netwerk eerst voor de app-shell, verversen alleen na een tik.
- Geen club- of persoonsnamen meer in de app.

## 1.0.0 - 2026-10-31

- Eerste jurytafel-PWA: score, zuivere speeltijd, schotklok, time-out, wissel, kaart, log, checklist.
