"use strict";
/* De kaart — §9 van de masterprompt.

   §9 zegt: "Voeg geen nieuwe externe kaartprovider toe zonder eerst de
   bestaande architectuur te controleren." Die controle levert drie dingen op
   die samen de keuze bepalen.

   1. De app haalt niets van buiten. Geen fonts, geen scripts, geen tegels. Dat
      is geen toeval maar de reden dat hij op een parkeerplaats zonder bereik
      nog werkt — precies het moment waarop je hem nodig hebt.
   2. De landsgrenzen liggen er al: `borders.json` (349 KB, Natural Earth,
      publiek domein) wordt sowieso geladen voor de landdetectie. Daar staan 34
      Europese landen in als polygonen.
   3. De routegeometrie, de tolpunten en de milieuzones liggen er ook al.

   Een kaartbibliotheek met tegels toevoegen zou dus een externe afhankelijkheid
   en een paar honderd kilobyte introduceren om iets te tekenen waarvan we de
   data al in het geheugen hebben — en de offline-eigenschap slopen. Deze kaart
   tekent daarom zelf: landen en grenzen uit borders.json, de route uit de
   trip, en markers voor tolpunten, milieuzones en blokkades.

   Wat je daarmee niet krijgt: straatnamen, luchtfoto's, en inzoomen tot op
   huisnummerniveau. Wat je wel krijgt: waar loopt mijn route, welke landen raak
   ik, en waar zitten de dingen die me geld of een boete kosten. Dat is precies
   de vraag die deze app beantwoordt.

   Lazy (§25): de kaart wordt pas opgebouwd als de pagina zichtbaar is, en
   opnieuw alleen als de reis of de zoom veranderde. */

var MAP_VB_W = 1000, MAP_VB_H = 700, MAP_PAD = 60;

/* Zoom en verschuiving staan hier en niet op de trip: het is hoe je kijkt,
   niet wat je gepland hebt. */
/* Twee markers dichter dan dit bij elkaar overlappen elkaars stip en worden
   uit elkaar gelegd. */
var SPREID_DREMPEL = 14;

var KAART = { zoom: 1, panX: 0, panY: 0, marker: null, sleutel: null, markers: [] };

/* ---------------- projectie ---------------- */

/* Equirectangulair met een cosinus-correctie op de middelste breedtegraad. Voor
   een gebied ter grootte van een autorit is dat niet van een echte projectie te
   onderscheiden, en het is één regel rekenwerk per punt. */
/* De ruimte die de knoppen en de legenda van de kaart afsnoepen.

   Die liggen als HTML bóvenop de SVG, en op een breed scherm valt dat niet op.
   Op een telefoon wel: bij Brussel → Salzburg kwam de eindmarker precies onder
   de zoomknoppen te liggen, en een marker onder een knop is met geen vinger te
   raken. De tekening wijkt daarom uit. Gemeten in plaats van geraden, want
   hetzelfde blokje van 44 pixels is op een brede kaart een randje en op een
   smalle een kwart van het beeld — vandaar ook de bovengrens: liever een
   marker die net onder een knop uitkomt dan een kaart die in een hoekje is
   samengeperst.

   Alleen de knoppen krijgen ruimte. De legenda linksonder staat er ook, maar
   die is niet aan te klikken en krijgt `pointer-events:none`: een marker die er
   half achter valt is nog steeds te raken, en de kaart schuift niet opzij voor
   een bijschrift. */
function overlayInset(){
  var host = document.getElementById("mapwrap");
  var leeg = { rechts:0, onder:0 };
  if(!host) return leeg;
  var h = host.getBoundingClientRect();
  if(!h.width || !h.height) return leeg;

  var f = schermNaarViewBox();
  var max = { rechts: MAP_VB_W * 0.25, onder: MAP_VB_H * 0.25 };

  function ruimte(sel, kant){
    var el = document.querySelector(".panel-map " + sel);
    if(!el) return 0;
    var r = el.getBoundingClientRect();
    if(!r.width || !r.height) return 0;
    var px = kant === "rechts" ? h.right - r.left : h.bottom - r.top;
    return Math.max(0, Math.min(max[kant], (px + 12) * f));
  }

  return {
    rechts: ruimte(".mapctrl.bottom", "rechts"),
    onder:  ruimte(".mapctrl.bottom", "onder")
  };
}

