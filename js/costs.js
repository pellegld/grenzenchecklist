"use strict";
/* Tol: het kasboekje per post en het retourtotaal. */

/* ================= tol onderweg (dormant tot Checklist/Tol-pagina) ================= */
function tolRegels(){
  var rijen = [];
  var sch = {};
  tolSchatting(ROUTE_RES).forEach(function(t){ sch[t.c.code] = t; });

  var punten = {};
  ROUTE_TOLLS.forEach(function(o){
    if(o.p.optional) return;
    (punten[o.c.code] = punten[o.c.code] || []).push(o);
  });

  ROUTE.forEach(function(code){
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
      if(ROUTE_RES) rijen.push({ c:c, naam:c.name, detail:i18n("tol.geenTol"), vast:0 });
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

function renderTol(){
  var sec = document.getElementById("tol");
  if(!sec) return;
  var rijen = ROUTE.length ? tolRegels() : [];
  if(!rijen.length){ sec.hidden = true; sec.innerHTML = ""; return; }
  sec.hidden = false;
}

function eersteZin(t){
  var m = String(t).match(/^[^.]+\./);
  return m ? m[0] : String(t);
}

/* ---------------- render: tolsamenvatting (bovenkant, retour) ---------------- */
function tolTotaalRetour(){
  if(!ROUTE_RES) return null;
  var enkel = 0, zeker = true;

  tolSchatting(ROUTE_RES).forEach(function(t){
    enkel += t.hoog;
    if(t.onzeker) zeker = false;
  });
  ROUTE_TOLLS.forEach(function(o){
    if(o.p.optional) return;
    if(typeof o.p.priceEur === "number") enkel += o.p.priceEur;
    else zeker = false;
  });
  ROUTE.forEach(function(code){
    var c = BY_CODE[code];
    if(c && (c.tollVignette || {}).required) zeker = false;
  });

  if(!enkel) return null;
  return { bedrag: Math.round(enkel * 2), zeker: zeker };
}
