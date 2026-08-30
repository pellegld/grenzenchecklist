"use strict";
/* Feiten, vertrouwen en boetekans.

   Twee vragen die de app tot nu toe niet beantwoordde en die een reiziger wél
   stelt:

     "Hoe zeker is dit eigenlijk allemaal?"
     "En wat kost het me als ik niets regel?"

   Allebei zijn ze te beantwoorden uit data die er al ligt. Elk feit in
   countries.json en zones.json draagt sinds fase A een stabiel `id` en een
   `confidence` (official / verified / uncertain / unavailable); de boetebedragen
   staan als `fineIndication` bij de milieuzone en het vignet.

   Wat dit bestand NIET doet: iets berekenen dat er niet staat. Een bedrag in
   Zwitserse frank wordt niet omgerekend — een wisselkoers is data die we niet
   hebben en die verandert. Een feit zonder bedrag telt niet mee in het totaal;
   het totaal zegt dan "of meer". Schijnprecisie is hier erger dan een open
   einde (§10, §13). */

/* ================= welke feiten draagt deze reis ================= */

/* Wat er per veld aan de gebruiker getoond wordt, in gewone taal. De sleutel is
   het middelste deel van het id (at.tollVignette -> tollVignette). */
function feitLabel(soort, feit, land){
  if(soort === "tollPoint" || soort === "zone") return feit.name || feit.city || "";
  if(soort === "equipment") return feit.item || "";
  if(soort === "quirk" || soort === "vehicleNote") return kortZin(quirkTekst(feit) || feit.text || "");
  return i18n("feit.soort." + soort);
}

function kortZin(t){
  t = String(t || "").trim();
  return t.length > 90 ? t.slice(0, 87).replace(/[\s,]+$/, "") + "…" : t;
}

function feit(soort, o, land){
  return {
    id: o.id || null,
    soort: soort,
    confidence: confidenceVan(o),
    label: feitLabel(soort, o, land),
    land: land || null,
    sourceUrl: o.sourceUrl || (land && land.sourceUrl) || null,
    lastVerified: o.lastVerified || (land && land.lastVerified) || null,
    verificationNote: o.verificationNote || null
  };
}

/* Alle feiten waar déze reis op rust. Bewust niet "alle feiten in de data":
   een tolpunt in Denemarken zegt niets over een rit naar Oostenrijk, en een
   voertuignotitie voor campers niet over een personenauto. Wat je niet ziet,
   telt niet mee in de teller eronder. */
function tripFeiten(trip){
  var uit = [];
  if(!trip || !DATA) return uit;

  /* Tolpunten alleen als de route er langs komt. */
  var puntenOpRoute = {};
  tripTolPunten(trip).forEach(function(o){ if(o.p.id) puntenOpRoute[o.p.id] = 1; });
  var heeftRoute = !!(trip.route && trip.route.coordinates);

  tripLanden(trip).forEach(function(code){
    var c = BY_CODE[code];
    if(!c) return;

    var z = c.environmentalZone;
    if(z){
      uit.push(feit("environmentalZone", z, c));
      if(z.emissionThreshold) uit.push(feit("emissionThreshold", z.emissionThreshold, c));
    }
    if(c.tollVignette) uit.push(feit("tollVignette", c.tollVignette, c));
    if(c.tollRoads) uit.push(feit("tollRoads", c.tollRoads, c));
    if(c.speedLimits) uit.push(feit("speedLimits", c.speedLimits, c));
    if(c.winterEquipment) uit.push(feit("winterEquipment", c.winterEquipment, c));

    /* Zonder berekende route weten we niet welke tolpunten je raakt; dan telt
       er geen enkele mee in plaats van allemaal. */
    (c.tollPoints || []).forEach(function(p){
      if(!heeftRoute || !puntenOpRoute[p.id]) return;
      uit.push(feit("tollPoint", p, c));
    });

    (c.mandatoryEquipment || []).forEach(function(it){ uit.push(feit("equipment", it, c)); });
    (c.quirks || []).forEach(function(q){
      if(typeof q === "string") return;   /* oude kopie zonder id: geen feit om te tellen */
      uit.push(feit("quirk", q, c));
    });
    vehicleNotesFor(c, trip).forEach(function(n){ uit.push(feit("vehicleNote", n, c)); });
  });

  /* Milieuzones op stadsniveau langs de route. */
  tripZones(trip).forEach(function(o){
    uit.push(feit("zone", o.zone, BY_CODE[o.zone.cc] || null));
  });

  return uit;
}

/* ================= de vertrouwensbalk ================= */