function projectieVoor(minLon, minLat, maxLon, maxLat, inset){
  inset = inset || { rechts:0, onder:0 };
  var cosLat = Math.max(0.2, Math.cos((minLat + maxLat) / 2 * Math.PI / 180));
  var dataW = Math.max(1e-6, (maxLon - minLon) * cosLat);
  var dataH = Math.max(1e-6, (maxLat - minLat));
  var W = Math.max(80, MAP_VB_W - MAP_PAD * 2 - inset.rechts);
  var H = Math.max(80, MAP_VB_H - MAP_PAD * 2 - inset.onder);
  var scale = Math.min(W / dataW, H / dataH);
  var offX = MAP_PAD + (W - dataW * scale) / 2;
  var offY = MAP_PAD + (H - dataH * scale) / 2;

  var proj = function(lon, lat){
    return [offX + (lon - minLon) * cosLat * scale, offY + (maxLat - lat) * scale];
  };
  /* De omgekeerde weg, zodat we kunnen bepalen welk stuk wereld er in beeld is
     en welke landen we dus moeten tekenen. */
  proj.terug = function(x, y){
    return [minLon + (x - offX) / (cosLat * scale), maxLat - (y - offY) / scale];
  };
  return proj;
}

function routeBbox(coords){
  var b = [Infinity, Infinity, -Infinity, -Infinity];
  for(var i = 0; i < coords.length; i++){
    var lon = coords[i][0], lat = coords[i][1];
    if(lon < b[0]) b[0] = lon;
    if(lat < b[1]) b[1] = lat;
    if(lon > b[2]) b[2] = lon;
    if(lat > b[3]) b[3] = lat;
  }
  /* Een marge eromheen, zodat de route niet tegen de rand plakt en je de landen
     eromheen ziet liggen. */
  var mx = Math.max(0.6, (b[2] - b[0]) * 0.12), my = Math.max(0.4, (b[3] - b[1]) * 0.12);
  return [b[0] - mx, b[1] - my, b[2] + mx, b[3] + my];
}

/* ---------------- landen en grenzen ---------------- */

/* Tekent de polygonen uit borders.json. Drie besparingen, want dit bestand
   bevat 26.000 punten en die hoeven niet allemaal in de DOM:

     - landen buiten beeld vallen af op hun bbox;
     - ringen die op deze schaal kleiner dan een paar pixels zijn (eilandjes)
       vallen af;
     - opeenvolgende punten dichter dan een halve pixel vallen af.

   Wat overblijft is voor een gemiddelde rit een paar duizend punten. */
function landenPaden(proj, view){
  if(!BORDERS) return "";
  var opRoute = {};
  tripLanden(TRIP).forEach(function(code){ opRoute[code] = 1; });

  var stukken = [];
  for(var code in BORDERS){
    if(code.charAt(0) === "_") continue;
    var g = BORDERS[code], b = g.b;
    if(b[2] < view[0] || b[0] > view[2] || b[3] < view[1] || b[1] > view[3]) continue;

    var d = "";
    for(var p = 0; p < g.p.length; p++){
      var poly = g.p[p];
      for(var r = 0; r < poly.length; r++){
        d += ringPad(poly[r], proj);
      }
    }
    if(!d) continue;
    stukken.push('<path class="land' + (opRoute[code] ? " op-route" : "") +
      '" d="' + d + '"></path>');
  }
  return '<g class="landen" aria-hidden="true">' + stukken.join("") + "</g>";
}

function ringPad(ring, proj){
  var n = ring.length;
  if(n < 6) return "";
  var punten = [], vx = null, vy = null;
  var minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for(var i = 0; i < n; i += 2){
    var pt = proj(ring[i], ring[i + 1]);
    var x = Math.round(pt[0] * 10) / 10, y = Math.round(pt[1] * 10) / 10;
    if(x < minX) minX = x;
    if(y < minY) minY = y;
    if(x > maxX) maxX = x;
    if(y > maxY) maxY = y;
    if(vx !== null && Math.abs(x - vx) < 0.5 && Math.abs(y - vy) < 0.5) continue;
    punten.push(x + " " + y);
    vx = x; vy = y;
  }
  if(punten.length < 3) return "";
  if(maxX - minX < 3 && maxY - minY < 3) return "";   /* eilandje, niet zichtbaar */
  return "M" + punten.join("L") + "Z";
}

/* ---------------- markers ---------------- */

