"use strict";
/* Paginarenderers: Regels per land, Mijn reizen, Reiservaring.

   De actiepagina staat in js/acties.js — die is sinds §7 een eigen ding
   geworden en niet meer de "checklist" die hier ooit stond. */

/* ================= Landeninformatie-pagina =================
   Doorbladerbaar voor elk land in countries.json (niet alleen de route),
   met dezelfde databronnen als de dormant countryCard()/renderCountries(). */

/* Zelf gehoste bannerfoto's per land, zodat de app offline blijft werken.
   Nog niet elk land heeft er een; ontbreekt de foto, dan valt de banner terug
   op het navy verloop van hiervoor. */
var LAND_PHOTOS = {
  NL: "images/Landbanner/Nederland.png",
  FR: "images/Landbanner/Frankrijk.png",
  GB: "images/Landbanner/UK.png",
  DE: "images/Landbanner/Duitsland.png",
  AT: "images/Landbanner/Oostenrijk.png",
  IT: "images/Landbanner/Italie.png",
  ES: "images/Landbanner/Spanje.png",
  PT: "images/Landbanner/Portugal.png",
  HR: "images/Landbanner/Kroatie.png",
  SI: "images/Landbanner/Slovenie.png",
  CZ: "images/Landbanner/Tsjechie.png",
  DK: "images/Landbanner/Denemarken.png",
  SE: "images/Landbanner/Zweden.png",
  LU: "images/Landbanner/Luxemburg.png"
  /* BE en CH: nog geen bannerfoto, vallen terug op het navy verloop. */
};

/* Subregio voor de "EUROPA · WEST"-regel in de hero. Niet in countries.json
   (dat gaat over regelgeving, niet geografie), dus een kleine vaste indeling
   voor de 16 landen die de app kent. */
var LAND_REGIO = {
  NL: "West", BE: "West", LU: "West", FR: "West", GB: "West",
  DE: "Centraal", AT: "Centraal", CH: "Centraal", CZ: "Centraal", SI: "Centraal",
  IT: "Zuid", ES: "Zuid", PT: "Zuid", HR: "Zuid",
  DK: "Noord", SE: "Noord"
};

/* Landkiezer als doorzoekbaar dropdownpaneel i.p.v. een rij vlagchips: schaalt
   beter dan 16 losse chips en houdt de hero net zo rustig als het voorbeeld. */
function landSwitcherHTML(){
  var route = tripLanden(TRIP);
  var overig = DATA.countries.map(function(c){ return c.code; })
    .filter(function(code){ return route.indexOf(code) === -1; })
    .sort(function(a, b){ return BY_CODE[a].name.localeCompare(BY_CODE[b].name); });

  function rij(code){
    var c = BY_CODE[code];
    if(!c) return "";
    return '<button type="button" class="landswitch-row' + (code === LANDEN_ACTIEF ? " active" : "") + '" data-land="' + esc(code) + '" data-naam="' + esc(c.name.toLowerCase()) + '">' +
      flagHTML(c) + "<span>" + esc(c.name) + "</span>" +
      (code === LANDEN_ACTIEF ? iconUse("check") : "") + "</button>";
  }
  var routeGroep = route.length
    ? '<div class="landswitch-label">' + esc(i18n("landen.opJeRoute")) + "</div>" + route.map(rij).join("")
    : "";
  var overigGroep = '<div class="landswitch-label">' + esc(i18n("landen.alleLanden")) + "</div>" +
    overig.map(rij).join("");

  var actief = BY_CODE[LANDEN_ACTIEF];
  return (
    '<div class="landswitch">' +
      '<button type="button" class="landswitch-toggle" id="land-switch-toggle" aria-expanded="false">' +
        (actief ? flagHTML(actief) : "") + "<span>" + esc(i18n("landen.wisselVanLand")) + "</span>" +
        iconUse("chevron-right") +
      "</button>" +
      '<div class="landswitch-panel" id="land-switch-panel" hidden>' +
        '<div class="landswitch-search">' + iconUse("search") +
          '<input type="search" id="land-switch-search" placeholder="' +
            esc(i18n("landen.zoekLand")) + '" autocomplete="off">' +
        "</div>" +
        '<div class="landswitch-list" id="land-switch-list">' + routeGroep + overigGroep + "</div>" +
      "</div>" +
    "</div>"
  );
}

