/* Geocodeerproxy.
 *
 * Zelfde reden als route.js: de sleutel blijft aan deze kant.
 *
 * Contract naar de client:
 *   GET /api/geocode?q=<tekst>            zoeken op tekst
 *   GET /api/geocode?lat=<lat>&lon=<lon>  omgekeerd zoeken
 *   200 { results:[{ naam, omschrijving, land, lat, lon }], provider:"<naam>" }
 *   4xx { error:"<uitleg>" }
 *
 * Instellen bij de host:
 *   GEO_PROVIDER  ors | nominatim          (standaard: nominatim)
 *   GEO_KEY       de sleutel               (niet nodig bij nominatim)
 *   GEO_UA        contactadres voor de User-Agent die Nominatim eist
 *   TOEGESTANE_HERKOMST  https://jouwdomein.nl
 *   LIMIET_GEOCODE  aanvragen per minuut per IP  (standaard: 60)
 *
 * Let op bij nominatim: het gebruiksbeleid vraagt om een identificeerbare
 * User-Agent en maximaal een aanvraag per seconde. Een proxy bundelt al jouw
 * bezoekers achter één IP, dus voor echt verkeer hoort hier een dienst met
 * sleutel te staan. De begrenzer hieronder beschermt jouw quotum, niet dat van
 * Nominatim — die twee zijn niet hetzelfde.
 */

import { fout, json, CACHE_GEOCODE } from "./lib/antwoord.js";
import { herkomstOk } from "./lib/herkomst.js";
import { begrens, begrensHeaders } from "./lib/ratelimit.js";
import { cacheSleutel, uitCache, naarCache, metCacheHeader, rondAf } from "./lib/cache.js";

const LIMIET = 60;
const VENSTER = 60;

export async function afhandelGeocode(request, env, ctx) {
  const url = new URL(request.url);

  if (!herkomstOk(request, env)) return fout("herkomst niet toegestaan", 403);

  const provider = (env.GEO_PROVIDER || "nominatim").toLowerCase();

  if (url.searchParams.get("ping")) {
    return json({ ok: true, provider }, { cache: "public, max-age=300" });
  }

  /* Twee vormen achter één endpoint: zoeken op tekst, en omgekeerd zoeken op
     coördinaten. Dat scheelt de client een tweede pad en de proxy een tweede
     begrenzer — het is dezelfde dienst en hetzelfde quotum. */
  const q = (url.searchParams.get("q") || "").trim();
  const lat = url.searchParams.get("lat");
  const lon = url.searchParams.get("lon");
  const omgekeerd = lat !== null && lon !== null;

  let vraag;
  if (omgekeerd) {
    const la = Number(lat), lo = Number(lon);
    if (!isFinite(la) || !isFinite(lo) || la < -90 || la > 90 || lo < -180 || lo > 180) {
      return fout("lat en lon moeten geldige coördinaten zijn");
    }
    vraag = { soort: "reverse", lat: rondAf(la), lon: rondAf(lo) };
  } else {
    if (q.length < 2) return fout("q moet minstens twee tekens zijn");
    if (q.length > 120) return fout("q is te lang");
    /* Normaliseren zodat "Wenen", "wenen" en " Wenen " dezelfde cache-ingang
       delen. De provider krijgt de genormaliseerde vorm, net als bij route.js:
       sleutel en antwoord horen bij elkaar. */
    vraag = { soort: "zoek", q: q.toLowerCase() };
  }

  const sleutel = await cacheSleutel("geocode", { provider, ...vraag });
  const gecacht = await uitCache(sleutel);
  if (gecacht) return metCacheHeader(gecacht, "HIT");

  const limiet = await begrens(request, env, "geocode", LIMIET, VENSTER);
  if (limiet.teveel) {
    return fout("te veel aanvragen — probeer het zo nog eens", 429, {
      "retry-after": String(limiet.herprobeerNa),
      ...begrensHeaders(limiet, LIMIET),
    });
  }

  let antwoord;
  try {
    if (provider === "ors") antwoord = await viaOrs(vraag, env);
    else antwoord = await viaNominatim(vraag, env);
  } catch (e) {
    console.error("geocodeproxy", provider, e && e.message);
    return fout("zoeken lukte niet", 502);
  }

  if (!antwoord.ok) return antwoord;
  naarCache(sleutel, antwoord, ctx);
  return metCacheHeader(antwoord, "MISS");
}

