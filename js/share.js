"use strict";
/* De deelbare reis (§12).

   Geen account, geen server, geen link die na een week dood is: de hele reis
   zit ín de URL. Wie hem opent heeft de reis, ook over een jaar, ook als deze
   app dan op een ander adres staat.

   Wat er meegaat is wat je hebt ingevuld — vertrek, bestemming, data, voertuig,
   landen en je vinkjes. Wat er niet meegaat is de routegeometrie: die is
   duizenden coördinaten groot en volledig af te leiden uit de twee plaatsen.
   De ontvanger laat hem opnieuw berekenen. Lukt dat niet, dan blijft de
   meegestuurde landenlijst over en werkt de checklist gewoon — dezelfde
   terugval als bij een uitgevallen routeprovider (§20).

   De sleutels zijn één letter lang. Niet uit zuinigheid maar omdat een link die
   over de rand van een chatvenster loopt niet meer gekopieerd wordt; `s` is het
   versienummer van dit formaat, zodat een oudere link over vijf jaar nog te
   herkennen is.

   Alles wat hier binnenkomt is invoer van buiten, ook als het uit een link van
   een vriend komt. Elk veld wordt daarom op vorm gecontroleerd voordat het in
   een reis belandt: landcodes tegen de data, datums tegen een patroon, getallen
   tegen een bereik, teksten op lengte. */

var DEEL_PARAM = "reis";
var DEEL_VERSIE = 1;
var DEEL_MAX_TEKST = 80;

/* ---------------- inpakken ---------------- */

function plaatsKort(p){
  if(!p) return null;
  return [String(p.naam || "").slice(0, DEEL_MAX_TEKST), p.land || "",
          Math.round(p.lat * 10000) / 10000, Math.round(p.lon * 10000) / 10000];
}

function plaatsLang(rij){
  if(!Array.isArray(rij) || rij.length < 4) return null;
  var lat = Number(rij[2]), lon = Number(rij[3]);
  if(!isFinite(lat) || !isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) return null;
  var naam = String(rij[0] || "").slice(0, DEEL_MAX_TEKST);
  if(!naam) return null;
  return { naam:naam, omschrijving:naam, land:String(rij[1] || "").slice(0, 2), lat:lat, lon:lon };
}

function deelPayload(trip){
  var v = trip.vehicle;
  return {
    s: DEEL_VERSIE,
    /* Een zelfgekozen naam gaat mee; een afgeleide niet — die leidt de ontvanger
       zelf af uit dezelfde twee plaatsen. */
    n: trip.metadata.naamAutomatisch ? null : String(trip.naam || "").slice(0, DEEL_MAX_TEKST),
    o: plaatsKort(trip.origin),
    d: plaatsKort(trip.destination),
    vd: trip.departureDate || null,
    rd: trip.returnDate || null,
    a: [v.plateCountry, v.fuel, v.euro, v.type, v.gewichtKg, v.hoogteM,
        v.verbruik, v.brandstofPrijs],
    l: (trip.countries || []).slice(0, 40),
    t: Object.keys(trip.ticked || {}).filter(function(k){ return trip.ticked[k]; }).slice(0, 200)
  };
}

/* base64 met een URL-veilig alfabet. btoa slikt geen tekens boven 255, en een
   plaatsnaam als "Genève" heeft die wel — vandaar de omweg via UTF-8. */