/* ---------------- de regelpagina per land (§15) ----------------

   De oude pagina zette alles naast elkaar: uitrusting, milieuzone, tol,
   snelheden, verboden. Alles even groot, en dus geen antwoord op de twee vragen
   waarmee iemand die pagina opent:

     mag ik hier rijden, en moet ik iets regelen?

   Die twee staan nu bovenaan als conclusie, met één zin uitleg. De rest — de
   juridische en praktische details — staat eronder in uitklapbare secties,
   waarvan de kop zelf al het belangrijkste feit draagt ("Snelheid · 130 km/u op
   de snelweg"). Dat is progressive disclosure: je hoeft niets open te klappen
   om te weten waar het over gaat, en de conclusie is nooit ondergeschikt aan de
   details. */

/* Het oordeel in woord én teken, nooit alleen in kleur (§21). */
function oordeelHTML(niveau, woord, uitleg){
  var teken = { ja:"✓", nee:"✗", mits:"!", check:"?" }[niveau] || "?";
  return '<p class="oordeel o-' + niveau + '">' +
      '<span class="teken" aria-hidden="true">' + teken + "</span>" +
      "<b>" + esc(woord) + "</b></p>" +
    (uitleg ? '<p class="oordeeluitleg">' + esc(uitleg) + "</p>" : "");
}

/* Mag ik hier rijden? Het milieuzone-oordeel is het enige in de data dat een
   auto écht kan tegenhouden; de rest zijn verplichtingen, geen verboden. */
function magIkRijdenHTML(c){
  var v = zoneVerdict(c, TRIP);
  var niveau = v.level === "bad" ? "nee" : v.level === "unknown" ? "check" : "ja";
  var woord = i18n("regels.mag." + niveau);
  return '<section class="oordeelkaart" aria-labelledby="vraag-rijden">' +
    '<h2 id="vraag-rijden">' + esc(i18n("regels.magIkRijden")) + "</h2>" +
    oordeelHTML(niveau, woord, v.text) + "</section>";
}

/* Moet ik iets regelen? Precies de acties die voor dit land op deze reis open
   staan — dezelfde lijst als op de actiepagina, niet een tweede waarheid. */
function moetIkRegelenHTML(c){
  var acties = bouwActies(TRIP).filter(function(a){
    return !a.afgevinkt && a.afvinkbaar && a.landen.length &&
      a.landen.filter(function(l){ return l.code === c.code; }).length;
  });
  var opRoute = tripLanden(TRIP).indexOf(c.code) !== -1;

  var body;
  if(!opRoute){
    body = oordeelHTML("check", i18n("regels.regel.nietOpRoute"), i18n("regels.nietOpRouteUitleg"));
  } else if(!acties.length){
    body = oordeelHTML("ja", i18n("regels.regel.nee"), i18n("regels.regelNeeUitleg"));
  } else {
    body = oordeelHTML("mits", i18nAantal("regels.regel.ja", acties.length), "") +
      '<ul class="oordeelacties">' + acties.map(function(a){
        return "<li>" + esc(a.wat) +
          (a.deadline ? ' <span class="deadlinechip u-' + esc(a.deadline.urgentie) + '">' +
            esc(deadlineTekst(a.deadline)) + "</span>" : "") + "</li>";
      }).join("") + "</ul>" +
      '<button type="button" class="tekstknop" data-view="acties">' +
        esc(i18n("regels.naarActies")) + "</button>";
  }
  return '<section class="oordeelkaart" aria-labelledby="vraag-regelen">' +
    '<h2 id="vraag-regelen">' + esc(i18n("regels.moetIkRegelen")) + "</h2>" + body + "</section>";
}

