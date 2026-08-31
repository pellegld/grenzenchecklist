"use strict";
/* De tijdelijke toegangspoort.

   Geen account, en geen echte beveiliging van de bestanden zelf — dit blijft
   een statische site, dus wie de URL van index.html of countries.json raadt
   kan die gewoon ophalen. Wat deze poort wél doet: het wachtwoord staat
   nergens in de broncode. De browser stuurt een gok naar een Netlify
   Function (netlify/functions/check-password.js), die hem serverside
   vergelijkt met de omgevingsvariabele SITE_PASSWORD en alleen ja of nee
   teruggeeft. Devtools, view source, het netwerktabblad — nergens staat het
   wachtwoord zelf.

   Het scriptje in <head> zet data-poort-open al vóór de eerste render als de
   vorige ontgrendeling nog in localStorage staat, zodat een teruggekeerde
   bezoeker geen flits van het slotscherm ziet. Dit bestand doet de rest:
   het formulier, de aanroep, en #app weer bereikbaar maken voor
   toetsenbord en schermlezers. */

function poortOntgrendeld(){
  return lsGet(STORE_POORT) === "1";
}

function poortOpen(){
  var wrap = document.getElementById("poortwrap");
  var app = document.getElementById("app");
  var sos = document.getElementById("btn-incident");
  if(wrap) wrap.hidden = true;
  if(app){ app.removeAttribute("inert"); app.removeAttribute("aria-hidden"); }
  /* De incidentknop staat buiten #app (zie index.html) en draagt daarom zijn
     eigen inert-attribuut, dat hier los ontgrendeld moet worden. */
  if(sos) sos.removeAttribute("inert");
}

function poortWire(){
  if(poortOntgrendeld()){ poortOpen(); return; }

  var form = document.getElementById("poortform");
  if(!form) return;
  var veld = document.getElementById("poort-wachtwoord");
  var fout = document.getElementById("poort-fout");
  var knop = form.querySelector("button[type=submit]");

  veld.focus();

  form.addEventListener("submit", function(e){
    e.preventDefault();
    fout.hidden = true;
    knop.disabled = true;

    fetch("/.netlify/functions/check-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ wachtwoord: veld.value })
    })
      .then(function(r){
        return r.json().catch(function(){ return {}; }).then(function(d){ return { status:r.status, ok:!!d.ok }; });
      })
      .then(function(res){
        knop.disabled = false;
        if(res.ok){
          lsSet(STORE_POORT, "1");
          poortOpen();
          return;
        }
        fout.hidden = false;
        fout.textContent = i18n(res.status === 500 ? "poort.foutNietIngesteld" : "poort.foutOnjuist");
        veld.value = "";
        veld.focus();
      })
      .catch(function(){
        knop.disabled = false;
        fout.hidden = false;
        fout.textContent = i18n("poort.foutNetwerk");
      });
  });
}

poortWire();
