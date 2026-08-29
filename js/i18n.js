"use strict";
/* Vertalingen — §17A van de masterprompt, A5 van de roadmap.

   Dit document mikt op een Europese reisassistent, maar de app was volledig
   Nederlands, met de teksten door de renderfuncties heen. i18n is veel
   goedkoper om vanaf het begin mee te bouwen dan er later in te knippen, dus
   staat hier nu de scaffolding: alle zichtbare UI-tekst achter een sleutel, en
   twee talen.

   Wat hier NIET in staat, en met opzet: de landdata. `note`, `rule`, `howToGet`
   en de quirks in countries.json/zones.json zijn Nederlands en blijven dat
   voorlopig. Dat vertalen is een apart project van honderden zorgvuldig
   geformuleerde alinea's, en een halfvertaalde regelpagina is gevaarlijker dan
   een Nederlandse. De UI zegt dat daarom expliciet zodra je Engels kiest
   (taal.dataNotitie), in plaats van het stilzwijgend te laten zien.

   De functie heet i18n() en niet t(): `t` is in deze codebase al de gangbare
   naam voor een taak, een tolpost en een drempelobject, en een globale functie
   die daardoor in de helft van de renderfuncties overschaduwd wordt, is een bug
   die pas opvalt als iemand van taal wisselt.

   Samengestelde zinnen staan als hele zin met plaatshouders in de tabel, niet
   als losse fragmenten die de code aan elkaar plakt. Dat is het verschil tussen
   vertaalbaar en niet: woordvolgorde verschilt per taal, dus
   "Euro " + euro + " voldoet NIET: hier is minimaal Euro " + need + " vereist"
   valt niet te vertalen zonder de zin uit elkaar te trekken. */

var STORE_TAAL = "grenschecklist.taal.v1";
var TALEN = ["nl", "en"];
var TAAL = "nl";

