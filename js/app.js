"use strict";
/* Orkestratie: render, view-switching, events en boot.
   
   Dit bestand wordt als laatste geladen; onderaan staat de daadwerkelijke start. */

/* ---------------- orkestratie ----------------
   Bouwt alleen de zichtbare VIEW opnieuw op — de andere secties staan toch
   achter [hidden], dus dat werk zou verspild zijn. switchView() roept dit aan
   na het omschakelen; alle state-mutaties (checkbox, profielveld, nieuwe route)
   roepen dit ook gewoon aan zoals voorheen. */
function render(){
  renderProfile();
  if(VIEW === "route"){
    renderDashboardStats();
    renderLandenLijst();
    renderMilieuzones();
    renderRouteSchets(ROUTE_COORDS);
  } else if(VIEW === "landen"){
    renderLandenInfo();
  } else if(VIEW === "checklist"){
    renderChecklistPagina();
  } else if(VIEW === "reizen"){
    renderMijnReizen();
  } else if(VIEW === "reis"){
    renderReisErvaring();
  }
}

/* ---------------- view-switching ---------------- */
function switchView(naam, geenHash){
  if(VIEW_ORDER.indexOf(naam) === -1) naam = "route";
  stopJourneyScroll(); // alleen actief terwijl VIEW==="reis"; render() start 'm zo nodig weer op
  VIEW = naam;
  VIEW_ORDER.forEach(function(v){
    var sec = document.getElementById("view-" + v);
    if(sec) sec.hidden = (v !== naam);
  });
  var knoppen = document.querySelectorAll("[data-view]");
  for(var i = 0; i < knoppen.length; i++){
    knoppen[i].classList.toggle("active", knoppen[i].getAttribute("data-view") === naam);
  }
  if(!geenHash && location.hash !== "#" + naam) location.hash = naam;
  window.scrollTo(0, 0);
  render();
}

