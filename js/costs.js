"use strict";
/* Tol: het kasboekje per post en het retourtotaal. */

/* ================= tol onderweg (dormant tot Checklist/Tol-pagina) ================= */
function tolRegels(trip){
  var rijen = [];
  var sch = {};
  tolSchatting(trip).forEach(function(t){ sch[t.c.code] = t; });

  var punten = {};
  tripTolPunten(trip).forEach(function(o){
    if(o.p.optional) return;
    (punten[o.c.code] = punten[o.c.code] || []).push(o);
  });

  tripLanden(trip).forEach(function(code){
    var c = BY_CODE[code];
    if(!c) return;
    var had = false;

    var v = c.tollVignette || {};
    if(v.required){
      var naam = String(v.name || i18n("tol.vignetNaam")).split(/\s+[—-]\s+|,/)[0];
      rijen.push({ c:c, naam:c.name, detail:i18n("tol.vignetSnelweg", { naam:naam }),
                   zacht:i18n("tol.vignet") });
      had = true;
    }

    var t = sch[code];
    if(t){
      rijen.push({ c:c, naam:c.name,
        detail:i18n("tol.perKm", { km:Math.round(t.km), tarief:getal(t.c.tollRoads.perKm, { minimumFractionDigits:2, maximumFractionDigits:2 }) }),
        laag:t.laag, hoog:t.hoog, onzeker:t.onzeker });
      had = true;
    }

    (punten[code] || []).forEach(function(o){
      rijen.push({ c:c, naam:o.p.name,
        detail:o.p.note ? eersteZin(o.p.note) : i18n("tol.apartBetalen"),
        vast:(typeof o.p.priceEur === "number" ? o.p.priceEur : null),
        zacht:(typeof o.p.priceEur === "number" ? "" : i18n("tol.tariefOnbekend")),
        onzeker:!!o.p.needsVerification });
      had = true;
    });

    if(!had){
      if(tripAnalyse(trip)) rijen.push({ c:c, naam:c.name, detail:i18n("tol.geenTol"), vast:0 });
      else rijen.push({ c:c, naam:c.name, detail:i18n("tol.vulRouteIn"),
        zacht:i18n("tol.nogGeenRoute") });
    }
  });
  return rijen;
}

/* Notatie van de gekozen taal, en centen alleen als ze er zijn. */
function euroTekst(n){
  return n % 1 === 0
    ? getal(n)
    : getal(n, { minimumFractionDigits:2, maximumFractionDigits:2 });
}

function tolBedragHTML(r){
  if(r.zacht) return '<div class="bedrag zacht">' + esc(r.zacht) + "</div>";
  var tekst;
  if(typeof r.vast === "number") tekst = euroTekst(r.vast);
  else tekst = r.laag === r.hoog ? euroTekst(r.hoog) : euroTekst(r.laag) + "–" + euroTekst(r.hoog);
  return '<div class="bedrag">' + (r.onzeker ? '<span class="cur">~</span>' : "") +
    '<span class="cur">&euro;</span>' + tekst + "</div>";
}

function eersteZin(t){
  var m = String(t).match(/^[^.]+\./);
  return m ? m[0] : String(t);
}

/* ---------------- render: tolsamenvatting (bovenkant, retour) ---------------- */
function tolTotaalRetour(trip){
  if(!tripAnalyse(trip)) return null;
  var enkel = 0, zeker = true;

  tolSchatting(trip).forEach(function(t){
    enkel += t.hoog;
    if(t.onzeker) zeker = false;
  });
  tripTolPunten(trip).forEach(function(o){
    if(o.p.optional) return;
    if(typeof o.p.priceEur === "number") enkel += o.p.priceEur;
    else zeker = false;
  });
  tripLanden(trip).forEach(function(code){
    var c = BY_CODE[code];
    if(c && (c.tollVignette || {}).required) zeker = false;
  });

  if(!enkel) return null;
  return { bedrag: Math.round(enkel * 2), zeker: zeker };
}

