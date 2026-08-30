"use strict";
/* Het reisdashboard — §6 van de masterprompt, plus drie toevoegingen.

   Dit is het scherm waar je op terechtkomt als je reis klaar is, en het moet in
   één blik antwoord geven op: waar ga ik heen, hoe ver ben ik, en wat moet ik
   nu doen. Mobile-first: op een telefoon staat alles onder elkaar in die
   volgorde, op een breed scherm naast elkaar.

   De drie toevoegingen die niet in de masterprompt staan:

   1. Het boetekans-totaal. De app vertelde wél per land welke boete er staat,
      maar nergens wat het samen is. Juist dat getal maakt het verschil tussen
      "een lijstje" en "hier moet ik iets mee". Het rekent alleen over
      openstaande acties en alleen met bedragen die er echt staan (js/facts.js).

   2. De vertrouwensbalk. Hoe zeker is dit? De confidence-velden uit fase A
      stonden in de data maar nergens op het scherm. Nu staat er onderaan wat de
      reis waard is, met een klik naar precies de feiten die onzeker zijn.

   3. Herkomst per actie. De data ligt er (factId/confidence/sourceUrl/
      lastVerified op elke actie, zie js/checklist.js); herkomstRegelHTML() is
      het ene punt waar dat straks een volle regel wordt. */

/* ---------------- kop ---------------- */
function dashboardKopHTML(trip){
  var landen = tripLanden(trip);
  var vlaggen = landen.map(function(code){
    return flagHTML(BY_CODE[code]);
  }).join('<span class="pijl" aria-hidden="true">→</span>');

  var van = trip.origin ? trip.origin.naam : (landen[0] && BY_CODE[landen[0]].name) || "";
  var naar = trip.destination ? trip.destination.naam
           : (landen.length > 1 ? BY_CODE[landen[landen.length - 1]].name : "");

  return '<header class="dashkop">' +
    '<div class="dashvlaggen">' + vlaggen + "</div>" +
    "<h1>" + esc(van) + (naar ? " → " + esc(naar) : "") + "</h1>" +
    '<p class="dashmeta">' + esc(reisPeriodeTekst(trip)) + "</p>" +
    '<p class="dashmeta">' + esc(voertuigSamenvatting(trip)) +
      ' <button type="button" class="tekstknop" data-view="wizard" data-wiz-naar="3">' +
      esc(i18n("dashboard.wijzig")) + "</button></p>" +
  "</header>";
}

/* ---------------- voortgang en statustellers ----------------
   Niet alleen kleur (§21): elke teller draagt een eigen teken en een woord. */
function dashboardVoortgangHTML(trip){
  var tel = checklistTelling(trip);
  var pct = tel.totaal ? Math.round(tel.gedaan / tel.totaal * 100) : 0;

  var tellers = [
    { klasse:"s-ok",   icoon:"check",   n:tel.gedaan,   label:i18n("dashboard.geregeld") },
    { klasse:"s-todo", icoon:"warning", n:tel.open,     label:i18nAantal("dashboard.acties", tel.open) },
    { klasse:"s-bad",  icoon:"block",   n:tel.blockers, label:i18nAantal("dashboard.problemen", tel.blockers) },
    { klasse:"s-info", icoon:"info",    n:tel.warnings, label:i18n("dashboard.waarschuwingen") }
  ].filter(function(t){ return t.n > 0 || t.klasse === "s-ok" || t.klasse === "s-todo"; });

  return '<section class="dashkaart voortgang">' +
    '<h2 class="groot">' + esc(i18n("dashboard.klaar", { pct:pct })) + "</h2>" +
    '<div class="progressbar" role="progressbar" aria-valuenow="' + pct +
      '" aria-valuemin="0" aria-valuemax="100"><i style="width:' + pct + '%"></i></div>' +
    '<ul class="statustellers">' + tellers.map(function(t){
      return '<li class="' + t.klasse + '">' + iconUse(t.icoon) +
        "<b>" + t.n + "</b> <span>" + esc(t.label) + "</span></li>";
    }).join("") + "</ul>" +
    '<button type="button" class="btn primary wide" data-view="acties">' +
      esc(i18n("dashboard.naarActies")) + " " + iconUse("arrow-right") + "</button>" +
  "</section>";
}

/* ---------------- eerst regelen ----------------
   Blokkades bovenaan, daarna de openstaande acties. Elke regel zegt waaróm hij
   er staat (het land en de reden) en draagt de herkomstlink. */
function actieRegelHTML(t, soort){
  var land = t.c ? t.c : (t.cs && t.cs[0]);
  return '<li class="actierij ' + soort + '">' +
    (land ? flagHTML(land) : iconUse("globe")) +
    '<div class="actietekst">' +
      '<span class="wat">' + esc(t.what) + "</span>" +
      (t.meta ? '<span class="waarom">' + esc(t.meta) + "</span>" : "") +
      herkomstRegelHTML(t) +
    "</div>" +
    '<span class="actiestatus">' + esc(i18n("status." + soort)) + "</span>" +
  "</li>";
}

