"use strict";
/* ---------------- loading ----------------
   countries.json is the single source of truth. Browsers block fetch() of a
   sibling file over file://, so we fall back to a cached copy and finally to a
   manual file picker; whatever we get is cached so later file:// opens work. */
function loadData(){
  return fetch("countries.json",{cache:"no-store"})
    .then(function(r){ if(!r.ok) throw new Error("HTTP "+r.status); return r.json(); })
    .then(function(d){ lsSet(STORE_DATA, JSON.stringify(d)); return d; })
    .catch(function(){
      var cached = lsGet(STORE_DATA);
      if(cached){
        try{
          var d = JSON.parse(cached);
          // Belangrijk om te melden: regels veranderen, en stilzwijgend een oude
          // kopie tonen is precies wat deze app niet moet doen.
          FROM_CACHE = true;
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
  w.textContent = "Let op: countries.json kon niet opgehaald worden, dus je ziet een eerder " +
    "opgeslagen kopie. Die kan verouderd zijn. Onderzoeksdatum van deze kopie: " +
    fmtDate(DATA.meta.researchDate) + ".";
  var eerste = d.querySelector(".body");
  d.insertBefore(w, eerste ? eerste.nextSibling : null);
}

/* ================= routeplanner: data en zoeken ================= */

function loadJSON(file){
  return fetch(file, { cache:"force-cache" }).then(function(r){
    if(!r.ok) throw new Error("HTTP " + r.status);
    return r.json();
  });
}
