# GRENSCHECKLIST — Roadmap naar een verkoopbaar product

Aanvulling op `GRNSCHECKLIST_V2_MASTERPROMPT.txt`. Die prompt beschrijft *wat* V2 moet worden.
Dit document beschrijft *in welke volgorde* je het bouwt, wat er ontbreekt om er geld mee te
verdienen, en geeft per fase een prompt die je rechtstreeks in Claude Code kunt plakken.

Elke fase heeft een **acceptatiecriterium**. Ga pas door als dat gehaald is. Doe je dat niet,
dan bouw je features bovenop een fundament dat omvalt zodra er echte gebruikers zijn.

---

## Overzicht

| fase | naam | duur (indicatie) | waarom |
|---|---|---|---|
| A | Fundament & blockers | 1–2 weken | zonder dit gaat de launch stuk |
| B | V2-UX (bestaande masterprompt) | 2–4 weken | van checklist naar reisassistent |
| C | Onderweg-modus | 2–3 weken | hier ontstaat "onmisbaar" |
| D | Terugkeerlus | 1–2 weken | hier ontstaat terugkerend gebruik |
| E | Vindbaarheid | 1–2 weken | hier komen de gebruikers vandaan |
| F | Verdienmodel | 1–2 weken | hier komt het geld vandaan |
| G | App store (Capacitor) | 1 week | alleen ná bewezen webverkeer |
| H | Kwaliteit, juridisch, launch | doorlopend | |

Werk per fase in een aparte git-branch. Commit klein. Na elke fase: console errors nakijken,
mobiel testen, offline testen, en de vorige fase opnieuw doorlopen om regressies te vangen.

---

# FASE A — FUNDAMENT & BLOCKERS

Dit is de saaiste fase en de belangrijkste. Bouw hier geen enkele nieuwe gebruikersfunctie.

## A1 — Audit

Zit al in de masterprompt (§31, FASE 0). Laat Claude Code `V2_AUDIT.md` maken vóór alles.
Voeg aan de audit-opdracht twee vragen toe die er nu niet in staan:

- welke bestanden bevatten hardgecodeerde Nederlandse tekst, en hoeveel strings zijn dat ongeveer;
- welke functies gaan er impliciet van uit dat er netwerk is.

## A2 — Repo-structuur + build step

`index.html` als één bestand met alle logica is niet houdbaar zodra je SEO-pagina's, een
kaart en meerdere talen hebt. Splits zoals §18 van de masterprompt beschrijft, en voeg één
lichte build step toe (een Node-script of Astro/11ty) die statische pagina's genereert uit
`countries.json`. Dat laatste is de reden om dit nú te doen: SEO-pagina's achteraf inbouwen
in een single-file app is pijnlijk.

De app zelf blijft vanilla JS. Geen React, geen bundler-complexiteit.

## A3 — Routeprovider-abstractie + eigen backend-proxy

**Dit is de harde blocker.** De OSRM-demoserver en Nominatim zijn niet-commercieel, hebben
geen uptime-garantie en zijn beperkt tot ongeveer 1 request/seconde.

Bouw:

1. `js/routeProvider.js` met een neutrale interface: `getRoute(from, to, opts)`,
   `geocode(query)`, `reverseGeocode(lat, lon)`.
2. Een dunne serverless proxy (Cloudflare Workers of Netlify/Vercel Functions) waar de
   API-sleutel achter blijft, met caching op route-hash en een rate limit per IP.
3. Minstens twee implementaties achter dezelfde interface, plus een fallback-keten:
   primaire provider → tweede provider → handmatige landenkeuze.

Providers om te vergelijken (**check zelf de actuele tarieven, die wijzigen**):

- **GraphHopper Directions API** — vergelijkingssites noemen betaalde plannen vanaf ongeveer
  $59/maand; expliciet commercieel gebruik toegestaan, OSM-gebaseerd. Waarschijnlijk je
  beste startpunt.
- **openrouteservice** — gulle gratis laag, maar let goed op de licentievoorwaarden voor
  commercieel gebruik.
- **Mapbox Directions** — ruime gratis laag per maand, duurder daarboven.
- **Zelf gehoste OSRM** op een VPS met alleen het Europese OSM-extract — eenmalig werk,
  daarna vaste lage kosten en geen rate limit. Financieel het aantrekkelijkst zodra je
  volume hebt; overweeg dit vanaf fase F.