/* Alles wat op de kaart aanklikbaar is, met precies de velden die §9 vraagt:
   naam, type, informatie, kosten indien bekend, waarschuwing, bron. Ze komen
   uit dezelfde data als de rest van de app — tollPoints, zones.json en het
   milieuzone-oordeel — dus er is geen tweede waarheid over wat er langs de
   route ligt. */
function kaartMarkers(trip, proj){
  var uit = [];
  var coords = trip.route && trip.route.coordinates;
  if(!coords || !coords.length) return uit;

  function punt(lon, lat){ return proj(lon, lat); }

  var start = punt(coords[0][0], coords[0][1]);
  uit.push({ id:"start", type:"start", x:start[0], y:start[1],
    titel: trip.origin ? trip.origin.naam : i18n("kaart.start"),
    subtitel: i18n("kaart.type.start") });

  var laatste = coords[coords.length - 1];
  var eind = punt(laatste[0], laatste[1]);
  uit.push({ id:"eind", type:"eind", x:eind[0], y:eind[1],
    titel: trip.destination ? trip.destination.naam : i18n("kaart.eind"),
    subtitel: i18n("kaart.type.eind") });

  /* Tolpunten: tunnels, passen en bruggen die je apart betaalt. */
  tripTolPunten(trip).forEach(function(o){
    var p = o.p, xy = punt(p.lon, p.lat);
    var h = herkomstVan(p, o.c);
    uit.push({
      id: "tol-" + (p.id || p.name), type: p.optional ? "optioneel" : "tol",
      x: xy[0], y: xy[1], land: o.c,
      titel: p.name,
      subtitel: i18n(p.optional ? "kaart.type.optioneel" : "kaart.type.tol"),
      info: p.note || "",
      kosten: typeof p.priceEur === "number"
        ? "&euro;" + euroTekst(p.priceEur) + " " + esc(i18n("kaart.perDoorgang"))
        : esc(p.price || i18n("tol.tariefOnbekend")),
      waarschuwing: p.optional ? i18n("kaart.optioneelUitleg") : "",
      bron: h
    });
  });

  /* Milieuzones op stadsniveau, met het oordeel voor dít voertuig erbij. */
  tripZones(trip).forEach(function(o){
    var z = o.zone, xy = punt(z.lon, z.lat);
    var v = zoneStadVerdict(z, trip);
    uit.push({
      id: "zone-" + z.id, type: v.level === "bad" ? "zonebad" : "zone",
      x: xy[0], y: xy[1], land: BY_CODE[z.cc] || null,
      titel: z.city, subtitel: i18n("kaart.type.zone") + " · " + (z.name || ""),
      info: z.rule || z.note || "",
      waarschuwing: v.text,
      bron: herkomstVan(z, BY_CODE[z.cc])
    });
  });

  return spreidSamenvallend(uit);
}

/* Markers die op hetzelfde punt liggen uit elkaar leggen.

   Op een rit naar Milaan vielen er drie samen: de bestemming en de twee
   milieuzones van de stad, alle drie op het stadscentrum. Alleen de bovenste
   was aan te klikken; de andere twee bestonden voor een muis en een vinger
   niet, hoe groot je het aanraakvlak ook maakt. Zoomen hielp niet, want ze
   schaalden gelijk mee.

   Gegroepeerd op werkelijke afstand, niet op een rasterhokje. Dat laatste was
   de eerste poging en het ging op de eerste echte route al mis: het vertrekpunt
   in Brussel en de Brusselse milieuzone lagen drie tiende van een eenheid uit
   elkaar en vielen net aan weerszijden van een hokgrens, waarmee ze voor de
   spreiding geen buren waren en de ene marker de andere alsnog opat.

   De plaatsmarker — het begin of het eind van de reis — blijft staan waar hij
   hoort; de rest komt in een kransje eromheen. Dat verschuift een zone met een
   twintig viewBox-eenheden, op een schets die duizend kilometer breed is een
   kilometer of twintig. Deze kaart belooft die precisie niet: hij laat zien
   dat er iets is en waar ongeveer, en de popup vertelt de rest. Een marker die
   drie kilometer preciezer staat maar niet te openen is, vertelt niets. */
