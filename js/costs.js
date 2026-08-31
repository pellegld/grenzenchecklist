"use strict";
/* Tol: het kasboekje per post en het retourtotaal. */

/* ================= tol onderweg (dormant tot Checklist/Tol-pagina) ================= */
function tolRegels(trip){
  var rijen = [];
  var sch = {};
  tolSchatting(trip).forEach(function(t){ sch[t.c.code] = t; });

  var punten = {};
  tripTolPunten(trip).forEach(function(o){
    if(o.p.optional) return;
    (punten[o.c.code] = punten[o.c.code] || []).push(o);
  });

  tripLanden(trip).forEach(function(code){
    var c = BY_CODE[code];
    if(!c) return;
    var had = false;

    var v = c.tollVignette || {};
    if(v.required){
      var naam = String(v.name || i18n("tol.vignetNaam")).split(/\s+[—-]\s+|,/)[0];
      rijen.push({ c:c, naam:c.name, detail:i18n("tol.vignetSnelweg", { naam:naam }),
                   zacht:i18n("tol.vignet") });
      had = true;
    }

    var t = sch[code];
    if(t){
      rijen.push({ c:c, naam:c.name,
        detail:i18n("tol.perKm", { km:Math.round(t.km), tarief:getal(t.c.tollRoads.perKm, { minimumFractionDigits:2, maximumFractionDigits:2 }) }),
        laag:t.laag, hoog:t.hoog, onzeker:t.onzeker });
      had = true;
    }

    (punten[code] || []).forEach(function(o){
      rijen.push({ c:c, naam:o.p.name,
        detail:o.p.note ? eersteZin(o.p.note) : i18n("tol.apartBetalen"),
        vast:(typeof o.p.priceEur === "number" ? o.p.priceEur : null),
        zacht:(typeof o.p.priceEur === "number" ? "" : i18n("tol.tariefOnbekend")),
        onzeker:!!o.p.needsVerification });
      had = true;
    });

    if(!had){
      if(tripAnalyse(trip)) rijen.push({ c:c, naam:c.name, detail:i18n("tol.geenTol"), vast:0 });
      else rijen.push({ c:c, naam:c.name, detail:i18n("tol.vulRouteIn"),
        zacht:i18n("tol.nogGeenRoute") });
    }
  });
  return rijen;
}

/* Notatie van de gekozen taal, en centen alleen als ze er zijn. */
function euroTekst(n){
  return n % 1 === 0
    ? getal(n)
    : getal(n, { minimumFractionDigits:2, maximumFractionDigits:2 });
}

function tolBedragHTML(r){
  if(r.zacht) return '<div class="bedrag zacht">' + esc(r.zacht) + "</div>";
  var tekst;
  if(typeof r.vast === "number") tekst = euroTekst(r.vast);
  else tekst = r.laag === r.hoog ? euroTekst(r.hoog) : euroTekst(r.laag) + "–" + euroTekst(r.hoog);
  return '<div class="bedrag">' + (r.onzeker ? '<span class="cur">~</span>' : "") +
    '<span class="cur">&euro;</span>' + tekst + "</div>";
}

/* ---------------- render: tolsamenvatting (bovenkant, retour) ---------------- */
function tolTotaalRetour(trip){
  if(!tripAnalyse(trip)) return null;
  var enkel = 0, zeker = true;

  tolSchatting(trip).forEach(function(t){
    enkel += t.hoog;
    if(t.onzeker) zeker = false;
  });
  tripTolPunten(trip).forEach(function(o){
    if(o.p.optional) return;
    if(typeof o.p.priceEur === "number") enkel += o.p.priceEur;
    else zeker = false;
  });
  tripLanden(trip).forEach(function(code){
    var c = BY_CODE[code];
    if(c && (c.tollVignette || {}).required) zeker = false;
  });

  if(!enkel) return null;
  return { bedrag: Math.round(enkel * 2), zeker: zeker };
}