/* Een uitklapbare sectie waarvan de kop het belangrijkste feit al draagt. */
function detailSectie(sleutel, samenvatting, inhoud){
  if(!inhoud) return "";
  return '<details class="regelsectie"><summary>' +
    "<span class=\"sectienaam\">" + esc(i18n("regels.sectie." + sleutel)) + "</span>" +
    (samenvatting ? '<span class="sectiekop">' + esc(samenvatting) + "</span>" : "") +
    "</summary><div class=\"sectiebody\">" + inhoud + "</div></details>";
}

/* Bron plus controledatum plus niveau, bij elke sectie (§13, §16). */
function sectieBronHTML(feit, c){
  var h = herkomstVan(feit, c);
  if(!h.factId && !h.sourceUrl) return "";
  return '<p class="bronregel">' + confidenceChipHTML(h) +
    (h.sourceUrl ? " " + herkomstRegelHTML({ bron:h }) : "") +
    (c ? '<span class="melden">' + correctionLinks(c, h.factId) + "</span>" : "") + "</p>";
}

function speedRij(label, val){
  if(!val) return "";
  var nummer = String(val).match(/\d+/);
  var bord = nummer
    ? '<div class="speedsign"><span>' + esc(nummer[0]) + "</span></div>"
    : '<div class="speedsign leeg">' + iconUse("speed") + "</div>";
  return '<div class="speedrow">' + bord +
    '<div class="speedtext"><span class="slabel">' + esc(label) + '</span>' +
    '<span class="sval">' + esc(val) + "</span></div></div>";
}

function snelheidSectie(c){
  var s = c.speedLimits || {}, n = s.normal || {}, wt = s.wet || {};
  var rijen = speedRij(i18n("landen.snelweg"), n.motorway) +
    speedRij(i18n("landen.autoweg"), n.expressway) +
    speedRij(i18n("landen.buitenDeKom"), n.rural) +
    speedRij(i18n("landen.bebouwdeKom"), n.builtUp);
  if(!rijen) return "";

  var wetTxt = (wt.motorway || wt.expressway || wt.rural)
    ? [wt.motorway && i18n("landen.regenSnelweg", { v:wt.motorway }),
       wt.expressway && i18n("landen.regenAutoweg", { v:wt.expressway }),
       wt.rural && i18n("landen.regenBuiten", { v:wt.rural })].filter(Boolean).join(", ")
    : (wt.note || "");

  var inhoud = rijen +
    (wetTxt ? '<div class="speednote"><b>' + esc(i18n("landen.regen")) + "</b> " + esc(wetTxt) + "</div>" : "") +
    (s.notes ? '<p class="sectienoot">' + esc(s.notes) + "</p>" : "") +
    sectieBronHTML(s, c);
  return detailSectie("snelheid", n.motorway ? kortZin(n.motorway) : "", inhoud);
}

function uitrustingSectie(c){
  var items = c.mandatoryEquipment || [];
  if(!items.length) return "";
  var must = items.filter(function(it){ return effectiveStatus(it, c, TRIP) === "must"; });
  var advies = items.filter(function(it){ return effectiveStatus(it, c, TRIP) === "advice"; });
  var na = items.filter(function(it){ return effectiveStatus(it, c, TRIP) === "na"; });

  function blok(lijst, sleutel){
    if(!lijst.length) return "";
    return '<h4 class="eqkop">' + esc(i18n("regels.uitrusting." + sleutel)) + "</h4>" +
      '<p class="eqtoelichting">' + esc(i18n("regels.uitrusting." + sleutel + ".uitleg")) + "</p>" +
      '<ul class="eqlijst">' + lijst.map(function(it){
        return '<li><span class="eqnaam">' + esc(it.item) + "</span>" +
          (it.note ? '<span class="eqnote">' + esc(it.note) + "</span>" : "") + "</li>";
      }).join("") + "</ul>";
  }

  /* Het onderscheid verplicht / alleen-voor-dat-kenteken / aanbevolen is de kern
     van deze app en krijgt daarom drie eigen koppen met uitleg, in plaats van
     één lijst met badges. */
  return detailSectie("uitrusting",
    i18n("regels.uitrustingKop", { must:must.length, advies:advies.length }),
    blok(must, "verplicht") + blok(na, "kenteken") + blok(advies, "aanbevolen") +
    sectieBronHTML(items[0], c));
}

