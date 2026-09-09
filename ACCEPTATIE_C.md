# ACCEPTATIE_C.md — de onderweg-modus, nagelopen

Nagelopen op 3 september 2026, tegen een lokale server, in een browser op 375 × 812, met
een service worker op v27 en een schone `localStorage`. De reis in alle proeven: Utrecht →
Salzburg, vertrek 10 oktober 2026, diesel, NL-kenteken, landen NL · DE · AT.

Achttien tests staan er in de roadmap onder "ACCEPTATIECRITERIA FASE C". Ze zijn alle
achttien uitgevoerd. Twaalf gaan door, vier gaan half door, twee vallen om. Daarnaast is er
een deel van fase C waar helemaal geen test bij staat, en dat is niet toevallig het deel dat
niet bestaat.

**Fase C is niet af.** Niet vanwege de vier halve tests — die zijn inmiddels gerepareerd,
zie §4 — maar vanwege §2 en §3 hieronder: één criterium dat botst met criterium B, en één
onderdeel dat helemaal niet bestaat.

---

## 0. Wat hier níet in staat

**De tel:-test op een echt toestel.** De roadmap zegt er zelf bij: *"Test dit op een echt
toestel, niet alleen in devtools."* Dat kan ik niet. Wat ik wel heb: de `href`-waarden zijn
welgevormd na het strippen van spaties en streepjes — `tel:112`, `tel:0882692888`,
`tel:900112222` — en er zit geen enkel teken in dat een telefoon-app doet struikelen. Of
Android en iOS ze werkelijk openen, moet jij met een duim bevestigen.

**Een echte GPS-fix.** De grensdetectie is getest met een vervangen `navigator.geolocation`
die coördinaten voedt die ik zelf koos (Brussel, Parijs, Salzburg, Innsbruck, München). Dat
bewijst de logica — de throttle, de classificatie, de melding — maar niet hoe een echte
telefoon zich gedraagt op een snelweg, met een fix die zwerft en een scherm dat uitgaat.

---

## 1. De achttien tests

Het oordeel hieronder is dat van de eerste doorloop. De vijf mankementen uit §4 zijn op
9 september 2026 gerepareerd en opnieuw nagelopen; per test staat dat erbij.

| test | oordeel | waarop |
|---|---|---|
| **C1-1** juiste land in banner, géén melding bij de eerste fix | half → **ja** | inhoud klopte al; de eerste fix zweeg pas na §4a |
| **C1-2** throttle: hooguit één classificatie per 60 s | **ja** | tweede fix binnen de minuut werd genegeerd, land bleef staan |
| **C1-3** uit + herladen: uit, geen watch, banner weg | **ja** | `{"enabled":false}`, `clearWatch(42)`, banner leeg en verborgen |
| **C1-4** toestemming geweigerd | **ja, met kanttekening** | duidelijke regel, nul console-fouten; de schakelaar blijft wel aan staan |
| **C1-5** terugkomen na wegschakelen | nee → **ja** | banner degradeert nu naar "laatst gezien om …" en vraagt een verse fix — §4b |
| **C2-1** knop op drie pagina's én zonder reis | **nee** | knop verborgen op Home en zonder reis — zie §2, dit is een keuze, geen bug |
| **C2-2** modal zonder GPS, land handmatig wisselbaar | **ja** | opent op NL, wissel naar ES verandert nummers, uitstapregel én zinnen mee |
| **C2-3** tel:-links op een echt toestel | **niet testbaar** | zie §0 |
| **C2-4** gegevens overleven sluiten en herladen | **ja** | vijf velden, terug na een volledige herlaadbeurt (offline nog wel) |
| **C2-5** verified vs uncertain, met correctielink | half → **ja** | alle vier de blokken dragen nu badge, bron én correctielink — §4c |
| **C4-1** grootte via `storage.estimate`, terugval | half → **ja** | `file://` toont nu dezelfde terugvaltekst als een browser zonder API — §4d |
| **C4-2** ververs raakt het netwerk, datum bijgewerkt | **ja** | vijf JSON-bestanden, alle 200 en niet uit cache; "Laatst ververst op 2 september 2026" |
| **C5-1** route + diesel → advies met besparing en prijsdatum | mits → **ja** | het advies weegt nu de kilometers die nog vóór je liggen — §4e |
| **C5-2** handmatige landenlijst → alleen de prijstabel | **ja** | "Nog geen berekende route, dus geen afstandsgewogen tankadvies" |
| **C5-3** EV → uitleg in plaats van leeg blok | **ja** | "Elektrisch of waterstof: tankstrategie is hier niet van toepassing." |
| **C5-4** geen fuelprices → Kosten werkt door | **ja** | pagina rendert volledig, nul console-fouten |
| **Offline** volledige herlaadbeurt zonder server | **ja** | server gestopt; app boot, alle acht pagina's renderen, `borders.json` uit de cache |
| **Regressie** de pagina's uit fase B | **ja** | Dashboard, Acties, Kaart, Kosten, Regels, Document, Mijn reizen, Reis — nul fouten |

