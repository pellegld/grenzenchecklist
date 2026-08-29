"use strict";
/* De vier paginarenderers: Checklist, Landeninformatie, Mijn Reizen, Reiservaring.
   
   Alle vier lezen dezelfde databronnen als de rest van de app; alleen de
   renderlaag verschilt per pagina. */

/* ================= Checklist-pagina =================
   Hergebruikt buildGroups()/buildTasks()/checklistTelling() ongewijzigd —
   alleen de render-laag is nieuw (bento-kaarten i.p.v. de oude 6-koloms grid). */
function bentoRow(key, titel, sub, badge, extraClass, vlaggenHTML){
  var done = !!TICKED[key];
  return '<div class="chkrow' + (done ? " done" : "") + (extraClass ? " " + extraClass : "") + '">' +
    '<label class="chklabel">' +
      '<input type="checkbox" data-tick="' + esc(key) + '"' + (done ? " checked" : "") + '>' +
      '<span class="chktext"><span class="ttl">' + esc(titel) + (badge || "") + '</span>' +
        (sub ? '<span class="sub">' + esc(sub) + '</span>' : "") + (vlaggenHTML || "") + '</span>' +
    '</label>' +
    (sub ? '<button type="button" class="infobtn" title="' + esc(sub) + '">' + iconUse("info") + '</button>' : "") +
  '</div>';
}

function renderChecklistPagina(){
  var wrap = document.getElementById("checklist-wrap");
  if(!wrap) return;
  var G = buildGroups(), T = buildTasks(), tel = checklistTelling();
  var pct = tel.totaal ? Math.round(tel.gedaan / tel.totaal * 100) : 0;

  var docRows = DOC_ITEMS.map(function(d){ return bentoRow("doc:" + d.key, d.naam, d.info); }).join("");

  var autoRows = G.must.map(function(row){
    var vl = vlaggenRij(row.main.map(function(e){ return e.country; }), row.other.map(function(e){ return e.country; }));
    return bentoRow(row.g.key, row.g.label, (row.main[0] && row.main[0].item.note) || "", '<span class="pill">Verplicht</span>', "", vl);
  }).concat(G.advice.map(function(row){
    var vl = vlaggenRij(row.main.map(function(e){ return e.country; }), row.other.map(function(e){ return e.country; }));
    return bentoRow(row.g.key, row.g.label, (row.main[0] && row.main[0].item.note) || "", "", "", vl);
  })).join("");

  var landRows = T.todo.map(function(t){
    var isZone = /^zone:/.test(t.key);
    var vl = vlaggenRij(t.cs || (t.c ? [t.c] : []), []);
    return bentoRow("task:" + t.key, t.what, t.meta || "", isZone ? '<span class="pill">Verplicht</span>' : "", isZone ? "zone" : "", vl);
  }).join("");

  var blokHtml = T.blockers.length
    ? '<div class="blockerbar">' + iconUse("block") + '<div>' +
      T.blockers.map(function(t){ return "<p><b>" + esc(t.c.name) + ".</b> " + esc(t.what) + "</p>"; }).join("") +
      "</div></div>"
    : "";

  wrap.innerHTML =
    "<h1>Jouw Reis Checklist</h1>" +
    '<div class="progresscard"><div class="prow"><span class="plbl">Voortgang</span>' +
      '<span class="pval">' + pct + '% gereed</span></div>' +
      '<div class="progressbar"><i style="width:' + pct + '%"></i></div></div>' +
    blokHtml +
    '<div class="bento">' +
      '<div class="bentocard"><div class="bentohead"><div class="bentobubble">' + iconUse("doc") + '</div>' +
        "<h2>Documenten</h2></div>" + docRows + "</div>" +
      '<div class="bentocard"><div class="bentohead"><div class="bentobubble">' + iconUse("tool") + '</div>' +
        "<h2>Auto Uitrusting</h2></div>" +
        (autoRows || '<p class="hint">Plan eerst een route voor de verplichte uitrusting per land.</p>') + "</div>" +
      '<div class="bentocard wide"><div class="bentohead"><div class="bentobubble">' + iconUse("globe") + '</div>' +
        "<h2>Land-specifiek</h2></div>" +
        (landRows || '<p class="hint">Geen extra acties gevonden voor je route.</p>') + "</div>" +
    "</div>";
}

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
  var route = ROUTE.slice();
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
    ? '<div class="landswitch-label">Op je route</div>' + route.map(rij).join("") : "";
  var overigGroep = '<div class="landswitch-label">Alle landen</div>' + overig.map(rij).join("");

  var actief = BY_CODE[LANDEN_ACTIEF];
  return (
    '<div class="landswitch">' +
      '<button type="button" class="landswitch-toggle" id="land-switch-toggle" aria-expanded="false">' +
        (actief ? flagHTML(actief) : "") + "<span>Wissel van land</span>" + iconUse("chevron-right") +
      "</button>" +
      '<div class="landswitch-panel" id="land-switch-panel" hidden>' +
        '<div class="landswitch-search">' + iconUse("search") +
          '<input type="search" id="land-switch-search" placeholder="Zoek een land..." autocomplete="off">' +
        "</div>" +
        '<div class="landswitch-list" id="land-switch-list">' + routeGroep + overigGroep + "</div>" +
      "</div>" +
    "</div>"
  );
}