var VERTALINGEN = {

/* ============================================================ NEDERLANDS */
nl: {
  "taal.naam.nl": "Nederlands",
  "taal.naam.en": "Engels",
  "taal.kies": "Taal",
  "taal.dataNotitie": "De regelteksten per land zijn alleen in het Nederlands beschikbaar.",

  "app.naam": "Grenschecklist",
  "app.tagline": "Klaar voor de grens",
  "app.titel": "Grenschecklist — Routeplanner",

  "nav.route": "Routeplanner",
  "nav.landen": "Landeninformatie",
  "nav.checklist": "Checklist",
  "nav.reizen": "Mijn reizen",
  "nav.reis": "Reiservaring",
  "nav.kort.route": "Route",
  "nav.kort.landen": "Info",
  "nav.kort.checklist": "Check",
  "nav.kort.reizen": "Reizen",
  "nav.kort.reis": "Reis",
  "nav.nieuweRit": "Nieuwe rit",
  "nav.instellingen": "Instellingen",
  "nav.donkereModus": "Donkere modus",
  "nav.donkereModusOm": "Donkere modus omschakelen",
  "nav.help": "Help",

  "planner.titel": "Route Plan",
  "planner.van": "Van",
  "planner.naar": "Naar",
  "planner.vertrekplaats": "Vertrekplaats",
  "planner.bestemming": "Bestemming",
  "planner.omdraaien": "Omdraaien",
  "planner.berekenen": "Route berekenen",
  "planner.bezig": "Route berekenen…",
  "planner.kiesEerst": "Kies eerst een vertrekplaats en een bestemming uit de lijst.",
  "planner.klaar": "Klaar — de landen hieronder zijn ingevuld.",
  "planner.geenLanden": "geen bekende landen op deze route",
  "planner.fout": "Route bepalen lukte niet ({reden}). Controleer de plaatsnamen en probeer het opnieuw.",
  "planner.geenDienst": "Route berekenen lukt nu niet. Geen van de routediensten reageerde.",
  "planner.nietGevonden": "Niet gevonden — online zoeken naar “{q}”",
  "planner.nietsGevonden": "Niets gevonden voor “{q}”",
  "planner.zoekenMislukt": "Online zoeken lukte niet — controleer je verbinding",
  "planner.zoeken": "Zoeken…",
  "planner.bekijkReis": "Bekijk je reiservaring",
  "planner.landenOpRoute": "Landen op deze route",
  "planner.afstand": "Afstand",
  "planner.reistijd": "Reistijd",
  "planner.verwachteTol": "Verwachte tol",
  "planner.ofMeer": "of meer",
  "planner.km": "km",
  "planner.duur": "{uur}u {min}m",
  "planner.milieuzones": "Milieuzones gedetecteerd",
  "planner.milieuzonesUitleg": "Let op: voor deze steden heb je mogelijk een vignet of milieusticker nodig.",

  "handmatig.kop": "Kies de landen zelf",
  "handmatig.uitleg": "De checklist, de vignetten en de milieuzones werken hier net zo goed op. Wat je zonder berekende route mist: de afstand, de reistijd, de kilometertol en de kaartschets.",
  "handmatig.toevoegen": "Toevoegen",
  "handmatig.landToevoegen": "Land toevoegen",
  "handmatig.verwijderen": "{land} van de route halen",
  "handmatig.geenLanden": "Nog geen landen gekozen.",

  "profiel.kop": "Voertuigprofiel",
  "profiel.kentekenUit": "Kenteken uit",
  "profiel.vertrekdatum": "Vertrekdatum",
  "profiel.brandstof": "Brandstof",
  "profiel.euronorm": "Euronorm",
  "profiel.voertuig": "Voertuig",
  "profiel.benzine": "Benzine",
  "profiel.diesel": "Diesel",
  "profiel.ev": "Elektrisch of waterstof",
  "profiel.weetIkNiet": "Weet ik niet",
  "profiel.euro6": "Euro 6 (vanaf ± 2015)",
  "profiel.euro5": "Euro 5 (± 2011–2014)",
  "profiel.euro4": "Euro 4 (± 2006–2010)",
  "profiel.euro3": "Euro 3 (± 2001–2005)",
  "profiel.euro2": "Euro 2 (± 1997–2000)",
  "profiel.euro1": "Euro 1 of ouder",
  "profiel.auto": "Personenauto",
  "profiel.aanhanger": "Met aanhanger of caravan",
  "profiel.camper": "Camper",
  "profiel.kenteken": "{land}s kenteken",
  "profiel.vertrek": "vertrek {datum}",
  "profiel.brandstofKort.petrol": "benzine",
  "profiel.brandstofKort.diesel": "diesel",
  "profiel.brandstofKort.ev": "elektrisch",
  "profiel.typeKort.auto": "personenauto",
  "profiel.typeKort.aanhanger": "met aanhanger",
  "profiel.typeKort.camper": "camper",
  "profiel.euroKort": "Euro {euro}",
  "profiel.dezeRoute": "deze route",

  "disclaimer.kop": "Regels veranderen.",
  "disclaimer.kopVervolg": "Controleer de officiële bron vlak voor vertrek.",
  "disclaimer.body": "Verkeersregels, vignetprijzen en milieuzones wijzigen doorlopend, soms midden in het jaar. Deze route-informatie is een geheugensteun, geen juridisch advies.",
  "disclaimer.colofon": "Data onderzocht op {datum}. Landsgrenzen en plaatsen: {naturalEarth} (publiek domein). Routeberekening: {osrm} op kaartdata © {osm}-bijdragers. Zoeken naar plaatsen buiten de meegeleverde lijst gaat via {nominatim}.",

  "kaart.lagen": "Kaartlagen",
  "kaart.centreren": "Centreren",
  "kaart.inzoomen": "Inzoomen",
  "kaart.uitzoomen": "Uitzoomen",
  "kaart.leeg": "Vul een van en naar in om de route te zien.",

  "checklist.titel": "Jouw Reis Checklist",
  "checklist.voortgang": "Voortgang",
  "checklist.gereed": "{pct}% gereed",
  "checklist.documenten": "Documenten",
  "checklist.uitrusting": "Auto Uitrusting",
  "checklist.landspecifiek": "Land-specifiek",
  "checklist.geenUitrusting": "Plan eerst een route voor de verplichte uitrusting per land.",
  "checklist.geenActies": "Geen extra acties gevonden voor je route.",
  "checklist.verplicht": "Verplicht",
  "checklist.geldtIn": "Geldt in {landen}",
  "checklist.nietAfdwingbaar": "{land} — niet afdwingbaar",

  "doc.rijbewijs": "Geldig rijbewijs",
  "doc.rijbewijs.info": "Controleer de vervaldatum voor vertrek.",
  "doc.kenteken": "Kentekenbewijs (deel I)",
  "doc.kenteken.info": "Het plastic pasje of de papieren versie.",
  "doc.groenekaart": "Groene kaart / verzekeringsbewijs",
  "doc.groenekaart.info": "In sommige landen nog als fysiek document verplicht.",
  "doc.id": "ID-kaart of paspoort",
  "doc.id.info": "Voor iedereen in de auto, ook kinderen.",

  "groep.voorafRegelen": "Vooraf regelen",
  "groep.voorafRegelen.qual": "kopen en aanmelden",
  "groep.inDeAuto": "In de auto",
  "groep.inDeAuto.qual": "wettelijk verplicht",
  "groep.uitDeAuto": "Uit de auto",
  "groep.uitDeAuto.qual": "verboden onderweg",
  "groep.aanbevolen": "Aanbevolen",
  "groep.aanbevolen.qual": "geen boete",
  "groep.nietVoorKenteken": "Niet voor jouw kenteken",
  "groep.nietVoorKenteken.qual": "ter info",
  "groep.letop": "Let op",

  "taak.zone.sticker": "Milieusticker regelen voor {land}",
  "taak.zone.registratie": "Kenteken vooraf registreren voor {land}",
  "taak.zone.betaling": "Vooraf betalen of registreren voor {land}",
  "taak.zone.anders": "Regelen voor {land}",
  "taak.vignet": "Vignet kopen voor {land}",
  "taak.winter": "Winterbanden of sneeuwkettingen voor {land}",
  "taak.winterLos": "Winterbanden voor {land}",
  "taak.winterGeenPeriode": "Geen vaste periode — verplicht zodra het winters is",
  "taak.flits": "Flitsmeldingen uitzetten in je navigatie-app",
  "taak.flits.meta": "Soms al strafbaar als de app alleen maar geïnstalleerd staat",
  "taak.dash": "Dashcam uit de auto halen",
  "taak.boeteZonder": "Boete zonder: {bedrag}",
  "taak.blokkade": "Je auto mag de milieuzone van {land} niet in",

  "zone.actie.sticker": "Je moet vooraf een sticker regelen.",
  "zone.actie.registratie": "Je moet je kenteken vooraf registreren — ook als je voldoet.",
  "zone.actie.betaling": "Je moet per dag betalen of vooraf registreren.",
  "zone.geen": "Geen milieuzone in dit land.",
  "zone.nietVoorAutos": "De milieuzones hier gelden niet voor personenauto's.",
  "zone.evActie": "Elektrisch — je voldoet overal aan de norm. {actie}",
  "zone.ev": "Elektrisch — je voldoet aan de norm en hoeft niets te regelen.",
  "zone.geenEuronorm": "Geen euronorm-drempel voor personenauto's; het gaat hier om snelheidsbeperkingen en lokale dieselverboden. {actie}",
  "zone.geenDrempelActie": "Voor {brandstof} geldt hier geen drempel{scope}. {actie}",
  "zone.geenDrempel": "Voor {brandstof} geldt hier geen drempel{scope}.",
  "zone.teVerschillend": "De drempel verschilt hier te sterk per stad om te beoordelen — check de gemeentesite van je bestemming. {actie}",
  "zone.vulEuronorm": "Vul je euronorm in om dit te beoordelen. Nodig{scope}: minimaal Euro {need}. {actie}",
  "zone.voldoetActie": "Euro {euro} voldoet aan de norm van minimaal Euro {need}{scope}. {actie}",
  "zone.voldoet": "Euro {euro} voldoet aan de norm van minimaal Euro {need}{scope}.",
  "zone.voldoetNiet": "Euro {euro} voldoet NIET: hier is minimaal Euro {need} vereist{scope}.",

  "zoneStad.geenDrempel": "Geen euronorm-drempel: dit is een toegangsverbod, geen emissiezone.",
  "zoneStad.ev": "Elektrisch — je voldoet.",
  "zoneStad.geenDrempelBrandstof": "Voor {brandstof} geldt hier geen drempel.",
  "zoneStad.vulEuronorm": "Vul je euronorm in. Nodig: minimaal Euro {need}.",
  "zoneStad.voldoet": "Euro {euro} voldoet aan de eis van minimaal Euro {need}.",
  "zoneStad.voldoetNiet": "Euro {euro} voldoet NIET: hier is minimaal Euro {need} vereist.",

  "landen.wisselVanLand": "Wissel van land",
  "landen.zoekLand": "Zoek een land...",
  "landen.opJeRoute": "Op je route",
  "landen.alleLanden": "Alle landen",
  "landen.europa": "Europa",
  "landen.intro": "Reisregels, verplichtingen en belangrijke informatie voor een veilige en vlotte doorreis.",
  "landen.verplichtInAuto": "Verplicht in de auto",
  "landen.geenUitrusting": "Geen verplichte uitrusting geregistreerd.",
  "landen.milieuEnTol": "Milieuzones & tol",
  "landen.milieuzone": "Milieuzone",
  "landen.tol": "Tol",
  "landen.milieuVereist": "Vereist — controleer de voorwaarden.",
  "landen.geenMilieuzone": "Geen milieuzone in dit land.",
  "landen.vignetVerplicht": "Vignet verplicht.",
  "landen.tolwegen": "Tolwegen: circa €{tarief} per km.",
  "landen.geenTolinfo": "Geen vignet- of tolweginfo geregistreerd.",
  "landen.snelheden": "Maximumsnelheden",
  "landen.snelweg": "Snelweg",
  "landen.autoweg": "Autoweg",
  "landen.buitenDeKom": "Buiten de kom",
  "landen.bebouwdeKom": "Bebouwde kom",
  "landen.geenSnelheden": "Geen snelheidslimieten geregistreerd.",
  "landen.regen": "Let op (regen):",
  "landen.regenSnelweg": "snelweg {v}",
  "landen.regenAutoweg": "autoweg {v}",
  "landen.regenBuiten": "buiten de kom {v}",
  "landen.striktVerboden": "Strikt verboden",
  "landen.letop": "Let op",
  "landen.nietsGeregistreerd": "Niets geregistreerd",
  "landen.geenVerboden": "Voor dit land staan geen specifieke verboden in de data.",
  "landen.geenLanden": "Geen landen beschikbaar.",
  "landen.regio.West": "West",
  "landen.regio.Centraal": "Centraal",
  "landen.regio.Zuid": "Zuid",
  "landen.regio.Noord": "Noord",

  "reizen.kop": "Mijn Reizen",
  "reizen.intro": "Beheer opgeslagen routes en controleer je voorbereidingen voor komende reizen.",
  "reizen.nieuweReis": "Nieuwe reis plannen",
  "reizen.planNieuwe": "Plan een nieuwe reis",
  "reizen.planNieuweIntro": "Vind de veiligste route, bereken tolkosten en check lokale regelgeving.",
  "reizen.startPlanner": "Start routeplanner",
  "reizen.landen.een": "{n} land",
  "reizen.landen.meer": "{n} landen",
  "reizen.naamWijzigen": "Naam wijzigen",
  "reizen.verwijderen": "Verwijderen",
  "reizen.openen": "Openen",
  "reizen.actief": "actief",
  "reizen.blokkade": "Blokkade op route",
  "reizen.checklistTeller": "Checklist: {gedaan}/{totaal}",
  "reizen.checklist": "Checklist",
  "reizen.geenRoute": "Nog geen route ingevuld",

  "trip.nieuweRit": "Nieuwe rit",
  "trip.verwijderBevestig": "\"{naam}\" verwijderen? Dit kan niet ongedaan gemaakt worden.",
  "trip.naamPrompt": "Naam voor deze rit:",

  "reis.kop": "Reis Route Ervaring",
  "reis.intro": "Scroll naar beneden om je reis te ervaren en de verplichtingen per land te ontdekken.",
  "reis.start": "Start",
  "reis.bestemming": "Bestemming",
  "reis.startTekst": "Je reis begint hier. Goede reis en rijd voorzichtig!",
  "reis.eindTekst": "Je hebt je bestemming bereikt. Check de checklist nog één keer voor vertrek.",
  "reis.verplicht": "Verplicht",
  "reis.aanbevolen": "Aanbevolen",
  "reis.bekijkChecklist": "Bekijk checklist",
  "reis.leegKop": "Nog geen reis gepland",
  "reis.leegIntro": "Bereken eerst een route op de Routeplanner-pagina, dan verschijnt hier je reisbeleving.",
  "reis.naarPlanner": "Naar Routeplanner",
  "reis.vignetVereist": "Vignet vereist",
  "reis.tolCirca": "Tol circa €{bedrag}",

  "tol.vignet": "vignet",
  "tol.vignetNaam": "Vignet",
  "tol.vignetSnelweg": "{naam} verplicht op de snelweg",
  "tol.perKm": "{km} km · circa € {tarief} per km tolweg",
  "tol.apartBetalen": "apart betalen, ook met vignet",
  "tol.tariefOnbekend": "tarief onbekend",
  "tol.geenTol": "geen tol gezien op deze route",
  "tol.vulRouteIn": "vul een route in voor de kilometerkosten",
  "tol.nogGeenRoute": "nog geen route",

  "badge.verplichtBoete": "verplicht — boete mogelijk",
  "badge.aanbevolen": "aanbevolen",
  "badge.alleenVoor": "alleen voor {land}s kenteken",

  "correctie.meldHet": "Klopt dit niet? Meld het",
  "correctie.kopieer": "Klopt dit niet? Kopieer een melding",
  "correctie.gekopieerd": "Gekopieerd — plak het in een mail of bericht",
  "correctie.onbekend": "onbekend",
  "correctie.tekst": "Grenschecklist — correctie {land} ({code})\nLaatst geverifieerd in de app: {datum}\nBron in de app: {bron}\n\nWat klopt er niet:\n\n\nBron waaruit dat blijkt:\n",

  "data.laadFoutKop": "countries.json kon niet geladen worden.",
  "data.laadFoutUitleg": "Je browser blokkeert het lezen van een databestand naast een pagina die je met <code>file://</code> hebt geopend. Kies het bestand hieronder één keer handmatig — daarna onthoudt deze browser het en werkt de app ook offline zonder server.",
  "data.laadFoutHint": "Liever structureel? Zet de map online (GitHub Pages) of start een lokale server in deze map, bijvoorbeeld <code>npx serve</code>, en open de app via <code>http://localhost</code>.",
  "data.leesFout": "Dit bestand kon niet gelezen worden als countries.json: {reden}",
  "data.cacheWaarschuwing": "Let op: de regeldata kon niet opgehaald worden, dus je ziet een eerder opgeslagen kopie. Die kan verouderd zijn. Onderzoeksdatum van deze kopie: {datum}.",

  "offline.klaar": "Offline klaar — deze app werkt nu ook zonder bereik.",
  "offline.nietBeschikbaar": "Offline-cache niet beschikbaar in deze browser. De app werkt gewoon, maar heeft bereik nodig om te laden.",
  "offline.file": "Geopend via file:// — werkt offline zodra countries.json één keer is ingelezen.",

  "alg.vlag": "Vlag {land}",
  "alg.maanden": "januari,februari,maart,april,mei,juni,juli,augustus,september,oktober,november,december",
  "alg.datum": "{dag} {maand} {jaar}",
  "alg.locale": "nl-NL",

  "dienst.proxy": "Berekend via je eigen proxy.",
  "dienst.osrm-demo": "Berekend via de OSRM-demoserver — die is niet voor productie bedoeld.",
  "dienst.graphhopper": "Berekend via Graphhopper.",
  "dienst.anders": "Berekend via {naam}.",
  "dienst.teVeel": "te veel aanvragen — probeer het zo nog eens",
  "dienst.geenRoute": "geen route gevonden",
  "dienst.geenDienst": "geen dienst beschikbaar",
  "dienst.nietIngesteld": "{naam} is niet ingesteld — zet hem achter de proxy ({env})",

  "kalender.zuid": "richting zuid",
  "kalender.noord": "richting noord",
  "kalender.vertrek": "vertrekrichting"
},

/* ================================================================ ENGELS */
en: {
  "taal.naam.nl": "Dutch",
  "taal.naam.en": "English",
  "taal.kies": "Language",
  "taal.dataNotitie": "The per-country rule texts are only available in Dutch.",

  "app.naam": "Grenschecklist",
  "app.tagline": "Ready for the border",
  "app.titel": "Grenschecklist — Route planner",

  "nav.route": "Route planner",
  "nav.landen": "Country information",
  "nav.checklist": "Checklist",
  "nav.reizen": "My trips",
  "nav.reis": "Journey",
  "nav.kort.route": "Route",
  "nav.kort.landen": "Info",
  "nav.kort.checklist": "Check",
  "nav.kort.reizen": "Trips",
  "nav.kort.reis": "Journey",
  "nav.nieuweRit": "New trip",
  "nav.instellingen": "Settings",
  "nav.donkereModus": "Dark mode",
  "nav.donkereModusOm": "Toggle dark mode",
  "nav.help": "Help",

  "planner.titel": "Route Plan",
  "planner.van": "From",
  "planner.naar": "To",
  "planner.vertrekplaats": "Starting point",
  "planner.bestemming": "Destination",
  "planner.omdraaien": "Swap",
  "planner.berekenen": "Calculate route",
  "planner.bezig": "Calculating route…",
  "planner.kiesEerst": "Pick a starting point and a destination from the list first.",
  "planner.klaar": "Done — the countries below have been filled in.",
  "planner.geenLanden": "no known countries on this route",
  "planner.fout": "Could not work out the route ({reden}). Check the place names and try again.",
  "planner.geenDienst": "Cannot calculate a route right now. None of the routing services responded.",
  "planner.nietGevonden": "Not found — search online for “{q}”",
  "planner.nietsGevonden": "Nothing found for “{q}”",
  "planner.zoekenMislukt": "Online search failed — check your connection",
  "planner.zoeken": "Searching…",
  "planner.bekijkReis": "View your journey",
  "planner.landenOpRoute": "Countries on this route",
  "planner.afstand": "Distance",
  "planner.reistijd": "Travel time",
  "planner.verwachteTol": "Expected tolls",
  "planner.ofMeer": "or more",
  "planner.km": "km",
  "planner.duur": "{uur}h {min}m",
  "planner.milieuzones": "Low-emission zones detected",
  "planner.milieuzonesUitleg": "Note: these cities may require a vignette or an emissions sticker.",

  "handmatig.kop": "Choose the countries yourself",
  "handmatig.uitleg": "The checklist, the vignettes and the low-emission zones work just as well this way. What you miss without a calculated route: the distance, the travel time, the per-kilometre tolls and the map sketch.",
  "handmatig.toevoegen": "Add",
  "handmatig.landToevoegen": "Add country",
  "handmatig.verwijderen": "Remove {land} from the route",
  "handmatig.geenLanden": "No countries chosen yet.",

  "profiel.kop": "Vehicle profile",
  "profiel.kentekenUit": "Registered in",
  "profiel.vertrekdatum": "Departure date",
  "profiel.brandstof": "Fuel",
  "profiel.euronorm": "Euro standard",
  "profiel.voertuig": "Vehicle",
  "profiel.benzine": "Petrol",
  "profiel.diesel": "Diesel",
  "profiel.ev": "Electric or hydrogen",
  "profiel.weetIkNiet": "I don't know",
  "profiel.euro6": "Euro 6 (from ± 2015)",
  "profiel.euro5": "Euro 5 (± 2011–2014)",
  "profiel.euro4": "Euro 4 (± 2006–2010)",
  "profiel.euro3": "Euro 3 (± 2001–2005)",
  "profiel.euro2": "Euro 2 (± 1997–2000)",
  "profiel.euro1": "Euro 1 or older",
  "profiel.auto": "Car",
  "profiel.aanhanger": "With trailer or caravan",
  "profiel.camper": "Motorhome",
  "profiel.kenteken": "{land} plates",
  "profiel.vertrek": "departing {datum}",
  "profiel.brandstofKort.petrol": "petrol",
  "profiel.brandstofKort.diesel": "diesel",
  "profiel.brandstofKort.ev": "electric",
  "profiel.typeKort.auto": "car",
  "profiel.typeKort.aanhanger": "with trailer",
  "profiel.typeKort.camper": "motorhome",
  "profiel.euroKort": "Euro {euro}",
  "profiel.dezeRoute": "this route",

  "disclaimer.kop": "Rules change.",
  "disclaimer.kopVervolg": "Check the official source just before you leave.",
  "disclaimer.body": "Traffic rules, vignette prices and low-emission zones change constantly, sometimes mid-year. This route information is a reminder, not legal advice.",
  "disclaimer.colofon": "Data researched on {datum}. Borders and places: {naturalEarth} (public domain). Routing: {osrm} on map data © {osm} contributors. Searching for places outside the bundled list goes through {nominatim}.",

  "kaart.lagen": "Map layers",
  "kaart.centreren": "Recentre",
  "kaart.inzoomen": "Zoom in",
  "kaart.uitzoomen": "Zoom out",
  "kaart.leeg": "Fill in a from and to to see the route.",

  "checklist.titel": "Your Trip Checklist",
  "checklist.voortgang": "Progress",
  "checklist.gereed": "{pct}% done",
  "checklist.documenten": "Documents",
  "checklist.uitrusting": "Car Equipment",
  "checklist.landspecifiek": "Country-specific",
  "checklist.geenUitrusting": "Plan a route first to see the required equipment per country.",
  "checklist.geenActies": "No extra actions found for your route.",
  "checklist.verplicht": "Required",
  "checklist.geldtIn": "Applies in {landen}",
  "checklist.nietAfdwingbaar": "{land} — not enforceable",

  "doc.rijbewijs": "Valid driving licence",
  "doc.rijbewijs.info": "Check the expiry date before you leave.",
  "doc.kenteken": "Vehicle registration document",
  "doc.kenteken.info": "The plastic card or the paper version.",
  "doc.groenekaart": "Green card / proof of insurance",
  "doc.groenekaart.info": "Still required as a physical document in some countries.",
  "doc.id": "ID card or passport",
  "doc.id.info": "For everyone in the car, children included.",

  "groep.voorafRegelen": "Arrange in advance",
  "groep.voorafRegelen.qual": "buy and register",
  "groep.inDeAuto": "In the car",
  "groep.inDeAuto.qual": "legally required",
  "groep.uitDeAuto": "Out of the car",
  "groep.uitDeAuto.qual": "prohibited on the road",
  "groep.aanbevolen": "Recommended",
  "groep.aanbevolen.qual": "no fine",
  "groep.nietVoorKenteken": "Not for your plates",
  "groep.nietVoorKenteken.qual": "for information",
  "groep.letop": "Note",

  "taak.zone.sticker": "Get an emissions sticker for {land}",
  "taak.zone.registratie": "Register your plates in advance for {land}",
  "taak.zone.betaling": "Pay or register in advance for {land}",
  "taak.zone.anders": "Arrange for {land}",
  "taak.vignet": "Buy a vignette for {land}",
  "taak.winter": "Winter tyres or snow chains for {land}",
  "taak.winterLos": "Winter tyres for {land}",
  "taak.winterGeenPeriode": "No fixed period — required as soon as conditions are wintry",
  "taak.flits": "Turn off speed camera alerts in your navigation app",
  "taak.flits.meta": "Sometimes an offence even if the app is merely installed",
  "taak.dash": "Take the dashcam out of the car",
  "taak.boeteZonder": "Fine without: {bedrag}",
  "taak.blokkade": "Your car is not allowed into the low-emission zone of {land}",

  "zone.actie.sticker": "You need to get a sticker in advance.",
  "zone.actie.registratie": "You need to register your plates in advance — even if you comply.",
  "zone.actie.betaling": "You need to pay per day or register in advance.",
  "zone.geen": "No low-emission zone in this country.",
  "zone.nietVoorAutos": "The low-emission zones here do not apply to cars.",
  "zone.evActie": "Electric — you meet the standard everywhere. {actie}",
  "zone.ev": "Electric — you meet the standard and need to arrange nothing.",
  "zone.geenEuronorm": "No Euro standard threshold for cars; this is about speed limits and local diesel bans. {actie}",
  "zone.geenDrempelActie": "There is no threshold for {brandstof} here{scope}. {actie}",
  "zone.geenDrempel": "There is no threshold for {brandstof} here{scope}.",
  "zone.teVerschillend": "The threshold varies too much per city to judge — check your destination's municipal website. {actie}",
  "zone.vulEuronorm": "Fill in your Euro standard to judge this. Required{scope}: Euro {need} or better. {actie}",
  "zone.voldoetActie": "Euro {euro} meets the standard of Euro {need} or better{scope}. {actie}",
  "zone.voldoet": "Euro {euro} meets the standard of Euro {need} or better{scope}.",
  "zone.voldoetNiet": "Euro {euro} does NOT comply: Euro {need} or better is required here{scope}.",

  "zoneStad.geenDrempel": "No Euro standard threshold: this is an access ban, not an emissions zone.",
  "zoneStad.ev": "Electric — you comply.",
  "zoneStad.geenDrempelBrandstof": "There is no threshold for {brandstof} here.",
  "zoneStad.vulEuronorm": "Fill in your Euro standard. Required: Euro {need} or better.",
  "zoneStad.voldoet": "Euro {euro} meets the requirement of Euro {need} or better.",
  "zoneStad.voldoetNiet": "Euro {euro} does NOT comply: Euro {need} or better is required here.",

  "landen.wisselVanLand": "Switch country",
  "landen.zoekLand": "Search for a country...",
  "landen.opJeRoute": "On your route",
  "landen.alleLanden": "All countries",
  "landen.europa": "Europe",
  "landen.intro": "Travel rules, obligations and key information for a safe and smooth journey through.",
  "landen.verplichtInAuto": "Required in the car",
  "landen.geenUitrusting": "No required equipment recorded.",
  "landen.milieuEnTol": "Low-emission zones & tolls",
  "landen.milieuzone": "Low-emission zone",
  "landen.tol": "Tolls",
  "landen.milieuVereist": "Required — check the conditions.",
  "landen.geenMilieuzone": "No low-emission zone in this country.",
  "landen.vignetVerplicht": "Vignette required.",
  "landen.tolwegen": "Toll roads: about €{tarief} per km.",
  "landen.geenTolinfo": "No vignette or toll road information recorded.",
  "landen.snelheden": "Speed limits",
  "landen.snelweg": "Motorway",
  "landen.autoweg": "Expressway",
  "landen.buitenDeKom": "Outside built-up areas",
  "landen.bebouwdeKom": "Built-up areas",
  "landen.geenSnelheden": "No speed limits recorded.",
  "landen.regen": "Note (rain):",
  "landen.regenSnelweg": "motorway {v}",
  "landen.regenAutoweg": "expressway {v}",
  "landen.regenBuiten": "outside built-up areas {v}",
  "landen.striktVerboden": "Strictly prohibited",
  "landen.letop": "Note",
  "landen.nietsGeregistreerd": "Nothing recorded",
  "landen.geenVerboden": "The data holds no specific prohibitions for this country.",
  "landen.geenLanden": "No countries available.",
  "landen.regio.West": "West",
  "landen.regio.Centraal": "Central",
  "landen.regio.Zuid": "South",
  "landen.regio.Noord": "North",

  "reizen.kop": "My Trips",
  "reizen.intro": "Manage saved routes and check your preparations for upcoming trips.",
  "reizen.nieuweReis": "Plan a new trip",
  "reizen.planNieuwe": "Plan a new trip",
  "reizen.planNieuweIntro": "Find the safest route, work out toll costs and check local rules.",
  "reizen.startPlanner": "Open the route planner",
  "reizen.landen.een": "{n} country",
  "reizen.landen.meer": "{n} countries",
  "reizen.naamWijzigen": "Rename",
  "reizen.verwijderen": "Delete",
  "reizen.openen": "Open",
  "reizen.actief": "active",
  "reizen.blokkade": "Blocked on route",
  "reizen.checklistTeller": "Checklist: {gedaan}/{totaal}",
  "reizen.checklist": "Checklist",
  "reizen.geenRoute": "No route filled in yet",

  "trip.nieuweRit": "New trip",
  "trip.verwijderBevestig": "Delete \"{naam}\"? This cannot be undone.",
  "trip.naamPrompt": "Name for this trip:",

  "reis.kop": "Journey Experience",
  "reis.intro": "Scroll down to travel through your trip and discover the obligations per country.",
  "reis.start": "Start",
  "reis.bestemming": "Destination",
  "reis.startTekst": "Your journey begins here. Have a good trip and drive safely!",
  "reis.eindTekst": "You have reached your destination. Run through the checklist once more before you leave.",
  "reis.verplicht": "Required",
  "reis.aanbevolen": "Recommended",
  "reis.bekijkChecklist": "View checklist",
  "reis.leegKop": "No trip planned yet",
  "reis.leegIntro": "Calculate a route on the route planner page first, and your journey will appear here.",
  "reis.naarPlanner": "Go to the route planner",
  "reis.vignetVereist": "Vignette required",
  "reis.tolCirca": "Tolls about €{bedrag}",

  "tol.vignet": "vignette",
  "tol.vignetNaam": "Vignette",
  "tol.vignetSnelweg": "{naam} required on the motorway",
  "tol.perKm": "{km} km · about € {tarief} per km of toll road",
  "tol.apartBetalen": "paid separately, even with a vignette",
  "tol.tariefOnbekend": "rate unknown",
  "tol.geenTol": "no tolls seen on this route",
  "tol.vulRouteIn": "enter a route for the per-kilometre costs",
  "tol.nogGeenRoute": "no route yet",

  "badge.verplichtBoete": "required — fine possible",
  "badge.aanbevolen": "recommended",
  "badge.alleenVoor": "only for {land} plates",

  "correctie.meldHet": "Not correct? Report it",
  "correctie.kopieer": "Not correct? Copy a report",
  "correctie.gekopieerd": "Copied — paste it into an email or message",
  "correctie.onbekend": "unknown",
  "correctie.tekst": "Grenschecklist — correction {land} ({code})\nLast verified in the app: {datum}\nSource in the app: {bron}\n\nWhat is wrong:\n\n\nSource that shows this:\n",

  "data.laadFoutKop": "countries.json could not be loaded.",
  "data.laadFoutUitleg": "Your browser blocks reading a data file next to a page opened with <code>file://</code>. Pick the file below once by hand — after that this browser remembers it and the app works offline without a server.",
  "data.laadFoutHint": "Prefer something permanent? Put the folder online (GitHub Pages) or start a local server in this folder, for example <code>npx serve</code>, and open the app via <code>http://localhost</code>.",
  "data.leesFout": "This file could not be read as countries.json: {reden}",
  "data.cacheWaarschuwing": "Note: the rule data could not be fetched, so you are seeing an earlier saved copy. It may be out of date. Research date of this copy: {datum}.",

  "offline.klaar": "Ready offline — this app now works without a connection too.",
  "offline.nietBeschikbaar": "Offline cache not available in this browser. The app works fine, but needs a connection to load.",
  "offline.file": "Opened via file:// — works offline once countries.json has been read in.",

  "alg.vlag": "Flag of {land}",
  "alg.maanden": "January,February,March,April,May,June,July,August,September,October,November,December",
  "alg.datum": "{dag} {maand} {jaar}",
  "alg.locale": "en-GB",

  "dienst.proxy": "Calculated via your own proxy.",
  "dienst.osrm-demo": "Calculated via the OSRM demo server — which is not meant for production use.",
  "dienst.graphhopper": "Calculated via Graphhopper.",
  "dienst.anders": "Calculated via {naam}.",
  "dienst.teVeel": "too many requests — try again in a moment",
  "dienst.geenRoute": "no route found",
  "dienst.geenDienst": "no service available",
  "dienst.nietIngesteld": "{naam} is not configured — put it behind the proxy ({env})",

  "kalender.zuid": "southbound",
  "kalender.noord": "northbound",
  "kalender.vertrek": "departure direction"
}

};

