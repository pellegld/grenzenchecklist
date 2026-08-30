# Grenschecklist

Webapp die per grensoverschrijdende autorit laat zien welke uitrusting, vignetten en regels
je nodig hebt. Vanilla HTML/CSS/JS, geen framework en geen bundler: `index.html` laadt losse
stylesheets en classic scripts, dus de app draait ook zonder dat er ooit iets gebouwd is.

```
index.html               shell: <head>, de app-markup en de scripttags
css/base.css             kleurtokens, thema's, reset, typografie
css/components.css       navigatie, layout, routepaneel, kaarten, knoppen
css/pages.css            de pagina's
css/print.css            print / PDF
js/i18n.js               vertalingen (nl, en) en de taalkeuze
js/config.js             sleutels, drempels, geladen referentiedata, zichtbare pagina
js/storage.js            localStorage die nooit gooit, donkere modus
js/util.js               escapen, formatteren, vlaggen, iconen
js/data.js               regeldata laden, met terugval
js/routeProvider.js      route- en geocodediensten achter één interface
js/geo.js                landen, zones en tolpunten uit de routegeometrie
js/trip.js               het trip-object: de bron van waarheid, met serialisatie
js/vehicle.js            voertuigprofiel en milieuzone-oordeel
js/trips.js              de lijst opgeslagen reizen, en de handmatige landenkeuze
js/checklist.js          uitrustingsgroepen en afgeleide regeltaken
js/facts.js              feiten, vertrouwensniveaus en het boetekans-totaal
js/actions.js            de actielijst: prioriteit, deadline, reden en herkomst
js/costs.js              tol en de kostenpagina
js/calendar.js           drukte per dag
js/countries.js          de correctielink per feit
js/planner.js            de plaatsvelden en de routeberekening
js/home.js               de homepage
js/wizard.js             de reiswizard in vier stappen
js/dashboard.js          het reisdashboard
js/acties.js             de actiepagina
js/pages.js              regels per land, mijn reizen, reiservaring
js/document.js           het reisdocument
js/map.js                routeschets als SVG
js/app.js                orkestratie, events en start
fonts.css                @font-face voor de zelf gehoste fonts
fonts/                   woff2-subsets
countries.json           alle landendata (los bij te werken)
cities.json              689 Europese plaatsen voor de routeplanner
borders.json             landsgrenzen voor de landdetectie
zones.json               47 milieuzones en toegangsverboden op stadsniveau
drukte.json              drukteprognoses per dag en per periode
sw.js                    service worker voor offline gebruik
build/build.mjs          genereert statische pagina's, meta/version.json en de sw-assetlijst
meta/changelog.json      inhoudelijke wijzigingen in de regeldata
meta/version.json        afgeleide: versies en aantallen per databestand
worker/                  Cloudflare Worker: de proxy, met cache en snelheidsbegrenzer
functions/api/           dezelfde proxy als Pages Function (dunne wikkel om worker/src/)
tools/build-geodata.ps1  genereert cities.json en borders.json opnieuw
tools/build-fonts.ps1    haalt de fontsubsets opnieuw op
V2_AUDIT.md              audit van de codebase en de architectuurkeuzes eronder
README.md                dit bestand
```

### Waarom classic scripts en geen modules

`<script type="module">` laadt niet via `file://`, en de app moet blijven werken als je
`index.html` gewoon dubbelklikt — dat is het scenario waar de handmatige bestandskiezer in
`js/data.js` voor bestaat. Losse classic scripts kosten op HTTP/2 vrijwel niets extra en
houden die eigenschap intact. De volgorde in `index.html` telt daarom maar op één plek:
`js/app.js` staat onderaan, want dat bestand start de app; alles daarboven is
functiedeclaraties.

### De build step

Er is er één, en de app heeft hem niet nodig:

```bash
npm run build:sw     # ververst de ASSETS-lijst in sw.js en bumpt de cachenaam
npm run build:pages  # genereert statische pagina's uit countries.json
```

`build:sw` bestaat omdat de offline-cachelijst met de hand bijhouden een keer misgaat: een
nieuw bestand staat dan wel op de server maar niet in de cache, en dat merk je pas zonder
bereik. `build:pages` genereert nu nog niets — `PAGINAS` in `build/build.mjs` is leeg. De
pipeline staat er alvast zodat de SEO-pagina's uit §27 van de masterprompt straks uit
dezelfde `countries.json` komen als de app, in plaats van met de hand geschreven te worden
en binnen een jaar uit de pas te lopen.

## Vormgeving

De app volgt een roadbook-esthetiek: donkerblauwe achtergrond, afgeronde panelen, één vet
sans-serif door de hele hiërarchie, en monospace voor cijfers en sectienummers.

| rol | font | gebruik |
|---|---|---|
| koppen | Manrope 800 | `h1` (52 px), `h2` (26 px) |
| kaartkoppen | Manrope 700 | groepstitels |
| labels | Manrope 600 | kwalificaties, veldlabels, badges |
| lopende tekst | Manrope 400 / 500 | body, checklistregels |
| cijfers | JetBrains Mono 700 | statwaarden, prijzen, sectienummers |

Palet: achtergrond `#0a0f18`, paneel `#121a26`, tekst `#eef2f8`, gedempt `#8996ab`, randen
`rgba(238,242,248,.07)` op 0,8 px. Accenten: **teal `#35d6c0`** voor bedragen en actieve staat,
amber `#e0b341` voor *let op*, oranje `#e07a49` voor blokkades, groen `#3fa877` voor *in orde*.

Kaarten hebben een radius van 18 px, kleinere elementen 10 px.

Secties zijn geen dozen maar velden, gescheiden door een haarlijn, met een serif-kop links en een
monospace nummer rechts (`01 — ROUTE`). Dat nummer komt uit `data-label` op de `h2` en wordt met
`::after` gezet, dus het staat niet dubbel in de tekst.

**De hero** volgt de referentie: koptekst links, een omlijnd paneel rechts met drie cellen —
monospace label boven, grote serif waarde eronder. Vanaf 900 px staan ze naast elkaar, daaronder
gestapeld.

| cel | bron |
|---|---|
| Afstand | `ROUTE_RES.total` uit de route-analyse |
| Tol, heen en terug | bovenkant van de kilometerschatting plus de tolpunten, maal twee |
| Ingepakt | afgevinkte van de verplichte uitrusting |

Voor dat tolbedrag heeft elk tolpunt naast de leesbare `price` ook een optelbare `priceEur`. Die
staat er alleen bij als het tarief hard is; ontbreekt hij, dan telt het punt niet mee en zet de
app *"of meer"* achter het bedrag. Autotreinen tellen nooit mee — dat is een keuze, geen kost.

Afstand en tol kennen we alleen als de routeplanner gebruikt is. Bij een handmatige landenlijst
tonen die cellen een streepje in plaats van een verzonnen getal.

**Maatvoering**, overgenomen uit de referentie: `--maxw` 1080 px met een `--gutter` van 28 px, dus
1024 px inhoud. Het raster is drie kolommen van 332 px met een gap van 14 px — zowel voor de
statkaarten in de hero als voor de checklistgroepen. Onder 980 px worden dat twee kolommen, onder
660 px één, en de gutter zakt naar 20 px.

Lopende tekst is begrensd op `--leesbreedte` (66 tekens), zodat notities in de landkaarten niet
over de volle breedte uitlopen.

**Bewust alleen donker.** Het ontwerp is daarop gebouwd; er is geen lichte variant meer. De
printstylesheet zet alles terug naar zwart op wit, inclusief de accentkleur.

**Fonts staan lokaal.** Manrope en JetBrains Mono vallen onder de SIL Open Font License, dus zelf
hosten mag. Beide zijn **variabele fonts**: één bestand per subset dekt het hele gewichtsbereik
(Manrope 400–800, Mono 400–700). Dat scheelt fors — vier bestanden van samen 81 KB in plaats van
acht statische instanties van 152 KB.

Alleen de `latin` en `latin-ext` subsets zijn meegenomen; latin-ext is nodig voor namen als
*dálniční známka*. Er gaat niets naar Google Fonts en de app blijft volledig offline werken.
Opnieuw ophalen kan met `tools/build-fonts.ps1`.

Let op bij dat script: de CSS van een variabele as geeft `font-weight: 400 800`. Dat bereik moet
heel doorgegeven worden aan de `@font-face`, anders werkt maar één gewicht.

**Onderzoeksdatum data: 19 augustus 2026.** Elk land draagt een eigen `lastVerified`-datum die
in de app zichtbaar is; is die ouder dan 240 dagen, dan markeert de app hem als verouderd.

---

## Talen

De app is Nederlands en Engels. Kiezen kan onder *Instellingen* in de zijbalk, en op
mobiel met de NL/EN-knop in de topbalk — de zijbalk is daar verborgen, dus zonder die
knop zou de taalkeuze op een telefoon onbereikbaar zijn. De keuze staat in
`localStorage`; is er nog geen keuze, dan volgt de app `navigator.languages` en valt
terug op Nederlands.

```js
i18n("taak.vignet", { land: "Oostenrijk" })   // "Vignet kopen voor Oostenrijk"
i18nAantal("reizen.landen", 3)                // "3 landen" / "1 land"
```

Statische markup gebruikt attributen, zodat er geen JS aan te pas komt om een label te
vullen:

```html
<h1 data-i18n="planner.titel">Route Plan</h1>
<input data-i18n-placeholder="planner.vertrekplaats">
<button data-i18n-aria="planner.omdraaien">
```

Ook `data-i18n-html` (voor tekst met links erin) en `data-i18n-title`. `pasTaalToe()`
loopt ze bij elke taalwissel opnieuw af.

**Waarom `i18n()` en niet `t()`.** `t` is in deze codebase al de gangbare naam voor een
taak, een tolpost en een drempelobject. Een globale functie die daardoor in de helft van
de renderfuncties overschaduwd wordt, is een bug die pas opvalt als iemand van taal
wisselt.

**Samengestelde zinnen staan heel in de tabel**, met plaatshouders:

```js
"zone.voldoetNiet": "Euro {euro} voldoet NIET: hier is minimaal Euro {need} vereist{scope}."
```

Niet als fragmenten die de code aan elkaar plakt. Dat laatste valt niet te vertalen —
woordvolgorde verschilt per taal, en juist de milieuzone-oordelen zijn de zinnen waar
het op aankomt.

**De landdata blijft Nederlands.** `note`, `rule`, `howToGet` en de quirks in
`countries.json` en `zones.json` zijn honderden zorgvuldig geformuleerde alinea's; die
vertalen is een apart project. Een halfvertaalde regelpagina is gevaarlijker dan een
Nederlandse, dus zegt de app het gewoon zodra je Engels kiest:

> The per-country rule texts are only available in Dutch.

Wat wél meebeweegt: datums (`fmtDate` haalt de maandnamen uit de tabel), getallen
(`getal()` gebruikt de locale van de gekozen taal) en de `accept-language` waarmee de
geocoder wordt bevraagd.

**Een taal toevoegen** is: een derde blok in `VERTALINGEN`, de code in `TALEN`, en een
`<option>` in `index.html`. Ontbreekt er een sleutel, dan valt hij terug op het
Nederlands in plaats van op de sleutelnaam — een half vertaalde taal moet leesbaar
blijven.

---

## Draaien

**GitHub Pages of een webserver** — gewoon de map serveren, werkt meteen.

**Lokaal met een servertje:**

```bash
py -m http.server 8731
```

Daarna http://localhost:8731 openen.