function landDetailHTML(c){
  var eqCards = (c.mandatoryEquipment || []).map(function(it){
    var must = effectiveStatus(it, c) === "must";
    return '<div class="eqcard' + (must ? " must" : "") + '">' +
      '<div class="eqicon">' + iconUse(must ? "warning" : "info") + "</div>" +
      "<div><h4>" + esc(it.item) + (must ? ' <span class="pill">Verplicht</span>' : "") + "</h4>" +
      "<p>" + esc(it.note || "") + "</p></div></div>";
  }).join("") || '<p class="hint">Geen verplichte uitrusting geregistreerd.</p>';

  var z = c.environmentalZone || {}, tv = c.tollVignette || {}, tr = c.tollRoads || {};
  var milieuTxt = z.required ? (z.note || z.name || "Vereist — controleer de voorwaarden.")
                              : (z.note || "Geen milieuzone in dit land.");
  var tolTxt = tv.required ? (tv.note || tv.name || "Vignet verplicht.")
             : (tr.perKm ? "Tolwegen: circa €" + tr.perKm.toFixed(2).replace(".", ",") + " per km." + (tr.note ? " " + tr.note : "")
             : "Geen vignet- of tolweginfo geregistreerd.");

  var s = c.speedLimits || {}, n = s.normal || {}, wt = s.wet || {};
  function speedRij(label, val){
    if(!val) return "";
    var getal = String(val).match(/\d+/);
    var bord = getal
      ? '<div class="speedsign"><span>' + esc(getal[0]) + "</span></div>"
      : '<div class="speedsign leeg">' + iconUse("speed") + "</div>";
    return '<div class="speedrow">' + bord +
      '<div class="speedtext"><span class="slabel">' + esc(label) + '</span>' +
      '<span class="sval">' + esc(val) + "</span></div></div>";
  }
  var speedRows = speedRij("Snelweg", n.motorway) + speedRij("Autoweg", n.expressway) +
    speedRij("Buiten de kom", n.rural) + speedRij("Bebouwde kom", n.builtUp);
  var wetTxt = (wt.motorway || wt.expressway || wt.rural)
    ? [wt.motorway && ("snelweg " + wt.motorway), wt.expressway && ("autoweg " + wt.expressway), wt.rural && ("buiten de kom " + wt.rural)]
        .filter(Boolean).join(", ")
    : (wt.note || "");

  var verboden = (c.quirks || []).filter(function(q){ return /verboden/i.test(quirkTekst(q)); });
  var verbodItems = verboden.length
    ? verboden.map(function(q){ return "<li>" + iconUse("block") + "<div><h4>Let op</h4><p>" + esc(quirkTekst(q)) + "</p></div></li>"; }).join("")
    : "<li>" + iconUse("info") + "<div><h4>Niets geregistreerd</h4><p>Voor dit land staan geen specifieke verboden in de data.</p></div></li>";

  var foto = LAND_PHOTOS[c.code];
  var heroStyle = foto ? ' style="background-image:linear-gradient(to top,var(--navy) 0%,rgba(var(--navy-rgb),.75) 55%,rgba(var(--navy-rgb),.15) 100%),url(' + foto + ');background-size:auto,cover;background-position:center,center 35%"' : '';
  var regio = LAND_REGIO[c.code];

  return (
    '<div class="landherowrap">' +
      '<div class="landhero"' + heroStyle + '><div class="regio">' + flagHTML(c) + "<span>Europa" + (regio ? " · " + esc(regio) : "") + "</span></div>" +
        "<h2>" + esc(c.name) + "</h2><p>Reisregels, verplichtingen en belangrijke informatie voor een veilige en vlotte doorreis.</p></div>" +
      landSwitcherHTML() +
    "</div>" +
    '<div class="landgrid"><div class="landmain">' +
      '<div class="landcard"><div class="landcardhead">' + iconUse("warning") + "<h3>Verplicht in de auto</h3></div>" +
      '<div class="eqgrid">' + eqCards + "</div></div>" +
      '<div class="landcard milieupanel"><div class="landcardhead">' + iconUse("eco") + "<h3>Milieuzones &amp; tol</h3></div>" +
      '<div class="milieucols">' +
        '<div class="milieucol"><h4>' + iconUse("eco") + "Milieuzone</h4><p>" + esc(milieuTxt) + "</p></div>" +
        '<div class="milieucol"><h4>' + iconUse("payments") + "Tol</h4><p>" + esc(tolTxt) + "</p></div>" +
      "</div></div>" +
    '</div><div class="landside">' +
      '<div class="landcard"><div class="landcardhead">' + iconUse("speed") + "<h3>Maximumsnelheden</h3></div>" +
      (speedRows || '<p class="hint">Geen snelheidslimieten geregistreerd.</p>') +
      (wetTxt ? '<div class="speednote"><b>Let op (regen):</b> ' + esc(wetTxt) + "</div>" : "") +
      "</div>" +
      '<div class="landcard verbodenpanel"><div class="landcardhead">' + iconUse("block") + "<h3>Strikt verboden</h3></div>" +
      '<ul class="verbodlist">' + verbodItems + "</ul></div>" +
    "</div></div>"
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
  if(!LANDEN_ACTIEF || !BY_CODE[LANDEN_ACTIEF]){
    LANDEN_ACTIEF = ROUTE.length ? ROUTE[0] : (DATA.countries[0] && DATA.countries[0].code);
  }
  var c = BY_CODE[LANDEN_ACTIEF];
  detail.innerHTML = c ? landDetailHTML(c) : '<p class="hint">Geen landen beschikbaar.</p>';
}

/* ================= Mijn Reizen-pagina ================= */
function tripStatChips(trip){
  var chips = ['<span class="tripchip">' + iconUse("globe") + (trip.route ? trip.route.length : 0) + " landen</span>"];
  if(trip.routeRes) chips.push('<span class="tripchip">' + iconUse("ruler") + Math.round(trip.routeRes.total).toLocaleString("nl-NL") + " km</span>");
  var duur = fmtDuur(trip.routeDuration);
  if(duur) chips.push('<span class="tripchip">' + iconUse("clock") + duur + "</span>");
  return chips.join("");
}

function tripKaartHTML(trip){
  var van = trip.fromCity ? trip.fromCity[0] : null;
  var naar = trip.toCity ? trip.toCity[0] : null;
  var tel = metTrip(trip, checklistTelling);
  var pct = tel.totaal ? Math.round(tel.gedaan / tel.totaal * 100) : 0;
  var actief = trip.id === ACTIVE_TRIP_ID;
  var blockerNote = tel.blockers
    ? '<div class="tripwarn"><span class="l">' + iconUse("warning") + " Blokkade op route</span>" +
      "<span>Checklist: " + tel.gedaan + "/" + tel.totaal + "</span></div>"
    : "";

  return (
    '<article class="tripcard" data-trip="' + esc(trip.id) + '">' +
    '<div class="tripbanner">' + (actief ? '<span class="tripbadge">' + iconUse("locate") + " actief</span>" : "") +
      iconUse("map").replace('class="icon sm"', 'class="icon"') + "</div>" +
    '<div class="tripbody">' +
      '<div class="triptop"><h3>' + esc(trip.naam) + "</h3>" +
        '<div class="tripactions">' +
          '<button type="button" data-actie="hernoem" aria-label="Naam wijzigen" title="Naam wijzigen">' + iconUse("edit") + "</button>" +
          '<button type="button" data-actie="verwijder" class="danger" aria-label="Verwijderen" title="Verwijderen">' + iconUse("trash") + "</button>" +
        "</div></div>" +
      (van && naar
        ? '<div class="tripvan">' + iconUse("map") + esc(van) + '<span class="arrow">→</span>' + esc(naar) + "</div>"
        : '<div class="tripvan">Nog geen route ingevuld</div>') +
      '<div class="tripchips">' + tripStatChips(trip) + "</div>" +
      blockerNote +
      '<div class="tripprogress"><div class="progresswrap">' +
        '<div class="prow"><span>' + iconUse("checklist") + " Checklist</span><b>" + tel.gedaan + "/" + tel.totaal + "</b></div>" +
        '<div class="progressbar"><i style="width:' + pct + '%"></i></div></div>' +
        '<button type="button" class="tripgo" data-actie="open" aria-label="Openen">' + iconUse("arrow-right") + "</button></div>" +
    "</div></article>"
  );
}

function renderMijnReizen(){
  var wrap = document.getElementById("reizen-wrap");
  if(!wrap) return;
  var kaarten = TRIPS.map(function(t){ return tripKaartHTML(t); }).join("");
  wrap.innerHTML =
    '<div class="reizenhead"><div><h2>Mijn Reizen</h2>' +
      "<p>Beheer opgeslagen routes en controleer je voorbereidingen voor komende reizen.</p></div>" +
      '<button type="button" class="btn primary" id="btn-nieuwe-reis">' + iconUse("plus-pin") + " Nieuwe reis plannen</button>" +
    "</div>" +
    '<div class="tripgrid">' + kaarten +
      '<div class="tripnew" id="btn-tripnew"><div class="bubble">' + iconUse("plus-pin") + "</div>" +
      "<h3>Plan een nieuwe reis</h3><p>Vind de veiligste route, bereken tolkosten en check lokale regelgeving.</p>" +
      '<span class="go">Start routeplanner ' + iconUse("arrow-right") + "</span></div>" +
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
  if((c.tollVignette || {}).required) bits.push("Vignet vereist");
  var sch = tolSchatting(ROUTE_RES).filter(function(t){ return t.c.code === code; })[0];
  if(sch) bits.push("Tol circa €" + euroTekst(sch.hoog));
  var punten = ROUTE_TOLLS.filter(function(o){ return o.c.code === code && !o.p.optional; })
    .map(function(o){ return o.p.name; });
  if(punten.length) bits.push(punten.slice(0, 2).join(", "));
  return bits;
}

function reisNodeHTML(code, idx, eerste, laatste){
  var c = BY_CODE[code];
  if(!c) return "";
  var must = (c.mandatoryEquipment || []).filter(function(it){ return effectiveStatus(it, c) === "must"; });
  var advice = (c.mandatoryEquipment || []).filter(function(it){ return effectiveStatus(it, c) === "advice"; });
  var tolBits = jTolBits(code, c);

  var badge = eerste ? '<span class="jbadge">Start</span>'
            : laatste ? '<span class="jbadge dest">Bestemming</span>' : "";
  var tekst = eerste ? "Je reis begint hier. Goede reis en rijd voorzichtig!"
            : laatste ? "Je hebt je bestemming bereikt. Check de checklist nog één keer voor vertrek." : "";

  return '<div class="journeynode' + (idx % 2 ? " alt" : "") + '" data-idx="' + idx + '">' +
    '<div class="jnode-spacer"></div>' +
    '<div class="jnode-icon' + (laatste ? " dest" : "") + '">' +
      flagHTML(c) + '<span class="jcheck">' + iconUse("check") + "</span></div>" +
    '<div class="jcard-wrap"><div class="jcard' + (laatste ? " dest" : "") + '">' +
      '<div class="jcardtop"><h2>' + esc(c.name) + "</h2>" + badge + "</div>" +
      (tekst ? "<p>" + esc(tekst) + "</p>" : "") +
      (must.length
        ? '<div class="jsubkop">Verplicht</div><div class="jchips">' +
          must.map(function(it){ return '<span class="jchip must">' + esc(it.item) + "</span>"; }).join("") + "</div>"
        : "") +
      (advice.length
        ? '<div class="jsubkop">Aanbevolen</div><div class="jchips">' +
          advice.map(function(it){ return '<span class="jchip">' + esc(it.item) + "</span>"; }).join("") + "</div>"
        : "") +
      (tolBits.length ? '<div class="jtol">' + iconUse("payments") + esc(tolBits.join(" · ")) + "</div>" : "") +
      (laatste ? '<button type="button" class="btn primary wide" id="btn-reis-checklist">' + iconUse("checklist") + " Bekijk checklist</button>" : "") +
    "</div></div></div>";
}

function renderReisErvaring(){
  var wrap = document.getElementById("reis-wrap");
  if(!wrap) return;
  if(!ROUTE.length){
    wrap.innerHTML =
      '<div class="journeyempty">' + iconUse("journey").replace('class="icon sm"', 'class="icon lg"') +
      "<h1>Nog geen reis gepland</h1>" +
      "<p>Bereken eerst een route op de Routeplanner-pagina, dan verschijnt hier je reisbeleving.</p>" +
      '<button type="button" class="btn primary" id="btn-reis-naar-planner">Naar Routeplanner</button></div>';
    return;
  }

  var nodes = ROUTE.map(function(code, i){ return reisNodeHTML(code, i, i === 0, i === ROUTE.length - 1); }).join("");
  wrap.innerHTML =
    '<div class="journeyhead"><h1>Reis Route Ervaring</h1>' +
    "<p>Scroll naar beneden om je reis te ervaren en de verplichtingen per land te ontdekken.</p></div>" +
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
