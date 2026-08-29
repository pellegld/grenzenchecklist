"use strict";
/* Kleine hulpfuncties zonder eigen state: escapen, formatteren, vlaggen, iconen.
   
   Hier hoort niets in dat DATA, ROUTE of VEH leest. */

/* ---------------- small utils ---------------- */
function esc(s){
  return String(s == null ? "" : s)
    .replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;")
    .replace(/"/g,"&quot;").replace(/'/g,"&#39;");
}
function fold(s){
  return String(s||"").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g,"");
}
function fmtDate(iso){
  if(!iso) return "";
  var p = String(iso).split("-");
  if(p.length !== 3) return iso;
  var m = ["januari","februari","maart","april","mei","juni","juli",
           "augustus","september","oktober","november","december"];
  return Number(p[2]) + " " + m[Number(p[1])-1] + " " + p[0];
}
function daysSince(iso){
  var t = Date.parse(iso);
  if(isNaN(t)) return null;
  return Math.floor((Date.now() - t) / 86400000);
}
function flagHTML(c){
  var cols = c.flagColors || ["#999","#ccc"];
  var style = c.flagStyle || "stripes-v";
  var cls = "flag", inner;
  if(style === "cross"){
    // Scandinavisch kruis: verschoven naar de hijszijde, armen tot aan de rand.
    inner = '<span style="background:' + esc(cols[0]) + ';position:relative">' +
      '<i style="position:absolute;left:34%;top:0;width:22%;height:100%;background:' + esc(cols[1]) + '"></i>' +
      '<i style="position:absolute;left:0;top:38%;width:100%;height:24%;background:' + esc(cols[1]) + '"></i>' +
      '</span>';
  } else if(style === "cross-centered"){
    // Zwitsers kruis: vierkant, gecentreerd, armen raken de rand niet.
    cls += " sq";
    inner = '<span style="background:' + esc(cols[0]) + ';position:relative">' +
      '<i style="position:absolute;left:40%;top:20%;width:20%;height:60%;background:' + esc(cols[1]) + '"></i>' +
      '<i style="position:absolute;left:20%;top:40%;width:60%;height:20%;background:' + esc(cols[1]) + '"></i>' +
      '</span>';
  } else if(style === "union"){
    // Union Jack: rood kruis boven wit kruis boven de rode en witte diagonalen.
    var b = esc(cols[0]), w = esc(cols[1] || "#FFFFFF"), r = esc(cols[2] || "#C8102E");
    inner = '<span style="background-color:' + b + ';background-image:' + [
      "linear-gradient(to bottom,transparent 40%," + r + " 40%," + r + " 60%,transparent 60%)",
      "linear-gradient(to right,transparent 42%," + r + " 42%," + r + " 58%,transparent 58%)",
      "linear-gradient(to bottom,transparent 30%," + w + " 30%," + w + " 70%,transparent 70%)",
      "linear-gradient(to right,transparent 33%," + w + " 33%," + w + " 67%,transparent 67%)",
      "linear-gradient(to top left,transparent 45%," + r + " 45%," + r + " 55%,transparent 55%)",
      "linear-gradient(to top right,transparent 45%," + r + " 45%," + r + " 55%,transparent 55%)",
      "linear-gradient(to top left,transparent 38%," + w + " 38%," + w + " 62%,transparent 62%)",
      "linear-gradient(to top right,transparent 38%," + w + " 38%," + w + " 62%,transparent 62%)"
    ].join(",") + '"></span>';
  } else {
    var dir = style === "stripes-h" ? "to bottom" : "to right";
    var n = cols.length, stops = [];
    for(var i=0;i<n;i++){
      stops.push(esc(cols[i]) + " " + (i*100/n) + "% " + ((i+1)*100/n) + "%");
    }
    inner = '<span style="background:linear-gradient(' + dir + "," + stops.join(",") + ')"></span>';
  }
  return '<span class="' + cls + '" role="img" aria-label="Vlag ' + esc(c.name) + '">' + inner + '</span>';
}
function countryChip(c){
  return '<span class="chip">' + flagHTML(c) + esc(c.name) + '</span>';
}
function iconUse(name){
  return '<svg class="icon sm"><use href="#i-' + name + '"></use></svg>';
}

/* Aliases fold near-identical wordings from different countries onto one line in
   the combined checklist. Unknown items simply dedupe on their own text. */
var ALIASES = [
  [/^gevarendriehoek/,                 "driehoek"],
  [/veiligheidsvest|veiligheidshesje/, "vest"],
  [/verbanddoos|ehbo/,                 "verbanddoos"],
  [/reservelamp/,                      "lampen"],
  [/brandblusser/,                     "brandblusser"],
  [/alcoholtester|ethylotest/,         "alcoholtester"],
  [/sleepkabel/,                       "sleepkabel"],
  [/reservebril/,                      "reservebril"]
];
function itemKey(it){
  if(it.key) return it.key;
  var t = fold(it.item);
  for(var i=0;i<ALIASES.length;i++){ if(ALIASES[i][0].test(t)) return ALIASES[i][1]; }
  return t.replace(/[^a-z0-9]+/g," ").trim();
}

/* The core distinction: "the law lists it" vs "you can be fined for it here". */
function effectiveStatus(item, country){
  if(item.status === "registration-country"){
    return country.code === HOME ? "must" : "na";
  }
  if(item.status === "required") return "must";
  return "advice";
}

function fmtDuur(sec){
  if(!sec) return null;
  var uur = Math.floor(sec / 3600), min = Math.round((sec % 3600) / 60);
  if(min === 60){ uur++; min = 0; }
  return uur + "u " + (min < 10 ? "0" : "") + min + "m";
}
