"use strict";
/* Orkestratie: render, view-switching, events en boot.

   Dit bestand wordt als laatste geladen; onderaan staat de daadwerkelijke start. */

/* ---------------- orkestratie ----------------
   Bouwt alleen de zichtbare VIEW opnieuw op — de andere secties staan toch
   achter [hidden], dus dat werk zou verspild zijn. */
var RENDERS = {
  home:      renderHome,
  /* Zonder force: renderWizard() bouwt alleen opnieuw op als de reis, de stap
     of de taal veranderde. Anders zou terugkomen op een stap de velden onder je
     vingers vandaan halen. */
  wizard:    function(){ renderWizard(); },
  dashboard: renderDashboard,
  acties:    renderActies,
  kaart:     function(){
    renderDashboardStats();
    renderLandenLijst();
    renderMilieuzones();
    renderHandmatigeKeuze();
    renderKaart();
  },
  kosten:    renderKosten,
  kalender:  renderKalender,
  regels:    renderLandenInfo,
  document:  renderDocument,
  onderweg:  renderOnderweg,
  reizen:    renderMijnReizen,
  reis:      renderReisErvaring
};

function render(){
  renderProfile();
  /* Ook hier, niet alleen in switchView: de kaartpagina kan een route berekenen
     zonder van view te wisselen, en dan hoort de noodknop erbij te komen. */
  verversSosKnop();
  var fn = RENDERS[VIEW];
  if(fn) fn();
  zetTopstrook();
}

/* De topstrook op een telefoon is de kop van een atlasblad: onder het merk de
   reis waar dit scherm over gaat, rechts in een bladvakje het ene getal dat
   hier telt — op het dashboard hoeveel procent klaar is, op de actiepagina
   hoeveel er nog open staan. Zonder reis staat er de ondertitel van de app. */
function zetTopstrook(){
  var sub = document.getElementById("topsub"), blad = document.getElementById("topblad");
  if(!sub || !blad) return;
  var reis = (typeof TRIP !== "undefined" && TRIP && DATA && tripIsKlaar(TRIP)) ? reisNaamKort(TRIP) : "";
  var tekst = reis || i18n("app.tagline"), label = "", waarde = "";
  if(reis && VIEW === "dashboard"){
    var t = checklistTelling(TRIP);
    label = i18n("topstrook.klaar");
    waarde = (t.totaal ? Math.round(t.gedaan / t.totaal * 100) : 0) + " %";
  }else if(reis && VIEW === "acties"){
    var a = actieTelling(TRIP);
    label = i18n("topstrook.nog");
    waarde = String(a.open);
    if(TRIP.departureDate) tekst += " \u00b7 " + fmtDateKort(TRIP.departureDate);
  }else if(VIEW === "home" || VIEW === "wizard"){
    tekst = i18n("app.tagline");
  }
  sub.textContent = tekst;
  document.getElementById("topblad-lbl").textContent = label;
  document.getElementById("topblad-val").textContent = waarde;
  blad.hidden = !label;
}

/* ---------------- view-switching ---------------- */
function switchView(naam, geenHash){
  if(VIEW_ORDER.indexOf(naam) === -1) naam = "home";
  stopJourneyScroll(); // alleen actief terwijl VIEW==="reis"; render() start 'm zo nodig weer op
  VIEW = naam;
  VIEW_ORDER.forEach(function(v){
    var sec = document.getElementById("view-" + v);
    if(sec) sec.hidden = (v !== naam);
  });
  /* De navigatie markeert de actieve bestemming. Home en wizard staan niet in
     de balk; dan is er terecht niets actief. */
  var knoppen = document.querySelectorAll("[data-view]");
  for(var i = 0; i < knoppen.length; i++){
    var is = knoppen[i].getAttribute("data-view") === naam;
    knoppen[i].classList.toggle("active", is && knoppen[i].closest(".sidenav, .bottomnav") !== null);
  }
  sluitMeer();
  verversSosKnop();
  if(!geenHash && location.hash !== "#" + naam) location.hash = naam;
  window.scrollTo(0, 0);
  var sec = document.getElementById("view-" + naam);
  if(sec) sec.scrollTop = 0;
  render();
}

