"use strict";
/* Sleutels, drempels en de geladen referentiedata.

   Wat hier NIET meer staat: het werkgeheugen van de actieve rit. Dat was een
   stuk of tien losse globals (ROUTE, HOME, VEH, DEPART, TICKED, FROM_CITY, ...)
   en staat sinds §19 in één trip-object — zie js/trip.js.

   Wat hier wel staat, is alles wat níét van één reis is: de opslagsleutels, de
   drempels, de geladen databestanden (die zijn van de app, niet van een rit) en
   de zichtbare pagina. */

var STORE_ROUTE = "grenschecklist.route.v1";   /* v1-sleutels: alleen nog voor  */
var STORE_HOME  = "grenschecklist.home.v1";    /* de eenmalige migratie in      */
var STORE_TICK  = "grenschecklist.ticked.v1";  /* migreerOudeStaat()            */
var STORE_VEH   = "grenschecklist.vehicle.v1";
var STORE_DATA  = "grenschecklist.data.v1";
var STORE_TRIPS  = "grenschecklist.trips.v1";
var STORE_ACTIVE = "grenschecklist.activeTrip.v1";
var STORE_THEME  = "grenschecklist.theme.v1";

/* De app markeert data ouder dan dit als verouderd. tools/verify-data.mjs
   waarschuwt eerder (180 dagen): de controle hoort aan de bel te trekken vóór
   een gebruiker het ziet. */
var STALE_DAYS  = 240;

/* ---------------- zichtbare pagina ----------------
   De informatiearchitectuur uit §3: Reis · Acties · Kaart · Kosten · Regels ·
   Document, met home en wizard ervoor en de opgeslagen reizen erachter. */
var VIEW = "home";
var VIEW_ORDER = ["home", "wizard", "dashboard", "acties", "kaart", "kosten",
                  "regels", "document", "reizen", "reis"];
var LANDEN_ACTIEF = null;

/* ---------------- geladen referentiedata ----------------
   Van de app, niet van een reis: één keer laden, door alle reizen gedeeld.
   CITIES laadt meteen (klein, voor directe autocomplete); BORDERS is 300 KB en
   laadt pas bij de eerste routeberekening. */
var DATA = null, BY_CODE = {};
var FROM_CACHE = false;
var CITIES = null, BORDERS = null, ZONES = null;

/* Kaartschets: puur weergave, hoort bij geen enkele reis. */
var MAP_ZOOM = 1;