/* ================= de vertaalfunctie =================

   Ontbreekt een sleutel in de gekozen taal, dan valt hij terug op het
   Nederlands en niet op de sleutel zelf: een half vertaalde taal moet leesbaar
   blijven. Ontbreekt hij ook daar, dan verschijnt de sleutel — dat is een bug
   en die hoort zichtbaar te zijn. */
function i18n(sleutel, params){
  var tabel = VERTALINGEN[TAAL] || VERTALINGEN.nl;
  var tekst = tabel[sleutel];
  if(tekst === undefined) tekst = VERTALINGEN.nl[sleutel];
  if(tekst === undefined) return sleutel;
  if(!params) return tekst;
  return tekst.replace(/\{(\w+)\}/g, function(heel, naam){
    return params[naam] === undefined || params[naam] === null ? "" : String(params[naam]);
  });
}

/* Meervoud. Alleen "één" tegenover "de rest" — dat dekt Nederlands en Engels.
   Talen met meer vormen (Pools, Russisch) vragen om Intl.PluralRules; dat is
   een uitbreiding van deze functie, niet van elke aanroepplek. */
function i18nAantal(sleutel, n, params){
  var p = params || {};
  p.n = n;
  return i18n(sleutel + (n === 1 ? ".een" : ".meer"), p);
}

