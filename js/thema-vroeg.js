/* Het thema vóór de eerste render: staat als synchroon script in de <head>
   van index.html, 404.html en de contentpagina's, zodat een bezoeker die
   donker koos geen lichte flits ziet. Stond eerst inline in de kop; de
   Content-Security-Policy (netlify.toml) laat alleen eigen scriptbestanden
   toe, en dit is bewust het enige wat hier gebeurt. */
try{
  var t = localStorage.getItem("grenschecklist.theme.v1");
  if(t === "dark" || t === "light") document.documentElement.setAttribute("data-theme", t);
}catch(e){}
