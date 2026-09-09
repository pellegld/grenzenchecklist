"use strict";
/* De actielijst — §7 en §8 van de masterprompt.

   Eén lijst met alles wat deze reiziger moet doen, uit vier bronnen die
   voorheen los van elkaar op het scherm stonden: de documenten (`DOC_ITEMS`),
   de uitrusting per land (`buildGroups`), de afgeleide regeltaken zoals
   vignetten en milieustickers (`buildTasks`) en de voertuignotities. Die vier
   producenten blijven waar ze staan; dit bestand maakt er één model van.

   Waarom één lijst: de gebruiker heeft geen drie categorieën taken, hij heeft
   één avond vóór vertrek. De vraag is niet "welk soort taak is dit" maar "wat
   moet ik eerst doen en wanneer uiterlijk".

   Elke actie draagt (§7):

     id            stabiel, gelijk aan het feit-id waar hij op rust
     tickKey       de sleutel in trip.ticked — ongewijzigd t.o.v. de oude app,
                   zodat afgevinkte reizen niet leeglopen
     landen        0..n landen waar hij vandaan komt
     status        blokkade | actie | waarschuwing | ok | onbekend
     prioriteit    eerst | voorVertrek | inDeAuto | aanbevolen | letop | nietVoorJou
     wat, uitleg   wat je moet doen, en waarom het bestaat
     waarom        waarom hij op DEZE reis staat — afgeleid, zie actieWaarom()
     deadline      null of { iso, dagen, urgentie } — zie DEADLINES
     bron          { factId, confidence, sourceUrl, lastVerified, verificationNote }
     prijs         null of { bedrag, vanaf } — alleen als het in de data staat
     boete         de fineIndication-tekst, of null
*/

/* ================= deadlines (§8) =================

   Belangrijk: dit zijn **richttijden van de app**, geen wettelijke termijnen.
   Ze zeggen hoeveel voorbereiding iets kost, niet wanneer de wet iets eist. De
   UI zegt dat er ook bij; een deadline die eruitziet als een regel terwijl hij
   een schatting is, is precies de schijnzekerheid die deze app moet vermijden.

   Waar de tijd wél ergens op stoelt, staat de bron in het commentaar. */
var DEADLINES = {
  /* De Crit'Air-sticker komt per post: "levering naar het buitenland duurt al
     snel een tot twee weken" (fr.environmentalZone.howToGet). Twee weken is de
     bovenkant daarvan. Ook de Duitse Umweltplakette kun je online bestellen. */
  "zone.sticker": 14,
  /* Registreren gaat online en is meestal meteen rond, maar niet elke gemeente
     verwerkt dezelfde dag. */
  "zone.registratie": 2,
  /* Betalen kan bij de meeste zones ook nog kort na de rit (ULEZ: tot de
     volgende dag), dus dit hoeft niet vooraf. */
  "zone.betaling": 0,
  /* Een vignet koop je aan de grens of bij het eerste tankstation. */
  "vignet": 1,
  /* Winterbanden of kettingen moet je halen, en in het seizoen zijn ze op. */
  "winter": 7,
  /* Een verlopen rijbewijs of paspoort vervangen kost bij de gemeente een week
     of langer. */
  "document": 14,
  /* Flitsmeldingen uitzetten en de dashcam eruit halen kan op de oprit. */
  "apparatuur": 0
};

/* Uitzondering met een harde grond in de data zelf: bij online aankoop van het
   Oostenrijkse vignet geldt een wettelijke bedenktijd van 18 dagen voordat het
   ingaat (at.tollVignette.howToGet). Wie later koopt, moet het ter plaatse
   halen — en dat is precies wat de melding zegt. */
var DEADLINE_HARD = { "at.tollVignette": 18 };

function dagenTussen(vanISO, totISO){
  var a = Date.parse(vanISO + "T12:00:00"), b = Date.parse(totISO + "T12:00:00");
  if(isNaN(a) || isNaN(b)) return null;
  return Math.round((b - a) / 86400000);
}

