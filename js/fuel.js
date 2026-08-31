"use strict";
/* Onderweg-modus, deel 3: tankstrategie.

   Combineert het wekelijkse Oil Bulletin (fuelprices.json) met de landen op de
   route. Met een berekende route (afstand per land bekend) een concreet advies
   met een indicatieve besparing; zonder route alleen de prijstabel — zelfde
   onderscheid als tolSchatting() in js/geo.js al maakt tussen een berekende en
   een handmatige landenlijst. */

/* Geen tankinhoud bekend van de auto — dat veld bestaat niet in het
   voertuigprofiel. De besparing rekent daarom met een aanname van een volle
   tank, expliciet zo genoemd in de tekst, in plaats van een tankgrootte te
   verzinnen die net zo goed fout kan zijn als geen aanname te doen. */
var TANK_AANNAME_LITER = 50;

function tankPrijzen(trip){
  if(!FUELPRICES || !FUELPRICES.prices) return null;
  var soort = brandstofVoorDrempel(trip.vehicle);
  if(soort === "ev") return null;
  var veld = soort === "diesel" ? "diesel" : "petrol";
  var landen = tripLanden(trip);
  if(!landen.length) return null;
  var rijen = landen.map(function(code){
    var p = FUELPRICES.prices[code];
    if(!p || p[veld] == null) return null;
    return { code: code, c: BY_CODE[code], prijs: p[veld] };
  }).filter(Boolean);
  return rijen.length ? { veld: veld, rijen: rijen } : null;
}

function tankAdvies(trip){
  var t = tankPrijzen(trip);
  if(!t) return { t: null, advies: null };
  var goedkoop = t.rijen[0], duur = t.rijen[0];
  t.rijen.forEach(function(r){
    if(r.prijs < goedkoop.prijs) goedkoop = r;
    if(r.prijs > duur.prijs) duur = r;
  });
  var res = tripAnalyse(trip);
  var advies = null;
  if(res && duur.code !== goedkoop.code && duur.prijs > goedkoop.prijs){
    advies = {
      goedkoop: goedkoop, duur: duur,
      besparing: Math.round((duur.prijs - goedkoop.prijs) * TANK_AANNAME_LITER * 100) / 100
    };
  }
  return { t: t, advies: advies, heeftRoute: !!res };
}

function tankRijHTML(r, veld){
  return '<li class="kostenrij">' + flagHTML(r.c) +
    '<div class="kostentekst"><span class="wat">' + esc(r.c.name) + '</span>' +
      '<span class="waarom">' + esc(i18n("tank.perLiter." + veld)) + '</span></div>' +
    '<div class="bedrag">' + '<span class="cur">&euro;</span>' + euroTekst(r.prijs) + '</div>' +
  '</li>';
}

function tankstrategieHTML(trip){
  if(!FUELPRICES){
    return '<section class="dashkaart tankkaart"><h2>' + iconUse("eco") + esc(i18n("tank.kop")) + '</h2>' +
      '<p class="hint">' + esc(i18n("tank.geenData")) + '</p></section>';
  }
  var soort = brandstofVoorDrempel(trip.vehicle);
  if(soort === "ev"){
    return '<section class="dashkaart tankkaart"><h2>' + iconUse("eco") + esc(i18n("tank.kop")) + '</h2>' +
      '<p class="hint">' + esc(i18n("tank.ev")) + '</p></section>';
  }
  var r = tankAdvies(trip);
  if(!r.t){
    return '<section class="dashkaart tankkaart"><h2>' + iconUse("eco") + esc(i18n("tank.kop")) + '</h2>' +
      '<p class="hint">' + esc(i18n("tank.geenLanden")) + '</p></section>';
  }
  var adviesHTML = r.advies
    ? '<p class="tankadvies">' + iconUse("eco") + esc(i18n("tank.advies", {
        goedkoop: r.advies.goedkoop.c.name, duur: r.advies.duur.c.name,
        besparing: euroTekst(r.advies.besparing), liter: TANK_AANNAME_LITER })) + '</p>'
    : '<p class="hint">' + esc(i18n(r.heeftRoute ? "tank.geenAdvies" : "tank.geenRoute")) + '</p>';

  return '<section class="dashkaart tankkaart">' +
    '<h2>' + iconUse("eco") + esc(i18n("tank.kop")) + '</h2>' +
    '<p class="hint">' + esc(i18n("tank.uitleg")) + '</p>' +
    adviesHTML +
    '<ul class="kostenlijst">' + r.t.rijen.map(function(row){ return tankRijHTML(row, r.t.veld); }).join("") + '</ul>' +
    '<p class="hint tankdatum">' + esc(i18n("tank.prijsdatum", { datum: fmtDate(FUELPRICES.meta.priceDate) })) + '</p>' +
    '<p class="hint">' + esc(FUELPRICES.meta.disclaimer || i18n("tank.disclaimer")) + '</p>' +
  '</section>';
}
