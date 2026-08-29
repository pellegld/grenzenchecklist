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
  var toggle = document.getElementById("dark-toggle");
  if(toggle) toggle.checked = donker;
}
function wisselThema(donker){
  lsSet(STORE_THEME, donker ? "dark" : "light");
  toepassenThema();
}
