"use strict";
/* Het reisdocument: één pagina die je meeneemt.

   Dit is de printbare samenvatting van §11, gebouwd uit precies dezelfde
   bouwers als de rest van de app (bouwActies, tolRegels, tripFeiten). Er staat
   dus niets in wat je op het scherm niet ook ziet — een document dat afwijkt
   van de app is erger dan geen document.

   Het staat op de bestaande @media print-stylesheet, niet ernaast: die zet deze
   pagina zwart-op-wit, haalt de bediening weg en schrijft alle bron-URL's
   voluit achter de linkteksten. Afdrukken naar PDF doet elke browser zelf; een
   eigen PDF-generator zou een afhankelijkheid zijn voor iets wat de browser al
   beter kan.

   Wat er nog niet in zit: het offline reispack uit fase 6. */

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

/* De kosten, in dezelfde vier categorieën en met dezelfde zekerheid als op de
   kostenpagina (§10). Juist op papier moet die aanduiding mee: een uitdraai met
   een bedrag erop wordt aan de balie voorgehouden alsof het een prijsopgave is,
   en dan hoort er "indicatief" of "onbekend" naast te staan.

   Het teken (✓ ~ ? —) draagt hier het verschil, niet de kleur: dit blad komt in
   zwart-wit uit de printer. */
function docKostenRij(p){
  var land = p.c && p.c.name !== p.naam ? esc(p.c.name) + " · " : "";
  return "<tr><td>" + land + esc(p.naam) +
    '<span class="sub">' + esc(p.detail) + "</span></td>" +
    '<td class="dokzeker"><span aria-hidden="true">' + KOSTEN_TEKEN[p.zekerheid] + "</span> " +
      esc(i18n("kosten.zeker." + p.zekerheid)) + "</td>" +
    "<td>" + (KOSTEN_MEETELLEN[p.zekerheid]
      ? "&euro;" + (p.laag === p.hoog ? euroTekst(Math.round(p.hoog))
          : euroTekst(Math.round(p.laag)) + "–" + euroTekst(Math.round(p.hoog)))
      : "—") + "</td></tr>";
}

function docKosten(trip){
  var k = kostenOverzicht(trip);
  var body = k.categorieen.map(function(cat){
    if(!cat.posten.length) return "";
    return '<tr class="dokkop"><th colspan="3">' + esc(i18n("kosten.kat." + cat.sleutel)) + "</th></tr>" +
      cat.posten.map(docKostenRij).join("");
  }).join("");
  if(!body) return "";

  var totaal = k.meegeteld
    ? "<tfoot><tr><td>" + esc(i18n("kosten.geschat")) + '</td><td></td><td>&euro;' +
      (k.laag === k.hoog ? euroTekst(k.hoog) : euroTekst(k.laag) + "–&euro;" + euroTekst(k.hoog)) +
      (k.ofMeer ? " " + esc(i18n("planner.ofMeer")) : "") + "</td></tr></tfoot>"
    : "";

  return '<table class="doctabel dokosten"><tbody>' + body + "</tbody>" + totaal + "</table>" +
    '<p class="docnoot">' + esc(i18n(k.meegeteld ? "kosten.nietMeeUitleg"
                                                : "kosten.nietMeeGeenTotaal")) + "</p>";
}

/* Waarschuwingen: het oordeel over de milieuzones per land, in één zin per land.
   Dit is wat je bij een zonebord nodig hebt, en het is precies het soort ding
   dat je niet op je telefoon wilt opzoeken terwijl er achter je getoeterd
   wordt. Alleen de landen waar iets te melden valt — "je mag hier gewoon in"
   hoeft geen regel op papier. */
function docWaarschuwingen(trip){
  var rijen = [];
  tripLanden(trip).forEach(function(code){
    var c = BY_CODE[code];
    var v = zoneVerdict(c, trip);
    if(!v || v.level === "ok") return;
    rijen.push('<li class="w-' + esc(v.level) + '">' +
      '<span class="wteken" aria-hidden="true">' + (v.level === "bad" ? "!" : "?") + "</span>" +
      "<b>" + esc(c.name) + "</b> — " + esc(v.text) + "</li>");
  });
  return rijen.length ? '<ul class="docwaarschuwingen">' + rijen.join("") + "</ul>" : "";
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

/* Alles openklappen voordat de printer begint, en daarna terugzetten.

   De regelpagina en de landkaarten werken met <details> (§15), en de inhoud van
   een dichtgeklapte <details> is voor de printer niet zomaar zichtbaar te
   maken: engines verbergen die via een intern mechanisme waar `display` in de
   printstylesheet niet altijd bij komt. Het attribuut zetten werkt wel, in elke
   browser, en dit is de enige plek waar dat hoeft.

   Dit hangt aan het venster en niet aan de knop: ctrl+P, het menu van de
   browser en "opslaan als PDF" komen alle drie hier langs. */
var DOC_OPENGEZET = [];

function klapAllesOpen(){
  DOC_OPENGEZET = [].filter.call(document.querySelectorAll("details:not([open])"), function(d){
    return !d.closest("[hidden]");
  });
  DOC_OPENGEZET.forEach(function(d){ d.open = true; });
}

function klapTerug(){
  DOC_OPENGEZET.forEach(function(d){ d.open = false; });
  DOC_OPENGEZET = [];
}

function wireDocument(){
  if(window.matchMedia){
    /* Safari kent beforeprint/afterprint niet en gebruikt de media-listener. */
    var mq = window.matchMedia("print");
    var luister = mq.addEventListener ? mq.addEventListener.bind(mq, "change") : null;
    if(luister) luister(function(e){ if(e.matches) klapAllesOpen(); else klapTerug(); });
  }
  window.addEventListener("beforeprint", klapAllesOpen);
  window.addEventListener("afterprint", klapTerug);
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
      docSectie(i18n("document.waarschuwingen"), docWaarschuwingen(TRIP)) +
      docSectie(i18n("document.douane"), docDouane(TRIP)) +
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