/* ---------------- het Meer-paneel (mobiel) ---------------- */
function openMeer(){
  var p = document.getElementById("meerpaneel");
  if(!p) return;
  p.hidden = false;
  document.getElementById("btn-meer").setAttribute("aria-expanded", "true");
  var eerste = p.querySelector(".meerrij");
  if(eerste) eerste.focus();
}
function sluitMeer(){
  var p = document.getElementById("meerpaneel");
  if(!p || p.hidden) return;
  p.hidden = true;
  var knop = document.getElementById("btn-meer");
  if(knop) knop.setAttribute("aria-expanded", "false");
}

/* ---------------- formulier bijwerken ----------------
   De velden op de kaartpagina staan buiten render() (ze zijn statisch in de
   markup), dus na een trip-wissel moeten ze apart gelijkgetrokken worden. */
function verversFormulier(){
  if(!TRIP) return;
  function zet(id, waarde){
    var el = document.getElementById(id);
    if(el) el.value = waarde;
  }
  zet("home", TRIP.vehicle.plateCountry);
  zet("depart", TRIP.departureDate || "");
  zet("fuel", TRIP.vehicle.fuel);
  zet("euro", TRIP.vehicle.euro === null ? "" : String(TRIP.vehicle.euro));
  zet("vtype", voertuigTypeVoorKeuze(TRIP.vehicle.type));
  zet("from", TRIP.origin ? TRIP.origin.naam : "");
  zet("to", TRIP.destination ? TRIP.destination.naam : "");
}