**Direct via `file://`** — dubbelklikken op `index.html` werkt, met één kanttekening: browsers
blokkeren `fetch()` van een bestand naast een `file://`-pagina, dus `countries.json` kan niet
automatisch geladen worden. De app vangt dat op en vraagt je het bestand één keer handmatig te
kiezen. Daarna staat het in `localStorage` en werkt de app volledig offline, ook bij een volgende
keer openen. Dat is bewust zo: de data blijft in één los bestand staan in plaats van hard in de
HTML gebakken.

De app haalt verder niets van buitenaf — geen fonts, scripts of afbeeldingen. De vlaggen zijn
met CSS getekend, zodat ze ook op Windows en in print goed weergeven.

### Offline

`sw.js` cachet de app zodra je hem één keer met bereik hebt geopend. Daarna laadt alles vanuit
de cache, ook zonder netwerk — precies het scenario waarvoor de app bedoeld is. De strategie is
*stale-while-revalidate*: je krijgt altijd meteen de gecachte versie, en op de achtergrond wordt
ververst, zodat een bijgewerkte `countries.json` de volgende keer vanzelf verschijnt.

Onder in het routeblok staat de status: *"Offline klaar"* betekent dat het gelukt is. Een service
worker vereist https of localhost; via `file://` bestaat de API niet en valt de app terug op de
`localStorage`-kopie. Sommige ingebouwde of afgeschermde browsers blokkeren registratie — de app
zegt dat dan, en werkt gewoon door zonder offline-garantie.

Bump `CACHE` in `sw.js` als je een release uitbrengt waarin oude bestanden echt weg moeten;
`npm run build:sw` doet dat vanzelf zodra de assetlijst wijzigt.

De install haalt elk bestand op met `cache: "reload"`. Zonder die vlag leest `addAll()` uit de
HTTP-cache van de browser, en dan kan er een verouderde `index.html` de offline cache in
gebakken worden — precies het bestand dat je daarna zonder bereik krijgt, en dat blijft zitten
tot je `CACHE` weer bumpt. Dat is tijdens het testen een keer echt gebeurd: de app laadde
offline een `index.html` van vóór een nieuwe scripttag, en dus zonder die module.

Lukt het ophalen van `countries.json` niet en valt de app terug op de `localStorage`-kopie, dan
zegt hij dat met zoveel woorden, inclusief de onderzoeksdatum van die kopie. Stilzwijgend
verouderde verplichtingen tonen is het ergste wat deze app kan doen.

Let op: `fetch(..., {cache:"no-store"})` wordt niet door elke browser gehonoreerd — in tests bleek
een ingebouwde webview gewoon uit de HTTP-cache te serveren. De service worker is de betrouwbare
laag voor versheid, niet die vlag.

---

## De reis is één object

Alles wat de app over de actieve reis weet, staat in één object in `js/trip.js`:

```js
{
  id, naam, createdAt, updatedAt,
  origin: { naam, omschrijving, land, lat, lon },   // of null
  destination: { ... },
  departureDate: "2027-07-12", returnDate: "2027-07-19",
  vehicle: { plateCountry, fuel, euro, type, gewichtKg, hoogteM },
  route: { coordinates, meters, seconds, provider, analyse },   // of null
  countries: ["BE", "DE", "AT"],
  ticked: { "task:vig:AT": 1 },
  metadata: { stap, geanalyseerd, handmatig }
}
```

`TRIPS` is de lijst opgeslagen reizen; `TRIP` **wijst naar** een element daarvan, dus er wordt
niets gekopieerd en er kan niets uit de pas lopen. Elke functie die over een reis rekent —
`buildTasks(trip)`, `checklistTelling(trip)`, `zoneVerdict(c, trip)`, `tolRegels(trip)` — krijgt
hem als parameter.

Dat was er eerder niet. Het werkgeheugen zat in een stuk of tien globals (`ROUTE`, `HOME`, `VEH`,
`DEPART`, `TICKED`, `FROM_CITY`, `TO_CITY`, `ROUTE_COORDS`, `ROUTE_RES`, `ROUTE_ZONES`,
`ROUTE_TOLLS`, `ROUTE_DURATION`) met twee functies die heen en weer kopieerden. Dat werkte, en het
was consistent, maar het kostte drie dingen:

* een nieuwe eigenschap moest op vier plekken bij: de global, het wegschrijven, het inlezen en de
  migratie;
* de voortgangsbalk per rit op *Mijn reizen* kon alleen door de globals tijdelijk om te wisselen
  (`metTrip()`), want de checklistfuncties lazen ze rechtstreeks;
* een half ingevulde reis — precies wat een wizard oplevert — was er niet in te modelleren.

**Serialisatie loopt over een expliciete whitelist** (`serialiseerTrip`). Afgeleide waarden gaan
niet mee: zones en tolpunten langs de route staan onder `trip._afgeleid` en worden opnieuw
berekend bij het activeren. Dat kost milliseconden; een verouderde kopie tonen kost vertrouwen.
De routegeometrie wordt uitgedund (elk derde punt) voordat hij de opslag in gaat.

`leesTrip()` leest ook de vorige vorm, zodat een reis die vóór deze wijziging is opgeslagen
gewoon blijft bestaan — inclusief de nog oudere losse `localStorage`-sleutels uit versie 1.

### De reis binnenkomen: de wizard

De wizard (`js/wizard.js`) vraagt in vier stappen wat er nodig is en schrijft rechtstreeks in
`TRIP`; er is geen aparte formulierstaat die daarna overgeschreven moet worden. De stap zelf staat
in `metadata.stap`, dus wie halverwege wegklikt, komt terug waar hij was.

| stap | vraagt | valt terug op |
|---|---|---|
| 1 | vertrek en bestemming, met de autocomplete uit `cities.json` | online zoeken via `RouteProvider.geocode` |
| 2 | vertrekdatum, en optioneel de retourdatum | vandaag |
| 3 | kentekenland, brandstof, euroklasse, voertuigtype, en optioneel gewicht en hoogte | Nederlands kenteken, benzine, personenauto |
| 4 | de analyse | de handmatige landenkeuze |

Stap 4 laat zien wát er gecontroleerd wordt — route, landen, milieuzones, tol, voertuig — en houdt
die lijst daarna staan. Het is geen laadbalk: hij duurt bijna niets, en de waarde zit in wat er
staat, niet in de wachttijd.

De wizard kent **vier voertuigtypen en vier brandstoffen**, terwijl `countries.json` er minder
kent. Twee afbeeldingen, allebei op één plek in `js/vehicle.js`: een caravan is voor de
`vehicleNotes` een aanhanger, en een hybride wordt in milieuzones op zijn verbrandingsmotor
beoordeeld — dat is bij personenauto's vrijwel altijd benzine. Wie een diesel-hybride rijdt kiest
diesel; dat staat als hint bij het veld. Liever een expliciete afbeelding dan een vijfde waarde in
de data die nergens onderzocht is.

**Als de routeberekening faalt** (§20) verschijnt er geen foutcode maar een uitleg met twee
uitwegen: opnieuw proberen, of *handmatig doorgaan*. Die tweede knop opent de landenbouwer die er
altijd al was. Wat je zonder berekende route mist — afstand, reistijd, kilometertol, kaartschets —
staat er met zoveel woorden bij, want een getal verzinnen is erger dan het weglaten.

---

## Wat de app doet

De navigatie volgt de informatiearchitectuur uit §3 van de masterprompt: **Reis · Acties · Kaart ·
Kosten · Regels · Document**, en op mobiel dezelfde vier plus *Meer*. Elke bestemming leidt naar
een pagina die er echt is; een navigatie-item zonder pagina is erger dan geen item.

| pagina | wat er staat |
|---|---|
| **Home** | wat het product is, en één knop. Met het voorbeeld Brussel → Salzburg als **statische illustratie** — die draagt dat label ook in de kaart zelf |
| **Reis** | het dashboard: waar ga je heen, hoe ver ben je, wat moet je eerst regelen, wat riskeer je, en waar de informatie vandaan komt |
| **Acties** | één actielijst, gegroepeerd naar wat eerst moet; met deadline, herkomst en bron per actie |
| **Kaart** | de routeschets als SVG, met de plaatsvelden, de landenlijst, de milieuzones en het voertuigprofiel ernaast |
| **Kosten** | het tol-kasboekje: één regel per post in routevolgorde, met het retourtotaal, plus een lijst van wat er *niet* in zit |
| **Regels** | per land eerst de conclusie (mag ik rijden, moet ik iets regelen), daaronder de details uitklapbaar |
| **Document** | één printbare pagina om mee te nemen, opgebouwd uit dezelfde bouwers als de rest |
| **Meer** (mobiel) | Regels, Document, Reiservaring, Mijn reizen en de donkere modus |

### Het dashboard

Bovenaan de reis zelf: vlaggen, plaatsen, periode, voertuig. Daaronder de voortgang en de tellers
voor *geregeld*, *acties*, *problemen* en *let op*. Elke teller draagt een eigen teken en een
woord; kleur alleen is geen betekenis (§21).

Daarna wat je moet regelen — blokkades bovenaan — met per regel het land, de reden, en een link
naar de officiële bron.

Twee dingen staan er die niet in de masterprompt staan.

#### Het boetekans-totaal

> Als je niets regelt loop je op deze route circa **€220 of meer** risico.

De app noemde per land wel een boetebedrag, maar nergens wat het samen is. Juist dat getal maakt
het verschil tussen een lijstje en iets waar je vanavond nog wat mee doet. Het rekent uit de
`fineIndication`-velden die al in `countries.json` staan, met drie regels waar niet van afgeweken
wordt:

* **alleen over openstaande acties.** Wat je hebt afgevinkt is geen risico meer. Blokkades tellen
  wél mee — die zijn per definitie niet geregeld, en het is dezelfde boete. Dubbeltellen kan niet:
  een land levert óf een blokkade óf een zone-actie op;
* **alleen bedragen die als euro's in de data staan.** Een boete in frank, pond of kronen wordt
  niet omgerekend: dat zou een wisselkoers verzinnen die we niet hebben. Zo'n post verschijnt in de
  uitsplitsing als *niet in euro's*;
* **als bandbreedte, en met "of meer".** Staat er een actie zonder bekend eurobedrag, dan komt er
  *of meer* achter het totaal in plaats van een getal dat te laag is zonder dat je dat ziet.

Het lezen van de bedragen (`euroBedragen()` in `js/facts.js`) is met opzet streng: alleen getallen
die zelf aan een euro-aanduiding vastzitten tellen mee. In *"vanaf 3 maanden na een eerste
overtreding tot 350 euro"* is de 3 een aantal maanden, en die als € 3 meetellen zou de ondergrens
onzin maken. Bereiken (*"80 tot 120 euro"*) worden apart herkend, want daar draagt alleen het
tweede getal de eenheid.

#### De vertrouwensbalk

> Deze reis is gebaseerd op 39 feiten. 10 officieel bevestigd, 27 gecontroleerd, 2 onzeker.
> Laatst gecontroleerd: 19 augustus 2026.

De `confidence`-velden uit de vorige fase stonden in de data maar nergens op het scherm. Onderaan
het dashboard staat nu wat de reis waard is, klikbaar naar precies de feiten die onzeker zijn —
met hun bron en de reden waarom ze onzeker zijn. Een balk die alleen een getal noemt en je daarna
laat zoeken, is een balk die niemand gebruikt.

Twee keuzes in de telling:

* **alleen de feiten die deze reis ook echt gebruikt.** Een tolpunt in Denemarken zegt niets over
  een rit naar Oostenrijk, en een voertuignotitie voor campers niet over een personenauto. Zonder
  berekende route telt geen enkel tolpunt mee, want dan weten we niet welke je raakt;
