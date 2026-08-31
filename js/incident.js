"use strict";
/* Onderweg-modus, deel 2: de incidentmodus.

   Eén altijd bereikbare knop (in index.html, buiten de views) die op elke
   pagina werkt, ook zonder actieve reis en zonder GPS: het land kies je zo
   nodig gewoon zelf. Alles hier is puur lokaal — geen netwerkaanroep, geen
   account. */

var INCIDENT_LAND = null;

function incidentLand(){
  if(INCIDENT_LAND && BY_CODE[INCIDENT_LAND]) return INCIDENT_LAND;
  if(HUIDIG_LAND && BY_CODE[HUIDIG_LAND]) return HUIDIG_LAND;
  var landen = TRIP ? tripLanden(TRIP) : [];
  return landen.length ? landen[0] : (DATA && DATA.countries.length ? DATA.countries[0].code : null);
}

function noodgegevens(){
  try{ return JSON.parse(lsGet(STORE_NOODGEGEVENS) || "null") || {}; }catch(e){ return {}; }
}
function bewaarNoodgegevens(veld, waarde){
  var g = noodgegevens();
  g[veld] = waarde;
  lsSet(STORE_NOODGEGEVENS, JSON.stringify(g));
}

function telHref(nr){
  return "tel:" + String(nr || "").replace(/[^\d+]/g, "");
}

/* Simpele confidence-badge, losstaand van de actielijst (die verwacht een volle
   "actie"-vorm). Hergebruikt dezelfde vertaalsleutels als js/acties.js. */
function owBadgeHTML(confidence){
  return '<span class="niveau n-' + esc(confidence) + '">' + esc(i18n("confidence." + confidence)) + '</span>';
}

function incidentLandKeuzeHTML(){
  var huidig = incidentLand();
  var opties = (DATA ? DATA.countries.slice() : []).sort(function(a, b){ return a.name.localeCompare(b.name); });
  return '<label class="field incident-landveld">' +
    '<span>' + esc(i18n("incident.welkLand")) + '</span>' +
    '<select id="incident-land">' + opties.map(function(c){
      return '<option value="' + esc(c.code) + '"' + (c.code === huidig ? " selected" : "") + '>' + esc(c.name) + '</option>';
    }).join("") + '</select>' +
  '</label>';
}

function incidentContactHTML(c, ow){
  var regels = [];
  regels.push('<a class="btn primary wide" href="' + telHref(ow.emergencyNumber) + '">' +
    iconUse("warning") + esc(i18n("incident.bel", { nummer: ow.emergencyNumber })) + '</a>');
  if(ow.roadside && ow.roadside.number){
    regels.push('<a class="btn wide" href="' + telHref(ow.roadside.number) + '">' +
      iconUse("tool") + esc(i18n("incident.belPechhulp", { org: ow.roadside.org, nummer: ow.roadside.number })) + '</a>');
  } else if(ow.roadside && ow.roadside.note){
    regels.push('<p class="hint">' + esc(ow.roadside.note) + '</p>');
  }
  return '<div class="incident-contact">' + regels.join("") +
    '<p class="incident-bron">' + owBadgeHTML(ow.alcohol.confidence) +
      herkomstRegelHTML({ sourceUrl: ow.roadside.sourceUrl || ow.alcohol.sourceUrl }) +
      correctionLinks(c, ow.roadside.id) + '</p>' +
  '</div>';
}

function incidentUitstapHTML(ow){
  return '<div class="incident-blok">' +
    '<h3>' + esc(i18n("incident.uitstapKop")) + '</h3>' +
    '<p>' + esc(ow.exitVehicleRule) + '</p>' +
    (ow.lightingRule ? '<p class="hint">' + esc(ow.lightingRule) + '</p>' : "") +
  '</div>';
}

function incidentFormulierHTML(ow){
  return '<div class="incident-blok">' +
    '<h3>' + esc(i18n("incident.formulierKop")) + '</h3>' +
    '<p class="hint">' + esc(i18n("incident.formulierUitleg")) + '</p>' +
    '<table class="incident-veldtabel"><tbody>' + ow.accidentFormFields.map(function(f){
      return '<tr><td>' + esc(f.nl) + '</td><td>' + esc(f.local) + '</td></tr>';
    }).join("") + '</tbody></table>' +
  '</div>';
}