function spreidSamenvallend(markers){
  var groep = [], groepen = [];
  var i, j;
  for(i = 0; i < markers.length; i++) groep[i] = -1;

  for(i = 0; i < markers.length; i++){
    if(groep[i] !== -1) continue;
    var leden = [markers[i]];
    groep[i] = groepen.length;
    for(j = i + 1; j < markers.length; j++){
      if(groep[j] !== -1) continue;
      var dx = markers[j].x - markers[i].x, dy = markers[j].y - markers[i].y;
      if(Math.sqrt(dx * dx + dy * dy) <= SPREID_DREMPEL){
        groep[j] = groepen.length;
        leden.push(markers[j]);
      }
    }
    groepen.push(leden);
  }

  groepen.forEach(function(leden){
    if(leden.length < 2) return;

    /* De plaatsmarker blijft staan waar hij hoort; de rest komt eromheen. */
    var anker = null, rest = [];
    leden.forEach(function(m){
      if(!anker && (m.type === "start" || m.type === "eind")) anker = m;
      else rest.push(m);
    });
    var midden = anker ? { x:anker.x, y:anker.y } : { x:leden[0].x, y:leden[0].y };
    if(!anker) rest = leden;

    var straal = 16 + rest.length * 2;
    rest.forEach(function(m, k){
      var hoek = -Math.PI / 2 + (k * 2 * Math.PI) / rest.length;
      m.x = midden.x + Math.cos(hoek) * straal;
      m.y = midden.y + Math.sin(hoek) * straal;
    });
  });

  return markers;
}


var MARKER_VORM = {
  start:     { r:9,  teken:"" },
  eind:      { r:9,  teken:"" },
  tol:       { r:11, teken:"€" },
  optioneel: { r:11, teken:"~" },
  zone:      { r:11, teken:"Z" },
  zonebad:   { r:12, teken:"!" }
};

/* Markers zijn knoppen, geen plaatjes: ze zijn met tab te bereiken en met Enter
   te openen (§21). Een kaart die alleen met een muis werkt, is voor een deel
   van je gebruikers geen kaart.

   De tekening blijft met opzet klein — een dikke stip verstopt de route
   eronder — maar op een telefoon is de kaart zo ver uitgeschaald dat een marker
   van elf viewBox-eenheden nog geen twaalf schermpixels meet, en dat is met een
   vinger niet te raken. Daarom draagt elke marker een onzichtbaar aanraakvlak
   van 44 schermpixels (`markerHitHTML`, `pasHitVlakkenAan`).

   Die vlakken staan in een eigen laag *onder* alle stippen, niet als kind van
   de marker zelf. Dat is geen opmaakvoorkeur maar de kern van de zaak: op een
   telefoon is 44 schermpixels bijna zestig viewBox-eenheden, en als het vlak
   met zijn eigen marker meereist, legt het zich over de stip van de buurman
   heen. De laatste in de tekenvolgorde wint dan alles, en op een route met drie
   markers dicht bij elkaar waren er twee niet meer aan te klikken. Met alle
   vlakken onderop staat elke stip altijd bovenop zijn eigen vlak: precies
   mikken werkt altijd, en de slack eromheen valt naar de dichtstbijzijnde. */
function markerHTML(m, i){
  var vorm = MARKER_VORM[m.type] || MARKER_VORM.tol;
  return '<g class="marker m-' + m.type + '" data-marker="' + i + '" role="button" tabindex="0"' +
    ' aria-label="' + esc(m.titel + " — " + m.subtitel) + '"' +
    ' transform="translate(' + m.x.toFixed(1) + "," + m.y.toFixed(1) + ')">' +
    '<circle class="mring" r="' + (vorm.r + 3) + '"></circle>' +
    '<circle class="mdot" r="' + vorm.r + '"></circle>' +
    (vorm.teken ? '<text class="mteken" y="4">' + vorm.teken + "</text>" : "") +
    "</g>";
}

/* Het aanraakvlak van één marker, in een eigen laag onder alle stippen. */
function markerHitHTML(m, i){
  var vorm = MARKER_VORM[m.type] || MARKER_VORM.tol;
  return '<circle class="mhit" data-marker="' + i +
    '" cx="' + m.x.toFixed(1) + '" cy="' + m.y.toFixed(1) +
    '" r="' + (vorm.r + 4) + '"></circle>';
}

/* ---------------- opbouw ---------------- */

/* De afgeleide waarden horen in de sleutel. borders.json en zones.json komen na
   de eerste tekening binnen (ze laden lazy), en zonder dat de sleutel daarop
   let bleef de kaart hangen op de versie zonder landen en zonder markers. */