/* ---------------- events ---------------- */
function wire(){
  document.getElementById("btn-reset").addEventListener("click", function(){ nieuweTrip("wizard"); });

  document.getElementById("dark-toggle").addEventListener("change", function(e){
    wisselThema(e.target.checked);
  });
  document.getElementById("dark-toggle-meer").addEventListener("change", function(e){
    wisselThema(e.target.checked);
  });
  document.getElementById("dark-toggle-mobiel").addEventListener("click", function(){
    wisselThema(huidigThema() !== "dark");
  });

  /* Eén afhandelaar voor alle navigatie: zijbalk, onderbalk, Meer-paneel en de
     knoppen in de pagina's zelf dragen allemaal data-view. */
  document.addEventListener("click", function(e){
    var meer = e.target.closest("#btn-meer");
    if(meer){ document.getElementById("meerpaneel").hidden ? openMeer() : sluitMeer(); return; }
    if(e.target.closest("#meer-sluit")){ sluitMeer(); return; }
    var sheet = e.target.closest(".meersheet");
    if(sheet && !e.target.closest(".meerkaart")){ sluitMeer(); return; }

    var b = e.target.closest("[data-view]");
    if(b){
      var naar = b.getAttribute("data-view");
      var stap = b.getAttribute("data-wiz-naar");
      if(stap && TRIP){ TRIP.metadata.stap = Number(stap); bewaarTrips(); WIZ_GETEKEND = null; }
      switchView(naar);
      return;
    }
  });
  window.addEventListener("hashchange", function(){
    var v = (location.hash || "").replace("#", "");
    if(v && v !== VIEW) switchView(v, true);
  });
  document.addEventListener("keydown", function(e){
    if(e.key !== "Escape") return;
    sluitMeer();
    sluitMelding();
    sluitIncident();
  });

  /* De grensbanner (fase C) is dynamisch ingevoegd buiten de views, dus zijn
     sluitknop hangt op document-niveau, net als de correctielink hierboven. */
  document.addEventListener("click", function(e){
    if(e.target.closest("#grensbanner-sluit")) verbergGrensbanner();
  });

  /* §21: een rij die als knop werkt, moet ook met het toetsenbord werken. De
     landenlijst op de kaartpagina had role="button" en tabindex, maar luisterde
     alleen naar een muisklik. */
  document.addEventListener("keydown", function(e){
    if(e.key !== "Enter" && e.key !== " ") return;
    var rij = e.target.closest(".landrow, .landswitch-row");
    if(!rij) return;
    e.preventDefault();
    rij.click();
  });

  /* Afvinken. Een afgevinkte actie verhuist naar "Klaar", dus de pagina wordt
     opnieuw opgebouwd; naAfvinken() bewaart de scrollpositie, zet de focus terug
     op hetzelfde vinkje en zegt tegen een schermlezer waar het heen ging. */
  document.addEventListener("change", function(e){
    var cb = e.target.closest("input[data-tick]");
    if(!cb || !TRIP) return;
    var k = cb.getAttribute("data-tick");
    var vig = /^task:vig:(.+)$/.exec(k);
    if(cb.checked){
      TRIP.ticked[k] = 1;
      /* Fase D2: bij een vignet met een harde looptijd (AT, CH) meteen vragen
         wanneer het gekocht is, zodat een volgende reis met dezelfde auto het
         niet opnieuw hoeft te melden. */
      if(vig) vignetVraagBijAfvinken(vig[1]);
    } else {
      delete TRIP.ticked[k];
      /* Uitvinken is een expliciet "nee, dit klopt niet" — dan hoort het
         onthouden vignet ook te verdwijnen, anders staat de actie bij de
         eerstvolgende render vanzelf weer als afgevinkt (het geheugen wint). */
      if(vig) wisVignetGeldigheid(vig[1]);
    }
    bewaarTrip();
    if(VIEW === "acties") naAfvinken(k, cb.checked);
    else render();
  });

  /* De correctielink (§14A). Staat bij elke actie en bij elke sectie van de
     regelpagina, dus één afhandelaar op document-niveau. */
  document.addEventListener("click", function(e){
    var meld = e.target.closest("[data-melden]");
    if(meld){
      e.preventDefault();
      MELD_HERKOMST = meld;
      kopieerMelding(meld.getAttribute("data-melden"),
                     meld.getAttribute("data-melden-feit"), meld);
      return;
    }
    if(e.target.closest("#meld-sluit")){ sluitMelding(); return; }
    var dlg = e.target.closest(".melddialoog");
    if(dlg && !e.target.closest(".meldvenster")) sluitMelding();
  });

  /* ---------------- wizard ---------------- */
  var wiz = document.getElementById("view-wizard");
  wiz.addEventListener("click", function(e){
    var terug = e.target.closest("[data-wiz-terug]");
    if(terug){ wizardGa(Number(terug.getAttribute("data-wiz-terug"))); return; }
    var verder = e.target.closest("[data-wiz-verder]");
    if(verder){ wizardGa(Number(verder.getAttribute("data-wiz-verder"))); return; }
    if(e.target.closest("#btn-analyse")){ startAnalyse(); return; }
    if(e.target.closest("#btn-handmatig")){ toonHandmatigInWizard(); return; }
    if(e.target.closest("#hm-toevoegen")){
      addCountry(document.getElementById("hm-land").value);
      toonHandmatigInWizard();
      return;
    }
    var weg = e.target.closest("[data-hm-weg]");
    if(weg){ removeAt(Number(weg.getAttribute("data-hm-weg"))); toonHandmatigInWizard(); }
  });
  wiz.addEventListener("change", function(e){
    if(!TRIP) return;
    var id = e.target.id, v = e.target.value;
    if(id === "wiz-depart") TRIP.departureDate = v || null;
    else if(id === "wiz-return") TRIP.returnDate = v || null;
    else if(id === "wiz-home") TRIP.vehicle.plateCountry = v;
    else if(id === "wiz-fuel") TRIP.vehicle.fuel = v;
    else if(id === "wiz-euro") TRIP.vehicle.euro = v === "" ? null : Number(v);
    else if(id === "wiz-vtype") TRIP.vehicle.type = v;
    else if(id === "wiz-gewicht") TRIP.vehicle.gewichtKg = v === "" ? null : Number(v);
    else if(id === "wiz-hoogte") TRIP.vehicle.hoogteM = v === "" ? null : Number(v);
    else return;
    bewaarTrip();
    verversFormulier();
    /* De vertrekdatum bepaalt of stap 2 door mag (wizKlaarVoorVolgende), dus de
       knop moet meteen meebewegen en niet pas bij de volgende render. */
    wizardVerderKnop();
  });
  /* Niet elke mobiele browser stuurt "change" bij het kiezen van een datum even
     snel als "input". Alleen voor dit ene veld, want op de getalvelden zou het
     bij iedere aanslag opslaan. */
  wiz.addEventListener("input", function(e){
    if(!TRIP || e.target.id !== "wiz-depart") return;
    TRIP.departureDate = e.target.value || null;
    bewaarTrip();
    wizardVerderKnop();
  });

  /* ---------------- homepage ---------------- */
  document.getElementById("view-home").addEventListener("click", function(e){
    if(e.target.closest("#btn-plan")){
      /* Een tweede reis plannen mag de eerste niet overschrijven. Staat er al
         een uitgewerkte reis, dan begint "Plan mijn reis" een nieuwe. */
      if(TRIP && tripIsKlaar(TRIP)) nieuweTrip("wizard");
      else { TRIP.metadata.stap = 1; bewaarTrips(); WIZ_GETEKEND = null; switchView("wizard"); }
    }
  });

  /* ---------------- regels per land ---------------- */
  var regels = document.getElementById("view-regels");
  regels.addEventListener("click", function(e){
    var toggle = e.target.closest(".landswitch-toggle");
    if(toggle){
      var panel = document.getElementById("land-switch-panel");
      var openen = panel.hidden;
      panel.hidden = !openen;
      toggle.setAttribute("aria-expanded", openen ? "true" : "false");
      if(openen){
        var zoek = document.getElementById("land-switch-search");
        if(zoek){ zoek.value = ""; filterLandSwitch(""); zoek.focus(); }
      }
      return;
    }
    var rij = e.target.closest(".landswitch-row");
    if(rij){
      LANDEN_ACTIEF = rij.getAttribute("data-land");
      renderLandenInfo();
    }
  });
  regels.addEventListener("input", function(e){
    if(e.target.id === "land-switch-search") filterLandSwitch(e.target.value);
  });
  document.addEventListener("click", function(e){
    var panel = document.getElementById("land-switch-panel");
    if(!panel || panel.hidden || e.target.closest(".landswitch")) return;
    panel.hidden = true;
    var toggle = document.getElementById("land-switch-toggle");
    if(toggle) toggle.setAttribute("aria-expanded", "false");
  });
  document.addEventListener("keydown", function(e){
    if(e.key !== "Escape") return;
    var panel = document.getElementById("land-switch-panel");
    if(!panel || panel.hidden) return;
    panel.hidden = true;
    var toggle = document.getElementById("land-switch-toggle");
    if(toggle){ toggle.setAttribute("aria-expanded", "false"); toggle.focus(); }
  });
  document.getElementById("landenlijst").addEventListener("click", function(e){
    var row = e.target.closest(".landrow");
    if(!row) return;
    LANDEN_ACTIEF = row.getAttribute("data-land");
    switchView("regels");
  });

  /* ---------------- mijn reizen ---------------- */
  document.getElementById("view-reizen").addEventListener("click", function(e){
    if(e.target.closest("#btn-nieuwe-reis") || e.target.closest("#btn-tripnew")){
      nieuweTrip("wizard");
      return;
    }
    /* Fase D1: "Gezien" op de wijzigingenkaart zet het ijkpunt van die ene reis
       vooruit, en alleen van die reis — de andere reizen in de lijst mogen hun
       eigen ongeziene wijzigingen houden. */
    var gezien = e.target.closest("[data-wijzigingen-gezien]");
    if(gezien){
      markeerGecontroleerd(tripById(gezien.getAttribute("data-wijzigingen-gezien")));
      verversWijzigingenBadge();
      renderMijnReizen();
      return;
    }
    var actieBtn = e.target.closest("[data-actie]");
    if(actieBtn){
      var kaart = actieBtn.closest(".tripcard");
      var id = kaart && kaart.getAttribute("data-trip");
      var actie = actieBtn.getAttribute("data-actie");
      if(actie === "open") activeerTrip(id);
      else if(actie === "hernoem") hernoemTrip(id);
      else if(actie === "verwijder") verwijderTrip(id);
    }
  });

  /* ---------------- reisdocument ---------------- */
  document.getElementById("view-document").addEventListener("click", function(e){
    if(e.target.closest("#btn-print")) window.print();
    var deel = e.target.closest("#btn-deel");
    if(deel){ deelReis(deel); return; }
  });

  /* ---------------- kaartpagina: profielvelden ---------------- */
  function veld(id, zet){
    var el = document.getElementById(id);
    if(el) el.addEventListener("change", function(e){ zet(e.target.value); bewaarTrip(); render(); });
  }
  veld("home",   function(v){ TRIP.vehicle.plateCountry = v; });
  veld("depart", function(v){ TRIP.departureDate = v || null; });
  veld("fuel",   function(v){ TRIP.vehicle.fuel = v; });
  veld("euro",   function(v){ TRIP.vehicle.euro = v === "" ? null : Number(v); });
  veld("vtype",  function(v){ TRIP.vehicle.type = v; });

  wireCityField("from", "from-res", function(p){ if(TRIP) TRIP.origin = p; });
  wireCityField("to",   "to-res",   function(p){ if(TRIP) TRIP.destination = p; });
  document.getElementById("btn-route").addEventListener("click", doRoute);

  /* Taalkeuze. zetTaal() vult de statische markup opnieuw en roept render()
     aan, zodat ook alles wat door JS is opgebouwd meteen omschakelt. */
  document.getElementById("taal-keuze").addEventListener("change", function(e){
    WIZ_GETEKEND = null;
    zetTaal(e.target.value);
  });
  document.getElementById("taal-toggle-mobiel").addEventListener("click", function(){
    WIZ_GETEKEND = null;
    zetTaal(TALEN[(TALEN.indexOf(TAAL) + 1) % TALEN.length]);
  });

  /* Handmatige landenkeuze op de kaartpagina (§20). */
  document.getElementById("handmatig").addEventListener("click", function(e){
    if(e.target.closest("#hm-toevoegen")){
      addCountry(document.getElementById("hm-land").value);
      return;
    }
    var weg = e.target.closest("[data-hm-weg]");
    if(weg) removeAt(Number(weg.getAttribute("data-hm-weg")));
  });
  document.getElementById("btn-swap").addEventListener("click", function(){
    var a = document.getElementById("from"), b = document.getElementById("to");
    var tv = a.value; a.value = b.value; b.value = tv;
    if(TRIP){
      var tc = TRIP.origin; TRIP.origin = TRIP.destination; TRIP.destination = tc;
      bewaarTrip();
    }
  });

  document.getElementById("map-zoom-in").addEventListener("click", function(){ kaartZoom(1.25); });
  document.getElementById("map-zoom-out").addEventListener("click", function(){ kaartZoom(1 / 1.25); });
  document.getElementById("map-locate").addEventListener("click", kaartHerstel);
  document.getElementById("map-layers").addEventListener("click", function(){
    document.querySelector(".panel-map").classList.toggle("alt");
  });
  wireKaart();
  wireKosten();
  wireDocument();
  wireOnderweg();
  wireIncident();

  /* ---------------- wanneer rijden: de drukte-kalender ---------------- */
  var kal = document.getElementById("view-kalender");
  kal.addEventListener("click", function(e){
    var m = e.target.closest("[data-kal-maand]");
    if(m){ kalenderMaand(Number(m.getAttribute("data-kal-maand"))); return; }
    var r = e.target.closest("[data-kal-richting]");
    if(r){ KAL_RICHTING = r.getAttribute("data-kal-richting"); renderKalender(); return; }
    var d = e.target.closest("[data-kal-dag]");
    if(d){ KAL_DAG = d.getAttribute("data-kal-dag"); renderKalender(); kalenderFocus(); }
  });
  kal.addEventListener("keydown", kalenderToets);

  /* De stadschips in de milieukaart openen de popup van die zone op de kaart
     (dezelfde popup als bij een tik op de marker, dus geen tweede waarheid). Op
     een telefoon schuift de kaart eerst in beeld. */
  document.getElementById("milieukaart").addEventListener("click", function(e){
    var chip = e.target.closest("[data-zone]");
    if(!chip) return;
    if(!document.getElementById("routesvg")) renderKaart();
    var id = chip.getAttribute("data-zone"), index = -1;
    KAART.markers.forEach(function(m, k){ if(m.id === "zone-" + id) index = k; });
    if(index === -1) return;
    var vlak = document.querySelector(".panel-map");
    if(vlak && window.innerWidth < 1024) vlak.scrollIntoView({ block:"start", behavior:"smooth" });
    toonMarkerPopup(index);
  });

  document.getElementById("view-reis").addEventListener("click", function(e){
    if(e.target.closest("#btn-reis-naar-planner")){ switchView("wizard"); return; }
    if(e.target.closest("#btn-reis-checklist")){ switchView("acties"); return; }
  });
}

