"use strict";
/* Het trip-object — §19 van de masterprompt.

   Eén object is de bron van waarheid voor een reis. Alles wat de app over de
   actieve reis weet staat in TRIP; er zijn geen losse ROUTE/HOME/VEH/DEPART/
   TICKED-globals meer die uit de pas kunnen lopen.

   Dat was eerder wél zo: het werkgeheugen stond in een stuk of tien globals en
   twee functies (tripUitGlobals/hydrateerVanuitTrip) kopieerden heen en weer.
   Dat werkte, maar het had drie kosten. Een nieuwe eigenschap moest op vier
   plekken bijgewerkt worden (globals, schrijven, lezen, migratie). De
   voortgangsbalk per rit op Mijn Reizen kon alleen door de globals tijdelijk om
   te wisselen (metTrip). En de wizard uit §5 vult een halve reis in — dat is
   met "het werkgeheugen is de actieve rit" niet te modelleren.

   Nu: TRIPS bevat de opgeslagen reizen, TRIP verwijst naar één daarvan (zelfde
   object, geen kopie), en elke functie die over een reis rekent krijgt die reis
   als parameter. Wegschrijven is dan serialiseren, niet synchroniseren.

   De veldnamen volgen §19 (origin, destination, departureDate, vehicle, route,
   countries, ...) en zijn daarom Engels, terwijl de functies eromheen
   Nederlands blijven zoals de rest van de codebase. Dat is een bewuste keuze:
   dit object is het contract uit de masterprompt en is straks ook de vorm die
   over de deel-URL (§12) en het reisdocument (§11) gaat. */

/* De actieve reis. Wijst naar een element van TRIPS, dus een wijziging aan
   TRIP is meteen een wijziging aan de opgeslagen lijst; bewaarTrips() zet hem
   op schijf. */
var TRIP = null;
var TRIPS = [];
var ACTIVE_TRIP_ID = null;