function kaartSleutel(trip){
  return [trip.id, trip.updatedAt, TAAL, BORDERS ? 1 : 0,
          tripZones(trip).length, tripTolPunten(trip).length].join("|");
}

function renderKaart(){
  var host = document.getElementById("mapwrap");
  if(!host || !TRIP) return;
  var coords = TRIP.route && TRIP.route.coordinates;

  if(!coords || !coords.length){
    KAART.sleutel = null;
    host.innerHTML = '<div class="mapempty">' + iconUse("map").replace('class="icon sm"', 'class="icon lg"') +
      "<p>" + esc(i18n("kaart.leeg")) + "</p>" +
      '<button type="button" class="btn" data-view="wizard">' + esc(i18n("home.cta")) + "</button></div>";
    return;
  }

  /* §25: niets opnieuw opbouwen zolang er niets veranderde. Het tekenen van de
     landen is het duurste wat deze app doet. */
  var sleutel = kaartSleutel(TRIP);
  if(KAART.sleutel === sleutel && host.querySelector("#routesvg")){
    /* Niets herbouwen, maar de aanraakvlakken wél opnieuw meten: het venster
       kan van maat zijn veranderd terwijl de kaart in de cache stond, en dan
       staan ze op de schaal van het vorige scherm. */
    pasHitVlakkenAan();
    return;
  }
  KAART.sleutel = sleutel;

  var bbox = routeBbox(coords);
  var proj = projectieVoor(bbox[0], bbox[1], bbox[2], bbox[3], overlayInset());
  var view = bbox;

  var step = Math.max(1, Math.floor(coords.length / 700));
  var pts = [];
  for(var i = 0; i < coords.length; i += step) pts.push(proj(coords[i][0], coords[i][1]));
  pts.push(proj(coords[coords.length - 1][0], coords[coords.length - 1][1]));
  var d = pts.map(function(p, i){
    return (i === 0 ? "M" : "L") + p[0].toFixed(1) + " " + p[1].toFixed(1);
  }).join(" ");

  KAART.markers = kaartMarkers(TRIP, proj);

  host.innerHTML =
    '<svg id="routesvg" viewBox="0 0 ' + MAP_VB_W + " " + MAP_VB_H + '"' +
      ' preserveAspectRatio="xMidYMid meet" role="img"' +
      ' aria-label="' + esc(i18n("kaart.omschrijving", {
        van: TRIP.origin ? TRIP.origin.naam : "—",
        naar: TRIP.destination ? TRIP.destination.naam : "—",
        landen: tripLanden(TRIP).length })) + '">' +
      /* Zoomen en slepen gebeurt op deze laag, niet met een CSS-transform op de
         <svg> zelf: die wordt in sommige engines genegeerd, en dan schuift de
         kaart wel maar de markers niet mee. Een transform-attribuut op een <g>
         is gewoon SVG en werkt overal hetzelfde. */
      '<g id="kaartlaag">' +
        landenPaden(proj, view) +
        '<path d="' + d + '" class="routeline-glow"></path>' +
        '<path d="' + d + '" class="routeline"></path>' +
        '<g class="markerhits" aria-hidden="true">' +
          KAART.markers.map(markerHitHTML).join("") + "</g>" +
        '<g class="markers">' + KAART.markers.map(markerHTML).join("") + "</g>" +
      "</g>" +
    "</svg>" +
    kaartLegendaHTML();

  pasKaartTransformToe();
  pasHitVlakkenAan();
}

function kaartLegendaHTML(){
  var soorten = [];
  var gezien = {};
  KAART.markers.forEach(function(m){
    if(m.type === "start" || m.type === "eind" || gezien[m.type]) return;
    gezien[m.type] = 1;
    soorten.push(m.type);
  });
  if(!soorten.length) return "";
  return '<ul class="kaartlegenda">' + soorten.map(function(t){
    return '<li><span class="lmarker m-' + t + '" aria-hidden="true">' +
      ((MARKER_VORM[t] || {}).teken || "") + "</span>" +
      esc(i18n("kaart.type." + (t === "zonebad" ? "zonebad" : t))) + "</li>";
  }).join("") + "</ul>";
}

/* ---------------- popup ----------------
   Een HTML-kaartje boven de SVG, niet in de SVG: tekstopmaak, links en
   schermlezers werken daar gewoon. De positie komt uit de schermcoördinaten van
   de marker, dus hij klopt ook na zoomen en slepen. */
