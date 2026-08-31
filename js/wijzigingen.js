"use strict";
/* De wijzigingsmonitor — fase D1, de terugkeerlus.

   Wie een reis al plande, moet een reden krijgen om terug te komen. Die reden
   staat er al: meta/changelog.json (fase A4) houdt sinds de fundamentfase elke
   inhoudelijke wijziging in de regeldata bij, met precies de velden die een
   gebruiker nodig heeft — land, onderwerp, oude waarde, nieuwe waarde, datum,
   bron. Dit bestand doet niets anders dan die lijst naast trip.countries
   leggen en tonen wat er sinds de vorige controle is veranderd.

   Geen nieuwe opslag voor "opgeslagen reizen" — die staat al in STORE_TRIPS
   (js/trip.js). Elke trip draagt sinds fase D een laatstGecontroleerd-
   tijdstip; dat is het enige nieuwe stukje staat dat hierbij hoort. */

var CHANGELOG = null;

function laadChangelog(){
  return loadJSON("meta/changelog.json").then(function(d){
    CHANGELOG = d;
    verversWijzigingenBadge();
    if(VIEW === "reizen") renderMijnReizen();
  }).catch(function(){
    /* Stil: geen changelog geladen is geen fout om de gebruiker mee lastig te
       vallen, gewoon niets te melden totdat het lukt. */
  });
}

/* Welke changelogregels raken déze reis: hetzelfde land, en later dan de
   vorige controle. Een wijziging zonder land (een appwijziging, geen
   regelwijziging) hoort bij geen enkele specifieke reis en telt hier niet mee —
   §4 van V2_AUDIT.md noemt id's die aan één feit hangen, en een feit zonder
   land is geen feit dat een reis gebruikt. */
function wijzigingenVoorTrip(trip){
  if(!CHANGELOG || !trip || !trip.laatstGecontroleerd) return [];
  var landen = {};
  (trip.countries || []).forEach(function(code){ landen[code] = 1; });
  if(!Object.keys(landen).length) return [];
  var ijk = String(trip.laatstGecontroleerd).slice(0, 10);
  return CHANGELOG.wijzigingen
    .filter(function(w){ return w.land && landen[w.land] && w.datum > ijk; })
    .sort(function(a, b){ return a.datum < b.datum ? 1 : -1; });
}

function wijzigingenTotaalTeller(){
  if(!CHANGELOG || !TRIPS) return 0;
  return TRIPS.reduce(function(n, t){ return n + wijzigingenVoorTrip(t).length; }, 0);
}

/* De badge/teller in de nav (§ D1: "zodra er ongelezen wijzigingen zijn voor
   een opgeslagen reis"). Twee plekken dragen 'm: de zijbalk en het Meer-paneel
   op mobiel, want "Mijn reizen" zit daar achter. */
function verversWijzigingenBadge(){
  var n = wijzigingenTotaalTeller();
  var els = document.querySelectorAll(".navbadge-wijzigingen");
  for(var i = 0; i < els.length; i++){
    els[i].textContent = n > 99 ? "99+" : String(n);
    els[i].hidden = n === 0;
    if(n) els[i].setAttribute("aria-label", i18nAantal("wijzigingen.badge", n));
    else els[i].removeAttribute("aria-label");
  }
}

/* Eén changelogregel, in hetzelfde format als de changelog zelf: land,
   onderwerp, oud, nieuw, datum, bron — geen nieuwe tekststructuur verzinnen. */
function wijzigingenRegelHTML(w){
  var c = BY_CODE[w.land];
  var waarden = [];
  if(w.oud != null) waarden.push(esc(w.oud));
  if(w.oud != null && w.nieuw != null) waarden.push("&rarr;");
  if(w.nieuw != null) waarden.push(esc(w.nieuw));
  return '<li class="wijzigingregel">' +
    (c ? flagHTML(c) : "") +
    '<div class="wijzigingtekst">' +
      '<b>' + (c ? esc(c.name) + " — " : "") + esc(w.onderwerp) + '</b>' +
      (waarden.length ? '<span class="wijzigingwaarden">' + waarden.join(" ") + '</span>' : "") +
      '<span class="wijzigingmeta">' + esc(fmtDate(w.datum)) +
        (w.bron ? ' · <a href="' + esc(w.bron) + '" target="_blank" rel="noopener">' +
          esc(i18n("wijzigingen.bron")) + '</a>' : "") +
      '</span>' +
    '</div>' +
  '</li>';
}

function wijzigingenTripBlokHTML(trip, wijzigingen){
  return '<div class="wijzigingtrip">' +
    '<div class="wijzigingtripkop"><h3>' + esc(trip.naam) + '</h3>' +
      '<button type="button" class="tekstknop" data-wijzigingen-gezien="' + esc(trip.id) + '">' +
        esc(i18n("wijzigingen.gezien")) + '</button></div>' +
    '<ul class="wijzigingenlijst">' + wijzigingen.map(wijzigingenRegelHTML).join("") + '</ul>' +
  '</div>';
}

/* De kaart op "Mijn reizen". Leeg blijft leeg: geen kaart tonen die zegt dat
   er niets te zien is, net als deelMeldingHTML() in js/share.js. */
function wijzigingenKaartHTML(){
  if(!CHANGELOG || !TRIPS) return "";
  var blokken = [], totaal = 0;
  TRIPS.forEach(function(t){
    var w = wijzigingenVoorTrip(t);
    if(!w.length) return;
    totaal += w.length;
    blokken.push(wijzigingenTripBlokHTML(t, w));
  });
  if(!blokken.length) return "";
  return '<section class="dashkaart wijzigingenkaart">' +
    '<h2>' + iconUse("info") + esc(i18nAantal("wijzigingen.kop", totaal)) + '</h2>' +
    '<p class="hint">' + esc(i18n("wijzigingen.intro")) + '</p>' +
    blokken.join("") +
  '</section>';
}