function milieuSectie(c){
  var z = c.environmentalZone || {};
  var tv = c.tollVignette || {}, tr = c.tollRoads || {};
  var milieuTxt = z.required ? (z.note || z.name || i18n("landen.milieuVereist"))
                             : (z.note || i18n("landen.geenMilieuzone"));
  var tolTxt = tv.required ? (tv.note || tv.name || i18n("landen.vignetVerplicht"))
             : (tr.perKm
                ? i18n("landen.tolwegen", { tarief:getal(tr.perKm, { minimumFractionDigits:2, maximumFractionDigits:2 }) }) +
                  (tr.note ? " " + tr.note : "")
                : i18n("landen.geenTolinfo"));

  var inhoud =
    '<h4 class="eqkop">' + esc(i18n("landen.milieuzone")) + "</h4>" +
    "<p>" + esc(milieuTxt) + "</p>" +
    (z.howToGet ? '<p class="hoe"><b>' + esc(i18n("regels.hoeKrijgJeHet")) + "</b> " + esc(z.howToGet) + "</p>" : "") +
    sectieBronHTML(z, c) +
    '<h4 class="eqkop">' + esc(i18n("landen.tol")) + "</h4>" +
    "<p>" + esc(tolTxt) + "</p>" +
    (tv.howToGet ? '<p class="hoe"><b>' + esc(i18n("regels.hoeKrijgJeHet")) + "</b> " + esc(tv.howToGet) + "</p>" : "") +
    sectieBronHTML(tv.required ? tv : tr, c);

  var kop = z.required
    ? (tv.required ? i18n("regels.milieuKop.beide") : i18n("regels.milieuKop.zone"))
    : (tv.required ? i18n("regels.milieuKop.vignet") : i18n("regels.milieuKop.geen"));
  return detailSectie("milieu", kop, inhoud);
}

function winterSectie(c){
  var w = c.winterEquipment;
  if(!w || !w.required || w.required === "nee") return "";
  return detailSectie("winter", w.period ? kortZin(w.period) : "",
    "<p>" + esc(w.note || "") + "</p>" + sectieBronHTML(w, c));
}

function regelsSectie(c){
  var quirks = c.quirks || [];
  if(!quirks.length) return "";
  return detailSectie("bijzonder", i18nAantal("regels.bijzonderKop", quirks.length),
    '<ul class="quirklijst">' + quirks.map(function(q){
      var verboden = /verboden/i.test(quirkTekst(q));
      return '<li class="' + (verboden ? "verbod" : "") + '">' +
        '<span class="teken" aria-hidden="true">' + (verboden ? "✗" : "i") + "</span>" +
        "<span>" + esc(quirkTekst(q)) + "</span></li>";
    }).join("") + "</ul>");
}

/* §16: bronnen bij elkaar, met de controledatum en een duidelijke link. */
function bronnenSectie(c){
  var bronnen = c.sources || [];
  var inhoud = '<p class="bronnenintro">' +
      esc(i18n("regels.bronnenIntro", { datum: fmtDate(c.lastVerified) })) + "</p>" +
    (bronnen.length
      ? '<ul class="bronnenlijst">' + bronnen.map(function(b){
          return '<li><a href="' + esc(b.url) + '" target="_blank" rel="noopener">' +
            esc(b.label) + ' <span aria-hidden="true">&rarr;</span></a></li>';
        }).join("") + "</ul>"
      : "") +
    '<p class="bronacties"><span class="melden">' + correctionLinks(c, null) + "</span></p>";
  return detailSectie("bronnen", i18nAantal("regels.bronnenKop", bronnen.length), inhoud);
}

