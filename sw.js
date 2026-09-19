/* Grenschecklist service worker.
   Doel: de app draait volledig offline zodra je hem één keer met bereik hebt geopend.
   Dat is precies het scenario waarvoor de app bedoeld is — vlak voor vertrek, op een
   parkeerplaats zonder dekking.

   Strategie: stale-while-revalidate. Je krijgt altijd meteen de gecachte versie
   (dus ook zonder netwerk), en op de achtergrond wordt de cache ververst zodat een
   bijgewerkte countries.json de volgende keer vanzelf verschijnt.

   Bump CACHE bij een release waarin je oude bestanden echt wil opruimen. */

var CACHE = "grenschecklist-v32";
/* ASSETS wordt gegenereerd door build/build.mjs (npm run build:sw). Voeg je met
   de hand een bestand toe, draai die dan; anders staat het nieuwe bestand wel op
   de server maar niet in de offline cache, en dat merk je pas zonder bereik.
   BEGIN-ASSETS (niet met de hand bewerken tussen de twee markeringen) */
var ASSETS = [
  "./",
  "./index.html",
  "./fonts.css",
  "./countries.json",
  "./cities.json",
  "./borders.json",
  "./zones.json",
  "./drukte.json",
  "./fuelprices.json",
  "./meta/changelog.json",
  "./css/base.css",
  "./css/components.css",
  "./css/pages.css",
  "./css/print.css",
  "./js/acties.js",
  "./js/actions.js",
  "./js/app.js",
  "./js/calendar.js",
  "./js/checklist.js",
  "./js/config.js",
  "./js/costs.js",
  "./js/countries.js",
  "./js/dashboard.js",
  "./js/data.js",
  "./js/document.js",
  "./js/douane.js",
  "./js/facts.js",
  "./js/fuel.js",
  "./js/geo.js",
  "./js/home.js",
  "./js/i18n.js",
  "./js/incident.js",
  "./js/journey.js",
  "./js/map.js",
  "./js/pages.js",
  "./js/planner.js",
  "./js/routeProvider.js",
  "./js/share.js",
  "./js/storage.js",
  "./js/trip.js",
  "./js/trips.js",
  "./js/util.js",
  "./js/vehicle.js",
  "./js/wijzigingen.js",
  "./js/wizard.js",
  "./fonts/barlow-400-latin-ext.woff2",
  "./fonts/barlow-400-latin.woff2",
  "./fonts/barlow-600-latin-ext.woff2",
  "./fonts/barlow-600-latin.woff2",
  "./fonts/barlow-700-latin-ext.woff2",
  "./fonts/barlow-700-latin.woff2",
  "./fonts/barlowcondensed-700-latin-ext.woff2",
  "./fonts/barlowcondensed-700-latin.woff2",
  "./fonts/barlowcondensed-800-latin-ext.woff2",
  "./fonts/barlowcondensed-800-latin.woff2",
  "./images/Landbanner/Denemarken.png",
  "./images/Landbanner/Duitsland.png",
  "./images/Landbanner/Frankrijk.png",
  "./images/Landbanner/Italie.png",
  "./images/Landbanner/Kroatie.png",
  "./images/Landbanner/Luxemburg.png",
  "./images/Landbanner/Nederland.png",
  "./images/Landbanner/Oostenrijk.png",
  "./images/Landbanner/Portugal.png",
  "./images/Landbanner/Slovenie.png",
  "./images/Landbanner/Spanje.png",
  "./images/Landbanner/Tsjechie.png",
  "./images/Landbanner/UK.png",
  "./images/Landbanner/Zweden.png"
];
/* EIND-ASSETS */

/* Let op de cache:"reload" hieronder. Zonder die vlag haalt addAll() de
   bestanden gewoon uit de HTTP-cache van de browser, en dan kan er een
   verouderde index.html of een oud js-bestand de offline cache in gebakken
   worden — precies het bestand dat je daarna zonder bereik krijgt, en dat blijft
   zitten tot je CACHE weer bumpt. Met "reload" gaat elk bestand vers van de
   server. Dit is een keer echt gebeurd tijdens het testen: de app laadde offline
   een index.html van vóór een nieuwe scripttag, en dus zonder die module. */
self.addEventListener("install", function(e){
  e.waitUntil(
    caches.open(CACHE)
      .then(function(c){
        return c.addAll(ASSETS.map(function(u){ return new Request(u, { cache:"reload" }); }));
      })
      .then(function(){ return self.skipWaiting(); })
  );
});

self.addEventListener("activate", function(e){
  e.waitUntil(
    caches.keys()
      .then(function(keys){
        return Promise.all(keys.map(function(k){
          return k === CACHE ? null : caches.delete(k);
        }));
      })
      .then(function(){ return self.clients.claim(); })
  );
});

// Gegenereerde contentpagina's (fase E1/E2/E3): build/build.mjs schrijft deze
// buiten de app-shell, met opzet niet in ASSETS hierboven. Ze staan hier apart
// omdat ze een kortere effectieve cachetermijn horen te hebben dan de app-shell
// — na een databuild (een vignetprijs die verandert, een nieuwe changelogregel)
// moet de eerstvolgende online bezoeker meteen de nieuwe versie zien, niet de
// gecachte versie van vóór de build met een achtergrondverversing die hij toch
// niet afwacht.
var CONTENT_PATH_RE = /^\/(autorijden-|vignet-|milieuzones-|milieuzone-|tol-|mag-ik\/|wijzigingen\/?$)|^\/(sitemap\.xml|robots\.txt|feed\.xml)$/;

self.addEventListener("fetch", function(e){
  var req = e.request;

  // Alleen eigen GET-verkeer cachen; bronlinks naar ANWB en co. laten we met rust.
  if(req.method !== "GET") return;
  var u = new URL(req.url);
  if(u.origin !== self.location.origin) return;

  // De proxy onder /api/ blijft er buiten. Een route is geen bestand: hij hangt
  // af van de vraag, en de proxy zegt zelf al met cache-control hoe lang zijn
  // antwoord houdbaar is. Die afweging hier overrulen levert alleen verwarring op.
  if(u.pathname.indexOf("/api/") !== -1) return;

  // Contentpagina's: netwerk eerst, cache alleen als terugval zonder bereik.
  // Geen stale-while-revalidate — die toont bewust eerst de oude versie, en
  // dat is precies wat een net gepubliceerde correctie hier niet moet doen.
  if(CONTENT_PATH_RE.test(u.pathname)){
    e.respondWith(
      fetch(req).then(function(res){
        if(res && res.ok){
          caches.open(CACHE).then(function(cache){ cache.put(req, res.clone()); });
        }
        return res;
      }).catch(function(){
        return caches.open(CACHE).then(function(cache){
          return cache.match(req).then(function(hit){ return hit || Response.error(); });
        });
      })
    );
    return;
  }

  // App-shell en databestanden: stale-while-revalidate, zoals altijd.
  e.respondWith(
    caches.open(CACHE).then(function(cache){
      return cache.match(req).then(function(hit){
        var net = fetch(req).then(function(res){
          if(res && res.ok) cache.put(req, res.clone());
          return res;
        }).catch(function(){
          // Offline en niets in de cache: laat de browser zijn eigen fout tonen.
          return hit || Response.error();
        });
        return hit || net;
      });
    })
  );
});
