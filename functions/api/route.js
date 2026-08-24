/* Routeproxy — Cloudflare Pages Function op /api/route.
 *
 * Bestaansreden: de sleutel van een routeringsdienst mag de browser nooit
 * bereiken. Hij staat hier in env, die je bij je host als secret invult; in de
 * repo staat hij niet en in de bundle evenmin.
 *
 * Contract naar de client:
 *   GET /api/route?from=<lon>,<lat>&to=<lon>,<lat>
 *   200 { coordinates:[[lon,lat],...], meters:<n>, provider:"<naam>" }
 *   4xx { error:"<uitleg>" }
 *
 * Instellen bij de host (Pages > Settings > Variables and Secrets):
 *   ROUTE_PROVIDER  ors | graphhopper | osrm      (standaard: osrm)
 *   ROUTE_KEY       de sleutel                    (niet nodig bij osrm)
 *   ROUTE_OSRM_URL  eigen OSRM-instantie          (optioneel)
 *   TOEGESTANE_HERKOMST  https://jouwdomein.nl    (optioneel, zie hieronder)
 */

const JSON_HEADERS = {
  "content-type": "application/json; charset=utf-8",
  // Antwoorden mogen best even blijven hangen: dezelfde twee plaatsen leveren
  // dezelfde route, en het scheelt aanroepen op je quotum.
  "cache-control": "public, max-age=3600",
};

function fout(bericht, status) {
  return new Response(JSON.stringify({ error: bericht }), {
    status: status || 400,
    headers: JSON_HEADERS,
  });
}

/* Alleen lon,lat-paren binnen bereik. Zonder deze controle stuur je willekeurige
   invoer van een vreemde door naar een dienst die jij betaalt. */
function punt(waarde) {
  if (!waarde) return null;
  const delen = String(waarde).split(",");
  if (delen.length !== 2) return null;
  const lon = Number(delen[0]);
  const lat = Number(delen[1]);
  if (!isFinite(lon) || !isFinite(lat)) return null;
  if (lon < -180 || lon > 180 || lat < -90 || lat > 90) return null;
  return [lon, lat];
}

/* Losse functie met platte argumenten, zodat hij te testen is zonder Request:
   de browser staat scripts niet toe om Origin te zetten.

   Wat dit wel en niet doet. Het houdt andere websites tegen die jouw endpoint
   als gratis routeserver willen gebruiken; dat is het scenario dat je quotum
   opmaakt. Het is geen authenticatie: met curl vervals je elke header in een
   seconde. Wil je echt afsluiten, dan hoort daar een token of een
   snelheidsbegrenzer per IP bij. */
export function herkomstToegestaan(toegestaan, origin, secFetchSite) {
  if (!toegestaan) return true;
  const lijst = toegestaan.split(",").map((h) => h.trim()).filter(Boolean);

  // Staat Origin erin, dan is dat doorslaggevend, in beide richtingen.
  if (origin) return lijst.includes(origin);

  // Geen Origin, maar de browser zegt zelf dat het van onze eigen pagina komt.
  if (secFetchSite === "same-origin" || secFetchSite === "none") return true;

  // Geen van beide: dit komt niet van een browser op onze site.
  return false;
}

function herkomstOk(request, env) {
  return herkomstToegestaan(
    env.TOEGESTANE_HERKOMST,
    request.headers.get("origin"),
    request.headers.get("sec-fetch-site"),
  );
}

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);

  if (!herkomstOk(request, env)) return fout("herkomst niet toegestaan", 403);

  // De client klopt eerst even aan om te weten of er een proxy draait.
  if (url.searchParams.get("ping")) {
    return new Response(
      JSON.stringify({ ok: true, provider: env.ROUTE_PROVIDER || "osrm" }),
      { headers: JSON_HEADERS },
    );
  }

  const van = punt(url.searchParams.get("from"));
  const naar = punt(url.searchParams.get("to"));
  if (!van || !naar) return fout("from en to moeten <lon>,<lat> zijn");

  const provider = (env.ROUTE_PROVIDER || "osrm").toLowerCase();

  try {
    if (provider === "ors") return await viaOrs(van, naar, env);
    if (provider === "graphhopper") return await viaGraphhopper(van, naar, env);
    return await viaOsrm(van, naar, env);
  } catch (e) {
    // De boodschap van de provider kan de sleutel bevatten; die gaat niet terug
    // naar de client. In je hostlogs staat de echte fout wel.
    console.error("routeproxy", provider, e && e.message);
    return fout("route bepalen lukte niet", 502);
  }
}

function antwoord(coordinates, meters, provider) {
  if (!coordinates || !coordinates.length) return fout("geen route gevonden", 404);
  return new Response(
    JSON.stringify({ coordinates, meters: Math.round(meters || 0), provider }),
    { headers: JSON_HEADERS },
  );
}

/* --- OpenRouteService: sleutel in de header, niet in de URL --- */
async function viaOrs([vanLon, vanLat], [naarLon, naarLat], env) {
  if (!env.ROUTE_KEY) return fout("ROUTE_KEY ontbreekt", 500);
  const r = await fetch(
    "https://api.openrouteservice.org/v2/directions/driving-car/geojson",
    {
      method: "POST",
      headers: {
        Authorization: env.ROUTE_KEY,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        coordinates: [[vanLon, vanLat], [naarLon, naarLat]],
        geometry_simplify: false,
      }),
    },
  );
  if (!r.ok) throw new Error("ORS " + r.status);
  const j = await r.json();
  const f = j.features && j.features[0];
  return antwoord(
    f && f.geometry && f.geometry.coordinates,
    f && f.properties && f.properties.summary && f.properties.summary.distance,
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
  return antwoord(
    pad && pad.points && pad.points.coordinates,
    pad && pad.distance,
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
  return antwoord(
    route && route.geometry && route.geometry.coordinates,
    route && route.distance,
    env.ROUTE_OSRM_URL ? "osrm-eigen" : "osrm-demo",
  );
}
