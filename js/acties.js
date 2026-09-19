"use strict";
/* De actiepagina — §7, met §13 (data quality), §16 (bronnen) en §21 (toegankelijkheid).

   De oude checklist toonde drie bento-kaarten: documenten, uitrusting,
   landspecifiek. Dat is een indeling naar hérkomst van de regel, en die
   interesseert niemand die morgen vertrekt. Deze pagina is ingedeeld naar
   handeling en moment: wat blokkeert, wat moet er vóór vertrek geregeld zijn,
   wat moet mee in de auto, wat is verstandig, en wat is alleen om te weten.

   Elke actie draagt vier dingen die er eerder niet stonden:

     een status in woord én teken, nooit alleen in kleur (§21);
     een deadline, gerekend vanaf de vertrekdatum (§8);
     "waarom zie ik dit?" — afgeleid uit de route en het voertuigprofiel;
     de herkomst: betrouwbaarheidsniveau, controledatum, officiële bron, en een
     knop om een fout te melden (§13, §16, §14A). */

/* Status in woord en teken. Het teken is er voor wie geen kleur ziet; het woord
   voor wie het teken niet kent. Kleur is de derde laag, niet de eerste. */
var STATUS_TEKEN = {
  blokkade: "✗",      /* ✗ */
  actie: "!",
  waarschuwing: "i",
  ok: "✓",            /* ✓ */
  onbekend: "?"
};

function statusChipHTML(status){
  return '<span class="statuschip s-' + esc(status) + '">' +
    '<span class="teken" aria-hidden="true">' + STATUS_TEKEN[status] + "</span>" +
    esc(i18n("status." + status)) + "</span>";
}

/* §13: vier niveaus, met de controledatum erbij zodra hij bekend is.

   Zonder feit-id valt er niets over betrouwbaarheid te zeggen: de vier
   universele documenten rusten op geen enkel feit in countries.json. Die
   "unavailable" noemen zou suggereren dat we het probeerden na te zoeken en
   niets vonden, en dat is niet waar. */
function confidenceChipHTML(bron){
  if(!bron || !bron.confidence || !bron.factId) return "";
  return '<span class="niveau n-' + esc(bron.confidence) + '">' +
    esc(i18n("confidence." + bron.confidence)) + "</span>" +
    (bron.lastVerified
      ? '<span class="controledatum">' +
        esc(i18n("bron.gecontroleerdOp", { datum: fmtDate(bron.lastVerified) })) + "</span>"
      : "");
}

/* §13: onzekerheid hoort niet weggestopt te worden achter een uitklap. Wie een
   boete riskeert op basis van een feit dat wij niet hard kunnen maken, moet dat
   zien staan zonder te klikken. */
function onzekerHTML(actie){
  var bron = actie.bron;
  if(!bron || !bron.factId) return "";
  if(bron.confidence !== "uncertain" && bron.confidence !== "unavailable") return "";
  return '<p class="onzeker">' + iconUse("warning") +
    "<span>" + esc(i18n("bron.onzeker")) +
    (bron.verificationNote ? " " + esc(kortZin(bron.verificationNote)) : "") + "</span>" +
    (bron.sourceUrl ? " " + herkomstRegelHTML(actie) : "") + "</p>";
}

function deadlineChipHTML(actie){
  if(!actie.deadline) return "";
  var d = actie.deadline;
  return '<span class="deadlinechip u-' + esc(d.urgentie) + '">' +
    iconUse("calendar") + esc(deadlineTekst(d)) +
    (d.hard ? "" : '<span class="sr"> ' + esc(i18n("deadline.richttijd")) + "</span>") + "</span>";
}

function prijsChipHTML(actie){
  if(!actie.prijs) return "";
  var bedrag = "&euro;" + euroTekst(actie.prijs.bedrag);
  return '<span class="prijschip">' +
    esc(actie.prijs.vanaf ? i18n("actie.prijsVanaf") : i18n("actie.prijs")) + " " + bedrag + "</span>";
}

/* De herkomstregel (§14A, §16). Alles wat over de bron van deze actie te zeggen
   valt staat hier bij elkaar: waarom hij op jouw reis staat, hoe hard het feit
   is, wanneer het gecontroleerd is, waar het vandaan komt, en hoe je het
   corrigeert als het niet klopt. */
