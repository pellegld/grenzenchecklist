# ACCEPTATIE_DESIGN.md — het herontwerp "Stil roadbook", nagelopen

Nagelopen op 19 september 2026 tegen een lokale server zonder cache, in de ingebouwde
browser op 375 px (licht én donker) en 1280 px (licht), in nl en en. De reis in alle proeven:
Utrecht → Salzburg, 10–17 oktober 2026, diesel Euro 5, NL-kenteken, route via OSRM berekend
(938 km, NL · DE · AT, vier milieuzones, één vignet).

De nummers verwijzen naar de functie-inventaris in `DESIGN_VOORSTEL.md` §1. "Werkt" betekent:
zelfde gedrag als vóór het herontwerp, alleen anders getekend.

---

## Derde ronde, dezelfde dag: het atlasblad precies als de mockup

Na de tweede ronde was het oordeel "nog niet zo precies als de mockup, vooral de kaart".
Nagelopen tegen `mockup-wegenatlas.html` (scherm voor scherm, 375 px licht en donker,
1024 px licht) en bijgewerkt:

**Kaart (§9).** De route is nu een hoofdweg in drie lagen — donkere rand, rood wegdek,
gestippelde lichte middenstreep — in schermpixels (`vector-effect:non-scaling-stroke`),
dus inzoomen maakt hem niet dikker. Markers tekenen op schermformaat (`pasHitVlakkenAan()`
zet de schaal in de transform) in plaats van in viewBox-eenheden, waardoor ze op een
telefoon niet meer tot vier pixels krompen. Elke plaats krijgt een naambordje: wit met
zwarte rand, groen voor een milieuzone, rood als deze auto er niet in mag
(`markerLabelHTML()`); `plaatsNaambordjes()` legt ze rechts van de stip, links in het
rechter derde van het blad, een regel hoger of lager als ze anders over een stip of een
eerder bordje vallen, en nooit buiten het blad. Namen worden ingekort tot de kern
("Ruhrgebied", niet "Ruhrgebied (Duisburg, Bochum)") en een naam die al op het blad staat
komt er niet nog eens op. Tolpunten krijgen hun naam alleen op ≥ 1024 px. De legenda toont
route, markertypen en een schaalbalk die zich aan de zoom aanpast (100 km, gehalveerd zolang
hij breder dan 220 px zou worden). De kop van het paneel is "ROUTE EN KAART" met rechts de
landcodes ("NL · DE · AT", `#kaartcodes`), de veldnamen VAN en NAAR staan ín het veld
rechts, en het afstandsbord heeft drie cellen naast elkaar. De popup verankert op de stip,
niet op stip-plus-bordje.

**Topstrook (mobiel).** Onder het merk de reis ("UTRECHT — SALZBURG"), rechts een
bladvakje met het ene getal dat op dit scherm telt: KLAAR 9 % op het dashboard, NOG 10 op
de actiepagina (`zetTopstrook()` in js/app.js, na elke render). Zonder reis staat er de
ondertitel van de app. De taal- en nachtknop blijven ernaast.

**Dashboard (§6).** Volgorde als op het atlasblad: afstandsbord, wegwijzers per land, de
reis (kop, periode, voertuig, wijzig, deel), dan het register "DIT MOET JE REGELEN" met de
telling rechts ("5 van 11"), regels met het bord links en de prijs en vlag rechts, en
eronder de gele afslag "Bekijk alle acties". De voortgangsbalk met tellers staat daaronder
zonder grote kop. Op 1000 px+ dezelfde twee kolommen als eerst.

**Acties (§7).** Groepskoppen als registerkoppen (klein, gespatieerd, telling rechts,
lijn erboven), het vinkje links en het bord rechts (`.statuschip` uit de metaregel wordt
rechts gepositioneerd; het statuswoord blijft voor de schermlezer, `.sw`). Regels zonder
vinkje (blokkade, waarschuwing, niet voor jou) houden hun bord links en krijgen er geen
tweede rechts. Deadlines zijn nu bordletters in kapitaal met gele (of rode) onderstreping
en korter: "UITERLIJK 22 SEP" (`fmtDateKort()`, `alg.maandenKort`); dat verandert ook de
tekst in de aria-beschrijving van het vinkje.

**Home (nachtstand).** Het tweede deel van de kop is 's nachts geel, zoals in de mockup;
overdag blijft het grijs (geel op papier is 1,5:1).