function dashboardActiesHTML(trip){
  var T = buildTasks(trip);
  var open = T.todo.filter(function(t){ return !isAangevinkt(trip, "task:" + t.key); });
  if(!T.blockers.length && !open.length){
    return '<section class="dashkaart"><h2>' + esc(i18n("dashboard.actiesKop")) + "</h2>" +
      '<p class="leeg">' + iconUse("check") + esc(i18n("dashboard.allesGeregeld")) + "</p></section>";
  }

  var lijst = T.blockers.map(function(t){ return actieRegelHTML(t, "blokkade"); })
    .concat(open.slice(0, 5).map(function(t){ return actieRegelHTML(t, "actie"); })).join("");

  var meer = open.length > 5
    ? '<button type="button" class="tekstknop" data-view="acties">' +
      esc(i18nAantal("dashboard.nogMeer", open.length - 5)) + "</button>"
    : "";

  return '<section class="dashkaart"><h2>' + esc(i18n("dashboard.actiesKop")) + "</h2>" +
    '<ul class="actielijst">' + lijst + "</ul>" + meer + "</section>";
}

/* ---------------- toevoeging 1: het boetekans-totaal ----------------

   "Als je niets regelt loop je op deze route circa X risico." Eén getal dat de
   losse boetebedragen bij elkaar optelt, want los zegt 68 euro niets en samen
   zegt het of je vanavond nog iets moet regelen.

   Drie regels waar niet van afgeweken wordt:
   - alleen openstaande acties; wat af is, is geen risico meer;
   - alleen bedragen die als euro's in de data staan. Een boete in frank of
     pond wordt niet omgerekend — dat zou een koers verzinnen;
   - staat er een boete zonder eurobedrag, dan verschijnt "of meer" achter het
     totaal en staat die post gewoon in de lijst eronder. */
function boetekansHTML(trip){
  var r = boeteRisico(trip);
  if(!r.open) return "";

  var bedrag;
  if(r.metBedrag === 0){
    bedrag = null;
  } else if(r.laag === r.hoog){
    bedrag = "&euro;" + getal(r.hoog);
  } else {
    bedrag = "&euro;" + getal(r.laag) + "–&euro;" + getal(r.hoog);
  }

  /* De zin komt heel uit de vertaaltabel (§17A) en krijgt het bedrag als
     plaatshouder; dat bedrag is hier zelf opgebouwd uit getallen, dus die HTML
     is van ons en niet uit de data. */
  var zin = bedrag
    ? i18n("dashboard.boete.zin", {
        bedrag: "<b>" + bedrag +
          (r.ofMeer ? ' <small>' + esc(i18n("planner.ofMeer")) + "</small>" : "") + "</b>"
      })
    : esc(i18n("dashboard.boete.geenBedrag"));

  var posten = r.items.filter(function(it){ return it.bedrag || it.actie.fineIndication; })
    .map(function(it){
      var t = it.actie;
      return "<li>" + (t.c ? flagHTML(t.c) : "") +
        '<span class="post">' + esc(t.what) + "</span>" +
        '<span class="bedrag">' + (it.bedrag
          ? "&euro;" + getal(it.bedrag.laag) + (it.bedrag.hoog !== it.bedrag.laag ? "–&euro;" + getal(it.bedrag.hoog) : "")
          : esc(i18n("dashboard.boete.nietInEuro"))) + "</span>" +
        (t.fineIndication ? '<span class="brontekst">' + esc(kortBedrag(t.fineIndication)) + "</span>" : "") +
      "</li>";
    }).join("");

  return '<section class="dashkaart boetekaart">' +
    '<h2>' + iconUse("warning") + esc(i18n("dashboard.boete.kop")) + "</h2>" +
    "<p class=\"boetezin\">" + zin + "</p>" +
    (posten
      ? "<details class=\"boetedetail\"><summary>" + esc(i18n("dashboard.boete.uitsplitsing")) + "</summary>" +
        '<ul class="boetelijst">' + posten + "</ul>" +
        '<p class="hint">' + esc(i18n("dashboard.boete.uitleg")) + "</p></details>"
      : '<p class="hint">' + esc(i18n("dashboard.boete.uitleg")) + "</p>") +
  "</section>";
}

/* ---------------- route en kosten in het kort ---------------- */
function dashboardCijfersHTML(trip){
  var afstand = tripAfstandKm(trip);
  var duur = fmtDuur(tripDuur(trip));
  var tol = tolTotaalRetour(trip);

  function cel(icoon, label, waarde, view){
    return '<button type="button" class="cijfercel" data-view="' + view + '">' +
      '<span class="clbl">' + iconUse(icoon) + esc(label) + "</span>" +
      '<span class="cval">' + waarde + "</span></button>";
  }

  return '<section class="cijfergrid">' +
    cel("ruler", i18n("planner.afstand"),
        afstand ? getal(Math.round(afstand)) + ' <small>' + esc(i18n("planner.km")) + "</small>" : "—", "kaart") +
    cel("clock", i18n("planner.reistijd"), duur || "—", "kaart") +
    cel("payments", i18n("planner.verwachteTol"),
        tol ? "&euro;" + euroTekst(tol.bedrag) +
          (tol.zeker ? "" : ' <small>' + esc(i18n("planner.ofMeer")) + "</small>") : "—", "kosten") +
  "</section>";
}

