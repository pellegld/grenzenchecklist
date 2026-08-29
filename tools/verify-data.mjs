#!/usr/bin/env node
/* Controleert de regeldata op alles wat stilzwijgend kan verouderen.
 *
 *   node tools/verify-data.mjs                  alles, inclusief de linkcheck
 *   node tools/verify-data.mjs --geen-netwerk   alleen wat lokaal te zien is
 *   node tools/verify-data.mjs --dagen=365      andere verouderingsdrempel
 *   node tools/verify-data.mjs --json           machineleesbaar, voor een cron
 *
 * Bedoeld om maandelijks te draaien. Het ergste wat deze app kan doen is
 * verouderde verplichtingen tonen alsof ze kloppen; dit is het net eronder.
 *
 * Vier soorten meldingen:
 *
 *   FOUT   structureel mis: ontbrekend of dubbel id, onbekende confidence,
 *          dode bron. Exitcode 1.
 *   OUD    lastVerified ouder dan de drempel. Geen fout — data kan een jaar
 *          kloppen — maar wel het signaal om te gaan kijken.
 *   ONZEKER needsVerification staat aan, of confidence is uncertain. Dit is een
 *          bewuste markering, geen bug; de lijst is er om hem te kunnen slijten.
 *   LET OP  confidence en bron spreken elkaar tegen.
 *
 * Ook: elk id in meta/changelog.json moet naar een bestaand feit wijzen. Een
 * changelog die naar een verdwenen id verwijst, is een changelog die je niet
 * meer kunt tonen — en dat merk je anders pas als de wijzigingenpagina er is.
 *
 * De drempel staat op 180 dagen, strenger dan de 240 dagen waarop de app zelf
 * "verouderd" toont. Dat is met opzet: deze tool moet eerder aan de bel trekken
 * dan de gebruiker het ziet.
 */

import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const args = process.argv.slice(2);
const heeftVlag = (naam) => args.includes(naam);
const vlagWaarde = (naam, standaard) => {
  const gevonden = args.find((a) => a.startsWith(naam + "="));
  return gevonden ? Number(gevonden.slice(naam.length + 1)) : standaard;
};

const DREMPEL_DAGEN = vlagWaarde("--dagen", 180);
const GEEN_NETWERK = heeftVlag("--geen-netwerk");
const ALS_JSON = heeftVlag("--json");
const GELIJKTIJDIG = 6;
const TIJDSLIMIET_MS = 12000;

const CONFIDENCE_NIVEAUS = ["official", "verified", "uncertain", "unavailable"];

/* Sites van de instantie die de regel uitvaardigt of het traject exploiteert.
 * Deze lijst bepaalt niets — de confidence in de data is wat telt — maar hij
 * signaleert wel als die twee uit elkaar lopen, bijvoorbeeld nadat een bron
 * vervangen is door een blogpost. Komt er een land bij, vul hem dan aan. */
const OFFICIEEL = new Set([
  "www.gov.uk", "tfl.gov.uk", "www.certificat-air.gouv.fr", "www.astra.admin.ch",
  "www.dgt.es", "www.praha.eu", "www.lisboa.pt", "www.madrid.es", "www.marseille.fr",
  "www.strasbourg.eu", "www.grandlyon.com", "www.grandreims.fr",
  "www.grenoblealpesmetropole.fr", "www.metropole-rouen-normandie.fr",
  "www.montpellier3m.fr", "www.nicecotedazur.org", "www.saint-etienne-metropole.fr",
  "www.toulouse-metropole.fr", "www.zbe.barcelona", "www.comune.bologna.it",
  "www.comune.fi.it", "www.comune.milano.it", "www.comune.pisa.it",
  "www.comune.torino.it", "www.comune.verona.it", "romamobilita.it",
  "stad.gent", "www.slimnaarantwerpen.be", "lez.brussels",
  "trafik.stockholm", "www.transportstyrelsen.se", "miljoezoner.dk",
  "www.milieuzones.nl",
  "edalnice.cz", "evinjeta.dars.si", "www.evignette.ch", "www.asfinag.at",
  "www.hak.hr", "www.portugaltolls.com", "www.lusoponte.pt", "www.m6toll.co.uk",
  "www.sftrf.fr", "www.tunnelmb.net", "www.tuneldelcadi.com", "www.bina-istra.com",
  "storebaelt.dk", "www.oresundsbron.com", "www.bls.ch", "www.rhb.ch",
  "www.matterhorngotthardbahn.ch", "www.felbertauernstrasse.at",
  "www.grossglockner.at", "www.herrentunnel.de", "www.warnowquerung.de",
  "www.kiltunnel.nl", "www.westerscheldetunnel.nl", "www.liefkenshoektunnel.be",
  "www.leshuttle.com", "www.letunnel.com", "www.leviaducdemillau.com",
]);