**Nagelopen:** dashboard, kaart, acties, home op 375 px licht en donker; dashboard en
kaart op 1024 px; console zonder nieuwe fouten (alleen de bekende endpoint-404's);
`node build/build.mjs --sw` voor een nieuwe cacheversie. Niet in de mockup en ongewijzigd:
kosten, kalender, regels, document, onderweg, reizen, reiservaring.

---

## Tweede ronde, dezelfde dag: "Wegenatlas"

Het "Stil roadbook"-ontwerp uit de secties hieronder is na oplevering verworpen: het leverde
de generieke gebroken-wit-met-kaartjes-look op die elk gegenereerd scherm heeft. Op een
mockup van vier schermen is de richting **"Wegenatlas"** gekozen — de app praat in
verkeersborden — en die is op dezelfde werkboom gebouwd. Alles wat hieronder over gedrag
staat (id's, klassen, JS-aanrakingen, kalender, D7-punten) blijft gelden; alleen de
visuele laag is opnieuw geschreven.

**Wat er is veranderd:** de vier CSS-bestanden opnieuw, de fonts (Geist en Inter eruit,
Barlow Condensed 700/800 en Barlow 400/600/700 erin via `tools/build-fonts.ps1`, 182 KB, tien
bestanden), `sw.js` met de nieuwe assetlijst (`npm run build:sw`, cache v31), en README
§Vormgeving. Geen JS-wijziging: de bordvormen hangen aan de bestaande tekens in de markup.

**Nagelopen** (375 px licht en donker, 1280 px licht, dezelfde reis Utrecht → Salzburg):

| scherm | oordeel | waarop |
|---|---|---|
| home | **ja** | bordletterkop tweekleurig, gele afslagpijl, beloftes, omkaderd voorbeeld met etiket op de rand, "JE REIS"-bord, drie genummerde borden; nachtstand |
| dashboard | **ja** | wegwijzers per land (bestemming groen), afstandsbord met vier cellen, tellers als borden, actielijst met blauwe gebodsborden, rood omkaderde boetekaart, registerregels; nachtstand |
| acties | **ja** | plakkende voortgang, groepskoppen met bordteken, vierkante vinkjes (groen als af), gebodsbordjes, onzekerheid als waarschuwingsbord op papier, deadlines onderstreept; nachtstand |
| kaart | **ja** | atlasblad met kilometerraster, route als rode hoofdweg, groene Z-markers, zwart eindpunt, legenda als wit bord, popup als blad onderaan (mobiel) en als bord bij de marker (1280); afstandsbord; nachtstand |
| kosten | **ja** | bedrag op een afstandsbord, kasboek per categorie met zekerheidsbordjes, brandstofbord, groen tankadvies; nachtstand |
| kalender | **ja** | tegels wit/groen/oranje/rood/zwart met teken, gele vertrekring, blauwe retourring, heen/terug-schakelaar als bord; nachtstand |
| regels | **ja** | fotoplaat met zwarte rand, landkiezer als wit bord, twee oordeelborden met groen vinkje, registerregels met +/−; nachtstand |
| wizard, document, onderweg, reizen, reiservaring, incident, Meer | **ja** | stappen als genummerde borden, reisdocument als vel met dubbele rand, reiskaart als bord met wegwijzers en groene ACTIEF-chip, asfaltweg met gele pijl, nooddialoog met SOS-rode belknop, Meer-blad met bordletters |
| contentpagina's | **ja** | `autorijden-frankrijk/` en `en/can-i-drive-to/paris/` in atlasstijl zonder rebuild |
| console | **ja** | alleen de bekende endpoint-404's |

**Contrast (gemeten):** wit op blauw 8,4:1, op groen 5,4:1, op rood 5,9:1; zwart op geel
11,2:1, op oranje 6,1:1; registerkoppen (`--ink-3`) op papier 5,6:1. In de nachtstand zijn
blauw, groen en rood na meting bijgesteld ten opzichte van de mockup (wit erop was 4,5, 3,3
en 4,3; nu 5,1, 4,6 en 4,7). Alles ≥ 4,5:1 voor tekst.

**Nog met de hand:** ctrl+P (print.css drukt de bordvormen met `print-color-adjust:exact`) en
een echte telefoon.

---

## 0. Wat er veranderd is, in één alinea (eerste ronde, "Stil roadbook")

Vier CSS-bestanden zijn opnieuw geschreven (`css/base.css`, `css/components.css`,
`css/pages.css`, `css/print.css`); alle klassen en id's waar JS aan hangt bestaan nog en de
oude tokennamen leven door als aliassen. Daarnaast vijf kleine JS-aanrakingen zonder
gedragswijziging: `kopHTML()` in `js/util.js` plus `i18nRuw()` en het `¦`-teken in 24
vertaalstrings (`js/i18n.js`) voor de tweekleurige koppen; `routelijnHTML()` in
`js/dashboard.js` (de route als verhaallijn, ook op de reiskaarten in `js/pages.js`); de
landenhero in `js/pages.js` zet de foto nu als `<img>` in plaats van een inline gradient; en
`sw.js` staat op cache v30. `index.html` kreeg één attribuut (`data-i18n-kop` op de kop van
het routepaneel). Geen enkele regel van de reis-, actie-, kosten-, route- of opslaglogica is
aangeraakt.

Twee kleine mankementen van vóór het herontwerp zijn onderweg gerepareerd omdat ze in de
visuele laag zaten: de aanraakvlakken van de kaartmarkers (`.mhit`) werden zwart getekend
(de CSS-selector zocht ze binnen `.marker`, maar ze staan in een eigen laag), en de
dashboardregel voor een blokkade zocht `.actierij.blokkade` terwijl de renderer
`.actierij.s-blokkade` schrijft.

---

## 1. Schil en globale onderdelen (G1–G24)

| # | onderdeel | oordeel | waarop |
|---|---|---|---|
| G1 | laadfout | **niet getest** | vereist een kapotte countries.json; de stijl (`.loaderr`) is amber vlak, ongewijzigd gedrag |
| G2 | cachekopie-waarschuwing | **ja (op stijl)** | `var(--amber)` inline in js/data.js resolveert via alias naar de amber-inkt |
| G3 | offline-status | **ja** | tekst in de zijbalkvoet zichtbaar op 1280 |
| G4 | thema | **ja** | volgt prefers-color-scheme (licht en donker nagelopen op elk scherm); schakelaars in zijbalk en Meer, maanknop in topbar |
| G5 | taal | **ja** | `zetTaal("en")`: alle koppen tweekleurig in het Engels, chips en labels vertaald, terug naar nl zonder rest |
| G6 | skiplink | **ja (op stijl)** | pill met schaduw bij focus |
| G7 | topbar | **ja** | 56 px, geen rand, sticky, merk + NL + maan |
| G8 | onderbalk | **ja** | vijf bestemmingen, actief = inkt met pilvlak; `.active` verspringt mee bij elke wissel |
| G9 | Meer-blad | **ja** | blad van onderen met grijpstreep, zes rijen, schakelaar, Sluiten; licht en donker |
| G10 | zijbalk | **ja** | 256 px, "Nieuwe reis" als accent-pill, actief item met accentstreep, voet met instellingen |
| G11 | wijzigingenbadge | **ja (op stijl)** | inkt-vlak; verborgen bij 0 (changelog is leeg) |
| G12 | view-switching | **ja** | alle elf views via `switchView` en via de hash, `[hidden]`-vangnet in base.css |
| G13 | noodknop | **ja** | rood, rechtsonder boven de onderbalk; verborgen op home en wizard; `body.met-sos` geeft onderruimte |
| G14 | incidentdialoog | **ja** | blad van onderen, "Bel 112" SOS-rood, pechhulp contour, niveau-badges, formulier-tabel wrapt nu (was afgesneden), zinnen, eigen gegevens; licht en donker |
| G15 | grensbanner | **ja** | `toonGrensbanner("DE")`: kaart bovenaan met vlag, kop en vier regels; sluitknop 40 px |
| G16 | melddialoog | **ja (op stijl)** | zelfde blad-stijl als incident |
| G17 | correctielink | **ja** | "Klopt dit niet?" op acties, secties, popup en incidentblokken |
| G18 | delen | **ja (op stijl)** | tekstknop met deelicoon op het dashboard |
| G19 | sr-status | **ja** | ongewijzigd (`.sr`) |
| G20 | prompt/confirm | **ja** | ongewijzigd, native |
| G21 | print | **niet getest in de browser** | print.css herschreven op de nieuwe tokens; details-openklappen ongewijzigd in js/document.js. Nalopen met ctrl+P op het reisdocument |
| G22 | reduced motion | **ja (op stijl)** | blanket-regel ongewijzigd |
| G23 | focus | **ja (op stijl)** | `:focus-visible` 2 px accent overal; niet visueel vastgelegd (de pane geeft geen toetsenbordfocus door) |
| G24 | contentpagina's | **ja** | `autorijden-frankrijk/`, `milieuzone-parijs/`, `en/can-i-drive-to/paris/` in de nieuwe stijl zonder rebuild; uitklaprijen, bronregels, selects, knoppen |

## 2. Per scherm

| # | scherm | oordeel | waarop |
|---|---|---|---|
| H1–H6 | Home | **ja** | tweekleurige hero, accent-pill met bolletje, beloftes, voorbeeldkaart met stapelschaduw, pill-banner "JE REIS" (alleen met reis), drie stappen, eerlijk-blok; licht, donker, 1280 |
| W1–W9 | Wizard | **ja** | stappenbalk met accentpunt, stap 1/3/4 (klaar), foutstaat "geen dienst" met amber vlak en handmatig blok met chips en "Naar mijn reis"; velden 52 px; Verder disabled-stijl leesbaar |
| D1–D8 | Dashboard | **ja** | verhaallijn met km per land, kop, voortgangskaart tweekleurig, tellers als statuschips, actielijst als lijst met deadline (bijna = inkt-vlak), cijfercellen, boetekaart met rood bedrag, snelkoppelingen, vertrouwens-pill; lege staat; 1280 in twee kolommen |
| A1–A11 | Acties | **ja** | sticky voortgang, deadlinenoot, groepen met teken, kaarten zonder kleurbalk, onzekerheidsbox amber, "Waarom zie ik dit?" open met niveau + datum + bron + correctielink, afvinken (kaart naar Klaar, groen vinkje, doorgestreept), "Klaar" en "Niet voor jouw kenteken" ingeklapt |
| K1–K9 | Kaart | **ja** | kaart bóven het routeblad op mobiel, blad met grijpstreep, velden, accent-pill, cijferrij, landenrijen, milieukaart als inkt-vlak, profiel en disclaimer als uitklaprijen; markers (start, eind, zone, verboden) in de nieuwe kleuren, hitvlakken onzichtbaar, legenda, popup boven een marker; lege kaart; 1280 tweedelig |
| C1–C6 | Kosten | **ja** | groot bedrag, kasboek per categorie met zekerheidschips, brandstofkaart, tankstrategie met groen advies en prijsrijen, "wat er niet in zit"; 1280 in twee kolommen |
| R1–R6 | Regels per land | **ja** | fotokaart met landkiezer-pill (paneel met zoekveld en twee groepen), kop in inkt, één oordeelkaart met twee vragen, uitklaprijen met chevron; foto ontbreekt voor BE/CH → rustig vlak |
| P1–P3 | Reisdocument | **ja** | papieren kaart, secties met eyebrow-koppen, vakjes, waarschuwingen, kostentabel (wrapt nu op 375), bronnen, voet |
| O1–O4 | Onderweg | **ja** | vier secties, reismodus-schakelaar als accent, reispack-lijst, douane (binnen EU), boete-herkenning |
| M1–M4 | Mijn reizen | **ja** | reiskaart met verhaallijn in de banner, "ACTIEF"-chip boven de vlaggen, chips, voortgang, open-knop; nieuwe-reis-kaart met stippelrand en accent-pill |
| J1–J4 | Reiservaring | **ja** | asfalt en bewegende streep ongewijzigd, pijl in inkt via CSS, haltes en bestemmingskaart in inkt; scrollkoppeling ongewijzigd |

## 3. Dwarsdoorsnijdend

| staat | oordeel | waarop |
|---|---|---|
| leeg (dashboard, kaart) | **ja** | `.leegstaat` met accent-pill; `.mapempty` met contourknop |
| fout (route) | **ja** | wizard-foutstaat nagelopen; kaartpagina-variant (`#route-status.err`) alleen op stijl |
| offline / file:// | **niet getest** | geen wijziging in de laadketen; alleen CSS en de vijf JS-aanrakingen |
| verouderd | **ja (op stijl)** | `.verouderdbalk`, `.vertrouwensbalk.verouderd`, `.grensbanner.is-verouderd` amber/inkt-2 |
| taal en | **ja** | dashboard en wizard in het Engels |
| donker | **ja** | home, dashboard, acties, kaart (met popup), kosten, regels, incident, wizard, Meer |
| 1280 px | **ja** | home, dashboard, acties, kaart, kosten, regels, reizen, reiservaring |
| contrast | **ja (gemeten)** | alle tekst-op-vlak-combinaties ≥ 4,5:1, zie DESIGN_VOORSTEL.md §3 en §4; het select-pijltje heeft een eigen donkere variant |
| raakvlakken | **ja (op stijl)** | knoppen 48–56 px, rijen 52–56 px, icoonknoppen 44 px, chips ≥ 26 px, checkbox 24 px |
| console | **ja** | alleen de twee bekende 404's van de endpoint-probes (`/api/v1/data/…`, `/api/route?ping=1`), geen scriptfouten |

## 4. Wat nog met de hand nagelopen moet worden

1. **Print / PDF** van het reisdocument en van de actiepagina (ctrl+P). De stylesheet is
   herschreven; de browser-pane kan geen printvoorbeeld tonen.
2. **Een echte telefoon**: onderbalk met safe-area, iOS-datumveld, en of 16 px in de velden
   het inzoomen inderdaad voorkomt.
3. **Toetsenbordfocus** door de hele flow: de ring is 2 px accent met 2 px afstand; op een
   accent-pill is hij accent-op-accent met 3 px afstand, controleer of dat zichtbaar genoeg is.
4. **Service worker**: na uitrol ziet een bestaande gebruiker de nieuwe stijl bij de tweede
   lading (stale-while-revalidate); cache v30 ruimt v29 op.

## 5. Aanvulling van dezelfde dag: de D7-punten

Op verzoek zijn de vier optionele punten uit DESIGN_VOORSTEL.md §10 alsnog gebouwd en
nagelopen, met dezelfde reis.

| # | onderdeel | oordeel | waarop |
|---|---|---|---|
| D7a | **Wanneer rijden** (drukte-kalender), nieuw scherm `#view-kalender` in `js/calendar.js` | **ja** | opent op oktober 2026 met de vertrekdag (10 oktober) in een accentring en gekozen; 31 dagen; heen/terug-schakelaar; juli 2026 toont de vaste prognoses (4 juli: heen zeer druk, terug enige drukte, met beide richtingen in de dagkaart); vuistregeldagen dragen "afgeleid uit een vuistregel"; pijltjestoetsen verplaatsen dag én focus; nl en en; licht en donker; 1280 met het nieuwe zijbalk-item actief; Meer-blad heeft de nieuwe rij bovenaan |
| D7a | dashboard: vierde cijfercel "Drukte vertrekdag" → kalender | **ja** | vier cellen in 2 × 2 op 375 px; verschijnt pas als drukte.json geladen is |
| D7a | zonder drukte.json | **ja (op code)** | `laadData("drukte.json")` volgt dezelfde laadketen als countries.json; mislukt hij, dan toont de pagina de kop met een uitleg in plaats van een lege maand |
| D7b | kaartpopup als onderblad op een telefoon | **ja** | de inline positie uit js/map.js wordt onder 760 px door CSS overschreven; het blad staat onderaan de kaart met grijpstreep, boven het routeblad; op 1280 blijft het een kaartje bij de marker |
| D7c | tikbare milieuchips | **ja** | de chips in "Milieuzones gedetecteerd" zijn knoppen met `data-zone`; een tik opent dezelfde popup als de marker (Utrecht → "Milieuzone Utrecht"), en op een telefoon schuift de kaart eerst in beeld |
| D7d | Geist 800 | **ja, zonder netwerk** | het lokale variabele bestand bevat de hele gewichtsas (gemeten: 700, 800 en 900 geven verschillende tekstbreedtes); `fonts.css` declareert nu 400–800 en `tools/build-fonts.ps1` vraagt hetzelfde bereik voor een volgende rebuild; h1, hero, landnaam, "Mijn reizen", "Je bent … klaar" en het kostenbedrag staan op 800 |
| — | print (benadering) | **ja, voor het reisdocument** | print.css zonder de `@media print`-schil op het scherm gezet op 800 px: zwart-wit, kaders in plaats van vlakken, bediening weg, URL's uitgeschreven, details open. De actiepagina is in die benadering niet betrouwbaar vastgelegd; een echte printvoorbeeldproef (ctrl+P) van document én acties blijft aan jou |
| — | toetsenbordfocus | **ja** | na vijf keer Tab staat de focus op een navigatieknop met een 2 px accentring (`:focus-visible` gemeten) |

Console na alle proeven: alleen de bekende endpoint-404's, geen scriptfouten. `node --check`
op de gewijzigde JS-bestanden: schoon.

## 6. Opgeruimd

Dode CSS-klassen uit de Kinetic-Route-tijd (`.bento*`, `.landcard`, `.eqcard`,
`.milieupanel`, `.verbodenpanel`, `.chkrow`, `.blockerbar`) zijn met het herschrijven
vervallen. `verdictHTML()` in js/vehicle.js (klasse `.verdict`) wordt nergens aangeroepen
en heeft dus ook geen stijl meer; de functie zelf staat er nog.
