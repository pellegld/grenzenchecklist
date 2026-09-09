"use strict";
/* Onderweg-modus, deel 1: reismodus (grensdetectie) en het offline reispack.

   Reismodus hergebruikt de landdetectie die al voor de routeplanner bestaat
   (classifyPoint/BORDERS uit js/geo.js) — er is geen tweede manier nodig om te
   weten in welk land een punt ligt, alleen een nieuwe bron voor dat punt:
   watchPosition in plaats van routegeometrie.

   Er is geen tegel-cache in deze app (js/map.js tekent een SVG-routeschets,
   geen Leaflet). Het "offline reispack" is daarom een status- en ververs-knop
   voor de databestanden die de service worker toch al cachet — geen tweede
   cachesysteem ernaast. */

/* ================= reismodus ================= */

var JOURNEY_WATCH_ID = null;
var JOURNEY_LAST_FIX = 0;     /* ms, voor de throttle */
var JOURNEY_LOG = [];         /* sessie-only: [{code, tijd}] voor de Onderweg-pagina */
var JOURNEY_MIN_INTERVAL = 60000;   /* niet vaker dan 1x/minuut classificeren */

/* Of er in deze meetsessie al écht een positie binnenkwam. Dit is bewust een
   eigen vlag en niet af te leiden uit HUIDIG_LAND: dat veld wordt bij het
   opstarten al gevuld door journeyInitHuidigLand() met het eerste land van je
   reis, en dat is een aanname, geen waarneming. Wie de app aanzet terwijl hij
   al in België rijdt, hoorde daardoor meteen "je rijdt nu in België" alsof hij
   zojuist de grens over kwam. */
var JOURNEY_FIX_GEHAD = false;
var JOURNEY_FIX_TIJD = null;         /* ISO-tijd van de laatste geslaagde meting */
var JOURNEY_BANNER_VEROUDERD = false;

function journeyEnabled(){
  try{ return !!JSON.parse(lsGet(STORE_JOURNEY) || "null").enabled; }catch(e){ return false; }
}
function journeyZetEnabled(aan){
  lsSet(STORE_JOURNEY, JSON.stringify({ enabled: !!aan }));
}

/* Eén tekstuele samenvatting van wat er verandert bij het passeren van deze
   grens — uit dezelfde velden als de rest van de app leest, niets nieuws
   verzinnen dat niet in de data staat. */
function grensInfo(code, trip){
  var c = BY_CODE[code];
  if(!c) return null;
  var ow = c.onderweg || null;
  var sl = (c.speedLimits && c.speedLimits.normal) || null;
  var eqMust = (trip && c.mandatoryEquipment)
    ? c.mandatoryEquipment.filter(function(it){ return effectiveStatus(it, c, trip) === "must"; })
    : [];
  var notes = trip ? vehicleNotesFor(c, trip) : [];
  var vign = null;
  if(c.tollVignette && c.tollVignette.required){
    vign = {
      naam: kortNaam(c.tollVignette.name, i18n("tol.vignetNaam")),
      geregeld: !!(trip && isAangevinkt(trip, "task:vig:" + code))
    };
  }
  return { c: c, ow: ow, sl: sl, eqMust: eqMust, notes: notes, vign: vign };
}

/* Platte tekst, voor de systeemmelding (Notification.body accepteert geen HTML). */
function grensTekstPlat(info){
  var regels = [];
  if(info.sl) regels.push(i18n("onderweg.meldingSnelheid", {
    kom: info.sl.builtUp || "—", buiten: info.sl.rural || "—", snelweg: info.sl.motorway || "—" }));
  if(info.ow && info.ow.alcohol) regels.push(i18n("onderweg.meldingAlcohol", { promille: getal(info.ow.alcohol.limitPromille) }));
  if(info.vign) regels.push(info.vign.geregeld
    ? i18n("onderweg.meldingVignetGeregeld", { naam: info.vign.naam })
    : i18n("onderweg.meldingVignetNietGeregeld", { naam: info.vign.naam }));
  if(info.eqMust.length) regels.push(i18n("onderweg.meldingUitrusting", { lijst: info.eqMust.map(function(it){ return it.item; }).join(", ") }));
  return regels.join(" · ");
}