/* ================= Kostenpagina =================

   §10 vraagt een volledig kostenoverzicht met brandstof erbij; dat is fase 5.
   Wat hier staat is wat de data nu kan onderbouwen: tol, vignetten en
   tolpunten, als kasboekje in de volgorde waarin je ze tegenkomt.

   De belangrijkste regel op deze pagina is de laatste: wat er NIET in het
   totaal zit. Vignetprijzen hangen af van hoe lang je blijft en staan alleen
   als lopende tekst in de bronnen; tolpunten zonder geverifieerd tarief tellen
   niet mee; autotreinen zijn een keuze en geen kost. In alle drie de gevallen
   staat er "of meer" achter het totaal in plaats van een getal dat te laag is
   zonder dat je dat ziet. */
function renderKosten(){
  var wrap = document.getElementById("kosten-wrap");
  if(!wrap || !TRIP || !DATA) return;

  if(!tripIsKlaar(TRIP)){
    wrap.innerHTML = '<div class="leegstaat">' + iconUse("payments").replace('class="icon sm"', 'class="icon lg"') +
      "<h1>" + esc(i18n("kosten.leegKop")) + "</h1>" +
      "<p>" + esc(i18n("kosten.leegTekst")) + "</p>" +
      '<button type="button" class="btn primary" data-view="wizard">' + esc(i18n("home.cta")) + "</button></div>";
    return;
  }

  var rijen = tolRegels(TRIP);
  var tol = tolTotaalRetour(TRIP);

  var kasboek = rijen.map(function(r){
    return '<li class="kostenrij">' + flagHTML(r.c) +
      '<div class="kostentekst"><span class="wat">' + esc(r.naam) + "</span>" +
      '<span class="waarom">' + esc(r.detail) + "</span></div>" +
      tolBedragHTML(r) + "</li>";
  }).join("");

  /* Wat de app niet weet, staat er als zodanig: geen schijnprecisie (§10). */
  var onbekend = [];
  tripLanden(TRIP).forEach(function(code){
    var c = BY_CODE[code], v = c.tollVignette || {};
    if(v.required) onbekend.push(i18n("kosten.vignetPrijs", { land:c.name }));
  });
  tripTolPunten(TRIP).forEach(function(o){
    if(o.p.optional) onbekend.push(i18n("kosten.autotrein", { naam:o.p.name }));
    else if(typeof o.p.priceEur !== "number") onbekend.push(i18n("kosten.tariefOnbekend", { naam:o.p.name }));
  });
  onbekend.push(i18n("kosten.geenBrandstof"));

  wrap.innerHTML =
    "<h1>" + esc(i18n("kosten.kop")) + "</h1>" +
    '<p class="lead">' + esc(i18n("kosten.intro")) + "</p>" +
    '<div class="kostengrid">' +
      '<section class="dashkaart">' +
        '<h2>' + esc(i18n("kosten.kasboek")) + "</h2>" +
        (kasboek ? '<ul class="kostenlijst">' + kasboek + "</ul>"
                 : '<p class="hint">' + esc(i18n("kosten.geenPosten")) + "</p>") +
        (tol ? '<p class="kostentotaal"><span>' + esc(i18n("kosten.totaalRetour")) + "</span>" +
          "<b>&euro;" + euroTekst(tol.bedrag) +
          (tol.zeker ? "" : ' <small>' + esc(i18n("planner.ofMeer")) + "</small>") + "</b></p>" : "") +
      "</section>" +
      '<section class="dashkaart nietmee">' +
        '<h2>' + esc(i18n("kosten.nietMeegerekend")) + "</h2>" +
        "<ul>" + onbekend.map(function(t){ return "<li>" + esc(t) + "</li>"; }).join("") + "</ul>" +
      "</section>" +
    "</div>";
}