/* Telt de feiten per niveau en zoekt de zwakste schakel in de controledatum.

   Waarom de oudste datum en niet de nieuwste: "laatst gecontroleerd" moet een
   belofte zijn die voor de hele reis geldt. De nieuwste datum tonen terwijl één
   land al een jaar niet is nagekeken, is precies de schijnzekerheid die deze
   app moet vermijden. */
function vertrouwenTelling(trip){
  var feiten = tripFeiten(trip);
  var telling = { totaal:feiten.length, official:0, verified:0, uncertain:0, unavailable:0 };
  var oudste = null, onzeker = [];

  feiten.forEach(function(f){
    telling[f.confidence]++;
    if(f.confidence === "uncertain" || f.confidence === "unavailable") onzeker.push(f);
    if(f.lastVerified && (!oudste || f.lastVerified < oudste)) oudste = f.lastVerified;
  });

  telling.laatstGecontroleerd = oudste;
  telling.verouderd = oudste ? (daysSince(oudste) > STALE_DAYS) : false;
  telling.onzekereFeiten = onzeker;
  return telling;
}

/* ================= boetebedragen ================= */

/* Leest een bedrag in euro's uit een zin als "circa 80 tot 120 euro per
   passage" of "68 euro voor personenauto's, tot 135 euro voor zwaardere
   voertuigen".

   Alleen getallen die zelf aan een euro-aanduiding vastzitten tellen mee. Dat
   is met opzet streng: in "vanaf 3 maanden na een eerste overtreding tot 350
   euro" is de 3 een aantal maanden, en die als 3 euro meetellen zou de
   ondergrens onzin maken. Bedragen in frank, pond of kronen laten we hier
   staan — omrekenen zou een koers verzinnen. */
function euroBedragen(tekst){
  if(!tekst) return null;
  var s = String(tekst);
  var waarden = [];

  function voegToe(ruw){
    var n = leesGetal(ruw);
    if(n !== null && n > 0 && n < 100000) waarden.push(n);
  }

  /* Eerst bereiken ("80 tot 120 euro"), zodat de ondergrens niet verloren gaat:
     alleen het tweede getal draagt daar de eenheid. */
  var bereik = /(\d[\d.,]*)\s*(?:tot|t\/m|–|—|-)\s*(\d[\d.,]*)\s*(?:euro|EUR|€)/gi, m;
  while((m = bereik.exec(s))){ voegToe(m[1]); voegToe(m[2]); }

  var los = /(\d[\d.,]*)\s*(?:euro|EUR|€)|(?:€)\s*(\d[\d.,]*)/gi;
  while((m = los.exec(s))){ voegToe(m[1] || m[2]); }

  if(!waarden.length) return null;
  return { laag: Math.min.apply(null, waarden), hoog: Math.max.apply(null, waarden) };
}

/* "12,50" is twaalf en een half, "20.000" is twintigduizend. Nederlandse
   notatie, want zo staat het in de data. */
function leesGetal(ruw){
  var s = String(ruw || "").trim();
  if(/^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, "");
  else s = s.replace(/\.(?=\d{3}\b)/g, "").replace(",", ".");
  var n = Number(s);
  return isNaN(n) ? null : n;
}

/* Wat riskeer je als je niets regelt?

   Alleen over openstaande acties: wat je hebt afgevinkt is geen risico meer.
   Blokkades tellen mee — die zijn per definitie niet geregeld. Acties zonder
   bekend eurobedrag blijven buiten het totaal en zetten `ofMeer`, zodat er geen
   bedrag ontstaat dat lager is dan de werkelijkheid zonder dat je dat ziet. */
function boeteRisico(trip){
  var open = openActies(trip);
  var laag = 0, hoog = 0, metBedrag = 0, zonderBedrag = 0;
  var items = [];

  open.forEach(function(t){
    var bedrag = euroBedragen(t.fineIndication);
    if(bedrag){
      laag += bedrag.laag; hoog += bedrag.hoog; metBedrag++;
    } else if(t.fineIndication){
      /* Er staat wél een boete, maar niet in euro's (frank, pond, kronen) of
         niet als bedrag. Dat is iets anders dan "geen boete bekend", en de
         gebruiker mag dat verschil zien. */
      zonderBedrag++;
    } else {
      zonderBedrag++;
    }
    items.push({ actie:t, bedrag:bedrag });
  });

  return {
    laag: Math.round(laag), hoog: Math.round(hoog),
    metBedrag: metBedrag, zonderBedrag: zonderBedrag,
    ofMeer: zonderBedrag > 0,
    items: items,
    open: open.length
  };
}