function isoPlus(iso, dagen){
  var d = new Date(iso + "T12:00:00");
  if(isNaN(d.getTime())) return null;
  d.setDate(d.getDate() + dagen);
  return d.toISOString().slice(0, 10);
}

/* Levert null als er niets te rekenen valt: geen vertrekdatum, geen richttijd,
   of een reis die al geweest is. Een deadline voor gisteren is geen deadline. */
function deadlineVoor(soort, factId, trip){
  var vertrek = trip && trip.departureDate;
  if(!vertrek) return null;

  var dagenVoor = DEADLINE_HARD[factId];
  if(dagenVoor === undefined) dagenVoor = DEADLINES[soort];
  if(dagenVoor === undefined) return null;

  var vandaag = vandaagISO();
  if(dagenTussen(vandaag, vertrek) < 0) return null;   /* de reis is geweest */

  var iso = isoPlus(vertrek, -dagenVoor);
  var dagen = dagenTussen(vandaag, iso);
  var urgentie = dagen < 0 ? "verstreken" : dagen === 0 ? "vandaag" : dagen <= 3 ? "bijna" : "later";
  return { iso: iso, dagen: dagen, urgentie: urgentie,
           hard: DEADLINE_HARD[factId] !== undefined };
}

function deadlineTekst(d){
  if(!d) return "";
  if(d.urgentie === "verstreken") return i18n("deadline.verstreken");
  if(d.urgentie === "vandaag") return i18n("deadline.vandaag");
  return i18n("deadline.uiterlijk", { datum: fmtDate(d.iso) });
}

/* ================= prijzen =================

   Alleen wat er staat. `howToGet` en `note` bevatten bij een paar landen een
   indicatief tarief ("circa 3,11 euro", "week circa 16 euro, maand circa 32
   euro"); meer dan één bedrag betekent dat het van de duur of de categorie
   afhangt, en dan is "vanaf" het enige eerlijke woord. Staat er geen bedrag,
   dan staat er geen bedrag — dan doet de link naar de officiële bron het werk. */
function prijsUitFeit(feit){
  if(!feit) return null;
  var bedragen = euroBedragen([feit.howToGet, feit.note].filter(Boolean).join(" "));
  if(!bedragen) return null;
  return { bedrag: bedragen.laag, vanaf: bedragen.hoog !== bedragen.laag };
}

/* ================= waarom zie ik dit? =================

   Afgeleid uit de route-analyse en het voertuigprofiel, nooit uit een tekst per
   item. Dat is het verschil tussen "dit geldt in Slovenië" (dat wist je al) en
   "je route loopt 63 km door Slovenië" (daarom staat het hier).

   De zinnen staan heel in de vertaaltabel met plaatshouders; ze worden hier
   gekozen, niet aan elkaar geplakt uit losse woorden. */
function landReden(c, trip){
  if(!c) return null;
  var res = tripAnalyse(trip);
  var km = res && res.km ? res.km[c.code] : null;
  if(km != null && km >= 1) return i18n("waarom.km", { km: getal(Math.round(km)), land: c.name });
  if(km != null) return i18n("waarom.kmKort", { land: c.name });
  return i18n("waarom.handmatig", { land: c.name });
}

function landenReden(landen, trip){
  if(!landen || !landen.length) return null;
  if(landen.length === 1) return landReden(landen[0], trip);
  return i18n("waarom.meerdere", { landen: landenLijst(landen) });
}

/* "België, Duitsland en Oostenrijk" — een opsomming met een voegwoord, niet een
   rij komma's. De laatste scheiding staat in de vertaaltabel omdat hij per taal
   verschilt. */
function landenLijst(landen){
  var namen = landen.map(function(c){ return c.name; });
  if(namen.length < 2) return namen.join("");
  return i18n("alg.lijstEn", {
    eerste: namen.slice(0, -1).join(", "), laatste: namen[namen.length - 1] });
}

