"use strict";
/* Drukte per dag uit drukte.json — de kalenderpagina "Wanneer rijden".

   Twee bronnen van waarheid, in deze volgorde: `dagen` (gepubliceerde
   prognoses per datum, met een niveau voor de heen- en de terugrichting en
   waar mogelijk een bron) winnen altijd; `regels` (periode + weekdag → niveau)
   vullen de rest van het jaar. Alles zonder bron is een afleiding, en de
   pagina zegt dat bij elke dag met zoveel woorden.

   De kalender opent op de maand van je vertrekdatum (of op deze maand zonder
   reis), je vertrekdag krijgt een accentring, je retourdag een inktring, en de
   gekozen dag toont eronder de prognose met tekst en bron. Een dag draagt
   naast kleur altijd een teken (○ ◐ ● ✱ ■) en in de kaart eronder een woord,
   zodat de betekenis nooit alleen aan kleur hangt (§21). */

var DRUKTE = null;
var KAL_MAAND = null;        /* "JJJJ-MM" van de getoonde maand; null = volg de reis */
var KAL_RICHTING = "heen";   /* heen | terug — alleen de vaste dagen kennen het verschil */
var KAL_DAG = null;          /* ISO van de gekozen dag; null = vertrekdag of vandaag */

var DRUKTE_RANG = { rustig:0, matig:1, druk:2, zeerdruk:3, zwart:4 };
var DRUKTE_TEKEN = { rustig:"○", matig:"◐", druk:"●", zeerdruk:"✱", zwart:"■" };
var DRUKTE_NIVEAUS = ["rustig", "matig", "druk", "zeerdruk", "zwart"];

/* De prognose voor één dag. `richting` is "heen" (standaard) of "terug"; de
   vuistregels kennen geen richting en gelden voor allebei. Levert null als
   geen enkele bron iets over de dag zegt — dat is een gewone dag. */
function drukteVoor(iso, richting){
  if(!DRUKTE) return null;
  var vast = (DRUKTE.dagen || {})[iso];
  if(vast){
    var niveau = richting === "terug" ? (vast.terug || vast.heen) : vast.heen;
    return { niveau:niveau, heen:vast.heen, terug:vast.terug, tekst:vast.tekst,
             bron:vast.bron || null, hard:true, id:vast.id || null };
  }

  var d = new Date(iso + "T12:00:00");
  var mmdd = iso.slice(5), wd = d.getDay();
  var uit = null;
  (DRUKTE.regels || []).forEach(function(r){
    if(r.weekdagen.indexOf(wd) === -1) return;
    var binnen = r.van <= r.tot ? (mmdd >= r.van && mmdd <= r.tot)
                                : (mmdd >= r.van || mmdd <= r.tot);
    if(binnen) uit = { niveau:r.niveau, tekst:r.tekst, bron:null, hard:false, id:r.id || null };
  });
  return uit;
}

/* Rijd je zuidwaarts, dan zit je in dezelfde stroom als de Franse
   vertrekgolf; oost-west zegt die prognose weinig. */
function kalRichting(trip){
  var res = tripAnalyse(trip);
  if(!res || res.zuidwaarts === null || res.zuidwaarts === undefined){
    return i18n("kalender.vertrek");
  }
  return i18n(res.zuidwaarts ? "kalender.zuid" : "kalender.noord");
}

/* Was een vaste array; als functie volgt hij de taalkeuze. */
function maanden(){ return i18n("alg.maanden").split(","); }
function pad2(n){ return (n < 10 ? "0" : "") + n; }

function niveauLabel(k){
  var sleutel = "kalender.niveau." + k;
  var t = i18n(sleutel);
  if(t !== sleutel) return t;
  return (DRUKTE && DRUKTE.niveaus && DRUKTE.niveaus[k] && DRUKTE.niveaus[k].label) || k;
}

/* ---------------- welke maand, welke dag ---------------- */
function kalMaand(){
  if(KAL_MAAND) return KAL_MAAND;
  var basis = (TRIP && TRIP.departureDate) || vandaagISO();
  return basis.slice(0, 7);
}

function kalGekozenDag(){
  if(KAL_DAG) return KAL_DAG;
  var m = kalMaand();
  var vertrek = TRIP && TRIP.departureDate;
  if(vertrek && vertrek.slice(0, 7) === m) return vertrek;
  var vandaag = vandaagISO();
  if(vandaag.slice(0, 7) === m) return vandaag;
  return m + "-01";
}

function kalenderMaand(delta){
  var p = kalMaand().split("-");
  var d = new Date(Number(p[0]), Number(p[1]) - 1 + delta, 1);
  KAL_MAAND = d.getFullYear() + "-" + pad2(d.getMonth() + 1);
  KAL_DAG = null;
  renderKalender();
}

