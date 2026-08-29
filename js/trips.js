"use strict";
/* Opgeslagen ritten en de brug tussen een trip en het werkgeheugen. */

/* ---------------- ritten (meerdere opgeslagen trips) ----------------
   Elke trip is een momentopname van het werkgeheugen: route, voertuigprofiel,
   afvinkstatus en de routegeometrie (uitgedund, alleen voor de kaartschets en
   om zones/tolpunten lokaal te herberekenen — geen nieuwe routeberekening nodig
   bij het activeren van een opgeslagen trip). */
function nieuwTripId(){ return "t" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }

function legeTrip(){
  var nu = new Date().toISOString();
  return { id: nieuwTripId(), naam: "Nieuwe rit", createdAt: nu, updatedAt: nu,
    route: [], home: (BY_CODE[HOME] ? HOME : "NL"), veh: { fuel:"petrol", euro:null, type:"auto" },
    depart: null, ticked: {}, fromCity: null, toCity: null,
    routeCoords: null, routeRes: null, routeDuration: null };
}

/* Om de zoveel punten bewaren: genoeg voor een herkenbare routeschets en om
   zones/tolpunten opnieuw te bepalen, zonder de volle (soms 10.000+ punten
   tellende) geometrie in localStorage te duwen. */
function downsample(coords){
  if(!coords || !coords.length) return null;
  var out = [];
  for(var i = 0; i < coords.length; i += 3) out.push(coords[i]);
  var last = coords[coords.length - 1];
  if(out[out.length - 1] !== last) out.push(last);
  return out;
}

function tripIndex(id){
  for(var i = 0; i < TRIPS.length; i++){ if(TRIPS[i].id === id) return i; }
  return -1;
}
function tripById(id){ var i = tripIndex(id); return i === -1 ? null : TRIPS[i]; }

/* Bouwt een tripobject uit het huidige werkgeheugen; behoudt id/createdAt en
   een handmatig gezette naam, leidt anders de naam af uit Van/Naar. */
function tripUitGlobals(basis){
  var naam = basis.naam;
  if((!naam || naam === "Nieuwe rit") && FROM_CITY && TO_CITY){
    naam = FROM_CITY[0] + " → " + TO_CITY[0];
  }
  return {
    id: basis.id, naam: naam || "Nieuwe rit",
    createdAt: basis.createdAt, updatedAt: new Date().toISOString(),
    route: ROUTE.slice(), home: HOME, veh: { fuel:VEH.fuel, euro:VEH.euro, type:VEH.type }, depart: DEPART,
    ticked: TICKED, fromCity: FROM_CITY, toCity: TO_CITY,
    routeCoords: downsample(ROUTE_COORDS), routeRes: ROUTE_RES, routeDuration: ROUTE_DURATION
  };
}

/* Zet het werkgeheugen op de gegeven trip. Zones/tolpunten worden lokaal
   herleid uit de opgeslagen (uitgedunde) coördinaten — geen netwerkaanroep. */
function hydrateerVanuitTrip(trip){
  ROUTE = (trip.route || []).filter(function(c){ return BY_CODE[c]; });
  HOME = BY_CODE[trip.home] ? trip.home : (DATA.countries[0] && DATA.countries[0].code) || "NL";
  VEH = { fuel: (trip.veh && trip.veh.fuel) || "petrol",
          euro: (trip.veh && trip.veh.euro != null) ? Number(trip.veh.euro) : null,
          type: (trip.veh && trip.veh.type) || "auto" };
  DEPART = trip.depart || new Date().toISOString().slice(0, 10);
  TICKED = trip.ticked || {};
  FROM_CITY = trip.fromCity || null;
  TO_CITY = trip.toCity || null;
  ROUTE_COORDS = trip.routeCoords || null;
  ROUTE_RES = trip.routeRes || null;
  ROUTE_DURATION = trip.routeDuration || null;
  ROUTE_ZONES = (ROUTE_COORDS && ZONES) ? zonesLangsRoute(ROUTE_COORDS) : [];
  ROUTE_TOLLS = ROUTE_COORDS ? tolPuntenLangsRoute(ROUTE_COORDS) : [];
}

/* Ververst de losstaande formuliervelden na een trip-wissel (buiten render()
   om, want render() bouwt alleen de huidige VIEW, niet dit formulier). */
