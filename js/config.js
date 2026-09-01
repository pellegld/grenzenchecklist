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

/* Fase C: onderweg-modus. Alle drie werken zonder account en zonder netwerk. */
var STORE_JOURNEY      = "grenschecklist.journey.v1";       /* { enabled } */
var STORE_NOODGEGEVENS = "grenschecklist.noodgegevens.v1";  /* eigen verzekering/pechhulp */
var STORE_PACK         = "grenschecklist.pack.v1";          /* { laatstVernieuwd } */

/* Fase D: de terugkeerlus. Ook zonder account.

   Er komt geen STORE_OPGESLAGEN_REIZEN bij: de opgeslagen reizen staan al in
   STORE_TRIPS (js/trip.js), en de wijzigingsmonitor leest daar gewoon uit —
   elke trip draagt sindsdien een eigen laatstGecontroleerd-tijdstip en een
   gereserveerd (nog ongebruikt) notifyEmail-veld. Zie legeTrip().

   Het vignetgeheugen hoort niet bij een reis maar bij de auto: één profiel,
   dus één vlakke opslag per landcode, niet per reis en niet per kenteken (een
   kentekennummer staat nergens in het voertuigprofiel). */
var STORE_VIGNETTEN = "grenschecklist.vignetten.v1";   /* { CODE: { gekocht, geldigTot, optieDagen } } */

/* De app markeert data ouder dan dit als verouderd. tools/verify-data.mjs
   waarschuwt eerder (180 dagen): de controle hoort aan de bel te trekken vóór
   een gebruiker het ziet. */
var STALE_DAYS  = 240;

/* ---------------- zichtbare pagina ----------------
   De informatiearchitectuur uit §3: Reis · Acties · Kaart · Kosten · Regels ·
   Document, met home en wizard ervoor en de opgeslagen reizen erachter. */
var VIEW = "home";
var VIEW_ORDER = ["home", "wizard", "dashboard", "acties", "kaart", "kosten",
                  "regels", "document", "onderweg", "reizen", "reis"];
var LANDEN_ACTIEF = null;

/* ---------------- geladen referentiedata ----------------
   Van de app, niet van een reis: één keer laden, door alle reizen gedeeld.
   CITIES laadt meteen (klein, voor directe autocomplete); BORDERS is 300 KB en
   laadt pas bij de eerste routeberekening. */
var DATA = null, BY_CODE = {};
var FROM_CACHE = false;
var CITIES = null, BORDERS = null, ZONES = null, FUELPRICES = null;

/* Huidig-land: gedeeld tussen reismodus en incidentmodus. Sessie-only — er
   wordt geen locatiegeschiedenis bewaard, alleen waar je nu volgens de app
   bent. Reismodus vult 'm uit GPS, de incidentmodal laat 'm met de hand
   overschrijven; zonder allebei valt hij terug op het eerste land van de reis. */
var HUIDIG_LAND = null;

/* De kaartstand (zoom en verschuiving) staat in js/map.js: het is hoe je
   kijkt, niet wat je gepland hebt. */