/* ---------------- boot ---------------- */

/* Was er al een rit van vóór de meerdere-ritten-datalaag (de losse sleutels uit
   fase 1), dan verhuist die eenmalig naar de eerste reis — niets gaat verloren. */
function migreerOudeStaat(){
  var route = [], ticked = {}, veh = {};
  try{ route = JSON.parse(lsGet(STORE_ROUTE) || "[]"); }catch(e){}
  try{ ticked = JSON.parse(lsGet(STORE_TICK) || "{}"); }catch(e){}
  try{ veh = JSON.parse(lsGet(STORE_VEH) || "null") || {}; }catch(e){}
  return leesTrip({
    route: Array.isArray(route) ? route : [],
    ticked: ticked, veh: veh, home: lsGet(STORE_HOME) || "NL"
  });
}

function laadTrips(){
  var ruw = [];
  try{
    var raw = lsGet(STORE_TRIPS);
    ruw = raw ? JSON.parse(raw) : [];
    if(!Array.isArray(ruw)) ruw = [];
  }catch(e){ ruw = []; }

  TRIPS = ruw.map(leesTrip);
  if(!TRIPS.length){
    TRIPS = [(lsGet(STORE_ROUTE) || lsGet(STORE_TICK)) ? migreerOudeStaat() : legeTrip()];
  }

  ACTIVE_TRIP_ID = lsGet(STORE_ACTIVE);
  if(!tripById(ACTIVE_TRIP_ID)) ACTIVE_TRIP_ID = TRIPS[0].id;
  TRIP = tripById(ACTIVE_TRIP_ID);
  lsSet(STORE_ACTIVE, ACTIVE_TRIP_ID);
  bewaarTrips();
}

