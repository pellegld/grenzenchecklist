# V2_AUDIT.md — audit van de bestaande codebase

Opgesteld op 29 augustus 2026, vóór de fundament-fase (fase A uit
`GRENSCHECKLIST_ROADMAP_COMMERCIEEL.md`, FASE 0/1 uit
`GRNSCHECKLIST_V2_MASTERPROMPT.txt`).

Dit document beschrijft de app **zoals hij was** aan het begin van die fase, plus de
architectuurkeuzes die daaruit volgen. Het is geen ontwerp van V2; het is de nulmeting
waartegen V2 zich moet verantwoorden.

---

## 1. Wat er stond

```
index.html      3179 regels — <style> (646), <body> (229), <script> (2287) in één bestand
fonts.css       @font-face voor Geist en Inter, self-hosted
countries.json  16 landen, 87 KB — de enige bron van waarheid voor regeldata
cities.json     689 Europese plaatsen voor de autocomplete
borders.json    349 KB landsgrenzen, lazy geladen bij de eerste routeberekening
zones.json      47 milieuzones op stadsniveau
drukte.json     drukteprognoses: 19 harde dagen + 7 periode/weekdag-regels
sw.js           service worker, stale-while-revalidate over een vaste ASSETS-lijst
functions/api/  Cloudflare Pages Functions: route.js en geocode.js (proxy)
tools/*.ps1     PowerShell: fonts en geodata opnieuw genereren
netlify.toml    statische publish, geen build step
```

Geen build step, geen dependencies, geen `package.json`. Vanilla HTML/CSS/JS in strict mode,
ES5-stijl (`var`, `function`), classic script — bewust, want de app moet ook via `file://`
werken.

### Architectuur in één alinea

`index.html` bevat één script met ongeveer 130 globale functies en 25 globale variabelen.
`DATA`/`BY_CODE` zijn de geladen regeldata; `ROUTE`, `HOME`, `VEH`, `DEPART`, `TICKED`,
`FROM_CITY`, `TO_CITY`, `ROUTE_COORDS`, `ROUTE_RES`, `ROUTE_ZONES`, `ROUTE_TOLLS` zijn het
werkgeheugen van de actieve rit. `TRIPS` is de lijst opgeslagen ritten in `localStorage`;
`saveRoute()` schrijft het werkgeheugen terug naar de actieve trip, `hydrateerVanuitTrip()`
doet het omgekeerde. `render()` bouwt alleen de zichtbare view opnieuw op, `switchView()`
wisselt tussen vijf views (route / landen / checklist / reizen / reis).

Dat is geen state management in de zin van §19 van de masterprompt, maar het is wel
consistent: er is één plek waar de waarheid staat (de actieve trip) en één functie die hem
wegschrijft. De verspreide globals zijn een leesbaarheidsprobleem, geen correctheidsprobleem.

### Wat er al werkt

| functie | waar | status |
|---|---|---|
| Routeplanner (van/naar → landen) | `doRoute`, `analyseRoute` | werkt |
| Landdetectie point-in-polygon | `classifyPoint`, `inCountry` | werkt, lokaal, providerloos |
| Milieuzones op stadsniveau | `zonesLangsRoute` | werkt |
| Tolpunten langs de route | `tolPuntenLangsRoute` | werkt |
| Tolschatting per km | `tolSchatting`, `tolTotaalRetour` | werkt |
| Voertuigprofiel + euronorm-oordeel | `zoneVerdict`, `zoneAction` | werkt |
| Checklist met groepen | `buildGroups`, `buildTasks` | werkt |
| Meerdere opgeslagen ritten | `TRIPS`, `activeerTrip` | werkt |
| Landeninformatie per land | `landDetailHTML` | werkt |
| Reiservaring (scrollytelling) | `renderReisErvaring` | werkt |
| Routeschets als SVG | `renderRouteSchets` | werkt, geen kaarttegels |
| Offline via service worker | `sw.js` | werkt |
| `file://`-fallback met bestandskiezer | `showLoadError` | werkt |
| Donkere modus | `toepassenThema` | werkt |
| Proxy-detectie met terugval | `proxyBeschikbaar` | werkt |

### Wat er ontbrak

* **Kalender / "wanneer rijden"** — `drukte.json` bestaat, `drukteVoor()` en
  `renderKalender()` bestaan, maar er is geen pagina die ze toont. Dode code met levende data.
