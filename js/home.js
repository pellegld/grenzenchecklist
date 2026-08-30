"use strict";
/* De homepage — §4 van de masterprompt.

   Eén taak: binnen een schermhoogte duidelijk maken wat dit is en één knop
   aanbieden. Alles eronder is onderbouwing, geen navigatie.

   Het voorbeeld Brussel → Salzburg is een statische illustratie en geen
   berekening. Dat staat er ook bij, met zoveel woorden en met een label op de
   kaart zelf: een voorbeeldscherm dat eruitziet als jouw uitkomst is precies de
   schijnzekerheid die deze app niet moet verkopen. De getallen komen letterlijk
   uit de masterprompt en zijn niet uit countries.json afgeleid. */

var VOORBEELD = {
  van: "Brussel", naar: "Salzburg",
  landen: ["BE", "DE", "AT"],
  km: 742, duur: "8u12",
  pct: 72, gedaan: 7, acties: 2, problemen: 1,
  kostenLaag: 155, kostenHoog: 180
};

function voorbeeldKaartHTML(){
  var vlaggen = VOORBEELD.landen.map(function(code){
    var c = BY_CODE[code];
    return c ? flagHTML(c) : "";
  }).join('<span class="pijl" aria-hidden="true">→</span>');

  return (
    '<figure class="voorbeeldkaart">' +
      '<figcaption class="voorbeeldlabel">' + esc(i18n("home.voorbeeldLabel")) + "</figcaption>" +
      '<div class="vbkop"><h3>' + esc(VOORBEELD.van) + " → " + esc(VOORBEELD.naar) + "</h3>" +
        '<div class="vbvlaggen">' + vlaggen + "</div></div>" +
      '<p class="vbmeta">' +
        esc(getal(VOORBEELD.km) + " " + i18n("planner.km")) + " · " + esc(VOORBEELD.duur) + " · " +
        esc(i18nAantal("reizen.landen", VOORBEELD.landen.length)) + "</p>" +

      '<div class="vbprogress"><div class="prow">' +
        '<span class="plbl">' + esc(i18n("dashboard.voortgang")) + "</span>" +
        '<span class="pval">' + esc(i18n("checklist.gereed", { pct:VOORBEELD.pct })) + "</span></div>" +
        '<div class="progressbar"><i style="width:' + VOORBEELD.pct + '%"></i></div></div>' +

      '<ul class="vbstatus">' +
        '<li class="s-ok"><b>' + VOORBEELD.gedaan + "</b> " + esc(i18n("dashboard.geregeld")) + "</li>" +
        '<li class="s-todo"><b>' + VOORBEELD.acties + "</b> " + esc(i18nAantal("dashboard.acties", VOORBEELD.acties)) + "</li>" +
        '<li class="s-bad"><b>' + VOORBEELD.problemen + "</b> " + esc(i18nAantal("dashboard.problemen", VOORBEELD.problemen)) + "</li>" +
      "</ul>" +

      '<p class="vbkosten"><span>' + esc(i18n("home.geschatteKosten")) + "</span>" +
        "<b>&euro;" + getal(VOORBEELD.kostenLaag) + "–&euro;" + getal(VOORBEELD.kostenHoog) + "</b></p>" +
    "</figure>"
  );
}

/* Drie stappen, in de volgorde waarin de wizard ze stelt. Geen marketingtekst:
   dit is letterlijk wat er gebeurt als je op de knop drukt. */
function homeStappenHTML(){
  var stappen = ["route", "auto", "checklist"];
  return '<ol class="homestappen">' + stappen.map(function(s, i){
    return "<li><span class=\"nr\">" + (i + 1) + "</span>" +
      "<h3>" + esc(i18n("home.stap." + s)) + "</h3>" +
      "<p>" + esc(i18n("home.stap." + s + ".uitleg")) + "</p></li>";
  }).join("") + "</ol>";
}

/* Heb je al een reis staan, dan is doorgaan de belangrijkste knop en niet
   "plan een nieuwe". */
function verderKaartHTML(){
  if(!TRIP || !tripIsKlaar(TRIP)) return "";
  var tel = checklistTelling(TRIP);
  var pct = tel.totaal ? Math.round(tel.gedaan / tel.totaal * 100) : 0;
  return '<div class="verderkaart">' +
    "<div><span class=\"lbl\">" + esc(i18n("home.jeReis")) + "</span>" +
      "<h3>" + esc(TRIP.naam) + "</h3>" +
      '<p class="hint">' + esc(i18n("checklist.gereed", { pct:pct })) + " · " +
        esc(i18nAantal("dashboard.openActies", tel.open)) + "</p></div>" +
    '<button type="button" class="btn primary" data-view="dashboard">' +
      esc(i18n("home.verder")) + " " + iconUse("arrow-right") + "</button></div>";
}

function renderHome(){
  var wrap = document.getElementById("home-wrap");
  if(!wrap) return;

  wrap.innerHTML =
    '<section class="hero">' +
      '<div class="herotekst">' +
        "<h1>" + esc(i18n("home.hero")) + "</h1>" +
        '<p class="lead">' + esc(i18n("home.sub")) + "</p>" +
        '<button type="button" class="btn primary groot" id="btn-plan">' +
          esc(i18n("home.cta")) + " " + iconUse("arrow-right") + "</button>" +
        '<ul class="beloftes">' +
          ["gratis", "geenAccount", "privacy", "offline"].map(function(k){
            return "<li>" + iconUse("check") + esc(i18n("home.belofte." + k)) + "</li>";
          }).join("") +
        "</ul>" +
      "</div>" +
      voorbeeldKaartHTML() +
    "</section>" +
    verderKaartHTML() +
    '<section class="homeblok"><h2>' + esc(i18n("home.hoeKop")) + "</h2>" +
      homeStappenHTML() + "</section>" +
    '<section class="homeblok eerlijk"><h2>' + esc(i18n("home.eerlijkKop")) + "</h2>" +
      "<p>" + esc(i18n("home.eerlijkTekst")) + "</p>" +
      '<p class="hint">' + esc(i18n("home.eerlijkDatum", {
        datum: DATA && DATA.meta ? fmtDate(DATA.meta.researchDate) : "—" })) + "</p>" +
    "</section>";
}
