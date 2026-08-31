"use strict";
/* Routeplanner: de plaatsvelden, de berekening en het routepaneel.

   Deze laag kent de provider niet — hij vraagt js/routeProvider.js om een route
   en rekent verder op coördinaten. De wizard (§5) gebruikt dezelfde velden en
   dezelfde berekening; er is één implementatie, twee ingangen. */

/* Zoekt in de meegeleverde stedenlijst. Rij = [naam, alias, landcode, lat, lon].
   Nederlandse naam en lokale naam tellen allebei mee, accentongevoelig. */
function searchCities(q){
  if(!CITIES || !q) return [];
  var f = fold(q), starts = [], contains = [];
  for(var i = 0; i < CITIES.length; i++){
    var c = CITIES[i];
    var n = fold(c[0]), a = fold(c[1]);
    if(n.indexOf(f) === 0 || (a && a.indexOf(f) === 0)) starts.push(c);
    else if(n.indexOf(f) !== -1 || (a && a.indexOf(f) !== -1)) contains.push(c);
    if(starts.length >= 7) break;
  }
  return starts.concat(contains).slice(0, 7);
}

/* ================= statusregel ================= */

/* De statusregel onthoudt zijn sleutel in plaats van alleen zijn tekst, zodat
   hij meeverandert als je halverwege van taal wisselt. Een melding die in de
   oude taal blijft staan naast een vertaalde pagina ziet er kapot uit. */
var STATUS_LAATST = null;

function plannerStatus(sleutel, isErr, params, metDienst){
  STATUS_LAATST = sleutel ? { sleutel:sleutel, isErr:isErr, params:params,
                              metDienst:metDienst } : null;
  toonPlannerStatus();
}

function toonPlannerStatus(){
  var el = document.getElementById("route-status");
  if(!el) return;
  if(!STATUS_LAATST){ el.textContent = ""; el.className = "rstat"; return; }
  /* De dienstnotitie pas hier ophalen, niet bij het zetten: ook die is
     vertaald, en anders blijft hij in de oude taal staan. */
  el.textContent = i18n(STATUS_LAATST.sleutel, STATUS_LAATST.params) +
    (STATUS_LAATST.metDienst ? RouteProvider.notitie() : "");
  el.className = "rstat" + (STATUS_LAATST.isErr ? " err" : "");
}

/* ================= plaatsvelden met autocomplete ================= */

function cityRowHTML(c, idx){
  var geo = BORDERS && BORDERS[c[2]];
  var landNaam = (BY_CODE[c[2]] && BY_CODE[c[2]].name) || (geo && geo.n) || c[2];
  var flag = BY_CODE[c[2]] ? flagHTML(BY_CODE[c[2]]) : "";
  var extra = c[1] && fold(c[1]) !== fold(c[0]) ? " · " + esc(c[1].split(",")[0]) : "";
  return '<li role="option" data-idx="' + idx + '">' + flag +
    "<span>" + esc(c[0]) + '<span class="cnt">' + extra + "</span></span>" +
    '<span class="cnt" style="margin-left:auto">' + esc(landNaam) + "</span></li>";
}

/* Houdt de suggestielijst van één veld bij. `hits` blijft lokaal zodat de
   online-resultaten niet met de offline lijst door elkaar lopen. onPick krijgt
   een Plaats (of null zodra er weer getypt wordt), niet de rij: de trip bewaart
   Plaatsen, en die conversie hoort op één plek te staan. */
function wireCityField(inputId, listId, onPick){
  var input = document.getElementById(inputId);
  var list = document.getElementById(listId);
  if(!input || !list) return null;
  var hits = [];

  function close(){ list.innerHTML = ""; hits = []; }

  function show(rows, onlineLabel){
    hits = rows;
    var html = rows.map(function(c, i){ return cityRowHTML(c, i); }).join("");
    if(onlineLabel) html += '<li data-online="1"><span class="onlinehit">' + esc(onlineLabel) + "</span></li>";
    list.innerHTML = html;
  }

  input.addEventListener("input", function(){
    onPick(null);
    var q = input.value.trim();
    if(q.length < 2){ close(); return; }
    var rows = searchCities(q);
    show(rows, rows.length ? null : i18n("planner.nietGevonden", { q:q }));
  });

  input.addEventListener("keydown", function(e){
    if(e.key !== "Enter") return;
    e.preventDefault();
    var first = list.querySelector("li[data-idx]");
    if(first) first.click();
    else {
      var ol = list.querySelector("li[data-online]");
      if(ol) ol.click();
    }
  });

  list.addEventListener("click", function(e){
    var li = e.target.closest("li");
    if(!li) return;

    if(li.hasAttribute("data-online")){
      var q = input.value.trim();
      li.innerHTML = '<span class="cnt">' + esc(i18n("planner.zoeken")) + '</span>';
      RouteProvider.geocode(q).then(function(plaatsen){
        var rows = plaatsen.map(rijUitPlaats);
        if(!rows.length){ show([], i18n("planner.nietsGevonden", { q:q })); return; }
        show(rows, null);
      }).catch(function(){
        show([], i18n("planner.zoekenMislukt"));
      });
      return;
    }

    var c = hits[Number(li.getAttribute("data-idx"))];
    if(!c) return;
    input.value = c[0];
    onPick(plaatsUitRij(c));
    close();
  });

  input.addEventListener("blur", function(){ setTimeout(close, 180); });
  return input;
}

