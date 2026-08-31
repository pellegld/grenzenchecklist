"use strict";
/* De reiswizard — §5 van de masterprompt.

   Vier stappen: waar, wanneer, welke auto, en de analyse. Elke stap schrijft
   rechtstreeks in TRIP; er is geen aparte formulierstaat die daarna
   overgeschreven moet worden. Wie halverwege wegklikt en terugkomt, staat weer
   op dezelfde stap — die staat in trip.metadata.stap.

   De autocomplete komt uit cities.json via wireCityField() (dezelfde functie
   als op de kaartpagina), en de route loopt via js/routeProvider.js. Deze
   pagina kent geen enkele routedienst bij naam; dat is precies de scheiding
   die §18A vraagt.

   De wizard bouwt alleen zichzelf opnieuw op als hij zichtbaar is en de stap
   verandert. Bij elke render() opnieuw tekenen zou de invoervelden onder je
   vingers vandaan halen. */

var WIZ_STAPPEN = ["waar", "wanneer", "auto", "analyse"];
var WIZ_GETEKEND = null;    /* "<tripId>:<stap>" van wat er nu staat */
var WIZ_ANALYSE = null;     /* voortgang van stap 4, zie analyseRegels() */
var WIZ_FOUT = null;        /* { sleutel, handmatig } */

function wizStap(){
  var n = (TRIP && TRIP.metadata.stap) || 1;
  return Math.min(4, Math.max(1, n));
}

function wizardGa(stap){
  if(!TRIP) return;
  TRIP.metadata.stap = Math.min(4, Math.max(1, stap));
  bewaarTrips();
  renderWizard(true);
  var top = document.getElementById("view-wizard");
  if(top) top.scrollTop = 0;
  window.scrollTo(0, 0);
}

/* Mag je door vanaf deze stap? Stap 1 is de enige die iets afdwingt: zonder
   plaatsen valt er niets te berekenen. Datum en auto hebben werkbare
   standaardwaarden, en die tegenhouden zou alleen maar in de weg zitten. */
function wizKlaarVoorVolgende(stap){
  if(stap === 1) return !!(TRIP && TRIP.origin && TRIP.destination);
  return true;
}

/* ---------------- de stappenbalk ---------------- */
function wizardBalkHTML(nu){
  return '<ol class="wizbalk" aria-label="' + esc(i18n("wizard.stappen")) + '">' +
    WIZ_STAPPEN.map(function(naam, i){
      var n = i + 1;
      var staat = n < nu ? "af" : (n === nu ? "nu" : "later");
      return '<li class="' + staat + '"' + (n === nu ? ' aria-current="step"' : "") + '>' +
        '<span class="bol">' + (n < nu ? iconUse("check") : n) + "</span>" +
        "<span class=\"lbl\">" + esc(i18n("wizard.stap." + naam)) + "</span></li>";
    }).join("") + "</ol>";
}

function wizardKnoppenHTML(nu, volgendeLabel){
  return '<div class="wizknoppen">' +
    (nu > 1 ? '<button type="button" class="btn" data-wiz-terug="' + (nu - 1) + '">' +
        esc(i18n("wizard.terug")) + "</button>" : "<span></span>") +
    (volgendeLabel
      ? '<button type="button" class="btn primary" data-wiz-verder="' + (nu + 1) + '"' +
        (wizKlaarVoorVolgende(nu) ? "" : " disabled") + ">" + esc(volgendeLabel) + " " +
        iconUse("arrow-right") + "</button>"
      : "") +
    "</div>";
}

/* ---------------- stap 1: waar ---------------- */
function wizWaarHTML(){
  return (
    "<h1>" + esc(i18n("wizard.waar.kop")) + "</h1>" +
    '<p class="lead">' + esc(i18n("wizard.waar.uitleg")) + "</p>" +
    '<div class="wizveld"><div class="field">' +
      '<label for="wiz-from">' + iconUse("pin-start") + esc(i18n("planner.van")) + "</label>" +
      '<input type="search" id="wiz-from" autocomplete="off" autocapitalize="off" spellcheck="false"' +
        ' placeholder="' + esc(i18n("planner.vertrekplaats")) + '" value="' +
        esc(TRIP.origin ? TRIP.origin.naam : "") + '">' +
      '<ul class="results" id="wiz-from-res" role="listbox"></ul>' +
    "</div>" +
    '<div class="field">' +
      '<label for="wiz-to">' + iconUse("pin-end") + esc(i18n("planner.naar")) + "</label>" +
      '<input type="search" id="wiz-to" autocomplete="off" autocapitalize="off" spellcheck="false"' +
        ' placeholder="' + esc(i18n("planner.bestemming")) + '" value="' +
        esc(TRIP.destination ? TRIP.destination.naam : "") + '">' +
      '<ul class="results" id="wiz-to-res" role="listbox"></ul>' +
    "</div></div>" +
    '<p class="hint" id="wiz-waar-hint">' + esc(i18n("wizard.waar.hint")) + "</p>"
  );
}

