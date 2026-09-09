"use strict";
/* De bouwers: uitrustingsgroepen en afgeleide regeltaken per reis.

   Dit bestand levert de ruwe onderdelen; js/actions.js maakt er de actielijst
   uit §7 van (met prioriteit, deadline en herkomstregel), en de paginarenderers
   maken daar kaarten van. Hier staat dus geen HTML en geen groepsindeling.

   Elke taak draagt waar hij vandaan komt: `factId`, `confidence`, `sourceUrl`,
   `lastVerified` en `fineIndication` van het feit waar hij op rust. Dat is wat
   de herkomstregel bij elke actie, het boetekans-totaal en de vertrouwensbalk
   allemaal lezen — één herkomst, drie plekken waar hij zichtbaar wordt. */

/* ---------------- uitrusting, gegroepeerd over landen heen ---------------- */
function buildGroups(trip){
  var map = {};
  tripLanden(trip).forEach(function(code){
    var c = BY_CODE[code];
    if(!c) return;
    (c.mandatoryEquipment || []).forEach(function(it){
      var k = itemKey(it), eff = effectiveStatus(it, c, trip);
      if(!map[k]) map[k] = { key:k, label:it.item, entries:[], rank:0 };
      var g = map[k];
      var rank = eff === "must" ? 3 : (eff === "advice" ? 2 : 1);
      if(rank > g.rank){ g.rank = rank; g.label = it.item; }
      g.entries.push({ country:c, item:it, eff:eff });
    });
  });
  var groups = Object.keys(map).map(function(k){ return map[k]; });
  var out = { must:[], advice:[], na:[] };
  groups.forEach(function(g){
    var must   = g.entries.filter(function(e){ return e.eff === "must"; });
    var advice = g.entries.filter(function(e){ return e.eff === "advice"; });
    var na     = g.entries.filter(function(e){ return e.eff === "na"; });
    if(must.length)        out.must.push({ g:g, main:must, other:advice.concat(na) });
    else if(advice.length) out.advice.push({ g:g, main:advice, other:na });
    else                   out.na.push({ g:g, main:na, other:[] });
  });
  return out;
}

function vlaggenRij(fel, dof){
  var h = "";
  fel.forEach(function(c){
    h += '<span title="' + esc(c.name) + '">' + flagHTML(c) + "</span>";
  });
  dof.forEach(function(c){
    h += '<span class="dim" title="' + esc(i18n("checklist.nietAfdwingbaar", { land:c.name })) + '">' +
      flagHTML(c) + "</span>";
  });
  return h ? '<div class="vlaggen" aria-hidden="true">' + h + "</div>" : "";
}

/* Universeel, niet landafhankelijk — hoort bij elke grensoverschrijdende rit,
   dus staat los van countries.json. Vinkstatus deelt gewoon trip.ticked, met een
   eigen key-prefix ("doc:") zodat het niet met landspecifieke keys botst. */
var DOC_ITEMS = [
  { key:"rijbewijs" }, { key:"kenteken" }, { key:"groenekaart" }, { key:"id" }
];

/* Naam en toelichting komen uit de vertaaltabel onder doc.<key>; de lijst
   hierboven bepaalt alleen welke er zijn en in welke volgorde. */
function docNaam(d){ return i18n("doc." + d.key); }
function docInfo(d){ return i18n("doc." + d.key + ".info"); }

function isAangevinkt(trip, key){ return !!(trip.ticked && trip.ticked[key]); }

/* De voortgangstelling hoort bij de actielijst, niet bij de checklist-bouwers:
   die weten niet wat een taak is en wat naslag. Zie js/actions.js. */
function checklistTelling(trip){
  return actieTelling(trip);
}

function kortBedrag(s){
  if(!s) return "";
  var t = String(s).split(/\s+[—-]\s+|;/)[0].trim();
  return t.length > 60 ? t.slice(0, 57).replace(/[\s,]+$/, "") + "…" : t;
}

var ZONE_ACTIES = { sticker:1, registratie:1, betaling:1 };
var WINTERMAANDEN = { 11:1, 12:1, 1:1, 2:1, 3:1 };

/* De herkomst van een actie: het feit waar hij op rust. Eén plek, zodat elke
   actie hem op dezelfde manier draagt en de renderlaag straks één functie
   nodig heeft in plaats van een uitzondering per soort. */
function herkomstVan(feit, land){
  feit = feit || {};
  return {
    factId: feit.id || null,
    confidence: confidenceVan(feit),
    sourceUrl: feit.sourceUrl || (land && land.sourceUrl) || null,
    lastVerified: feit.lastVerified || (land && land.lastVerified) || null,
    verificationNote: feit.verificationNote || null,
    fineIndication: feit.fineIndication || null
  };
}

function actie(basis, feit, land){
  var h = herkomstVan(feit, land);
  basis.factId = h.factId;
  basis.confidence = h.confidence;
  basis.sourceUrl = h.sourceUrl;
  basis.lastVerified = h.lastVerified;
  basis.verificationNote = h.verificationNote;
  basis.fineIndication = h.fineIndication;
  return basis;
}