function nieuwTripId(){
  return "t" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function vandaagISO(){ return new Date().toISOString().slice(0, 10); }

function legeTrip(){
  var nu = new Date().toISOString();
  return {
    id: nieuwTripId(),
    naam: i18n("trip.nieuweRit"),
    createdAt: nu,
    updatedAt: nu,

    /* Plaats: { naam, omschrijving, land, lat, lon } — dezelfde vorm die
       js/routeProvider.js teruggeeft, zodat er tussen geocoder en trip niets
       vertaald hoeft te worden. */
    origin: null,
    destination: null,

    departureDate: vandaagISO(),
    returnDate: null,

    /* plateCountry is het kentekenland: dat bepaalt of een uitrustingseis voor
       jou geldt en welke milieuzone-registratie je moet doen. gewichtKg en
       hoogteM zijn optioneel (§5) en nu alleen informatief. */
    vehicle: { plateCountry:"NL", fuel:"petrol", euro:null, type:"auto",
               gewichtKg:null, hoogteM:null },

    /* De berekende route. null zolang er geen berekening geweest is — dan is
       countries handmatig gevuld en tonen afstand/tol een streepje in plaats
       van een verzonnen getal. */
    route: null,   // { coordinates, meters, seconds, provider, analyse }

    countries: [],
    ticked: {},

    metadata: { stap:1, geanalyseerd:false, handmatig:false }
  };
}

/* ---------------- serialisatie ----------------

   Expliciete whitelist, twee redenen. Afgeleide waarden (_afgeleid) horen niet
   op schijf: die zijn in een oogwenk opnieuw te berekenen en zouden anders
   verouderd terugkomen. En een veld dat een latere versie toevoegt maar deze
   niet kent, wordt hier niet stilzwijgend meegesleept — dan zie je het verschil
   meteen in plaats van over een half jaar. */
function serialiseerTrip(trip){
  return {
    v: 2,
    id: trip.id, naam: trip.naam,
    createdAt: trip.createdAt, updatedAt: trip.updatedAt,
    origin: trip.origin, destination: trip.destination,
    departureDate: trip.departureDate, returnDate: trip.returnDate,
    vehicle: {
      plateCountry: trip.vehicle.plateCountry, fuel: trip.vehicle.fuel,
      euro: trip.vehicle.euro, type: trip.vehicle.type,
      gewichtKg: trip.vehicle.gewichtKg, hoogteM: trip.vehicle.hoogteM
    },
    route: trip.route ? {
      coordinates: downsample(trip.route.coordinates),
      meters: trip.route.meters, seconds: trip.route.seconds,
      provider: trip.route.provider, analyse: trip.route.analyse
    } : null,
    countries: trip.countries.slice(),
    ticked: trip.ticked,
    metadata: trip.metadata
  };
}

/* Om de zoveel punten bewaren: genoeg voor een herkenbare routeschets en om
   zones en tolpunten opnieuw te bepalen, zonder de volle (soms 10.000+ punten
   tellende) geometrie in localStorage te duwen. */
function downsample(coords){
  if(!coords || !coords.length) return null;
  var out = [];
  for(var i = 0; i < coords.length; i += 3) out.push(coords[i]);
  var last = coords[coords.length - 1];
  if(out[out.length - 1] !== last) out.push(last);
  return out;
}

/* Leest zowel de vorm van hierboven als de oude (v1) vorm, waarin een reis nog
   een momentopname van losse globals was: route/home/veh/depart/ticked/
   fromCity/toCity/routeCoords/routeRes/routeDuration. Iemand met een
   opgeslagen reis mag die niet kwijtraken door een refactor. */
function leesTrip(raw){
  var t = legeTrip();
  if(!raw || typeof raw !== "object") return t;

  t.id = raw.id || t.id;
  t.naam = raw.naam || t.naam;
  t.createdAt = raw.createdAt || t.createdAt;
  t.updatedAt = raw.updatedAt || t.updatedAt;
  t.ticked = (raw.ticked && typeof raw.ticked === "object") ? raw.ticked : {};

  var oud = raw.v !== 2;

  t.origin = oud ? plaatsUitRij(raw.fromCity) : (raw.origin || null);
  t.destination = oud ? plaatsUitRij(raw.toCity) : (raw.destination || null);
  t.departureDate = (oud ? raw.depart : raw.departureDate) || vandaagISO();
  t.returnDate = (oud ? null : raw.returnDate) || null;

  var v = (oud ? raw.veh : raw.vehicle) || {};
  t.vehicle = {
    plateCountry: (oud ? raw.home : v.plateCountry) || "NL",
    fuel: v.fuel || "petrol",
    euro: (v.euro === null || v.euro === undefined || v.euro === "") ? null : Number(v.euro),
    type: v.type || "auto",
    gewichtKg: v.gewichtKg == null ? null : Number(v.gewichtKg),
    hoogteM: v.hoogteM == null ? null : Number(v.hoogteM)
  };

  if(oud){
    t.route = raw.routeCoords ? {
      coordinates: raw.routeCoords, meters: null,
      seconds: raw.routeDuration || null, provider: null,
      analyse: raw.routeRes || null
    } : null;
  } else {
    t.route = raw.route || null;
  }

  t.countries = Array.isArray(oud ? raw.route : raw.countries)
    ? (oud ? raw.route : raw.countries).slice() : [];

  var m = raw.metadata || {};
  t.metadata = {
    stap: m.stap || (t.countries.length ? 4 : 1),
    geanalyseerd: m.geanalyseerd !== undefined ? !!m.geanalyseerd : !!t.countries.length,
    handmatig: !!m.handmatig
  };
  return t;
}

/* De rij uit cities.json is [naam, alias, landcode, lat, lon]; de trip bewaart
   een Plaats. Twee vormen, één conversie op één plek. */
function plaatsUitRij(rij){
  if(!rij || rij.length < 5) return null;
  return { naam: rij[0], omschrijving: rij[1] || rij[0],
           land: rij[2] || "", lat: Number(rij[3]), lon: Number(rij[4]) };
}
function rijUitPlaats(p){
  if(!p) return null;
  return [p.naam, p.omschrijving || p.naam, (p.land || "").toUpperCase(),
          Number(p.lat), Number(p.lon)];
}

/* ---------------- opslag ---------------- */
function bewaarTrips(){
  if(TRIP) TRIP.updatedAt = new Date().toISOString();
  lsSet(STORE_TRIPS, JSON.stringify(TRIPS.map(serialiseerTrip)));
}

/* Elke mutatie op de actieve reis loopt hierlangs: naam bijwerken, afgeleide
   waarden verversen, wegschrijven. Zo kan er geen scherm blijven staan op een
   berekening van vóór de wijziging. */
function bewaarTrip(){
  if(!TRIP) return;
  if(isStandaardNaam(TRIP.naam) && TRIP.origin && TRIP.destination){
    TRIP.naam = TRIP.origin.naam + " → " + TRIP.destination.naam;
  }
  herbereken(TRIP);
  bewaarTrips();
}

/* De naam van een rit is gebruikersinvoer en wordt daarom niet vertaald; alleen
   de standaardnaam is dat wél. Vandaar deze toets tegen álle talen: een rit die
   in het Nederlands is aangemaakt en in het Engels wordt geopend, moet nog
   steeds "Brussel → Salzburg" krijgen zodra er een route staat. */
function isStandaardNaam(naam){
  if(!naam) return true;
  for(var i = 0; i < TALEN.length; i++){
    if(naam === VERTALINGEN[TALEN[i]]["trip.nieuweRit"]) return true;
  }
  return false;
}

/* ---------------- afgeleide waarden ----------------

   Zones en tolpunten langs de route zijn een functie van de geometrie plus de
   geladen data. Ze staan op de trip onder _afgeleid en gaan niet mee naar
   localStorage: opnieuw berekenen kost milliseconden, een verouderde kopie
   tonen kost vertrouwen. */
function herbereken(trip){
  if(!trip) return;
  var coords = trip.route && trip.route.coordinates;
  trip._afgeleid = {
    zones: (coords && ZONES) ? zonesLangsRoute(coords) : [],
    tolpunten: coords ? tolPuntenLangsRoute(coords, trip) : []
  };
}

function tripZones(trip){ return (trip && trip._afgeleid && trip._afgeleid.zones) || []; }
function tripTolPunten(trip){ return (trip && trip._afgeleid && trip._afgeleid.tolpunten) || []; }

/* De landen op de route, ontdaan van codes die niet (meer) in countries.json
   staan — data kan krimpen tussen twee versies. */
function tripLanden(trip){
  return (trip && trip.countries || []).filter(function(code){ return BY_CODE[code]; });
}

function tripAnalyse(trip){ return (trip && trip.route && trip.route.analyse) || null; }
function tripAfstandKm(trip){
  var a = tripAnalyse(trip);
  return a ? a.total : null;
}
function tripDuur(trip){ return (trip && trip.route && trip.route.seconds) || null; }

/* Heeft deze reis genoeg om een dashboard voor te tonen? Een handmatig gekozen
   landenlijst telt mee: de checklist werkt daar net zo goed op. */
function tripIsKlaar(trip){
  return !!(trip && trip.countries && trip.countries.length);
}
