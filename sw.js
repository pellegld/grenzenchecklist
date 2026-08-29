/* Grenschecklist service worker.
   Doel: de app draait volledig offline zodra je hem één keer met bereik hebt geopend.
   Dat is precies het scenario waarvoor de app bedoeld is — vlak voor vertrek, op een
   parkeerplaats zonder dekking.

   Strategie: stale-while-revalidate. Je krijgt altijd meteen de gecachte versie
   (dus ook zonder netwerk), en op de achtergrond wordt de cache ververst zodat een
   bijgewerkte countries.json de volgende keer vanzelf verschijnt.

   Bump CACHE bij een release waarin je oude bestanden echt wil opruimen. */

var CACHE = "grenschecklist-v19";
/* ASSETS wordt gegenereerd door build/build.mjs (npm run build:sw). Voeg je met
   de hand een bestand toe, draai die dan; anders staat het nieuwe bestand wel op
   de server maar niet in de offline cache, en dat merk je pas zonder bereik.
   BEGIN-ASSETS (niet met de hand bewerken tussen de twee markeringen) */
var ASSETS = [
  "./", "./index.html", "./fonts.css",
  "./css/base.css", "./css/components.css", "./css/pages.css", "./css/print.css",
  "./js/i18n.js", "./js/config.js", "./js/storage.js", "./js/util.js", "./js/data.js",
  "./js/routeProvider.js", "./js/geo.js", "./js/vehicle.js", "./js/trips.js",
  "./js/checklist.js", "./js/costs.js", "./js/calendar.js", "./js/countries.js",
  "./js/planner.js", "./js/pages.js", "./js/map.js", "./js/app.js",
  "./countries.json", "./cities.json", "./borders.json", "./zones.json", "./drukte.json",
  // Zelf gehost, zodat de app offline werkt en er niets naar Google gaat.
  // Variabele assen: één bestand per subset dekt alle gewichten.
  "./fonts/geist-400-latin.woff2",  "./fonts/geist-400-latin-ext.woff2",
  "./fonts/inter-400-latin.woff2",  "./fonts/inter-400-latin-ext.woff2",
  // Bannerfoto's per land voor de Landeninformatie-pagina.
  "./images/Landbanner/Nederland.png",
  "./images/Landbanner/Frankrijk.png",
  "./images/Landbanner/UK.png",
  "./images/Landbanner/Duitsland.png",
  "./images/Landbanner/Oostenrijk.png",
  "./images/Landbanner/Italie.png",
  "./images/Landbanner/Spanje.png",
  "./images/Landbanner/Portugal.png",
  "./images/Landbanner/Kroatie.png",
  "./images/Landbanner/Slovenie.png",
  "./images/Landbanner/Tsjechie.png",
  "./images/Landbanner/Denemarken.png",
  "./images/Landbanner/Zweden.png",
  "./images/Landbanner/Luxemburg.png"
];
/* EIND-ASSETS */

self.addEventListener("install", function(e){
  e.waitUntil(
    caches.open(CACHE)
      .then(function(c){ return c.addAll(ASSETS); })
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