/* ================= de berekening =================

   Eén implementatie voor de kaartpagina en voor stap 4 van de wizard. `stap`
   is een terugmeldfunctie: de wizard toont er zijn voortgangslijst mee
   (ROUTE ANALYSEREN ✓ / LANDEN CONTROLEREN ✓ / ...), de kaartpagina negeert
   hem. Zo hoeft de wizard niets van de routelogica te weten en de routelogica
   niets van de wizard. */
var ROUTING = false;

function berekenRoute(trip, stap){
  stap = stap || function(){};
  if(!trip.origin || !trip.destination){
    return Promise.reject(new Error(i18n("planner.kiesEerst")));
  }

  stap("route", "bezig");
  return laadGeoData().then(function(){
    return RouteProvider.getRoute(
      { lat: trip.origin.lat, lon: trip.origin.lon },
      { lat: trip.destination.lat, lon: trip.destination.lon }
    );
  }).then(function(route){
    stap("route", "klaar");

    stap("landen", "bezig");
    var coords = route.coordinates;
    var res = analyseRoute(coords);
    var landen = res.order.filter(function(c){ return BY_CODE[c]; });
    if(!landen.length){
      var leeg = new Error(i18n("planner.geenLanden"));
      leeg.geenLanden = true;
      throw leeg;
    }

    trip.route = { coordinates:coords, meters:route.meters || null,
                   seconds:route.seconds || null, provider:route.provider || null,
                   analyse:res };
    trip.countries = landen;
    trip.metadata.handmatig = false;
    trip.metadata.geanalyseerd = true;
    stap("landen", "klaar", landen.length);

    /* De volgende drie stappen zijn lokaal en snel; ze staan apart omdat de
       gebruiker moet kunnen zien wát er gecontroleerd is. Niet omdat het lang
       duurt — de eerlijkheid van de lijst zit in wat er staat, niet in de
       wachttijd. */
    stap("zones", "bezig");
    herbereken(trip);
    stap("zones", "klaar", tripZones(trip).length);

    stap("tol", "bezig");
    stap("tol", "klaar", tripTolPunten(trip).length);

    stap("voertuig", "bezig");
    var tel = checklistTelling(trip);
    stap("voertuig", "klaar", tel.blockers);

    bewaarTrip();
    return trip;
  });
}

/* De kaartpagina houdt zijn eigen knop en statusregel; de wizard heeft zijn
   eigen weergave. */
function doRoute(){
  if(ROUTING || !TRIP) return;
  if(!TRIP.origin || !TRIP.destination){
    plannerStatus("planner.kiesEerst", true);
    return;
  }
  ROUTING = true;
  var knop = document.getElementById("btn-route");
  if(knop) knop.disabled = true;
  plannerStatus("planner.bezig");

  berekenRoute(TRIP).then(function(){
    HANDMATIG_ZICHTBAAR = false;
    render();
    plannerStatus("planner.klaar", false, null, true);
  }).catch(function(err){
    /* §20: een fout is geen doodlopende weg. Kon geen enkele dienst een route
       leveren (err.handmatig), dan is de planner uitgevallen, niet de app — de
       checklist werkt net zo goed op een zelf gekozen landenlijst. Bij een
       gewone fout (plaatsnaam, geen bekende landen) helpt zelf kiezen niet, dus
       dan blijft het bij de melding. */
    if(err && err.handmatig){
      plannerStatus("planner.geenDienst", true);
      HANDMATIG_ZICHTBAAR = true;
      renderHandmatigeKeuze();
    } else {
      plannerStatus("planner.fout", true, { reden:String(err && err.message || err) });
    }
  }).then(function(){
    ROUTING = false;
    if(knop) knop.disabled = false;
  });
}