function naarBase64(tekst){
  var bytes = unescape(encodeURIComponent(tekst));
  return btoa(bytes).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function uitBase64(code){
  var b64 = String(code).replace(/-/g, "+").replace(/_/g, "/");
  while(b64.length % 4) b64 += "=";
  return decodeURIComponent(escape(atob(b64)));
}

function deelURL(trip){
  var code = naarBase64(JSON.stringify(deelPayload(trip)));
  var basis = location.origin === "null"
    ? location.href.split("?")[0].split("#")[0]        /* file:// heeft geen origin */
    : location.origin + location.pathname;
  return basis + "?" + DEEL_PARAM + "=" + code;
}

/* ---------------- uitpakken ---------------- */

function schoonDatum(d){
  return /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : null;
}

function schoonUitLijst(waarde, toegestaan, terugval){
  return toegestaan.indexOf(waarde) === -1 ? terugval : waarde;
}

function schoonGetal(n, min, max){
  var g = Number(n);
  return isFinite(g) && g >= min && g <= max ? g : null;
}

function tripUitPayload(raw){
  if(!raw || raw.s !== DEEL_VERSIE) return null;

  var t = legeTrip();
  var a = Array.isArray(raw.a) ? raw.a : [];

  t.origin = plaatsLang(raw.o);
  t.destination = plaatsLang(raw.d);
  t.departureDate = schoonDatum(raw.vd) || vandaagISO();
  t.returnDate = schoonDatum(raw.rd);

  t.vehicle = {
    plateCountry: BY_CODE[a[0]] ? a[0] : "NL",
    fuel: schoonUitLijst(a[1], ["petrol", "diesel", "hybride", "ev"], "petrol"),
    euro: schoonGetal(a[2], 1, 6),
    type: schoonUitLijst(a[3], ["auto", "camper", "aanhanger", "caravan"], "auto"),
    gewichtKg: schoonGetal(a[4], 1, 100000),
    hoogteM: schoonGetal(a[5], 0.5, 10),
    verbruik: schoonGetal(a[6], 0.1, 100),
    brandstofPrijs: schoonGetal(a[7], 0.01, 100)
  };

  t.countries = (Array.isArray(raw.l) ? raw.l : [])
    .filter(function(code){ return BY_CODE[code]; }).slice(0, 40);

  t.ticked = {};
  (Array.isArray(raw.t) ? raw.t : []).slice(0, 200).forEach(function(k){
    if(typeof k === "string" && k.length < 120) t.ticked[k] = 1;
  });

  if(typeof raw.n === "string" && raw.n.trim()){
    t.naam = raw.n.trim().slice(0, DEEL_MAX_TEKST);
    t.metadata.naamAutomatisch = false;
  }
  t.metadata.geanalyseerd = !!t.countries.length;
  t.metadata.handmatig = !!t.countries.length;
  t.metadata.stap = t.countries.length ? 4 : 1;

  if(!t.origin && !t.destination && !t.countries.length) return null;
  return t;
}

/* De link uit de adresbalk lezen, en hem daarna wegpoetsen. Dat laatste is geen
   cosmetiek: zonder dat maakt elke herlaadbeurt er nóg een reis bij. */
function leesDeelLink(){
  var m = (location.search || "").match(new RegExp("[?&]" + DEEL_PARAM + "=([^&]+)"));
  if(!m) return null;
  var payload = null;
  try { payload = JSON.parse(uitBase64(decodeURIComponent(m[1]))); }
  catch(e){ payload = null; }
  wisDeelLink();
  return payload;
}

function wisDeelLink(){
  if(!history.replaceState) return;
  var schoon = location.pathname + location.hash;
  try { history.replaceState(null, "", schoon || "."); } catch(e){}
}

var DEEL_MELDING = false;

/* Een gedeelde reis komt er altijd bíj. Hem over de actieve heen zetten zou
   betekenen dat één klik op een link in een groepsapp het werk van iemand
   anders wist — en die reis staat alleen in zijn eigen browser, dus dat is
   onherstelbaar. */
function importeerGedeeldeReis(payload){
  var t = tripUitPayload(payload);
  if(!t) return false;
  DEEL_MELDING = true;

  TRIPS.push(t);
  TRIP = t;
  ACTIVE_TRIP_ID = t.id;
  lsSet(STORE_ACTIVE, t.id);
  bewaarTrips();

  /* Met twee plaatsen kan de route opnieuw berekend worden, en dan werken de
     kaart, de kilometertol en de afstand net zo goed als bij de afzender. Lukt
     het niet, dan blijft de meegestuurde landenlijst staan. */
  if(t.origin && t.destination){
    berekenRoute(t).then(function(){
      bewaarTrip();
      render();
    }).catch(function(){
      herbereken(t);
      render();
    });
  }
  return true;
}

/* ---------------- delen ---------------- */

/* Drie manieren, in aflopende volgorde van comfort: het deelvenster van het
   apparaat, het klembord, en anders een tekstvak waaruit je met de hand
   kopieert. Die laatste is dezelfde dialoog als bij een correctiemelding, want
   het probleem is hetzelfde: tekst overbrengen zonder klembord-API. */
function deelReis(knop){
  if(!TRIP) return;
  var url = deelURL(TRIP);
  var titel = TRIP.naam;

  function gelukt(sleutel){
    if(!knop) return;
    var oud = knop.getAttribute("data-oud") || knop.textContent;
    knop.setAttribute("data-oud", oud);
    knop.textContent = i18n(sleutel);
    setTimeout(function(){ knop.textContent = oud; }, 4000);
  }

  function klembord(){
    if(navigator.clipboard && navigator.clipboard.writeText){
      navigator.clipboard.writeText(url).then(function(){ gelukt("deel.gekopieerd"); },
                                             function(){ toonMelding(url); });
    } else {
      toonMelding(url);
    }
  }

  if(navigator.share){
    navigator.share({ title:titel, text:i18n("deel.tekst", { naam:titel }), url:url })
      .then(function(){ gelukt("deel.gedeeld"); })
      .catch(function(err){
        /* Afbreken is geen fout: wie het deelvenster wegklikt wil niet alsnog
           iets op zijn klembord vinden. */
        if(err && err.name === "AbortError") return;
        klembord();
      });
    return;
  }
  klembord();
}

/* Eén regel, één keer, boven het dashboard: er is zojuist een reis bijgekomen
   en dat hoor je te weten. Daarna verdwijnt hij — een melding die bij elke
   herlaadbeurt terugkomt is geen melding maar meubilair. */
function deelMeldingHTML(){
  if(!DEEL_MELDING) return "";
  DEEL_MELDING = false;
  return '<p class="deelmelding">' + iconUse("share") + " " +
    esc(i18n("deel.ontvangen")) + "</p>";
}

function deelKnopHTML(){
  return '<button type="button" class="tekstknop deelknop" id="btn-deel">' +
    iconUse("share") + " " + esc(i18n("deel.knop")) + "</button>";
}