* **Print/PDF** — de README beschrijft een `@media print`-stylesheet. Die is bij de
  Kinetic-Route-redesign verdwenen; er staat nu geen enkele printregel in de CSS. De
  `.printnamen`-elementen in de checklist-HTML staan er nog wel. Dit is een regressie.
* **Kostenpagina** — `tolRegels()` en `renderTol()` bestaan, maar `#tol` bestaat niet in de
  DOM. Zelfde patroon: logica zonder pagina.
* **Deelbare reis, deadline engine, "wat is er veranderd"** — bestaan niet.
* **Dode renderfuncties** — `renderChecklist()`, `renderSteden()`, `renderCountries()`,
  `countryCard()` (geeft `""` terug), `renderKalender()`, `renderTol()`: allemaal zoeken ze
  een element-id dat niet meer in de DOM staat. Ze crashen niet (ze returnen vroeg), maar ze
  vertroebelen wel het beeld van wat er echt draait.

---

## 2. Risico's

### 2.1 Routeprovider (§18A) — het zwaarste risico

De planner belt rechtstreeks `https://router.project-osrm.org` (OSRM-demoserver) en
`https://nominatim.openstreetmap.org`. Beide zijn expliciet niet-commercieel, zonder
uptime-garantie, en begrensd op ongeveer één aanvraag per seconde.

Er is al een proxy (`functions/api/route.js`, `geocode.js`) die dit kan verbergen achter een
eigen domein met een sleutel serverside, en de client kiest daar zelf tussen
(`proxyBeschikbaar()`). Dat is meer dan de masterprompt aannam. Maar:

* de keuze zit **in de aanroepende functies**, niet achter een interface. `doRoute()` roept
  `fetchRoute()` aan, die `routeViaProxy` of `routeViaOsrm` kiest; `searchOnline()` doet
  hetzelfde met `geocodeViaProxy`/`geocodeViaNominatim`. Een derde provider betekent dus een
  `if` erbij op twee plekken, plus een derde plek voor de naamgeving (`DIENST_NAAM`);
* er is **geen reverse geocoding**, terwijl §5 (autocomplete op eigen locatie) die vraagt;
* de proxy heeft **geen rate limit en geen cache op route-hash**. Hij bundelt juist al je
  bezoekers achter één IP richting Nominatim, wat het misbruikrisico groter maakt in plaats
  van kleiner;
* faalt de route, dan toont `plannerStatus()` netjes een menselijke fout — maar er is geen
  expliciete route terug naar handmatige landenkeuze, want de handmatige routebouwer staat
  op deze pagina niet in beeld (`addCountry`/`removeAt`/`moveItem` zijn dormant).

**Conclusie:** de abstractielaag uit §18A moet er komen, en de proxy moet cache en rate limit
krijgen vóór er verkeer op zit.

### 2.2 i18n-gereedheid (§17A) — nul

Er is geen enkele vertaalstructuur. Nederlandse tekst zit op vier plekken:

1. **statische HTML** — navigatielabels, veldlabels, `<option>`-teksten, placeholders,
   `aria-label`s, de disclaimer. Ongeveer 40 strings;
2. **JS-stringliteralen in HTML-templates** — koppen, knopteksten, lege-staat-teksten,
   statusmeldingen. Ruim 150 strings, verspreid over alle renderfuncties;
3. **JS-lookuptabellen** — `ACTION_TEXT`, `ZONE_VERB`, `DIENST_NAAM`, `MAANDEN`,
   `DOC_ITEMS`, de brandstof- en voertuiglabels in `renderProfile()`/`voertuigLabel()`;
