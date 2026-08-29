#!/usr/bin/env node
/* Build-pipeline voor Grenschecklist.
 *
 * Twee taken, allebei zonder dependencies:
 *
 *   node build/build.mjs        genereert statische pagina's uit countries.json
 *   node build/build.mjs --sw   ververst de ASSETS-lijst in sw.js
 *
 * Waarom nu al, terwijl er nog geen pagina te genereren valt: de SEO-pagina's
 * uit §27 van de masterprompt (/autorijden-frankrijk, /vignet-oostenrijk, ...)
 * moeten uit dezelfde countries.json komen als de app zelf. Zodra die pagina's
 * met de hand geschreven worden, lopen ze binnen een jaar uit de pas met de
 * data — en dan staat er onjuiste informatie op je vindbaarste pagina's. Dit
 * script is er zodat dat niet kan.
 *
 * PAGINAS hieronder is met opzet leeg. Deze fase bouwt het fundament, geen
 * gebruikersfuncties; het genereren zelf is fase E van de roadmap. Vul de array
 * en er komen pagina's uit, zonder dat er nog iets aan dit script hoeft te
 * veranderen.
 *
 * De app zelf blijft vanilla en buildloos: `index.html` werkt zonder dat dit
 * script ooit gedraaid heeft. Deze pipeline maakt alleen extra bestanden.
 */