function buildTasks(trip){
  var todo = [], blockers = [], notices = [];
  var flits = [], dash = [];

  tripLanden(trip).forEach(function(code){
    var c = BY_CODE[code];
    if(!c) return;

    var z = c.environmentalZone || {}, v = zoneVerdict(c, trip);
    if(v.level === "bad"){
      blockers.push(actie({ key:"blok:" + code, c:c,
        what:i18n("taak.blokkade", { land:c.name }), meta:v.text }, z, c));
    } else {
      var act = zoneAction(c, trip);
      if(z.required && act){
        todo.push(actie({ key:"zone:" + code, c:c,
          what:i18n("taak.zone." + (ZONE_ACTIES[act] ? act : "anders"), { land:c.name }),
          meta:z.fineIndication ? i18n("taak.boeteZonder", { bedrag:kortBedrag(z.fineIndication) }) : "" },
          z, c));
      }
    }

    var t = c.tollVignette || {};
    if(t.required){
      todo.push(actie({ key:"vig:" + code, c:c,
        what:i18n("taak.vignet", { land:c.name }),
        meta:t.fineIndication ? i18n("taak.boeteZonder", { bedrag:kortBedrag(t.fineIndication) }) : "" },
        t, c));
    }

    var w = c.winterEquipment;
    if(w && w.required && w.required !== "nee"){
      var actief = seasonActive(w, trip);
      var maand = trip.departureDate ? Number(trip.departureDate.slice(5, 7)) : 0;
      if(actief === true){
        todo.push(actie({ key:"win:" + code, c:c,
          what:i18n("taak.winter", { land:c.name }), meta:w.period || "" }, w, c));
      } else if(actief === null && w.required === "situatiegebonden" && WINTERMAANDEN[maand]){
        todo.push(actie({ key:"win:" + code, c:c,
          what:i18n("taak.winterLos", { land:c.name }),
          meta:i18n("taak.winterGeenPeriode") }, w, c));
      }
    }

    /* quirks zijn sinds schemaVersion 2 objecten met een eigen id, zodat een
       changelog of een correctie ernaar kan verwijzen. De heuristiek eronder is
       onveranderd: hij leest alleen de tekst. */
    (c.quirks || []).forEach(function(q){
      var tekst = quirkTekst(q);
      if(!/verboden/i.test(tekst)) return;
      if(/flitsapp|radarverklikker/i.test(tekst) && flits.indexOf(c) === -1) flits.push(c);
      if(/dashcam/i.test(tekst) && dash.indexOf(c) === -1) dash.push(c);
    });

    vehicleNotesFor(c, trip).forEach(function(n){
      notices.push(actie({ key:"let:" + code + ":" + (n.id || ""), c:c, what:n.text }, n, c));
    });
  });

  /* LPG/CNG-verbod op een tolpunt: hergebruikt de bestaande routedetectie op
     tolpunten (tripTolPunten, middelpunt + radiusKm tegen de routelijn) in
     plaats van een eigen detectie te bouwen. Geldt ook voor een optioneel punt
     (de Eurotunnel is een gekozen alternatief, geen verplichte doorgang) — wie
     op gas rijdt kan die keuze domweg niet maken, en dat hoort net zo hard te
     blokkeren als een milieuzone die dicht zit. */
  tripTolPunten(trip).forEach(function(o){
    var verboden = o.p.forbiddenFuels;
    if(!verboden || verboden.indexOf(trip.vehicle.fuel) === -1) return;
    var brandstofBlok = actie({ key:"blok:brandstof:" + o.p.id, c:o.c, soort:"brandstofverbod",
      what:i18n("taak.brandstofverboden", {
        tunnel:o.p.name, brandstof:i18n("profiel.brandstofKort." + trip.vehicle.fuel) }),
      meta:o.p.forbiddenFuelsNote || "" },
      { id:o.p.id + ".forbiddenFuels", sourceUrl:o.p.forbiddenFuelsSourceUrl || o.p.sourceUrl,
        lastVerified:o.p.lastVerified, confidence:o.p.confidence }, o.c);
    blockers.push(brandstofBlok);
  });

  /* Twee acties die over landen heen gaan: ze hangen aan geen enkel los feit,
     dus ze dragen de landen die ze veroorzaakten in plaats van één factId. */
  if(flits.length){
    todo.push({ key:"flits", c:null, cs:flits, what:i18n("taak.flits"),
      meta:i18n("taak.flits.meta"), confidence:"verified", factId:null,
      sourceUrl:null, lastVerified:null, fineIndication:null });
  }
  if(dash.length){
    todo.push({ key:"dash", c:null, cs:dash, what:i18n("taak.dash"), meta:"",
      confidence:"verified", factId:null, sourceUrl:null, lastVerified:null,
      fineIndication:null });
  }
  return { todo:todo, blockers:blockers, notices:notices };
}

/* De link naar de officiële bron, visueel herkenbaar (§16). Werkt zowel op een
   ruwe taak uit buildTasks() als op een actie uit js/actions.js. */
function herkomstRegelHTML(t){
  var url = t && (t.sourceUrl || (t.bron && t.bron.sourceUrl));
  if(!url) return "";
  return '<a class="bronlink" href="' + esc(url) + '" target="_blank" rel="noopener">' +
    esc(i18n("actie.officieleWebsite")) + ' <span aria-hidden="true">&rarr;</span></a>';
}
