"use strict";
/* De lijst opgeslagen reizen: kiezen, aanmaken, hernoemen, verwijderen.

   Het reismodel zelf staat in js/trip.js. Dit bestand gaat alleen over de
   verzameling: welke reis is actief, en wat gebeurt er als je er een toevoegt
   of weghaalt. */

function tripIndex(id){
  for(var i = 0; i < TRIPS.length; i++){ if(TRIPS[i].id === id) return i; }
  return -1;
}
function tripById(id){ var i = tripIndex(id); return i === -1 ? null : TRIPS[i]; }

/* Zet de actieve reis. TRIP wijst naar hetzelfde object als in TRIPS — er wordt
   niets gekopieerd, dus er kan ook niets uit de pas lopen.

   Zones en tolpunten worden lokaal herleid uit de opgeslagen (uitgedunde)
   coördinaten; het activeren van een opgeslagen reis kost geen netwerkaanroep.
   Zijn borders/zones nog niet geladen, dan gebeurt dat eerst. */
function activeerTrip(id, gaNaar){
  var t = tripById(id);
  if(!t) return;
  TRIP = t;
  ACTIVE_TRIP_ID = id;
  lsSet(STORE_ACTIVE, id);

  function klaar(){
    herbereken(TRIP);
    verversFormulier();
    plannerStatus("");
    if(gaNaar === false) render();
    else switchView(gaNaar || (tripIsKlaar(TRIP) ? "dashboard" : "wizard"));
  }
  if(TRIP.route && TRIP.route.coordinates && !ZONES) laadGeoData().then(klaar, klaar);
  else klaar();

  herstelVerschraaldeRoute(TRIP);
}

/* Een route die door het oude uitdunnen tot een rechte lijn is geworden één keer
   opnieuw laten berekenen. Dat kan alleen met een vertrek- en een bestemmings-
   plaats; een handmatig samengestelde landenlijst heeft geen geometrie en hoeft
   die ook niet te hebben.

   Stil op de achtergrond, en bij mislukking gebeurt er niets: zonder netwerk
   houd je wat je had, en dat is nog altijd een werkende checklist. Er komt geen
   melding — dit is de app die een oude fout van zichzelf opruimt, niet iets
   waar de gebruiker een besluit over hoeft te nemen. */
function herstelVerschraaldeRoute(trip){
  if(!trip || !routeIsVerschraald(trip)) return;
  if(!trip.origin || !trip.destination) return;
  if(ROUTING) return;

  berekenRoute(trip).then(function(){
    bewaarTrip();
    render();
  }).catch(function(){});
}

/* borders.json en zones.json horen bij elkaar: allebei nodig zodra er een
   geometrie is om tegen te toetsen. Faalt zones.json, dan werkt de rest door
   met een lege lijst — geen zones melden is beter dan de app laten vallen. */
function laadGeoData(){
  return Promise.all([
    BORDERS ? Promise.resolve() : loadJSON("borders.json").then(function(b){ BORDERS = b; }),
    ZONES ? Promise.resolve() : laadData("zones.json")
      .then(function(z){ ZONES = z.zones || z; })
      .catch(function(){ ZONES = []; })
  ]);
}

function nieuweTrip(gaNaar){
  var t = legeTrip();
  TRIPS.push(t);
  activeerTrip(t.id, gaNaar || "wizard");
  bewaarTrips();
}

function verwijderTrip(id){
  var t = tripById(id);
  if(!t) return;
  if(!confirm(i18n("trip.verwijderBevestig", { naam:t.naam }))) return;
  TRIPS = TRIPS.filter(function(x){ return x.id !== id; });
  if(id === ACTIVE_TRIP_ID){
    if(!TRIPS.length) TRIPS.push(legeTrip());
    activeerTrip(TRIPS[0].id, false);
  }
  bewaarTrips();
  renderMijnReizen();
}

function hernoemTrip(id){
  var t = tripById(id);
  if(!t) return;
  var naam = prompt(i18n("trip.naamPrompt"), t.naam);
  if(naam === null) return;
  naam = naam.trim();
  if(!naam) return;
  t.naam = naam;
  t.metadata.naamAutomatisch = false;   /* vanaf nu is de naam van jou */
  t.updatedAt = new Date().toISOString();
  bewaarTrips();
  renderMijnReizen();
}

/* ---------------- handmatige landenkeuze ----------------
   De routebouwer die er altijd al was: landen toevoegen, verwijderen en
   herordenen zonder routeberekening. Hij is de terugval van §20 en tegelijk de
   gewone manier om de landenlijst van de planner bij te sturen. */
function addCountry(code){
  if(!TRIP || !BY_CODE[code]) return;
  if(TRIP.countries.indexOf(code) === -1){
    TRIP.countries.push(code);
    TRIP.metadata.handmatig = true;
    TRIP.metadata.geanalyseerd = true;
    bewaarTrip();
    render();
  }
}
function removeAt(i){
  if(!TRIP) return;
  TRIP.countries.splice(i, 1);
  bewaarTrip();
  render();
}
function moveItem(from, to){
  if(!TRIP || to < 0 || to >= TRIP.countries.length) return;
  TRIP.countries.splice(to, 0, TRIP.countries.splice(from, 1)[0]);
  bewaarTrip();
  render();
}
