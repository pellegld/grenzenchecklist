/* Antwoordvormen die de hele proxy deelt.
 *
 * Eén plek, omdat het contract naar de client (zie README, "Het contract")
 * anders per endpoint uit elkaar loopt zodra er een derde bijkomt. */

export const JSON_TYPE = "application/json; charset=utf-8";

/* Routes zijn een uur houdbaar, plaatsnamen een dag: dezelfde twee plaatsen
 * leveren dezelfde route, en plaatsen verhuizen niet. Dat scheelt fors op je
 * quotum bij de provider. */
export const CACHE_ROUTE = "public, max-age=3600";
export const CACHE_GEOCODE = "public, max-age=86400";

export function json(waarde, { status = 200, cache = "no-store", extra = {} } = {}) {
  return new Response(JSON.stringify(waarde), {
    status,
    headers: { "content-type": JSON_TYPE, "cache-control": cache, ...extra },
  });
}

/* Fouten gaan altijd als { error } terug, nooit als kale statuscode, en nooit
 * met de boodschap van de provider erin — die kan de sleutel bevatten. */
export function fout(bericht, status = 400, extra = {}) {
  return json({ error: bericht }, { status, extra });
}