/* ---------------- stap 2: wanneer ---------------- */
function wizWanneerHTML(){
  return (
    "<h1>" + esc(i18n("wizard.wanneer.kop")) + "</h1>" +
    '<p class="lead">' + esc(i18n("wizard.wanneer.uitleg")) + "</p>" +
    '<div class="wizveld row2">' +
      '<div class="field"><label for="wiz-depart">' + esc(i18n("profiel.vertrekdatum")) + "</label>" +
        '<input type="date" id="wiz-depart" value="' + esc(TRIP.departureDate || "") + '"></div>' +
      '<div class="field"><label for="wiz-return">' + esc(i18n("wizard.retourdatum")) + "</label>" +
        '<input type="date" id="wiz-return" value="' + esc(TRIP.returnDate || "") + '"></div>' +
    "</div>" +
    '<p class="hint">' + esc(i18n("wizard.wanneer.hint")) + "</p>"
  );
}

/* ---------------- stap 3: auto ---------------- */
function keuzeVeld(id, label, opties, waarde, hint){
  return '<div class="field"><label for="' + id + '">' + esc(label) + "</label>" +
    '<select id="' + id + '">' + opties.map(function(o){
      return '<option value="' + esc(o[0]) + '"' + (String(o[0]) === String(waarde) ? " selected" : "") +
        ">" + esc(o[1]) + "</option>";
    }).join("") + "</select>" +
    (hint ? '<p class="veldhint">' + esc(hint) + "</p>" : "") + "</div>";
}

function wizAutoHTML(){
  var veh = TRIP.vehicle;
  var landen = DATA.countries.map(function(c){ return [c.code, c.name]; });
  var brandstof = [["petrol", i18n("profiel.benzine")], ["diesel", i18n("profiel.diesel")],
                   ["hybride", i18n("profiel.hybride")], ["ev", i18n("profiel.ev")]];
  var euro = [["", i18n("profiel.weetIkNiet")], ["6", i18n("profiel.euro6")], ["5", i18n("profiel.euro5")],
              ["4", i18n("profiel.euro4")], ["3", i18n("profiel.euro3")], ["2", i18n("profiel.euro2")],
              ["1", i18n("profiel.euro1")]];
  var typen = [["auto", i18n("profiel.auto")], ["caravan", i18n("profiel.caravan")],
               ["aanhanger", i18n("profiel.aanhanger")], ["camper", i18n("profiel.camper")]];

  return (
    "<h1>" + esc(i18n("wizard.auto.kop")) + "</h1>" +
    '<p class="lead">' + esc(i18n("wizard.auto.uitleg")) + "</p>" +
    '<div class="wizveld raster">' +
      keuzeVeld("wiz-home", i18n("profiel.kentekenUit"), landen, veh.plateCountry,
                i18n("wizard.auto.kentekenHint")) +
      keuzeVeld("wiz-fuel", i18n("profiel.brandstof"), brandstof, veh.fuel,
                i18n("wizard.auto.brandstofHint")) +
      keuzeVeld("wiz-euro", i18n("profiel.euronorm"), euro, veh.euro === null ? "" : veh.euro,
                i18n("wizard.auto.euroHint")) +
      keuzeVeld("wiz-vtype", i18n("profiel.voertuig"), typen, veh.type, "") +
    "</div>" +
    '<details class="wizoptioneel"><summary>' + esc(i18n("wizard.auto.optioneel")) + "</summary>" +
      '<div class="row2">' +
        '<div class="field"><label for="wiz-gewicht">' + esc(i18n("wizard.auto.gewicht")) + "</label>" +
          '<input type="number" id="wiz-gewicht" min="0" step="50" inputmode="numeric" value="' +
            esc(TRIP.vehicle.gewichtKg == null ? "" : TRIP.vehicle.gewichtKg) + '"></div>' +
        '<div class="field"><label for="wiz-hoogte">' + esc(i18n("wizard.auto.hoogte")) + "</label>" +
          '<input type="number" id="wiz-hoogte" min="0" step="0.05" inputmode="decimal" value="' +
            esc(TRIP.vehicle.hoogteM == null ? "" : TRIP.vehicle.hoogteM) + '"></div>' +
      "</div>" +
      '<p class="hint">' + esc(i18n("wizard.auto.optioneelHint")) + "</p>" +
    "</details>"
  );
}

/* ---------------- stap 4: analyse ----------------

   De voortgangslijst is geen laadbalkje maar een verantwoording: hij zegt wát
   er gecontroleerd is. Daarom blijft hij ook staan als het klaar is. */