/* ---------------- handmatige landenkeuze (§20) ----------------
   De bestaande routebouwer: landen kiezen uit een lijst, zonder berekening.
   Wat je zonder route mist — afstand, reistijd, kilometertol, kaartschets —
   staat er met zoveel woorden bij, want een getal verzinnen is erger dan het
   weglaten. Twee ingangen: de knop "handmatig doorgaan" in de wizard en de
   terugval hier op de kaartpagina. */
var HANDMATIG_ZICHTBAAR = false;

function handmatigeKeuzeHTML(trip){
  var opties = DATA.countries.map(function(c){
    return '<option value="' + esc(c.code) + '">' + esc(c.name) + "</option>";
  }).join("");

  var chips = tripLanden(trip).map(function(code, i){
    var c = BY_CODE[code];
    return '<span class="hmchip">' + flagHTML(c) + esc(c.name) +
      '<button type="button" data-hm-weg="' + i + '" aria-label="' +
      esc(i18n("handmatig.verwijderen", { land:c.name })) + '">&times;</button></span>';
  }).join("");

  return "<h3>" + esc(i18n("handmatig.kop")) + "</h3>" +
    "<p>" + esc(i18n("handmatig.uitleg")) + "</p>" +
    '<div class="hmrij">' +
      '<select id="hm-land" aria-label="' + esc(i18n("handmatig.landToevoegen")) + '">' + opties + "</select>" +
      '<button type="button" class="btn" id="hm-toevoegen">' + iconUse("add") + " " +
        esc(i18n("handmatig.toevoegen")) + "</button>" +
    "</div>" +
    (chips ? '<div class="hmchips">' + chips + "</div>"
           : '<p class="hint">' + esc(i18n("handmatig.geenLanden")) + "</p>");
}

function renderHandmatigeKeuze(){
  var el = document.getElementById("handmatig");
  if(!el) return;
  if(!HANDMATIG_ZICHTBAAR || !DATA || !TRIP){ el.hidden = true; el.innerHTML = ""; return; }
  el.hidden = false;
  el.innerHTML = handmatigeKeuzeHTML(TRIP);
}

/* ---------------- kaartpagina: samenvatting naast de schets ---------------- */
function renderDashboardStats(){
  var el = document.getElementById("stat-cards");
  if(!el || !TRIP) return;
  var res = tripAnalyse(TRIP);
  if(!res){ el.hidden = true; el.innerHTML = ""; return; }
  el.hidden = false;

  var afstand = getal(Math.round(res.total));
  var duur = fmtDuur(tripDuur(TRIP));
  var kostenWaarde = kostenTotaalHTML(kostenOverzicht(TRIP)) ||
                     esc(i18n("kosten.nietTeBepalen"));

  el.innerHTML =
    '<div class="statcard"><span class="slbl">' + iconUse("ruler") + esc(i18n("planner.afstand")) + '</span>' +
      '<span class="sval">' + afstand + ' <small>' + esc(i18n("planner.km")) + '</small></span></div>' +
    '<div class="statcard"><span class="slbl">' + iconUse("clock") + esc(i18n("planner.reistijd")) + '</span>' +
      '<span class="sval">' + (duur || "—") + '</span></div>' +
    '<div class="statcard wide"><span class="slbl">' + iconUse("payments") + esc(i18n("planner.geschatteKosten")) + '</span>' +
      '<span class="sval">' + kostenWaarde + '</span></div>';
}

function renderLandenLijst(){
  var wrap = document.getElementById("landenblok");
  var box = document.getElementById("landenlijst");
  if(!wrap || !box || !TRIP) return;
  var landen = tripLanden(TRIP);
  if(!landen.length){ wrap.hidden = true; box.innerHTML = ""; return; }
  wrap.hidden = false;
  box.innerHTML = landen.map(function(code){
    var c = BY_CODE[code];
    return '<div class="landrow" data-land="' + esc(code) + '" role="button" tabindex="0">' + flagHTML(c) +
      '<span class="landnaam">' + esc(c.name) + '</span>' +
      iconUse("chevron-right") + '</div>';
  }).join("");
}

function renderMilieuzones(){
  var el = document.getElementById("milieukaart");
  if(!el || !TRIP) return;
  var zones = tripZones(TRIP);
  if(!zones.length){ el.hidden = true; el.innerHTML = ""; return; }
  el.hidden = false;
  var namen = zones.slice(0, 8).map(function(o){ return esc(o.zone.city); });
  el.innerHTML =
    '<div class="milieuhead">' + iconUse("eco") +
      "<div><h2 class=\"paneelkop\">" + esc(i18n("planner.milieuzones")) + "</h2>" +
      "<p>" + esc(i18n("planner.milieuzonesUitleg")) + "</p></div></div>" +
    '<div class="milieuchips">' + namen.map(function(n){ return '<span class="mchip">' + n + "</span>"; }).join("") + "</div>";
}
