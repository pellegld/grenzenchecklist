"use strict";
/* Routeprovider-abstractielaag — §18A van de masterprompt, A3 van de roadmap.

   Het probleem dat dit oplost: de app draait op de OSRM-demoserver en Nominatim.
   Allebei expliciet niet-commercieel, zonder uptime-garantie, begrensd op
   ongeveer één aanvraag per seconde. Zodra hier echt verkeer op komt is dat een
   blocker, geen randgeval.

   Dit bestand kiest géén nieuwe provider — dat hoort bij een latere fase, zodra
   er verkeer is en de tarieven te vergelijken zijn. Het zorgt er alleen voor dat
   die keuze later één regel configuratie is in plaats van een verbouwing van de
   wizard, de kaart en de state-laag.

   De interface, neutraal en zonder providerbegrippen erin:

     RouteProvider.getRoute(van, naar, opties) -> Promise<Route>
     RouteProvider.geocode(zoekterm, opties)   -> Promise<Plaats[]>
     RouteProvider.reverseGeocode(lat, lon, o) -> Promise<Plaats|null>

   met

     Punt   { lat, lon }
     Route  { coordinates:[[lon,lat],...], meters, seconds, provider }
     Plaats { naam, omschrijving, land, lat, lon }

   De rest van de app kent alleen deze vormen. Dat is niet toevallig: de
   landdetectie in js/geo.js draait op de coördinaten en verder op niets, dus een
   andere router verandert daar niets aan.

   Let op: hier staat met opzet GEEN sleutelveld. Alles wat de browser meekrijgt
   is publiek, ook een sleutel die je "alleen in de JS" zet. Een dienst met een
   sleutel hoort achter de proxy op je eigen domein, met de sleutel in een
   omgevingsvariabele. Zie worker/ en functions/api/. */

/* ================= configuratie =================

   mode:
     "auto"  loopt de keten af zoals hij hieronder staat
     "proxy" alleen je eigen proxy; faalt hij, dan is er geen route
     "open"  alleen de sleutelloze publieke diensten (OSRM-demo, Nominatim)

   keten: de volgorde waarin implementaties geprobeerd worden. Overstappen op
   een betaalde provider is straks: zet hem vooraan in deze lijst. */
var DIENSTEN = {
  mode: "auto",
  keten: ["proxy", "osrm-demo"],
  proxyBase: "./api",
  osrm: "https://router.project-osrm.org/route/v1/driving/",
  nominatim: "https://nominatim.openstreetmap.org"
};

/* Welke implementatie het uiteindelijk deed. Blijft null tot de eerste aanroep
   en wordt in de planner zichtbaar gemaakt: stil terugvallen op een demoserver
   is precies wat je in productie niet pas wil merken als het te laat is. */
var DIENST_IN_GEBRUIK = null;

/* ================= foutsoorten =================
   De UI moet twee dingen uit elkaar kunnen houden: "deze ene dienst deed het
   niet" (probeer de volgende) en "geen enkele dienst deed het" (bied de
   handmatige landenkeuze aan). Daarom draagt de fout dat zelf. */
function dienstError(bericht, extra){
  var e = new Error(bericht);
  if(extra) for(var k in extra) e[k] = extra[k];
  return e;
}

function dienstFout(r){
  if(r.status === 429) throw dienstError("te veel aanvragen — probeer het zo nog eens", { tijdelijk:true });
  throw dienstError("HTTP " + r.status);
}

/* ================= implementatie: proxy =================
   Je eigen backend. Welke dienst daarachter zit weet de client niet, en dat is
   precies de bedoeling: de sleutel blijft aan die kant. */

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

var PROVIDER_PROXY = {
  naam: "proxy",
  omschrijving: "Berekend via je eigen proxy.",

  beschikbaar: proxyBeschikbaar,

  getRoute: function(van, naar){
    var url = DIENSTEN.proxyBase + "/route" +
      "?from=" + van.lon + "," + van.lat + "&to=" + naar.lon + "," + naar.lat;
    return fetch(url).then(function(r){
      if(!r.ok) dienstFout(r);
      return r.json();
    }).then(function(j){
      if(!j.coordinates || !j.coordinates.length){
        throw dienstError(j.error || "geen route gevonden");
      }
      return {
        coordinates: j.coordinates,
        meters: j.meters || 0,
        seconds: j.seconds || 0,
        provider: j.provider || "proxy"
      };
    });
  },

  /* Het proxycontract levert al genormaliseerde treffers, zodat het niet
     uitmaakt welke dienst erachter zit. */
  geocode: function(zoekterm){
    var url = DIENSTEN.proxyBase + "/geocode?q=" + encodeURIComponent(zoekterm);
    return fetch(url).then(function(r){
      if(!r.ok) dienstFout(r);
      return r.json();
    }).then(function(j){ return (j.results || []).map(naarPlaats); });
  },

  reverseGeocode: function(lat, lon){
    var url = DIENSTEN.proxyBase + "/geocode?lat=" + lat + "&lon=" + lon;
    return fetch(url).then(function(r){
      if(!r.ok) dienstFout(r);
      return r.json();
    }).then(function(j){
      var eerste = (j.results || [])[0];
      return eerste ? naarPlaats(eerste) : null;
    });
  }
};