/* Het tijdstip waarop de laatste meting binnenkwam, als uu:mm. */
function journeyFixTijdTekst(){
  if(!JOURNEY_FIX_TIJD) return "";
  var t = new Date(JOURNEY_FIX_TIJD);
  return ("0" + t.getHours()).slice(-2) + ":" + ("0" + t.getMinutes()).slice(-2);
}

/* verouderd = true betekent: dit is de laatste waarneming, maar er is sindsdien
   niet meegekeken. De kop zegt dat dan ook, in plaats van "je rijdt nu in". */
function grensBannerHTML(info, verouderd){
  var c = info.c;
  var regels = [];
  if(verouderd){
    regels.push('<li class="grensbanner-verouderd">' + iconUse("info") + '<span>' +
      esc(i18n("onderweg.bannerVerouderdUitleg")) + '</span></li>');
  }
  if(info.sl){
    regels.push('<li>' + iconUse("speed") + '<span>' + esc(i18n("onderweg.meldingSnelheid", {
      kom: info.sl.builtUp || "—", buiten: info.sl.rural || "—", snelweg: info.sl.motorway || "—" })) + '</span></li>');
  }
  if(info.ow && info.ow.alcohol){
    regels.push('<li>' + iconUse("warning") + '<span>' + esc(i18n("onderweg.meldingAlcohol", { promille: getal(info.ow.alcohol.limitPromille) })) +
      (info.ow.alcohol.note ? ' — ' + esc(info.ow.alcohol.note) : "") + '</span></li>');
  }
  if(info.ow && info.ow.lightingRule){
    regels.push('<li>' + iconUse("info") + '<span>' + esc(info.ow.lightingRule) + '</span></li>');
  }
  if(info.vign){
    regels.push('<li>' + iconUse(info.vign.geregeld ? "check" : "warning") + '<span>' +
      esc(info.vign.geregeld
        ? i18n("onderweg.meldingVignetGeregeld", { naam: info.vign.naam })
        : i18n("onderweg.meldingVignetNietGeregeld", { naam: info.vign.naam })) + '</span></li>');
  }
  if(info.eqMust.length){
    regels.push('<li>' + iconUse("checklist") + '<span>' +
      esc(i18n("onderweg.meldingUitrusting", { lijst: info.eqMust.map(function(it){ return it.item; }).join(", ") })) + '</span></li>');
  }
  info.notes.forEach(function(n){
    regels.push('<li>' + iconUse("info") + '<span>' + esc(n.text) + '</span></li>');
  });
  return '<div class="grensbanner' + (verouderd ? " is-verouderd" : "") + '" role="status" aria-live="polite">' +
    '<div class="grensbanner-kop">' + flagHTML(c) + '<b>' + esc(verouderd
      ? i18n("onderweg.laatstGezien", { land: c.name, tijd: journeyFixTijdTekst() })
      : i18n("onderweg.nuIn", { land: c.name })) + '</b>' +
    '<button type="button" class="grensbanner-sluit" id="grensbanner-sluit" aria-label="' + esc(i18n("alg.sluiten")) + '">&times;</button></div>' +
    '<ul class="grensbanner-lijst">' + regels.join("") + '</ul></div>';
}

function toonGrensbanner(code, trip, verouderd){
  var el = document.getElementById("grensbanner-wrap");
  if(!el) return;
  var info = grensInfo(code, trip);
  if(!info){ el.innerHTML = ""; el.hidden = true; return; }
  el.innerHTML = grensBannerHTML(info, !!verouderd);
  el.hidden = false;
}

function verbergGrensbanner(){
  var el = document.getElementById("grensbanner-wrap");
  if(el){ el.hidden = true; el.innerHTML = ""; }
}

