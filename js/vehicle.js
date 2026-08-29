"use strict";
/* Voertuigprofiel: mag deze auto erin, en moet je vooraf iets regelen.
   
   De twee vragen zijn apart gemodelleerd omdat ze los van elkaar staan: in Brussel
   moet je je registreren ook als je auto ruim voldoet. */

/* Mag dit voertuig de strengste milieuzone van dit land in, en moet je vooraf
   iets regelen? Levert altijd een oordeel op, ook als het "dat weet ik niet" is.
   Dormant op deze pagina: de milieuzonekaart toont nu alleen welke steden je
   raakt, de volledige euro-norm-verdicts komen terug op de Checklist-pagina. */
var ACTION_TEXT = {
  sticker:     "Je moet vooraf een sticker regelen.",
  registratie: "Je moet je kenteken vooraf registreren — ook als je voldoet.",
  betaling:    "Je moet per dag betalen of vooraf registreren."
};
function zoneAction(c){
  var z = c.environmentalZone || {};
  var act = z.actionRequired;
  if(!act || act === "geen") return null;
  var scope = z.actionAppliesTo || "all";
  var thuis = (c.code === HOME);
  if(scope === "foreign") return thuis ? (z.actionLocal || null) : act;
  if(scope === "local")   return thuis ? act : null;
  return act;
}

function zoneVerdict(c){
  var z = c.environmentalZone || {};
  if(!z.required) return { level:"ok", text:"Geen milieuzone in dit land." };
  if(z.appliesToCars === false){
    return { level:"ok", text:"De milieuzones hier gelden niet voor personenauto's." };
  }

  var act = zoneAction(c);
  var action = act ? ACTION_TEXT[act] : "";
  var t = z.emissionThreshold;

  if(VEH.fuel === "ev"){
    return action
      ? { level:"todo", text:"Elektrisch — je voldoet overal aan de norm. " + action }
      : { level:"ok",   text:"Elektrisch — je voldoet aan de norm en hoeft niets te regelen." };
  }
  if(z.euroBasedForCars === false){
    return { level:"todo", text:"Geen euronorm-drempel voor personenauto's; het gaat hier om snelheidsbeperkingen en lokale dieselverboden. " + action };
  }

  var need = t ? (VEH.fuel === "diesel" ? t.diesel : t.petrol) : undefined;
  var scope = t && t.scope ? " (" + t.scope + ")" : "";

  if(t && need === null){
    return action
      ? { level:"todo", text:"Voor " + (VEH.fuel === "diesel" ? "diesel" : "benzine") + " geldt hier geen drempel" + scope + ". " + action }
      : { level:"ok",   text:"Voor " + (VEH.fuel === "diesel" ? "diesel" : "benzine") + " geldt hier geen drempel" + scope + "." };
  }
  if(!t || need === undefined || need === null){
    return { level:"unknown", text:"De drempel verschilt hier te sterk per stad om te beoordelen — check de gemeentesite van je bestemming. " + action };
  }
  if(VEH.euro === null){
    return { level:"unknown", text:"Vul je euronorm in om dit te beoordelen. Nodig" + scope + ": minimaal Euro " + need + ". " + action };
  }
  if(VEH.euro >= need){
    return action
      ? { level:"todo", text:"Euro " + VEH.euro + " voldoet aan de norm van minimaal Euro " + need + scope + ". " + action }
      : { level:"ok",   text:"Euro " + VEH.euro + " voldoet aan de norm van minimaal Euro " + need + scope + "." };
  }
  return { level:"bad", text:"Euro " + VEH.euro + " voldoet NIET: hier is minimaal Euro " + need + " vereist" + scope + "." };
}
function verdictHTML(v){
  var icon = { ok:"&#10003;", bad:"&#10007;", todo:"!", unknown:"?" }[v.level] || "?";
  var txt = String(v.text).replace(/\s+/g," ").trim();
  return '<div class="verdict v-' + v.level + '"><span class="vi">' + icon + "</span><span>" + esc(txt) + "</span></div>";
}

/* Notities die alleen gelden voor een aanhanger of camper. Dormant. */
function vehicleNotesFor(c){
  return (c.vehicleNotes || []).filter(function(n){
    return (n.applies || []).indexOf(VEH.type) !== -1;
  });
}

/* Is a dated winter period active on the departure date? Dormant. */
function seasonActive(w){
  if(!w || !w.periodStart || !w.periodEnd || !DEPART) return null;
  var d = DEPART.slice(5);
  return (w.periodStart <= w.periodEnd)
    ? (d >= w.periodStart && d <= w.periodEnd)
    : (d >= w.periodStart || d <= w.periodEnd);
}

function voertuigLabel(){
  return { auto:"deze route", aanhanger:"met aanhanger", camper:"camper" }[VEH.type] || "deze route";
}

/* Het autoprofiel stel je één keer in; daarna is één samenvattingsregel genoeg. */
function renderProfile(){
  var el = document.getElementById("profile-sum");
  if(!el) return;
  var fuel = { petrol:"benzine", diesel:"diesel", ev:"elektrisch" }[VEH.fuel] || VEH.fuel;
  var type = { auto:"personenauto", aanhanger:"met aanhanger", camper:"camper" }[VEH.type] || VEH.type;
  var land = BY_CODE[HOME] ? BY_CODE[HOME].name : HOME;
  var bits = [land + "s kenteken", type, fuel + (VEH.euro !== null ? " Euro " + VEH.euro : "")];
  if(DEPART) bits.push("vertrek " + fmtDate(DEPART));
  el.textContent = bits.join(" · ");
}