---

## 2. De knop die twee criteria niet tegelijk kan halen

Dit is de belangrijkste bevinding, en het is er een waar je zelf over moet beslissen.

**C2 eist:** *"de incidentknop is zichtbaar en bruikbaar op minstens drie verschillende
pagina's (Home, Kosten, Kaart), en ook wanneer er helemaal geen reis is aangemaakt."*

**Gemeten:**

| | Home | Kosten | Kaart | Dashboard |
|---|---|---|---|---|
| zonder reis | verborgen | verborgen | verborgen | verborgen |
| met reis | verborgen | zichtbaar | zichtbaar | zichtbaar |

Van de vier vakjes die C2 vraagt, staan er nul goed.

Dat is geen sluipende regressie. Het is de reparatie van mankement (c) uit
`ACCEPTATIE_B.md`, twee dagen geleden bewust aangebracht: op de homepage lag de rode
driehoek half over "Geschatte kosten €155–€180", en bij een eerste bezoek — het moment
waarop criterium B afgerekend wordt — verontrust een noodknop eerder dan dat hij helpt.

Zo staan twee acceptatiecriteria tegenover elkaar. B zegt: een nieuwe bezoeker moet rustig
kunnen kijken. C zegt: wie pech heeft moet die knop overal kunnen vinden, ook als hij nooit
een reis heeft aangemaakt. Allebei hebben ze gelijk voor hun eigen gebruiker.

Wat mij de beste uitweg lijkt, maar het is jouw keuze:

* **Home houdt hem verborgen** (B wint daar — het is de enige pagina die over de eerste
  indruk gaat);
* **zonder reis wordt hij weer zichtbaar op alle andere pagina's** (C wint daar — de modal
  wérkt al zonder reis: hij valt terug op het eerste land uit `DATA.countries` en je kiest
  handmatig, dat is in §1 gemeten);
* en de tekst van C2 wordt bijgesteld naar "op elke pagina behalve de homepage", met de
  reden erbij.

Dat is één regel in `verversSosKnop()` in [js/incident.js](js/incident.js:166): de
voorwaarde `!TRIP || !tripLanden(TRIP).length` vervalt, `VIEW === "home"` blijft. Ik heb
het niet gedaan, omdat het een criterium herschrijft en dat niet aan mij is.

---

## 3. C3 bestaat niet

De roadmap noemt vijf onderdelen voor fase C. Er staan acceptatietests bij C1, C2, C4 en
C5. Bij **C3 — Documentenkluis met vervaldatumcheck** staat niets, en in de code staat ook
niets.