function meldGrenswissel(code){
  JOURNEY_BANNER_VEROUDERD = false;
  JOURNEY_LOG.unshift({ code: code, tijd: new Date().toISOString() });
  if(JOURNEY_LOG.length > 20) JOURNEY_LOG.length = 20;

  var info = grensInfo(code, TRIP);
  if(info && typeof Notification !== "undefined" && Notification.permission === "granted" && document.hidden){
    try{
      new Notification(i18n("onderweg.nuIn", { land: info.c.name }), { body: grensTekstPlat(info), tag: "grens-" + code });
    }catch(e){ /* sommige browsers staan dit alleen via een service worker toe; de banner blijft werken */ }
  }
  toonGrensbanner(code, TRIP);
  if(VIEW === "onderweg") renderOnderweg();
}

function journeyOpPositie(pos){
  var nu = Date.now();
  if(nu - JOURNEY_LAST_FIX < JOURNEY_MIN_INTERVAL) return;
  JOURNEY_LAST_FIX = nu;
  if(!BORDERS) return;   /* laadGeoData() is nog bezig; de volgende fix pakt het wel op */

  var code = classifyPoint(pos.coords.longitude, pos.coords.latitude);
  if(!code || !BY_CODE[code]) return;

  var eersteFix = !JOURNEY_FIX_GEHAD;
  JOURNEY_FIX_GEHAD = true;
  JOURNEY_FIX_TIJD = new Date().toISOString();

  var gewisseld = code !== HUIDIG_LAND;
  HUIDIG_LAND = code;

  /* Een grenswissel meld je; de allereerste meting van een sessie niet, ook al
     ligt hij in een ander land dan waar je reis begint. Je bent dan niet zojuist
     een grens overgestoken — de app kijkt pas net mee. */
  if(gewisseld && !eersteFix){ meldGrenswissel(code); return; }

  /* Geen wissel (of de eerste meting), maar er stond misschien nog een
     verouderde banner van vóór het wegschakelen. Die is nu weer waar. */
  if(JOURNEY_BANNER_VEROUDERD){
    JOURNEY_BANNER_VEROUDERD = false;
    toonGrensbanner(code, TRIP);
  }
  if(VIEW === "onderweg") renderOnderweg();
}

/* iOS bevriest watchPosition zodra een PWA naar de achtergrond gaat. Zonder
   correctie blijft de banner daarna "Je rijdt nu in Frankrijk" beweren terwijl
   je al twee uur in Oostenrijk rijdt: verouderde informatie die zich voordoet
   als actueel, en juist bij snelheidslimieten en alcoholgrenzen is dat de
   verkeerde fout om te maken.

   Bij terugkeer zetten we de banner daarom eerst terug op wat we werkelijk
   weten — "laatst gezien om 14:12 in Frankrijk" — en vragen we meteen één verse
   positie. Komt die binnen, dan wint hij vanzelf en staat er weer "nu". */
function journeyOpTerugkeer(){
  if(document.hidden || !journeyEnabled() || !JOURNEY_FIX_GEHAD) return;
  /* Even wisselen van tabblad is geen onderbreking; wat vers is, blijft vers. */
  if(Date.now() - JOURNEY_LAST_FIX < JOURNEY_MIN_INTERVAL) return;

  if(HUIDIG_LAND && BY_CODE[HUIDIG_LAND]){
    JOURNEY_BANNER_VEROUDERD = true;
    toonGrensbanner(HUIDIG_LAND, TRIP, true);
  }
  /* Deze ene meting mag niet door de throttle tegengehouden worden: hij is de
     reden dat we hier zijn. */
  JOURNEY_LAST_FIX = 0;
  if(navigator.geolocation && navigator.geolocation.getCurrentPosition){
    try{
      navigator.geolocation.getCurrentPosition(journeyOpPositie, function(){
        /* Geen verse fix te krijgen: de verouderde banner blijft staan, en dat
           is precies wat hij hoort te doen. */
      }, { enableHighAccuracy: false, maximumAge: 0, timeout: 20000 });
    }catch(e){}
  }
}