function landDetailHTML(c){
  var foto = LAND_PHOTOS[c.code];
  var heroStyle = foto ? ' style="background-image:linear-gradient(to top,var(--navy) 0%,rgba(var(--navy-rgb),.75) 55%,rgba(var(--navy-rgb),.15) 100%),url(' + foto + ');background-size:auto,cover;background-position:center,center 35%"' : '';
  var regio = LAND_REGIO[c.code];
  var verouderd = daysSince(c.lastVerified) > STALE_DAYS;

  return (
    '<div class="landherowrap">' +
      '<div class="landhero"' + heroStyle + '><div class="regio">' + flagHTML(c) +
        "<span>" + esc(i18n("landen.europa")) +
        (regio ? " · " + esc(i18n("landen.regio." + regio)) : "") + "</span></div>" +
        "<h1>" + esc(c.name) + "</h1><p>" + esc(i18n("landen.intro")) + "</p></div>" +
      landSwitcherHTML() +
    "</div>" +
    (verouderd
      ? '<p class="verouderdbalk">' + iconUse("warning") +
        esc(i18n("regels.verouderd", { datum: fmtDate(c.lastVerified) })) + "</p>"
      : "") +
    '<div class="regeloordeel">' + magIkRijdenHTML(c) + moetIkRegelenHTML(c) + "</div>" +
    '<div class="regeldetails">' +
      snelheidSectie(c) + uitrustingSectie(c) + milieuSectie(c) +
      winterSectie(c) + regelsSectie(c) + bronnenSectie(c) +
    "</div>"
  );
}

function filterLandSwitch(q){
  q = q.trim().toLowerCase();
  document.querySelectorAll("#land-switch-list .landswitch-row").forEach(function(row){
    var naam = row.getAttribute("data-naam") || "";
    row.style.display = (!q || naam.indexOf(q) !== -1) ? "" : "none";
  });
  document.querySelectorAll("#land-switch-list .landswitch-label").forEach(function(label){
    var next = label.nextElementSibling, zichtbaar = false;
    while(next && !next.classList.contains("landswitch-label")){
      if(next.style.display !== "none") zichtbaar = true;
      next = next.nextElementSibling;
    }
    label.style.display = zichtbaar ? "" : "none";
  });
}

function renderLandenInfo(){
  var detail = document.getElementById("land-detail");
  if(!detail) return;
  var landen = tripLanden(TRIP);
  if(!LANDEN_ACTIEF || !BY_CODE[LANDEN_ACTIEF]){
    LANDEN_ACTIEF = landen.length ? landen[0] : (DATA.countries[0] && DATA.countries[0].code);
  }
  var c = BY_CODE[LANDEN_ACTIEF];
  detail.innerHTML = c ? landDetailHTML(c)
    : '<p class="hint">' + esc(i18n("landen.geenLanden")) + "</p>";
}

/* ================= Mijn Reizen-pagina ================= */
function tripStatChips(trip){
  var aantal = tripLanden(trip).length;
  var chips = ['<span class="tripchip">' + iconUse("globe") +
    esc(i18nAantal("reizen.landen", aantal)) + "</span>"];
  var afstand = tripAfstandKm(trip);
  if(afstand) chips.push('<span class="tripchip">' + iconUse("ruler") +
    getal(Math.round(afstand)) + " " + esc(i18n("planner.km")) + "</span>");
  var duur = fmtDuur(tripDuur(trip));
  if(duur) chips.push('<span class="tripchip">' + iconUse("clock") + duur + "</span>");
  return chips.join("");
}

