"use strict";
/* Voertuigprofiel: mag deze auto erin, en moet je vooraf iets regelen.

   De twee vragen zijn apart gemodelleerd omdat ze los van elkaar staan: in Brussel
   moet je je registreren ook als je auto ruim voldoet.

   Elke functie hier krijgt de reis als parameter. Dat is niet alleen netjes: de
   voortgangsbalk op Mijn Reizen rekent over een ándere reis dan de actieve, en
   dat kon eerder alleen door de globals tijdelijk om te wisselen. */

/* Vier voertuigtypen en vier brandstoffen in de wizard (§5), minder in
   countries.json. Twee vertaalslagen, allebei op een plek:

   - een caravan is voor de regels die in de data staan een aanhanger
     (vehicleNotes gebruiken alleen "aanhanger" en "camper");
   - een hybride wordt in milieuzones op zijn verbrandingsmotor beoordeeld, en
     dat is bij personenauto's vrijwel altijd benzine. Wie een diesel-hybride
     rijdt kiest diesel; dat staat als hint bij het veld.

   Liever hier een expliciete afbeelding dan een vijfde waarde in de data
   verzinnen die nergens onderzocht is. */
function voertuigDataType(veh){
  return veh.type === "caravan" ? "aanhanger" : veh.type;
}
function brandstofVoorDrempel(veh){
  if(veh.fuel === "ev") return "ev";
  if(veh.fuel === "diesel") return "diesel";
  return "petrol";
}

function actieTekst(actie){
  return actie ? i18n("zone.actie." + actie) : "";
}

function zoneAction(c, trip){
  var z = c.environmentalZone || {};
  var act = z.actionRequired;
  if(!act || act === "geen") return null;
  var scope = z.actionAppliesTo || "all";
  var thuis = (c.code === trip.vehicle.plateCountry);
  if(scope === "foreign") return thuis ? (z.actionLocal || null) : act;
  if(scope === "local")   return thuis ? act : null;
  return act;
}

/* Let op de vorm: elke uitkomst is één hele zin uit de vertaaltabel met
   plaatshouders, niet een reeks fragmenten die hier aan elkaar geplakt wordt.
   Dat laatste valt niet te vertalen — woordvolgorde verschilt per taal. */
function zoneVerdict(c, trip){
  var z = c.environmentalZone || {};
  if(!z.required) return { level:"ok", text:i18n("zone.geen") };
  if(z.appliesToCars === false){
    return { level:"ok", text:i18n("zone.nietVoorAutos") };
  }

  var veh = trip.vehicle;
  var actie = actieTekst(zoneAction(c, trip));
  var drempel = z.emissionThreshold;
  var soort = brandstofVoorDrempel(veh);
  var brandstof = i18n("profiel.brandstofKort." + soort);

  if(soort === "ev"){
    return actie
      ? { level:"todo", text:i18n("zone.evActie", { actie:actie }) }
      : { level:"ok",   text:i18n("zone.ev") };
  }
  if(z.euroBasedForCars === false){
    return { level:"todo", text:i18n("zone.geenEuronorm", { actie:actie }) };
  }

  var need = drempel ? (soort === "diesel" ? drempel.diesel : drempel.petrol) : undefined;
  var scope = drempel && drempel.scope ? " (" + drempel.scope + ")" : "";

  if(drempel && need === null){
    return actie
      ? { level:"todo", text:i18n("zone.geenDrempelActie", { brandstof:brandstof, scope:scope, actie:actie }) }
      : { level:"ok",   text:i18n("zone.geenDrempel", { brandstof:brandstof, scope:scope }) };
  }
  if(!drempel || need === undefined || need === null){
    return { level:"unknown", text:i18n("zone.teVerschillend", { actie:actie }) };
  }
  if(veh.euro === null){
    return { level:"unknown", text:i18n("zone.vulEuronorm", { scope:scope, need:need, actie:actie }) };
  }
  if(veh.euro >= need){
    return actie
      ? { level:"todo", text:i18n("zone.voldoetActie", { euro:veh.euro, need:need, scope:scope, actie:actie }) }
      : { level:"ok",   text:i18n("zone.voldoet", { euro:veh.euro, need:need, scope:scope }) };
  }
  return { level:"bad", text:i18n("zone.voldoetNiet", { euro:veh.euro, need:need, scope:scope }) };
}

/* Niet alleen kleur (§21): elk oordeel draagt een eigen teken en een woord. */
function verdictHTML(v){
  var icon = { ok:"&#10003;", bad:"&#10007;", todo:"!", unknown:"?" }[v.level] || "?";
  var txt = String(v.text).replace(/\s+/g," ").trim();
  return '<div class="verdict v-' + v.level + '"><span class="vi">' + icon + "</span><span>" + esc(txt) + "</span></div>";
}

/* Notities die alleen gelden voor een aanhanger of camper. */
function vehicleNotesFor(c, trip){
  var type = voertuigDataType(trip.vehicle);
  return (c.vehicleNotes || []).filter(function(n){
    return (n.applies || []).indexOf(type) !== -1;
  });
}

/* Is een gedateerde winterperiode actief op de vertrekdatum? */
function seasonActive(w, trip){
  var depart = trip && trip.departureDate;
  if(!w || !w.periodStart || !w.periodEnd || !depart) return null;
  var d = depart.slice(5);
  return (w.periodStart <= w.periodEnd)
    ? (d >= w.periodStart && d <= w.periodEnd)
    : (d >= w.periodStart || d <= w.periodEnd);
}

function voertuigLabel(trip){
  return trip.vehicle.type === "auto" ? i18n("profiel.dezeRoute")
       : i18n("profiel.typeKort." + trip.vehicle.type) || i18n("profiel.dezeRoute");
}

/* Eén samenvattingsregel: kentekenland · type · brandstof en euronorm · vertrek. */
function voertuigSamenvatting(trip){
  var veh = trip.vehicle;
  var fuel = i18n("profiel.brandstofKort." + veh.fuel) || veh.fuel;
  var type = i18n("profiel.typeKort." + veh.type) || veh.type;
  var land = BY_CODE[veh.plateCountry] ? BY_CODE[veh.plateCountry].name : veh.plateCountry;
  var bits = [
    i18n("profiel.kenteken", { land:land }),
    type,
    fuel + (veh.euro !== null ? " " + i18n("profiel.euroKort", { euro:veh.euro }) : "")
  ];
  if(trip.departureDate) bits.push(i18n("profiel.vertrek", { datum:fmtDate(trip.departureDate) }));
  return bits.join(" · ");
}

/* Het autoprofiel stel je één keer in; daarna is één samenvattingsregel genoeg. */
function renderProfile(){
  var el = document.getElementById("profile-sum");
  if(!el || !TRIP) return;
  el.textContent = voertuigSamenvatting(TRIP);
}