/* ================= §10: het volledige kostenoverzicht =================

   Vier categorieën — tol, vignetten, milieuzones, brandstof — en bij elke post
   staat wat we van het bedrag weten. Dat laatste is de kern van deze pagina.
   Een totaal zonder die aanduiding is een gok met een euroteken ervoor.

   bevestigd   een eurobedrag dat als getal in de data staat en gecontroleerd
               is. Telt mee.
   indicatief  een schatting: een tarief per kilometer, een bedrag dat in de
               bron met "circa" staat, of jouw eigen verbruik maal jouw eigen
               prijs. Telt mee, met een bandbreedte waar die er is.
   onbekend    de post geldt voor jou, maar de data noemt geen bedrag dat we
               durven optellen. Telt niet mee en zet "of meer" achter het
               totaal: het echte bedrag ligt hoger, en dat hoor je te zien.
   nietmee     de post is een keuze (de autotrein) of hangt van gedrag af (de
               dagheffing die je alleen betaalt als je de zone in rijdt). Telt
               niet mee en zet géén "of meer" — het is geen kost die je
               overkomt.

   Bedragen komen uitsluitend uit velden die over geld gaan: `priceEur`,
   `tollRoads.perKm` en de brontekst van `howToGet`. Nadrukkelijk niet uit
   `note`. Daar staan de uitzonderingen en de boetes, en een boete van 750 euro
   die als vignetprijs in het totaal belandt is precies de schijnprecisie die
   §10 verbiedt.

   Afstandgebonden posten — kilometertol, tolpunten, brandstof — tellen dubbel:
   je rijdt heen en terug. Een vignet of een sticker koop je één keer. */

var KOSTEN_MEETELLEN = { bevestigd:1, indicatief:1 };

/* De eerste naam uit een veld dat soms een hele uitleg is: "Autobahnvignette -
   sticker of e-vignette" wordt "Autobahnvignette". */
function kortNaam(naam, terugval){
  return String(naam || terugval || "").split(/\s+[—–-]\s+|,/)[0] || terugval || "";
}

function bereikTekst(b){
  return b.laag === b.hoog
    ? "€" + euroTekst(b.laag)
    : "€" + euroTekst(b.laag) + "–€" + euroTekst(b.hoog);
}

/* ---------------- tol ---------------- */
function kostenTol(trip){
  var posten = [];

  tolSchatting(trip).forEach(function(t){
    posten.push({
      c:t.c, naam:t.c.name,
      detail:i18n("tol.perKm", {
        km: Math.round(t.km),
        tarief: getal(t.c.tollRoads.perKm, { minimumFractionDigits:2, maximumFractionDigits:2 })
      }) + " · " + i18n("kosten.heenTerug"),
      laag: t.laag * 2, hoog: t.hoog * 2,
      zekerheid: "indicatief",
      bron: herkomstVan(t.c.tollRoads, t.c)
    });
  });

  tripTolPunten(trip).forEach(function(o){
    var p = o.p;
    if(p.optional){
      posten.push({ c:o.c, naam:p.name, detail:i18n("kosten.autotreinKort"),
        laag:0, hoog:0, zekerheid:"nietmee", bron:herkomstVan(p, o.c) });
      return;
    }
    if(typeof p.priceEur === "number"){
      posten.push({ c:o.c, naam:p.name,
        detail:i18n("kosten.perDoorgang", { bedrag:"€" + euroTekst(p.priceEur) }) +
               " · " + i18n("kosten.heenTerug"),
        laag:p.priceEur * 2, hoog:p.priceEur * 2,
        zekerheid: p.needsVerification ? "indicatief" : "bevestigd",
        bron:herkomstVan(p, o.c) });
      return;
    }
    posten.push({ c:o.c, naam:p.name, detail:i18n("tol.tariefOnbekend"),
      laag:0, hoog:0, zekerheid:"onbekend", bron:herkomstVan(p, o.c) });
  });

  return posten;
}

/* ---------------- vignetten ----------------
   Altijd "onbekend", en dat is geen luiheid: een vignet kost wat past bij hoe
   lang je blijft, en welke termijn jij nodig hebt volgt niet uit een vertrek-
   en een retourdatum alleen — de geldigheidsstaffels staan niet in de data. Wat
   de bron wél noemt komt erbij te staan, zodat je zelf ziet in welke orde van
   grootte je zit. */
function kostenVignetten(trip){
  var posten = [];
  tripLanden(trip).forEach(function(code){
    var c = BY_CODE[code], v = c.tollVignette || {};
    if(!v.required) return;
    var b = euroBedragen(v.howToGet);
    posten.push({
      c:c, naam:kortNaam(v.name, i18n("tol.vignetNaam")),
      detail: b ? i18n("kosten.bronNoemt", { bereik:bereikTekst(b) })
                : i18n("kosten.vignetGeenBedrag"),
      laag:0, hoog:0, zekerheid:"onbekend", bron:herkomstVan(v, c)
    });
  });
  return posten;
}

/* ---------------- milieuzones ----------------
   Alleen wanneer deze zone voor dit voertuig een handeling vraagt. Een zone
   waar je gewoon in mag kost niets, en een lege regel met een nul erachter is
   ruis. */