function tripKaartHTML(trip){
  var van = trip.origin ? trip.origin.naam : null;
  var naar = trip.destination ? trip.destination.naam : null;
  var tel = checklistTelling(trip);
  var pct = tel.totaal ? Math.round(tel.gedaan / tel.totaal * 100) : 0;
  var actief = trip.id === ACTIVE_TRIP_ID;
  var blockerNote = tel.blockers
    ? '<div class="tripwarn"><span class="l">' + iconUse("warning") + " " +
      esc(i18n("reizen.blokkade")) + "</span>" +
      "<span>" + esc(i18n("reizen.checklistTeller", { gedaan:tel.gedaan, totaal:tel.totaal })) + "</span></div>"
    : "";

  return (
    '<article class="tripcard" data-trip="' + esc(trip.id) + '">' +
    '<div class="tripbanner">' +
      (actief ? '<span class="tripbadge">' + iconUse("locate") + " " + esc(i18n("reizen.actief")) + "</span>" : "") +
      iconUse("map").replace('class="icon sm"', 'class="icon"') + "</div>" +
    '<div class="tripbody">' +
      '<div class="triptop"><h3>' + esc(trip.naam) + "</h3>" +
        '<div class="tripactions">' +
          '<button type="button" data-actie="hernoem" aria-label="' + esc(i18n("reizen.naamWijzigen")) +
            '" title="' + esc(i18n("reizen.naamWijzigen")) + '">' + iconUse("edit") + "</button>" +
          '<button type="button" data-actie="verwijder" class="danger" aria-label="' +
            esc(i18n("reizen.verwijderen")) + '" title="' + esc(i18n("reizen.verwijderen")) + '">' +
            iconUse("trash") + "</button>" +
        "</div></div>" +
      (van && naar
        ? '<div class="tripvan">' + iconUse("map") + esc(van) + '<span class="arrow">→</span>' + esc(naar) + "</div>"
        : '<div class="tripvan">' + esc(i18n("reizen.geenRoute")) + "</div>") +
      '<div class="tripchips">' + tripStatChips(trip) + "</div>" +
      blockerNote +
      '<div class="tripprogress"><div class="progresswrap">' +
        '<div class="prow"><span>' + iconUse("checklist") + " " + esc(i18n("reizen.checklist")) +
          "</span><b>" + tel.gedaan + "/" + tel.totaal + "</b></div>" +
        '<div class="progressbar"><i style="width:' + pct + '%"></i></div></div>' +
        '<button type="button" class="tripgo" data-actie="open" aria-label="' +
          esc(i18n("reizen.openen")) + '">' + iconUse("arrow-right") + "</button></div>" +
    "</div></article>"
  );
}

function renderMijnReizen(){
  var wrap = document.getElementById("reizen-wrap");
  if(!wrap) return;
  var kaarten = TRIPS.map(function(t){ return tripKaartHTML(t); }).join("");
  wrap.innerHTML =
    '<div class="reizenhead"><div><h2>' + esc(i18n("reizen.kop")) + "</h2>" +
      "<p>" + esc(i18n("reizen.intro")) + "</p></div>" +
      '<button type="button" class="btn primary" id="btn-nieuwe-reis">' + iconUse("plus-pin") + " " +
        esc(i18n("reizen.nieuweReis")) + "</button>" +
    "</div>" +
    '<div class="tripgrid">' + kaarten +
      '<div class="tripnew" id="btn-tripnew"><div class="bubble">' + iconUse("plus-pin") + "</div>" +
      "<h3>" + esc(i18n("reizen.planNieuwe")) + "</h3><p>" + esc(i18n("reizen.planNieuweIntro")) + "</p>" +
      '<span class="go">' + esc(i18n("reizen.startPlanner")) + " " + iconUse("arrow-right") + "</span></div>" +
    "</div>";
}

/* ================= Reiservaring-pagina =================
   Scrollytelling-weergave van de actieve rit: één halte per land op de route,
   met de echte verplichte/aanbevolen uitrusting en tolinfo — dezelfde
   databronnen als de Checklist- en Landeninformatie-pagina, alleen visueel
   verteld als een reis in plaats van een lijst. */