function voegSamen(a, b){
  if(!a) return b || "";
  if(!b) return a;
  return i18n("waarom.en", { a: a, b: b });
}

/* ================= de acties ================= */

function actieBasis(o){
  var bron = o.bron || {};
  return {
    id: o.id,
    tickKey: o.tickKey || null,
    landen: o.landen || [],
    status: o.status,
    prioriteit: o.prioriteit,
    wat: o.wat,
    uitleg: o.uitleg || "",
    waarom: o.waarom || "",
    deadline: o.deadline || null,
    bron: {
      factId: bron.factId || null,
      confidence: bron.confidence || "unavailable",
      sourceUrl: bron.sourceUrl || null,
      lastVerified: bron.lastVerified || null,
      verificationNote: bron.verificationNote || null
    },
    prijs: o.prijs || null,
    boete: o.boete || null,
    afvinkbaar: o.afvinkbaar !== false,
    afgevinkt: false,
    naarWizardStap: o.naarWizardStap || null
  };
}

/* De vier universele documenten. Ze hangen aan geen enkel land en aan geen
   enkele bron in countries.json: ze gelden voor elke grensoverschrijdende rit.
   Dat zegt de herkomstregel dan ook, in plaats van een bron te suggereren die
   er niet is. */
function documentActies(trip){
  return DOC_ITEMS.map(function(d){
    return actieBasis({
      id: "doc." + d.key,
      tickKey: "doc:" + d.key,
      status: "actie",
      prioriteit: "inDeAuto",
      wat: docNaam(d),
      uitleg: docInfo(d),
      waarom: i18n("waarom.altijd"),
      deadline: deadlineVoor("document", null, trip)
    });
  });
}

/* Uitrusting, gegroepeerd over landen heen. Het onderscheid uit de bestaande
   app blijft overeind en is hier juist de kern van de indeling:

     must    afdwingbaar op deze route, ook met een buitenlands kenteken
     advice  verstandig, maar geen boete
     na      staat in de wet daar, maar niet voor jouw kenteken

   Die derde groep verdwijnt niet in "aanbevolen": dat zou de belangrijkste
   correctie van deze app platslaan (zie README, "verplicht ≠ beboetbaar"). Hij
   krijgt een eigen, ingeklapte groep die uitlegt waaróm hij niet voor jou geldt. */
function uitrustingActies(trip){
  var G = buildGroups(trip);
  var eigenLand = BY_CODE[trip.vehicle.plateCountry];
  var uit = [];

  function rij(row, prioriteit, status, waarom){
    var landen = row.main.map(function(e){ return e.country; });
    var item = row.main[0] && row.main[0].item;
    var land = row.main[0] && row.main[0].country;
    return actieBasis({
      id: (item && item.id) || ("uitrusting." + row.g.key),
      tickKey: row.g.key,
      landen: landen,
      status: status,
      prioriteit: prioriteit,
      wat: row.g.label,
      uitleg: (item && item.note) || "",
      waarom: waarom(landen),
      bron: herkomstVan(item, land)
    });
  }

  G.must.forEach(function(row){
    uit.push(rij(row, "inDeAuto", "actie", function(landen){
      return voegSamen(landenReden(landen, trip), i18n("waarom.afdwingbaar"));
    }));
  });
  G.advice.forEach(function(row){
    uit.push(rij(row, "aanbevolen", "ok", function(landen){
      return voegSamen(landenReden(landen, trip), i18n("waarom.aanbevolen"));
    }));
  });
  G.na.forEach(function(row){
    var a = rij(row, "nietVoorJou", "ok", function(landen){
      return i18n("waarom.nietVoorJou", {
        landen: landenLijst(landen),
        eigen: eigenLand ? eigenLand.name : trip.vehicle.plateCountry });
    });
    a.afvinkbaar = false;   /* je hoeft dit niet te doen, dus valt er niets af te vinken */
    uit.push(a);
  });
  return uit;
}

