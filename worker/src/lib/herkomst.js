/* Herkomstcontrole.
 *
 * Wat dit wel doet: het houdt andere websites tegen die jouw endpoint als
 * gratis routeserver willen gebruiken. Dat is het scenario dat je quotum
 * opmaakt.
 *
 * Wat dit niet doet: authenticatie. Met curl vervals je elke header in een
 * seconde. Daarvoor is de snelheidsbegrenzer in ratelimit.js er — en ook die is
 * een rem, geen slot. Wil je echt afsluiten, dan hoort daar een token bij. */

/* Losse functie met platte argumenten, zodat hij te testen is zonder Request:
   de browser staat scripts niet toe om Origin te zetten. */
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

export function herkomstOk(request, env) {
  return herkomstToegestaan(
    env.TOEGESTANE_HERKOMST,
    request.headers.get("origin"),
    request.headers.get("sec-fetch-site"),
  );
}