/* Overheidsdomeinen die per definitie officieel zijn, zodat de lijst hierboven
 * niet hoeft mee te groeien met elke nieuwe gemeentesite of dienst. */
const OFFICIELE_PATRONEN = [
  /\.gouv\.fr$/, /\.gov\.uk$/, /\.admin\.ch$/, /\.europa\.eu$/,
  /\.gob\.es$/, /\.gov\.pt$/, /\.gv\.at$/, /\.bund\.de$/, /\.overheid\.nl$/,
];

function isOfficieleHost(h) {
  return Boolean(h) && (OFFICIEEL.has(h) || OFFICIELE_PATRONEN.some((p) => p.test(h)));
}

/* ------------------------------------------------------------ verzamelen */

/** Elk object met een id én een confidence telt als feit. Dat is precies de
 *  vorm die de datalaag garandeert, dus dit hoeft niet per bestand te weten
 *  hoe het eruitziet. */
function verzamelFeiten(knoop, ctx, uit) {
  if (Array.isArray(knoop)) {
    for (const x of knoop) verzamelFeiten(x, ctx, uit);
    return;
  }
  if (!knoop || typeof knoop !== "object") return;

  const land = typeof knoop.code === "string" && typeof knoop.name === "string"
    ? knoop.code
    : ctx.land;
  const geverifieerd = knoop.lastVerified || ctx.lastVerified;

  if (typeof knoop.id === "string" && "confidence" in knoop) {
    uit.push({
      id: knoop.id,
      bestand: ctx.bestand,
      land,
      lastVerified: geverifieerd || null,
      eigenDatum: Boolean(knoop.lastVerified),
      needsVerification: knoop.needsVerification === true,
      confidence: knoop.confidence,
      /* bron in drukte.json is een label ("Bison Fute 2026"), geen adres —
         alleen iets dat op een URL lijkt telt als bron. */
      sourceUrl: alsUrl(knoop.sourceUrl) || alsUrl(knoop.bron) || null,
      erfBron: ctx.sourceUrl || null,
    });
  }

  const volgende = {
    ...ctx,
    land,
    lastVerified: geverifieerd,
    sourceUrl: alsUrl(knoop.sourceUrl) || ctx.sourceUrl,
  };
  for (const waarde of Object.values(knoop)) verzamelFeiten(waarde, volgende, uit);
}

function verzamelUrls(knoop, ctx, uit) {
  if (Array.isArray(knoop)) {
    for (const x of knoop) verzamelUrls(x, ctx, uit);
    return;
  }
  if (!knoop || typeof knoop !== "object") return;

  const land = typeof knoop.code === "string" && typeof knoop.name === "string"
    ? knoop.code
    : ctx.land;

  for (const [sleutel, waarde] of Object.entries(knoop)) {
    if ((sleutel === "sourceUrl" || sleutel === "url" || sleutel === "bron") &&
        typeof waarde === "string" && /^https?:\/\//.test(waarde)) {
      uit.push({ url: waarde, land, waar: knoop.id || knoop.label || knoop.name || ctx.bestand });
    } else {
      verzamelUrls(waarde, { ...ctx, land }, uit);
    }
  }
}

/* --------------------------------------------------------------- helpers */

function alsUrl(waarde) {
  return typeof waarde === "string" && /^https?:\/\//.test(waarde) ? waarde : null;
}

function dagenSinds(iso) {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return null;
  return Math.floor((Date.now() - t) / 86400000);
}

function host(url) {
  try {
    return new URL(url).host;
  } catch {
    return null;
  }
}

/* --------------------------------------------------------------- linkcheck */

/* HEAD eerst: dat scheelt bandbreedte en de meeste servers doen het. Wie 405 of
 * 501 teruggeeft, krijgt alsnog een GET. 403 laten we staan als waarschuwing en
 * niet als fout: veel overheidssites weren een kale client, terwijl de pagina
 * voor een browser gewoon bestaat. Een 404 is wél hard. */
async function controleerUrl(url) {
  const opties = {
    redirect: "follow",
    signal: AbortSignal.timeout(TIJDSLIMIET_MS),
    headers: {
      // Zonder herkenbare client weren nogal wat sites je meteen.
      "user-agent": "Grenschecklist-linkcheck/1.0 (+https://github.com/) node-fetch",
      accept: "text/html,application/xhtml+xml,*/*",
    },
  };
  try {
    let r = await fetch(url, { ...opties, method: "HEAD" });
    if (r.status === 405 || r.status === 501 || r.status === 403) {
      r = await fetch(url, { ...opties, method: "GET" });
    }
    return { url, status: r.status, ok: r.ok, eind: r.url !== url ? r.url : null };
  } catch (e) {
    return { url, status: 0, ok: false, reden: String(e && e.message || e) };
  }
}