Geocoding kun je grotendeels vermijden: je `cities.json` met 689 plaatsen dekt het meeste al
lokaal. Breid die uit naar ~3000 plaatsen in plaats van vaker een geocoder aan te roepen.

**Acceptatiecriterium A3:** je kunt in één configuratieregel van provider wisselen zonder dat
wizard, kaart of state-laag verandert. Als je de primaire provider uitschakelt, valt de app
netjes terug op de handmatige landenkeuze zonder foutmelding in de console.

## A4 — Data losmaken van de app

Je regeldata moet kunnen wijzigen zonder dat je de app opnieuw uitrolt. Dat is meteen de
basis voor je latere B2B-API.

- Zet `countries.json`, `zones.json`, `drukte.json` achter een versioned endpoint
  (`/api/v1/data/countries.json`) met ETag en lange cache.
- De app haalt bij opstarten op, valt terug op de meegeleverde kopie in de service worker.
- Elk feit krijgt een stabiel `id` en een `confidence`-veld (`official` / `verified` /
  `uncertain` / `unavailable`), zoals §13 van de masterprompt beschrijft.
- Schrijf `tools/verify-data.js`: rapporteert alles met `lastVerified` ouder dan 180 dagen,
  alles met `needsVerification: true`, en alle dode `sourceUrl`'s (HTTP-check). Laat dit
  maandelijks draaien.
- Houd `meta/changelog.json` bij: welk feit, oude waarde, nieuwe waarde, datum, bron. Dit
  voedt straks zowel je wijzigingsmonitor (fase D) als een publieke changelog-pagina (fase E).

**Acceptatiecriterium A4:** je kunt een vignetprijs wijzigen door één JSON-bestand te uploaden,
zonder deploy, en de app toont de nieuwe waarde binnen een minuut.

## A5 — i18n-scaffolding

Zoals §17A van de masterprompt. Alle UI-strings via `js/i18n.js`. Vertaal in deze fase alleen
NL en EN volledig; landdata-teksten mogen voorlopig Nederlands blijven mits de UI dat eerlijk
aangeeft. DE en FR volgen zodra er verkeer is — dat zijn samen verreweg de grootste markten.

### Prompt voor fase A

```
Werk in de repo GRENSCHECKLIST. Lees eerst V2_AUDIT.md, README.md en
GRNSCHECKLIST_V2_MASTERPROMPT.txt volledig.

Deze fase bouwt GEEN nieuwe gebruikersfuncties. Doel is uitsluitend het fundament.

1. Splits index.html op volgens §18 van de masterprompt, aangepast aan wat er
   werkelijk staat. Voeg een minimale Node-build toe die statische pagina's kan
   genereren uit countries.json (nog geen pagina's maken, alleen de pipeline).
2. Bouw js/routeProvider.js: een abstractielaag met getRoute(from,to,opts),
   geocode(query), reverseGeocode(lat,lon). Kapsel de huidige OSRM/Nominatim-
   aanroepen erachter als implementatie "osrm-demo". Voeg een tweede lege
   implementatie "graphhopper" toe met dezelfde signatuur, en een providerketen
   met fallback naar handmatige landenkeuze.
3. Bouw een serverless proxy-endpoint (Cloudflare Worker) dat routeverzoeken
   doorzet, de API-sleutel serverside houdt, resultaten cachet op route-hash en
   per IP rate-limit. Zet de sleutel niet in de repo.
4. Verplaats countries.json, zones.json en drukte.json naar een versioned
   data-endpoint met ETag. De app haalt op bij opstarten en valt terug op de
   bundled kopie. Voeg per feit een stabiel id en een confidence-veld toe
   (official/verified/uncertain/unavailable).
5. Schrijf tools/verify-data.js: rapporteert verlopen lastVerified (>180 dagen),
   needsVerification-vlaggen en dode sourceUrl's.
6. Zet meta/changelog.json op met de structuur: id, land, onderwerp, oude waarde,
   nieuwe waarde, datum, bron.
7. Bouw js/i18n.js met { nl, en } en haal alle hardgecodeerde UI-strings eruit.
   Voeg een taalkeuze toe in de UI.

Behoud alle bestaande functionaliteit. Werk incrementeel, commit per onderdeel.
Test na elk onderdeel: console errors, mobiel, offline, print.
```

---

# FASE B — V2-UX

