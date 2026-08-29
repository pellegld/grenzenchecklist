/* Cloudflare Pages Function op /api/v1/data/<bestand>.
 *
 * Leeg van logica, net als de andere twee: de afhandeling staat in
 * worker/src/data.js en wordt gedeeld met de Worker. */

import { afhandelData } from "../../../../worker/src/data.js";

export async function onRequestGet(context) {
  return afhandelData(context.request, context.env, {
    waitUntil: (p) => context.waitUntil(p),
  });
}
