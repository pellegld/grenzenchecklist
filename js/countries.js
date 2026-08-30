"use strict";
/* De correctielink: het instappunt voor gebruikerscorrecties (§14A).

   Hij hing tot nu toe onder de landkaart en is daarmee onvindbaar voor wie een
   fout ziet bij één regel. Nu staat hij bij elke actie en bij elke sectie van de
   regelpagina, en draagt hij het `id` van het feit waar je op klikte. Een
   binnenkomende melding is daarmee ondubbelzinnig aan één feit te koppelen in
   plaats van aan een heel land — precies waar V2_AUDIT.md §4 op mikte.

   Er staat bewust geen e-mailadres in de data: een mailto op een publieke
   pagina is binnen dagen geoogst. Twee routes dus, allebei zonder adres. Met
   meta.correctionFormUrl gaat de knop naar een formulier; zonder zet hij een
   ingevulde melding op het klembord. Werkt de klembord-API niet (file://, of
   een browser die hem blokkeert), dan verschijnt een tekstvak. */

/* De melding die op het klembord belandt. Het feit-id staat erin zodat een
   correctie aan één regel te koppelen is; ontbreekt het (een actie die uit
   meerdere feiten volgt), dan blijft het bij het land. */
function correctionTekst(c, factId){
  return i18n("correctie.tekst", {
    land: c.name,
    code: c.code,
    feit: factId ? i18n("correctie.feitRegel", { id:factId }) : "",
    datum: c.lastVerified || i18n("correctie.onbekend"),
    bron: c.sourceUrl || "—"
  });
}

function correctionLinks(c, factId){
  var m = (DATA && DATA.meta) || {};
  if(m.correctionFormUrl){
    var u = m.correctionFormUrl
      .replace(/\{CODE\}/g, encodeURIComponent(c.code))
      .replace(/\{NAME\}/g, encodeURIComponent(c.name))
      .replace(/\{ID\}/g, encodeURIComponent(factId || ""));
    return '<a class="meldlink" href="' + esc(u) + '" target="_blank" rel="noopener">' +
      esc(i18n("correctie.knop")) + '</a>';
  }
  return '<button type="button" class="meldlink" data-melden="' + esc(c.code) + '"' +
    (factId ? ' data-melden-feit="' + esc(factId) + '"' : "") + '>' +
    esc(i18n("correctie.knop")) + "</button>";
}

function kopieerMelding(code, factId, link){
  var c = BY_CODE[code];
  if(!c) return;
  var tekst = correctionTekst(c, factId);

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

/* Terugval zonder klembord-API: een tekstvak waaruit je met de hand kopieert.
   Sluit met Escape, met de knop, of met een klik ernaast; de focus gaat daarna
   terug naar de knop waarmee je hem opende (§21). */
var MELD_HERKOMST = null;

function toonMelding(tekst){
  var dlg = document.getElementById("melddialoog");
  if(!dlg){ alert(tekst); return; }
  var ta = dlg.querySelector("textarea");
  ta.value = tekst;
  dlg.hidden = false;
  ta.focus();
  ta.select();
}

function sluitMelding(){
  var dlg = document.getElementById("melddialoog");
  if(!dlg || dlg.hidden) return;
  dlg.hidden = true;
  if(MELD_HERKOMST && document.contains(MELD_HERKOMST)) MELD_HERKOMST.focus();
  MELD_HERKOMST = null;
}
