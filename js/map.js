"use strict";
/* Routeschets als SVG. Geen kaarttegels, dus werkt offline. */

/* ---------------- render: routeschets (SVG, offline — geen kaarttegels) ---------------- */
var MAP_VB_W = 1000, MAP_VB_H = 700, MAP_PAD = 60;

function projecteerRoute(coords){
  var minLon=Infinity,maxLon=-Infinity,minLat=Infinity,maxLat=-Infinity;
  for(var i=0;i<coords.length;i++){
    var lon=coords[i][0], lat=coords[i][1];
    if(lon<minLon) minLon=lon; if(lon>maxLon) maxLon=lon;
    if(lat<minLat) minLat=lat; if(lat>maxLat) maxLat=lat;
  }
  var cosLat = Math.max(0.2, Math.cos((minLat+maxLat)/2 * Math.PI/180));
  var dataW = Math.max(1e-6,(maxLon-minLon)*cosLat), dataH = Math.max(1e-6,(maxLat-minLat));
  var W = MAP_VB_W - MAP_PAD*2, H = MAP_VB_H - MAP_PAD*2;
  var scale = Math.min(W/dataW, H/dataH);
  var offX = MAP_PAD + (W - dataW*scale)/2;
  var offY = MAP_PAD + (H - dataH*scale)/2;
  return function(lon, lat){
    return [offX + (lon-minLon)*cosLat*scale, offY + (maxLat-lat)*scale];
  };
}

function renderRouteSchets(coords){
  var host = document.getElementById("mapwrap");
  if(!coords || !coords.length){
    host.innerHTML = '<div class="mapempty">' + iconUse("map").replace('class="icon sm"','class="icon lg"') +
      '<p>Vul een van en naar in om de route te zien.</p></div>';
    return;
  }
  var proj = projecteerRoute(coords);
  var step = Math.max(1, Math.floor(coords.length / 600));
  var pts = [];
  for(var i=0;i<coords.length;i+=step) pts.push(proj(coords[i][0], coords[i][1]));
  pts.push(proj(coords[coords.length-1][0], coords[coords.length-1][1]));

  var d = pts.map(function(p,i){ return (i===0?"M":"L") + p[0].toFixed(1) + " " + p[1].toFixed(1); }).join(" ");
  var start = proj(coords[0][0], coords[0][1]);
  var end = proj(coords[coords.length-1][0], coords[coords.length-1][1]);

  host.innerHTML =
    '<svg id="routesvg" viewBox="0 0 ' + MAP_VB_W + ' ' + MAP_VB_H + '" preserveAspectRatio="xMidYMid meet" style="transform:scale(' + MAP_ZOOM + ')">' +
      '<path d="' + d + '" class="routeline-glow"></path>' +
      '<path d="' + d + '" class="routeline"></path>' +
      '<circle cx="' + start[0] + '" cy="' + start[1] + '" r="7" class="pt-start"></circle>' +
      '<circle cx="' + end[0] + '" cy="' + end[1] + '" r="8" class="pt-end"></circle>' +
    '</svg>';
}

function applyMapZoom(){
  var svg = document.getElementById("routesvg");
  if(svg) svg.style.transform = "scale(" + MAP_ZOOM + ")";
}