/* De afgeleide regeltaken: vignetten, milieustickers, registraties,
   winteruitrusting en de twee apparatuurregels. buildTasks() levert ze al
   inclusief herkomst; hier komen de prioriteit, de deadline en de reden erbij. */
var TAAK_SOORT = {
  "zone": "zone", "vig": "vignet", "win": "winter", "flits": "apparatuur", "dash": "apparatuur"
};

function taakSoort(key){
  var kop = String(key).split(":")[0];
  return TAAK_SOORT[kop] || null;
}

function regelActies(trip){
  var T = buildTasks(trip);
  var uit = [];

  T.blockers.forEach(function(t){
    var c = t.c;
    var waarom;
    /* Een brandstofverbod op een tolpunt (LPG/CNG) heeft niets met de euronorm
       te maken — dat is een aparte soort blokkade dan de milieuzone-verdicten
       hieronder, en verdient dus ook een andere reden (§7: "waarom zie ik dit"
       moet kloppen, niet alleen aanwezig zijn). */
    if(t.soort === "brandstofverbod"){
      waarom = voegSamen(landReden(c, trip), i18n("waarom.brandstofverboden", {
        brandstof: i18n("profiel.brandstofKort." + trip.vehicle.fuel) }));
    } else {
      var z = (c.environmentalZone || {});
      var drempel = z.emissionThreshold || {};
      var need = brandstofVoorDrempel(trip.vehicle) === "diesel" ? drempel.diesel : drempel.petrol;
      waarom = voegSamen(landReden(c, trip),
        (need != null && trip.vehicle.euro != null)
          ? i18n("waarom.euronorm", {
              brandstof: i18n("profiel.brandstofKort." + brandstofVoorDrempel(trip.vehicle)),
              euro: trip.vehicle.euro, need: need })
          : null);
    }
    uit.push(actieBasis({
      id: t.factId || ("blok." + c.code),
      tickKey: null,
      landen: [c],
      status: "blokkade",
      prioriteit: "eerst",
      wat: t.what,
      uitleg: t.meta,
      waarom: waarom,
      bron: t,
      boete: t.fineIndication,
      prijs: null,
      afvinkbaar: false
    }));
  });

  T.todo.forEach(function(t){
    var soort = taakSoort(t.key);
    var c = t.c;
    var landen = t.cs || (c ? [c] : []);
    var feit = null, deadlineSoort = soort;

    if(soort === "zone" && c){
      feit = c.environmentalZone;
      deadlineSoort = "zone." + (zoneAction(c, trip) || "registratie");
    } else if(soort === "vignet" && c){
      feit = c.tollVignette;
    } else if(soort === "winter" && c){
      feit = c.winterEquipment;
    }

    var waarom = landenReden(landen, trip);
    if(soort === "zone" && c && (c.environmentalZone || {}).actionAppliesTo === "foreign"){
      waarom = voegSamen(waarom, i18n("waarom.buitenlandsKenteken", { land: c.name }));
    }
    if(soort === "winter" && c){
      waarom = voegSamen(waarom, i18n("waarom.winterperiode", {
        datum: fmtDate(trip.departureDate) }));
    }
    if(soort === "apparatuur"){
      waarom = voegSamen(waarom, i18n("waarom.verboden"));
    }

    /* Fase D2: een vignet dat voor deze auto nog geldig is op de vertrekdatum
       (uit een eerdere reis of los ingevuld) hoeft niet opnieuw geregeld te
       worden. De actie blijft bestaan — bouwActies() hieronder markeert 'm als
       afgevinkt — maar de reden legt uit waaróm, in plaats van gewoon de
       gebruikelijke "je route loopt door X". */
    var vignetGeheugenInfo = (soort === "vignet" && c) ? vignetGeheugenGeldig(c.code, trip.departureDate) : null;
    if(vignetGeheugenInfo){
      waarom = i18n("waarom.vignetGeldig", {
        naam: c.tollVignette.name, datum: fmtDate(vignetGeheugenInfo.geldigTot) });
    }

    uit.push(actieBasis({
      id: t.factId || ("taak." + t.key),
      tickKey: "task:" + t.key,
      landen: landen,
      status: "actie",
      prioriteit: "voorVertrek",
      wat: t.what,
      uitleg: (feit && feit.howToGet) || t.meta || "",
      waarom: waarom,
      deadline: deadlineVoor(deadlineSoort, t.factId, trip),
      bron: t,
      prijs: prijsUitFeit(feit),
      boete: t.fineIndication
    }));
  });

  T.notices.forEach(function(t){
    uit.push(actieBasis({
      id: t.factId || ("letop." + t.key),
      tickKey: null,
      landen: t.c ? [t.c] : [],
      status: "waarschuwing",
      prioriteit: "letop",
      wat: t.what,
      waarom: voegSamen(landReden(t.c, trip),
        i18n("waarom.voertuig", { type: i18n("profiel.typeKort." + trip.vehicle.type) })),
      bron: t,
      afvinkbaar: false
    }));
  });

  return uit;
}

