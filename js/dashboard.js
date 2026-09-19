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

/* ---------------- de route als verhaallijn ----------------
   Elk land een halte op een lijn, met de kilometers die je erin aflegt (uit
   de route-analyse; zonder berekende route alleen de naam). Staat boven het
   dashboard en op de reiskaarten van Mijn reizen. De vlag is hier versiering:
   de landnaam staat ernaast, dus hij is voor schermlezers verborgen. */
function routelijnHTML(trip){
  var landen = tripLanden(trip);
  if(!landen.length) return "";
  var res = tripAnalyse(trip);
  return '<ol class="routelijn" aria-label="' + esc(i18n("planner.landenOpRoute")) + '">' +
    landen.map(function(code){
      var c = BY_CODE[code];
      var km = res && res.km ? res.km[code] : null;
      return '<li><span aria-hidden="true">' + flagHTML(c) + "</span>" +
        '<span class="rl-naam">' + esc(c.name) + "</span>" +
        (km != null && km >= 1
          ? '<span class="rl-km">' + esc(getal(Math.round(km)) + " " + i18n("planner.km")) + "</span>"
          : "") +
      "</li>";
    }).join("") + "</ol>";
}

/* ---------------- kop ---------------- */
function dashboardKopHTML(trip){
  var landen = tripLanden(trip);

  var van = trip.origin ? trip.origin.naam : (landen[0] && BY_CODE[landen[0]].name) || "";
  var naar = trip.destination ? trip.destination.naam
           : (landen.length > 1 ? BY_CODE[landen[landen.length - 1]].name : "");

  return '<header class="dashkop">' +
    deelMeldingHTML() +
    routelijnHTML(trip) +
    "<h1>" + esc(van) + (naar ? " → " + esc(naar) : "") + "</h1>" +
    '<p class="dashmeta">' + esc(reisPeriodeTekst(trip)) + "</p>" +
    '<p class="dashmeta">' + esc(voertuigSamenvatting(trip)) +
      ' <button type="button" class="tekstknop" data-view="wizard" data-wiz-naar="3">' +
      esc(i18n("dashboard.wijzig")) + "</button></p>" +
    '<p class="dashdeel">' + deelKnopHTML() + "</p>" +
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
    '<h2 class="groot">' + kopHTML("dashboard.klaar", { pct:pct }) + "</h2>" +
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
   Blokkades bovenaan, daarna de openstaande acties op deadline. Dezelfde
   actielijst als op de actiepagina (js/actions.js), alleen ingekort: het
   dashboard toont wat er nu speelt, de actiepagina het geheel. */
function actieRegelHTML(a){
  var land = a.landen[0];
  return '<li class="actierij s-' + esc(a.status) + '">' +
    (land ? flagHTML(land) : iconUse("globe")) +
    '<div class="actietekst">' +
      '<span class="wat">' + esc(a.wat) + "</span>" +
      (a.waarom ? '<span class="waarom">' + esc(a.waarom) + "</span>" : "") +
      (a.deadline ? '<span class="deadlinechip u-' + esc(a.deadline.urgentie) + '">' +
        esc(deadlineTekst(a.deadline)) + "</span>" : "") +
    "</div>" +
    '<span class="actiestatus">' +
      '<span class="teken" aria-hidden="true">' + STATUS_TEKEN[a.status] + "</span>" +
      esc(i18n("status." + a.status)) + "</span>" +
  "</li>";
}

function dashboardActiesHTML(trip){
  var acties = bouwActies(trip);
  var blokkades = acties.filter(function(a){ return a.status === "blokkade"; });
  var open = sorteerActies(acties.filter(function(a){
    return a.status === "actie" && !a.afgevinkt;
  }));

  if(!blokkades.length && !open.length){
    return '<section class="dashkaart dashacties"><h2>' + esc(i18n("dashboard.actiesKop")) + "</h2>" +
      '<p class="leeg">' + iconUse("check") + esc(i18n("dashboard.allesGeregeld")) + "</p></section>";
  }

  var lijst = blokkades.concat(open.slice(0, 5)).map(actieRegelHTML).join("");
  var rest = open.length - Math.min(open.length, 5);
  var meer = rest > 0
    ? '<button type="button" class="tekstknop" data-view="acties">' +
      esc(i18nAantal("dashboard.nogMeer", rest)) + "</button>"
    : "";

  return '<section class="dashkaart dashacties"><h2>' + esc(i18n("dashboard.actiesKop")) + "</h2>" +
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

  var posten = r.items.map(function(it){
      var t = it.actie, land = t.landen[0];
      return "<li>" + (land ? flagHTML(land) : "") +
        '<span class="post">' + esc(t.wat) + "</span>" +
        '<span class="bedrag">' + (it.bedrag
          ? "&euro;" + getal(it.bedrag.laag) + (it.bedrag.hoog !== it.bedrag.laag ? "–&euro;" + getal(it.bedrag.hoog) : "")
          : esc(i18n("dashboard.boete.nietInEuro"))) + "</span>" +
        '<span class="brontekst">' + esc(kortBedrag(t.boete)) + "</span>" +
      "</li>";
    }).join("");

  return '<section class="dashkaart boetekaart">' +
    '<h2>' + iconUse("warning") + esc(i18n("dashboard.boete.kop")) + "</h2>" +
    "<p class=\"boetezin\">" + zin + "</p>" +
    (posten
      ? "<details class=\"boetedetail\"><summary>" + esc(i18n("dashboard.boete.uitsplitsing")) + "</summary>" +
        '<ul class="boetelijst">' + posten + "</ul>" +
        '<p class="hint">' + esc(i18n("dashboard.boete.uitleg")) +
        (r.zonderBoeteData
          ? " " + esc(i18nAantal("dashboard.boete.zonderBedrag", r.zonderBoeteData))
          : "") + "</p></details>"
      : '<p class="hint">' + esc(i18n("dashboard.boete.uitleg")) + "</p>") +
  "</section>";
}

/* ---------------- route en kosten in het kort ---------------- */
function dashboardCijfersHTML(trip){
  var afstand = tripAfstandKm(trip);
  var duur = fmtDuur(tripDuur(trip));
  /* Hetzelfde bedrag als op de kostenpagina, uit dezelfde bron. Deze cel liet
     eerder alleen tol zien terwijl hij "kosten" heette en naar de kostenpagina
     doorklikte; wie daar een hoger getal aantrof, moest raden welke van de twee
     loog. Nu staat er één schatting, hier en daar. */
  var kosten = kostenOverzicht(trip);
  var kostenWaarde = kostenTotaalHTML(kosten);

  function cel(icoon, label, waarde, view){
    return '<button type="button" class="cijfercel" data-view="' + view + '">' +
      '<span class="clbl">' + iconUse(icoon) + esc(label) + "</span>" +
      '<span class="cval">' + waarde + "</span></button>";
  }

  return '<section class="cijfergrid">' +
    cel("ruler", i18n("planner.afstand"),
        afstand ? getal(Math.round(afstand)) + ' <small>' + esc(i18n("planner.km")) + "</small>" : "—", "kaart") +
    cel("clock", i18n("planner.reistijd"), duur || "—", "kaart") +
    /* Een streepje zou hier "nul" of "onbekend" kunnen betekenen, en op een
       route waar wel degelijk een vignet en een sticker op wachten is dat het
       verkeerde antwoord. De kostenpagina legt uit waarom er niets te tellen
       valt; deze cel zegt in één woord dat er iets uit te leggen is. */
    cel("payments", i18n("planner.geschatteKosten"),
        kostenWaarde || esc(i18n("kosten.nietTeBepalen")), "kosten") +
    /* De drukte op je vertrekdag, uit de kalender — alleen als die geladen is. */
    (kalVertrekdagTekst(trip) !== null
      ? cel("calendar", i18n("kalender.vertrekdagKop"), kalVertrekdagTekst(trip), "kalender")
      : "") +
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