import { readFile, writeFile, mkdir, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const p = (...delen) => path.join(ROOT, ...delen);

/* ---------------------------------------------------------------- pagina's */

/* Elke definitie zegt: over welke landen gaat dit, hoe heet de map, en wat
 * staat erin. `voor` krijgt één land uit countries.json en geeft null terug als
 * de pagina voor dat land niet bestaat — geen lege SEO-pagina's (§27).
 *
 * Voorbeeld van hoe een definitie eruit gaat zien, bewust uitgecommentarieerd:
 *
 *   {
 *     naam: "vignet",
 *     voor(land) {
 *       const v = land.tollVignette;
 *       if (!v?.required) return null;                 // geen vignet, geen pagina
 *       return {
 *         slug: `vignet-${slugify(land.name)}`,
 *         titel: `Vignet ${land.name}: prijs, kopen en boetes`,
 *         beschrijving: kortZin(v.note ?? v.name),
 *         inhoud: vignetSectie(land),
 *         bronnen: land.sources ?? [],
 *         geverifieerd: land.lastVerified,
 *       };
 *     },
 *   }
 */
const PAGINAS = [];

/* --------------------------------------------------------------- helpers */

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

const fmtDatum = (iso) => {
  const m = ["januari", "februari", "maart", "april", "mei", "juni", "juli",
             "augustus", "september", "oktober", "november", "december"];
  const d = String(iso ?? "").split("-");
  return d.length === 3 ? `${Number(d[2])} ${m[Number(d[1]) - 1]} ${d[0]}` : String(iso ?? "");
};

/* Eén laag boven de generatie: elke gegenereerde pagina deelt hetzelfde
 * stylesheet en dezelfde voettekst als de app, zodat ze niet uit elkaar lopen.
 * Merk op dat de paden één niveau omhoog gaan: pagina's staan in <slug>/. */
function paginaHTML({ slug, titel, beschrijving, inhoud, bronnen = [], geverifieerd }) {
  const bronLijst = bronnen.length
    ? `<h2>Bronnen</h2>\n<ul>${bronnen
        .map((b) => `<li><a href="${esc(b.url)}" rel="noopener">${esc(b.label)}</a></li>`)
        .join("")}</ul>`
    : "";
  const controle = geverifieerd
    ? `<p class="hint">Laatst gecontroleerd op ${esc(fmtDatum(geverifieerd))}. ` +
      `Regels veranderen; controleer de officiële bron vlak voor vertrek.</p>`
    : "";

  return `<!DOCTYPE html>
<html lang="nl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="color-scheme" content="light dark">
<meta name="description" content="${esc(beschrijving)}">
<link rel="canonical" href="/${esc(slug)}">
<link rel="stylesheet" href="../fonts.css">
<link rel="stylesheet" href="../css/base.css">
<link rel="stylesheet" href="../css/components.css">
<link rel="stylesheet" href="../css/pages.css">
<link rel="stylesheet" href="../css/print.css">
<title>${esc(titel)} — Grenschecklist</title>
</head>
<body>
<main class="main view view-page">
<h1>${esc(titel)}</h1>
${inhoud}
${bronLijst}
${controle}
<p><a href="../">Plan je hele route met Grenschecklist →</a></p>
</main>
</body>
</html>
`;
}

async function bouwPaginas() {
  const data = JSON.parse(await readFile(p("countries.json"), "utf8"));
  const gemaakt = [];

  for (const definitie of PAGINAS) {
    for (const land of data.countries) {
      const pagina = definitie.voor(land);
      if (!pagina) continue;                       // geen data, geen pagina
      await mkdir(p(pagina.slug), { recursive: true });
      await writeFile(p(pagina.slug, "index.html"), paginaHTML(pagina), "utf8");
      gemaakt.push({ slug: pagina.slug, soort: definitie.naam, land: land.code });
    }
  }

  await mkdir(p("meta"), { recursive: true });
  await writeFile(
    p("meta", "build-manifest.json"),
    JSON.stringify(
      { gegenereerd: new Date().toISOString().slice(0, 10), bron: "countries.json", paginas: gemaakt },
      null,
      2,
    ) + "\n",
    "utf8",
  );

  if (!gemaakt.length) {
    console.log(
      "Geen pagina's gegenereerd: PAGINAS in build/build.mjs is leeg.\n" +
      "Dat klopt voor deze fase — de pipeline staat, het genereren is fase E.",
    );
  } else {
    console.log(`${gemaakt.length} pagina's gegenereerd:`);
    for (const g of gemaakt) console.log(`  /${g.slug}`);
  }
}

/* ------------------------------------------------------- service worker */

/* De ASSETS-lijst in sw.js met de hand bijhouden gaat een keer mis: een nieuw
 * bestand staat dan wel op de server maar niet in de offline cache, en dat merk
 * je pas op een parkeerplaats zonder bereik. Dit leest de mappen uit en schrijft
 * de lijst tussen de twee markeringen opnieuw. */
const SW_MAPPEN = ["css", "js", "fonts", "images/Landbanner"];
const SW_LOSSE = [
  "./", "./index.html", "./fonts.css",
  "./countries.json", "./cities.json", "./borders.json", "./zones.json", "./drukte.json",
];

async function bestandenIn(map) {
  const uit = [];
  for (const naam of (await readdir(p(map), { withFileTypes: true })).sort((a, b) =>
    a.name.localeCompare(b.name),
  )) {
    if (naam.isDirectory()) uit.push(...(await bestandenIn(path.posix.join(map, naam.name))));
    else if (!naam.name.startsWith(".")) uit.push(`./${map}/${naam.name}`);
  }
  return uit;
}

async function bouwServiceWorker() {
  const paden = [...SW_LOSSE];
  for (const map of SW_MAPPEN) paden.push(...(await bestandenIn(map)));

  const lijst =
    "var ASSETS = [\n" + paden.map((x) => `  ${JSON.stringify(x)}`).join(",\n") + "\n];";

  const sw = await readFile(p("sw.js"), "utf8");
  const start = sw.indexOf("var ASSETS = [");
  const eind = sw.indexOf("/* EIND-ASSETS */");
  if (start === -1 || eind === -1) {
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

  if (uit === sw) {
    console.log("sw.js was al bij: geen wijziging.");
    return;
  }
  await writeFile(p("sw.js"), uit, "utf8");
  console.log(`sw.js bijgewerkt: ${paden.length} bestanden in de offline cache.`);
}

/* ------------------------------------------------------------------ main */

const argumenten = process.argv.slice(2);
if (argumenten.includes("--sw")) await bouwServiceWorker();
else if (argumenten.includes("--alles")) {
  await bouwPaginas();
  await bouwServiceWorker();
} else await bouwPaginas();
