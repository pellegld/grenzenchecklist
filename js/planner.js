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

/* Van de neutrale Plaats van js/routeProvider.js naar de rij waarop deze pagina
   werkt: [naam, alias, landcode, lat, lon]. Diezelfde rij staat ook in
   cities.json en wordt zo in een trip bewaard, dus die vorm blijft. */
function plaatsNaarRij(p){
  return [p.naam, p.omschrijving || p.naam, (p.land || "").toUpperCase(),
          Number(p.lat), Number(p.lon)];
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
        var rows = plaatsen.map(plaatsNaarRij);
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
    onPick(c);
    close();
  });

  input.addEventListener("blur", function(){ setTimeout(close, 180); });
  return input;
}

function doRoute(){
  if(ROUTING) return;
  if(!FROM_CITY || !TO_CITY){
    plannerStatus("planner.kiesEerst", true);
    return;
  }
  ROUTING = true;
  document.getElementById("btn-route").disabled = true;
  plannerStatus("planner.bezig");

  var need = Promise.all([
    BORDERS ? Promise.resolve(BORDERS) : loadJSON("borders.json").then(function(b){ BORDERS = b; return b; }),
    ZONES ? Promise.resolve(ZONES) : laadData("zones.json").then(function(z){ ZONES = z.zones || z; return ZONES; })
             .catch(function(){ ZONES = []; return ZONES; })
  ]);

  need.then(function(){
    return RouteProvider.getRoute(
      { lat: FROM_CITY[3], lon: FROM_CITY[4] },
      { lat: TO_CITY[3],   lon: TO_CITY[4]   }
    );
  }).then(function(route){
    var coords = route.coordinates;
    var res = analyseRoute(coords);
    var toAdd = res.order.filter(function(c){ return BY_CODE[c]; });
    if(!toAdd.length) throw new Error(i18n("planner.geenLanden"));

    ROUTE = toAdd;
    ROUTE_RES = res;
    ROUTE_ZONES = zonesLangsRoute(coords);
    ROUTE_TOLLS = tolPuntenLangsRoute(coords);
    ROUTE_COORDS = coords;
    ROUTE_DURATION = route.seconds || null;
    HANDMATIG_ZICHTBAAR = false;
    saveRoute();
    render();
    plannerStatus("planner.klaar", false, null, true);
  }).catch(function(err){
    /* §20: een fout is geen doodlopende weg. Kon geen enkele dienst een route
       leveren (err.handmatig), dan is de planner uitgevallen, niet de app — de
       checklist werkt net zo goed op een zelf gekozen landenlijst. Bij een
       gewone fout (plaatsnaam, geen bekende landen) helpt zelf kiezen niet, dus
       dan blijft het bij de melding. */
    var m = String(err && err.message || err);
    if(err && err.handmatig){
      plannerStatus("planner.geenDienst", true);
      HANDMATIG_ZICHTBAAR = true;
      renderHandmatigeKeuze();
    } else {
      plannerStatus("planner.fout", true, { reden:m });
    }
  }).then(function(){
    ROUTING = false;
    document.getElementById("btn-route").disabled = false;
  });
}

/* ---------------- handmatige landenkeuze (terugval, §20) ----------------
   Verschijnt pas als de providerketen helemaal leeg uitkomt. Hij gebruikt de
   bestaande routebouwer (addCountry/removeAt) die al in js/trips.js staat; de
   planner vult de landenlijst vóór, hij is er nooit de enige manier voor
   geweest. Wat je zonder route mist is de afstand, de reistijd, de
   kilometertol en de kaartschets — dat staat er met zoveel woorden bij, want
   een getal verzinnen is erger dan het weglaten. */
var HANDMATIG_ZICHTBAAR = false;

function renderHandmatigeKeuze(){
  var el = document.getElementById("handmatig");
  if(!el) return;
  if(!HANDMATIG_ZICHTBAAR || !DATA){ el.hidden = true; el.innerHTML = ""; return; }
  el.hidden = false;

  var opties = DATA.countries.map(function(c){
    return '<option value="' + esc(c.code) + '">' + esc(c.name) + "</option>";
  }).join("");

  var chips = ROUTE.map(function(code, i){
    var c = BY_CODE[code];
    if(!c) return "";
    return '<span class="hmchip">' + flagHTML(c) + esc(c.name) +
      '<button type="button" data-hm-weg="' + i + '" aria-label="' +
      esc(i18n("handmatig.verwijderen", { land:c.name })) + '">&times;</button></span>';
  }).join("");

  el.innerHTML =
    "<h3>" + esc(i18n("handmatig.kop")) + "</h3>" +
    "<p>" + esc(i18n("handmatig.uitleg")) + "</p>" +
    '<div class="hmrij">' +
      '<select id="hm-land" aria-label="' + esc(i18n("handmatig.landToevoegen")) + '">' + opties + "</select>" +
      '<button type="button" class="btn" id="hm-toevoegen">' + iconUse("add") + " " +
        esc(i18n("handmatig.toevoegen")) + "</button>" +
    "</div>" +
    (chips ? '<div class="hmchips">' + chips + "</div>"
           : '<p class="hint">' + esc(i18n("handmatig.geenLanden")) + "</p>");
}

function renderDashboardStats(){
  var el = document.getElementById("stat-cards");
  var reisBtn = document.getElementById("btn-bekijk-reis");
  if(!ROUTE_RES){ el.hidden = true; el.innerHTML = ""; reisBtn.hidden = true; return; }
  el.hidden = false;
  reisBtn.hidden = false;

  var afstand = getal(Math.round(ROUTE_RES.total));
  var duur = fmtDuur(ROUTE_DURATION);
  var tol = tolTotaalRetour();
  var tolWaarde = tol
    ? '&euro;' + euroTekst(tol.bedrag) +
      (tol.zeker ? "" : ' <small>' + esc(i18n("planner.ofMeer")) + '</small>')
    : "—";

  el.innerHTML =
    '<div class="statcard"><span class="slbl">' + iconUse("ruler") + esc(i18n("planner.afstand")) + '</span>' +
      '<span class="sval">' + afstand + ' <small>' + esc(i18n("planner.km")) + '</small></span></div>' +
    '<div class="statcard"><span class="slbl">' + iconUse("clock") + esc(i18n("planner.reistijd")) + '</span>' +
      '<span class="sval">' + (duur || "—") + '</span></div>' +
    '<div class="statcard wide"><span class="slbl">' + iconUse("payments") + esc(i18n("planner.verwachteTol")) + '</span>' +
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
      "<div><h3>" + esc(i18n("planner.milieuzones")) + "</h3>" +
      "<p>" + esc(i18n("planner.milieuzonesUitleg")) + "</p></div></div>" +
    '<div class="milieuchips">' + namen.map(function(n){ return '<span class="mchip">' + n + "</span>"; }).join("") + "</div>";
}
