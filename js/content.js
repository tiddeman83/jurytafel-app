/** Teksten van de app. Eigen formulering, met bronverwijzing. */

export const INSTALL = {
  iphone: "iPhone Safari → Deel → 'Zet op beginscherm'",
  android: "Android Chrome → menu → 'App installeren'",
};

export const CHECKLIST = [
  {
    id: 'voor',
    title: 'Voor de wedstrijd',
    items: [
      { id: 'voor-mensen', text: 'Jurytafel, scheidsrechter en bediening zijn op tijd aanwezig.' },
      { id: 'voor-aanvang', text: 'Aanvangstijd nagevraagd bij de wedstrijdcommissaris.' },
      { id: 'voor-tafel', text: 'Tafel staat tussen de banken, met werkruimte.' },
      { id: 'voor-klok', text: 'Tijdklok, scorebord en zoemer getest.' },
      { id: 'voor-schot', text: 'Schotklok getest als dit type die gebruikt.' },
      { id: 'voor-opstelling', text: 'Opstellingen binnen. Namen en rugnummers gecontroleerd.' },
      { id: 'voor-materiaal', text: 'Wisselformulieren en kaarten voor time-out en wissel liggen klaar.' },
      { id: 'voor-start', text: 'Startsituatie samen met de scheidsrechter gecontroleerd.' },
    ],
  },
  {
    id: 'tijdens',
    title: 'Tijdens de wedstrijd',
    items: [
      { id: 'tijdens-toezicht', text: 'Tijd, score en schotklok in de gaten houden.' },
      { id: 'tijdens-fout', text: 'Fout aan de tafel: zoemer, daarna beslist de scheidsrechter.' },
      { id: 'tijdens-melden', text: 'Time-out en wissel staand melden, met kaart en zoemer.' },
      { id: 'tijdens-rust', text: 'Na de eerste helft de rusttijd op het bord zetten.' },
    ],
  },
  {
    id: 'na',
    title: 'Na afloop',
    items: [
      { id: 'na-vastleggen', text: 'Uitslag en bijzonderheden vastleggen met de scheidsrechter.' },
      { id: 'na-log', text: 'Logboek bewaren of delen voordat je een nieuwe wedstrijd start.' },
    ],
  },
  {
    id: 'storing',
    title: 'Als iets uitvalt',
    items: [
      { id: 'storing-noteer', text: 'Noteer reden, stand, tijdstip, balbezit, wissels, time-outs en kaarten.' },
      { id: 'storing-bezetting', text: 'De tafel niet met een dunnere bezetting voortzetten zonder overleg.' },
    ],
  },
];

