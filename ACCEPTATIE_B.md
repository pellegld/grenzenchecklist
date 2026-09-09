# ACCEPTATIE_B.md — de twaalf punten van §32, nagelopen

Nagelopen op 2 september 2026, tegen `http://localhost:8732`, in een browser op
375 × 812 (iPhone-formaat), met een leeggemaakte `localStorage` — dus als iemand die de
app nooit eerder opende.

Dit document doet twee dingen. Het eerste deel is wat er te bewijzen viel zonder mensen:
werkt elk van de twaalf punten, en waar breekt het. Het tweede deel is de rand van dat
bewijs: welke van de twaalf punten alleen een echte testpersoon kan afvinken, en waarom
het antwoord van de bouwer daar niets waard is.

---

## 0. Wat hier níet in staat

Criterium B eindigt met: *"Test dit met drie echte mensen, niet met jezelf."*

Die drie sessies hebben niet plaatsgevonden. Ik kan geen testpersonen werven, dus dat
deel van B is **niet afgerond** — en daarmee is B als geheel niet afgerond, hoe de tabel
hieronder ook uitpakt. Het protocol voor die drie sessies staat in
`docs/GEBRUIKERSTEST_B.md`; het is geschreven om zonder voorbereiding uitgevoerd te
worden.

De reden dat mijn eigen doorloop punt 1 en punt 2 niet kan afvinken is niet
bescheidenheid. Ik weet waar de knop zit. Ik weet wat een euronorm is. Ik weet dat
"kenteken uit" het land van je nummerplaat bedoelt en niet je bestemming. Precies die
drie dingen zijn wat er getest moet worden, en ik ben de enige die ze niet kan testen.

---

## 1. De twaalf punten

| # | §32 | oordeel | waarop |
|---|---|---|---|
| 1 | homepage begrijpen zonder uitleg | **mensen nodig** | structuur staat er, begrip is niet aantoonbaar |
| 2 | binnen 2 minuten een reis invoeren | **mensen nodig** | machinetijd 5,7 s; de rest is menstijd |
| 3 | een persoonlijke checklist krijgen | **ja** | 11 acties, toegesneden op NL-kenteken, benzine, Utrecht → Salzburg |
| 4 | direct zien wat eerst moet | **ja, met één mits** | groepen "Eerst oplossen / Voor vertrek / In de auto"; zie §3a |
| 5 | zien waarom een actie relevant is | **ja** | elke regel draagt "omdat je route 14 km door Oostenrijk loopt" plus "Waarom zie ik dit?" |
| 6 | officiële bronnen openen | **ja** | 17 bronlinks op de actiepagina, o.a. asfinag.at, adac.de |
| 7 | kosten bekijken | **ja** | Kosten-pagina met per post een herkomst, en een expliciete "wat er niet in zit" |
| 8 | route op een kaart bekijken | **ja, schematisch** | SVG-schets met landen en zones; geen kaarttegels |
| 9 | een reisdocument maken | **ja** | printpagina met bron-URL's voluit, zwart-wit |
| 10 | de reis delen | **ja, end-to-end bewezen** | zie §2 |
| 11 | goed op mobiel | **grotendeels** | geen horizontale overloop; drie mankementen, zie §3 |
| 12 | niet kapot bij een falende API | **ja, end-to-end bewezen** | zie §2 |

---

## 2. De twee die het overtuigendst bewezen zijn

**Punt 10, delen.** `deelURL(TRIP)` levert een link van 290 tekens waar de hele reis in
zit — geen server, geen account. Ik heb hem gekopieerd, `localStorage` leeggegooid en de
link geopend. De app bouwde Utrecht → Salzburg opnieuw op, landde op het dashboard met
dezelfde elf acties, en veegde de reis-parameter uit de adresbalk. Dat is de hele lus,
niet alleen de knop.

**Punt 12, een falende API.** Twee keer getest, met twee verschillende uitkomsten die
allebei goed zijn.

*Vanzelf gebeurd:* de proxy bestaat niet op de dev-server. `GET /api/route?ping=1` gaf
404, de keten viel door naar `router.project-osrm.org`, en de gebruiker heeft niets
gemerkt — 935 km, 9u15, elf acties. Zo hoort een keten te werken.

*Expres kapotgemaakt:* ik heb `fetch` naar OSRM, Nominatim en `/api/` laten afwijzen en
Amsterdam → Milaan geprobeerd. De app zei: *"Geen van de routediensten reageerde. Dat
ligt niet aan jou en niet aan je reis."* Daarna: landen zelf kiezen, met er expliciet bij
wat je dan mist ("de afstand, de reistijd, de kilometertol en de kaartschets"). Ik koos
NL, DE, CH, IT en kreeg negen acties — en de motivering was meegegroeid: *"omdat je
Duitsland zelf aan je route hebt toegevoegd"*, niet "omdat je route erdoor loopt". Dat
laatste is het verschil tussen een terugval en een leugen.

