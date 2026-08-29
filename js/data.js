"use strict";
/* Laden van de regeldata, met een keten van terugvallen.

   De regeldata moet kunnen wijzigen zonder dat de app opnieuw uitgerold wordt:
   een vignetprijs of een euronorm-drempel verandert midden in het jaar. Daarom
   staan countries.json, zones.json en drukte.json achter een versioned endpoint
   (zie worker/src/data.js). Maar de app moet ook werken als dat endpoint er niet
   is — op een kale statische host, op file://, of gewoon zonder bereik.

   De volgorde, van vers naar oud:

     1. ./api/v1/data/<bestand>   het endpoint; hier komt een correctie binnen
                                  zonder deploy
     2. ./<bestand>               de meegeleverde kopie naast de app, die de
                                  service worker ook offline heeft
     3. localStorage              een eerder geladen kopie; alleen countries.json
     4. bestandskiezer            file://, waar de browser fetch van een
                                  buurbestand blokkeert

   Welke het werd onthouden we, want stilzwijgend op een oude kopie draaien is
   precies wat deze app niet moet doen: dan zie je verouderde verplichtingen. */

var DATA_ENDPOINT = "./api/v1/data/";
var DATA_BESTANDEN = { "countries.json":1, "zones.json":1, "drukte.json":1 };

/* bestand -> "endpoint" | "bundel" | "opslag" */
var DATA_HERKOMST = {};

/* Eén keer per sessie vaststellen of het endpoint er is. Zonder deze vlag
   klopt elk databestand opnieuw aan bij een host die er geen heeft. */
var DATA_ENDPOINT_ER = null;

function laadData(naam){
  if(!DATA_BESTANDEN[naam]) return loadJSON(naam);

  function viaBundel(){
    return loadJSON(naam).then(function(d){
      DATA_HERKOMST[naam] = "bundel";
      return d;
    });
  }

  if(location.protocol === "file:" || DATA_ENDPOINT_ER === false) return viaBundel();

  return fetch(DATA_ENDPOINT + naam)
    .then(function(r){
      if(!r.ok) throw new Error("HTTP " + r.status);
      return r.json();
    })
    .then(function(d){
      DATA_ENDPOINT_ER = true;
      DATA_HERKOMST[naam] = "endpoint";
      return d;
    })
    .catch(function(){
      /* Eén mislukte poging is genoeg om te weten dat er geen endpoint draait;
         de andere bestanden slaan hem daarna over. */
      if(DATA_ENDPOINT_ER === null) DATA_ENDPOINT_ER = false;
      return viaBundel();
    });
}

/* ---------------- countries.json ----------------
   Dit bestand is de bron van waarheid, dus dit is het enige dat ook een
   localStorage-kopie krijgt: zonder countries.json is er geen app. */
function loadData(){
  return laadData("countries.json")
    .then(function(d){
      if(!d || !d.countries) throw new Error("geen countries-array");
      lsSet(STORE_DATA, JSON.stringify(d));
      return d;
    })
    .catch(function(){
      var cached = lsGet(STORE_DATA);
      if(cached){
        try{
          var d = JSON.parse(cached);
          // Belangrijk om te melden: regels veranderen, en stilzwijgend een oude
          // kopie tonen is precies wat deze app niet moet doen.
          FROM_CACHE = true;
          DATA_HERKOMST["countries.json"] = "opslag";
          return d;
        }catch(e){}
      }
      return null;
    });
}

function showLoadError(){
  var el = document.getElementById("loaderr");
  el.hidden = false;
  document.getElementById("app").hidden = true;
  el.innerHTML =
    '<strong>countries.json kon niet geladen worden.</strong>' +
    '<p style="margin:6px 0 0;font-size:.9rem">Je browser blokkeert het lezen van een databestand naast een pagina die je met ' +
    '<code>file://</code> hebt geopend. Kies het bestand hieronder één keer handmatig — daarna onthoudt deze browser het ' +
    'en werkt de app ook offline zonder server.</p>' +
    '<p style="margin:10px 0 0"><input type="file" id="pick" accept=".json,application/json"></p>' +
    '<p class="hint">Liever structureel? Zet de map online (GitHub Pages) of start een lokale server in deze map, ' +
    'bijvoorbeeld <code>npx serve</code>, en open de app via <code>http://localhost</code>.</p>';
  document.getElementById("pick").addEventListener("change", function(ev){
    var f = ev.target.files && ev.target.files[0];
    if(!f) return;
    var rd = new FileReader();
    rd.onload = function(){
      try{
        var d = JSON.parse(rd.result);
        if(!d || !d.countries) throw new Error("geen countries-array");
        lsSet(STORE_DATA, JSON.stringify(d));
        DATA_HERKOMST["countries.json"] = "bundel";
        el.hidden = true;
        document.getElementById("app").hidden = false;
        boot(d);
      }catch(e){ alert("Dit bestand kon niet gelezen worden als countries.json: " + e.message); }
    };
    rd.readAsText(f);
  });
}

/* Draaien op een opgeslagen kopie is precies wat deze app niet stilzwijgend moet
   doen: regels veranderen, en dan zie je verouderde verplichtingen. */
function meldCachekopie(){
  if(!FROM_CACHE) return;
  var d = document.querySelector(".disclaimer");
  if(!d || d.querySelector(".cachewarn")) return;
  d.open = true;
  var w = document.createElement("p");
  w.className = "body cachewarn";
  w.style.color = "var(--amber)";
  w.textContent = "Let op: de regeldata kon niet opgehaald worden, dus je ziet een eerder " +
    "opgeslagen kopie. Die kan verouderd zijn. Onderzoeksdatum van deze kopie: " +
    fmtDate(DATA.meta.researchDate) + ".";
  var eerste = d.querySelector(".body");
  d.insertBefore(w, eerste ? eerste.nextSibling : null);
}

/* ================= gewone bestanden ================= */

function loadJSON(file){
  return fetch(file, { cache:"force-cache" }).then(function(r){
    if(!r.ok) throw new Error("HTTP " + r.status);
    return r.json();
  });
}