Doorzocht op `indexedDB`, `idb`, `crypto.subtle`, `FileReader`, `input type="file"`,
`verval`, `verloopt`, `groene kaart`. Wat er is: één regel checklist-tekst
(`"Controleer de vervaldatum voor vertrek."`) en een `<input type="file">` in
[js/data.js](js/data.js:96) voor het importeren van een JSON-databestand. Verder niets.
Geen opslag van foto's, geen versleuteling, geen vergelijking van een vervaldatum met
`departureDate`.

Dat betekent dat het hele privacy-verhaal uit de roadmap — *"nooit naar een server (dat is
meteen je privacy-verhaal)"* — nog niet bestaat, en de slimme laag eromheen evenmin:
*"Je groene kaart verloopt op 14 juli. Je bent dan nog in Kroatië."*

`js/document.js` heet zo, maar is het reisdocument uit fase B: de printbare pagina. De
kluis is iets anders.

**Fase C kan niet afgetekend worden zolang een vijfde van de fase ontbreekt** — ongeacht
hoe de andere achttien tests uitpakken. Dat de roadmap er geen acceptatietests bij zette,
maakt het onderdeel niet optioneel; het maakt alleen dat het ontbreken ervan niet vanzelf
opvalt.

---

## 4. De vijf mankementen — gerepareerd op 9 september 2026

Elk mankement staat hieronder zoals het gevonden is, met daaronder wat eraan gedaan is en
hoe het nagelopen is. De reparaties zijn opnieuw gemeten op een schone opslag, en daarna
nog een keer met de server uit — alle vijf houden ook offline stand.

### a. De allereerste fix meldt tóch een grens

**C1-1 eist:** *"Bij de eerste fix verschijnt géén melding."*

Twee metingen, en het verschil zit hem in of er een reis openstaat.

```
zonder reis    HUIDIG_LAND = null → eerste fix in België → geen melding, geen banner  ✓
met een reis   HUIDIG_LAND = "NL" → eerste fix in België → melding + banner           ✗
```

De oorzaak staat in [js/app.js](js/app.js:444): `journeyInitHuidigLand()` zet
`HUIDIG_LAND` alvast op het eerste land van je reis, zodat de incidentmodus ook zonder
GPS-fix een land kan tonen. Dat is op zichzelf verstandig, maar
[js/journey.js](js/journey.js:130) leidt daar de eerste fix uit af:

```js
var eersteFix = HUIDIG_LAND === null;
```

Met een reis is `HUIDIG_LAND` nooit `null`, dus geldt geen enkele fix meer als de eerste.
Wie de app opstart terwijl hij al in België rijdt, krijgt meteen een melding die doet alsof
hij zojuist de grens over kwam.

**Reparatie:** een aparte vlag die zegt of er in deze sessie al een fix binnenkwam, los van
de vraag of er een land bekend is. Twee regels.

> **Gerepareerd.** `JOURNEY_FIX_GEHAD` in [js/journey.js](js/journey.js:21) houdt nu bij of
> er werkelijk gemeten is; `HUIDIG_LAND` mag weer gewoon een aanname zijn. De vlag gaat op
> `false` bij `journeyStart()` en `journeyStop()`, zodat elke nieuwe meetsessie opnieuw een
> eerste keer heeft.
>
> Nagelopen in precies het scenario dat omviel — reis Utrecht → Salzburg open,
> `HUIDIG_LAND` vooraf op `NL`, eerste fix in België:
>
> ```
> eerste fix (BE)      land=BE  meldingen=0  banner verborgen
> daarna wissel (FR)   land=FR  meldingen=1  "Je rijdt nu in Frankrijk"
> ```
>
> De eerste meting zwijgt, de echte grenswissel erna meldt gewoon.

### b. De banner doet alsof er meegekeken is

**C1-5 eist:** *"De banner moet de actuele situatie tonen in plaats van te doen alsof er
continu is meegekeken — dit is de iOS-correctie uit de prompt."*