Dit is je bestaande masterprompt, ongewijzigd: homepage, reiswizard, dashboard, actielijst met
deadlines, kaart, kostenpagina, reisdocument, deelbare reis.

Drie aanvullingen die er nog niet in staan:

**Boetekans-totaal op het dashboard.** Naast "72% klaar" één regel: *"Als je niets regelt loop
je op deze route €1.240 risico."* Je hebt de boetebedragen al in de data. Dit is het getal dat
mensen screenshotten en doorsturen.

**"Waarom zie ik dit?" bij elke actie.** Eén regel die de herkomst toont: *"Omdat je route
63 km door Slovenië loopt"* of *"Omdat je een Belgisch kenteken hebt."* Dit maakt het verschil
tussen een lijst die je vertrouwt en een lijst die je wegklikt.

**Vertrouwensbalk.** Onderaan het dashboard: *"Deze reis is gebaseerd op 34 feiten. 29 officieel
bevestigd, 4 gecontroleerd, 1 onzeker. Laatst gecontroleerd: 19 augustus 2026."* Dat is je
grootste concurrentievoordeel en op dit moment is het onzichtbaar.

**Acceptatiecriterium B:** de 12 punten uit §32 van de masterprompt, plus: iemand die de app
nooit zag kan zonder uitleg binnen twee minuten een persoonlijke checklist krijgen op een
telefoon. Test dit met drie echte mensen, niet met jezelf.

---

# FASE C — ONDERWEG-MODUS

Hier wordt de app onmisbaar. Alles in deze fase moet werken **zonder netwerk**.

## C1 — Grensmelding

Bij het oversteken van een grens: een melding met de kernregels van het nieuwe land.
Snelheidslimieten (binnen bebouwde kom / buiten / snelweg, aangepast aan je voertuigtype —
met caravan gelden andere limieten), alcohollimiet, verplichte verlichting, wat je in de auto
moet hebben, en of je vignet geregeld is.

Technisch: `navigator.geolocation.watchPosition()` met een lage frequentie, point-in-polygon
tegen `borders.json` (die logica bestaat al voor de landdetectie), lokale notificatie.
Volledig offline. Alleen actief als de gebruiker "reismodus" aanzet — nooit stiekem op de
achtergrond, dat kost je batterij én vertrouwen.

Let op: op iOS werkt achtergrondlocatie in een PWA niet betrouwbaar. Dit is het argument voor
fase G.

## C2 — Incidentmodus

Eén grote, altijd bereikbare knop: **pech of ongeval**. Toont voor het land waar je nú bent:

- alarmnummer (112 plus het lokale pechnummer);
- wat de wet vereist vóórdat je uitstapt — hesje aan bínnen de auto in Spanje en Italië,
  gevarendriehoek op X meter, verlichting;
- Europees schadeformulier met de veldnamen in de lokale taal ernaast;
- vijf zinnen fonetisch: *ik heb een ongeval gehad · niemand is gewond · ik heb pech ·
  mijn auto start niet · waar is de dichtstbijzijnde garage*;
- de contactgegevens van je eigen verzekering en pechhulp (die je één keer invult);
- de vraag die mensen vergeten: *heb je foto's van beide voertuigen, de positie en de
  kentekenplaten?*

## C3 — Documentenkluis met vervaldatumcheck

Lokaal opgeslagen foto's van rijbewijs, groene kaart, verzekeringsbewijs, kentekenbewijs,
paspoort. IndexedDB, versleuteld, nooit naar een server (dat is meteen je privacy-verhaal).

De slimme laag: je voert de vervaldatum in, en de app vergelijkt met je reisdata.
*"Je groene kaart verloopt op 14 juli. Je bent dan nog in Kroatië."*

## C4 — Offline reispack

Eén knop vóór vertrek: alles wat je onderweg nodig hebt in de cache. Regels per land, kaart-
tegels van je routecorridor, tolpunten, milieuzones, noodnummers, je documenten. Toon de
grootte in MB en wanneer het pack gemaakt is.

## C5 — Tankstrategie

De Europese Commissie publiceert wekelijks brandstofprijzen per land (Oil Bulletin, gratis).
Combineer met je route-afstand per land: *"Diesel: NL €1,89 · DE €1,72 · FR €1,81. Tank vol
vlak na de Duitse grens — scheelt ongeveer €19 op deze rit."*

### Prompt voor fase C