function journeyStart(){
  return laadGeoData().then(function(){
    if(!navigator.geolocation){ journeyStatus(i18n("onderweg.geenGps")); return; }
    if(typeof Notification !== "undefined" && Notification.permission === "default"){
      try{ Notification.requestPermission(); }catch(e){}
    }
    JOURNEY_LAST_FIX = 0;
    /* Een nieuwe meetsessie: de eerstvolgende positie is weer een eerste. */
    JOURNEY_FIX_GEHAD = false;
    JOURNEY_BANNER_VEROUDERD = false;
    JOURNEY_WATCH_ID = navigator.geolocation.watchPosition(journeyOpPositie, function(err){
      journeyStatus(i18n("onderweg.gpsFout", { reden: err && err.message ? err.message : "" }));
    }, { enableHighAccuracy: false, maximumAge: 120000, timeout: 20000 });
  });
}

function journeyStop(){
  if(JOURNEY_WATCH_ID !== null && navigator.geolocation){
    navigator.geolocation.clearWatch(JOURNEY_WATCH_ID);
  }
  JOURNEY_WATCH_ID = null;
  JOURNEY_FIX_GEHAD = false;
  JOURNEY_BANNER_VEROUDERD = false;
  verbergGrensbanner();
}

function journeyToggle(aan){
  journeyZetEnabled(aan);
  if(aan) journeyStart().then(renderOnderweg); else { journeyStop(); renderOnderweg(); }
}

function journeyStatus(tekst){
  var el = document.getElementById("journey-status");
  if(el) el.textContent = tekst || "";
}

/* ================= offline reispack ================= */

var PACK_BESTANDEN = ["countries.json", "zones.json", "borders.json", "drukte.json", "fuelprices.json"];

function pakInfo(){
  try{ return JSON.parse(lsGet(STORE_PACK) || "null") || {}; }catch(e){ return {}; }
}

function bytesTekst(n){
  if(n == null) return "—";
  if(n < 1024 * 1024) return getal(Math.round(n / 1024)) + " KB";
  return getal(Math.round(n / (1024 * 1024) * 10) / 10, { maximumFractionDigits:1 }) + " MB";
}

function pakVerversen(){
  var status = document.getElementById("pack-status");
  if(status) status.textContent = i18n("onderweg.pakBezig");
  return Promise.all(PACK_BESTANDEN.map(function(f){
    return fetch(f, { cache: "reload" }).catch(function(){ /* stil: offline of bestand ontbreekt */ });
  })).then(function(){
    lsSet(STORE_PACK, JSON.stringify({ laatstVernieuwd: new Date().toISOString() }));
    renderOnderweg();
  });
}

function pakKaartHTML(){
  var info = pakInfo();
  var laatst = info.laatstVernieuwd ? fmtDate(info.laatstVernieuwd.slice(0, 10)) : null;
  var grootteRegel = '<p class="hint" id="pack-status">' + esc(i18n("onderweg.pakGrootteLaden")) + '</p>';
  if(navigator.storage && navigator.storage.estimate){
    navigator.storage.estimate().then(function(est){
      var el = document.getElementById("pack-status");
      if(el) el.textContent = i18n("onderweg.pakGrootte", { grootte: bytesTekst(est.usage) });
    }).catch(function(){
      /* Op file:// bestaat navigator.storage wél maar weigert estimate(). Zonder
         deze regel bleef "Grootte wordt berekend…" voor altijd staan: een belofte
         dat er nog iets komt, terwijl er niets meer komt. */
      var el = document.getElementById("pack-status");
      if(el) el.textContent = i18n("onderweg.pakGeenSchatting");
    });
  } else {
    grootteRegel = '<p class="hint" id="pack-status">' + esc(i18n("onderweg.pakGeenSchatting")) + '</p>';
  }
  return '<section class="dashkaart onderwegkaart">' +
    '<h2>' + iconUse("layers") + esc(i18n("onderweg.pakKop")) + '</h2>' +
    '<p class="hint">' + esc(i18n("onderweg.pakUitleg")) + '</p>' +
    '<ul class="pakinhoud">' + PACK_BESTANDEN.map(function(f){
      return '<li>' + iconUse("check") + '<span>' + esc(f) + '</span></li>';
    }).join("") + '</ul>' +
    grootteRegel +
    '<p class="hint">' + esc(laatst ? i18n("onderweg.pakLaatst", { datum: laatst }) : i18n("onderweg.pakNogNooit")) + '</p>' +
    '<button type="button" class="btn" id="btn-pak-ververs">' + esc(i18n("onderweg.pakVerversen")) + '</button>' +
  '</section>';
}

