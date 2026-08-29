"use strict";
/* Landkaart-onderdelen en de correctielink per land.
   
   countryCard()/renderCountries() zijn dormant sinds de Landeninformatie-pagina
   die rol overnam; correctionLinks() is wel in gebruik en is het instappunt voor
   de latere correctie-flow (zie V2_AUDIT.md §4). */

/* ---------------- render: country cards (dormant tot Landeninformatie-pagina) ---------------- */
function eqBadge(it, c){
  var eff = effectiveStatus(it, c);
  if(eff === "must")   return '<span class="badge b-must">' + esc(i18n("badge.verplichtBoete")) + '</span>';
  if(eff === "advice") return '<span class="badge b-advice">' + esc(i18n("badge.aanbevolen")) + '</span>';
  return '<span class="badge b-na">' + esc(i18n("badge.alleenVoor", { land:c.name })) + '</span>';
}

function correctionTekst(c){
  return i18n("correctie.tekst", {
    land: c.name,
    code: c.code,
    datum: c.lastVerified || i18n("correctie.onbekend"),
    bron: c.sourceUrl || "—"
  });
}

function correctionLinks(c){
  var m = DATA.meta || {};
  if(m.correctionFormUrl){
    var u = m.correctionFormUrl
      .replace(/\{CODE\}/g, encodeURIComponent(c.code))
      .replace(/\{NAME\}/g, encodeURIComponent(c.name));
    return '<a href="' + esc(u) + '" target="_blank" rel="noopener">' +
      esc(i18n("correctie.meldHet")) + '</a>';
  }
  return '<a href="#" data-melden="' + esc(c.code) + '">' + esc(i18n("correctie.kopieer")) + '</a>';
}

function kopieerMelding(code, link){
  var c = BY_CODE[code];
  if(!c) return;
  var tekst = correctionTekst(c);

  function gelukt(){
    var oud = link.getAttribute("data-oud") || link.textContent;
    link.setAttribute("data-oud", oud);
    link.textContent = i18n("correctie.gekopieerd");
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
