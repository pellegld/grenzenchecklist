/* Cloudflare Pages Function op /api/route.
 *
 * Dit bestand is met opzet leeg van logica. De echte afhandeling — validatie,
 * cache op route-hash, snelheidsbegrenzer per IP en de providers zelf — staat in
 * worker/src/route.js, zodat de Worker en de Pages Function dezelfde
 * implementatie delen. Twee kopieën lopen na een half jaar uit de pas, en dan
 * gedraagt je proxy zich anders afhankelijk van waar je hem uitrolt.
 *
 * Instellen en het contract naar de client: zie worker/src/route.js en README. */

import { afhandelRoute } from "../../worker/src/route.js";

export async function onRequestGet(context) {
  return afhandelRoute(context.request, context.env, {
    waitUntil: (p) => context.waitUntil(p),
  });
}
