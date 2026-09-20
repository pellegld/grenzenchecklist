/* De "mag ik met deze auto <stad> in?"-pagina's (gegenereerd door
   build/build.mjs). Het formulier is een gewone GET naar dezelfde pagina; dit
   script leest de parameters, vraagt zoneStadVerdict() om het oordeel en zet
   het onder het formulier. De zone en de vertaalde etiketten staan in een
   JSON-datablok (#magik-data) in de pagina: een datablok voert niets uit, dus
   de Content-Security-Policy (alleen eigen scriptbestanden) laat hem door. */
(function(){
  "use strict";
  var blok = document.getElementById("magik-data");
  if(!blok) return;
  var D;
  try { D = JSON.parse(blok.textContent); } catch(e){ return; }
  if(D.lang === "en") TAAL = "en";

  function paramsUit(){
    var q = new URLSearchParams(location.search);
    return { fuel: q.get("fuel"), euro: q.get("euro"), plate: q.get("plate") };
  }
  function toon(){
    var q = paramsUit();
    if(!q.fuel) return;
    var f = document.getElementById("f-fuel"); if(f && q.fuel) f.value = q.fuel;
    var e = document.getElementById("f-euro"); if(e && q.euro !== null) e.value = q.euro;
    var pl = document.getElementById("f-plate"); if(pl && q.plate) pl.value = q.plate;

    var trip = { vehicle: { fuel: q.fuel, euro: q.euro ? Number(q.euro) : null, plateCountry: q.plate || "NL" } };
    var v = zoneStadVerdict(D.zone, trip);
    var el = document.getElementById("check-result");
    var brandstofLabel = D.fuelLabel[q.fuel] || q.fuel;
    var euroLabel = q.euro ? "Euro " + q.euro : D.onbekendeEuronorm;
    el.hidden = false;
    el.innerHTML =
      '<div class="oordeel o-' + (v.level === "bad" ? "nee" : v.level === "ok" ? "ja" : v.level === "todo" ? "mits" : "check") + '">' +
      '<span class="teken" aria-hidden="true">' + { ok:"&#10003;", bad:"&#10007;", todo:"!", unknown:"?" }[v.level] + "</span>" +
      "<b>" + esc(v.text) + "</b></div>" +
      '<p class="hint">' + esc(D.antwoordGebaseerdOp) + " " + esc(brandstofLabel) + ", " + esc(euroLabel) +
      (q.plate ? ", " + esc(D.kentekenUit) + " " + esc(q.plate) : "") + ".</p>";
  }
  document.addEventListener("DOMContentLoaded", toon);
})();