/* ================= sessielog: gedetecteerde landwissels ================= */

function journeyLogHTML(){
  if(!JOURNEY_LOG.length) return "";
  return '<ul class="journeylog">' + JOURNEY_LOG.map(function(r){
    var c = BY_CODE[r.code];
    if(!c) return "";
    var t = new Date(r.tijd);
    var uur = ("0" + t.getHours()).slice(-2), min = ("0" + t.getMinutes()).slice(-2);
    return '<li>' + flagHTML(c) + '<span>' + esc(c.name) + '</span><span class="journeylog-tijd">' + uur + ":" + min + '</span></li>';
  }).join("") + '</ul>';
}

/* ================= de Onderweg-pagina ================= */

function journeyKaartHTML(){
  var aan = journeyEnabled();
  return '<section class="dashkaart onderwegkaart">' +
    '<h2>' + iconUse("locate") + esc(i18n("onderweg.reismodusKop")) + '</h2>' +
    '<p class="hint">' + esc(i18n("onderweg.reismodusUitleg")) + '</p>' +
    '<p class="hint waarschuwing-batterij">' + iconUse("warning") + ' ' + esc(i18n("onderweg.batterijWaarschuwing")) + '</p>' +
    '<label class="switchrow reismodusrij">' +
      '<span>' + esc(i18n("onderweg.reismodusAanzetten")) + '</span>' +
      '<span class="switch"><input type="checkbox" id="journey-toggle"' + (aan ? " checked" : "") + '>' +
        '<span class="switch-track"><span class="switch-thumb"></span></span></span>' +
    '</label>' +
    '<p class="rstat" id="journey-status"></p>' +
    (aan ? ('<p class="hint">' + esc(HUIDIG_LAND && BY_CODE[HUIDIG_LAND]
        ? i18n("onderweg.huidigLand", { land: BY_CODE[HUIDIG_LAND].name })
        : i18n("onderweg.nogGeenFix")) + '</p>' + journeyLogHTML())
      : "") +
  '</section>';
}

function renderOnderweg(){
  var wrap = document.getElementById("onderweg-wrap");
  if(!wrap) return;
  wrap.innerHTML =
    '<section class="kostenkop">' +
      '<h1>' + esc(i18n("onderweg.titel")) + '</h1>' +
      '<p class="lead">' + esc(i18n("onderweg.intro")) + '</p>' +
    '</section>' +
    '<div class="kostengrid">' + journeyKaartHTML() + pakKaartHTML() +
      douaneKaartHTML(TRIP) + boeteHerkenningKaartHTML() + '</div>';
}

function wireOnderweg(){
  /* De grensbanner staat buiten de views en overleeft dus elke paginawissel;
     de terugkeercorrectie hoort daarom op document-niveau, niet in de wrap. */
  document.addEventListener("visibilitychange", journeyOpTerugkeer);

  var wrap = document.getElementById("onderweg-wrap");
  if(!wrap) return;
  wrap.addEventListener("change", function(e){
    if(e.target.id === "journey-toggle") journeyToggle(e.target.checked);
  });
  wrap.addEventListener("click", function(e){
    if(e.target.closest("#btn-pak-ververs")) pakVerversen();
  });
}

/* Zet HUIDIG_LAND op een redelijk startpunt zodra de app opstart met reismodus
   al aan (bv. na een herlaad tijdens de rit) of anders op het eerste land van
   de actieve reis, zodat de incidentmodus ook zonder GPS-fix een land toont. */
function journeyInitHuidigLand(){
  if(HUIDIG_LAND) return;
  var landen = TRIP ? tripLanden(TRIP) : [];
  if(landen.length) HUIDIG_LAND = landen[0];
}