Er is geen `visibilitychange`-luisteraar in de app, en de banner draagt geen tijdstempel.
Nagelopen in de broncode van `journeyStart`, `journeyOpPositie`, `meldGrenswissel` en
`grensBannerHTML`: geen van vieren weet iets van wegschakelen.

Gevolg op iOS, precies het scenario dat de roadmap benoemt: `watchPosition` valt stil zodra
de PWA naar de achtergrond gaat. Kom je twee uur later terug — inmiddels in Oostenrijk —
dan staat er onveranderd **"Je rijdt nu in Frankrijk"**, met Franse snelheidslimieten
eronder. Dat is niet alleen verouderd, het is verouderde informatie die zich voordoet als
actueel, en op dit onderwerp is dat het verkeerde soort fout.

**Reparatie:** een `visibilitychange`-luisteraar die bij terugkeer óf een verse fix vraagt,
óf de banner degradeert tot "laatst gezien om 14:12 in Frankrijk".

> **Gerepareerd.** Allebei, in die volgorde. `journeyOpTerugkeer()` in
> [js/journey.js](js/journey.js:150) zet de banner bij terugkeer eerst terug op wat de app
> werkelijk weet, en vraagt daarna één verse positie; komt die binnen, dan wint hij vanzelf.
> `grensBannerHTML()` kent nu een verouderde vorm: andere kop, een regel erboven die zegt
> waarom, en de accentkleur weg.
>
> Nagelopen met een gesimuleerde onderbreking van twee uur, van Italië naar Oostenrijk:
>
> ```
> vóór wegschakelen   "Je rijdt nu in Italië"
> na terugkomst       "Laatst gezien om 01:45 in Italië"
>                     + "De app keek niet mee terwijl hij op de achtergrond stond."
> na de verse fix     "Je rijdt nu in Oostenrijk"
> ```
>
> Drie remmen erin, alle drie nagelopen: even van tabblad wisselen doet niets (wat vers is
> blijft vers), reismodus uit doet niets, en zonder ooit een fix gehad te hebben doet het
> ook niets.

### c. De correctielink staat aan de verkeerde kant

**C2-5 eist:** *"de twee geverifieerde velden — alcohollimiet en pechhulpnummer — tonen
confidence: verified, de rest van het blok toont uncertain met de correctielink erbij."*

De data klopt: alle zestien landen hebben `alcohol.confidence` en `roadside.confidence` op
`verified` en het omliggende blok op `uncertain`, met `lastVerified: 2026-08-31`. De badges
verschijnen ook correct. Maar:

```
blok "gecontroleerd"  → Officiële website →  ·  Klopt dit niet?     ← correctielink hier
blok "onzeker"        → Officiële website →                         ← en hier niet
```

Precies omgekeerd aan wat het criterium vraagt, en ook omgekeerd aan wat logisch is: bij
een onzeker gegeven wil je juist dat iemand kan zeggen dat het niet klopt.

In [js/incident.js](js/incident.js:59) staat `correctionLinks()` in
`incidentContactHTML`; in `incidentZinnenHTML` (regel 96) ontbreekt hij. De blokken
"Voordat je uitstapt" en "Europees schadeformulier" dragen helemaal geen badge, terwijl ook
die uit `onderweg` komen met `confidence: uncertain`.

**Kleinere smet in hetzelfde blok:** het contactblok toont `ow.alcohol.confidence` als
badge, terwijl het blok het alarmnummer en het pechhulpnummer bevat. Beide staan op
`verified`, dus je ziet het niet — tot er ooit één van de twee verspringt.

