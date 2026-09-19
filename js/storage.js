"use strict";
/* localStorage die nooit gooit, plus de donkere modus.
   
   Beide zijn browseropslag: een browser in privémodus of met opslag uit laat
   localStorage gooien, en dan mag de app niet omvallen. */

/* ---------------- storage helpers (never throw) ---------------- */
function lsGet(k){ try{ return localStorage.getItem(k); }catch(e){ return null; } }
function lsSet(k,v){ try{ localStorage.setItem(k,v); }catch(e){} }

/* ---------------- donkere modus ----------------
   Volgt het systeem (prefers-color-scheme) totdat de gebruiker de schakelaar
   onder Instellingen zelf omzet; dan staat de keuze vast in localStorage en
   wint hij van het systeem. Het flits-vrije scriptje bovenin <head> zet het
   data-theme-attribuut al vóór de eerste render; dit hier houdt de twee
   schakelaars (zijbalk + mobiele topbar) in de juiste stand. */
function huidigThema(){
  var t = lsGet(STORE_THEME);
  if(t === "dark" || t === "light") return t;
  return (window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches) ? "dark" : "light";
}
function toepassenThema(){
  var t = lsGet(STORE_THEME);
  if(t === "dark" || t === "light") document.documentElement.setAttribute("data-theme", t);
  else document.documentElement.removeAttribute("data-theme");
  var donker = huidigThema() === "dark";
  /* De kleur van de browserbalk (theme-color in index.html) volgt het papier:
     een media-query op de meta zou de eigen keuze van de gebruiker negeren. */
  var meta = document.querySelector('meta[name="theme-color"]');
  if(meta) meta.setAttribute("content", donker ? "#15171B" : "#F2EAD7");
  /* Twee schakelaars: onder Instellingen in de zijbalk en in het Meer-paneel op
     mobiel. Ze staan altijd in dezelfde stand, ook als je de andere gebruikt. */
  ["dark-toggle", "dark-toggle-meer"].forEach(function(id){
    var toggle = document.getElementById(id);
    if(toggle) toggle.checked = donker;
  });
}
function wisselThema(donker){
  lsSet(STORE_THEME, donker ? "dark" : "light");
  toepassenThema();
}