function boot(d){
  DATA = d;
  DATA.meta = DATA.meta || {};
  DATA.meta.principle = DATA.meta.principle || { text:"" };
  BY_CODE = {};
  DATA.countries.forEach(function(c){ BY_CODE[c.code] = c; });

  toepassenThema();
  laadTrips();
  journeyInitHuidigLand();

  laadData("fuelprices.json").then(function(f){ FUELPRICES = f; if(VIEW === "kosten") render(); }).catch(function(){});
  laadChangelog();
  /* De druktekalender: dezelfde laadketen als de rest van de regeldata. Zonder
     bestand blijft de pagina staan met een uitleg in plaats van een lege maand. */
  laadData("drukte.json").then(function(d){
    DRUKTE = d;
    if(VIEW === "kalender" || VIEW === "dashboard") render();
  }).catch(function(){});
  if(journeyEnabled()) journeyStart().then(render);

  var sel = document.getElementById("home");
  sel.innerHTML = DATA.countries.map(function(c){
    return '<option value="' + esc(c.code) + '">' + esc(c.name) + "</option>";
  }).join("");
  verversFormulier();

  /* Een gedeelde reis in de adresbalk gaat voor: wie zo'n link opent komt
     daarvoor, niet voor de reis die hij zelf open had staan. Hij komt er als
     nieuwe reis bij (§12) — er wordt niets van jou overschreven. */
  var gedeeld = leesDeelLink();
  var kwamVanLink = gedeeld ? importeerGedeeldeReis(gedeeld) : false;

  /* Waar je binnenkomt: een expliciete hash wint, daarna je eigen reis, en
     anders de homepage. Iemand die de app al gebruikt heeft, wil niet elke keer
     opnieuw langs de verkooptekst. */
  var hashView = (location.hash || "").replace("#", "");
  if(kwamVanLink) hashView = "dashboard";
  if(VIEW_ORDER.indexOf(hashView) !== -1) VIEW = hashView;
  else VIEW = tripIsKlaar(TRIP) ? "dashboard" : "home";

  meldCachekopie();

  var gs = document.getElementById("general-sources");
  gs.innerHTML = (DATA.meta.generalSources || []).map(function(s){
    return '<li><a href="' + esc(s.url) + '" target="_blank" rel="noopener">' + esc(s.label) + "</a></li>";
  }).join("");

  /* De links zitten als plaatshouders in de vertaling, zodat een vertaler de
     zin kan herschikken zonder de HTML aan te raken. */
  function bron(url, naam){
    return '<a href="' + url + '" target="_blank" rel="noopener">' + naam + "</a>";
  }
  document.getElementById("colofon").innerHTML = i18n("disclaimer.colofon", {
    datum: esc(fmtDate(DATA.meta.researchDate)),
    naturalEarth: bron("https://www.naturalearthdata.com/", "Natural Earth"),
    osrm: bron("https://project-osrm.org/", "OSRM"),
    osm: bron("https://www.openstreetmap.org/copyright", "OpenStreetMap"),
    nominatim: bron("https://nominatim.openstreetmap.org/", "Nominatim")
  });

  wire();
  switchView(VIEW, true);

  /* Had de actieve reis al een geometrie maar liepen borders/zones nog niet
     binnen, dan zijn de zones nu leeg — alsnog laden en opnieuw tekenen. */
  if(TRIP.route && TRIP.route.coordinates && !ZONES){
    laadGeoData().then(function(){
      herbereken(TRIP);
      render();
      herstelVerschraaldeRoute(TRIP);
    }).catch(function(){});
  } else {
    herstelVerschraaldeRoute(TRIP);
  }

  /* De planner heeft netwerk nodig en kan cities.json niet via file:// laden.
     Lukt dat niet, dan blijven de plaatsvelden verborgen en is handmatig
     landen kiezen de gewone weg — de wizard zegt dat ook. */
  if(location.protocol !== "file:"){
    loadJSON("cities.json").then(function(c){
      CITIES = c.cities || c;
      document.getElementById("planner").hidden = false;
      if(VIEW === "wizard") renderWizard(true);
    }).catch(function(){
      /* stil: de app werkt zonder */
    });
  }
}

/* Taal vóór het laden: showLoadError() draait als boot() nooit toekomt, en die
   moet ook al in de gekozen taal staan. */
TAAL = taalUitOpslag();
pasTaalToe();

loadData().then(function(d){
  if(d) boot(d); else showLoadError();
});

/* Service worker: maakt de app écht offline-bruikbaar op GitHub Pages of een eigen
   server. Vereist https of localhost — via file:// bestaat de API niet en valt de
   app terug op de localStorage-kopie hierboven. */
function offlineState(msg){
  var el = document.getElementById("offline-state");
  if(el) el.textContent = msg;
}
if("serviceWorker" in navigator && location.protocol !== "file:"){
  window.addEventListener("load", function(){
    navigator.serviceWorker.register("sw.js").then(function(){
      return navigator.serviceWorker.ready;
    }).then(function(){
      offlineState(i18n("offline.klaar"));
    }).catch(function(){
      offlineState(i18n("offline.nietBeschikbaar"));
    });
  });
} else if(location.protocol === "file:"){
  offlineState(i18n("offline.file"));
}
