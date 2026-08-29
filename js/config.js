"use strict";
/* Sleutels, drempels en het werkgeheugen van de actieve rit.
   
   Alle globals van de app staan hier bij elkaar. Dat is bewust: ze waren eerder
   verspreid over het ene grote script, en dan is niet te zien wat state is en wat
   afgeleide waarde. De trip is de bron van waarheid; deze variabelen zijn zijn
   werkgeheugen (zie js/trips.js). */

var STORE_ROUTE = "grenschecklist.route.v1";
var STORE_HOME  = "grenschecklist.home.v1";
var STORE_TICK  = "grenschecklist.ticked.v1";
var STORE_DATA  = "grenschecklist.data.v1";
var STORE_VEH   = "grenschecklist.vehicle.v1";
var STORE_TRIPS  = "grenschecklist.trips.v1";
var STORE_ACTIVE = "grenschecklist.activeTrip.v1";
var STORE_THEME  = "grenschecklist.theme.v1";
var STALE_DAYS  = 240;

/* Meerdere ritten: TRIPS is de opgeslagen lijst, ACTIVE_TRIP_ID wijst naar welke
   trip het huidige werkgeheugen is. De globals hieronder (ROUTE, HOME, VEH, ...)
   blijven gewoon "het werkgeheugen van de actieve trip" — alle bestaande
   route-/checklist-logica die op die globals leest, blijft ongewijzigd werken.
   Alleen saveRoute()/boot() weten van het bestaan van TRIPS. */
var TRIPS = [], ACTIVE_TRIP_ID = null;
var VIEW = "route";
var VIEW_ORDER = ["route", "landen", "checklist", "reizen", "reis"];
var LANDEN_ACTIEF = null;

var DATA = null, BY_CODE = {}, ROUTE = [], HOME = "", TICKED = {}, DEPART = null;
var VEH = { fuel:"petrol", euro:null, type:"auto" };

/* Routeplanner. CITIES laadt meteen (klein, voor directe autocomplete); BORDERS
   is 300 KB en laadt pas bij de eerste routeberekening. */
var FROM_CACHE = false;
var CITIES = null, BORDERS = null;
var ZONES = null, ROUTE_ZONES = [], ROUTE_RES = null, ROUTE_TOLLS = [];
var FROM_CITY = null, TO_CITY = null, ROUTING = false;
var ROUTE_COORDS = null, ROUTE_DURATION = null;
var MAP_ZOOM = 1;