/* ================= wat de app níét kan beoordelen (§13) =================

   zoneVerdict() levert soms "unknown": de euronorm is niet ingevuld, of de
   drempel verschilt te sterk per gemeente. Dat leverde tot nu toe helemaal geen
   regel op — het verdween stilletjes, terwijl het juist het geval is waarin de
   gebruiker iets moet doen. Nu wordt het een actie met status ONBEKEND. */
function onbekendActies(trip){
  var uit = [];
  var euroOntbreekt = false;

  tripLanden(trip).forEach(function(code){
    var c = BY_CODE[code];
    var z = c.environmentalZone || {};
    if(!z.required || z.appliesToCars === false) return;
    var v = zoneVerdict(c, trip);
    if(v.level !== "unknown") return;

    if(trip.vehicle.euro === null && z.euroBasedForCars !== false){
      euroOntbreekt = true;
      return;
    }
    uit.push(actieBasis({
      id: (z.emissionThreshold && z.emissionThreshold.id) || (z.id || code) + ".onbekend",
      tickKey: null,
      landen: [c],
      status: "onbekend",
      prioriteit: "letop",
      wat: i18n("actie.nietTeBeoordelen", { land: c.name }),
      uitleg: v.text,
      waarom: voegSamen(landReden(c, trip), i18n("waarom.drempelVerschilt")),
      bron: herkomstVan(z.emissionThreshold || z, c),
      afvinkbaar: false
    }));
  });

  /* Eén regel voor alle landen samen: de euronorm invullen lost ze in één keer
     op, en vier keer dezelfde vraag stellen is geen checklist maar geklaag. */
  if(euroOntbreekt){
    uit.unshift(actieBasis({
      id: "profiel.euronorm",
      tickKey: null,
      landen: [],
      status: "onbekend",
      prioriteit: "eerst",
      wat: i18n("actie.vulEuronorm"),
      uitleg: i18n("actie.vulEuronormUitleg"),
      waarom: i18n("waarom.euronormOntbreekt"),
      afvinkbaar: false,
      naarWizardStap: 3
    }));
  }
  return uit;
}

/* ================= de lijst ================= */

/* Volgorde: eerst de prioriteit, dan de deadline, dan wat geen deadline heeft.

   De prioriteit telt ook mee binnen één lijst omdat het dashboard er een
   dóórsnede van toont, over de groepen heen: daar hoort "vignet kopen" boven
   "rijbewijs meenemen" te staan, ook als ze dezelfde datum dragen. Binnen een
   groep is de prioriteit gelijk en beslist de deadline. */