```
Bouw de onderweg-modus. Alles in deze fase moet werken zonder netwerkverbinding
en zonder account. Gebruik de bestaande borders.json en point-in-polygon-logica.

1. Reismodus met grensdetectie: watchPosition op lage frequentie, point-in-polygon
   tegen borders.json, lokale notificatie bij landwissel met snelheidslimieten
   (aangepast aan voertuigtype), alcohollimiet, verlichtingsplicht, verplichte
   uitrusting en vignetstatus. Alleen actief na expliciete opt-in, met duidelijke
   aan/uit-knop en een waarschuwing over batterijgebruik.
2. Incidentmodus: altijd bereikbare knop, toont per huidig land het alarmnummer,
   wat de wet vereist voor uitstappen, het Europees schadeformulier met lokale
   veldnamen, vijf fonetische noodzinnen, en de eigen verzekerings- en
   pechhulpgegevens van de gebruiker. Voeg de benodigde velden toe aan
   countries.json met sourceUrl en lastVerified.
3. Documentenkluis: IndexedDB, versleuteld, foto's + vervaldatum per document.
   Vergelijk vervaldatums met departureDate/returnDate en waarschuw wanneer een
   document tijdens de reis verloopt. Nooit uploaden.
4. Offline reispack: één knop die alle route-relevante data en kaarttegels cachet.
   Toon grootte en aanmaakdatum, met een knop om te verversen.
5. Tankstrategie: haal brandstofprijzen per land op uit de wekelijkse EU Oil
   Bulletin-data, combineer met km per land, toon een concreet tankadvies met
   geschatte besparing. Markeer als indicatief, met datum van de prijsdata.

Test elk onderdeel met vliegtuigmodus aan.
```

---

# FASE D — TERUGKEERLUS

## D1 — Wijzigingsmonitor

Gebruiker slaat een reis op (nog steeds zonder account — een lokale sleutel plus optioneel
e-mailadres is genoeg). Wijzigt er een feit in `meta/changelog.json` dat zijn route raakt, dan
krijgt hij bericht met land, onderwerp, oude en nieuwe waarde, datum en bron.

Dit is je enige echte abonnementsargument. Bouw het goed.

## D2 — Voertuig- en vignetgeheugen

Onthoud per voertuig wat er al geregeld is en hoe lang dat geldig is. *"Je Zwitserse vignet
2026 is geldig tot 31 januari 2027 — je hoeft niets te doen."* Voorkomt dat mensen elk jaar
dezelfde checklist opnieuw moeten aflopen, en dat is precies waarom ze terugkomen.

## D3 — Terugreis- en na-reismodus

Douanelimieten voor de terugweg, en: *"Boetes uit Frankrijk komen doorgaans na 4–8 weken. Zo
herken je een echte: [kenmerken]. Betaal nooit via een link in een e-mail."* Nepboetes uit het
buitenland zijn een plaag; dit is goedkope, hoge goodwill.

---

# FASE E — VINDBAARHEID

## E1 — Gegenereerde contentpagina's

Genereer statisch uit `countries.json` en `zones.json`, nooit met de hand:

```
/autorijden-frankrijk        /vignet-oostenrijk       /milieuzones-duitsland
/autorijden-oostenrijk       /vignet-zwitserland      /milieuzone-parijs
/tol-frankrijk               /winterbanden-oostenrijk /crit-air-uitleg
```

Elke pagina toont dezelfde data als de app, met `lastVerified` zichtbaar en een CTA naar de
wizard. Omdat ze uit de data gegenereerd worden, verouderen ze nooit — dat is een structureel
voordeel op elke concurrent die dit met de hand schrijft.

## E2 — De check-pagina als deelbaar artefact

`/mag-ik/parijs` met een klein formulier: brandstof, euronorm, kenteken → direct antwoord.
Deelbaar via URL met de parameters erin. Dit is tegelijk je beste zoekwoord en je beste
WhatsApp-doorstuur.

## E3 — Publieke changelog

`/wijzigingen` — gevoed door `meta/changelog.json`. Toont dat de data leeft. Journalisten en
Google houden hier allebei van.

## E4 — Distributie buiten Google

- Seizoenspitch aan Belgische en Nederlandse media in mei/juni en november/december. Je hebt
  een verhaal dat ze willen: *"21 van de 47 Europese milieuzones zijn zo onduidelijk
  gedocumenteerd dat je niet kunt weten of je erin mag."*