* **de oudste controledatum, niet de nieuwste.** "Laatst gecontroleerd" moet een belofte zijn die
  voor de hele reis geldt. De nieuwste datum tonen terwijl één land al een jaar niet is nagekeken,
  is precies de schijnzekerheid die deze app moet vermijden. Is die datum ouder dan `STALE_DAYS`,
  dan kleurt de balk amber en zegt hij dat erbij.

#### Herkomst per actie

Elke actie uit `buildTasks()` draagt sinds deze fase `factId`, `confidence`, `sourceUrl`,
`lastVerified` en `fineIndication` van het feit waar hij op rust. De renderlaag toont daar nu één
link van (*Officiële bron*) via `herkomstRegelHTML()`; dat is het ene aangrijpingspunt waar de
volle herkomstregel uit sessie B2 landt. Het is geen dode voorbereiding: het boetekans-totaal en
de vertrouwensbalk lezen dezelfde velden.

---

### De routeplanner

Vul vertrekplaats en bestemming in en de app vult de landenlijst zelf. In drie stappen:

1. **Plaats kiezen** — autocomplete uit `cities.json`, 689 Europese plaatsen. Zoekt op de
   Nederlandse én de lokale naam, accentongevoelig: `wenen` en `vienna` vinden allebei Wenen.
   Geen netwerk nodig, geen rate limit, geen wachttijd. Staat een plaats er niet bij, dan
   verschijnt *"online zoeken naar …"* — dat is een expliciete klik naar Nominatim, geen
   zoeken-tijdens-typen, want dat staat hun beleid niet toe.
2. **Route ophalen** — één aanroep naar de OSRM demo-server, die de routegeometrie teruggeeft.
3. **Landen bepalen** — de geometrie wordt om de 2 km bemonsterd en elk monster met
   point-in-polygon getoetst tegen `borders.json`. De afstand per land wordt opgeteld, de
   volgorde volgt uit de eerste passage.

De landdetectie zit dus lokaal, niet bij de routeprovider. Dat maakt hem onafhankelijk van welke
router je gebruikt en maakt een latere GPX-import bijna gratis.

**Wat de planner nooit doet: hem overrulen.** Hij vult de landenlijst vóór; daarna kun je landen
toevoegen, verwijderen en herordenen zoals altijd. Valt OSRM weg, zit je zonder bereik, of is de
planner uitgeschakeld — dan werkt de handmatige bouwer precies zoals eerst. Route-invoer is een
versneller, geen vervanging.

De planner verschijnt alleen als `cities.json` geladen kon worden, dus niet via `file://`. Dat is
geen verlies: de routeberekening heeft sowieso netwerk nodig.

#### Drie waarschuwingen die hij zelf geeft

- **Land nog niet in de checklist.** Een route Praag–Warschau detecteert Polen, meldt dat het
  ontbreekt, en voegt het níét toe. Meteen een signaal welk land je zou moeten toevoegen.
- **Kort aangeraakt.** Onder de 15 km krijg je een controlevraag. Rotterdam–Milaan pikt bij Bazel
  4 km Frankrijk op — dat klópt (de A5 scheert langs Saint-Louis), maar vlak langs een grens is
  de detectie het minst zeker. Andersom is Utrecht–Zagreb met 63 km Slovenië precies het
  vignetland dat mensen vergeten.
- **Buiten alle landsgrenzen.** Amsterdam–Londen meldt 26 km die nergens in viel: het Kanaal.
  Veerboten en tunnels vallen zo vanzelf op in plaats van stilletjes verkeerd geteld te worden.

### Steden op je route

De landdata werkt met de **strengste zone per land**. Dat is veilig maar grof: met een Euro 4
diesel mag je in 2026 wél Straatsburg en Lyon in, maar niet Parijs of Grenoble. Zodra de
routeplanner gebruikt is, toetst de app daarom ook op stadsniveau tegen `zones.json`.

Detectie: de route wordt bemonsterd en voor elke zone wordt de kortste afstand tot het opgegeven
middelpunt berekend. Ligt die onder `radiusKm`, dan wordt de zone gemeld. Dat is een **benadering
van de zonegrens**, geen exacte toets — vandaar de formulering "dit geldt als je de stad in rijdt;
passeer je op de snelweg eromheen, dan meestal niet".

Elke zone krijgt hetzelfde oordeel als op landniveau, maar tegen zijn eigen drempel:

```jsonc
{
  "id": "zone.fr-strasbourg", "city": "Straatsburg", "cc": "FR",
  "name": "ZFE-m Eurometropole de Strasbourg",
  "type": "milieuzone",              // "milieuzone" | "ztl" | "tolzone"
  "lat": 48.573, "lon": 7.752, "radiusKm": 10,
  "threshold": { "diesel": 4, "petrol": 2 },   // null = toegangsverbod, geen euronorm
  "rule": "...", "note": "...", "sourceUrl": "...",
  "lastVerified": "2026-08-19", "needsVerification": false, "confidence": "official"
}
```

**Dekking: 47 zones in 11 landen** (DE 11, FR 11, IT 8, GB 4, NL 4, BE 3, ES 2, en één elk voor
SE, DK, PT, CZ). Bewust niet uitputtend — Frankrijk, Duitsland, Italië en Spanje hebben er samen
honderden. **21 van de 47 staan als onzeker gemarkeerd**; die tonen een waarschuwing in de app.

### Tol onderweg

`countries.json` heeft per land een `tollRoads` met een indicatief tarief:

```jsonc
"tollRoads": { "type": "peage", "perKm": 0.10, "note": "..." }
```

De app vermenigvuldigt dat met de kilometers die de route door dat land loopt en toont een
**bandbreedte**: de onderkant gaat uit van de helft tolweg, de bovenkant van alles tolweg. Onder
de 25 km per land wordt de schatting weggelaten, want een schatting van een paar euro over een
grensstrookje is ruis.

#### Tolpunten: tunnels, passen en bruggen

Kilometertol is niet het hele verhaal. Een vignet dekt lang niet alles: in Oostenrijk betaal je
op de **Sondermautstrecken** een apart bedrag per doorgang, bovenop het vignet. Dat zijn precies
de kosten die mensen niet zien aankomen. Daarom een `tollPoints` per land:

```jsonc
"tollPoints": [
  { "name": "A13 Brennerautobahn", "lat": 47.10, "lon": 11.47, "radiusKm": 15,
    "price": "12,50 euro enkele reis", "note": "...", "sourceUrl": "...",
    "needsVerification": false }
]
```

Detectie werkt hetzelfde als bij de stadszones: middelpunt plus straal tegen de routelijn. De app
meldt daarom dat je route er *langs komt*, niet dat je er *doorheen rijdt* — bij de Mont Blanc
kun je immers ook over de Col des Montets.

Nu opgenomen:

| land | tolpunten |
|---|---|
| Oostenrijk | Brenner € 12,50 · Tauern/Katschberg € 15,00 · Arlberg € 13,00 · Karawanken € 9,00 · plus Gleinalm, Grossglockner en Felbertauern zonder bevestigd tarief |
| Zwitserland | Grote Sint-Bernhard CHF 33,40 · Munt la Schera CHF 17–35 · drie autotreinen |
| Frankrijk | Mont Blanc en Fréjus, elk ruim € 56 |
| Denemarken | Storebælt ≈ € 31 · Øresund ≈ € 63 |

**Vignet ≠ alles gedekt, maar het verschilt sterk per land.** Oostenrijk laat je bovenop het
vignet nog per tunnel betalen; Zwitserland doet juist het omgekeerde — daar zitten de Gotthard en
de San Bernardino gewoon in het vignet. Zürich → Milaan levert dan ook terecht géén tolpunten op,
terwijl Salzburg → Ljubljana de Tauern én de Karawanken vindt: € 24 bovenop twee vignetten.

**Optionele punten.** Zwitserse autotreinen (Lötschberg, Vereina, Furka) zijn geen tol maar een
alternatief dat je kiest, vooral als de passen dicht zijn. Die krijgen `"optional": true` en
staan onder een eigen kopje. Bevat een route alléén optionele punten, dan heet het blok
"Onderweg in de bergen" in plaats van "Tunnels, passen en bruggen", want er valt dan niets
verplicht te betalen.

Bekende zwakte: niet elke kilometer door Frankrijk is autoroute. Spanje is het scheefst — daar
zijn veel AP-wegen sinds 2021 gratis — en staat daarom als onzeker gemarkeerd.

De OSRM demoserver ondersteunt `exclude=toll` niet (400 Bad Request), dus een tolvrij alternatief
berekenen kan niet met deze routeprovider.

### De actielijst

Alles wat je moet doen staat in één lijst (`js/actions.js`), gebouwd uit vier producenten die
voorheen los van elkaar op het scherm stonden: de vier universele documenten, de uitrusting per
land, de afgeleide regeltaken (vignet, milieusticker, winterbanden, apparatuur) en de
voertuignotities.

Waarom één lijst: de gebruiker heeft geen drie categorieën taken, hij heeft één avond vóór
vertrek. De vraag is niet "welk soort taak is dit" maar "wat moet ik eerst doen en wanneer
uiterlijk". De groepen volgen die vraag:

| groep | inhoud |
|---|---|
| **Eerst oplossen** | je auto mag een milieuzone op deze route niet in; niet af te vinken |
| **Voor vertrek** | vignet, milieusticker, registratie, winterbanden, flitsapp en dashcam |
| **In de auto** | de documenten en de uitrusting die hier afdwingbaar is |
| **Aanbevolen** | verstandig, maar geen boete |
| **Let op** | regels voor aanhanger of camper; geen taak, wel iets om te weten |
| **Klaar** | alles wat je hebt afgevinkt, ongeacht waar het vandaan kwam |
| **Niet voor jouw kenteken** | staat in de wet daar, maar geldt niet voor jouw auto |

Die laatste twee staan ingeklapt. **"Niet voor jouw kenteken" is geen restcategorie maar het
belangrijkste onderscheid dat deze app maakt** (zie *verplicht ≠ beboetbaar* verderop); hij
verdwijnt daarom niet in "aanbevolen" en legt in zijn groepskop uit waaróm hij niet voor jou
geldt. Die items telden overigens wél mee in de voortgangsnoemer maar stonden nergens op het
scherm — 100% was dus onbereikbaar zodra er één was. Ze tellen nu niet meer mee en zijn wel
zichtbaar.

Afvinken verplaatst een actie naar *Klaar*. De pagina wordt daarvoor opnieuw opgebouwd, dus de
scrollpositie blijft staan, de focus verhuist mee naar hetzelfde vinkje in zijn nieuwe groep
(die daarvoor openklapt), en een schermlezer hoort *"Vignet kopen voor Oostenrijk afgevinkt en
verplaatst naar Klaar"*.

De sleutels in `trip.ticked` zijn niet gewijzigd. Een reis die half afgevinkt was voordat deze
pagina bestond, is dat nog steeds.

#### Elke actie draagt zijn herkomst

```
🇦🇹 Vignet kopen voor Oostenrijk
   ! Actie · 📅 Regel dit uiterlijk 2 september 2026 · Vanaf € 9,60
   Digitaal via de ASFINAG-webshop of app, of als sticker bij tankstations…
   ⚠ Niet zeker — controleer de officiële bron. Prijzen worden jaarlijks
     geïndexeerd. Officiële website →
   ▸ Waarom zie ik dit?
       omdat je route 289 km door Oostenrijk loopt
       Boete zonder: Ersatzmaut van circa 120 euro ter plaatse
       [onzeker] gecontroleerd op 19 augustus 2026
       Officiële website →   Klopt dit niet?
```