export const RULES = [
  {
    title: 'Wedstrijdtypen',
    html: `<p>De limieten horen bij het gekozen type. De scheidsrechter en het handboek van de competitie gaan voor.</p>
<ul class="lim">
<li><strong>Schotklok.</strong> 2 time-outs en 8 wissels per team. Officiële schotklok van 25 seconden. Tijdstraf van 4 minuten zuivere speeltijd.</li>
<li><strong>A-categorie.</strong> 2 time-outs en 8 wissels per team. Geen officiële schotklok en geen tijdstraf.</li>
<li><strong>Breedte / B.</strong> Geen time-out, onbeperkt wisselen, geen officiële schotklok en geen tijdstraf.</li>
</ul>
<p>De schotklok in deze app blijft altijd beschikbaar als eigen timer, ook zonder officiële schotklok.</p>`,
  },
  {
    title: 'Time-out',
    html: `<ul>
<li>Een time-out duurt één minuut. De wedstrijdklok staat stil.</li>
<li>Het team vraagt hem aan via de jurytafel. Zodra de groene kaart omhoog is, telt hij, ook als het team hem niet gebruikt.</li>
<li>Het maximum hangt van het wedstrijdtype af. De knop op het wedstrijdscherm toont hoeveel er nog over zijn.</li>
<li>Heeft een coach of staflid een lopende tijdstraf, dan mag dat team geen time-out aanvragen.</li>
<li>In de laatste tien seconden geeft de app een seintje, zodat je kunt fluiten. De time-out is dan ongeveer vijftig seconden onderweg.</li>
</ul>`,
  },
  {
    title: 'Wissel',
    html: `<ul>
<li>Alleen bij stil spel, gemeld aan de jurytafel met de oranje kaart.</li>
<li>Na een wissel gaat die speler niet direct het andere vak in.</li>
<li>Boven het maximum alleen een extra wissel voor een geblesseerde of weggestuurde speler, als de scheidsrechter dat toestaat.</li>
<li>Coach of staf in tijdstraf mag geen wissel aanvragen.</li>
<li>Bij rood voor een speler moet die speler vervangen worden. Leg die vervanging ook vast als wissel, anders klopt de teller niet.</li>
<li>Spelers op de bank of het veld zetten zonder de wisselknop telt niet mee als officiële wissel. Dat is een correctie van de opstelling.</li>
</ul>`,
  },
  {
    title: 'Kaarten',
    html: `<ul>
<li>Geel voor een speler: vier minuten zuivere speeltijd op de bank. De straf loopt alleen mee als de wedstrijdklok loopt.</li>
<li>Geel voor coach of staf: vier minuten niet coachen, geen time-out en geen wissel.</li>
<li>Een tweede geel voor dezelfde persoon wordt rood.</li>
<li>Rood voor een speler: de rest van de wedstrijd eruit, en vervangen.</li>
<li>Rood voor coach of staf: coaching kwijt. Na vier minuten mag de aanvoerder time-out en wissel aanvragen.</li>
</ul>`,
  },
  {
    title: 'Klok',
    html: `<ul>
<li>Zuivere speeltijd: de klok loopt alleen tussen start en stop. Eén tik.</li>
<li>Je ziet tegelijk de resterende tijd, de gespeelde tijd in deze periode en het totaal van de wedstrijd.</li>
<li>Voorbeeld: bij helften van 30 minuten is 5:00 in de tweede helft samen 35:00 gespeeld. Bij helften van 25 minuten is dat 30:00.</li>
<li>In het logboek staat de lopende minuut als 37', met de exacte tijd ernaast. Op 35:00 begint minuut 36.</li>
<li>De rust op het bord is één minuut korter dan de ingestelde rust, zodat het bord op nul staat als de teams weer mogen starten.</li>
<li>In de Nederlandse competitie speelt men doorgaans twee helften zonder extra beslissingsperiode. Volg de scheidsrechter als de opdracht afwijkt.</li>
<li>Ga pas naar de volgende periode als de gespeelde tijd van deze helft klopt. Alleen die tijd telt mee in het totaal.</li>
</ul>`,
  },
  {
    title: 'Schotklok',
    html: `<ul>
<li>Standaard 25 seconden. De duur is zelf in te stellen.</li>
<li>Elke reset bewaart de tijd van vóór die reset, plus de wedstrijdtijd. Alleen de laatste vijf blijven staan.</li>
<li>Tik op de schotklok en kies herstel om een foute reset terug te zetten.</li>
<li>Bij een officiële schotklok: terug naar de begintijd als de verdediging de bal verovert, bij een doelpunt, aan het eind van een periode, of bij een spelhervatting zoals een vrije worp of strafworp.</li>
<li>Alleen stoppen, zonder reset, bij uitbal, een blessure van de aanvallende partij, of een andere onderbreking.</li>
</ul>`,
  },
  {
    title: 'Coach of jurytafel',
    html: `<p>Jurytafel volgt beide teams: score, time-outs, wissels en kaarten. Coach legt de nadruk op het eigen team, de wissels en een gelijke speeltijd. De andere functies blijven beschikbaar.</p>
<p>Speeltijd per speler loopt alleen mee zolang de wedstrijdklok loopt en de speler op het veld staat. Het gemiddelde is de gelijke verdeling over de ingevoerde selectie.</p>`,
  },
];

export const SOURCES = 'Bronnen, ter verwijzing en niet als citaat: KNKV-spelregels korfbal (time-out, wissel, kaarten, schotklok), KNKV-competitiehandboek 2026-2027 (categorieën en aantallen), KNKV-opleiding voor de jurytafel (werkwijze). Limieten kunnen per seizoen wijzigen.';

export const WARNING = 'Deze app ondersteunt de jurytafel of de coach. De scheidsrechter beslist. Controleer de aantallen in het handboek van jouw competitie.';