/* ================= taalkeuze ================= */

function taalUitOpslag(){
  var opgeslagen = lsGet(STORE_TAAL);
  if(TALEN.indexOf(opgeslagen) !== -1) return opgeslagen;
  /* Geen keuze gemaakt: volg de browser. Nederlands is de standaard omdat de
     landdata Nederlands is; dat is eerlijker dan Engels tonen met Nederlandse
     regelteksten eronder. */
  var voorkeuren = (navigator.languages || [navigator.language || "nl"]);
  for(var i = 0; i < voorkeuren.length; i++){
    var kort = String(voorkeuren[i]).slice(0, 2).toLowerCase();
    if(TALEN.indexOf(kort) !== -1) return kort;
  }
  return "nl";
}

function zetTaal(taal){
  if(TALEN.indexOf(taal) === -1) return;
  TAAL = taal;
  lsSet(STORE_TAAL, taal);
  pasTaalToe();
  if(typeof render === "function" && typeof DATA !== "undefined" && DATA) render();
}

/* Vult de statische markup. Attributen apart, want een placeholder of een
   aria-label is geen tekstinhoud maar moet net zo goed mee. */
function pasTaalToe(){
  document.documentElement.setAttribute("lang", TAAL);
  document.title = i18n("app.titel");

  var kaarten = [
    ["data-i18n",             function(el, tekst){ el.textContent = tekst; }],
    ["data-i18n-html",        function(el, tekst){ el.innerHTML = tekst; }],
    ["data-i18n-placeholder", function(el, tekst){ el.setAttribute("placeholder", tekst); }],
    ["data-i18n-aria",        function(el, tekst){ el.setAttribute("aria-label", tekst); }],
    ["data-i18n-title",       function(el, tekst){ el.setAttribute("title", tekst); }]
  ];
  kaarten.forEach(function(paar){
    var attribuut = paar[0], zetten = paar[1];
    var nodes = document.querySelectorAll("[" + attribuut + "]");
    for(var i = 0; i < nodes.length; i++){
      zetten(nodes[i], i18n(nodes[i].getAttribute(attribuut)));
    }
  });

  /* Ook wat door JS is opgebouwd en buiten render() valt. */
  if(typeof toonPlannerStatus === "function") toonPlannerStatus();

  var keuze = document.getElementById("taal-keuze");
  if(keuze) keuze.value = TAAL;

  /* De mobiele knop toont de huidige taal, niet de taal waar je heen gaat: bij
     twee talen is dat hetzelfde aantal klikken en scheelt het uitleg. */
  var knop = document.getElementById("taal-toggle-mobiel");
  if(knop) knop.textContent = TAAL.toUpperCase();

  /* §17A: liever expliciet zeggen dat de regelteksten Nederlands blijven dan
     een halfvertaalde pagina suggereren. */
  var notitie = document.getElementById("taal-notitie");
  if(notitie){
    notitie.hidden = TAAL === "nl";
    notitie.textContent = i18n("taal.dataNotitie");
  }
}