/* Exact de pijl uit pijl/code.html — eigen vaste kleuren (net als het
   verkeersbord), dus niet via de gedeelde .icon-sprite (die zet fill:none/
   stroke:currentColor, wat deze eigen fill/stroke zou overschrijven). */
var JOURNEY_PIJL_SVG = '<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">' +
  '<path d="M32 4L12 56L32 46L52 56L32 4Z" fill="#3b82f6" stroke="#1d4ed8" stroke-width="3" stroke-linejoin="round"/></svg>';

function jTolBits(code, c){
  var bits = [];
  if((c.tollVignette || {}).required) bits.push(i18n("reis.vignetVereist"));
  var sch = tolSchatting(TRIP).filter(function(t){ return t.c.code === code; })[0];
  if(sch) bits.push(i18n("reis.tolCirca", { bedrag:euroTekst(sch.hoog) }));
  var punten = tripTolPunten(TRIP).filter(function(o){ return o.c.code === code && !o.p.optional; })
    .map(function(o){ return o.p.name; });
  if(punten.length) bits.push(punten.slice(0, 2).join(", "));
  return bits;
}

function reisNodeHTML(code, idx, eerste, laatste){
  var c = BY_CODE[code];
  if(!c) return "";
  var must = (c.mandatoryEquipment || []).filter(function(it){ return effectiveStatus(it, c, TRIP) === "must"; });
  var advice = (c.mandatoryEquipment || []).filter(function(it){ return effectiveStatus(it, c, TRIP) === "advice"; });
  var tolBits = jTolBits(code, c);

  var badge = eerste ? '<span class="jbadge">' + esc(i18n("reis.start")) + "</span>"
            : laatste ? '<span class="jbadge dest">' + esc(i18n("reis.bestemming")) + "</span>" : "";
  var tekst = eerste ? i18n("reis.startTekst")
            : laatste ? i18n("reis.eindTekst") : "";

  return '<div class="journeynode' + (idx % 2 ? " alt" : "") + '" data-idx="' + idx + '">' +
    '<div class="jnode-spacer"></div>' +
    '<div class="jnode-icon' + (laatste ? " dest" : "") + '">' +
      flagHTML(c) + '<span class="jcheck">' + iconUse("check") + "</span></div>" +
    '<div class="jcard-wrap"><div class="jcard' + (laatste ? " dest" : "") + '">' +
      '<div class="jcardtop"><h2>' + esc(c.name) + "</h2>" + badge + "</div>" +
      (tekst ? "<p>" + esc(tekst) + "</p>" : "") +
      (must.length
        ? '<div class="jsubkop">' + esc(i18n("reis.verplicht")) + '</div><div class="jchips">' +
          must.map(function(it){ return '<span class="jchip must">' + esc(it.item) + "</span>"; }).join("") + "</div>"
        : "") +
      (advice.length
        ? '<div class="jsubkop">' + esc(i18n("reis.aanbevolen")) + '</div><div class="jchips">' +
          advice.map(function(it){ return '<span class="jchip">' + esc(it.item) + "</span>"; }).join("") + "</div>"
        : "") +
      (tolBits.length ? '<div class="jtol">' + iconUse("payments") + esc(tolBits.join(" · ")) + "</div>" : "") +
      (laatste ? '<button type="button" class="btn primary wide" id="btn-reis-checklist">' +
        iconUse("checklist") + " " + esc(i18n("reis.bekijkChecklist")) + "</button>" : "") +
    "</div></div></div>";
}