function kostenZones(trip){
  var posten = [];
  tripLanden(trip).forEach(function(code){
    var c = BY_CODE[code], z = c.environmentalZone || {};
    var actie = zoneAction(c, trip);
    if(!actie) return;

    var b = euroBedragen(z.howToGet);
    posten.push({
      c:c, naam:kortNaam(z.name, c.name),
      detail: b ? i18n("kosten.zoneCirca", { actie:actieTekst(actie) })
                : i18n("kosten.zoneGeenBedrag", { actie:actieTekst(actie) }),
      laag: b ? b.laag : 0, hoog: b ? b.hoog : 0,
      zekerheid: b ? "indicatief" : "onbekend",
      bron: herkomstVan(z, c)
    });
  });
  return posten;
}

/* ---------------- brandstof ----------------
   Twee getallen die alleen jij weet. Zonder allebei rekent de app niets uit en
   zegt dat: een gemiddeld verbruik verzinnen zou van deze post de minst
   betrouwbare van de vier maken, en tegelijk de grootste.

   Mét allebei is het een rechttoe rechtaan vermenigvuldiging, geen model — de
   uitkomst staat er daarom met de hele som erbij, zodat je ziet waar hij
   vandaan komt. Toch "indicatief" en niet "bevestigd": het echte verbruik
   hangt af van bagage, bergen en tegenwind, en de prijs van de dag en het
   land. */
function kostenBrandstof(trip){
  var v = trip.vehicle;
  var km = tripAfstandKm(trip);
  var naam = i18n("kosten.brandstof");

  if(!km){
    return [{ c:null, naam:naam, detail:i18n("kosten.brandstofGeenRoute"),
      laag:0, hoog:0, zekerheid:"nietmee", bron:null }];
  }
  if(!v.verbruik || !v.brandstofPrijs){
    return [{ c:null, naam:naam, detail:i18n("kosten.brandstofVulIn"),
      laag:0, hoog:0, zekerheid:"nietmee", bron:null }];
  }

  var totaalKm = Math.round(km) * 2;
  var liters = totaalKm * v.verbruik / 100;
  var bedrag = liters * v.brandstofPrijs;
  return [{
    c:null, naam:naam,
    detail:i18n("kosten.brandstofSom", {
      km: getal(totaalKm),
      verbruik: getal(v.verbruik, { minimumFractionDigits:1, maximumFractionDigits:1 }),
      liters: getal(Math.round(liters)),
      prijs: getal(v.brandstofPrijs, { minimumFractionDigits:2, maximumFractionDigits:2 })
    }),
    laag: Math.round(bedrag), hoog: Math.round(bedrag),
    zekerheid: "indicatief", bron: null
  }];
}

/* ---------------- het geheel ---------------- */
function kostenOverzicht(trip){
  var categorieen = [
    { sleutel:"tol",         posten: kostenTol(trip) },
    { sleutel:"vignetten",   posten: kostenVignetten(trip) },
    { sleutel:"milieuzones", posten: kostenZones(trip) },
    { sleutel:"brandstof",   posten: kostenBrandstof(trip) }
  ];

  var laag = 0, hoog = 0, ofMeer = false, meegeteld = 0;

  categorieen.forEach(function(cat){
    cat.laag = 0; cat.hoog = 0; cat.ofMeer = false;
    cat.posten.forEach(function(p){
      if(KOSTEN_MEETELLEN[p.zekerheid]){
        cat.laag += p.laag; cat.hoog += p.hoog; meegeteld++;
      } else if(p.zekerheid === "onbekend"){
        cat.ofMeer = true;
      }
    });
    cat.laag = Math.round(cat.laag); cat.hoog = Math.round(cat.hoog);
    laag += cat.laag; hoog += cat.hoog;
    if(cat.ofMeer) ofMeer = true;
  });

  return { categorieen:categorieen, laag:Math.round(laag), hoog:Math.round(hoog),
           ofMeer:ofMeer, meegeteld:meegeteld };
}

/* Het bedrag bovenaan, en op het dashboard. Eén getal als de boven- en
   ondergrens gelijk zijn, anders een bandbreedte — nooit een gemiddelde van
   die twee, want dat suggereert een precisie die er niet is. */
function kostenTotaalHTML(k){
  if(!k.meegeteld) return "";
  var tekst = k.laag === k.hoog
    ? "€" + euroTekst(k.hoog)
    : "€" + euroTekst(k.laag) + "–€" + euroTekst(k.hoog);
  return tekst + (k.ofMeer ? ' <small>' + esc(i18n("planner.ofMeer")) + "</small>" : "");
}