**De reden is afgeleid, niet ingetypt.** Hij komt uit de route-analyse (`route.analyse.km` per
land) en het voertuigprofiel, niet uit een tekst per item. Dat is het verschil tussen "dit geldt
in Slovenië" — dat wist je al — en "je route loopt er 63 km doorheen", wat verklaart waarom het
op jóuw scherm staat. De zinnen staan heel in de vertaaltabel met plaatshouders:

| situatie | reden |
|---|---|
| land op een berekende route | *omdat je route 289 km door Oostenrijk loopt* |
| land met de hand toegevoegd | *omdat je Oostenrijk zelf aan je route hebt toegevoegd* |
| registratieplicht voor buitenlanders | *…, en je auto staat niet in België geregistreerd* |
| blokkade | *…, en je rijdt diesel Euro 4 en hier is minimaal Euro 6 vereist* |
| winteruitrusting | *…, en je vertrekdatum (12 december 2026) valt in de winterperiode* |
| niet voor jouw kenteken | *dit geldt alleen voor auto's met een kenteken uit Duitsland; jouw auto staat in Nederland geregistreerd* |
| documenten | *omdat dit voor elke rit over de grens geldt* |

**Onzekerheid staat niet achter de uitklap.** Wie een boete riskeert op grond van een feit dat wij
niet hard kunnen maken, hoort dat te zien zonder te klikken — dus staat *"Niet zeker —
controleer de officiële bron"* met de `verificationNote` en de link gewoon in de kaart (§13).

**De correctielink staat bij elke actie**, niet meer alleen onder de landkaart, en draagt het
`id` van het feit waarop je klikte. Een binnenkomende melding is daarmee aan één feit te
koppelen in plaats van aan een heel land — precies waar de structuur uit fase A op mikte. Werkt
de klembord-API niet (via `file://`, of in een browser die hem blokkeert), dan verschijnt het
meldvenster; sluiten zet de focus terug op de knop waarmee je hem opende.

De vier universele documenten dragen géén betrouwbaarheidsniveau. Ze rusten op geen enkel feit
in `countries.json`, en ze "niet beschikbaar" noemen zou suggereren dat we het probeerden na te
zoeken en niets vonden.

#### Deadlines zijn richttijden, geen termijnen

Elke actie kan een deadline krijgen, teruggerekend vanaf `departureDate` (§8):

> 🔴 Vandaag regelen · 🟠 Regel dit uiterlijk 7 juli · Dit had al geregeld moeten zijn

**Dit zijn richttijden van de app.** Ze zeggen hoeveel voorbereiding iets kost, niet wanneer de
wet iets eist, en de pagina zegt dat er met zoveel woorden bij. Een datum die eruitziet als een
regel terwijl hij een schatting is, is precies de schijnzekerheid die deze app moet vermijden.

| soort | dagen vooraf | waarom |
|---|---|---|
| milieusticker | 14 | komt per post; *"levering naar het buitenland duurt al snel een tot twee weken"* (`fr.environmentalZone.howToGet`) |
| registratie | 2 | gaat online, maar niet elke gemeente verwerkt dezelfde dag |
| betaling (ULEZ e.d.) | 0 | kan bij de meeste zones ook nog kort na de rit |
| vignet | 1 | koop je aan de grens of bij het eerste tankstation |
| winteruitrusting | 7 | banden en kettingen moet je halen, en in het seizoen zijn ze op |
| documenten | 14 | een verlopen rijbewijs vervangen kost bij de gemeente een week of langer |
| apparatuur | 0 | flitsmeldingen uitzetten kan op de oprit |

Eén uitzondering staat wél hard in de data en is daarom aan een `factId` gekoppeld in plaats van
aan een soort: bij online aankoop van het **Oostenrijkse vignet** geldt een wettelijke bedenktijd
van 18 dagen voordat het ingaat (`at.tollVignette.howToGet`). Die deadline draagt geen
"richttijd"-voorbehoud, want hij is er geen.

#### Prijs alleen als hij in de data staat