/* ================= implementatie: osrm-demo =================
   De sleutelloze publieke diensten: OSRM voor de route, Nominatim voor het
   zoeken. Dit is wat de app tot nu toe deed, nu achter dezelfde interface als
   al het andere.

   Waarom het zo blijft heten: deze naam mag in de UI verschijnen, en "demo" is
   de eerlijkste samenvatting van wat je krijgt. */
var PROVIDER_OSRM_DEMO = {
  naam: "osrm-demo",
  omschrijving: "Berekend via de OSRM-demoserver — die is niet voor productie bedoeld.",

  beschikbaar: function(){ return Promise.resolve(DIENSTEN.mode !== "proxy"); },

  getRoute: function(van, naar){
    var url = DIENSTEN.osrm + van.lon + "," + van.lat + ";" + naar.lon + "," + naar.lat +
              "?overview=full&geometries=geojson&alternatives=false&steps=false";
    return fetch(url).then(function(r){
      if(!r.ok) dienstFout(r);
      return r.json();
    }).then(function(j){
      if(j.code !== "Ok" || !j.routes || !j.routes.length){
        throw dienstError(j.message || "geen route gevonden");
      }
      var route = j.routes[0];
      return {
        coordinates: route.geometry.coordinates,
        meters: route.distance || 0,
        seconds: route.duration || 0,
        provider: "osrm-demo"
      };
    });
  },

  geocode: function(zoekterm){
    var url = DIENSTEN.nominatim + "/search" +
      "?format=jsonv2&limit=5&addressdetails=1&accept-language=nl&q=" + encodeURIComponent(zoekterm);
    return fetch(url).then(function(r){
      if(!r.ok) dienstFout(r);
      return r.json();
    }).then(function(lijst){ return lijst.map(naarPlaatsNominatim); });
  },

  reverseGeocode: function(lat, lon){
    var url = DIENSTEN.nominatim + "/reverse" +
      "?format=jsonv2&addressdetails=1&accept-language=nl&lat=" + lat + "&lon=" + lon;
    return fetch(url).then(function(r){
      if(!r.ok) dienstFout(r);
      return r.json();
    }).then(function(h){ return h && h.lat ? naarPlaatsNominatim(h, true) : null; });
  }
};

/* ================= implementatie: graphhopper =================
   Bewust leeg, met dezelfde signatuur als hierboven. Twee redenen dat hij er
   toch staat:

   1. Hij bewijst dat de interface klopt. Een abstractielaag met precies één
      implementatie erachter is geen abstractielaag maar een omweg; pas met een
      tweede zie je of de vorm de provider echt niet doorlaat.
   2. Hij is de plek waar de overstap landt zodra die aan de beurt is (P3-29 in
      de masterprompt).

   Waarom hij hier niet ingevuld wordt: GraphHopper wil een sleutel, en een
   sleutel in de browser is een publieke sleutel. De echte aanroep hoort dus
   achter de proxy — die kan het al, zie worker/src/route.js met
   ROUTE_PROVIDER=graphhopper. Vanuit de client is "graphhopper" daarom niet een
   dienst om aan te roepen maar een dienst om te configureren.

   Wil je hem tóch rechtstreeks (alleen zinnig bij een self-hosted GraphHopper
   zonder sleutel op je eigen domein): vul de drie functies in en zet
   "graphhopper" in DIENSTEN.keten. Er hoeft verder niets te veranderen. */
var PROVIDER_GRAPHHOPPER = {
  naam: "graphhopper",
  omschrijving: "Berekend via Graphhopper.",

  beschikbaar: function(){ return Promise.resolve(false); },

  getRoute: function(van, naar, opties){
    return Promise.reject(dienstError(
      "graphhopper is niet ingesteld — zet hem achter de proxy (ROUTE_PROVIDER=graphhopper)",
      { nietIngesteld:true }));
  },

  geocode: function(zoekterm, opties){
    return Promise.reject(dienstError(
      "graphhopper is niet ingesteld — zet hem achter de proxy (GEO_PROVIDER=graphhopper)",
      { nietIngesteld:true }));
  },

  reverseGeocode: function(lat, lon, opties){
    return Promise.reject(dienstError(
      "graphhopper is niet ingesteld — zet hem achter de proxy (GEO_PROVIDER=graphhopper)",
      { nietIngesteld:true }));
  }
};

