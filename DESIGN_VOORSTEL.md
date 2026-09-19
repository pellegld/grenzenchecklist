# DESIGN_VOORSTEL.md — herontwerp van de visuele laag van Grenschecklist

> **Status, 19 september 2026:** richting A ("Stil roadbook") is gebouwd, inclusief de
> D7-punten, en daarna op het scherm verworpen: het leverde de generieke gebroken-wit-met-
> kaartjes-look op. De visuele laag is opnieuw geschreven als **"Wegenatlas"** (de app praat in
> verkeersborden: blauw gebod, rode ring, rode driehoek, groen vierkant; wegwijzer als
> navigatie; gele afslagpijl als de ene actie; Barlow Condensed op atlaspapier). De
> functie-inventaris (§1), het statusantwoord (§4: accent nooit gelijk aan status) en de
> risico's (§7) blijven gelden; de tokens in §3 zijn vervangen — zie README §Vormgeving en
> `ACCEPTATIE_DESIGN.md`. Dit document is het voorstel zoals het aan de eerste keuze
> voorafging.

Opgesteld op 19 september 2026, na het lezen van de volledige codebase (index.html, css/*, js/*,
sw.js, build/build.mjs, de gegenereerde contentpagina's, README, masterprompt, acceptatie-
rapporten) en na het live doorlopen van alle schermen op 375 × 812 in lichte én donkere modus
met een echte reis (Utrecht → Salzburg, 10–17 oktober 2026, diesel Euro 5, NL-kenteken).

Dit document is fase 0 en fase 1 uit de opdracht. Er is geen enkel bestaand bestand gewijzigd;
dit is het enige nieuwe bestand. Alle contrastwaarden hieronder zijn uitgerekend (WCAG 2.x
relatieve luminantie), niet geschat.

---

## 0. Vooraf: vier dingen die niet klopten met de opdrachttekst, en de vragen die daaruit volgen

1. **De app is geen single-file HTML meer.** Sinds commit `2ccc6eb` is index.html opgesplitst in
   `css/base.css` (tokens, thema's, reset), `css/components.css` (navigatie, layout, routepaneel,
   knoppen), `css/pages.css` (alle pagina's, 1189 regels) en `css/print.css`, plus 32 JS-modules als
   classic scripts. Er is wél een build step, maar alleen voor de tooling eromheen
   (`build/build.mjs` genereert de contentpagina's, de service-worker-assetlijst en version.json);
   de app zelf draait zonder build. Dat verandert niets aan de randvoorwaarden, wel aan waar het
   werk landt: het herontwerp is grotendeels een operatie op drie CSS-bestanden.

2. **De drukte-kalender bestaat niet als scherm.** `js/calendar.js` bevat de data-logica
   (`drukteVoor()`, `DRUKTE_RANG`, `kalRichting()`) en `drukte.json` wordt gecachet, maar de
   variabele `DRUKTE` wordt nergens gevuld en er is geen view, geen navigatie-item en geen
   renderfunctie. Het bestand zegt het zelf: "Dormant: de kalenderpagina nog niet (fase 5)."
   Ik heb de kalender in §5 toch uitgewerkt, zodat je kunt kiezen. **Vraag 1:** wil je dat de
   kalender in dit herontwerp als nieuw scherm gebouwd wordt (dat is nieuw JS, geen visuele
   laag), of blijft hij buiten scope?

3. **De blendedtech-screenshot heb ik niet ontvangen.** Ik heb gewerkt vanuit de zeven
   principes die je erbij beschreef. **Vraag 2:** wil je hem alsnog aanleveren voordat fase 2
   begint, of volstaat de beschrijving?

4. **Twee starttokens halen AA niet.** `--ink-soft #8A8F98` haalt 3,25:1 op wit en 2,98:1 op de
   paginaachtergrond; als bodytekst faalt hij, en als tweede helft van een grote kop faalt hij nét
   op `--bg`. Witte tekst op `--accent #D9542B` haalt 4,00:1, te weinig voor knoptekst onder 24 px.
   In §3 staan de verfijnde waarden met de cijfers erbij; de uitstraling blijft dezelfde.

Overige vragen staan verzameld in §10.

---

## 1. Functie-inventaris (fase 0)

Dit is de checklist waartegen elke implementatiefase wordt afgevinkt. Elke regel is een
waarneembaar gedrag; "werkt" betekent: zelfde gedrag als vandaag, alleen anders vormgegeven.
De id's en klassen tussen backticks zijn de haakjes waar JS aan hangt — die blijven bestaan.

### 1.1 Schil en globale onderdelen

| # | Onderdeel | Wat het doet | States / varianten |
|---|---|---|---|
| G1 | Laadfout `#loaderr` | Als countries.json nergens vandaan komt: melding + bestandskiezer, `#app` verborgen | zichtbaar / verborgen |
| G2 | Cachekopie-waarschuwing | Draait de app op de localStorage-kopie (`FROM_CACHE`), dan klapt de disclaimer open met een amberregel (`.cachewarn`, inline `var(--amber)`) | aan / uit |
| G3 | Offline-status `#offline-state` | Tekst in de zijbalkvoet: "Offline klaar" / "niet beschikbaar" / "file://" | 3 teksten |
| G4 | Thema | `data-theme` op `<html>` via flits-vrij script; volgt systeem tot de gebruiker kiest. Drie bedieningen: schakelaar zijbalk `#dark-toggle`, schakelaar Meer `#dark-toggle-meer`, maanknop topbar `#dark-toggle-mobiel` | licht / donker / systeem |
| G5 | Taal | `#taal-keuze` (select, zijbalk) en `#taal-toggle-mobiel` (NL/EN-knop). `#taal-notitie` verschijnt alleen in EN. `zetTaal()` hervult statische markup en rendert opnieuw | nl / en |
| G6 | Skiplink `.skiplink` | Zichtbaar bij focus, springt naar `#hoofd` | focus / verborgen |
| G7 | Topbar (mobiel) `.topbar` | Merknaam (knop → home), taalknop, maanknop; sticky; verborgen ≥1024 px | — |
| G8 | Onderbalk (mobiel) `.bottomnav` | Reis · Acties · Kaart · Kosten · Meer (`aria-expanded`, `aria-controls`); `.active` op de huidige view; verborgen ≥1024 px | 4 actief-standen + geen (home/wizard) |
| G9 | Meer-blad `#meerpaneel` | Overlay + kaart van onderen: Regels, Document, Onderweg, Reiservaring, Mijn reizen (+ badge), Over deze app, donkere modus, Sluiten. Sluit via knop, klik ernaast, Escape; focus op eerste rij | open / dicht |
| G10 | Zijbalk (desktop) `.sidebar` | Merk + tagline, "Nieuwe reis" `#btn-reset`, 9 navitems met `.active`, scheiding, voet: Instellingen, donkere modus, taal, notitie, offline-status. Vast, 256 px, eigen scroll | — |
| G11 | Wijzigingenbadge `.navbadge-wijzigingen` | Teller op "Mijn reizen" in zijbalk én Meer; `hidden` bij 0; `aria-label` met aantal; "99+" | 0 / n / 99+ |
| G12 | View-switching | `switchView()` zet `[hidden]` op alle `.view` behalve één, `location.hash`, scroll naar boven, `.active` op nav; `#view-<naam>` ids; `VIEW_ORDER` van 11 views | 11 views |
| G13 | Noodknop `.sosbutton#btn-incident` | Vast rechtsonder, boven de onderbalk; verborgen op home/wizard en zonder reis (`verversSosKnop`); `body.met-sos` geeft extra onderruimte | zichtbaar / verborgen |
| G14 | Incidentdialoog `#incidentdialoog` | Landkeuze `#incident-land` (alle 16), bel-knoppen (`tel:` alarmnummer, pechhulp of notitie), "Voordat je uitstapt", schadeformulier-tabel, vijf zinnen (nl / lokaal / fonetisch), eigen gegevens (5 tekstvelden, bewaard in localStorage), foto-herinnering; per blok een niveau-badge + bronlink + correctielink; sluiten via ×, klik ernaast, Escape; focus terug naar de knop | met data / `incident.geenData` |
| G15 | Grensbanner `#grensbanner-wrap` | Vast bovenaan (onder topbar op mobiel, naast zijbalk op desktop). Kop "Je rijdt nu in {land}" of "Laatst gezien om {tijd} in {land}" (`.is-verouderd`), regels: snelheid, alcohol, verlichting, vignet (✓/!), uitrusting, voertuignotities; sluitknop `#grensbanner-sluit`; `role=status` | actueel / verouderd / verborgen |
| G16 | Melddialoog `#melddialoog` | Terugval voor klembord: textarea met de correctietekst of de deel-URL; Sluiten, Escape, klik ernaast; focus terug | open / dicht |
| G17 | Correctielink `[data-melden]` / `.meldlink` | "Klopt dit niet?" bij elke actie, sectie, popup en incidentblok; kopieert naar klembord en toont 4 s "Gekopieerd"; met `meta.correctionFormUrl` een externe link | knop / link / gekopieerd |
| G18 | Delen `#btn-deel` | `navigator.share` → klembord → melddialoog; knoptekst wisselt 4 s ("Gedeeld" / "Link gekopieerd"); `.deelmelding` één keer boven het dashboard na import | 3 wegen + melding |
| G19 | Schermlezer-status `#actie-melding` | `aria-live` zin na afvinken ("… verplaatst naar Klaar") | — |
| G20 | Native dialogen | `prompt()` bij hernoemen en bij vignet-aankoopdatum (+ duurkeuze AT), `confirm()` bij verwijderen | — |
| G21 | Print | `beforeprint`/`matchMedia("print")` klapt alle `<details>` open en daarna dicht; print.css verbergt bediening, zet tokens op zwart-wit, schrijft URL's uit, toont `.printnamen` | — |
| G22 | Reduced motion | Alle animaties/transities naar 0,001 ms | — |
| G23 | Focus | `:focus-visible` ring 2 px, overal; toetsenbord op `.landrow`/`.landswitch-row` (Enter/spatie) en op kaartmarkers | — |
| G24 | Gegenereerde contentpagina's | 16 × autorijden-*, 4 × vignet-*, 11 × milieuzones-*, 47 × milieuzone-*, 12 × tol-*, mag-ik/*, wijzigingen/, en/* — statische pagina's uit `build/build.mjs` die **dezelfde vier CSS-bestanden** laden en de klassen `.view-page .skiplink .lead .hint .regelsectie[open] .sectienaam .sectiekop .sectiebody .speedrow .speedtext .slabel .sval .speednote .sectienoot .eqkop .eqtoelichting .eqlijst .eqnaam .eqnote .hoe .bronregel .niveau .controledatum .bronlink .quirklijst .teken .bronnenlijst .btn.primary` gebruiken | nl / en |

### 1.2 Home `#view-home` (§4)

| # | Onderdeel | Gedrag | States |
|---|---|---|---|
| H1 | Hero: h1 `home.hero`, lead, CTA `#btn-plan` | CTA start wizard stap 1; is er al een afgeronde reis, dan begint hij een níeuwe | — |
| H2 | Beloftes ×4 | Gratis · Geen account · Privacy · Offline, met vinkje | — |
| H3 | Voorbeeldkaart `.voorbeeldkaart` | Label "VOORBEELD — NIET JOUW REIS", Brussel → Salzburg, vlaggen, meta, voortgang 72 %, tellers s-ok/s-todo/s-bad, geschatte kosten. Statisch | — |
| H4 | Verderkaart `.verderkaart` | Alleen als `tripIsKlaar`: naam, % gereed, open acties, knop naar dashboard | met / zonder reis |
| H5 | Hoe het werkt ×3 `.homestappen` | Genummerde kaartjes | — |
| H6 | Eerlijk-blok | Tekst + onderzoeksdatum uit `DATA.meta.researchDate` | — |

### 1.3 Reiswizard `#view-wizard` (§5)

| # | Onderdeel | Gedrag | States |
|---|---|---|---|
| W1 | Stappenbalk `.wizbalk` | 4 stappen: `af` (vinkje), `nu` (`aria-current=step`), `later`; op <560 px alleen de actieve stap met naam | 4 × 3 |
| W2 | Kaart `.wizkaart` + knoppen `.wizknoppen` | Terug (`data-wiz-terug`), Verder (`data-wiz-verder`, `disabled` tot `wizKlaarVoorVolgende`) | enabled / disabled |
| W3 | Stap 1 Waar: velden `#wiz-from` `#wiz-to` + `.results` | Autocomplete uit cities.json (≥2 tekens, max 7, vlag + landnaam); rij "niet gevonden — zoek online" (`data-online`) → "Zoeken…" → resultaten / "niets gevonden" / "zoeken mislukt"; Enter kiest eerste; blur sluit na 180 ms; hint `#wiz-waar-hint` wordt "geen steden" op file:// | leeg / typen / lijst / online-zoeken / fout |
| W4 | Stap 2 Wanneer: `#wiz-depart` `#wiz-return` | Verder pas met vertrekdatum; `input` én `change` | — |
| W5 | Stap 3 Auto: 4 selects + `.veldhint`, `<details class="wizoptioneel">` gewicht/hoogte | Schrijft direct in TRIP | — |
| W6 | Stap 4 Analyse: `.wizsamenvatting`, startknop `#btn-analyse`, `.analyselijst` ×5 (wacht ○ / bezig spinner / klaar ✓ + uitkomst / fout ⚠), `.wizklaar` + "Naar mijn reis", "Opnieuw" | Verantwoordingslijst blijft staan na afloop | leeg / bezig / klaar / fout |
| W7 | Foutkaart `.wizfout` (`role=alert`) | 3 varianten: geen dienst (→ handmatig), geen bekende landen (→ handmatig), algemeen ({reden}); knoppen Opnieuw / Handmatig doorgaan | 3 |
| W8 | Handmatig `#wiz-handmatig` | Select `#hm-land` + Toevoegen `#hm-toevoegen`, chips met × (`data-hm-weg`), hint zonder landen, "Naar mijn reis" zodra ≥1 land | leeg / gevuld |
| W9 | Herrender-regel | Wizard herbouwt alleen bij andere reis/stap/taal (`WIZ_GETEKEND`) — velden verdwijnen nooit onder je vingers | — |

### 1.4 Reisdashboard `#view-dashboard` (§6)

| # | Onderdeel | Gedrag | States |
|---|---|---|---|
| D1 | Lege staat `.leegstaat` | Icoon, kop, tekst, CTA naar wizard | zonder reis |
| D2 | Kop `.dashkop` | Deelmelding (één keer), vlaggenrij met pijlen, h1 "van → naar", periode, voertuigregel + "wijzig" (→ wizard stap 3), deelknop | met / zonder datums |
| D3 | Voortgang `.voortgang` | h2 "Je bent {pct}% klaar", progressbar (`role=progressbar`), tellers `.statustellers` s-ok / s-todo / s-bad (alleen >0) / s-info (alleen >0), CTA "Bekijk alle acties" | 0–100 % |
| D4 | Dit moet je regelen | Blokkades + max 5 open acties op deadline: vlag of wereldbol, wat, waarom, deadlinechip (u-later/bijna/vandaag/verstreken), statuschip; "Nog n acties bekijken"; of "Alles op deze route is afgevinkt" | lijst / leeg |
| D5 | Cijfers `.cijfergrid` ×3 (knoppen) | Afstand → kaart, Reistijd → kaart, Geschatte kosten → kosten; "—" zonder route; "niet te bepalen" zonder optelbaar bedrag | 3 × (waarde / leeg) |
| D6 | Boetekans `.boetekaart` | Zin met bedrag/bandbreedte/"of meer"/geen bedrag; `<details>` uitsplitsing per post (vlag, post, bedrag, brontekst) + hint; verborgen zonder open acties | verborgen / met / zonder bedrag |
| D7 | Snelkoppelingen ×3 | Regels · Reisdocument · Reiservaring | — |
| D8 | Vertrouwensbalk `.vertrouwensbalk` | Zin "n feiten, x officieel, y gecontroleerd, z onzeker", datum oudste controle, `.verouderd` variant (amber), `<details>` met onzekere feiten (vlag, wat, waarom, bronlink, niveau-chip) of "alles zeker" | normaal / verouderd / geen onzekere |

### 1.5 Acties `#view-acties` (§7, §8, §13, §16)

| # | Onderdeel | Gedrag | States |
|---|---|---|---|
| A1 | Lege staat | zoals D1 | — |
| A2 | Progresskaart `.progresscard` | label, "{pct}% gereed", balk, "Nog n van m te gaan" | — |
| A3 | Deadlinenoot | Alleen met vertrekdatum | — |
| A4 | Groepen `.actiegroep` ×7 | eerst ✗ / voorVertrek ! / inDeAuto 🚗 / aanbevolen + / letop i / klaar ✓ / nietVoorJou —; kop met teken, naam, teller, uitleg; `klaar` en `nietVoorJou` als ingeklapte `<details>`; lege groepen verdwijnen | open / dicht |
| A5 | Actiekaart `.actiekaart` | Modifiers `s-blokkade` (rood vlak) / `s-actie` / `s-waarschuwing` / `s-onbekend` / `.af` (doorgestreept, 72 %); linkerrand in statuskleur | 5 |
| A6 | Vinkje `.actievink` of merk `.actiemerk` | Afvinkbaar → checkbox met `aria-labelledby/describedby`; niet afvinkbaar → teken in stippelvak | — |
| A7 | Titel | Eén land: vlag + tekst; meer landen: tekst + vlaggenrij + namenregel | — |
| A8 | Meta-chips | `.statuschip` (teken + woord, 5 stijlen, onbekend gestippeld), `.deadlinechip` (kalender-icoon, 4 urgenties, sr-tekst "richttijd"), `.prijschip` ("Vanaf €9,60", gestippeld) | — |
| A9 | Uitleg (2 zinnen), onzekerheidsbox `.onzeker` (amber, alleen bij uncertain/unavailable), knop "Naar profiel" (`naarWizardStap`) | — | — |
| A10 | "Waarom zie ik dit?" `<details class="waarom">` | ?-bolletje → −; waaromtekst, boeteregel, bronregel (niveau-chip n-official/verified/uncertain/unavailable + controledatum), bronacties (Officiële website →, Klopt dit niet?) | dicht / open |
| A11 | Afvinken | Herrender, scrollpositie terug, `klaar`-groep open, focus terug op hetzelfde vinkje, sr-melding; bij vignet AT/CH `prompt()` voor datum (+duur); uitvinken wist vignetgeheugen | — |

### 1.6 Kaart `#view-kaart` (§9, planner §20)

| # | Onderdeel | Gedrag | States |
|---|---|---|---|
| K1 | Routepaneel `.panel-route` | h1, `#planner` (verborgen tot cities.json er is — dus altijd op file://): Van/Naar + `.results`, swap `#btn-swap`, `#btn-route` (disabled tijdens rekenen), `#route-status` (`.rstat`, `.err`; bezig / klaar + dienstnotitie / fout / geen dienst / kies eerst), `#handmatig` (na "geen dienst") | leeg / bezig / klaar / fout / handmatig |
| K2 | Statkaarten `#stat-cards` ×3 | Afstand, reistijd, geschatte kosten; `hidden` zonder analyse | — |
| K3 | Landen op route `#landenlijst` | `.landrow` (role=button, tabindex) → Regels per land | — |
| K4 | Milieuzones `#milieukaart` | Amber kaart met max 8 stadschips; `hidden` zonder zones | — |
| K5 | Voertuigprofiel `<details class="profile">` | Samenvatting + "wijzig/sluit" (::after), kenteken/vertrek/brandstof/euronorm/voertuig; schrijft direct en rendert | dicht / open |
| K6 | Disclaimer `<details class="disclaimer">` | Body, `#general-sources`, `#colofon` (+ cachewarn) | — |
| K7 | Kaartvlak `.panel-map` + `#mapwrap` | Zelfgetekende SVG `#routesvg`: landen (`.land`, `.op-route`), route (glow + lijn), hitvlakken, markers `m-start m-eind m-tol m-optioneel m-zone m-zonebad` (role=button, tabindex, teken €/~/Z/!), legenda `.kaartlegenda`; lege staat `.mapempty` met knop; `.alt` achtergrond via lagenknop | leeg / route / alt |
| K8 | Bediening `.mapctrl` | Lagen, centreren (herstel), zoom in/uit (44 px); slepen (pointer capture), ctrl/cmd + scroll zoomt; resize hertekent na 200 ms | — |
| K9 | Popup `.kaartpopup` (role=dialog) | ×, type + vlag, h3, kosten, waarschuwing (amber), info (2 zinnen), bronregel + bronacties; positie boven of onder de marker; Escape; focus naar × en terug | open / dicht |

### 1.7 Kosten `#view-kosten` (§10) en tankstrategie

| # | Onderdeel | Gedrag | States |
|---|---|---|---|
| C1 | Lege staat | zoals D1 | — |
| C2 | Kop | h1, label, groot bedrag (één getal / bandbreedte / "of meer") of "geen bedrag", lead | 4 |
| C3 | Categoriekaarten ×4 (tol, vignetten, milieuzones, brandstof) | h2, uitleg, `.kostenrij` (vlag of `.geenvlag`, wat, detail, `.zeker` chip z-bevestigd ✓ / z-indicatief ~ / z-onbekend ? / z-nietmee — + bronlink, bedrag met ~ en € of "geen bedrag"), subtotaal `.katsub`; lege categorie verdwijnt | — |
| C4 | Brandstofkaart | 2 tekstvelden (`inputmode=decimal`), herrender op `input` met caret-herstel, privacyregel | leeg / ingevuld |
| C5 | Tankstrategie `.tankkaart` | Geen data / EV / geen landen / advies (`.tankadvies`) of reden (geenRoute, teKort, alGoedkoopst, geenAdvies) + prijsrijen per land + prijsdatum + disclaimer | 6 |
| C6 | Wat er niet in zit `.nietmee` | Chip + naam + detail per niet-meegerekende post; uitleg (met/zonder totaal) | verborgen / lijst |

### 1.8 Regels per land `#view-regels` (§15)

| # | Onderdeel | Gedrag | States |
|---|---|---|---|
| R1 | Hero `.landherowrap` | Foto (14 landen) of navy verloop (BE, CH); vlag + "EUROPA · regio"; h1 landnaam; intro; loopt tot de schermrand (negatieve marge) | foto / verloop |
| R2 | Landkiezer `.landswitch` | Pillknop + paneel: zoekveld, groepen "Op je route" / "Alle landen", rijen met vlag en vinkje; filter op naam; sluit bij klik buiten/Escape (focus terug) | dicht / open / gefilterd / leeg |
| R3 | Verouderd-balk | Als `lastVerified` > 240 dagen | — |
| R4 | Oordeel ×2 `.oordeelkaart` | "Mag ik hier rijden?" ✓ Ja / ✗ Nee / ? Controleer dit + uitleg; "Moet ik iets regelen?" ✓ Nee / ! Ja, n dingen + lijst met deadlinechips + "naar acties" / ? Niet op je route | 3 + 3 |
| R5 | Secties `<details class="regelsectie">` ×6 | Snelheid (verkeersbord-rondjes, regen-noot, noot, bron), Uitrusting (verplicht / kenteken / aanbevolen), Milieuzone en tol (2 subkoppen, "Hoe kom je eraan", 2 bronregels), Winter, Bijzondere regels (`.quirklijst`, ✗ bij verboden), Bronnen (intro met datum, lijst, correctielink); kop draagt samenvatting; +/− via ::after | dicht / open |
| R6 | Lege staat | "geen landen" hint | — |

### 1.9 Reisdocument `#view-document` (§11)

| # | Onderdeel | Gedrag |
|---|---|---|
| P1 | Lege staat | zoals D1 |
| P2 | Acties `.docacties` | "Print of bewaar als PDF" (`window.print`) + hint |
| P3 | Document `.reisdocument` | Kop (naam, periode, voertuig, "Gemaakt op"), secties: landen (chips), acties (per groep, vakje/×/teken, deadline, sub), Let op onderweg (w-bad ! / w-unknown ?), douane, kosten (tabel met zekerheid en totaal + noot), risico-zin, bronnen, voet (vertrouwenszin, datum, disclaimer) |

### 1.10 Onderweg `#view-onderweg` (fase C/D)

| # | Onderdeel | Gedrag | States |
|---|---|---|---|
| O1 | Reismodus-kaart | Uitleg, batterijwaarschuwing, schakelaar `#journey-toggle`, status `#journey-status` (geen GPS / geweigerd → schakelaar terug uit / fout), huidig land of "nog geen fix", sessielog `.journeylog` (vlag, land, tijd) | uit / aan / fout |
| O2 | Offline reispack | 5 bestanden met vinkje, grootte (berekenen… / n KB / geen schatting), laatst ververst / nooit, knop "Nu verversen" (→ "bezig") | 3 × 2 |
| O3 | Douane op de terugweg | Badge "NU RELEVANT" na retourdatum; per niet-EU-land alcohol/tabak/overig + bron; of "route blijft binnen de EU" | — |
| O4 | Herken een echte boete | 3 vaste regels met iconen | — |

### 1.11 Mijn reizen `#view-reizen` (§12, D1)

| # | Onderdeel | Gedrag | States |
|---|---|---|---|
| M1 | Kop + "Nieuwe reis plannen" `#btn-nieuwe-reis` | — | — |
| M2 | Wijzigingenkaart `.wijzigingenkaart` | Per reis: naam, "Gezien" (`data-wijzigingen-gezien`), regels (vlag, land — onderwerp, oud → nieuw, datum · bron) | verborgen / lijst |
| M3 | Reiskaart `.tripcard` | Banner + "actief"-badge, naam, hernoem (prompt) / verwijder (confirm), van → naar of "geen route", chips (landen, km, duur), `.tripwarn` bij blokkade, voortgang n/m + balk, open-knop `.tripgo` | actief / inactief / blokkade |
| M4 | Nieuwe-reis-kaart `#btn-tripnew` | Gestippelde kaart, hele kaart klikbaar | — |

### 1.12 Reiservaring `#view-reis` (scrollytelling)

| # | Onderdeel | Gedrag | States |
|---|---|---|---|
| J1 | Lege staat `.journeyempty` | Knop naar wizard | — |
| J2 | Weg `.journeyroad` + marker `.journeymarker` | Asfaltbaan met bewegende streep (CSS-animatie), pijl (vaste blauwe SVG uit JS) die met scroll meebeweegt (rAF + lerp); `#view-reis` is op élke breedte de scrollcontainer met vaste hoogte `calc(100vh − topbar − 64px)` | — |
| J3 | Haltes `.journeynode` | Verschijnen via IntersectionObserver (`.is-visible`), worden groen met vinkje als de marker passeert (`.is-passed`); om en om links/rechts ≥768 px; laatste is `.dest` (navy) | 3 |
| J4 | Kaart `.jcard` | Land, badge START/BESTEMMING, tekst, chips verplicht (amber) / aanbevolen, tolregel, op de laatste "Bekijk checklist" | — |

### 1.13 Dwarsdoorsnijdende staten (voor de checklist per fase)

- **Laden**: eerste paint vóór data (geen skeleton; de views zijn leeg tot `boot`); analyselijst in de wizard; "Zoeken…" in autocomplete; "Route berekenen…" in `#route-status`; "Grootte wordt berekend…"; knop "bezig" bij reispack.
- **Leeg**: home zonder reis, dashboard/acties/kosten/document zonder reis, kaart zonder route (`.mapempty`), regels zonder landen, reiservaring zonder landen, geen zones (`#milieukaart` hidden), geen tol (categorie weg), geen changelog (kaart weg), geen boeterisico (kaart weg), geen onzekere feiten.
- **Fout**: laadfout (G1), route-fout algemeen, geen dienst (→ handmatig), geen bekende landen (→ handmatig), online zoeken mislukt, GPS geweigerd/fout, klembord niet beschikbaar (→ dialoog), `prompt` geannuleerd/ongeldig (stil).
- **Offline**: alles behalve routeberekening en online-geocoding werkt; statusregel in zijbalk; cachekopie-waarschuwing; contentpagina's netwerk-eerst met cache-terugval.
- **file://**: planner verborgen, wizard-hint "geen steden", handmatig kiezen is de gewone weg, geen service worker, `storage.estimate` faalt netjes.
- **Verouderd**: vertrouwensbalk `.verouderd`, regels `.verouderdbalk`, grensbanner `.is-verouderd`.
- **Taal**: alle bovenstaande in nl en en; getallen in de locale; regelteksten blijven Nederlands (notitie).
- **Thema**: alle bovenstaande in licht en donker; vaste kleuren voor navy-panelen, asfalt, SOS, verkeersbord, vlaggen, journey-pijl.
- **Print**: reisdocument en elke zichtbare view; details open; URL's uitgeschreven; vlaggen → `.printnamen`.

---

## 2. Drie design-richtingen

Alle drie voldoen aan de harde randvoorwaarden (vanilla, offline, light + dark, AA, ≥44 px,
geen layout shift). Ze verschillen in wat het hart van het scherm is en hoeveel kleur er praat.

### Richting A — "Stil roadbook" (aanbevolen)

**Kernidee.** De app is een rustige, warme reisgids die je vertrouwt omdat hij niet schreeuwt.
Inktblauw op gebroken wit, één terracotta actie per scherm, kaarten met grote radius en zachte
schaduw, scheiding door ruimte in plaats van lijnen, tweekleurige koppen. Kleur is
uitzonderingssignaal: alleen wat afwijkt van "gewoon regelen" krijgt een tint (verboden,
onzeker, klaar). Cijfers krijgen een eigen, strakke hiërarchie in tabular numerals.

**Leunt op.** blendedtech (uitstraling, pills, tweekleurige koppen, witruimte, overlappende
kaarten) · Cleanmeter (compacte dataregels, numerieke hiërarchie, niet-vermoeiende dark mode) ·
Polarsteps (route als verhaallijn in de kop van het dashboard, warme typografie) · Hopper alleen
voor het principe "één dominante actie per scherm" — de speelse kleurcodering wordt bewust
getemperd.

**Waarom past dit.** Het antwoord dat de app geeft ("mag ik dit land in, en wat moet ik regelen")
is een lijst met veel gelijkwaardige verplichtingen (op de testreis 11 van 11 acties met status
"Actie"). Een palet dat elke verplichting inkleurt levert één oranje pagina op; een palet dat
alleen afwijkingen inkleurt laat de ene blokkade of het ene onzekere feit springen. Dat is
precies de leesbaarheid die de ontwerpvraag in de opdracht zoekt.

**Waarom niet.** Minder "speels" dan Hopper; wie een kleurrijke app verwachtte vindt dit sober.
Dat is een bewuste keuze, geen tekortkoming.

### Richting B — "Kaart voorop"

**Kernidee.** Polarsteps-achtig: de reis ís de kaart. Het dashboard opent met de routeschets
schermvullend, en voortgang, acties en kosten zitten in een omhoogschuifbaar blad. Elke halte op
de route is een land; tikken op een land opent de regels. De Reiservaring-pagina en het dashboard
versmelten.

**Leunt op.** Polarsteps (kaart als hart, route als verhaallijn) · blendedtech (blad met r24,
schaduw, pills) · Cleanmeter (dataregels in het blad).

**Waarom past dit.** Reisgevoel is het sterkst; de kaart, nu op mobiel ónder een lang paneel
verstopt, komt centraal te staan.

**Waarom niet.** De kaart is een zelfgetekende SVG uit borders.json — zonder straten, zonder
tegels, zonder inzoomen tot stadsniveau (bewust, voor offline). Schermvullend oogt hij leeg.
Bovendien is dit de richting met de meeste JS-aanrakingen: het dashboard zou `renderKaart()`
moeten aanroepen (de duurste render van de app, nu lazy op de kaartpagina), de sheet-gestures en
de scroll-container van de Reiservaring botsen, en de kaart-overlayInset gaat uit van de huidige
knopposities. Het risico om bestaand gedrag te veranderen is hier het grootst, en de winst zit in
gevoel, niet in de kernvraag.

### Richting C — "Hopper kleur"

**Kernidee.** Data-as-color, volledig: elke status heeft een verzadigde eigen kleur en kleurt het
hele kaartje (rood kaartje, oranje kaartje, groen kaartje). Grote speelse kaarten, dikke pills,
tellers als gekleurde bollen.

**Leunt op.** Hopper (statuskleuren, grote kaarten) · TravelWise (scanbare blokken met iconen).

**Waarom past dit.** Snel scanbaar als statussen gelijk verdeeld zijn; het "let op"-gevoel is
onmisbaar in een checklist-app.

**Waarom niet.** Het botst frontaal met de ontwerpvraag: oranje kan niet tegelijk primaire actie
en "let op" zijn, en in deze richting wil je juist beide luid. Het botst ook met "rustig, zeker,
reisachtig" en met de blendedtech-uitstraling. En de dominante status (Actie) kleurt dan 80 % van
de pagina.

---

## 3. Design tokens per richting

De tokennamen hieronder zijn nieuw. In de implementatie blijven de huidige namen (`--surface`,
`--on-surface`, `--secondary`, `--amber`, `--ok`, `--error`, `--outline-var`, …) bestaan als
aliassen op de nieuwe waarden, zodat alle 1189 regels pages.css en de twee inline
`var(--amber)`/`var(--navy)`-verwijzingen in JS blijven werken tijdens de overgang. Zie §8.

### 3.1 Richting A — tokens (volledig)

#### Kleur, licht

| token | hex | rol | contrast (gemeten) |
|---|---|---|---|
| `--bg` | `#F6F5F3` | paginaachtergrond (gebroken wit) | — |
| `--surface` | `#FFFFFF` | kaarten, bladen, popups | — |
| `--surface-2` | `#F0EEEA` | ingezonken vlakken: inputs, chips-op-kaart, kaartachtergrond, progress-track | 1,16:1 t.o.v. surface (bewust subtiel) |
| `--line` | `#E4E1DC` | haarlijn, alleen waar ruimte niet genoeg is (tabelrijen, details-scheiding) | decoratief |
| `--ink` | `#1E2A3A` | koppen, primaire tekst, eerste helft van koppen, solid chips, routelijn | 14,51:1 op surface · 13,32:1 op bg |
| `--ink-2` | `#5B6370` | secundaire tekst, uitleg, labels, aanbevolen/optioneel-chips | 6,06:1 op surface · 5,56:1 op bg · 5,23:1 op surface-2 |
| `--ink-soft` | `#767B85` | **alleen** tweede helft van grote koppen (≥ 24 px) en decoratieve cijfers | 4,25:1 op surface · 3,90:1 op bg (AA-large) |
| `--accent` | `#BD4420` | de ene accentkleur: CTA-vulling, actieve schakelaar, actieve nav-indicator, focusring, accent-tekstlinks | wit op accent 5,23:1 · accent op bg 4,80:1 · op surface 5,23:1 |
| `--accent-bright` | `#D9542B` | decoratief: het bolletje-met-pijl in hover, de "NIEUW"-vulling achter **witte tekst ≥ 18,66 px vet** — nooit onder kleine tekst | 4,00:1 (AA-large) |
| `--on-accent` | `#FFFFFF` | tekst op accent | zie boven |

De aangeleverde `#D9542B` blijft dus in het palet, maar als *bright*-variant voor grote/decoratieve
toepassingen; de werk-accent is een tint donkerder zodat knoptekst van 15–17 px AA haalt. Naast
elkaar is het verschil niet te zien; in cijfers is het het verschil tussen 4,00 en 5,23.

#### Kleur, donker

| token | hex | rol | contrast |
|---|---|---|---|
| `--bg` | `#121820` | pagina (blauwzwart, geen puur zwart) | — |
| `--surface` | `#1A2230` | kaarten (één toon lichter i.p.v. schaduw) | — |
| `--surface-2` | `#232D3B` | ingezonken vlakken | — |
| `--line` | `#2E3947` | haarlijn; in dark mode vervangt hij de schaduw als kaartrand | 1,36:1 |
| `--ink` | `#E8EAEE` | tekst (geen puur wit — vermoeit minder) | 14,81:1 op bg · 13,25:1 op surface · 11,55:1 op surface-2 |
| `--ink-2` | `#A6AEBA` | secundair | 7,13:1 op surface · 6,22:1 op surface-2 |
| `--ink-soft` | `#8A93A0` | tweede kophelft | 5,14:1 op surface · 5,74:1 op bg |
| `--accent` | `#BD4420` | CTA-vulling, **zelfde token als licht** (wit erop blijft 5,23:1; pillrand op bg ≥ 3:1) | 5,23:1 |
| `--accent-text` | `#E2603A` | accent als tekst, icoon, focusring en schakelaar-aan in dark mode | 4,54:1 op surface · 5,07:1 op bg |
| `--on-accent` | `#FFFFFF` | — | — |

Vaste kleuren (in beide thema's, zoals nu): `--sos #B42318` (wit erop 6,57:1), verkeersbord
wit/rood, vlaggen, asfalt van de Reiservaring. `--navy` verdwijnt als decoratief paneel (de
landenhero en het milieupaneel worden lichte kaarten; zie §5.7) maar blijft als alias = `--ink`.

#### Statusschaal (het antwoord op de ontwerpvraag staat in §4; dit is het palet van optie 1)

| status | teken | licht: inkt / vlak / rand | donker: inkt / vlak / rand | contrast inkt op vlak (L / D) |
|---|---|---|---|---|
| verboden · blokkade · nee · verstreken | ✗ | `#A5261A` / `#FBE9E7` / `#EDB3AB` | `#F3A196` / `#3B1D19` / `#6E2C24` | 6,19 / 7,52 |
| onbekend · onzeker · niet beschikbaar · controleer | ? | `#7A5205` / `#FBF1DC` / `#E4C67C` | `#EACB82` / `#382E14` / `#6B5525` | 6,16 / 8,52 |
| verplicht · actie · moet · mits | ! | `#1E2A3A` / `#E8EBF0` / `#C9D0DA` | `#E8EAEE` / `#26313F` / `#3C4858` | 12,14 / 10,94 |
| in orde · klaar · ja · bevestigd · officieel | ✓ | `#1F6D42` / `#E3F2E8` / `#A9D8BC` | `#8FD3A6` / `#16301F` / `#2A5A3A` | 5,45 / 8,15 |
| aanbevolen · let op (informatief) | + / i | `#5B6370` / geen vlak / `#858C97` | `#A6AEBA` / geen / `#6E7D93` | 6,06 / 7,13 (rand 3,39 / 3,81) |
| optioneel · niet voor jouw kenteken · niet meegerekend · autotrein | — | `#5B6370` / geen vlak / `#858C97` **gestippeld** | `#A6AEBA` / geen / `#6E7D93` gestippeld | idem |

Elke inkt haalt ook los op surface en op bg ≥ 4,5:1 (gemeten: verboden 7,26 / 6,66; onbekend
6,92 / 6,35; in orde 6,32 / 5,80), dus een los teken of icoon zonder vlak is ook leesbaar. De
randen van de gevulde chips zijn decoratief (1,5–1,8:1) omdat vlak + teken + woord de betekenis
dragen; de randen van de *ongevulde* chips zijn wél ≥ 3:1, want daar is de rand de vorm.

#### Typografie

| stap | mobiel | ≥ 760 px | font / gewicht / regelhoogte / tracking | gebruik |
|---|---|---|---|---|
| display | 36 px | 52 px | Geist 700 · 1,05 · −0,02 em | home-hero, tweekleurig |
| h1 | 28 px | 34 px | Geist 700 · 1,12 · −0,015 em | paginakop, tweekleurig waar zinvol |
| h2 | 18 px | 20 px | Geist 600 · 1,3 · 0 | kaartkop, groepskop |
| h3 | 15 px | 15 px | Geist 600 · 1,35 | subkop in kaart |
| eyebrow | 11 px | 11 px | Geist 600 · 1 · +0,08 em · kapitaal | spaarzaam: "VOORBEELD", regio, kostenlabel |
| body | 16 px | 16 px | Inter 400 · 1,55 | lopende tekst (nu 15 px; 16 voorkomt iOS-zoom op velden) |
| body-2 | 14 px | 14 px | Inter 400 · 1,5 | uitleg, meta |
| caption | 12 px | 12 px | Inter 500 · 1,4 | chips, datums, bronregels |
| num-xl | 40 px | 48 px | Geist 700 · 1 · tabular | totaalbedrag kosten |
| num-l | 24 px | 28 px | Geist 600 · 1 · tabular | cijfercellen, statkaarten, boetebedrag |
| num-m | 16 px | 16 px | Geist 600 · tabular | bedragen in rijen, tellers |

Geist en Inter staan al lokaal (`fonts.css`, latin + latin-ext, `font-weight: 400 700`). Geist is
een geometrische grotesk en dekt "zware geometrische grotesk" op 700. Wil je 800 voor de hero,
dan moet `tools/build-fonts.ps1` één keer opnieuw draaien (blijft self-hosted, blijft offline).
**Vraag 3:** 700 volstaat, of 800 ophalen?

#### Spacing, radii, elevatie, iconen, motion

- **Spacing** (4-basis): 4 · 8 · 12 · 16 · 24 · 32 · 48 · 64 · 96. Paginamarge 20 px mobiel / 40 px
  desktop. Tussen blokken op een pagina: 48 px mobiel, 64 px desktop ("nooit twee dingen die om
  aandacht vechten"). Binnen een kaart: 20 px mobiel, 24 px desktop. Lijstrijen: 12 px verticaal,
  min-height 48 px.
- **Radii**: `--r-input` 12 · `--r-card` 20 · `--r-sheet` 24 · `--r-pill` 999 · `--r-sign` 6 (kleine
  vierkantjes zoals het printvakje).
- **Elevatie**: niveau 0 = geen schaduw, onderscheid door toon (bg/surface/surface-2). Niveau 1
  (kaarten): `0 1px 2px rgba(30,42,58,.04), 0 12px 32px -16px rgba(30,42,58,.14)`. Niveau 2
  (bladen, popups, autocomplete): `0 24px 64px -24px rgba(30,42,58,.28)`. Dark mode: geen schaduw,
  1 px `--line` + surface-stap. Geen randen op kaarten in light.
- **Overlap**: kaarten die inhoudelijk bij elkaar horen stapelen 24 px over elkaar (home:
  voorbeeldkaart over de hero-onderrand; kaart: routeblad over de kaart; regels: oordeelkaart
  over de fotokaart). Altijd via negatieve margin op de bovenste kaart, nooit via absolute
  positionering, dus geen layout shift.
- **Iconen**: de bestaande inline SVG-sprite blijft (38 symbolen). Stroke 1,75 px, ronde caps;
  24 px in navigatie, 20 px in lijsten, 16 px in chips. Statustekens blijven tekstglyphs
  (✓ ✗ ! ? + — i) in een 20 px cirkel — dat zijn ze nu ook, en ze printen.
- **Motion**: alleen `opacity`, `transform`, `background-color`; 150 ms ease-out voor
  hover/druk, 220 ms cubic-bezier(.2,.8,.2,1) voor bladen (Meer, popup); geen parallax, geen
  hover-lift van 3 px op kaarten (weg), de asfaltstreep van de Reiservaring blijft (bestaand
  gedrag). `prefers-reduced-motion` zoals nu.

### 3.2 Richting B — tokens (afwijkingen t.o.v. A)

Zelfde palet en typografie. Verschillen: kaartachtergrond wordt `--bg`-toon met landvlakken in
`--surface` (de kaart is de pagina), het blad heeft `--r-sheet` 28 met een grijpstreep van
36 × 4 px, elevatie niveau 2 permanent op het blad, motion krijgt een derde tijd (320 ms voor het
snappen van het blad naar 2 standen), en de route krijgt een halo in `--accent` op 12 % om hem als
verhaallijn te laten lezen. Landen-haltes op de route als 32 px vlagcirkels op de kaart zelf.

### 3.3 Richting C — tokens (afwijkingen t.o.v. A)

Statusvlakken op 100 % verzadiging als kaartachtergrond: verboden `#E5533D`, actie `#F2994A`,
onbekend `#F2C94C`, klaar `#27AE60`, elk met inkt `#1E2A3A` of wit afhankelijk van contrast; radii
24 overal; display 44 px mobiel; motion met een lichte "pop" (scale 1 → 1,02) bij afvinken. Accent
voor de CTA moet dan van kleur veranderen (zie §4, optie 2), want oranje is bezet.

---

## 4. De ontwerpvraag: accentkleur versus statuskleuren

### 4.1 Welke statussen bestaan er eigenlijk

De app heeft niet vijf maar negen statusachtige schalen, en die moeten allemaal op één systeem
landen. Gemeten in de code:

| schaal | waarden | waar |
|---|---|---|
| actiestatus | blokkade · actie · waarschuwing · ok · onbekend | `STATUS_TEKEN`, `.statuschip`, `.actiekaart` |
| prioriteitsgroep | eerst · voorVertrek · inDeAuto · aanbevolen · letop · klaar · nietVoorJou | `.actiegroep` |
| uitrusting | must · advice · na | regels, reiservaring |
| zone-oordeel | ok · todo · bad · unknown | kaartmarkers, document |
| regel-oordeel | ja · nee · mits · check | `.oordeel` |
| kosten-zekerheid | bevestigd · indicatief · onbekend · nietmee | `.zeker` |
| betrouwbaarheid | official · verified · uncertain · unavailable | `.niveau` |
| deadline-urgentie | later · bijna · vandaag · verstreken | `.deadlinechip` |
| drukte | rustig · matig · druk · zeerdruk · zwart | (kalender, nog niet gebouwd) |

Die 34 waarden vallen zonder geweld in de vijf semantische niveaus uit je vraag plus "in orde":

| niveau | betekenis | bevat |
|---|---|---|
| **verboden** | dit gaat niet zoals het nu staat | blokkade · eerst · bad · nee · verstreken · vandaag · zeerdruk · zwart |
| **verplicht** | dit moet je doen, gewoon doen | actie · voorVertrek · inDeAuto · must · todo · mits · bijna · indicatief (bedrag telt mee) |
| **aanbevolen** | verstandig, geen boete | advice · aanbevolen · letop (informatief) · waarschuwing · later |
| **optioneel** | geldt niet voor jou, of is een keuze | na · nietVoorJou · nietmee · optioneel tolpunt · rustig |
| **onbekend / niet geverifieerd** | de app weet het niet zeker | onbekend · unknown · check · uncertain · unavailable · onbekend (kosten) · druk (kalender) |
| **in orde** | klaar of bevestigd | ok · klaar · ja · bevestigd · official · verified · matig (kalender: "enige drukte" is normaal) |

### 4.2 Wat de huidige app doet (en waarom dat de vraag oproept)

Vandaag is amber tegelijk `s-actie` (verplicht), `n-uncertain` (onzeker), `.onzeker`, de
milieuzonekaart, de wijzigingenkaart én de navbadge; het verschil zit in een gestippelde rand.
Blauw (`--secondary`) is tegelijk knop, link, focusring, progress, routelijn, tolmarker,
checkbox én de status `s-waarschuwing`. Dat is precies de botsing die je beschrijft, alleen dan in
blauw en amber.

### 4.3 Drie opties

#### Optie 1 — "Stil verplicht": accent strikt voor acties, status heeft een eigen schaal waarin *verplicht geen kleur is*

- Terracotta: alleen de primaire CTA-pill, de actieve stand van een schakelaar, de
  focusring, en de actieve nav-indicator. Nooit op een chip, nooit op een kaartje, nooit in de
  kaart.
- Statusschaal: verboden = rood, onbekend = amber, in orde = groen, **verplicht = inkt**
  (koel getint vlak, solid inkt-teken), aanbevolen = inkt-2 contour, optioneel = inkt-2
  gestippeld.
- Het principe: kleur markeert *afwijking van het normale pad*. Het normale pad in deze app is
  "dit moet je regelen", en dat komt 11 keer voor op een gewone reis. Dat hoort de rustige
  basistoon te zijn, niet een waarschuwing.

**Voor.** Geen enkele botsing: oranje betekent altijd "hier druk je op". De ene blokkade en het
ene onzekere feit springen eruit omdat de rest stil is (Hopper-effect zonder Hopper-lawaai).
Print en grijstinten werken vanzelf: inkt/contour/stippel zijn al drie vormen. Dark mode heeft
geen apart "oranje op donker"-probleem. Sluit aan bij blendedtech ("de rest is navy, grijs en
gebroken wit").

**Tegen.** "Verplicht" heeft geen waarschuwingskleur meer; wie de app snel scant ziet de
verplichtingen niet oranje oplichten. Dat vangen we op met het teken (!), de groepskop ("Voor
vertrek", "In de auto") en de deadline in inkt-vet. Vereist discipline: één plek waar per ongeluk
`--accent` op een chip belandt, breekt het systeem.

#### Optie 2 — "Oranje is verplicht": terracotta in de statusschaal, de primaire actie wordt inkt

- Statusschaal: verboden = rood, verplicht = terracotta, onbekend = amber, in orde = groen.
- De CTA-pill wordt inkt (`#1E2A3A`, wit erop 14,51:1) met het witte pijl-bolletje; in dark mode
  een lichte pill (`#E8EAEE`) met donkere tekst.

**Voor.** Verplicht is luid en scanbaar. De CTA in inkt is chic en haalt moeiteloos contrast.

**Tegen.** Gemeten: terracotta als *chip-inkt* op een licht vlak faalt (`#D9542B` op `#FBE9E2`
3,40:1; `#BD4420` 4,01:1); om AA te halen moet hij naar `#A83A16` (5,44:1), en dat is bruinrood
dat naast verboden-rood `#A5261A` staat met een onderling contrast van 1,13:1 — twee tinten die
voor iedereen, niet alleen voor kleurenblinden, dezelfde kleur zijn. Verplicht en verboden vallen
dus samen, het slechtst denkbare paar. Bovendien verliest de app de warme accent op de knop die
de briefing expliciet vraagt, en 11 oranje chips per pagina zijn opnieuw één oranje pagina.

#### Optie 3 — "Amber naast terracotta": accent voor acties, amber voor verplicht (dichtst bij nu)

- Terracotta CTA, amber chips voor verplicht (`#7A5205` op `#FBF1DC`), en onbekend krijgt dan
  een andere vorm van dezelfde amber (gestippeld), zoals nu.

**Voor.** Kleinste stap vanaf de huidige CSS.

**Tegen.** Amber-inkt en terracotta-accent hebben onderling 1,47:1; de vlakken `#FBF1DC` en
`#FBE9E2` 1,05:1. Onder deuteranopie (de meest voorkomende kleurenblindheid, 6 % van de mannen)
schuiven oranje en amber naar dezelfde okerbruine tint. Een pagina met een terracotta knop en tien
amber chips leest dan als "elf dingen die schreeuwen". En het probleem verplicht/onzeker in
dezelfde hue blijft bestaan.

### 4.4 Leesbaar zonder kleur (kleurenblindheid, zonlicht, print)

Elke status draagt in alle opties drie lagen, en de eerste twee zijn kleurloos:

| niveau | teken | vorm (chip) | woord | grijstint (print) |
|---|---|---|---|---|
| verboden | ✗ | gevuld vlak, 1 px rand | Blokkade / Nee / Verstreken | donkergrijs vlak |
| verplicht | ! | gevuld koel vlak, solid teken | Actie / Ja, n dingen | lichtgrijs vlak |
| aanbevolen | + | contour | Aanbevolen / Let op | contour |
| optioneel | — | gestippelde contour | Niet voor jouw kenteken / niet meegerekend | stippel |
| onbekend | ? | gevuld vlak, gestippelde rand | Onbekend / Controleer dit / onzeker | lichtgrijs + stippel |
| in orde | ✓ | gevuld vlak | In orde / Klaar / bevestigd | doorgestreepte titel |

De tekens en woorden bestaan al in de code (`STATUS_TEKEN`, `KOSTEN_TEKEN`, `oordeelHTML`,
`groep.*.teken`, `.wteken`); de vormen bestaan deels (gestippeld voor onbekend, gestippeld voor
prijs). Het herontwerp maakt de vormtaal consistent over alle negen schalen: gevuld = gebeurt,
contour = mag, stippel = niet voor jou / weet ik niet.

### 4.5 Aanbeveling

**Optie 1.** Het is de enige optie waarin oranje één betekenis heeft, waarin verboden en verplicht
niet op elkaar kunnen gaan lijken, en waarin de meest voorkomende status de rustigste is. De
prijs — verplicht licht niet meer oranje op — is precies wat de briefing vraagt: "niet een
spreadsheet met kleurtjes".

Twee uitzonderingen op "accent alleen voor acties", expliciet benoemd zodat ze geen sluipweg
worden:

1. De **noodknop** en "Bel 112" blijven rood (`--sos`), niet terracotta: SOS-rood is een
   conventie, en de knop is de dominante actie in zijn eigen context.
2. Een **actieve schakelaar** (reismodus aan, donkere modus aan) is terracotta: dat is "actieve
   status" in de zin van de briefing, en een schakelaar is een actie-element.

Wat ik bewust niet doe: de deadline "vandaag regelen" in terracotta zetten omdat het "een
oproep tot actie" is. Die lijn is dun en leidt binnen een maand tot oranje overal. Vandaag/
verstreken valt onder verboden-rood (de tijd is op), bijna onder verplicht-inkt-vet.

---

## 5. Richting A scherm voor scherm

Mobile-first, 375 px breed. Desktop (≥ 1024 px) houdt de vaste zijbalk en zet kaarten naast
elkaar zoals nu; waar dat afwijkt staat het erbij. Alle id's en klassen uit §1 blijven; wat
verandert is CSS, plus de kleine JS-aanrakingen uit §7.

### 5.0 Navigatiemodel

Ongewijzigd in structuur (het is de §3-IA en `switchView` hangt eraan), gewijzigd in gewicht:

```
mobiel                                   desktop ≥ 1024
┌────────────────────────────────┐       ┌────────┬───────────────────────────────┐
│ Grenschecklist        NL   ◐   │       │ Grens- │                               │
│ (56 px, geen rand, bg = pagina)│       │ check- │  main (max 1120, marge 40)    │
│                                │       │ list   │                               │
│  … pagina …                    │       │        │                               │
│                                │       │ ( + )  │  ← "Nieuwe reis" als accent- │
│                                │       │        │     pill met bolletje        │
│                                │       │ Reis   │                               │
│                                │       │ Acties │  actief: inkt-vet + 3 px      │
│                                │       │ Kaart  │  accent-streep links; overige │
│                                │       │ Kosten │  inkt-2; hover surface-2      │
│                                │       │ Regels │                               │
│                                │       │ Docu.  │                               │
│                                │       │ Onderw.│                               │
│                                │       │ ────   │                               │
│                                │       │ Reizen•│  • = badge (inkt-vlak, wit)   │
│                                │       │ Reiserv│                               │
│                                │       │        │                               │
│                                │       │ Instel.│                               │
├────────────────────────────────┤       │ ◐ Donk.│                               │
│  ⌂     ☰     ⌂     €     ⋯    │       │ NL ▾   │                               │
│ Reis  Acties Kaart Kosten Meer │       │ offline│                               │
│ (64 px + safe-area; actief =   │       └────────┴───────────────────────────────┘
│  inkt + pil surface-2 achter   │
│  het icoon; overige inkt-2)    │
└────────────────────────────────┘
```

- Geen accent in de navigatie behalve de 3 px streep op desktop en de "Nieuwe reis"-pill. Op
  mobiel is "actief" inkt met een zacht pilvlak achter het icoon — genoeg zonder kleur.
- De topbar verliest zijn rand en zijn blur-achtergrond: hij is gewoon de bovenkant van de pagina.
  Scheiding door ruimte.
- Het Meer-blad wordt een r24-blad met grijpstreep, rijen van 56 px, geen scheidingslijnen.
- Hash-routing, `.active`, `aria-expanded`: ongewijzigd.

### 5.1 Home

```
┌──────────────────────────────────────┐
│ Grenschecklist               NL   ◐  │
│                                      │
│ ╭─────────────────────────────────╮  │  alleen als er een reis staat:
│ │ ▮JE REIS▮ Utrecht → Salzburg  › │  │  pill-banner, klein inkt-label links,
│ ╰─────────────────────────────────╯  │  tekst inkt-2, hele pill = knop → dashboard
│                                      │
│ Ga voorbereid                        │  display 36/1.05, inkt
│ de grens over.                       │  tweede regel ink-soft
│                                      │
│ Controleer in één minuut wat jij     │  lead 17 px inkt-2, max 30 ch
│ moet regelen voor je autorit         │
│ door Europa.                         │
│                                      │
│ ╭──────────────────────────────╮     │  CTA-pill 56 px: accent, tekst 17/600 wit,
│ │  Plan mijn reis          (→) │     │  rechts wit bolletje 36 px met accent-pijl
│ ╰──────────────────────────────╯     │
│ ✓ Gratis   ✓ Geen account nodig      │  14 px inkt-2, vinkjes in in-orde-groen
│ ✓ Privacyvriendelijk  ✓ Offline      │
│                                      │  48 px ruimte
│      ╭───────────────────────────╮   │  voorbeeldkaart r20, schaduw 1,
│   ╭──┤ VOORBEELD · NIET JOUW REIS│   │  2° gedraaide schaduwkaart eronder
│   │  │ Brussel → Salzburg        │   │  (puur CSS ::before) = "licht overlappend
│   │  │ 🇧🇪 → 🇩🇪 → 🇦🇹  742 km · 8u12│   │   gestapeld"
│   │  │ ▓▓▓▓▓▓▓▓▓░░░  72 %        │   │  progress inkt op surface-2
│   │  │ ✓ 7 geregeld  ! 2  ✗ 1    │   │  tellers: chips uit de statusschaal
│   │  │ Geschatte kosten €155–180 │   │  bedrag num-l
│   ╰──┴───────────────────────────╯   │
│                                      │  64 px ruimte
│ Hoe het werkt                        │  h2
│ ① Route  → ② Auto  → ③ Checklist     │  drie kaartjes, nummer in inkt-cirkel
│                                      │
│ Eerlijk over de data …  (tekst)      │  inkt-2, datum in caption
├──────────────────────────────────────┤
│  Reis   Acties   Kaart   Kosten  Meer│
└──────────────────────────────────────┘
```
Desktop: hero-tekst links (max 52 ch), voorbeeldkaart rechts, verticaal gecentreerd, zoals nu.
Eén dominante actie: "Plan mijn reis". De verderkaart is een pill-banner en geen tweede knop.

### 5.2 Reiswizard

```
┌──────────────────────────────────────┐
│ Grenschecklist               NL   ◐  │
│                                      │
│ ● ─── ○ ─── ○ ─── ○                  │  stappenbalk: bolletjes 28 px; af = inkt
│ Waarheen                             │  gevuld + ✓, nu = inkt-ring + accent-stip
│                                      │  binnenin, later = line-ring; alleen de
│ Waar                                 │  actieve stap draagt zijn naam (nu ook)
│ ga je heen?                          │  h1 tweekleurig
│                                      │
│ Vul je vertrekplaats en je           │  lead inkt-2
│ bestemming in.                       │
│                                      │
│ VAN                                  │  eyebrow 11 px
│ ╭──────────────────────────────╮     │  input 56 px, r12, surface-2, geen rand;
│ │ ◎  Utrecht                   │     │  focus: 2 px accent-ring + witte fill
│ ╰──────────────────────────────╯     │
│  ╭─────────────────────────────╮     │  autocomplete: surface, r16, schaduw 2,
│  │ 🇳🇱 Utrecht        Nederland │     │  rijen 48 px, landnaam rechts inkt-2
│  │ 🇳🇱 Utrechtse Heuvelrug  …   │     │
│  │ ⌕  Niet gevonden — zoek online│    │  online-rij: inkt, onderstreept
│  ╰─────────────────────────────╯     │
│ NAAR                                 │
│ ╭──────────────────────────────╮     │
│ │ ⚲  Salzburg                  │     │
│ ╰──────────────────────────────╯     │
│ Nog geen plaats? Handmatig kiezen    │  hint / file://-variant
│ kan in stap 4.                       │
│                                      │  wizkaart: geen kaart meer — de pagina
│                                      │  ís de kaart (minder chrome)
│                                      │
│  Terug                ╭──────────╮   │  Terug = tekstknop inkt-2 (alleen stap>1)
│                       │Verder (→)│   │  Verder = accent-pill; disabled = surface-2
│                       ╰──────────╯   │  met inkt-2 tekst (geen opacity — leesbaar)
├──────────────────────────────────────┤
```
- Stap 2: twee datumvelden naast elkaar (≥ 360 px), hint eronder.
- Stap 3: vier selects in één kolom op mobiel, 2 × 2 op ≥ 640 px; `.veldhint` als caption; het
  optionele blok (gewicht/hoogte) blijft een `<details>` maar als tekstknop "+ Gewicht en hoogte
  (optioneel)".
- Stap 4: samenvatting als één rustige kaart (r20) met drie regels in inkt; startknop als
  accent-pill; de analyselijst als vijf rijen met bolletjes (○ wacht, draaiend ringetje bezig,
  ✓ in-orde-groen klaar, ⚠ onbekend-amber fout) en de uitkomst rechts in num-m; `.wizklaar` als
  in-orde-groen vlak met de accent-pill "Naar mijn reis"; `.wizfout` als onbekend-amber vlak
  (het is geen verbod, het is "we weten het niet") met twee knoppen: Opnieuw (contour-pill),
  Handmatig doorgaan (accent-pill — dat is daar de dominante actie).
- Het handmatige blok: select 56 px + contour-knop "Toevoegen"; gekozen landen als vlag-chips
  met ×; "Naar mijn reis" als accent-pill.

### 5.3 Reisdashboard

```
┌──────────────────────────────────────┐
│ Grenschecklist               NL   ◐  │
│                                      │
│ ⇪ Reis ontvangen via een link …      │  deelmelding: in-orde-groen vlak, één keer
│                                      │
│ 🇳🇱 ─── 🇩🇪 ─── 🇦🇹                  │  "route als verhaallijn": vlaggen 24 px op
│ Utrecht → Salzburg                   │  een inkt-lijn met km-labels eronder
│ 10–17 oktober                        │  (uit tripAnalyse.km) — h1 inkt,
│ kenteken NL · personenauto · diesel  │  periode ink-soft 20 px
│ Euro 5 · vertrek 10 oktober  wijzig  │  meta caption inkt-2; "wijzig" onderstreept
│ ⤴ Deel deze reis                     │  tekstknop
│                                      │  32 px
│ ╭──────────────────────────────────╮ │  kaart r20
│ │ Je bent                          │ │  h2 groot tweekleurig: "Je bent" inkt,
│ │ 0 % klaar                        │ │  "0 % klaar" ink-soft, cijfer num-l
│ │ ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░   │ │  progress 8 px, inkt op surface-2; 100 % → groen
│ │ ✓ 0 geregeld   ! 11 acties       │ │  tellers als statuschips (in orde / verplicht)
│ │                                  │ │  ✗ n problemen alleen als >0 (rood)
│ │ ╭──────────────────────────────╮ │ │
│ │ │  Bekijk alle acties      (→) │ │ │  de ene accent-pill van dit scherm
│ │ ╰──────────────────────────────╯ │ │
│ ╰──────────────────────────────────╯ │
│                                      │  32 px
│ Dit moet je regelen                  │  h2 (buiten een kaart: scheiding door ruimte)
│ 🇦🇹 Vignet kopen voor Oostenrijk     │  rij 1: vlag 22 px + wat (16/600 inkt)
│    omdat je route 17 km door         │  rij 2: waarom (14 inkt-2)
│    Oostenrijk loopt                  │
│    ⏱ uiterlijk 22 sep      ! Actie   │  rij 3: deadline (inkt-vet als bijna, rood
│ ──────────────────────────────────── │  als vandaag/verstreken) + statuschip
│ 🇩🇪 Milieusticker regelen voor …     │  rijen gescheiden door --line (tabel-uitz.)
│ …                                    │
│ Nog 6 acties bekijken                │  tekstknop inkt onderstreept
│                                      │  48 px
│ ╭─────────╮ ╭─────────╮ ╭──────────╮ │  cijfercellen: surface-2, r16, geen rand,
│ │ AFSTAND │ │REISTIJD │ │ KOSTEN   │ │  eyebrow + num-l inkt; hele cel = knop
│ │ 938 km  │ │ 9u 17m  │ │€10–32 of…│ │  ("of meer" caption)
│ ╰─────────╯ ╰─────────╯ ╰──────────╯ │
│                                      │  48 px
│ ╭──────────────────────────────────╮ │  boetekaart: onbekend-amber vlak? NEE —
│ │ Wat het kost als je niets regelt │ │  het is een gevolg, geen onzekerheid:
│ │ circa €220                       │ │  gewone kaart (surface), bedrag num-l
│ │ Waar dit bedrag vandaan komt ▾   │ │  in verboden-rood inkt (het is een risico)
│ ╰──────────────────────────────────╯ │
│ Regels per land                    › │  snelkoppelingen: drie rijen 56 px,
│ Reisdocument                       › │  inkt, chevron inkt-2, geen kaart eromheen
│ Reiservaring                       › │
│                                      │  48 px
│ ╭ 37 feiten · 20 officieel · 15 ge- ╮│  vertrouwensbalk: pill-banner-stijl,
│ │ controleerd · 2 onzeker  ·  19 aug ││  surface-2, caption; "verouderd" → amber
│ ╰ Bekijk de 2 onzekere feiten ▾     ╯│  vlak; details eronder als lijst
├──────────────────────────────────────┤
```
Desktop: twee kolommen (1,35 : 1) zoals nu; de vlaggen-verhaallijn loopt over de volle breedte
boven beide kolommen.

### 5.4 Acties (checklist)

```
┌──────────────────────────────────────┐
│ Grenschecklist               NL   ◐  │
│                                      │
│ Dit moet je                          │  h1 tweekleurig
│ regelen                              │
│ ░░░░░░░░░░░░░░░░░░░░  0 % · 11 open  │  progress + caption, sticky onder de topbar
│                                      │  bij scrollen (sticky, geen JS)
│ ⓘ De datums zijn richttijden van de  │  deadlinenoot: caption inkt-2, info-icoon,
│   app …                              │  geen kaart
│                                      │  48 px
│ !  Voor vertrek                   4  │  groepskop: teken in 28 px inkt-cirkel,
│    Regel dit voordat je wegrijdt.    │  h2, teller num-m in pil surface-2;
│                                      │  de "eerst"-groep krijgt een rood teken,
│ ╭──────────────────────────────────╮ │  de rest inkt — verder geen groepkleur
│ │ ☐  🇦🇹 Vignet kopen voor         │ │  actiekaart r20 surface, schaduw 1,
│ │       Oostenrijk                 │ │  géén linker kleurbalk meer (behalve
│ │    ⏱ Regel dit uiterlijk 22 sep  │ │  blokkade: rood vlak + rode rand)
│ │    ! Actie      Vanaf €9,60      │ │  meta: deadline eerst (inkt-vet), dan
│ │    Digitaal via de ASFINAG-web-  │ │  statuschip, prijs als num-m rechts
│ │    shop of app, of als sticker … │ │  uitleg 14 px inkt-2, 2 zinnen
│ │    ╭ ? Niet zeker — controleer ╮ │ │  onzeker: amber vlak r12, gestippelde rand
│ │    │ de officiële bron …       │ │ │
│ │    ╰──────────────────────────╯ │ │
│ │    ? Waarom zie ik dit?          │ │  details-summary als tekstknop 40 px
│ ╰──────────────────────────────────╯ │
│ ╭──────────────────────────────────╮ │
│ │ ☐  🇩🇪 Milieusticker regelen …   │ │
│ …                                    │
│ 🚗 In de auto                     7  │
│ …                                    │
│ ✓  Klaar                          0 ▾│  ingeklapte groepen: kop als samenvatting,
│ —  Niet voor jouw kenteken        2 ▾│  chevron rechts
├──────────────────────────────────────┤
```
- Checkbox: 24 px, r6, inkt-rand 1,5 px; aangevinkt = in-orde-groen vulling met wit vinkje
  (`accent-color: var(--ok)`). Afgevinkte kaart: titel doorgestreept, inkt-2, geen opacity
  (leesbaar).
- Blokkade-kaart: verboden-vlak `#FBE9E7`, rand `#EDB3AB`, teken ✗ in rood; de enige kaart
  met kleur op de pagina, dus hij springt.
- Onbekend-kaart (bijv. "Vul je euronorm in"): amber vlak; knop "Naar profiel" als contour-pill.
- Het afvink-gedrag (herrender, scroll, focus, sr-melding) is JS en blijft.

### 5.5 Kaart

Mobiel: de kaart komt bóven de velden, want de kaart was onder de vouw. HTML-volgorde blijft
(`.panel-route` vóór `.panel-map`); CSS `order` draait ze op < 1024 px.

```
┌──────────────────────────────────────┐
│ Grenschecklist               NL   ◐  │
│ ┌──────────────────────────────────┐ │  kaartvlak 52 vh, surface-2 achtergrond
│ │        ╭╮                   [≡]  │ │  landen: surface (wit) op surface-2,
│ │   ●────╯╰───╮     🇩🇪      [◎]  │ │  op-route-landen: #E2DED6; grenzen --line;
│ │ Utrecht     ╰──€──╮              │ │  routelijn inkt 3 px + halo inkt 10 %;
│ │                   ╰──Z─╮   [+]   │ │  start: witte stip inkt-ring; eind: inkt-
│ │            🇦🇹          ●  [−]   │ │  stip met wit; tol: inkt "€"; optioneel:
│ │ ● start ● tol Z zone ! verboden  │ │  inkt-2 "~"; zone: witte stip inkt "Z";
│ └──────────────────────────────────┘ │  zonebad: rood "!". Knoppen 44 px, wit,
│ ╭──────────────────────────────────╮ │  schaduw 1. Legenda caption linksonder.
│ │ ══                               │ │  routeblad r24 overlapt de kaart 24 px
│ │ Route                            │ │  (negatieve margin), grijpstreep decoratief
│ │ en kaart                         │ │  h1 tweekleurig
│ │ VAN  ╭───────────────────────╮ ⇅ │ │  velden zoals wizard; swap 44 px contour
│ │ NAAR ╭───────────────────────╮   │ │
│ │ ╭──────────────────────────────╮ │ │  accent-pill "Route berekenen"; disabled
│ │ │  Route berekenen         (→) │ │ │  tijdens rekenen; status eronder caption
│ │ ╰──────────────────────────────╯ │ │  (fout: verboden-rood inkt, geen vlak)
│ │ Klaar — de landen hieronder …    │ │
│ │                                  │ │
│ │ 938 km    9u 17m    €10–32 of m. │ │  statkaarten → één cijferrij (num-l),
│ │ AFSTAND   REISTIJD  KOSTEN       │ │  eyebrow eronder; geen drie kaartjes
│ │                                  │ │
│ │ Landen op deze route             │ │  h3
│ │ 🇳🇱 Nederland                  › │ │  rijen 52 px
│ │ 🇩🇪 Duitsland                  › │ │
│ │ 🇦🇹 Oostenrijk                 › │ │
│ │                                  │ │
│ │ ╭ Z Milieuzones op je route ────╮ │ │  milieukaart: verplicht-vlak (koel), geen
│ │ │ Utrecht · Ruhrgebied · Keulen │ │ │  amber (het is geen onzekerheid)
│ │ │ · Frankfurt am Main           │ │ │  chips → optioneel tikbaar (§7, JS)
│ │ ╰───────────────────────────────╯ │ │
│ │ Voertuig  kenteken NL · diesel … │ │  details: samenvatting + "wijzig"
│ │ Regels veranderen …              │ │  disclaimer: caption
│ ╰──────────────────────────────────╯ │
├──────────────────────────────────────┤
```
- Popup (`.kaartpopup`): r16, surface, schaduw 2, 44 px sluitknop, type-eyebrow met vlag, h3,
  kosten num-m, waarschuwing als amber vlak, bronregel. Op mobiel in fase 4 nog verankerd aan de
  marker (geen JS-wijziging); in de optionele fase 7 een onderblad (zie §7).
- Desktop: routepaneel links 400 px (scrollt), kaart rechts vullend, zoals nu — de kaart oogt
  daar al als hart.
- De "lagen"-knop wisselt nu tussen twee achtergrondtinten (`.alt`); dat blijft, met surface-2
  ↔ `#E8E5DF`.

### 5.6 Kosten

```
┌──────────────────────────────────────┐
│ Kosten                               │  h1 tweekleurig
│ onderweg                             │
│ GESCHATTE KOSTEN HEEN EN TERUG       │  eyebrow
│ €10–€32  of meer                     │  num-xl 40 px inkt, "of meer" 16 px inkt-2
│ Alles wat we durven optellen staat   │  lead
│ hieronder …                          │
│                                      │  48 px
│ Vignetten                            │  h2 (buiten kaart), uitleg caption
│ 🇦🇹 Autobahnvignette      ~ €10–32   │  kasboekrij: wat 16/600, bedrag num-m rechts
│    de bron noemt €9,60–€32; wat jij  │  detail 14 inkt-2
│    betaalt hangt af van …            │
│    ~ indicatief · Officiële website →│  zekerheidschip (contour, teken+woord)
│ ────────────────────────────────────  │  + bronlink caption
│                            Samen €10–32│ subtotaal: caption + num-m, lijn erboven
│                                      │  48 px
│ Milieuzones                          │
│ 🇩🇪 Umweltplakette        geen bedrag│  "geen bedrag" caption inkt-2 rechts
│    Je moet vooraf een sticker …      │
│    ? onbekend · Officiële website →  │  onbekend = amber chip (gevuld, stippelrand)
│                                      │
│ Brandstof                            │
│ Brandstof                 geen bedrag│
│    — niet meegerekend                │  stippel-contour chip
│                                      │
│ ╭──────────────────────────────────╮ │  brandstofkaart: de enige kaart (het is
│ │ Reken brandstof mee              │ │  invoer): twee velden 56 px, r12
│ │ VERBRUIK L/100 KM   PRIJS €/L    │ │
│ │ ╭─────────╮         ╭─────────╮  │ │
│ │ │ 6,2     │         │ 1,78    │  │ │
│ │ ╰─────────╯         ╰─────────╯  │ │
│ │ Blijft in je browser …           │ │
│ ╰──────────────────────────────────╯ │
│                                      │
│ Tankstrategie                        │  h2
│ ╭ ⛽ Tank vol in Duitsland en niet ╮ │  advies: in-orde-groen vlak r12 (het is
│ │ in Nederland — scheelt circa €6,45│ │  goed nieuws), tekst 15 inkt
│ ╰──────────────────────────────────╯ │
│ 🇳🇱 Nederland   diesel/L      €2,42  │  prijsrijen num-m, hoogste in inkt-2?
│ 🇩🇪 Duitsland                 €2,29  │  nee — alle inkt; goedkoopste krijgt ✓
│ 🇦🇹 Oostenrijk                €2,05 ✓│  in-orde-groen
│ Prijspeil 24 augustus 2026 · …       │  caption
│                                      │
│ Wat er niet in zit                   │  h2, lijst met chips zoals nu, caption
├──────────────────────────────────────┤
```
Desktop: twee kolommen (1,4 : 1) — kasboek links, brandstof/tank/niet-in-zit rechts.

### 5.7 Detailpagina land (Regels per land)

```
┌──────────────────────────────────────┐
│ Grenschecklist               NL   ◐  │
│ ╭──────────────────────────────────╮ │  fotokaart r24, 176 px hoog, foto met
│ │ (foto Nederland)                 │ │  lichte inkt-sluier 20 % onderaan; BE/CH
│ │                 ╭ 🇳🇱 Wissel ▾ ╮  │ │  zonder foto: surface-2 vlak met 96 px vlag
│ │                 ╰──────────────╯  │ │  landkiezer: witte pill met vlag, rechtsonder
│ ╰──────────────────────────────────╯ │  ín de fotokaart (was: op het navy)
│ EUROPA · WEST                        │  eyebrow inkt-2
│ Nederland                            │  h1 inkt (geen wit-op-navy meer)
│ Reisregels, verplichtingen en …      │  lead
│                                      │
│ ╭──────────────────────────────────╮ │  oordeelkaart: één kaart, twee secties
│ │ Mag ik hier rijden?              │ │  (blijven twee <section> met eigen h2
│ │ ✓ Ja                             │ │  voor aria-labelledby); teken 32 px
│ │ Euro 5 voldoet aan de norm van   │ │  cirkel in statuskleur, woord 28 px inkt
│ │ minimaal Euro 4 …                │ │  ✓ groen · ✗ rood · ! inkt · ? amber
│ │ ──────────────────────────────── │ │
│ │ Moet ik iets regelen?            │ │
│ │ ✓ Nee                            │ │  bij "Ja, 3 dingen": lijst + tekstknop
│ │ Voor dit land staat er niets …   │ │  "Naar acties"
│ ╰──────────────────────────────────╯ │
│                                      │  48 px
│ Snelheid            130 km/u snelweg ▾│ regelsecties: geen kaart per sectie meer;
│ ──────────────────────────────────── │  rijen 56 px, naam 16/600 inkt links,
│ Uitrusting     0 verplicht, 2 aanbev.▾│ samenvatting caption inkt-2, chevron;
│ ──────────────────────────────────── │  open: inhoud ingesprongen, verkeers-
│ Milieuzone en tol        Milieuzone ▾│  borden blijven (semantisch), bronregel
│ ──────────────────────────────────── │  caption. Scheiding door --line: dit is
│ Bijzondere regels          3 regels ▾│  de "tabel"-uitzondering op ruimte-i.p.v.
│ ──────────────────────────────────── │  -lijnen.
│ Bronnen                   2 bronnen ▾│
├──────────────────────────────────────┤
```
- De landkiezer-popover: r16, surface, schaduw 2, zoekveld 48 px, groepslabels eyebrow, rijen
  48 px, actieve rij inkt-vet met ✓.
- Verouderd-balk: amber vlak, caption.
- Dezelfde `.regelsectie`-klassen worden door de 90+ gegenereerde contentpagina's gebruikt
  (daar staan ze `open`); die krijgen dus dezelfde rij-stijl. Dat is gewenst: één merk.

### 5.8 Detailpagina stad (milieuzone)

Er is in de app geen stadspagina; een stad bestaat als (a) kaartmarker met popup, (b) chip in
de milieukaart op de kaartpagina, (c) gegenereerde pagina `milieuzone-<stad>/`. Voorstel:

```
mobiel — onderblad (fase 7, JS)         desktop — popup boven de marker (fase 4, CSS)
╭──────────────────────────────────╮    ╭────────────────────────────╮
│ ══                            ×  │    │ 🇩🇪 MILIEUZONE · Umweltzone ×│
│ 🇩🇪 MILIEUZONE · Umweltzone      │    │ Keulen                     │
│ Keulen                           │    │ ╭ ✓ Euro 5 voldoet … ╮     │  oordeel als statusvlak
│ ╭ ✓ Euro 5 diesel voldoet aan de ╮│    │ ╰────────────────────╯     │  (groen / rood / amber)
│ │ groene plakette; sticker nodig ││    │ Groene zone sinds …        │  info 2 zinnen
│ ╰────────────────────────────────╯│    │ officieel · 19 aug 2026    │  bronregel
│ Groene zone sinds 2008; alleen … │    │ Officiële website → Klopt… │
│ officieel · gecontroleerd 19 aug │    ╰────────────────────────────╯
│ Officiële website →  Klopt dit niet?│
╰──────────────────────────────────╯
```
Inhoud is exact `toonMarkerPopup()`; alleen de plaatsing verschilt. De chips in de milieukaart
worden tikbaar en openen dezelfde popup (10 regels JS, optioneel). De gegenereerde
`milieuzone-*`-pagina's krijgen automatisch de nieuwe stijl via de gedeelde CSS.

### 5.9 Drukte-kalender (nieuw scherm — alleen als je vraag 1 met "ja" beantwoordt)

```
┌──────────────────────────────────────┐
│ Wanneer                              │  h1 tweekleurig
│ rijden?                              │
│ Verwachte drukte op de noord-zuidas, │  lead; richting uit kalRichting(trip)
│ richting zuid · vertrek 10 oktober   │
│                                      │
│ ‹  oktober 2026  ›     [heen] terug  │  maandnavigatie 44 px; richting als
│                                      │  segmented pill (inkt-vulling actief)
│ ma  di  wo  do  vr  za  zo           │  eyebrow
│          1   2   3   4               │  dagcel 44 × 48, r8, cijfer num-m
│  5   6   7   8   9  10  11           │  rustig: surface-2 / inkt-2
│ 12  13  14  15  16  17  18           │  matig: groen vlak · druk: amber vlak
│ 19  20  21  22  23  24  25           │  zeer druk: rood vlak · zwart: inkt vlak
│ 26  27  28  29  30  31               │  met wit cijfer; vertrekdag: accent-ring
│                                      │  (actieve status); vandaag: inkt-stip
│ ○ rustig  ◐ enige  ● druk  ✱ zeer  ■ │  legenda: teken + woord + vlakje
│                                      │
│ ╭──────────────────────────────────╮ │  gekozen dag: kaart met niveau-chip,
│ │ zaterdag 10 oktober   ● Druk     │ │  tekst uit drukte.json, bron-link of
│ │ Herfstvakantie zuid: eerste      │ │  "afgeleid uit de regels" (hard:false)
│ │ zaterdag …                       │ │
│ │ Bison Futé →                     │ │
│ ╰──────────────────────────────────╯ │
│ Indicatief. Bison Futé publiceert …  │  disclaimer uit meta
├──────────────────────────────────────┤
```
- Statusschaal hergebruikt: alle dagcijfers ≥ 5,2:1 (gemeten). Het teken per niveau (○ ◐ ● ✱ ■)
  maakt de kalender ook zwart-wit leesbaar; de kleurwaarden in `drukte.json` (`kleur`, `ink`,
  `legenda`, nog van het v1-thema) worden genegeerd ten gunste van CSS-klassen `.dr-rustig` … `.dr-zwart`.
- Plek in de navigatie: onder Meer (mobiel) en in de zijbalk tussen Kosten en Regels; en als
  vierde cijfercel op het dashboard ("Drukte op vertrekdag: druk").
- Benodigd JS: `DRUKTE` laden (`laadData("drukte.json")`), een `renderKalender()` van circa 80
  regels, een view `#view-kalender` in `VIEW_ORDER`, een i18n-blokje. Dit is de enige plek in dit
  voorstel waar nieuwe functionaliteit bij komt; daarom een aparte fase en een aparte ja/nee.

### 5.10 De overige schermen, kort

- **Reisdocument**: het document wordt een A4-achtige witte kaart (r20) met 24 px binnenmarge,
  koppen in eyebrow-stijl, de acties met vierkante vakjes (r6) — dit is bewust "papier". De
  printknop is de accent-pill. print.css krijgt de nieuwe klassen erbij (§8).
- **Onderweg**: vier kaarten worden vier secties met ruimte ertussen; de reismodus-schakelaar is
  de accent-schakelaar (actieve status); het reispack-lijstje in caption met groene vinkjes;
  douane-badge "NU RELEVANT" als verplicht-chip (inkt), niet amber.
- **Mijn reizen**: reiskaarten r20 zonder navy banner; bovenin een 88 px strook surface-2 met
  de vlaggen-verhaallijn van die reis (zelfde component als het dashboard); "actief" als
  inkt-chip; hernoem/verwijder als 44 px icoonknoppen; de "Plan een nieuwe reis"-kaart met
  gestippelde rand blijft (het is het optioneel-idioom) en de knop erin is een accent-pill.
  Wijzigingenkaart: pill-banner met "NIEUW"-label (accent-bright vulling is hier niet toegestaan
  onder 12 px tekst → inkt-vulling, wit) en de lijst eronder.
- **Reiservaring**: asfalt blijft (vaste kleur), de pijl wordt inkt via CSS op de SVG-path
  (CSS wint van presentatie-attributen, geen JS), haltes worden in-orde-groen als gepasseerd,
  bestemmingskaart wordt inkt-vlak met witte tekst i.p.v. blauw; chips "verplicht" = verplicht-
  chip (inkt), "aanbevolen" = contour.
- **Incidentdialoog**: r24 onderblad op mobiel (het is al `align-items:center`; wordt
  `flex-end` onder 760 px), "Bel 112" als SOS-rode pill met wit bolletje-telefoontje, pechhulp
  als contour-pill, blokken gescheiden door ruimte, formulier-tabel in caption.
- **Grensbanner**: r16 kaart, surface, schaduw 2, vlag + kop 16/600; verouderd: kop inkt-2 en
  eerste regel cursief zoals nu.
- **Meer-blad, melddialoog**: r24, grijpstreep, rijen 56 px, sluiten als contour-pill.
- **Laadfout**: onbekend-amber vlak, r20, tekst inkt.

---

## 6. Wat verandert in de informatiehiërarchie, en waarom dat beter is

1. **Eén dominante actie per scherm, en die is oranje.** Vandaag concurreren op het dashboard
   een blauwe knop, blauwe tekstlinks, blauwe cijfers, een amber boetekaart en een teal
   vertrouwensbalk. Straks is er per scherm precies één terracotta element. De gebruiker hoeft
   niet te kiezen wat "de" volgende stap is.
2. **Verplicht wordt de rusttoon, afwijking wordt kleur.** Zie §4. Het effect op de testreis:
   van elf amber chips naar nul gekleurde chips en één groene teller; de enige kleur op de
   actiepagina is de amber onzekerheidsbox bij het vignet (die precies de aandacht verdient).
3. **De kaart gaat op mobiel boven de vouw.** Nu staat op 375 px eerst een paneel van meer dan
   twee schermhoogtes (velden, statkaarten, landen, milieukaart, profiel, disclaimer) en pas
   daaronder een kaart van 320 px. Straks: kaart eerst, blad eroverheen. "Kaart als hart".
4. **Cijfers krijgen één hiërarchie.** Nu wisselen bedragen tussen 1,15 rem, 1,3 rem, 1,4 rem,
   clamp(2rem,6vw,3rem) en .95 rem in vier verschillende font-wegingen. Straks vier vaste
   numerieke stappen in Geist tabular, waardoor bedragen in een kolom uitlijnen (Cleanmeter).
5. **Kaarten alleen waar iets een ding is.** Nu zit vrijwel alles in een `.dashkaart` met rand
   én schaduw; de pagina is een raster dozen. Straks zijn lijsten gewoon lijsten met ruimte
   ertussen, en zijn kaarten gereserveerd voor: het voortgangsblok, een actie, een reis, invoer,
   een oordeel, het document. Randen verdwijnen in light mode; scheiding komt uit toon en
   ruimte. Uitzondering, bewust: tabelachtige rijen (kasboek, regelsecties, actielijst op het
   dashboard) houden een haarlijn, omdat ruimte daar te veel hoogte zou kosten.
6. **Tweekleurige koppen dragen de zin.** "Dit moet je | regelen", "Waar | ga je heen?", "Je
   bent | 0 % klaar": de inkt-helft is de handeling, de grijze helft de aanvulling. Het maakt
   koppen groter zonder zwaarder, en geeft de app een herkenbare stem.
7. **De route als verhaallijn op het dashboard.** De vlaggenrij met pijltjes wordt een lijn met
   haltes en kilometers ertussen (data ligt al in `tripAnalyse.km`). Dat is het Polarsteps-
   gevoel zonder een kaart te hoeven tekenen.
8. **De landenhero verliest het navy.** Wit-op-donker-op-foto was het enige scherm dat niet in
   het palet paste en had het laagste contrast van de app (wit op de fotosluier). Straks: foto
   als kaart, kop eronder in inkt. Rustiger, en AA zonder sluier-trucs.
9. **Niet-tekst hoeft geen kleur te dragen.** Progressbalken, routelijn, markers, checkboxen en
   schakelaars gaan van blauw naar inkt (of groen voor "klaar"). Blauw verdwijnt volledig; het
   had geen betekenis behalve "dit is interactief", en dat vertelt vorm nu.

---

## 7. Risico's: waar het herontwerp aan JS-logica raakt

Gerangschikt op kans × gevolg. "Type" zegt of het CSS-alleen is, een JS-aanraking zonder
gedragswijziging, of een echte gedragskeuze.

| # | Raakvlak | Wat er kan breken | Type | Beheersing |
|---|---|---|---|---|
| R1 | `[hidden]` versus `display:flex/grid` | Elk element dat in CSS `display` krijgt en door JS `hidden` wordt gezet, moet een `[hidden]{display:none}`-regel houden. Nu: `.view`, `.sosbutton`, `.meersheet`, `.navbadge`, `.landswitch-panel`, `.kaartpopup`, `.melddialoog`, `.grensbanner-wrap`, `.results:empty`; en `#planner`, `#stat-cards`, `#landenblok`, `#milieukaart`, `#handmatig`, `#wiz-handmatig`, `#taal-notitie` via het attribuut | CSS | Eén generieke regel `[hidden]{display:none !important}` bovenin base.css, plus de inventaris (§1) per fase |
| R2 | Kaartmaten in JS (`overlayInset`, `schermNaarViewBox`, `pasHitVlakkenAan`, `positioneerPopup`) | Lezen `#mapwrap`, `.panel-map .mapctrl.bottom` en `#routesvg` bounding rects. Het routeblad dat de kaart overlapt verkleint de zichtbare kaart niet in de DOM, dus markers kunnen onder het blad liggen; `overlayInset` kent alleen de knoppen | CSS + kleine JS | Fase 4: kaartvlak krijgt `padding-bottom` ter hoogte van de overlap zodat `#mapwrap` zelf kleiner is (geen JS); knoppen blijven in `.panel-map`. Popup-als-onderblad is fase 7 (JS: `positioneerPopup` overslaan onder 760 px) |
| R3 | Scrollcontainers | `naAfvinken()` bewaart `#view-acties.scrollTop`; `initJourneyScroll()` eist dat `#view-reis` de scroller is met vaste hoogte `calc(100vh − topbar − 64px)`; `.view-page` scrollt zelf ≥ 1024 px | CSS | Zelfde scrollmodel houden; de `64px` wordt `var(--bottomnav-h)`; hoogtes topbar/onderbalk als tokens |
| R4 | Inline kleuren in JS | `data.js` zet `style.color = "var(--amber)"`; `pages.js` zet de hero-gradient met `var(--navy)`/`var(--navy-rgb)` inline; `JOURNEY_PIJL_SVG` heeft vaste blauwe fill/stroke; `drukte.json` bevat v1-kleuren | CSS (aliassen) | `--amber`, `--navy`, `--navy-rgb` blijven bestaan als aliassen; de hero-inline-style wordt overschreven met `.landhero{background-image:none !important}` en de foto via `--land-foto` custom property? Nee: eenvoudiger is één JS-regel wijzigen (`heroStyle` alleen de url zetten). Pijl: CSS op `.journeymarker svg path` |
| R5 | Klassen in `build/build.mjs` en 90+ gegenereerde pagina's | Hernoem ik `.regelsectie`, `.bronregel`, `.niveau`, `.btn.primary`, `.lead`, `.hint`, `.view-page`, dan vallen de contentpagina's om zonder rebuild | CSS-discipline | Geen klasse hernoemen, alleen restylen; na fase 5 één contentpagina in nl en en nalopen; `npm run build:pages` niet nodig tenzij de markup verandert |
| R6 | print.css | Verwijst naar klassen; nieuwe kaartklassen moeten in de "kaders in plaats van vlakken"-lijst; tokenreset moet ook de nieuwe tokens op zwart-wit zetten | CSS | Fase 5: print.css meenemen; testen met "opslaan als PDF" op document én acties |
| R7 | `.active`, `aria-current`, `aria-expanded` | `switchView` zet alleen `.active` (het statische `aria-current="page"` op de zijbalk beweegt niet mee — bestaand mankement) | — | Niet aanraken (gedrag), wel noteren voor een latere a11y-ronde |
| R8 | Tweekleurige koppen | Vereist een marker in i18n-strings (nl én en) en een helper `kopHTML()`; 10 koppen in 8 renderfuncties | JS, geen gedrag | Aparte commit in fase 2; zonder marker valt de helper terug op één span, dus onvertaalde strings breken niet |
| R9 | Tikbare milieuchips → popup | Nieuwe interactie (`data-marker` op `.mchip`, click-handler) | JS, nieuw gedrag | Fase 7, optioneel, na akkoord |
| R10 | Onderbalk-hoogte en SOS-positie | `.sosbutton{bottom:calc(84px + safe-area)}`, `.view-page{padding-bottom:84/148px}`, `.panel-route{padding-bottom:84px}` zijn drie losse getallen | CSS | Eén token `--bottomnav-h` + `--sos-h`; inventaris G13 na elke fase |
| R11 | Inputs op 16 px | Nu 15 px; iOS zoomt bij focus op < 16 px. Verhogen naar 16 kan wrapping in `.row2` veranderen | CSS | Bewust onderdeel van fase 1; op 375 px testen |
| R12 | `accent-color` van checkboxes en `.switch` | Native rendering; in dark mode moet de switch-track ≥ 3:1 op surface (gemeten `#E2603A` 4,54:1) | CSS | — |
| R13 | Service worker | CSS-wijzigingen komen via stale-while-revalidate pas bij de tweede lading; oude gebruikers zien één keer oud+nieuw gemengd als fonts/CSS niet tegelijk verversen | build | `CACHE` bumpen aan het eind van elke fase (`npm run build:sw`); geen nieuwe assets tenzij Geist 800 (dan ook `build:sw`) |
| R14 | Details/summary `::after` teksten ("wijzig", "sluit", "+", "−") | Zitten in CSS `content:` en zijn dus niet vertaald (bestaand); bij herontwerp niet vergeten in EN | CSS | Vervangen door chevron-icoon (taalloos) — dat is een verbetering zonder gedragswijziging |
| R15 | `.wizbalk` op < 560 px | Labels verborgen behalve actieve; met 28 px bolletjes en "Waarheen" past het, met langere EN-labels ("Where to") ook — controleren | CSS | Fase 2 in beide talen |
| R16 | Reduced motion | Nieuwe transities moeten onder de bestaande blanket-regel vallen — ja, want die staat op `*` | — | — |
| R17 | Dead CSS | `.bento*`, `.landcard`, `.eqcard`, `.milieupanel`, `.verbodenpanel`, `.chkrow`, `.blockerbar`, `.verdict` staan in pages.css/print.css maar worden door geen enkele renderer meer gebruikt (Kinetic-Route-erfenis) | opruimen | Fase 6, met `grep` per klasse over js/ én build.mjs voor het weghalen |

Wat níet raakt aan logica: het trip-object, de actie-engine, de deadlines, de kosten, de
routeprovider, de opslag, de deellink, i18n-mechaniek, de geodata. Daar komt geen wijziging.

---

## 8. Implementatieplan in fasen

Elke fase: één commit (na jouw akkoord per commit, zoals afgesproken), daarna de inventaris
uit §1 aflopen in vier standen (375 px licht, 375 px donker, 1280 px licht, print) in nl en en,
en een korte "ACCEPTATIE_DESIGN.md"-tabel bijhouden per fase. De app blijft na elke fase
werkend en uitrolbaar; er is geen fase waarin de helft oud en de helft nieuw is.

| fase | wat | bestanden | verwachte omvang | inventaris-focus |
|---|---|---|---|---|
| **D0 — tokens en aliassen** | Nieuwe tokens in base.css; alle oude namen als aliassen op nieuwe waarden; `[hidden]`-vangnet; `--bottomnav-h`/`--sos-h`; body 16 px; dark-tokens; niets verplaatst | base.css, pages.css (3 getallen), sw.js CACHE | klein | alle schermen: alleen kleur en tekstgrootte verschillen; contrastaudit met het script uit de scratchpad |
| **D1 — fundament** | Typografie-schaal, spacing, radii, elevatie; knoppen → pills met bolletje-variant; contour- en tekstknoppen; inputs 56 px; chips: het volledige statussysteem (teken + woord + vorm) op alle negen schalen; focusringen; topbar, onderbalk, Meer-blad, zijbalk; details-chevrons | components.css, pages.css (chips/knoppen/nav-delen) | groot | G4–G12, A8, C3 chips, R4 oordelen, D3 tellers; toetsenbordrondje |
| **D2 — home en wizard** | Hero tweekleurig (helper + i18n-markers), pill-banner, voorbeeldkaart met stapel-schaduw, wizard zonder kaart-om-de-kaart, stappenbalk, analyselijst, fout- en handmatig-blokken | pages.css, i18n.js (markers), util.js (`kopHTML`), home.js/wizard.js (kop-aanroep) | middel | H1–H6, W1–W9 incl. file://-variant en alle drie de foutvarianten (te forceren via devtools: netwerk offline) |
| **D3 — dashboard en acties** | Verhaallijn-component, voortgangskaart, actielijst als lijst, cijfercellen, boetekaart, snelkoppelingen, vertrouwens-pill; actiegroepen en actiekaarten, blokkade/onbekend-varianten, sticky voortgang | pages.css, dashboard.js (verhaallijn-HTML, km-labels), acties.js (geen) | groot | D1–D8, A1–A11 incl. afvinken (scroll/focus/sr), vignet-prompt, 0 % en 100 % |
| **D4 — kaart en kosten** | Kaart-eerst op mobiel (`order`), routeblad, kaartkleuren/markers/legenda/popup, statrij; kosten als kasboek, brandstofkaart, tankstrategie | components.css, pages.css | groot | K1–K9 (slepen, zoomen, resize, popup-positie op 375 en 1280, lege kaart, handmatig na "geen dienst"), C1–C6 (live herrender met caret) |
| **D5 — regels, document, onderweg, reizen, reiservaring, dialogen, print** | Fotokaart + landkiezer, oordeelkaart, regelrijen; document als papier; onderweg-secties; reiskaarten met verhaallijn; scrollytelling-kleuren (CSS op de pijl); incident- en meldblad; grensbanner; print.css bijwerken; één gegenereerde pagina nl/en nalopen | pages.css, print.css, pages.js (één regel: hero-inline-style) | groot | R1–R6, P1–P3, O1–O4, M1–M4, J1–J4, G13–G18, G21, G24 |
| **D6 — donker, toegankelijkheid, opruimen** | Dark-mode-pass over alle schermen; contrastaudit opnieuw; 44 px-audit; toetsenbord door alle flows; reduced-motion check; layout-shift check (fonts `font-display:swap` → overweeg `optional` voor de body-font); dead CSS weg; README §Vormgeving herschrijven (beschrijft nu nog het v1-roadbook); CACHE bump | alle css, README.md, sw.js | middel | volledige inventaris, alle vier de standen |
| **D7 — optioneel, na aparte ja** | (a) drukte-kalender als nieuw scherm; (b) popup als onderblad op mobiel; (c) tikbare milieuchips; (d) Geist 800 ophalen | calendar.js, app.js (VIEW_ORDER, RENDERS), index.html (view + nav), i18n.js, map.js, planner.js, fonts | middel | nieuwe rijen in §1 |

Volgorde-argument: D0 en D1 raken alles maar verplaatsen niets, dus een fout valt meteen op en
is in één bestand terug te draaien. D2–D5 zijn per scherm en onafhankelijk van elkaar; ze kunnen
desnoods in een andere volgorde of met een pauze ertussen. D6 is de enige fase die een bestaand
bestand buiten css/ herschrijft (README).

---

## 9. Aanbeveling

**Richting A, "Stil roadbook", met statusoptie 1.**

Drie redenen die zwaarder wegen dan smaak:

1. **Het beantwoordt de kernvraag zonder compromis.** Terracotta krijgt één betekenis (druk
   hier), de statusschaal is volledig zonder oranje, en de meest voorkomende status is de
   rustigste. Optie 2 laat verplicht en verboden samenvallen (gemeten 1,13:1 tussen de twee
   AA-conforme tinten); optie 3 laat oranje en amber samenvallen voor 6 % van de mannelijke
   gebruikers. Er is geen versie van "oranje in de statusschaal" die de test doorstaat.
2. **Het is de richting met de kleinste JS-voetafdruk voor de grootste visuele stap.** Vrijwel
   alles is CSS op bestaande klassen; de vier JS-aanrakingen (kop-helper, verhaallijn-km's,
   één hero-regel, CSS op een SVG-path) veranderen geen gedrag. Richting B zou de duurste render
   van de app naar het drukste scherm verplaatsen en twee scrollmodellen laten botsen.
3. **Het past bij wat de app belooft.** "Mag ik dit land in met deze auto" is een vraag aan een
   deskundige, niet aan een dashboard. Rustig, zeker, warm — en de ene knop is niet te missen.

Wat je inlevert: de speelsheid van Hopper. Wat je terugkrijgt: een checklist waarin de ene
blokkade en het ene onzekere feit eruit springen omdat al het andere zwijgt.

---

## 10. Open vragen (graag beantwoorden vóór fase D0)

1. **Drukte-kalender** — nieuw scherm bouwen (D7a, nieuw JS) of buiten scope?
2. **blendedtech-screenshot** — alsnog aanleveren, of is de beschrijving genoeg?
3. **Geist 800** — voor de hero ophalen via `tools/build-fonts.ps1` (D7d), of 700 volstaat?
4. **Tweekleurige koppen via i18n-markers** (`¦` in tien strings, nl en en, plus een helper van
   ~8 regels) — akkoord met die JS-aanraking? Zonder markers blijven koppen eenkleurig; de rest
   van het ontwerp staat er los van.
5. **Popup als onderblad op mobiel** — nu meenemen (kleine JS in `positioneerPopup`) of pas in
   D7b? Mijn voorstel: D7b.
6. **README §Vormgeving** herschrijven in D6 (beschrijft nu het v1-roadbook, niet Kinetic Route
   en straks niet dit) — ja?
7. **Dode CSS** (§7 R17) opruimen in D6 — ja, of laten staan?
8. **Desktopnavigatie** — vaste zijbalk houden (mijn voorstel, minste risico) of naar een
   topnavigatie?

Na je antwoord op de richting en op vraag 1 en 4 kan D0 beginnen. Tot dan verander ik niets.
