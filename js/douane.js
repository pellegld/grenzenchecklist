"use strict";
/* Terugreis- en na-reismodus — fase D3.

   Twee losse onderdelen die allebei pas op de terugweg ertoe doen: de
   douanelimieten voor wie van buiten de EU terugkomt, en hoe je een
   phishing-boete herkent. Ze staan op de Onderweg-pagina (js/journey.js
   bouwt de rest van die pagina) en, verkort, in het reisdocument (§11) zodat
   het ook op papier meegaat.

   De douanelimieten zelf zijn een EU-brede regel, niet iets per land: hoeveel
   je belastingvrij mee de EU in mag nemen hangt niet af van welk niet-EU-land
   je verlaat. Toch staat het blok per land in countries.json (bij CH en GB),
   zoals de rest van de data: elk feit met zijn eigen id, bron en
   confidence, zodat een correctie of een changelogregel er net zo naar kan
   wijzen als naar elk ander feit. */

/* De 16 landen in countries.json zijn op twee na EU-lidstaat. Dat is geen feit
   dat een bron of een confidence-niveau nodig heeft zoals de rest van de data
   in countries.json — het is wie er lid is van de EU — en staat daarom hier
   als vaste lijst, niet in de data zelf. */
var NIET_EU_LANDEN = { CH: 1, GB: 1 };

function tripBuitenEU(trip){
  return tripLanden(trip)
    .filter(function(code){ return NIET_EU_LANDEN[code]; })
    .map(function(code){ return BY_CODE[code]; });
}

function douaneLandHTML(c){
  var d = c.douane;
  if(!d) return "";
  return '<div class="douaneland">' +
    '<h3>' + flagHTML(c) + esc(c.name) + '</h3>' +
    (d.note ? '<p class="hint">' + esc(d.note) + '</p>' : "") +
    '<ul class="douanelijst">' +
      '<li><b>' + esc(i18n("douane.alcohol")) + '</b><span>' + esc(d.alcohol) + '</span></li>' +
      '<li><b>' + esc(i18n("douane.tabak")) + '</b><span>' + esc(d.tabak) + '</span></li>' +
      '<li><b>' + esc(i18n("douane.overig")) + '</b><span>' + esc(d.overig) + '</span></li>' +
    '</ul>' +
    '<p class="douanebron">' + owBadgeHTML(d.confidence) + herkomstRegelHTML({ sourceUrl: d.sourceUrl }) +
      correctionLinks(c, d.id) + '</p>' +
  '</div>';
}

/* Alleen relevant tonen als de route buiten de EU komt; binnen de EU gelden
   geen douanelimieten en dat zegt de kaart met zoveel woorden, in plaats van
   het blok gewoon leeg te laten staan. */
function douaneKaartHTML(trip){
  if(!trip || !tripIsKlaar(trip)) return "";
  var landen = tripBuitenEU(trip);
  var nu = landen.length && trip.returnDate && vandaagISO() >= trip.returnDate;

  return '<section class="dashkaart douanekaart">' +
    '<h2>' + iconUse("doc") + esc(i18n("douane.kop")) +
      (nu ? '<span class="douanenu">' + esc(i18n("douane.nuRelevant")) + '</span>' : "") + '</h2>' +
    '<p class="hint">' + esc(i18n("douane.uitleg")) + '</p>' +
    (landen.length
      ? landen.map(douaneLandHTML).join("")
      : '<p class="hint">' + esc(i18n("douane.geenBuitenEU")) + '</p>') +
  '</section>';
}

/* Statische voorlichting: geen landspecifieke claims die verificatie nodig
   hebben, dus geen bron- of confidence-machinerie nodig — alleen de
   kenmerken van een phishing-boete die overal hetzelfde zijn. */
function boeteHerkenningKaartHTML(){
  return '<section class="dashkaart boeteherkenningkaart">' +
    '<h2>' + iconUse("warning") + esc(i18n("boeteherkenning.kop")) + '</h2>' +
    '<p class="hint">' + esc(i18n("boeteherkenning.intro")) + '</p>' +
    '<ul class="boeteherkenninglijst">' +
      '<li>' + iconUse("block") + '<span>' + esc(i18n("boeteherkenning.punt1")) + '</span></li>' +
      '<li>' + iconUse("check") + '<span>' + esc(i18n("boeteherkenning.punt2")) + '</span></li>' +
      '<li>' + iconUse("info") + '<span>' + esc(i18n("boeteherkenning.punt3")) + '</span></li>' +
    '</ul>' +
  '</section>';
}

/* ---------------- reisdocument (§11) ----------------
   Verkorte versie, zonder kaarten of badges — dezelfde tekst als op het
   scherm, want een document dat afwijkt van de app is erger dan geen
   document (zie js/document.js). */
function docDouane(trip){
  var landen = tripBuitenEU(trip);
  if(!landen.length) return "";
  return landen.map(function(c){
    var d = c.douane;
    if(!d) return "";
    return '<h3 class="docgroep">' + esc(c.name) + '</h3><ul class="doclijst">' +
      '<li>' + esc(i18n("douane.alcohol")) + ' ' + esc(d.alcohol) + '</li>' +
      '<li>' + esc(i18n("douane.tabak")) + ' ' + esc(d.tabak) + '</li>' +
      '<li>' + esc(i18n("douane.overig")) + ' ' + esc(d.overig) + '</li>' +
    '</ul>';
  }).join("");
}