/* ---------------- de dagen van een maand ---------------- */
function kalDagenVan(jjjjmm){
  var p = jjjjmm.split("-"), jaar = Number(p[0]), maand = Number(p[1]);
  var eerste = new Date(jaar, maand - 1, 1);
  var aantal = new Date(jaar, maand, 0).getDate();
  var offset = (eerste.getDay() + 6) % 7;          /* maandag eerst */
  var uit = [];
  for(var i = 0; i < offset; i++) uit.push(null);
  for(var dag = 1; dag <= aantal; dag++){
    uit.push(jjjjmm + "-" + pad2(dag));
  }
  return uit;
}

function kalDagLabel(iso){
  var d = new Date(iso + "T12:00:00");
  var weekdagen = i18n("kalender.weekdagenVol").split(",");
  return weekdagen[(d.getDay() + 6) % 7] + " " + fmtDate(iso);
}

/* ---------------- HTML ---------------- */
function kalDagHTML(iso){
  if(!iso) return '<span class="kaldag leeg" aria-hidden="true"></span>';
  var info = drukteVoor(iso, KAL_RICHTING);
  var niveau = info ? info.niveau : "rustig";
  var vertrek = TRIP && TRIP.departureDate === iso;
  var retour = TRIP && TRIP.returnDate === iso;
  var vandaag = vandaagISO() === iso;
  var gekozen = kalGekozenDag() === iso;
  var klassen = ["kaldag", "dr-" + niveau];
  if(vertrek) klassen.push("is-vertrek");
  if(retour) klassen.push("is-retour");
  if(vandaag) klassen.push("is-vandaag");
  if(gekozen) klassen.push("is-gekozen");

  var label = kalDagLabel(iso) + ": " + niveauLabel(niveau) +
    (vertrek ? ", " + i18n("kalender.vertrekdag") : "") +
    (retour ? ", " + i18n("kalender.retourdag") : "") +
    (vandaag ? ", " + i18n("kalender.vandaag") : "");

  return '<button type="button" class="' + klassen.join(" ") + '" data-kal-dag="' + iso + '"' +
    ' aria-pressed="' + (gekozen ? "true" : "false") + '" aria-label="' + esc(label) + '"' +
    (gekozen ? "" : ' tabindex="-1"') + ">" +
    '<span class="kaldag-nr">' + Number(iso.slice(8)) + "</span>" +
    '<span class="kaldag-teken" aria-hidden="true">' + DRUKTE_TEKEN[niveau] + "</span>" +
  "</button>";
}

function kalNiveauChipHTML(niveau){
  return '<span class="kalniveau dr-' + esc(niveau) + '">' +
    '<span class="teken" aria-hidden="true">' + DRUKTE_TEKEN[niveau] + "</span>" +
    esc(niveauLabel(niveau)) + "</span>";
}

/* De gekozen dag: datum, niveau, de tekst uit de data en waar hij vandaan komt. */
function kalDagkaartHTML(){
  var iso = kalGekozenDag();
  var info = drukteVoor(iso, KAL_RICHTING);
  var niveau = info ? info.niveau : "rustig";
  var vertrek = TRIP && TRIP.departureDate === iso;
  var retour = TRIP && TRIP.returnDate === iso;

  var herkomst;
  if(!info) herkomst = i18n("kalender.geenPrognose");
  else if(info.hard) herkomst = i18n("kalender.prognose");
  else herkomst = i18n("kalender.afgeleid");

  var beideRichtingen = info && info.hard && info.terug && info.terug !== info.heen
    ? '<p class="hint">' + esc(i18n("kalender.heen")) + ": " + esc(niveauLabel(info.heen)) + " · " +
      esc(i18n("kalender.terug")) + ": " + esc(niveauLabel(info.terug)) + "</p>"
    : "";

  return '<section class="dashkaart kaldagkaart" aria-live="polite">' +
    '<p class="eyebrow">' + esc(kalDagLabel(iso)) +
      (vertrek ? " · " + esc(i18n("kalender.vertrekdag")) : "") +
      (retour ? " · " + esc(i18n("kalender.retourdag")) : "") + "</p>" +
    "<h2>" + kalNiveauChipHTML(niveau) + "</h2>" +
    (info && info.tekst ? "<p>" + esc(info.tekst) + "</p>" : "") +
    beideRichtingen +
    '<p class="hint kalherkomst">' + esc(herkomst) +
      (info && info.bron
        ? ' <a href="' + esc(info.bron) + '" target="_blank" rel="noopener">' + esc(i18n("kalender.bron")) +
          ' <span aria-hidden="true">&rarr;</span></a>'
        : "") + "</p>" +
  "</section>";
}

function kalLegendaHTML(){
  return '<ul class="kallegenda" aria-label="' + esc(i18n("kalender.legenda")) + '">' +
    DRUKTE_NIVEAUS.map(function(k){
      return "<li>" + '<span class="kalvlak dr-' + k + '" aria-hidden="true">' + DRUKTE_TEKEN[k] + "</span>" +
        esc(niveauLabel(k)) + "</li>";
    }).join("") +
    (TRIP && TRIP.departureDate
      ? '<li><span class="kalvlak ring-vertrek" aria-hidden="true"></span>' + esc(i18n("kalender.vertrekdag")) + "</li>"
      : "") +
    (TRIP && TRIP.returnDate
      ? '<li><span class="kalvlak ring-retour" aria-hidden="true"></span>' + esc(i18n("kalender.retourdag")) + "</li>"
      : "") +
  "</ul>";
}

