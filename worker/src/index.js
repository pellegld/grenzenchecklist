/* Cloudflare Worker — de proxy van Grenschecklist.
 *
 * Eén Worker met alle endpoints, en dezelfde modules die functions/api/ als
 * Pages Function gebruikt. Er is dus één implementatie, geen tweede kopie die
 * langzaam uit de pas loopt.
 *
 * Draaien:
 *   npx wrangler dev      (in worker/, met ../.dev.vars voor de sleutels)
 *   npx wrangler deploy
 *
 * De statische bestanden hoeven hier niet doorheen: zet de Worker op een route
 * als jouwdomein.nl/api/* en laat de rest bij je statische host. Dat scheelt
 * aanroepen en houdt de app buiten de Worker-quota.
 */

import { fout } from "./lib/antwoord.js";
import { afhandelRoute } from "./route.js";
import { afhandelGeocode } from "./geocode.js";

export default {
  async fetch(request, env, ctx) {
    if (request.method !== "GET") return fout("alleen GET", 405);

    const pad = new URL(request.url).pathname.replace(/\/+$/, "");

    if (pad.endsWith("/api/route")) return afhandelRoute(request, env, ctx);
    if (pad.endsWith("/api/geocode")) return afhandelGeocode(request, env, ctx);

    return fout("onbekend pad", 404);
  },
};