/* ================= Kostenpagina (§10) =================

   Bovenaan het bedrag, daaronder waar het vandaan komt, en onderaan wat er
   niet in zit. In die volgorde, want de vraag is "wat kost dit ongeveer" en
   niet "welke posten kent de app".

   De zekerheid staat bij élke post, met een woord en een eigen teken — nooit
   alleen met kleur (§21). Wie de pagina zwart-wit uitprint of geen kleur
   onderscheidt moet hetzelfde kunnen lezen als iedereen. */

var KOSTEN_TEKEN = { bevestigd:"✓", indicatief:"~", onbekend:"?", nietmee:"—" };

function kostenChipHTML(zekerheid){
  return '<span class="zeker z-' + esc(zekerheid) + '">' +
    '<span class="zteken" aria-hidden="true">' + KOSTEN_TEKEN[zekerheid] + "</span>" +
    esc(i18n("kosten.zeker." + zekerheid)) + "</span>";
}

function kostenBedragHTML(p){
  if(!KOSTEN_MEETELLEN[p.zekerheid]){
    return '<div class="bedrag zacht">' + esc(i18n("kosten.geenBedrag")) + "</div>";
  }
  var tekst = p.laag === p.hoog
    ? euroTekst(Math.round(p.hoog))
    : euroTekst(Math.round(p.laag)) + "–" + euroTekst(Math.round(p.hoog));
  return '<div class="bedrag">' +
    (p.zekerheid === "indicatief" ? '<span class="cur">~</span>' : "") +
    '<span class="cur">&euro;</span>' + tekst + "</div>";
}

function kostenPostHTML(p){
  return '<li class="kostenrij">' +
    (p.c ? flagHTML(p.c) : '<span class="geenvlag" aria-hidden="true"></span>') +
    '<div class="kostentekst">' +
      '<span class="wat">' + esc(p.naam) + "</span>" +
      '<span class="waarom">' + esc(p.detail) + "</span>" +
      '<span class="kostenbron">' + kostenChipHTML(p.zekerheid) +
        (p.bron ? herkomstRegelHTML({ bron:p.bron }) : "") + "</span>" +
    "</div>" +
    kostenBedragHTML(p) + "</li>";
}

function kostenCategorieHTML(cat){
  if(!cat.posten.length) return "";
  var subtotaal = cat.laag || cat.hoog
    ? '<p class="katsub">' + esc(i18n("kosten.subtotaal")) + " <b>&euro;" +
      (cat.laag === cat.hoog ? euroTekst(cat.hoog)
                             : euroTekst(cat.laag) + "–&euro;" + euroTekst(cat.hoog)) +
      (cat.ofMeer ? " " + esc(i18n("planner.ofMeer")) : "") + "</b></p>"
    : "";
  return '<section class="dashkaart kostenkat">' +
    "<h2>" + esc(i18n("kosten.kat." + cat.sleutel)) + "</h2>" +
    '<p class="hint">' + esc(i18n("kosten.kat." + cat.sleutel + ".uitleg")) + "</p>" +
    '<ul class="kostenlijst">' + cat.posten.map(kostenPostHTML).join("") + "</ul>" +
    subtotaal +
  "</section>";
}

/* De twee optionele velden uit §10. Ze staan onderaan en niet bovenaan: het
   overzicht moet iets waard zijn zonder dat je eerst iets invult.

   De waarde komt er in de notatie van de gekozen taal in te staan. Wie op een
   Nederlands toetsenbord 6,2 typt, hoort daar geen 6.2 van te zien zodra hij
   het volgende veld aanraakt; het getal in de reis is hetzelfde. */
function veldGetal(n){
  return n == null ? "" : getal(n, { maximumFractionDigits:2 });
}

function brandstofFormHTML(trip){
  var v = trip.vehicle;
  return '<section class="dashkaart brandstofkaart">' +
    "<h2>" + esc(i18n("kosten.brandstofKop")) + "</h2>" +
    '<p class="hint">' + esc(i18n("kosten.brandstofUitleg")) + "</p>" +
    '<div class="wizveld raster">' +
      '<label class="field"><span>' + esc(i18n("kosten.verbruikLabel")) + "</span>" +
        '<input type="text" inputmode="decimal" id="kosten-verbruik" autocomplete="off"' +
        ' placeholder="6,2" value="' + esc(veldGetal(v.verbruik)) + '"></label>' +
      '<label class="field"><span>' + esc(i18n("kosten.prijsLabel")) + "</span>" +
        '<input type="text" inputmode="decimal" id="kosten-prijs" autocomplete="off"' +
        ' placeholder="1,78" value="' + esc(veldGetal(v.brandstofPrijs)) + '"></label>' +
    "</div>" +
    '<p class="hint">' + esc(i18n("kosten.brandstofPrivacy")) + "</p>" +
  "</section>";
}