var ANALYSE_ONDERDELEN = ["route", "landen", "zones", "tol", "voertuig"];

function analyseRegels(){
  return '<ul class="analyselijst">' + ANALYSE_ONDERDELEN.map(function(k){
    var st = (WIZ_ANALYSE && WIZ_ANALYSE[k]) || {};
    var staat = st.staat || "wacht";
    var teken = staat === "klaar" ? iconUse("check")
              : staat === "bezig" ? '<span class="spin" aria-hidden="true"></span>'
              : staat === "fout"  ? iconUse("warning")
              : '<span class="bol" aria-hidden="true"></span>';
    return '<li class="' + staat + '">' + teken +
      "<span>" + esc(i18n("wizard.analyse." + k)) + "</span>" +
      (st.uitkomst ? '<span class="uitkomst">' + esc(st.uitkomst) + "</span>" : "") +
      '<span class="sr">' + esc(i18n("wizard.staat." + staat)) + "</span></li>";
  }).join("") + "</ul>";
}

function wizAnalyseHTML(){
  var bezig = WIZ_ANALYSE && WIZ_ANALYSE.bezig;
  var klaar = TRIP.metadata.geanalyseerd && !bezig && !WIZ_FOUT;

  var kop = "<h1>" + esc(i18n(klaar ? "wizard.analyse.klaarKop" : "wizard.analyse.kop")) + "</h1>";
  var samenvatting =
    '<div class="wizsamenvatting">' +
      "<p><b>" + esc((TRIP.origin ? TRIP.origin.naam : "—") + " → " +
                     (TRIP.destination ? TRIP.destination.naam : "—")) + "</b></p>" +
      "<p>" + esc(reisPeriodeTekst(TRIP)) + "</p>" +
      "<p>" + esc(voertuigSamenvatting(TRIP)) + "</p>" +
    "</div>";

  var body;
  if(!WIZ_ANALYSE && !TRIP.metadata.geanalyseerd){
    body = '<button type="button" class="btn primary groot" id="btn-analyse">' +
      esc(i18n("wizard.analyse.start")) + " " + iconUse("arrow-right") + "</button>";
  } else {
    body = analyseRegels() +
      (klaar
        ? '<div class="wizklaar"><p class="klaarzin">' + esc(i18n("wizard.analyse.klaarZin")) + "</p>" +
          '<button type="button" class="btn primary groot" data-view="dashboard">' +
            esc(i18n("wizard.analyse.naarReis")) + " " + iconUse("arrow-right") + "</button></div>"
        : "") +
      (bezig ? "" : '<button type="button" class="btn" id="btn-analyse">' +
          esc(i18n("wizard.analyse.opnieuw")) + "</button>");
  }

  var fout = WIZ_FOUT
    ? '<div class="wizfout" role="alert">' + iconUse("warning") +
      "<div><h3>" + esc(i18n(WIZ_FOUT.kop)) + "</h3>" +
      "<p>" + esc(i18n(WIZ_FOUT.tekst, WIZ_FOUT.params)) + "</p>" +
      '<div class="foutknoppen">' +
        '<button type="button" class="btn" id="btn-analyse">' + esc(i18n("wizard.fout.opnieuw")) + "</button>" +
        (WIZ_FOUT.handmatig
          ? '<button type="button" class="btn primary" id="btn-handmatig">' +
            esc(i18n("wizard.fout.handmatig")) + "</button>"
          : "") +
      "</div></div></div>"
    : "";

  return kop + samenvatting + body + fout +
    '<div class="handmatig" id="wiz-handmatig" hidden></div>';
}

/* ---------------- de analyse zelf ---------------- */
function startAnalyse(){
  if(!TRIP || ROUTING) return;
  WIZ_FOUT = null;
  WIZ_ANALYSE = { bezig:true };
  ROUTING = true;
  renderWizard(true);

  function stap(k, staat, aantal){
    /* i18nAantal en niet i18n: "1 blokkades" hoort niet in een app die de rest
       van de zin wél nakijkt. */
    WIZ_ANALYSE[k] = { staat:staat, uitkomst: (staat === "klaar" && aantal !== undefined)
      ? i18nAantal("wizard.uitkomst." + k, aantal) : "" };
    tekenAnalyse();
  }

  berekenRoute(TRIP, stap).then(function(){
    WIZ_ANALYSE.bezig = false;
    TRIP.metadata.stap = 4;
    bewaarTrips();
    renderWizard(true);
  }).catch(function(err){
    WIZ_ANALYSE.bezig = false;
    ANALYSE_ONDERDELEN.forEach(function(k){
      if(!WIZ_ANALYSE[k] || WIZ_ANALYSE[k].staat === "bezig") WIZ_ANALYSE[k] = { staat:"fout" };
    });
    /* §20: nooit een kale foutcode. Drie soorten, drie uitwegen.

       - geen enkele routedienst deed het: dan is de planner uitgevallen, niet
         de app. Handmatig landen kiezen levert dezelfde checklist op.
       - wel een route, maar geen bekend land erop: handmatig kiezen helpt hier
         juist wél, want de app kent maar zestien landen.
       - iets anders (plaatsnaam, verbinding): opnieuw proberen. */
    if(err && err.handmatig){
      WIZ_FOUT = { kop:"wizard.fout.dienstKop", tekst:"wizard.fout.dienstTekst", handmatig:true };
    } else if(err && err.geenLanden){
      WIZ_FOUT = { kop:"wizard.fout.landenKop", tekst:"wizard.fout.landenTekst", handmatig:true };
    } else {
      WIZ_FOUT = { kop:"wizard.fout.algemeenKop", tekst:"wizard.fout.algemeenTekst",
                   params:{ reden:String(err && err.message || err) }, handmatig:true };
    }
    renderWizard(true);
  }).then(function(){ ROUTING = false; });
}

