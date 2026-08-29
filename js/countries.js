"use strict";
/* Landkaart-onderdelen en de correctielink per land.
   
   countryCard()/renderCountries() zijn dormant sinds de Landeninformatie-pagina
   die rol overnam; correctionLinks() is wel in gebruik en is het instappunt voor
   de latere correctie-flow (zie V2_AUDIT.md §4). */

/* ---------------- render: country cards (dormant tot Landeninformatie-pagina) ---------------- */
function eqBadge(it, c){
  var eff = effectiveStatus(it, c);
  if(eff === "must")   return '<span class="badge b-must">verplicht — boete mogelijk</span>';
  if(eff === "advice") return '<span class="badge b-advice">aanbevolen</span>';
  return '<span class="badge b-na">alleen voor ' + esc(c.name) + 's kenteken</span>';
}

function correctionTekst(c){
  return "Grenschecklist — correctie " + c.name + " (" + c.code + ")\n" +
    "Laatst geverifieerd in de app: " + (c.lastVerified || "onbekend") + "\n" +
    "Bron in de app: " + (c.sourceUrl || "—") + "\n\n" +
    "Wat klopt er niet:\n\n\n" +
    "Bron waaruit dat blijkt:\n";
}

function correctionLinks(c){
  var m = DATA.meta || {};
  if(m.correctionFormUrl){
    var u = m.correctionFormUrl
      .replace(/\{CODE\}/g, encodeURIComponent(c.code))
      .replace(/\{NAME\}/g, encodeURIComponent(c.name));
    return '<a href="' + esc(u) + '" target="_blank" rel="noopener">Klopt dit niet? Meld het</a>';
  }
  return '<a href="#" data-melden="' + esc(c.code) + '">Klopt dit niet? Kopieer een melding</a>';
}

function kopieerMelding(code, link){
  var c = BY_CODE[code];
  if(!c) return;
  var tekst = correctionTekst(c);

  function gelukt(){
    var oud = link.getAttribute("data-oud") || link.textContent;
    link.setAttribute("data-oud", oud);
    link.textContent = "Gekopieerd — plak het in een mail of bericht";
    setTimeout(function(){ link.textContent = oud; }, 4000);
  }

  if(navigator.clipboard && navigator.clipboard.writeText){
    navigator.clipboard.writeText(tekst).then(gelukt, function(){ toonMelding(tekst); });
  } else {
    toonMelding(tekst);
  }
}

function toonMelding(tekst){
  var dlg = document.getElementById("melddialoog");
  if(!dlg) return;
  var ta = dlg.querySelector("textarea");
  ta.value = tekst;
  dlg.hidden = false;
  ta.focus();
  ta.select();
}

function speedRow(lbl, val){
  return val ? '<p class="kv"><b>' + lbl + ':</b> ' + esc(val) + '</p>' : "";
}

function countryCard(c, i){
  return "";
}

function renderCountries(){
  var box = document.getElementById("countries");
  if(!box) return;
  box.innerHTML = "";
}