`howToGet` en `note` bevatten bij een handjevol landen een indicatief tarief. Eén bedrag is een
prijs (*Crit'Air, € 3,11*); meer bedragen betekent dat het van de duur of de voertuigcategorie
afhangt, en dan is **"vanaf"** het enige eerlijke woord (*vignet Oostenrijk, vanaf € 9,60*).
Staat er geen bedrag, dan staat er geen bedrag — dan doet de link naar de officiële bron het
werk. Er wordt niets omgerekend en niets gemiddeld.

#### Twee gevallen die eerder stilletjes verdwenen

`zoneVerdict()` levert soms `unknown`, en dat leverde tot nu toe helemaal geen regel op — terwijl
het juist het geval is waarin de gebruiker iets moet doen. Nu krijgen ze status **ONBEKEND**:

* **de euronorm is niet ingevuld** → één actie voor alle landen samen, met een knop naar stap 3
  van de wizard. Vier keer dezelfde vraag stellen is geen checklist maar geklaag;
* **de drempel verschilt te sterk per gemeente** (Portugal, Italië) → één actie per land, met de
  officiële bron.

### De regelpagina

Per land twee vragen bovenaan, als conclusie:

> **Mag ik hier rijden?** ✓ Ja — *Euro 6 voldoet: hier is minimaal Euro 5 vereist (Crit'Air 3
> geweerd).*
>
> **Moet ik iets regelen?** ! Ja, 2 dingen — *met de acties eronder en een knop naar je lijst.*

Die tweede vraag leest dezelfde actielijst als de actiepagina; er is geen tweede waarheid over
wat er open staat.

Daaronder staan de details in uitklapbare secties, en **de kop van elke sectie draagt het
belangrijkste feit al**:

```
Snelheid            130 km/u, maar 100 km/u op alle IG-L-trajecten      +
Uitrusting          3 verplicht, 0 aanbevolen                           +
Milieuzone en tol   Milieuzone én vignet                                +
Winteruitrusting    1 november tot en met 15 april                      +
Bijzondere regels   4 regels                                            +
Bronnen             3 bronnen                                           +
```

Dat is wat progressive disclosure hoort te zijn: je hoeft niets open te klappen om te weten waar
het over gaat, en de praktische conclusie staat nooit onder de juridische details (§15). Elke
sectie draagt zijn eigen bron, controledatum, betrouwbaarheidsniveau en correctielink (§13,
§16); is de landdata ouder dan `STALE_DAYS`, dan staat dat als balk boven de pagina.

De uitrusting houdt drie eigen koppen met uitleg — *verplicht op deze route*, *alleen voor een
kenteken uit dit land*, *aanbevolen* — in plaats van één lijst met badges. Dat onderscheid is de
belangrijkste correctie die deze app maakt en mag niet vervlakken.

### Toegankelijkheid

* **Status nooit alleen in kleur.** Elke status draagt een teken (`✗ ! i ✓ ?`) en een woord;
  kleur is de derde laag. In fel zonlicht op een parkeerplaats is kleur het eerste dat wegvalt.
* **Skiplink** naar de inhoud, want anders loop je met de tab-toets elke pagina opnieuw de hele
  navigatie af.
* **Koppenvolgorde zonder sprongen**, op alle tien de pagina's gecontroleerd.
* **Vinkjes met een echte naam**: `aria-labelledby` op de titel, `aria-describedby` op de status-
  en deadlineregel. Een schermlezer leest *"Vignet kopen voor Oostenrijk, selectievakje, niet
  aangevinkt — Actie, regel dit uiterlijk 2 september"*.
* **Toetsenbord**: Enter en spatie werken op de landrijen, die alleen naar een muisklik
  luisterden. Escape sluit het Meer-paneel en het meldvenster, met focusherstel.
* **Raakvlakken minstens 24 px** (WCAG 2.5.8). Dertien elementen zaten daaronder — vooral
  tekstknoppen en uitklappers van 15 tot 18 px.
* **Contrast** gemeten met de samengestelde achtergrond (die containers zijn halfdoorzichtig, dus
  de kleurwaarde alleen zegt niets) in beide thema's; alle tekst boven 4,5:1.
* **Reduced motion** en zichtbare focus stonden er al.

### Tol onderweg

Tolkosten stonden eerst als twee `<h3>`-blokken onderin de stedensectie — een vreemde plek voor
het enige getal op de pagina dat over geld gaat. Ze hebben nu een eigen sectie met links een
bedragenkaart en rechts de uitleg.

De linkerkaart is bewust een kasboekje: **één regel per post**, in de volgorde waarin je ze
tegenkomt, niet één regel per land. Frankrijk levert dus twee regels als je er zowel autoroute
rijdt als de Mont Blanc-tunnel neemt. Per land komen achtereenvolgens:

| bron | regel | bedrag |
|---|---|---|
| `tollVignette.required` | naam van het vignet | `vignet` — geen bedrag |
| `tollRoads.perKm` | `{km} km · circa € {tarief} per km tolweg` | bereik laag–hoog |
| `tollPoints` op de route | naam van de tunnel of brug | `priceEur`, of `tarief onbekend` |
| niets van dat alles | — | `€ 0`, met *geen tol gezien op deze route* |

Die laatste regel verschijnt alleen als er ook echt een route gereden is. Zonder coördinaten
weten we niet welke tunnels je raakt, en dan is *geen tol* een bewering die we niet kunnen
onderbouwen; er staat dan `nog geen route`.

**Wat het totaal niet bevat.** Vignetprijzen hangen af van hoe lang je blijft en staan in de
bronnen alleen als lopende tekst, dus ze tellen niet mee. Hetzelfde geldt voor tolpunten zonder
geverifieerd tarief. In beide gevallen wordt het totaal gemarkeerd als *of meer* — in de sectie
én in de statkaart bovenaan, want die delen `tolTotaalRetour()`. Autotreinen staan bewust buiten
het totaal: dat is een alternatief dat je kiest, geen kost die je overkomt.

De rechterkolom is volledig data-gestuurd en toont alleen kaarten waarvoor tekst bestaat:
*Vooraf kopen* (eerste zin van `tollVignette.howToGet`), *Goedkoper rijden* (`tollRoads.note`)
en *Autotreinen* (de `optional` tolpunten).

**Losse tolpunten.** `tollPoints` telt 30 tunnels, bruggen en losse trajecten in elf landen —
precies de kosten die mensen niet zien aankomen omdat ze buiten het vignet en buiten het
kilometertarief vallen. Twee bijzondere gevallen krijgen `priceEur: 0`, omdat *niets betalen*
ook een antwoord is dat je wil zien:

- **Westerscheldetunnel** — sinds 2025 gratis voor voertuigen tot 3 meter hoog. Boén de 3 meter
  — camper, hoge dakkoffer — betaal je 18,20 euro. Precies het soort detail waar het
  voertuigprofiel voor bestaat.
- **Gotthard- en San Bernardinotunnel** — wel degelijk in het Zwitserse vignet inbegrepen,
  anders dan de Zwitserse tunnels naar Italië.

De regel toont de eerste zin van `note` als toelichting; die zegt meer dan een vaste formule
(*welke* weg het is, wie vrijgesteld is, welk alternatief gratis is). Een tilde vóór het bedrag
betekent `needsVerification: true`.

### Wanneer rijden

Een maandkalender met per dag een drukteniveau, plus een legenda en een waarschuwing voor de
dag die eruit springt. Bladeren kan per maand; de kalender opent op de maand van je vertrekdatum
en die dag krijgt een ring.

De data staat in `drukte.json` met **twee bronnen van waarheid, in deze volgorde**:

1. `dagen` — gepubliceerde prognoses per datum, met richting (`heen` / `terug`) en waar mogelijk
   een `bron`. Deze winnen altijd.
2. `regels` — periode + weekdag → niveau, bijvoorbeeld *elke zaterdag tussen 1 juli en 31
   augustus is zeer druk*. Deze vullen de rest van het jaar.

Dat onderscheid is er met opzet. Een hard-gecodeerde jaarkalender is na een jaar waardeloos;
regels blijven kloppen. Een periode mag over de jaarwisseling lopen (`12-19` → `01-04`), zodat
de kerst- en wintersportgolf zonder jaartal werkt. De `disclaimer` in `meta` zegt expliciet dat
alles zonder bron een afleiding is en geen prognose.

De richting boven de kalender (*richting zuid* / *richting noord*) komt uit `analyseRoute`, die
nu ook het breedtegraadverschil tussen begin- en eindpunt teruggeeft. Onder één graad verschil
staat er neutraal *vertrekrichting*: oost–west zegt de Franse vertrekgolf weinig.

Op een telefoon is een dagvakje 36 px. Daar past het label niet meer in, dus onder 640 px
vervallen de labels en dragen de kleur en de legenda de betekenis. In print vervallen de
achtergrondkleuren sowieso — daar krijgen de dagen een rand en blijft het label staan.

De inhoud wordt afgeleid uit de gestructureerde data, niet apart onderhouden:

| bron in `countries.json` | levert op |
|---|---|
| `tollVignette.required` | "Vignet kopen voor X" |
| `environmentalZone.actionRequired` | "Milieusticker regelen" / "Kenteken vooraf registreren" / "Vooraf betalen" |
| oordeel `bad` uit `emissionThreshold` | rode blokkade: "Je auto mag de milieuzone van X niet in" |
| `winterEquipment` actief op de vertrekdatum | "Winterbanden of sneeuwkettingen voor X" |
| `quirks` met *verboden* + *flitsapp* of *dashcam* | één gebundelde taak over alle landen heen |
| `vehicleNotes` voor het gekozen voertuigtype | "Let op"-regels, niet af te vinken |

#### Handelingen die van je kentekenland afhangen

Niet elke verplichting geldt voor iedereen. De LEZ-registratie in België is er alleen voor
**buitenlandse** kentekens: Belgische auto's staan al in de DIV-databank. Spanje werkt precies
andersom — een Spaans kenteken haalt een distintivo-sticker, een buitenlands kenteken meldt zich
per stad aan. Daarvoor twee velden op `environmentalZone`:

```jsonc
"actionRequired": "registratie",   // wat er moet gebeuren
"actionAppliesTo": "foreign",      // "all" (standaard) | "foreign" | "local"
"actionLocal": "sticker"           // optioneel: wat een lokaal kenteken in plaats daarvan moet
```

`zoneAction()` lost dit op tegen het ingestelde kentekenland en levert `null` als er voor jou
niets te regelen valt. De toegangseis zelf — mag je auto de zone in — blijft altijd voor iedereen
gelden; alleen de administratieve handeling verschilt.

Voeg je een land toe, dan verschijnen de taken vanzelf. De laatste twee regels zijn een
tekstheuristiek op `quirks`; alle andere zijn hard uit gestructureerde velden.

**Wat er bewust níét in staat:** de volledige koopinstructies. Die stonden eerst in het
overzicht *en* op de landkaart, wat de pagina verdubbelde zonder iets toe te voegen. Nu staat de
uitleg alleen op de landkaart en bevat de taak alleen de handeling plus het boetebedrag.

Boetebedragen zijn stille grijze tekst in plaats van gekleurde badges: een boetebedrag is naslag,
geen actie. Lange boeteomschrijvingen worden ingekort tot de kern (`kortBedrag()`).

### Het milieuzone-oordeel

In plaats van "controleer je emissieklasse" geeft de app per land een antwoord, in vier smaken:

| | Betekenis |
|---|---|
| ✓ **ok** | Je mag erin en hoeft niets te regelen. |
| ! **todo** | Je voldoet, maar moet nog iets doen: sticker kopen, registreren of betalen. |
| ✗ **bad** | Je voldoet niet aan de drempel van de strengste zone in dat land. |
| ? **unknown** | Niet te beoordelen — euronorm niet ingevuld, of de drempel verschilt te sterk per stad. |

De drempels zijn die van de **strengste zone per land**; het `scope`-veld zegt om welke zone het
gaat. Dat is bewust aan de veilige kant: liever een onterechte waarschuwing dan een boete.
Het onderscheid tussen "mag ik erin" en "moet ik iets regelen" is apart gemodelleerd via
`actionRequired`, omdat die twee los van elkaar staan — in Brussel moet je je registreren zelfs
als je auto ruim voldoet.

### De belangrijkste ontwerpkeuze: verplicht ≠ beboetbaar

Binnen de EU geldt als hoofdregel dat de **uitrustingseisen van je kentekenland** bindend zijn.
Duitsland schrijft een DIN-verbanddoos voor, maar beboet een Nederlands kenteken daar niet voor.
Gedragsregels — snelheid, alcohol, milieuzones, vignetten, winterbanden, verboden apparatuur —
gelden daarentegen voor iedereen die er rijdt.

Daarom heeft elk uitrustingsitem een `status`:

| `status` | Betekenis | Waar het in de checklist belandt |
|---|---|---|
| `required` | Geldt voor iedereen die er rijdt, ook buitenlandse kentekens | **Verplicht op deze route** |
| `registration-country` | Alleen voor auto's met het kenteken van dát land | **Wél in de wet, maar niet voor jouw kenteken** — tenzij je het kenteken van dat land hebt |
| `recommended` | Verstandig, maar geen wettelijke plicht en geen boete | **Aanbevolen, maar niet beboetbaar** |

Je stelt in de app je kentekenland in; `registration-country`-items schuiven automatisch naar
"verplicht" zodra dat land jouw kentekenland is.

Dit corrigeert twee hardnekkige misverstanden die in de meeste checklists blijven staan:

- **De alcoholtester in Frankrijk is geen verplichting meer.** De plicht uit 2012 is op
  22 mei 2020 formeel afgeschaft en omgezet in een aanbeveling; er is nooit een boete voor
  ingevoerd. Staat in de app als `recommended`.
- **Het Spaanse V16-baken geldt niet voor jou.** Sinds 1 januari 2026 verplicht voor Spaans
  geregistreerde voertuigen, maar buitenlandse kentekens zijn uitdrukkelijk uitgezonderd en
  mogen de gewone gevarendriehoek blijven gebruiken.

---

## Data bijwerken

Alles zit in `countries.json`; de app hoeft er niet voor open. Zet bij elke wijziging de
`lastVerified` van dat land op de datum waarop je de bron gecontroleerd hebt, en werk de
`confidence` van het feit bij als de bron veranderd is.

### Elk feit heeft een id en een confidence

Sinds `schemaVersion: 2` draagt elk feit twee extra velden. Ze zijn er niet voor de sier:
zonder stabiel id kan een changelogregel of een gebruikerscorrectie nergens ondubbelzinnig
naar wijzen, en `needsVerification: true/false` is te grof voor het verschil tussen "dit
staat op de site van de ASFINAG" en "dit stond in een lokale krant".

```
at.tollVignette                     het Oostenrijkse vignet
at.emissionThreshold                de euronorm-drempel van de strengste zone
at.tollPoint.a13-brennerautobahn    één tolpunt
at.equipment.gevarendriehoek        één uitrustingsitem
at.quirk.dashcams-zijn-verboden-het één losse regel
at.vehicleNote.met-aanhanger-of-caravan  één voertuignotitie
zone.fr-paris                       één milieuzone uit zones.json
drukte.dag.2026-07-04               één dag uit drukte.json
drukte.regel.zomerzaterdag          één periode-regel
```

De id's zijn eenmalig afgeleid uit landcode plus veldnaam plus een slug van de inhoud, en
zijn **vanaf dat moment vast**. Herformuleer je een regel, dan houdt hij zijn id — anders
verliest de changelog het spoor. Alleen een écht nieuw feit krijgt een nieuw id. Ze zijn ook
niet afgeleid van een array-index, dus er schuift niets op als er een tolpunt bij komt.

| `confidence` | betekenis |
|---|---|
| `official` | de site van de instantie die de regel uitvaardigt of het traject exploiteert |
| `verified` | gecontroleerd tegen een betrouwbare secundaire bron: ANWB, ADAC, RAC, VAB, Urban Access Regulations |
| `uncertain` | `needsVerification: true`, of geen bron, of een bron die het gewicht niet draagt |
| `unavailable` | vaststaand dat het niet te achterhalen is — dit is een menselijk oordeel en wordt nooit automatisch gezet |

Nu in de data: 173 `official`, 56 `verified`, 76 `uncertain`, over 305 feiten.
`tools/verify-data.mjs` controleert of elk feit ze heeft en of ze uniek zijn.

```jsonc
{
  "code": "FR",
  "name": "Frankrijk",
  "flagStyle": "stripes-v",              // zie tabel onder dit blok
  "flagColors": ["#002395", "#FFFFFF", "#ED2939"],
  "lastVerified": "2026-08-19",
  "sourceUrl": "https://...",            // hoofdbron
  "sources": [ { "label": "...", "url": "..." } ],
  "environmentalZone": {
    "required": true,
    "name": "Crit'Air-vignet voor de ZFE-zones",
    "howToGet": "...",
    "note": "...",
    "appliesToForeign": true,
    "fineIndication": "68 euro voor personenauto's",
    "actionRequired": "sticker",         // "sticker" | "registratie" | "betaling" | "geen"
    "appliesToCars": true,               // false => zone raakt personenauto's niet (Denemarken)
    "euroBasedForCars": true,            // false => geen euronorm-drempel (Oostenrijk)
    "emissionThreshold": {
      "diesel": 5,                       // minimale euronorm; null = geen drempel voor die brandstof
      "petrol": 4,                       // hele object weglaten = "kan de app niet beoordelen"
      "scope": "welke zone deze drempel is",
      "note": "...",
      "needsVerification": false
    },
    "needsVerification": false,          // true => "onzeker"-badge in de app
    "verificationNote": "wat er precies onzeker is"
  },
  "tollVignette": { "required": false, "note": "..." },
  "mandatoryEquipment": [
    { "item": "Gevarendriehoek", "status": "required", "enforceable": true, "note": "..." }
  ],
  "speedLimits": {
    "normal": { "motorway": "...", "expressway": "...", "rural": "...", "builtUp": "..." },
    "wet":    { "motorway": "...", "note": "..." },
    "notes": "..."
  },
  "quirks": [                            // regels die 'verboden' bevatten komen ook in de samenvatting
    { "id": "fr.quirk.<slug>", "text": "...", "confidence": "verified" }
  ],
  "vehicleNotes": [                      // alleen getoond bij het gekozen voertuigtype
    { "id": "fr.vehicleNote.<slug>", "applies": ["aanhanger", "camper"], "text": "...",
      "confidence": "verified" }
  ],
  "winterEquipment": {
    "required": "seizoensgebonden",      // "nee" | "situatiegebonden" | "seizoensgebonden"
    "periodStart": "11-01",              // MM-DD, optioneel
    "periodEnd": "03-31",
    "period": "leesbare omschrijving",
    "note": "..."
  }
}
```

**Vlagstijlen.** `flagStyle` bepaalt hoe de CSS-vlag getekend wordt:

| stijl | vorm | `flagColors` |
|---|---|---|
| `stripes-v` | verticale banen | één kleur per baan |
| `stripes-h` | horizontale banen | één kleur per baan |
| `cross` | Scandinavisch kruis, verschoven naar de hijszijde | `[veld, kruis]` |
| `cross-centered` | vierkant, gecentreerd kruis dat de rand niet raakt (Zwitserland) | `[veld, kruis]` |
| `union` | Union Jack, gelaagd met diagonalen | `[veld, wit, rood]` |

**`periodStart`/`periodEnd`** zijn optioneel maar handig: staan ze er, dan vergelijkt de app ze
met je vertrekdatum en markeert de winteruitrusting met "geldt op je vertrekdatum" in plaats van
een algemene vermelding. Zonder die velden wordt het land altijd getoond.

**Dedupliceren** gebeurt op een genormaliseerde itemnaam. Wil je zeker weten dat twee verschillend
geformuleerde items op één regel belanden (bv. "Reservelampenset" en "Reservelampjes"), geef ze dan
allebei dezelfde `"key": "lampen"`. Zonder `key` valt de app terug op een aliastabel in `index.html`
voor de bekende gevallen, en anders op de letterlijke tekst.

### De datacontrole

```bash
npm run verify:data              # inclusief de linkcheck
npm run verify:data:offline      # alleen wat lokaal te zien is
node tools/verify-data.mjs --dagen=365 --json
```

Bedoeld om maandelijks te draaien. Het ergste wat deze app kan doen is verouderde
verplichtingen tonen alsof ze kloppen; dit is het net eronder.

| melding | wat het is |
|---|---|
| **FOUT** | ontbrekend of dubbel id, onbekende `confidence`, ontbrekende `lastVerified`, dode bron |
| **OUD** | `lastVerified` ouder dan de drempel |
| **ONZEKER** | `needsVerification` staat aan, of `confidence` is `uncertain` |
| **LET OP** | `confidence` en bron spreken elkaar tegen |

Alleen FOUT geeft exitcode 1. Oude data en gemarkeerde onzekerheid zijn werk, geen
defect — laat je die een maandelijkse cron rood maken, dan kijkt er binnen een
kwartaal niemand meer naar.

De drempel staat op **180 dagen**, strenger dan de 240 dagen waarop de app zelf
"verouderd" toont. Dat is met opzet: de tool moet eerder aan de bel trekken dan de
gebruiker het ziet.

Twee dingen die de linkcheck bewust anders doet dan naïef:

* **403 en 429 zijn een waarschuwing, geen fout.** Veel overheidssites weren een
  kale client terwijl de pagina in een browser gewoon bestaat. Een 404 is wél hard.
* **Feiten zonder eigen datum erven die van hun land**, en in `drukte.json` van de
  `meta` van het bestand. De OUD-lijst vouwt die samen tot één regel per land,
  anders lees je driehonderd keer dezelfde datum.

Stand nu: 305 feiten, 305 unieke id's, geen fouten, 76 als onzeker gemarkeerd.

### Wat er veranderd is

`meta/changelog.json` houdt **inhoudelijke** wijzigingen in de regeldata bij: een
vignetprijs die omhoog gaat, een euronorm-drempel die strenger wordt, een tolpunt
dat gratis wordt. Niet wijzigingen aan de vórm van de data — die staan in
`meta.schemaVersion` van het bestand zelf — en niet aan de app.

```jsonc
{
  "id": "at.tollVignette",              // het stabiele id van het feit
  "land": "AT",                          // of null als het feit niet aan één land hangt
  "onderwerp": "prijs 10-dagenvignet",   // in gewone taal
  "oud": "12,40 euro",                   // null als het feit nieuw is
  "nieuw": "13,10 euro",                 // null als het feit vervallen is
  "datum": "2026-12-01",                 // wanneer het in de data kwam
  "ingegaan": "2027-01-01",              // wanneer de regel zelf veranderde, indien bekend
  "bron": "https://www.asfinag.at/..."
}
```

Twee data die je uit elkaar wil houden: `datum` is wanneer jij het verwerkt hebt,
`ingegaan` is wanneer het voor de weggebruiker ging gelden. Voor "3 regels gewijzigd
sinds je vorige controle" (§14) heb je de eerste nodig; voor "let op, dit verandert
vlak na je vertrekdatum" de tweede.

De lijst is nu leeg. Bij het opzetten van deze changelog is er geen enkele
inhoudelijke waarde veranderd, alleen de vorm van de data. Een verzonnen regel
toevoegen om de lijst te vullen zou precies de schijnzekerheid zijn die deze app
moet vermijden; het voorbeeld staat daarom in `meta`, niet in `wijzigingen`.

`tools/verify-data.mjs` controleert dat elk `id` in de changelog nog naar een
bestaand feit wijst. Een changelog die naar een verdwenen id verwijst is een
changelog die je niet meer kunt tonen, en dat merk je anders pas als de
wijzigingenpagina er is.

`meta/version.json` is een **afgeleide**, geen invoer: `npm run build:version`
leest de schemaversie, de verificatiedatum en het aantal records uit de drie
databestanden. Met de hand bijhouden zou betekenen dat hij precies op het moment
dat het uitmaakt — vlak na een datacorrectie — nog de vorige waarde heeft.

### Correctielink instellen

Er staat bewust **geen e-mailadres in de data**. Een `mailto:` op een publieke pagina is binnen
dagen geoogst, en een GitHub-issue dwingt melders een account te nemen. Daarom twee routes,
allebei zonder adres:

**Standaard: kopieren naar het klembord.** De knop onder elke landkaart zet een ingevulde melding
op het klembord — land, code, huidige `lastVerified`, de bron die de app gebruikt, en lege regels
voor wat er niet klopt. De melder stuurt hem via het kanaal dat hij zelf kiest. Werkt zonder
account en zonder configuratie.

De klembord-API bestaat alleen op https of localhost. Via `file://` en in browsers die hem
blokkeren valt de app terug op een tekstvak waaruit je met de hand kopieert; dat vak zit in
`#melddialoog` en sluit met Escape, de knop, of een klik naast het venster.

**Optioneel: een meldformulier.** Zet een URL in `meta.correctionFormUrl` van `countries.json` en
elke knop linkt daarheen in plaats van te kopieren:

```json
"correctionFormUrl": "https://voorbeeld.nl/formulier?land={CODE}"
```

`{CODE}` en `{NAME}` worden per land ingevuld en ge-url-encodeerd. Werkt met elke dienst die een
link accepteert — Google Forms, Tally, Formspree. Er komt dan een formulier-URL publiek te staan
in plaats van een adres, en de spam die dat oplevert filtert de dienst zelf.

---

## Router en geocoder verwisselen

### De abstractielaag

`js/routeProvider.js` is de enige plek in de app die weet welke dienst er belt. De rest
werkt met drie functies en drie datavormen:

```js
RouteProvider.getRoute(van, naar, opties)   // -> { coordinates, meters, seconds, provider }
RouteProvider.geocode(zoekterm, opties)     // -> [{ naam, omschrijving, land, lat, lon }]
RouteProvider.reverseGeocode(lat, lon, o)   // -> { naam, ... } of null
```

`van` en `naar` zijn `{ lat, lon }`. Meer niet. Dat is geen toeval: de landdetectie in
`js/geo.js` draait op de coördinaten en verder op niets, dus een andere router verandert
daar niets aan.

Waarom dit er nu al staat terwijl de app nog gewoon OSRM gebruikt: de OSRM-demoserver en
Nominatim zijn expliciet niet-commercieel, zonder uptime-garantie en begrensd op ongeveer
één aanvraag per seconde. Zodra hier verkeer op komt is dat een blocker. De keuze wélke
provider daarvoor in de plaats komt hoort bij het moment dat er verkeer is en de tarieven
te vergelijken zijn; de architectuur mag daar nu al niet blind van uitgaan dat OSRM het
eindstation is.

### De keten

```js
DIENSTEN.keten = ["proxy", "osrm-demo"];
```

De implementaties worden in deze volgorde geprobeerd. Elke implementatie zegt eerst zelf of
hij beschikbaar is (`beschikbaar()`); zo niet, dan is de volgende aan de beurt. Faalt er
één, dan schuift hij ook door. Overstappen op een betaalde provider is: hem vooraan in deze
lijst zetten.

| implementatie | wat het is |
|---|---|
| `proxy` | je eigen backend; welke dienst daarachter zit weet de client niet |
| `osrm-demo` | de sleutelloze publieke diensten: OSRM voor routes, Nominatim voor zoeken |
| `graphhopper` | leeg, met dezelfde signatuur — zie hieronder |

`graphhopper` is met opzet niet ingevuld. Twee redenen dat hij er toch staat: een
abstractielaag met precies één implementatie erachter is geen abstractielaag maar een
omweg — pas met een tweede zie je of de vorm de provider echt niet doorlaat. En het is de
plek waar de overstap straks landt. Hij wordt hier niet ingevuld omdat GraphHopper een
sleutel wil, en een sleutel in de browser een publieke sleutel is: de echte aanroep hoort
achter de proxy, die dat al kan (`ROUTE_PROVIDER=graphhopper`).

### Als de hele keten leeg uitkomt

Dan krijgt de planner een fout met `handmatig: true`, en toont hij de handmatige
landenkeuze in plaats van een doodlopende melding (§20 van de masterprompt). Die keuze
gebruikt de routebouwer die er altijd al was: je kiest landen uit een lijst, de checklist,
de vignetten en de milieuzones werken daar net zo goed op. Wat je zonder berekende route
mist — afstand, reistijd, kilometertol, kaartschets — staat er met zoveel woorden bij.

Wat de keten nadrukkelijk **niet** doet: een oude of verzonnen route teruggeven als
noodoplossing. Een route die er niet is, is geen route.

### Waarom er geen sleutelveld in de client zit

Alles wat de browser meekrijgt is publiek. Een sleutel in `index.html`, in een los
`config.js`, of achter een build-stap gestopt: het staat allemaal in de bundle die
iedereen kan lezen. Er is in een statische site geen plek waar een sleutel geheim blijft.

Daarom staat er in `DIENSTEN` **geen veld voor een sleutel**. Niet vergeten, maar bewust:
er is dan ook niets om per ongeluk in te vullen en mee te committen. Wie een dienst met
sleutel wil gebruiken, zet die achter een proxy op het eigen domein.

### De drie standen

```js
var DIENSTEN = {
  mode: "auto",                          // "auto" | "proxy" | "open"
  keten: ["proxy", "osrm-demo"],
  proxyBase: "./api",
  osrm: "https://router.project-osrm.org/route/v1/driving/",
  nominatim: "https://nominatim.openstreetmap.org"
};
```

| stand | gedrag |
|---|---|
| `auto` | klopt eenmalig aan bij `./api/route?ping=1`; is er een proxy, dan die, anders de sleutelloze diensten |
| `proxy` | alleen de eigen proxy; is die stuk, dan faalt de planner zichtbaar |
| `open` | alleen OSRM-demo en Nominatim, geen proxyaanroep |

`auto` is handig omdat de app dan ook werkt op `file://` en op een host zonder functions.
Het risico is stil terugvallen op de demoserver, en daarom noemt de statusregel onder de
planner altijd welke dienst het uiteindelijk werd — inclusief *"die is niet voor productie
bedoeld"* bij de demoserver. Voor een echte productiesite is `proxy` de juiste stand: dan
merk je het als de proxy eruit ligt.

### Het contract

De proxy moet twee routes aanbieden. De client kent de provider niet en normaliseert niets:
dat gebeurt aan de serverkant, zodat je van provider kunt wisselen zonder de app aan te raken.

```
GET  {proxyBase}/route?from=<lon>,<lat>&to=<lon>,<lat>
200  { "coordinates": [[lon,lat], ...], "meters": 734000, "seconds": 29500,
       "provider": "openrouteservice" }

GET  {proxyBase}/geocode?q=<tekst>
200  { "results": [{ "naam", "omschrijving", "land", "lat", "lon" }], "provider": "..." }

GET  {proxyBase}/geocode?lat=<lat>&lon=<lon>
200  hetzelfde antwoord, één resultaat — omgekeerd zoeken

     Alle drie accepteren ?ping=1 en antwoorden dan 200 zonder de provider aan te roepen.
     Fouten komen terug als { "error": "<uitleg>" } met een 4xx- of 5xx-status.
```

### De meegeleverde proxy

Eén implementatie, twee manieren om hem uit te rollen:

```
worker/src/index.js       Cloudflare Worker: routeert /api/route en /api/geocode
worker/src/route.js       de route-afhandeling
worker/src/geocode.js     zoeken en omgekeerd zoeken
worker/src/lib/           herkomst, snelheidsbegrenzer, cache, antwoordvormen
worker/wrangler.toml      namen en standaardwaarden, geen sleutels
functions/api/route.js    Pages Function — importeert worker/src/route.js
functions/api/geocode.js  Pages Function — importeert worker/src/geocode.js
```

De twee Pages Functions bevatten geen logica meer; ze roepen dezelfde modules
aan als de Worker. Twee kopieën lopen na een half jaar uit de pas, en dan
gedraagt je proxy zich anders afhankelijk van waar je hem uitrolt.

```bash
cd worker && npx wrangler dev      # Worker, met ../.dev.vars voor de sleutels
npx wrangler pages dev .           # Pages Functions naast de statische bestanden
```

Zet de Worker op een route als `jouwdomein.nl/api/*` en laat de statische
bestanden bij je host. Dan gaat er geen enkele pagina-aanvraag door de Worker
heen en blijft de app buiten je Worker-quota.

Ondersteund: OpenRouteService en Graphhopper (beide met sleutel) voor routes,
OpenRouteService voor geocoderen, en OSRM/Nominatim zonder sleutel. Instellen
gebeurt met omgevingsvariabelen, nooit met bestanden in de repo:

| variabele | waarde |
|---|---|
| `ROUTE_PROVIDER` | `ors` \| `graphhopper` \| `osrm` |
| `ROUTE_KEY` | de sleutel, als **Secret** — niet als plain text |
| `ROUTE_OSRM_URL` | eigen OSRM-instantie; zonder deze pakt hij de demoserver |
| `GEO_PROVIDER` | `ors` \| `nominatim` |
| `GEO_KEY` | de sleutel, als Secret |
| `GEO_UA` | contactadres voor de User-Agent die Nominatim eist |
| `TOEGESTANE_HERKOMST` | je eigen domein; leeg laten zet de proxy open |
| `LIMIET_ROUTE` | aanvragen per minuut per IP, standaard 30; `0` zet uit |
| `LIMIET_GEOCODE` | idem, standaard 60 |

Die `TOEGESTANE_HERKOMST` is het verschil tussen jouw quotum en dat van iedereen
die je endpoint vindt. Zonder die variabele kan een vreemde site jouw proxy als
gratis routeserver gebruiken en jouw sleutel opmaken.

Twee dingen die de proxy nog doet, en die je zelf moet blijven doen als je hem
vervangt: coördinaten worden op vorm en bereik gecontroleerd voordat ze doorgaan,
en foutmeldingen van de provider worden **niet** teruggegeven aan de client — die
kunnen de sleutel bevatten. De echte fout gaat naar je hostlogs.

#### Snelheidsbegrenzer per IP

De proxy bundelt al je bezoekers achter één IP richting de provider. Zonder rem
is dat geen bescherming maar een versterker: één script dat je endpoint vindt,
trekt je quotum leeg en zet je hele site zonder routes.

Twee lagen, allebei bewust bescheiden:

1. **Een teller in het geheugen van de isolate.** Gratis en direct. Cloudflare
   draait meerdere isolates naast elkaar, dus wie zich daarover verspreidt krijgt
   per isolate opnieuw budget. Als rem tegen een doorgeslagen script werkt hij
   prima.
2. **Een teller in KV**, als je de binding `RATELIMIT` aanmaakt. Die geldt over
   isolates heen. KV is uiteindelijk consistent en telt onder gelijktijdige
   aanvragen eerder te laag dan te hoog.

```bash
npx wrangler kv namespace create RATELIMIT   # zet het id in wrangler.toml
```

Het blijft een rem, geen slot. Voor een hard slot heb je een Durable Object
nodig, en dat is een andere prijsklasse dan waar deze app nu zit. Wat je hier
tegenhoudt is misbruik van je quotum, niet een aanval op je gegevens — er staan
geen gegevens achter deze endpoints. Het IP wordt alleen als tellersleutel
gebruikt en nergens opgeslagen of gelogd.

#### Het data-endpoint

```
GET  /api/v1/data/countries.json    ook zones.json en drukte.json
200  het bestand, met ETag en x-data-versie
304  als je dezelfde ETag meestuurt
```

De regeldata moet kunnen wijzigen zonder dat de app opnieuw uitgerold wordt: een vignetprijs
of een euronorm-drempel verandert midden in het jaar, en als daar een deploy voor nodig is
gebeurt het te laat of niet. Koppel een KV-namespace `DATA` en je uploadt een nieuw
`countries.json` los; zonder die binding haalt het endpoint het bestand naast de app op en is
het een doorgeefluik met ETag — nog steeds nuttig, alleen zonder de losse-upload-eigenschap.

```bash
npx wrangler kv namespace create DATA          # zet het id in wrangler.toml
npx wrangler kv key put --binding=DATA countries.json --path=countries.json
```

De `v1` in het pad is het contract naar buiten, niet de versie van de data. Verandert de
*vorm*, dan komt er `v2` naast; verandert de *inhoud*, dan verandert de ETag en
`meta.schemaVersion` / `meta.researchDate` in het bestand zelf. Dit endpoint is meteen de
B2B-API uit fase F van de roadmap — er hoeft later niets bij.

**"Lange cache" is hier de conditionele cache, niet een lange max-age.** Een lange max-age zou
betekenen dat een gecorrigeerde vignetprijs uren blijft hangen, en dat is precies wat dit
endpoint moest oplossen. Dus `max-age=60` plus een ETag: de herhaalvraag is een 304 van een
paar honderd bytes in plaats van 87 KB.

De app haalt bij het opstarten op en valt in vier stappen terug:

| | bron | wanneer |
|---|---|---|
| 1 | `./api/v1/data/<bestand>` | er draait een endpoint |
| 2 | `./<bestand>` naast de app | geen endpoint; dit is ook wat de service worker offline heeft |
| 3 | `localStorage` | alleen `countries.json`, en de app zegt er dan bij dat het een oude kopie is |
| 4 | bestandskiezer | `file://`, waar de browser fetch van een buurbestand blokkeert |

Eén mislukte poging is genoeg: `DATA_ENDPOINT_ER` onthoudt voor de rest van de sessie dat er
geen endpoint draait, zodat `zones.json` niet opnieuw aanklopt bij een host die er geen heeft.
`borders.json` en `cities.json` gaan hier niet doorheen: dat is geodata die alleen verandert
als je `tools/build-geodata.ps1` draait, en dan hoort er sowieso een deploy bij.

#### Cache op route-hash

Dezelfde twee plaatsen leveren dezelfde route. De sleutel is een SHA-256 over de
**genormaliseerde vraag** (provider plus afgeronde coördinaten), niet over de
rauwe URL — dat maakt hem ongevoelig voor de volgorde van queryparameters.

Coördinaten worden afgerond op vier decimalen, ongeveer elf meter. Voor de 689
plaatsen uit `cities.json`, die al op drie decimalen vastliggen, verandert dat
niets; voor een geocodeerd punt vangt het het verschil op tussen twee keer
hetzelfde adres opzoeken. Belangrijk detail: de **afgeronde** waarde gaat ook
naar de provider. Een sleutel maken van afgeronde coördinaten en dan de rauwe
doorsturen levert een cache op die het antwoord van iemand anders teruggeeft.

Een treffer gaat bewust *vóór* de snelheidsbegrenzer langs: hij kost de provider
niets, dus hij hoeft niet van iemands budget af. Het antwoord draagt
`x-cache: HIT` of `MISS`, zodat je in de netwerkinspecteur kunt zien of het werkt
zonder in de logs te duiken.

### Sleutels buiten de repo houden

Drie lagen, en je hebt ze alle drie nodig:

1. `.gitignore` blokkeert `.dev.vars`, `.env` en `.env.*`.
2. `.dev.vars.example` staat er wel in, met alleen namen en lege waarden. Kopieer hem
   naar `.dev.vars` voor `npx wrangler pages dev .`
3. `tools/check-geheimen.ps1` doorzoekt alles wat onder versiebeheer staat op
   sleutelpatronen (ORS, Google, Mapbox, AWS, private keys) en op e-mailadressen:

```powershell
powershell -File tools\check-geheimen.ps1
```

Exitcode 1 als er iets gevonden wordt, dus je kunt hem als pre-commit hook hangen.

### Caching in de app

De service worker laat `/api/` met rust. Een route is geen bestand — hij hangt af van de
vraag — en de proxy zegt met zijn eigen `cache-control` hoe lang zijn antwoord houdbaar is:
een uur voor routes, een dag voor plaatsnamen. Dat scheelt aanroepen op je quotum zonder dat
de app daar iets van hoeft te weten. De gedeelde cache op route-hash staat hierboven; die
zit aan de proxykant en werkt over bezoekers heen, deze aan de browserkant en per bezoeker.

---

## Geodata opnieuw genereren

`cities.json` en `borders.json` komen uit Natural Earth en zijn reproduceerbaar:

```bash
powershell -ExecutionPolicy Bypass -File tools/build-geodata.ps1
```

Het script downloadt de brondata eenmalig naar `tools/_cache` (ruim 30 MB, staat in
`.gitignore`) en schrijft beide bestanden opnieuw weg. Bovenin staan de knoppen:

| variabele | betekenis |
|---|---|
| `$covered` | landen die fijne polygonen krijgen — houd dit gelijk aan `countries.json` |
| `$TOL_FINE` / `$TOL_COARSE` | Douglas-Peucker-tolerantie in graden (0,002 ≈ 220 m / 0,03 ≈ 3,3 km) |
| `$MIN_RING_*` | eilanden kleiner dan deze bbox-diagonaal vervallen |
| `$map` / `$names` | welke landen meedoen, en hun Nederlandse naam |

**Voeg je een land toe aan `countries.json`?** Zet de code er dan ook in `$covered` bij en draai
het script opnieuw, anders houdt het land grove polygonen en blijft de app melden dat het niet
in de checklist staat.

Het script bevat bewust geen letterlijke niet-ASCII tekens: PowerShell 5.1 leest een `.ps1`
zonder BOM als ANSI, waardoor accenten dubbel geëncodeerd in de uitvoer belanden. Diakrieten
worden daarom met `[char]`-codes opgebouwd.

## Bronnen en licenties van de geodata

| bron | waarvoor | licentie |
|---|---|---|
| [Natural Earth](https://www.naturalearthdata.com/) 10m admin_0 countries | `borders.json` | publiek domein |
| [Natural Earth](https://www.naturalearthdata.com/) 10m populated places | `cities.json` | publiek domein |
| [OSRM demo-server](https://github.com/Project-OSRM/osrm-backend/wiki/Api-usage-policy) | routegeometrie | kaartdata ODbL, © OpenStreetMap-bijdragers |
| [Nominatim](https://operations.osmfoundation.org/policies/nominatim/) | plaatsen buiten `cities.json` | kaartdata ODbL, © OpenStreetMap-bijdragers |

De OSM-bronvermelding staat in de colofon onderaan de app; die moet blijven staan.

Beide OSM-diensten hanteren **maximaal 1 verzoek per seconde** en zijn niet-commercieel en
zonder uptime-garantie. Eén route kost één OSRM-aanroep; Nominatim wordt alleen op een expliciete
klik geraadpleegd. Voor persoonlijk gebruik ruim binnen het beleid — bouw hier geen dienst met
veel verkeer op zonder een eigen routeserver.

## Bronnen per land

Alle landen zijn onderzocht op **19 augustus 2026**. Waar geen harde bron gevonden is, staat
`needsVerification: true` in de data en toont de app een "onzeker"-badge in plaats van een gok.

| Land | Belangrijkste bronnen |
|---|---|
| België | [ANWB milieuzones België](https://www.anwb.nl/vakantie/belgie/reisvoorbereiding/milieuzones) · [LEZ Brussel](https://lez.brussels/mytax/nl/) · [Stad Gent LEZ buitenlandse plaat](https://stad.gent/nl/mobiliteit-openbare-werken/lage-emissiezone/registratie-lez-voertuig-met-buitenlandse-nummerplaat) |
| Nederland | [Milieuzones.nl](https://www.milieuzones.nl/) · [ANWB verkeer Nederland](https://www.anwb.nl/verkeer/nederland) |
| Duitsland | [ADAC Umweltzonen](https://www.adac.de/verkehr/abgas-diesel-fahrverbote/umweltzonen/) · [ANWB milieuzones Duitsland](https://www.anwb.nl/vakantie/duitsland/reisvoorbereiding/milieuzones) |
| Frankrijk | [Crit'Air (overheid)](https://www.certificat-air.gouv.fr/) · [VAB milieuvignet Frankrijk 2026](https://magazine.vab.be/op-weg/mobiliteit/alles-over-het-milieuvignet-in-frankrijk/) · [RAC driving in France 2026](https://www.rac.co.uk/drive/travel/country/france/) |
| Luxemburg | [ANWB Luxemburg](https://www.anwb.nl/vakantie/luxemburg/reisvoorbereiding) · [Radar – dashcamverboden](https://radar.avrotros.nl/artikel/in-deze-vakantielanden-is-een-dashcam-verboden-60734) |
| Oostenrijk | [ASFINAG vignette](https://www.asfinag.at/maut-vignette/vignette/) · [ANWB winterbanden buitenland](https://www.anwb.nl/auto/banden/winterbanden/winterbanden-in-het-buitenland) · [Snowplaza vignet 2026](https://www.snowplaza.nl/weblog/vignet-oostenrijk-zwitserland-2026-dit-verandert-er-vanaf-nu-kleur-prijs-en-regels/) |
| Zwitserland | [E-Vignette CH](https://www.evignette.ch/) · [HCC flitsapps in Europa](https://www2.hcc.nl/kennis/kennis/reviews/flitsapps-in-europa-handig-onderweg-maar-niet-overal-toegestaan) |
| Italië | [Urban Access Regulations – Italië](https://urbanaccessregulations.eu/countries-mainmenu-147/italy-mainmenu-81) · [ANWB Italië](https://www.anwb.nl/vakantie/italie/reisvoorbereiding) |
| Spanje | [DGT](https://www.dgt.es/) · [Idealista – V16 vanaf 1-1-2026](https://www.idealista.com/en/news/legal-advice-in-spain/2026/01/08/878404-the-v16-beacon-is-now-mandatory-in-spain-what-you-need-to-know-to-avoid-an-eu80) · [Euro Weekly News – V16-uitzonderingen](https://euroweeklynews.com/2025/11/26/spains-new-v16-rule-sparks-confusion-these-cars-wont-have-to-carry-it-in-2026/) |
| Portugal | [Portugal Tolls](https://www.portugaltolls.com/) · [Radar – dashcamverboden](https://radar.avrotros.nl/artikel/in-deze-vakantielanden-is-een-dashcam-verboden-60734) |
| Kroatië | [HAK (Kroatische wegenwacht)](https://www.hak.hr/en) · [ANWB verplichte materialen Kroatië](https://www.anwb.nl/webwinkel/c/259/auto/verplichte-automaterialen/kroatie) |
| Slovenië | [DARS e-vinjeta](https://evinjeta.dars.si/) · [ANWB Slovenië](https://www.anwb.nl/vakantie/slovenie/reisvoorbereiding) |
| Tsjechië | [eDálnice](https://edalnice.cz/en/) · [ANWB winterbanden buitenland](https://www.anwb.nl/auto/banden/winterbanden/winterbanden-in-het-buitenland) |
| Denemarken | [Miljøzoner.dk](https://miljoezoner.dk/) · [ANWB Denemarken](https://www.anwb.nl/vakantie/denemarken/reisvoorbereiding) |
| Zweden | [Transportstyrelsen](https://www.transportstyrelsen.se/en/road/) · [Urban Access Regulations – Zweden](https://urbanaccessregulations.eu/countries-mainmenu-147/sweden-mainmenu-248) |
| Verenigd Koninkrijk | [TfL ULEZ](https://tfl.gov.uk/modes/driving/ultra-low-emission-zone) · [GOV.UK Clean Air Zones](https://www.gov.uk/guidance/driving-in-a-clean-air-zone) · [RAC driving in Europe](https://www.rac.co.uk/drive/travel/advice/checklist/) |

### Bronnen voor de euronorm-drempels

De drempels achter het milieuzone-oordeel zijn apart nagezocht op 19 augustus 2026:

| Land | Drempel (strengste zone) | Bron |
|---|---|---|
| België | diesel Euro 6, benzine Euro 3 (Brussel) | [Stad Brussel – LEZ verbod sinds 2026](https://www.brussel.be/lage-emissie-zone-lez-nieuw-verbod-sinds-2026) |
| Nederland | diesel Euro 4 (groene zone), benzine geen | [Milieuzones.nl](https://www.milieuzones.nl/) |
| Duitsland | diesel Euro 4 (of Euro 3 + roetfilter), benzine Euro 1 met kat | [ADAC Umweltplaketten](https://www.adac.de/verkehr/tanken-kraftstoff-antrieb/fahrverbote-umweltzonen/umweltplaketten/) |
| Frankrijk | diesel Euro 5, benzine Euro 4 (Crit'Air 3 geweerd) | [ZFE 2026 – Paris stelt sancties uit](https://www.permisapoints.fr/actualites/environnement/zfe-et-vignettes-critair-2026) |
| Spanje | diesel Euro 4, benzine Euro 3 (B-label) | [TyreMap Madrid](https://tyremap.com/emission-zones/madrid/) · [ZBE Barcelona](https://www.zbe.barcelona/es/zones-baixes-emissions/vehicles-afectats.html) |
| Zweden | diesel Euro 6, benzine Euro 5 (klass 2) | [Stockholm miljözon Hornsgatan](https://trafik.stockholm/trafikregler/miljozoner/miljozon-hornsgatan/) |
| VK | diesel Euro 6, benzine Euro 4 (ULEZ) | [TfL ULEZ](https://tfl.gov.uk/modes/driving/ultra-low-emission-zone) |

Portugal en Italië hebben een drempel die per gemeente te sterk verschilt; die staan als onzeker
gemarkeerd. Oostenrijk kent geen euronorm-drempel voor personenauto's (IG-L werkt met
snelheidsbeperkingen), en de Deense milieuzones raken personenauto's in beginsel niet.

### Als onzeker gemarkeerd (`needsVerification: true`)

Hier is bewust géén stellige uitspraak gedaan:

- **Oostenrijk** — stickerplicht rond Graz en de actuele IG-L-trajecten; vignetprijzen worden jaarlijks geïndexeerd.
- **Spanje** — de registratieprocedure voor buitenlandse kentekens in ZBE's verschilt per gemeente en verandert regelmatig.
- **Portugal** — de exacte euronorm-drempels van de Lissabonse ZER.
- **Kroatië** — of de sleepkabel bij buitenlandse kentekens daadwerkelijk gehandhaafd wordt.
- **Slovenië / Tsjechië** — actuele vignettarieven.
- **Tsjechië** — status van een bredere milieuzone in Praag voor personenauto's.
- **Denemarken** — of personenauto's inmiddels onder de milieuzones vallen (nu vooral dieselbestel- en vrachtverkeer).
- **Zweden** — de exacte grenzen van de uitdijende miljözon-klassen.

---

## Beperkingen

- Prijzen en boetebedragen zijn **indicatief** en veranderen jaarlijks; de app noemt ze om een
  orde van grootte te geven, niet als exact tarief.
- Snelheidslimieten zijn de landelijke standaard. **Borden gaan altijd voor.**
- Milieuzones zijn per land samengevat, niet per stad uitgeput. Rijd je een specifieke binnenstad
  in, check dan de gemeentesite — zeker bij Italiaanse ZTL's.
- Het milieuzone-oordeel gebruikt de **strengste zone per land**. Een groen vinkje betekent dus
  "overal in dit land goed"; een rood kruis betekent "in de strengste zone niet", niet
  automatisch "nergens". Het `scope`-veld zegt om welke zone het gaat.
- De euronorm-drempels gelden voor **personenauto's**. Bestel- en vrachtwagens hebben vrijwel
  overal eigen, strengere regels die deze app niet dekt.
- `vehicleNotes` voor aanhanger en camper dekken de meest voorkomende afwijkingen (snelheid,
  vignetcategorie, aantal driehoeken), niet alles: gewichtsgrenzen, rijbewijscategorieën en
  afmetingen blijven jouw verantwoordelijkheid.

### Beperkingen van de routeplanner

- **De landsgrenzen zijn vereenvoudigd** tot ongeveer 220 meter nauwkeurig voor de 16 gedekte
  landen. Een weg die vlak langs een grens loopt kan daardoor aan het verkeerde land worden
  toegekend. Daarom de controlevraag onder de 15 km. Een geteste steekproef van 41 plaatsen —
  inclusief lastige gevallen als Maastricht/Aken, Bazel, Straatsburg/Kehl en Ventimiglia —
  komt goed uit, maar op de Rivièra en langs de Rijn is de marge het krapst.
- **Kustlijnen zijn grover dan landsgrenzen.** Een havenplaats kan net in zee vallen; daarvoor
  tast de app in ringen van 1,7 en 3,9 km om het punt heen af en laat de meerderheid beslissen.
  Echte zee ligt verder weg en blijft onbekend, zodat veerboten niet als land meetellen.
- **Eilanden kleiner dan ongeveer 13 km** zitten niet in de data. De Kroatische eilanden en de
  Griekse archipel vallen daarmee grotendeels weg; het vasteland dekt de rijroute.
- **689 plaatsen** is wat Natural Earth voor Europa biedt. Slovenië heeft er twee. Alles daarbuiten
  gaat via de online zoekterugval, die netwerk nodig heeft.
- **De route is de snelste route volgens OSRM**, niet per se jouw route. Rijd je bewust om — via
  Zwitserland in plaats van Oostenrijk — pas de landenlijst dan handmatig aan.
- Dit is een geheugensteun, geen juridisch advies. De app zegt dat ook bovenaan, met links naar
  ANWB, VAB, RAC, ADAC en Urban Access Regulations.