/* ---------------- events ---------------- */
function wire(){
  document.getElementById("btn-reset").addEventListener("click", nieuweTrip);

  document.getElementById("dark-toggle").addEventListener("change", function(e){
    wisselThema(e.target.checked);
  });
  document.getElementById("dark-toggle-mobiel").addEventListener("click", function(){
    wisselThema(huidigThema() !== "dark");
  });

  // Sidebar- en onderbalk-navigatie delen dezelfde data-view-knoppen.
  document.addEventListener("click", function(e){
    var b = e.target.closest("[data-view]");
    if(b){ switchView(b.getAttribute("data-view")); return; }
  });
  window.addEventListener("hashchange", function(){
    var v = (location.hash || "").replace("#", "");
    if(v && v !== VIEW) switchView(v, true);
  });

  // Checkbox-vinkjes: gedeeld tussen de bento-rijen van de Checklist-pagina
  // (data-tick op "doc:", equipment- en task-keys); TICKED is toch al één pot.
  document.addEventListener("change", function(e){
    var cb = e.target.closest("input[data-tick]");
    if(!cb) return;
    var k = cb.getAttribute("data-tick");
    if(cb.checked) TICKED[k] = 1; else delete TICKED[k];
    saveRoute();
    var row = cb.closest(".chkrow");
    if(row) row.classList.toggle("done", cb.checked);
    var tel = checklistTelling();
    var pct = tel.totaal ? Math.round(tel.gedaan / tel.totaal * 100) : 0;
    var pval = document.querySelector(".progresscard .pval");
    var bar = document.querySelector(".progresscard .progressbar>i");
    if(pval) pval.textContent = pct + "% gereed";
    if(bar) bar.style.width = pct + "%";
  });

  document.getElementById("view-landen").addEventListener("click", function(e){
    var toggle = e.target.closest(".landswitch-toggle");
    if(toggle){
      var panel = document.getElementById("land-switch-panel");
      var openen = panel.hidden;
      panel.hidden = !openen;
      toggle.setAttribute("aria-expanded", openen ? "true" : "false");
      if(openen){
        var zoek = document.getElementById("land-switch-search");
        if(zoek){ zoek.value = ""; filterLandSwitch(""); zoek.focus(); }
      }
      return;
    }
    var rij = e.target.closest(".landswitch-row");
    if(rij){
      LANDEN_ACTIEF = rij.getAttribute("data-land");
      renderLandenInfo();
    }
  });
  document.getElementById("view-landen").addEventListener("input", function(e){
    if(e.target.id === "land-switch-search") filterLandSwitch(e.target.value);
  });
  document.addEventListener("click", function(e){
    var panel = document.getElementById("land-switch-panel");
    if(!panel || panel.hidden || e.target.closest(".landswitch")) return;
    panel.hidden = true;
    var toggle = document.getElementById("land-switch-toggle");
    if(toggle) toggle.setAttribute("aria-expanded", "false");
  });
  document.addEventListener("keydown", function(e){
    if(e.key !== "Escape") return;
    var panel = document.getElementById("land-switch-panel");
    if(!panel || panel.hidden) return;
    panel.hidden = true;
    var toggle = document.getElementById("land-switch-toggle");
    if(toggle){ toggle.setAttribute("aria-expanded", "false"); toggle.focus(); }
  });
  document.getElementById("landenlijst").addEventListener("click", function(e){
    var row = e.target.closest(".landrow");
    if(!row) return;
    LANDEN_ACTIEF = row.getAttribute("data-land");
    switchView("landen");
  });

  document.getElementById("view-reizen").addEventListener("click", function(e){
    if(e.target.closest("#btn-nieuwe-reis") || e.target.closest("#btn-tripnew")){
      nieuweTrip();
      return;
    }
    var actieBtn = e.target.closest("[data-actie]");
    if(actieBtn){
      var kaart = actieBtn.closest(".tripcard");
      var id = kaart && kaart.getAttribute("data-trip");
      var actie = actieBtn.getAttribute("data-actie");
      if(actie === "open") activeerTrip(id, true);
      else if(actie === "hernoem") hernoemTrip(id);
      else if(actie === "verwijder") verwijderTrip(id);
    }
  });

  document.getElementById("home").addEventListener("change", function(e){
    HOME = e.target.value; saveRoute(); render();
  });
  document.getElementById("depart").addEventListener("change", function(e){
    DEPART = e.target.value; render();
  });
  document.getElementById("fuel").addEventListener("change", function(e){
    VEH.fuel = e.target.value; saveRoute(); render();
  });
  document.getElementById("euro").addEventListener("change", function(e){
    VEH.euro = e.target.value === "" ? null : Number(e.target.value);
    saveRoute(); render();
  });
  document.getElementById("vtype").addEventListener("change", function(e){
    VEH.type = e.target.value; saveRoute(); render();
  });

  wireCityField("from", "from-res", function(c){ FROM_CITY = c; });
  wireCityField("to",   "to-res",   function(c){ TO_CITY   = c; });
  document.getElementById("btn-route").addEventListener("click", doRoute);
  document.getElementById("btn-swap").addEventListener("click", function(){
    var a = document.getElementById("from"), b = document.getElementById("to");
    var tv = a.value; a.value = b.value; b.value = tv;
    var tc = FROM_CITY; FROM_CITY = TO_CITY; TO_CITY = tc;
  });

  document.getElementById("map-zoom-in").addEventListener("click", function(){
    MAP_ZOOM = Math.min(3, MAP_ZOOM * 1.25); applyMapZoom();
  });
  document.getElementById("map-zoom-out").addEventListener("click", function(){
    MAP_ZOOM = Math.max(0.6, MAP_ZOOM / 1.25); applyMapZoom();
  });
  document.getElementById("map-locate").addEventListener("click", function(){
    MAP_ZOOM = 1; applyMapZoom();
  });
  document.getElementById("map-layers").addEventListener("click", function(){
    document.querySelector(".panel-map").classList.toggle("alt");
  });

  document.getElementById("btn-bekijk-reis").addEventListener("click", function(){
    switchView("reis");
  });
  document.getElementById("view-reis").addEventListener("click", function(e){
    if(e.target.closest("#btn-reis-naar-planner")){ switchView("route"); return; }
    if(e.target.closest("#btn-reis-checklist")){ switchView("checklist"); return; }
  });
}

/* ---------------- boot ---------------- */

/* Was er al een rit van vóór de meerdere-ritten-datalaag (de losse sleutels uit
   fase 1), dan verhuist die eenmalig naar de eerste trip — niets gaat verloren. */
function migreerOudeStaat(){
  var route = [], ticked = {}, veh = { fuel:"petrol", euro:null, type:"auto" };
  try{ route = JSON.parse(lsGet(STORE_ROUTE) || "[]"); }catch(e){}
  try{ ticked = JSON.parse(lsGet(STORE_TICK) || "{}"); }catch(e){}
  try{
    var v = JSON.parse(lsGet(STORE_VEH) || "null");
    if(v && typeof v === "object"){
      veh.fuel = v.fuel || "petrol";
      veh.euro = (v.euro === null || v.euro === undefined) ? null : Number(v.euro);
      veh.type = v.type || "auto";
    }
  }catch(e){}
  var home = lsGet(STORE_HOME) || "NL";
  var nu = new Date().toISOString();
  return { id: nieuwTripId(), naam: "Nieuwe rit", createdAt: nu, updatedAt: nu,
    route: route.filter(function(c){ return BY_CODE[c]; }), home: (BY_CODE[home] ? home : "NL"), veh: veh,
    depart: null, ticked: ticked, fromCity: null, toCity: null,
    routeCoords: null, routeRes: null, routeDuration: null };
}