Eén smet: als de route mislukt springen alle vijf de stappen op "mislukt", ook
"Voertuig controleren", die nooit gedraaid heeft. Er is niets misgegaan met het
voertuig. Vier van de vijf regels zeggen iets onwaars over zichzelf.

---

## 3. Wat er stuk was — a tot en met e zijn gerepareerd

Hieronder staat wat de doorloop vond, met per punt wat eraan gedaan is.
a tot en met e zijn verholpen en opnieuw nagelopen; f is een afweging gebleven.

**a. De vertrekdatum staat op vandaag.** Wie doorklikt zonder de datum aan te raken
krijgt een lijst waarin élke actie "Dit had al geregeld moeten zijn" draagt, in het rood.
Nul procent, elf acties, alles te laat. Zet je de datum op 10 oktober, dan differentieert
de deadline-motor keurig — "uiterlijk 22 september" voor het vignet, "uiterlijk 26
september" voor de milieusticker, "uiterlijk 10 oktober" voor de dashcam. De motor
deugt; de standaardwaarde ondermijnt hem. Dit raakt punt 4 rechtstreeks: als alles rood
is, is niets meer het eerst.

> **Gerepareerd.** `legeTrip()` begint met `departureDate: null`, `leesTrip()` en
> `tripUitPayload()` vullen niet langer vandaag in, en stap 2 van de wizard laat je pas
> door met een datum (`wizKlaarVoorVolgende`). De hint bij het veld zegt waaróm.
> Alles wat de datum leest verdroeg null al — `deadlineVoor`, `seasonActive` en
> `voertuigSamenvatting` laten hem dan gewoon weg. Nagelopen: Utrecht → Salzburg met
> 10 oktober levert "uiterlijk 22 september" en "uiterlijk 26 september" in plaats van
> elf keer rood. Amsterdam → Milaan op 5 november levert nu ook de winterbandenregel
> voor Duitsland, die met een datum van vandaag nooit betrouwbaar verscheen.

**b. Twee voertuigopties die hetzelfde lijken.** In stap 3 staat:

```
auto       → Personenauto
caravan    → Auto met caravan
aanhanger  → Met aanhanger of caravan
camper     → Camper
```

Optie 2 en 3 noemen allebei een caravan. Iemand met een caravan kan hier niet kiezen
zonder te gokken, en dit is precies de invoer waarop de checklist zijn gewichts- en
snelheidsregels baseert.

> **Gerepareerd.** De keuze zonder verschil is weg: `voertuigDataType()` vertaalde
> `caravan` toch al naar `aanhanger`, dus de lijst biedt nog drie opties, met
> "Auto met aanhanger of caravan" als enige aanhangerkeuze. `voertuigTypeVoorKeuze()`
> (`js/vehicle.js`) zorgt dat een opgeslagen reis of een deellink met de oude waarde
> `caravan` in beide keuzelijsten gewoon de goede optie oplicht in plaats van terug te
> vallen op personenauto. Nagelopen met een reis van vóór de wijziging: wizard en
> kaartpagina kiezen allebei "aanhanger", en de regels blijven dezelfde.

