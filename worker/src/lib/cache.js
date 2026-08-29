/* Cache op route-hash.
 *
 * Dezelfde twee plaatsen leveren dezelfde route. Elke bezoeker die Brussel naar
 * Salzburg intikt hoeft dus niet opnieuw je quotum aan te spreken. De
 * cache-control op het antwoord regelt de browser- en randcache al, maar die is
 * per bezoeker; deze is gedeeld.
 *
 * De sleutel is een SHA-256 over de genormaliseerde vraag, niet over de rauwe
 * URL. Dat maakt hem ongevoelig voor de volgorde van queryparameters en voor
 * jitter in de coördinaten.
 *
 * Waarom afronden op vier decimalen (~11 meter): coördinaten uit cities.json
 * staan al op drie decimalen vast, dus voor de meegeleverde plaatsen is dit een
 * no-op. Voor een geocodeerd punt vangt het het verschil op tussen twee keer
 * hetzelfde adres opzoeken. Belangrijker: de afgeronde waarde gaat óók naar de
 * provider, zodat de sleutel en het antwoord bij elkaar horen. Een sleutel
 * maken van afgeronde coördinaten en dan de rauwe doorsturen levert een cache
 * op die het antwoord van iemand anders teruggeeft.
 */

export const COORD_DECIMALEN = 4;

export function rondAf(getal) {
  const f = 10 ** COORD_DECIMALEN;
  return Math.round(Number(getal) * f) / f;
}

async function sha256(tekst) {
  const bytes = new TextEncoder().encode(tekst);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/* Cachesleutels moeten een geldige URL zijn; het domein bestaat niet en wordt
 * nooit opgevraagd, het is puur een naamruimte. */
export async function cacheSleutel(soort, delen) {
  const hash = await sha256(JSON.stringify(delen));
  return new Request(`https://cache.grenschecklist.invalid/${soort}/${hash}`, { method: "GET" });
}

/* caches.default bestaat niet in elke omgeving (o.a. wrangler dev zonder
 * --remote). Ontbreekt hij, dan draait alles gewoon door zonder cache. */
function beschikbaar() {
  return typeof caches !== "undefined" && caches.default;
}

export async function uitCache(sleutel) {
  if (!beschikbaar()) return null;
  try {
    return (await caches.default.match(sleutel)) || null;
  } catch {
    return null;
  }
}

/* De cache mag pas geschreven worden nadat het antwoord de deur uit is, anders
 * wacht de bezoeker op ons huishoudwerk — vandaar waitUntil. */
export function naarCache(sleutel, response, ctx) {
  if (!beschikbaar() || !response.ok) return;
  const kopie = response.clone();
  const werk = caches.default.put(sleutel, kopie).catch(() => {});
  if (ctx && ctx.waitUntil) ctx.waitUntil(werk);
}

/* Zodat je in de browser kunt zien of het werkt zonder in de logs te duiken. */
export function metCacheHeader(response, status) {
  const kop = new Headers(response.headers);
  kop.set("x-cache", status);
  return new Response(response.body, { status: response.status, headers: kop });
}
