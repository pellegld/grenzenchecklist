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

/* Onder deze afstand loont een tankstop niet: je hebt de kilometers al gereden
   waarin het prijsverschil terug had moeten komen. Dit is een grens, geen
   berekening — hij staat apart zodat je hem kunt bijstellen zonder de rest te
   hoeven doorgronden. Het effect is dat het eindland van een enkele reis vanzelf
   afvalt: daar tank je niet meer vol voor een route die daar ophoudt. */
var TANK_MIN_KM_NA = 200;

/* En onder dit bedrag is het advies ruis. Een omweg naar de volgende afslag
   voor tachtig cent is geen advies, het is een afleiding. */
var TANK_MIN_BESPARING = 2;

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

/* Hoeveel kilometer er nog vóór je ligt vanaf het moment dat je dit land
   binnenrijdt. Een tank die je hier vol gooit, moet daarin opgaan — dat is de
   hele reden dat de kilometers per land meetellen en niet alleen de prijs. */
function kmVanafLand(res, code){
  var i = res.order.indexOf(code);
  if(i === -1) return 0;
  var som = 0;
  for(var j = i; j < res.order.length; j++) som += (res.km[res.order[j]] || 0);
  return som;
}

/* Het advies koos eerder simpelweg het goedkoopste land van de route. Op
   Utrecht → Salzburg leverde dat "tank vol in Oostenrijk" op: de bestemming,
   150 van de 900 kilometer, aan het eind. Rekenkundig klopte het bedrag en
   praktisch was het onbruikbaar — je zou eerst de hele reis moeten rijden.

   Nu telt mee hoeveel weg er ná het binnenrijden van een land nog ligt, en
   waar je anders getankt zou hebben: thuis, tegen de prijs van je vertrekland.

   De analyse is een enkele reis. Rijd je dezelfde route terug, dan kom je door
   dezelfde landen en klopt het advies nog steeds; alleen het eindland is dan
   strenger beoordeeld dan nodig. */
function tankAdvies(trip){
  var t = tankPrijzen(trip);
  if(!t) return { t: null, advies: null, reden: null, heeftRoute: false };

  var res = tripAnalyse(trip);
  if(!res || !res.order) return { t: t, advies: null, reden: "geenRoute", heeftRoute: false };

  var kandidaten = t.rijen.map(function(r){
    return { code: r.code, c: r.c, prijs: r.prijs,
             km: res.km[r.code] || 0, kmNa: kmVanafLand(res, r.code) };
  }).filter(function(r){ return r.kmNa >= TANK_MIN_KM_NA; });

  if(!kandidaten.length) return { t: t, advies: null, reden: "teKort", heeftRoute: true };

  var goedkoop = kandidaten[0];
  kandidaten.forEach(function(r){ if(r.prijs < goedkoop.prijs) goedkoop = r; });

  /* Waarmee je vergelijkt: het land waar je vertrekt. Je gaat met een volle tank
     de deur uit tegen de prijs van thuis, en de vraag is of het loont die tank
     onderweg te halen in plaats van daar. Kent de brandstofdata je vertrekland
     niet, dan valt de vergelijking terug op het duurste land waar je langskomt. */
  var referentie = null;
  kandidaten.forEach(function(r){ if(r.code === res.order[0]) referentie = r; });
  if(!referentie){
    referentie = kandidaten[0];
    kandidaten.forEach(function(r){ if(r.prijs > referentie.prijs) referentie = r; });
  }

  if(referentie.code === goedkoop.code){
    return { t: t, advies: null, reden: "alGoedkoopst", heeftRoute: true };
  }

  var besparing = Math.round((referentie.prijs - goedkoop.prijs) * TANK_AANNAME_LITER * 100) / 100;
  if(besparing < TANK_MIN_BESPARING){
    return { t: t, advies: null, reden: "geenAdvies", heeftRoute: true };
  }

  return { t: t, heeftRoute: true, reden: null, advies: {
    goedkoop: goedkoop, duur: referentie, totaalKm: res.total, besparing: besparing
  }};
}

/* De disclaimer in fuelprices.json is Nederlandse data, net als note en rule in
   countries.json. Anders dan die twee is dit geen regeltekst per land maar een
   zin van de app zelf, en dan dekt de notitie bij de taalkeuze hem niet: een
   Nederlandse alinea onder een verder Engelse pagina is precies de halfvertaalde
   indruk die §17A wil vermijden. Dus: levert het databestand een vertaling mee
   (disclaimer_en), dan die; anders in het Nederlands de zin uit de data en in elke
   andere taal de kortere vertaalde regel uit i18n.js. */
function tankDisclaimer(){
  var m = FUELPRICES.meta || {};
  return m["disclaimer_" + TAAL] || (TAAL === "nl" && m.disclaimer) || i18n("tank.disclaimer");
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
        /* De afstand die je nog vóór je hebt vanaf dat land, niet de afstand
           die je erin aflegt: dát is waarom het advies daar uitkomt, en het
           blijft kloppen als het goedkope land zelf maar een strook is. */
        km: getal(Math.round(r.advies.goedkoop.kmNa)),
        totaal: getal(Math.round(r.advies.totaalKm)),
        besparing: euroTekst(r.advies.besparing), liter: TANK_AANNAME_LITER })) + '</p>'
    : '<p class="hint">' + esc(i18n("tank." + (r.reden || "geenAdvies"))) + '</p>';

  return '<section class="dashkaart tankkaart">' +
    '<h2>' + iconUse("eco") + esc(i18n("tank.kop")) + '</h2>' +
    '<p class="hint">' + esc(i18n("tank.uitleg")) + '</p>' +
    adviesHTML +
    '<ul class="kostenlijst">' + r.t.rijen.map(function(row){ return tankRijHTML(row, r.t.veld); }).join("") + '</ul>' +
    '<p class="hint tankdatum">' + esc(i18n("tank.prijsdatum", { datum: fmtDate(FUELPRICES.meta.priceDate) })) + '</p>' +
    '<p class="hint">' + esc(tankDisclaimer()) + '</p>' +
  '</section>';
}