function waaromHTML(actie){
  var bron = actie.bron;
  var land = actie.landen[0];
  var melden = land ? correctionLinks(land, bron.factId) : "";

  return '<details class="waarom">' +
    "<summary>" + esc(i18n("actie.waarom")) + "</summary>" +
    '<div class="waarombody">' +
      (actie.waarom ? '<p class="waaromtekst">' + esc(actie.waarom) + "</p>" : "") +
      (actie.boete ? '<p class="boeteregel">' + iconUse("payments") +
        esc(i18n("taak.boeteZonder", { bedrag: kortBedrag(actie.boete) })) + "</p>" : "") +
      '<p class="bronregel">' + confidenceChipHTML(bron) + "</p>" +
      '<p class="bronacties">' + herkomstRegelHTML(actie) +
        (melden ? '<span class="melden">' + melden + "</span>" : "") + "</p>" +
    "</div></details>";
}

/* De vlag is hier versiering: de landnaam staat al in de tekst van de actie of
   in de namenregel eronder. Een schermlezer die eerst "Vlag van Oostenrijk"
   voorleest en dan "Vignet kopen voor Oostenrijk" herhaalt zichzelf. */
function actieTitelHTML(actie, idAttr){
  var landen = actie.landen;
  if(landen.length === 1){
    return '<p class="actietitel" id="' + esc(idAttr) + '-titel">' +
      '<span aria-hidden="true">' + flagHTML(landen[0]) + "</span>" +
      "<span>" + esc(actie.wat) + "</span></p>";
  }
  return '<p class="actietitel" id="' + esc(idAttr) + '-titel"><span>' + esc(actie.wat) + "</span></p>" +
    (landen.length ? vlaggenRij(landen, []) +
      '<p class="landnamen">' +
      esc(landen.map(function(c){ return c.name; }).join(" · ")) + "</p>" : "");
}

/* Eén actie. Afvinkbaar of niet: een blokkade, een waarschuwing en een regel die
   niet voor jouw kenteken geldt zijn geen taken, dus die krijgen geen vinkje —
   een uitgeschakeld vakje zou suggereren dat je iets vergeten bent. */
function actieHTML(actie){
  var idAttr = "actie-" + actie.id.replace(/[^a-zA-Z0-9_.-]/g, "-");

  /* Het vinkje krijgt zijn naam van de titel en zijn toelichting van de
     statusregel: "Vignet kopen voor Oostenrijk, selectievakje, niet aangevinkt
     — Actie, regel dit uiterlijk 2 september". */
  var vink = actie.afvinkbaar
    ? '<input type="checkbox" class="actievink" data-tick="' + esc(actie.tickKey) + '"' +
      (actie.afgevinkt ? " checked" : "") + ' id="' + esc(idAttr) + '-vink"' +
      ' aria-labelledby="' + esc(idAttr) + '-titel"' +
      ' aria-describedby="' + esc(idAttr) + '-meta">'
    : '<span class="actiemerk" aria-hidden="true">' + STATUS_TEKEN[actie.status] + "</span>";

  var naarStap = actie.naarWizardStap
    ? '<button type="button" class="btn klein" data-view="wizard" data-wiz-naar="' +
      actie.naarWizardStap + '">' + esc(i18n("actie.naarProfiel")) + "</button>"
    : "";

  return '<li class="actiekaart s-' + esc(actie.status) + (actie.afgevinkt ? " af" : "") + '">' +
    vink +
    '<div class="actiehoofd">' +
      actieTitelHTML(actie, idAttr) +
      '<p class="actiemeta" id="' + esc(idAttr) + '-meta">' +
        statusChipHTML(actie.status) + deadlineChipHTML(actie) +
        prijsChipHTML(actie) + "</p>" +
      (actie.uitleg ? '<p class="actieuitleg">' + esc(eersteZinnen(actie.uitleg)) + "</p>" : "") +
      onzekerHTML(actie) +
      naarStap +
      waaromHTML(actie) +
    "</div>" +
  "</li>";
}

