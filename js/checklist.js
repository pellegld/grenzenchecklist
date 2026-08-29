"use strict";
/* Checklist: uitrustingsgroepen en afgeleide taken per route.
   
   buildGroups() en buildTasks() leveren data, geen HTML — de paginarenderers in
   js/pages.js maken daar de bento-kaarten van. */

/* ---------------- render: combined checklist (dormant tot Checklist-pagina) ---------------- */
function buildGroups(){
  var map = {};
  ROUTE.forEach(function(code){
    var c = BY_CODE[code];
    if(!c) return;
    (c.mandatoryEquipment || []).forEach(function(it){
      var k = itemKey(it), eff = effectiveStatus(it, c);
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

function chkRow(row){
  var key = row.g.key;
  var done = !!TICKED[key];
  var fel = row.main.map(function(e){ return e.country; });
  var dof = row.other.map(function(e){ return e.country; });
  var namen = fel.map(function(c){ return c.name; }).join(" · ");
  if(dof.length) namen += (namen ? " · " : "") + "(" +
    dof.map(function(c){ return c.name; }).join(" · ") + ")";

  return '<div class="chk' + (done ? " done" : "") + '">' +
    '<input type="checkbox" data-tick="' + esc(key) + '"' + (done ? " checked" : "") +
      ' aria-label="' + esc(row.g.label) + '">' +
    '<div class="body"><div class="ttl">' + esc(row.g.label) + "</div>" +
      vlaggenRij(fel, dof) +
      (namen ? '<div class="where printnamen">' + esc(namen) + "</div>" : "") +
    "</div></div>";
}

function taakRow(t){
  var key = "task:" + t.key;
  var done = !!TICKED[key];
  var meer = t.cs && t.cs.length;
  var vlaggen = meer ? vlaggenRij(t.cs, []) : "";
  var namen = meer
    ? i18n("checklist.geldtIn", { landen:t.cs.map(function(c){ return c.name; }).join(", ") })
    : "";
  return '<div class="chk' + (done ? " done" : "") + '">' +
    '<input type="checkbox" data-tick="' + esc(key) + '"' + (done ? " checked" : "") +
      ' aria-label="' + esc(t.what) + '">' +
    '<div class="body"><div class="ttl">' + esc(t.what) + "</div>" + vlaggen +
      (namen ? '<div class="where printnamen">' + esc(namen) + "</div>" : "") +
      (t.meta ? '<div class="where">' + esc(t.meta) + "</div>" : "") +
    "</div></div>";
}

function letopRow(t){
  return '<div class="chk noti"><span class="mark">i</span>' +
    '<div class="body"><div class="ttl">' + (t.c ? esc(t.c.name) : "") + "</div>" +
    '<div class="why"><p>' + esc(t.what) + "</p></div></div></div>";
}

function renderChecklist(){
  var sec = document.getElementById("checklist");
  if(!sec) return;
  if(!ROUTE.length){ sec.hidden = true; return; }
  sec.hidden = false;

  var G = buildGroups();
  var T = buildTasks();

  var kopen  = T.todo.filter(function(t){ return /^(zone|vig|win):/.test(t.key); });
  var eruit  = T.todo.filter(function(t){ return !/^(zone|vig|win):/.test(t.key); });

  function groep(sleutel, rows, qual){
    return { titel:i18n("groep." + sleutel),
             qual:qual === undefined ? i18n("groep." + sleutel + ".qual") : qual,
             rows:rows };
  }
  var groepen = [
    groep("voorafRegelen",     kopen.map(taakRow)),
    groep("inDeAuto",          G.must.map(chkRow)),
    groep("uitDeAuto",         eruit.map(taakRow)),
    groep("aanbevolen",        G.advice.map(chkRow)),
    groep("nietVoorKenteken",  G.na.map(chkRow)),
    groep("letop",             T.notices.map(letopRow), voertuigLabel())
  ].filter(function(g){ return g.rows.length; });

  var html = '<h2 data-label="02 — Checklist">Voor je vertrekt</h2>';

  if(T.blockers.length){
    html += '<ul class="tasks blockers">' +
      T.blockers.map(function(t){ return taskRow(t, "blocker"); }).join("") + "</ul>";
  }

  html += '<div class="grid">' + groepen.map(function(g){
    return '<section class="grp"><h3 class="grp-head">' + esc(g.titel) +
      '<span class="qual">' + esc(g.qual) + "</span></h3>" +
      g.rows.join("") + "</section>";
  }).join("") + "</div>";
  sec.innerHTML = html;
}

/* Universeel, niet landafhankelijk — hoort bij elke grensoverschrijdende rit,
   dus staat los van countries.json. Vinkstatus deelt gewoon TICKED, met een
   eigen key-prefix ("doc:") zodat het niet met landspecifieke keys botst. */
var DOC_ITEMS = [
  { key:"rijbewijs" }, { key:"kenteken" }, { key:"groenekaart" }, { key:"id" }
];

/* Naam en toelichting komen uit de vertaaltabel onder doc.<key>; de lijst
   hierboven bepaalt alleen welke er zijn en in welke volgorde. */
function docNaam(d){ return i18n("doc." + d.key); }
function docInfo(d){ return i18n("doc." + d.key + ".info"); }

function checklistTelling(){
  var G = buildGroups(), T = buildTasks();
  var totaal = 0, gedaan = 0;
  DOC_ITEMS.forEach(function(d){ totaal++; if(TICKED["doc:" + d.key]) gedaan++; });
  G.must.concat(G.advice, G.na).forEach(function(r){
    totaal++; if(TICKED[r.g.key]) gedaan++;
  });
  T.todo.forEach(function(t){
    totaal++; if(TICKED["task:" + t.key]) gedaan++;
  });
  return { totaal:totaal, gedaan:gedaan, open:totaal - gedaan, blockers:T.blockers.length };
}

function kortBedrag(s){
  if(!s) return "";
  var t = String(s).split(/\s+[—-]\s+|;/)[0].trim();
  return t.length > 60 ? t.slice(0, 57).replace(/[\s,]+$/, "") + "…" : t;
}

var ZONE_ACTIES = { sticker:1, registratie:1, betaling:1 };
var WINTERMAANDEN = { 11:1, 12:1, 1:1, 2:1, 3:1 };

function buildTasks(){
  var todo = [], blockers = [], notices = [];
  var flits = [], dash = [];

  ROUTE.forEach(function(code){
    var c = BY_CODE[code];
    if(!c) return;

    var z = c.environmentalZone || {}, v = zoneVerdict(c);
    if(v.level === "bad"){
      blockers.push({ c:c, what:i18n("taak.blokkade", { land:c.name }), meta:v.text });
    } else {
      var act = zoneAction(c);
      if(z.required && act){
        todo.push({ key:"zone:" + code, c:c,
          what:i18n("taak.zone." + (ZONE_ACTIES[act] ? act : "anders"), { land:c.name }),
          meta:z.fineIndication ? i18n("taak.boeteZonder", { bedrag:kortBedrag(z.fineIndication) }) : "" });
      }
    }

    var t = c.tollVignette || {};
    if(t.required){
      todo.push({ key:"vig:" + code, c:c,
        what:i18n("taak.vignet", { land:c.name }),
        meta:t.fineIndication ? i18n("taak.boeteZonder", { bedrag:kortBedrag(t.fineIndication) }) : "" });
    }

    var w = c.winterEquipment;
    if(w && w.required && w.required !== "nee"){
      var actief = seasonActive(w);
      var maand = DEPART ? Number(DEPART.slice(5, 7)) : 0;
      if(actief === true){
        todo.push({ key:"win:" + code, c:c,
          what:i18n("taak.winter", { land:c.name }),
          meta:w.period || "" });
      } else if(actief === null && w.required === "situatiegebonden" && WINTERMAANDEN[maand]){
        todo.push({ key:"win:" + code, c:c,
          what:i18n("taak.winterLos", { land:c.name }),
          meta:i18n("taak.winterGeenPeriode") });
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

    vehicleNotesFor(c).forEach(function(n){
      notices.push({ c:c, what:n.text });
    });
  });

  if(flits.length){
    todo.push({ key:"flits", c:null, cs:flits,
      what:i18n("taak.flits"),
      meta:i18n("taak.flits.meta") });
  }
  if(dash.length){
    todo.push({ key:"dash", c:null, cs:dash,
      what:i18n("taak.dash"),
      meta:"" });
  }
  return { todo:todo, blockers:blockers, notices:notices };
}

function taskRow(t, kind){
  if(kind === "todo"){
    var done = !!TICKED["task:" + t.key];
    return '<li class="' + (done ? "done" : "") + '">' +
      '<input type="checkbox" data-task="' + esc(t.key) + '"' + (done ? " checked" : "") +
        ' aria-label="' + esc(t.what) + '">' +
      '<div class="body"><span class="what">' + esc(t.what) + "</span>" +
      (t.meta ? '<span class="meta">' + esc(t.meta) + "</span>" : "") + "</div></li>";
  }
  var mark = kind === "blocker" ? "&#10007;" : "i";
  return '<li class="' + kind + '"><span class="mark">' + mark + "</span>" +
    '<div class="body"><span class="what">' +
    (t.c ? esc(t.c.name) + " — " : "") + esc(t.what) + "</span>" +
    (t.meta ? '<span class="meta">' + esc(t.meta) + "</span>" : "") + "</div></li>";
}

/* Dormant: hoort bij de Landeninformatie/Steden-pagina. */
function renderSteden(){
  var sec = document.getElementById("steden");
  if(!sec) return;
  if(!ROUTE_ZONES.length){ sec.hidden = true; return; }
  sec.hidden = false;
}