function toonMarkerPopup(index){
  var m = KAART.markers[index];
  var host = document.getElementById("mapwrap");
  if(!m || !host) return;
  KAART.marker = index;

  var el = document.getElementById("kaartpopup");
  if(!el){
    el = document.createElement("div");
    el.id = "kaartpopup";
    el.className = "kaartpopup";
    el.setAttribute("role", "dialog");
    el.setAttribute("aria-labelledby", "kaartpopup-titel");
    host.appendChild(el);
  }

  var bron = m.bron || {};
  el.innerHTML =
    '<button type="button" class="popupsluit" id="popup-sluit" aria-label="' +
      esc(i18n("alg.sluiten")) + '">&times;</button>' +
    '<p class="popuptype">' + (m.land ? flagHTML(m.land) : "") +
      "<span>" + esc(m.subtitel) + "</span></p>" +
    '<h3 id="kaartpopup-titel">' + esc(m.titel) + "</h3>" +
    (m.kosten ? '<p class="popupkosten">' + m.kosten + "</p>" : "") +
    (m.waarschuwing ? '<p class="popupwaarschuwing">' + iconUse("warning") +
      esc(m.waarschuwing) + "</p>" : "") +
    (m.info ? '<p class="popupinfo">' + esc(eersteZinnen(m.info, 2)) + "</p>" : "") +
    (bron.factId
      ? '<p class="bronregel">' + confidenceChipHTML(bron) + "</p>" +
        '<p class="bronacties">' + herkomstRegelHTML({ bron:bron }) +
        (m.land ? '<span class="melden">' + correctionLinks(m.land, bron.factId) + "</span>" : "") + "</p>"
      : "");

  el.hidden = false;
  positioneerPopup(index);
  var sluit = document.getElementById("popup-sluit");
  if(sluit) sluit.focus();
}

function positioneerPopup(index){
  var el = document.getElementById("kaartpopup");
  var host = document.getElementById("mapwrap");
  var marker = document.querySelector('#mapwrap .marker[data-marker="' + index + '"]');
  if(!el || !host || !marker) return;
  var mr = marker.getBoundingClientRect(), hr = host.getBoundingClientRect();
  var breedte = el.offsetWidth || 260, hoogte = el.offsetHeight || 160;

  var x = mr.left + mr.width / 2 - hr.left - breedte / 2;
  var y = mr.top - hr.top - hoogte - 14;
  if(y < 8) y = mr.bottom - hr.top + 14;          /* onder de marker als het boven niet past */
  x = Math.max(8, Math.min(x, hr.width - breedte - 8));
  el.style.left = Math.round(x) + "px";
  el.style.top = Math.round(y) + "px";
}

function sluitMarkerPopup(){
  var el = document.getElementById("kaartpopup");
  if(!el || el.hidden) return;
  el.hidden = true;
  var vorige = document.querySelector('#mapwrap .marker[data-marker="' + KAART.marker + '"]');
  KAART.marker = null;
  if(vorige) vorige.focus();
}

/* ---------------- zoomen en slepen ---------------- */
/* De verschuiving komt binnen in schermpixels (van de muis of een vinger) en
   moet naar viewBox-eenheden. De schaal daartussen volgt uit preserveAspectRatio
   "meet": de kleinste van de twee verhoudingen. */
function schermNaarViewBox(){
  var svg = document.getElementById("routesvg");
  if(!svg) return 1;
  var r = svg.getBoundingClientRect();
  if(!r.width || !r.height) return 1;
  return 1 / Math.min(r.width / MAP_VB_W, r.height / MAP_VB_H);
}

/* Het aanraakvlak van elke marker op 44 schermpixels brengen (§21). Hoeveel
   viewBox-eenheden dat zijn hangt af van hoe groot de SVG op dit scherm staat
   en van de zoom, dus dit gebeurt na elke tekening, na elke zoomstap en als het
   venster van maat verandert. Een cap op de afstand tot de buren is niet nodig:
   de vlakken liggen onder de stippen. */
function pasHitVlakkenAan(){
  var r = Math.max(14, 22 * schermNaarViewBox() / KAART.zoom).toFixed(1);
  [].forEach.call(document.querySelectorAll("#kaartlaag .mhit"), function(c){
    c.setAttribute("r", r);
  });
}

