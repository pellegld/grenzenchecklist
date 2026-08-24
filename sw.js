/* Grenschecklist service worker.
   Doel: de app draait volledig offline zodra je hem één keer met bereik hebt geopend.
   Dat is precies het scenario waarvoor de app bedoeld is — vlak voor vertrek, op een
   parkeerplaats zonder dekking.

   Strategie: stale-while-revalidate. Je krijgt altijd meteen de gecachte versie
   (dus ook zonder netwerk), en op de achtergrond wordt de cache ververst zodat een
   bijgewerkte countries.json de volgende keer vanzelf verschijnt.

   Bump CACHE bij een release waarin je oude bestanden echt wil opruimen. */

var CACHE = "grenschecklist-v9";
var ASSETS = [
  "./", "./index.html", "./fonts.css",
  "./countries.json", "./cities.json", "./borders.json", "./zones.json", "./drukte.json",
  // Zelf gehost, zodat de app offline werkt en er niets naar Google gaat.
  // Variabele assen: één bestand per subset dekt alle gewichten.
  "./fonts/manrope-400-latin.woff2",       "./fonts/manrope-400-latin-ext.woff2",
  "./fonts/jetbrainsmono-400-latin.woff2", "./fonts/jetbrainsmono-400-latin-ext.woff2"
];

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
  if(new URL(req.url).origin !== self.location.origin) return;

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