async function controleerAlles(urls) {
  const uit = [];
  let volgende = 0;
  async function werker() {
    while (volgende < urls.length) {
      const i = volgende++;
      uit[i] = await controleerUrl(urls[i]);
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(GELIJKTIJDIG, urls.length) }, werker),
  );
  return uit;
}

/* ------------------------------------------------------------------ main */

async function lees(naam) {
  return JSON.parse(await readFile(path.join(ROOT, naam), "utf8"));
}

const bestanden = ["countries.json", "zones.json", "drukte.json"];

const feiten = [];
const urlPlekken = [];
for (const naam of bestanden) {
  const inhoud = await lees(naam);
  /* De datum uit de meta van het bestand is de bodem: feiten die geen eigen
     lastVerified hebben en ook niet onder een land hangen — de dagen en regels
     in drukte.json — zijn geverifieerd op het moment dat het bestand dat was. */
  const meta = inhoud.meta || inhoud._meta || {};
  const bodemDatum = meta.lastVerified || meta.researchDate || null;
  /* Dezelfde redenering voor de bron: de dagen in drukte.json dragen een label
     ("Bison Fute 2026") en het adres staat in meta.sources. Zonder deze bodem
     zou elke dag als "official zonder bron" gemeld worden, terwijl de bron er
     wel is — alleen een niveau hoger. */
  const bodemBron = (meta.sources || []).map((b) => b && b.url).find(alsUrl) || null;
  verzamelFeiten(inhoud, { bestand: naam, land: null, lastVerified: bodemDatum, sourceUrl: bodemBron }, feiten);
  verzamelUrls(inhoud, { bestand: naam, land: null }, urlPlekken);
}

const fouten = [];
const oud = [];
const onzeker = [];
const letop = [];

/* --- structuur --- */
const perId = new Map();
for (const f of feiten) {
  if (!f.id) {
    fouten.push({ soort: "geen-id", bestand: f.bestand, land: f.land });
    continue;
  }
  if (perId.has(f.id)) {
    fouten.push({ soort: "dubbel-id", id: f.id, bestand: f.bestand, land: f.land });
  } else {
    perId.set(f.id, f);
  }
  if (!CONFIDENCE_NIVEAUS.includes(f.confidence)) {
    fouten.push({ soort: "onbekende-confidence", id: f.id, waarde: f.confidence });
  }
}

/* --- veroudering --- */
for (const f of feiten) {
  const d = f.lastVerified ? dagenSinds(f.lastVerified) : null;
  if (d === null) {
    /* Geen datum, ook niet geërfd van het land. Dat hoort niet te kunnen. */
    fouten.push({ soort: "geen-lastVerified", id: f.id, bestand: f.bestand });
  } else if (d > DREMPEL_DAGEN) {
    oud.push({ id: f.id, land: f.land, dagen: d, datum: f.lastVerified, eigen: f.eigenDatum });
  }
}

/* --- onzekerheid --- */
for (const f of feiten) {
  if (f.needsVerification || f.confidence === "uncertain") {
    onzeker.push({
      id: f.id,
      land: f.land,
      vlag: f.needsVerification,
      confidence: f.confidence,
      bron: f.sourceUrl || f.erfBron || null,
    });
  }
}

/* --- confidence tegenover de bron --- */
for (const f of feiten) {
  const h = host(f.sourceUrl || f.erfBron || "");
  if (f.confidence === "official" && h && !isOfficieleHost(h)) {
    letop.push({ id: f.id, confidence: f.confidence, host: h,
                 waarom: "als official gemarkeerd, maar de bron staat niet in de lijst met officiële sites" });
  }
  if (f.confidence === "official" && !h) {
    letop.push({ id: f.id, confidence: f.confidence, host: null,
                 waarom: "als official gemarkeerd, maar er is geen bron-URL" });
  }
}

/* --- changelog: wijst elke regel nog ergens naar? --- */
let changelog = { wijzigingen: [] };
try {
  changelog = JSON.parse(await readFile(path.join(ROOT, "meta", "changelog.json"), "utf8"));
} catch (e) {
  fouten.push({ soort: "changelog-onleesbaar", reden: String(e && e.message || e) });
}
for (const w of changelog.wijzigingen || []) {
  if (!perId.has(w.id)) {
    fouten.push({ soort: "changelog-verweesd", id: w.id, bestand: "meta/changelog.json" });
  }
  for (const veld of ["id", "onderwerp", "datum"]) {
    if (!w[veld]) fouten.push({ soort: "changelog-mist-" + veld, id: w.id || "(geen id)" });
  }
  if (w.bron && !alsUrl(w.bron)) {
    letop.push({ id: w.id, waarom: "bron in de changelog is geen URL" });
  }
}