function incidentZinnenHTML(ow){
  return '<div class="incident-blok">' +
    '<h3>' + esc(i18n("incident.zinnenKop")) + '</h3>' +
    (ow.languageNote ? '<p class="hint">' + esc(ow.languageNote) + '</p>' : "") +
    '<ul class="incident-zinnen">' + ow.phrases.map(function(p){
      return '<li><span class="incident-zin-nl">' + esc(i18n("incident.zin." + p.key)) + '</span>' +
        '<span class="incident-zin-local">' + esc(p.local) + '</span>' +
        '<span class="incident-zin-fon">' + esc(p.phonetic) + '</span></li>';
    }).join("") + '</ul>' +
    '<p class="incident-bron">' + owBadgeHTML(ow.confidence) + herkomstRegelHTML({ sourceUrl: ow.sourceUrl }) + '</p>' +
  '</div>';
}

function incidentEigenGegevensHTML(){
  var g = noodgegevens();
  function veld(id, label, waarde){
    return '<label class="field"><span>' + esc(label) + '</span>' +
      '<input type="text" id="' + id + '" autocomplete="off" value="' + esc(waarde || "") + '"></label>';
  }
  return '<div class="incident-blok">' +
    '<h3>' + esc(i18n("incident.eigenGegevensKop")) + '</h3>' +
    '<p class="hint">' + esc(i18n("incident.eigenGegevensUitleg")) + '</p>' +
    '<div class="wizveld raster">' +
      veld("nood-verzekeraar", i18n("incident.veldVerzekeraar"), g.verzekeraar) +
      veld("nood-polisnummer", i18n("incident.veldPolisnummer"), g.polisnummer) +
      veld("nood-verzekeraartel", i18n("incident.veldVerzekeraarTel"), g.verzekeraarTel) +
      veld("nood-pechhulp", i18n("incident.veldPechhulp"), g.pechhulp) +
      veld("nood-pechhulptel", i18n("incident.veldPechhulpTel"), g.pechhulpTel) +
    '</div>' +
  '</div>';
}

function incidentFotoHTML(){
  return '<div class="incident-blok incident-fotoherinnering">' +
    iconUse("info") +
    '<p>' + esc(i18n("incident.fotoHerinnering")) + '</p>' +
  '</div>';
}

function renderIncident(){
  var inhoud = document.getElementById("incident-inhoud");
  if(!inhoud || !DATA) return;
  var code = incidentLand();
  var c = BY_CODE[code];
  var ow = c && c.onderweg;
  if(!c || !ow){
    inhoud.innerHTML = incidentLandKeuzeHTML() + '<p class="hint">' + esc(i18n("incident.geenData")) + '</p>';
    return;
  }
  inhoud.innerHTML =
    incidentLandKeuzeHTML() +
    incidentContactHTML(c, ow) +
    incidentUitstapHTML(ow) +
    incidentFormulierHTML(ow) +
    incidentZinnenHTML(ow) +
    incidentEigenGegevensHTML() +
    incidentFotoHTML();
}

var INCIDENT_HERKOMST = null;

function openIncident(bron){
  var dlg = document.getElementById("incidentdialoog");
  if(!dlg) return;
  INCIDENT_HERKOMST = bron || null;
  renderIncident();
  dlg.hidden = false;
  var eerste = dlg.querySelector("select, input, button.meld-sluit-incident");
  if(eerste) eerste.focus();
}
function sluitIncident(){
  var dlg = document.getElementById("incidentdialoog");
  if(!dlg || dlg.hidden) return;
  dlg.hidden = true;
  if(INCIDENT_HERKOMST && document.contains(INCIDENT_HERKOMST)) INCIDENT_HERKOMST.focus();
  INCIDENT_HERKOMST = null;
}

function wireIncident(){
  var knop = document.getElementById("btn-incident");
  if(knop) knop.addEventListener("click", function(e){ openIncident(e.currentTarget); });

  var dlg = document.getElementById("incidentdialoog");
  if(!dlg) return;
  dlg.addEventListener("click", function(e){
    if(e.target.closest("#incident-sluit")){ sluitIncident(); return; }
    if(e.target === dlg) sluitIncident();
  });
  dlg.addEventListener("change", function(e){
    if(e.target.id === "incident-land"){ INCIDENT_LAND = e.target.value; renderIncident(); return; }
    var map = {
      "nood-verzekeraar": "verzekeraar", "nood-polisnummer": "polisnummer",
      "nood-verzekeraartel": "verzekeraarTel", "nood-pechhulp": "pechhulp", "nood-pechhulptel": "pechhulpTel"
    };
    if(map[e.target.id]) bewaarNoodgegevens(map[e.target.id], e.target.value);
  });
}
