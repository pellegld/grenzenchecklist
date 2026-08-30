"use strict";
/* Het reisdocument: één pagina die je meeneemt.

   Dit is de printbare samenvatting van §11, gebouwd uit precies dezelfde
   bouwers als de rest van de app (bouwActies, tolRegels, tripFeiten). Er staat
   dus niets in wat je op het scherm niet ook ziet — een document dat afwijkt
   van de app is erger dan geen document.

   Wat er nog niet in zit: het offline reispack en de losse PDF-export uit fase 6
   van de masterprompt. Wat er wél is: de bestaande @media print-stylesheet, die
   deze pagina zwart-op-wit zet en alle bron-URL's voluit achter de linkteksten
   plaatst. Afdrukken naar PDF doet elke browser zelf. */

function docSectie(kop, inhoud){
  if(!inhoud) return "";
  return '<section class="docsectie"><h2>' + esc(kop) + "</h2>" + inhoud + "</section>";
}

/* De acties, in dezelfde groepen als op het scherm. Op papier staat er een
   leeg vakje voor wat nog moet en een kruisje voor wat af is, plus de deadline —
   dat is wat een uitdraai bruikbaar maakt naast het stuur. */
function docActieLijst(trip){
  var groepen = groepeerActies(bouwActies(trip));
  return groepen.map(function(g){
    return '<h3 class="docgroep">' + esc(i18n("groep." + g.sleutel)) + "</h3>" +
      '<ul class="doclijst">' + g.acties.map(function(a){
        return '<li class="' + (a.afgevinkt ? "af" : a.status === "blokkade" ? "blok" : "open") + '">' +
          (a.afvinkbaar
            ? '<span class="vak" aria-hidden="true">' + (a.afgevinkt ? "×" : "") + "</span>"
            : '<span class="vak leeg" aria-hidden="true">' + STATUS_TEKEN[a.status] + "</span>") +
          esc(a.wat) +
          (a.deadline ? ' <span class="docdeadline">' + esc(deadlineTekst(a.deadline)) + "</span>" : "") +
          (a.landen.length ? '<span class="sub">' +
            esc(a.landen.map(function(c){ return c.name; }).join(" · ")) +
            (a.waarom ? " — " + esc(a.waarom) : "") + "</span>" : "") +
        "</li>";
      }).join("") + "</ul>";
  }).join("");
}

function docKosten(trip){
  var rijen = tolRegels(trip);
  if(!rijen.length) return "";
  var tol = tolTotaalRetour(trip);
  return '<table class="doctabel"><tbody>' + rijen.map(function(r){
    return "<tr><td>" + esc(r.naam) + '<span class="sub">' + esc(r.detail) + "</span></td>" +
      "<td>" + tolBedragHTML(r) + "</td></tr>";
  }).join("") + "</tbody>" +
  (tol ? "<tfoot><tr><td>" + esc(i18n("kosten.totaalRetour")) + "</td><td>&euro;" +
    euroTekst(tol.bedrag) + (tol.zeker ? "" : " " + esc(i18n("planner.ofMeer"))) + "</td></tr></tfoot>" : "") +
  "</table>";
}

function docBronnen(trip){
  var gezien = {}, rijen = [];
  tripFeiten(trip).forEach(function(f){
    if(!f.sourceUrl || gezien[f.sourceUrl]) return;
    gezien[f.sourceUrl] = 1;
    rijen.push("<li>" + (f.land ? esc(f.land.name) + " — " : "") +
      '<a href="' + esc(f.sourceUrl) + '" target="_blank" rel="noopener">' +
      esc(f.label || f.sourceUrl) + "</a></li>");
  });
  return rijen.length ? '<ul class="docbronnen">' + rijen.join("") + "</ul>" : "";
}

function renderDocument(){
  var wrap = document.getElementById("document-wrap");
  if(!wrap || !TRIP || !DATA) return;
  if(!tripIsKlaar(TRIP)){
    wrap.innerHTML = '<div class="leegstaat">' + iconUse("doc").replace('class="icon sm"', 'class="icon lg"') +
      "<h1>" + esc(i18n("document.leegKop")) + "</h1>" +
      "<p>" + esc(i18n("document.leegTekst")) + "</p>" +
      '<button type="button" class="btn primary" data-view="wizard">' + esc(i18n("home.cta")) + "</button></div>";
    return;
  }

  var landen = tripLanden(TRIP).map(function(code){
    var c = BY_CODE[code];
    return '<span class="chip">' + flagHTML(c) + esc(c.name) + "</span>";
  }).join("");

  var v = vertrouwenTelling(TRIP);
  var r = boeteRisico(TRIP);

  wrap.innerHTML =
    '<div class="docacties">' +
      '<button type="button" class="btn primary" id="btn-print">' + iconUse("doc") + " " +
        esc(i18n("document.print")) + "</button>" +
      '<p class="hint">' + esc(i18n("document.printHint")) + "</p>" +
    "</div>" +
    '<article class="reisdocument">' +
      '<header class="dockop"><h1>' + esc(TRIP.naam) + "</h1>" +
        "<p>" + esc(reisPeriodeTekst(TRIP)) + "</p>" +
        "<p>" + esc(voertuigSamenvatting(TRIP)) + "</p>" +
        '<p class="docdatum">' + esc(i18n("document.gemaaktOp", { datum:fmtDate(vandaagISO()) })) + "</p>" +
      "</header>" +
      docSectie(i18n("document.landen"), '<div class="docchips">' + landen + "</div>") +
      docSectie(i18n("document.acties"), docActieLijst(TRIP)) +
      docSectie(i18n("document.kosten"), docKosten(TRIP)) +
      docSectie(i18n("document.risico"),
        r.open ? "<p>" + esc(i18n("dashboard.boete.zin", {
          bedrag: (r.metBedrag ? "€" + getal(r.laag) + (r.hoog !== r.laag ? "–€" + getal(r.hoog) : "") +
                   (r.ofMeer ? " " + i18n("planner.ofMeer") : "") : i18n("document.bedragOnbekend"))
        })) + "</p>" : "") +
      docSectie(i18n("document.bronnen"), docBronnen(TRIP)) +
      '<footer class="docvoet"><p>' + esc(i18n("vertrouwen.zin", {
        n:v.totaal, official:v.official, verified:v.verified, uncertain:v.uncertain })) + "</p>" +
        "<p>" + esc(v.laatstGecontroleerd
          ? i18n("vertrouwen.laatst", { datum:fmtDate(v.laatstGecontroleerd) })
          : i18n("vertrouwen.geenDatum")) + "</p>" +
        "<p>" + esc(i18n("disclaimer.body")) + "</p></footer>" +
    "</article>";
}
