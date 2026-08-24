# ASCII-only. Haalt de latijnse subsets van de drie fonts op en zet ze lokaal neer,
# zodat de app offline blijft werken zonder Google Fonts aan te roepen.
# Alle drie staan onder de SIL Open Font License; zelf hosten mag.
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
$root = 'C:\Users\pelle\OneDrive\Documents\p\Programmeren\Claude Code\Apps\Verkeer'
$dir  = Join-Path $root 'fonts'
if (-not (Test-Path $dir)) { New-Item -ItemType Directory -Path $dir | Out-Null }

# Moderne UA is nodig, anders levert Google Fonts ttf in plaats van woff2.
$ua = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
# Variabele assen: één bestand per subset dekt alle gewichten, veel kleiner dan
# losse statische instanties.
$url = 'https://fonts.googleapis.com/css2?family=Manrope:wght@400..800&family=JetBrains+Mono:wght@400..700&display=swap'
$css = (Invoke-WebRequest -Uri $url -Headers @{ 'User-Agent' = $ua } -UseBasicParsing).Content
Write-Output ("css opgehaald: " + $css.Length + " tekens")

# Blokken opsplitsen per @font-face
$blokken = [regex]::Matches($css, '(?s)/\*\s*([a-z0-9-]+)\s*\*/\s*@font-face\s*\{(.*?)\}')
Write-Output ("font-face blokken: " + $blokken.Count)

$wanted = 'latin', 'latin-ext'
$manifest = New-Object System.Collections.Generic.List[string]
$totaal = 0

foreach ($b in $blokken) {
  $subset = $b.Groups[1].Value
  if ($wanted -notcontains $subset) { continue }
  $body = $b.Groups[2].Value

  $fam = [regex]::Match($body, "font-family:\s*'([^']+)'").Groups[1].Value
  # Bij een variabele as staat hier een bereik ("400 800"); dat moet heel blijven,
  # anders werkt maar een gewicht. Voor de bestandsnaam pakken we het eerste getal.
  $wgt = [regex]::Match($body, 'font-weight:\s*([^;]+);').Groups[1].Value.Trim()
  $wgtSlug = [regex]::Match($wgt, '\d+').Value
  $src = [regex]::Match($body, 'url\((https://[^)]+\.woff2)\)').Groups[1].Value
  $rng = [regex]::Match($body, 'unicode-range:\s*([^;]+);').Groups[1].Value.Trim()
  if (-not $src) { continue }

  $slug = ($fam -replace '\s','') + '-' + $wgtSlug + '-' + $subset
  $slug = $slug.ToLowerInvariant()
  $out = Join-Path $dir ($slug + '.woff2')
  Invoke-WebRequest -Uri $src -OutFile $out -UseBasicParsing -TimeoutSec 120
  $kb = [math]::Round((Get-Item $out).Length / 1KB, 1)
  $totaal += (Get-Item $out).Length
  Write-Output ("  {0,-38} {1,6} KB" -f ($slug + '.woff2'), $kb)

  $manifest.Add(@"
@font-face{font-family:'$fam';font-style:normal;font-weight:$wgt;font-display:swap;
  src:url('fonts/$slug.woff2') format('woff2');
  unicode-range:$rng}
"@)
}

$cssOut = @"
/* Zelf gehoste subsets, zodat de app offline werkt en niets naar Google stuurt.
   Instrument Serif, Karla en JetBrains Mono staan onder de SIL Open Font License.
   Opnieuw ophalen kan met tools/build-fonts.ps1. */
$($manifest -join "`n")
"@
[System.IO.File]::WriteAllText((Join-Path $root 'fonts.css'), $cssOut, (New-Object System.Text.UTF8Encoding($false)))
Write-Output ("--- totaal " + [math]::Round($totaal/1KB) + " KB, fonts.css geschreven")
