/* Cloudflare Pages Function op /api/geocode.
 *
 * Zelfde reden als route.js om leeg te zijn: de afhandeling staat in
 * worker/src/geocode.js, gedeeld met de Worker. */

import { afhandelGeocode } from "../../worker/src/geocode.js";

export async function onRequestGet(context) {
  return afhandelGeocode(context.request, context.env, {
    waitUntil: (p) => context.waitUntil(p),
  });
}