**c. De noodknop ligt over de tekst.** `#btn-incident` (`.sosbutton`, aria-label "Nood
onderweg") staat rechtsonder vast op elk scherm — ook op de homepage van iemand die nog
geen reis heeft, en ook in de wizard. Op 375 px overlapt hij op het dashboard de chip
"Regel dit uiterlijk 22 september 2026"; het jaartal valt eronder weg. Op de homepage
dekt hij de rechterhelft van "Geschatte kosten €155–€180" af.

> **Gerepareerd**, in twee delen. `verversSosKnop()` (`js/incident.js`) verbergt de knop
> op de homepage en in de wizard: daar is nog geen reis, geen land en geen alarmnummer om
> te tonen. En `body.met-sos` geeft de pagina 148 px onderruimte in plaats van 84, zodat
> de laatste regel niet meer onder de knop eindigt. Er was nog een addertje: `.sosbutton`
> zet `display:flex`, en dat wint van de `[hidden]`-regel van de browser — het attribuut
> stond dus goed terwijl de knop bleef staan. `.sosbutton[hidden]{display:none}` erbij.
> Nagelopen op 375 px en op desktop: geen element overlapt hem meer onderaan de pagina.
> Wat blijft: halverwege een lange lijst zweeft hij nog over de rechterrand, zoals elke
> zwevende knop dat doet.

**d. Kaartpagina toont lege velden na de wizard.** `verversFormulier()` (`js/app.js:82`)
vult `#from` en `#to` bij het opstarten en bij een reiswissel, maar de wizardvelden
`wiz-from` / `wiz-to` schrijven `TRIP.origin` weg langs een andere weg en roepen hem niet
aan. Loop de wizard af en ga naar Kaart: twee lege zoekvelden en een knop "Route
berekenen", terwijl de reis er wel degelijk is. Na een herlaadbeurt klopt het weer.

> **Gerepareerd.** `wizardWaarWire()` roept `verversFormulier()` aan zodra er een plaats
> gekozen wordt. Nagelopen: direct na het kiezen in de wizard staan `#from` en `#to` op
> "Utrecht" en "Salzburg", zonder herlaadbeurt.

**e. Stapnamen afgekapt.** De voortgangsbalk van de wizard toont `1 Waarh… 2 3 4`. Alleen
de actieve stap heeft een naam, en die naam past niet. Je weet niet hoeveel stappen er
nog komen of waarover ze gaan — wat op punt 2 drukt, omdat iemand die niet weet hoe lang
iets duurt eerder afhaakt.

> **Gerepareerd.** De oorzaak zat in `flex:1 1 0` op elke stap: de actieve stap kreeg een
> kwart van de balk, waarvan 26 px aan de bol opging. De bollen krijgen nu hun eigen
> breedte (`flex:0 0 auto`) en de actieve stap de rest. Nagelopen op 375 px: er staat
> `✓ 2 Wanneer 3 4`, met een hele stapnaam.

**f. Kleine raakvlakken.** Zeven bedienbare elementen zijn lager dan 40 px: "wijzig"
(37 × 24), "Deel deze reis" (107 × 24), "Nog 4 acties bekijken" (135 × 24). Ze halen de
WCAG-ondergrens van 24 px, maar niet de 44 px die iOS aanraadt. Geen blokkade, wel
precies het soort ding waar een testpersoon met grote duimen op stukloopt.

Geen horizontale overloop op 375 px. Lichte en donkere modus zijn allebei leesbaar.

---

## 4. Het tijdbudget van punt 2

Gemeten, van de tik op "Plan mijn reis" tot de checklist op het scherm, met de
tussenliggende menshandelingen weggeautomatiseerd:

```
wizard opent            3 ms
route berekenen      1001 ms   (OSRM, lokaal netwerk)
dashboard tekent        9 ms
totaal machinetijd   5748 ms
```

De app kost dus ongeveer zes seconden van de honderdtwintig. De overige honderdveertien
gaan op aan lezen, typen en tikken:

* **10 tikken** minimaal — Plan mijn reis · veld VAN · suggestie · veld NAAR · suggestie ·
  Verder naar de datum · Verder naar je auto · Verder naar de analyse · Analyseer mijn
  reis · Bekijk je reis;
* **15 aanslagen** ("Utrecht", "Salzburg");
* plus, voor wie het echt invult, de datumkiezer en de drie keuzelijsten in stap 3.

Twee van die tien tikken bevestigen alleen: stap 4 toont de reis nog eens en vraagt
"Analyseer mijn reis", en na de analyse vraagt hij "Bekijk je reis". Dat zijn twee
schermen waar niets te beslissen valt.

Het is haalbaar. Maar de homepage belooft *"Controleer in één minuut"* — één, niet twee —
en die belofte hangt volledig aan wat een vreemde doet bij "KENTEKEN UIT" en "EURONORM".
Dat is niet te meten door iemand die het antwoord al weet.

---

## 5. Wat er nog moet gebeuren voordat B afgerond is

1. ~~a tot en met e repareren~~ — gedaan, en per punt opnieuw nagelopen. Wat na de
   reparaties nog eens end-to-end bevestigd is: de deellink (reis wordt volledig
   herbouwd, datum en oude voertuigwaarde overleven het), de terugval bij een falende
   routedienst (handmatige landenkeuze levert nog steeds een volledige checklist), geen
   horizontale overloop op 375 px, en geen andere consolefouten dan de twee bekende
   404's van de dataproxy;
2. de drie sessies uitvoeren volgens `docs/GEBRUIKERSTEST_B.md`;
3. per punt 1, 2 en 11 noteren wat er echt gebeurde, niet wat er hoorde te gebeuren.

Let op: stap 2 van de wizard vraagt nu een vertrekdatum, en dat is één tik extra in het
tijdbudget van punt 2. Dat is een bewuste ruil — een lijst die klopt boven een lijst die
snel is — maar het is wel precies het soort ruil waar de drie sessies over gaan.

Slaagt punt 2 bij twee van de drie, dan is dat geen 66 % — dan is het één op de drie
mensen die je app niet aankan. De drempel voor B is drie van de drie.