function resultaat(results, provider) {
  return json({ results, provider }, { cache: CACHE_GEOCODE });
}

/* --- OpenRouteService Pelias --- */
async function viaOrs(vraag, env) {
  if (!env.GEO_KEY) return fout("GEO_KEY ontbreekt", 500);
  const url = vraag.soort === "reverse"
    ? "https://api.openrouteservice.org/geocode/reverse?size=1&point.lat=" +
      vraag.lat + "&point.lon=" + vraag.lon
    : "https://api.openrouteservice.org/geocode/search?size=5&text=" +
      encodeURIComponent(vraag.q);
  const r = await fetch(url, { headers: { Authorization: env.GEO_KEY } });
  if (!r.ok) throw new Error("ORS " + r.status);
  const j = await r.json();
  const results = (j.features || []).map((f) => {
    const p = f.properties || {};
    return {
      naam: vraag.soort === "reverse"
        ? (p.locality || p.county || p.name || p.label)
        : (p.name || p.label),
      omschrijving: p.label,
      // Pelias geeft ISO3; de app werkt met ISO2.
      land: ISO3_NAAR_ISO2[p.country_a] || "",
      lon: f.geometry.coordinates[0],
      lat: f.geometry.coordinates[1],
    };
  });
  return resultaat(results, "openrouteservice");
}

/* --- Nominatim --- */
async function viaNominatim(vraag, env) {
  const kop = {
    "User-Agent": env.GEO_UA || "Grenschecklist (stel GEO_UA in met je contactadres)",
    "Accept-Language": "nl",
  };

  if (vraag.soort === "reverse") {
    const url = "https://nominatim.openstreetmap.org/reverse" +
      "?format=jsonv2&addressdetails=1&accept-language=nl&lat=" + vraag.lat + "&lon=" + vraag.lon;
    const r = await fetch(url, { headers: kop });
    if (!r.ok) throw new Error("Nominatim " + r.status);
    const h = await r.json();
    return resultaat(h && h.lat ? [uitNominatim(h, true)] : [], "nominatim");
  }

  const url = "https://nominatim.openstreetmap.org/search" +
    "?format=jsonv2&limit=5&addressdetails=1&accept-language=nl&q=" + encodeURIComponent(vraag.q);
  const r = await fetch(url, { headers: kop });
  if (!r.ok) throw new Error("Nominatim " + r.status);
  const lijst = await r.json();
  return resultaat(lijst.map((h) => uitNominatim(h, false)), "nominatim");
}

/* Bij omgekeerd zoeken wil je de plaatsnaam, niet het eerste deel van het
   adres — anders heet je vertrekpunt "12" omdat dat het huisnummer was. */
function uitNominatim(h, voorkeurPlaats) {
  const a = h.address || {};
  const naam = (voorkeurPlaats && (a.city || a.town || a.village || a.municipality || a.county)) ||
               String(h.display_name || "").split(",")[0];
  return {
    naam,
    omschrijving: h.display_name,
    land: (a.country_code || "").toUpperCase(),
    lat: Number(h.lat),
    lon: Number(h.lon),
  };
}

/* Alleen de landen die de app kent; de rest levert een lege landcode op en valt
   in de app vanzelf buiten de boot. */
const ISO3_NAAR_ISO2 = {
  BEL: "BE", NLD: "NL", DEU: "DE", FRA: "FR", LUX: "LU", AUT: "AT", CHE: "CH",
  ITA: "IT", ESP: "ES", PRT: "PT", HRV: "HR", SVN: "SI", CZE: "CZ", DNK: "DK",
  SWE: "SE", GBR: "GB",
};
