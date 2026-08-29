"use strict";
/* Routeplanner: de van/naar-velden, de berekening en het routepaneel.

   Deze laag kent de provider niet — hij vraagt js/routeProvider.js om een route
   en rekent verder op coördinaten. */

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

/* ================= routeplanner: UI ================= */

function plannerStatus(msg, isErr){
  var el = document.getElementById("route-status");
  el.textContent = msg || "";
  el.className = "rstat" + (isErr ? " err" : "");
}

/* Welke dienst de route berekende, in gewone taal. Stil terugvallen op een
   demoserver is precies wat je in productie niet pas wil merken als het te laat
   is, dus staat het er gewoon bij. */
var DIENST_NAAM = {
  "osrm-demo":        "Berekend via de OSRM-demoserver — die is niet voor productie bedoeld.",
  "osrm-eigen":       "Berekend via je eigen OSRM-instantie.",
  "openrouteservice": "Berekend via OpenRouteService.",
  "graphhopper":      "Berekend via Graphhopper.",
  "proxy":            "Berekend via je eigen proxy."
};
function dienstNotitie(){
  if(!DIENST_IN_GEBRUIK) return "";
  return " " + (DIENST_NAAM[DIENST_IN_GEBRUIK] || "Berekend via " + DIENST_IN_GEBRUIK + ".");
}

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
   online-resultaten niet met de offline lijst door elkaar lopen. */
function wireCityField(inputId, listId, onPick){
  var input = document.getElementById(inputId);
  var list = document.getElementById(listId);
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
    show(rows, rows.length ? null : "Niet gevonden — online zoeken naar “" + q + "”");
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
      li.innerHTML = '<span class="cnt">Zoeken…</span>';
      searchOnline(q).then(function(rows){
        if(!rows.length){ show([], "Niets gevonden voor “" + q + "”"); return; }
        show(rows, null);
      }).catch(function(){
        show([], "Online zoeken lukte niet — controleer je verbinding");
      });
      return;
    }

    var c = hits[Number(li.getAttribute("data-idx"))];
    if(!c) return;
    input.value = c[0];
    onPick(c);
    close();
  });

  input.addEventListener("blur", function(){ setTimeout(close, 180); });
  return input;
}

function doRoute(){
  if(ROUTING) return;
  if(!FROM_CITY || !TO_CITY){
    plannerStatus("Kies eerst een vertrekplaats en een bestemming uit de lijst.", true);
    return;
  }
  ROUTING = true;
  document.getElementById("btn-route").disabled = true;
  plannerStatus("Route berekenen…");

  var need = Promise.all([
    BORDERS ? Promise.resolve(BORDERS) : loadJSON("borders.json").then(function(b){ BORDERS = b; return b; }),
    ZONES ? Promise.resolve(ZONES) : loadJSON("zones.json").then(function(z){ ZONES = z.zones || z; return ZONES; })
             .catch(function(){ ZONES = []; return ZONES; })
  ]);

  need.then(function(){
    return fetchRoute(FROM_CITY, TO_CITY);
  }).then(function(route){
    var res = analyseRoute(route.geometry.coordinates);
    var toAdd = res.order.filter(function(c){ return BY_CODE[c]; });
    if(!toAdd.length) throw new Error("geen bekende landen op deze route");

    ROUTE = toAdd;
    ROUTE_RES = res;
    ROUTE_ZONES = zonesLangsRoute(route.geometry.coordinates);
    ROUTE_TOLLS = tolPuntenLangsRoute(route.geometry.coordinates);
    ROUTE_COORDS = route.geometry.coordinates;
    ROUTE_DURATION = route.duration || null;
    saveRoute();
    render();
    plannerStatus("Klaar — de landen hieronder zijn ingevuld." + dienstNotitie());
  }).catch(function(err){
    var m = String(err && err.message || err);
    plannerStatus("Route bepalen lukte niet (" + m + "). Controleer de plaatsnamen en probeer het opnieuw.", true);
  }).then(function(){
    ROUTING = false;
    document.getElementById("btn-route").disabled = false;
  });
}

function renderDashboardStats(){
  var el = document.getElementById("stat-cards");
  var reisBtn = document.getElementById("btn-bekijk-reis");
  if(!ROUTE_RES){ el.hidden = true; el.innerHTML = ""; reisBtn.hidden = true; return; }
  el.hidden = false;
  reisBtn.hidden = false;

  var afstand = Math.round(ROUTE_RES.total).toLocaleString("nl-NL");
  var duur = fmtDuur(ROUTE_DURATION);
  var tol = tolTotaalRetour();
  var tolWaarde = tol
    ? '&euro;' + euroTekst(tol.bedrag) + (tol.zeker ? "" : ' <small>of meer</small>')
    : "—";

  el.innerHTML =
    '<div class="statcard"><span class="slbl">' + iconUse("ruler") + 'Afstand</span>' +
      '<span class="sval">' + afstand + ' <small>km</small></span></div>' +
    '<div class="statcard"><span class="slbl">' + iconUse("clock") + 'Reistijd</span>' +
      '<span class="sval">' + (duur || "—") + '</span></div>' +
    '<div class="statcard wide"><span class="slbl">' + iconUse("payments") + 'Verwachte tol</span>' +
      '<span class="sval">' + tolWaarde + '</span></div>';
}

function renderLandenLijst(){
  var wrap = document.getElementById("landenblok");
  var box = document.getElementById("landenlijst");
  if(!ROUTE.length){ wrap.hidden = true; box.innerHTML = ""; return; }
  wrap.hidden = false;
  box.innerHTML = ROUTE.map(function(code){
    var c = BY_CODE[code];
    if(!c) return "";
    return '<div class="landrow" data-land="' + esc(code) + '" role="button" tabindex="0">' + flagHTML(c) +
      '<span class="landnaam">' + esc(c.name) + '</span>' +
      iconUse("chevron-right") + '</div>';
  }).join("");
}

function renderMilieuzones(){
  var el = document.getElementById("milieukaart");
  if(!ROUTE_ZONES.length){ el.hidden = true; el.innerHTML = ""; return; }
  el.hidden = false;
  var namen = ROUTE_ZONES.slice(0, 8).map(function(o){ return esc(o.zone.city); });
  el.innerHTML =
    '<div class="milieuhead">' + iconUse("eco") +
      '<div><h3>Milieuzones gedetecteerd</h3>' +
      '<p>Let op: voor deze steden heb je mogelijk een vignet of milieusticker nodig.</p></div></div>' +
    '<div class="milieuchips">' + namen.map(function(n){ return '<span class="mchip">' + n + "</span>"; }).join("") + "</div>";
}