> **Gerepareerd.** Eén helper, `owBronRegelHTML()` in
> [js/incident.js](js/incident.js:36), zet onder elk blok dezelfde drie dingen: badge,
> bronlink, correctielink. Alle vier de blokken gebruiken hem nu, dus de correctielink
> staat waar hij hoort — óók, en juist, bij het onzekere. De smet is meegenomen: het
> contactblok leest zijn badge nu uit `roadside.confidence`, het gegeven dat er werkelijk
> in staat.
>
> ```
> contact                      gecontroleerd   bron ✓   correctie ✓
> Voordat je uitstapt          onzeker         bron ✓   correctie ✓
> Europees schadeformulier     onzeker         bron ✓   correctie ✓
> Vijf zinnen voor onderweg    onzeker         bron ✓   correctie ✓
> ```
>
> Alle zestien landen doorgelopen: elk levert vier bronregels op, geen enkele fout. De
> knop werkt ook binnen de modal — de afhandelaar voor `[data-melden]` staat op
> document-niveau ([js/app.js](js/app.js:189)), dus hij pakt hem vanzelf op.

### d. Op `file://` blijft de grootte "wordt berekend"

**C4-1 eist:** *"Open de app via `file://` of in een browser zonder die API: er staat een
terugvaltekst, geen leeg vak en geen error."*

Twee gevallen, twee uitkomsten:

```
navigator.storage ontbreekt      → "Deze browser kan de opslaggrootte niet tonen."  ✓
estimate() weigert (file://)     → "Grootte wordt berekend…"  — voor altijd         ✗
```

De `.catch(function(){})` in `pakKaartHTML()` ([js/journey.js](js/journey.js:207)) vangt de
afwijzing wel op, maar schrijft niets terug. De laadtekst blijft staan. Dat is geen leeg
vak en geen error, maar het is wel een regel die belooft dat er nog iets komt, en er komt
niets meer. En `file://` is precies waar de app óók moet werken.

**Reparatie:** in die `catch` dezelfde terugvaltekst zetten als in de `else`-tak. Eén
regel.

> **Gerepareerd.** Precies dat, in [js/journey.js](js/journey.js:236). Opnieuw gemeten met
> een `estimate()` die weigert:
>
> ```
> API ontbreekt        "Deze browser kan de opslaggrootte niet tonen."
> estimate() weigert   "Deze browser kan de opslaggrootte niet tonen."
> normaal              "Offline opgeslagen: circa 23,6 MB."
> ```

### e. Het tankadvies rekent niet met de kilometers

**C5-1 gaat door op de letter** — er verschijnt een concreet advies met een besparing en de
prijsdatum. Maar de opdracht in de roadmap luidde: *"Combineer met je route-afstand per
land."* Dat gebeurt niet.

`tankAdvies()` in [js/fuel.js](js/fuel.js:30) zoekt het goedkoopste en het duurste land uit
de lijst en rekent:

```js
besparing: (duur.prijs - goedkoop.prijs) * 50 liter
```

De route komt er alleen aan te pas als poortwachter: is er geen `tripAnalyse`, dan geen
advies. De kilometers per land, die daar netjes in staan, worden nergens gebruikt.

Dat levert op onze proefreis dit op:

> "Tank vol in **Oostenrijk** en niet in Nederland — dat scheelt circa €18,25 op een volle
> tank van 50 liter."

Oostenrijk is de bestemming. Je rijdt er 150 van de 900 kilometer, aan het eind. Het advies
komt erop neer dat je van Utrecht naar Salzburg moet rijden voordat je tankt. Het bedrag
klopt rekenkundig en het advies is praktisch onbruikbaar.

Duitsland — 600 van de 900 kilometer, twee cent duurder dan Oostenrijk — is het antwoord
dat een reiziger zoekt, en de data om dat uit te rekenen ligt er al.

**Reparatie:** weeg de kandidaten met `res.km[code]`, en sluit het laatste land uit tenzij
er een terugreis is. Dit is de enige van de vijf die meer dan een middag kost.

