/* Snelheidsbegrenzer per IP.
 *
 * Waarom dit er is: de proxy bundelt al je bezoekers achter één IP richting de
 * provider. Zonder rem is dat geen bescherming maar een versterker — één script
 * dat je endpoint vindt, trekt je quotum leeg en zet je hele site zonder routes.
 *
 * Twee lagen, allebei bewust bescheiden:
 *
 * 1. Een teller in het geheugen van de isolate. Gratis, direct, en nul
 *    afhankelijkheden. Nadeel: Cloudflare draait meerdere isolates naast
 *    elkaar, dus een aanvaller die over isolates verspreid raakt, krijgt per
 *    isolate opnieuw zijn budget. Als rem tegen een doorgeslagen script of een
 *    scraper werkt hij prima.
 *
 * 2. Een teller in KV, als de binding RATELIMIT bestaat. Die geldt over
 *    isolates heen. KV is uiteindelijk consistent: onder gelijktijdige
 *    aanvragen telt hij eerder te laag dan te hoog. Ook dit is dus een rem, geen
 *    slot — voor een hard slot heb je een Durable Object nodig, en dat is een
 *    andere prijsklasse dan waar deze app nu zit.
 *
 * De keuze om het niet zwaarder te maken is expliciet: wat je hier tegenhoudt
 * is misbruik van je quotum, niet een aanval op je gegevens. Er staan geen
 * gegevens achter deze endpoints.
 */

/* Sliding window per isolate. Sleutel -> array met tijdstempels. */
const GEHEUGEN = new Map();

/* Opruimen zodat een langlevende isolate niet volloopt met oude IP's. */
function opruimen(nu, venster) {
  if (GEHEUGEN.size < 5000) return;
  for (const [sleutel, stempels] of GEHEUGEN) {
    if (!stempels.some((t) => nu - t < venster)) GEHEUGEN.delete(sleutel);
  }
}

function inGeheugen(sleutel, limiet, vensterMs) {
  const nu = Date.now();
  opruimen(nu, vensterMs);
  const stempels = (GEHEUGEN.get(sleutel) || []).filter((t) => nu - t < vensterMs);
  stempels.push(nu);
  GEHEUGEN.set(sleutel, stempels);
  return { over: Math.max(0, limiet - stempels.length), teveel: stempels.length > limiet };
}

async function inKV(kv, sleutel, limiet, vensterSec) {
  /* Vaste vensters in plaats van glijdende: één get en één put per aanvraag.
     Een glijdend venster in KV zou per aanvraag de hele lijst moeten lezen en
     terugschrijven, en dat is duurder dan het probleem. */
  const bak = Math.floor(Date.now() / 1000 / vensterSec);
  const k = `rl:${sleutel}:${bak}`;
  const huidig = Number((await kv.get(k)) || 0) + 1;
  /* expirationTtl moet bij Cloudflare KV minstens 60 zijn. */
  await kv.put(k, String(huidig), { expirationTtl: Math.max(60, vensterSec * 2) });
  return { over: Math.max(0, limiet - huidig), teveel: huidig > limiet };
}

/* Het IP zoals Cloudflare het aanlevert. Achter een andere proxy kan dat
 * ontbreken; dan vallen alle aanvragen op één emmer, wat streng is maar veilig.
 * Het IP wordt nergens opgeslagen buiten deze teller en gaat niet in een log. */
export function clientIp(request) {
  return request.headers.get("cf-connecting-ip") ||
         request.headers.get("x-real-ip") ||
         "onbekend";
}

/**
 * @param {Request} request
 * @param {object}  env
 * @param {string}  emmer     naam van het endpoint, zodat /route en /geocode
 *                            hun eigen budget hebben
 * @param {number}  limiet    aanvragen per venster
 * @param {number}  vensterSec
 * @returns {Promise<{teveel:boolean, over:number, herprobeerNa:number}>}
 */
export async function begrens(request, env, emmer, limiet, vensterSec) {
  const uit = Number(env[`LIMIET_${emmer.toUpperCase()}`]) || limiet;
  if (uit <= 0) return { teveel: false, over: Infinity, herprobeerNa: 0 };

  const sleutel = `${emmer}:${clientIp(request)}`;
  const lokaal = inGeheugen(sleutel, uit, vensterSec * 1000);
  if (lokaal.teveel) return { ...lokaal, herprobeerNa: vensterSec };

  if (env.RATELIMIT) {
    try {
      const gedeeld = await inKV(env.RATELIMIT, sleutel, uit, vensterSec);
      if (gedeeld.teveel) return { ...gedeeld, herprobeerNa: vensterSec };
      return { ...gedeeld, herprobeerNa: 0 };
    } catch {
      /* KV even niet bereikbaar mag geen 500 opleveren: de teller in het
         geheugen heeft dan al gezegd dat het mag. */
    }
  }
  return { ...lokaal, herprobeerNa: 0 };
}

export function begrensHeaders(uitslag, limiet) {
  return {
    "x-ratelimit-limit": String(limiet),
    "x-ratelimit-remaining": String(Number.isFinite(uitslag.over) ? uitslag.over : limiet),
  };
}
