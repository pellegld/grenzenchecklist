"use strict";
/* De actie-engine: uitrustingsgroepen en afgeleide acties per reis.

   buildGroups() en buildTasks() leveren data, geen HTML — de paginarenderers in
   js/pages.js en js/dashboard.js maken daar kaarten van.

   Elke actie draagt sinds deze fase ook waar hij vandaan komt: `factId`,
   `confidence`, `sourceUrl` en `lastVerified` van het feit waar hij op rust.
   Dat is de voorbereiding op de herkomstregel per actie (sessie B2): de
   renderlaag hoeft er straks alleen een regel van te maken, de data ligt er al.
   Ze zijn nu al in gebruik — de vertrouwensbalk en het boetekans-totaal op het
   dashboard lezen dezelfde velden, zodat het geen dode voorbereiding is. */

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

function checklistTelling(trip){
  var G = buildGroups(trip), T = buildTasks(trip);
  var totaal = 0, gedaan = 0;
  DOC_ITEMS.forEach(function(d){ totaal++; if(isAangevinkt(trip, "doc:" + d.key)) gedaan++; });
  G.must.concat(G.advice, G.na).forEach(function(r){
    totaal++; if(isAangevinkt(trip, r.g.key)) gedaan++;
  });
  T.todo.forEach(function(t){
    totaal++; if(isAangevinkt(trip, "task:" + t.key)) gedaan++;
  });
  return { totaal:totaal, gedaan:gedaan, open:totaal - gedaan,
           blockers:T.blockers.length, warnings:T.notices.length };
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
    fineIndication: feit.fineIndication || null
  };
}

function actie(basis, feit, land){
  var h = herkomstVan(feit, land);
  basis.factId = h.factId;
  basis.confidence = h.confidence;
  basis.sourceUrl = h.sourceUrl;
  basis.lastVerified = h.lastVerified;
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

/* Openstaande acties: waar het boetekans-totaal en het dashboard over rekenen.
   Blokkades tellen mee — een blokkade is per definitie niet geregeld, en het
   is dezelfde boete die je riskeert. Dubbeltellen kan niet: een land levert óf
   een blokkade óf een zone-actie op, nooit allebei. */
function openActies(trip){
  var T = buildTasks(trip);
  var open = T.todo.filter(function(t){ return !isAangevinkt(trip, "task:" + t.key); });
  return open.concat(T.blockers);
}

/* ---------------- herkomstregel per actie (voorbereiding, sessie B2) ----------------
   De data staat er (factId/confidence/sourceUrl/lastVerified); de regel eronder
   wordt in B2 een zichtbare "volgens <bron>, gecontroleerd op <datum>". Deze
   functie is nu het ene aangrijpingspunt daarvoor: elke actierenderer roept hem
   aan, dus straks verandert er één functie in plaats van vijf renderers. */
function herkomstRegelHTML(t){
  if(!t || !t.sourceUrl) return "";
  return '<a class="herkomst" href="' + esc(t.sourceUrl) + '" target="_blank" rel="noopener">' +
    esc(i18n("actie.officieleBron")) + "</a>";
}