function kalBronnenHTML(){
  var m = (DRUKTE && DRUKTE.meta) || {};
  var bronnen = m.sources || [];
  return '<section class="kalbronnen">' +
    (m.disclaimer ? '<p class="hint">' + esc(m.disclaimer) + "</p>" : "") +
    (m.lastVerified ? '<p class="hint">' + esc(i18n("kalender.gecontroleerd", { datum: fmtDate(m.lastVerified) })) + "</p>" : "") +
    (bronnen.length
      ? '<h3 class="eyebrow">' + esc(i18n("kalender.bronnen")) + "</h3>" +
        '<ul class="bronnenlijst">' + bronnen.map(function(b){
          return '<li><a href="' + esc(b.url) + '" target="_blank" rel="noopener">' + esc(b.label) +
            ' <span aria-hidden="true">&rarr;</span></a></li>';
        }).join("") + "</ul>"
      : "") +
  "</section>";
}

function renderKalender(){
  var wrap = document.getElementById("kalender-wrap");
  if(!wrap) return;

  var kop = '<section class="kalkop"><h1>' + kopHTML("kalender.kop") + "</h1>" +
    '<p class="lead">' + esc(i18n("kalender.intro", { richting: kalRichting(TRIP) })) + "</p></section>";

  if(!DRUKTE){
    wrap.innerHTML = kop + '<p class="hint">' + esc(i18n("kalender.geenData")) + "</p>";
    return;
  }

  var m = kalMaand(), p = m.split("-");
  var maandnaam = maanden()[Number(p[1]) - 1] + " " + p[0];
  var weekdagen = i18n("kalender.weekdagen").split(",");

  wrap.innerHTML = kop +
    '<div class="kalbalk">' +
      '<div class="kalnav">' +
        '<button type="button" data-kal-maand="-1" aria-label="' + esc(i18n("kalender.vorigeMaand")) + '">&lsaquo;</button>' +
        '<h2 class="kalmaand" aria-live="polite">' + esc(maandnaam) + "</h2>" +
        '<button type="button" data-kal-maand="1" aria-label="' + esc(i18n("kalender.volgendeMaand")) + '">&rsaquo;</button>' +
      "</div>" +
      '<div class="kalrichting" role="group" aria-label="' + esc(i18n("kalender.richting")) + '">' +
        ["heen", "terug"].map(function(r){
          return '<button type="button" class="kalseg' + (KAL_RICHTING === r ? " active" : "") +
            '" data-kal-richting="' + r + '" aria-pressed="' + (KAL_RICHTING === r ? "true" : "false") + '">' +
            esc(i18n("kalender." + r)) + "</button>";
        }).join("") +
      "</div>" +
    "</div>" +
    '<div class="kalweek" aria-hidden="true">' + weekdagen.map(function(w){ return "<span>" + esc(w) + "</span>"; }).join("") + "</div>" +
    '<div class="kalgrid" role="grid" aria-label="' + esc(maandnaam) + '">' +
      kalDagenVan(m).map(kalDagHTML).join("") +
    "</div>" +
    kalLegendaHTML() +
    kalDagkaartHTML() +
    kalBronnenHTML();
}

/* Pijltjestoetsen door het raster: links/rechts een dag, boven/onder een week.
   Eén dag is tabbable (de gekozen), de rest bereik je met de pijlen. */
function kalenderToets(e){
  var knop = e.target.closest("[data-kal-dag]");
  if(!knop) return;
  var stap = { ArrowLeft:-1, ArrowRight:1, ArrowUp:-7, ArrowDown:7 }[e.key];
  if(!stap) return;
  e.preventDefault();
  var dagen = [].slice.call(document.querySelectorAll("#kalender-wrap [data-kal-dag]"));
  var i = dagen.indexOf(knop) + stap;
  if(i < 0 || i >= dagen.length){
    kalenderMaand(stap < 0 ? -1 : 1);
    var nieuw = document.querySelectorAll("#kalender-wrap [data-kal-dag]");
    var doel = stap < 0 ? nieuw[nieuw.length - 1] : nieuw[0];
    if(doel){ KAL_DAG = doel.getAttribute("data-kal-dag"); renderKalender(); kalenderFocus(); }
    return;
  }
  KAL_DAG = dagen[i].getAttribute("data-kal-dag");
  renderKalender();
  kalenderFocus();
}

function kalenderFocus(){
  var el = document.querySelector('#kalender-wrap [data-kal-dag="' + kalGekozenDag() + '"]');
  if(el) el.focus();
}

/* Het cijfer op het dashboard: de drukte op je vertrekdag, in één woord. */
function kalVertrekdagTekst(trip){
  if(!DRUKTE) return null;
  if(!trip || !trip.departureDate) return esc(i18n("kalender.geenDatum"));
  var info = drukteVoor(trip.departureDate, "heen");
  return esc(niveauLabel(info ? info.niveau : "rustig"));
}
