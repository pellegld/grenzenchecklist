/* Routeproxy.
 *
 * Bestaansreden: de sleutel van een routeringsdienst mag de browser nooit
 * bereiken. Hij staat in env, die je bij je host als secret invult; in de repo
 * staat hij niet en in de bundle evenmin.
 *
 * Contract naar de client (zie ook README, "Het contract"):
 *   GET /api/route?from=<lon>,<lat>&to=<lon>,<lat>
 *   200 { coordinates:[[lon,lat],...], meters:<n>, seconds:<n>, provider:"<naam>" }
 *   4xx { error:"<uitleg>" }
 *
 * Instellen bij de host (Secrets, geen plain text):
 *   ROUTE_PROVIDER  ors | graphhopper | osrm      (standaard: osrm)
 *   ROUTE_KEY       de sleutel                    (niet nodig bij osrm)
 *   ROUTE_OSRM_URL  eigen OSRM-instantie          (optioneel)
 *   TOEGESTANE_HERKOMST  https://jouwdomein.nl    (optioneel)
 *   LIMIET_ROUTE    aanvragen per minuut per IP   (standaard: 30)
 */

import { fout, json, CACHE_ROUTE } from "./lib/antwoord.js";
import { herkomstOk } from "./lib/herkomst.js";
import { begrens, begrensHeaders } from "./lib/ratelimit.js";
import { cacheSleutel, uitCache, naarCache, metCacheHeader, rondAf } from "./lib/cache.js";

const LIMIET = 30;          // aanvragen
const VENSTER = 60;         // seconden

/* Alleen lon,lat-paren binnen bereik. Zonder deze controle stuur je willekeurige
   invoer van een vreemde door naar een dienst die jij betaalt. */
export function punt(waarde) {
  if (!waarde) return null;
  const delen = String(waarde).split(",");
  if (delen.length !== 2) return null;
  const lon = Number(delen[0]);
  const lat = Number(delen[1]);
  if (!isFinite(lon) || !isFinite(lat)) return null;
  if (lon < -180 || lon > 180 || lat < -90 || lat > 90) return null;
  return [rondAf(lon), rondAf(lat)];
}

export async function afhandelRoute(request, env, ctx) {
  const url = new URL(request.url);

  if (!herkomstOk(request, env)) return fout("herkomst niet toegestaan", 403);

  const provider = (env.ROUTE_PROVIDER || "osrm").toLowerCase();

  // De client klopt eerst even aan om te weten of er een proxy draait. Dit gaat
  // bewust vóór de begrenzer langs: het is één antwoord uit deze functie zelf,
  // het raakt geen provider, en de app doet het één keer per sessie.
  if (url.searchParams.get("ping")) {
    return json({ ok: true, provider }, { cache: "public, max-age=300" });
  }

  const van = punt(url.searchParams.get("from"));
  const naar = punt(url.searchParams.get("to"));
  if (!van || !naar) return fout("from en to moeten <lon>,<lat> zijn");

  /* Eerst de cache, dan pas de begrenzer: een treffer kost de provider niets,
     dus die hoeft niet van iemands budget af. Wie tien keer dezelfde route
     opvraagt, doet niemand kwaad. */
  const sleutel = await cacheSleutel("route", { provider, van, naar });
  const gecacht = await uitCache(sleutel);
  if (gecacht) return metCacheHeader(gecacht, "HIT");

  const limiet = await begrens(request, env, "route", LIMIET, VENSTER);
  if (limiet.teveel) {
    return fout("te veel aanvragen — probeer het zo nog eens", 429, {
      "retry-after": String(limiet.herprobeerNa),
      ...begrensHeaders(limiet, LIMIET),
    });
  }

  let antwoord;
  try {
    if (provider === "ors") antwoord = await viaOrs(van, naar, env);
    else if (provider === "graphhopper") antwoord = await viaGraphhopper(van, naar, env);
    else antwoord = await viaOsrm(van, naar, env);
  } catch (e) {
    // De boodschap van de provider kan de sleutel bevatten; die gaat niet terug
    // naar de client. In je hostlogs staat de echte fout wel.
    console.error("routeproxy", provider, e && e.message);
    return fout("route bepalen lukte niet", 502);
  }

  if (!antwoord.ok) return antwoord;          // 404/500 uit de provider-functies
  naarCache(sleutel, antwoord, ctx);
  return metCacheHeader(antwoord, "MISS");
}

function resultaat(coordinates, meters, seconds, provider) {
  if (!coordinates || !coordinates.length) return fout("geen route gevonden", 404);
  return json(
    {
      coordinates,
      meters: Math.round(meters || 0),
      seconds: Math.round(seconds || 0),
      provider,
    },
    { cache: CACHE_ROUTE },
  );
}

/* --- OpenRouteService: sleutel in de header, niet in de URL --- */
async function viaOrs([vanLon, vanLat], [naarLon, naarLat], env) {
  if (!env.ROUTE_KEY) return fout("ROUTE_KEY ontbreekt", 500);
  const r = await fetch(
    "https://api.openrouteservice.org/v2/directions/driving-car/geojson",
    {
      method: "POST",
      headers: { Authorization: env.ROUTE_KEY, "content-type": "application/json" },
      body: JSON.stringify({
        coordinates: [[vanLon, vanLat], [naarLon, naarLat]],
        geometry_simplify: false,
      }),
    },
  );
  if (!r.ok) throw new Error("ORS " + r.status);
  const j = await r.json();
  const f = j.features && j.features[0];
  const summary = f && f.properties && f.properties.summary;
  return resultaat(
    f && f.geometry && f.geometry.coordinates,
    summary && summary.distance,
    summary && summary.duration,
    "openrouteservice",
  );
}

/* --- Graphhopper: sleutel als queryparameter, maar wel aan deze kant --- */
async function viaGraphhopper([vanLon, vanLat], [naarLon, naarLat], env) {
  if (!env.ROUTE_KEY) return fout("ROUTE_KEY ontbreekt", 500);
  const q =
    "point=" + vanLat + "," + vanLon +
    "&point=" + naarLat + "," + naarLon +
    "&profile=car&points_encoded=false&instructions=false" +
    "&key=" + encodeURIComponent(env.ROUTE_KEY);
  const r = await fetch("https://graphhopper.com/api/1/route?" + q);
  if (!r.ok) throw new Error("Graphhopper " + r.status);
  const j = await r.json();
  const pad = j.paths && j.paths[0];
  return resultaat(
    pad && pad.points && pad.points.coordinates,
    pad && pad.distance,
    pad && pad.time && pad.time / 1000,
    "graphhopper",
  );
}

/* --- OSRM: geen sleutel. Wijs ROUTE_OSRM_URL naar je eigen instantie;
       zonder die variabele gebruikt hij de demoserver, en die is niet
       voor productie bedoeld. --- */
async function viaOsrm([vanLon, vanLat], [naarLon, naarLat], env) {
  const basis = env.ROUTE_OSRM_URL || "https://router.project-osrm.org/route/v1/driving/";
  const url = basis + vanLon + "," + vanLat + ";" + naarLon + "," + naarLat +
    "?overview=full&geometries=geojson&alternatives=false&steps=false";
  const r = await fetch(url);
  if (!r.ok) throw new Error("OSRM " + r.status);
  const j = await r.json();
  const route = j.routes && j.routes[0];
  return resultaat(
    route && route.geometry && route.geometry.coordinates,
    route && route.distance,
    route && route.duration,
    env.ROUTE_OSRM_URL ? "osrm-eigen" : "osrm-demo",
  );
}