var PRIO_RANG = { eerst:0, voorVertrek:1, inDeAuto:2, aanbevolen:3, letop:4, nietVoorJou:5 };

function sorteerActies(acties){
  return acties.slice().sort(function(a, b){
    var pa = PRIO_RANG[a.prioriteit], pb = PRIO_RANG[b.prioriteit];
    if(pa !== pb) return pa - pb;
    var da = a.deadline ? a.deadline.dagen : null;
    var db = b.deadline ? b.deadline.dagen : null;
    if(da === null && db === null) return 0;
    if(da === null) return 1;
    if(db === null) return -1;
    return da - db;
  });
}

function bouwActies(trip){
  if(!trip || !DATA) return [];
  var acties = onbekendActies(trip)
    .concat(regelActies(trip), documentActies(trip), uitrustingActies(trip));

  acties.forEach(function(a){
    /* Fase D2: een nog geldig onthouden vignet telt mee als afgevinkt, ook als
       trip.ticked deze specifieke reis nooit heeft aangeraakt — dat is precies
       het punt van het geheugen: een nieuwe reis met dezelfde auto hoeft het
       vignet niet opnieuw te melden. */
    var m = a.tickKey && /^task:vig:(.+)$/.exec(a.tickKey);
    var vignetGeheugenInfo = m ? vignetGeheugenGeldig(m[1], trip.departureDate) : null;
    a.afgevinkt = !!(a.afvinkbaar && a.tickKey && (isAangevinkt(trip, a.tickKey) || vignetGeheugenInfo));
    if(a.afgevinkt) a.status = "ok";
  });
  return acties;
}

/* De groepen uit §7, in de volgorde waarin je ze afloopt. "Klaar" staat
   onderaan en trekt alles naar zich toe wat je hebt afgevinkt, ongeacht waar
   het vandaan kwam — dat is wat een takenlijst hoort te doen.

   Twee groepen staan er die §7 niet noemt, en allebei met reden: "Let op" voor
   wat je moet weten maar niet kunt afvinken, en "Niet voor jouw kenteken" om
   het onderscheid uit de bestaande app overeind te houden. */
var ACTIE_GROEPEN = ["eerst", "voorVertrek", "inDeAuto", "aanbevolen", "letop", "klaar", "nietVoorJou"];

function groepeerActies(acties){
  var pot = {};
  ACTIE_GROEPEN.forEach(function(g){ pot[g] = []; });
  acties.forEach(function(a){
    var g = a.afgevinkt ? "klaar" : a.prioriteit;
    (pot[g] || pot.voorVertrek).push(a);
  });
  return ACTIE_GROEPEN.map(function(g){
    return { sleutel: g, acties: g === "klaar" ? pot[g] : sorteerActies(pot[g]) };
  }).filter(function(g){ return g.acties.length; });
}

/* Telling voor de voortgangsbalk. Alleen wat je kunt afvinken telt mee: een
   blokkade, een waarschuwing en een regel die niet voor jouw kenteken geldt
   zijn geen taken. Dat was eerder anders — de "niet voor jouw kenteken"-items
   telden wél mee in de noemer maar stonden nergens op het scherm, waardoor
   100% onbereikbaar was zodra er zo'n item was. */
function actieTelling(trip){
  var acties = bouwActies(trip);
  var totaal = 0, gedaan = 0, blokkades = 0, waarschuwingen = 0, onbekend = 0;
  acties.forEach(function(a){
    if(a.afvinkbaar){ totaal++; if(a.afgevinkt) gedaan++; }
    if(a.status === "blokkade") blokkades++;
    else if(a.status === "waarschuwing") waarschuwingen++;
    else if(a.status === "onbekend") onbekend++;
  });
  return { totaal: totaal, gedaan: gedaan, open: totaal - gedaan,
           blockers: blokkades, warnings: waarschuwingen, onbekend: onbekend,
           acties: acties };
}