function renderReisErvaring(){
  var wrap = document.getElementById("reis-wrap");
  if(!wrap || !TRIP) return;
  var landen = tripLanden(TRIP);
  if(!landen.length){
    wrap.innerHTML =
      '<div class="journeyempty">' + iconUse("journey").replace('class="icon sm"', 'class="icon lg"') +
      "<h1>" + esc(i18n("reis.leegKop")) + "</h1>" +
      "<p>" + esc(i18n("reis.leegIntro")) + "</p>" +
      '<button type="button" class="btn primary" id="btn-reis-naar-planner">' +
        esc(i18n("reis.naarPlanner")) + "</button></div>";
    return;
  }

  var nodes = landen.map(function(code, i){
    return reisNodeHTML(code, i, i === 0, i === landen.length - 1);
  }).join("");
  wrap.innerHTML =
    '<div class="journeyhead"><h1>' + esc(i18n("reis.kop")) + "</h1>" +
    "<p>" + esc(i18n("reis.intro")) + "</p></div>" +
    '<div class="journeyroad-wrap">' +
      '<div class="journeyroad"><div class="journeyroad-progress" id="journey-progress"></div></div>' +
      '<div class="journeymarker" id="journey-marker">' + JOURNEY_PIJL_SVG + "</div>" +
      '<div class="journeynodes">' + nodes + "</div>" +
    "</div>";
  initJourneyScroll();
}

/* Scroll-gekoppelde animatie: een marker beweegt mee met de scrollpositie en
   zet haltes op "voltooid" (groen, vinkje) zodra hij ze passeert. Draait
   alleen terwijl deze pagina zichtbaar is — switchView() stopt 'm bij het
   wegnavigeren, en elke render() hier start 'm schoon opnieuw op. */
var JOURNEY_RAF = null;
var JOURNEY_SCROLL_EL = null, JOURNEY_SCROLL_HANDLER = null;
function stopJourneyScroll(){
  if(JOURNEY_RAF){ cancelAnimationFrame(JOURNEY_RAF); JOURNEY_RAF = null; }
  if(JOURNEY_SCROLL_EL && JOURNEY_SCROLL_HANDLER) JOURNEY_SCROLL_EL.removeEventListener("scroll", JOURNEY_SCROLL_HANDLER);
  JOURNEY_SCROLL_EL = null; JOURNEY_SCROLL_HANDLER = null;
}

function initJourneyScroll(){
  stopJourneyScroll();
  var scroller = document.getElementById("view-reis");
  var nodes = document.querySelectorAll("#reis-wrap .journeynode");
  var progress = document.getElementById("journey-progress");
  var marker = document.getElementById("journey-marker");
  if(!scroller || !nodes.length || !marker) return;

  var observer = new IntersectionObserver(function(entries){
    entries.forEach(function(entry){
      if(entry.isIntersecting) entry.target.classList.add("is-visible");
    });
  }, { root: scroller, rootMargin: "0px 0px -15% 0px", threshold: 0.2 });
  for(var i = 0; i < nodes.length; i++) observer.observe(nodes[i]);

  var target = 0, current = 0;

  function checkPassed(){
    var markerRect = marker.getBoundingClientRect();
    var markerY = markerRect.top + markerRect.height / 2;
    for(var j = 0; j < nodes.length; j++){
      var icon = nodes[j].querySelector(".jnode-icon");
      var iconRect = icon.getBoundingClientRect();
      var iconY = iconRect.top + iconRect.height / 2;
      nodes[j].classList.toggle("is-passed", markerY >= iconY);
    }
  }

  function tick(){
    current += (target - current) * 0.08;
    var pct = Math.min(current + 4, 100);
    progress.style.height = pct + "%";
    marker.style.top = pct + "%";
    checkPassed();
    JOURNEY_RAF = requestAnimationFrame(tick);
  }

  function onScroll(){
    var max = scroller.scrollHeight - scroller.clientHeight;
    target = max > 0 ? (scroller.scrollTop / max) * 100 : 0;
  }

  JOURNEY_SCROLL_EL = scroller;
  JOURNEY_SCROLL_HANDLER = onScroll;
  scroller.addEventListener("scroll", onScroll);
  onScroll();
  JOURNEY_RAF = requestAnimationFrame(tick);
}