4. **samengestelde zinnen** — `zoneVerdict()` en `zoneStadVerdict()` plakken zinnen aan
   elkaar uit losse fragmenten ("Euro 5 voldoet NIET: hier is minimaal Euro 6 vereist
   (Brussel)"). Dit is het lastigste geval: woordvolgorde verschilt per taal, dus dit moet
   naar parameterized keys, niet naar concatenatie.

Daarnaast staat er Nederlandstalige **data** in `countries.json`, `zones.json` en
`drukte.json` (`note`, `rule`, `howToGet`, `tekst`). Die vertalen is een apart, veel groter
project. §17A staat toe die voorlopig Nederlands te laten, mits de UI dat eerlijk zegt.

Ook: `toLocaleString("nl-NL")` staat hard in vier functies, en `fmtDate()` heeft een
hardgecodeerde Nederlandse maandnamenlijst.

**Waar die strings terechtkwamen.** Bij elkaar ongeveer 200 Nederlandse zinnen, en ze stonden
allemaal in dat ene `index.html`. Na de splitsing is de telling anders: er zijn 671 sleutels,
in twee talen, en ze staan alle 671 in `js/i18n.js` (§5 heeft de kaart). In de componenten
staan er nul — de statische markup verwijst met `data-i18n`, `data-i18n-placeholder`,
`data-i18n-aria` en `data-i18n-title` naar een sleutel, en de renderfuncties roepen `i18n()`
aan. Wat je in de JS-bestanden nog wél tegenkomt is Nederlands in commentaar, in element-id's
(`btn-meer`, `dark-toggle`) en in interne foutmeldingen die nooit een scherm halen
(`new Error("geen countries-array")`); dat is geen UI-tekst en hoeft niet mee.

Nederlands blijft staan in de **data**: `note`, `rule`, `howToGet`, `fineIndication` en de
quirks in `countries.json` en `zones.json`, plus `meta.disclaimer` in `fuelprices.json`. De
eerste groep dekt de app af met de notitie bij de taalkeuze ("de regelteksten per land zijn
alleen in het Nederlands beschikbaar"); de tweede is geen regeltekst per land, en daarom kiest
`tankDisclaimer()` in een andere taal de vertaalde zin uit `i18n.js` — tenzij het databestand
zelf een vertaling meelevert (`disclaimer_en`).

### 2.3 Data-onderhoud

Elk land heeft `lastVerified` en losse `needsVerification`-vlaggen op subobjecten. Maar:

* **geen stabiele id's per feit.** Een correctie of een changelog-regel kan nergens
  ondubbelzinnig naar verwijzen. Dit blokkeert §14 én §14A;
* **geen `confidence`.** `needsVerification: true/false` is binair; §13 vraagt vier
  niveaus (`official` / `verified` / `uncertain` / `unavailable`);
* **data zit in de bundle.** Een vignetprijs wijzigen vereist een deploy. Dat schaalt niet
  bij honderden losse feiten;
* de app markeert data ouder dan `STALE_DAYS = 240` als verouderd; de roadmap vraagt om
  **180 dagen** als drempel voor de verificatietool. Die twee getallen mogen verschillen
  (de tool waarschuwt eerder dan de app), maar dat moet dan wel expliciet zijn.

### 2.4 Kleinere observaties

* `sw.js` cachet een handmatige `ASSETS`-lijst. Elk nieuw bestand (en die komen er nu veel)
  moet daar met de hand bij, en `CACHE` moet gebumpt worden. Foutgevoelig.
* `functions/api/*.js` zijn Pages Functions; `netlify.toml` zegt zelf dat ze op Netlify niet
  draaien. Er zijn dus twee hostingdoelen waarvan er één de proxy niet heeft.
* De herkomstcontrole (`herkomstToegestaan`) is geen authenticatie en zegt dat ook eerlijk in
  het commentaar. Zonder rate limit is het endpoint met curl triviaal leeg te trekken.
* `esc()` wordt consequent gebruikt in de HTML-templates. Steekproef: geen plek gevonden waar
  data ongeëscaped in `innerHTML` belandt, behalve bewust opgebouwde stukken (`flagHTML`,
  `iconUse`) die zelf al escapen.

---

## 3. Wat deze fase doet

Geen nieuwe gebruikersfuncties. Alleen fundament:

| onderdeel | resultaat |
|---|---|
| Bestandssplitsing | `css/{base,components,pages,print}.css`, `js/*.js`, `index.html` als shell |
| Build-pipeline | `build/build.mjs` — leest `countries.json`, kan statische pagina's genereren; genereert er nog geen |
| Routeprovider | `js/routeProvider.js` met `getRoute`/`geocode`/`reverseGeocode`, implementaties `osrm-demo` en (leeg) `graphhopper`, providerketen met terugval |
| Proxy | Cloudflare Worker met cache op route-hash en rate limit per IP; sleutel in env |
| Data-endpoint | `/api/v1/data/*.json` met ETag; app haalt op bij opstarten, valt terug op de bundled kopie |
| Data-annotatie | stabiele `id` en `confidence` per feit |
| Verificatietool | `tools/verify-data.mjs` |
| Changelog | `meta/changelog.json` + `meta/version.json` |
| i18n | `js/i18n.js` met `{ nl, en }`, taalkeuze in de UI |

### Wat bewust níét gebeurt

* Geen nieuwe routeprovider kiezen of afsluiten (§18A zegt: pas als er verkeer is).
* Geen kaartbibliotheek toevoegen; de SVG-schets blijft.
* Geen framework, geen bundler. De app blijft classic scripts, zodat `file://` blijft werken.
* De dode renderfuncties blijven staan waar ze horen (`checklist.js`, `costs.js`,
  `calendar.js`) in plaats van weggegooid te worden — ze zijn de basis voor de kosten- en
  kalenderpagina uit fase 5 van de masterprompt.

---

## 4. Hoe een latere correctie-flow hierop aanhaakt (§14A)

Deze fase bouwt geen correctie-flow. Wel de structuur eronder. Zo zou hij later aanhaken,
zonder dat er dan nog iets aan de datalaag hoeft te veranderen:

**1. Het id is het aangrijpingspunt.** Elk feit krijgt een stabiel, afgeleid id van de vorm
`<landcode>.<onderwerp>[.<sleutel>]`, bijvoorbeeld:

```
at.tollVignette                     het Oostenrijkse vignet als geheel
at.tollPoint.a13-brennerautobahn    één tolpunt
fr.equipment.alcoholtester          één uitrustingsitem
zone.fr-paris                       één milieuzone uit zones.json
```

Die id's zijn afgeleid van inhoud die niet verandert (landcode + veldnaam + geslugde naam),
niet van een array-index. Hernoemt een land een vignet, dan blijft het id gelijk; komt er een
tolpunt bij, dan schuift er niets op.

**2. Een correctie is een verwijzing naar een id plus een voorgestelde waarde.** De vorm die
`meta/changelog.json` nu al heeft, is precies de vorm die een correctie aanneemt zodra hij
geaccepteerd is:

```jsonc
{ "id": "at.tollVignette", "land": "AT", "onderwerp": "prijs 10-dagenvignet",
  "oud": "12,40 euro", "nieuw": "13,10 euro", "datum": "2026-09-01",
  "bron": "https://www.asfinag.at/..." }
```

Een ingediende correctie is dus hetzelfde object zonder de `datum`/`bron` van de redactie,
met een status ervoor. De changelog is de geaccepteerde correctie; er is geen tweede
datamodel nodig.

**3. De bestaande correctielink is het instappunt.** `correctionLinks()` maakt nu per land
een kopieerbare melding of een link naar `meta.correctionFormUrl`. Die functie krijgt er
later een `id`-parameter bij, zodat de link ook vanaf één actie of één feit gelegd kan
worden in plaats van alleen vanaf de landkaart. `correctionTekst()` zet dat id dan in de
kop van de melding, zodat een binnenkomende melding automatisch aan een feit te koppelen is.

**4. `confidence` is de plek waar een correctie effect heeft.** Een feit dat door meerdere
gebruikers betwist wordt, zakt naar `uncertain` — precies het niveau dat de app toont als
"Controleer de officiële bron". Er is dus geen nieuwe UI-status nodig; het bestaande
onzekerheidsniveau draagt het.

Wat er dán nog gebouwd moet worden — een indienformulier, moderatie, stemmen, een publieke
wijzigingspagina — staat in fase D/E van de roadmap en hoort daar.

---

## 5. Waar staat wat na de splitsing — en wat fase B raakt

De hoofdstukken hierboven beschrijven de app van vóór de splitsing, toen alles in
`index.html` stond. Dat is de nulmeting en die blijft staan. Maar een audit die niet zegt
wélk bestand je straks openslaat, laat het duurste werk aan de lezer over. Daarom deze kaart:
één regel per bestand, en in de laatste kolom of fase B (V2-UX) eraan komt.

`index.html` is sinds de splitsing een shell: markup, de navigatie, de lege view-containers en
onderaan de scripttags in laadvolgorde. Geen logica, geen `<style>`.

### De laag eronder — data, staat en diensten

| bestand | wat het doet | fase B |
|---|---|---|
| `js/i18n.js` | alle zichtbare tekst, `{ nl, en }`, plus `i18n()`/`i18nAantal()`/`zetTaal()` | **ja, altijd** — elke nieuwe zin is hier een sleutel |
| `js/config.js` | opslagsleutels, drempels (`STALE_DAYS`), de geladen referentiedata, `VIEW_ORDER` | ja, bij een nieuwe pagina |
| `js/storage.js` | `localStorage`-wrappers en het thema | nee |
| `js/util.js` | `esc()`, datum- en bedragopmaak, vlaggen, icoonverwijzingen | zijdelings |
| `js/data.js` | regeldata laden: endpoint → bundel → `localStorage` → bestandskiezer | nee |
| `js/routeProvider.js` | `getRoute`/`geocode`/`reverseGeocode` achter één interface, met providerketen | nee |
| `js/geo.js` | landen, zones en tolpunten uit de routegeometrie (point-in-polygon) | nee |
| `js/trip.js` | het trip-object: de bron van waarheid van één reis | ja, bij elk nieuw veld |
| `js/trips.js` | de lijst opgeslagen reizen, `laadGeoData()` | zijdelings |
| `js/vehicle.js` | voertuigprofiel en het milieuzone-oordeel (`zoneVerdict`) | zijdelings |
| `js/checklist.js` | uitrustingsgroepen en regeltaken | ja |
| `js/facts.js` | feiten, vertrouwensniveau en boetekans | **ja** — vertrouwensbalk en boetekans-totaal |
| `js/actions.js` | de actielijst: prioriteit, deadline, herkomst (`waarom.*`) | **ja** — deadlines en "waarom zie ik dit" |
| `js/costs.js` | tol en de kostenberekening | **ja** — kostenpagina |
| `js/calendar.js` | drukte per dag; dormant, wacht op een kalenderpagina | nee (fase 5) |
| `js/countries.js` | landkaart-onderdelen en de correctielink | zijdelings |

### De laag erboven — pagina's

| bestand | pagina | fase B |
|---|---|---|
| `js/app.js` | orkestratie, `switchView()`, `render()`, opstarten | **ja** |
| `js/home.js` | homepage | **ja** |
| `js/wizard.js` | de reiswizard in vier stappen | **ja** |
| `js/planner.js` | de plaatsvelden, `berekenRoute()`, de handmatige landenkeuze | **ja** |
| `js/dashboard.js` | het reisdashboard | **ja** |
| `js/acties.js` | de actiepagina | **ja** |
| `js/map.js` | de routeschets (SVG, geen kaarttegels) | **ja** |
| `js/pages.js` | regels per land, mijn reizen, reiservaring | **ja** |
| `js/document.js` | het reisdocument en print | **ja** |
| `js/share.js` | de reis in een URL | **ja** — deelbare reis |
| `js/journey.js` | reismodus (grensdetectie) en offline reispack | nee (fase C) |
| `js/incident.js` | incidentmodus | nee (fase C) |
| `js/fuel.js` | tankstrategie | nee (fase C5) |
| `js/wijzigingen.js` | de wijzigingsmonitor | nee (fase D) |
| `js/douane.js` | terugreismodus: douane en boete-herkenning | nee (fase D) |

### CSS, buiten de app

`css/base.css` (variabelen, typografie, thema), `css/components.css` (knoppen, kaarten,
chips), `css/pages.css` (de paginalayouts — verreweg het grootste bestand en het bestand dat
fase B het hardst raakt), `css/print.css` (het reisdocument op papier; dit was de regressie
uit §1 en staat er weer).

Buiten de app, en door fase B **niet** geraakt: `build/build.mjs` (statische pagina's, sitemap,
feed, de `ASSETS`-lijst in `sw.js`), `tools/verify-data.mjs` (de datacontrole),
`worker/src/*` en `functions/api/*` (route-, geocode- en dataproxy), en de databestanden zelf.

**Samengevat, wat fase B openslaat:** alle acht paginabestanden plus `app.js`, daaronder
`facts.js`, `actions.js`, `costs.js`, `checklist.js` en `trip.js`, en bij élke zin `i18n.js`
in twee talen. Wat het níét openslaat: de dienstenlaag (`routeProvider.js`, `data.js`, de
worker) en de bouwstraat. Dat is precies waarom fase A eerst kwam.

---

## 6. Welke functies stilzwijgend aannemen dat er netwerk is

De vraag achter deze vraag is: waar breekt de app als je hem meeneemt naar een parkeerplaats
zonder dekking? Alles wat het netwerk raakt zit in drie bestanden — `js/data.js`,
`js/routeProvider.js` en `js/journey.js` — plus de plekken die daaruit putten. Hieronder per
functie, met de aanname erbij.

**Neemt niets aan, meldt wat het deed**

* `laadData(naam)` / `loadData()` — `js/data.js`. Vier trappen: endpoint, gebundelde kopie,
  `localStorage`, bestandskiezer. Welke trap het werd staat in `DATA_HERKOMST`, en draaien op
  een `localStorage`-kopie zet `FROM_CACHE` aan, wat `meldCachekopie()` zichtbaar maakt. Dit
  is hoe de rest het ook zou moeten doen.
* `RouteProvider.getRoute/geocode/reverseGeocode` — `js/routeProvider.js`. De keten probeert
  elke implementatie; faalt de laatste, dan draagt de fout `.handmatig`, en dat is het signaal
  voor de handmatige landenkeuze. Geen verzonnen route, geen oude route.
* `laadChangelog()` — `js/wijzigingen.js`. Vangt stil af: geen changelog is niets te melden.
* `loadJSON("cities.json")` — `js/app.js`. Vangt af; lukt het niet, dan blijven de
  plaatsvelden verborgen en is handmatig kiezen de gewone weg. Op `file://` wordt het niet
  eens geprobeerd.
* `vulPack()` — `js/journey.js`. Fetcht met `cache:"reload"` en vangt stil af; het reispack is
  een opdracht om te cachen, geen belofte dat het lukt.
* De reismodus zelf (`startReismodus`, `journeyOpPositie`) gebruikt `navigator.geolocation`,
  geen netwerk. Ontbreekt GPS, dan zegt hij dat. Dit is de enige functie die per ontwerp
  offline hóórt te werken, en dat doet hij ook.

**Neemt het wél aan**

* `laadGeoData()` — `js/trips.js`. Hier zit de enige echte: `loadJSON("borders.json")` heeft
  geen `.catch()`, terwijl `zones.json` er direct naast er wél een heeft, mét een
  commentaarregel die uitlegt waarom ("geen zones melden is beter dan de app laten vallen").
  Bij borders is dat vergeten. Faalt dat ene bestand, dan valt de hele `Promise.all` om,
  verwerpt `berekenRoute()` met de ruwe browserfout, en toont de wizard "Failed to fetch"
  letterlijk in zijn algemene foutmelding. De uitweg is er (die melding biedt ook handmatig
  doorgaan), maar de tekst is er een van de browser en niet van de app. Eén regel werk, en het
  hoort bij de robuustheid van fase B, niet bij het fundament.
* `loadJSON()` zelf fetcht met `cache:"force-cache"`. Dat is goed voor snelheid, maar het
  betekent ook dat een tweede poging na een mislukking niet vanzelf opnieuw het netwerk raakt.
* `proxyBeschikbaar()` — `js/routeProvider.js`. Het antwoord wordt in `PROXY_CHECK` onthouden
  voor de hele sessie. Klop je één keer aan terwijl je geen bereik hebt, dan blijft de proxy
  die sessie "afwezig", ook als het bereik terugkomt. Bewust (niet bij elke route opnieuw
  kloppen), maar het is een aanname met een houdbaarheidsdatum.
* `DATA_ENDPOINT_ER` — `js/data.js`. Hetzelfde patroon één laag hoger: één mislukte poging
  zet het endpoint voor de rest van de sessie op afwezig, en de andere databestanden slaan hem
  daarna over. Bedoeld gedrag, met dezelfde kanttekening.

**Wat er niet in staat, en dat is het punt**

De checklist, het voertuigoordeel, de zones, de tolschatting, het reisdocument, de kaartschets
en de opgeslagen reizen doen geen enkele netwerkaanroep. Ze rekenen op `DATA`, `BORDERS`,
`ZONES` en het trip-object, en die staan alle vier al in het geheugen tegen de tijd dat er een
pagina getekend wordt. Zet de server uit en herlaad: de service worker levert de app, de
gebundelde kopieën leveren de data, en elke pagina rendert. Alleen een nieuwe route berekenen
en een nieuwe plaatsnaam opzoeken kan niet — en dat zijn precies de twee dingen die achter
`RouteProvider` staan, met de handmatige landenkeuze eronder.
