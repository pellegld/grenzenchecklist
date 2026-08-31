/* Wachtwoordcontrole voor de tijdelijke toegangspoort — serverside, want dat
   is het hele punt: het wachtwoord staat in een Netlify-omgevingsvariabele
   (SITE_PASSWORD, in te stellen via Site settings → Environment variables in
   het Netlify-dashboard) en komt nooit in de broncode of in het antwoord aan
   de browser terecht. De browser stuurt alleen een gok; deze functie zegt
   alleen ja of nee.

   Dit beschermt het wachtwoord, niet de site zelf: de statische bestanden
   (index.html, de js/*.js, countries.json) blijven gewoon rechtstreeks op te
   vragen voor wie de URL raadt. Dat is de grens van wat met een puur
   statische site zonder server-side routing te doen is; zie README.md. */

import { timingSafeEqual } from "node:crypto";

/* Constant-time vergelijken: een simpele === zou bij een korte, foute gok
   iets sneller antwoorden dan bij een lange, en dat verschil is in theorie
   meetbaar. Ongelijke lengte is per definitie geen match. */
function veiligGelijk(a, b){
  const bufA = Buffer.from(String(a));
  const bufB = Buffer.from(String(b));
  if(bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

export async function handler(event){
  if(event.httpMethod !== "POST"){
    return { statusCode: 405, body: JSON.stringify({ ok: false }) };
  }

  let wachtwoord;
  try{
    wachtwoord = JSON.parse(event.body || "{}").wachtwoord;
  }catch(e){
    return { statusCode: 400, body: JSON.stringify({ ok: false }) };
  }

  const verwacht = process.env.SITE_PASSWORD;
  if(!verwacht){
    // Geen wachtwoord ingesteld in Netlify: dicht laten staan, niet openzetten.
    return { statusCode: 500, body: JSON.stringify({ ok: false, error: "not-configured" }) };
  }

  const ok = typeof wachtwoord === "string" && wachtwoord.length > 0 && veiligGelijk(wachtwoord, verwacht);
  return {
    statusCode: ok ? 200 : 401,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ok })
  };
}
