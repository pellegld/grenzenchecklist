"use strict";
/* Geometrie: waar loopt deze route, door welke landen, langs welke zones en tolpunten.
   
   De landdetectie zit hier lokaal, niet bij de routeprovider. Dat maakt hem
   onafhankelijk van welke router je gebruikt (zie js/routeProvider.js). */

var SAMPLE_KM = 2;      // om de hoeveel km we de route bemonsteren
var SHORT_KM = 15;      // daaronder melden we "even aangeraakt, controleer dit"

/* ================= routeplanner: geometrie ================= */

function haversine(lat1, lon1, lat2, lon2){
  var R = 6371, rad = Math.PI / 180;
  var dLat = (lat2 - lat1) * rad, dLon = (lon2 - lon1) * rad;
  var a = Math.sin(dLat/2) * Math.sin(dLat/2) +
          Math.cos(lat1*rad) * Math.cos(lat2*rad) * Math.sin(dLon/2) * Math.sin(dLon/2);
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
}

/* Ray casting op een vlakke ring [x,y,x,y,...]. */
function inRing(x, y, r){
  var inside = false, n = r.length;
  for(var i = 0, j = n - 2; i < n; j = i, i += 2){
    var xi = r[i], yi = r[i+1], xj = r[j], yj = r[j+1];
    if(((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) inside = !inside;
  }
  return inside;
}

/* Een land bevat het punt als het in een buitenring valt en niet in een gat. */
function inCountry(x, y, g){
  var b = g.b;
  if(x < b[0] || x > b[2] || y < b[1] || y > b[3]) return false;
  for(var p = 0; p < g.p.length; p++){
    var poly = g.p[p];
    if(!inRing(x, y, poly[0])) continue;
    var inHole = false;
    for(var h = 1; h < poly.length; h++){
      if(inRing(x, y, poly[h])){ inHole = true; break; }
    }
    if(!inHole) return true;
  }
  return false;
}

function countryAt(lon, lat){
  for(var code in BORDERS){
    if(code.charAt(0) === "_") continue;
    if(inCountry(lon, lat, BORDERS[code])) return code;
  }
  return null;
}

/* De vereenvoudigde kustlijn wijkt tot ongeveer een kilometer af, waardoor een
   kustweg of havenplaats net in zee kan vallen. Vinden we niets, dan tasten we
   in ringen om het punt heen af en laat de meerderheid beslissen. Echte zee —
   een veerboot — ligt verder dan de grootste ring en blijft dus onbekend. */
var COAST_PROBE = [0.015, 0.035];
function classifyPoint(lon, lat){
  var direct = countryAt(lon, lat);
  if(direct) return direct;
  var cosLat = Math.max(0.2, Math.cos(lat * Math.PI / 180));
  for(var ri = 0; ri < COAST_PROBE.length; ri++){
    var r = COAST_PROBE[ri], votes = {}, best = null, bestN = 0;
    for(var a = 0; a < 8; a++){
      var ang = a * Math.PI / 4;
      var c = countryAt(lon + Math.cos(ang) * r / cosLat, lat + Math.sin(ang) * r);
      if(!c) continue;
      votes[c] = (votes[c] || 0) + 1;
      if(votes[c] > bestN){ bestN = votes[c]; best = c; }
    }
    if(best) return best;
  }
  return null;
}

/* Loopt de routegeometrie af, bemonstert om de SAMPLE_KM en telt de afstand per
   land op. Levert de landen in volgorde van eerste passage. */
function analyseRoute(coords){
  var perCountry = {}, order = [], unknownKm = 0, total = 0;
  function add(code, km){
    if(code === null){ unknownKm += km; return; }
    // let op: perCountry[code] kan 0 zijn, dus expliciet op undefined toetsen
    if(perCountry[code] === undefined){ perCountry[code] = 0; order.push(code); }
    perCountry[code] += km;
  }
  if(!coords.length) return { order:order, km:perCountry, unknownKm:0, total:0 };

  add(classifyPoint(coords[0][0], coords[0][1]), 0);
  var pending = 0;
  for(var i = 1; i < coords.length; i++){
    var d = haversine(coords[i-1][1], coords[i-1][0], coords[i][1], coords[i][0]);
    total += d; pending += d;
    if(pending >= SAMPLE_KM || i === coords.length - 1){
      add(classifyPoint(coords[i][0], coords[i][1]), pending);
      pending = 0;
    }
  }
  // Breedtegraadverschil tussen begin en eind: rijd je zuidwaarts, dan zit je in
  // dezelfde stroom als de Franse vertrekgolf.
  var dLat = coords[coords.length - 1][1] - coords[0][1];
  return { order:order, km:perCountry, unknownKm:unknownKm, total:total,
           zuidwaarts:(Math.abs(dLat) < 1 ? null : dLat < 0) };
}

/* ================= zones op stadsniveau =================
   De landdata werkt met de strengste zone per land. Dat is veilig maar grof:
   Straatsburg is in 2026 soepeler dan Parijs. Zodra we een route hebben kunnen
   we per stad kijken welke zone je werkelijk raakt. */

/* Kortste afstand van een punt tot de routelijn, in km. Vergelijkt tegen de
   bemonsterde route, niet tegen elk geometriepunt — dat scheelt werk en de
   afwijking blijft ruim onder de zoneradius. */
function afstandTotRoute(lat, lon, punten){
  var best = Infinity;
  for(var i = 0; i < punten.length; i++){
    var d = haversine(lat, lon, punten[i][1], punten[i][0]);
    if(d < best) best = d;
  }
  return best;
}

/* Welke zones raakt deze route? Levert ze op volgorde van passage. */
function zonesLangsRoute(coords){
  if(!ZONES || !coords || !coords.length) return [];
  // Bemonster de route zodat we niet 19.000 punten tegen 47 zones leggen.
  var stap = Math.max(1, Math.floor(coords.length / 1200));
  var punten = [];
  for(var i = 0; i < coords.length; i += stap) punten.push(coords[i]);
  punten.push(coords[coords.length - 1]);

  var uit = [];
  ZONES.forEach(function(z){
    var d = afstandTotRoute(z.lat, z.lon, punten);
    if(d > z.radiusKm) return;
    // index van het dichtstbijzijnde punt bepaalt de volgorde langs de route
    var beste = 0, bd = Infinity;
    for(var k = 0; k < punten.length; k++){
      var dd = haversine(z.lat, z.lon, punten[k][1], punten[k][0]);
      if(dd < bd){ bd = dd; beste = k; }
    }
    uit.push({ zone:z, afstandKm:d, volgorde:beste });
  });
  uit.sort(function(a, b){ return a.volgorde - b.volgorde; });
  return uit;
}

/* Zelfde oordeelslogica als op landniveau, maar tegen de drempel van deze zone.
   Dormant: er is nog geen steden-pagina om dit te tonen. */
function zoneStadVerdict(z){
  if(!z.threshold) return { level:"unknown", text:"Geen euronorm-drempel: dit is een toegangsverbod, geen emissiezone." };
  if(VEH.fuel === "ev") return { level:"ok", text:"Elektrisch — je voldoet." };
  var need = VEH.fuel === "diesel" ? z.threshold.diesel : z.threshold.petrol;
  if(need === null || need === undefined){
    return { level:"ok", text:"Voor " + (VEH.fuel === "diesel" ? "diesel" : "benzine") + " geldt hier geen drempel." };
  }
  if(VEH.euro === null){
    return { level:"unknown", text:"Vul je euronorm in. Nodig: minimaal Euro " + need + "." };
  }
  if(VEH.euro >= need){
    return { level:"ok", text:"Euro " + VEH.euro + " voldoet aan de eis van minimaal Euro " + need + "." };
  }
  return { level:"bad", text:"Euro " + VEH.euro + " voldoet NIET: hier is minimaal Euro " + need + " vereist." };
}

/* ================= tol ================= */

/* Losse tolpunten: tunnels, passen en bruggen die je apart betaalt, óók als je
   al een vignet hebt. Precies de kosten die mensen niet zien aankomen. */
function tolPuntenLangsRoute(coords){
  if(!coords || !coords.length) return [];
  var stap = Math.max(1, Math.floor(coords.length / 1200));
  var punten = [];
  for(var i = 0; i < coords.length; i += stap) punten.push(coords[i]);
  punten.push(coords[coords.length - 1]);

  var uit = [];
  ROUTE.forEach(function(code){
    var c = BY_CODE[code];
    if(!c || !c.tollPoints) return;
    c.tollPoints.forEach(function(p){
      var d = afstandTotRoute(p.lat, p.lon, punten);
      if(d <= p.radiusKm) uit.push({ c:c, p:p, afstandKm:d });
    });
  });
  uit.sort(function(a, b){ return a.afstandKm - b.afstandKm; });
  return uit;
}

/* Ruwe schatting op basis van de kilometers per land. Bewust als indicatie
   gepresenteerd: lang niet elke kilometer in Frankrijk is autoroute. */
function tolSchatting(res){
  if(!res) return [];
  var uit = [];
  res.order.forEach(function(code){
    var c = BY_CODE[code];
    if(!c || !c.tollRoads || !c.tollRoads.perKm) return;
    var km = res.km[code] || 0;
    // Een schatting van een paar euro over een grensstrookje is ruis, geen informatie.
    if(km < 25) return;

    uit.push({
      c: c,
      km: km,
      laag: Math.round(km * c.tollRoads.perKm * 0.5),
      hoog: Math.round(km * c.tollRoads.perKm),
      onzeker: !!c.tollRoads.needsVerification,
      note: c.tollRoads.note || ""
    });
  });
  return uit;
}