/* Wat er niet in het totaal zit, met de reden erbij. Dit is de belangrijkste
   lijst op de pagina: een bedrag zonder deze lijst belooft volledigheid die
   het niet heeft. */
function kostenNietMeeHTML(k){
  var regels = [];
  k.categorieen.forEach(function(cat){
    cat.posten.forEach(function(p){
      if(KOSTEN_MEETELLEN[p.zekerheid]) return;
      regels.push({ p:p, cat:cat });
    });
  });
  if(!regels.length) return "";
  return '<section class="dashkaart nietmee">' +
    "<h2>" + esc(i18n("kosten.nietMeegerekend")) + "</h2>" +
    "<ul>" + regels.map(function(r){
      return "<li>" + kostenChipHTML(r.p.zekerheid) +
        "<b>" + esc(r.p.naam) + "</b> — " + esc(r.p.detail) + "</li>";
    }).join("") + "</ul>" +
    '<p class="hint">' + esc(i18n(k.meegeteld ? "kosten.nietMeeUitleg"
                                             : "kosten.nietMeeGeenTotaal")) + "</p>" +
  "</section>";
}

function renderKosten(){
  var wrap = document.getElementById("kosten-wrap");
  if(!wrap || !TRIP || !DATA) return;

  if(!tripIsKlaar(TRIP)){
    wrap.innerHTML = '<div class="leegstaat">' + iconUse("payments").replace('class="icon sm"', 'class="icon lg"') +
      "<h1>" + esc(i18n("kosten.leegKop")) + "</h1>" +
      "<p>" + esc(i18n("kosten.leegTekst")) + "</p>" +
      '<button type="button" class="btn primary" data-view="wizard">' + esc(i18n("home.cta")) + "</button></div>";
    return;
  }

  var k = kostenOverzicht(TRIP);
  var totaal = kostenTotaalHTML(k);

  var kop =
    '<section class="kostenkop">' +
      "<h1>" + esc(i18n("kosten.kop")) + "</h1>" +
      (totaal
        ? '<p class="kostenlabel">' + esc(i18n("kosten.geschat")) + "</p>" +
          '<p class="kostenbedrag">' + totaal + "</p>"
        : '<p class="kostenlabel">' + esc(i18n("kosten.geenBedragTotaal")) + "</p>") +
      '<p class="lead">' + esc(i18n("kosten.intro")) + "</p>" +
    "</section>";

  wrap.innerHTML = kop +
    '<div class="kostengrid">' +
      k.categorieen.map(kostenCategorieHTML).join("") +
      brandstofFormHTML(TRIP) +
      tankstrategieHTML(TRIP) +
      kostenNietMeeHTML(k) +
    "</div>";
}

/* De twee velden schrijven rechtstreeks in de reis, net als de wizard. Op
   `input` en niet op `change`: het bedrag hoort mee te bewegen terwijl je typt,
   anders lijkt het veld niets te doen.

   Daarna wordt de hele pagina opnieuw getekend en gaat de cursor terug waar hij
   stond. Dat is goedkoop — het is wat rekenwerk over een handvol posten — en
   het houdt alles kloppend: het totaal, het subtotaal van de categorie én de
   lijst met wat er niet in zit, waar brandstof uit verdwijnt zodra je hem wél
   kunt uitrekenen. Alleen het bedrag bijwerken zou die laatste twee laten
   liegen. */
function wireKosten(){
  var wrap = document.getElementById("kosten-wrap");
  if(!wrap) return;
  wrap.addEventListener("input", function(e){
    var veld = e.target;
    if(veld.id !== "kosten-verbruik" && veld.id !== "kosten-prijs") return;
    if(!TRIP) return;

    if(veld.id === "kosten-verbruik") TRIP.vehicle.verbruik = getalOfNull(veld.value);
    else TRIP.vehicle.brandstofPrijs = getalOfNull(veld.value);
    bewaarTrip(TRIP);

    var id = veld.id, tekst = veld.value, pos = veld.selectionStart;
    renderKosten();
    var opnieuw = document.getElementById(id);
    if(opnieuw){
      opnieuw.value = tekst;          /* "6," is nog geen getal, maar wel wat je typte */
      opnieuw.focus();
      try{ opnieuw.setSelectionRange(pos, pos); }catch(err){}
    }
  });
}