- Facebookgroepen rond camperreizen en caravanvakanties (enorm en actief), Wintersport.nl,
  camperforums.
- Touring, VAB, ANWB, ADAC — niet als concurrent maar als partner.

---

# FASE F — VERDIENMODEL

## F1 — Affiliate-laag

Bouw het als data, niet als hardgecodeerde links: `partners.json` met per productcategorie en
per land de partner, de link en het commissiemodel. Regels die je jezelf oplegt en in de code
afdwingt:

- alleen tonen bij een actie die de checklist zelf al genereerde;
- de officiële, gratis bron staat er altijd naast en even prominent;
- elke affiliate-link is als zodanig gemarkeerd;
- de volgorde wordt nooit door commissie bepaald.

Categorieën: vignetten (Autopay, tolltickets, vintrica), pechhulp en reisverzekering, veerboten
en autoslaaptreinen, uitrustingssets, eSIM.

## F2 — Premium-vlag

Nog geen betaalmuur bouwen. Wel: één centrale `isPremium()` en alle premium-functies erachter,
zodat je later Stripe of Paddle in één plek aansluit. Kandidaten: opgeslagen reizen,
wijzigingsmonitor, camper/caravanmodule, documentkluis-sync, uitgebreid offline pack.

## F3 — B2B-widget en API

Je data-endpoint uit fase A4 is al de API. Voeg toe:

- een `<iframe>`-widget met een `?theme=`-parameter voor huisstijl;
- API-sleutels met quota;
- een `/zakelijk`-pagina met één duidelijk aanbod.

Doelgroepen in volgorde van haalbaarheid: camperverhuurbemiddelaars, leasemaatschappijen,
mobiliteitsclubs, autodealers, reisorganisaties.

---

# FASE G — APP STORE (alleen ná bewezen webverkeer)

Wikkel dezelfde codebase met **Capacitor**. Je schrijft niets opnieuw.

Wat je ermee wint en anders niet krijgt:
- betrouwbare achtergrondlocatie op iOS (nodig voor de grensmelding uit C1);
- pushmeldingen voor de wijzigingsmonitor;
- vindbaarheid in de App Store;
- vertrouwen — mensen installeren voor een reis liever een app dan een bladwijzer.

Kosten: Apple Developer €99/jaar, Google Play €25 eenmalig. Reken op een week werk plus een
eerste review-ronde.

Doe dit niet eerder. Een app store-app zonder gebruikers is een onderhoudslast met een
jaarabonnement eraan vast.

---

# FASE H — KWALITEIT, JURIDISCH, LAUNCH

- **Juridisch:** duidelijke disclaimer (informatief, geen juridisch advies, controleer altijd de
  officiële bron), voorwaarden, privacyverklaring. Je hebt geen accounts en geen tracking-cookies
  nodig, dus geen cookiebanner — gebruik cookieloze analytics (Plausible of self-hosted Umami).
- **Analytics:** alleen geaggregeerde events zoals §26 van de masterprompt. Nooit kentekens.
- **Tests:** schrijf minstens unit-tests voor de landdetectie, de emissie-oordeelsfunctie en
  de tolberekening. Dat zijn de drie plekken waar een stille fout iemand een boete oplevert.
- **Foutscenario's expliciet testen:** provider down, geen netwerk, ongeldige invoer,
  route buiten Europa, route volledig binnen één land, veerbootroute.
- **Monitoring:** uptime-check op je proxy en je data-endpoint.

---

# Wat ik de eerste 30 dagen zou doen

1. Fase A volledig. Niets anders. Vooral A3 en A4.
2. `verify-data.js` draaien en de 21 onzekere zones terugbrengen naar hooguit vijf. Je data
   is je product; twee dagen bronnenwerk is hier meer waard dan twee weken features.
3. Domeinnaam en naam definitief kiezen vóór je in SEO investeert. "Grenschecklist" werkt in
   het Nederlands maar sluit Duitsland, Frankrijk en het VK uit — samen je grootste markt.
   Overweeg een neutrale merknaam met `grenschecklist.be` als Nederlandstalige ingang.
4. Fase B afmaken en live zetten als PWA. Gratis, geen account.
5. Vijf echte mensen laten proberen zonder uitleg terwijl je meekijkt. Niets is zo goedkoop
   en zo pijnlijk nuttig.

Pas daarna fase C. Zonder gebruikers weet je niet welke onderweg-functie ze echt willen.