function pasKaartTransformToe(){
  var laag = document.getElementById("kaartlaag");
  if(!laag) return;
  var f = schermNaarViewBox();
  var cx = MAP_VB_W / 2, cy = MAP_VB_H / 2;
  /* Rond het midden schalen, zodat inzoomen niet naar de linkerbovenhoek trekt. */
  laag.setAttribute("transform",
    "translate(" + (KAART.panX * f).toFixed(1) + "," + (KAART.panY * f).toFixed(1) + ") " +
    "translate(" + cx + "," + cy + ") scale(" + KAART.zoom.toFixed(3) + ") " +
    "translate(" + (-cx) + "," + (-cy) + ")");
  if(KAART.marker !== null) positioneerPopup(KAART.marker);
}

function kaartZoom(factor){
  KAART.zoom = Math.max(0.6, Math.min(6, KAART.zoom * factor));
  pasKaartTransformToe();
  pasHitVlakkenAan();
}

function kaartHerstel(){
  KAART.zoom = 1; KAART.panX = 0; KAART.panY = 0;
  pasKaartTransformToe();
  pasHitVlakkenAan();
}

/* Slepen met muis of vinger. Pointer events dekken beide, en de kaart vangt ze
   alleen als je op het vlak zelf begint — niet op een marker of de popup. */
function wireKaart(){
  var host = document.getElementById("mapwrap");
  if(!host) return;
  var sleept = false, startX = 0, startY = 0, basisX = 0, basisY = 0, bewogen = 0;

  host.addEventListener("pointerdown", function(e){
    if(e.target.closest(".marker, .kaartpopup")) return;
    sleept = true; bewogen = 0;
    startX = e.clientX; startY = e.clientY;
    basisX = KAART.panX; basisY = KAART.panY;
    host.setPointerCapture(e.pointerId);
    host.classList.add("sleept");
  });
  host.addEventListener("pointermove", function(e){
    if(!sleept) return;
    var dx = e.clientX - startX, dy = e.clientY - startY;
    bewogen = Math.max(bewogen, Math.abs(dx) + Math.abs(dy));
    KAART.panX = basisX + dx; KAART.panY = basisY + dy;
    pasKaartTransformToe();
  });
  function stop(e){
    if(!sleept) return;
    sleept = false;
    host.classList.remove("sleept");
    if(e && e.pointerId !== undefined && host.hasPointerCapture(e.pointerId)) host.releasePointerCapture(e.pointerId);
  }
  host.addEventListener("pointerup", stop);
  host.addEventListener("pointercancel", stop);

  host.addEventListener("click", function(e){
    if(e.target.closest("#popup-sluit")){ sluitMarkerPopup(); return; }
    if(e.target.closest(".kaartpopup")) return;
    var marker = e.target.closest("[data-marker]");
    if(marker){
      if(bewogen > 6) return;                       /* dit was slepen, geen klik */
      toonMarkerPopup(Number(marker.getAttribute("data-marker")));
      return;
    }
    sluitMarkerPopup();
  });

  host.addEventListener("keydown", function(e){
    var marker = e.target.closest("[data-marker]");
    if(marker && (e.key === "Enter" || e.key === " ")){
      e.preventDefault();
      toonMarkerPopup(Number(marker.getAttribute("data-marker")));
      return;
    }
    if(e.key === "Escape") sluitMarkerPopup();
  });

  /* Scrollen zoomt alleen met ctrl of cmd erbij: anders kun je op een telefoon
     of trackpad niet meer langs de kaart scrollen zonder erin te zoomen. */
  /* De inset is in viewBox-eenheden en hangt van de schermmaat af, dus na een
     draai of een venstermaatverandering klopt de tekening niet meer. Opnieuw
     tekenen kost tien milliseconden en gebeurt pas als het schuiven ophoudt. */
  var hertekenTimer = null;
  window.addEventListener("resize", function(){
    pasHitVlakkenAan();
    clearTimeout(hertekenTimer);
    hertekenTimer = setTimeout(function(){
      if(VIEW !== "kaart") return;
      KAART.sleutel = null;
      renderKaart();
    }, 200);
  });

  host.addEventListener("wheel", function(e){
    if(!e.ctrlKey && !e.metaKey) return;
    e.preventDefault();
    kaartZoom(e.deltaY < 0 ? 1.15 : 1 / 1.15);
  }, { passive:false });
}
