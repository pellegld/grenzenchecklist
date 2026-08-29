"use strict";
/* Voertuigprofiel: mag deze auto erin, en moet je vooraf iets regelen.
   
   De twee vragen zijn apart gemodelleerd omdat ze los van elkaar staan: in Brussel
   moet je je registreren ook als je auto ruim voldoet. */

/* Mag dit voertuig de strengste milieuzone van dit land in, en moet je vooraf
   iets regelen? Levert altijd een oordeel op, ook als het "dat weet ik niet" is.
   Dormant op deze pagina: de milieuzonekaart toont nu alleen welke steden je
   raakt, de volledige euro-norm-verdicts komen terug op de Checklist-pagina. */
function actieTekst(actie){
  return actie ? i18n("zone.actie." + actie) : "";
}
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

/* Let op de vorm: elke uitkomst is één hele zin uit de vertaaltabel met
   plaatshouders, niet een reeks fragmenten die hier aan elkaar geplakt wordt.
   Dat laatste valt niet te vertalen — woordvolgorde verschilt per taal.

   `drempel` heette hier `t`; dat overschaduwde niets zolang er geen globale
   vertaalfunctie was, maar dat is precies het soort naam dat je één keer wil
   opruimen in plaats van er omheen te programmeren. */
function zoneVerdict(c){
  var z = c.environmentalZone || {};
  if(!z.required) return { level:"ok", text:i18n("zone.geen") };
  if(z.appliesToCars === false){
    return { level:"ok", text:i18n("zone.nietVoorAutos") };
  }

  var actie = actieTekst(zoneAction(c));
  var drempel = z.emissionThreshold;
  var brandstof = i18n("profiel.brandstofKort." + (VEH.fuel === "diesel" ? "diesel" : "petrol"));

  if(VEH.fuel === "ev"){
    return actie
      ? { level:"todo", text:i18n("zone.evActie", { actie:actie }) }
      : { level:"ok",   text:i18n("zone.ev") };
  }
  if(z.euroBasedForCars === false){
    return { level:"todo", text:i18n("zone.geenEuronorm", { actie:actie }) };
  }

  var need = drempel ? (VEH.fuel === "diesel" ? drempel.diesel : drempel.petrol) : undefined;
  var scope = drempel && drempel.scope ? " (" + drempel.scope + ")" : "";

  if(drempel && need === null){
    return actie
      ? { level:"todo", text:i18n("zone.geenDrempelActie", { brandstof:brandstof, scope:scope, actie:actie }) }
      : { level:"ok",   text:i18n("zone.geenDrempel", { brandstof:brandstof, scope:scope }) };
  }
  if(!drempel || need === undefined || need === null){
    return { level:"unknown", text:i18n("zone.teVerschillend", { actie:actie }) };
  }
  if(VEH.euro === null){
    return { level:"unknown", text:i18n("zone.vulEuronorm", { scope:scope, need:need, actie:actie }) };
  }
  if(VEH.euro >= need){
    return actie
      ? { level:"todo", text:i18n("zone.voldoetActie", { euro:VEH.euro, need:need, scope:scope, actie:actie }) }
      : { level:"ok",   text:i18n("zone.voldoet", { euro:VEH.euro, need:need, scope:scope }) };
  }
  return { level:"bad", text:i18n("zone.voldoetNiet", { euro:VEH.euro, need:need, scope:scope }) };
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
  return VEH.type === "auto" ? i18n("profiel.dezeRoute")
       : i18n("profiel.typeKort." + VEH.type) || i18n("profiel.dezeRoute");
}

/* Het autoprofiel stel je één keer in; daarna is één samenvattingsregel genoeg. */
function renderProfile(){
  var el = document.getElementById("profile-sum");
  if(!el) return;
  var fuel = i18n("profiel.brandstofKort." + VEH.fuel) || VEH.fuel;
  var type = i18n("profiel.typeKort." + VEH.type) || VEH.type;
  var land = BY_CODE[HOME] ? BY_CODE[HOME].name : HOME;
  var bits = [
    i18n("profiel.kenteken", { land:land }),
    type,
    fuel + (VEH.euro !== null ? " " + i18n("profiel.euroKort", { euro:VEH.euro }) : "")
  ];
  if(DEPART) bits.push(i18n("profiel.vertrek", { datum:fmtDate(DEPART) }));
  el.textContent = bits.join(" · ");
}