/* Alleen de voortgangslijst opnieuw tekenen tijdens het rekenen: de rest van de
   pagina staat er al en opnieuw opbouwen zou de knoppen laten knipperen. */
function tekenAnalyse(){
  var el = document.querySelector("#wizard-wrap .analyselijst");
  if(el) el.outerHTML = analyseRegels();
}

/* ---------------- handmatig doorgaan (§20) ---------------- */
function toonHandmatigInWizard(){
  var el = document.getElementById("wiz-handmatig");
  if(!el || !TRIP) return;
  el.hidden = false;
  el.innerHTML = handmatigeKeuzeHTML(TRIP) +
    (tripLanden(TRIP).length
      ? '<button type="button" class="btn primary wide" data-view="dashboard">' +
        esc(i18n("wizard.fout.naarReis")) + " " + iconUse("arrow-right") + "</button>"
      : "");
}

/* ---------------- render ---------------- */
function renderWizard(forceer){
  var wrap = document.getElementById("wizard-wrap");
  if(!wrap || !TRIP || !DATA) return;
  var stap = wizStap();
  var sleutel = TRIP.id + ":" + stap + ":" + TAAL;
  if(!forceer && WIZ_GETEKEND === sleutel) return;
  WIZ_GETEKEND = sleutel;

  var body = stap === 1 ? wizWaarHTML()
           : stap === 2 ? wizWanneerHTML()
           : stap === 3 ? wizAutoHTML()
           : wizAnalyseHTML();

  var volgende = stap === 1 ? i18n("wizard.verder.datum")
               : stap === 2 ? i18n("wizard.verder.auto")
               : stap === 3 ? i18n("wizard.verder.analyse")
               : null;

  wrap.innerHTML = wizardBalkHTML(stap) +
    '<div class="wizkaart">' + body + wizardKnoppenHTML(stap, volgende) + "</div>";

  if(stap === 1) wizardWaarWire();
  if(stap === 4 && WIZ_FOUT && tripLanden(TRIP).length) toonHandmatigInWizard();
}

function wizardWaarWire(){
  wireCityField("wiz-from", "wiz-from-res", function(p){
    TRIP.origin = p;
    if(p) bewaarTrip();
    wizardVerderKnop();
  });
  wireCityField("wiz-to", "wiz-to-res", function(p){
    TRIP.destination = p;
    if(p) bewaarTrip();
    wizardVerderKnop();
  });
  /* Zonder cities.json (file://) is er geen autocomplete. Dan is handmatig
     landen kiezen niet de terugval maar de gewone weg, en dat zeggen we hier
     in plaats van een veld aan te bieden dat niets doet. */
  var hint = document.getElementById("wiz-waar-hint");
  if(hint && !CITIES) hint.textContent = i18n("wizard.waar.geenSteden");
}

function wizardVerderKnop(){
  var knop = document.querySelector("#wizard-wrap [data-wiz-verder]");
  if(knop) knop.disabled = !wizKlaarVoorVolgende(wizStap());
}

/* Leesbare periode: "12–19 juli 2027", of alleen de vertrekdatum. */
function reisPeriodeTekst(trip){
  if(!trip.departureDate) return "";
  if(!trip.returnDate) return fmtDate(trip.departureDate);
  var v = trip.departureDate.split("-"), r = trip.returnDate.split("-");
  var maanden = i18n("alg.maanden").split(",");
  if(v[0] === r[0] && v[1] === r[1]){
    return i18n("alg.periodeZelfdeMaand", {
      van:Number(v[2]), tot:Number(r[2]), maand:maanden[Number(v[1]) - 1], jaar:v[0] });
  }
  return i18n("alg.periode", { van:fmtDate(trip.departureDate), tot:fmtDate(trip.returnDate) });
}