/* --- dode links --- */
const unieke = [...new Set(urlPlekken.map((u) => u.url))];
let linkResultaten = [];
if (!GEEN_NETWERK) {
  linkResultaten = await controleerAlles(unieke);
  for (const r of linkResultaten) {
    const plekken = urlPlekken.filter((u) => u.url === r.url);
    const waar = [...new Set(plekken.map((u) => u.land || u.waar))].join(", ");
    if (r.ok) continue;
    if (r.status === 0) {
      fouten.push({ soort: "bron-onbereikbaar", url: r.url, waar, reden: r.reden });
    } else if (r.status === 403 || r.status === 429) {
      letop.push({ id: null, waarom: `bron gaf ${r.status} — mogelijk alleen een blokkade voor scripts`, host: host(r.url), url: r.url, waar });
    } else {
      fouten.push({ soort: "dode-bron", url: r.url, status: r.status, waar });
    }
  }
}

/* ---------------------------------------------------------------- verslag */

const verslag = {
  gedraaid: new Date().toISOString(),
  drempelDagen: DREMPEL_DAGEN,
  feiten: feiten.length,
  unieke_ids: perId.size,
  changelog_regels: (changelog.wijzigingen || []).length,
  bronnen_gecontroleerd: GEEN_NETWERK ? 0 : unieke.length,
  fouten,
  oud,
  onzeker,
  letop,
};

if (ALS_JSON) {
  console.log(JSON.stringify(verslag, null, 2));
} else {
  const regel = (s) => console.log(s);
  regel("");
  regel(`Grenschecklist — datacontrole (${new Date().toISOString().slice(0, 10)})`);
  regel(`${feiten.length} feiten, ${perId.size} unieke id's, ` +
        `${(changelog.wijzigingen || []).length} changelogregels, drempel ${DREMPEL_DAGEN} dagen`);
  regel("");

  if (fouten.length) {
    regel(`FOUT (${fouten.length})`);
    for (const f of fouten) {
      if (f.soort === "dode-bron") regel(`  ${f.status}  ${f.url}   (${f.waar})`);
      else if (f.soort === "bron-onbereikbaar") regel(`  ---  ${f.url}   (${f.waar}) — ${f.reden}`);
      else regel(`  ${f.soort}  ${f.id || ""} ${f.bestand || ""} ${f.waarde ?? ""}`.trimEnd());
    }
    regel("");
  }

  if (oud.length) {
    regel(`OUD — lastVerified ouder dan ${DREMPEL_DAGEN} dagen (${oud.length})`);
    /* Feiten zonder eigen datum erven die van hun land; die samenvouwen, anders
       lees je 300 keer dezelfde datum. */
    const perLand = new Map();
    for (const o of oud.filter((x) => !x.eigen)) {
      if (!perLand.has(o.land)) perLand.set(o.land, { land: o.land, dagen: o.dagen, datum: o.datum, n: 0 });
      perLand.get(o.land).n++;
    }
    for (const l of perLand.values()) {
      regel(`  ${l.land}  ${l.datum}  (${l.dagen} dagen, ${l.n} feiten erven deze datum)`);
    }
    for (const o of oud.filter((x) => x.eigen)) {
      regel(`  ${o.id}  ${o.datum}  (${o.dagen} dagen)`);
    }
    regel("");
  }

  if (onzeker.length) {
    regel(`ONZEKER — bewust gemarkeerd, wacht op een betere bron (${onzeker.length})`);
    for (const o of onzeker) {
      regel(`  ${o.id}  ${o.confidence}${o.vlag ? " needsVerification" : ""}`);
    }
    regel("");
  }

  if (letop.length) {
    regel(`LET OP (${letop.length})`);
    for (const l of letop) regel(`  ${l.id || l.url || ""} — ${l.waarom}`);
    regel("");
  }

  if (!fouten.length && !oud.length && !onzeker.length && !letop.length) {
    regel("Niets te melden.");
    regel("");
  }
  if (GEEN_NETWERK) regel("(--geen-netwerk: bronnen zijn niet gecontroleerd)");
}

/* Alleen structurele problemen en dode links zijn een fout. Oude data en
 * gemarkeerde onzekerheid zijn werk, geen defect — die mogen een maandelijkse
 * cron niet rood laten worden, anders kijkt niemand er meer naar. */
process.exitCode = fouten.length ? 1 : 0;