function laadTrips(){
  try{
    var raw = lsGet(STORE_TRIPS);
    TRIPS = raw ? JSON.parse(raw) : [];
    if(!Array.isArray(TRIPS)) TRIPS = [];
  }catch(e){ TRIPS = []; }

  if(!TRIPS.length){
    TRIPS = [(lsGet(STORE_ROUTE) || lsGet(STORE_TICK)) ? migreerOudeStaat() : legeTrip()];
    lsSet(STORE_TRIPS, JSON.stringify(TRIPS));
  }

  ACTIVE_TRIP_ID = lsGet(STORE_ACTIVE);
  if(!tripById(ACTIVE_TRIP_ID)) ACTIVE_TRIP_ID = TRIPS[0].id;
  lsSet(STORE_ACTIVE, ACTIVE_TRIP_ID);
}

function boot(d){
  DATA = d;
  DATA.meta = DATA.meta || {};
  DATA.meta.principle = DATA.meta.principle || { text:"" };
  BY_CODE = {};
  DATA.countries.forEach(function(c){ BY_CODE[c.code] = c; });

  toepassenThema();

  laadTrips();
  hydrateerVanuitTrip(tripById(ACTIVE_TRIP_ID));

  var sel = document.getElementById("home");
  sel.innerHTML = DATA.countries.map(function(c){
    return '<option value="' + esc(c.code) + '"' + (c.code === HOME ? " selected" : "") + ">" + esc(c.name) + "</option>";
  }).join("");
  verversFormulier();

  var hashView = (location.hash || "").replace("#", "");
  if(VIEW_ORDER.indexOf(hashView) !== -1) VIEW = hashView;

  meldCachekopie();

  var gs = document.getElementById("general-sources");
  gs.innerHTML = (DATA.meta.generalSources || []).map(function(s){
    return '<li><a href="' + esc(s.url) + '" target="_blank" rel="noopener">' + esc(s.label) + "</a></li>";
  }).join("");

  document.getElementById("colofon").innerHTML =
    "Data onderzocht op " + esc(fmtDate(DATA.meta.researchDate)) + ". " +
    'Landsgrenzen en plaatsen: <a href="https://www.naturalearthdata.com/" target="_blank" rel="noopener">Natural Earth</a> (publiek domein). ' +
    'Routeberekening: <a href="https://project-osrm.org/" target="_blank" rel="noopener">OSRM</a> op kaartdata &copy; ' +
    '<a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>-bijdragers. ' +
    'Zoeken naar plaatsen buiten de meegeleverde lijst gaat via ' +
    '<a href="https://nominatim.openstreetmap.org/" target="_blank" rel="noopener">Nominatim</a>.';

  wire();
  switchView(VIEW, true);

  /* Was de actieve trip al onderweg (routeCoords) maar liepen borders/zones nog
     niet binnen toen hydrateerVanuitTrip draaide, dan is ROUTE_ZONES nu leeg —
     alsnog laden en de zichtbare view opnieuw opbouwen zodra dat lukt. */
  if(ROUTE_COORDS && !ZONES){
    Promise.all([
      BORDERS ? Promise.resolve() : loadJSON("borders.json").then(function(b){ BORDERS = b; }),
      loadJSON("zones.json").then(function(z){ ZONES = z.zones || z; }).catch(function(){ ZONES = []; })
    ]).then(function(){
      ROUTE_ZONES = zonesLangsRoute(ROUTE_COORDS);
      render();
    }).catch(function(){});
  }

  /* De planner heeft netwerk nodig (OSRM) en kan cities.json niet via file://
     laden. Lukt dat niet, dan blijft hij verborgen. */
  if(location.protocol !== "file:"){
    loadJSON("cities.json").then(function(c){
      CITIES = c.cities || c;
      document.getElementById("planner").hidden = false;
    }).catch(function(){
      /* stil */
    });
  }
}

loadData().then(function(d){
  if(d) boot(d); else showLoadError();
});

/* Service worker: maakt de app écht offline-bruikbaar op GitHub Pages of een eigen
   server. Vereist https of localhost — via file:// bestaat de API niet en valt de
   app terug op de localStorage-kopie hierboven. */
function offlineState(msg){
  var el = document.getElementById("offline-state");
  if(el) el.textContent = msg;
}
if("serviceWorker" in navigator && location.protocol !== "file:"){
  window.addEventListener("load", function(){
    navigator.serviceWorker.register("sw.js").then(function(){
      return navigator.serviceWorker.ready;
    }).then(function(){
      offlineState("Offline klaar — deze app werkt nu ook zonder bereik.");
    }).catch(function(){
      offlineState("Offline-cache niet beschikbaar in deze browser. De app werkt gewoon, maar heeft bereik nodig om te laden.");
    });
  });
} else if(location.protocol === "file:"){
  offlineState("Geopend via file:// — werkt offline zodra countries.json één keer is ingelezen.");
}
