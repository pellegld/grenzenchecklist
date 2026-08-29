"use strict";
/* Aanroepen naar de externe route- en geocodediensten. */

/* ================= externe diensten =================
   Let op: hier staat met opzet GEEN sleutelveld. Alles wat de browser meekrijgt
   is publiek, ook een sleutel die je "alleen in de JS" zet. Wil je een dienst
   met een sleutel gebruiken, zet die dan achter een proxy op je eigen domein en
   laat de sleutel daar in een omgevingsvariabele staan. De client kent dan
   alleen het pad, en er valt niets te lekken.

   mode:
     "auto"  probeert eerst de proxy en valt terug op de sleutelloze dienst
     "proxy" alleen je eigen proxy; faalt hij, dan faalt de planner
     "open"  alleen de sleutelloze publieke diensten (OSRM-demo, Nominatim)

   De proxy moet twee routes aanbieden. Zie functions/api/ voor een werkende
   implementatie en README voor het contract. */
var DIENSTEN = {
  mode: "auto",
  proxyBase: "./api",
  osrm: "https://router.project-osrm.org/route/v1/driving/",
  nominatim: "https://nominatim.openstreetmap.org/search"
};

/* Welke kant het uiteindelijk op ging. Blijft null tot de eerste aanroep, en
   wordt in de planner zichtbaar gemaakt: stil terugvallen op een demoserver is
   precies wat je in productie niet wil. */
var DIENST_IN_GEBRUIK = null;

/* Eenmalig vaststellen of er een proxy draait. Het antwoord wordt onthouden,
   zodat we niet bij elke route opnieuw kloppen. */
var PROXY_CHECK = null;
function proxyBeschikbaar(){
  if(DIENSTEN.mode === "open")  return Promise.resolve(false);
  if(DIENSTEN.mode === "proxy") return Promise.resolve(true);
  if(PROXY_CHECK) return PROXY_CHECK;
  PROXY_CHECK = fetch(DIENSTEN.proxyBase + "/route?ping=1")
    .then(function(r){ return r.ok || r.status === 400; })
    .catch(function(){ return false; });
  return PROXY_CHECK;
}

function dienstFout(r){
  if(r.status === 429) throw new Error("te veel aanvragen — probeer het zo nog eens");
  throw new Error("HTTP " + r.status);
}

/* Terugval voor alles wat niet in de 689 meegeleverde plaatsen zit. Bewust pas
   op een expliciete klik: het beleid van Nominatim staat geen zoeken-tijdens-typen toe. */
function searchOnline(q){
  return proxyBeschikbaar().then(function(viaProxy){
    return viaProxy ? geocodeViaProxy(q) : geocodeViaNominatim(q);
  });
}

/* Het proxycontract levert al genormaliseerde treffers, zodat het niet uitmaakt
   welke dienst erachter zit. */
function geocodeViaProxy(q){
  var url = DIENSTEN.proxyBase + "/geocode?q=" + encodeURIComponent(q);
  return fetch(url).then(function(r){
    if(!r.ok) dienstFout(r);
    return r.json();
  }).then(function(j){
    DIENST_IN_GEBRUIK = j.provider || "proxy";
    return (j.results || []).map(function(h){
      return [h.naam, h.omschrijving || h.naam, (h.land || "").toUpperCase(),
              Number(h.lat), Number(h.lon)];
    });
  });
}

function geocodeViaNominatim(q){
  var url = DIENSTEN.nominatim +
    "?format=jsonv2&limit=5&addressdetails=1&accept-language=nl&q=" + encodeURIComponent(q);
  return fetch(url).then(function(r){
    if(!r.ok) dienstFout(r);
    return r.json();
  }).then(function(list){
    DIENST_IN_GEBRUIK = "nominatim";
    return list.map(function(h){
      var cc = (h.address && h.address.country_code || "").toUpperCase();
      var naam = h.display_name.split(",")[0];
      return [naam, h.display_name, cc, Number(h.lat), Number(h.lon)];
    });
  });
}

/* Levert altijd dezelfde vorm op: { geometry:{ coordinates:[[lon,lat],...] }, distance, duration }.
   De rest van de app kent de provider niet, en dat is precies de bedoeling —
   de landanalyse draait op die coördinaten en verder op niets. */
function fetchRoute(a, b){
  return proxyBeschikbaar().then(function(viaProxy){
    return viaProxy ? routeViaProxy(a, b) : routeViaOsrm(a, b);
  });
}

function routeViaProxy(a, b){
  var url = DIENSTEN.proxyBase + "/route" +
    "?from=" + a[4] + "," + a[3] + "&to=" + b[4] + "," + b[3];
  return fetch(url).then(function(r){
    if(!r.ok) dienstFout(r);
    return r.json();
  }).then(function(j){
    if(!j.coordinates || !j.coordinates.length) throw new Error(j.error || "geen route gevonden");
    DIENST_IN_GEBRUIK = j.provider || "proxy";
    return { geometry:{ coordinates:j.coordinates }, distance:j.meters || 0, duration:j.seconds || 0 };
  });
}

function routeViaOsrm(a, b){
  var url = DIENSTEN.osrm + a[4] + "," + a[3] + ";" + b[4] + "," + b[3] +
            "?overview=full&geometries=geojson&alternatives=false&steps=false";
  return fetch(url).then(function(r){
    if(!r.ok) dienstFout(r);
    return r.json();
  }).then(function(j){
    if(j.code !== "Ok" || !j.routes || !j.routes.length){
      throw new Error(j.message || "geen route gevonden");
    }
    DIENST_IN_GEBRUIK = "osrm-demo";
    return j.routes[0];
  });
}