var IMPLEMENTATIES = {
  "proxy":       PROVIDER_PROXY,
  "osrm-demo":   PROVIDER_OSRM_DEMO,
  "graphhopper": PROVIDER_GRAPHHOPPER
};

/* ================= normalisatie ================= */

function naarPlaats(h){
  return {
    naam: h.naam || h.name || "",
    omschrijving: h.omschrijving || h.naam || h.name || "",
    land: String(h.land || "").toUpperCase(),
    lat: Number(h.lat),
    lon: Number(h.lon)
  };
}

/* voorkeurPlaats: bij reverse geocoding wil je de plaatsnaam, niet het eerste
   deel van het adres — anders heet je vertrekpunt "12" omdat dat het huisnummer
   was. Bij zoeken op tekst is dat eerste deel juist wél wat je bedoelde
   ("Jahnstraße"), dus daar blijft het zoals het was. */
function naarPlaatsNominatim(h, voorkeurPlaats){
  var a = h.address || {};
  var naam = (voorkeurPlaats && (a.city || a.town || a.village || a.municipality || a.county)) ||
             String(h.display_name || h.name || "").split(",")[0];
  return {
    naam: naam,
    omschrijving: h.display_name || naam,
    land: ((h.address && h.address.country_code) || "").toUpperCase(),
    lat: Number(h.lat),
    lon: Number(h.lon)
  };
}

/* ================= de keten =================

   Loop de implementaties af tot er één antwoord geeft. Faalt de laatste, dan
   krijgt de aanroeper een fout met .handmatig — dat is het signaal voor de UI
   om de handmatige landenkeuze aan te bieden in plaats van doodlopend "Error"
   te tonen (§20).

   Wat hij nadrukkelijk NIET doet: een verzonnen of oude route teruggeven als
   noodoplossing. Een route die er niet is, is geen route. */
function actieveKeten(){
  return DIENSTEN.keten
    .map(function(naam){ return IMPLEMENTATIES[naam]; })
    .filter(Boolean);
}

function probeerKeten(bewerking, uitvoeren){
  var keten = actieveKeten();
  var fouten = [];

  function volgende(i){
    if(i >= keten.length){
      var reden = fouten.length ? fouten.join("; ") : "geen dienst beschikbaar";
      return Promise.reject(dienstError(reden, { handmatig:true, bewerking:bewerking }));
    }
    var impl = keten[i];
    return impl.beschikbaar().then(function(ja){
      if(!ja) return volgende(i + 1);
      return uitvoeren(impl).then(function(uit){
        DIENST_IN_GEBRUIK = (uit && uit.provider) || impl.naam;
        return uit;
      }, function(err){
        fouten.push(impl.naam + ": " + (err && err.message || err));
        return volgende(i + 1);
      });
    }, function(){ return volgende(i + 1); });
  }
  return volgende(0);
}

var RouteProvider = {
  /* van/naar zijn { lat, lon }. opties is nu nog ongebruikt en staat er zodat
     latere wensen (vermijd tol, vertrektijd, alternatieven) geen wijziging aan
     de aanroepende kant vragen — de providers die dat kunnen lezen hem uit, de
     rest negeert hem. */
  getRoute: function(van, naar, opties){
    return probeerKeten("route", function(impl){
      return impl.getRoute(van, naar, opties || {});
    });
  },

  geocode: function(zoekterm, opties){
    return probeerKeten("geocode", function(impl){
      return impl.geocode(zoekterm, opties || {});
    });
  },

  reverseGeocode: function(lat, lon, opties){
    return probeerKeten("reverse", function(impl){
      return impl.reverseGeocode(lat, lon, opties || {});
    });
  },

  /* Welke implementatie het laatst leverde, en hoe dat in gewone taal heet. */
  inGebruik: function(){ return DIENST_IN_GEBRUIK; },

  notitie: function(){
    if(!DIENST_IN_GEBRUIK) return "";
    var impl = IMPLEMENTATIES[DIENST_IN_GEBRUIK];
    /* De proxy meldt zelf welke dienst hij gebruikte; die naam kennen we hier
       niet altijd als implementatie. */
    var tekst = impl ? impl.omschrijving : "Berekend via " + DIENST_IN_GEBRUIK + ".";
    return " " + tekst;
  },

  /* Voor tests en voor de instellingen later: wie zit er in de keten. */
  keten: function(){ return actieveKeten().map(function(i){ return i.naam; }); }
};
