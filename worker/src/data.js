/* Dataproxy — /api/v1/data/<bestand>.json
 *
 * Waarom dit bestaat: de regeldata moet kunnen wijzigen zonder dat de app
 * opnieuw uitgerold wordt. Een vignetprijs of een euronorm-drempel verandert
 * midden in het jaar; als daar een deploy voor nodig is, gebeurt het te laat of
 * niet. Meteen ook de basis voor een latere B2B-API — dit endpoint ís de API.
 *
 * Twee bronnen, in deze volgorde:
 *
 *   1. de KV-namespace DATA, als die gekoppeld is. Daar upload je een nieuw
 *      bestand in en het staat er meteen;
 *   2. anders het bestand dat naast de app staat. Zonder KV gedraagt het
 *      endpoint zich dus als een doorgeefluik met ETag — nog steeds nuttig,
 *      alleen zonder de losse-upload-eigenschap.
 *
 * De v1 in het pad is het contract naar buiten, niet de versie van de data.
 * Verandert de vórm van de data, dan komt er v2 naast; verandert de inhoud, dan
 * verandert de ETag en meta.schemaVersion / meta.researchDate in het bestand
 * zelf.
 *
 * Over "lange cache": dat is hier de conditionele cache, niet een lange
 * max-age. Een lange max-age zou betekenen dat een gecorrigeerde vignetprijs
 * uren blijft hangen, en dat is precies wat dit endpoint moest oplossen. Dus:
 * korte max-age plus een ETag, waardoor de herhaalvraag een 304 van een paar
 * honderd bytes is in plaats van 87 KB.
 */

import { fout, JSON_TYPE } from "./lib/antwoord.js";
import { herkomstOk } from "./lib/herkomst.js";

/* Alleen de regeldata. borders.json en cities.json zijn geodata: die veranderen
 * alleen als je tools/build-geodata.ps1 draait, en dan hoort er sowieso een
 * deploy bij. */
const BESTANDEN = new Set(["countries.json", "zones.json", "drukte.json"]);

const CACHE = "public, max-age=60, stale-while-revalidate=86400";

async function etagVan(tekst) {
  const bytes = new TextEncoder().encode(tekst);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  const hex = [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
  /* Zwakke ETag: we beloven dat de inhoud gelijk is, niet dat de bytes
     byte-voor-byte identiek zijn — KV en de statische host kunnen anders
     inspringen. */
  return `W/"${hex.slice(0, 32)}"`;
}

export async function afhandelData(request, env, ctx) {
  if (!herkomstOk(request, env)) return fout("herkomst niet toegestaan", 403);

  const url = new URL(request.url);
  const naam = url.pathname.split("/").pop();

  if (!BESTANDEN.has(naam)) {
    return fout("onbekend databestand; beschikbaar: " + [...BESTANDEN].join(", "), 404);
  }

  let tekst = null;
  let bron = "kv";

  if (env.DATA) {
    try {
      tekst = await env.DATA.get(naam);
    } catch {
      tekst = null;
    }
  }

  if (tekst === null) {
    bron = "bundel";
    /* Het bestand naast de app. DATA_ORIGIN alleen nodig als de Worker op een
       ander domein staat dan de statische bestanden. */
    const basis = env.DATA_ORIGIN || url.origin;
    const r = await fetch(new URL("/" + naam, basis).toString(), {
      cf: { cacheTtl: 60, cacheEverything: true },
    });
    if (!r.ok) return fout("databestand niet beschikbaar", 502);
    tekst = await r.text();
  }

  /* Kapotte JSON doorgeven zou de app op een lege checklist zetten zonder dat
     iemand weet waarom. Liever hier stuklopen, dan valt de app terug op zijn
     eigen kopie. */
  let versie = null;
  try {
    const j = JSON.parse(tekst);
    const meta = j.meta || j._meta || {};
    versie = [meta.schemaVersion, meta.researchDate || meta.lastVerified].filter(Boolean).join("/");
  } catch {
    console.error("dataproxy: ongeldige JSON in", naam, "via", bron);
    return fout("databestand is geen geldige JSON", 502);
  }

  const etag = await etagVan(tekst);
  const kop = {
    "content-type": JSON_TYPE,
    "cache-control": CACHE,
    etag,
    "x-data-bron": bron,
    ...(versie ? { "x-data-versie": versie } : {}),
  };

  /* Herhaalvraag met dezelfde ETag: 304, geen body. Dat is wat "lange cache"
     hier betekent. */
  const meegestuurd = request.headers.get("if-none-match");
  if (meegestuurd && meegestuurd.split(",").some((t) => t.trim() === etag)) {
    return new Response(null, { status: 304, headers: kop });
  }

  return new Response(tekst, { headers: kop });
}
