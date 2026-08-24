/* Geocodeerproxy — Cloudflare Pages Function op /api/geocode.
 *
 * Zelfde reden als route.js: de sleutel blijft aan deze kant.
 *
 * Contract naar de client:
 *   GET /api/geocode?q=<tekst>
 *   200 { results:[{ naam, omschrijving, land, lat, lon }], provider:"<naam>" }
 *   4xx { error:"<uitleg>" }
 *
 * Instellen bij de host:
 *   GEO_PROVIDER  ors | nominatim          (standaard: nominatim)
 *   GEO_KEY       de sleutel               (niet nodig bij nominatim)
 *   GEO_UA        contactadres voor de User-Agent van Nominatim
 *   TOEGESTANE_HERKOMST  https://jouwdomein.nl
 *
 * Let op bij nominatim: het gebruiksbeleid vraagt om een identificeerbare
 * User-Agent en maximaal een aanvraag per seconde. Een proxy bundelt al jouw
 * bezoekers achter een IP, dus voor echt verkeer hoort hier een dienst met
 * sleutel te staan.
 */

const JSON_HEADERS = {
  "content-type": "application/json; charset=utf-8",
  // Plaatsnamen verhuizen niet; een dag cachen scheelt fors op je quotum.
  "cache-control": "public, max-age=86400",
};

function fout(bericht, status) {
  return new Response(JSON.stringify({ error: bericht }), {
    status: status || 400,
    headers: JSON_HEADERS,
  });
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

  if (url.searchParams.get("ping")) {
    return new Response(
      JSON.stringify({ ok: true, provider: env.GEO_PROVIDER || "nominatim" }),
      { headers: JSON_HEADERS },
    );
  }

  const q = (url.searchParams.get("q") || "").trim();
  if (q.length < 2) return fout("q moet minstens twee tekens zijn");
  if (q.length > 120) return fout("q is te lang");

  const provider = (env.GEO_PROVIDER || "nominatim").toLowerCase();

  try {
    if (provider === "ors") return await viaOrs(q, env);
    return await viaNominatim(q, env);
  } catch (e) {
    console.error("geocodeproxy", provider, e && e.message);
    return fout("zoeken lukte niet", 502);
  }
}

function antwoord(results, provider) {
  return new Response(JSON.stringify({ results, provider }), { headers: JSON_HEADERS });
}

/* --- OpenRouteService Pelias --- */
async function viaOrs(q, env) {
  if (!env.GEO_KEY) return fout("GEO_KEY ontbreekt", 500);
  const url = "https://api.openrouteservice.org/geocode/search?size=5&text=" +
    encodeURIComponent(q);
  const r = await fetch(url, { headers: { Authorization: env.GEO_KEY } });
  if (!r.ok) throw new Error("ORS " + r.status);
  const j = await r.json();
  const results = (j.features || []).map((f) => {
    const p = f.properties || {};
    return {
      naam: p.name || p.label,
      omschrijving: p.label,
      // Pelias geeft ISO3; de app werkt met ISO2.
      land: ISO3_NAAR_ISO2[p.country_a] || "",
      lon: f.geometry.coordinates[0],
      lat: f.geometry.coordinates[1],
    };
  });
  return antwoord(results, "openrouteservice");
}

/* --- Nominatim --- */
async function viaNominatim(q, env) {
  const url = "https://nominatim.openstreetmap.org/search" +
    "?format=jsonv2&limit=5&addressdetails=1&accept-language=nl&q=" +
    encodeURIComponent(q);
  const r = await fetch(url, {
    headers: {
      "User-Agent": env.GEO_UA || "Grenschecklist (stel GEO_UA in met je contactadres)",
      "Accept-Language": "nl",
    },
  });
  if (!r.ok) throw new Error("Nominatim " + r.status);
  const lijst = await r.json();
  const results = lijst.map((h) => ({
    naam: String(h.display_name).split(",")[0],
    omschrijving: h.display_name,
    land: ((h.address && h.address.country_code) || "").toUpperCase(),
    lat: Number(h.lat),
    lon: Number(h.lon),
  }));
  return antwoord(results, "nominatim");
}

/* Alleen de landen die de app kent; de rest levert een lege landcode op en valt
   in de app vanzelf buiten de boot. */
const ISO3_NAAR_ISO2 = {
  BEL: "BE", NLD: "NL", DEU: "DE", FRA: "FR", LUX: "LU", AUT: "AT", CHE: "CH",
  ITA: "IT", ESP: "ES", PRT: "PT", HRV: "HR", SVN: "SI", CZE: "CZ", DNK: "DK",
  SWE: "SE", GBR: "GB",
};