> **Gerepareerd**, en iets anders dan hierboven bedacht. Het bleek niet nodig het eindland
> apart uit te sluiten: als je weegt met de kilometers die ná het binnenrijden van een land
> nog vóór je liggen (`kmVanafLand()` in [js/fuel.js](js/fuel.js:40)), valt het eindland er
> vanzelf uit. Een land telt mee vanaf 200 km resterend (`TANK_MIN_KM_NA`), en de
> vergelijking gaat tegen je vertrekland — daar zou je anders getankt hebben. Onder €2
> verschil komt er geen advies; dat is ruis.
>
> Vier routevormen nagelopen:
>
> ```
> NL 150 · DE 600 · AT 150   "Tank vol in Duitsland en niet in Nederland — vanaf daar heb
>                             je nog 750 van de 900 km voor je. Circa €6,45."
> NL 600 · DE 150 · AT 150   idem, met "nog 300 van de 900 km voor je"
> AT 150 · DE 600 · NL 150   "Je vertrekt al in het goedkoopste land van je route."
> NL 60 · DE 80              "Je rijdt nergens ver genoeg door om een tankstop te laten
>                             lonen — hieronder wel de prijzen per land."
> ```
>
> Oostenrijk verdwijnt uit het advies zodra het aan het eind ligt, en Duitsland — 600 van
> de 900 km — komt eruit zoals het hoort.
>
> Eén ding is onderweg veranderd ten opzichte van mijn eerste poging. Die zette de eigen
> kilometers van het goedkope land in de zin ("daar rijd je 600 van de 900 km"). Dat leest
> prettig zolang het goedkope land ook het langste is, maar op de tweede route hierboven
> werd het "daar rijd je 150 van de 900 km" — een argument tégen het advies dat eronder
> staat. Nu staat het getal er dat het advies werkelijk draagt: wat er nog vóór je ligt.
>
> **Wat nog steeds een aanname is:** de tank van 50 liter. Die stond er al, hij staat in de
> zin zelf genoemd, en de app kent de tankinhoud van je auto niet. Het bedrag is daarmee
> een orde van grootte, geen belofte — en het verschuift niet met de afstand, alleen met
> het prijsverschil.

---

## 5. Wat wél overtuigend staat

**De offline-belofte houdt stand.** Ik heb de server gestopt en de app volledig herladen.
Hij boot, alle acht pagina's uit fase B renderen, `borders.json` komt uit de cache, de
incidentmodal opent met de vijf Spaanse noodzinnen erin, de verzekeringsgegevens staan er
nog, en er is geen enkele console-fout. Dat is de kern van fase C — *"Alles in deze fase
moet werken zonder netwerk"* — en die kern is heel.

**De throttle werkt precies zoals bedoeld.** Twee landwissels binnen een minuut: de tweede
werd genegeerd, `HUIDIG_LAND` bleef op België staan, geen melding. Na het verzetten van de
klok kwam Frankrijk er alsnog door, met de juiste snelheidslimiet (130 op de snelweg), de
juiste alcohollimiet (0,5‰ met de 0,2‰-uitzondering voor beginners) en de verplichte
uitrusting bij een NL-kenteken.

**Vignetstatus in de banner klopt ook.** Bij binnenkomst in Oostenrijk: *"Vignet voor
Autobahnvignette: nog niet geregeld."* Dat leest uit hetzelfde afvinkveld als de
checklist — vink je het vignet af, dan verandert de banner mee. Geen tweede waarheid naast
de eerste.

**Het uitzetten laat niets achter.** Schakelaar uit, `clearWatch` aangeroepen met het
juiste id, `JOURNEY_WATCH_ID` op `null`, banner leeg én verborgen, en na een herlaadbeurt
staat de schakelaar nog steeds uit. Precies wat je wil van iets dat je batterij kost.

**De verversknop is echt netwerkverkeer.** In het netwerkpaneel staan de vijf bestanden als
verse verzoeken met status 200, niet als cachetreffers — de `cache: "reload"` doet zijn
werk.

---

## 6. Kleinere dingen, voor de volledigheid