/* ---------------- toevoeging 2: de vertrouwensbalk ----------------

   Onderaan, want het is geen actie maar een verantwoording. Klikbaar naar de
   feiten die onzeker zijn: een balk die alleen een getal noemt en je daarna
   laat zoeken, is een balk die niemand gebruikt. */
function vertrouwensbalkHTML(trip){
  var v = vertrouwenTelling(trip);
  if(!v.totaal) return "";

  var zin = i18n("vertrouwen.zin", { n:v.totaal, official:v.official,
                                     verified:v.verified, uncertain:v.uncertain }) +
    (v.unavailable ? " " + i18n("vertrouwen.nietBeschikbaar", { n:v.unavailable }) : "");

  var datum = v.laatstGecontroleerd
    ? i18n("vertrouwen.laatst", { datum:fmtDate(v.laatstGecontroleerd) })
    : i18n("vertrouwen.geenDatum");

  var onzeker = v.onzekereFeiten.map(function(f){
    return "<li>" + (f.land ? flagHTML(f.land) : iconUse("globe")) +
      '<div><span class="wat">' + esc(f.label || f.id) + "</span>" +
      (f.verificationNote ? '<span class="waarom">' + esc(kortZin(f.verificationNote)) + "</span>" : "") +
      (f.sourceUrl
        ? '<a class="herkomst" href="' + esc(f.sourceUrl) + '" target="_blank" rel="noopener">' +
          esc(i18n("actie.officieleBron")) + "</a>"
        : "") + "</div>" +
      '<span class="niveau n-' + f.confidence + '">' + esc(i18n("confidence." + f.confidence)) + "</span></li>";
  }).join("");

  return '<section class="vertrouwensbalk' + (v.verouderd ? " verouderd" : "") + '">' +
    '<p class="vzin">' + esc(zin) + "</p>" +
    '<p class="vdatum">' + esc(datum) +
      (v.verouderd ? ' <span class="vwaarschuwing">' + esc(i18n("vertrouwen.verouderd")) + "</span>" : "") + "</p>" +
    (onzeker
      ? '<details class="vdetail" id="onzekere-feiten"><summary>' +
        esc(i18nAantal("vertrouwen.bekijkOnzeker", v.onzekereFeiten.length)) + "</summary>" +
        '<ul class="feitenlijst">' + onzeker + "</ul>" +
        '<p class="hint">' + esc(i18n("vertrouwen.uitleg")) + "</p></details>"
      : '<p class="hint">' + esc(i18n("vertrouwen.allesZeker")) + "</p>") +
  "</section>";
}

/* ---------------- lege staat ---------------- */
function dashboardLeegHTML(){
  return '<div class="leegstaat">' + iconUse("journey").replace('class="icon sm"', 'class="icon lg"') +
    "<h1>" + esc(i18n("dashboard.leegKop")) + "</h1>" +
    "<p>" + esc(i18n("dashboard.leegTekst")) + "</p>" +
    '<button type="button" class="btn primary groot" data-view="wizard">' +
      esc(i18n("home.cta")) + " " + iconUse("arrow-right") + "</button></div>";
}

function renderDashboard(){
  var wrap = document.getElementById("dashboard-wrap");
  if(!wrap || !TRIP || !DATA) return;
  if(!tripIsKlaar(TRIP)){ wrap.innerHTML = dashboardLeegHTML(); return; }

  wrap.innerHTML =
    dashboardKopHTML(TRIP) +
    '<div class="dashgrid">' +
      '<div class="dashkolom">' +
        dashboardVoortgangHTML(TRIP) +
        dashboardActiesHTML(TRIP) +
      "</div>" +
      '<div class="dashkolom">' +
        dashboardCijfersHTML(TRIP) +
        boetekansHTML(TRIP) +
        '<section class="dashkaart snelkoppelingen">' +
          '<button type="button" class="snelrij" data-view="regels">' + iconUse("flag") +
            esc(i18n("nav.regels")) + iconUse("chevron-right") + "</button>" +
          '<button type="button" class="snelrij" data-view="document">' + iconUse("doc") +
            esc(i18n("nav.document")) + iconUse("chevron-right") + "</button>" +
          '<button type="button" class="snelrij" data-view="reis">' + iconUse("journey") +
            esc(i18n("nav.reis")) + iconUse("chevron-right") + "</button>" +
        "</section>" +
      "</div>" +
    "</div>" +
    vertrouwensbalkHTML(TRIP);
}