function verversFormulier(){
  document.getElementById("home").value = HOME;
  document.getElementById("depart").value = DEPART || "";
  document.getElementById("fuel").value = VEH.fuel;
  document.getElementById("euro").value = VEH.euro === null ? "" : String(VEH.euro);
  document.getElementById("vtype").value = VEH.type;
  document.getElementById("from").value = FROM_CITY ? FROM_CITY[0] : "";
  document.getElementById("to").value = TO_CITY ? TO_CITY[0] : "";
}

function activeerTrip(id, gaNaarRoute){
  var t = tripById(id);
  if(!t) return;
  ACTIVE_TRIP_ID = id;
  lsSet(STORE_ACTIVE, id);

  function klaar(){
    hydrateerVanuitTrip(t);
    verversFormulier();
    plannerStatus("");
    if(gaNaarRoute !== false) switchView("route"); else render();
  }
  if(t.routeCoords && !ZONES){
    Promise.all([
      BORDERS ? Promise.resolve() : loadJSON("borders.json").then(function(b){ BORDERS = b; }),
      loadJSON("zones.json").then(function(z){ ZONES = z.zones || z; }).catch(function(){ ZONES = []; })
    ]).then(klaar, klaar);
  } else klaar();
}

function nieuweTrip(){
  var t = legeTrip();
  TRIPS.push(t);
  lsSet(STORE_TRIPS, JSON.stringify(TRIPS));
  activeerTrip(t.id, true);
}

function verwijderTrip(id){
  var t = tripById(id);
  if(!t) return;
  if(!confirm('"' + t.naam + '" verwijderen? Dit kan niet ongedaan gemaakt worden.')) return;
  TRIPS = TRIPS.filter(function(x){ return x.id !== id; });
  lsSet(STORE_TRIPS, JSON.stringify(TRIPS));
  if(id === ACTIVE_TRIP_ID){
    if(!TRIPS.length) TRIPS.push(legeTrip());
    activeerTrip(TRIPS[0].id, false);
  }
  renderMijnReizen();
}

function hernoemTrip(id){
  var t = tripById(id);
  if(!t) return;
  var naam = prompt("Naam voor deze rit:", t.naam);
  if(naam === null) return;
  naam = naam.trim();
  if(!naam) return;
  t.naam = naam;
  t.updatedAt = new Date().toISOString();
  lsSet(STORE_TRIPS, JSON.stringify(TRIPS));
  renderMijnReizen();
}

/* Laat buildGroups()/buildTasks()/checklistTelling() (die overal op de globals
   lezen) heel even tegen een ANDERE trip draaien dan de actieve — nodig voor de
   voortgangsbalk op elke tripkaart in Mijn Reizen, zonder die functies te
   herschrijven om een tripobject als parameter te accepteren. */
function metTrip(trip, fn){
  var save = { ROUTE:ROUTE, HOME:HOME, VEH:VEH, DEPART:DEPART, TICKED:TICKED };
  ROUTE = (trip.route || []).filter(function(c){ return BY_CODE[c]; });
  HOME = trip.home;
  VEH = trip.veh || { fuel:"petrol", euro:null, type:"auto" };
  DEPART = trip.depart;
  TICKED = trip.ticked || {};
  var out = fn();
  ROUTE = save.ROUTE; HOME = save.HOME; VEH = save.VEH; DEPART = save.DEPART; TICKED = save.TICKED;
  return out;
}

/* ---------------- route state ---------------- */
function saveRoute(){
  var i = tripIndex(ACTIVE_TRIP_ID);
  if(i === -1) return;
  TRIPS[i] = tripUitGlobals(TRIPS[i]);
  lsSet(STORE_TRIPS, JSON.stringify(TRIPS));
}
/* Dormant: horen bij de handmatige routebouwer, die op deze pagina niet in
   beeld is (hier bepaalt alleen de planner de landenlijst). Komt terug zodra
   een routebouw-achtige pagina aan de beurt is. */
function addCountry(code){
  if(ROUTE.indexOf(code) === -1){ ROUTE.push(code); saveRoute(); render(); }
}
function removeAt(i){ ROUTE.splice(i,1); saveRoute(); render(); }
function moveItem(from,to){
  if(to < 0 || to >= ROUTE.length) return;
  ROUTE.splice(to, 0, ROUTE.splice(from,1)[0]);
  saveRoute(); render();
}