* ~~De systeemmelding laat de **verlichtingsplicht** weg.~~ **Gerepareerd.**
  `grensTekstPlat()` nam snelheid, alcohol, vignet en uitrusting mee maar niet
  `lightingRule`; de banner toonde hem wel, terwijl de melding juist het ding is dat je
  leest zonder de app open te hebben. C1-1 noemt verlichtingsplicht met zoveel woorden, en
  is daarmee nu ook letterlijk waar. De melding bij binnenkomst in Oostenrijk draagt
  "Dagrijverlichting verplicht, het hele jaar, ook overdag."
* ~~Bij een **geweigerde locatietoestemming** blijft de schakelaar aan staan.~~
  **Gerepareerd**, en met een onderscheid dat er eerst niet was: de foutafhandeling kijkt
  nu naar de aard van de fout. Een timeout of een onbekende positie gaat over — reismodus
  blijft staan en probeert het opnieuw. Toestemming gaat niet over zolang je hem niet in je
  browser terugzet, en daar gaat reismodus dus uit, met de reden in de statusregel. Een
  schakelaar die "aan" zegt terwijl er niets bijgehouden wordt, is een leugen; een
  schakelaar die uitgaat met een uitleg erbij niet.

  ```
  code 1  toestemming geweigerd   uit · watch opgeruimd · vinkje uit · opslag false
  code 2  positie onbekend        blijft aan, watch actief
  code 3  timeout                 blijft aan, watch actief
  ```
* **Zonder `fuelprices.json`** verdwijnt de tankkaart niet, maar toont hij
  "Brandstofprijzen konden niet geladen worden." C5-4 zegt "zonder tankkaart". Ik heb dit
  niet als mankement geteld — uitleggen waarom iets er niet is, is beter dan het geruisloos
  weglaten, en §34 van de masterprompt kiest dezelfde kant.
* De **printregel** verbergt `.sosbutton`, `.sosdialoog` en `.grensbanner-wrap`
  ([css/print.css](css/print.css:27)), dus fase C lekt niet in de uitdraai van fase B.

---

## 7. Wat er nu moet gebeuren

De vijf mankementen uit §4 zijn gerepareerd en nagelopen (9 september 2026), en de twee
kleine dingen uit §6 erna. `sw.js` staat daarvoor op `grenschecklist-v29`; zonder die bump
krijgt een toestel dat de app al eens opende de oude bestanden te zien.

Daarmee gaat **zeventien van de achttien** tests door. De enige die nog omvalt is C2-1, en
die valt om door een keuze die nog niet gemaakt is. Wat overblijft is geen code:

1. **Beslis over de noodknop** (§2). Dit is een keuze tussen twee criteria, geen bug. Tien
   minuten nadenken, één regel code. Zolang die beslissing uitblijft is C2-1 de enige test
   die nog omvalt.
2. **Bouw C3, of schrap C3 uit fase C** (§3). Beide zijn verdedigbaar; net doen alsof de
   fase af is terwijl hij er niet in zit, is dat niet. Merk op dat de roadmap zelf bij §496
   zegt: *"Pas daarna fase C. Zonder gebruikers weet je niet welke onderweg-functie ze echt
   willen."* De drie sessies uit `docs/GEBRUIKERSTEST_B.md` zijn ook hier het goedkoopste
   antwoord: vraag die drie mensen of ze foto's van hun groene kaart in een app zouden
   zetten. Als het antwoord nee is, heb je C3 net gratis geschrapt.

En dan het punt dat boven beide staat, omdat het ze allebei beantwoordt: **de drie
testsessies**. Ze zijn niet alleen wat criterium B afmaakt. Ze zeggen ook of iemand die
noodknop op de homepage mist (§2) en of iemand foto's van zijn groene kaart in deze app zou
zetten (§3). Dat zijn de twee dingen waar fase C nu op staat te wachten, en ze kosten samen
drie kwartier van drie mensen.

Zolang die sessies niet gebeurd zijn, is bijbouwen aan fase C bouwen op aannames die je in
een middag had kunnen controleren.