function groepHTML(groep){
  var sleutel = groep.sleutel;
  var id = "groep-" + sleutel;
  var kop =
    '<div class="groepkop">' +
      '<h2 id="' + id + '"><span class="groepteken" aria-hidden="true">' +
        esc(i18n("groep." + sleutel + ".teken")) + "</span>" +
        esc(i18n("groep." + sleutel)) +
        '<span class="groeptel">' + groep.acties.length + "</span></h2>" +
      '<p class="groepuitleg">' + esc(i18n("groep." + sleutel + ".uitleg")) + "</p>" +
    "</div>";
  var lijst = '<ul class="actielijst">' +
    groep.acties.map(actieHTML).join("") + "</ul>";

  /* Twee groepen staan ingeklapt: wat af is en wat niet voor jou geldt. Beide
     zijn naslag — je wilt kunnen controleren dát ze er zijn, niet erlangs
     scrollen op weg naar wat nog moet (§15, progressive disclosure). */
  if(sleutel === "klaar" || sleutel === "nietVoorJou"){
    return '<section class="actiegroep g-' + sleutel + '" aria-labelledby="' + id + '">' +
      "<details><summary>" + kop + "</summary>" + lijst + "</details></section>";
  }
  return '<section class="actiegroep g-' + sleutel + '" aria-labelledby="' + id + '">' +
    kop + lijst + "</section>";
}

function renderActies(){
  var wrap = document.getElementById("checklist-wrap");
  if(!wrap || !TRIP || !DATA) return;

  if(!tripIsKlaar(TRIP)){
    wrap.innerHTML = '<div class="leegstaat">' + iconUse("checklist").replace('class="icon sm"', 'class="icon lg"') +
      "<h1>" + esc(i18n("acties.leegKop")) + "</h1>" +
      "<p>" + esc(i18n("acties.leegTekst")) + "</p>" +
      '<button type="button" class="btn primary" data-view="wizard">' + esc(i18n("home.cta")) + "</button></div>";
    return;
  }

  var tel = actieTelling(TRIP);
  var pct = tel.totaal ? Math.round(tel.gedaan / tel.totaal * 100) : 0;
  var groepen = groepeerActies(tel.acties);

  wrap.innerHTML =
    "<h1>" + kopHTML("checklist.titel") + "</h1>" +
    '<div class="progresscard"><div class="prow"><span class="plbl">' +
      esc(i18n("checklist.voortgang")) + '</span>' +
      '<span class="pval">' + esc(i18n("checklist.gereed", { pct:pct })) + '</span></div>' +
      '<div class="progressbar" role="progressbar" aria-valuenow="' + pct +
        '" aria-valuemin="0" aria-valuemax="100"><i style="width:' + pct + '%"></i></div>' +
      '<p class="hint">' + esc(i18nAantal("acties.telling", tel.open, { totaal:tel.totaal })) + "</p>" +
    "</div>" +
    (TRIP.departureDate
      ? '<p class="deadlinenoot">' + iconUse("info") + esc(i18n("deadline.uitleg")) + "</p>"
      : "") +
    groepen.map(groepHTML).join("");
}

/* ---------------- afvinken ----------------

   Een afgevinkte actie verhuist naar "Klaar", dus de pagina moet opnieuw
   opgebouwd worden. Twee dingen mogen daarbij niet gebeuren: de focus mag niet
   verdwijnen (§21) en de pagina mag niet naar boven springen. Daarom onthouden
   we de scrollpositie en zetten we de focus terug op hetzelfde vinkje, dat dan
   in zijn nieuwe groep staat. Een schermlezer krijgt te horen waar het heen is. */
function meldAanSchermlezer(tekst){
  var el = document.getElementById("actie-melding");
  if(el) el.textContent = tekst;
}

function naAfvinken(tickKey, aangevinkt){
  var pagina = document.getElementById("view-acties");
  var top = pagina ? pagina.scrollTop : 0;
  renderActies();
  if(pagina) pagina.scrollTop = top;

  /* De actie staat nu in een andere groep, en "Klaar" is ingeklapt. Focussen op
     iets in een dichtgeklapte <details> doet niets, dus die gaat eerst open —
     dan zie je ook meteen waar je vinkje heen ging. */
  var vink = document.querySelector('#view-acties input[data-tick="' + tickKey + '"]');
  if(vink){
    var groep = vink.closest(".actiegroep");
    var vouw = groep && groep.querySelector(":scope > details");
    if(vouw) vouw.open = true;
    vink.focus();
  }

  var actie = bouwActies(TRIP).filter(function(a){ return a.tickKey === tickKey; })[0];
  if(actie){
    meldAanSchermlezer(i18n(aangevinkt ? "acties.gemeldAf" : "acties.gemeldOpen",
      { wat: actie.wat, groep: i18n("groep." + (aangevinkt ? "klaar" : actie.prioriteit)) }));
  }
}
