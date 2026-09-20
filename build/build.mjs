#!/usr/bin/env node
/* Build-pipeline voor Grenschecklist.
 *
 * Vier taken, alle vier zonder dependencies:
 *
 *   node build/build.mjs             genereert statische pagina's uit countries.json en zones.json
 *   node build/build.mjs --sw        ververst de ASSETS-lijst in sw.js
 *   node build/build.mjs --versie    schrijft meta/version.json bij
 *   node build/build.mjs --alles     alle drie hierboven, in die volgorde
 *
 * Fase E van de roadmap: vindbaarheid. Elke gegenereerde pagina komt rechtstreeks
 * uit countries.json, zones.json of meta/changelog.json — er staat hier geen
 * met de hand geschreven zin over een land of een zone. Dat is geen stijlkeuze:
 * een hand-geschreven pagina veroudert los van de data, en binnen een jaar staat
 * er onjuiste informatie op de vindbaarste pagina's van de site. Verander je een
 * vignetprijs in countries.json en draai je de build opnieuw, dan verandert de
 * bijbehorende pagina vanzelf mee.
 *
 * Elke contentpagina bestaat twee keer: /<slug>/ (Nederlands) en /en/<slug>/
 * (Engels). Vertaald is de STRUCTUUR — titels, koppen, vraag-labels, knoppen,
 * formulierlabels — niet de regeldata zelf. `note`, `rule`, `howToGet`,
 * `fineIndication` en de quirks in countries.json/zones.json zijn en blijven
 * Nederlands, met dezelfde eerlijke disclaimer die de app al toont in EN-modus
 * (js/i18n.js, "taal.dataNotitie"): een halfvertaalde regelpagina — een
 * boetebedrag of een euronorm-drempel die machinaal verkeerd vertaald is — is
 * gevaarlijker dan een Nederlandse. Landnamen en stadsnamen zijn wél vertaald
 * (EN_COUNTRY_NAME/EN_CITY_NAME hieronder): dat is geografie, geen regelgeving,
 * en het risico op een foute vertaling van "Duitsland" naar "Germany" is nul.
 *
 * De app zelf blijft vanilla en buildloos: index.html werkt zonder dat dit
 * script ooit gedraaid heeft. Deze pipeline maakt alleen extra, losse bestanden.
 *
 * SITE_URL hieronder is een placeholder. Absolute URL's (canonical, Open Graph,
 * sitemap.xml, feed.xml) hebben een echt domein nodig — dat kunnen wij niet
 * raden. Zet de omgevingsvariabele SITE_URL vóór het publiceren, bijvoorbeeld:
 *   SITE_URL=https://grenschecklist.example npm run build
 * Zolang dat niet gebeurt bouwt de site prima door, met een placeholder die
 * zichzelf duidelijk verraadt in plaats van een geraden domein dat toevallig
 * bestaat. */

