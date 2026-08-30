"use strict";
/* Drukte per dag uit drukte.json.

   Dormant: de data en de logica staan er, de kalenderpagina nog niet (fase 5). */

var DRUKTE = null;
var KAL_MAAND = null;

function drukteVoor(iso){
  if(!DRUKTE) return null;
  var vast = (DRUKTE.dagen || {})[iso];
  if(vast) return { niveau:vast.heen, terug:vast.terug, tekst:vast.tekst, bron:vast.bron || null, hard:true };

  var d = new Date(iso + "T12:00:00");
  var mmdd = iso.slice(5), wd = d.getDay();
  var uit = null;
  (DRUKTE.regels || []).forEach(function(r){
    if(r.weekdagen.indexOf(wd) === -1) return;
    var binnen = r.van <= r.tot ? (mmdd >= r.van && mmdd <= r.tot)
                                : (mmdd >= r.van || mmdd <= r.tot);
    if(binnen) uit = { niveau:r.niveau, tekst:r.tekst, bron:null, hard:false };
  });
  return uit;
}

var DRUKTE_RANG = { rustig:0, matig:1, druk:2, zeerdruk:3, zwart:4 };

/* Rijd je zuidwaarts, dan zit je in dezelfde stroom als de Franse
   vertrekgolf; oost-west zegt die prognose weinig. */
function kalRichting(trip){
  var res = tripAnalyse(trip);
  if(!res || res.zuidwaarts === null || res.zuidwaarts === undefined){
    return i18n("kalender.vertrek");
  }
  return i18n(res.zuidwaarts ? "kalender.zuid" : "kalender.noord");
}

/* Was een vaste array; als functie volgt hij de taalkeuze. */
function maanden(){ return i18n("alg.maanden").split(","); }
function pad2(n){ return (n < 10 ? "0" : "") + n; }