import { readFile, writeFile, mkdir, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const p = (...delen) => path.join(ROOT, ...delen);

const SITE_URL = (process.env.SITE_URL || "https://JOUW-DOMEIN-HIER.example").replace(/\/+$/, "");
const SITE_URL_IS_PLACEHOLDER = !process.env.SITE_URL;

/* ---------------------------------------------------------------- helpers */

const slugify = (s) =>
  String(s)
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

const esc = (s) =>
  String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const MAANDEN_NL = ["januari", "februari", "maart", "april", "mei", "juni", "juli",
                    "augustus", "september", "oktober", "november", "december"];
const MAANDEN_EN = ["January", "February", "March", "April", "May", "June", "July",
                    "August", "September", "October", "November", "December"];

function fmtDatum(iso, lang){
  const d = String(iso ?? "").split("-");
  if(d.length !== 3) return String(iso ?? "");
  const m = lang === "en" ? MAANDEN_EN : MAANDEN_NL;
  return lang === "en"
    ? `${m[Number(d[1]) - 1]} ${Number(d[2])}, ${d[0]}`
    : `${Number(d[2])} ${m[Number(d[1]) - 1]} ${d[0]}`;
}

/* Alleen ISO-datums (JJJJ-MM-DD) tellen mee voor lastmod/dateModified; alles
   anders is geen datum die een crawler kan gebruiken. */
const isIsoDatum = (s) => /^\d{4}-\d{2}-\d{2}$/.test(String(s ?? ""));

/* ---------------------------------------------------------------- vertaaltabellen
   Alleen structuur: koppen, labels, vraagsjablonen, formuliertekst. Nooit de
   inhoud van note/rule/howToGet/fineIndication/quirks — die blijft Nederlands. */

const EN_COUNTRY_NAME = {
  BE: "Belgium", NL: "Netherlands", DE: "Germany", FR: "France", LU: "Luxembourg",
  AT: "Austria", CH: "Switzerland", IT: "Italy", ES: "Spain", PT: "Portugal",
  HR: "Croatia", SI: "Slovenia", CZ: "Czechia", DK: "Denmark", SE: "Sweden",
  GB: "United Kingdom",
};
const EN_ARTICLE = { NL: "the ", GB: "the " };

function landNaam(land, lang){
  if(lang !== "en") return land.name;
  const naam = EN_COUNTRY_NAME[land.code] || land.name;
  return (EN_ARTICLE[land.code] || "") + naam;
}
function landSlug(land, lang){
  return lang === "en" ? slugify(EN_COUNTRY_NAME[land.code] || land.name) : slugify(land.name);
}

/* Nederlandse stadsnaam -> Engels exoniem. Ontbreekt een stad hier, dan is de
   Nederlandse naam ook de Engelse (Lyon, Stockholm, Verona, ...). */
const EN_CITY_NAME = {
  "Antwerpen": "Antwerp", "Brussel": "Brussels", "Gent": "Ghent",
  "Praag": "Prague", "Berlijn": "Berlin", "Frankfurt am Main": "Frankfurt",
  "Keulen": "Cologne", "Munchen": "Munich",
  "Ruhrgebied (Essen, Duisburg, Bochum)": "Ruhr area (Essen, Duisburg, Bochum)",
  "Kopenhagen": "Copenhagen", "Parijs": "Paris", "Straatsburg": "Strasbourg",
  "Londen": "London", "Milaan": "Milan", "Turijn": "Turin", "Den Haag": "The Hague",
  "Lissabon": "Lisbon", "Saint-Etienne": "Saint-Étienne",
};
function stadNaam(city, lang){
  return lang === "en" ? (EN_CITY_NAME[city] || city) : city;
}

/* Onderwerp-woorden in de URL. Vaste, kleine vertaling van de route-structuur
   zelf, niet van regelgeving — hetzelfde soort risico als een landnaam. */
const TOPIC = {
  autorijden: { nl: "autorijden", en: "driving" },
  vignet: { nl: "vignet", en: "vignette" },
  milieuzones: { nl: "milieuzones", en: "environmental-zones" },
  tol: { nl: "tol", en: "toll" },
  milieuzone: { nl: "milieuzone", en: "environmental-zone" },
  magIk: { nl: "mag-ik", en: "en/can-i-drive-to" },
  wijzigingen: { nl: "wijzigingen", en: "en/changes" },
};

/* UI-chrome die bij elke pagina hoort — geen regeldata, dus veilig te
   vertalen. Functies waar een waarde ingevuld moet worden, platte strings
   waar dat niet nodig is. */
const L = {
  nl: {
    naarInhoud: "Naar de inhoud",
    terug: "Grenschecklist",
    laatstGecontroleerd: (d) => `Laatst gecontroleerd op ${d}. Regels veranderen; controleer de officiële bron vlak voor vertrek.`,
    wijzigingenLink: "Laatste wijzigingen in deze data →",
    cta: "Check wat jij voor je eigen route moet regelen →",
    bronnenKop: "Bronnen",
    officieleBron: "Officiële bron →",
    confidence: { official: "officieel", verified: "gecontroleerd", uncertain: "onzeker", unavailable: "niet beschikbaar" },
    gecontroleerdOp: (d) => `gecontroleerd op ${d}`,
    dataDisclaimer: null,

    snelheid: "Maximumsnelheden", regenLetOp: "Let op (regen):",
    uitrusting: "Verplichte uitrusting",
    uitrustingVerplicht: "Verplicht op elke rit",
    uitrustingVerplichtUitleg: "Geldt voor iedereen die hier rijdt, ook met een buitenlands kenteken.",
    uitrustingKenteken: "Alleen voor een kenteken uit dit land",
    uitrustingKentekenUitleg: "Staat in de wet, maar wordt bij een buitenlands kenteken niet gehandhaafd — binnen de EU gelden de uitrustingseisen van je eigen land.",
    uitrustingAanbevolen: "Aanbevolen",
    uitrustingAanbevolenUitleg: "Verstandig, maar geen wettelijke plicht en geen boete.",
    verplichtN: (m, a) => `${m} verplicht, ${a} aanbevolen`,

    milieuTol: "Milieuzone en tol",
    milieuzoneKop: "Milieuzone", vignetTolKop: "Vignet en tol",
    hoeKomJeEraan: "Hoe kom je eraan:",
    milieuGeen: "Geen milieuzone in dit land.",
    milieuVereist: "Milieuzone van kracht — controleer de voorwaarden.",
    vignetVerplichtFallback: "Vignet verplicht.",
    geenTolinfo: "Geen vignet- of tolweginfo geregistreerd.",
    tolwegenTemplate: (tarief) => `Tolwegen: circa €${tarief} per km.`,
    milieuKop: { beide: "Milieuzone én vignet", zone: "Milieuzone", vignet: "Vignet verplicht", geen: "Geen milieuzone of vignet" },

    winter: "Winteruitrusting",
    bijzonder: "Bijzondere regels",
    regelN: (n) => `${n} regel${n === 1 ? "" : "s"}`,

    stedenMetEigenZone: "Steden met een eigen zone",
    stedenHint: "De landelijke drempel hierboven is de strengste in het land. Sommige steden zijn soepeler; dat staat op de stadspagina zelf.",

    kilometertol: "Kilometertol", tolpunten: "Tolpunten",
    tariefOnbekend: "tarief onbekend", optioneelLabel: "(optioneel)",

    checkNaarStad: (stad) => `Check of jouw auto naar ${stad} mag →`,
    alleRegelsVoor: (land) => `Alle regels voor ${land} →`,
    bijzonderheden: "Bijzonderheden",

    autorijdenTitel: (land) => `Autorijden in ${land}: regels, uitrusting, milieuzones en tol`,
    autorijdenDesc: (land, d) => `Wat je moet regelen om met de auto naar ${land} te rijden: verplichte uitrusting, milieuzones, vignetten en tol, met de officiële bron per regel. Laatst gecontroleerd op ${d}.`,
    autorijdenLead: (land) => `Verplichte uitrusting, milieuzones, vignetten en tol voor een autorit naar ${land}, rechtstreeks uit dezelfde data als de Grenschecklist-app.`,

    vignetTitel: (land) => `Vignet ${land}: prijs, kopen en boete`,
    vignetDesc: (naam, land, d) => `${naam} in ${land}: hoe je het koopt, wat het kost en wat de boete is zonder vignet. Laatst gecontroleerd op ${d}.`,
    vignetQ1: (land) => `Heb ik een vignet nodig in ${land}?`,
    vignetA1: (naam) => `Ja. ${naam} is verplicht op de snelweg.`,
    vignetQ2: (land) => `Wat kost het vignet voor ${land}?`,
    vignetQ3: (land) => `Hoe koop ik het vignet voor ${land}?`,
    vignetQ4: (land) => `Wat is de boete zonder vignet in ${land}?`,
    vignetA4: (bedrag) => `Boete zonder: ${bedrag}.`,

    milieuzonesTitel: (land) => `Milieuzones in ${land}: mag mijn auto er in?`,
    milieuzonesDesc: (land, d) => `Welke euronorm je nodig hebt voor de milieuzones in ${land}, en wat je moet regelen. Laatst gecontroleerd op ${d}.`,
    milieuzonesQ1: (land) => `Mag mijn auto de milieuzone in ${land} in?`,
    milieuzonesQ2: (land) => `Wat moet ik regelen voor de milieuzone in ${land}?`,
    milieuzonesA2Geen: "Geen aparte handeling nodig als je aan de norm voldoet.",
    drempelGeenKlasse: "Geen euronorm-drempel: dit gaat om snelheidsbeperkingen of dieselverboden, niet om een emissieklasse.",
    drempelDiesel: (n) => `diesel vanaf Euro ${n}`,
    drempelPetrol: (n) => `benzine vanaf Euro ${n}`,

    tolTitel: (land) => `Tol in ${land}: tarieven en tolpunten`,
    tolDesc: (land, d) => `Wat de tolwegen en tolpunten in ${land} ongeveer kosten, met bron en controledatum per bedrag. Laatst gecontroleerd op ${d}.`,
    tolQ: (land) => `Is er tol in ${land}?`,
    tolAMet: (tarief) => `Ja, circa €${tarief} per km op tolwegen.`,
    tolAAlleenPunten: (n) => `Geen algemene kilometertol, maar wel ${n} losse tolpunt${n === 1 ? "" : "en"} (tunnels, passen of bruggen).`,
    tolKmTekst: (tarief) => `Circa €${tarief} per kilometer op tolwegen.`,

    milieuzoneStadTitel: (stad, naam) => `Milieuzone ${stad}: ${naam}`,
    milieuzoneStadDesc: (stad) => `Mag jouw auto de milieuzone in ${stad} in? Bekijk de euronorm-eis en de officiële bron.`,
    milieuzoneStadQ1: (stad) => `Mag ik met mijn auto naar ${stad}?`,
    milieuzoneStadQ2: (stad) => `Welke euronorm heb ik nodig in ${stad}?`,
    zoneGeenDrempel: "Geen euronorm-drempel geregistreerd — mogelijk een toegangsverbod of dagheffing die niet van de euronorm afhangt.",

    magIkTitel: (stad) => `Mag ik met mijn auto naar ${stad}?`,
    magIkDesc: (stad, naam) => `Vul je brandstof en euronorm in en zie meteen of je met jouw auto de milieuzone van ${stad} (${naam}) in mag. Deelbaar via de link.`,
    magIkLeadFallback: (naam) => `Vul je brandstof en euronorm in voor een direct antwoord over ${naam}.`,
    magIkNoscript: (stad, href) => `Deze check heeft JavaScript nodig. Zonder JavaScript vind je de vaste drempels hierboven en op de <a href="${href}">milieuzonepagina van ${esc(stad)}</a>.`,
    formBrandstof: "Brandstof", formEuronorm: "Euronorm", formKenteken: "Kentekenland",
    formWeetNiet: "Weet ik niet", formCheck: "Check",
    fuelOpties: [["petrol", "Benzine"], ["diesel", "Diesel"], ["lpg", "LPG"], ["cng", "CNG (aardgas)"], ["ev", "Elektrisch of waterstof"]],
    euroOpties: [
      ["6", "Euro 6 (vanaf ± 2015)"], ["5", "Euro 5 (± 2011–2014)"], ["4", "Euro 4 (± 2006–2010)"],
      ["3", "Euro 3 (± 2001–2005)"], ["2", "Euro 2 (± 1997–2000)"], ["1", "Euro 1 of ouder"],
    ],
    fuelLabel: { petrol: "benzine", diesel: "diesel", lpg: "lpg", cng: "cng", ev: "elektrisch" },
    antwoordGebaseerdOp: "Antwoord gebaseerd op:",
    kentekenUit: "kenteken uit",
    onbekendeEuronorm: "onbekende euronorm",

    wijzigingenTitel: "Wijzigingen in de regeldata",
    wijzigingenDesc: "Elke inhoudelijke wijziging in de Grenschecklist-data: welk land, welke regel, de oude en de nieuwe waarde, met bron en datum.",
    wijzigingenLead: (n, d) => `${n} wijziging${n === 1 ? "" : "en"} sinds ${d}, nieuwste bovenaan.`,
    wijzigingenLeeg: (d) => `Nog geen gepubliceerde wijzigingen sinds ${d}. Zodra een regel, prijs of drempel verandert, verschijnt dat hier.`,
    bronLabel: "bron",
  },

  en: {
    naarInhoud: "Skip to content",
    terug: "Grenschecklist",
    laatstGecontroleerd: (d) => `Last checked on ${d}. Rules change; check the official source shortly before you leave.`,
    wijzigingenLink: "Latest changes to this data →",
    cta: "Check what you need to arrange for your own route →",
    bronnenKop: "Sources",
    officieleBron: "Official source →",
    confidence: { official: "official", verified: "verified", uncertain: "uncertain", unavailable: "unavailable" },
    gecontroleerdOp: (d) => `checked on ${d}`,
    dataDisclaimer: "The detailed rule text on this page is only available in Dutch — the labels above are translated so you can find and share the right page.",

    snelheid: "Speed limits", regenLetOp: "Watch out (rain):",
    uitrusting: "Mandatory equipment",
    uitrustingVerplicht: "Required on every trip",
    uitrustingVerplichtUitleg: "Applies to everyone driving here, including foreign-registered vehicles.",
    uitrustingKenteken: "Only for a licence plate from this country",
    uitrustingKentekenUitleg: "It's in the law, but not enforced against a foreign licence plate — within the EU, your own country's equipment rules apply to you.",
    uitrustingAanbevolen: "Recommended",
    uitrustingAanbevolenUitleg: "Sensible, but not a legal requirement and no fine.",
    verplichtN: (m, a) => `${m} required, ${a} recommended`,

    milieuTol: "Environmental zone and toll",
    milieuzoneKop: "Environmental zone", vignetTolKop: "Vignette and toll",
    hoeKomJeEraan: "How to get it:",
    milieuGeen: "No environmental zone in this country.",
    milieuVereist: "Environmental zone in force — check the conditions.",
    vignetVerplichtFallback: "Vignette required.",
    geenTolinfo: "No vignette or toll-road information recorded.",
    tolwegenTemplate: (tarief) => `Toll roads: approx. €${tarief} per km.`,
    milieuKop: { beide: "Environmental zone and vignette", zone: "Environmental zone", vignet: "Vignette required", geen: "No environmental zone or vignette" },

    winter: "Winter equipment",
    bijzonder: "Other rules",
    regelN: (n) => `${n} rule${n === 1 ? "" : "s"}`,

    stedenMetEigenZone: "Cities with their own zone",
    stedenHint: "The national threshold above is the strictest in the country. Some cities are more lenient — that's on the city's own page.",

    kilometertol: "Distance-based toll", tolpunten: "Toll points",
    tariefOnbekend: "rate unknown", optioneelLabel: "(optional)",

    checkNaarStad: (stad) => `Check if your car is allowed into ${stad} →`,
    alleRegelsVoor: (land) => `All rules for ${land} →`,
    bijzonderheden: "Details",

    autorijdenTitel: (land) => `Driving in ${land}: rules, equipment, environmental zones and toll`,
    autorijdenDesc: (land, d) => `What you need to arrange to drive to ${land}: mandatory equipment, environmental zones, vignettes and toll, with the official source per rule. Last checked on ${d}.`,
    autorijdenLead: (land) => `Mandatory equipment, environmental zones, vignettes and toll for a drive to ${land}, straight from the same data as the Grenschecklist app.`,

    vignetTitel: (land) => `${land} vignette: price, how to buy it and the fine`,
    vignetDesc: (naam, land, d) => `${naam} in ${land}: how to buy it, what it costs and the fine without one. Last checked on ${d}.`,
    vignetQ1: (land) => `Do I need a vignette in ${land}?`,
    vignetA1: (naam) => `Yes. ${naam} is required on the motorway.`,
    vignetQ2: (land) => `What does the vignette for ${land} cost?`,
    vignetQ3: (land) => `How do I buy the vignette for ${land}?`,
    vignetQ4: (land) => `What's the fine without a vignette in ${land}?`,
    vignetA4: (bedrag) => `Fine without one: ${bedrag}.`,

    milieuzonesTitel: (land) => `Environmental zones in ${land}: can my car enter?`,
    milieuzonesDesc: (land, d) => `Which emission standard you need for the environmental zones in ${land}, and what you need to arrange. Last checked on ${d}.`,
    milieuzonesQ1: (land) => `Can my car enter the environmental zone in ${land}?`,
    milieuzonesQ2: (land) => `What do I need to arrange for the environmental zone in ${land}?`,
    milieuzonesA2Geen: "No separate action needed if your vehicle meets the standard.",
    drempelGeenKlasse: "No emission-standard threshold: this is about speed restrictions or diesel bans, not an emission class.",
    drempelDiesel: (n) => `diesel from Euro ${n}`,
    drempelPetrol: (n) => `petrol from Euro ${n}`,

    tolTitel: (land) => `Toll in ${land}: rates and toll points`,
    tolDesc: (land, d) => `Roughly what the toll roads and toll points in ${land} cost, with a source and check date per amount. Last checked on ${d}.`,
    tolQ: (land) => `Is there toll in ${land}?`,
    tolAMet: (tarief) => `Yes, approx. €${tarief} per km on toll roads.`,
    tolAAlleenPunten: (n) => `No general distance-based toll, but ${n} separate toll point${n === 1 ? "" : "s"} (tunnels, passes or bridges).`,
    tolKmTekst: (tarief) => `Approx. €${tarief} per kilometer on toll roads.`,

    milieuzoneStadTitel: (stad, naam) => `Environmental zone ${stad}: ${naam}`,
    milieuzoneStadDesc: (stad) => `Can your car enter the environmental zone in ${stad}? See the emission-standard requirement and the official source.`,
    milieuzoneStadQ1: (stad) => `Can I drive to ${stad} with my car?`,
    milieuzoneStadQ2: (stad) => `What emission standard do I need in ${stad}?`,
    zoneGeenDrempel: "No emission-standard threshold recorded — possibly an access ban or daily charge that doesn't depend on the emission standard.",

    magIkTitel: (stad) => `Can I drive to ${stad} with my car?`,
    magIkDesc: (stad, naam) => `Enter your fuel type and emission standard to see instantly whether your car is allowed into the ${stad} (${naam}) environmental zone. Shareable via the link.`,
    magIkLeadFallback: (naam) => `Enter your fuel type and emission standard for an instant answer about ${naam}.`,
    magIkNoscript: (stad, href) => `This check needs JavaScript. Without JavaScript, you'll find the fixed thresholds above and on the <a href="${href}">${esc(stad)} environmental-zone page</a>.`,
    formBrandstof: "Fuel", formEuronorm: "Emission standard", formKenteken: "Country of registration",
    formWeetNiet: "I don't know", formCheck: "Check",
    fuelOpties: [["petrol", "Petrol"], ["diesel", "Diesel"], ["lpg", "LPG"], ["cng", "CNG (natural gas)"], ["ev", "Electric or hydrogen"]],
    euroOpties: [
      ["6", "Euro 6 (from ± 2015)"], ["5", "Euro 5 (± 2011–2014)"], ["4", "Euro 4 (± 2006–2010)"],
      ["3", "Euro 3 (± 2001–2005)"], ["2", "Euro 2 (± 1997–2000)"], ["1", "Euro 1 or older"],
    ],
    fuelLabel: { petrol: "petrol", diesel: "diesel", lpg: "lpg", cng: "cng", ev: "electric" },
    antwoordGebaseerdOp: "Answer based on:",
    kentekenUit: "registered in",
    onbekendeEuronorm: "unknown emission standard",

    wijzigingenTitel: "Changes to the rule data",
    wijzigingenDesc: "Every substantive change to the Grenschecklist data: which country, which rule, the old and new value, with source and date.",
    wijzigingenLead: (n, d) => `${n} change${n === 1 ? "" : "s"} since ${d}, newest first.`,
    wijzigingenLeeg: (d) => `No published changes yet since ${d}. As soon as a rule, price or threshold changes, it will appear here.`,
    bronLabel: "source",
  },
};

/* Eén stabiele, leesbare stadsslug per zone, per taal. Botsen twee zones op
   dezelfde stad (Milaan/Milan heeft zowel een milieuzone als een aparte
   tolzone), dan krijgt de tweede het onderscheidende deel van zijn eigen naam
   erbij — afgeleid uit de data, niet uit een met de hand bijgehouden lijst. */
function stadSlugKaart(zones, lang){
  const gebruikt = new Set();
  const kaart = new Map();
  zones.forEach((z) => {
    const naam = stadNaam(z.city, lang);
    let basis = slugify(naam);
    if(gebruikt.has(basis)){
      let extra = slugify(String(z.name || "").split(z.city).join("").trim());
      if(!extra) extra = slugify(String(z.id || "").replace(/^zone\.[a-z]{2}-/, ""));
      let kandidaat = `${basis}-${extra}`, n = 2;
      while(gebruikt.has(kandidaat)){ kandidaat = `${basis}-${extra}-${n}`; n++; }
      basis = kandidaat;
    }
    gebruikt.add(basis);
    kaart.set(z.id, basis);
  });
  return kaart;
}

/* ---------------------------------------------------------------- pagina-shell */

/* Elke gegenereerde pagina deelt hetzelfde stylesheet en dezelfde klassen als
   de app (§E4: geen tweede designsysteem), en werkt zonder JavaScript: alles
   hieronder is platte HTML, en <details> klapt open/dicht zonder script. */
function paginaHTML({ slug, lang = "nl", altSlug, titel, beschrijving, inhoud, bronnen = [], geverifieerd, jsonLd, wijzigingenSlug }){
  const t = L[lang];
  const diepte = slug.split("/").length;
  const rel = "../".repeat(diepte);
  const canonical = `${SITE_URL}/${slug}/`;
  const altCanonical = altSlug ? `${SITE_URL}/${altSlug}/` : null;
  const nlCanonical = lang === "en" && altCanonical ? altCanonical : canonical;

  const bronLijst = bronnen.length
    ? `<h2>${esc(t.bronnenKop)}</h2>\n<ul class="bronnenlijst">${bronnen
        .map((b) => `<li><a href="${esc(b.url)}" target="_blank" rel="noopener">${esc(b.label)} <span aria-hidden="true">&rarr;</span></a></li>`)
        .join("")}</ul>`
    : "";
  const controle = geverifieerd
    ? `<p class="hint">${esc(t.laatstGecontroleerd(fmtDatum(geverifieerd, lang)))}</p>`
    : "";
  const disclaimer = t.dataDisclaimer ? `<p class="hint">${esc(t.dataDisclaimer)}</p>` : "";
  const wijzigingen = wijzigingenSlug
    ? `<p class="hint"><a href="${rel}${wijzigingenSlug}/">${esc(t.wijzigingenLink)}</a></p>`
    : "";
  const jsonLdBlok = jsonLd
    ? `<script type="application/ld+json">${JSON.stringify(jsonLd).replace(/</g, "\\u003c")}</script>\n`
    : "";
  const hreflang = altCanonical
    ? `<link rel="alternate" hreflang="nl" href="${esc(lang === "en" ? altCanonical : canonical)}">\n` +
      `<link rel="alternate" hreflang="en" href="${esc(lang === "en" ? canonical : altCanonical)}">\n` +
      `<link rel="alternate" hreflang="x-default" href="${esc(nlCanonical)}">\n`
    : "";

  return `<!DOCTYPE html>
<html lang="${lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="color-scheme" content="light dark">
<meta name="description" content="${esc(beschrijving)}">
<link rel="canonical" href="${esc(canonical)}">
${hreflang}<link rel="alternate" type="application/atom+xml" title="Grenschecklist — wijzigingen" href="${rel}feed.xml">
<meta property="og:type" content="article">
<meta property="og:site_name" content="Grenschecklist">
<meta property="og:locale" content="${lang === "en" ? "en_US" : "nl_NL"}">
<meta property="og:title" content="${esc(titel)}">
<meta property="og:description" content="${esc(beschrijving)}">
<meta property="og:url" content="${esc(canonical)}">
<meta property="og:image" content="${SITE_URL}/og-image.png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<meta name="theme-color" content="#F2EAD7">
<script src="${rel}js/thema-vroeg.js"></script>
<link rel="manifest" href="${rel}manifest.json">
<link rel="icon" href="${rel}favicon.ico" sizes="32x32">
<link rel="icon" href="${rel}favicon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="${rel}icons/apple-touch-icon.png">
<link rel="stylesheet" href="${rel}fonts.css">
<link rel="stylesheet" href="${rel}css/base.css">
<link rel="stylesheet" href="${rel}css/components.css">
<link rel="stylesheet" href="${rel}css/pages.css">
<link rel="stylesheet" href="${rel}css/print.css">
<title>${esc(titel)} — Grenschecklist</title>
${jsonLdBlok}</head>
<body>
<a class="skiplink" href="#hoofd">${esc(t.naarInhoud)}</a>
<main class="view-page" id="hoofd">
<p class="hint"><a href="${rel}">&larr; ${esc(t.terug)}</a></p>
<h1>${esc(titel)}</h1>
${disclaimer}
${inhoud}
${bronLijst}
${controle}
${wijzigingen}
<p><a class="btn primary" href="${rel}#wizard">${esc(t.cta)}</a></p>
</main>
</body>
</html>
`;
}

/* Een uitklapbare sectie — open bij het laden, want dit is een pagina om te
   lezen, niet een dashboard om te scannen. <details> werkt zonder JS. */
function sectie(naam, samenvatting, inhoud){
  if(!inhoud) return "";
  return `<details class="regelsectie" open><summary>` +
    `<span class="sectienaam">${esc(naam)}</span>` +
    (samenvatting ? `<span class="sectiekop">${esc(samenvatting)}</span>` : "") +
    `</summary><div class="sectiebody">${inhoud}</div></details>`;
}

function confidenceChip(confidence, lastVerified, lang){
  const t = L[lang];
  if(!confidence) return "";
  return `<span class="niveau n-${esc(confidence)}">${esc(t.confidence[confidence] || confidence)}</span>` +
    (lastVerified ? `<span class="controledatum">${esc(t.gecontroleerdOp(fmtDatum(lastVerified, lang)))}</span>` : "");
}

/* Bron plus controledatum plus betrouwbaarheidsniveau bij een los feit —
   dezelfde drie dingen die de app bij elke sectie toont (§13, §16). */
function bronRegel(feit, land, lang){
  const t = L[lang];
  if(!feit) return "";
  const bron = feit.sourceUrl || (land && land.sourceUrl);
  const datum = feit.lastVerified || (land && land.lastVerified);
  if(!feit.confidence && !bron) return "";
  return `<p class="bronregel">${confidenceChip(feit.confidence, datum, lang)}` +
    (bron ? ` <a class="bronlink" href="${esc(bron)}" target="_blank" rel="noopener">${esc(t.officieleBron)}</a>` : "") +
    `</p>`;
}

/* ---------------------------------------------------------------- landpagina's */

function speedRij(label, val){
  if(!val) return "";
  return `<div class="speedrow"><div class="speedtext"><span class="slabel">${esc(label)}</span>` +
    `<span class="sval">${esc(val)}</span></div></div>`;
}

function snelheidInhoud(land, lang){
  const t = L[lang];
  const s = land.speedLimits || {}, n = s.normal || {}, wt = s.wet || {};
  const rijen = speedRij(lang === "en" ? "Motorway" : "Snelweg", n.motorway) +
    speedRij(lang === "en" ? "Dual carriageway" : "Autoweg", n.expressway) +
    speedRij(lang === "en" ? "Outside built-up areas" : "Buiten de kom", n.rural) +
    speedRij(lang === "en" ? "Built-up areas" : "Bebouwde kom", n.builtUp);
  if(!rijen) return "";
  const wetTxt = lang === "en"
    ? [wt.motorway && `motorway ${wt.motorway}`, wt.expressway && `dual carriageway ${wt.expressway}`,
       wt.rural && `outside built-up areas ${wt.rural}`].filter(Boolean).join(", ") || wt.note || ""
    : [wt.motorway && `snelweg ${wt.motorway}`, wt.expressway && `autoweg ${wt.expressway}`,
       wt.rural && `buiten de kom ${wt.rural}`].filter(Boolean).join(", ") || wt.note || "";
  const inhoud = rijen +
    (wetTxt ? `<div class="speednote"><b>${esc(t.regenLetOp)}</b> ${esc(wetTxt)}</div>` : "") +
    (s.notes ? `<p class="sectienoot">${esc(s.notes)}</p>` : "") + bronRegel(s, land, lang);
  return sectie(t.snelheid, n.motorway ? `${lang === "en" ? "motorway" : "snelweg"} ${n.motorway}` : "", inhoud);
}

function uitrustingInhoud(land, lang){
  const t = L[lang];
  const items = land.mandatoryEquipment || [];
  if(!items.length) return "";
  const must = items.filter((it) => it.status === "required");
  const kenteken = items.filter((it) => it.status === "registration-country");
  const advies = items.filter((it) => it.status === "recommended");
  const blok = (lijst, kop, uitleg) => !lijst.length ? "" :
    `<h4 class="eqkop">${esc(kop)}</h4><p class="eqtoelichting">${esc(uitleg)}</p>` +
    `<ul class="eqlijst">${lijst.map((it) =>
      `<li><span class="eqnaam">${esc(it.item)}</span>` +
      (it.note ? `<span class="eqnote">${esc(it.note)}</span>` : "") + `</li>`).join("")}</ul>`;
  const inhoud =
    blok(must, t.uitrustingVerplicht, t.uitrustingVerplichtUitleg) +
    blok(kenteken, t.uitrustingKenteken, t.uitrustingKentekenUitleg) +
    blok(advies, t.uitrustingAanbevolen, t.uitrustingAanbevolenUitleg) +
    bronRegel(items[0], land, lang);
  return sectie(t.uitrusting, t.verplichtN(must.length, advies.length), inhoud);
}

function milieuTolInhoud(land, lang){
  const t = L[lang];
  const z = land.environmentalZone || {}, tv = land.tollVignette || {}, tr = land.tollRoads || {};
  const milieuTxt = z.required ? (z.note || z.name || t.milieuVereist) : (z.note || t.milieuGeen);
  const tolTxt = tv.required ? (tv.note || tv.name || t.vignetVerplichtFallback)
    : (tr.perKm ? `${t.tolwegenTemplate(tr.perKm.toFixed(2))}${tr.note ? " " + tr.note : ""}` : t.geenTolinfo);
  const inhoud =
    `<h4 class="eqkop">${esc(t.milieuzoneKop)}</h4><p>${esc(milieuTxt)}</p>` +
    (z.howToGet ? `<p class="hoe"><b>${esc(t.hoeKomJeEraan)}</b> ${esc(z.howToGet)}</p>` : "") +
    bronRegel(z, land, lang) +
    `<h4 class="eqkop">${esc(t.vignetTolKop)}</h4><p>${esc(tolTxt)}</p>` +
    (tv.howToGet ? `<p class="hoe"><b>${esc(t.hoeKomJeEraan)}</b> ${esc(tv.howToGet)}</p>` : "") +
    bronRegel(tv.required ? tv : tr, land, lang);
  const kop = z.required ? (tv.required ? t.milieuKop.beide : t.milieuKop.zone) : (tv.required ? t.milieuKop.vignet : t.milieuKop.geen);
  return sectie(t.milieuTol, kop, inhoud);
}

function winterInhoud(land, lang){
  const t = L[lang];
  const w = land.winterEquipment;
  if(!w || !w.required || w.required === "nee") return "";
  const inhoud = `<p>${esc(w.note || "")}</p>` + bronRegel(w, land, lang);
  return sectie(t.winter, w.period || "", inhoud);
}

function quirkTekst(q){ return typeof q === "string" ? q : (q && q.text) || ""; }

function bijzondereRegelsInhoud(land, lang){
  const t = L[lang];
  const quirks = land.quirks || [];
  if(!quirks.length) return "";
  const inhoud = `<ul class="quirklijst">${quirks.map((q) => {
    const verboden = /verboden/i.test(quirkTekst(q));
    return `<li class="${verboden ? "verbod" : ""}"><span class="teken" aria-hidden="true">${verboden ? "✗" : "i"}</span>` +
      `<span>${esc(quirkTekst(q))}</span></li>`;
  }).join("")}</ul>`;
  return sectie(t.bijzonder, t.regelN(quirks.length), inhoud);
}

/* /autorijden-<land> (en /en/driving-<land>) — alle regels, uitrusting,
   milieuzones en tol in één overzicht. Bestaat voor elk land: elk land in
   countries.json heeft op zijn minst snelheidslimieten of uitrusting om te
   tonen. */
function autorijdenPagina(land, lang){
  const t = L[lang];
  const naam = landNaam(land, lang);
  const titel = t.autorijdenTitel(naam);
  const beschrijving = t.autorijdenDesc(naam, fmtDatum(land.lastVerified, lang));
  const inhoud =
    `<p class="lead">${esc(t.autorijdenLead(naam))}</p>` +
    snelheidInhoud(land, lang) + uitrustingInhoud(land, lang) + milieuTolInhoud(land, lang) +
    winterInhoud(land, lang) + bijzondereRegelsInhoud(land, lang);
  return {
    slug: `${lang === "en" ? "en/" : ""}${TOPIC.autorijden[lang]}-${landSlug(land, lang)}`,
    lang, titel, beschrijving, inhoud,
    bronnen: land.sources || [],
    geverifieerd: land.lastVerified,
    jsonLd: isIsoDatum(land.lastVerified) ? {
      "@context": "https://schema.org", "@type": "Article",
      headline: titel, description: beschrijving, dateModified: land.lastVerified, inLanguage: lang,
    } : null,
  };
}

function faqJsonLd(vragen){
  const mainEntity = vragen.filter((v) => v.a).map((v) => ({
    "@type": "Question", name: v.q,
    acceptedAnswer: { "@type": "Answer", text: v.a },
  }));
  return mainEntity.length ? { "@context": "https://schema.org", "@type": "FAQPage", mainEntity } : null;
}

/* /vignet-<land> (en /en/vignette-<land>) — alleen voor landen met een
   verplicht vignet. */
function vignetPagina(land, lang){
  const t = L[lang];
  const v = land.tollVignette || {};
  if(!v.required) return null;
  const naam = v.name || (lang === "en" ? "The vignette" : "Het vignet");
  const landN = landNaam(land, lang);
  const titel = t.vignetTitel(landN);
  const beschrijving = t.vignetDesc(naam, landN, fmtDatum(land.lastVerified, lang));
  const vragen = [
    { q: t.vignetQ1(landN), a: t.vignetA1(naam) },
    { q: t.vignetQ2(landN), a: v.note || null },
    { q: t.vignetQ3(landN), a: v.howToGet || null },
    { q: t.vignetQ4(landN), a: v.fineIndication ? t.vignetA4(v.fineIndication) : null },
  ];
  const inhoud = vragen.map((vr) => sectie(vr.q, "", vr.a ? `<p>${esc(vr.a)}</p>` : "")).join("") + bronRegel(v, land, lang);
  return {
    slug: `${lang === "en" ? "en/" : ""}${TOPIC.vignet[lang]}-${landSlug(land, lang)}`,
    lang, titel, beschrijving, inhoud,
    bronnen: land.sources || [],
    geverifieerd: land.lastVerified,
    jsonLd: faqJsonLd(vragen),
  };
}

/* /milieuzones-<land> (en /en/environmental-zones-<land>) — alleen voor
   landen met een landelijke milieuzoneplicht. */
function milieuzonesPagina(land, zonesVanLand, stadSlugs, lang){
  const t = L[lang];
  const z = land.environmentalZone || {};
  if(!z.required) return null;
  const landN = landNaam(land, lang);
  const titel = t.milieuzonesTitel(landN);
  const beschrijving = t.milieuzonesDesc(landN, fmtDatum(land.lastVerified, lang));
  const th = z.emissionThreshold;
  const drempelTxt = th
    ? (th.diesel == null && th.petrol == null
        ? t.drempelGeenKlasse
        : [th.diesel != null && t.drempelDiesel(th.diesel), th.petrol != null && t.drempelPetrol(th.petrol)]
            .filter(Boolean).join(", ") + (th.scope ? ` (${th.scope})` : "") + ".")
    : null;
  const vragen = [
    { q: t.milieuzonesQ1(landN), a: drempelTxt || z.note || null },
    { q: t.milieuzonesQ2(landN), a: z.actionRequired && z.actionRequired !== "geen" ? z.howToGet : t.milieuzonesA2Geen },
  ];
  const eigenSlug = `${lang === "en" ? "en/" : ""}${TOPIC.milieuzones[lang]}-${landSlug(land, lang)}`;
  const rel = "../".repeat(eigenSlug.split("/").length);
  const stedenLijst = zonesVanLand.length
    ? `<h2>${esc(t.stedenMetEigenZone)}</h2><ul class="bronnenlijst">${zonesVanLand.map((zn) =>
        `<li><a href="${rel}${lang === "en" ? "en/" : ""}${TOPIC.milieuzone[lang]}-${esc(stadSlugs.get(zn.id))}/">${esc(stadNaam(zn.city, lang))} — ${esc(zn.name)} &rarr;</a></li>`).join("")}</ul>` +
      `<p class="hint">${esc(t.stedenHint)}</p>`
    : "";
  const inhoud = vragen.map((vr) => sectie(vr.q, "", vr.a ? `<p>${esc(vr.a)}</p>` : "")).join("") +
    bronRegel(z, land, lang) + stedenLijst;
  return {
    slug: eigenSlug,
    lang, titel, beschrijving, inhoud,
    bronnen: land.sources || [],
    geverifieerd: land.lastVerified,
    jsonLd: faqJsonLd(vragen),
  };
}

/* /tol-<land> (en /en/toll-<land>) — alleen voor landen met kilometertol of
   losse tolpunten. */
function tolPagina(land, lang){
  const t = L[lang];
  const tr = land.tollRoads, punten = land.tollPoints || [];
  if(!tr && !punten.length) return null;
  const landN = landNaam(land, lang);
  const titel = t.tolTitel(landN);
  const beschrijving = t.tolDesc(landN, fmtDatum(land.lastVerified, lang));
  const kmTekst = tr && tr.perKm
    ? `<p>${esc(t.tolKmTekst(tr.perKm.toFixed(2)))}${tr.note ? " " + esc(tr.note) : ""}</p>${bronRegel(tr, land, lang)}`
    : "";
  const puntenTekst = punten.length
    ? `<ul class="eqlijst">${punten.map((pt) =>
        `<li><span class="eqnaam">${esc(pt.name)}${pt.optional ? " " + esc(t.optioneelLabel) : ""}</span>` +
        `<span class="eqnote">${esc(pt.price || t.tariefOnbekend)}${pt.note ? " — " + esc(pt.note) : ""}</span>` +
        bronRegel(pt, land, lang) + `</li>`).join("")}</ul>`
    : "";
  const vraagA = tr ? t.tolAMet(tr.perKm?.toFixed(2) ?? "?") : (punten.length ? t.tolAAlleenPunten(punten.length) : null);
  const inhoud = sectie(t.tolQ(landN), "", vraagA ? `<p>${esc(vraagA)}</p>` : "") +
    (kmTekst ? sectie(t.kilometertol, "", kmTekst) : "") +
    (puntenTekst ? sectie(t.tolpunten, `${punten.length}`, puntenTekst) : "");
  return {
    slug: `${lang === "en" ? "en/" : ""}${TOPIC.tol[lang]}-${landSlug(land, lang)}`,
    lang, titel, beschrijving, inhoud,
    bronnen: land.sources || [],
    geverifieerd: land.lastVerified,
    jsonLd: faqJsonLd([{ q: t.tolQ(landN), a: vraagA }]),
  };
}

/* ---------------------------------------------------------------- zonepagina's */

/* /milieuzone-<stad> (en /en/environmental-zone-<stad>) — één per zone in
   zones.json. Elke zone draagt een eigen rule/note/threshold, dus er is
   altijd iets om te tonen. */
function milieuzoneStadPagina(zone, land, basis, lang){
  const t = L[lang];
  const stad = stadNaam(zone.city, lang);
  const titel = t.milieuzoneStadTitel(stad, zone.name);
  const beschrijving = t.milieuzoneStadDesc(stad);
  const th = zone.threshold;
  const drempelTxt = th
    ? [th.diesel != null && t.drempelDiesel(th.diesel), th.petrol != null && t.drempelPetrol(th.petrol)]
        .filter(Boolean).join(", ") + "."
    : t.zoneGeenDrempel;
  const vragen = [
    { q: t.milieuzoneStadQ1(stad), a: zone.rule || null },
    { q: t.milieuzoneStadQ2(stad), a: drempelTxt },
  ];
  const eigenSlug = `${lang === "en" ? "en/" : ""}${TOPIC.milieuzone[lang]}-${basis}`;
  const rel = "../".repeat(eigenSlug.split("/").length);
  const magIkSlug = `${TOPIC.magIk[lang]}/${basis}`;
  const inhoud = vragen.map((vr) => sectie(vr.q, "", vr.a ? `<p>${esc(vr.a)}</p>` : "")).join("") +
    (zone.note ? sectie(t.bijzonderheden, "", `<p>${esc(zone.note)}</p>`) : "") +
    bronRegel(zone, land, lang) +
    `<p><a class="btn" href="${rel}${magIkSlug}/">${esc(t.checkNaarStad(stad))}</a></p>` +
    (land ? `<p class="hint"><a href="${rel}${lang === "en" ? "en/" : ""}${TOPIC.autorijden[lang]}-${landSlug(land, lang)}/">${esc(t.alleRegelsVoor(landNaam(land, lang)))}</a></p>` : "");
  return {
    slug: eigenSlug,
    lang, titel, beschrijving, inhoud,
    bronnen: zone.sourceUrl ? [{ label: t.officieleBron.replace(" →", ""), url: zone.sourceUrl }] : [],
    geverifieerd: zone.lastVerified,
    jsonLd: faqJsonLd(vragen),
  };
}

/* ---------------------------------------------------------------- E2: mag-ik/<stad> */

/* De interactieve check-pagina. Geen tweede drempellogica: het resultaat komt
   uit dezelfde zoneStadVerdict() als de app (js/geo.js), hier client-side
   aangeroepen na het laden van i18n.js/util.js/vehicle.js/geo.js — precies de
   scripts die die functie ook in de app nodig heeft, verder niets. Voor de
   Engelse pagina wordt alleen de globale TAAL op "en" gezet vóór de aanroep:
   i18n.js kent de "zoneStad.*"-teksten al in het Engels, dus dat is geen
   nieuwe vertaling maar dezelfde tabel die de app zelf gebruikt.
   De vraag staat als GET-formulier, dus het resultaat zit gewoon in de URL en
   is zonder enige serverlogica te delen (?fuel=diesel&euro=4). */
function magIkPagina(zone, land, basis, lang){
  const t = L[lang];
  const stad = stadNaam(zone.city, lang);
  const eigenSlug = `${TOPIC.magIk[lang]}/${basis}`;
  const titel = t.magIkTitel(stad);
  const beschrijving = t.magIkDesc(stad, zone.name);
  /* De zone en de vertaalde etiketten gaan als JSON-datablok mee; het script
     zelf staat in js/magik-pagina.js. Een inline script zou de
     Content-Security-Policy (netlify.toml) niet doorlaten. */
  const magikJson = JSON.stringify({
    zone: { city: zone.city, name: zone.name, threshold: zone.threshold || null,
            rule: zone.rule || "", note: zone.note || "" },
    lang, fuelLabel: t.fuelLabel, onbekendeEuronorm: t.onbekendeEuronorm,
    antwoordGebaseerdOp: t.antwoordGebaseerdOp, kentekenUit: t.kentekenUit,
  }).replace(/</g, "\\u003c");

  const fuelOpties = t.fuelOpties.map(([v, l]) => `<option value="${v}">${esc(l)}</option>`).join("");
  const euroOpties = `<option value="">${esc(t.formWeetNiet)}</option>` +
    t.euroOpties.map(([v, l]) => `<option value="${v}">${esc(l)}</option>`).join("");
  const kentekenOpties = Object.keys(EN_COUNTRY_NAME)
    .map((code) => `<option value="${code}">${esc(lang === "en" ? EN_COUNTRY_NAME[code] : (BY_CODE_NAMEN[code] || EN_COUNTRY_NAME[code]))}</option>`)
    .join("");

  const form = `
<form method="get" id="check-form" class="wizveld raster">
  <label class="field"><span>${esc(t.formBrandstof)}</span>
    <select name="fuel" id="f-fuel">${fuelOpties}</select>
  </label>
  <label class="field"><span>${esc(t.formEuronorm)}</span>
    <select name="euro" id="f-euro">${euroOpties}</select>
  </label>
  <label class="field"><span>${esc(t.formKenteken)}</span>
    <select name="plate" id="f-plate">${kentekenOpties}</select>
  </label>
  <button type="submit" class="btn primary">${esc(t.formCheck)}</button>
</form>`;

  const rel = "../".repeat(eigenSlug.split("/").length);
  const zoneStadHref = `${rel}${lang === "en" ? "en/" : ""}${TOPIC.milieuzone[lang]}-${basis}/`;

  const inhoud = `
<p class="lead">${zone.rule ? esc(zone.rule) : esc(t.magIkLeadFallback(zone.name))}</p>
${form}
<div id="check-result" hidden></div>
<noscript><p class="hint">${t.magIkNoscript(stad, zoneStadHref)}</p></noscript>
<script type="application/json" id="magik-data">${magikJson}</script>
<script src="${rel}js/i18n.js"></script>
<script src="${rel}js/util.js"></script>
<script src="${rel}js/vehicle.js"></script>
<script src="${rel}js/geo.js"></script>
<script src="${rel}js/magik-pagina.js"></script>`;

  return {
    slug: eigenSlug,
    lang, titel, beschrijving, inhoud,
    bronnen: zone.sourceUrl ? [{ label: t.officieleBron.replace(" →", ""), url: zone.sourceUrl }] : [],
    geverifieerd: zone.lastVerified,
    jsonLd: null,
  };
}

/* Kentekenlandnamen in het Nederlands, voor de EN-paginakeuzelijst zodat een
   Nederlandse gebruiker die per ongeluk op /en/ terechtkomt zijn eigen land
   nog herkent — puur een leesbaarheidskeuze, geen aparte vertaaltabel: hij
   leent dezelfde 16 landcodes als EN_COUNTRY_NAME. */
const BY_CODE_NAMEN = {};

/* ---------------------------------------------------------------- E3: wijzigingen + feed */

function wijzigingenRegelHTML(w, byCode, lang){
  const t = L[lang];
  const land = w.land ? byCode.get(w.land) : null;
  const waarden = [];
  if(w.oud != null) waarden.push(esc(w.oud));
  if(w.oud != null && w.nieuw != null) waarden.push("&rarr;");
  if(w.nieuw != null) waarden.push(esc(w.nieuw));
  return `<li class="wijzigingregel"><div class="wijzigingtekst">` +
    `<b>${land ? esc(land.name) + " — " : ""}${esc(w.onderwerp)}</b>` +
    (waarden.length ? `<span class="wijzigingwaarden">${waarden.join(" ")}</span>` : "") +
    `<span class="wijzigingmeta">${esc(fmtDatum(w.datum, lang))}` +
    (w.bron ? ` · <a href="${esc(w.bron)}" target="_blank" rel="noopener">${esc(t.bronLabel)}</a>` : "") +
    `</span></div></li>`;
}

function wijzigingenPagina(changelog, byCode, lang){
  const t = L[lang];
  const rijen = [...changelog.wijzigingen].sort((a, b) => (a.datum < b.datum ? 1 : -1));
  const titel = t.wijzigingenTitel;
  const beschrijving = t.wijzigingenDesc;
  const d = fmtDatum(changelog.meta.bijgehoudenSinds, lang);
  const inhoud = rijen.length
    ? `<p class="lead">${esc(t.wijzigingenLead(rijen.length, d))}</p>` +
      `<ul class="wijzigingenlijst">${rijen.map((w) => wijzigingenRegelHTML(w, byCode, lang)).join("")}</ul>`
    : `<p class="lead">${esc(t.wijzigingenLeeg(d))}</p>`;
  return {
    slug: TOPIC.wijzigingen[lang],
    lang, titel, beschrijving, inhoud,
    bronnen: [], geverifieerd: null, jsonLd: null,
  };
}

function xmlEsc(s){
  return String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/'/g, "&apos;").replace(/"/g, "&quot;");
}

/* Eén feed, geen aparte Engelse versie: de entries zelf (onderwerp/oud/nieuw)
   zijn regeldata en blijven Nederlands (zie het bestandscommentaar hierboven),
   dus een tweede feed met alleen vertaalde titel/subtitle voegt weinig toe.
   /en/changes/ linkt naar dezelfde feed.xml. */
function feedXML(changelog, byCode){
  const rijen = [...changelog.wijzigingen].sort((a, b) => (a.datum < b.datum ? 1 : -1));
  const updated = rijen.length ? rijen[0].datum : changelog.meta.bijgehoudenSinds;
  const entries = rijen.map((w) => {
    const land = w.land ? byCode.get(w.land) : null;
    const id = `${SITE_URL}/wijzigingen/#${slugify(`${w.land || "app"}-${w.onderwerp}-${w.datum}`)}`;
    const title = `${land ? land.name + " — " : ""}${w.onderwerp}`;
    const summary = [w.oud, w.nieuw].filter((x) => x != null).join(" → ") || w.onderwerp;
    return `  <entry>
    <title>${xmlEsc(title)}</title>
    <id>${xmlEsc(id)}</id>
    <updated>${xmlEsc(w.datum)}T00:00:00Z</updated>
    <link href="${xmlEsc(w.bron || `${SITE_URL}/wijzigingen/`)}"/>
    <summary>${xmlEsc(summary)}</summary>
  </entry>`;
  }).join("\n");
  return `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>Grenschecklist — wijzigingen</title>
  <subtitle>Inhoudelijke wijzigingen in de regeldata: land, onderwerp, oude en nieuwe waarde, bron.</subtitle>
  <link href="${xmlEsc(SITE_URL)}/feed.xml" rel="self"/>
  <link href="${xmlEsc(SITE_URL)}/wijzigingen/"/>
  <id>${xmlEsc(SITE_URL)}/feed.xml</id>
  <updated>${xmlEsc(updated)}T00:00:00Z</updated>
${entries}
</feed>
`;
}

/* ---------------------------------------------------------------- sitemap + robots */

function sitemapXML(paginas){
  const urls = [{ slug: "", lastVerified: null }, ...paginas].map(({ slug, lastVerified }) => {
    const loc = `${SITE_URL}/${slug ? slug + "/" : ""}`;
    return `  <url><loc>${xmlEsc(loc)}</loc>${lastVerified && isIsoDatum(lastVerified) ? `<lastmod>${xmlEsc(lastVerified)}</lastmod>` : ""}</url>`;
  }).join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>
`;
}

function robotsTXT(){
  return `User-agent: *
Disallow: /api/
Allow: /

Sitemap: ${SITE_URL}/sitemap.xml
`;
}

/* ---------------------------------------------------------------- orkestratie */

async function schrijfPagina(pagina){
  await mkdir(p(pagina.slug), { recursive: true });
  await writeFile(p(pagina.slug, "index.html"), paginaHTML(pagina), "utf8");
}

/* Genereert dezelfde pagina in beide talen en koppelt ze aan elkaar voor de
   hreflang-tags, zodat elke paginafunctie zelf maar één taal per keer hoeft
   te kennen. `maak(lang)` moet `null` mogen teruggeven (bijvoorbeeld: geen
   vignet in dit land) — dan wordt er voor geen van beide talen iets
   geschreven, want een Engelse pagina zonder Nederlandse tegenhanger zou een
   hreflang-paar breken. */
async function schrijfTweetalig(maak, gemaakt, overgeslagen, overslagReden, metWijzigingenLink = true){
  const nl = maak("nl");
  if(!nl){
    if(overslagReden) overgeslagen.push(overslagReden);
    return;
  }
  const en = maak("en");
  nl.altSlug = en.slug;
  en.altSlug = nl.slug;
  if(metWijzigingenLink){
    nl.wijzigingenSlug = TOPIC.wijzigingen.nl;
    en.wijzigingenSlug = TOPIC.wijzigingen.en;
  }
  await schrijfPagina(nl);
  await schrijfPagina(en);
  gemaakt.push({ slug: nl.slug, soort: nl._soort, lastVerified: nl.geverifieerd });
  gemaakt.push({ slug: en.slug, soort: en._soort, lastVerified: en.geverifieerd });
}

async function bouwPaginas(){
  const data = JSON.parse(await readFile(p("countries.json"), "utf8"));
  const zonesData = JSON.parse(await readFile(p("zones.json"), "utf8"));
  const changelog = JSON.parse(await readFile(p("meta", "changelog.json"), "utf8"));

  const byCode = new Map(data.countries.map((c) => [c.code, c]));
  data.countries.forEach((c) => { BY_CODE_NAMEN[c.code] = c.name; });
  const stadSlugsNl = stadSlugKaart(zonesData.zones, "nl");
  const stadSlugsEn = stadSlugKaart(zonesData.zones, "en");
  const stadSlugsVoor = { nl: stadSlugsNl, en: stadSlugsEn };

  const gemaakt = [];         // { slug, soort, lastVerified }
  const overgeslagen = [];    // { wat, reden }

  for(const land of data.countries){
    await schrijfTweetalig((lang) => {
      const pagina = autorijdenPagina(land, lang);
      pagina._soort = "autorijden";
      return pagina;
    }, gemaakt, overgeslagen, null);

    await schrijfTweetalig((lang) => {
      const pagina = vignetPagina(land, lang);
      if(pagina) pagina._soort = "vignet";
      return pagina;
    }, gemaakt, overgeslagen, { wat: `${TOPIC.vignet.nl}-${landSlug(land, "nl")}`, reden: "geen verplicht vignet" });

    const zonesVanLand = zonesData.zones.filter((z) => z.cc === land.code);
    await schrijfTweetalig((lang) => {
      const pagina = milieuzonesPagina(land, zonesVanLand, stadSlugsVoor[lang], lang);
      if(pagina) pagina._soort = "milieuzones";
      return pagina;
    }, gemaakt, overgeslagen, { wat: `${TOPIC.milieuzones.nl}-${landSlug(land, "nl")}`, reden: "geen landelijke milieuzoneplicht" });

    await schrijfTweetalig((lang) => {
      const pagina = tolPagina(land, lang);
      if(pagina) pagina._soort = "tol";
      return pagina;
    }, gemaakt, overgeslagen, { wat: `${TOPIC.tol.nl}-${landSlug(land, "nl")}`, reden: "geen tolwegen of tolpunten" });
  }

  for(const zone of zonesData.zones){
    if(!zone.rule && !zone.note){
      overgeslagen.push({ wat: `${TOPIC.milieuzone.nl}-${zone.city}`, reden: "geen rule/note in de data" });
      continue;
    }
    const land = byCode.get(zone.cc) || null;

    await schrijfTweetalig((lang) => {
      const basis = stadSlugsVoor[lang].get(zone.id);
      const pagina = milieuzoneStadPagina(zone, land, basis, lang);
      pagina._soort = "milieuzone-stad";
      return pagina;
    }, gemaakt, overgeslagen, null);

    await schrijfTweetalig((lang) => {
      const basis = stadSlugsVoor[lang].get(zone.id);
      const pagina = magIkPagina(zone, land, basis, lang);
      pagina._soort = "mag-ik";
      return pagina;
    }, gemaakt, overgeslagen, null, false);
  }

  await schrijfTweetalig((lang) => {
    const pagina = wijzigingenPagina(changelog, byCode, lang);
    pagina._soort = "wijzigingen";
    return pagina;
  }, gemaakt, overgeslagen, null, false);

  await writeFile(p("feed.xml"), feedXML(changelog, byCode), "utf8");
  await writeFile(p("sitemap.xml"), sitemapXML(gemaakt), "utf8");
  await writeFile(p("robots.txt"), robotsTXT(), "utf8");

  await mkdir(p("meta"), { recursive: true });
  await writeFile(
    p("meta", "build-manifest.json"),
    JSON.stringify({ gegenereerd: new Date().toISOString().slice(0, 10), siteUrl: SITE_URL, paginas: gemaakt, overgeslagen }, null, 2) + "\n",
    "utf8",
  );

  const perSoort = {};
  gemaakt.forEach((g) => { perSoort[g.soort] = (perSoort[g.soort] || 0) + 1; });
  console.log(`${gemaakt.length} pagina's gegenereerd (NL + EN samen):`);
  Object.keys(perSoort).sort().forEach((s) => console.log(`  ${s}: ${perSoort[s]}`));
  if(overgeslagen.length){
    console.log(`${overgeslagen.length} overgeslagen wegens onvoldoende data:`);
    overgeslagen.forEach((o) => console.log(`  ${o.wat} — ${o.reden}`));
  }
  console.log("sitemap.xml, robots.txt en feed.xml geschreven.");
  if(SITE_URL_IS_PLACEHOLDER){
    console.log(
      "Let op: SITE_URL is niet gezet, dus canonical/OG/sitemap/feed wijzen naar " +
      `${SITE_URL} — zet de omgevingsvariabele SITE_URL vóór het publiceren.`,
    );
  }
}

/* ------------------------------------------------------------- versies */

/* meta/version.json is een afgeleide, geen invoer. Met de hand bijhouden zou
   betekenen dat hij precies op het moment dat het uitmaakt — na een
   datacorrectie — nog de vorige waarde heeft. */
async function bouwVersie(){
  const bestanden = ["countries.json", "zones.json", "drukte.json"];
  const data = {};
  for(const naam of bestanden){
    const j = JSON.parse(await readFile(p(naam), "utf8"));
    const meta = j.meta || j._meta || {};
    data[naam] = {
      schemaVersion: meta.schemaVersion ?? null,
      geverifieerd: meta.researchDate || meta.lastVerified || null,
      /* Waar de app op rekent, zodat een leeggelopen bestand opvalt. */
      aantal: Array.isArray(j.countries) ? j.countries.length
            : Array.isArray(j.zones) ? j.zones.length
            : j.dagen ? Object.keys(j.dagen).length
            : null,
    };
  }

  const pkg = JSON.parse(await readFile(p("package.json"), "utf8"));
  const changelog = JSON.parse(await readFile(p("meta", "changelog.json"), "utf8"));

  const versie = {
    app: pkg.version,
    dataApi: "v1",
    gegenereerd: new Date().toISOString().slice(0, 10),
    data,
    wijzigingen: changelog.wijzigingen.length,
    laatsteWijziging: changelog.wijzigingen.length
      ? changelog.wijzigingen[changelog.wijzigingen.length - 1].datum
      : null,
  };

  await mkdir(p("meta"), { recursive: true });
  await writeFile(p("meta", "version.json"), JSON.stringify(versie, null, 2) + "\n", "utf8");
  console.log(`meta/version.json bijgewerkt (app ${versie.app}, ${versie.wijzigingen} wijzigingen).`);
}

/* ------------------------------------------------------- service worker */

/* De ASSETS-lijst in sw.js met de hand bijhouden gaat een keer mis: een nieuw
 * bestand staat dan wel op de server maar niet in de offline cache, en dat merk
 * je pas op een parkeerplaats zonder bereik. Dit leest de mappen uit en schrijft
 * de lijst tussen de twee markeringen opnieuw.
 *
 * De gegenereerde contentpagina's (autorijden-*, vignet-*, ..., mag-ik/*,
 * wijzigingen, en de /en/-tegenhangers) staan hier bewust NIET in: het
 * app-shell precachet voor altijd offline gebruik, maar een contentpagina
 * moet bij het eerstvolgende bezoek ná een databuild gewoon de nieuwe versie
 * kunnen tonen. sw.js zelf regelt dat met een network-first-strategie voor
 * die routes — zie de commentaren daar. */
const SW_MAPPEN = ["css", "js", "fonts", "images/Landbanner"];
const SW_LOSSE = [
  "./", "./index.html", "./fonts.css", "./manifest.json", "./favicon.svg",
  "./countries.json", "./cities.json", "./borders.json", "./zones.json", "./drukte.json",
  "./fuelprices.json", "./meta/changelog.json",
];

async function bestandenIn(map){
  const uit = [];
  for(const naam of (await readdir(p(map), { withFileTypes: true })).sort((a, b) =>
    a.name.localeCompare(b.name),
  )){
    if(naam.isDirectory()) uit.push(...(await bestandenIn(path.posix.join(map, naam.name))));
    else if(!naam.name.startsWith(".")) uit.push(`./${map}/${naam.name}`);
  }
  return uit;
}

async function bouwServiceWorker(){
  const paden = [...SW_LOSSE];
  for(const map of SW_MAPPEN) paden.push(...(await bestandenIn(map)));

  const lijst =
    "var ASSETS = [\n" + paden.map((x) => `  ${JSON.stringify(x)}`).join(",\n") + "\n];";

  const sw = await readFile(p("sw.js"), "utf8");
  const start = sw.indexOf("var ASSETS = [");
  const eind = sw.indexOf("/* EIND-ASSETS */");
  if(start === -1 || eind === -1){
    console.error("sw.js mist de ASSETS-markeringen; niets gewijzigd.");
    process.exitCode = 1;
    return;
  }
  const nieuw = sw.slice(0, start) + lijst + "\n" + sw.slice(eind);

  /* Een nieuwe assetlijst hoort bij een nieuwe cachenaam, anders houdt een
     bezoeker met een warme cache de oude lijst. */
  const versie = nieuw.match(/var CACHE = "grenschecklist-v(\d+)"/);
  const uit =
    versie && nieuw !== sw
      ? nieuw.replace(versie[0], `var CACHE = "grenschecklist-v${Number(versie[1]) + 1}"`)
      : nieuw;

  if(uit === sw){
    console.log("sw.js was al bij: geen wijziging.");
    return;
  }
  await writeFile(p("sw.js"), uit, "utf8");
  console.log(`sw.js bijgewerkt: ${paden.length} bestanden in de offline cache.`);
}

/* ------------------------------------------------------------------ main */

const argumenten = process.argv.slice(2);
if(argumenten.includes("--sw")) await bouwServiceWorker();
else if(argumenten.includes("--versie")) await bouwVersie();
else if(argumenten.includes("--alles")){
  await bouwPaginas();
  await bouwVersie();
  await bouwServiceWorker();
} else await bouwPaginas();
